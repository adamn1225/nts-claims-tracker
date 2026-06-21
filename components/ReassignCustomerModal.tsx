"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
// Notification API routes (server-side only for security)
import { X } from "lucide-react";

type TeamMember = {
  id: string;
  first_name: string;
  last_name?: string;
  email: string;
  office_location: string | null;
  is_manager: boolean;
  is_admin: boolean;
};

type ReassignCustomerModalProps = {
  isOpen: boolean;
  onCloseAction: () => void;
  customerId: string;
  customerName: string;
  currentTeamMemberId: string;
  onSuccessAction: () => void;
};

export default function ReassignCustomerModal({
  isOpen,
  onCloseAction,
  customerId,
  customerName,
  currentTeamMemberId,
  onSuccessAction,
}: ReassignCustomerModalProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTeamMembers();
      loadCurrentUser();
    }
  }, [isOpen]);

  const loadCurrentUser = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: teamMemberData } = await supabase
      .from("team_members")
      .select("*")
      .eq("id", user.id)
      .single();

    setCurrentUser(teamMemberData);
  };

  const loadTeamMembers = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("team_members")
      .select("*")
      .eq("is_active", true) // Only show active team members
      .neq("id", currentTeamMemberId) // Exclude current team member
      .order("first_name");

    setTeamMembers(data || []);
  };

  const handleReassign = async () => {
    if (!selectedTeamMember) return;

    setLoading(true);
    const supabase = createClient();

    const newTeamMemberId = selectedTeamMember === "UNASSIGN" ? null : selectedTeamMember;

    const { error } = await supabase
      .from("customers")
      .update({
        team_member_id: newTeamMemberId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);

    if (error) {
      alert("Error reassigning customer: " + error.message);
      setLoading(false);
      return;
    }

    // Create notification for reassignment (API handles security & self-assignment skip)
    if (currentUser) {
      fetch('/api/notifications/contact-reassigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newTeamMemberId,
          oldTeamMemberId: currentTeamMemberId,
          customerId,
          customerName,
          reassignedBy: `${currentUser.first_name} ${currentUser.last_name || ''}`.trim(),
          reassignedByTeamMemberId: currentUser.id,
        }),
      }).catch(err => console.error('Failed to send reassignment notification:', err));
    }

    const action = selectedTeamMember === "UNASSIGN" ? "unassigned" : "reassigned";
    alert(`Customer ${action} successfully!`);
    setLoading(false);
    onSuccessAction();
    onCloseAction();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Reassign Customer
          </h3>
          <button
            onClick={onCloseAction}
            disabled={loading}
            className="rounded-lg p-1 hover:bg-slate-100"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm text-blue-900">
            <span className="font-medium">{customerName}</span> will be reassigned
            to the selected team member.
          </p>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Reassign to:
          </label>
          <select
            value={selectedTeamMember}
            onChange={(e) => setSelectedTeamMember(e.target.value)}
            disabled={loading}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="">Select a team member...</option>
            <option value="UNASSIGN" className="font-medium">(Unassign)</option>
            {teamMembers.map((teamMember) => (
              <option key={teamMember.id} value={teamMember.id}>
                {teamMember.first_name} {teamMember.last_name || ""} -{" "}
                {teamMember.office_location || "No Office"}
                {teamMember.is_manager && " (Manager)"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCloseAction}
            disabled={loading}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleReassign}
            disabled={!selectedTeamMember || loading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Reassigning..." : "Reassign"}
          </button>
        </div>
      </div>
    </div>
  );
}
