/**
 * DashboardNav Component - NTS Claims Tracker Navigation
 *
 * DESIGN PATTERN: Responsive navigation with mobile drawer
 *
 * Navigation Structure:
 * - Dashboard: Overview & KPIs
 * - Claims Track: Active claims pipeline (Kanban view)
 * - Tasks: Follow-ups & reminders
 * - Reports: Analytics & performance
 *
 * MOBILE BEHAVIOR:
 * - Desktop (1024px+): Persistent sidebar
 * - Mobile (<1024px): Hamburger menu with slide-out drawer
 */

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSidebar } from "@/contexts/SidebarContext";
import {
  LayoutDashboard,
  Users,
  ListTodo,
  Workflow,
  Calendar,
  ShieldCheck,
  Phone,
  PhoneCall,
  PhoneOutgoing,
  Mail,
  Settings,
  Building2,
  Power,
  Loader2,
  Menu,
  Map,
  X,
  ToolCase,
  TrendingUp,
  ClipboardList,
  List,
  Star,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Upload,
  FolderInput,
  BarChart3,
  Calculator,
  Search,
  Megaphone,
  UserCircle2,
} from "lucide-react";

type NavigationItem = {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  children?: NavigationItem[];
  requiresRole?: readonly ("manager" | "admin" | "claims_staff")[];
};

type RoleViewMode = "admin" | "teamMember" | "manager";

const ROLE_VIEW_STORAGE_KEY = "app:role-view-mode";

