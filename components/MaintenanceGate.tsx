"use client";

import { useEffect, useState, useCallback } from "react";
import { Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import MaintenanceScreen from "@/components/MaintenanceScreen";

interface MaintenanceStatus {
  maintenanceEnabled: boolean;
  manualEnabled?: boolean;
  scheduledActive?: boolean;
  message: string | null;
  startsAt: string | null;
  endsAt: string | null;
}

const POLL_MS = 30000;

/**
 * Blocks non-admin users with a full-screen maintenance page when maintenance
 * mode is enabled. Admins bypass the block but see a small indicator that
 * maintenance is currently ON.
 */
export default function MaintenanceGate() {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Resolve admin status once.
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (active) setIsAdmin(false);
          return;
        }
        const { data: broker } = await supabase
          .from("brokers")
          .select("is_admin")
          .eq("id", user.id)
          .single();
        if (active) setIsAdmin(Boolean(broker?.is_admin));
      } catch {
        if (active) setIsAdmin(false);
      }
    };
    check();
    return () => {
      active = false;
    };
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/maintenance", { cache: "no-store" });
      if (!res.ok) return;
      const data: MaintenanceStatus = await res.json();
      setStatus(data);
    } catch {
      // fail open — don't block on network errors
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, POLL_MS);
    return () => clearInterval(id);
  }, [fetchStatus]);

  if (!status?.maintenanceEnabled) return null;

  // Non-admins (and unresolved state defaults to showing nothing until known)
  if (isAdmin === false) {
    return (
      <MaintenanceScreen
        message={status.message}
        endsAt={status.endsAt}
      />
    );
  }

  // Admin indicator
  if (isAdmin === true) {
    return (
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 shadow-md">
        <Wrench className="h-3.5 w-3.5" />
        {status.scheduledActive && !status.manualEnabled
          ? "Maintenance mode is ON for users (scheduled)"
          : "Maintenance mode is ON for users"}
      </div>
    );
  }

  return null;
}
