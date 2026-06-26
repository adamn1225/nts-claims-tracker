import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "File a Claim — Nationwide Transport Services",
  description:
    "Submit a freight, cargo, or shipment claim to Nationwide Transport Services. Our claims team will acknowledge your submission within one business day.",
  // Don't index the embed surface; the brand site itself can be indexed.
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Public intake surface. No DashboardNav, no auth, no app chrome — this
 * route is designed to be embedded via <iframe> on NTS brand sites and to
 * stand alone at claims.ntslogistics.com/intake/claims.
 *
 * Iframe-friendly CSP headers are configured in `next.config.ts` for the
 * `/intake/:path*` source.
 */
export default function IntakeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // `overflow-x-clip` prevents any stray-wide child (e.g. an
    // overflow-x-auto pill row, long unbreakable file names) from creating
    // a horizontal page scroll on phones or inside iframes.
    <div className="min-h-screen overflow-x-clip bg-slate-50 text-slate-900">
      {children}
    </div>
  );
}
