-- =============================================================================
-- NTS Claims Tracker — Foundational Schema
-- Migration 02: Identity (profiles, brokers, api_tokens)
-- =============================================================================
-- profiles extends auth.users with role + preferences
-- brokers is a first-class entity (a broker exists before they ever log in)
-- api_tokens supports both intake-form auth and integration callers
-- =============================================================================

-- ---------------------------------------------------------------------------
-- brokers
-- ---------------------------------------------------------------------------
-- Broker employees at NTS. Customers and claims are owned by a broker of
-- record. The cross-app sync (sales tracker -> claims tracker) will write to
-- this table; bootstrap is via CSV import.
-- ---------------------------------------------------------------------------
create table public.brokers (
  id                          uuid primary key default gen_random_uuid(),
  first_name                  text not null,
  last_name                   text not null,
  display_name                text generated always as (first_name || ' ' || last_name) stored,
  email                       citext unique,
  phone                       text,
  office_location             text,
  brand                       text,          -- Heavy Haulers, AutoTransport, etc.
  job_title                   text,
  is_active                   boolean not null default true,

  -- Cross-app sync metadata
  source                      broker_source not null default 'manual',
  external_sales_tracker_id   text,          -- ID in nts.salestrack (for sync)
  external_synced_at          timestamptz,

  -- Audit
  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create unique index brokers_external_sales_tracker_id_uidx
  on public.brokers (external_sales_tracker_id)
  where external_sales_tracker_id is not null;

create index brokers_is_active_idx on public.brokers (is_active);
create index brokers_brand_idx on public.brokers (brand);

comment on table public.brokers is
  'Broker employees of NTS. A broker exists in the system before their user account does. external_sales_tracker_id is the upstream key when synced from nts.salestrack.';

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- Extends auth.users. Single row per platform user. broker_id is set when
-- this user IS a broker (links profile -> broker entity).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text,
  email           citext unique,
  phone           text,
  avatar_url      text,
  role            user_role not null default 'claims_staff',
  broker_id       uuid references public.brokers(id) on delete set null,

  -- Per-user preferences (notification times, pinned columns, kanban widths)
  preferences     jsonb not null default '{}'::jsonb,

  -- Operational
  timezone        text not null default 'America/New_York',
  is_active       boolean not null default true,
  last_active_at  timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index profiles_broker_id_idx on public.profiles (broker_id);

comment on table public.profiles is
  'Platform user records. Mirrors auth.users 1:1. broker_id is set when the user is themselves a broker (role=broker).';

-- ---------------------------------------------------------------------------
-- profile auto-provisioning trigger
-- ---------------------------------------------------------------------------
-- New auth.users rows get a matching profiles row automatically. Email and
-- full_name come from raw_user_meta_data when available (Microsoft SSO).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger brokers_updated_at
  before update on public.brokers
  for each row execute function public.set_updated_at();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- api_tokens
-- ---------------------------------------------------------------------------
-- Hashed API tokens for intake-form auth, integrations, and CLI scripts.
-- Token is stored as a SHA-256 hash (token_hash); the plaintext is only ever
-- shown to the user once at creation time.
-- ---------------------------------------------------------------------------
create table public.api_tokens (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  token_hash      text not null unique,   -- sha256 hex digest
  token_prefix    text not null,          -- first 8 chars, for display only
  scopes          text[] not null default '{}',  -- e.g. {'intake:write','claims:read'}
  created_by      uuid references public.profiles(id) on delete set null,
  last_used_at    timestamptz,
  expires_at      timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index api_tokens_is_active_idx on public.api_tokens (is_active);

comment on table public.api_tokens is
  'Hashed API tokens. token_hash = sha256(plaintext). Plaintext is only returned on creation.';
