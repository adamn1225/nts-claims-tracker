"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Customer } from "@/lib/types";
import { getCustomerDisplayName } from "@/lib/customer-utils";
import { useClickToCall } from "@/contexts/ClickToCallContext";
import {
  X,
  Phone,
  Mail,
  MapPin,
  Building2,
  Calendar as CalendarIcon,
  TrendingUp,
  Edit,
  Clock,
  MessageSquare,
  Plus,
  Send,
  Paperclip,
} from "lucide-react";

type ContactLogEntry = {
  id: string;
  customer_id: string;
  team_member_id: string;
  type: "call" | "email" | "meeting" | "note" | "sms" | "other";
  subject: string;
  notes: string | null;
  contact_date: string;
  created_at: string;
};

type CustomerDetailModalProps = {
  isOpen: boolean;
  onCloseAction: () => void;
  customer: Customer;
  onEditAction: (customer: Customer) => void;
  onScheduleTaskAction: () => void;
  onQuickAction?: (action: "call" | "email" | "schedule", customer: Customer) => void;
};

type FollowUpType = "call" | "email" | "online_meeting" | "follow_up";

const followUpTypeStyles: Record<FollowUpType, { badge: string; dot: string }> =
  {
    call: {
      badge: "bg-green-50 text-green-800 border-green-200",
      dot: "bg-green-500",
    },
    email: {
      badge: "bg-blue-50 text-blue-800 border-blue-200",
      dot: "bg-blue-500",
    },
    online_meeting: {
      badge: "bg-teal-50 text-teal-800 border-teal-200",
      dot: "bg-teal-500",
    },
    follow_up: {
      badge: "bg-amber-50 text-amber-800 border-amber-200",
      dot: "bg-amber-500",
    },
  };

const formatFollowUpType = (type: FollowUpType) => type.replace("_", " ");

