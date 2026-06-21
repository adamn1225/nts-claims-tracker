-- =============================================================================
-- NTS Claims Tracker — Foundational Schema
-- Migration 01: Extensions + Enum types
-- =============================================================================
-- All enum types are declared here so that subsequent migrations can reference
-- them freely. Extensions are limited to those required by the core schema.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- case-insensitive email
create extension if not exists "pg_trgm";    -- fuzzy company / claim search

-- ---------------------------------------------------------------------------
-- Identity & access
-- ---------------------------------------------------------------------------
create type user_role as enum (
  'admin',          -- full platform access
  'manager',        -- approve holds, see all claims, run reports
  'claims_staff',   -- handle claims they own or are assigned
  'broker'          -- read + comment on claims tied to their customers
);

create type broker_source as enum (
  'manual',                 -- entered directly in claims tracker
  'csv_import',             -- bootstrapped from sales tracker export
  'sales_tracker_sync',     -- pushed in by cross-app sync job (future)
  'sso_provisioned'         -- created on first Microsoft SSO login
);

-- ---------------------------------------------------------------------------
-- Companies (shippers, carriers, factoring, AP, insurers)
-- ---------------------------------------------------------------------------
create type company_kind as enum (
  'shipper',
  'carrier',
  'factoring',
  'accounts_payable',
  'insurer',
  'broker_agency',  -- another broker firm if relevant on a claim
  'other'
);

-- ---------------------------------------------------------------------------
-- Claims
-- ---------------------------------------------------------------------------
create type claim_intake_source as enum (
  'web_form',              -- public ntslogistics.com/claims submission
  'branded_link',          -- per-customer pre-filled URL
  'api',                   -- system-to-system POST
  'email',                 -- inbound email parsed in
  'phone',                 -- logged by claims staff after a call
  'freightclaims_legacy',  -- imported from FreightClaims.com history
  'manual'                 -- entered directly by staff
);

create type claim_value_bucket as enum (
  'current',            -- under $10K
  'credit_high_value',  -- credit/high value escalation
  'legal'               -- legal bucket
);

create type claim_resolution as enum (
  'paid_full',
  'paid_partial',
  'denied',
  'withdrawn',
  'recovered',     -- subrogation succeeded
  'concession'     -- goodwill / business decision
);

-- ---------------------------------------------------------------------------
-- Claim parties
-- ---------------------------------------------------------------------------
create type claim_party_role as enum (
  'shipper',
  'customer',
  'consignee',
  'carrier',
  'factoring',
  'accounts_payable',
  'insurer',
  'broker_of_record'
);

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------
create type document_type as enum (
  'bill_of_lading',
  'proof_of_delivery',
  'damage_photo',
  'pickup_photo',
  'delivery_photo',
  'video',
  'repair_estimate',
  'replacement_invoice',
  'witness_statement',
  'presentation_of_loss',
  'release',
  'settlement_agreement',
  'payment_confirmation',
  'insurance_doc',
  'claim_form',
  'correspondence_attachment',
  'other'
);

create type document_source as enum (
  'intake_form',
  'email_attachment',
  'manual_upload',
  'goto_recording',
  'ai_generated',
  'system'
);

-- ---------------------------------------------------------------------------
-- Correspondence
-- ---------------------------------------------------------------------------
create type correspondence_channel as enum (
  'phone',
  'email',
  'sms',
  'letter',
  'in_person',
  'system'
);

create type correspondence_direction as enum (
  'inbound',
  'outbound',
  'internal'
);

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create type task_type as enum (
  'send_acknowledgment',
  'request_bol',
  'request_pod',
  'request_photos',
  'request_repair_estimate',
  'request_presentation_of_loss',
  'request_witness_statement',
  'follow_up_shipper',
  'follow_up_customer',
  'follow_up_carrier',
  'follow_up_factoring',
  'follow_up_accounts_payable',
  'follow_up_insurer',
  'internal_review',
  'manager_approval',
  'place_carrier_hold',
  'release_carrier_hold',
  'prepare_settlement',
  'close_claim',
  'other'
);

create type task_priority as enum (
  'low',
  'normal',
  'high',
  'critical'
);

create type task_status as enum (
  'open',
  'in_progress',
  'blocked',
  'completed',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- Carrier holds
-- ---------------------------------------------------------------------------
create type carrier_hold_type as enum (
  'do_not_pay',
  'payment_hold',
  'dispatch_hold',
  'monitoring_only'
);

create type carrier_hold_status as enum (
  'requested',
  'approved',
  'active',
  'released',
  'denied_approval'
);

-- ---------------------------------------------------------------------------
-- Intake
-- ---------------------------------------------------------------------------
create type intake_submission_status as enum (
  'pending_review',
  'promoted',
  'rejected',
  'duplicate'
);

create type intake_token_kind as enum (
  'branded_link',  -- shareable URL per customer/broker
  'api'            -- server-to-server API key
);

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
create type audit_action as enum (
  'insert',
  'update',
  'delete',
  'status_change',
  'hold_requested',
  'hold_approved',
  'hold_released',
  'document_uploaded',
  'correspondence_logged',
  'claim_closed',
  'claim_reopened'
);
