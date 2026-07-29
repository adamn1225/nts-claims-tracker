-- =============================================================================
-- Demo carrier seed data
-- Migration: 20260729000003_demo_carriers
-- =============================================================================
-- Synthetic records for demos before MCP and Central Dispatch credentials are
-- available. Every record is visibly marked as demo data and uses example.test
-- email addresses so it cannot be mistaken for a real carrier contact.
--
-- Fixed UUIDs and ON CONFLICT clauses make this migration idempotent.
-- =============================================================================

insert into public.companies (
  id,
  legal_name,
  dba_name,
  kinds,
  primary_email,
  primary_phone,
  city,
  state,
  postal_code,
  mc_number,
  dot_number,
  scac,
  external_source,
  notes
)
values
  (
    'd0000000-0000-4000-8000-000000000001',
    'DEMO Northstar Transport LLC',
    'Northstar Transport',
    array['carrier']::public.company_kind[],
    'dispatch@northstar.example.test',
    '(555) 010-1001',
    'Minneapolis',
    'MN',
    '55401',
    '812345',
    '2984101',
    'NSTX',
    'demo_seed',
    'Synthetic demo carrier. Verified and in good standing.'
  ),
  (
    'd0000000-0000-4000-8000-000000000002',
    'DEMO Blue Ridge Auto Hauling Inc.',
    'Blue Ridge Auto',
    array['carrier']::public.company_kind[],
    'claims@blueridge.example.test',
    '(555) 010-1002',
    'Charlotte',
    'NC',
    '28202',
    '823456',
    '3095202',
    'BRAH',
    'demo_seed',
    'Synthetic demo auto carrier for Central Dispatch scenarios.'
  ),
  (
    'd0000000-0000-4000-8000-000000000003',
    'DEMO Summit Reefer Logistics LLC',
    'Summit Reefer',
    array['carrier']::public.company_kind[],
    'safety@summitreefer.example.test',
    '(555) 010-1003',
    'Denver',
    'CO',
    '80202',
    '834567',
    '3106303',
    'SMRF',
    'demo_seed',
    'Synthetic demo carrier with an insurance-expiry warning.'
  ),
  (
    'd0000000-0000-4000-8000-000000000004',
    'DEMO Harbor Freight Carriers LLC',
    'Harbor Freight Carriers',
    array['carrier']::public.company_kind[],
    'operations@harborfreight.example.test',
    '(555) 010-1004',
    'Savannah',
    'GA',
    '31401',
    '845678',
    '3217404',
    'HFCL',
    'demo_seed',
    'Synthetic demo carrier with an active do-not-pay hold.'
  ),
  (
    'd0000000-0000-4000-8000-000000000005',
    'DEMO Prairie Flatbed Express Inc.',
    'Prairie Flatbed',
    array['carrier']::public.company_kind[],
    'admin@prairieflatbed.example.test',
    '(555) 010-1005',
    'Omaha',
    'NE',
    '68102',
    '856789',
    '3328505',
    'PRFX',
    'demo_seed',
    'Synthetic demo carrier with an expired verification snapshot.'
  ),
  (
    'd0000000-0000-4000-8000-000000000006',
    'DEMO Metro Final Mile LLC',
    'Metro Final Mile',
    array['carrier']::public.company_kind[],
    'support@metrofinalmile.example.test',
    '(555) 010-1006',
    'Columbus',
    'OH',
    '43215',
    '867890',
    '3439606',
    'MTFM',
    'demo_seed',
    'Synthetic demo carrier with verification pending.'
  )
on conflict (id) do update set
  legal_name = excluded.legal_name,
  dba_name = excluded.dba_name,
  kinds = excluded.kinds,
  primary_email = excluded.primary_email,
  primary_phone = excluded.primary_phone,
  city = excluded.city,
  state = excluded.state,
  postal_code = excluded.postal_code,
  mc_number = excluded.mc_number,
  dot_number = excluded.dot_number,
  scac = excluded.scac,
  external_source = excluded.external_source,
  notes = excluded.notes;