export default function CustomerDetailModal({
  isOpen,
  onCloseAction,
  customer,
  onEditAction,
  onScheduleTaskAction,
  onQuickAction,
}: CustomerDetailModalProps) {
  const [contactLog, setContactLog] = useState<ContactLogEntry[]>([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteSubject, setNoteSubject] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const { makeCall } = useClickToCall();

  useEffect(() => {
    if (isOpen && customer) {
      loadContactLog();
    }
  }, [isOpen, customer]);

  const loadContactLog = async () => {
    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("contact_log")
      .select("*")
      .eq("customer_id", customer.id)
      .order("contact_date", { ascending: false })
      .limit(10); // Show most recent 10 entries

    if (error) {
      console.error("Error fetching contact log:", error);
    } else {
      setContactLog(data || []);
    }

    setLoading(false);
  };

  const handleSaveNote = async () => {
    if (!noteContent.trim()) return;

    setIsSavingNote(true);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("contact_log")
        .insert({
          customer_id: customer.id,
          team_member_id: user.id,
          type: "note",
          subject: noteSubject.trim() || "Quick Note",
          notes: noteContent.trim(),
          contact_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Add new entry to the top of the list
      setContactLog([data, ...contactLog]);

      // Reset form
      setNoteSubject("");
      setNoteContent("");
      setShowNoteForm(false);
    } catch (error) {
      console.error("Error saving note:", error);
      alert("Failed to save note. Please try again.");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleQuickLog = async (type: "call" | "email" | "sms") => {
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let defaultSubject = "Quick Note";
      if (type === "call") defaultSubject = "Phone Call";
      else if (type === "email") defaultSubject = "Email Sent";
      else if (type === "sms") defaultSubject = "Text Message";

      const { data, error } = await supabase
        .from("contact_log")
        .insert({
          customer_id: customer.id,
          team_member_id: user.id,
          type: type,
          subject: defaultSubject,
          notes: null,
          contact_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Add new entry to the top of the list
      setContactLog([data, ...contactLog]);

      if (onQuickAction) {
        onQuickAction(type as "call" | "email", customer);
      }
    } catch (error) {
      console.error("Error logging activity:", error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      prospect: "bg-blue-100 text-blue-800 border-blue-200",
      active: "bg-green-100 text-green-800 border-green-200",
      won: "bg-amber-100 text-amber-800 border-amber-200",
      lost: "bg-slate-100 text-slate-600 border-slate-200",
    };
    return colors[status as keyof typeof colors] || colors.prospect;
  };

  const getFrequencyColor = (freq: string) => {
    const colors = {
      multiple_per_week: "bg-green-50 text-green-700",
      weekly: "bg-blue-50 text-blue-700",
      bi_weekly: "bg-amber-50 text-amber-700",
      monthly: "bg-yellow-50 text-yellow-700",
      quarterly: "bg-orange-50 text-orange-700",
      yearly: "bg-slate-50 text-slate-700",
      other: "bg-slate-50 text-slate-700",
    };
    return colors[freq as keyof typeof colors] || colors.other;
  };

  const formatFrequency = (freq: string) => {
    return freq.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const daysSinceContact = (dateString?: string | null) => {
    if (!dateString) return null;
    const days = Math.floor(
      (new Date().getTime() - new Date(dateString).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return days;
  };

  const isOverdue = (dateString?: string | null) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  const daysSince = daysSinceContact(customer.last_contact_date);
  const nextFollowUpOverdue = isOverdue(customer.next_follow_up_date);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-4xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 p-6">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-900">
                {customer.business_name || getCustomerDisplayName(customer) || "Unknown Customer"}
              </h2>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getStatusColor(customer.status)}`}
              >
                {customer.status.charAt(0).toUpperCase() +
                  customer.status.slice(1)}
              </span>
            </div>
            <p className="text-slate-600">
              {getCustomerDisplayName(customer) || "No contact name"}
              {customer.customer_id && (
                <span className="ml-2 text-sm text-slate-400">
                  {customer.customer_id}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onCloseAction}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(100vh-16rem)] overflow-y-auto p-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column - Main Info */}
            <div className="space-y-6 lg:col-span-2">
              {/* Quick Actions */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    handleQuickLog("call");
                    if (customer.phone) makeCall(customer.phone, customer.id);
                  }}
                  className="flex items-center justify-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-100"
                >
                  <Phone className="h-4 w-4" />
                  Log Call
                </button>
                <button
                  onClick={() => handleQuickLog("email")}
                  className="flex items-center justify-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                >
                  <Mail className="h-4 w-4" />
                  Log Email
                </button>
                <button
                  onClick={onScheduleTaskAction}
                  className="flex items-center justify-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100"
                >
                  <CalendarIcon className="h-4 w-4" />
                  Schedule
                </button>
              </div>

              {/* Contact Information */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-3 font-semibold text-slate-900">
                  Contact Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-slate-400" />
                    {customer.phone ? (
                      <button
                        onClick={() => makeCall(customer.phone!, customer.id)}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {customer.phone}
                      </button>
                    ) : (
                      <span className="text-slate-600">&mdash;</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600">
                      {customer.email || "—"}
                    </span>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                    <div className="text-slate-600 flex-1">
                      {customer.address || customer.city || customer.state || customer.zip ? (
                        <div className="space-y-0.5">
                          {customer.address && (
                            <div>{customer.address}</div>
                          )}
                          {(customer.city || customer.state || customer.zip) && (
                            <div>
                              {[
                                customer.city,
                                customer.state,
                                customer.zip
                              ].filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600">
                      {customer.industry || "—"}
                    </span>
                  </div>
                  {customer.opportunity_type && (
                    <div className="flex items-center gap-3 text-sm">
                      <TrendingUp className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-600">
                        {customer.opportunity_type
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    </div>
                  )}
                  {customer.shipping_frequency && (
                    <div className="flex items-center gap-3 text-sm">
                      <TrendingUp className="h-4 w-4 text-slate-400" />
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${getFrequencyColor(customer.shipping_frequency)}`}
                      >
                        {formatFrequency(customer.shipping_frequency)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes & Activity */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">
                    Notes & Activity
                  </h3>
                  <button
                    onClick={() => setShowNoteForm(!showNoteForm)}
                    className="flex items-center gap-1 rounded-lg bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-100"
                  >
                    <Plus className="h-4 w-4" />
                    Add Note
                  </button>
                </div>

                {showNoteForm && (
                  <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <input
                      type="text"
                      placeholder="Subject (optional)"
                      value={noteSubject}
                      onChange={(e) => setNoteSubject(e.target.value)}
                      className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                    <textarea
                      placeholder="Add your note..."
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      rows={3}
                      className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveNote}
                        disabled={!noteContent.trim() || isSavingNote}
                        className="rounded-lg bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                      >
                        {isSavingNote ? "Saving..." : "Save Note"}
                      </button>
                      <button
                        onClick={() => {
                          setShowNoteForm(false);
                          setNoteSubject("");
                          setNoteContent("");
                        }}
                        className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {loading ? (
                    <div className="py-8 text-center text-sm text-slate-500">
                      Loading activity...
                    </div>
                  ) : contactLog.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-500">
                      <MessageSquare className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                      <p>No activity yet</p>
                      <p className="text-xs">Add your first note or log a call</p>
                    </div>
                  ) : (
                    contactLog.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <div className="font-medium text-slate-900">
                            {log.subject}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatDate(log.contact_date)}
                          </div>
                        </div>
                        {log.notes && (
                          <p className="text-sm text-slate-600">{log.notes}</p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-700">
                            {log.type.charAt(0).toUpperCase() +
                              log.type.slice(1)}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(log.contact_date).toLocaleTimeString(
                              "en-US",
                              {
                                hour: "numeric",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Status & Follow-Up */}
            <div className="space-y-6">
              {/* Follow-Up Info */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="mb-3 font-semibold text-slate-900">
                  Follow-Up
                </h3>
                <div className="space-y-4">
                  {customer.last_contact_date && (
                    <div>
                      <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        Last Contact
                      </div>
                      <div className="text-sm text-slate-900">
                        {formatDate(customer.last_contact_date)}
                      </div>
                      {daysSince !== null && (
                        <div className="text-xs text-slate-500">
                          {daysSince === 0
                            ? "Today"
                            : daysSince === 1
                              ? "Yesterday"
                              : `${daysSince} days ago`}
                        </div>
                      )}
                    </div>
                  )}

                  {customer.next_follow_up_date && (
                    <div>
                      <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        Next Follow-Up
                      </div>
                      <div
                        className={`text-sm font-medium ${nextFollowUpOverdue ? "text-red-600" : "text-slate-900"}`}
                      >
                        {formatDate(customer.next_follow_up_date)}
                        {nextFollowUpOverdue && (
                          <span className="ml-1 text-xs">(Overdue)</span>
                        )}
                      </div>
                      {customer.next_follow_up_type && (
                        <div className="mt-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                              followUpTypeStyles[
                                customer.next_follow_up_type as FollowUpType
                              ].badge
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                followUpTypeStyles[
                                  customer.next_follow_up_type as FollowUpType
                                ].dot
                              }`}
                            />
                            {formatFollowUpType(
                              customer.next_follow_up_type as FollowUpType,
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {!customer.last_contact_date &&
                    !customer.next_follow_up_date && (
                      <div className="py-4 text-center text-sm text-slate-500">
                        No follow-up scheduled
                      </div>
                    )}
                </div>
              </div>

              {/* Notes Preview */}
              {customer.notes && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-slate-900">
                    Customer Notes
                  </h3>
                  <p className="text-sm text-slate-600">{customer.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-4">
          <button
            onClick={() => onEditAction(customer)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Edit className="h-4 w-4" />
            Edit Customer
          </button>
          <button
            onClick={onCloseAction}
            className="rounded-lg bg-slate-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
