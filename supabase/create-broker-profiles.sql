-- ============================================================================
-- Broker Profiles + Gamification
-- ============================================================================
-- Adds public-facing profile fields to brokers and a freight portfolio table
-- so brokers can showcase the loads they've moved (their portfolio), link
-- their LinkedIn, and earn achievements.
--
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS guards).
-- After running, regenerate types:  npm run db:types
-- ============================================================================

-- 1. Profile fields on brokers ----------------------------------------------
ALTER TABLE public.brokers
  ADD COLUMN IF NOT EXISTS avatar_url    text,
  ADD COLUMN IF NOT EXISTS headline      text,   -- short tagline shown under name
  ADD COLUMN IF NOT EXISTS bio           text,   -- longer "about me"
  ADD COLUMN IF NOT EXISTS linkedin_url  text,
  ADD COLUMN IF NOT EXISTS specialties   text[] DEFAULT '{}'::text[],  -- e.g. {"RGN","Flatbed","Oversize"}
  ADD COLUMN IF NOT EXISTS joined_date   date;   -- when they started in freight / at NTS

-- 2. Freight portfolio (photo gallery of loads moved) -----------------------
CREATE TABLE IF NOT EXISTS public.broker_portfolio (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id      uuid NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  image_path     text NOT NULL,            -- storage path inside the bucket
  caption        text,
  equipment_type text,                     -- e.g. "RGN", "Flatbed", "Step Deck"
  origin         text,                     -- "Dallas, TX"
  destination    text,                     -- "Atlanta, GA"
  order_ref      text,                     -- optional reference to an order/load #
  sort_order     int DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broker_portfolio_broker
  ON public.broker_portfolio (broker_id, sort_order);

-- 3. Row Level Security ------------------------------------------------------
ALTER TABLE public.broker_portfolio ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view portfolios (profiles are company-wide visible)
DROP POLICY IF EXISTS "broker_portfolio_select" ON public.broker_portfolio;
CREATE POLICY "broker_portfolio_select"
  ON public.broker_portfolio FOR SELECT
  TO authenticated
  USING (true);

-- Brokers can manage only their own portfolio items
DROP POLICY IF EXISTS "broker_portfolio_insert" ON public.broker_portfolio;
CREATE POLICY "broker_portfolio_insert"
  ON public.broker_portfolio FOR INSERT
  TO authenticated
  WITH CHECK (broker_id = auth.uid());

DROP POLICY IF EXISTS "broker_portfolio_update" ON public.broker_portfolio;
CREATE POLICY "broker_portfolio_update"
  ON public.broker_portfolio FOR UPDATE
  TO authenticated
  USING (broker_id = auth.uid())
  WITH CHECK (broker_id = auth.uid());

DROP POLICY IF EXISTS "broker_portfolio_delete" ON public.broker_portfolio;
CREATE POLICY "broker_portfolio_delete"
  ON public.broker_portfolio FOR DELETE
  TO authenticated
  USING (broker_id = auth.uid());

-- 4. Storage bucket (run once; ignore error if it already exists) ------------
-- Public bucket so freight photos render on profiles.
INSERT INTO storage.buckets (id, name, public)
VALUES ('broker-portfolio', 'broker-portfolio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: anyone authenticated can read, brokers write to their own
-- folder (path prefix = their broker id).
DROP POLICY IF EXISTS "broker_portfolio_read" ON storage.objects;
CREATE POLICY "broker_portfolio_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'broker-portfolio');

DROP POLICY IF EXISTS "broker_portfolio_write" ON storage.objects;
CREATE POLICY "broker_portfolio_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'broker-portfolio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "broker_portfolio_remove" ON storage.objects;
CREATE POLICY "broker_portfolio_remove"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'broker-portfolio'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- Done. Avatars reuse the same bucket under <broker_id>/avatar/<file>.
-- ============================================================================
