import { supabase } from "../supabase";
import type { CustomerModel, DbCustomerRow } from "../models";
import { toCustomerModel, fromCustomerModel } from "../models";

function mapRows(rows: DbCustomerRow[]): CustomerModel[] {
  return rows.map(toCustomerModel);
}

export async function listCustomersByBroker(
  brokerId: string,
): Promise<CustomerModel[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("broker_id", brokerId)
    .order("is_pinned", { ascending: false })
    .order("pin_order", { ascending: true, nullsFirst: true })
    .order("business_name", { ascending: true });

  if (error) throw error;
  return mapRows(data ?? []);
}

export async function getCustomerById(
  id: string,
): Promise<CustomerModel | null> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toCustomerModel(data) : null;
}

export async function createCustomer(
  input: Omit<CustomerModel, "id" | "createdAt" | "updatedAt">,
): Promise<CustomerModel> {
  // Construct insert payload with required fields
  const payload = {
    broker_id: input.brokerId,
    business_name: input.businessName,
    contact_name: input.contactName,
    status: input.status,
    shipping_frequency: input.shippingFrequency,
    is_pinned: input.isPinned ?? false,
    phone: input.phone ?? null,
    email: input.email ?? null,
    industry: input.industry ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    pin_order: input.pinOrder ?? null,
    last_contact_date: input.lastContactDate ?? null,
    next_follow_up_date: input.nextFollowUpDate ?? null,
    estimated_value: input.estimatedValue ?? null,
    notes: input.notes ?? null,
  } as const;

  const { data, error } = await supabase
    .from("customers")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return toCustomerModel(data);
}

export async function updateCustomer(
  id: string,
  patch: Partial<CustomerModel>,
): Promise<CustomerModel> {
  const payload = fromCustomerModel(patch);
  const { data, error } = await supabase
    .from("customers")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return toCustomerModel(data);
}

export async function setPinned(
  id: string,
  isPinned: boolean,
  pinOrder?: number,
): Promise<void> {
  const payload = fromCustomerModel({ isPinned, pinOrder });
  const { error } = await supabase
    .from("customers")
    .update(payload)
    .eq("id", id);

  if (error) throw error;
}

export async function setNextFollowUp(
  id: string,
  nextFollowUpDate: string,
): Promise<void> {
  const payload = fromCustomerModel({ nextFollowUpDate });
  const { error } = await supabase
    .from("customers")
    .update(payload)
    .eq("id", id);

  if (error) throw error;
}
