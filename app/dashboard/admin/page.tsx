"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DesktopOnlyView from "@/components/DesktopOnlyView";
import { useIsMobileOrTablet } from "@/lib/hooks/useMediaQuery";
import {
  ShieldCheck,
  Users,
  Mail,
  BarChart3,
  Settings,
  TrendingUp,
  Send,
  Key,
  Megaphone,
  Palette,
  Wrench,
} from "lucide-react";
import TeamMemberTable from "@/components/admin/TeamMemberTable";
import EmailManagement from "@/components/admin/EmailManagement";
import ApiTokenManagement from "@/components/admin/ApiTokenManagement";
import LandingReview from "@/components/admin/LandingReview";
import MaintenanceControl from "@/components/admin/MaintenanceControl";
import OnlineUsersIndicator from "@/components/admin/OnlineUsersIndicator";

function AdminDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const isMobileOrTablet = useIsMobileOrTablet();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Read active tab from URL, default to 'teamMembers'
  const tabFromUrl = searchParams.get('tab') as any || 'teamMembers';
  const [activeTab, setActiveTab] = useState<
    | "teamMembers"
    | "api-tokens"
    | "landing"
    | "email"
    | "maintenance"
    | "updates"
  >(tabFromUrl);

  // Update URL when tab changes
  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url.toString());
  };

  useEffect(() => {
    const check = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        const user = data?.user;
        if (!user || error) {
          router.push("/auth/login");
          return;
        }
        // Real admin check via profiles.role (canonical source of truth)
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        setIsAdmin(profile?.role === "admin");
        if (profileError)
          console.warn("Profile lookup error", profileError.message);
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [router, supabase]);

  // Show desktop-only message on mobile/tablet
  if (isMobileOrTablet) {
    return (
      <DesktopOnlyView
        pageName="Admin Panel"
        reason="The comprehensive admin dashboard with data tables and analytics requires a desktop screen."
        mobileAlternative={{
          href: "/dashboard",
          label: "Back to Dashboard",
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        Checking access…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-slate-900">
          Admin access required
        </h1>
        <p className="mb-6 text-slate-600">
          You don’t have permission to view this page. Please contact an
          administrator.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="rounded-lg bg-orange-500 px-4 py-2 font-medium text-white hover:bg-orange-600"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Admin Dashboard
          </h1>
          <p className="text-sm text-slate-600">
            Manage team members, email templates, and API tokens.
          </p>
        </div>
        <OnlineUsersIndicator />
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        <button
          onClick={() => handleTabChange("teamMembers")}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === "teamMembers"
              ? "border-b-2 border-orange-500 bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
        >
          <Users className="h-4 w-4" /> TeamMembers
        </button>
        <button
          onClick={() => handleTabChange("api-tokens")}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === "api-tokens"
              ? "border-b-2 border-orange-500 bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
        >
          <Key className="h-4 w-4" /> API Tokens
        </button>
        <button
          onClick={() => handleTabChange("landing")}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === "landing"
              ? "border-b-2 border-orange-500 bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
        >
          <Palette className="h-4 w-4" /> Landing Pages
        </button>
        <button
          onClick={() => handleTabChange("email")}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === "email"
              ? "border-b-2 border-orange-500 bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
        >
          <Mail className="h-4 w-4" /> Email
        </button>
        <button
          onClick={() => handleTabChange("maintenance")}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === "maintenance"
              ? "border-b-2 border-orange-500 bg-orange-50 text-orange-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
        >
          <Wrench className="h-4 w-4" /> Maintenance
        </button>
        <button
          onClick={() => router.push("/dashboard/admin/updates")}
          className="flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <Megaphone className="h-4 w-4" /> Updates
        </button>
      </div>

      {/* Panels */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {activeTab === "teamMembers" && <TeamMemberTable />}
        {activeTab === "api-tokens" && <ApiTokenManagement />}
        {activeTab === "landing" && <LandingReview />}
        {activeTab === "maintenance" && <MaintenanceControl />}
        {activeTab === "email" && <EmailManagement />}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
          <p className="text-sm">Loading admin panel...</p>
        </div>
      </div>
    }>
      <AdminDashboard />
    </Suspense>
  );
}
