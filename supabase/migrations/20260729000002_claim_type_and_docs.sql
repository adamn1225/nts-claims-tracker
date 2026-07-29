-- =============================================================================
-- NTS Claims Tracker — Post-Questionnaire Additions
-- Migration: 20260729000002_claim_type_and_docs
-- =============================================================================
-- From the George/Karen/Christina questionnaire response:
--   Q4: "types of claims" report — needs a claim_type field on claims
--   Q6: "ownership forms" and "police reports" — missing document_type enum values
-- =============================================================================

-- ---------------------------------------------------------------------------
-- claim_type enum (cause of loss / claim classification)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'claim_type') then
    create type public.claim_type as enum (
      'cargo_damage',        -- visible damage on delivery
      'concealed_damage',    -- damage discovered after acceptance
      'cargo_shortage',      -- short shipment / partial delivery
      'cargo_loss',          -- total loss / non-delivery
      'cargo_theft',
      'refused_shipment',    -- consignee refused delivery
      'wrong_delivery',      -- delivered to wrong party / address
      'late_delivery',
      'service_failure',     -- other broker/carrier service issue
      'overage',             -- more freight than manifest
      'temperature_excursion',
      'contamination',
      'billing_dispute',
      'other'
    );
  end if;
end$$;

alter table public.claims
  add column if not exists claim_type public.claim_type;

create index if not exists claims_claim_type_idx on public.claims (claim_type);

-- ---------------------------------------------------------------------------
-- Additional document_type enum values
-- ---------------------------------------------------------------------------
-- Postgres enum extensions are additive-only, name-unique — safe to add these
-- to an existing type without touching prior rows.
alter type public.document_type add value if not exists 'ownership_form';
alter type public.document_type add value if not exists 'police_report';
alter type public.document_type add value if not exists 'short_pay_notice';
alter type public.document_type add value if not exists 'non_pay_notice';
