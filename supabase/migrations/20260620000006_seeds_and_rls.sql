-- =============================================================================
-- NTS Claims Tracker — Foundational Schema
-- Migration 06: Seed data + Row-Level Security policies
-- =============================================================================
-- Order of operations:
--   1. Seed lookup tables (claim_statuses, freight_types, trailer_types)
--   2. Seed cron config entries
--   3. Seed core email templates (acknowledgment + key requests)
--   4. Helper functions for RLS (role check, claim visibility)
--   5. Enable RLS + policies on every table
-- =============================================================================

-- ===========================================================================
-- 1. Claim statuses (CEO's 6 columns + side-state columns)
-- ===========================================================================
insert into public.claim_statuses (name, description, color, position, is_inbox, is_closed, is_denied, is_system)
values
  ('Inbox',                  'New submissions awaiting triage',                'info',     1, true,  false, false, true),
  ('Claim Started',          'Acknowledged and being documented',              'warning',  2, false, false, false, true),
  ('Processing Claim',       'Active investigation and party correspondence',  'accent',   3, false, false, false, true),
  ('Claim Awaiting Payment', 'Settlement negotiated; awaiting payment',        'primary',  4, false, false, false, true),
  ('Claim Closed',           'Resolved and closed (paid or recovered)',        'success',  5, false, true,  false, true),
  ('Claim Denied',           'Side state: denied or non-payable',              'danger',   6, false, true,  true,  true),
  ('Legal',                  'Side state: escalated to legal',                 'critical', 7, false, false, false, true);

-- ===========================================================================
-- 2. Freight types
-- ===========================================================================
insert into public.freight_types (name, position) values
  ('General Freight',           10),
  ('Auto Transport',            20),
  ('Heavy Equipment',           30),
  ('Heavy Haul / Oversize',     40),
  ('Container',                 50),
  ('Tractor',                   60),
  ('Wideload',                  70),
  ('Refrigerated',              80),
  ('Hazmat',                    90),
  ('Less Than Truckload (LTL)', 100),
  ('Other',                     1000);

-- ===========================================================================
-- 3. Trailer types
-- ===========================================================================
insert into public.trailer_types (name, position) values
  ('Dry Van',          10),
  ('Flatbed',          20),
  ('Reefer',           30),
  ('Step Deck',        40),
  ('RGN',              50),
  ('Lowboy',           60),
  ('Conestoga',        70),
  ('Hotshot',          80),
  ('Power Only',       90),
  ('Container Chassis',100),
  ('Auto Carrier',     110),
  ('Other',            1000);

-- ===========================================================================
-- 4. App settings (defaults)
-- ===========================================================================
insert into public.app_settings (key, value, description) values
  ('maintenance_mode',          'false'::jsonb,
   'When true, non-admin users see the maintenance screen.'),
  ('maintenance_message',       '"We''ll be right back."'::jsonb,
   'Message shown on the maintenance screen.'),
  ('value_bucket_threshold_usd','10000'::jsonb,
   'Damage amounts >= this auto-classify as credit_high_value.'),
  ('max_pinned_claims',         '10'::jsonb,
   'Per-user soft cap on pinned claims.'),
  ('public_intake_recaptcha',   'true'::jsonb,
   'Require reCAPTCHA on public intake form (ntslogistics.com/claims).'),
  ('public_intake_rate_limit_per_hour', '5'::jsonb,
   'Max public intake submissions per IP per hour.');

-- ===========================================================================
-- 5. Cron config (rows created in advance; actual schedules wired via pg_cron later)
-- ===========================================================================
insert into public.cron_config (key, schedule, is_enabled, description) values
  ('daily_digest',          '0 8 * * *', true,
   'Daily email digest of open claims, overdue tasks, and pending intake submissions.'),
  ('task_reminders',        '*/30 * * * *', true,
   'Every 30 min: notify assignees of tasks due in the next hour.'),
  ('intake_alerts',         '*/10 * * * *', true,
   'Every 10 min: alert claims staff of new pending_review intake submissions.'),
  ('stale_claim_detector',  '0 9 * * *', true,
   'Daily: flag claims with no activity in 7+ days for manager review.');

-- ===========================================================================
-- 6. Core email templates
-- ===========================================================================
insert into public.email_templates (key, name, template_type, subject, body_html, body_text, is_system, variables) values
  (
    'acknowledgment_shipper',
    'Acknowledgment Letter — Shipper / Customer',
    'acknowledgment',
    'Claim {{claim_number}} — Acknowledgment of Loss / Damage',
    '<p>Dear {{contact_name}},</p><p>This letter confirms that NTS has received notice of the loss or damage related to BOL <strong>{{bol_number}}</strong> moved on {{pickup_date}}. We have assigned this claim number <strong>{{claim_number}}</strong> for tracking.</p><p>Your assigned claims representative is {{claims_rep_name}} ({{claims_rep_email}}).</p><p>Please retain all packaging, damaged product, and related documentation pending our investigation.</p><p>Regards,<br/>NTS Claims Department</p>',
    'Dear {{contact_name}},\n\nThis letter confirms that NTS has received notice of the loss or damage related to BOL {{bol_number}} moved on {{pickup_date}}. We have assigned this claim number {{claim_number}} for tracking.\n\nYour assigned claims representative is {{claims_rep_name}} ({{claims_rep_email}}).\n\nPlease retain all packaging, damaged product, and related documentation pending our investigation.\n\nRegards,\nNTS Claims Department',
    true,
    '["claim_number","contact_name","bol_number","pickup_date","claims_rep_name","claims_rep_email"]'::jsonb
  ),
  (
    'acknowledgment_carrier',
    'Acknowledgment Letter — Carrier',
    'acknowledgment',
    'Claim {{claim_number}} — Notice of Claim Against Carrier',
    '<p>Dear {{contact_name}},</p><p>This is formal notice that a cargo claim has been filed regarding shipment moved under BOL <strong>{{bol_number}}</strong>, pickup date {{pickup_date}}, delivery date {{delivery_date}}.</p><p>Claim number: <strong>{{claim_number}}</strong>. Total claimed amount: <strong>{{damage_claim_amount}}</strong>.</p><p>Please acknowledge receipt and provide your carrier insurance information within 7 business days.</p><p>Regards,<br/>NTS Claims Department</p>',
    'Dear {{contact_name}},\n\nThis is formal notice that a cargo claim has been filed regarding shipment moved under BOL {{bol_number}}, pickup date {{pickup_date}}, delivery date {{delivery_date}}.\n\nClaim number: {{claim_number}}. Total claimed amount: {{damage_claim_amount}}.\n\nPlease acknowledge receipt and provide your carrier insurance information within 7 business days.\n\nRegards,\nNTS Claims Department',
    true,
    '["claim_number","contact_name","bol_number","pickup_date","delivery_date","damage_claim_amount"]'::jsonb
  ),
  (
    'acknowledgment_factoring',
    'Acknowledgment Letter — Factoring Company',
    'acknowledgment',
    'Claim {{claim_number}} — Notice to Factoring Company',
    '<p>Dear {{contact_name}},</p><p>NTS has opened a cargo claim against carrier <strong>{{carrier_name}}</strong> (MC# {{carrier_mc_number}}) for shipment under BOL {{bol_number}}.</p><p>Per our agreement, payment on this load is being held pending resolution of claim <strong>{{claim_number}}</strong>.</p><p>Regards,<br/>NTS Claims Department</p>',
    'Dear {{contact_name}},\n\nNTS has opened a cargo claim against carrier {{carrier_name}} (MC# {{carrier_mc_number}}) for shipment under BOL {{bol_number}}.\n\nPer our agreement, payment on this load is being held pending resolution of claim {{claim_number}}.\n\nRegards,\nNTS Claims Department',
    true,
    '["claim_number","contact_name","carrier_name","carrier_mc_number","bol_number"]'::jsonb
  ),
  (
    'acknowledgment_ap',
    'Internal Notice — Accounts Payable',
    'notification',
    'Hold Carrier Payment — Claim {{claim_number}}',
    '<p>AP Team,</p><p>Please place a payment hold on carrier <strong>{{carrier_name}}</strong> (MC# {{carrier_mc_number}}) for BOL <strong>{{bol_number}}</strong> pending claim {{claim_number}}.</p><p>Hold reason: {{hold_reason}}</p>',
    'AP Team,\n\nPlease place a payment hold on carrier {{carrier_name}} (MC# {{carrier_mc_number}}) for BOL {{bol_number}} pending claim {{claim_number}}.\n\nHold reason: {{hold_reason}}',
    true,
    '["claim_number","carrier_name","carrier_mc_number","bol_number","hold_reason"]'::jsonb
  ),
  (
    'request_bol',
    'Document Request — Bill of Lading',
    'request',
    'Claim {{claim_number}} — Please provide signed BOL',
    '<p>Dear {{contact_name}},</p><p>In connection with claim {{claim_number}}, please provide a copy of the signed Bill of Lading for BOL <strong>{{bol_number}}</strong>.</p><p>Regards,<br/>{{claims_rep_name}}</p>',
    'Dear {{contact_name}},\n\nIn connection with claim {{claim_number}}, please provide a copy of the signed Bill of Lading for BOL {{bol_number}}.\n\nRegards,\n{{claims_rep_name}}',
    true,
    '["claim_number","contact_name","bol_number","claims_rep_name"]'::jsonb
  );

-- ===========================================================================
-- 7. RLS helper functions
-- ===========================================================================
-- These are SECURITY DEFINER so they bypass RLS when checking the caller's
-- role. They return data only about the calling user.
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_broker_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select broker_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'manager') from public.profiles where id = auth.uid()),
    false
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  )
$$;

