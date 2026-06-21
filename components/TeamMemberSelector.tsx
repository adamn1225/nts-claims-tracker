"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useTeamMemberView } from "@/contexts/TeamMemberViewContext";
import { ChevronDown, User, X, Loader, Search } from "lucide-react";

export default function TeamMemberSelector() {
  const {
    currentTeamMember,
    viewingTeamMember,
    setViewingTeamMember,
    viewableTeamMembers,
    loading,
    permissionsLoading,
    resetView,
  } = useTeamMemberView();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter viewable teamMembers: exclude inactive and apply search
  const filteredTeamMembers = useMemo(() => {
    // First, filter out inactive teamMembers
    const activeTeamMembers = viewableTeamMembers.filter((b) => b.is_active !== false);
    
    // Then, apply search filter
    if (!searchQuery.trim()) return activeTeamMembers;
    
    const query = searchQuery.toLowerCase();
    return activeTeamMembers.filter((b) => {
      const fullName = `${b.first_name || ""} ${b.last_name || ""}`.toLowerCase();
      const email = (b.email || "").toLowerCase();
      const office = (b.office_location || "").toLowerCase();
      
      return (
        fullName.includes(query) ||
        email.includes(query) ||
        office.includes(query)
      );
    });
  }, [viewableTeamMembers, searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Clear search when closing dropdown
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Show loading state
  if (loading || permissionsLoading) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-400">
        <Loader className="h-4 w-4 animate-spin" />
        <span className="hidden sm:inline">Loading...</span>
      </div>
    );
  }

  // Don't show if no team member data
  if (!currentTeamMember || !viewingTeamMember) {
    return null;
  }

  // If user can only view themselves, don't show selector
  if (viewableTeamMembers.length <= 1) {
    return null;
  }

  const isViewingOther = viewingTeamMember.id !== currentTeamMember.id;
  const isViewingAll = viewingTeamMember.id === "ALL";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
          isViewingAll
            ? "border-purple-500 bg-purple-50 text-purple-700"
            : isViewingOther
            ? "border-orange-500 bg-orange-50 text-orange-700"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <User className="h-4 w-4" />
        <span className="hidden sm:inline">
          {isViewingAll
            ? "Viewing: All TeamMembers"
            : isViewingOther
            ? `Viewing: ${viewingTeamMember.first_name} ${viewingTeamMember.last_name || ""}${viewingTeamMember.is_active === false ? " (Deactivated)" : ""}`
            : "My View"}
        </span>
        <span className="sm:hidden">
          {isViewingAll ? "All" : isViewingOther ? viewingTeamMember.first_name : "Me"}
        </span>
        {!isViewingAll && viewingTeamMember.is_active === false && (
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
            Inactive
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-64 rounded-lg border border-slate-200 bg-white shadow-lg">
          {/* Header */}
          <div className="border-b border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Switch View
              </h3>
              {isViewingOther && (
                <button
                  onClick={() => {
                    resetView();
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700"
                >
                  <X className="h-3 w-3" /> Reset
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-600">
              View another teamMember's customers and tasks
            </p>
          </div>

          {/* Search Input */}
          <div className="border-b border-slate-200 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search team members..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* TeamMember List */}
          <div className="max-h-80 overflow-y-auto p-2">
            {filteredTeamMembers.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-500">No team members found</p>
                {searchQuery && (
                  <p className="mt-1 text-xs text-slate-400">
                    Try a different search term
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* "All TeamMembers" option - only show when not searching */}
                {!searchQuery && (
                  <button
                    onClick={() => {
                      setViewingTeamMember({
                        id: "ALL",
                        email: "",
                        first_name: "All",
                        last_name: "TeamMembers",
                        office_location: null,
                        is_admin: false,
                        is_manager: false,
                        is_remote: null,
                        is_active: true,
                      });
                      setIsOpen(false);
                    }}
                    className={`mb-2 w-full rounded-lg border-2 border-dashed p-2 text-left transition-colors ${
                      isViewingAll
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">All TeamMembers</p>
                          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                            Combined View
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          View data from all {filteredTeamMembers.length} teamMembers
                        </p>
                      </div>
                      {isViewingAll && (
                        <div className="ml-2 h-2 w-2 rounded-full bg-purple-500"></div>
                      )}
                    </div>
                  </button>
                )}
                
                {filteredTeamMembers.map((teamMember) => {
              const isActive = teamMember.id === viewingTeamMember.id;
              const isCurrent = teamMember.id === currentTeamMember.id;

              return (
                <button
                  key={teamMember.id}
                  onClick={() => {
                    setViewingTeamMember(teamMember);
                    setIsOpen(false);
                  }}
                  className={`w-full rounded-lg p-2 text-left transition-colors ${
                    isActive
                      ? "bg-orange-50 text-orange-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {teamMember.first_name} {teamMember.last_name || ""}
                          {isCurrent && " (You)"}
                        </p>
                        {teamMember.is_admin && (
                          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                            Admin
                          </span>
                        )}
                        {teamMember.is_manager && !teamMember.is_admin && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                            Manager
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        {teamMember.email}
                      </p>
                      {teamMember.office_location && (
                        <p className="truncate text-xs text-slate-400">
                          {teamMember.office_location}
                        </p>
                      )}
                    </div>
                    {isActive && (
                      <div className="ml-2 h-2 w-2 rounded-full bg-orange-500"></div>
                    )}
                  </div>
                </button>
              );
            })}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 p-2">
            <p className="text-xs text-slate-500">
              {filteredTeamMembers.length} teamMember
              {filteredTeamMembers.length !== 1 ? "s" : ""}{" "}
              {searchQuery ? "found" : "available"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
