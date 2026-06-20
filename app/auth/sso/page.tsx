"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function SSOContent() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleSSO = async () => {
      try {
        // ✅ CASE 1: Returning from magic link (tokens in hash)
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);

        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (error) throw error;

          // Clean URL
          window.history.replaceState({}, document.title, "/auth/sso");

          // Full page reload instead of client-side push — ensures the new session
          // cookies are committed to the browser before the middleware runs on /dashboard.
          // router.push() can race ahead of cookie writes and cause an instant logout.
          window.location.href = "/dashboard";
          return;
        }

        // ✅ CASE 2: Returning from Supabase magic link with PKCE code in query string
        // (Supabase SSR uses PKCE flow by default; the magic link verify endpoint
        // appends ?code=... to redirectTo. We need to hand it off to the server-side
        // callback route which can call exchangeCodeForSession with the cookie store.)
        const code = params.get("code");
        if (code) {
          window.location.href = `/auth/callback?code=${encodeURIComponent(code)}`;
          return;
        }

        // ✅ CASE 2b: Returning from Supabase verify with token_hash (newer OTP flow)
        const token_hash = params.get("token_hash");
        const type = params.get("type");
        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as any,
          });
          if (error) throw error;
          window.location.href = "/dashboard";
          return;
        }

        // ✅ CASE 2c: Surface explicit errors returned by Supabase in the URL
        const urlError =
          params.get("error_description") ||
          params.get("error") ||
          hashParams.get("error_description") ||
          hashParams.get("error");

        // ✅ CASE 3: Initial SSO entry with CRM token
        const token = params.get("token");

        if (!token) {
          // Before flashing "Missing SSO token", check if a session is already
          // established (verify may have set cookies and redirected back with
          // no params). If so, just forward to the dashboard.
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            window.location.href = "/dashboard";
            return;
          }
          if (urlError) {
            throw new Error(urlError);
          }
          // No token, no session, no error — likely a stale tab or direct hit.
          // Send to login instead of flashing an error.
          window.location.href = "/auth/login";
          return;
        }

        const res = await fetch(`/api/sso-login?token=${token}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "SSO login failed");
        }

        // Redirect to Supabase magic link
        window.location.href = data.magicLink;
      } catch (err: any) {
        console.error("SSO error:", err.message);
        // Delay surfacing the error so an in-flight redirect (window.location.href)
        // gets a chance to win the race and we don't flash an error banner.
        setTimeout(() => {
          setError(err.message || "SSO failed");
          setLoading(false);
        }, 1200);
      }
    };

    handleSSO();
  }, [params, router, supabase]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
      {error ? (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-red-200">
          <p className="font-semibold">SSO Error</p>
          <p className="text-sm">{error}</p>
        </div>
      ) : (
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
          <p className="text-slate-300">{loading ? "Processing login..." : "Done"}</p>
        </div>
      )}
    </div>
  );
}

export default function SSOPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
          <p className="text-slate-300">Loading...</p>
        </div>
      </div>
    }>
      <SSOContent />
    </Suspense>
  );
}
