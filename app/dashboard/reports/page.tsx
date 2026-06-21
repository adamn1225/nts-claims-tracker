/**
 * Reports Page - Role-based Analytics Dashboard
 *
 * Routing Logic:
 * - Admin: Redirects to /dashboard/reports/admin (company-wide view)
 * - Manager: Redirects to /dashboard/reports/office (office-specific view)
 * - Regular TeamMember: Shows access denied
 *
 * This page acts as a router to the appropriate dashboard based on user role.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Lock } from "lucide-react";

export default function ReportsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkRoleAndRedirect = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth/login");
          return;
        }

        // Fetch user's teamMember record to check role
        const { data: teamMember, error: fetchError } = await supabase
          .from("team_members")
          .select("is_admin, is_manager, office_location")
          .eq("id", user.id)
          .single();

        if (fetchError) {
          throw new Error("Failed to fetch user role");
        }

        if (!teamMember) {
          throw new Error("TeamMember profile not found");
        }

        // Route based on role
        if (teamMember.is_admin) {
          router.push("/dashboard/reports/admin");
        } else if (teamMember.is_manager) {
          router.push("/dashboard/reports/office");
        } else {
          // Regular teamMember - show access denied
          setError(
            "You don't have permission to view analytics. Contact your manager.",
          );
          setLoading(false);
        }
      } catch (err) {
        console.error("Error checking role:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
        setLoading(false);
      }
    };

    checkRoleAndRedirect();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-orange-500" />
          <p className="mt-4 text-slate-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-4">
            <Lock className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h1 className="font-semibold text-red-900">Access Denied</h1>
              <p className="mt-2 text-sm text-red-700">{error}</p>
              <button
                onClick={() => router.push("/dashboard")}
                className="mt-4 inline-flex rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
