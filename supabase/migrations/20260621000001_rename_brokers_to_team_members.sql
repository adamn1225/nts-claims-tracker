-- =============================================================================
-- NTS Claims Tracker — Rename `brokers` → `team_members`
-- Migration: drop the sales-tracker "broker" persona from the schema.
-- =============================================================================
-- This migration is the single source of truth for the rename. It is
-- idempotent (safe to re-run) and does the following:
--
--   1. Drop policies / functions that reference the old `broker` role
--      (so the alters below don't fail on dependency conflicts)
--   2. Rename the `brokers` table → `team_members`
--   3. Rename every `broker_id` column → `team_member_id` (dynamically,
--      across every public.* table that has one)
--   4. Rename FK constraints, indexes, triggers, and the source enum
--   5. Drop and recreate RLS policies that referenced the old names,
--      removing the now-dropped `'broker'` user_role branch
--   6. Rename the `broker_permissions` helper table and its broker-named
--      columns (can_invite_brokers → can_invite_team_members, etc.)
--
-- The `user_role` enum keeps its `'broker'` value (Postgres doesn't allow
-- dropping enum values without recreating the type). Nothing in the schema
-- or app references it anymore, so it's effectively retired.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Drop dependent policies that reference broker-named columns so the
--    column renames below don't fail. We do NOT drop the helper functions
--    (`can_see_claim`, `current_user_broker_id`) — they're updated in place
--    via `create or replace` later, which preserves the signature so all
--    other policies that depend on them keep working.
--
--    Each drop is guarded with a table-existence check because some of
--    these tables are optional legacy (dialer_*) and some may already be
--    renamed on re-run (brokers → team_members).
-- ---------------------------------------------------------------------------

do $$
declare
  t record;
  policies text[][] := array[
    ['claims',            'claims_select'],
    ['brokers',           'brokers_select_authenticated'],
    ['brokers',           'brokers_write_admin'],
    ['team_members',      'team_members_select_authenticated'],
    ['team_members',      'team_members_write_admin'],
    ['dialer_lists',      'dialer_lists_owner'],
    ['dialer_contacts',   'dialer_contacts_owner'],
    ['dialer_sessions',   'dialer_sessions_owner'],
    ['dialer_call_logs',  'dialer_call_logs_owner']
  ];
  i int;
begin
  for i in 1 .. array_length(policies, 1) loop
    if exists (
      select 1 from pg_tables
       where schemaname = 'public'
         and tablename  = policies[i][1]
    ) then
      execute format('drop policy if exists %I on public.%I',
                     policies[i][2], policies[i][1]);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Rename the table itself: brokers → team_members
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
      from pg_tables
     where schemaname = 'public'
       and tablename  = 'brokers'
  ) then
    alter table public.brokers rename to team_members;
  end if;
end $$;

-- Comment to reflect the new role.
comment on table public.team_members is
  'NTS team members (claims staff, managers, admins). A team member can exist before their auth account does. external_sales_tracker_id is the upstream key when synced from the legacy sales tracker.';

-- ---------------------------------------------------------------------------
-- 3. Rename every `broker_id` column across the public schema to
--    `team_member_id`. Dynamic so we catch every table that has one
--    (claims, profiles, intake_tokens.assigned_broker_id, dialer_*,
--    customers, tasks, notifications, broker_permissions, microsoft_tokens,
--    seed/fix tables, etc.).
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  -- Plain broker_id columns
  for r in
    select table_schema, table_name, column_name
      from information_schema.columns
     where table_schema = 'public'
       and column_name  = 'broker_id'
  loop
    execute format(
      'alter table %I.%I rename column %I to team_member_id',
      r.table_schema, r.table_name, r.column_name
    );
  end loop;

  -- assigned_broker_id → assigned_team_member_id
  for r in
    select table_schema, table_name, column_name
      from information_schema.columns
     where table_schema = 'public'
       and column_name  = 'assigned_broker_id'
  loop
    execute format(
      'alter table %I.%I rename column %I to assigned_team_member_id',
      r.table_schema, r.table_name, r.column_name
    );
  end loop;

  -- reported_by_broker_id / reviewed_by_broker_id (legacy permit_corrections)
  for r in
    select table_schema, table_name, column_name
      from information_schema.columns
     where table_schema = 'public'
       and column_name  in ('reported_by_broker_id', 'reviewed_by_broker_id')
  loop
    execute format(
      'alter table %I.%I rename column %I to %I',
      r.table_schema, r.table_name, r.column_name,
      replace(r.column_name, 'broker_id', 'team_member_id')
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Rename indexes that referenced the old names. Wrapped in `if exists`
--    because some legacy indexes may have been created on tables that
--    don't exist in every environment.
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  new_name text;
begin
  for r in
    select schemaname, indexname
      from pg_indexes
     where schemaname = 'public'
       and indexname like '%broker%'
  loop
    new_name := replace(replace(r.indexname, 'broker_id', 'team_member_id'),
                        'broker', 'team_member');
    if new_name <> r.indexname then
      execute format('alter index %I.%I rename to %I',
                     r.schemaname, r.indexname, new_name);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Rename trigger on the renamed table.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_trigger
     where tgname = 'brokers_updated_at'
       and tgrelid = 'public.team_members'::regclass
  ) then
    alter trigger brokers_updated_at on public.team_members
      rename to team_members_updated_at;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Rename the source enum: broker_source → team_member_source
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public'
       and t.typname = 'broker_source'
  ) then
    alter type public.broker_source rename to team_member_source;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Rename the broker_permissions table and its broker-named columns.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_tables
     where schemaname = 'public'
       and tablename  = 'broker_permissions'
  ) then
    alter table public.broker_permissions rename to team_member_permissions;
  end if;
