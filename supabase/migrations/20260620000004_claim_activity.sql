-- =============================================================================
-- NTS Claims Tracker — Foundational Schema
-- Migration 04: Documents + Notes + Correspondence + Tasks + Holds + Settlements
-- =============================================================================
-- All the per-claim activity tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- claim_documents
-- ---------------------------------------------------------------------------
-- File metadata only — actual files live in Supabase Storage at `storage_path`.
-- ai_extracted_fields holds AI-parsed structured data awaiting human review.
-- ---------------------------------------------------------------------------
create table public.claim_documents (
  id                       uuid primary key default gen_random_uuid(),
  claim_id                 uuid not null references public.claims(id) on delete cascade,
  party_id                 uuid references public.claim_parties(id) on delete set null,

  document_type            document_type not null,
  source                   document_source not null default 'manual_upload',

  storage_bucket           text not null default 'claim-documents',
  storage_path             text not null,
  filename                 text not null,
  mime_type                text,
  size_bytes               bigint,

  -- AI extraction
  ai_extracted_fields      jsonb,                          -- e.g. {bol_number, weight, carrier}
  ai_extracted_at          timestamptz,
  ai_requires_review       boolean not null default false,
  ai_reviewed_by           uuid references public.profiles(id) on delete set null,
  ai_reviewed_at           timestamptz,

  -- Operational
  is_required_evidence     boolean not null default false, -- shows on checklist
  description              text,

  uploaded_by              uuid references public.profiles(id) on delete set null,
  uploaded_at              timestamptz not null default now(),

  unique (storage_bucket, storage_path)
);

create index claim_documents_claim_id_idx on public.claim_documents (claim_id);
create index claim_documents_document_type_idx on public.claim_documents (document_type);
create index claim_documents_ai_requires_review_idx
  on public.claim_documents (ai_requires_review)
  where ai_requires_review = true;

