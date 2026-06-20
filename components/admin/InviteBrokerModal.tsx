"use client";

import { useState } from "react";
import { X, Loader } from "lucide-react";

type InviteBrokerModalProps = {
  isOpen: boolean;
  onCloseAction: () => void;
  onSubmitAction: (data: {
    email: string;
    firstName: string;
    lastName: string;
    office: string;
    isRemote: boolean;
    isAdmin: boolean;
    isManager: boolean;
  }) => Promise<void>;
  restrictedOffice?: string; // If set, manager can only invite to this office
};

export default function InviteBrokerModal({
  isOpen,
  onCloseAction,
  onSubmitAction,
  restrictedOffice,
}: InviteBrokerModalProps) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [office, setOffice] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setWarning(null);

    if (!email || !firstName) {
      setError("Email and first name are required");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    // Validate email domain (only NTS/Heavy Haulers domains allowed)
    if (
      !email.endsWith("@ntslogistics.com") &&
      !email.endsWith("@nationwidetransportservices.com")
    ) {
      setError(
        "Only NTS Logistics or Nationwide Transport Services email addresses are allowed"
      );
      return;
    }

    setLoading(true);
    try {
      await onSubmitAction({
        email,
        firstName,
        lastName,
        office: restrictedOffice || office, // Use restricted office if set
        isRemote,
        isAdmin,
        isManager,
      });
      setSuccess(true);
      setEmail("");
      setFirstName("");
      setLastName("");
      setOffice("");
      setIsRemote(false);
      setIsAdmin(false);
      setIsManager(false);
      setTimeout(() => {
        onCloseAction();
        setSuccess(false);
        setWarning(null);
      }, 1500);
    } catch (err: any) {
      // Check if it's a warning (user created but email failed)
      if (err.warning) {
        setWarning(err.warning);
        setSuccess(true);
        setEmail("");
        setFirstName("");
        setLastName("");
        setOffice("");
        setIsRemote(false);
        setIsAdmin(false);
        setIsManager(false);
      } else {
        setError(err instanceof Error ? err.message : "Failed to send invite");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg sm:p-8">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Invite Broker
          </h2>
          <button
            onClick={onCloseAction}
            className="rounded p-1 hover:bg-slate-100"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {success && !warning && (
          <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            ✓ Invite sent successfully! {email} will receive a welcome email
            with login credentials.
          </div>
        )}

        {warning && (
          <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
            ⚠️ {warning}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="broker@ntslogistics.com"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              disabled={loading}
            />
          </div>

          {/* Name Fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                First Name *
              </label>
              <input
                type="text"
                value={firstName}
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
                value={lastName}
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
                Office Location {restrictedOffice && "(Restricted)"}
              </label>
              {restrictedOffice ? (
                <input
                  type="text"
                  value={restrictedOffice}
                  disabled
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600"
                />
              ) : (
                <select
                  value={office}
                  onChange={(e) => setOffice(e.target.value)}
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
                  <option value="West Palm Beach, FL">
                    West Palm Beach, FL
                  </option>
                  <option value="Jacksonville, FL">Jacksonville, FL</option>
                  <option value="Cleveland, OH">Cleveland, OH</option>
                  <option value="Raleigh, NC">Raleigh, NC</option>
                </select>
              )}
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRemote}
                  onChange={(e) => setIsRemote(e.target.checked)}
                  disabled={loading}
                  className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                />
                <span className="text-sm font-medium text-slate-700">
                  Working Remotely
                </span>
              </label>
            </div>
          </div>

          {/* Manager Checkbox */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isManager}
                onChange={(e) => setIsManager(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-slate-700">
                Manager Access
              </span>
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Grant manager permissions to view and manage office brokers
            </p>
          </div>

          {/* Admin Checkbox */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-slate-700">
                Admin Access
              </span>
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Grant admin permissions to manage other brokers and settings
            </p>
          </div>

          {/* Info text */}
          <p className="text-xs text-slate-500">
            The broker will receive a welcome email at{" "}
            <strong>{email || "their email address"}</strong> with login
            credentials and getting started instructions.
          </p>

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
              {loading ? "Sending..." : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
