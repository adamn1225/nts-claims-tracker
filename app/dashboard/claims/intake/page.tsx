import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type IntakeStatusFilter =
  | "pending_review"
  | "promoted"
  | "rejected"
  | "duplicate"
  | "all";

const STATUS_TABS: { value: IntakeStatusFilter; label: string }[] = [
  { value: "pending_review", label: "Pending review" },
  { value: "promoted", label: "Promoted" },
  { value: "rejected", label: "Rejected" },
  { value: "duplicate", label: "Duplicate" },
  { value: "all", label: "All" },
];

export default async function IntakeQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const statusFilter: IntakeStatusFilter =
    (STATUS_TABS.find((t) => t.value === params.status)?.value as
      | IntakeStatusFilter
      | undefined) ?? "pending_review";

  // ---- Auth ----
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  if (
    profile?.is_active === false ||
    !role ||
    !["admin", "manager", "claims_staff"].includes(role)
  ) {
    redirect("/dashboard");
  }

  // ---- Fetch submissions via service role (read-only — RLS allows this
  // role to SELECT, but service role gives consistent behavior across the
  // triage surface, including the attachment URL endpoint downstream). ----
  const admin = createAdminClient();

  let query = admin
    .from("claim_intake_submissions")
    .select(
      "id, received_at, source, status, submitter_name, submitter_email, payload, attachments, promoted_claim_id",
    )
    .order("received_at", { ascending: false })
    .limit(100);

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: submissions, error } = await query;

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            Claim intake
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Triage queue
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Review submissions from the public form, then promote them into the
            claims kanban.
          </p>
        </div>
        <Link
          href="/dashboard/customers/kanban"
          className="text-sm font-medium text-accent hover:underline"
        >
          ← Back to claims board
        </Link>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-slate-200">
        {STATUS_TABS.map((tab) => {
          const active = tab.value === statusFilter;
          return (
            <Link
              key={tab.value}
              href={`/dashboard/claims/intake?status=${tab.value}`}
              className={[
                "rounded-t-md px-3 py-2 text-sm font-medium",
                active
                  ? "border-b-2 border-primary text-primary"
                  : "text-slate-600 hover:text-slate-900",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Failed to load submissions: {error.message}
        </div>
      )}

      {!error && (!submissions || submissions.length === 0) && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          No submissions matching this filter.
        </div>
      )}

      {!error && submissions && submissions.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Received</th>
                <th className="px-4 py-3 text-left">Submitter</th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Damage summary</th>
                <th className="px-4 py-3 text-left">Files</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {submissions.map((sub) => {
                const payload = (sub.payload ?? {}) as {
                  damage?: { description?: string | null };
                  submitter?: { company?: string | null };
                };
                const attachments = (sub.attachments ?? []) as unknown[];
                return (
                  <tr key={sub.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {formatDate(sub.received_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {sub.submitter_name ?? "—"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {sub.submitter_email ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {payload.submitter?.company ?? "—"}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-700">
                      <p className="line-clamp-2">
                        {payload.damage?.description ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {attachments.length}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/claims/intake/${sub.id}`}
                        className="font-medium text-accent hover:underline"
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending_review: "bg-warning/10 text-warning border-warning/30",
    promoted: "bg-success/10 text-success border-success/30",
    rejected: "bg-danger/10 text-danger border-danger/30",
    duplicate: "bg-slate-100 text-slate-600 border-slate-300",
  };
  const cls = styles[status] ?? "bg-slate-100 text-slate-600 border-slate-300";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