insert into public.carrier_verifications (
  id,
  company_id,
  source,
  status,
  dot_number,
  mc_number,
  legal_name,
  insurance_carrier,
  insurance_expiry,
  operating_status,
  raw_response,
  fetched_at,
  notes
)
values
  (
    'd1000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000001',
    'manual',
    'verified',
    '2984101',
    '812345',
    'DEMO Northstar Transport LLC',
    'Demo Mutual Commercial',
    '2027-06-30',
    'AUTHORIZED FOR Property',
    '{"_demo": true, "flags": []}'::jsonb,
    '2026-07-27 14:00:00+00',
    'Synthetic verification snapshot for product demonstrations.'
  ),
  (
    'd1000000-0000-4000-8000-000000000002',
    'd0000000-0000-4000-8000-000000000002',
    'central_dispatch',
    'verified',
    '3095202',
    '823456',
    'DEMO Blue Ridge Auto Hauling Inc.',
    'Demo Shield Insurance',
    '2027-03-31',
    'AUTHORIZED FOR Property',
    '{"_demo": true, "flags": [], "equipment": "auto_hauler"}'::jsonb,
    '2026-07-26 16:30:00+00',
    'Synthetic Central Dispatch verification snapshot.'
  ),
  (
    'd1000000-0000-4000-8000-000000000003',
    'd0000000-0000-4000-8000-000000000003',
    'descartes_mcp',
    'flagged',
    '3106303',
    '834567',
    'DEMO Summit Reefer Logistics LLC',
    'Demo Mutual Commercial',
    '2026-08-10',
    'AUTHORIZED FOR Property',
    '{"_demo": true, "flags": ["insurance_expiring_soon"]}'::jsonb,
    '2026-07-28 12:15:00+00',
    'Synthetic warning used to demonstrate verification review.'
  ),
  (
    'd1000000-0000-4000-8000-000000000004',
    'd0000000-0000-4000-8000-000000000004',
    'mycarrierpackets',
    'flagged',
    '3217404',
    '845678',
    'DEMO Harbor Freight Carriers LLC',
    'Demo Harbor Indemnity',
    '2026-12-31',
    'AUTHORIZED FOR Property',
    '{"_demo": true, "flags": ["active_payment_hold"]}'::jsonb,
    '2026-07-28 15:45:00+00',
    'Synthetic flagged carrier paired with a do-not-pay hold.'
  ),
  (
    'd1000000-0000-4000-8000-000000000005',
    'd0000000-0000-4000-8000-000000000005',
    'manual',
    'expired',
    '3328505',
    '856789',
    'DEMO Prairie Flatbed Express Inc.',
    'Demo Plains Casualty',
    '2026-06-30',
    'AUTHORIZED FOR Property',
    '{"_demo": true, "flags": ["verification_expired"]}'::jsonb,
    '2026-06-15 10:00:00+00',
    'Synthetic expired snapshot for review-queue demonstrations.'
  ),
  (
    'd1000000-0000-4000-8000-000000000006',
    'd0000000-0000-4000-8000-000000000006',
    'manual',
    'pending',
    '3439606',
    '867890',
    'DEMO Metro Final Mile LLC',
    null,
    null,
    'PENDING REVIEW',
    '{"_demo": true, "flags": []}'::jsonb,
    '2026-07-29 13:00:00+00',
    'Synthetic pending verification.'
  )
on conflict (id) do update set
  company_id = excluded.company_id,
  source = excluded.source,
  status = excluded.status,
  dot_number = excluded.dot_number,
  mc_number = excluded.mc_number,
  legal_name = excluded.legal_name,
  insurance_carrier = excluded.insurance_carrier,
  insurance_expiry = excluded.insurance_expiry,
  operating_status = excluded.operating_status,
  raw_response = excluded.raw_response,
  fetched_at = excluded.fetched_at,
  notes = excluded.notes;

insert into public.carrier_holds (
  id,
  company_id,
  hold_type,
  status,
  reason,
  requested_at,
  approved_at,
  notes
)
values (
  'd2000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000004',
  'do_not_pay',
  'active',
  'DEMO: unresolved high-value cargo claim; payment review required.',
  '2026-07-25 14:00:00+00',
  '2026-07-25 15:00:00+00',
  'Synthetic hold for product demonstrations. Do not treat as a real carrier restriction.'
)
on conflict (id) do update set
  company_id = excluded.company_id,
  hold_type = excluded.hold_type,
  status = excluded.status,
  reason = excluded.reason,
  requested_at = excluded.requested_at,
  approved_at = excluded.approved_at,
  notes = excluded.notes;

