-- Consolidate user-editable claim fields into one audit event per update.
drop trigger if exists claims_financial_audit on public.claims;
drop function if exists public.audit_claim_financial_changes();

create or replace function public.audit_claim_detail_changes()
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
    'summary', old.summary,
    'owner_id', old.owner_id,
    'filing_status', old.filing_status,
    'filed_at', old.filed_at,
    'claim_type', old.claim_type,
    'value_bucket', old.value_bucket,
    'value_bucket_manual', old.value_bucket_manual,
    'tms_order_number', old.tms_order_number,
    'bol_number', old.bol_number,
    'freight_type_id', old.freight_type_id,
    'trailer_type_id', old.trailer_type_id,
    'origin_city', old.origin_city,
    'origin_state', old.origin_state,
    'origin_postal_code', old.origin_postal_code,
    'destination_city', old.destination_city,
    'destination_state', old.destination_state,
    'destination_postal_code', old.destination_postal_code,
    'pickup_date', old.pickup_date,
    'delivery_date', old.delivery_date,
    'incident_date', old.incident_date,
    'damage_claim_amount', old.damage_claim_amount,
    'shipment_value', old.shipment_value,
    'carrier_pay', old.carrier_pay,
    'carrier_deductible', old.carrier_deductible,
    'currency', old.currency,
    'internal_description', old.internal_description,
    'resolution', old.resolution,
    'resolution_notes', old.resolution_notes
  );
  new_values := jsonb_build_object(
    'summary', new.summary,
    'owner_id', new.owner_id,
    'filing_status', new.filing_status,
    'filed_at', new.filed_at,
    'claim_type', new.claim_type,
    'value_bucket', new.value_bucket,
    'value_bucket_manual', new.value_bucket_manual,
    'tms_order_number', new.tms_order_number,
    'bol_number', new.bol_number,
    'freight_type_id', new.freight_type_id,
    'trailer_type_id', new.trailer_type_id,
    'origin_city', new.origin_city,
    'origin_state', new.origin_state,
    'origin_postal_code', new.origin_postal_code,
    'destination_city', new.destination_city,
    'destination_state', new.destination_state,
    'destination_postal_code', new.destination_postal_code,
    'pickup_date', new.pickup_date,
    'delivery_date', new.delivery_date,
    'incident_date', new.incident_date,
    'damage_claim_amount', new.damage_claim_amount,
    'shipment_value', new.shipment_value,
    'carrier_pay', new.carrier_pay,
    'carrier_deductible', new.carrier_deductible,
    'currency', new.currency,
    'internal_description', new.internal_description,
    'resolution', new.resolution,
    'resolution_notes', new.resolution_notes
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
      jsonb_build_object('category', 'claim_details')
    );
  end if;

  return new;
end;
$$;

create trigger claims_detail_audit
  after update of
    summary,
    owner_id,
    filing_status,
    filed_at,
    claim_type,
    value_bucket,
    value_bucket_manual,
    tms_order_number,
    bol_number,
    freight_type_id,
    trailer_type_id,
    origin_city,
    origin_state,
    origin_postal_code,
    destination_city,
    destination_state,
    destination_postal_code,
    pickup_date,
    delivery_date,
    incident_date,
    damage_claim_amount,
    shipment_value,
    carrier_pay,
    carrier_deductible,
    currency,
    internal_description,
    resolution,
    resolution_notes
  on public.claims
  for each row execute function public.audit_claim_detail_changes();