"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Mail,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Loader2,
} from "lucide-react";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      });

      if (error) throw error;

      setSuccess(true);
      setEmail(""); // Clear the input
    } catch (err: any) {
      setError(err.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Logo & Header */}
        <div className="text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center">
            <img src="/NTS-logo.svg" alt="NTS Logo" className="h-full w-full" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
            Reset your password
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Enter your email and we'll send you a link to reset your password
          </p>
        </div>

        {/* Reset Form */}
        <div className="mt-8 rounded-lg bg-white px-6 py-8 shadow-xl sm:px-10">
          {/* Success Message */}
          {success && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
              <div className="text-sm text-emerald-800">
                <p className="font-semibold mb-1">Check your email</p>
                <p>
                  We've sent a password reset link to your email address. Click
                  the link in the email to set a new password.
                </p>
                <p className="mt-2 text-xs text-emerald-700">
                  Didn't receive it? Check your spam folder or try again in a
                  few minutes.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-6">
            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700"
              >
                Email address
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || success}
                  className="block w-full rounded-lg border border-slate-300 py-3 pl-10 pr-3 text-slate-900 placeholder-slate-400 focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04] focus:ring-offset-0 disabled:bg-slate-50 disabled:text-slate-500 sm:text-sm"
                  placeholder="teammember@ntsconnect.com"
                />
              </div>
            </div>

            {/* Send Reset Link Button */}
            <button
              type="submit"
              disabled={loading || success}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#E85D04] px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#C74E03] focus:outline-none focus:ring-2 focus:ring-[#E85D04] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 active:bg-[#B04503]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending reset link...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Email sent
                </>
              ) : (
                "Send reset link"
              )}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6">
            <Link
              href="/auth/login"
              className="flex items-center justify-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
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
