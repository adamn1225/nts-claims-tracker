"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Check,
  X,
} from "lucide-react";
import {
  checkPasswordRequirements,
  calculatePasswordStrength,
  isPasswordValid,
} from "@/lib/password-strength";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validating, setValidating] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Verify user has a valid session (came from reset link)
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        // No session means they didn't come from a reset link
        router.push("/auth/login?error=invalid-reset-link");
      } else {
        setValidating(false);
      }
    };

    checkSession();
  }, [router, supabase.auth]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation - Check all requirements
    if (!isPasswordValid(password)) {
      setError(
        "Password must meet all requirements: 8+ characters, uppercase, lowercase, digit, and symbol",
      );
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setSuccess(true);

      // Sign out and redirect to login after 2 seconds
      // Using setTimeout to show success message briefly
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Sign out first (clears all session cookies)
      await supabase.auth.signOut();
      
      // Then redirect to login
      router.push("/auth/login?message=password-updated");
      router.refresh(); // Force refresh to clear any cached auth state
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#E85D04]" />
          <p className="text-sm text-slate-600">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Logo & Header */}
        <div className="text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center">
            <img src="/NTS-logo.svg" alt="NTS Logo" className="h-full w-full" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
            Set new password
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Choose a strong password for your account
          </p>
        </div>

        {/* Update Password Form */}
        <div className="mt-8 rounded-lg bg-white px-6 py-8 shadow-xl sm:px-10">
          {/* Success Message */}
          {success && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
              <div className="text-sm text-emerald-800">
                <p className="font-semibold mb-1">Password updated!</p>
                <p>
                  Your password has been successfully changed. Please log in with your new password.
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

          <form onSubmit={handleUpdatePassword} className="space-y-6">
            {/* New Password Input */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700"
              >
                New password
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || success}
                  className="block w-full rounded-lg border border-slate-300 py-3 pl-10 pr-10 text-slate-900 placeholder-slate-400 focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04] focus:ring-offset-0 disabled:bg-slate-50 disabled:text-slate-500 sm:text-sm"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading || success}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Password Strength Meter */}
              {password && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700">
                      Password Strength
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        calculatePasswordStrength(password).score <= 40
                          ? "text-rose-600"
                          : calculatePasswordStrength(password).score <= 60
                            ? "text-amber-600"
                            : calculatePasswordStrength(password).score <= 80
                              ? "text-blue-600"
                              : "text-emerald-600"
                      }`}
                    >
                      {calculatePasswordStrength(password).label}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full transition-all duration-300 ${calculatePasswordStrength(password).color}`}
                      style={{
                        width: `${calculatePasswordStrength(password).score}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Password Requirements Checklist */}
              {password && (
                <div className="mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-semibold text-slate-700">
                    Password must contain:
                  </p>
                  {[
                    {
                      key: "minLength",
                      label: "At least 8 characters",
                      met: checkPasswordRequirements(password).minLength,
                    },
                    {
                      key: "hasUppercase",
                      label: "One uppercase letter (A-Z)",
                      met: checkPasswordRequirements(password).hasUppercase,
                    },
                    {
                      key: "hasLowercase",
                      label: "One lowercase letter (a-z)",
                      met: checkPasswordRequirements(password).hasLowercase,
                    },
                    {
                      key: "hasDigit",
                      label: "One number (0-9)",
                      met: checkPasswordRequirements(password).hasDigit,
                    },
                    {
                      key: "hasSymbol",
                      label: "One symbol (!@#$%...)",
                      met: checkPasswordRequirements(password).hasSymbol,
                    },
                  ].map((req) => (
                    <div
                      key={req.key}
                      className="flex items-center gap-2 text-xs"
                    >
                      {req.met ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      <span
                        className={
                          req.met ? "text-emerald-700" : "text-slate-600"
                        }
                      >
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password Input */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-slate-700"
              >
                Confirm new password
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading || success}
                  className="block w-full rounded-lg border border-slate-300 py-3 pl-10 pr-10 text-slate-900 placeholder-slate-400 focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04] focus:ring-offset-0 disabled:bg-slate-50 disabled:text-slate-500 sm:text-sm"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading || success}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Update Password Button */}
            <button
              type="submit"
              disabled={loading || success}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#E85D04] px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#C74E03] focus:outline-none focus:ring-2 focus:ring-[#E85D04] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 active:bg-[#B04503]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating password...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Password updated
                </>
              ) : (
                "Update password"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-slate-500">
          Nationwide Transport Services © 2026
        </p>
      </div>
    </div>
  );
}
