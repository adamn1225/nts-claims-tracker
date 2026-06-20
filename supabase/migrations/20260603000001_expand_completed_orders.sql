-- ─────────────────────────────────────────────────────────────────────────────
-- Expand completed_orders to capture the full CRM export.
--
-- Background: the original completed_orders table only ingested ~17 columns
-- from the CRM export. The full export carries customer identity, structured
-- dims/weight, distance, marketing attribution, and broker branch — all of
-- which unlock the freight-broker analytics roadmap (Customer 360, Lane Rate
-- Card v2, Campaign ROI, etc.).
--
-- Strategy:
--   1. Add the missing raw CRM columns (preserve original CSV strings).
--   2. Add typed/normalized mirror columns for analytics:
--        - carrier_pay_numeric, quote_price_numeric, cargo_value_numeric,
--          broker_balance_numeric  (NUMERIC, parsed from "$40K"-style text)
--        - distance_miles, duration_minutes (NUMERIC)
--        - length_ft, width_ft, height_ft, weight_lbs (NUMERIC)
--        - equipment_type (normalized enum-like TEXT)
--        - is_oversize, is_overweight, is_superload (BOOLEAN)
--        - margin_amount, margin_pct (NUMERIC, generated)
--   3. Add indexes for the dashboards we are about to build (shipper email,
--      campaign source, broker branch, equipment, oversize, recency).
--
-- This migration is additive. Existing rows keep their values; new columns
-- backfill as the CSV reimport runs.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Raw CRM columns ──────────────────────────────────────────────────────

-- The expanded CRM export (ClientSourceWiseData) includes pre-book quotes
-- where carrier_company_name is legitimately unknown. Relax the NOT NULL
-- constraint so we can ingest those rows too. The carrier_company_name index
-- already excludes nulls behaviorally for the carrier-finder query.
ALTER TABLE completed_orders
    ALTER COLUMN carrier_company_name DROP NOT NULL;

-- The reimport pipeline relies on UPSERT (ON CONFLICT order_id). PostgREST
-- requires an actual UNIQUE CONSTRAINT (a unique index alone is not enough)
-- for the onConflict parameter to resolve. Add the constraint via a unique
-- index → ADD CONSTRAINT ... USING INDEX, which is idempotent-safe.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'completed_orders_order_id_key'
          AND conrelid = 'public.completed_orders'::regclass
    ) THEN
        -- If duplicates exist, surface them clearly before we try to add the
        -- constraint (otherwise the ALTER fails with a confusing message).
        IF EXISTS (
            SELECT order_id
            FROM public.completed_orders
            GROUP BY order_id
            HAVING count(*) > 1
            LIMIT 1
        ) THEN
            RAISE EXCEPTION
                'completed_orders has duplicate order_id values. '
                'Run: SELECT order_id, count(*) FROM completed_orders '
                'GROUP BY order_id HAVING count(*) > 1; '
                'Resolve duplicates before applying this migration.';
        END IF;

        ALTER TABLE public.completed_orders
            ADD CONSTRAINT completed_orders_order_id_key UNIQUE (order_id);
    END IF;
END $$;

-- Refresh PostgREST's schema cache so the new constraint is visible to
-- onConflict immediately (otherwise the API may not see it until the next
-- automatic reload).
NOTIFY pgrst, 'reload schema';

