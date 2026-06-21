import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import TriageActions from "./TriageActions";

export const dynamic = "force-dynamic";

type Attachment = {
  storage_path: string;
  filename: string;
  mime?: string;
  size?: number;
  document_type?: string;
};

type SubmissionPayload = {
  submitter?: {
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
    // Legacy submissions stored a single `name` field.
    name?: string | null;
    company?: string | null;
    is_personal?: boolean | null;
    email?: string | null;
    phone?: string | null;
  };
  shipment?: {
    tms_order_number?: string | null;
    bol_number?: string | null;
    carrier_name?: string | null;
    carrier_pro_number?: string | null;
    freight_type_id?: string | null;
    trailer_type_id?: string | null;
    commodity?: string | null;
  };
  origin?: { city?: string | null; state?: string | null; postal_code?: string | null };
  destination?: { city?: string | null; state?: string | null; postal_code?: string | null };
  dates?: {
    pickup_date?: string | null;
    delivery_date?: string | null;
    incident_date?: string | null;
  };
  damage?: {
    description?: string | null;
    claim_amount?: number | null;
    shipment_value?: number | null;
  };
};

export default async function IntakeSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  const admin = createAdminClient();

  const { data: submission, error } = await admin
    .from("claim_intake_submissions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !submission) notFound();

  const payload = (submission.payload ?? {}) as SubmissionPayload;
  const attachments = (submission.attachments ?? []) as Attachment[];

  // Resolve freight/trailer names for display.
  const [freightRes, trailerRes] = await Promise.all([
    payload.shipment?.freight_type_id
      ? admin
          .from("freight_types")
          .select("name")
          .eq("id", payload.shipment.freight_type_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    payload.shipment?.trailer_type_id
      ? admin
          .from("trailer_types")
          .select("name")
          .eq("id", payload.shipment.trailer_type_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const freightName = freightRes.data?.name ?? null;
  const trailerName = trailerRes.data?.name ?? null;

  // If already promoted, link to the resulting claim.
  let promotedClaimNumber: string | null = null;
  if (submission.promoted_claim_id) {
    const { data: c } = await admin
      .from("claims")
      .select("claim_number")
      .eq("id", submission.promoted_claim_id)
      .maybeSingle();
    promotedClaimNumber = c?.claim_number ?? null;
  }

  const editable = submission.status === "pending_review";

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Link
          href="/dashboard/claims/intake"
          className="hover:text-slate-900 hover:underline"
        >
          ← Triage queue
        </Link>
      </div>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Submission from {submission.submitter_name ?? "Unknown"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Received {formatDateTime(submission.received_at)} via{" "}
            <span className="font-medium">{submission.source}</span>
          </p>
        </div>
        <StatusBadge status={submission.status} />
      </header>

      {submission.status === "promoted" && promotedClaimNumber && (
        <div className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          Promoted to claim{" "}
          <Link
            href={`/dashboard/customers/${submission.promoted_claim_id}`}
            className="font-mono font-semibold hover:underline"
          >
            {promotedClaimNumber}
          </Link>
          .
        </div>
      )}

      {submission.status === "rejected" && submission.review_notes && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <span className="font-medium">Rejection note:</span>{" "}
          {submission.review_notes}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card title="Submitter">
            <KV label="First name" value={payload.submitter?.first_name} />
            <KV label="Last name" value={payload.submitter?.last_name} />
            <KV
              label="Company"
              value={
                payload.submitter?.is_personal ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="text-slate-700">
                      {payload.submitter?.company ?? "—"}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                      Personal shipment
                    </span>
                  </span>
                ) : (
                  payload.submitter?.company
                )
              }
            />
            <KV label="Email" value={payload.submitter?.email} />
            <KV label="Phone" value={payload.submitter?.phone} />
          </Card>

          <Card title="Shipment">
            <KV
              label="NTS order / load #"
              value={payload.shipment?.tms_order_number}
            />
            <KV label="BOL #" value={payload.shipment?.bol_number} />
            <KV
              label="Carrier"
              value={payload.shipment?.carrier_name}
            />
            <KV
              label="Carrier PRO #"
              value={payload.shipment?.carrier_pro_number}
            />
            <KV label="Freight type" value={freightName} />
            <KV label="Trailer type" value={trailerName} />
            <KV label="Commodity" value={payload.shipment?.commodity} />
          </Card>

          <Card title="Origin → Destination">
            <KV
              label="Origin"
              value={formatLocation(payload.origin)}
            />
            <KV
              label="Destination"
              value={formatLocation(payload.destination)}
            />
            <KV label="Pickup date" value={payload.dates?.pickup_date} />
            <KV label="Delivery date" value={payload.dates?.delivery_date} />
            <KV label="Incident date" value={payload.dates?.incident_date} />
          </Card>

          <Card title="Damage / loss">
            <KV
              label="Estimated claim"
              value={formatCurrency(payload.damage?.claim_amount)}
            />
            <KV
              label="Shipment value"
              value={formatCurrency(payload.damage?.shipment_value)}
            />
            <div className="pt-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Description
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                {payload.damage?.description ?? "—"}
              </p>
            </div>
          </Card>

          <Card title={`Attachments (${attachments.length})`}>
            {attachments.length === 0 ? (
              <p className="text-sm text-slate-500">
                No files were attached to this submission.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {attachments.map((a) => (
                  <li
                    key={a.storage_path}
                    className="flex items-center gap-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {a.filename}
                      </p>
                      <p className="text-xs text-slate-500">
                        {a.document_type?.replace(/_/g, " ") ?? "other"} ·{" "}
                        {a.mime ?? "unknown"} ·{" "}
                        {a.size ? formatBytes(a.size) : "?"}
                      </p>
                    </div>
                    <AttachmentLink
                      submissionId={id}
                      storagePath={a.storage_path}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card title="Actions">
            {editable ? (
              <TriageActions submissionId={id} />
            ) : (
              <p className="text-sm text-slate-500">
                This submission is no longer pending review.
              </p>
            )}
          </Card>

          <Card title="Metadata">
            <KV
              label="Submission ID"
              value={
                <span className="font-mono text-xs">{submission.id}</span>
              }
            />
            <KV
              label="Submitter IP"
              value={
                submission.submitter_ip
                  ? String(submission.submitter_ip)
                  : null
              }
            />
            <KV
              label="User agent"
              value={
                submission.user_agent ? (
                  <span className="break-all text-xs text-slate-600">
                    {submission.user_agent}
                  </span>
                ) : null
              }
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}

// ----------------------- subcomponents ---------------------------------

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function KV({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode | string | number | null | undefined;
}) {
  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : (value as React.ReactNode);
  return (
    <div className="grid grid-cols-[10rem_1fr] items-baseline gap-3 text-sm">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="text-slate-900">{display}</dd>
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
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium capitalize ${cls}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function AttachmentLink({
  submissionId,
  storagePath,
}: {
  submissionId: string;
  storagePath: string;
}) {
  // Anchor that the client component (or a small inline script) could
  // upgrade, but keeping it server-rendered: clicking will navigate to the
  // signed URL via the API endpoint. We use a form GET to avoid client JS.
  const href = `/api/admin/intake/${submissionId}/attachment-url?path=${encodeURIComponent(
    storagePath,
  )}&redirect=1`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:border-primary hover:text-primary"
    >
      Open
    </a>
  );
}

function formatLocation(loc?: {
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}): string | null {
  if (!loc) return null;
  const parts = [loc.city, loc.state, loc.postal_code].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function formatCurrency(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
