import { redirect } from "next/navigation";

/**
 * Customers index — default to the Kanban view. The kanban/list/calendar
 * subpages are individually responsive, so no client-side media-query
 * redirect is needed here.
 */
export default function CustomersPage() {
  redirect("/dashboard/customers/kanban");
}
