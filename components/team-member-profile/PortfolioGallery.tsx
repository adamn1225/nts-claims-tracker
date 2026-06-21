"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  ImagePlus,
  Trash2,
  X,
  Loader2,
  MapPin,
  Truck,
  Images,
} from "lucide-react";

export type PortfolioItem = {
  id: string;
  team_member_id: string;
  image_path: string;
  caption: string | null;
  equipment_type: string | null;
  origin: string | null;
  destination: string | null;
  order_ref: string | null;
  created_at: string;
};

const BUCKET = "teamMember-portfolio";

type Props = {
  teamMemberId: string;
  items: PortfolioItem[];
  isOwn: boolean;
  onChange: () => void;
};

export default function PortfolioGallery({
  teamMemberId,
  items,
  isOwn,
  onChange,
}: Props) {
  // broker_portfolio is created by the team member-profiles migration and may not
  // be in the generated types yet; use an untyped client at that boundary.
  const supabase = createClient() as unknown as SupabaseClient;
  const [showUpload, setShowUpload] = useState(false);
  const [lightbox, setLightbox] = useState<PortfolioItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    file: null as File | null,
    preview: "",
    caption: "",
    equipment_type: "",
    origin: "",
    destination: "",
  });

  function publicUrl(path: string) {
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  function resetForm() {
    setForm({
      file: null,
      preview: "",
      caption: "",
      equipment_type: "",
      origin: "",
      destination: "",
    });
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }
    setForm((f) => ({
      ...f,
      file,
      preview: URL.createObjectURL(file),
    }));
  }

  async function handleUpload() {
    if (!form.file) return;
    setUploading(true);
    try {
      const safeName = form.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${teamMemberId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, form.file);
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("broker_portfolio").insert({
        team_member_id: teamMemberId,
        image_path: path,
        caption: form.caption.trim() || null,
        equipment_type: form.equipment_type.trim() || null,
        origin: form.origin.trim() || null,
        destination: form.destination.trim() || null,
      });
      if (dbErr) throw dbErr;

      resetForm();
      setShowUpload(false);
      onChange();
    } catch (err) {
      console.error("Portfolio upload failed:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(item: PortfolioItem) {
    if (!confirm("Remove this photo from your portfolio?")) return;
    setDeletingId(item.id);
    try {
      await supabase.storage.from(BUCKET).remove([item.image_path]);
      const { error } = await supabase
        .from("broker_portfolio")
        .delete()
        .eq("id", item.id);
      if (error) throw error;
      setLightbox(null);
      onChange();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Could not remove photo. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Images className="h-5 w-5 text-[#E85D04]" />
          Freight Portfolio
        </h2>
        {isOwn && (
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#E85D04] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#d35303]"
          >
            <ImagePlus className="h-4 w-4" />
            Add photo
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
          <Images className="h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-600">
            No freight photos yet
          </p>
          <p className="text-xs text-gray-400">
            {isOwn
              ? "Show off the loads you've moved - oversize, heavy haul, anything you're proud of."
              : "This team member hasn't added any photos yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setLightbox(item)}
              className="group relative aspect-square overflow-hidden rounded-xl bg-gray-100 ring-1 ring-gray-100"
            >
              <Image
                src={publicUrl(item.image_path)}
                alt={item.caption ?? "Freight photo"}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover transition group-hover:scale-105"
              />
              {(item.equipment_type || item.caption) && (
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-2 text-left">
                  <p className="truncate text-xs font-medium text-white">
                    {item.equipment_type || item.caption}
                  </p>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="relative aspect-video w-full bg-gray-900">
              <Image
                src={publicUrl(lightbox.image_path)}
                alt={lightbox.caption ?? "Freight photo"}
                fill
                sizes="640px"
                className="object-contain"
              />
            </div>
            <div className="p-4">
              {lightbox.caption && (
                <p className="font-medium text-gray-900">{lightbox.caption}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                {lightbox.equipment_type && (
                  <span className="inline-flex items-center gap-1">
                    <Truck className="h-4 w-4" />
                    {lightbox.equipment_type}
                  </span>
                )}
                {(lightbox.origin || lightbox.destination) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {[lightbox.origin, lightbox.destination]
                      .filter(Boolean)
                      .join(" → ")}
                  </span>
                )}
              </div>
              {isOwn && (
                <button
                  onClick={() => handleDelete(lightbox)}
                  disabled={deletingId === lightbox.id}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingId === lightbox.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Add freight photo
              </h3>
              <button
                onClick={() => {
                  setShowUpload(false);
                  resetForm();
                }}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onPickFile}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 transition hover:border-[#E85D04]"
              >
                {form.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.preview}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex flex-col items-center text-gray-400">
                    <ImagePlus className="h-7 w-7" />
                    <span className="mt-1 text-sm">Choose an image</span>
                  </span>
                )}
              </button>

              <input
                type="text"
                placeholder="Caption (e.g. Excavator move from TX to GA)"
                value={form.caption}
                onChange={(e) =>
                  setForm((f) => ({ ...f, caption: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#E85D04]"
              />
              <input
                type="text"
                placeholder="Equipment / trailer type (e.g. RGN)"
                value={form.equipment_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, equipment_type: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#E85D04]"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Origin"
                  value={form.origin}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, origin: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#E85D04]"
                />
                <input
                  type="text"
                  placeholder="Destination"
                  value={form.destination}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, destination: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#E85D04]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                onClick={() => {
                  setShowUpload(false);
                  resetForm();
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!form.file || uploading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#E85D04] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#d35303] disabled:opacity-50"
              >
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
