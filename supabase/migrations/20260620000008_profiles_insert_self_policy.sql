-- =============================================================================
-- NTS Claims Tracker — Self-insert policy on profiles
-- =============================================================================
-- The handle_new_auth_user trigger normally creates the profiles row on
-- signup. This policy is a safety net for edge cases where the trigger does
-- not fire (e.g. user existed in auth.users before the trigger was created,
-- or a future migration replaces the trigger). It only lets a user insert
-- THEIR OWN row.
-- =============================================================================

drop policy if exists profiles_insert_self on public.profiles;

create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());
