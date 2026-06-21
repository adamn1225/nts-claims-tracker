"use client";

import { useState, useEffect, useRef } from "react";
import Modal from "./Modal";
import type { Task, TaskType, TaskPriority, Customer } from "@/lib/types";
import { getCustomerDisplayName } from "@/lib/customer-utils";
import {
  Clock,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  Info,
  User,
  ChevronDown,
  ChevronRight,
  Bell,
  Save,
  FileText,
} from "lucide-react";

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => Promise<Task>;
  task?: Task | null;
  teamMemberId: string | null;
  customers?: Customer[]; // For customer selection
  preselectedCustomer?: Customer; // Customer pre-selected from customer card
}

// Task Type Templates with descriptions and auto-fill suggestions
const actionTypeOptions: {
  value: TaskType;
  label: string;
  description: string;
  defaultPriority?: TaskPriority;
  suggestedTitle?: string;
  suggestedDescription?: string;
}[] = [
  {
    value: "internal_reminder",
    label: "Internal Reminder",
    description: "Personal reminder not tied to customer outreach",
    defaultPriority: "medium",
    suggestedTitle: "Reminder: ",
  },
  {
    value: "call",
    label: "Call",
    description: "Schedule a phone call with customer",
    defaultPriority: "high",
    suggestedTitle: "Call: ",
  },
  {
    value: "email",
    label: "Email",
    description: "Send an email to customer",
    defaultPriority: "medium",
    suggestedTitle: "Email: ",
  },
  {
    value: "sms",
    label: "SMS",
    description: "Send a text message to customer",
    defaultPriority: "medium",
    suggestedTitle: "Text: ",
  },
  {
    value: "meeting",
    label: "Meeting",
    description: "Schedule in-person or virtual meeting",
    defaultPriority: "high",
    suggestedTitle: "Meeting: ",
  },
  {
    value: "decision_day",
    label: "Decision Day",
    description:
      "Customer's deadline to decide on proposal/quote - critical follow-up date",
    defaultPriority: "urgent",
    suggestedTitle: "Decision Day: ",
    suggestedDescription:
      "Follow up on pending decision. Review proposal terms and address any final concerns.",
  },
  {
    value: "price_check_in",
    label: "Price Check In (Give Quote)",
    description:
      "Provide pricing/quote to customer - initial rate proposal or updated pricing",
    defaultPriority: "high",
    suggestedTitle: "Provide Quote: ",
    suggestedDescription:
      "Send pricing for requested lane/service. Include all fees and transit time.",
  },
  {
    value: "rate_reevaluation",
    label: "Rate Re-Evaluation",
    description:
      "Review and adjust existing rates - market changes, fuel costs, or contract renewal",
    defaultPriority: "high",
    suggestedTitle: "Rate Review: ",
    suggestedDescription:
      "Re-evaluate current pricing based on market conditions. Prepare updated rate sheet.",
  },
  {
    value: "reactivation",
    label: "Reactivate Past Customer",
    description:
      "Re-engage inactive customer we haven't heard from in a while - win them back",
    defaultPriority: "medium",
    suggestedTitle: "Reactivate: ",
    suggestedDescription:
      "Reach out to past customer. Check on current shipping needs and offer competitive rates.",
  },
  {
    value: "linkedin_connection",
    label: "Send LinkedIn Connection Request",
    description:
      "Connect with customer on LinkedIn to build professional relationship",
    defaultPriority: "low",
    suggestedTitle: "LinkedIn Connect: ",
    suggestedDescription:
      "Send personalized connection request mentioning recent conversation or mutual interests.",
  },
  {
    value: "linkedin_message",
    label: "Send LinkedIn Message",
    description:
      "Follow up via LinkedIn message - less formal than email, good for relationship building",
    defaultPriority: "low",
    suggestedTitle: "LinkedIn Message: ",
    suggestedDescription:
      "Send brief, friendly message on LinkedIn. Keep it casual and conversational.",
  },
  {
    value: "video_shoutout",
    label: "Send Video Shoutout",
    description:
      "Record personalized video message - stands out, builds rapport, memorable touch",
    defaultPriority: "medium",
    suggestedTitle: "Video Shoutout: ",
    suggestedDescription:
      "Record 30-60 sec personal video. Thank them for business or address specific topic.",
  },
  {
    value: "service_feedback",
    label: "Service Feedback Check",
    description: "Check in on recent service quality and customer satisfaction",
    defaultPriority: "medium",
    suggestedTitle: "Service Feedback: ",
    suggestedDescription:
      "Follow up on recent shipment. Ask about delivery experience and any improvement areas.",
  },
  {
    value: "follow_up",
    label: "General Follow-Up",
    description: "General check-in or follow-up on previous conversation",
    defaultPriority: "medium",
    suggestedTitle: "Follow-Up: ",
  },
  {
    value: "other",
    label: "Other",
    description: "Custom task type",
    defaultPriority: "medium",
  },
];