ALTER TABLE completed_orders
    -- Customer / shipper identity
    ADD COLUMN IF NOT EXISTS customer_type        TEXT,
    ADD COLUMN IF NOT EXISTS order_sub_type       TEXT,
    ADD COLUMN IF NOT EXISTS shipper_name         TEXT,
    ADD COLUMN IF NOT EXISTS shipper_phone        TEXT,
    ADD COLUMN IF NOT EXISTS shipper_email        TEXT,
    ADD COLUMN IF NOT EXISTS verified_shipper     BOOLEAN,

    -- Country (existing city/state/zip stays as-is)
    ADD COLUMN IF NOT EXISTS origin_country       TEXT,
    ADD COLUMN IF NOT EXISTS destination_country  TEXT,

    -- Pricing (raw text from CSV — may contain "$40K" notation)
    ADD COLUMN IF NOT EXISTS cargo_value          TEXT,
    ADD COLUMN IF NOT EXISTS quoted_date          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS broker_balance       TEXT,

    -- Broker / branch
    ADD COLUMN IF NOT EXISTS broker_branch        TEXT,

    -- Route / load profile (raw)
    ADD COLUMN IF NOT EXISTS duration_text        TEXT,
    ADD COLUMN IF NOT EXISTS distance_text        TEXT,
    ADD COLUMN IF NOT EXISTS load_name            TEXT,
    ADD COLUMN IF NOT EXISTS make                 TEXT,
    ADD COLUMN IF NOT EXISTS model                TEXT,
    ADD COLUMN IF NOT EXISTS year                 INTEGER,
    ADD COLUMN IF NOT EXISTS length_text          TEXT,
    ADD COLUMN IF NOT EXISTS width_text           TEXT,
    ADD COLUMN IF NOT EXISTS height_text          TEXT,
    ADD COLUMN IF NOT EXISTS weight_text          TEXT,
    ADD COLUMN IF NOT EXISTS trailer_type         TEXT,
    ADD COLUMN IF NOT EXISTS vehicle_type         TEXT,

    -- Lifecycle timestamps
    ADD COLUMN IF NOT EXISTS order_sent           TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS order_signed         TIMESTAMPTZ,

    -- Marketing attribution
    ADD COLUMN IF NOT EXISTS campaign_source      TEXT,
    ADD COLUMN IF NOT EXISTS campaign_medium      TEXT,
    ADD COLUMN IF NOT EXISTS campaign_name        TEXT,
    ADD COLUMN IF NOT EXISTS campaign_content     TEXT,
    ADD COLUMN IF NOT EXISTS campaign_keyword     TEXT;

-- ── 2. Typed / normalized mirror columns ────────────────────────────────────

