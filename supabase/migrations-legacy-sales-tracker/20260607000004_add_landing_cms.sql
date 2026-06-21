-- Broker landing page CMS
-- Adds brand theming, a custom content config, and an admin approval workflow
-- to each broker's public /rep/[slug] page.
--
-- Approval model:
--   landing_config           -> the broker's editable working draft (brand,
--                               tagline, ordered content blocks)
--   landing_config_approved  -> the snapshot shown publicly (null until an
--                               admin approves it the first time)
--   landing_status           -> 'draft' | 'pending' | 'approved' | 'rejected'
--
-- The public page only renders landing_config_approved, so unreviewed edits
-- never reach customers.

ALTER TABLE public.brokers
  ADD COLUMN IF NOT EXISTS landing_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS landing_config_approved jsonb,
  ADD COLUMN IF NOT EXISTS landing_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS landing_review_note text,
  ADD COLUMN IF NOT EXISTS landing_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS landing_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS landing_reviewed_by uuid REFERENCES public.brokers(id);

-- Constrain status to known values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brokers_landing_status_check'
  ) THEN
    ALTER TABLE public.brokers
      ADD CONSTRAINT brokers_landing_status_check
      CHECK (landing_status IN ('draft', 'pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Fast lookup of pending pages for the admin review queue.
CREATE INDEX IF NOT EXISTS idx_brokers_landing_status
  ON public.brokers (landing_status)
  WHERE landing_status = 'pending';

COMMENT ON COLUMN public.brokers.landing_config IS 'Broker editable landing page draft (brand, tagline, blocks).';
COMMENT ON COLUMN public.brokers.landing_config_approved IS 'Admin-approved landing config shown publicly on /rep/[slug].';
COMMENT ON COLUMN public.brokers.landing_status IS 'draft | pending | approved | rejected';

-- Allow landing-page review notifications. Recreate the type constraint with
-- the full set of known notification types so existing ones keep working.
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'task_reminder',
    'task_assigned',
    'customer_update',
    'system_alert',
    'contact_assigned',
    'contact_reassigned',
    'collaboration_activity',
    'collaboration_invited',
    'landing_approved',
    'landing_changes_requested'
  ));
