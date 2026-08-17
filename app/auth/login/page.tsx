"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Lock,
  AlertCircle,
  Loader2,
  Building2,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inactivityMessage, setInactivityMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // Check for inactivity message on mount and clear stale client-side session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "inactivity") {
      setInactivityMessage(true);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
    if (params.get("message") === "password-updated") {
      setSuccessMessage(
        "Password updated successfully! Please log in with your new password.",
      );
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }

    // Clear any stale client-side session the server already signed out.
    // This prevents a background token-refresh from racing with the first login attempt.
    supabase.auth.signOut({ scope: "local" }).catch(() => { });
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        // Better error messages for common issues
        if (error.message.includes("Invalid login credentials")) {
          throw new Error("Invalid email or password. Please check your credentials and try again.");
        } else if (error.message.includes("Email not confirmed")) {
          throw new Error("Please confirm your email address before logging in. Check your inbox for the confirmation email.");
        } else {
          throw error;
        }
      }

      if (data?.user) {
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleCRMSSOLogin = () => {
    const returnUrl = encodeURIComponent(`${window.location.origin}/auth/sso`);
    window.location.href = `https://crm.ntsconnect.com/Account/Login?returnUrl=${returnUrl}`;
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-12 sm:px-6 lg:px-8">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-4 top-0 h-72 w-72 animate-pulse rounded-full bg-[#E85D04] opacity-20 blur-3xl"></div>
        <div className="absolute -right-4 top-1/3 h-72 w-72 animate-pulse rounded-full bg-[#FFA726] opacity-20 blur-3xl animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/3 h-72 w-72 animate-pulse rounded-full bg-[#E85D04] opacity-10 blur-3xl animation-delay-4000"></div>
      </div>

      <div className="relative z-10 w-full max-w-md space-y-8">
        {/* Logo & Header */}
        <div className="text-center">
          <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl bg-white/10 p-6 backdrop-blur-sm">
            <img src="/NTS-logo.svg" alt="NTS Logo" className="h-full w-full" />
          </div>
          <h2 className="mt-6 text-4xl font-bold tracking-tight text-white">
            Welcome Back
          </h2>
          <p className="mt-2 text-base text-slate-300">
            Sign in to manage cargo and transportation claims
          </p>
        </div>

        {/* Login Form */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-6 py-8 shadow-2xl backdrop-blur-xl sm:px-10">
          {successMessage && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200 backdrop-blur-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <p>{successMessage}</p>
            </div>
          )}

          {inactivityMessage && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200 backdrop-blur-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>
                You were logged out due to 1 hour of inactivity. Please sign in
                again.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200 backdrop-blur-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-6">
            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-200"
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
                  className="block w-full rounded-lg border border-white/10 bg-white/5 py-3 pl-10 pr-3 text-white placeholder-slate-400 backdrop-blur-sm focus:border-[#E85D04] focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#E85D04] focus:ring-offset-0 sm:text-sm"
                  placeholder="teammember@ntsconnect.com"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-200"
              >
                Password
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-white/10 bg-white/5 py-3 pl-10 pr-10 text-white placeholder-slate-400 backdrop-blur-sm focus:border-[#E85D04] focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#E85D04] focus:ring-offset-0 sm:text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end">
              <Link
                href="/auth/reset-password"
                className="text-sm font-medium text-[#FFA726] hover:text-[#E85D04] transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-[#E85D04] to-[#FFA726] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#E85D04]/20 transition-all hover:shadow-xl hover:shadow-[#E85D04]/30 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#E85D04] focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-slate-800/50 px-2 text-slate-400 backdrop-blur-sm">
                Or continue with
              </span>
            </div>
          </div>

          {/* NTS CRM SSO Button */}
          <button
            type="button"
            onClick={handleCRMSSOLogin}
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border-2 border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white shadow-sm backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60 active:bg-white/5"
          >
            Sign in with NTS CRM
          </button>
          <p className="mt-1 text-center text-xs text-slate-500 italic">
            You'll be redirected to CRM Login window
          </p>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-slate-400">
          Nationwide Transport Services © 2026
        </p>
      </div>
    </div>
  );
}
