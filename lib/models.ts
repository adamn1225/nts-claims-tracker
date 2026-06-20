import type { ShippingFrequency } from "@/lib/types";
import type { Database } from "./database.types";

export interface CustomerModel {
  id: string;
  brokerId: string | null;
  businessName: string | null;
  contactName: string | null;
  phone?: string;
  email?: string;
  industry?: string;
  city?: string;
  state?: string;
  status: string;
  shippingFrequency: ShippingFrequency;
  isPinned: boolean;
  pinOrder?: number;
  lastContactDate?: string;
  nextFollowUpDate?: string;
  estimatedValue?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type DbCustomerRow = Database["public"]["Tables"]["customers"]["Row"];
export type DbCustomerInsert =
  Database["public"]["Tables"]["customers"]["Insert"];
export type DbCustomerUpdate =
  Database["public"]["Tables"]["customers"]["Update"];

export function toCustomerModel(row: DbCustomerRow): CustomerModel {
  return {
    id: row.id,
    brokerId: row.broker_id,
    businessName: row.business_name,
    contactName: row.contact_name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    industry: row.industry ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    status: row.status,
    shippingFrequency: row.shipping_frequency as ShippingFrequency,
    isPinned: !!row.is_pinned,
    pinOrder: row.pin_order ?? undefined,
    lastContactDate: row.last_contact_date ?? undefined,
    nextFollowUpDate: row.next_follow_up_date ?? undefined,
    estimatedValue: (row as any).estimated_value ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export function fromCustomerModel(
  model: Partial<CustomerModel>,
): DbCustomerInsert | DbCustomerUpdate {
  const base: Partial<DbCustomerInsert> = {
    id: model.id,
    broker_id: model.brokerId,
    business_name: model.businessName,
    contact_name: model.contactName,
    phone: model.phone,
    email: model.email,
    industry: model.industry,
    city: model.city,
    state: model.state,
    status: model.status,
    shipping_frequency: model.shippingFrequency,
    is_pinned: model.isPinned,
    pin_order: model.pinOrder,
    last_contact_date: model.lastContactDate,
    next_follow_up_date: model.nextFollowUpDate,
    notes: model.notes,
  };

  // Remove undefined fields to avoid overwriting in updates
  const cleaned = Object.fromEntries(
    Object.entries(base).filter(([_, v]) => v !== undefined),
  ) as DbCustomerInsert;

  return cleaned;
}
