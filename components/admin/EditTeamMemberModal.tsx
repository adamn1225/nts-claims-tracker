"use client";

import { useEffect, useState } from "react";
import { X, Loader } from "lucide-react";

type EditTeamMemberModalProps = {
  isOpen: boolean;
  teamMember: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    office_location: string | null;
    is_remote: boolean | null;
    is_admin: boolean | null;
    is_manager: boolean | null;
    show_in_directory?: boolean | null;
  } | null;
  onCloseAction: () => void;
  onSubmitAction: (data: {
    id: string;
    first_name: string;
    last_name: string;
    office_location: string;
    is_remote: boolean;
    is_admin: boolean;
    is_manager: boolean;
    show_in_directory: boolean;
  }) => Promise<void>;
  isAdmin?: boolean; // Only admins can change role permissions
};

export default function EditTeamMemberModal({
  isOpen,
  teamMember,
  onCloseAction,
  onSubmitAction,
  isAdmin = true, // Default to true for backward compatibility
}: EditTeamMemberModalProps) {
  const [first_name, setFirstName] = useState("");
  const [last_name, setLastName] = useState("");
  const [office_location, setOfficeLocation] = useState("");
  const [is_remote, setIsRemote] = useState(false);
  const [is_admin, setIsAdmin] = useState(false);
  const [is_manager, setIsManager] = useState(false);
  const [show_in_directory, setShowInDirectory] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (teamMember) {
      setFirstName(teamMember.first_name || "");
      setLastName(teamMember.last_name || "");
      setOfficeLocation(teamMember.office_location || "");
      setIsRemote(teamMember.is_remote ?? false);
      setIsAdmin(teamMember.is_admin ?? false);
      setIsManager(teamMember.is_manager ?? false);
      setShowInDirectory(teamMember.show_in_directory ?? true);
      setError(null);
      setSuccess(false);
    }
  }, [teamMember, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!first_name) {
      setError("First name is required");
      return;
    }

    if (!teamMember) {
      setError("No team member selected");
      return;
    }

    setLoading(true);
    try {
      await onSubmitAction({
        id: teamMember.id,
        first_name,
        last_name,
        office_location,
        is_remote,
        // Preserve existing role permissions if not admin
        is_admin: isAdmin ? is_admin : (teamMember.is_admin ?? false),
        is_manager: isAdmin ? is_manager : (teamMember.is_manager ?? false),
        show_in_directory,
      });
      setSuccess(true);
      setTimeout(() => {
        onCloseAction();
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update team member");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !teamMember) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg sm:p-8">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Edit TeamMember</h2>
          <button
            onClick={onCloseAction}
            className="rounded p-1 hover:bg-slate-100"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {success && (
          <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            ✓ TeamMember updated successfully!
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Email Address
            </label>
            <input
              type="email"
              value={teamMember.email}
              disabled
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
            />
            <p className="mt-1 text-xs text-slate-500">Cannot be changed</p>
          </div>

          {/* Name Fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                First Name *
              </label>
              <input
                type="text"
                value={first_name}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Last Name
              </label>
              <input
                type="text"
                value={last_name}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                disabled={loading}
              />
            </div>
          </div>

          {/* Office Location & Remote */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Office Location
              </label>
              <select
                value={office_location}
                onChange={(e) => setOfficeLocation(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                disabled={loading}
              >
                <option value="">Select office</option>
                <option value="Fort Lauderdale, FL">
                  Fort Lauderdale, FL (Corporate)
                </option>
                <option value="Florence, KY">
                  Florence, KY (Finance & Admin)
                </option>
                <option value="Fort Myers, FL">Fort Myers, FL</option>
                <option value="Fort Pierce, FL">Fort Pierce, FL</option>
                <option value="Doral, FL">Doral, FL (Miami)</option>
                <option value="Orlando, FL">Orlando, FL</option>
                <option value="Tampa, FL">Tampa, FL</option>
                <option value="West Palm Beach, FL">West Palm Beach, FL</option>
                <option value="Jacksonville, FL">Jacksonville, FL</option>
                <option value="Cleveland, OH">Cleveland, OH</option>
                <option value="Raleigh, NC">Raleigh, NC</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={is_remote}
                  onChange={(e) => setIsRemote(e.target.checked)}
                  disabled={loading}
                  className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm font-medium text-slate-700">
                  Remote
                </span>
              </label>
            </div>
          </div>

          {/* Manager Checkbox - Admin Only */}
          {isAdmin && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={is_manager}
                  onChange={(e) => setIsManager(e.target.checked)}
                  disabled={loading}
                  className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm font-medium text-slate-700">
                  Manager Access
                </span>
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Grant manager permissions to view and manage office teamMembers
              </p>
            </div>
          )}

          {/* Admin Checkbox - Admin Only */}
          {isAdmin && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={is_admin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                  disabled={loading}
                  className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm font-medium text-slate-700">
                  Admin Access
                </span>
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Grant admin permissions to manage other team members and settings
              </p>
            </div>
          )}

          {/* Directory Visibility */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={show_in_directory}
                onChange={(e) => setShowInDirectory(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-slate-700">
                Show in Team Directory
              </span>
            </label>
            <p className="mt-1 text-xs text-slate-500 ml-6">
              Uncheck to hide this account from the directory and performance metrics (test accounts, executives, coaches, QC staff, etc.)
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCloseAction}
              disabled={loading}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
            >
              {loading && <Loader className="h-4 w-4 animate-spin" />}
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
