-- Phase 1 (safe rollout): add FK-based status linkage without breaking existing flows.
-- Keeps customers.status (text) for compatibility while introducing customers.status_id.

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS status_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customers_status_id_fkey'
  ) THEN
    ALTER TABLE customers
    ADD CONSTRAINT customers_status_id_fkey
    FOREIGN KEY (status_id)
    REFERENCES customer_statuses(id)
    ON DELETE SET NULL
    NOT VALID;
  END IF;
END $$;

ALTER TABLE customers VALIDATE CONSTRAINT customers_status_id_fkey;

CREATE INDEX IF NOT EXISTS idx_customers_broker_status_id
  ON customers (broker_id, status_id);

-- Backfill status_id for existing rows using case-insensitive name matching per broker.
WITH ranked_matches AS (
  SELECT
    c.id AS customer_id,
    s.id AS matched_status_id,
    ROW_NUMBER() OVER (
      PARTITION BY c.id
      ORDER BY
        CASE
          WHEN c.status = s.name THEN 0
          WHEN lower(trim(c.status)) = lower(trim(s.name)) THEN 1
          ELSE 2
        END,
        s."order" ASC,
        s.created_at ASC
    ) AS rn
  FROM customers c
  JOIN customer_statuses s
    ON s.broker_id = c.broker_id
   AND lower(trim(c.status)) = lower(trim(s.name))
  WHERE c.status_id IS NULL
)
UPDATE customers c
SET status_id = rm.matched_status_id
FROM ranked_matches rm
WHERE c.id = rm.customer_id
  AND rm.rn = 1;

-- Keep status text and status_id in sync going forward.
CREATE OR REPLACE FUNCTION sync_customer_status_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  matched_id UUID;
  matched_name TEXT;
BEGIN
  -- If status_id is present, treat it as source of truth and normalize status text.
  IF NEW.status_id IS NOT NULL THEN
    SELECT s.id, s.name
      INTO matched_id, matched_name
    FROM customer_statuses s
    WHERE s.id = NEW.status_id
      AND s.broker_id = NEW.broker_id
    LIMIT 1;

    IF matched_id IS NOT NULL THEN
      NEW.status := matched_name;
      RETURN NEW;
    END IF;
  END IF;

  -- If only status text is present, resolve canonical status row for this broker.
  IF NEW.status IS NOT NULL THEN
    SELECT s.id, s.name
      INTO matched_id, matched_name
    FROM customer_statuses s
    WHERE s.broker_id = NEW.broker_id
      AND lower(trim(s.name)) = lower(trim(NEW.status))
    ORDER BY s."order" ASC
    LIMIT 1;

    IF matched_id IS NOT NULL THEN
      NEW.status_id := matched_id;
      NEW.status := matched_name;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_customer_status_fields ON customers;

CREATE TRIGGER trg_sync_customer_status_fields
BEFORE INSERT OR UPDATE OF broker_id, status, status_id
ON customers
FOR EACH ROW
EXECUTE FUNCTION sync_customer_status_fields();

NOTIFY pgrst, 'reload schema';