-- A claim is visible to the caller if:
--   - they are admin/manager
--   - they are a claims_staff and (owner_id = them OR no owner yet)
--   - they are a broker and broker_id = their linked broker
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
        or (p.role = 'broker' and c.broker_id = p.broker_id)
      )
  )
$$;

create or replace function public.can_write_claim(target_claim_id uuid)
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

-- ===========================================================================
-- 8. Enable RLS on every public table
-- ===========================================================================
alter table public.brokers                    enable row level security;
alter table public.profiles                   enable row level security;
alter table public.api_tokens                 enable row level security;
alter table public.companies                  enable row level security;
alter table public.intake_tokens              enable row level security;
alter table public.claim_statuses             enable row level security;
alter table public.claims                     enable row level security;
alter table public.claim_intake_submissions   enable row level security;
alter table public.claim_parties              enable row level security;
alter table public.claim_status_history       enable row level security;
alter table public.claim_pins                 enable row level security;
alter table public.claim_documents            enable row level security;
alter table public.claim_notes                enable row level security;
alter table public.correspondence_log         enable row level security;
alter table public.task_templates             enable row level security;
alter table public.tasks                      enable row level security;
alter table public.carrier_holds              enable row level security;
alter table public.claim_settlements          enable row level security;
alter table public.goto_connections           enable row level security;
alter table public.goto_admin_token           enable row level security;
alter table public.audit_logs                 enable row level security;
alter table public.notifications              enable row level security;
alter table public.app_settings               enable row level security;
alter table public.app_updates                enable row level security;
alter table public.feedback                   enable row level security;
alter table public.email_config               enable row level security;
alter table public.email_templates            enable row level security;
alter table public.ai_chat_history            enable row level security;
alter table public.cron_config                enable row level security;
alter table public.freight_types              enable row level security;
alter table public.trailer_types              enable row level security;

