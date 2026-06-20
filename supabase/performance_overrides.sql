-- Performance Dashboard: Agent Override Configuration
-- Allows sales coaches to configure GoTo agents who don't have SalesTrack accounts:
--   - Override display names (e.g. "Noah A." instead of full email fallback)
--   - Assign office_location / team group for the Groups view
--   - Exclude specific agents from performance reporting

create table if not exists public.performance_overrides (
  id                    uuid default gen_random_uuid() primary key,
  goto_user_email       text not null unique,
  goto_user_key         text,                          -- cached from GoTo admin API
  display_name_override text,                          -- shown instead of GoTo name
  office_location       text,                          -- group key for Group view
  is_excluded           boolean not null default false, -- hide from all reports
  notes                 text,                          -- internal coach notes
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- Index for fast email lookups during report generation
create index if not exists idx_performance_overrides_email
  on public.performance_overrides (goto_user_email);

-- RLS: only SalesTrack admins can see and modify this table
alter table public.performance_overrides enable row level security;

create policy "Admins can manage performance overrides"
  on public.performance_overrides
  for all
  using (
    exists (
      select 1 from public.brokers
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.brokers
      where id = auth.uid() and is_admin = true
    )
  );

-- Auto-update updated_at on row changes
create or replace function update_performance_overrides_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_performance_overrides_updated_at on public.performance_overrides;
create trigger set_performance_overrides_updated_at
  before update on public.performance_overrides
  for each row execute function update_performance_overrides_updated_at();
