import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClaimTransactionsPanel from "@/components/claims/ClaimTransactionsPanel";
import ClaimActivityTimeline from "@/components/claims/ClaimActivityTimeline";
import ClaimIntegrationsPanel from "@/components/claims/ClaimIntegrationsPanel";
import ClaimDocumentsPanel from "@/components/claims/ClaimDocumentsPanel";
import ClaimTasksPanel from "@/components/claims/ClaimTasksPanel";
import ClaimHeaderActions from "@/components/claims/ClaimHeaderActions";
import ClaimFinancialsPanel from "@/components/claims/ClaimFinancialsPanel";
import ClaimEditDialog from "@/components/claims/ClaimEditDialog";

export const dynamic = "force-dynamic";

const PARTY_ROLE_LABELS: Record<string, string> = {
  shipper: "Shipper / customer",
  customer: "Customer",
  carrier: "Carrier",
  factoring_company: "Factoring company",
  accounts_payable: "Accounts payable",
  insurer: "Insurance carrier",
  broker: "Broker",
  other: "Other",
};

const VALUE_BUCKET_LABELS: Record<string, string> = {
  current: "Current (<$10K)",
  credit_high_value: "Credit / High Value",
  legal: "Legal",
};

const INTAKE_SOURCE_LABELS: Record<string, string> = {
  web_form: "Public intake form",
  freight_claims_com: "FreightClaims.com",
  email: "Email",
  phone: "Phone",
  manual: "Manual entry",
  branded_link: "Branded intake link",
};

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtMoney(n: number | null | undefined, currency = "USD"): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
}

function fmtRoute(
  city: string | null | undefined,
  state: string | null | undefined,
  zip: string | null | undefined,
): string {
  return (
    [city, state, zip].filter((p) => p && p.trim().length > 0).join(", ") || "—"
  );
}

