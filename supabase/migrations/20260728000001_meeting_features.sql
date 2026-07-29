-- =============================================================================
-- NTS Claims Tracker — Post-Meeting Feature Set
-- Migration: 20260728000001_meeting_features
-- =============================================================================
-- Adds tables/enums/columns for the features surfaced in the George/Karen/Christina
-- meeting (see workspace-docs/nts-claims-tracker-concept/dev-feature-discovery-*.md)
-- and the FreightClaims parity screenshots:
--
--   1. Granular claim transaction ledger with payment source (P5)
--   2. FreightClaims-style filing status (Not Filed / Filed / Acknowledged / Closed)
--   3. Carrier verifications table (Descartes MCP integration scaffold)
--   4. TMS / dispatch order linking on claims (Central Dispatch integration scaffold)
--   5. Convenience view aggregating financial totals per claim
--
-- Additive-only: no destructive drops. Safe to apply on top of the existing
-- foundation.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'claim_transaction_type') then
    create type public.claim_transaction_type as enum (
      'inbound_payment',   -- money in (from carrier / insurance / etc.)
      'outbound_payment',  -- money out (payment to shipper / customer)
      'concession',        -- non-cash concession granted
      'adjustment',        -- correction / write-off
      'recovery',          -- subrogation recovery
      'direct_payment'     -- direct pay between two external parties (logged for reporting)
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_source') then
    -- Who actually paid / from whose bucket the money came.
    create type public.payment_source as enum (
      'carrier',
      'insurance',
      'nts',
      'broker',
      'shipper',
      'customer',
      'factoring',
      'unknown',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'claim_filing_status') then
    -- Mirrors the FreightClaims "Filing Status" column: does the carrier /
    -- insurance side know a claim has been formally filed against them?
    create type public.claim_filing_status as enum (
      'not_filed',
      'filed_not_acknowledged',
      'acknowledged',
      'closed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'carrier_verification_status') then
    create type public.carrier_verification_status as enum (
      'pending',
      'verified',
      'flagged',
      'expired',
      'failed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'carrier_verification_source') then
    create type public.carrier_verification_source as enum (
      'descartes_mcp',
      'mycarrierpackets',
      'central_dispatch',
      'manual'
    );
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- claim_transactions
-- ---------------------------------------------------------------------------
-- Individual money events tied to a claim. Complements `claim_settlements`,
-- which is a single closing snapshot. Transactions let staff log per-payment
-- entries as they happen (carrier partial payment, insurance settlement,
-- customer direct pay, etc.) and drive the "who paid what" report the
-- claims team asked for.
--
-- Optional links:
--   - from_party_id / to_party_id  → route the money between two claim parties
--                                    (nullable when NTS itself is a leg)
--   - related_document_id           → link a payment confirmation PDF
-- ---------------------------------------------------------------------------
create table if not exists public.claim_transactions (
  id                  uuid primary key default gen_random_uuid(),
  claim_id            uuid not null references public.claims(id) on delete cascade,

  transaction_type    public.claim_transaction_type not null,
  payment_source      public.payment_source not null default 'unknown',

  amount              numeric(12, 2) not null check (amount >= 0),
  currency            char(3) not null default 'USD',

  transaction_date    date not null default (now() at time zone 'utc')::date,
  gl_code             text,
  reference_number    text,           -- check #, wire ref, EFT trace, etc.

  from_party_id       uuid references public.claim_parties(id) on delete set null,
  to_party_id         uuid references public.claim_parties(id) on delete set null,
  related_document_id uuid references public.claim_documents(id) on delete set null,

  notes               text,

  logged_by           uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists claim_transactions_claim_id_idx
  on public.claim_transactions (claim_id);
create index if not exists claim_transactions_payment_source_idx
  on public.claim_transactions (payment_source);
create index if not exists claim_transactions_transaction_type_idx
  on public.claim_transactions (transaction_type);
create index if not exists claim_transactions_transaction_date_idx
  on public.claim_transactions (transaction_date);

-- Bump claim.last_activity_at whenever a transaction is logged.
create or replace function public.bump_claim_last_activity_from_txn()
returns trigger
language plpgsql
as $$
begin
  update public.claims
     set last_activity_at = now()
   where id = coalesce(new.claim_id, old.claim_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists claim_transactions_bump_activity on public.claim_transactions;
create trigger claim_transactions_bump_activity
  after insert or update or delete on public.claim_transactions
  for each row execute function public.bump_claim_last_activity_from_txn();

-- ---------------------------------------------------------------------------
-- claim_financial_summary — convenience view for FreightClaims-style rollup
-- ---------------------------------------------------------------------------
-- Aggregates transactions into the buckets that the FreightClaims Insights
-- screen breaks out (Concession / Paid / Unpaid / Direct Payment).
-- ---------------------------------------------------------------------------
create or replace view public.claim_financial_summary as
select
  c.id as claim_id,
  c.claim_number,
  c.damage_claim_amount,
  coalesce(sum(case when t.transaction_type = 'inbound_payment' then t.amount end), 0) as paid_total,
  coalesce(sum(case when t.transaction_type = 'concession'     then t.amount end), 0) as concession_total,
  coalesce(sum(case when t.transaction_type = 'direct_payment' then t.amount end), 0) as direct_payment_total,
  coalesce(sum(case when t.transaction_type = 'outbound_payment' then t.amount end), 0) as outbound_total,
  coalesce(sum(case when t.transaction_type = 'recovery'       then t.amount end), 0) as recovery_total,
  greatest(
    coalesce(c.damage_claim_amount, 0)
      - coalesce(sum(case when t.transaction_type in ('inbound_payment','direct_payment','concession') then t.amount end), 0),
    0
  ) as unpaid_total,
  count(t.id) as transaction_count
from public.claims c
left join public.claim_transactions t on t.claim_id = c.id
group by c.id, c.claim_number, c.damage_claim_amount;

-- ---------------------------------------------------------------------------
-- claims: filing_status + integration references
-- ---------------------------------------------------------------------------

alter table public.claims
  add column if not exists filing_status public.claim_filing_status not null default 'not_filed',
  add column if not exists filed_at timestamptz,
  add column if not exists central_dispatch_order_number text,
  add column if not exists mcp_verification_id uuid;

create index if not exists claims_filing_status_idx on public.claims (filing_status);

-- ---------------------------------------------------------------------------
-- carrier_verifications — Descartes MCP / MyCarrierPackets scaffold
-- ---------------------------------------------------------------------------
-- Cached carrier vetting pulls from external sources. Stored per-company so
-- multiple claims against the same carrier reuse the last snapshot instead of
-- hammering the provider API. `raw_response` keeps the full payload for future
-- field extraction without another round trip.
-- ---------------------------------------------------------------------------
create table if not exists public.carrier_verifications (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id) on delete cascade,

  source             public.carrier_verification_source not null,
  status             public.carrier_verification_status not null default 'pending',

  -- Common identity fields extracted from the response
  dot_number         text,
  mc_number          text,
  legal_name         text,
  dba_name           text,
  insurance_carrier  text,
  insurance_expiry   date,
  operating_status   text,

  raw_response       jsonb,
  fetched_at         timestamptz not null default now(),
  requested_by       uuid references public.profiles(id) on delete set null,

  notes              text,

  unique (company_id, source, fetched_at)
);

create index if not exists carrier_verifications_company_id_idx
  on public.carrier_verifications (company_id);
create index if not exists carrier_verifications_source_idx
  on public.carrier_verifications (source);

-- Backfill the FK on claims now that the target table exists.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
     where table_schema = 'public'
       and table_name = 'claims'
       and constraint_name = 'claims_mcp_verification_id_fkey'
  ) then
    alter table public.claims
      add constraint claims_mcp_verification_id_fkey
      foreign key (mcp_verification_id)
      references public.carrier_verifications(id)
      on delete set null;
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- RLS: same policy family as the rest of the schema
-- ---------------------------------------------------------------------------

alter table public.claim_transactions enable row level security;
alter table public.carrier_verifications enable row level security;

-- claim_transactions: read = can_see_claim, write = can_write_claim
drop policy if exists claim_transactions_select on public.claim_transactions;
create policy claim_transactions_select on public.claim_transactions
  for select using (public.can_see_claim(claim_id));

drop policy if exists claim_transactions_insert on public.claim_transactions;
create policy claim_transactions_insert on public.claim_transactions
  for insert with check (public.can_write_claim(claim_id));

drop policy if exists claim_transactions_update on public.claim_transactions;
create policy claim_transactions_update on public.claim_transactions
  for update using (public.can_write_claim(claim_id))
             with check (public.can_write_claim(claim_id));

drop policy if exists claim_transactions_delete on public.claim_transactions;
create policy claim_transactions_delete on public.claim_transactions
  for delete using (public.is_admin_or_manager());

-- carrier_verifications: visible to any user who can see any claim tied to
-- the company; write is admin/manager only for now (we'll relax when we wire
-- the actual MCP API up).
drop policy if exists carrier_verifications_select on public.carrier_verifications;
create policy carrier_verifications_select on public.carrier_verifications
  for select using (
    public.is_admin_or_manager()
    or exists (
      select 1
        from public.claim_parties cp
        join public.claims c on c.id = cp.claim_id
       where cp.company_id = carrier_verifications.company_id
         and public.can_see_claim(c.id)
    )
  );

drop policy if exists carrier_verifications_insert on public.carrier_verifications;
create policy carrier_verifications_insert on public.carrier_verifications
  for insert with check (public.is_admin_or_manager());

drop policy if exists carrier_verifications_update on public.carrier_verifications;
create policy carrier_verifications_update on public.carrier_verifications
  for update using (public.is_admin_or_manager())
             with check (public.is_admin_or_manager());

drop policy if exists carrier_verifications_delete on public.carrier_verifications;
create policy carrier_verifications_delete on public.carrier_verifications
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants for the view (grants follow the underlying tables)
-- ---------------------------------------------------------------------------
grant select on public.claim_financial_summary to authenticated;

-- =============================================================================
-- Done. Run `npm run db:push` then `npm run db:types`.
-- =============================================================================
