-- =============================================================================
-- NTS Claims Tracker — Demo Features Round 2
-- Migration: 20260729000001_docs_and_carrier_notes
-- =============================================================================
--   1. Ensure `claim-documents` storage bucket exists (idempotent) with
--      matching mime allowlist + size cap policy so document uploads from
--      the claim detail page succeed even in a fresh Supabase project.
--   2. `company_notes` — persistent per-company notes for carrier profile
--      pages (claim history + notes surface).
--   3. `list_saved_views` — per-user saved filter combinations for the
--      claims list view (broker-only for now; nothing else uses it).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'claim-documents',
  'claim-documents',
  false,
  26214400, -- 25 MB
  array[
    'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv','text/plain',
    'video/mp4','video/quicktime','video/webm'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

-- Only staff/manager/admin may read files. Row-level access is enforced by
-- signed URLs generated server-side; direct storage access is locked down.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and policyname = 'claim_documents_read'
  ) then
    create policy claim_documents_read on storage.objects
      for select using (
        bucket_id = 'claim-documents'
        and public.is_admin_or_manager()
      );
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and policyname = 'claim_documents_write'
  ) then
    create policy claim_documents_write on storage.objects
      for insert with check (
        bucket_id = 'claim-documents'
        and coalesce(auth.role() = 'authenticated', false)
      );
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and policyname = 'claim_documents_delete'
  ) then
    create policy claim_documents_delete on storage.objects
      for delete using (
        bucket_id = 'claim-documents'
        and public.is_admin_or_manager()
      );
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- company_notes
-- ---------------------------------------------------------------------------
create table if not exists public.company_notes (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  body       text not null,
  is_pinned  boolean not null default false,
  author_id  uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_notes_company_id_idx
  on public.company_notes (company_id);

alter table public.company_notes enable row level security;

drop policy if exists company_notes_select on public.company_notes;
create policy company_notes_select on public.company_notes
  for select using (public.is_admin_or_manager() or coalesce(auth.role() = 'authenticated', false));

drop policy if exists company_notes_insert on public.company_notes;
create policy company_notes_insert on public.company_notes
  for insert with check (coalesce(auth.role() = 'authenticated', false));

drop policy if exists company_notes_update on public.company_notes;
create policy company_notes_update on public.company_notes
  for update using (public.is_admin_or_manager() or author_id = auth.uid())
             with check (public.is_admin_or_manager() or author_id = auth.uid());

drop policy if exists company_notes_delete on public.company_notes;
create policy company_notes_delete on public.company_notes
  for delete using (public.is_admin_or_manager() or author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- list_saved_views — per-user saved filter combinations for the claims list
-- ---------------------------------------------------------------------------
create table if not exists public.list_saved_views (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  scope      text not null default 'claims_list', -- forward-compatible with other list pages
  filters    jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scope, name)
);

alter table public.list_saved_views enable row level security;

drop policy if exists list_saved_views_owner on public.list_saved_views;
create policy list_saved_views_owner on public.list_saved_views
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