function daysBetween(opened: string, closed?: string | null): number {
  const a = new Date(opened).getTime();
  const b = closed ? new Date(closed).getTime() : Date.now();
  return Math.max(0, Math.floor((b - a) / (1000 * 60 * 60 * 24)));
}

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // RLS handles access scoping. We just load the claim + relations.
  const { data: claim, error } = await supabase
    .from("claims")
    .select(
      `
        *,
        status:claim_statuses!claims_status_id_fkey (
          id, name, color, is_inbox, is_closed, is_denied
        ),
        parties:claim_parties (
          id, role, contact_name, contact_email, contact_phone,
          acknowledged_at, last_response_at, notes,
          company:companies (
            id, legal_name, dba_name, primary_phone, primary_email,
            has_active_hold, dot_number, mc_number
          )
        ),
        owner:profiles!claims_owner_id_fkey (
          id, first_name, last_name, email
        ),
        freight_type:freight_types!claims_freight_type_id_fkey (
          id, name
        ),
        trailer_type:trailer_types!claims_trailer_type_id_fkey (
          id, name
        )
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[ClaimDetailPage] fetch error:", error);
  }
  if (!claim) notFound();

  const parties = (claim.parties ?? []) as Array<{
    id: string;
    role: string;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    acknowledged_at: string | null;
    last_response_at: string | null;
    notes: string | null;
    company: {
      id: string;
      legal_name: string | null;
      dba_name: string | null;
      primary_phone: string | null;
      primary_email: string | null;
      has_active_hold: boolean | null;
      dot_number: string | null;
      mc_number: string | null;
    } | null;
  }>;

  const status = (claim.status ?? null) as
    | { name: string; is_closed: boolean | null; is_denied: boolean | null }
    | null;

  const owner = (claim.owner ?? null) as
    | { first_name: string | null; last_name: string | null; email: string | null }
    | null;
  const ownerName = owner
    ? [owner.first_name, owner.last_name].filter(Boolean).join(" ") ||
    owner.email ||
    "Unassigned"
    : "Unassigned";

  const freightTypeName =
    (claim.freight_type as { name: string } | null)?.name ?? null;
  const trailerTypeName =
    (claim.trailer_type as { name: string } | null)?.name ?? null;

  const valueBucketLabel =
    VALUE_BUCKET_LABELS[claim.value_bucket] ?? claim.value_bucket;
  const intakeSourceLabel =
    INTAKE_SOURCE_LABELS[claim.intake_source] ?? claim.intake_source;

  const daysOpen = daysBetween(claim.opened_at, claim.closed_at);

  // Role gates writes to notes / transactions / integrations. Brokers stay
  // read-only per the security model in copilot-instructions.md.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const canEdit =
    profile?.role === "admin" ||
    profile?.role === "manager" ||
    profile?.role === "claims_staff";

  // Users the current person can hand a claim off to. Brokers don't own
  // claims so filter to internal roles.
  const { data: assignableUsers } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, role, office_location")
    .eq("is_active", true)
    .in("role", ["admin", "manager", "claims_staff"])
    .order("first_name");

  const [
    { data: statusOptions },
    { data: freightTypeOptions },
    { data: trailerTypeOptions },
  ] =
    await Promise.all([
      supabase
        .from("claim_statuses")
        .select("id, name")
        .eq("is_active", true)
        .order("position"),
      supabase.from("freight_types").select("id, name").order("position"),
      supabase.from("trailer_types").select("id, name").order("position"),
    ]);

  const carrierIntegrationParties = parties
    .filter((p) => p.role === "carrier" && p.company)
    .map((p) => ({
      id: p.id,
      company_id: p.company!.id,
      company_name:
        p.company!.dba_name || p.company!.legal_name || "Unnamed carrier",
      dot_number: p.company!.dot_number,
      mc_number: p.company!.mc_number,
    }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- new column
  const centralDispatchOrder = (claim as any).central_dispatch_order_number as
    | string
    | null
    | undefined;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* ---- Header ---- */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link
            href="/dashboard/customers/kanban"
            className="hover:text-primary"
          >
            ← All claims
          </Link>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold text-slate-900">
            {claim.claim_number}
          </h1>
          {status && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              {status.name}
            </span>
          )}
          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
            {valueBucketLabel}
          </span>
          {claim.intake_submission_id && (
            <Link
              href={`/dashboard/claims/intake/${claim.intake_submission_id}`}
              className="rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:border-primary hover:text-primary"
            >
              View intake submission
            </Link>
          )}
          {canEdit && (
            <ClaimEditDialog
              key={claim.updated_at}
              claimId={claim.id}
              claimNumber={claim.claim_number}
              initialValues={{
                summary: claim.summary,
                status_id: claim.status_id,
                claim_type: claim.claim_type,
                value_bucket: claim.value_bucket,
                value_bucket_manual: claim.value_bucket_manual,
                tms_order_number: claim.tms_order_number,
                bol_number: claim.bol_number,
                freight_type_id: claim.freight_type_id,
                trailer_type_id: claim.trailer_type_id,
                origin_city: claim.origin_city,
                origin_state: claim.origin_state,
                origin_postal_code: claim.origin_postal_code,
                destination_city: claim.destination_city,
                destination_state: claim.destination_state,
                destination_postal_code: claim.destination_postal_code,
                pickup_date: claim.pickup_date,
                delivery_date: claim.delivery_date,
                incident_date: claim.incident_date,
                damage_claim_amount: claim.damage_claim_amount,
                shipment_value: claim.shipment_value,
                carrier_pay: claim.carrier_pay,
                carrier_deductible: claim.carrier_deductible,
                currency: claim.currency,
                internal_description: claim.internal_description,
                resolution: claim.resolution,
                resolution_notes: claim.resolution_notes,
              }}
              statuses={statusOptions ?? []}
              freightTypes={freightTypeOptions ?? []}
              trailerTypes={trailerTypeOptions ?? []}
            />
          )}
        </div>
        {claim.summary && (
          <p className="mt-2 text-sm text-slate-600">{claim.summary}</p>
        )}

        {/* Owner assignment + filing status controls */}
        <div className="mt-3">
          <ClaimHeaderActions
            claimId={claim.id}
            currentOwnerId={claim.owner_id}
            currentOwnerName={ownerName}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- new col
            currentFilingStatus={(claim as any).filing_status ?? null}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- new col
            currentFiledAt={(claim as any).filed_at ?? null}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- new col
            currentClaimType={(claim as any).claim_type ?? null}
            assignableUsers={
              (assignableUsers ?? []) as Array<{
                id: string;
                first_name: string | null;
                last_name: string | null;
                email: string | null;
                role: string | null;
                office_location: string | null;
              }>
            }
            canEdit={canEdit}
          />
        </div>
      </div>

      {/* ---- Top stats ---- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Opened" value={fmtDate(claim.opened_at)} />
        <Stat label="Days open" value={String(daysOpen)} />
        <Stat label="Owner" value={ownerName} />
        <Stat label="Intake source" value={intakeSourceLabel} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ---- Left column: shipment + route + dates + financials ---- */}
        <div className="space-y-6 lg:col-span-2">
          <Card title="Shipment">
            <Dl>
              <Row label="NTS order / load #" value={claim.tms_order_number} />
              <Row label="BOL #" value={claim.bol_number} />
              <Row label="Freight type" value={freightTypeName} />
              <Row label="Trailer type" value={trailerTypeName} />
            </Dl>
          </Card>

          <Card title="Route">
            <Dl>
              <Row
                label="Origin"
                value={fmtRoute(
                  claim.origin_city,
                  claim.origin_state,
                  claim.origin_postal_code,
                )}
              />
              <Row
                label="Destination"
                value={fmtRoute(
                  claim.destination_city,
                  claim.destination_state,
                  claim.destination_postal_code,
                )}
              />
              <Row label="Pickup date" value={fmtDate(claim.pickup_date)} />
              <Row label="Delivery date" value={fmtDate(claim.delivery_date)} />
              <Row label="Incident date" value={fmtDate(claim.incident_date)} />
            </Dl>
          </Card>

          <ClaimFinancialsPanel
            claimId={claim.id}
            currency={claim.currency}
            initialValues={{
              damage_claim_amount: claim.damage_claim_amount,
              shipment_value: claim.shipment_value,
              carrier_pay: claim.carrier_pay,
              carrier_deductible: claim.carrier_deductible,
            }}
            valueBucketLabel={valueBucketLabel}
            resolution={claim.resolution}
            resolutionNotes={claim.resolution_notes}
            canEdit={canEdit}
          />

          {claim.internal_description && (
            <Card title="Internal description">
              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {claim.internal_description}
              </p>
            </Card>
          )}

          <ClaimDocumentsPanel claimId={claim.id} canEdit={canEdit} />
        </div>

        {/* ---- Right column: parties + timestamps ---- */}
        <div className="space-y-6">
          <Card title={`Parties (${parties.length})`}>
            {parties.length === 0 ? (
              <p className="text-sm text-slate-500">No parties linked yet.</p>
            ) : (
              <ul className="space-y-4">
                {parties.map((p) => {
                  const companyName =
                    p.company?.legal_name ||
                    p.company?.dba_name ||
                    "(unnamed company)";
                  return (
                    <li
                      key={p.id}
                      className="rounded-md border border-slate-200 bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {PARTY_ROLE_LABELS[p.role] ?? p.role}
                          </p>
                          <p className="mt-0.5 text-sm font-medium text-slate-900">
                            {companyName}
                          </p>
                        </div>
                        {p.company?.has_active_hold && (
                          <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger">
                            Do not pay
                          </span>
                        )}
                      </div>
                      {(p.contact_name ||
                        p.contact_email ||
                        p.contact_phone) && (
                          <div className="mt-2 space-y-0.5 text-xs text-slate-600">
                            {p.contact_name && <p>{p.contact_name}</p>}
                            {p.contact_email && (
                              <p>
                                <a
                                  href={`mailto:${p.contact_email}`}
                                  className="text-accent hover:underline"
                                >
                                  {p.contact_email}
                                </a>
                              </p>
                            )}
                            {p.contact_phone && (
                              <p>
                                <a
                                  href={`tel:${p.contact_phone}`}
                                  className="text-accent hover:underline"
                                >
                                  {p.contact_phone}
                                </a>
                              </p>
                            )}
                          </div>
                        )}
                      {p.acknowledged_at && (
                        <p className="mt-2 text-[11px] text-success">
                          Acknowledged {fmtDate(p.acknowledged_at)}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Timeline">
            <Dl>
              <Row label="Opened" value={fmtDateTime(claim.opened_at)} />
              <Row
                label="Acknowledged"
                value={fmtDateTime(claim.acknowledged_at)}
              />
              <Row
                label="Last activity"
                value={fmtDateTime(claim.last_activity_at)}
              />
              <Row label="Closed" value={fmtDateTime(claim.closed_at)} />
            </Dl>
          </Card>

          <ClaimIntegrationsPanel
            claimId={claim.id}
            carrierParties={carrierIntegrationParties}
            existingCentralDispatchOrder={centralDispatchOrder ?? null}
            canEdit={canEdit}
          />
        </div>
      </div>

      {/* ---- Full-width sections: tasks, transactions + activity timeline ---- */}
      <ClaimTasksPanel
        claimId={claim.id}
        canEdit={canEdit}
        assignableUsers={
          (assignableUsers ?? []) as Array<{
            id: string;
            first_name: string | null;
            last_name: string | null;
            email: string | null;
            role: string | null;
            office_location: string | null;
          }>
        }
      />

      <ClaimTransactionsPanel
        claimId={claim.id}
        currency={claim.currency}
        damageClaimAmount={claim.damage_claim_amount}
        canEdit={canEdit}
      />

      <ClaimActivityTimeline claimId={claim.id} canEdit={canEdit} />
    </main>
  );
}

// --------------------------------- helpers ---------------------------------

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Dl({ children }: { children: React.ReactNode }) {
  return <dl className="space-y-1.5 text-sm">{children}</dl>;
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  const display =
    value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[12rem_1fr]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="whitespace-pre-wrap wrap-break-word text-slate-900">
        {display}
      </dd>
    </div>
  );
}
