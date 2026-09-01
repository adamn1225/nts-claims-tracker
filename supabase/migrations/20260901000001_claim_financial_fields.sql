-- Add internal financial fields and audit all financial edits made to claims.
alter table public.claims
  add column carrier_pay numeric(12,2),
  add column carrier_deductible numeric(12,2),
  add constraint claims_carrier_pay_nonnegative
    check (carrier_pay is null or carrier_pay >= 0),
  add constraint claims_carrier_deductible_nonnegative
    check (carrier_deductible is null or carrier_deductible >= 0);

create or replace function public.audit_claim_financial_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_values jsonb;
  new_values jsonb;
begin
  old_values := jsonb_build_object(
    'damage_claim_amount', old.damage_claim_amount,
    'shipment_value', old.shipment_value,
    'carrier_pay', old.carrier_pay,
    'carrier_deductible', old.carrier_deductible
  );
  new_values := jsonb_build_object(
    'damage_claim_amount', new.damage_claim_amount,
    'shipment_value', new.shipment_value,
    'carrier_pay', new.carrier_pay,
    'carrier_deductible', new.carrier_deductible
  );

  if old_values is distinct from new_values then
    insert into public.audit_logs (
      actor_id,
      entity_type,
      entity_id,
      action,
      before,
      after,
      metadata
    ) values (
      auth.uid(),
      'claims',
      new.id,
      'update',
      old_values,
      new_values,
      jsonb_build_object('category', 'financials')
    );
  end if;

  return new;
end;
$$;

create trigger claims_financial_audit
  after update of damage_claim_amount, shipment_value, carrier_pay, carrier_deductible
  on public.claims
  for each row execute function public.audit_claim_financial_changes();

create policy audit_logs_select_claim_staff on public.audit_logs
  for select to authenticated
  using (
    entity_type = 'claims'
    and exists (
      select 1
      from public.claims
      where claims.id = audit_logs.entity_id
    )
  );

comment on column public.claims.carrier_pay is
  'Internal amount payable to the motor carrier for the shipment.';
comment on column public.claims.carrier_deductible is
  'Internal carrier insurance deductible associated with the claim.';