const navigation: NavigationItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Overview & key metrics",
  },
  {
    name: "Claims Track",
    href: "/dashboard/customers/kanban",
    icon: ClipboardList,
    description: "Drag-and-drop claims pipeline",
  },
  {
    name: "Claims List",
    href: "/dashboard/claims/list",
    icon: List,
    description: "FreightClaims-style table view",
  },
  {
    name: "Companies",
    href: "/dashboard/companies",
    icon: Building2,
    description: "Shippers, carriers, factoring, insurers",
  },
  {
    name: "Claim Intake",
    href: "/dashboard/claims/intake",
    icon: FolderInput,
    description: "Review new claim submissions",
    requiresRole: ["claims_staff", "manager", "admin"] as const,
  },
  // {
  //   name: "My Profile",
  //   href: "/dashboard/team-members/me",
  //   icon: UserCircle2,
  //   description: "Your profile & portfolio",
  //   requiresRole: ["manager", "admin"] as const,
  // },
  // {
  //   name: "Team Directory",
  //   href: "/dashboard/team-members",
  //   icon: Users,
  //   description: "Browse all team members",
  //   requiresRole: ["manager", "admin"] as const,
  // },
  {
    name: "Reports",
    href: "/dashboard/reports",
    icon: BarChart3,
    description: "Claims analytics & breakdowns",
    requiresRole: ["claims_staff", "manager", "admin"] as const,
  },
  // {
  //   name: "Call Sessions",
  //   href: "/dashboard/call-sessions",
  //   icon: PhoneCall,
  //   description: "Custom lists & AI-coached dialer",
  //   requiresRole: ["manager", "admin", "sales_coach"] as const,
  // },
  // {
  //   name: "Import Contacts",
  //   href: "/dashboard/import",
  //   icon: Upload,
  //   description: "Quick CSV import to your list",
  // },
  // {
  //   name: "Distribution Center",
  //   href: "/dashboard/imports",
  //   icon: FolderInput,
  //   description: "Advanced import & distribution",
  //   requiresRole: ["manager", "admin", "sales_coach"] as const,
  // },
  {
    name: "Post Update",
    href: "/dashboard/updates/create",
    icon: Megaphone,
    description: "Share new features & announcements",
    requiresRole: ["manager", "admin"] as const,
  },
  {
    name: "Admin Console",
    href: "/dashboard/admin",
    icon: ShieldCheck,
    description: "Manage users & settings",
    requiresRole: ["admin"] as const,
  },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isClaimsStaff, setIsClaimsStaff] = useState(false);
  const [roleViewMode, setRoleViewMode] = useState<RoleViewMode>("admin");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [officeLocation, setOfficeLocation] = useState<string>("");

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Fetch user's role and permissions
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        setUserId(user.id);
        setEmail(user.email || "");

        // Source of truth for role/identity is `profiles` (1:1 with auth.users).
        // `team_members` is a separate entity table and not every signed-in user
        // has a row there.
        const profileRes = await supabase
          .from("profiles")
          .select(
            "role, first_name, last_name, office_location",
          )
          .eq("id", user.id)
          .single();

        if (profileRes.error) {
          console.error("Failed to fetch user profile:", profileRes.error);
        } else if (profileRes.data) {
          const role = profileRes.data.role;
          setIsAdmin(role === "admin");
          setIsManager(role === "manager");
          setIsClaimsStaff(role === "claims_staff");
          setFirstName(profileRes.data.first_name || "");
          setLastName(profileRes.data.last_name || "");
          setOfficeLocation(profileRes.data.office_location || "");
        }
      } catch (err) {
        console.error("Error fetching user role:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [supabase]);

  // Listen for admin demo role-view mode changes from TopNav switcher
  useEffect(() => {
    const storedMode =
      (localStorage.getItem(ROLE_VIEW_STORAGE_KEY) as RoleViewMode | null) ||
      "admin";
    setRoleViewMode(storedMode);

    const handleRoleModeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ mode?: RoleViewMode }>;
      const nextMode = customEvent.detail?.mode || "admin";
      setRoleViewMode(nextMode);
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === ROLE_VIEW_STORAGE_KEY) {
        const nextMode = (event.newValue as RoleViewMode | null) || "admin";
        setRoleViewMode(nextMode);
      }
    };

    window.addEventListener("role-view-mode-changed", handleRoleModeChange as EventListener);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("role-view-mode-changed", handleRoleModeChange as EventListener);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Effective roles for UI rendering (admin-only demo mode override)
  const effectiveIsAdmin = isAdmin && roleViewMode === "admin";
  const effectiveIsManager = isAdmin
    ? roleViewMode === "manager"
    : isManager;
  // Admins always have an effective claims_staff capability so role-view
  // switching reveals claims-staff-only items when the admin previews them.
  const effectiveIsClaimsStaff = isAdmin || isManager || isClaimsStaff;

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    // Exact match or match with trailing slash to prevent /dashboard/import matching /dashboard/imports
    return pathname === href || pathname.startsWith(href + "/");
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    setShowLogoutConfirm(false);
    try {
      await supabase.auth.signOut();
      router.push("/auth/login");
      router.refresh(); // Clear cached auth state
    } catch (error) {
      console.error("Logout error:", error);
      setLoggingOut(false);
    }
  };

  return (
    <>
      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Sign out of your account?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to sign out? You'll need to log back in to
              access your account.
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Header Bar */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center border-b border-slate-700/50 bg-surface-nav px-4 lg:hidden">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-slate-600/50"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="ml-3 flex flex-1 items-center gap-2">
          <img src="/NTS-logo.svg" alt="NTS Logo" className="h-8 w-8" />
          <div>
            <h1 className="text-sm font-bold leading-none text-white">
              NTS Claims Tracker
            </h1>
            {firstName && (
              <p className="text-xs text-slate-300 mt-0.5">
                Welcome, {firstName}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Navigation Sidebar/Drawer */}
      <nav
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-700/30 bg-surface-nav transition-all duration-300 lg:static lg:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          } ${isCollapsed ? "w-16" : "w-52"}`}
      >
        {/* Logo & Mobile Close Button */}
        <div
          className={`relative flex flex-col items-center justify-center border-b border-slate-700/30 pt-6 transition-all duration-300 ${isCollapsed ? "px-2" : "px-6"
            }`}
        >
          {!isCollapsed && (
            <div className="flex flex-col items-center">
              <img src="/nts-logo.png" alt="NTS Logo" className="h-20 w-auto" />
              {/* <p className="text-center text-sm font-bold text-white">
                NTS SalesTrack
              </p> */}
            </div>
          )}
          {isCollapsed && (
            <img src="/NTS-logo.svg" alt="NTS" className="h-8 w-8" />
          )}

          {/* Collapse Toggle Button - Desktop Only (Top Right) */}
          <button
            onClick={toggleSidebar}
            className="absolute -right-5 top-12 hidden h-9 w-9 items-center justify-center rounded-md border border-slate-700/30 bg-surface-nav-elevated text-slate-400 shadow-2xl drop-shadow-2xl transition-all hover:bg-slate-600/50 hover:text-white lg:flex"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-white hover:bg-slate-600/50 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 px-3 py-3">
          <div className="space-y-0.5">
            {navigation.map((item) => {
              if (!item.href) return null;

              // Check if item requires a specific role
              if (item.requiresRole) {
                // Handle manager-only items (exclude admins)
                if (
                  item.requiresRole.length === 1 &&
                  item.requiresRole.includes("manager")
                ) {
                  if (!effectiveIsManager || effectiveIsAdmin) {
                    return null;
                  }
                } else {
                  // Handle other role requirements
                  const hasRequiredRole =
                    (item.requiresRole.includes("manager") && effectiveIsManager) ||
                    (item.requiresRole.includes("admin") && effectiveIsAdmin) ||
                    (item.requiresRole.includes("claims_staff") && effectiveIsClaimsStaff);

                  if (!hasRequiredRole) {
                    return null;
                  }
                }
              }

              const active = isActive(item.href);
              const isPipeline = item.name === "Claims Track";
              const isRaceTrack = item.name === "Race Track";

              // Data tour attributes
              const tourAttr =
                item.name === "Tasks"
                  ? "nav-tasks"
                  : item.name === "Help"
                    ? "nav-help"
                    : item.name === "Claims Track"
                      ? "nav-customers"
                      : undefined;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tour={tourAttr}
                  title={isCollapsed ? item.description : ""}
                  className={`group relative flex items-center rounded-lg py-2 text-xs font-semibold transition-all ${isCollapsed ? "justify-center px-2" : "gap-x-2 px-2.5"
                    } ${active
                      ? "bg-primary/10 text-white shadow-sm ring-1 ring-primary/20"
                      : isPipeline
                        ? "text-slate-300 hover:bg-primary/5 hover:text-white"
                        : "text-slate-300 hover:bg-slate-700/30 hover:text-white"
                    }`}
                >
                  {/* Active accent bar (Linear-style) */}
                  {active && !isCollapsed && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                  )}
                  {active && isCollapsed && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                  )}
                  <item.icon
                    className={`h-5 w-5 shrink-0 ${isRaceTrack
                      ? "text-primary"
                      : active
                        ? "text-primary"
                        : isPipeline
                          ? "text-primary/70"
                          : "text-slate-400"
                      }`}
                  />
                  {!isCollapsed && (
                    <span className="flex-1">{item.name}</span>
                  )}
                  {!isCollapsed && isPipeline && (
                    <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" />
                  )}
                  {/* Active indicator */}
                  {!isCollapsed && active && (
                    <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <span className="pointer-events-none absolute left-full ml-2 hidden rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block whitespace-nowrap z-50 border border-slate-700">
                      {item.name}
                      {isPipeline && " ⭐"}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Settings Footer */}
        <div className="border-t border-slate-700/30 p-3">
          {/* User Info */}
          {!isCollapsed && (
            <div className="mb-2 rounded-lg bg-slate-700/30 p-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                  {firstName?.[0] || email?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-white">
                    {firstName} {lastName}
                  </p>
                  <p className="truncate text-[10px] text-slate-400">{email}</p>
                  {(isAdmin || isManager) && (
                    <p className="mt-0.5 text-[10px] font-medium text-primary">
                      {isAdmin ? "Admin" : "Manager"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowLogoutConfirm(true)}
            disabled={loggingOut}
            title={
              isCollapsed ? (loggingOut ? "Signing out..." : "Sign Out") : ""
            }
            className={`group relative flex w-full items-center rounded-md py-2 text-sm font-medium text-slate-300 hover:bg-slate-600/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 ${isCollapsed ? "justify-center px-2" : "gap-x-3 px-3"
              }`}
          >
            {loggingOut ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-slate-400" />
            ) : (
              <Power className="h-5 w-5 shrink-0 text-slate-400" />
            )}
            {!isCollapsed && (loggingOut ? "Signing out..." : "Sign Out")}
            {isCollapsed && (
              <span className="pointer-events-none absolute left-full ml-2 hidden rounded bg-slate-800 px-2 py-1 text-xs text-white shadow-lg group-hover:block whitespace-nowrap z-50">
                {loggingOut ? "Signing out..." : "Sign Out"}
              </span>
            )}
          </button>
          <Link
            href="/dashboard/settings"
            title={isCollapsed ? "Settings" : ""}
            className={`group relative mt-1 flex items-center rounded-md py-2 text-sm font-medium text-slate-300 hover:bg-slate-600/30 hover:text-white ${isCollapsed ? "justify-center px-2" : "gap-x-3 px-3"
              }`}
          >
            <Settings className="h-5 w-5 shrink-0 text-slate-400" />
            {!isCollapsed && "Settings"}
            {isCollapsed && (
              <span className="pointer-events-none absolute left-full ml-2 hidden rounded bg-slate-800 px-2 py-1 text-xs text-white shadow-lg group-hover:block whitespace-nowrap z-50">
                Settings
              </span>
            )}
          </Link>
        </div>
      </nav>
    </>
  );
}
