import IntakeReceipt from "./IntakeReceipt";

export default async function IntakeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-slate-900">
              Claim submitted
            </h1>
            <p className="mt-2 text-slate-600">
              Thanks — your submission has been received. A member of the NTS
              claims team will reach out within one business day to acknowledge
              your claim and request any additional documentation.
            </p>
            {ref && (
              <p className="mt-4 text-sm text-slate-500">
                Reference:{" "}
                <span className="font-mono text-slate-900">{ref}</span>
                <br />
                Please keep this reference for your records and quote it in any
                follow-up emails.
              </p>
            )}
            <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">What happens next</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>
                  We&apos;ll send an acknowledgment email to the address you
                  provided.
                </li>
                <li>
                  A claims specialist will review your submission and reach out
                  to the carrier and any other involved parties.
                </li>
                <li>
                  You&apos;ll be contacted if additional documentation
                  (BOL, photos, repair estimate, etc.) is needed.
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {ref && <IntakeReceipt reference={ref} />}
    </main>
  );
}
