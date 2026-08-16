import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CompanyNotesPanel from "@/components/companies/CompanyNotesPanel";
import CompanyHoldsPanel from "@/components/companies/CompanyHoldsPanel";
import EditCompanyButton from "@/components/companies/EditCompanyButton";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  shipper: "Shipper",
  carrier: "Carrier",
  factoring: "Factoring",
  accounts_payable: "AP",
  insurer: "Insurer",
  broker_agency: "Broker agency",
  other: "Other",
};

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString();
}

function fmtMoney(n: number | null | undefined, ccy = "USD") {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: ccy,
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function CompanyDetailPage({
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

  const { data: company, error } = await supabase
    .from("companies")
    .select(
      `id, legal_name, dba_name, kinds, dot_number, mc_number, scac,
       primary_phone, primary_email, website,
       street_1, street_2, city, state, postal_code, country,
       notes, has_active_hold, is_active,
       created_at, updated_at`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) console.error("[CompanyDetail]", error);
  if (!company) notFound();

  // All claim parties for this company, joined to their claim.
  const { data: parties } = await supabase
    .from("claim_parties")
    .select(
      `id, role,
       claim:claims (
         id, claim_number, opened_at, closed_at, damage_claim_amount,
         currency, value_bucket, filing_status,
         status:claim_statuses!claims_status_id_fkey (id, name, is_closed)
       )`,
    )
    .eq("company_id", id);

  const claimRows = (parties ?? [])
    .map((p) => {
      const c = p.claim as unknown as {
        id: string;
        claim_number: string;
        opened_at: string;
        closed_at: string | null;
        damage_claim_amount: number | null;
        currency: string;
        value_bucket: string;
        filing_status: string | null;
        status: { name: string; is_closed: boolean } | null;
      } | null;
      if (!c) return null;
      return { role: p.role, claim: c };
    })
    .filter(<T,>(x: T | null): x is T => x !== null)
    .sort(
      (a, b) =>
        new Date(b.claim.opened_at).getTime() -
        new Date(a.claim.opened_at).getTime(),
    );

  const totalExposure = claimRows.reduce(
    (sum, r) => sum + Number(r.claim.damage_claim_amount ?? 0),
    0,
  );
  const openCount = claimRows.filter(
    (r) => !r.claim.status?.is_closed && !r.claim.closed_at,
  ).length;
  const closedCount = claimRows.length - openCount;

  // Latest verification (if any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- new table
  const { data: verifications } = await (supabase as any)
    .from("carrier_verifications")
    .select("id, source, status, insurance_carrier, insurance_expiry, operating_status, fetched_at")
    .eq("company_id", id)
    .order("fetched_at", { ascending: false })
    .limit(5);

  const address = [
    company.street_1,
    company.street_2,
    [company.city, company.state, company.postal_code]
      .filter(Boolean)
      .join(", "),
    company.country,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs text-slate-500">
          <Link href="/dashboard/companies" className="hover:text-primary">
            ← All companies
          </Link>
        </p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">
              {company.dba_name || company.legal_name}
            </h1>
            {company.dba_name && company.legal_name !== company.dba_name && (
              <span className="text-sm text-slate-500">
                ({company.legal_name})
              </span>
            )}
            {company.has_active_hold && (
              <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-danger">
                Do not pay
              </span>
            )}
            {!company.is_active && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Inactive
              </span>
            )}
            {(company.kinds ?? []).map((k: string) => (
              <span
                key={k}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600"
              >
                {KIND_LABELS[k] ?? k}
              </span>
            ))}
          </div>
          <EditCompanyButton company={company} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: identity + claims list */}
        <div className="space-y-6 lg:col-span-2">
          <Card title="Identity">
            <Dl>
              <Row label="Legal name" value={company.legal_name} />
              <Row label="DBA" value={company.dba_name} />
              <Row label="MC number" value={company.mc_number} />
              <Row label="DOT number" value={company.dot_number} />
              <Row label="SCAC" value={company.scac} />
              <Row label="Phone" value={company.primary_phone} />
              <Row label="Email" value={company.primary_email} />
              <Row label="Website" value={company.website} />
              <Row label="Address" value={address} />
            </Dl>
          </Card>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Claim history ({claimRows.length})
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{openCount} open</span>
                <span>·</span>
                <span>{closedCount} closed</span>
                <span>·</span>
                <span>Total exposure {fmtMoney(totalExposure)}</span>
              </div>
            </div>
            {claimRows.length === 0 ? (
              <p className="text-sm text-slate-500">
                No claims involve this company yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-1 pr-2 font-medium">Claim #</th>
                      <th className="py-1 pr-2 font-medium">Role</th>
                      <th className="py-1 pr-2 font-medium">Status</th>
                      <th className="py-1 pr-2 font-medium">Filing</th>
                      <th className="py-1 pr-2 font-medium">Opened</th>
                      <th className="py-1 pr-2 font-medium">Amount</th>
                      <th className="py-1 pr-2 font-medium">Bucket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claimRows.map((r) => (
                      <tr
                        key={r.claim.id}
                        className="border-t border-slate-100"
                      >
                        <td className="py-1 pr-2">
                          <Link
                            href={`/dashboard/claims/${r.claim.id}`}
                            className="font-mono font-semibold text-accent hover:underline"
                          >
                            {r.claim.claim_number}
                          </Link>
                        </td>
                        <td className="py-1 pr-2 capitalize">{r.role}</td>
                        <td className="py-1 pr-2">
                          {r.claim.status?.name ?? "—"}
                        </td>
                        <td className="py-1 pr-2 text-slate-500">
                          {r.claim.filing_status?.replace(/_/g, " ") ?? "—"}
                        </td>
                        <td className="py-1 pr-2 text-slate-500">
                          {fmtDate(r.claim.opened_at)}
                        </td>
                        <td className="py-1 pr-2 font-medium">
                          {fmtMoney(r.claim.damage_claim_amount, r.claim.currency)}
                        </td>
                        <td className="py-1 pr-2 capitalize text-slate-500">
                          {r.claim.value_bucket.replace(/_/g, " ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <CompanyHoldsPanel companyId={company.id} />
        </div>

        {/* Right: notes + verifications */}
        <div className="space-y-6">
          <CompanyNotesPanel companyId={company.id} />

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Carrier verifications ({(verifications ?? []).length})
            </h2>
            {(verifications ?? []).length === 0 ? (
              <p className="text-xs text-slate-500">
                No verifications on record. Trigger one from any claim
                involving this carrier.
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {(verifications ?? []).map(
                  (v: {
                    id: string;
                    source: string;
                    status: string;
                    insurance_carrier: string | null;
                    insurance_expiry: string | null;
                    operating_status: string | null;
                    fetched_at: string;
                  }) => (
                    <li
                      key={v.id}
                      className="rounded-md border border-slate-200 bg-slate-50 p-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold uppercase tracking-wide text-slate-700">
                          {v.source.replace(/_/g, " ")}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${v.status === "verified"
                            ? "bg-success/10 text-success"
                            : v.status === "flagged"
                              ? "bg-warning/10 text-warning-text"
                              : v.status === "failed" || v.status === "expired"
                                ? "bg-danger/10 text-danger"
                                : "bg-slate-200 text-slate-700"
                            }`}
                        >
                          {v.status}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-600">
                        {v.operating_status ?? "—"}
                      </p>
                      {v.insurance_carrier && (
                        <p className="text-slate-500">
                          {v.insurance_carrier} · exp{" "}
                          {fmtDate(v.insurance_expiry)}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-slate-400">
                        Fetched {fmtDate(v.fetched_at)}
                      </p>
                    </li>
                  ),
                )}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

// ----------------------------- helpers -----------------------------

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
    <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[10rem_1fr]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="whitespace-pre-wrap text-slate-900">{display}</dd>
    </div>
  );
}