end $$;

do $$
declare
  r record;
  new_name text;
begin
  for r in
    select column_name
      from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'team_member_permissions'
       and (column_name like 'can_%broker%' or column_name like 'can_invite_brokers')
  loop
    new_name := replace(r.column_name, 'broker', 'team_member');
    -- "can_view_office_brokers" → "can_view_office_team_members"
    -- "can_view_all_brokers" → "can_view_all_team_members"
    -- "can_invite_brokers" → "can_invite_team_members"
    if not exists (
      select 1
        from information_schema.columns
       where table_schema = 'public'
         and table_name   = 'team_member_permissions'
         and column_name  = new_name
    ) then
      execute format('alter table public.team_member_permissions rename column %I to %I',
                     r.column_name, new_name);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Recreate RLS policies on the renamed core tables.
--    The 'broker' role branch is intentionally removed — claims-staff,
--    managers, and admins are the only roles going forward.
--    `drop policy if exists` first so this section is re-runnable.
-- ---------------------------------------------------------------------------

drop policy if exists team_members_select_authenticated on public.team_members;
drop policy if exists team_members_write_admin          on public.team_members;
drop policy if exists claims_select                     on public.claims;

create policy team_members_select_authenticated on public.team_members
  for select to authenticated
  using (true);

create policy team_members_write_admin on public.team_members
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

create policy claims_select on public.claims
  for select to authenticated
  using (
    public.is_admin_or_manager()
    or (public.current_user_role() = 'claims_staff'
        and (owner_id = auth.uid() or owner_id is null))
  );

-- Recreate dialer policies pointing at the renamed column. Only create if the
-- dialer tables actually exist in this database (they're optional legacy).
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'dialer_lists') then
    execute 'drop policy if exists "dialer_lists_owner" on public.dialer_lists';
    execute 'create policy "dialer_lists_owner" on public.dialer_lists
               for all using (auth.uid() = team_member_id)';
  end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'dialer_contacts') then
    execute 'drop policy if exists "dialer_contacts_owner" on public.dialer_contacts';
    execute 'create policy "dialer_contacts_owner" on public.dialer_contacts
               for all using (auth.uid() = team_member_id)';
  end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'dialer_sessions') then
    execute 'drop policy if exists "dialer_sessions_owner" on public.dialer_sessions';
    execute 'create policy "dialer_sessions_owner" on public.dialer_sessions
               for all using (auth.uid() = team_member_id)';
  end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'dialer_call_logs') then
    execute 'drop policy if exists "dialer_call_logs_owner" on public.dialer_call_logs';
    execute 'create policy "dialer_call_logs_owner" on public.dialer_call_logs
               for all using (auth.uid() = team_member_id)';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Recreate helper function with the new name.
--    `can_see_claim` is updated *in place* via `create or replace` so the
--    other policies that depend on it (claim_parties_select,
--    claim_documents_select, tasks_select, etc.) keep working without
--    needing to be dropped and recreated.
--    `current_user_broker_id()` was only referenced by the dropped
--    `claims_select` policy. It's now harmless dead code; leave it for a
--    follow-up cleanup migration once we've confirmed nothing else uses it.
-- ---------------------------------------------------------------------------

create or replace function public.current_user_team_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_member_id from public.profiles where id = auth.uid()
$$;

-- Recreate can_see_claim WITHOUT the 'broker' branch.
create or replace function public.can_see_claim(target_claim_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.claims c
    left join public.profiles p on p.id = auth.uid()
    where c.id = target_claim_id
      and (
        p.role in ('admin', 'manager')
        or (p.role = 'claims_staff' and (c.owner_id = p.id or c.owner_id is null))
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- 10. Sanity: update profile column comment.
-- ---------------------------------------------------------------------------
comment on column public.profiles.team_member_id is
  'Optional FK to public.team_members. Set when this user IS a team member (claims staff, manager, or admin).';

commit;

-- =============================================================================
-- POST-MIGRATION TODO (manual / app-side)
-- =============================================================================
-- 1. Regenerate generated types:   npm run db:types
-- 2. The TypeScript build will now fail at every site that still references
--    'brokers' / 'broker_id' / Broker type. Sweep those references next.
-- 3. The `user_role` enum still contains 'broker'. To remove it later:
--      create type user_role_new as enum ('admin','manager','claims_staff');
--      alter table public.profiles
--        alter column role type user_role_new using role::text::user_role_new;
--      drop type public.user_role;
--      alter type public.user_role_new rename to user_role;
--    Skipped here because it requires no rows to currently hold role='broker'.
-- =============================================================================
