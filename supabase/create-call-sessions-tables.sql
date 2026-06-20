-- ============================================================================
-- Call Sessions Feature
-- ============================================================================
-- Standalone dialer feature separate from the main contacts/customers table.
-- Brokers can build custom call lists (saved or ephemeral), dial through them,
-- log call outcomes, and get pre/post-call AI feedback.
--
-- Tables:
--   dialer_lists           : Named, reusable contact lists per broker
--   dialer_contacts        : Contacts inside lists (one phone/email each)
--   dialer_sessions        : A dialing session (saved or ephemeral)
--   dialer_call_logs       : One row per call attempt — notes, outcome, AI feedback
--   dialer_ai_preferences  : Per-broker post-call AI configuration
-- ============================================================================

-- ─── dialer_lists ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dialer_lists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dialer_lists_broker_idx ON public.dialer_lists(broker_id);

-- ─── dialer_contacts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dialer_contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id     UUID NOT NULL REFERENCES public.dialer_lists(id) ON DELETE CASCADE,
  broker_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  company     TEXT,
  title       TEXT,
  phone       TEXT,
  email       TEXT,
  city        TEXT,
  state       TEXT,
  industry    TEXT,
  tags        TEXT[] DEFAULT '{}',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dialer_contacts_list_idx   ON public.dialer_contacts(list_id);
CREATE INDEX IF NOT EXISTS dialer_contacts_broker_idx ON public.dialer_contacts(broker_id);

-- ─── dialer_sessions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dialer_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id      UUID REFERENCES public.dialer_lists(id) ON DELETE SET NULL,
  mode         TEXT NOT NULL CHECK (mode IN ('saved', 'ephemeral')),
  -- snapshot for ephemeral sessions where contacts aren't persisted
  contacts_snapshot JSONB,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  total_calls  INTEGER NOT NULL DEFAULT 0,
  total_connected INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS dialer_sessions_broker_idx ON public.dialer_sessions(broker_id);
CREATE INDEX IF NOT EXISTS dialer_sessions_list_idx   ON public.dialer_sessions(list_id);

-- ─── dialer_call_logs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dialer_call_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.dialer_sessions(id) ON DELETE CASCADE,
  broker_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- nullable for ephemeral; contact_snapshot always populated
  contact_id      UUID REFERENCES public.dialer_contacts(id) ON DELETE SET NULL,
  contact_snapshot JSONB NOT NULL,
  outcome         TEXT,
  notes           TEXT,
  goto_call_id    TEXT,
  duration_seconds INTEGER,
  follow_up_at    TIMESTAMPTZ,
  -- AI artifacts
  pre_call_brief  TEXT,
  ai_feedback     JSONB, -- { performance, tips, email, sms, suggested_followup }
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dialer_call_logs_session_idx ON public.dialer_call_logs(session_id);
CREATE INDEX IF NOT EXISTS dialer_call_logs_broker_idx  ON public.dialer_call_logs(broker_id);
CREATE INDEX IF NOT EXISTS dialer_call_logs_contact_idx ON public.dialer_call_logs(contact_id);

-- ─── dialer_ai_preferences ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dialer_ai_preferences (
  broker_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pre_call_brief         BOOLEAN NOT NULL DEFAULT TRUE,
  post_performance       BOOLEAN NOT NULL DEFAULT TRUE,
  post_tips              BOOLEAN NOT NULL DEFAULT TRUE,
  post_email_draft       BOOLEAN NOT NULL DEFAULT TRUE,
  post_sms_draft         BOOLEAN NOT NULL DEFAULT FALSE,
  post_suggest_followup  BOOLEAN NOT NULL DEFAULT TRUE,
  manual_advance         BOOLEAN NOT NULL DEFAULT TRUE,
  auto_advance_delay_sec INTEGER NOT NULL DEFAULT 10,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.dialer_lists           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialer_contacts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialer_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialer_call_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialer_ai_preferences  ENABLE ROW LEVEL SECURITY;

-- Broker owns their data on all tables
CREATE POLICY "dialer_lists_owner"     ON public.dialer_lists           FOR ALL TO authenticated USING (auth.uid() = broker_id) WITH CHECK (auth.uid() = broker_id);
CREATE POLICY "dialer_contacts_owner"  ON public.dialer_contacts        FOR ALL TO authenticated USING (auth.uid() = broker_id) WITH CHECK (auth.uid() = broker_id);
CREATE POLICY "dialer_sessions_owner"  ON public.dialer_sessions        FOR ALL TO authenticated USING (auth.uid() = broker_id) WITH CHECK (auth.uid() = broker_id);
CREATE POLICY "dialer_call_logs_owner" ON public.dialer_call_logs       FOR ALL TO authenticated USING (auth.uid() = broker_id) WITH CHECK (auth.uid() = broker_id);
CREATE POLICY "dialer_prefs_owner"     ON public.dialer_ai_preferences  FOR ALL TO authenticated USING (auth.uid() = broker_id) WITH CHECK (auth.uid() = broker_id);

-- ─── updated_at triggers ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dialer_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dialer_lists_updated_at ON public.dialer_lists;
CREATE TRIGGER dialer_lists_updated_at BEFORE UPDATE ON public.dialer_lists
  FOR EACH ROW EXECUTE FUNCTION public.dialer_set_updated_at();

DROP TRIGGER IF EXISTS dialer_contacts_updated_at ON public.dialer_contacts;
CREATE TRIGGER dialer_contacts_updated_at BEFORE UPDATE ON public.dialer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.dialer_set_updated_at();

DROP TRIGGER IF EXISTS dialer_prefs_updated_at ON public.dialer_ai_preferences;
CREATE TRIGGER dialer_prefs_updated_at BEFORE UPDATE ON public.dialer_ai_preferences
  FOR EACH ROW EXECUTE FUNCTION public.dialer_set_updated_at();
