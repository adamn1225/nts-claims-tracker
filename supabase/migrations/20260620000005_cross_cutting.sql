-- =============================================================================
-- NTS Claims Tracker — Foundational Schema
-- Migration 05: Cross-cutting (audit, notifications, app settings, email, AI)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
-- Generic audit trail. Specific events (status changes, hold lifecycle) also
-- have their own purpose-built history tables; this is the catch-all.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references public.profiles(id) on delete set null,
  entity_type   text not null,            -- 'claims', 'companies', 'carrier_holds', etc.
  entity_id     uuid not null,
  action        audit_action not null,
  before        jsonb,
  after         jsonb,
  metadata      jsonb,
  ip_address    inet,
  occurred_at   timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, occurred_at desc);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id, occurred_at desc);
create index audit_logs_action_idx on public.audit_logs (action);
create index audit_logs_occurred_at_idx on public.audit_logs (occurred_at desc);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
-- Per-user in-app notifications. Only created for actions the user did NOT
-- initiate (e.g. admin assigns them a claim, a party responds, a hold is
-- approved). Self-actions never write here.
-- ---------------------------------------------------------------------------
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  type          text not null,                 -- 'claim_assigned', 'task_due_soon', 'hold_approved'
  title         text not null,
  body          text,
  link          text,                          -- in-app URL

  -- Optional polymorphic context
  related_entity_type   text,
  related_entity_id     uuid,

  -- Lifecycle
  read_at       timestamptz,
  delivered_at  timestamptz,                   -- when push/email was sent
  channel       text not null default 'in_app',-- 'in_app', 'email', 'push'

  created_at    timestamptz not null default now()
);

create index notifications_user_id_idx
  on public.notifications (user_id, created_at desc);
create index notifications_unread_idx
  on public.notifications (user_id)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- app_settings
-- ---------------------------------------------------------------------------
-- Global key/value flags. Maintenance mode, feature toggles, value-bucket
-- thresholds, etc.
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key           text primary key,
  value         jsonb not null,
  description   text,
  updated_by    uuid references public.profiles(id) on delete set null,
  updated_at    timestamptz not null default now()
);

create trigger app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- app_updates (changelog widget on dashboard)
-- ---------------------------------------------------------------------------
create table public.app_updates (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  body            text,
  category        text,                              -- 'feature', 'fix', 'announcement'
  published_at    timestamptz not null default now(),
  is_published    boolean not null default false,
  cta_label       text,
  cta_url         text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index app_updates_published_idx
  on public.app_updates (published_at desc)
  where is_published = true;

create trigger app_updates_updated_at
  before update on public.app_updates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- feedback
-- ---------------------------------------------------------------------------
create table public.feedback (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete set null,
  category      text not null,                       -- 'bug', 'feature_request', 'question', 'other'
  subject       text not null,
  body          text not null,
  page_url      text,
  screenshot_url text,
  status        text not null default 'new',         -- 'new', 'triaged', 'in_progress', 'resolved', 'wont_fix'
  resolved_by   uuid references public.profiles(id) on delete set null,
  resolved_at   timestamptz,
  resolution_notes text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index feedback_status_idx on public.feedback (status, created_at desc);

create trigger feedback_updated_at
  before update on public.feedback
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- email_config
-- ---------------------------------------------------------------------------
-- SendGrid + SMTP credentials, encrypted at app layer.
-- ---------------------------------------------------------------------------
create table public.email_config (
  id                    integer primary key default 1,
  provider              text not null default 'sendgrid', -- 'sendgrid', 'smtp'
  sendgrid_api_key_enc  text,
  smtp_host             text,
  smtp_port             integer,
  smtp_user             text,
  smtp_pass_enc         text,
  from_email            citext not null,
  from_name             text not null default 'NTS Claims Tracker',
  reply_to_email        citext,
  is_active             boolean not null default true,
  updated_by            uuid references public.profiles(id) on delete set null,
  updated_at            timestamptz not null default now(),
  check (id = 1)
);

create trigger email_config_updated_at
  before update on public.email_config
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- email_templates
-- ---------------------------------------------------------------------------
-- Acknowledgment letters, document requests, follow-up templates. Templates
-- support {{variable}} substitution.
-- ---------------------------------------------------------------------------
create table public.email_templates (
  id              uuid primary key default gen_random_uuid(),
  key             text unique not null,         -- 'acknowledgment_shipper', 'request_bol', etc.
  name            text not null,
  description     text,
  template_type   text not null,                -- 'acknowledgment', 'request', 'follow_up', 'notification', 'digest'
  subject         text not null,
  body_html       text not null,
  body_text       text,
  variables       jsonb not null default '[]'::jsonb, -- documented {{vars}}
  is_active       boolean not null default true,
  is_system       boolean not null default false,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index email_templates_template_type_idx
  on public.email_templates (template_type);

create trigger email_templates_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ai_chat_history
-- ---------------------------------------------------------------------------
-- Conversation history for the AI coach. Scoped by user; optionally scoped
-- to a claim for in-context conversations.
-- ---------------------------------------------------------------------------
create table public.ai_chat_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  claim_id        uuid references public.claims(id) on delete set null,

  conversation_id uuid not null,                -- groups messages in a single thread
  role            text not null,                -- 'user' | 'assistant' | 'system' | 'tool'
  content         text not null,
  model           text,                         -- e.g. 'gpt-4o-mini'
  prompt_tokens   integer,
  completion_tokens integer,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

create index ai_chat_history_user_id_idx on public.ai_chat_history (user_id, created_at desc);
create index ai_chat_history_conversation_id_idx on public.ai_chat_history (conversation_id, created_at);
create index ai_chat_history_claim_id_idx on public.ai_chat_history (claim_id) where claim_id is not null;

-- ---------------------------------------------------------------------------
-- cron_config
-- ---------------------------------------------------------------------------
-- Tracks scheduled jobs (pg_cron) the app cares about, so the admin UI can
-- show their state.
-- ---------------------------------------------------------------------------
create table public.cron_config (
  key            text primary key,            -- e.g. 'daily_digest', 'task_reminders'
  schedule       text not null,               -- cron expression
  is_enabled     boolean not null default true,
  last_run_at    timestamptz,
  last_status    text,                        -- 'success', 'error'
  last_error     text,
  description    text,
  updated_at     timestamptz not null default now()
);

create trigger cron_config_updated_at
  before update on public.cron_config
  for each row execute function public.set_updated_at();
