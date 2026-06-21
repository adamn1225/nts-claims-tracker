"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Task, TaskType, TaskPriority, Customer } from "@/lib/types";
import Modal from "@/components/Modal";
import EmailTemplateModal from "@/components/EmailTemplateModal";
import {
  ArrowLeft,
  Phone,
  User,
  Mail,
  Share,
  Share2,
  Briefcase,
  MapPin,
  Building2,
  Calendar as CalendarIcon,
  TrendingUp,
  Edit,
  Pin,
  Clock,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  X,
  Paperclip,
  FileIcon,
  Download,
  Trash2,
  Upload,
  Copy,
  Search,
} from "lucide-react";
import CustomerFormModal from "@/components/CustomerFormModal";
import TaskFormModal from "@/components/TaskFormModal";
import ShareCustomerModal from "@/components/ShareCustomerModal";
import AiEmailDraftModal from "@/components/AiEmailDraftModal";
import { useClickToCall } from "@/contexts/ClickToCallContext";

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

type CustomerAttachment = {
  id: string;
  customer_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
  notes: string | null;
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

export default function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [contactLog, setContactLog] = useState<ContactLogEntry[]>([]);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteSubject, setNoteSubject] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [showEmailTemplateModal, setShowEmailTemplateModal] = useState(false);
  const [quickLogType, setQuickLogType] = useState<
    "call" | "email" | "sms" | null
  >(null);
  const [attachments, setAttachments] = useState<CustomerAttachment[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAiEmailModal, setShowAiEmailModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentTeamMemberId, setCurrentTeamMemberId] = useState<string>("");
  const [assignedTeamMemberName, setAssignedTeamMemberName] = useState<string>("");
  const [briefText, setBriefText] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefSources, setBriefSources] = useState<{ crm: boolean; goto: boolean } | null>(null);
  const { makeCall } = useClickToCall();

  const fetchCallBrief = async (cust: Customer) => {
    setBriefLoading(true);
    setBriefText(null);
    setBriefSources(null);
    try {
      const res = await fetch("/api/ai/call-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: cust.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setBriefText(data.brief ?? null);
        setBriefSources(data.sources ?? null);
      }
    } catch (err) {
      console.error("Error fetching call brief:", err);
    } finally {
      setBriefLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      // Fetch customer by customer_id
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("customer_id", id)
        .single();

      if (customerError) {
        console.error("Error fetching customer:", customerError);
        setCustomer(null);
      } else {
        setCustomer(customerData);

        // Fetch contact log for this customer
        const { data: logData, error: logError } = await supabase
          .from("contact_log")
          .select("*")
          .eq("customer_id", customerData.id)
          .order("contact_date", { ascending: false });

        if (logError) {
          console.error("Error fetching contact log:", logError);
        } else {
          setContactLog(logData || []);
        }

        // Fetch attachments for this customer
        const { data: attachmentData, error: attachmentError } = await supabase
          .from("customer_attachments")
          .select("*")
          .eq("customer_id", customerData.id)
          .order("uploaded_at", { ascending: false });

        if (attachmentError) {
          console.error("Error fetching attachments:", attachmentError);
        } else {
          setAttachments(attachmentData || []);
        }

        // Fetch assigned team member name
        if (customerData.team_member_id) {
          const { data: teamMemberData } = await supabase
            .from("team_members")
            .select("first_name, last_name")
            .eq("id", customerData.team_member_id)
            .single();

          if (teamMemberData) {
            setAssignedTeamMemberName(`${teamMemberData.first_name} ${teamMemberData.last_name || ''}`.trim());
          }
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [id]);

  // Real-time subscriptions for customer and contact log
  useEffect(() => {
    if (!customer) return;

    const supabase = createClient();

    // Subscribe to customer changes
    const customerChannel = supabase
      .channel(`customer:${customer.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "customers",
          filter: `id=eq.${customer.id}`,
        },
        (payload) => {
          console.log("Real-time customer update:", payload);
          setCustomer(payload.new as Customer);
        }
      )
      .subscribe();

    // Subscribe to contact log changes
    const contactLogChannel = supabase
      .channel(`contact_log:${customer.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contact_log",
          filter: `customer_id=eq.${customer.id}`,
        },
        async (payload) => {
          console.log("Real-time contact log change:", payload);
          // Refetch contact log
          const { data: logData } = await supabase
            .from("contact_log")
            .select("*")
            .eq("customer_id", customer.id)
            .order("contact_date", { ascending: false });

          if (logData) {
            setContactLog(logData);
          }
        }
      )
      .subscribe();

    // Subscribe to attachments changes
    const attachmentsChannel = supabase
      .channel(`attachments:${customer.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_attachments",
          filter: `customer_id=eq.${customer.id}`,
        },
        async (payload) => {
          console.log("Real-time attachment change:", payload);
          // Refetch attachments
          const { data: attachmentData } = await supabase
            .from("customer_attachments")
            .select("*")
            .eq("customer_id", customer.id)
            .order("uploaded_at", { ascending: false });

          if (attachmentData) {
            setAttachments(attachmentData);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(customerChannel);
      supabase.removeChannel(contactLogChannel);
      supabase.removeChannel(attachmentsChannel);
    };
  }, [customer?.id]);

  // Fetch current team member ID
  useEffect(() => {
    const fetchTeamMemberId = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: teamMember } = await supabase
          .from("team_members")
          .select("id, is_admin")
          .eq("id", user.id)
          .single();
        if (teamMember) {
          setCurrentTeamMemberId(teamMember.id);
          setIsAdmin(teamMember.is_admin ?? false);
        }
      }
    };
    fetchTeamMemberId();
  }, []);

  const handleSaveCustomer = async (customerData: Partial<Customer>): Promise<Customer> => {
    if (!customer) throw new Error("No customer to update");

    const supabase = createClient();

    try {
      // If the caller changed the status text, clear status_id so the
      // `sync_customer_status_fields` trigger re-resolves it from the new name.
      // Without this, the trigger treats the existing status_id as the source
      // of truth and silently reverts our new status text.
      const statusChanged =
        typeof customerData.status === "string" &&
        customerData.status.trim().toLowerCase() !==
          (customer.status ?? "").trim().toLowerCase();

      const updatePayload: Record<string, unknown> = {
        ...customerData,
        updated_at: new Date().toISOString(),
      };
      if (statusChanged) {
        updatePayload.status_id = null;
      }

      // Update customer in Supabase
      const { data, error } = await supabase
        .from("customers")
        .update(updatePayload)
        .eq("id", customer.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating customer:", error);
        alert(`Failed to save customer: ${error.message || 'Unknown error'}`);
        throw error;
      }

      if (!data) {
        alert("Failed to save customer: No data returned");
        throw new Error("No data returned from update");
      }

      // Update local state
      setCustomer(data);
      setShowEditModal(false);

      return data;
    } catch (error: any) {
      console.error("Error in handleSaveCustomer:", error);
      // Show user-friendly error if not already shown
      if (!error.message?.includes("No customer to update")) {
        alert(`Error saving customer: ${error.message || 'Please try again'}`);
      }
      throw error;
    }
  };

  const handleSaveNote = async () => {
    if (!customer) return;

    // For quick logs (call/email/sms), allow empty content
    // For regular notes, require content
    if (!quickLogType && !noteContent.trim()) return;

    setIsSavingNote(true);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get current team member info for notification
      const { data: teamMemberData } = await supabase
        .from("team_members")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      const teamMemberName = teamMemberData
        ? `${teamMemberData.first_name} ${teamMemberData.last_name || ""}`.trim()
        : "A team member";

      // Determine the log type and subject
      const logType = quickLogType || "note";
      let defaultSubject = "Quick Note";

      if (quickLogType === "call") defaultSubject = "Phone Call";
      else if (quickLogType === "email") defaultSubject = "Email Sent";
      else if (quickLogType === "sms") defaultSubject = "Text Message";

      const { data, error } = await supabase
        .from("contact_log")
        .insert({
          customer_id: customer.id,
          team_member_id: user.id,
          type: logType,
          subject: noteSubject.trim() || defaultSubject,
          notes: noteContent.trim() || null,
          contact_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Add new entry to the top of the list
      setContactLog([data, ...contactLog]);

      // Notify collaborators of activity (if any)
      if (customer.collaborators && customer.collaborators.length > 0) {
        const collaboratorIds = customer.collaborators
          .filter((c) => c.active)
          .map((c) => c.team_member_id);

        if (collaboratorIds.length > 0) {
          try {
            await fetch("/api/notifications/collaboration-activity", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                collaboratorTeamMemberIds: collaboratorIds,
                customerId: customer.id,
                customerName: customer.business_name,
                activityType: logType,
                activityMessage: noteContent.trim() || defaultSubject,
                activityByTeamMemberId: user.id,
                activityByTeamMemberName: teamMemberName,
              }),
            });
          } catch (notificationError) {
            console.error("Error notifying collaborators:", notificationError);
            // Don't fail the activity log if notification fails
          }
        }
      }

      // Reset form and close modal
      setNoteSubject("");
      setNoteContent("");
      setQuickLogType(null);
      setShowNoteModal(false);
    } catch (error) {
      console.error("Error saving contact log:", error);
      alert("Failed to save contact log. Please try again.");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleQuickLog = (type: "call" | "email" | "sms") => {
    setQuickLogType(type);
    setShowNoteModal(true);
  };

  const handleFileUpload = async (file: File, notes: string) => {
    if (!customer) return;

    setUploadingFile(true);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload file to storage
      const fileName = `${customer.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("customer-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Create database record
      const { data, error: dbError } = await supabase
        .from("customer_attachments")
        .insert({
          customer_id: customer.id,
          file_name: file.name,
          file_path: fileName,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user.id,
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Add to list
      setAttachments([data, ...attachments]);
      setShowUploadModal(false);
      alert("File uploaded successfully!");
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file. Please try again.");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDownloadAttachment = async (attachment: CustomerAttachment) => {
    const supabase = createClient();

    try {
      const { data, error } = await supabase.storage
        .from("customer-documents")
        .download(attachment.file_path);

      if (error) throw error;

      // Create download link
      const url = window.URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Failed to download file. Please try again.");
    }
  };

  const handleDeleteAttachment = async (attachmentId: string, fileName: string, filePath: string) => {
    const confirmed = confirm(`Delete "${fileName}"? This cannot be undone.`);
    if (!confirmed) return;

    const supabase = createClient();

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("customer-documents")
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("customer_attachments")
        .delete()
        .eq("id", attachmentId);

      if (dbError) throw dbError;

      // Remove from list
      setAttachments(attachments.filter((a) => a.id !== attachmentId));
      alert("File deleted successfully!");
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("Failed to delete file. Please try again.");
    }
  };

  const handlePin = () => {
    if (!customer) return;
    // TODO: Update in Supabase
    setCustomer({ ...customer, is_pinned: !customer.is_pinned });
  };

  const handleSaveTask = async (taskData: Partial<any>): Promise<Task> => {
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.from("tasks").insert({
        ...taskData,
        team_member_id: user.id,
        customer_id: customer?.id,
      }).select().single();

      if (error || !data) throw error;

      // Generate notification records for reminders
      if (data.id) {
        await fetch("/api/tasks/generate-notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: data.id }),
        });
      }

      setShowTaskModal(false);
      return data;
    } catch (error) {
      console.error("Error creating task:", error);
      alert("Failed to create task. Please try again.");
      throw error;
    }
  };

  const handleQuickAction = async (action: "call" | "schedule") => {
    if (!customer) return;

    if (action === "call" && customer.phone) {
      makeCall(customer.phone, customer.id);
    } else if (action === "schedule") {
      setShowTaskModal(true);
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
      multiple_per_week: "bg-green-100 text-green-800",
      weekly: "bg-blue-100 text-blue-800",
      bi_weekly: "bg-amber-100 text-amber-800",
      monthly: "bg-yellow-100 text-yellow-800",
      quarterly: "bg-orange-100 text-orange-800",
      yearly: "bg-gray-100 text-gray-800",
      other: "bg-gray-100 text-gray-800",
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

  const getContactIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "meeting":
        return <CalendarIcon className="h-4 w-4" />;
      case "sms":
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="text-lg text-slate-900">Customer not found</div>
        <button
          onClick={() => router.push("/dashboard/customers")}
          className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-white transition-colors hover:bg-orange-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Customers
        </button>
      </div>
    );
  }

  const isOverdue =
    customer.next_follow_up_date &&
    new Date(customer.next_follow_up_date) < new Date();

  const daysSinceContact = customer.last_contact_date
    ? Math.floor(
      (new Date().getTime() -
        new Date(customer.last_contact_date).getTime()) /
      (1000 * 60 * 60 * 24),
    )
    : null;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard/customers")}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
              aria-label="Back to customers"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  {customer.business_name}
                </h1>
                <button
                  onClick={handlePin}
                  className={`rounded p-1 transition-colors ${customer.is_pinned
                    ? "bg-orange-500 text-white"
                    : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                    }`}
                  title={customer.is_pinned ? "Unpin" : "Pin"}
                >
                  <Pin
                    className="h-4 w-4"
                    fill={customer.is_pinned ? "currentColor" : "none"}
                  />
                </button>
              </div>
              <p className="text-sm text-slate-600">
                Customer ID: {customer.customer_id}
              </p>

            </div>
            <button
              onClick={() => setShowEditModal(true)}
              className="flex h-10 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-medium text-white transition-colors hover:bg-orange-600"
            >
              <Edit className="h-4 w-4" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          </div>

          {/* Quick Actions - Mobile friendly */}
          <div className={`grid gap-2 ${isAdmin ? "grid-cols-4" : "grid-cols-3"}`}>
            <button
              onClick={() => handleQuickAction("call")}
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-green-50 text-green-700 transition-colors hover:bg-green-100"
            >
              <Phone className="h-4 w-4" />
              <span className="text-sm font-medium">Call</span>
            </button>
            {/* <button
              onClick={() => setShowEmailTemplateModal(true)}
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-purple-50 text-purple-700 transition-colors hover:bg-purple-100"
              title="Use email template"
            >
              <Send className="h-4 w-4" />
              <span className="text-sm font-medium">Template</span>
            </button> */}
            <button
              onClick={() => handleQuickAction("schedule")}
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-purple-50 text-purple-700 transition-colors hover:bg-purple-100"
            >
              <CalendarIcon className="h-4 w-4" />
              <span className="text-sm font-medium">Schedule</span>
            </button>
            <button
              onClick={() => setShowShareModal(true)}
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-orange-100 text-orange-700 transition-colors hover:bg-orange-200"
              title="Share this contact with other team members"
            >
              <Share2 className="h-4 w-4" />
              <span className="text-sm font-medium">Share Contact</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowAiEmailModal(true)}
                className="flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100"
                title="Draft an email with AI"
              >
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium">AI Email</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Customer Details */}
          <div className="space-y-6 lg:col-span-2">
            {/* Contact Information */}
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                Contact Information
              </h2>
              <div className="space-y-3">
                {/* Contact Name */}
                <div className="flex items-center gap-3 text-slate-700">
                  <User className="h-5 w-5 text-slate-400" />
                  <div>
                    <div className="text-sm text-slate-500">Contact Name</div>
                    <div className="font-medium">
                      {[customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
                        customer.contact_name ||
                        "—"}
                    </div>
                  </div>
                </div>

                {/* Job Title */}
                {customer.job_title && (
                  <div className="flex items-center gap-3 text-slate-700">
                    <Briefcase className="h-5 w-5 text-slate-400" />
                    <div>
                      <div className="text-sm text-slate-500">Job Title</div>
                      <div className="font-medium">{customer.job_title}</div>
                    </div>
                  </div>
                )}

                {/* Phone Numbers */}
                {(customer.phone || customer.phone_2 || customer.phone_3) && (
                  <div className="flex items-start gap-3 text-slate-700">
                    <Phone className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm text-slate-500 mb-1">Phone Numbers</div>
                      <div className="space-y-1">
                        {customer.phone && (
                          <div className="flex items-center gap-2 font-medium">
                            <span className="text-xs text-slate-500">Cell/Mobile:</span>
                            <span>{customer.phone}</span>
                            {customer.phone_ext && (
                              <span className="text-slate-500">ext. {customer.phone_ext}</span>
                            )}
                            <button
                              onClick={() => makeCall(customer.phone!, customer.id)}
                              className="ml-1 rounded p-1 text-green-600 transition-colors hover:bg-green-50"
                              title="Call via GoTo"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                        {customer.phone_2 && (
                          <div className="flex items-center gap-2 font-medium">
                            <span className="text-xs text-slate-500">Direct Office:</span>
                            <span>{customer.phone_2}</span>
                            {customer.phone_2_ext && (
                              <span className="text-slate-500">ext. {customer.phone_2_ext}</span>
                            )}
                            <button
                              onClick={() => makeCall(customer.phone_2!, customer.id)}
                              className="ml-1 rounded p-1 text-green-600 transition-colors hover:bg-green-50"
                              title="Call via GoTo"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                        {customer.phone_3 && (
                          <div className="flex items-center gap-2 font-medium">
                            <span className="text-xs text-slate-500">Main/HQ:</span>
                            <span>{customer.phone_3}</span>
                            {customer.phone_3_ext && (
                              <span className="text-slate-500">ext. {customer.phone_3_ext}</span>
                            )}
                            <button
                              onClick={() => makeCall(customer.phone_3!, customer.id)}
                              className="ml-1 rounded p-1 text-green-600 transition-colors hover:bg-green-50"
                              title="Call via GoTo"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 text-slate-700">
                  <Mail className="h-5 w-5 text-slate-400" />
                  <div className="flex-1">
                    <div className="text-sm text-slate-500">Email</div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{customer.email || "—"}</div>
                      {customer.email && (
                        <>
                          <button
                            onClick={async () => {
                              const { copyEmail } = await import("@/lib/clipboard-utils");
                              await copyEmail(customer.email!);
                            }}
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            title="Copy email to clipboard"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {/* Primary Location */}
                {(customer.address || customer.city || customer.state || customer.zip) && (
                  <div className="flex items-start gap-3 text-slate-700">
                    <MapPin className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm text-slate-500 mb-1">
                        {(customer.address_2 || customer.city_2 || customer.state_2 || customer.zip_2)
                          ? "Primary/HQ Address"
                          : "Address"}
                      </div>
                      <div className="font-medium">
                        {customer.address && <div>{customer.address}</div>}
                        <div>
                          {customer.city && customer.state
                            ? `${customer.city}, ${customer.state}${customer.zip ? ` ${customer.zip}` : ''}`
                            : customer.state || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Secondary Location (Regional Office) */}
                {(customer.address_2 || customer.city_2 || customer.state_2 || customer.zip_2) && (
                  <div className="flex items-start gap-3 text-slate-700">
                    <MapPin className="h-5 w-5 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm text-slate-500 mb-1">Regional Office</div>
                      <div className="font-medium">
                        {customer.address_2 && <div>{customer.address_2}</div>}
                        <div>
                          {customer.city_2 && customer.state_2
                            ? `${customer.city_2}, ${customer.state_2}${customer.zip_2 ? ` ${customer.zip_2}` : ''}`
                            : customer.state_2 || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 text-slate-700">
                  <Building2 className="h-5 w-5 text-slate-400" />
                  <div>
                    <div className="text-sm text-slate-500">Industry</div>
                    <div className="font-medium">
                      {customer.industry || "—"}
                    </div>
                  </div>
                </div>
                {customer.opportunity_type && (
                  <div className="flex items-center gap-3 text-slate-700">
                    <TrendingUp className="h-5 w-5 text-slate-400" />
                    <div>
                      <div className="text-sm text-slate-500">
                        Opportunity Type
                      </div>
                      <div className="font-medium">
                        {customer.opportunity_type
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 text-slate-700">
                  <TrendingUp className="h-5 w-5 text-slate-400" />
                  <div>
                    <div className="text-sm text-slate-500">
                      Estimated Value
                    </div>
                    <div className="font-medium">
                      {customer.estimated_value
                        ? `$${customer.estimated_value.toLocaleString()}`
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Secondary Contact */}
            {(customer.first_name2 || customer.last_name2 || customer.job_title2 || customer.phone2 || customer.email2) && (
              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Secondary Contact</h2>
                <div className="space-y-3">
                  {(customer.first_name2 || customer.last_name2) && (
                    <div className="flex items-center gap-3 text-slate-700">
                      <User className="h-5 w-5 text-slate-400" />
                      <div>
                        <div className="text-sm text-slate-500">Contact Name</div>
                        <div className="font-medium">
                          {[customer.first_name2, customer.last_name2].filter(Boolean).join(" ")}
                        </div>
                      </div>
                    </div>
                  )}
                  {customer.job_title2 && (
                    <div className="flex items-center gap-3 text-slate-700">
                      <Briefcase className="h-5 w-5 text-slate-400" />
                      <div>
                        <div className="text-sm text-slate-500">Job Title</div>
                        <div className="font-medium">{customer.job_title2}</div>
                      </div>
                    </div>
                  )}
                  {customer.phone2 && (
                    <div className="flex items-center gap-3 text-slate-700">
                      <Phone className="h-5 w-5 text-slate-400" />
                      <div>
                        <div className="text-sm text-slate-500">Phone</div>
                        <div className="flex items-center gap-2 font-medium">
                          <span>{customer.phone2}</span>
                          {customer.phone2_ext && (
                            <span className="text-slate-500">ext. {customer.phone2_ext}</span>
                          )}
                          <button
                            onClick={() => makeCall(customer.phone2!, customer.id)}
                            className="rounded p-1 text-green-600 transition-colors hover:bg-green-50"
                            title="Call via GoTo"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {customer.email2 && (
                    <div className="flex items-center gap-3 text-slate-700">
                      <Mail className="h-5 w-5 text-slate-400" />
                      <div>
                        <div className="text-sm text-slate-500">Email</div>
                        <div className="flex items-center gap-2 font-medium">
                          <span>{customer.email2}</span>
                          <button
                            onClick={async () => {
                              const { copyEmail } = await import("@/lib/clipboard-utils");
                              await copyEmail(customer.email2!);
                            }}
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            title="Copy email to clipboard"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Social Media & Website */}
            {(customer.website_url ||
              customer.linkedin_url ||
              customer.facebook_url ||
              customer.twitter_url ||
              customer.instagram_url) && (
                <div className="rounded-lg border border-slate-200 bg-white p-6">
                  <h2 className="mb-4 text-lg font-semibold text-slate-900">
                    Social Media & Website
                  </h2>
                  <div className="space-y-3">
                    {customer.website_url && (
                      <a
                        href={customer.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-slate-700 transition-colors hover:text-orange-600"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                          <span className="text-sm font-semibold text-slate-600">
                            🌐
                          </span>
                        </div>
                        <div>
                          <div className="text-sm text-slate-500">Website</div>
                          <div className="font-medium hover:underline">
                            {customer.website_url}
                          </div>
                        </div>
                      </a>
                    )}
                    {customer.linkedin_url && (
                      <a
                        href={customer.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-slate-700 transition-colors hover:text-blue-600"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                          <span className="text-sm font-semibold text-blue-600">
                            in
                          </span>
                        </div>
                        <div>
                          <div className="text-sm text-slate-500">LinkedIn</div>
                          <div className="font-medium hover:underline">
                            {customer.linkedin_url}
                          </div>
                        </div>
                      </a>
                    )}
                    {customer.facebook_url && (
                      <a
                        href={customer.facebook_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-slate-700 transition-colors hover:text-blue-700"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                          <span className="text-sm font-semibold text-blue-700">
                            f
                          </span>
                        </div>
                        <div>
                          <div className="text-sm text-slate-500">Facebook</div>
                          <div className="font-medium hover:underline">
                            {customer.facebook_url}
                          </div>
                        </div>
                      </a>
                    )}
                    {customer.twitter_url && (
                      <a
                        href={customer.twitter_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-slate-700 transition-colors hover:text-sky-600"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50">
                          <span className="text-sm font-semibold text-sky-600">
                            𝕏
                          </span>
                        </div>
                        <div>
                          <div className="text-sm text-slate-500">
                            Twitter / X
                          </div>
                          <div className="font-medium hover:underline">
                            {customer.twitter_url}
                          </div>
                        </div>
                      </a>
                    )}
                    {customer.instagram_url && (
                      <a
                        href={customer.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-slate-700 transition-colors hover:text-pink-600"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-purple-500 via-pink-500 to-orange-500">
                          <span className="text-sm font-semibold text-white">
                            IG
                          </span>
                        </div>
                        <div>
                          <div className="text-sm text-slate-500">Instagram</div>
                          <div className="font-medium hover:underline">
                            {customer.instagram_url}
                          </div>
                        </div>
                      </a>
                    )}
                  </div>
                </div>
              )}

            {/* Notes */}
            {customer.notes && (
              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <h2 className="mb-3 text-lg font-semibold text-slate-900">
                  Notes
                </h2>
                <p className="text-slate-700">{customer.notes}</p>
              </div>
            )}

            {/* Team Members / Collaborators */}
            {customer.collaborators && customer.collaborators.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-6">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">
                  👥 Teaming On This Opportunity
                </h2>
                <div className="space-y-3">
                  {customer.collaborators.map((collab) => (
                    <div
                      key={collab.id}
                      className="flex items-center justify-between rounded-lg bg-slate-50 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-orange-500 to-orange-600 text-white font-semibold">
                          {collab.team_member_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">
                            {collab.team_member_name}
                          </div>
                          <div className="text-xs text-slate-600">
                            {collab.role === "partner" ? "🤝 Partner" : "👤 Owner"} •{" "}
                            {collab.access_level === "full"
                              ? "Full Access"
                              : "View Only"}
                          </div>
                        </div>
                      </div>
                      {currentTeamMemberId === customer.team_member_id && (
                        <button
                          onClick={async () => {
                            const confirmed = confirm(
                              `Remove ${collab.team_member_name} from this opportunity?`
                            );
                            if (!confirmed) return;

                            const supabase = createClient();
                            try {
                              const { error } = await supabase
                                .from("customer_collaborators")
                                .update({ active: false })
                                .eq("id", collab.id);

                              if (error) throw error;

                              // Update local customer state
                              setCustomer({
                                ...customer,
                                collaborators:
                                  customer.collaborators?.filter(
                                    (c) => c.id !== collab.id
                                  ) || [],
                              });
                            } catch (error) {
                              console.error("Error removing collaborator:", error);
                              alert("Failed to remove team member. Please try again.");
                            }
                          }}
                          className="rounded px-2 py-1 text-sm text-red-600 transition-colors hover:bg-red-50"
                          title="Remove from team"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Log */}
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Contact Log
                </h2>
                <button
                  onClick={() => {
                    setQuickLogType(null);
                    setShowNoteModal(true);
                  }}
                  className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" />
                  Add Note
                </button>
              </div>

              {/* Quick Contact Actions */}
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  onClick={() => handleQuickLog("call")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-green-300 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 transition-colors hover:bg-green-100"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Called
                </button>
                <button
                  onClick={() => handleQuickLog("email")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Emailed
                </button>
                <button
                  onClick={() => handleQuickLog("sms")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-purple-300 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Text
                </button>
              </div>

              <div className="space-y-4">
                {contactLog.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">
                    No activity logged yet
                  </div>
                ) : (
                  contactLog.map((log) => (
                    <div
                      key={log.id}
                      className="flex gap-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                        {getContactIcon(log.type)}
                      </div>
                      <div className="flex-1">
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
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
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
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Attachments Section */}
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Documents & Files
                </h2>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </button>
              </div>

              <div className="space-y-3">
                {attachments.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">
                    <FileIcon className="mx-auto mb-2 h-12 w-12 text-slate-300" />
                    <p>No files uploaded yet</p>
                    <p className="text-xs">Upload documents, images, or PDFs</p>
                  </div>
                ) : (
                  attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors hover:bg-slate-100"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white">
                        {attachment.file_type.startsWith("image/") ? (
                          <img
                            src={`/api/placeholder/40/40`}
                            alt=""
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <FileIcon className="h-5 w-5 text-slate-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {attachment.file_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {(attachment.file_size / 1024).toFixed(1)} KB •{" "}
                          {new Date(attachment.uploaded_at).toLocaleDateString()}
                        </div>
                        {attachment.notes && (
                          <div className="mt-1 text-xs text-slate-600 truncate">
                            {attachment.notes}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDownloadAttachment(attachment)}
                          className="rounded p-1.5 text-blue-600 transition-colors hover:bg-blue-50"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            handleDeleteAttachment(
                              attachment.id,
                              attachment.file_name,
                              attachment.file_path,
                            )
                          }
                          className="rounded p-1.5 text-red-600 transition-colors hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Status & Follow-Up */}
          <div className="space-y-6">
            {/* Status Card */}
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                Status
              </h2>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-sm text-slate-500">
                    Current Status
                  </div>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${getStatusColor(customer.status)}`}
                  >
                    {customer.status.charAt(0).toUpperCase() +
                      customer.status.slice(1)}
                  </span>
                </div>

                <div>
                  <div className="mb-2 text-sm text-slate-500">
                    Shipping Frequency
                  </div>
                  {customer.shipping_frequency ? (
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${getFrequencyColor(customer.shipping_frequency)}`}
                    >
                      {formatFrequency(customer.shipping_frequency)}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </div>
              </div>
            </div>

            {/* Follow-Up Card */}
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                Follow-Up
              </h2>
              <div className="space-y-4">
                {customer.last_contact_date && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                      <Clock className="h-4 w-4" />
                      Last Contact
                    </div>
                    <div className="text-slate-900">
                      {formatDate(customer.last_contact_date)}
                    </div>
                    {daysSinceContact !== null && (
                      <div className="text-sm text-slate-500">
                        {daysSinceContact === 0
                          ? "Today"
                          : daysSinceContact === 1
                            ? "Yesterday"
                            : `${daysSinceContact} days ago`}
                      </div>
                    )}
                  </div>
                )}

                {customer.next_follow_up_date && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                      <CalendarIcon className="h-4 w-4" />
                      Next Follow-Up
                    </div>
                    <div
                      className={`font-medium ${isOverdue ? "text-red-600" : "text-slate-900"}`}
                    >
                      {formatDate(customer.next_follow_up_date)}
                      {isOverdue && (
                        <span className="ml-2 text-sm">(Overdue)</span>
                      )}
                    </div>
                    {customer.next_follow_up_type && (
                      <div className="mt-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${followUpTypeStyles[
                            customer.next_follow_up_type as FollowUpType
                          ].badge
                            }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${followUpTypeStyles[
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
              </div>
            </div>

            {/* AI Call Brief */}
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-orange-500" />
                  <h2 className="text-sm font-semibold text-slate-900">AI Call Brief</h2>
                  {briefSources?.goto && (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-200">GoTo</span>
                  )}
                </div>
                <button
                  onClick={() => customer && fetchCallBrief(customer)}
                  disabled={briefLoading}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                  title="Regenerate brief"
                >
                  <Sparkles className="h-3 w-3" />
                  {briefLoading ? "Generating..." : briefText ? "Refresh" : "Generate"}
                </button>
              </div>
              {briefLoading && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-orange-300 border-t-transparent" />
                  Analyzing communication history...
                </div>
              )}
              {!briefLoading && briefText && (
                <p className="text-sm leading-relaxed text-slate-700">{briefText}</p>
              )}
              {!briefLoading && !briefText && (
                <p className="text-xs text-slate-400">Click Generate to get an AI summary of past interactions before your next call.</p>
              )}
            </div>

            {/* Timestamps */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
              {/* Assigned TeamMember */}
              {customer.team_member_id && assignedTeamMemberName && (
                <div className="flex items-center gap-1 text-slate-700">
                  <User className="h-3 w-3 text-orange-500" />
                  <div>
                    <div className="text-sm text-slate-700">Assigned to: <span className="text-sm font-medium">{assignedTeamMemberName}</span></div>

                  </div>
                </div>
              )}
              <div className="ml-4 mt-2">
                <div className="mb-1">
                  Created: {formatDate(customer.created_at)}
                </div>
                <div>Updated: {formatDate(customer.updated_at)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <CustomerFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveCustomer}
        customer={customer}
        teamMemberId={customer.team_member_id}
      />

      {/* Task/Schedule Modal */}
      <TaskFormModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onSave={handleSaveTask}
        teamMemberId={customer.team_member_id}
        customers={[customer]}
      />

      {/* Add Note Modal */}
      <Modal
        isOpen={showNoteModal}
        onClose={() => {
          setShowNoteModal(false);
          setNoteSubject("");
          setNoteContent("");
          setQuickLogType(null);
        }}
        title={
          quickLogType === "call"
            ? "Log Phone Call"
            : quickLogType === "email"
              ? "Log Email"
              : quickLogType === "sms"
                ? "Log Text Message"
                : "Add Note"
        }
        size="lg"
      >
        <div className="p-4 sm:p-6">
          <div className="space-y-4">
            {/* Subject */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Subject (optional)
              </label>
              <input
                type="text"
                value={noteSubject}
                onChange={(e) => setNoteSubject(e.target.value)}
                placeholder={
                  quickLogType === "call"
                    ? "e.g., Discussed shipping rates"
                    : quickLogType === "email"
                      ? "e.g., Rate quote sent"
                      : quickLogType === "sms"
                        ? "e.g., Quick follow-up"
                        : "e.g., Follow-up discussion, Rate quote sent..."
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>

            {/* Note Content */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Note {!quickLogType && <span className="text-red-500">*</span>}
                {quickLogType && (
                  <span className="text-slate-500">(optional)</span>
                )}
              </label>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder={
                  quickLogType
                    ? "Add optional details about this contact..."
                    : "Enter your note here..."
                }
                rows={5}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
              <div className="mt-1 text-xs text-slate-500">
                {quickLogType
                  ? `${noteContent.length} / 1000 characters`
                  : `Required • ${noteContent.length} / 1000 characters`}
              </div>
            </div>

            {/* Info */}
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
              <p className="font-medium">
                {quickLogType === "call"
                  ? "Quick Call Log"
                  : quickLogType === "email"
                    ? "Quick Email Log"
                    : quickLogType === "sms"
                      ? "Quick Text Log"
                      : "Quick Note"}
              </p>
              <p className="mt-1 text-xs text-blue-700">
                {quickLogType
                  ? "Automatically timestamped. Add optional details to track important conversation points."
                  : "This will be saved as an activity log entry. No reminders or tasks will be created."}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button
              onClick={() => {
                setShowNoteModal(false);
                setNoteSubject("");
                setNoteContent("");
                setQuickLogType(null);
              }}
              className="flex h-11 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNote}
              disabled={(!quickLogType && !noteContent.trim()) || isSavingNote}
              className="flex h-11 items-center justify-center rounded-lg bg-orange-500 px-4 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingNote
                ? "Saving..."
                : quickLogType
                  ? "Log Contact"
                  : "Save Note"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Email Template Modal */}
      {customer && (
        <EmailTemplateModal
          isOpen={showEmailTemplateModal}
          onClose={() => setShowEmailTemplateModal(false)}
          customer={customer}
        />
      )}

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleFileUpload}
        uploading={uploadingFile}
      />

      {/* Share Customer Modal */}
      {customer && (
        <ShareCustomerModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          customer={customer}
          currentTeamMemberId={currentTeamMemberId || ""}
        />
      )}

      {/* AI Email Draft Modal (admin only) */}
      {customer && isAdmin && (
        <AiEmailDraftModal
          isOpen={showAiEmailModal}
          onClose={() => setShowAiEmailModal(false)}
          customer={customer}
        />
      )}
    </div>
  );
}

// File Upload Modal Component
function FileUploadModal({
  isOpen,
  onClose,
  onUpload,
  uploading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, notes: string) => void;
  uploading: boolean;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileNotes, setFileNotes] = useState("");
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB");
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleSubmit = () => {
    if (!selectedFile) return;
    onUpload(selectedFile, fileNotes);
  };

  const handleClose = () => {
    if (!uploading) {
      setSelectedFile(null);
      setFileNotes("");
      setFilePreview(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload File" size="lg">
      <div className="p-4 sm:p-6">
        <div className="space-y-4">
          {/* File Input */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Select File <span className="text-red-500">*</span>
            </label>
            {!selectedFile ? (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 transition-colors hover:border-orange-400 hover:bg-orange-50">
                <Paperclip className="mb-2 h-10 w-10 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">
                  Click to select file
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  Images, PDFs, Documents (max 10MB)
                </span>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                {filePreview ? (
                  <div className="mb-3">
                    <img
                      src={filePreview}
                      alt="Preview"
                      className="h-48 w-full rounded object-contain bg-slate-50"
                    />
                  </div>
                ) : (
                  <div className="mb-3 flex h-48 items-center justify-center rounded bg-slate-50">
                    <FileIcon className="h-16 w-16 text-slate-400" />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Paperclip className="h-4 w-4 text-slate-400" />
                    <span className="font-medium text-slate-700">
                      {selectedFile.name}
                    </span>
                    <span className="text-slate-500">
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setFilePreview(null);
                    }}
                    disabled={uploading}
                    className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Notes (optional)
            </label>
            <textarea
              value={fileNotes}
              onChange={(e) => setFileNotes(e.target.value)}
              placeholder="Add a description or notes about this file..."
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              disabled={uploading}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="flex h-11 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedFile || uploading}
            className="flex h-11 items-center justify-center rounded-lg bg-orange-500 px-4 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