-- ===========================================================================
-- 9. Policies
-- ===========================================================================

-- ---------- profiles ----------
-- All authenticated users can see basic profile info (needed for @mentions,
-- assignee dropdowns, etc.). Sensitive fields (preferences) can be locked
-- down later via column-level grants or a view.
create policy profiles_select_authenticated on public.profiles
  for select to authenticated
  using (true);

-- Users can update their own profile EXCEPT role (role changes require admin).
-- The role-protection check uses a separate function to avoid recursive RLS.
create or replace function public.profile_role_unchanged(target_id uuid, new_role user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = new_role from public.profiles where id = target_id),
    true
  )
$$;

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and public.profile_role_unchanged(id, role));

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- brokers ----------
create policy brokers_select_authenticated on public.brokers
  for select to authenticated
  using (true);

create policy brokers_write_admin on public.brokers
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

-- ---------- api_tokens ----------
create policy api_tokens_admin_only on public.api_tokens
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- companies ----------
create policy companies_select_authenticated on public.companies
  for select to authenticated
  using (true);

create policy companies_insert_authenticated on public.companies
  for insert to authenticated
  with check (auth.uid() is not null);

create policy companies_update_staff on public.companies
  for update to authenticated
  using (public.current_user_role() in ('admin', 'manager', 'claims_staff'))
  with check (public.current_user_role() in ('admin', 'manager', 'claims_staff'));

