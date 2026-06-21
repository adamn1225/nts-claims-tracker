"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { X, Loader2, Camera, Plus } from "lucide-react";

const BUCKET = "teamMember-portfolio";

const SUGGESTED_SPECIALTIES = [
  "RGN",
  "Flatbed",
  "Step Deck",
  "Oversize",
  "Heavy Haul",
  "Enclosed",
  "Driveaway",
  "Containers",
  "Hotshot",
  "Reefer",
];

export type EditableProfile = {
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  linkedin_url: string | null;
  specialties: string[] | null;
  phone?: string | null;
  profile_slug?: string | null;
};

type Props = {
  teamMemberId: string;
  initial: EditableProfile;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditProfileModal({
  teamMemberId,
  initial,
  onClose,
  onSaved,
}: Props) {
  // New team member profile columns may not be in the generated types yet; use an
  // untyped client so writes to them compile before db:types is regenerated.
  const supabase = createClient() as unknown as SupabaseClient;
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url ?? "");
  const [headline, setHeadline] = useState(initial.headline ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [linkedin, setLinkedin] = useState(initial.linkedin_url ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [profileSlug, setProfileSlug] = useState(initial.profile_slug ?? "");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [specialties, setSpecialties] = useState<string[]>(
    initial.specialties ?? [],
  );
  const [specInput, setSpecInput] = useState("");

  function addSpecialty(value: string) {
    const v = value.trim();
    if (!v || specialties.includes(v)) return;
    setSpecialties((s) => [...s, v]);
    setSpecInput("");
  }

  function removeSpecialty(value: string) {
    setSpecialties((s) => s.filter((x) => x !== value));
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }
    setUploadingAvatar(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${teamMemberId}/avatar/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data
        .publicUrl;
      setAvatarUrl(url);
    } catch (err) {
      console.error("Avatar upload failed:", err);
      alert("Could not upload photo. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  function normalizeLinkedin(value: string): string | null {
    const v = value.trim();
    if (!v) return null;
    if (/^https?:\/\//i.test(v)) return v;
    return `https://${v}`;
  }

  function normalizeSlug(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function handleSave() {
    setSlugError(null);
    const slug = normalizeSlug(profileSlug);
    if (slug && slug.length < 3) {
      setSlugError("Page URL must be at least 3 characters.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("team_members")
        .update({
          avatar_url: avatarUrl || null,
          headline: headline.trim() || null,
          bio: bio.trim() || null,
          linkedin_url: normalizeLinkedin(linkedin),
          specialties,
          phone: phone.trim() || null,
          profile_slug: slug || null,
        })
        .eq("id", teamMemberId);
      if (error) {
        if (error.code === "23505") {
          setSlugError("That page URL is already taken. Please choose another.");
          setSaving(false);
          return;
        }
        throw error;
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error("Save failed:", err);
      alert("Could not save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Edit profile</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-200">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="Avatar"
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-300">
                  <Camera className="h-7 w-7" />
                </div>
              )}
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleAvatar}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                Change photo
              </button>
              <p className="mt-1 text-xs text-gray-400">
                Square images look best.
              </p>
            </div>
          </div>

          {/* Headline */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Headline
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={120}
              placeholder="Heavy haul specialist · 10+ years moving oversize freight"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#E85D04]"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              About
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={600}
              placeholder="Tell customers and teammates about your experience, the lanes you know best, and what you love hauling."
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#E85D04]"
            />
          </div>

          {/* LinkedIn */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              LinkedIn
            </label>
            <input
              type="text"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="linkedin.com/in/your-name"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#E85D04]"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#E85D04]"
            />
          </div>

          {/* Public page slug */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Your Public Page URL
            </label>
            <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 focus-within:border-[#E85D04]">
              <span className="shrink-0 bg-gray-50 px-3 py-2 text-sm text-gray-400 border-r border-gray-200">
                /rep/
              </span>
              <input
                type="text"
                value={profileSlug}
                onChange={(e) => setProfileSlug(normalizeSlug(e.target.value))}
                placeholder="your-name"
                className="flex-1 px-3 py-2 text-sm outline-none"
              />
            </div>
            {slugError && (
              <p className="mt-1 text-xs text-red-600">{slugError}</p>
            )}
            {profileSlug && !slugError && (
              <p className="mt-1 text-xs text-gray-400">
                Shareable link: <span className="font-medium text-gray-600">/rep/{normalizeSlug(profileSlug)}</span>
              </p>
            )}
            <p className="mt-1 text-xs text-gray-400">
              Share this link with customers to receive quote requests directly in your CRM.
            </p>
          </div>

          {/* Specialties */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Specialties
            </label>
            {specialties.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {specialties.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-full bg-[#E85D04]/10 px-2.5 py-1 text-xs font-medium text-[#E85D04]"
                  >
                    {s}
                    <button
                      onClick={() => removeSpecialty(s)}
                      className="text-[#E85D04]/70 hover:text-[#E85D04]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={specInput}
                onChange={(e) => setSpecInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSpecialty(specInput);
                  }
                }}
                placeholder="Add a specialty"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#E85D04]"
              />
              <button
                onClick={() => addSpecialty(specInput)}
                className="inline-flex items-center rounded-lg bg-gray-100 px-3 text-gray-600 hover:bg-gray-200"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTED_SPECIALTIES.filter(
                (s) => !specialties.includes(s),
              ).map((s) => (
                <button
                  key={s}
                  onClick={() => addSpecialty(s)}
                  className="rounded-full border border-dashed border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:border-[#E85D04] hover:text-[#E85D04]"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#E85D04] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#d35303] disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save profile
          </button>
        </div>
      </div>
    </div>
  );
}