-- ---------------------------------------------------------------------------
-- claim_notes
-- ---------------------------------------------------------------------------
-- Internal notes only. NOT correspondence with parties (that's correspondence_log).
-- ---------------------------------------------------------------------------
create table public.claim_notes (
  id                  uuid primary key default gen_random_uuid(),
  claim_id            uuid not null references public.claims(id) on delete cascade,
  body                text not null,
  is_ai_generated     boolean not null default false,
  is_pinned           boolean not null default false,
  author_id           uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index claim_notes_claim_id_idx on public.claim_notes (claim_id, created_at desc);
create index claim_notes_is_pinned_idx on public.claim_notes (claim_id) where is_pinned = true;

create trigger claim_notes_updated_at
  before update on public.claim_notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- correspondence_log
-- ---------------------------------------------------------------------------
-- Every message exchanged with a party. GoTo call summaries land here too.
-- ---------------------------------------------------------------------------
create table public.correspondence_log (
  id                       uuid primary key default gen_random_uuid(),
  claim_id                 uuid not null references public.claims(id) on delete cascade,
  party_id                 uuid references public.claim_parties(id) on delete set null,

  channel                  correspondence_channel not null,
  direction                correspondence_direction not null,

  subject                  text,
  body                     text,                          -- email body, call notes, SMS text

  -- Call-specific
  goto_call_id             text,                          -- GoTo recording ID
  call_duration_seconds    integer,
  call_recording_url       text,

  -- Email-specific
  email_message_id         text,
  email_thread_id          text,
  to_addresses             text[],
  cc_addresses             text[],

  -- AI assistance
  ai_summary               text,
  ai_action_items          jsonb,                         -- [{description, suggested_task_type}]
  requires_human_review    boolean not null default false,

  occurred_at              timestamptz not null default now(),
  logged_by                uuid references public.profiles(id) on delete set null,
  created_at               timestamptz not null default now()
);

create index correspondence_log_claim_id_idx
  on public.correspondence_log (claim_id, occurred_at desc);
create index correspondence_log_party_id_idx
  on public.correspondence_log (party_id);
create index correspondence_log_goto_call_id_idx
  on public.correspondence_log (goto_call_id)
  where goto_call_id is not null;

-- ---------------------------------------------------------------------------
-- task_templates
-- ---------------------------------------------------------------------------
-- Reusable task definitions that drive SOP automation. e.g. "on claim
-- creation, queue: acknowledgment letter + 5 document requests".
-- ---------------------------------------------------------------------------
create table public.task_templates (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  description         text,
  task_type           task_type not null,
  default_priority    task_priority not null default 'normal',
  default_due_offset  interval,                  -- e.g. '5 days'
  default_title       text not null,
  default_body        text,
  trigger_on_status   uuid references public.claim_statuses(id) on delete set null,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger task_templates_updated_at
  before update on public.task_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
-- Flat single-assignee model (assigned_to nullable for queue tasks).
-- ---------------------------------------------------------------------------
create table public.tasks (
  id                  uuid primary key default gen_random_uuid(),
  claim_id            uuid not null references public.claims(id) on delete cascade,
  template_id         uuid references public.task_templates(id) on delete set null,

  type                task_type not null,
  title               text not null,
  description         text,

  priority            task_priority not null default 'normal',
  status              task_status not null default 'open',

  due_at              timestamptz,
  assigned_to         uuid references public.profiles(id) on delete set null,

  completed_at        timestamptz,
  completed_by        uuid references public.profiles(id) on delete set null,
  completion_notes    text,

  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index tasks_claim_id_idx on public.tasks (claim_id);
create index tasks_assigned_to_idx on public.tasks (assigned_to) where status in ('open', 'in_progress');
create index tasks_due_at_idx on public.tasks (due_at) where status in ('open', 'in_progress');
create index tasks_status_idx on public.tasks (status);

create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- carrier_holds
-- ---------------------------------------------------------------------------
-- Carrier-level risk flags. Do Not Pay, payment hold, dispatch hold.
-- Manager approval required for active holds; full audit trail of who did what.
-- ---------------------------------------------------------------------------
create table public.carrier_holds (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies(id) on delete restrict,
  related_claim_id     uuid references public.claims(id) on delete set null,

  hold_type            carrier_hold_type not null,
  status               carrier_hold_status not null default 'requested',
  reason               text not null,

  -- Lifecycle audit
  requested_by         uuid references public.profiles(id) on delete set null,
  requested_at         timestamptz not null default now(),

  approved_by          uuid references public.profiles(id) on delete set null,
  approved_at          timestamptz,

  released_by          uuid references public.profiles(id) on delete set null,
  released_at          timestamptz,
  release_reason       text,

  notes                text,
  updated_at           timestamptz not null default now()
);

create index carrier_holds_company_id_idx on public.carrier_holds (company_id);
create index carrier_holds_status_idx on public.carrier_holds (status);
create index carrier_holds_active_idx
  on public.carrier_holds (company_id)
  where status in ('approved', 'active');

create trigger carrier_holds_updated_at
  before update on public.carrier_holds
  for each row execute function public.set_updated_at();

-- Maintain companies.has_active_hold whenever a hold row changes status.
create or replace function public.refresh_company_active_hold()
returns trigger
language plpgsql
as $$
declare
  target_company uuid;
begin
  target_company := coalesce(new.company_id, old.company_id);

  update public.companies
  set has_active_hold = exists (
    select 1 from public.carrier_holds
    where company_id = target_company
      and status in ('approved', 'active')
  )
  where id = target_company;

  return null;
end;
$$;

create trigger carrier_holds_refresh_company
  after insert or update or delete on public.carrier_holds
  for each row execute function public.refresh_company_active_hold();

comment on table public.carrier_holds is
  'Carrier-level risk flags. Status flow: requested -> approved -> active -> released. Manager approval enforced via RLS in migration 06.';

-- ---------------------------------------------------------------------------
-- claim_settlements
-- ---------------------------------------------------------------------------
-- Money breakdown for a closed (or partially settled) claim. Supports the
-- FreightClaims Insights-style breakdown: Concession / Paid / Unpaid /
-- Direct Payment / Recovered / Denied. Multiple rows allowed per claim if
-- a settlement happens in tranches.
-- ---------------------------------------------------------------------------
create table public.claim_settlements (
  id                            uuid primary key default gen_random_uuid(),
  claim_id                      uuid not null references public.claims(id) on delete cascade,

  amount_paid_to_shipper        numeric(12,2) not null default 0,
  amount_concession             numeric(12,2) not null default 0,
  amount_recovered_from_carrier numeric(12,2) not null default 0,
  amount_direct_payment         numeric(12,2) not null default 0,
  amount_denied                 numeric(12,2) not null default 0,

  currency                      text not null default 'USD',

  settled_at                    timestamptz not null default now(),
  settled_by                    uuid references public.profiles(id) on delete set null,
  notes                         text,

  created_at                    timestamptz not null default now()
);

create index claim_settlements_claim_id_idx
  on public.claim_settlements (claim_id, settled_at desc);

-- ---------------------------------------------------------------------------
-- GoTo Connect integrations (call logging)
-- ---------------------------------------------------------------------------
-- Per-user OAuth tokens for GoTo, and a system-level admin token.
-- Tokens are encrypted at the app layer before insert (lib/encryption.ts).
-- ---------------------------------------------------------------------------
create table public.goto_connections (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references public.profiles(id) on delete cascade,
  goto_user_email        citext,
  goto_account_key       text,
  access_token_enc       text not null,
  refresh_token_enc      text not null,
  expires_at             timestamptz,
  preferred_device_id    text,
  scopes                 text[],
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger goto_connections_updated_at
  before update on public.goto_connections
  for each row execute function public.set_updated_at();

create table public.goto_admin_token (
  id                  integer primary key default 1,
  access_token_enc    text not null,
  refresh_token_enc   text not null,
  expires_at          timestamptz,
  updated_at          timestamptz not null default now(),
  check (id = 1)
);

create trigger goto_admin_token_updated_at
  before update on public.goto_admin_token
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- last_activity_at maintainer
-- ---------------------------------------------------------------------------
-- Any write to a child table bumps the parent claim's last_activity_at.
-- ---------------------------------------------------------------------------
create or replace function public.bump_claim_last_activity()
returns trigger
language plpgsql
as $$
declare
  target_claim uuid;
begin
  if tg_op = 'DELETE' then
    target_claim := old.claim_id;
  else
    target_claim := new.claim_id;
  end if;

  update public.claims
  set last_activity_at = now()
  where id = target_claim;

  return coalesce(new, old);
end;
$$;

create trigger claim_documents_bump_activity
  after insert or update or delete on public.claim_documents
  for each row execute function public.bump_claim_last_activity();

create trigger claim_notes_bump_activity
  after insert or update or delete on public.claim_notes
  for each row execute function public.bump_claim_last_activity();

create trigger correspondence_log_bump_activity
  after insert or update or delete on public.correspondence_log
  for each row execute function public.bump_claim_last_activity();

create trigger tasks_bump_activity
  after insert or update or delete on public.tasks
  for each row execute function public.bump_claim_last_activity();

create trigger claim_settlements_bump_activity
  after insert or update or delete on public.claim_settlements
  for each row execute function public.bump_claim_last_activity();
