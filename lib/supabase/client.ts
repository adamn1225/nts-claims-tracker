import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase Client for Browser/Client Components
 * Uses browser storage for auth state
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
