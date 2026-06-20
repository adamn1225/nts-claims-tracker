"use client";

import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useCustomerSearch } from "@/contexts/CustomerSearchContext";
import { useClickToCall } from "@/contexts/ClickToCallContext";
import { getCustomerDisplayName } from "@/lib/customer-utils";
import {
  Phone,
  Mail,
  Calendar,
  MapPin,
  Building2,
  Pin,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
  UserPlus,
  User,
  Kanban,
  Share2,
  Search,
} from "lucide-react";
import { getTimezoneByPhone } from "@/lib/timezone-utils";
import QuickNoteInput from "./QuickNoteInput";
import ShareCustomerModal from "./ShareCustomerModal";
import type { Customer } from "@/lib/types";

// Timezone mappings by US state
const STATE_TIMEZONES: Record<string, "EST" | "CST" | "MST" | "PST"> = {
  // Eastern (EST)
  CT: "EST", DE: "EST", FL: "EST", GA: "EST", ME: "EST", MD: "EST",
  MA: "EST", NH: "EST", NJ: "EST", NY: "EST", NC: "EST", OH: "EST",
  PA: "EST", RI: "EST", SC: "EST", VT: "EST", VA: "EST", WV: "EST",
  DC: "EST", MI: "EST", IN: "EST", KY: "EST",

  // Central (CST)
  AL: "CST", AR: "CST", IL: "CST", IA: "CST", KS: "CST", LA: "CST",
  MN: "CST", MS: "CST", MO: "CST", NE: "CST", ND: "CST", OK: "CST",
  SD: "CST", TN: "CST", TX: "CST", WI: "CST",

  // Mountain (MST)
  AZ: "MST", CO: "MST", ID: "MST", MT: "MST", NM: "MST", UT: "MST", WY: "MST",

  // Pacific (PST)
  CA: "PST", NV: "PST", OR: "PST", WA: "PST", AK: "PST", HI: "PST",
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

interface ListViewProps {
  customers: Customer[];
  onPin: (id: string) => void;
  onEdit: (customer: Customer) => void;
  onViewDetail?: (customer: Customer) => void;
  onQuickAction: (
    action: "call" | "email" | "schedule",
    customer: Customer,
  ) => void;
  canReassign?: boolean;
  onReassign?: (customerId: string, customerName: string, brokerId: string) => void;
  onAddToBoard?: (customerId: string) => void;
  onStatusChange?: (customerId: string, newStatus: string) => void;
}

type SortField =
  | "business_name"
  | "status"
  | "shipping_frequency"
  | "last_contact_date"
  | "next_follow_up_date";
type SortDirection = "asc" | "desc";

export default function ListView({
  customers,
  onPin,
  onEdit,
  onViewDetail,
  onQuickAction,
  canReassign = false,
  onReassign,
  onAddToBoard,
  onStatusChange,
}: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>("business_name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [hoveredNoteCustomerId, setHoveredNoteCustomerId] = useState<string | null>(null);
  const [recentNotes, setRecentNotes] = useState<Record<string, any[]>>({});
  const [availableStatuses, setAvailableStatuses] = useState<Array<{ id: string, name: string, color: string }>>([]);

  // Bulk selection state
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());

  // Broker names for "Assigned to" column
  const [brokerNames, setBrokerNames] = useState<Record<string, string>>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCustomer, setShareCustomer] = useState<Customer | null>(null);
  const [currentBrokerId, setCurrentBrokerId] = useState<string>("");

  // Use context filters
  const { searchQuery, statusFilter, sourceFilter, timezoneFilter, timezoneMode } = useCustomerSearch();
  const { makeCall } = useClickToCall();

  // Fetch recent notes for customers with notes
  useEffect(() => {
    const fetchRecentNotes = async () => {
      const supabase = createClient();
      const customerIds = customers.filter(c => (c.note_count ?? 0) > 0).map(c => c.id);

      if (customerIds.length === 0) return;

      const { data } = await supabase
        .from("contact_log")
        .select("*")
        .in("customer_id", customerIds)
        .eq("type", "note")
        .order("contact_date", { ascending: false });

      if (data) {
        // Group notes by customer_id
        const notesByCustomer: Record<string, any[]> = {};
        data.forEach(note => {
          if (!notesByCustomer[note.customer_id]) {
            notesByCustomer[note.customer_id] = [];
          }
          // Only keep the 3 most recent notes per customer
          if (notesByCustomer[note.customer_id].length < 3) {
            notesByCustomer[note.customer_id].push(note);
          }
        });
        setRecentNotes(notesByCustomer);
      }
    };

    fetchRecentNotes();
  }, [customers]);

  // Fetch available statuses
  useEffect(() => {
    const fetchStatuses = async () => {
      const supabase = createClient();

      // Always include inbox status
      const inboxStatus = { id: "inbox", name: "Inbox", color: "slate" };

      try {
        const { data, error } = await supabase.rpc("get_user_statuses");
        if (data && !error) {
          setAvailableStatuses([inboxStatus, ...data]);
        } else {
          setAvailableStatuses([inboxStatus]);
        }
      } catch (err) {
        console.error("Error fetching statuses:", err);
        setAvailableStatuses([inboxStatus]);
      }
    };

    fetchStatuses();
  }, []);

  // Fetch current broker ID
  useEffect(() => {
    const fetchBrokerId = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: broker } = await supabase
          .from("brokers")
          .select("id")
          .eq("id", user.id)
          .single();
        if (broker) {
          setCurrentBrokerId(broker.id);
        }
      }
    };
    fetchBrokerId();
  }, []);

  // Fetch broker names for "Assigned to" column
  useEffect(() => {
    const fetchBrokerNames = async () => {
      const supabase = createClient();
      const brokerIds = [...new Set(customers.map(c => c.broker_id).filter(Boolean))];

      if (brokerIds.length === 0) return;

      const { data } = await supabase
        .from("brokers")
        .select("id, first_name, last_name")
        .in("id", brokerIds);

      if (data) {
        const names: Record<string, string> = {};
        data.forEach(broker => {
          names[broker.id] = `${broker.first_name} ${broker.last_name || ''}`.trim();
        });
        setBrokerNames(names);
      }
    };

    fetchBrokerNames();
  }, [customers]);

  // ListView-specific pins (separate from kanban pins) - stored in localStorage
  const [listPinnedIds, setListPinnedIds] = useState<Set<string>>(new Set());

  // Load pinned IDs from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("listview-pinned-customers");
    if (stored) {
      try {
        setListPinnedIds(new Set(JSON.parse(stored)));
      } catch (e) {
        console.error("Error loading pinned customers:", e);
      }
    }
  }, []);

  // Save pinned IDs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(
      "listview-pinned-customers",
      JSON.stringify(Array.from(listPinnedIds)),
    );
  }, [listPinnedIds]);

  const toggleListPin = (customerId: string) => {
    setListPinnedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectedCustomerIds.size === paginatedCustomers.length) {
      setSelectedCustomerIds(new Set());
    } else {
      setSelectedCustomerIds(new Set(paginatedCustomers.map(c => c.id)));
    }
  };

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(customerId)) {
        newSet.delete(customerId);
      } else {
        newSet.add(customerId);
      }
      return newSet;
    });
  };

  const handleBulkAddToBoard = async () => {
    if (!onAddToBoard || selectedCustomerIds.size === 0) return;

    // Add all selected customers to board
    const promises = Array.from(selectedCustomerIds).map(id => onAddToBoard(id));
    await Promise.all(promises);

    // Clear selection after adding
    setSelectedCustomerIds(new Set());
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Apply filters using context
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      // Status filter from context (case-insensitive comparison)
      if (statusFilter.length > 0 && !statusFilter.some(f => f.toLowerCase() === customer.status.toLowerCase())) {
        return false;
      }

      // Source filter from context (case-insensitive, trimmed comparison)
      if (sourceFilter.length > 0) {
        if (!customer.import_source) {
          return false;
        }
        const customerSource = customer.import_source.trim().toLowerCase();
        if (!sourceFilter.some(s => s.trim().toLowerCase() === customerSource)) {
          return false;
        }
      }

      // Timezone filter
      if (timezoneFilter && timezoneFilter !== "all") {
        if (timezoneMode === "phone") {
          // Phone area code mode: check all available phone fields
          const phoneFields = [customer.phone, (customer as any).phone_2, (customer as any).phone_3].filter(Boolean);
          const customerTimezone = phoneFields.reduce<string | null>(
            (found, ph) => found ?? getTimezoneByPhone(ph as string),
            null
          );
          if (!customerTimezone || customerTimezone !== timezoneFilter) {
            return false;
          }
        } else {
          // Address mode (default): use state field
          const customerState = customer.state?.trim().toUpperCase();
          if (!customerState) {
            return false;
          }
          const customerTimezone = STATE_TIMEZONES[customerState];
          if (customerTimezone !== timezoneFilter) {
            return false;
          }
        }
      }

      // Search query - search across multiple fields
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const searchableText = [
          customer.customer_id,
          customer.business_name,
          getCustomerDisplayName(customer),
          customer.industry,
          customer.city,
          customer.state,
          customer.email,
          customer.phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [customers, statusFilter, sourceFilter, timezoneFilter, searchQuery]);

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    // First, sort by list pin status - pinned items always go to top
    const aPinned = listPinnedIds.has(a.id);
    const bPinned = listPinnedIds.has(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    // Then sort by selected field
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    // Handle null/undefined values
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    // Convert to string for comparison
    if (typeof aValue === "string") aValue = aValue.toLowerCase();
    if (typeof bValue === "string") bValue = bValue.toLowerCase();

    const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    return sortDirection === "asc" ? comparison : -comparison;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedCustomers.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedCustomers = sortedCustomers.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  // Filter selected customers that are not on kanban board
  const selectedNotOnBoard = Array.from(selectedCustomerIds).filter(id => {
    const customer = customers.find(c => c.id === id);
    return customer && !customer.on_kanban_board;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      prospect: "bg-blue-100 text-blue-800 border-blue-200",
      active: "bg-green-100 text-green-800 border-green-200",
      won: "bg-amber-100 text-amber-800 border-amber-200",
      lost: "bg-slate-100 text-slate-600 border-slate-200",
    };
    return colors[status.trim().toLowerCase()] || colors.prospect;
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

  const formatDate = (dateString?: string | null) => {
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

  const SortButton = ({
    field,
    label,
  }: {
    field: SortField;
    label: string;
  }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 font-semibold text-slate-700 transition-colors hover:text-slate-900"
    >
      {label}
      {sortField === field && (
        <span className="text-orange-500">
          {sortDirection === "asc" ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      )}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Bulk Action Button */}
      {onAddToBoard && selectedNotOnBoard.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-green-800">
              <span className="font-semibold">{selectedNotOnBoard.length}</span> customer{selectedNotOnBoard.length !== 1 ? 's' : ''} selected
            </div>
            <button
              onClick={handleBulkAddToBoard}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              <Kanban className="h-4 w-4" />
              Add to Board ({selectedNotOnBoard.length})
            </button>
          </div>
        </div>
      )}

      {/* Results Counter */}
      {(statusFilter.length > 0 || searchQuery.trim()) && (
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="text-sm text-slate-600">
            Showing <span className="font-semibold text-slate-900">{sortedCustomers.length}</span> of{" "}
            <span className="font-semibold text-slate-900">{customers.length}</span> customers
          </div>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs">
                <input
                  type="checkbox"
                  checked={paginatedCustomers.length > 0 && selectedCustomerIds.size === paginatedCustomers.length}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-2 focus:ring-orange-500"
                  title="Select all on this page"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs">
                <span className="sr-only">Pin</span>
              </th>
              <th className="px-4 py-3 text-left text-xs">
                <span className="font-semibold text-slate-700">ID</span>
              </th>
              <th className="px-4 py-3 text-left text-xs">
                <span className="font-semibold text-slate-700">Actions</span>
              </th>
              <th className="px-4 py-3 text-left text-xs">
                <SortButton field="business_name" label="Customer" />
              </th>
              <th className="px-4 py-3 text-left text-xs">
                <span className="font-semibold text-slate-700">Contact</span>
              </th>
              <th className="px-4 py-3 text-left text-xs">
                <span className="font-semibold text-slate-700">Location</span>
              </th>
              <th className="px-4 py-3 text-left text-xs">
                <SortButton field="status" label="Status" />
              </th>
              <th className="px-4 py-3 text-left text-xs">
                <SortButton field="shipping_frequency" label="Frequency" />
              </th>
              <th className="px-4 py-3 text-left text-xs">
                <SortButton field="last_contact_date" label="Last Contact" />
              </th>
              <th className="px-4 py-3 text-left text-xs">
                <SortButton field="next_follow_up_date" label="Follow-Up" />
              </th>
              <th className="px-4 py-3 text-left text-xs">
                <span className="font-semibold text-slate-700">Team</span>
              </th>
              <th className="px-4 py-3 text-left text-xs">
                <span className="font-semibold text-slate-700">Assigned To</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedCustomers.map((customer) => {
              const daysSince = daysSinceContact(customer.last_contact_date);
              const followUpOverdue = isOverdue(customer.next_follow_up_date);

              return (
                <tr
                  key={customer.id}
                  className="transition-colors hover:bg-slate-50"
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedCustomerIds.has(customer.id)}
                      onChange={() => handleSelectCustomer(customer.id)}
                      className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-2 focus:ring-orange-500"
                    />
                  </td>

                  {/* Pin */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleListPin(customer.id)}
                      className={`rounded p-1 transition-colors ${listPinnedIds.has(customer.id)
                          ? "bg-orange-500 text-white"
                          : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        }`}
                      title={
                        listPinnedIds.has(customer.id)
                          ? "Unpin from list"
                          : "Pin to top of list"
                      }
                    >
                      <Pin
                        className="h-4 w-4"
                        fill={
                          listPinnedIds.has(customer.id)
                            ? "currentColor"
                            : "none"
                        }
                      />
                    </button>
                  </td>

                  {/* Customer ID */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/customers/${customer.customer_id}`}
                      className="flex items-center gap-1 text-sm font-mono font-medium text-orange-600 underline transition-colors hover:text-orange-700"
                    >
                      {customer.customer_id}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </td>

                  {/* Actions */}
                  <td className="relative px-4 py-3">
                    <div className="flex gap-1">
                      {onAddToBoard && !customer.on_kanban_board && (
                        <button
                          onClick={() => onAddToBoard(customer.id)}
                          className="rounded p-1.5 text-green-600 transition-colors hover:bg-green-50"
                          title="Add to Kanban Board"
                        >
                          <Kanban className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onQuickAction("schedule", customer)}
                        className="rounded p-1.5 text-orange-600 transition-colors hover:bg-orange-50"
                        title="Schedule Follow-up"
                      >
                        <Calendar className="h-4 w-4" />
                      </button>
                      <QuickNoteInput
                        customerId={customer.id}
                        customerName={customer.business_name || "Unknown"}
                        onSaved={() => {
                          console.log("Note saved for", customer.business_name);
                        }}
                        trigger="icon"
                        size="sm"
                        noteCount={customer.note_count || 0}
                      />
                      {canReassign && onReassign && customer.broker_id && (
                        <button
                          onClick={() => onReassign(customer.id, customer.business_name || "Unknown", customer.broker_id!)}
                          className="rounded p-1.5 text-blue-600 transition-colors hover:bg-blue-50"
                          title="Reassign to another broker"
                        >
                          <UserPlus className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Customer */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onViewDetail ? onViewDetail(customer) : onEdit(customer)}
                      className="text-left transition-colors hover:text-orange-600"
                    >
                      <div className="font-medium text-slate-900">
                        {customer.business_name}
                      </div>
                      {customer.industry && (
                        <div className="text-xs text-slate-500">
                          {customer.industry}
                        </div>
                      )}
                    </button>
                  </td>

                  {/* Contact */}
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-900">
                      {getCustomerDisplayName(customer)}
                    </div>
                    {customer.phone && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => makeCall(customer.phone!, customer.id)}
                          className="block text-left text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {customer.phone}
                        </button>
                      </div>
                    )}
                    {customer.email && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={async () => {
                            const { copyEmail } = await import("@/lib/clipboard-utils");
                            await copyEmail(customer.email!);
                          }}
                          className="block text-left text-xs text-blue-600 hover:underline"
                        >
                          {customer.email}
                        </button>
                      </div>
                    )}
                  </td>

                  {/* Location */}
                  <td className="px-4 py-3">
                    {customer.city && customer.state ? (
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <MapPin className="h-3 w-3" />
                        <span>
                          {customer.city}, {customer.state}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    {onStatusChange ? (
                      <select
                        value={customer.status}
                        onChange={(e) => onStatusChange(customer.id, e.target.value)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 ${getStatusColor(customer.status)}`}
                      >
                        {availableStatuses.map((status) => (
                          <option key={status.id} value={status.name}>
                            {status.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${getStatusColor(customer.status)}`}
                      >
                        {customer.status.charAt(0).toUpperCase() +
                          customer.status.slice(1)}
                      </span>
                    )}
                  </td>

                  {/* Frequency */}
                  <td className="px-4 py-3">
                    {customer.shipping_frequency ? (
                      <span
                        className={`inline-flex rounded px-2 py-1 text-xs font-medium ${getFrequencyColor(customer.shipping_frequency)}`}
                      >
                        {formatFrequency(customer.shipping_frequency)}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>

                  {/* Last Contact */}
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-900">
                      {formatDate(customer.last_contact_date)}
                    </div>
                    {daysSince !== null && (
                      <div className="text-xs text-slate-500">
                        {daysSince === 0
                          ? "Today"
                          : daysSince === 1
                            ? "Yesterday"
                            : `${daysSince}d ago`}
                      </div>
                    )}
                  </td>

                  {/* Follow-Up */}
                  <td className="px-4 py-3">
                    {customer.next_follow_up_date ? (
                      <div
                        className={
                          followUpOverdue ? "text-red-600" : "text-slate-900"
                        }
                      >
                        <div className="flex items-center gap-1 text-sm">
                          {followUpOverdue && (
                            <AlertCircle className="h-3 w-3" />
                          )}
                          {formatDate(customer.next_follow_up_date)}
                        </div>
                        {followUpOverdue && (
                          <div className="text-xs font-medium">Overdue</div>
                        )}
                        {customer.next_follow_up_type && (
                          <div className="mt-1">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${followUpTypeStyles[
                                  customer.next_follow_up_type as FollowUpType
                                ].badge
                                }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${followUpTypeStyles[
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
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>

                  {/* Team Members */}
                  <td className="px-4 py-3">
                    {customer.collaborators && customer.collaborators.length > 0 ? (
                      <div className="flex items-center gap-1">
                        {customer.collaborators.slice(0, 2).map((collab) => (
                          <div
                            key={collab.id}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-linear-to-br from-orange-400 to-orange-600 text-[10px] font-bold text-white"
                            title={collab.broker_name}
                          >
                            {collab.broker_name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {customer.collaborators.length > 2 && (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                            +{customer.collaborators.length - 2}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>

                  {/* Assigned To */}
                  <td className="px-4 py-3">
                    {customer.broker_id && brokerNames[customer.broker_id] ? (
                      <div className="flex items-center gap-1.5 text-sm text-slate-700">
                        <User className="h-3.5 w-3.5 text-orange-500" />
                        {brokerNames[customer.broker_id]}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">Unassigned</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {paginatedCustomers.length === 0 && sortedCustomers.length === 0 && (
          <div className="py-12 text-center text-slate-500">
            No customers found
          </div>
        )}

        {/* Pagination Controls */}
        {sortedCustomers.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-600">
                Showing <span className="font-semibold">{startIndex + 1}</span> to{" "}
                <span className="font-semibold">{Math.min(endIndex, sortedCustomers.length)}</span> of{" "}
                <span className="font-semibold">{sortedCustomers.length}</span> customers
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="pageSize" className="text-sm text-slate-600">
                  Per page:
                </label>
                <select
                  id="pageSize"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded border border-slate-300 px-2 py-1 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="rounded px-3 py-1 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              >
                Previous
              </button>
              <div className="text-sm text-slate-600">
                Page <span className="font-semibold">{currentPage}</span> of{" "}
                <span className="font-semibold">{totalPages}</span>
              </div>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="rounded px-3 py-1 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="divide-y divide-slate-100 lg:hidden">
        {paginatedCustomers.map((customer) => {
          const daysSince = daysSinceContact(customer.last_contact_date);
          const followUpOverdue = isOverdue(customer.next_follow_up_date);

          return (
            <div
              key={customer.id}
              className="p-4 transition-colors active:bg-slate-50"
            >
              {/* Header Row with Checkbox */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedCustomerIds.has(customer.id)}
                    onChange={() => handleSelectCustomer(customer.id)}
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-orange-600 focus:ring-2 focus:ring-orange-500"
                  />
                  <div className="flex-1">
                    <Link
                      href={`/dashboard/customers/${customer.customer_id}`}
                      className="mb-1 flex items-center gap-1.5 text-xs font-mono font-medium text-orange-600 underline"
                    >
                      {customer.customer_id}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <button
                      onClick={() => onViewDetail ? onViewDetail(customer) : onEdit(customer)}
                      className="text-left"
                    >
                      <div className="font-semibold text-slate-900">
                        {customer.business_name}
                      </div>
                      <div className="text-sm text-slate-600">
                        {getCustomerDisplayName(customer)}
                      </div>
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => onPin(customer.id)}
                  className={`ml-2 rounded p-1.5 transition-colors ${customer.is_pinned
                      ? "bg-orange-500 text-white"
                      : "bg-slate-100 text-slate-400"
                    }`}
                  title={customer.is_pinned ? "Unpin" : "Pin"}
                >
                  <Pin
                    className="h-4 w-4"
                    fill={customer.is_pinned ? "currentColor" : "none"}
                  />
                </button>
              </div>

              {/* Info Grid */}
              <div className="mb-3 space-y-2 text-sm">
                {/* Location & Industry */}
                <div className="flex flex-wrap gap-2 text-slate-600">
                  {customer.city && customer.state && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>
                        {customer.city}, {customer.state}
                      </span>
                    </div>
                  )}
                  {customer.industry && (
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      <span>{customer.industry}</span>
                    </div>
                  )}
                </div>

                {/* Status & Frequency Badges */}
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(customer.status)}`}
                  >
                    {customer.status.charAt(0).toUpperCase() +
                      customer.status.slice(1)}
                  </span>
                  {customer.shipping_frequency && (
                    <span
                      className={`inline-flex rounded px-2.5 py-0.5 text-xs font-medium ${getFrequencyColor(customer.shipping_frequency)}`}
                    >
                      {formatFrequency(customer.shipping_frequency)}
                    </span>
                  )}
                </div>

                {/* Last Contact & Follow-Up */}
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {customer.last_contact_date && (
                      <div>
                        Last contact:{" "}
                        <span className="font-medium text-slate-700">
                          {daysSince === 0
                            ? "Today"
                            : daysSince === 1
                              ? "Yesterday"
                              : `${daysSince}d ago`}
                        </span>
                      </div>
                    )}
                    {customer.next_follow_up_date && (
                      <div
                        className={followUpOverdue ? "text-red-600" : undefined}
                      >
                        Follow-up:{" "}
                        <span
                          className={`font-medium ${followUpOverdue ? "text-red-700" : "text-slate-700"}`}
                        >
                          {formatDate(customer.next_follow_up_date)}
                          {followUpOverdue && " (Overdue)"}
                        </span>
                      </div>
                    )}
                  </div>
                  {customer.next_follow_up_type && (
                    <div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${followUpTypeStyles[
                            customer.next_follow_up_type as FollowUpType
                          ].badge
                          }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${followUpTypeStyles[
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
              </div>

              {/* Quick Actions - Touch-friendly 44px height */}
              <div className="space-y-2">
                {onAddToBoard && !customer.on_kanban_board && (
                  <button
                    onClick={() => onAddToBoard(customer.id)}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 text-sm font-medium text-green-700 transition-colors active:bg-green-100"
                  >
                    <Kanban className="h-4 w-4" />
                    Add to Kanban Board
                  </button>
                )}
                <button
                  onClick={() => onQuickAction("schedule", customer)}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-orange-200 bg-orange-50 text-sm font-medium text-orange-700 transition-colors active:bg-orange-100"
                >
                  <Calendar className="h-4 w-4" />
                  Schedule Follow-up
                </button>
                <button
                  onClick={() => {
                    setShareCustomer(customer);
                    setShowShareModal(true);
                  }}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-orange-200 bg-linear-to-r from-orange-50 to-orange-100 text-sm font-medium text-orange-700 transition-colors active:from-orange-100 active:to-orange-200"
                >
                  <Share2 className="h-4 w-4" />
                  Share Contact
                </button>
                <QuickNoteInput
                  customerId={customer.id}
                  customerName={customer.business_name || "Unknown"}
                  onSaved={() => {
                    console.log("Note saved for", customer.business_name);
                  }}
                  size="md"
                  noteCount={customer.note_count || 0}
                />
              </div>
            </div>
          );
        })}

        {paginatedCustomers.length === 0 && sortedCustomers.length === 0 && (
          <div className="py-12 text-center text-slate-500">
            No customers found
          </div>
        )}

        {/* Pagination Controls - Mobile */}
        {sortedCustomers.length > 0 && (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-slate-600">
                <span className="font-semibold">{startIndex + 1}</span>-
                <span className="font-semibold">{Math.min(endIndex, sortedCustomers.length)}</span> of{" "}
                <span className="font-semibold">{sortedCustomers.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="pageSizeMobile" className="text-sm text-slate-600">
                  Per page:
                </label>
                <select
                  id="pageSizeMobile"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded border border-slate-300 px-2 py-1 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex-1 rounded px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              >
                Previous
              </button>
              <div className="text-sm text-slate-600">
                <span className="font-semibold">{currentPage}</span> / <span className="font-semibold">{totalPages}</span>
              </div>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex-1 rounded px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Share Customer Modal */}
      {showShareModal && shareCustomer && (
        <ShareCustomerModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setShareCustomer(null);
          }}
          customer={shareCustomer}
          currentBrokerId={currentBrokerId || ""}
        />
      )}
    </div>
  );
}
