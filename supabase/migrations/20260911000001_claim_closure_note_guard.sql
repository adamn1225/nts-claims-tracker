-- Closing or denying a claim must always carry an explanation. This is
-- enforced at the database level (not just in the UI) so no write path —
-- kanban drag, API, bulk action, or a future one — can silently skip it.
create or replace function public.enforce_claim_closure_note()
returns trigger
language plpgsql
as $$
declare
  target_status public.claim_statuses%rowtype;
begin
  if new.status_id is distinct from old.status_id then
    select * into target_status from public.claim_statuses where id = new.status_id;

    if target_status.is_closed or target_status.is_denied then
      if new.resolution_notes is null or length(trim(new.resolution_notes)) = 0 then
        raise exception
          'A resolution note is required before moving a claim to a closed or denied status.'
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists claims_require_closure_note on public.claims;
create trigger claims_require_closure_note
  before update of status_id on public.claims
  for each row execute function public.enforce_claim_closure_note();
