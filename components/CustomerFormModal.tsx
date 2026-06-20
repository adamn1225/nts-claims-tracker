"use client";

import { useState, useRef, useEffect } from "react";
import Modal from "./Modal";
import Tooltip from "./Tooltip";
import IndustryCombobox from "./IndustryCombobox";
import type {
  Customer,
  ShippingFrequency,
  TmsReference,
  TmsReferenceType,
} from "@/lib/types";
import {
  CheckCircle2,
  AlertCircle,
  Info,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Calendar,
} from "lucide-react";

// Customer with relations (for editing)
type CustomerWithRelations = Customer & {
  tms_references?: TmsReference[];
};

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    customer: Partial<Customer> & { tms_references?: TmsReference[] },
  ) => Promise<Customer>;
  customer?: CustomerWithRelations | null;
  brokerId: string | null;
}

const statusOptions: { value: string; label: string }[] = [
  { value: "prospect", label: "Prospect" },
  { value: "active", label: "Active Client" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const frequencyOptions: { value: ShippingFrequency; label: string }[] = [
  { value: "other", label: "One-time/As Needed" },
  { value: "yearly", label: "Once a Year" },
  { value: "quarterly", label: "Few Times a Year" },
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "multiple_per_week", label: "Multiple Times per Week" },
  { value: "bi_weekly", label: "Daily" },
];

// US States and Canadian Provinces/Territories
const stateProvinceOptions: { value: string; label: string; country: string }[] = [
  // US States
  { value: "AL", label: "Alabama", country: "US" },
  { value: "AK", label: "Alaska", country: "US" },
  { value: "AZ", label: "Arizona", country: "US" },
  { value: "AR", label: "Arkansas", country: "US" },
  { value: "CA", label: "California", country: "US" },
  { value: "CO", label: "Colorado", country: "US" },
  { value: "CT", label: "Connecticut", country: "US" },
  { value: "DE", label: "Delaware", country: "US" },
  { value: "FL", label: "Florida", country: "US" },
  { value: "GA", label: "Georgia", country: "US" },
  { value: "HI", label: "Hawaii", country: "US" },
  { value: "ID", label: "Idaho", country: "US" },
  { value: "IL", label: "Illinois", country: "US" },
  { value: "IN", label: "Indiana", country: "US" },
  { value: "IA", label: "Iowa", country: "US" },
  { value: "KS", label: "Kansas", country: "US" },
  { value: "KY", label: "Kentucky", country: "US" },
  { value: "LA", label: "Louisiana", country: "US" },
  { value: "ME", label: "Maine", country: "US" },
  { value: "MD", label: "Maryland", country: "US" },
  { value: "MA", label: "Massachusetts", country: "US" },
  { value: "MI", label: "Michigan", country: "US" },
  { value: "MN", label: "Minnesota", country: "US" },
  { value: "MS", label: "Mississippi", country: "US" },
  { value: "MO", label: "Missouri", country: "US" },
  { value: "MT", label: "Montana", country: "US" },
  { value: "NE", label: "Nebraska", country: "US" },
  { value: "NV", label: "Nevada", country: "US" },
  { value: "NH", label: "New Hampshire", country: "US" },
  { value: "NJ", label: "New Jersey", country: "US" },
  { value: "NM", label: "New Mexico", country: "US" },
  { value: "NY", label: "New York", country: "US" },
  { value: "NC", label: "North Carolina", country: "US" },
  { value: "ND", label: "North Dakota", country: "US" },
  { value: "OH", label: "Ohio", country: "US" },
  { value: "OK", label: "Oklahoma", country: "US" },
  { value: "OR", label: "Oregon", country: "US" },
  { value: "PA", label: "Pennsylvania", country: "US" },
  { value: "RI", label: "Rhode Island", country: "US" },
  { value: "SC", label: "South Carolina", country: "US" },
  { value: "SD", label: "South Dakota", country: "US" },
  { value: "TN", label: "Tennessee", country: "US" },
  { value: "TX", label: "Texas", country: "US" },
  { value: "UT", label: "Utah", country: "US" },
  { value: "VT", label: "Vermont", country: "US" },
  { value: "VA", label: "Virginia", country: "US" },
  { value: "WA", label: "Washington", country: "US" },
  { value: "WV", label: "West Virginia", country: "US" },
  { value: "WI", label: "Wisconsin", country: "US" },
  { value: "WY", label: "Wyoming", country: "US" },
  { value: "DC", label: "District of Columbia", country: "US" },
  // Canadian Provinces and Territories
  { value: "AB", label: "Alberta", country: "CA" },
  { value: "BC", label: "British Columbia", country: "CA" },
  { value: "MB", label: "Manitoba", country: "CA" },
  { value: "NB", label: "New Brunswick", country: "CA" },
  { value: "NL", label: "Newfoundland and Labrador", country: "CA" },
  { value: "NT", label: "Northwest Territories", country: "CA" },
  { value: "NS", label: "Nova Scotia", country: "CA" },
  { value: "NU", label: "Nunavut", country: "CA" },
  { value: "ON", label: "Ontario", country: "CA" },
  { value: "PE", label: "Prince Edward Island", country: "CA" },
  { value: "QC", label: "Quebec", country: "CA" },
  { value: "SK", label: "Saskatchewan", country: "CA" },
  { value: "YT", label: "Yukon", country: "CA" },
];

export default function CustomerFormModal({
  isOpen,
  onClose,
  onSave,
  customer,
  brokerId,
}: CustomerFormModalProps) {
  const isEditing = !!customer;

  const [formData, setFormData] = useState<Partial<Customer>>({
    broker_id: brokerId,
    business_name: customer?.business_name || "",
    first_name: customer?.first_name || "",
    last_name: customer?.last_name || "",
    job_title: customer?.job_title || "",
    phone: customer?.phone || "",
    email: customer?.email || "",
    first_name2: customer?.first_name2 || "",
    last_name2: customer?.last_name2 || "",
    job_title2: customer?.job_title2 || "",
    phone2: customer?.phone2 || "",
    email2: customer?.email2 || "",
    industry: customer?.industry || "",
    opportunity_type: customer?.opportunity_type || undefined,
    address: customer?.address || "",
    city: customer?.city || "",
    state: customer?.state || "",
    zip: customer?.zip || "",
    status: customer?.status || "inbox",
    shipping_frequency: customer?.shipping_frequency || "monthly",
    is_pinned: customer?.is_pinned || false,
    on_kanban_board: customer?.on_kanban_board !== undefined ? customer.on_kanban_board : true, // Default true for manually added customers
    last_contact_date: customer?.last_contact_date || "",
    next_follow_up_date: customer?.next_follow_up_date || "",
    estimated_value: customer?.estimated_value || undefined,
    notes: customer?.notes || "",
    tms_account_id: customer?.tms_account_id || "",
  });

  const [socialLinks, setSocialLinks] = useState<
    {
      platform: "website" | "linkedin" | "facebook" | "twitter" | "instagram";
      url: string;
    }[]
  >(() => {
    const links: {
      platform: "website" | "linkedin" | "facebook" | "twitter" | "instagram";
      url: string;
    }[] = [];
    if (customer?.website_url)
      links.push({ platform: "website", url: customer.website_url });
    if (customer?.linkedin_url)
      links.push({ platform: "linkedin", url: customer.linkedin_url });
    if (customer?.facebook_url)
      links.push({ platform: "facebook", url: customer.facebook_url });
    if (customer?.twitter_url)
      links.push({ platform: "twitter", url: customer.twitter_url });
    if (customer?.instagram_url)
      links.push({ platform: "instagram", url: customer.instagram_url });
    return links;
  });

  const [tmsReferences, setTmsReferences] = useState<
    Array<Pick<TmsReference, "type" | "external_id" | "label"> & { id?: string }>
  >(
    customer?.tms_references?.length
      ? customer.tms_references.map((ref: TmsReference) => ({
          id: ref.id, // Preserve ID for existing references
          type: ref.type,
          external_id: ref.external_id,
          label: ref.label || "",
        }))
      : [],
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>(
    {},
  );
  const [isSaving, setIsSaving] = useState(false);
  const businessNameInputRef = useRef<HTMLInputElement>(null);
  const [followUpReminders, setFollowUpReminders] = useState<number[]>([15]); // Default 15 min before
  const [emailNotificationsDisabled, setEmailNotificationsDisabled] = useState(false);
  const [isLoadingZip, setIsLoadingZip] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [emailText, setEmailText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [showEmailExtractor, setShowEmailExtractor] = useState(false);

  // Auto-focus first field when modal opens
  useEffect(() => {
    if (isOpen && businessNameInputRef.current) {
      setTimeout(() => {
        businessNameInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Check if email notifications are enabled and if user is admin
  useEffect(() => {
    const checkNotificationSettings = async () => {
      if (!isOpen || !brokerId) return;

      const supabase = (await import("@/lib/supabase/client")).createClient();
      const { data } = await supabase
        .from("user_preferences")
        .select("email_notifications_enabled")
        .eq("broker_id", brokerId)
        .single();

      setEmailNotificationsDisabled(data?.email_notifications_enabled === false);
      
      // Check if user is admin
      const { data: broker } = await supabase
        .from("brokers")
        .select("is_admin")
        .eq("id", brokerId)
        .single();
      
      setIsAdmin(broker?.is_admin === true);
    };

    checkNotificationSettings();
  }, [isOpen, brokerId]);

  // Keyboard shortcuts: Ctrl/Cmd+S to save, Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        const form = businessNameInputRef.current?.closest("form");
        if (form) {
          form.requestSubmit();
        }
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset form data when customer prop changes
  useEffect(() => {
    setFormData({
      broker_id: brokerId,
      business_name: customer?.business_name || "",
      contact_name: customer?.contact_name || "",
      first_name: customer?.first_name || "",
      last_name: customer?.last_name || "",
      job_title: customer?.job_title || "",
      phone: customer?.phone || "",
      email: customer?.email || "",
      first_name2: customer?.first_name2 || "",
      last_name2: customer?.last_name2 || "",
      job_title2: customer?.job_title2 || "",
      phone2: customer?.phone2 || "",
      email2: customer?.email2 || "",
      industry: customer?.industry || "",
      opportunity_type: customer?.opportunity_type || undefined,
      city: customer?.city || "",
      state: customer?.state || "",
      status: customer?.status || "inbox",
      shipping_frequency: customer?.shipping_frequency || "monthly",
      is_pinned: customer?.is_pinned || false,
      on_kanban_board: customer?.on_kanban_board !== undefined ? customer.on_kanban_board : true, // Default true for manually added customers
      last_contact_date: customer?.last_contact_date ? customer.last_contact_date.split('T')[0] : "",
      next_follow_up_date: customer?.next_follow_up_date ? customer.next_follow_up_date.substring(0, 16) : "",
      estimated_value: customer?.estimated_value || undefined,
      notes: customer?.notes || "",
      tms_account_id: customer?.tms_account_id || "",
    });

    // Reset social links
    const links: {
      platform: "website" | "linkedin" | "facebook" | "twitter" | "instagram";
      url: string;
    }[] = [];
    if (customer?.website_url)
      links.push({ platform: "website", url: customer.website_url });
    if (customer?.linkedin_url)
      links.push({ platform: "linkedin", url: customer.linkedin_url });
    if (customer?.facebook_url)
      links.push({ platform: "facebook", url: customer.facebook_url });
    if (customer?.twitter_url)
      links.push({ platform: "twitter", url: customer.twitter_url });
    if (customer?.instagram_url)
      links.push({ platform: "instagram", url: customer.instagram_url });
    setSocialLinks(links);

    // Reset TMS references
    setTmsReferences(
      customer?.tms_references?.length
        ? customer.tms_references.map((ref: TmsReference) => ({
            id: ref.id, // Preserve ID for existing references
            type: ref.type,
            external_id: ref.external_id,
            label: ref.label || "",
          }))
        : []
    );

    // Reset errors and touched fields
    setErrors({});
    setTouchedFields({});
  }, [customer, brokerId]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "number" ? (value ? parseFloat(value) : undefined) : value,
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

  const handleBlur = (fieldName: string) => {
    setTouchedFields((prev) => ({ ...prev, [fieldName]: true }));
  };

  // Format phone number as user types
  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      const parts = [match[1], match[2], match[3]].filter(Boolean);
      if (parts.length === 1) return parts[0];
      if (parts.length === 2) return `(${parts[0]}) ${parts[1]}`;
      if (parts.length === 3) return `(${parts[0]}) ${parts[1]}-${parts[2]}`;
    }
    return value;
  };

  // Format currency as user types
  const formatCurrency = (value: string) => {
    const cleaned = value.replace(/[^\d]/g, "");
    if (!cleaned) return "";
    const number = parseInt(cleaned, 10);
    return new Intl.NumberFormat("en-US").format(number);
  };

  // Parse currency back to number
  const parseCurrency = (value: string): number | undefined => {
    const cleaned = value.replace(/[^\d]/g, "");
    return cleaned ? parseInt(cleaned, 10) : undefined;
  };

  // Helper to determine if a field is valid
  const isFieldValid = (fieldName: string): boolean | null => {
    if (!touchedFields[fieldName]) return null;
    if (errors[fieldName]) return false;

    if (fieldName === "business_name") return !!formData.business_name?.trim();
    if (fieldName === "first_name") return !!formData.first_name?.trim();
    if (fieldName === "last_name") return !!formData.last_name?.trim();
    if (fieldName === "email" && formData.email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
    }
    if (fieldName === "phone" && formData.phone) {
      return /^[\d\s\-\(\)\.+]+$/.test(formData.phone.replace(/\s/g, ""));
    }

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

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.business_name?.trim()) {
      newErrors.business_name = "Business name is required";
    }

    // First name is optional now

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (
      formData.phone &&
      !/^[\d\s\-\(\)\.+]+$/.test(formData.phone.replace(/\s/g, ""))
    ) {
      newErrors.phone = "Invalid phone format";
    }

    tmsReferences.forEach((ref, index: number) => {
      if (!ref.external_id.trim()) {
        newErrors[`tms_reference_${index}`] = "Enter an ID";
      } else if (!/^\d+$/.test(ref.external_id.trim())) {
        newErrors[`tms_reference_${index}`] = "Numbers only";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddReference = () => {
    setTmsReferences((prev) => [
      ...prev,
      { type: "order", external_id: "", label: "" },
    ]);
  };

  const handleReferenceChange = (
    index: number,
    field: "type" | "external_id" | "label",
    value: string,
  ) => {
    setTmsReferences((prev) =>
      prev.map((ref, i) => (i === index ? { ...ref, [field]: value } : ref)),
    );

    const key = `tms_reference_${index}`;
    if (errors[key]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const handleRemoveReference = (index: number) => {
    setTmsReferences((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddSocialLink = () => {
    setSocialLinks((prev) => [...prev, { platform: "website", url: "" }]);
  };

  const handleSocialLinkChange = (
    index: number,
    field: "platform" | "url",
    value: string,
  ) => {
    setSocialLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)),
    );
  };

  const handleRemoveSocialLink = (index: number) => {
    setSocialLinks((prev) => prev.filter((_, i) => i !== index));
  };

  // Fetch city and state from ZIP code using Zippopotamus API
  const handleZipChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const zip = e.target.value.trim();
    handleChange(e);

    // Only attempt lookup for valid ZIP formats
    if (zip.length >= 5) {
      setIsLoadingZip(true);
      try {
        // Detect if it's a Canadian postal code (format: A1A 1A1 or A1A1A1)
        const isCanadian = /^[A-Za-z]\d[A-Za-z]/.test(zip);
        const country = isCanadian ? 'ca' : 'us';
        const cleanZip = isCanadian ? zip.replace(/\s/g, '').toUpperCase() : zip.substring(0, 5);

        const response = await fetch(`https://api.zippopotam.us/${country}/${cleanZip}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.places && data.places.length > 0) {
            const place = data.places[0];
            setFormData((prev) => ({
              ...prev,
              city: place['place name'] || prev.city,
              state: place['state abbreviation'] || prev.state,
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching location from ZIP:', error);
      } finally {
        setIsLoadingZip(false);
      }
    }
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
      
      // Validate next_follow_up_date
      if (sanitizedFormData.next_follow_up_date) {
        const followUpDate = new Date(sanitizedFormData.next_follow_up_date);
        if (isNaN(followUpDate.getTime())) {
          // Invalid date - set to null instead of saving invalid value
          sanitizedFormData.next_follow_up_date = undefined;
        }
      } else if (sanitizedFormData.next_follow_up_date === "") {
        // Empty string - convert to null
        sanitizedFormData.next_follow_up_date = undefined;
      }
      
      // Validate last_contact_date
      if (sanitizedFormData.last_contact_date) {
        const contactDate = new Date(sanitizedFormData.last_contact_date);
        if (isNaN(contactDate.getTime())) {
          sanitizedFormData.last_contact_date = undefined;
        }
      } else if (sanitizedFormData.last_contact_date === "") {
        sanitizedFormData.last_contact_date = undefined;
      }

      const cleanedReferences = tmsReferences
        .filter((ref) => ref.external_id.trim())
        .map((ref) => ({
          ...ref,
          external_id: ref.external_id.trim(),
        }));

      // Convert social links array to individual URL fields
      const socialUrls: Partial<Customer> = {
        website_url:
          socialLinks.find((l: { platform: string; url: string }) => l.platform === "website")?.url || "",
        linkedin_url:
          socialLinks.find((l: { platform: string; url: string }) => l.platform === "linkedin")?.url || "",
        facebook_url:
          socialLinks.find((l: { platform: string; url: string }) => l.platform === "facebook")?.url || "",
        twitter_url:
          socialLinks.find((l: { platform: string; url: string }) => l.platform === "twitter")?.url || "",
        instagram_url:
          socialLinks.find((l: { platform: string; url: string }) => l.platform === "instagram")?.url || "",
      };

      // Auto-set import_source to "manual_entry" if not set (for manually created customers)
      if (!sanitizedFormData.import_source && !isEditing) {
        sanitizedFormData.import_source = "manual_entry";
      }

      // Generate contact_name from first_name + last_name for backward compatibility
      const contactName = [sanitizedFormData.first_name, sanitizedFormData.last_name]
        .filter(Boolean)
        .join(' ') || sanitizedFormData.business_name || '';

      const savedCustomer = await onSave({
        ...sanitizedFormData,
        contact_name: contactName,
        ...socialUrls,
        // Note: tms_references is a separate table, not a customer column
      });

      // Create follow-up task if next_follow_up_date is set
      if (formData.next_follow_up_date && brokerId && savedCustomer?.id) {
        try {
          const supabase = (await import("@/lib/supabase/client")).createClient();
          const { data: newTask, error: taskError } = await supabase.from("tasks").insert({
            broker_id: brokerId,
            customer_id: savedCustomer.id,
            title: `Follow-Up: ${formData.business_name}`,
            description: `Scheduled follow-up with ${[formData.first_name, formData.last_name].filter(Boolean).join(' ') || formData.business_name}`,
            type: "follow_up",
            priority: "medium",
            due_date: formData.next_follow_up_date,
            reminder_days: followUpReminders,
            status: "pending",
          }).select().single();
          
          if (taskError) throw taskError;
          
          // Generate notification records for reminders
          if (newTask?.id) {
            await fetch("/api/tasks/generate-notifications", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ taskId: newTask.id }),
            });
          }
        } catch (taskError) {
          console.error("Error creating follow-up task:", taskError);
          // Don't fail the whole operation if task creation fails
        }
      }
      onClose();
      // Reset form
      setFormData({
        broker_id: brokerId,
        business_name: "",
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        industry: "",
        address: "",
        city: "",
        state: "",
        zip: "",
        linkedin_url: "",
        facebook_url: "",
        twitter_url: "",
        instagram_url: "",
        website_url: "",
        status: "inbox",
        shipping_frequency: "monthly",
        is_pinned: false,
        last_contact_date: "",
        next_follow_up_date: "",
        estimated_value: undefined,
        notes: "",
        tms_account_id: "",
      });
      setTmsReferences([]);
      setSocialLinks([]);
    } catch (error) {
      console.error("Error saving customer:", error);
      setErrors({
        submit:
          error instanceof Error ? error.message : "Failed to save customer",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Email extraction handler
  const handleExtractFromEmail = async () => {
    if (!emailText.trim()) return;
    
    setIsExtracting(true);
    try {
      const response = await fetch("/api/ai/extract-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email_text: emailText,
          enrich_data: true 
        }),
      });
      
      if (!response.ok) throw new Error("Extraction failed");
      
      const data = await response.json();
      const extracted = data.extracted_fields;
      
      // Auto-fill form with extracted data
      setFormData(prev => ({
        ...prev,
        business_name: extracted.business_name || prev.business_name,
        contact_name: extracted.contact_name || prev.contact_name,
        first_name: extracted.first_name || prev.first_name,
        last_name: extracted.last_name || prev.last_name,
        email: extracted.email || prev.email,
        phone: extracted.phone || prev.phone,
        city: extracted.city || prev.city,
        state: extracted.state || prev.state,
        industry: extracted.industry || prev.industry,
        notes: extracted.notes || prev.notes,
      }));
      
      setEmailText("");
      setShowEmailExtractor(false);
    } catch (error) {
      console.error("Email extraction error:", error);
      setErrors({ submit: "Failed to extract customer data from email" });
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Customer" : "New Customer"}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="p-4 sm:p-6">
        {/* Email Notifications Disabled Warning */}
        {emailNotificationsDisabled && formData.next_follow_up_date && followUpReminders.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">Email Notifications Disabled</p>
                <p className="mt-1 text-xs">
                  You have email notifications turned off in your settings. You won't receive reminder emails for the follow-up task even though reminders are configured.
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

        {/* Error Banner */}
        {errors.submit && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errors.submit}
          </div>
        )}

        {/* Admin-Only: Email Extraction Tool */}
        {isAdmin && !isEditing && (
          <div className="mb-4">
            {!showEmailExtractor ? (
            <>
                <button
                  type="button"
                  onClick={() => setShowEmailExtractor(true)}
                  className="text-xs text-slate-500 hover:text-orange-600 underline transition-colors"
                >
                  Extract from email
                </button>
                <p className="mt-1 text-xs text-slate-500">
                  Paste the content of an email from a potential customer, and we'll try to extract relevant information to auto-fill the form.
                </p>
            </>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700">Paste email content:</label>
                  <button
                    type="button"
                    onClick={() => setShowEmailExtractor(false)}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
                <textarea
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                  placeholder="Paste email content here..."
                  className="w-full rounded border border-slate-200 p-2 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  rows={4}
                />
                <button
                  type="button"
                  onClick={handleExtractFromEmail}
                  disabled={isExtracting || !emailText.trim()}
                  className="w-full rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isExtracting ? "Extracting..." : "Extract & Auto-Fill"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Form Grid */}
        <div className="space-y-5">
          {/* Business Information */}
          <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-orange-500" />
              Business Information
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Business Name */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="business_name"
                  className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700"
                >
                  <span>
                    Business Name <span className="text-red-500">*</span>
                  </span>
                  <Tooltip content="Enter the company name exactly as it appears on their business card or website. This is how they'll appear in your customer list." />
                </label>
                <div className="relative">
                  <input
                    ref={businessNameInputRef}
                    type="text"
                    id="business_name"
                    name="business_name"
                    value={formData.business_name || ""}
                    onChange={handleChange}
                    onBlur={() => handleBlur("business_name")}
                    className={`h-11 w-full rounded-lg border bg-white px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 transition-colors ${
                      errors.business_name
                        ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                        : "border-slate-200 focus:border-orange-500 focus:ring-orange-500/20"
                    }`}
                    placeholder="ABC Inc."
                    autoComplete="organization"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {getValidationIcon("business_name")}
                  </div>
                </div>
                {errors.business_name ? (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.business_name}
                  </p>
                ) : touchedFields.business_name &&
                  formData.business_name?.trim() ? (
                  <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Looks good!
                  </p>
                ) : null}
              </div>

              {/* Industry */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="industry"
                  className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700"
                >
                  <span>Industry</span>
                  <Tooltip content="Categorize this customer by their industry type. This helps you organize and filter customers for reporting and analysis." />
                </label>
                <IndustryCombobox
                  id="industry"
                  name="industry"
                  value={formData.industry || ""}
                  onChange={(val) =>
                    handleChange({
                      target: { name: "industry", value: val },
                    } as React.ChangeEvent<HTMLSelectElement>)
                  }
                />
                <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Search by name or type a custom industry
                </p>
              </div>

              {/* Opportunity Type */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="opportunity_type"
                  className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700"
                >
                  <span>Opportunity Type</span>
                  <Tooltip content="How did this customer or lead come to you? Tracking the source helps identify your most effective channels." />
                </label>
                <select
                  id="opportunity_type"
                  name="opportunity_type"
                  value={formData.opportunity_type || ""}
                  onChange={handleChange}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="">Select source</option>
                  <option value="new_call_in">New Call in</option>
                  <option value="new_lead">New Lead</option>
                  <option value="cold_call">Cold Call</option>
                  <option value="referral">Referral</option>
                  <option value="origin_destination_contact">
                    Origin/Destination Contact
                  </option>
                  <option value="existing_customer">Existing Customer</option>
                  <option value="other">Other</option>
                </select>
                <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Track the source of your opportunities
                </p>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4 rounded-lg border border-slate-200 bg-linear-to-br from-orange-50 to-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <User className="h-4 w-4 text-orange-500" />
              Contact Information
            </h3>

            {/* Existing Contact Name (Read-only display) */}
            {customer?.contact_name && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <div className="mb-1 text-xs font-medium text-blue-700">Stored Contact Name</div>
                <div className="text-sm text-blue-900">{customer.contact_name}</div>
                <div className="mt-1 text-xs text-blue-600">This is the original name as imported. Edit First/Last Name below to update.</div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {/* First Name */}
              <div>
                <label
                  htmlFor="first_name"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  First Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    value={formData.first_name || ""}
                    onChange={handleChange}
                    onBlur={() => handleBlur("first_name")}
                    className={`h-11 w-full rounded-lg border bg-white px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 transition-colors ${
                      errors.first_name
                        ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                        : "border-slate-200 focus:border-orange-500 focus:ring-orange-500/20"
                    }`}
                    placeholder="John"
                    autoComplete="given-name"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {getValidationIcon("first_name")}
                  </div>
                </div>
                {errors.first_name ? (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.first_name}
                  </p>
                ) : touchedFields.first_name &&
                  formData.first_name?.trim() ? (
                  <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Looks good!
                  </p>
                ) : null}
              </div>

              {/* Last Name */}
              <div>
                <label
                  htmlFor="last_name"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Last Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={formData.last_name || ""}
                    onChange={handleChange}
                    onBlur={() => handleBlur("last_name")}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:border-orange-500 focus:ring-orange-500/20 transition-colors"
                    placeholder="Smith"
                    autoComplete="family-name"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {getValidationIcon("last_name")}
                  </div>
                </div>
                {touchedFields.last_name && formData.last_name?.trim() ? (
                  <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Looks good!
                  </p>
                ) : null}
              </div>

              {/* Job Title */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="job_title"
                  className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700"
                >
                  <span>
                    Job Title{" "}
                    <span className="text-slate-400 font-normal">
                      (Optional)
                    </span>
                  </span>
                  <Tooltip content="Contact's position or role (e.g., Fleet Manager, CEO, Logistics Director). Helps identify decision-makers and personalize communication." />
                </label>
                <input
                  type="text"
                  id="job_title"
                  name="job_title"
                  value={formData.job_title || ""}
                  onChange={handleChange}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-orange-500 focus:ring-orange-500/20 transition-colors"
                  placeholder="e.g., Fleet Manager, CEO, Logistics Director"
                  autoComplete="organization-title"
                />
                <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Helps identify decision-makers and personalize outreach
                </p>
              </div>

              {/* Phone 1 (Cell/Mobile) */}
              <div>
                <label
                  htmlFor="phone"
                  className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700"
                >
                  <span>
                    Cell/Mobile Phone{" "}
                    <span className="text-slate-400 font-normal">
                      (Optional)
                    </span>
                  </span>
                  <Tooltip content="Primary contact phone number (usually cell/mobile). Click the phone icon on customer cards to call them directly." />
                </label>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="relative sm:col-span-2">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone || ""}
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        setFormData((prev) => ({ ...prev, phone: formatted }));
                        setTouchedFields((prev) => ({ ...prev, phone: true }));
                        if (errors.phone) {
                          setErrors((prev) => {
                            const newErrors = { ...prev };
                            delete newErrors.phone;
                            return newErrors;
                          });
                        }
                      }}
                      onBlur={() => handleBlur("phone")}
                      className={`h-11 w-full rounded-lg border bg-white pl-10 pr-10 py-2 text-sm focus:outline-none focus:ring-2 transition-colors ${
                        errors.phone
                          ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                          : "border-slate-200 focus:border-orange-500 focus:ring-orange-500/20"
                      }`}
                      placeholder="(555) 123-4567"
                      autoComplete="tel"
                      maxLength={14}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {getValidationIcon("phone")}
                    </div>
                  </div>
                  <div>
                    <input
                      type="text"
                      id="phone_ext"
                      name="phone_ext"
                      value={formData.phone_ext || ""}
                      onChange={handleChange}
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-orange-500 focus:ring-orange-500/20"
                      placeholder="Ext."
                      maxLength={10}
                    />
                  </div>
                </div>
                {errors.phone && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.phone}
                  </p>
                )}
              </div>

              {/* Phone 2 (Direct Office Line) */}
              <div>
                <label
                  htmlFor="phone_2"
                  className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700"
                >
                  <span>
                    Direct Office Line{" "}
                    <span className="text-slate-400 font-normal">
                      (Optional)
                    </span>
                  </span>
                  <Tooltip content="Direct office line or desk phone number." />
                </label>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="relative sm:col-span-2">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="tel"
                      id="phone_2"
                      name="phone_2"
                      value={formData.phone_2 || ""}
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        setFormData((prev) => ({ ...prev, phone_2: formatted }));
                      }}
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-orange-500 focus:ring-orange-500/20"
                      placeholder="(555) 123-4567"
                      maxLength={14}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      id="phone_2_ext"
                      name="phone_2_ext"
                      value={formData.phone_2_ext || ""}
                      onChange={handleChange}
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-orange-500 focus:ring-orange-500/20"
                      placeholder="Ext."
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>

              {/* Phone 3 (Main/HQ Number) */}
              <div>
                <label
                  htmlFor="phone_3"
                  className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700"
                >
                  <span>
                    Main/HQ Phone{" "}
                    <span className="text-slate-400 font-normal">
                      (Optional)
                    </span>
                  </span>
                  <Tooltip content="Main company or headquarters phone number." />
                </label>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="relative sm:col-span-2">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="tel"
                      id="phone_3"
                      name="phone_3"
                      value={formData.phone_3 || ""}
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        setFormData((prev) => ({ ...prev, phone_3: formatted }));
                      }}
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-orange-500 focus:ring-orange-500/20"
                      placeholder="(555) 123-4567"
                      maxLength={14}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      id="phone_3_ext"
                      name="phone_3_ext"
                      value={formData.phone_3_ext || ""}
                      onChange={handleChange}
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-orange-500 focus:ring-orange-500/20"
                      placeholder="Ext."
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700"
                >
                  <span>
                    Email{" "}
                    <span className="text-slate-400 font-normal">
                      (Optional)
                    </span>
                  </span>
                  <Tooltip content="Customer's email address. Click the email icon on their card to send them an email. Must be valid format (name@company.com)." />
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email || ""}
                    onChange={handleChange}
                    onBlur={() => handleBlur("email")}
                    className={`h-11 w-full rounded-lg border bg-white pl-10 pr-10 py-2 text-sm focus:outline-none focus:ring-2 transition-colors ${
                      errors.email
                        ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                        : "border-slate-200 focus:border-orange-500 focus:ring-orange-500/20"
                    }`}
                    placeholder="john@detroitsteel.com"
                    autoComplete="email"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {getValidationIcon("email")}
                  </div>
                </div>
                {errors.email && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.email}
                  </p>
                )}
              </div>
            </div>

            {/* Secondary Contact (Optional) */}
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex items-center gap-2">
                <User className="h-4 w-4 text-slate-600" />
                <h4 className="text-sm font-semibold text-slate-700">
                  Secondary Contact <span className="font-normal text-slate-500">(Optional)</span>
                </h4>
              </div>
              <p className="mb-4 text-xs text-slate-600">
                Add a second contact person for this company (e.g., backup contact, decision maker, etc.)
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* First Name 2 */}
                <div>
                  <label htmlFor="first_name2" className="mb-1.5 block text-sm font-medium text-slate-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="first_name2"
                    name="first_name2"
                    value={formData.first_name2 || ""}
                    onChange={handleChange}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-orange-500 focus:ring-orange-500/20 transition-colors"
                    placeholder="Sarah"
                  />
                </div>

                {/* Last Name 2 */}
                <div>
                  <label htmlFor="last_name2" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="last_name2"
                    name="last_name2"
                    value={formData.last_name2 || ""}
                    onChange={handleChange}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-orange-500 focus:ring-orange-500/20 transition-colors"
                    placeholder="Johnson"
                  />
                </div>

                {/* Job Title 2 */}
                <div className="sm:col-span-2">
                  <label htmlFor="job_title2" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Job Title
                  </label>
                  <input
                    type="text"
                    id="job_title2"
                    name="job_title2"
                    value={formData.job_title2 || ""}
                    onChange={handleChange}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-orange-500 focus:ring-orange-500/20 transition-colors"
                    placeholder="e.g., CEO, Operations Manager"
                  />
                </div>

                {/* Phone 2 */}
                <div>
                  <label htmlFor="phone2" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Phone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="tel"
                      id="phone2"
                      name="phone2"
                      value={formData.phone2 || ""}
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        setFormData((prev) => ({ ...prev, phone2: formatted }));
                      }}
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-orange-500 focus:ring-orange-500/20 transition-colors"
                      placeholder="(555) 123-4567"
                      maxLength={14}
                    />
                  </div>
                </div>

                {/* Email 2 */}
                <div>
                  <label htmlFor="email2" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      id="email2"
                      name="email2"
                      value={formData.email2 || ""}
                      onChange={handleChange}
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-orange-500 focus:ring-orange-500/20 transition-colors"
                      placeholder="sarah@company.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Social Media & Website */}
            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-slate-700">
                    Social Media & Website
                  </h4>
                  <p className="text-xs text-slate-500">
                    Add links to social profiles and website
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddSocialLink}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-orange-500 hover:text-orange-600"
                >
                  + Add URL
                </button>
              </div>

              {socialLinks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  No social media links added yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {socialLinks.map((link, index) => (
                    <div
                      key={index}
                      className="grid gap-3 rounded-lg border border-slate-200 p-3 shadow-sm sm:grid-cols-12"
                    >
                      <div className="sm:col-span-4">
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          Platform
                        </label>
                        <select
                          value={link.platform}
                          onChange={(e) =>
                            handleSocialLinkChange(
                              index,
                              "platform",
                              e.target.value,
                            )
                          }
                          className="h-10 w-full rounded-lg border border-slate-200 px-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        >
                          <option value="website">Website</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="facebook">Facebook</option>
                          <option value="twitter">Twitter / X</option>
                          <option value="instagram">Instagram</option>
                        </select>
                      </div>

                      <div className="sm:col-span-7">
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                          URL
                        </label>
                        <input
                          type="url"
                          value={link.url}
                          onChange={(e) =>
                            handleSocialLinkChange(index, "url", e.target.value)
                          }
                          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                          placeholder={
                            link.platform === "website"
                              ? "https://www.example.com"
                              : link.platform === "linkedin"
                                ? "https://www.linkedin.com/company/..."
                                : link.platform === "facebook"
                                  ? "https://www.facebook.com/..."
                                  : link.platform === "twitter"
                                    ? "https://twitter.com/..."
                                    : "https://www.instagram.com/..."
                          }
                        />
                      </div>

                      <div className="flex items-end justify-end sm:col-span-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveSocialLink(index)}
                          className="text-sm font-medium text-slate-500 transition hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* TMS Links */}
          <div className="space-y-4 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-700">CRM Links</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Orders & quotes (optional)
                  </p>
                  <p className="text-xs text-slate-500">
                    Add one or more order/quote IDs to generate quick links.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddReference}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-orange-500 hover:text-orange-600"
                >
                  + Add link
                </button>
              </div>

              {tmsReferences.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  No order or quote links added yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {tmsReferences.map((ref, index) => (
                    <div
                      key={`${ref.type}-${index}`}
                      className="rounded-lg border border-slate-200 p-3 shadow-sm"
                    >
                      <div className="grid gap-3 sm:grid-cols-10">
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Type
                          </label>
                          <select
                            value={ref.type}
                            onChange={(e) =>
                              handleReferenceChange(
                                index,
                                "type",
                                e.target.value as TmsReferenceType,
                              )
                            }
                            className="h-10 w-full rounded-lg border border-slate-200 px-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                          >
                            <option value="order">Order</option>
                            <option value="quote">Quote</option>
                          </select>
                        </div>

                        <div className="sm:col-span-3">
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            ID
                          </label>
                          <input
                            type="text"
                            value={ref.external_id}
                            onChange={(e) =>
                              handleReferenceChange(
                                index,
                                "external_id",
                                e.target.value,
                              )
                            }
                            className={`h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 ${
                              errors[`tms_reference_${index}`]
                                ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                                : "border-slate-200 focus:border-orange-500 focus:ring-orange-500/20"
                            }`}
                            placeholder={
                              ref.type === "order" ? "986875" : "987196"
                            }
                            inputMode="numeric"
                          />
                          {errors[`tms_reference_${index}`] && (
                            <p className="mt-1 text-xs text-red-600">
                              {errors[`tms_reference_${index}`]}
                            </p>
                          )}
                        </div>

                        <div className="sm:col-span-4">
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Label (optional)
                          </label>
                          <input
                            type="text"
                            value={ref.label || ""}
                            onChange={(e) =>
                              handleReferenceChange(
                                index,
                                "label",
                                e.target.value,
                              )
                            }
                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                            placeholder="e.g. Q1 Contract"
                          />
                        </div>

                        <div className="flex items-end justify-end sm:col-span-1">
                          <button
                            type="button"
                            onClick={() => handleRemoveReference(index)}
                            className="text-sm font-medium text-slate-500 transition hover:text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Account Number */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="tms_account_id"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  CRM Customer Account # (Optional)
                </label>
                <input
                  type="text"
                  id="tms_account_id"
                  name="tms_account_id"
                  value={formData.tms_account_id as string}
                  onChange={handleChange}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  placeholder="489244"
                  inputMode="numeric"
                />
                <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  To find this number, navigate to
                  https://crm.ntsconnect.com/AccountType/ManageAccount/1 and
                  search for the customer. The account number is displayed in
                  the URL and on the account details page.
                </p>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-orange-500" />
              Location
            </h3>

            {/* Address */}
            <div>
              <label
                htmlFor="address"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Street Address
              </label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address || ""}
                onChange={handleChange}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                placeholder="123 Main Street"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {/* ZIP Code - First for auto-lookup */}
              <div>
                <label
                  htmlFor="zip"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  ZIP / Postal Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="zip"
                    name="zip"
                    value={formData.zip || ""}
                    onChange={handleZipChange}
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    placeholder="48226 or K1A 0B1"
                    maxLength={10}
                  />
                  {isLoadingZip && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Auto-fills city & state
                </p>
              </div>

              {/* City */}
              <div>
                <label
                  htmlFor="city"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  City
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city || ""}
                  onChange={handleChange}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  placeholder="Detroit"
                />
              </div>

              {/* State/Province Dropdown */}
              <div>
                <label
                  htmlFor="state"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  State / Province
                </label>
                <select
                  id="state"
                  name="state"
                  value={formData.state || ""}
                  onChange={handleChange}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="">Select...</option>
                  <optgroup label="United States">
                    {stateProvinceOptions
                      .filter((opt) => opt.country === "US")
                      .map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.value} - {opt.label}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Canada">
                    {stateProvinceOptions
                      .filter((opt) => opt.country === "CA")
                      .map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.value} - {opt.label}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>
            </div>
          </div>

          {/* Secondary Location (Regional Office) */}
          <div className="space-y-4 border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-700">
                Regional Office Location <span className="font-normal text-slate-500">(Optional)</span>
              </h3>
            </div>
            <p className="text-xs text-slate-600">
              If speaking with a regional manager or contact at a different office, enter their location here while keeping HQ address above.
            </p>

            {/* Secondary Address */}
            <div>
              <label
                htmlFor="address_2"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Street Address
              </label>
              <input
                type="text"
                id="address_2"
                name="address_2"
                value={formData.address_2 || ""}
                onChange={handleChange}
                className="h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                placeholder="456 Regional Blvd"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {/* ZIP Code 2 */}
              <div>
                <label
                  htmlFor="zip_2"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  ZIP / Postal Code
                </label>
                <input
                  type="text"
                  id="zip_2"
                  name="zip_2"
                  value={formData.zip_2 || ""}
                  onChange={handleChange}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  placeholder="48226"
                  maxLength={10}
                />
              </div>

              {/* City 2 */}
              <div>
                <label
                  htmlFor="city_2"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  City
                </label>
                <input
                  type="text"
                  id="city_2"
                  name="city_2"
                  value={formData.city_2 || ""}
                  onChange={handleChange}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  placeholder="Chicago"
                />
              </div>

              {/* State/Province 2 */}
              <div>
                <label
                  htmlFor="state_2"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  State / Province
                </label>
                <select
                  id="state_2"
                  name="state_2"
                  value={formData.state_2 || ""}
                  onChange={handleChange}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="">Select...</option>
                  <optgroup label="United States">
                    {stateProvinceOptions
                      .filter((opt) => opt.country === "US")
                      .map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.value} - {opt.label}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Canada">
                    {stateProvinceOptions
                      .filter((opt) => opt.country === "CA")
                      .map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.value} - {opt.label}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>
            </div>
          </div>

          {/* Classification */}
          <div className="space-y-4 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-700">
              Classification
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Status */}
              <div>
                <label
                  htmlFor="status"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status || "prospect"}
                  onChange={handleChange}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shipping Frequency */}
              <div>
                <label
                  htmlFor="shipping_frequency"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Shipping Frequency
                </label>
                <select
                  id="shipping_frequency"
                  name="shipping_frequency"
                  value={formData.shipping_frequency || "monthly"}
                  onChange={handleChange}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  {frequencyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tracking */}
          <div className="space-y-4 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-700">Tracking</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Last Contact Date */}
              <div>
                <label
                  htmlFor="last_contact_date"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Last Contact Date
                </label>
                <input
                  type="date"
                  id="last_contact_date"
                  name="last_contact_date"
                  value={formData.last_contact_date || ""}
                  onChange={handleChange}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              {/* Next Follow-Up Date */}
              <div className="sm:col-span-2">
                <label
                  htmlFor="next_follow_up_date"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Next Follow-Up Date & Time
                </label>
                <input
                  type="datetime-local"
                  id="next_follow_up_date"
                  name="next_follow_up_date"
                  value={formData.next_follow_up_date || ""}
                  onChange={handleChange}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
                <p className="mt-1.5 text-xs text-slate-500">A follow-up task will be created automatically. Reminders will be sent before this exact time.</p>
                
                {/* Reminder Settings - Show when follow-up date is set */}
                {formData.next_follow_up_date && (
                  <div className="mt-3 space-y-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
                    <p className="text-xs font-semibold text-orange-900">Set Follow-Up Reminders:</p>
                    <div className="space-y-1.5">
                      {[
                        { value: 15, label: "15 minutes before" },
                        { value: 30, label: "30 minutes before" },
                        { value: 60, label: "1 hour before" },
                        { value: 120, label: "2 hours before" },
                      ].map((option) => (
                        <label
                          key={option.value}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={followUpReminders.includes(option.value)}
                            onChange={() => {
                              setFollowUpReminders((prev) =>
                                prev.includes(option.value)
                                  ? prev.filter((v) => v !== option.value)
                                  : [...prev, option.value].sort((a, b) => a - b)
                              );
                            }}
                            className="h-3.5 w-3.5 rounded border-orange-300 text-orange-600 focus:ring-2 focus:ring-orange-500/20"
                          />
                          <span className="text-xs text-orange-900">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Estimated Value */}
              <div>
                <label
                  htmlFor="estimated_value"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Estimated Annual Shipping Revenue
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    $
                  </span>
                  <input
                    type="text"
                    id="estimated_value"
                    name="estimated_value"
                    value={
                      formData.estimated_value
                        ? formatCurrency(formData.estimated_value.toString())
                        : ""
                    }
                    onChange={(e) => {
                      const numericValue = parseCurrency(e.target.value);
                      setFormData((prev) => ({
                        ...prev,
                        estimated_value: numericValue,
                      }));
                    }}
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 py-2 pl-7 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    placeholder="50,000"
                    inputMode="numeric"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="border-t border-slate-200 pt-4">
            <label
              htmlFor="notes"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes || ""}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              placeholder="Additional notes about this customer..."
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex h-11 items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving
              ? "Saving..."
              : isEditing
                ? "Update Customer"
                : "Add Customer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
