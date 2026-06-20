"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { StickyNote, X } from "lucide-react";

interface QuickNoteInputProps {
  customerId: string;
  customerName: string;
  onSaved?: () => void;
  onCancel?: () => void;
  trigger?: "icon" | "button";
  size?: "sm" | "md";
  noteCount?: number; // Number of notes for this customer
}

export default function QuickNoteInput({
  customerId,
  customerName,
  onSaved,
  onCancel,
  trigger = "icon",
  size = "md",
  noteCount = 0,
}: QuickNoteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showHoverPopup, setShowHoverPopup] = useState(false);
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Fetch recent notes when hovering (only if there are notes)
  useEffect(() => {
    if (showHoverPopup && noteCount > 0 && recentNotes.length === 0) {
      fetchRecentNotes();
    }
  }, [showHoverPopup, noteCount]);

  const fetchRecentNotes = async () => {
    setLoadingNotes(true);
    const supabase = createClient();

    const { data } = await supabase
      .from("contact_log")
      .select("*")
      .eq("customer_id", customerId)
      .eq("type", "note")
      .order("contact_date", { ascending: false })
      .limit(3);

    if (data) {
      setRecentNotes(data);
    }
    setLoadingNotes(false);
  };

  const handleSave = async () => {
    if (!noteText.trim()) return;

    setIsSaving(true);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("contact_log").insert({
        customer_id: customerId,
        broker_id: user.id,
        type: "note",
        subject: "Quick Note",
        notes: noteText.trim(),
        contact_date: new Date().toISOString(),
      });

      if (error) throw error;

      // Reset and close
      setNoteText("");
      setIsOpen(false);
      onSaved?.();
    } catch (error) {
      console.error("Error saving note:", error);
      alert("Failed to save note. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNoteText("");
    setIsOpen(false);
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    }
    // Ctrl/Cmd+Enter to save
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleSave();
    }
  };

  if (!isOpen) {
    return trigger === "icon" ? (
      <div
        className="relative inline-block"
        onMouseEnter={() => setShowHoverPopup(true)}
        onMouseLeave={() => setShowHoverPopup(false)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
            setShowHoverPopup(false);
          }}
          className={`relative flex items-center justify-center rounded transition-colors ${
            size === "sm"
              ? "h-8 w-8 hover:bg-slate-200"
              : "h-11 flex-1 gap-1 bg-slate-100 px-2 hover:bg-slate-200 active:bg-slate-300"
          } text-slate-700`}
          title="Add quick note"
          aria-label="Add quick note"
        >
          <StickyNote className="h-4 w-4" />
          {size === "md" && (
            <span className="hidden text-xs font-medium sm:inline">Note</span>
          )}
          {noteCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              {noteCount > 9 ? "9+" : noteCount}
            </span>
          )}
        </button>

        {/* Hover Popup with Recent Notes */}
        {showHoverPopup && noteCount > 0 && (
          <div
            className="absolute left-full top-0 z-100 ml-2 w-80 max-w-[90vw] rounded-lg border border-slate-200 bg-white p-3 shadow-xl"
            style={{
              marginTop: '-0.5rem',
            }}
            onMouseEnter={() => setShowHoverPopup(true)}
            onMouseLeave={() => setShowHoverPopup(false)}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-900">
                Recent Notes ({noteCount})
              </p>
              <StickyNote className="h-3 w-3 text-blue-500" />
            </div>

            {loadingNotes ? (
              <div className="flex items-center justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
              </div>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {recentNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-md border border-slate-100 bg-slate-50 p-2"
                  >
                    <p className="mb-1 text-xs text-slate-600">
                      {new Date(note.contact_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="text-xs text-slate-900">{note.notes}</p>
                  </div>
                ))}
                {noteCount > 3 && (
                  <p className="mt-2 text-xs text-slate-500 italic">
                    + {noteCount - 3} more note{noteCount - 3 !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    ) : (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="relative flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
        title="Add quick note"
      >
        <StickyNote className="h-3.5 w-3.5" />
        Add Note
        {noteCount > 0 && (
          <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
            {noteCount > 9 ? "9+" : noteCount}
          </span>
        )}
      </button>
    );
  }

  // When open, show overlay
  return (
    <>
      {/* Invisible trigger placeholder to maintain layout */}
      {trigger === "icon" ? (
        <div className="relative inline-block">
          <button
            className={`flex items-center justify-center rounded transition-colors ${
              size === "sm"
                ? "h-8 w-8 hover:bg-slate-200"
                : "h-11 flex-1 gap-1 bg-slate-100 px-2 hover:bg-slate-200 active:bg-slate-300"
            } text-slate-700 opacity-50`}
            disabled
          >
            <StickyNote className="h-4 w-4" />
            {size === "md" && (
              <span className="hidden text-xs font-medium sm:inline">Note</span>
            )}
          </button>
          {/* Absolute positioned overlay */}
          <div
            className="absolute left-0 top-full z-50 mt-1 w-80 max-w-[90vw] rounded-lg border-2 border-blue-300 bg-blue-50 p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold text-blue-900">
                Internal Note:
              </label>
              <button
                onClick={handleCancel}
                className="rounded p-1 text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-900"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type note here..."
              autoFocus
              maxLength={500}
              className="mb-3 w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <div className="flex items-center gap-2 justify-between">
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={!noteText.trim() || isSaving}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleCancel}
                  className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
              <div className="text-xs text-blue-700">
                <span className="hidden sm:inline">Esc to cancel • </span>
                <span className="hidden sm:inline">Ctrl+Enter to save</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative inline-block">
          <button
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 opacity-50"
            disabled
          >
            <StickyNote className="h-3.5 w-3.5" />
            Add Note
          </button>
          {/* Absolute positioned overlay */}
          <div
            className="absolute left-0 top-full z-50 mt-1 w-80 max-w-[90vw] rounded-lg border-2 border-blue-300 bg-blue-50 p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold text-blue-900">
                Internal Note:
              </label>
              <button
                onClick={handleCancel}
                className="rounded p-1 text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-900"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type note here..."
              autoFocus
              maxLength={500}
              className="mb-3 w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <div className="flex items-center gap-2 justify-between">
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={!noteText.trim() || isSaving}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleCancel}
                  className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
              <div className="text-xs text-blue-700">
                <span className="hidden sm:inline">Esc to cancel • </span>
                <span className="hidden sm:inline">Ctrl+Enter to save</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
