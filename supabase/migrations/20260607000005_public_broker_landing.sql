-- Public access for broker landing pages (/rep/[slug])
--
-- The brokers table is authenticated-only via RLS, which 404s the public page
-- for logged-out visitors. RLS is row-level (not column-level), so we cannot
-- simply open the table to anon without leaking email, admin flags, and the
-- broker's *unapproved* landing draft.
--
-- Instead we expose a narrow, read-only VIEW containing only public-safe
-- columns. The view runs with the definer's rights (security_invoker = false),
-- bypassing the underlying table RLS, and is granted to anon + authenticated.

CREATE OR REPLACE VIEW public.public_broker_pages AS
SELECT
  id,
  first_name,
  last_name,
  office_location,
  avatar_url,
  headline,
  bio,
  linkedin_url,
  specialties,
  phone,
  profile_slug,
  landing_status,
  landing_config_approved
FROM public.brokers
WHERE is_active = true
  AND profile_slug IS NOT NULL;

-- Run as the view owner so the brokers RLS does not hide rows from anon.
ALTER VIEW public.public_broker_pages SET (security_invoker = false);

-- Only the curated columns above are reachable; the base table stays locked.
GRANT SELECT ON public.public_broker_pages TO anon, authenticated;

-- Allow anonymous visitors to read portfolio photos for brokers who have a
-- public page. Freight photos are intended to be shared publicly; this is
-- scoped to active brokers with a slug so private accounts stay hidden.
DROP POLICY IF EXISTS "broker_portfolio_public_select" ON public.broker_portfolio;
CREATE POLICY "broker_portfolio_public_select"
  ON public.broker_portfolio FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.brokers b
      WHERE b.id = broker_portfolio.broker_id
        AND b.is_active = true
        AND b.profile_slug IS NOT NULL
    )
  );
