-- Transient table for passing GoTo call events to the browser via Supabase Realtime
-- Rows are short-lived (current session only); no long-term retention needed

CREATE TABLE IF NOT EXISTS public.power_dialer_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  call_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('initiated', 'ringing', 'answered', 'no_answer', 'ended', 'failed')),
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE public.power_dialer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers can read their own dialer events"
  ON public.power_dialer_events
  FOR SELECT
  USING (user_id = auth.uid());

-- Service role can insert (webhook handler uses service key)
CREATE POLICY "Service role can insert dialer events"
  ON public.power_dialer_events
  FOR INSERT
  WITH CHECK (true);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.power_dialer_events;

-- Auto-cleanup: delete events older than 24 hours
-- This keeps the table small without needing a separate cron job
CREATE OR REPLACE FUNCTION cleanup_old_dialer_events()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.power_dialer_events
  WHERE created_at < now() - INTERVAL '24 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_cleanup_dialer_events
  AFTER INSERT ON public.power_dialer_events
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_old_dialer_events();
