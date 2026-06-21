-- GoTo Connect OAuth token storage
-- Stores encrypted access/refresh tokens per broker

CREATE TABLE IF NOT EXISTS public.goto_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  account_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE public.goto_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brokers can manage their own GoTo connection"
  ON public.goto_connections
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_goto_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_goto_connections_updated_at
  BEFORE UPDATE ON public.goto_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_goto_connections_updated_at();
