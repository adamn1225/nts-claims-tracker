import { Building2, Mail } from "lucide-react";
import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Logo & Header */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E85D04] shadow-lg">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
            Check your email
          </h2>
        </div>

        {/* Email Verification Message */}
        <div className="mt-8 rounded-lg bg-white px-6 py-8 shadow-xl sm:px-10">
          <div className="flex flex-col items-center text-center">
            <div className="rounded-full bg-emerald-100 p-3">
              <Mail className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">
              Verify your email address
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              We've sent a confirmation email to your inbox. Please click the
              link in the email to activate your account.
            </p>
            <div className="mt-6 w-full rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-600">
                <strong>Didn't receive the email?</strong>
                <br />
                Check your spam folder or contact your administrator.
              </p>
            </div>
            <Link
              href="/auth/login"
              className="mt-6 text-sm font-medium text-[#E85D04] hover:text-[#C74E03]"
            >
              ← Back to sign in
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-slate-500">
          Nationwide Transport Services © 2026
        </p>
      </div>
    </div>
  );
}
