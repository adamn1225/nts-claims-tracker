"use client";

import { useState, useEffect, useRef } from "react";
import { Share2, X, Send, ChevronDown, Search, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Customer } from "@/lib/types";
import type { Database } from "@/lib/database.types";

type TeamMember = Database["public"]["Tables"]["team_members"]["Row"];
type CollaborationMode = "team_up" | "notify_only";

interface ShareCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  currentTeamMemberId: string;
}

export default function ShareCustomerModal({
  isOpen,
  onClose,
  customer,
  currentTeamMemberId,
}: ShareCustomerModalProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedTeamMemberIds, setSelectedTeamMemberIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<CollaborationMode>("team_up");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const fetchTeamMembers = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      // Verify user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error("Auth error:", authError);
        throw new Error("Not authenticated");
      }

      // Fetch all active team members except current user
      let query = supabase
        .from("team_members")
        .select("*")
        .eq("is_active", true)
        .order("first_name", { ascending: true });

      // Only exclude current team member if we have the ID
      if (currentTeamMemberId) {
        query = query.neq("id", currentTeamMemberId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase error fetching team members:", error);
        throw error;
      }

      console.log("Fetched team members:", data?.length || 0);
      setTeamMembers(data || []);
    } catch (error) {
      console.error("Error fetching team members:", error);
      alert("Unable to load team member list. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTeamMember = (teamMemberId: string) => {
    setSelectedTeamMemberIds((prev) =>
      prev.includes(teamMemberId)
        ? prev.filter((id) => id !== teamMemberId)
        : [...prev, teamMemberId]
    );
  };

  // Filter teamMembers based on search query
  const filteredTeamMembers = teamMembers.filter((teamMember) => {
    const searchLower = searchQuery.toLowerCase();
    const fullName = `${teamMember.first_name} ${teamMember.last_name || ''}`.toLowerCase();
    const email = teamMember.email.toLowerCase();
    const office = teamMember.office_location?.toLowerCase() || '';

    return fullName.includes(searchLower) || email.includes(searchLower) || office.includes(searchLower);
  });

  const handleSelectAll = () => {
    if (selectedTeamMemberIds.length === filteredTeamMembers.length) {
      setSelectedTeamMemberIds([]);
    } else {
      setSelectedTeamMemberIds(filteredTeamMembers.map((b) => b.id));
    }
  };

  const handleShare = async () => {
    if (selectedTeamMemberIds.length === 0) {
      alert("Please select at least one team member.");
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch("/api/customers/collaborate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          customerName: customer.business_name,
          teamMemberIds: selectedTeamMemberIds,
          mode,
          message: note.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to share customer");
      }

      const modeLabel = mode === "team_up" ? "teamed up on" : "shared";
      alert(`Customer ${modeLabel} successfully with ${selectedTeamMemberIds.length} team member(s)!`);
      handleClose();
    } catch (error: any) {
      console.error("Error sharing customer:", error);
      alert(error.message || "Failed to share customer. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setSelectedTeamMemberIds([]);
    setNote("");
    setMode("team_up");
    setIsDropdownOpen(false);
    setSearchQuery("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-orange-500 to-orange-600">
              <Share2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Share Contact
              </h2>
              <p className="text-sm text-slate-600">
                {customer.business_name}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
            </div>
          ) : (
            <>
              {/* Collaboration Mode Selection */}
              <div className="mb-8">
                <label className="mb-3 block text-sm font-medium text-slate-900">
                  How would you like to share? <span className="text-red-500">*</span>
                </label>
                <div className="space-y-3">
                  {/* Team Up Option */}
                  <label className="relative flex cursor-pointer rounded-lg border-2 border-slate-200 bg-white p-4 transition-all hover:border-slate-300 has-checked:border-orange-500 has-checked:bg-orange-50">
                    <input
                      type="radio"
                      name="collaboration_mode"
                      value="team_up"
                      checked={mode === "team_up"}
                      onChange={(e) => setMode(e.target.value as CollaborationMode)}
                      className="mt-1"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-orange-600" />
                        <span className="font-medium text-slate-900">Team Up</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        Give them full access to view, log activity, and manage follow-ups on this customer together.
                      </p>
                    </div>
                  </label>

                  {/* Notify Only Option */}
                  <label className="relative flex cursor-pointer rounded-lg border-2 border-slate-200 bg-white p-4 transition-all hover:border-slate-300 has-checked:border-orange-500 has-checked:bg-orange-50">
                    <input
                      type="radio"
                      name="collaboration_mode"
                      value="notify_only"
                      checked={mode === "notify_only"}
                      onChange={(e) => setMode(e.target.value as CollaborationMode)}
                      className="mt-1"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center gap-2">
                        <Share2 className="h-4 w-4 text-slate-600" />
                        <span className="font-medium text-slate-900">Notify Only</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        Send them the contact information via email. They'll be notified but won't have access to manage this customer.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* TeamMember Selection */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Share With <span className="text-red-500">*</span>
                </label>

                {teamMembers.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No other team members available to share with.
                  </p>
                ) : (
                  <div ref={dropdownRef} className="relative">
                    {/* Dropdown Button */}
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-left text-sm transition-colors hover:border-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    >
                      <span className={selectedTeamMemberIds.length === 0 ? "text-slate-400" : "text-slate-900"}>
                        {selectedTeamMemberIds.length === 0
                          ? "Select team members..."
                          : selectedTeamMemberIds.length === 1
                            ? `${teamMembers.find((b) => b.id === selectedTeamMemberIds[0])?.first_name} ${teamMembers.find((b) => b.id === selectedTeamMemberIds[0])?.last_name || ''}`
                            : `${selectedTeamMemberIds.length} team members selected`}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-slate-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""
                          }`}
                      />
                    </button>

                    {/* Dropdown Panel */}
                    {isDropdownOpen && (
                      <div className="absolute z-10 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                        {/* Search Box */}
                        <div className="border-b border-slate-200 p-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search team members..."
                              className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                            />
                          </div>
                        </div>

                        {/* Select All */}
                        <div className="border-b border-slate-200 px-3 py-2">
                          <button
                            type="button"
                            onClick={handleSelectAll}
                            className="text-sm text-orange-600 hover:text-orange-700 hover:underline"
                          >
                            {selectedTeamMemberIds.length === filteredTeamMembers.length && filteredTeamMembers.length > 0
                              ? "Deselect All"
                              : "Select All"}
                          </button>
                        </div>

                        {/* TeamMember List */}
                        <div className="max-h-60 overflow-y-auto p-2">
                          {filteredTeamMembers.length === 0 ? (
                            <p className="px-3 py-4 text-center text-sm text-slate-500">
                              No team members found
                            </p>
                          ) : (
                            filteredTeamMembers.map((teamMember) => (
                              <label
                                key={teamMember.id}
                                className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-slate-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedTeamMemberIds.includes(teamMember.id)}
                                  onChange={() => handleToggleTeamMember(teamMember.id)}
                                  className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-0"
                                />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-slate-900">
                                    {`${teamMember.first_name} ${teamMember.last_name || ''}`.trim()}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {teamMember.email}
                                    {teamMember.office_location && (
                                      <span className="ml-2">
                                        • {teamMember.office_location}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedTeamMemberIds.length > 0 && (
                  <p className="mt-2 text-xs text-slate-600">
                    {selectedTeamMemberIds.length} teamMember(s) selected
                  </p>
                )}
              </div>

              {/* Optional Note */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Add a Note (Optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a personal message or context about this customer..."
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  maxLength={500}
                />
                <p className="mt-1 text-xs text-slate-500">
                  {note.length}/500 characters
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 p-6">
          <button
            onClick={handleClose}
            disabled={isSending}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={isSending || selectedTeamMemberIds.length === 0 || loading}
            className="flex items-center gap-2 rounded-lg bg-linear-to-r from-orange-500 to-orange-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-orange-600 hover:to-orange-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Sharing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Share Contact
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