create policy companies_delete_admin on public.companies
  for delete to authenticated
  using (public.is_admin());

-- ---------- intake_tokens ----------
create policy intake_tokens_admin on public.intake_tokens
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

-- ---------- claim_statuses ----------
create policy claim_statuses_select_authenticated on public.claim_statuses
  for select to authenticated using (true);
create policy claim_statuses_admin_write on public.claim_statuses
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

-- ---------- claims ----------
create policy claims_select on public.claims
  for select to authenticated
  using (
    public.is_admin_or_manager()
    or (public.current_user_role() = 'claims_staff' and (owner_id = auth.uid() or owner_id is null))
    or (public.current_user_role() = 'broker' and broker_id = public.current_user_broker_id())
  );

create policy claims_insert_staff on public.claims
  for insert to authenticated
  with check (public.current_user_role() in ('admin', 'manager', 'claims_staff'));

create policy claims_update_staff on public.claims
  for update to authenticated
  using (
    public.is_admin_or_manager()
    or (public.current_user_role() = 'claims_staff' and (owner_id = auth.uid() or owner_id is null))
  )
  with check (
    public.is_admin_or_manager()
    or (public.current_user_role() = 'claims_staff' and (owner_id = auth.uid() or owner_id is null))
  );

create policy claims_delete_admin on public.claims
  for delete to authenticated
  using (public.is_admin());

-- ---------- claim_intake_submissions ----------
-- Inserts come via service-role (public intake endpoint) or staff manual entry.
create policy claim_intake_select_staff on public.claim_intake_submissions
  for select to authenticated
  using (public.current_user_role() in ('admin', 'manager', 'claims_staff'));

create policy claim_intake_insert_staff on public.claim_intake_submissions
  for insert to authenticated
  with check (public.current_user_role() in ('admin', 'manager', 'claims_staff'));

create policy claim_intake_update_staff on public.claim_intake_submissions
  for update to authenticated
  using (public.current_user_role() in ('admin', 'manager', 'claims_staff'))
  with check (public.current_user_role() in ('admin', 'manager', 'claims_staff'));

-- ---------- claim_parties / claim_status_history / claim_pins ----------
create policy claim_parties_select on public.claim_parties
  for select to authenticated
  using (public.can_see_claim(claim_id));
create policy claim_parties_write on public.claim_parties
  for all to authenticated
  using (public.can_write_claim(claim_id))
  with check (public.can_write_claim(claim_id));

create policy claim_status_history_select on public.claim_status_history
  for select to authenticated
  using (public.can_see_claim(claim_id));
-- inserts happen via trigger as the session user, but policy still required:
create policy claim_status_history_insert on public.claim_status_history
  for insert to authenticated
  with check (public.can_see_claim(claim_id));

create policy claim_pins_self on public.claim_pins
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- claim_documents / claim_notes / correspondence_log ----------
create policy claim_documents_select on public.claim_documents
  for select to authenticated using (public.can_see_claim(claim_id));
create policy claim_documents_write on public.claim_documents
  for all to authenticated
  using (public.can_write_claim(claim_id))
  with check (public.can_write_claim(claim_id));

