import { useCallback, useEffect, useState } from "react";
import { Claim, ClaimWithDetails } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

/**
 * useClaims
 *
 * Loads the active claim pipeline for the kanban / list views and keeps it
 * fresh via a Supabase realtime subscription.
 *
 * Notes:
 *  - Reads are RLS-gated server-side; we don't pre-filter by owner here. The
 *    UI is the same for claims staff (own + assigned) and managers/admins
 *    (all). Brokers see only claims tied to their customers.
 *  - We fetch joined `status`, `parties` (with `company`), and `owner` in a
 *    single PostgREST select so the card has everything it needs without
 *    N+1 round trips.
 *  - Realtime currently subscribes to `claims` only. If a party row changes
 *    independently the UI won't auto-refresh until a parent claim updates;
 *    that's good enough for v1.
 */
export function useClaims() {
  const [claims, setClaims] = useState<ClaimWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  const fetchClaims = useCallback(async () => {
    const supabase = createClient();
    const { data, error: fetchErr } = await supabase
      .from("claims")
      .select(
        `
          *,
          status:claim_statuses!claims_status_id_fkey (
            id, name, color, position, is_inbox, is_closed, is_denied
          ),
          parties:claim_parties (
            id, role, contact_name, contact_email, contact_phone,
            acknowledged_at, last_response_at,
            company:companies (
              id, legal_name, dba_name, primary_phone, primary_email, has_active_hold
            )
          ),
          owner:profiles!claims_owner_id_fkey (
            id, first_name, last_name, email
          )
        `,
      )
      .order("last_activity_at", { ascending: false });

    if (fetchErr) {
      console.error("[useClaims] fetch error:", fetchErr);
      setError(fetchErr.message);
      setClaims([]);
      return;
    }

    setClaims((data ?? []) as unknown as ClaimWithDetails[]);
    setError(null);
  }, []);

  // Initial load + auth identity.
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setCurrentUserId(user?.id ?? "");
      await fetchClaims();
      if (!cancelled) setIsLoading(false);
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [fetchClaims]);

  // Realtime: refetch on any claim insert/update/delete. Cheap and correct;
  // the alternative of patching the joined shape from payload.new is fragile.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("claims:kanban")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "claims" },
        () => {
          fetchClaims();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchClaims]);

  /**
   * Move a claim to a different status column. Updates the local state
   * optimistically; rolls back on error. `last_activity_at` is bumped so the
   * card sorts to the top of its new column.
   */
  const moveClaimToStatus = useCallback(
    async (claimId: string, newStatusId: string) => {
      const previous = claims;
      const target = previous.find((c) => c.id === claimId);
      if (!target || target.status_id === newStatusId) return;

      // Find the destination status so we can patch `status` locally without a refetch.
      const destStatus = previous.find((c) => c.status?.id === newStatusId)?.status ?? null;

      const nowIso = new Date().toISOString();

      setClaims((prev) =>
        prev.map((c) =>
          c.id === claimId
            ? {
                ...c,
                status_id: newStatusId,
                last_activity_at: nowIso,
                status: destStatus ?? c.status,
              }
            : c,
        ),
      );

      const supabase = createClient();
      const { error: updateErr } = await supabase
        .from("claims")
        .update({ status_id: newStatusId, last_activity_at: nowIso } satisfies Partial<Claim>)
        .eq("id", claimId);

      if (updateErr) {
        console.error("[useClaims] moveClaimToStatus error:", updateErr);
        setClaims(previous);
        setError(updateErr.message);
        return;
      }

      // Refetch in the background so the joined `status` is authoritative
      // (in case our locally-patched dest status was null).
      fetchClaims();
    },
    [claims, fetchClaims],
  );

  return {
    claims,
    isLoading,
    error,
    currentUserId,
    refetch: fetchClaims,
    moveClaimToStatus,
  };
}
