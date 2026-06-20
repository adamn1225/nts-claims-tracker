"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const OFFICE_LOCATIONS = [
  { value: "Fort Lauderdale, FL", label: "Fort Lauderdale, FL (Corporate)" },
  { value: "Florence, KY", label: "Florence, KY (Finance & Admin)" },
  { value: "Fort Myers, FL", label: "Fort Myers, FL" },
  { value: "Fort Pierce, FL", label: "Fort Pierce, FL" },
  { value: "Doral, FL", label: "Doral, FL (Miami)" },
  { value: "Orlando, FL", label: "Orlando, FL" },
  { value: "Tampa, FL", label: "Tampa, FL" },
  { value: "West Palm Beach, FL", label: "West Palm Beach, FL" },
  { value: "Jacksonville, FL", label: "Jacksonville, FL" },
  { value: "Cleveland, OH", label: "Cleveland, OH" },
  { value: "Raleigh, NC", label: "Raleigh, NC" },
];

export default function CompleteProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [officeLocation, setOfficeLocation] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      setEmail(user.email ?? "");

      const { data: broker } = await supabase
        .from("brokers")
        .select("first_name, last_name, office_location, is_remote")
        .eq("id", user.id)
        .single();

      if (broker) {
        setFirstName(broker.first_name ?? "");
        setLastName(broker.last_name ?? "");
        setOfficeLocation(broker.office_location ?? "");
        setIsRemote(broker.is_remote ?? false);
      }

      setLoading(false);
    };

    load();
  }, [supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }
    if (!lastName.trim()) {
      setError("Last name is required.");
      return;
    }
    if (!officeLocation) {
      setError("Please select your office location.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      // Upsert: creates the brokers row if it doesn't exist yet (e.g. SSO users
      // who authenticated but never got a brokers profile), or updates it if
      // they already have one but it's missing required fields.
      const { error: upsertError } = await supabase
        .from("brokers")
        .upsert(
          {
            id: user.id,
            email: user.email ?? "",
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            office_location: officeLocation,
            is_remote: isRemote,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );

      if (upsertError) throw upsertError;

      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E85D04]">
            <span className="text-2xl font-black text-white">N</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Complete Your Profile</h1>
          <p className="mt-1 text-sm text-slate-400">
            A few quick details before you get started
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          {/* Account email (read-only context) */}
          {email && (
            <p className="mb-6 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
              Logged in as <span className="font-medium text-slate-700">{email}</span>
            </p>
          )}

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/20"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/20"
                  disabled={saving}
                />
              </div>
            </div>

            {/* Office Location */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Office Location <span className="text-red-500">*</span>
              </label>
              <select
                value={officeLocation}
                onChange={(e) => setOfficeLocation(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/20"
                disabled={saving}
              >
                <option value="">Select your office</option>
                {OFFICE_LOCATIONS.map((loc) => (
                  <option key={loc.value} value={loc.value}>
                    {loc.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Remote */}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isRemote}
                onChange={(e) => setIsRemote(e.target.checked)}
                disabled={saving}
                className="h-4 w-4 rounded border-slate-300 text-[#E85D04] focus:ring-[#E85D04]"
              />
              <span className="text-sm font-medium text-slate-700">I work remotely</span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-[#E85D04] py-2.5 font-semibold text-white transition-colors hover:bg-[#d14f00] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save & Continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
