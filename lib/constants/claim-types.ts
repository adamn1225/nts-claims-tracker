/**
 * Canonical claim_type values + labels. Mirrors the `claim_type` enum from
 * migration 20260729000002_claim_type_and_docs.sql.
 *
 * Kept in one file so intake, edit forms, reports, and any future export
 * agree on ordering and copy without drift.
 */

export const CLAIM_TYPES = [
  { value: "cargo_damage", label: "Cargo damage (visible)" },
  { value: "concealed_damage", label: "Concealed damage" },
  { value: "cargo_shortage", label: "Cargo shortage" },
  { value: "cargo_loss", label: "Cargo loss / non-delivery" },
  { value: "cargo_theft", label: "Cargo theft" },
  { value: "refused_shipment", label: "Refused shipment" },
  { value: "wrong_delivery", label: "Wrong delivery" },
  { value: "late_delivery", label: "Late delivery" },
  { value: "service_failure", label: "Service failure" },
  { value: "overage", label: "Overage" },
  { value: "temperature_excursion", label: "Temperature excursion" },
  { value: "contamination", label: "Contamination" },
  { value: "billing_dispute", label: "Billing dispute" },
  { value: "other", label: "Other" },
] as const;

export type ClaimType = (typeof CLAIM_TYPES)[number]["value"];

export const CLAIM_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  CLAIM_TYPES.map((c) => [c.value, c.label]),
);

export function claimTypeLabel(v: string | null | undefined): string {
  if (!v) return "— Not set";
  return CLAIM_TYPE_LABELS[v] ?? v;
}
