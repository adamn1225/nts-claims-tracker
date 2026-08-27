-- =============================================================================
-- NTS Claims Tracker — Public intake lookup access
-- Migration: Allow anonymous users to read freight_types / trailer_types
-- =============================================================================
-- Problem:
--   The public claim-intake form (/intake/claims) is served to anonymous
--   visitors (it is iframe-embedded on NTS brand sites). The page loads
--   `freight_types` and `trailer_types` with the anon Supabase client, but
--   the only select policies on those tables were scoped `to authenticated`.
--   Under RLS, anon requests therefore returned zero rows and the two
--   dropdowns rendered only their placeholder option — i.e. "not working".
--
-- Fix:
--   These are read-only reference tables (id, name, position, is_active,
--   created_at) with no sensitive data, so exposing `select` to anon is safe.
--   Write access remains restricted to admin/manager via the existing
--   *_admin_write policies.
-- =============================================================================

create policy freight_types_select_anon on public.freight_types
  for select to anon using (true);

create policy trailer_types_select_anon on public.trailer_types
  for select to anon using (true);
