import { permanentRedirect } from "next/navigation";

// Legacy sales-tracker route. The original 1946-line customer detail page is
// archived as `page.legacy.tsx.bak` next to this file — it referenced dropped
// tables (`customers`, `customer_statuses`, etc.) and is no longer used.
//
// The kanban, triage promote action, and intake submission "View promoted
// claim" link still send users here with a claim UUID, so we 308-redirect to
// the real claim detail page at /dashboard/claims/[id] until those callers
// are fully migrated.
export default async function LegacyCustomerRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/dashboard/claims/${id}`);
}