create policy claim_notes_select on public.claim_notes
  for select to authenticated using (public.can_see_claim(claim_id));
create policy claim_notes_write on public.claim_notes
  for all to authenticated
  using (public.can_write_claim(claim_id) or author_id = auth.uid())
  with check (public.can_write_claim(claim_id));

create policy correspondence_log_select on public.correspondence_log
  for select to authenticated using (public.can_see_claim(claim_id));
create policy correspondence_log_write on public.correspondence_log
  for all to authenticated
  using (public.can_write_claim(claim_id))
  with check (public.can_write_claim(claim_id));

-- ---------- tasks / task_templates ----------
create policy task_templates_select_authenticated on public.task_templates
  for select to authenticated using (true);
create policy task_templates_admin_write on public.task_templates
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

create policy tasks_select on public.tasks
  for select to authenticated
  using (public.can_see_claim(claim_id) or assigned_to = auth.uid());
create policy tasks_write on public.tasks
  for all to authenticated
  using (
    public.can_write_claim(claim_id)
    or assigned_to = auth.uid()
  )
  with check (
    public.can_write_claim(claim_id)
    or assigned_to = auth.uid()
  );

-- ---------- carrier_holds ----------
-- Read: anyone who can see claims involving this carrier
-- Insert (request): claims_staff and up
-- Approve / release: managers and admins only (enforced at policy level by status)
create policy carrier_holds_select_authenticated on public.carrier_holds
  for select to authenticated using (true);

create policy carrier_holds_insert_request on public.carrier_holds
  for insert to authenticated
  with check (
    public.current_user_role() in ('admin', 'manager', 'claims_staff')
    and status = 'requested'
  );

create policy carrier_holds_update_manager on public.carrier_holds
  for update to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

create policy carrier_holds_delete_admin on public.carrier_holds
  for delete to authenticated
  using (public.is_admin());

-- ---------- claim_settlements ----------
create policy claim_settlements_select on public.claim_settlements
  for select to authenticated using (public.can_see_claim(claim_id));
create policy claim_settlements_write on public.claim_settlements
  for all to authenticated
  using (public.can_write_claim(claim_id))
  with check (public.can_write_claim(claim_id));

-- ---------- goto_connections / goto_admin_token ----------
create policy goto_connections_self on public.goto_connections
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy goto_admin_token_admin on public.goto_admin_token
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- audit_logs ----------
create policy audit_logs_select_manager on public.audit_logs
  for select to authenticated
  using (public.is_admin_or_manager());
-- Inserts come from triggers or service-role; no INSERT policy means only service-role can write.

-- ---------- notifications ----------
create policy notifications_self on public.notifications
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ---------- app_settings / app_updates / feedback ----------
create policy app_settings_select_authenticated on public.app_settings
  for select to authenticated using (true);
create policy app_settings_admin_write on public.app_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy app_updates_select_published on public.app_updates
  for select to authenticated
  using (is_published or public.is_admin_or_manager());
create policy app_updates_admin_write on public.app_updates
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

create policy feedback_insert_authenticated on public.feedback
  for insert to authenticated with check (auth.uid() is not null);
create policy feedback_select_self_or_manager on public.feedback
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_or_manager());
create policy feedback_update_manager on public.feedback
  for update to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

-- ---------- email_config / email_templates ----------
create policy email_config_admin on public.email_config
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy email_templates_select_authenticated on public.email_templates
  for select to authenticated using (true);
create policy email_templates_admin_write on public.email_templates
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

-- ---------- ai_chat_history ----------
create policy ai_chat_self on public.ai_chat_history
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid());

-- ---------- cron_config ----------
create policy cron_config_admin on public.cron_config
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- freight_types / trailer_types ----------
create policy freight_types_select_authenticated on public.freight_types
  for select to authenticated using (true);
create policy freight_types_admin_write on public.freight_types
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

create policy trailer_types_select_authenticated on public.trailer_types
  for select to authenticated using (true);
create policy trailer_types_admin_write on public.trailer_types
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());
