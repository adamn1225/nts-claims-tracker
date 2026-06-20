-- Allow an authenticated user to INSERT their own brokers row.
-- This is required so /auth/complete-profile can self-provision a broker
-- profile for users who authenticate (e.g. via SSO) but never had a brokers
-- record created for them. Without this, the upsert fails under RLS and the
-- user is stuck in an unrecoverable state.

DROP POLICY IF EXISTS "Users can insert own profile" ON brokers;

CREATE POLICY "Users can insert own profile"
  ON brokers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

NOTIFY pgrst, 'reload schema';
