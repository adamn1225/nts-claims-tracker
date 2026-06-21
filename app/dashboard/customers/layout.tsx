"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  List,
  Calendar as CalendarIcon,
  Plus,
  Search,
  MapPin,
  Phone,
} from "lucide-react";
import {
  CustomerSearchProvider,
  useCustomerSearch,
} from "@/contexts/CustomerSearchContext";
import { createClient } from "@/lib/supabase/client";

type Timezone = "all" | "EST" | "CST" | "MST" | "PST";

function CustomersLayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { searchQuery, setSearchQuery, statusFilter, toggleStatus, timezoneFilter, setTimezoneFilter, timezoneMode, setTimezoneMode } = useCustomerSearch();
  const supabase = createClient();

  const isKanban = pathname?.includes("/kanban");
  const isList = pathname?.includes("/list");
  const isCalendar = pathname?.includes("/calendar");

  // Check if we're on a view page (kanban/list/calendar) vs customer detail page
  const isViewPage = isKanban || isList || isCalendar;

  // Fetch dynamic statuses from database
  const [statuses, setStatuses] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(true);

  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          throw new Error("Not authenticated");
        }

        // Use RPC function to get teamMember-specific statuses (filtered by auth.uid())
        const { data, error } = await supabase.rpc("get_user_statuses");

        if (error) throw error;

        // RPC function returns statuses filtered by team_member_id
        // Each teamMember sees only their own custom statuses
        if (data && data.length > 0) {
          setStatuses(data);
        }
      } catch (err) {
        console.error("Error fetching statuses:", err);
        // Fallback to the CEO's 6 default kanban columns (per email spec).
        // Inbox is the protected landing column for all newly-assigned claims.
        // Mirrors the seed in supabase/migrations/20260620000006_seeds_and_rls.sql.
        setStatuses([
          { id: "inbox",                  name: "Inbox",                  color: "slate"  },
          { id: "claim_started",          name: "Claim Started",          color: "blue"   },
          { id: "processing_claim",       name: "Processing Claim",       color: "amber"  },
          { id: "claim_denied",           name: "Claim Denied",           color: "red"    },
          { id: "claim_awaiting_payment", name: "Claim Awaiting Payment", color: "orange" },
          { id: "claim_closed",           name: "Claim Closed",           color: "green"  },
        ]);
      } finally {
        setLoadingStatuses(false);
      }
    };
    fetchStatuses();

    // Refetch when pathname changes (navigating between Kanban/List/Calendar)
    // to ensure deleted statuses don't persist
  }, [supabase, pathname]);

  const getStatusColor = (color: string, isSelected: boolean) => {
    const colors: Record<string, { selected: string; unselected: string }> = {
      blue: {
        selected: "border-blue-500 bg-blue-100 text-blue-900 shadow-sm ring-2 ring-blue-500/20",
        unselected: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
      },
      green: {
        selected: "border-green-500 bg-green-100 text-green-900 shadow-sm ring-2 ring-green-500/20",
        unselected: "border-green-200 bg-green-50 text-green-800 hover:bg-green-100",
      },
      amber: {
        selected: "border-amber-500 bg-amber-100 text-amber-900 shadow-sm ring-2 ring-amber-500/20",
        unselected: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
      },
      orange: {
        selected: "border-orange-500 bg-orange-100 text-orange-900 shadow-sm ring-2 ring-orange-500/20",
        unselected: "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100",
      },
      slate: {
        selected: "border-slate-500 bg-slate-100 text-slate-900 shadow-sm ring-2 ring-slate-500/20",
        unselected: "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
      },
      red: {
        selected: "border-red-500 bg-red-100 text-red-900 shadow-sm ring-2 ring-red-500/20",
        unselected: "border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
      },
      yellow: {
        selected: "border-yellow-500 bg-yellow-100 text-yellow-900 shadow-sm ring-2 ring-yellow-500/20",
        unselected: "border-yellow-200 bg-yellow-50 text-yellow-800 hover:bg-yellow-100",
      },
      pink: {
        selected: "border-pink-500 bg-pink-100 text-pink-900 shadow-sm ring-2 ring-pink-500/20",
        unselected: "border-pink-200 bg-pink-50 text-pink-800 hover:bg-pink-100",
      },
    };
    const statusColors = colors[color] || colors.blue;
    return isSelected ? statusColors.selected : statusColors.unselected;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header - Only show on view pages (kanban/list/calendar), not on customer detail pages */}
      {isViewPage && (
        <div className="border-b border-slate-200 bg-white">
          <div className="px-4 py-3 sm:px-6">
            {/* Top Row: Tabs and New Claim Button */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                <Link
                  href="/dashboard/customers/kanban"
                  className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${isKanban
                      ? "bg-white text-primary-text shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>Kanban</span>
                </Link>
                <Link
                  href="/dashboard/customers/list"
                  className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${isList
                      ? "bg-white text-primary-text shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <List className="h-3.5 w-3.5" />
                  <span>List</span>
                  {/* {isKanban && (
                  <span className="ml-1 rounded bg-green-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Add Contacts
                  </span>
                )} */}
                </Link>
                <Link
                  href="/dashboard/customers/calendar"
                  className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${isCalendar
                      ? "bg-white text-primary-text shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  <span>Calendar</span>
                </Link>
              </div>

              <Link
                href="/dashboard/customers/kanban?action=new"
                data-tour="new-customer"
                className="flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary px-3 py-2 font-medium text-white shadow-sm transition-colors hover:bg-primary-text"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm">New Claim</span>
              </Link>
            </div>

            {/* Filters Row: Search + Timezone + Status */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Bar + Timezone Filter */}
              <div className="flex gap-3 w-full items-center">

                {/* Timezone Filter */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Mode toggle: By Address / By Phone */}
                  <div className="flex rounded-lg overflow-hidden border-2 border-blue-200 text-xs font-medium">
                    <button
                      onClick={() => setTimezoneMode("address")}
                      title="Filter by customer address state (more accurate)"
                      className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${timezoneMode === "address"
                          ? "bg-blue-500 text-white"
                          : "bg-white text-blue-700 hover:bg-blue-50"
                        }`}
                    >
                      <MapPin className="h-3 w-3" />
                      <span>Address</span>
                    </button>
                    <button
                      onClick={() => setTimezoneMode("phone")}
                      title="Filter by phone area code (useful when address is missing)"
                      className={`flex items-center gap-1 px-2.5 py-1.5 border-l-2 border-blue-200 transition-colors ${timezoneMode === "phone"
                          ? "bg-blue-500 text-white"
                          : "bg-white text-blue-700 hover:bg-blue-50"
                        }`}
                    >
                      <Phone className="h-3 w-3" />
                      <span>Phone #</span>
                    </button>
                  </div>
                  {/* Timezone value dropdown */}
                  <select
                    value={timezoneFilter}
                    onChange={(e) => setTimezoneFilter(e.target.value)}
                    className="h-10 rounded-lg border-2 border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-900 hover:border-blue-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    <option value="all">All Timezones</option>
                    <option value="EST">EST (Eastern)</option>
                    <option value="CST">CST (Central)</option>
                    <option value="MST">MST (Mountain)</option>
                    <option value="PST">PST (Pacific)</option>
                  </select>
                </div>

                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by claim #, party, BOL, location..."
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Status Filters - Dynamic from database (hidden on Kanban view) */}
              {!isKanban && (
                <div className="flex text-nowrap gap-2 flex-wrap sm:flex-nowrap">
                  {loadingStatuses ? (
                    <div className="text-xs text-slate-500">Loading filters...</div>
                  ) : (
                    statuses.map((status) => {
                      const isSelected = statusFilter.some(
                        (f) => f.toLowerCase() === status.name.toLowerCase()
                      );
                      return (
                        <button
                          key={status.id}
                          onClick={() => toggleStatus(status.name.toLowerCase())}
                          className={`rounded-lg border-2 px-2 py-1 text-xs font-medium transition-all ${getStatusColor(status.color, isSelected)
                            }`}
                          title={isSelected ? `Remove ${status.name} filter` : `Filter by ${status.name}`}
                        >
                          {status.name}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Source Filter Dropdown - Show only if sources exist */}
            {/* {isKanban && sources.length > 0 && (
            <div className="flex gap-2 items-center pt-2 border-t border-slate-100 mt-3">
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Filter by Source:</span>
              {loadingSources ? (
                <div className="text-xs text-slate-500">Loading sources...</div>
              ) : (
                <select
                  value={sourceFilter.length === 1 ? sourceFilter[0] : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "") {
                      // Clear filter - show all
                      setSourceFilter([]);
                    } else {
                      // Set single source filter
                      setSourceFilter([value]);
                    }
                  }}
                  className="h-9 rounded-lg border-2 border-purple-200 bg-white px-3 py-1.5 text-xs font-medium text-purple-900 hover:border-purple-300 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                >
                  <option value="">All Sources</option>
                  {sources.map((source) => {
                    const displayName = source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return (
                      <option key={source} value={source}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          )} */}
          </div>
        </div>
      )}

      {/* Main Content */}
      {children}
    </div>
  );
}

export default function CustomersLayout({ children }: { children: ReactNode }) {
  return (
    <CustomerSearchProvider>
      <CustomersLayoutContent>{children}</CustomersLayoutContent>
    </CustomerSearchProvider>
  );
}
