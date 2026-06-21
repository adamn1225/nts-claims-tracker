import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Service-role Supabase client. Bypasses RLS.
 *
 * USE ONLY in server-side code (API routes, server actions, scheduled jobs).
 * Never import this from client components or expose to the browser.
 *
 * Typical use cases:
 *  - Public intake form writing to `claim_intake_submissions` (RLS denies
 *    anon/auth writes; service-role is the documented entry point).
 *  - Storage operations against the private `claim-documents` bucket.
 *  - Admin workflows that intentionally bypass per-user RLS.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
    );
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
