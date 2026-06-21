-- =============================================================================
-- NTS Claims Tracker — Foundational Schema
-- Migration 03: Companies + Intake + Claims core
-- =============================================================================
-- Single unified `companies` table for shippers, carriers, factoring, AP,
-- insurers. `kinds` is an array so a single company can act in multiple roles.
--
-- `claim_statuses` holds the configurable kanban columns. CEO's 6 columns are
-- seeded in migration 06.
--
-- `claims` is the central entity. `claim_intake_submissions` is the staging
-- area for public form submissions awaiting triage.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Lookup tables
-- ---------------------------------------------------------------------------
create table public.freight_types (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  position    integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.trailer_types (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  position    integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
-- One table for every external organization. `kinds` is an array so a single
-- carrier can also be flagged as a shipper if needed. Search across legal/dba
-- names is sped up by pg_trgm GIN indexes.
-- ---------------------------------------------------------------------------
create table public.companies (
  id                 uuid primary key default gen_random_uuid(),
  legal_name         text not null,
  dba_name           text,
  kinds              company_kind[] not null default '{}',

  -- Contact
  primary_email      citext,
  primary_phone      text,
  website            text,

  -- Address
  street_1           text,
  street_2           text,
  city               text,
  state              text,
  postal_code        text,
  country            text default 'US',

  -- Carrier-specific identifiers (nullable for non-carriers)
  mc_number          text,
  dot_number         text,
  scac               text,                                -- standard carrier alpha code

  -- External references
  tms_external_id    text,                                -- crm.ntsconnect link
  external_source    text,                                -- where this row came from

  -- Risk / status
  is_active          boolean not null default true,
  has_active_hold    boolean not null default false,      -- denormalized for fast filtering; maintained by trigger in migration 04
  notes              text,

  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index companies_legal_name_trgm_idx
  on public.companies using gin (legal_name gin_trgm_ops);
create index companies_dba_name_trgm_idx
  on public.companies using gin (dba_name gin_trgm_ops)
  where dba_name is not null;
create index companies_kinds_idx
  on public.companies using gin (kinds);
create index companies_mc_number_idx
  on public.companies (mc_number)
  where mc_number is not null;
create index companies_dot_number_idx
  on public.companies (dot_number)
  where dot_number is not null;
create index companies_has_active_hold_idx
  on public.companies (has_active_hold)
  where has_active_hold = true;

create trigger companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

comment on table public.companies is
  'Unified party table. Use kinds[] to mark each role this company can play. has_active_hold is denormalized from carrier_holds for fast list filtering.';

-- ---------------------------------------------------------------------------
-- intake_tokens
-- ---------------------------------------------------------------------------
-- Branded-link tokens for per-customer pre-filled intake URLs, and API tokens
-- for partner integrations. Plaintext token is hashed; prefix shown for ops.
-- ---------------------------------------------------------------------------
create table public.intake_tokens (
  id                    uuid primary key default gen_random_uuid(),
  token_hash            text not null unique,
  token_prefix          text not null,
  kind                  intake_token_kind not null,
  label                 text not null,             -- "Heavy Haulers - Acme Co"

  assigned_broker_id    uuid references public.brokers(id) on delete set null,
  assigned_company_id   uuid references public.companies(id) on delete set null,

  is_active             boolean not null default true,
  max_uses              integer,                   -- null = unlimited
  use_count             integer not null default 0,
  expires_at            timestamptz,

  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  last_used_at          timestamptz
);

create index intake_tokens_is_active_idx on public.intake_tokens (is_active);

-- ---------------------------------------------------------------------------
-- claim_statuses (kanban columns)
-- ---------------------------------------------------------------------------
-- Configurable. Managers can add/rename/reorder. is_inbox / is_closed /
-- is_denied flag special columns for app logic.
-- ---------------------------------------------------------------------------
create table public.claim_statuses (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  color        text not null default 'slate',   -- semantic token name
  position     integer not null,
  is_inbox     boolean not null default false,
  is_closed    boolean not null default false,
  is_denied    boolean not null default false,
  is_system    boolean not null default false,  -- system columns cannot be deleted
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index claim_statuses_position_uidx
  on public.claim_statuses (position)
  where is_active = true;

create trigger claim_statuses_updated_at
  before update on public.claim_statuses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- claim_number sequence + generator
-- ---------------------------------------------------------------------------
-- Format: CLM-YYYY-NNNN (4-digit padded, resets implicitly via year prefix).
-- The sequence is monotonic across years; the YYYY in the number reflects
-- the claim's opened_at year, so display is "CLM-2026-0001" even if the
-- sequence number is 14237.
-- ---------------------------------------------------------------------------
create sequence public.claim_number_seq start with 1;

create or replace function public.generate_claim_number(opened_at_in timestamptz default now())
returns text
language plpgsql
as $$
declare
  yr   text := to_char(opened_at_in, 'YYYY');
  num  bigint;
begin
  num := nextval('public.claim_number_seq');
  return 'CLM-' || yr || '-' || lpad(num::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- claims
-- ---------------------------------------------------------------------------
create table public.claims (
  id                       uuid primary key default gen_random_uuid(),
  claim_number             text not null unique,            -- defaults set via trigger below

  -- Intake
  intake_source            claim_intake_source not null default 'manual',
  intake_submission_id     uuid,                            -- FK added in this migration after table exists

  -- Stage
  status_id                uuid not null references public.claim_statuses(id),

  -- Value & exposure
  value_bucket             claim_value_bucket not null default 'current',
  value_bucket_manual      boolean not null default false,  -- true if user overrode auto-derive
  damage_claim_amount      numeric(12,2),
  shipment_value           numeric(12,2),
  currency                 text not null default 'USD',

  -- Shipment context
  freight_type_id          uuid references public.freight_types(id) on delete set null,
  trailer_type_id          uuid references public.trailer_types(id) on delete set null,
  origin_city              text,
  origin_state             text,
  origin_postal_code       text,
  destination_city         text,
  destination_state        text,
  destination_postal_code  text,

  -- Dates
  incident_date            date,
  pickup_date              date,
  delivery_date            date,
  opened_at                timestamptz not null default now(),
  acknowledged_at          timestamptz,
  closed_at                timestamptz,
  last_activity_at         timestamptz not null default now(),

  -- Resolution
  resolution               claim_resolution,
  resolution_notes         text,

  -- Ownership
  broker_id                uuid references public.brokers(id) on delete set null,
  owner_id                 uuid references public.profiles(id) on delete set null,

  -- External references
  tms_order_number         text,   -- crm.ntsconnect order/quote ref (text, no FK)
  bol_number               text,   -- bill of lading reference for fast search

  -- Description
  summary                  text,
  internal_description     text,

  -- Audit
  created_by               uuid references public.profiles(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index claims_status_id_idx on public.claims (status_id);
create index claims_owner_id_idx on public.claims (owner_id);
create index claims_broker_id_idx on public.claims (broker_id);
create index claims_value_bucket_idx on public.claims (value_bucket);
create index claims_opened_at_idx on public.claims (opened_at desc);
create index claims_last_activity_at_idx on public.claims (last_activity_at desc);
create index claims_tms_order_number_idx on public.claims (tms_order_number)
  where tms_order_number is not null;
create index claims_bol_number_idx on public.claims (bol_number)
  where bol_number is not null;
create index claims_claim_number_trgm_idx
  on public.claims using gin (claim_number gin_trgm_ops);

create trigger claims_updated_at
  before update on public.claims
  for each row execute function public.set_updated_at();

-- Claim number auto-generator
create or replace function public.set_claim_number()
returns trigger
language plpgsql
as $$
begin
  if new.claim_number is null or new.claim_number = '' then
    new.claim_number := public.generate_claim_number(coalesce(new.opened_at, now()));
  end if;
  return new;
end;
$$;

create trigger claims_set_claim_number
  before insert on public.claims
  for each row execute function public.set_claim_number();

-- Auto-derive value_bucket from damage_claim_amount unless manually overridden.
-- Threshold: < $10,000 -> current, >= $10,000 -> credit_high_value. Legal is
-- always a manual flag.
create or replace function public.derive_claim_value_bucket()
returns trigger
language plpgsql
as $$
begin
  if new.value_bucket_manual then
    return new;
  end if;

  if new.damage_claim_amount is null then
    new.value_bucket := 'current';
  elsif new.damage_claim_amount < 10000 then
    new.value_bucket := 'current';
  else
    new.value_bucket := 'credit_high_value';
  end if;

  return new;
end;
$$;

create trigger claims_derive_value_bucket
  before insert or update of damage_claim_amount, value_bucket_manual
  on public.claims
  for each row execute function public.derive_claim_value_bucket();

comment on table public.claims is
  'Central claim entity. claim_number is auto-generated. value_bucket is auto-derived from damage_claim_amount unless value_bucket_manual=true.';

-- ---------------------------------------------------------------------------
-- claim_intake_submissions
-- ---------------------------------------------------------------------------
-- Public form submissions land here first. Claims staff review and promote
-- them into a real claim row (intake_submission_id back-references this row).
-- ---------------------------------------------------------------------------
create table public.claim_intake_submissions (
  id                  uuid primary key default gen_random_uuid(),
  received_at         timestamptz not null default now(),
  source              claim_intake_source not null,
  intake_token_id     uuid references public.intake_tokens(id) on delete set null,

  payload             jsonb not null,    -- raw form fields
  attachments         jsonb not null default '[]'::jsonb,  -- [{storage_path, filename, mime, size}]

  submitter_name      text,
  submitter_email     citext,
  submitter_phone     text,
  submitter_ip        inet,
  user_agent          text,

  status              intake_submission_status not null default 'pending_review',
  promoted_claim_id   uuid references public.claims(id) on delete set null,
  duplicate_of_id     uuid references public.claim_intake_submissions(id) on delete set null,

  reviewed_by         uuid references public.profiles(id) on delete set null,
  reviewed_at         timestamptz,
  review_notes        text
);

create index claim_intake_submissions_status_idx
  on public.claim_intake_submissions (status);
create index claim_intake_submissions_received_at_idx
  on public.claim_intake_submissions (received_at desc);
create index claim_intake_submissions_promoted_claim_id_idx
  on public.claim_intake_submissions (promoted_claim_id)
  where promoted_claim_id is not null;

-- Add the FK from claims -> intake submission now that the table exists
alter table public.claims
  add constraint claims_intake_submission_id_fkey
  foreign key (intake_submission_id)
  references public.claim_intake_submissions(id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- claim_parties (M:N claims <-> companies)
-- ---------------------------------------------------------------------------
-- A claim has many parties. role is independent of company.kinds because the
-- same company might be the shipper on one claim and the consignee on another.
-- ---------------------------------------------------------------------------
create table public.claim_parties (
  id                    uuid primary key default gen_random_uuid(),
  claim_id              uuid not null references public.claims(id) on delete cascade,
  company_id            uuid not null references public.companies(id) on delete restrict,
  role                  claim_party_role not null,

  -- Per-claim contact (overrides company defaults)
  contact_name          text,
  contact_email         citext,
  contact_phone         text,

  notes                 text,
  acknowledged_at       timestamptz,           -- ack letter sent
  last_response_at      timestamptz,           -- last time this party replied

  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),

  unique (claim_id, company_id, role)
);

create index claim_parties_claim_id_idx on public.claim_parties (claim_id);
create index claim_parties_company_id_idx on public.claim_parties (company_id);
create index claim_parties_role_idx on public.claim_parties (role);

-- ---------------------------------------------------------------------------
-- claim_status_history
-- ---------------------------------------------------------------------------
-- Every status change writes a row here. Used for SLA reporting (avg time
-- in each stage) and for the timeline view on a claim.
-- ---------------------------------------------------------------------------
create table public.claim_status_history (
  id                uuid primary key default gen_random_uuid(),
  claim_id          uuid not null references public.claims(id) on delete cascade,
  from_status_id    uuid references public.claim_statuses(id) on delete set null,
  to_status_id      uuid not null references public.claim_statuses(id) on delete restrict,
  changed_by        uuid references public.profiles(id) on delete set null,
  changed_at        timestamptz not null default now(),
  note              text
);

create index claim_status_history_claim_id_idx
  on public.claim_status_history (claim_id, changed_at desc);

-- Trigger to write history on status_id change
create or replace function public.log_claim_status_change()
returns trigger
language plpgsql
as $$
begin
  -- Initial insert: log the starting status
  if tg_op = 'INSERT' then
    insert into public.claim_status_history (claim_id, from_status_id, to_status_id, changed_by)
    values (new.id, null, new.status_id, new.created_by);
    return new;
  end if;

  -- Update: only log when status_id actually changes
  if new.status_id is distinct from old.status_id then
    insert into public.claim_status_history (claim_id, from_status_id, to_status_id, changed_by)
    values (new.id, old.status_id, new.status_id, auth.uid());
  end if;

  return new;
end;
$$;

create trigger claims_log_status_change
  after insert or update of status_id on public.claims
  for each row execute function public.log_claim_status_change();

-- ---------------------------------------------------------------------------
-- claim_pins
-- ---------------------------------------------------------------------------
-- Per-user pinned claims for the kanban / dashboard. App enforces a soft cap.
-- ---------------------------------------------------------------------------
create table public.claim_pins (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  claim_id    uuid not null references public.claims(id) on delete cascade,
  pinned_at   timestamptz not null default now(),
  primary key (user_id, claim_id)
);

create index claim_pins_claim_id_idx on public.claim_pins (claim_id);