ALTER TABLE completed_orders
    -- Numeric pricing mirrors (populated by import — see upload-orders route)
    ADD COLUMN IF NOT EXISTS carrier_pay_numeric  NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS quote_price_numeric  NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS cargo_value_numeric  NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS broker_balance_numeric NUMERIC(12, 2),

    -- Distance / duration mirrors
    ADD COLUMN IF NOT EXISTS distance_miles       NUMERIC(7, 1),
    ADD COLUMN IF NOT EXISTS duration_minutes     INTEGER,

    -- Structured dims/weight (parsed from text)
    ADD COLUMN IF NOT EXISTS length_ft            NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS width_ft             NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS height_ft            NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS weight_lbs           NUMERIC(10, 0),

    -- Normalized equipment classification (derived from ship_via + trailer_type)
    -- Examples: 'VAN', 'REEFER', 'FLATBED', 'STEPDECK', 'RGN', 'LOWBOY',
    --           'DOUBLE_DROP', 'CONESTOGA', 'AUTO_CARRIER', 'HOTSHOT',
    --           'POWER_ONLY', 'CONTAINER', 'BOX_TRUCK', 'DRIVEAWAY', 'OTHER'
    ADD COLUMN IF NOT EXISTS equipment_type       TEXT,

    -- Oversize / overweight flags (computed at import from dims/weight)
    ADD COLUMN IF NOT EXISTS is_oversize          BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_overweight        BOOLEAN,
    ADD COLUMN IF NOT EXISTS is_superload         BOOLEAN,

    -- Inferred load type for analytics (replaces today's runtime heuristic)
    -- Values: 'ftl' | 'partial' | 'unknown'
    ADD COLUMN IF NOT EXISTS load_type            TEXT;

-- ── 3. Generated columns for realized margin ────────────────────────────────
-- (Use generated columns so the metric is always consistent with inputs.)

ALTER TABLE completed_orders
    ADD COLUMN IF NOT EXISTS margin_amount NUMERIC(12, 2)
        GENERATED ALWAYS AS (quote_price_numeric - carrier_pay_numeric) STORED;

ALTER TABLE completed_orders
    ADD COLUMN IF NOT EXISTS margin_pct NUMERIC(6, 3)
        GENERATED ALWAYS AS (
            CASE
                WHEN quote_price_numeric IS NULL OR quote_price_numeric = 0 THEN NULL
                ELSE (quote_price_numeric - carrier_pay_numeric) / quote_price_numeric
            END
        ) STORED;

ALTER TABLE completed_orders
    ADD COLUMN IF NOT EXISTS rate_per_mile NUMERIC(8, 3)
        GENERATED ALWAYS AS (
            CASE
                WHEN distance_miles IS NULL OR distance_miles = 0 THEN NULL
                WHEN carrier_pay_numeric IS NULL THEN NULL
                ELSE carrier_pay_numeric / distance_miles
            END
        ) STORED;

-- ── 4. Indexes for new dashboards ───────────────────────────────────────────

-- Customer 360 / Repeat Shipper Dashboard
CREATE INDEX IF NOT EXISTS idx_completed_orders_shipper_email
    ON completed_orders (LOWER(shipper_email))
    WHERE shipper_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_completed_orders_shipper_phone
    ON completed_orders (shipper_phone)
    WHERE shipper_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_completed_orders_customer_type
    ON completed_orders (customer_type);

-- Broker / branch leaderboards
CREATE INDEX IF NOT EXISTS idx_completed_orders_broker_branch
    ON completed_orders (broker_branch);

-- Campaign ROI
CREATE INDEX IF NOT EXISTS idx_completed_orders_campaign_source
    ON completed_orders (campaign_source);

-- Margin Intelligence / Lane Rate Card v2
CREATE INDEX IF NOT EXISTS idx_completed_orders_equipment_type
    ON completed_orders (equipment_type);

CREATE INDEX IF NOT EXISTS idx_completed_orders_load_type
    ON completed_orders (load_type);

CREATE INDEX IF NOT EXISTS idx_completed_orders_oversize
    ON completed_orders (is_oversize)
    WHERE is_oversize = true;

CREATE INDEX IF NOT EXISTS idx_completed_orders_quoted_date
    ON completed_orders (quoted_date DESC)
    WHERE quoted_date IS NOT NULL;

-- Cycle-time funnel
CREATE INDEX IF NOT EXISTS idx_completed_orders_order_signed
    ON completed_orders (order_signed DESC)
    WHERE order_signed IS NOT NULL;

-- ── 5. Comments for future maintainers ──────────────────────────────────────

COMMENT ON COLUMN completed_orders.carrier_pay_numeric IS
    'Parsed numeric mirror of carrier_pay (handles $40K notation).';
COMMENT ON COLUMN completed_orders.quote_price_numeric IS
    'Parsed numeric mirror of quote_price (handles $40K notation).';
COMMENT ON COLUMN completed_orders.equipment_type IS
    'Normalized equipment enum (VAN/REEFER/FLATBED/STEPDECK/RGN/LOWBOY/...).';
COMMENT ON COLUMN completed_orders.is_oversize IS
    'TRUE when length>53 ft OR width>8.5 ft OR height>13.5 ft.';
COMMENT ON COLUMN completed_orders.is_overweight IS
    'TRUE when weight_lbs > 80000.';
COMMENT ON COLUMN completed_orders.is_superload IS
    'TRUE when width>16 ft OR height>17 ft OR weight>250000 lbs.';
COMMENT ON COLUMN completed_orders.margin_amount IS
    'Generated: quote_price_numeric - carrier_pay_numeric.';
COMMENT ON COLUMN completed_orders.margin_pct IS
    'Generated: realized broker margin as fraction of quote.';
COMMENT ON COLUMN completed_orders.rate_per_mile IS
    'Generated: carrier_pay_numeric / distance_miles.';
