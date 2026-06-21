"use client";

import { Search, Bell, Menu, MessageSquare, X, HelpCircle, Info } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSidebar } from "@/contexts/SidebarContext";
import { getCustomerDisplayName } from "@/lib/customer-utils";
import NotificationsPanel from "@/components/NotificationsPanel";
import FeedbackPanel from "@/components/FeedbackPanel";
import HelpModal from "@/components/HelpModal";
import TeamMemberSelector from "@/components/TeamMemberSelector";
import RoleViewSwitcher from "@/components/RoleViewSwitcher";

interface TopNavProps {
  onNotificationClick?: () => void;
  unreadCount?: number;
  searchPlaceholder?: string;
  teamMemberId: string;
  notificationsPanelOpen: boolean;
  setNotificationsPanelOpen: (open: boolean) => void;
}

export default function TopNav({
  onNotificationClick,
  unreadCount = 0,
  searchPlaceholder = "Search claims, parties, tasks...",
  teamMemberId,
  notificationsPanelOpen,
  setNotificationsPanelOpen,
}: TopNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { isCollapsed } = useSidebar();
  const searchRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState("all");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [feedbackPanelOpen, setFeedbackPanelOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // Get TMS URL based on search filter
  const getTmsUrl = (filter: string, query: string): string | null => {
    const encodedQuery = encodeURIComponent(query);
    switch (filter) {
      case "order_id":
        return `https://crm.ntsconnect.com/Orders/Orders/1/0?Search_Data=${encodedQuery}&SearchType=1&CurPage=1&Pagesize=50`;
      case "quote_id":
        return `https://crm.ntsconnect.com/Quote/Quote/1/0?Search_Data=${encodedQuery}&SearchType=1&CurPage=1&Pagesize=50`;
      case "customer":
        return `https://crm.ntsconnect.com/Orders/Orders/1/0?Search_Data=${encodedQuery}&SearchType=7&CurPage=1&Pagesize=50`;
      case "phone":
        return `https://crm.ntsconnect.com/Orders/Orders/1/0?Search_Data=${encodedQuery}&SearchType=5&CurPage=1&Pagesize=50`;
      case "email":
        return `https://crm.ntsconnect.com/Orders/Orders/1/0?Search_Data=${encodedQuery}&SearchType=6&CurPage=1&Pagesize=50`;
      default:
        return null;
    }
  };

  // Handle TMS search
  const handleTmsSearch = () => {
    if (!searchQuery.trim()) return;
    const tmsUrl = getTmsUrl(searchFilter, searchQuery.trim());
    if (tmsUrl) {
      window.open(tmsUrl, "_blank");
      clearSearch();
    }
  };

  // Check if TMS search is available for current filter
  const isTmsSearchAvailable = ["order_id", "quote_id", "customer", "phone", "email", "all"].includes(
    searchFilter,
  );

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    // Skip in-app search for TMS-only fields (Order ID, Quote ID)
    if (searchFilter === "order_id" || searchFilter === "quote_id") {
      setSearchResults([]);
      setShowResults(false);
      setSearchLoading(false);
      return;
    }

    const debounce = setTimeout(async () => {
      setSearchLoading(true);
      try {
        // Build search filter based on selection
        let searchCondition = "";
        switch (searchFilter) {
          case "all":
            searchCondition = `business_name.ilike.%${searchQuery}%,contact_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`;
            break;
          case "customer":
            searchCondition = `business_name.ilike.%${searchQuery}%`;
            break;
          case "contact":
            searchCondition = `contact_name.ilike.%${searchQuery}%`;
            break;
          case "email":
            searchCondition = `email.ilike.%${searchQuery}%`;
            break;
          case "phone":
            searchCondition = `phone.ilike.%${searchQuery}%`;
            break;
          case "teamMember":
            searchCondition = `teamMembers.first_name.ilike.%${searchQuery}%,teamMembers.last_name.ilike.%${searchQuery}%`;
            break;
          default:
            searchCondition = `business_name.ilike.%${searchQuery}%,contact_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`;
        }

        // Search customers globally
        const { data: customers, error } = await supabase
          .from("customers")
          .select(
            `
            id,
            business_name,
            contact_name,
            email,
            phone,
            city,
            state,
            status,
            team_member_id,
            teamMembers:team_member_id (first_name, last_name, office_location)
          `,
          )
          .or(searchCondition)
          .limit(10);

        if (!error && customers) {
          setSearchResults(customers);
          setShowResults(true);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery, searchFilter, supabase]);

  // Close results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    }

    if (showResults) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showResults]);

  const handleResultClick = (customerId: string) => {
    setShowResults(false);
    setSearchQuery("");
    router.push(`/dashboard/customers/kanban?customer=${customerId}`);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
  };

  return (
    <>
      <div
        className={`fixed left-0 right-0 top-0 z-30 border-b border-[#28323d]/20 bg-white drop-shadow transition-all duration-300 ${isCollapsed ? "lg:left-16" : "lg:left-52"
          }`}
      >
        <div className="flex items-center justify-between px-6 pt-3 pb-5">
          {/* Search Bar */}
          <div
            className="relative flex max-w-2xl flex-1 gap-2"
            ref={searchRef}
            data-tour="search"
          >
            <select
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-9 inline-flex self-center shrink-0 rounded-lg border border-[#28323d]/20 bg-white px-1 text-sm text-[#28323d] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">Any Field</option>
              <option value="contact">Customer Name</option>
              <option value="customer">Company Name</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="order_id">CRM Order ID</option>
              <option value="quote_id">CRM Quote ID</option>
            </select>
            <div className="relative flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#28323d]/60" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowResults(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (searchFilter === "order_id" || searchFilter === "quote_id") {
                        // For TMS-only searches, Enter opens TMS
                        handleTmsSearch();
                      } else if (e.ctrlKey || e.metaKey) {
                        // Ctrl+Enter or Cmd+Enter = TMS search
                        handleTmsSearch();
                      } else {
                        // Enter = in-app search
                        setShowResults(true);
                      }
                    }
                  }}
                  className="h-9 self-center w-full rounded-lg border border-[#28323d]/20 py-2 pl-10 pr-10 text-sm text-[#28323d] placeholder-[#28323d]/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#28323d]/60 hover:text-[#28323d]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}

              </div>

              {/* Search Buttons */}
              <div className="flex gap-2">
                {/* TMS Search Button - Show first if TMS-only search */}
                {isTmsSearchAvailable && (
                  <button
                    onClick={handleTmsSearch}
                    disabled={!searchQuery.trim()}
                    className={`flex h-8 self-center shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${searchFilter === "order_id" || searchFilter === "quote_id"
                      ? "bg-primary hover:bg-primary-text"
                      : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    title={
                      searchFilter === "order_id" || searchFilter === "quote_id"
                        ? "Search CRM - Opens in new tab (Press Enter or Ctrl+Enter)"
                        : "Search CRM - Opens in new tab (Press Ctrl+Enter)"
                    }
                  >
                    <Search className="h-3 w-3" />
                    <span className="hidden sm:inline">
                      {searchFilter === "order_id" || searchFilter === "quote_id"
                        ? "Search CRM"
                        : "crm.ntsconnect"}
                    </span>
                  </button>
                )}

                {/* In-App Search Button - Hide for TMS-only searches */}
                {searchFilter !== "order_id" && searchFilter !== "quote_id" && (
                  <button
                    onClick={() => setShowResults(true)}
                    disabled={!searchQuery.trim()}
                    className="flex h-8 self-center shrink-0 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-white transition-colors hover:bg-primary-text disabled:cursor-not-allowed disabled:opacity-50"
                    title="Search Claims Tracker (Press Enter)"
                  >
                    <Search className="h-3 w-3" />
                    <span className="hidden sm:inline">Claims Tracker</span>
                  </button>
                )}
              </div>
            </div>

            {/* Search Results Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-12 z-50 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {/* Keyboard Shortcut Hint */}
                {isTmsSearchAvailable && (
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
                    {searchFilter === "order_id" || searchFilter === "quote_id" ? (
                      <p className="flex items-center gap-1.5 text-[10px] leading-tight text-slate-600">
                        <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[9px] font-semibold shadow-sm">
                          Enter
                        </kbd>
                        <span className="text-slate-400">=</span>
                        <span>Search TMS crm.ntsconnect</span>
                        <span className="ml-2 flex items-center gap-1 italic text-amber-600">
                          <Info className="h-3 w-3 mb-1 shrink-0" />
                          <span>
                            {searchFilter === "order_id" ? "Order IDs" : "Quote numbers"} only exist in TMS
                          </span>
                        </span>
                      </p>
                    ) : (
                      <p className="flex items-center gap-1.5 text-[10px] leading-tight text-slate-600">
                        <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[9px] font-semibold shadow-sm">
                          Enter
                        </kbd>
                        <span className="text-slate-400">=</span>
                        <span>Claims Tracker</span>
                        <span className="mx-1 text-slate-300">•</span>
                        <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[9px] font-semibold shadow-sm">
                          Ctrl+Enter
                        </kbd>
                        <span className="text-slate-400">=</span>
                        <span>crm.ntsconnect</span>
                        <span className="ml-2 flex items-center gap-1 italic">
                          <HelpCircle className="h-3 w-3 mb-1 shrink-0 text-slate-400" />
                          <span>
                            Must be logged in to{" "}
                            <a
                              href="https://crm.ntsconnect.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-blue-600"
                            >
                              crm.ntsconnect.com
                            </a>{" "}
                            to use this feature.
                          </span>
                        </span>
                      </p>
                    )}
                  </div>
                )}
                <div className="p-2">
                  <p className="mb-2 px-2 text-xs font-semibold text-slate-500">
                    {searchResults.length} result
                    {searchResults.length !== 1 ? "s" : ""} found
                  </p>
                  {searchResults.map((customer: any) => (
                    <button
                      key={customer.id}
                      onClick={() => handleResultClick(customer.id)}
                      className="w-full rounded-lg p-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-900">
                            {customer.business_name}
                          </p>
                          <p className="truncate text-sm text-slate-600">
                            {getCustomerDisplayName(customer)}
                          </p>
                          {(customer.email || customer.phone) && (
                            <p className="truncate text-xs text-slate-500">
                              {customer.email || customer.phone}
                            </p>
                          )}
                          {customer.teamMembers && (
                            <p className="mt-1 truncate text-xs text-slate-400">
                              TeamMember: {customer.teamMembers.first_name}{" "}
                              {customer.teamMembers.last_name || ""}
                              {customer.teamMembers.office_location &&
                                ` • ${customer.teamMembers.office_location}`}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-text">
                          {customer.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showResults &&
              searchQuery &&
              searchResults.length === 0 &&
              !searchLoading && (
                <div className="absolute left-0 right-0 top-12 z-50 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
                  <p className="text-center text-sm text-slate-500">
                    No customers found in Claims Tracker
                  </p>
                  {isTmsSearchAvailable && (
                    <p className="mt-2 text-center text-xs text-slate-400">
                      Try searching TMS with the blue button
                    </p>
                  )}
                </div>
              )}
          </div>

          {/* Right Actions */}
          <div className="ml-4 flex items-center gap-3 h-full">
            {/* Admin-only demo role view switcher */}
            <RoleViewSwitcher />

            {/* TeamMember Selector */}
            <TeamMemberSelector />

            {/* Help Button */}
            <button
              onClick={() => setHelpModalOpen(true)}
              className="flex h-10 items-center gap-2 rounded-lg bg-[#28323d] px-3 text-sm font-medium text-white transition-colors hover:bg-[#28323d]/90"
              aria-label="Quick Help"
              data-tour="help-button"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Help</span>
            </button>

            {/* Feedback Button */}
            <button
              onClick={() => setFeedbackPanelOpen(true)}
              className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 my-0 py-5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              aria-label="Send Feedback"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Feedback</span>
            </button>

            {/* Notification Bell */}
            <button
              data-testid="notification-bell"
              data-tour="notifications"
              onClick={() => setNotificationsPanelOpen(true)}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-[#28323d] transition-colors hover:bg-[#28323d]/10"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <>
                  {/* Pulsing ring animation */}
                  <span className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                  </span>
                  {/* Badge with count */}
                  <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-white shadow-lg ring-2 ring-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications Panel */}
      <NotificationsPanel
        isOpen={notificationsPanelOpen}
        onClose={() => setNotificationsPanelOpen(false)}
        teamMemberId={teamMemberId}
        onUnreadCountChange={(count) => {
          // This is a workaround - ideally the count would be managed in layout.tsx
          // For now, we'll dispatch a custom event that layout.tsx can listen to
          window.dispatchEvent(new CustomEvent('notifications-count-update', { detail: { count } }));
        }}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
        currentPath={pathname || "/dashboard"}
      />

      {/* Feedback Panel */}
      <FeedbackPanel
        isOpen={feedbackPanelOpen}
        onClose={() => setFeedbackPanelOpen(false)}
      />
    </>
  );
}