const priorityOptions: { value: TaskPriority; label: string; color: string }[] =
  [
    { value: "urgent", label: "Urgent", color: "text-red-700" },
    { value: "high", label: "High", color: "text-orange-700" },
    { value: "medium", label: "Medium", color: "text-amber-700" },
    { value: "low", label: "Low", color: "text-slate-700" },
  ];

// Time-based reminder options (in minutes before task)
const reminderOptions = [
  { value: 15, label: "15 Minutes Before" },
  { value: 30, label: "30 Minutes Before" },
  { value: 45, label: "45 Minutes Before" },
  { value: 60, label: "1 Hour Before" },
  { value: 90, label: "1.5 Hours Before" },
  { value: 120, label: "2 Hours Before" },
  { value: 180, label: "3 Hours Before" },
];

export default function TaskFormModal({
  isOpen,
  onClose,
  onSave,
  task,
  teamMemberId,
  customers = [],
  preselectedCustomer,
}: TaskFormModalProps) {
  const isEditing = !!task;
  const isCustomerPreselected = !!preselectedCustomer;

  const [formData, setFormData] = useState<Partial<Task>>({
    team_member_id: teamMemberId,
    title: task?.title || "",
    description: task?.description || "",
    type: task?.type || "internal_reminder",
    priority: task?.priority || "medium",
    customer_id: task?.customer_id || preselectedCustomer?.id || "",
    due_date: task?.due_date || new Date().toISOString().split("T")[0],
    due_time: task?.due_time || "",
    reminder_days: task?.reminder_days || [], // Default: no reminders
    status: task?.status || "pending",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>(
    {},
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isRemindersSectionExpanded, setIsRemindersSectionExpanded] = useState(false);
  const [emailNotificationsDisabled, setEmailNotificationsDisabled] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const dueTimeRef = useRef<HTMLInputElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  
  // Customer search state
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  // Auto-focus first field when modal opens
  useEffect(() => {
    if (isOpen && titleInputRef.current) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Initialize customer search when editing or preselected
  useEffect(() => {
    if (formData.customer_id && customers.length > 0) {
      const customer = customers.find(c => c.id === formData.customer_id);
      if (customer) {
        setCustomerSearch(`${customer.business_name || getCustomerDisplayName(customer) || "Unknown"} - ${getCustomerDisplayName(customer)}`);
      }
    } else if (!formData.customer_id) {
      setCustomerSearch("");
    }
  }, [task, preselectedCustomer, customers, isOpen]);

  // Load templates and check notification settings
  useEffect(() => {
    const loadData = async () => {
      if (!isOpen || !teamMemberId) return;

      const supabase = (await import("@/lib/supabase/client")).createClient();
      
      // Check notification settings
      const { data: prefs } = await supabase
        .from("user_preferences")
        .select("email_notifications_enabled")
        .eq("team_member_id", teamMemberId)
        .single();

      setEmailNotificationsDisabled(prefs?.email_notifications_enabled === false);

      // Load templates
      const { data: templatesData } = await supabase
        .from("task_templates")
        .select("*")
        .eq("team_member_id", teamMemberId)
        .order("name");

      setTemplates(templatesData || []);
    };

    loadData();
  }, [isOpen, teamMemberId]);

  // Close customer dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };

    if (showCustomerDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showCustomerDropdown]);

  // Keyboard shortcuts: Ctrl/Cmd+S to save, Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Ctrl/Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSubmit(e as any);
      }

      // Escape to close
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, formData]);

  // Update form data when task changes (for editing)
  useEffect(() => {
    if (task) {
      setFormData({
        team_member_id: teamMemberId,
        title: task.title || "",
        description: task.description || "",
        type: task.type || "internal_reminder",
        priority: task.priority || "medium",
        customer_id: task.customer_id || "",
        due_date: task.due_date || new Date().toISOString().split("T")[0],
        due_time: task.due_time || "",
        reminder_days: task.reminder_days || [],
        status: task.status || "pending",
      });
    } else {
      // Reset form for new task
      setFormData({
        team_member_id: teamMemberId,
        title: "",
        description: "",
        type: "internal_reminder",
        priority: "medium",
        customer_id: preselectedCustomer?.id || "",
        due_date: new Date().toISOString().split("T")[0],
        due_time: "",
        reminder_days: [], // Default: no reminders
        status: "pending",
      });
    }
    // Reset touched fields when task changes
    setTouchedFields({});
  }, [task, teamMemberId, preselectedCustomer]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value === "" ? undefined : value,
    }));

    // Mark field as touched
    setTouchedFields((prev) => ({ ...prev, [name]: true }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Handle task type change with template auto-fill
  const handleTaskTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as TaskType;
    const template = actionTypeOptions.find((opt) => opt.value === newType);

    if (!template) return;

    // Only auto-fill if creating new task (not editing) and fields are empty
    const updates: Partial<Task> = { type: newType };

    if (!isEditing) {
      if (template.defaultPriority && !formData.priority) {
        updates.priority = template.defaultPriority;
      }

      // Auto-fill title prefix if title is empty
      if (template.suggestedTitle && !formData.title?.trim()) {
        updates.title = template.suggestedTitle;
      }

      // Auto-fill description if description is empty
      if (template.suggestedDescription && !formData.description?.trim()) {
        updates.description = template.suggestedDescription;
      }
    }

    setFormData((prev) => ({ ...prev, ...updates }));
    setTouchedFields((prev) => ({ ...prev, type: true }));

    // Clear error for type field
    if (errors.type) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.type;
        return newErrors;
      });
    }
  };

  const handleBlur = (fieldName: string) => {
    setTouchedFields((prev) => ({ ...prev, [fieldName]: true }));
  };

  // Helper to determine if a field is valid
  const isFieldValid = (fieldName: string): boolean | null => {
    if (!touchedFields[fieldName]) return null; // Not touched yet
    if (errors[fieldName]) return false; // Has error

    // Field-specific validation
    if (fieldName === "title") return !!formData.title?.trim();
    if (fieldName === "due_date") return !!formData.due_date;
    if (fieldName === "description") return !!formData.description?.trim();

    return null;
  };

  // Get validation icon
  const getValidationIcon = (fieldName: string) => {
    const isValid = isFieldValid(fieldName);
    if (isValid === null) return null;

    return isValid ? (
      <CheckCircle2 className="h-5 w-5 text-green-600" />
    ) : (
      <AlertCircle className="h-5 w-5 text-red-600" />
    );
  };

  const handleReminderToggle = (minutes: number) => {
    setFormData((prev) => {
      const current = prev.reminder_days || [];
      const isSelected = current.includes(minutes);

      return {
        ...prev,
        reminder_days: isSelected
          ? current.filter((m) => m !== minutes)
          : [...current, minutes].sort((a, b) => a - b), // Sort ascending (earliest first)
      };
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title?.trim()) {
      newErrors.title = "Task title is required";
    }

    if (!formData.due_date) {
      newErrors.due_date = "Due date is required";
    }

    // Time-based reminders require a time to calculate "X minutes before"
    const hasReminders = (formData.reminder_days?.length ?? 0) > 0;
    if (hasReminders && !formData.due_time) {
      newErrors.due_time = "A time is required when reminders are set — reminders are calculated relative to the task time.";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      // Scroll to and expand the time field if that's the only issue
      if (newErrors.due_time) {
        setIsRemindersSectionExpanded(true);
        setTimeout(() => {
          scheduleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          dueTimeRef.current?.focus();
        }, 50);
      }
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSaving(true);

    try {
      // Validate and sanitize dates before saving
      const sanitizedFormData = { ...formData };
      
      // Validate due_date
      if (sanitizedFormData.due_date) {
        const dueDate = new Date(sanitizedFormData.due_date);
        if (isNaN(dueDate.getTime())) {
          // Invalid date - show error and don't save
          setErrors({ submit: "Invalid due date format. Please select a valid date." });
          setIsSaving(false);
          return;
        }
      } else {
        // Empty date - show error (due_date is required)
        setErrors({ submit: "Due date is required" });
        setIsSaving(false);
        return;
      }
      
      // Ensure due_date stays as a plain date string (no timezone conversion)
      const taskData = {
        ...sanitizedFormData,
        due_date: sanitizedFormData.due_date, // Keep as YYYY-MM-DD string
      };

      await onSave(taskData);
      onClose();
      // Reset form
      setFormData({
        team_member_id: teamMemberId,
        title: "",
        description: "",
        type: "internal_reminder",
        priority: "medium",
        customer_id: "",
        due_date: new Date().toISOString().split("T")[0],
        due_time: "",
        reminder_days: [], // Default: no reminders
        status: "pending",
      });
    } catch (error: any) {
      console.error("Error saving task:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        fullError: error,
      });
      setErrors({
        submit:
          error?.message || "Failed to save task. Check console for details.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    // Calculate due date from offset
    let dueDate = new Date();
    const offset = template.due_date_offset || "+1 day";
    const match = offset.match(/([+-]?\d+)\s*(day|week|hour)/);
    if (match) {
      const amount = parseInt(match[1]);
      const unit = match[2];
      if (unit === 'day') dueDate.setDate(dueDate.getDate() + amount);
      else if (unit === 'week') dueDate.setDate(dueDate.getDate() + (amount * 7));
      else if (unit === 'hour') dueDate.setHours(dueDate.getHours() + amount);
    }

    setFormData({
      ...formData,
      title: template.name,
      description: template.description || "",
      type: template.type,
      priority: template.priority || "medium",
      due_date: dueDate.toISOString().split('T')[0],
      due_time: template.due_time || "",
      reminder_days: template.reminder_days || [],
    });
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim() || !teamMemberId) return;

    const supabase = (await import("@/lib/supabase/client")).createClient();
    const { error } = await supabase.from("task_templates").insert({
      team_member_id: teamMemberId,
      name: templateName.trim(),
      description: formData.description || null,
      type: formData.type,
      priority: formData.priority || null,
      reminder_days: formData.reminder_days,
      due_date_offset: "+1 day", // Default offset
      due_time: formData.due_time || null,
    });

    if (!error) {
      // Reload templates
      const { data: templatesData } = await supabase
        .from("task_templates")
        .select("*")
        .eq("team_member_id", teamMemberId)
        .order("name");
      setTemplates(templatesData || []);
      setShowSaveTemplateDialog(false);
      setTemplateName("");
    }
  };

  // Filter customers based on search
  const filteredCustomers = customers.filter((customer) => {
    if (!customerSearch.trim()) return true;
    const query = customerSearch.toLowerCase();
    const searchText = [
      customer.business_name || "",
      getCustomerDisplayName(customer),
      customer.email,
      customer.phone,
      customer.city,
      customer.state,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return searchText.includes(query);
  });

  const handleSelectCustomer = (customerId: string) => {
    setFormData((prev) => ({ ...prev, customer_id: customerId }));
    setShowCustomerDropdown(false);
    
    // Update search to show selected customer
    const selected = customers.find(c => c.id === customerId);
    if (selected) {
      setCustomerSearch(`${selected.business_name || getCustomerDisplayName(selected) || "Unknown"} - ${getCustomerDisplayName(selected)}`);
    }
  };

  const handleCustomerSearchChange = (value: string) => {
    setCustomerSearch(value);
    setShowCustomerDropdown(true);
    // Clear selection if search changes
    if (formData.customer_id) {
      setFormData((prev) => ({ ...prev, customer_id: "" }));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEditing ? `Edit Task #${task?.id?.slice(0, 8) || ""}` : "New Task"
      }
      size="xl"
    >
      <form onSubmit={handleSubmit} className="p-4 sm:p-6">
        {/* Email Notifications Disabled Warning */}
        {emailNotificationsDisabled && formData.reminder_days && formData.reminder_days.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">Email Notifications Disabled</p>
                <p className="mt-1 text-xs">
                  You have email notifications turned off in your settings. You won't receive reminder emails for this task even though reminders are configured.
                </p>
                <a
                  href="/dashboard/settings"
                  target="_blank"
                  className="mt-2 inline-block text-xs font-semibold text-amber-700 underline hover:text-amber-800"
                >
                  Enable notifications in Settings →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errors.submit && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errors.submit}
          </div>
        )}

        {/* Load Template Dropdown */}
        {!isEditing && templates.length > 0 && (
          <div className="mb-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              <FileText className="inline h-4 w-4 mr-1" />
              Load from Template
            </label>
            <select
              onChange={(e) => e.target.value && handleLoadTemplate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-20"
              defaultValue=""
            >
              <option value="">Select a template...</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Keyboard Shortcuts Info */}
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>Keyboard shortcuts:</strong> Press{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-blue-100 font-mono text-blue-900">
              Ctrl+S
            </kbd>{" "}
            or{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-blue-100 font-mono text-blue-900">
              ⌘S
            </kbd>{" "}
            to save,{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-blue-100 font-mono text-blue-900">
              Esc
            </kbd>{" "}
            to cancel
          </div>
        </div>

        {/* Quick Task Template Banner */}
        {!isEditing && formData.type !== "internal_reminder" && (
          <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800 flex items-start gap-2">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
              ✓
            </div>
            <div>
              <strong>Quick Task Template Applied:</strong>{" "}
              {
                actionTypeOptions.find((opt) => opt.value === formData.type)
                  ?.label
              }
              <br />
              <span className="text-orange-700">
                Title, description, and priority have been pre-filled. Feel free
                to customize!
              </span>
            </div>
          </div>
        )}

        {/* Form Grid */}
        <div className="space-y-5">
          {/* Task Title */}
          <div>
            <label
              htmlFor="title"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Task Title <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                ref={titleInputRef}
                type="text"
                id="title"
                name="title"
                value={formData.title || ""}
                onChange={handleChange}
                onBlur={() => handleBlur("title")}
                className={`h-11 w-full rounded-lg border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 transition-colors ${
                  errors.title
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                    : "border-slate-200 focus:border-orange-500 focus:ring-orange-500/20"
                }`}
                placeholder="e.g., Follow up on shipping quote"
                autoComplete="off"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {getValidationIcon("title")}
              </div>
            </div>
            {errors.title && (
              <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.title}
              </p>
            )}
            {!errors.title && touchedFields.title && formData.title?.trim() && (
              <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Looks good!
              </p>
            )}
          </div>

          {/* Action Type & Priority - Visual Grouping */}
          <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-orange-500"></div>
              Task Details
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="type"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Action Type (Quick Task Template)
                </label>
                <select
                  id="type"
                  name="type"
                  value={formData.type || "internal_reminder"}
                  onChange={handleTaskTypeChange}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  {actionTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {/* Show description for selected task type */}
                {formData.type && (
                  <p className="mt-1.5 text-xs text-slate-600 flex items-start gap-1.5">
                    <Info className="h-3 w-3 shrink-0 mt-0.5 text-blue-500" />
                    <span>
                      {
                        actionTypeOptions.find(
                          (opt) => opt.value === formData.type,
                        )?.description
                      }
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="priority"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Priority
                </label>
                <select
                  id="priority"
                  name="priority"
                  value={formData.priority || "medium"}
                  onChange={handleChange}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  {priorityOptions.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className={option.color}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-500">
                  Current:{" "}
                  <span
                    className={
                      priorityOptions.find((p) => p.value === formData.priority)
                        ?.color
                    }
                  >
                    {
                      priorityOptions.find((p) => p.value === formData.priority)
                        ?.label
                    }
                  </span>
                </p>
              </div>
            </div>

            {/* Customer Assignment - Only show if not preselected */}
            {!isCustomerPreselected ? (
              <div ref={customerSearchRef} className="relative">
                <label
                  htmlFor="customer_search"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Customer{" "}
                  <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="customer_search"
                    value={customerSearch}
                    onChange={(e) => handleCustomerSearchChange(e.target.value)}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    placeholder="Search or select a customer..."
                    autoComplete="off"
                  />
                  <User className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                
                {/* Dropdown */}
                {showCustomerDropdown && (
                  <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {/* No customer option */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, customer_id: "" }));
                        setCustomerSearch("");
                        setShowCustomerDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50 border-b border-slate-100"
                    >
                      -- No customer (standalone task) --
                    </button>
                    
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => handleSelectCustomer(customer.id)}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-orange-50 transition-colors ${
                            formData.customer_id === customer.id ? "bg-orange-50" : ""
                          }`}
                        >
                          <div className="font-medium text-slate-900">
                            {customer.business_name || getCustomerDisplayName(customer) || "Unknown"}
                          </div>
                          <div className="text-xs text-slate-600">
                            {getCustomerDisplayName(customer)}
                            {customer.city && customer.state && ` • ${customer.city}, ${customer.state}`}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-center text-sm text-slate-500">
                        No customers found
                      </div>
                    )}
                  </div>
                )}
                
                <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Link this task to a customer or leave blank for personal reminders
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-orange-900">
                      Task for: {preselectedCustomer.business_name || getCustomerDisplayName(preselectedCustomer) || "Unknown"}
                    </p>
                    <p className="mt-0.5 text-xs text-orange-700">
                      Contact: {getCustomerDisplayName(preselectedCustomer)}
                      {preselectedCustomer.phone &&
                        ` • ${preselectedCustomer.phone}`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Notes / Description{" "}
              <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <textarea
                id="description"
                name="description"
                value={formData.description || ""}
                onChange={handleChange}
                onBlur={() => handleBlur("description")}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                placeholder="Additional details, context, or talking points for this task..."
              />
              {formData.description && (
                <div className="absolute bottom-2 right-2 text-xs text-slate-400">
                  {formData.description.length} characters
                </div>
              )}
            </div>
          </div>

          {/* Date & Time - Enhanced Section */}
          <div ref={scheduleRef} className="space-y-4 rounded-lg border border-slate-200 bg-linear-to-br from-orange-50 to-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-orange-500" />
              Schedule
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="due_date"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    id="due_date"
                    name="due_date"
                    value={formData.due_date || ""}
                    onChange={handleChange}
                    onBlur={() => handleBlur("due_date")}
                    className={`h-11 w-full rounded-lg border bg-white px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 transition-colors ${
                      errors.due_date
                        ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                        : "border-slate-200 focus:border-orange-500 focus:ring-orange-500/20"
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {getValidationIcon("due_date")}
                  </div>
                </div>
                {errors.due_date && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.due_date}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="due_time"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Time{" "}
                  <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    ref={dueTimeRef}
                    type="time"
                    id="due_time"
                    name="due_time"
                    value={formData.due_time || ""}
                    onChange={handleChange}
                    className={`h-11 w-full rounded-lg border bg-white pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors ${
                      errors.due_time
                        ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                        : "border-slate-200 focus:border-orange-500 focus:ring-orange-500/20"
                    }`}
                    placeholder="--:--"
                  />
                </div>
                {errors.due_time ? (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.due_time}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Leave blank for all-day task. Required for time-based reminders.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Reminders - Collapsible Section */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
            {/* Accordion Header */}
            <button
              type="button"
              onClick={() => setIsRemindersSectionExpanded(!isRemindersSectionExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                {/* <div className="h-1 w-1 rounded-full bg-orange-500"></div> */}
                <h3 className="text-sm font-semibold text-slate-700">
                  Task Reminders (Day Of)
                </h3>
              </div>
              <div className="flex items-center gap-3">
                {/* Summary when collapsed */}
                {!isRemindersSectionExpanded && formData.reminder_days && formData.reminder_days.length > 0 && (
                  <span className="text-xs font-medium text-orange-600">
                    {formData.reminder_days.length} reminder{formData.reminder_days.length > 1 ? 's' : ''} set
                  </span>
                )}
                {!isRemindersSectionExpanded && (!formData.reminder_days || formData.reminder_days.length === 0) && (
                  <span className="text-xs font-medium text-slate-500">
                    No reminders
                  </span>
                )}
                {isRemindersSectionExpanded ? (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                )}
              </div>
            </button>

            {/* Show selected reminders when collapsed */}
            {!isRemindersSectionExpanded && formData.reminder_days && formData.reminder_days.length > 0 && (
              <div className="px-4 pb-3 border-t border-slate-200 pt-3">
                <div className="flex flex-wrap gap-1.5">
                  {formData.reminder_days.map((mins) => {
                    const display = mins >= 60 ? `${mins / 60}h before` : `${mins}min before`;
                    return (
                      <span
                        key={mins}
                        className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700"
                      >
                        <Bell className="h-3 w-3" />
                        {display}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Collapsible Content */}
            {isRemindersSectionExpanded && (
              <div className="space-y-4 px-4 pb-4 border-t border-slate-200 pt-4">
                {!formData.due_time ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <strong>Time Required:</strong> Set a time above to enable time-based reminders (e.g., "15 minutes before"). Without a time, only daily digest emails will include this task.
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">
                    Choose when you'd like to be notified before the task is due. Daily digest emails will also remind you of upcoming tasks.
                  </p>
                )}

                <div className="space-y-2">
                  {reminderOptions.map((option) => {
                    const isSelected = formData.reminder_days?.includes(
                      option.value,
                    );
                    return (
                      <label
                        key={option.value}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleReminderToggle(option.value)}
                          className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:ring-offset-0"
                        />
                        <span className="flex-1 text-sm font-medium text-slate-700">
                          {option.label}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="h-4 w-4 text-orange-600" />
                        )}
                      </label>
                    );
                  })}
                </div>

                {formData.reminder_days && formData.reminder_days.length > 0 && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div>
                      <strong>{formData.reminder_days.length} Reminder{formData.reminder_days.length > 1 ? 's' : ''} Set:</strong>{" "}
                      {formData.reminder_days.map((mins, idx) => {
                        const display = mins >= 60 ? `${mins / 60} hour${mins > 60 ? 's' : ''}` : `${mins} min`;
                        return idx === formData.reminder_days!.length - 1 ? display : `${display}, `;
                      })}
                    </div>
                  </div>
                )}
                {(!formData.reminder_days || formData.reminder_days.length === 0) && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div>
                      <strong>No Reminders:</strong> You'll only see this task in your daily digest email and task list
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions - Enhanced */}
        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            {!isEditing && (
              <button
                type="button"
                onClick={() => setShowSaveTemplateDialog(true)}
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                disabled={isSaving || !formData.title || !formData.type}
              >
                <Save className="h-4 w-4" />
                Save as Template
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-orange-500"
              disabled={isSaving || !!errors.title || !!errors.due_date}
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {isEditing ? "Update Task" : "Create Task"}
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Save Template Dialog */}
      {showSaveTemplateDialog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              Save as Template
            </h3>
            <p className="mb-4 text-sm text-slate-600">
              Give this task configuration a name to reuse it later.
            </p>
            <input
              type="text"
              placeholder="Template name (e.g., Weekly Price Check)"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveAsTemplate();
                if (e.key === 'Escape') setShowSaveTemplateDialog(false);
              }}
              autoFocus
              className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-20"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowSaveTemplateDialog(false);
                  setTemplateName("");
                }}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAsTemplate}
                disabled={!templateName.trim()}
                className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
