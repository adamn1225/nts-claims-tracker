import { useCallback, useEffect, useMemo, useState } from "react";
import { Claim, ClaimWithDetails } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

export type ClaimWithPin = ClaimWithDetails & {
  is_pinned: boolean;
  pin_position: number | null;
};

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
  const [rawClaims, setRawClaims] = useState<ClaimWithDetails[]>([]);
  const [pinsMap, setPinsMap] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [assignableUsers, setAssignableUsers] = useState<
    Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    }>
  >([]);

  const claims: ClaimWithPin[] = useMemo(
    () =>
      rawClaims.map((c) => ({
        ...c,
        is_pinned: pinsMap.has(c.id),
        pin_position: pinsMap.get(c.id) ?? null,
      })),
    [rawClaims, pinsMap],
  );

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
      setRawClaims([]);
      return;
    }

    setRawClaims((data ?? []) as unknown as ClaimWithDetails[]);
    setError(null);
  }, []);

  // Per-user pin order; RLS on claim_pins already scopes rows to auth.uid().
  const fetchPins = useCallback(async () => {
    const supabase = createClient();
    const { data, error: fetchErr } = await supabase
      .from("claim_pins")
      .select("claim_id, position")
      .order("position", { ascending: true });

    if (fetchErr) {
      console.error("[useClaims] fetch pins error:", fetchErr.message, fetchErr);
      setPinsMap(new Map());
      return;
    }
    setPinsMap(new Map((data ?? []).map((p) => [p.claim_id, p.position])));
  }, []);

  // Internal roles a claim can be handed off to. Brokers don't own claims.
  const fetchAssignableUsers = useCallback(async () => {
    const supabase = createClient();
    const { data, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("is_active", true)
      .in("role", ["admin", "manager", "claims_staff"])
      .order("first_name");

    if (fetchErr) {
      console.error("[useClaims] fetch assignable users error:", fetchErr);
      return;
    }
    setAssignableUsers(data ?? []);
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
      await Promise.all([fetchClaims(), fetchAssignableUsers(), fetchPins()]);
      if (!cancelled) setIsLoading(false);
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [fetchClaims, fetchAssignableUsers, fetchPins]);

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
      const previous = rawClaims;
      const target = previous.find((c) => c.id === claimId);
      if (!target || target.status_id === newStatusId) return;

      // Find the destination status so we can patch `status` locally without a refetch.
      const destStatus = previous.find((c) => c.status?.id === newStatusId)?.status ?? null;

      const nowIso = new Date().toISOString();

      setRawClaims((prev) =>
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
        setRawClaims(previous);
        setError(updateErr.message);
        return;
      }

      // Refetch in the background so the joined `status` is authoritative
      // (in case our locally-patched dest status was null).
      fetchClaims();
    },
    [rawClaims, fetchClaims],
  );

  /**
   * Reassign a claim's owner from the kanban board. Optimistically patches
   * local state, then persists via the existing assign endpoint (which
   * validates the target profile is active before writing).
   */
  const reassignClaim = useCallback(
    async (claimId: string, ownerId: string | null) => {
      const previous = rawClaims;
      const target = previous.find((c) => c.id === claimId);
      if (!target || target.owner_id === ownerId) return;

      const newOwner = ownerId
        ? (assignableUsers.find((u) => u.id === ownerId) ?? null)
        : null;

      setRawClaims((prev) =>
        prev.map((c) =>
          c.id === claimId
            ? { ...c, owner_id: ownerId, owner: newOwner }
            : c,
        ),
      );

      try {
        const res = await fetch(`/api/claims/${claimId}/assign`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner_id: ownerId }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? "Failed to reassign claim");
        }
      } catch (err) {
        console.error("[useClaims] reassignClaim error:", err);
        setRawClaims(previous);
        setError(err instanceof Error ? err.message : String(err));
        return;
      }

      fetchClaims();
    },
    [rawClaims, assignableUsers, fetchClaims],
  );

  /**
   * Pin or unpin a claim for the current user. Optimistic; rolls back on
   * server rejection (e.g. the max-pinned-claims cap).
   */
  const togglePin = useCallback(
    async (claimId: string) => {
      const previous = pinsMap;
      const isPinned = pinsMap.has(claimId);

      if (isPinned) {
        setPinsMap((prev) => {
          const next = new Map(prev);
          next.delete(claimId);
          return next;
        });
        try {
          const res = await fetch(`/api/claims/${claimId}/pin`, { method: "DELETE" });
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error ?? "Failed to unpin claim");
          }
        } catch (err) {
          setPinsMap(previous);
          setError(err instanceof Error ? err.message : String(err));
        }
        return;
      }

      const nextPosition = Math.max(0, ...Array.from(pinsMap.values())) + 1;
      setPinsMap((prev) => new Map(prev).set(claimId, nextPosition));
      try {
        const res = await fetch(`/api/claims/${claimId}/pin`, { method: "POST" });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? "Failed to pin claim");
        }
        await fetchPins();
      } catch (err) {
        setPinsMap(previous);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [pinsMap, fetchPins],
  );

  /**
   * Swap the pin position of two already-pinned claims. Used when a pinned
   * card is dragged onto another pinned card in the same column.
   */
  const reorderPins = useCallback(
    async (claimId: string, targetClaimId: string) => {
      if (claimId === targetClaimId) return;
      const previous = pinsMap;
      const a = pinsMap.get(claimId);
      const b = pinsMap.get(targetClaimId);
      if (a === undefined || b === undefined) return;

      setPinsMap((prev) => {
        const next = new Map(prev);
        next.set(claimId, b);
        next.set(targetClaimId, a);
        return next;
      });

      try {
        const res = await fetch(`/api/claims/${claimId}/pin`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ swap_with: targetClaimId }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? "Failed to reorder pinned claims");
        }
      } catch (err) {
        setPinsMap(previous);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [pinsMap],
  );

  return {
    claims,
    isLoading,
    error,
    currentUserId,
    assignableUsers,
    refetch: fetchClaims,
    moveClaimToStatus,
    reassignClaim,
    togglePin,
    reorderPins,
  };
}
