-- =============================================================================
-- NTS Claims Tracker — Profiles employee fields
-- =============================================================================
-- The legacy sales-tracker captured first/last name, office location, and
-- remote flag on the `brokers` table because every signed-in user was a
-- broker. In claims-tracker, signed-in users are claims_staff / managers /
-- admins / brokers — these employee details belong on `profiles`, not
-- `brokers` (which is reserved for brokers of record).
-- =============================================================================

alter table public.profiles
  add column if not exists first_name      text,
  add column if not exists last_name       text,
  add column if not exists office_location text,
  add column if not exists is_remote       boolean not null default false;

-- Backfill full_name when first/last are present and full_name is blank.
-- (No-op for fresh deployments; useful if there's any pre-existing profile data.)
update public.profiles
set full_name = trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
where (full_name is null or full_name = '')
  and (first_name is not null or last_name is not null);

-- Update the auth-user provisioning trigger so SSO logins populate
-- first_name / last_name when raw_user_meta_data carries them (Microsoft
-- SSO exposes given_name / family_name).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_first text;
  meta_last  text;
  meta_full  text;
begin
  meta_first := coalesce(
    new.raw_user_meta_data->>'given_name',
    new.raw_user_meta_data->>'first_name'
  );
  meta_last := coalesce(
    new.raw_user_meta_data->>'family_name',
    new.raw_user_meta_data->>'last_name'
  );
  meta_full := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    nullif(trim(coalesce(meta_first, '') || ' ' || coalesce(meta_last, '')), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, full_name, first_name, last_name)
  values (
    new.id,
    new.email,
    meta_full,
    meta_first,
    meta_last
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
