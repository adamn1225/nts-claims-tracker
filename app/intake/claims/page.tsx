import { createClient } from "@/lib/supabase/server";
import IntakeForm from "./IntakeForm";

export const dynamic = "force-dynamic";

type LookupRow = { id: string; name: string };

/**
 * Public claim-intake form.
 *
 * Embeds at /intake/claims and is iframe-able onto NTS brand sites.
 * Submissions go to `claim_intake_submissions` (status = pending_review)
 * via the service-role API route at /api/intake/claims.
 */
export default async function IntakeClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ embed?: string; source?: string }>;
}) {
  const params = await searchParams;
  const isEmbed = params.embed === "1" || params.embed === "true";

  // Anon client is fine for lookups — freight_types and trailer_types are
  // read-only reference data and have permissive RLS.
  const supabase = await createClient();

  const [freightRes, trailerRes] = await Promise.all([
    supabase
      .from("freight_types")
      .select("id, name")
      .order("position", { ascending: true }),
    supabase
      .from("trailer_types")
      .select("id, name")
      .order("position", { ascending: true }),
  ]);

  const freightTypes: LookupRow[] = (freightRes.data ?? []) as LookupRow[];
  const trailerTypes: LookupRow[] = (trailerRes.data ?? []) as LookupRow[];

  return (
    <main
      className={
        isEmbed
          ? "px-4 py-6 sm:px-6"
          : "mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14"
      }
    >
      <div
        className={
          isEmbed
            ? "mb-6 flex items-center gap-3"
            : "mb-8 flex items-center gap-4 border-b border-slate-200 pb-6"
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nts-logo.png"
          alt="Nationwide Transport Services"
          className={isEmbed ? "h-12 w-auto" : "h-16 w-auto"}
        />
        {!isEmbed && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              Nationwide Transport Services
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold text-slate-900 sm:text-3xl">
              File a Claim
            </h1>
          </div>
        )}
        {isEmbed && (
          <h1 className="text-xl font-semibold text-slate-900">
            File a Claim
          </h1>
        )}
      </div>

      {!isEmbed && (
        <p className="mb-8 text-base text-slate-600">
          Use this form to report freight damage, loss, or a service failure.
          Our claims team will acknowledge your submission within one business
          day.
        </p>
      )}

      <IntakeForm
        freightTypes={freightTypes}
        trailerTypes={trailerTypes}
        embed={isEmbed}
      />

      <footer className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-500">
        <p>
          By submitting this form you confirm that the information provided is
          accurate to the best of your knowledge. NTS will use these details
          solely to investigate and resolve your claim.
        </p>
      </footer>
    </main>
  );
}
