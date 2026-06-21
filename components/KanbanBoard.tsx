"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { Customer } from "@/lib/types";
import {
  Pin,
  Phone,
  Mail,
  Calendar,
  MapPin,
  TrendingUp,
  Settings,
  ExternalLink,
  Check,
  Trash2,
  X,
  Kanban,
  List,
  ArrowRight,
  Plus,
  Pencil,
  Filter,
  SquareStack,
  Square,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsDown,
  Upload,
  Share2,
  Search,
  GripVertical,
} from "lucide-react";
import QuickNoteInput from "./QuickNoteInput";
import ShareCustomerModal from "./ShareCustomerModal";
import Tooltip from "./Tooltip";
import { createClient } from "@/lib/supabase/client";
import { getCustomerDisplayName } from "@/lib/customer-utils";
import { useCustomerSearch } from "@/contexts/CustomerSearchContext";
import { useTeamMemberView } from "@/contexts/TeamMemberViewContext";
import { useSidebar } from "@/contexts/SidebarContext";

import { getTimezoneByPhone } from "@/lib/timezone-utils";

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
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";

type FollowUpType = "call" | "email" | "online_meeting" | "follow_up";

const followUpTypeStyles: Record<FollowUpType, { badge: string; dot: string }> =
{
  call: {
    badge: "border-green-200 bg-green-50 text-green-800",
    dot: "bg-green-500",
  },
  email: {
    badge: "border-blue-200 bg-blue-50 text-blue-800",
    dot: "bg-blue-500",
  },
  online_meeting: {
    badge: "border-teal-200 bg-teal-50 text-teal-800",
    dot: "bg-teal-500",
  },
  follow_up: {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  },
};

const formatFollowUpType = (type: FollowUpType) => type.replace("_", " ");
const normalizeStatusValue = (value: string) => value.trim().toLowerCase();

interface CustomerCardProps {
  customer: Customer;
  onPin: (id: string) => void;
  onEdit: (customer: Customer) => void;
  onQuickAction: (
    action: "call" | "email" | "schedule" | "notes",
    customer: Customer,
  ) => void;
  onRemoveFromBoard?: (id: string) => void;
  onShare?: (customer: Customer) => void;
  onQuickMove?: (customerId: string, newStatusName: string) => void;
  availableStatuses?: Array<{ id: string; name: string; color: string }>;
  isDragging?: boolean;
  compact?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  visibleFields?: {
    contactName: boolean;
    phone: boolean;
    email: boolean;
    industry: boolean;
    location: boolean;
    links: boolean;
    shippingFrequency: boolean;
    lastContact: boolean;
    nextFollowUp: boolean;
    importSource: boolean;
    notes: boolean;
  };
}

function CustomerCard({
  customer,
  onPin,
  onEdit,
  onQuickAction,
  onRemoveFromBoard,
  onShare,
  onQuickMove,
  availableStatuses = [],
  isDragging = false,
  compact = false,
  isSelected = false,
  onSelect,
  visibleFields = {
    contactName: true,
    phone: true,
    email: true,
    industry: false,
    location: true,
    links: false,
    shippingFrequency: true,
    lastContact: true,
    nextFollowUp: true,
    importSource: true,
    notes: false,
  },
}: CustomerCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  // Use useSortable for both dragging and dropping (enables vertical reordering)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isOver,
  } = useSortable({
    id: customer.id,
    data: {
      customer,
    },
  });

  const style = transform
    ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      transition,
    }
    : undefined;

  // Get company initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Generate consistent color from company name
  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-orange-500",
      "bg-teal-500",
      "bg-indigo-500",
      "bg-red-500",
    ];
    const index =
      name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
      colors.length;
    return colors[index];
  };

  const daysSinceContact = customer.last_contact_date
    ? Math.floor(
      (new Date().getTime() -
        new Date(customer.last_contact_date).getTime()) /
      (1000 * 60 * 60 * 24),
    )
    : null;

  const isOverdue = customer.next_follow_up_date
    ? new Date(customer.next_follow_up_date) < new Date()
    : false;

  const getStatusDotColor = () => {
    if (isOverdue) return "bg-red-500";
    if (customer.next_follow_up_date) return "bg-amber-500";
    if (daysSinceContact && daysSinceContact > 30) return "bg-orange-500";
    return "bg-green-500";
  };

  // Compact card view - minimal info, click to expand
  if (compact) {
    return (
      <div
        ref={setNodeRef}
        data-customer-id={customer.id}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => onEdit(customer)}
        className={`group relative flex items-center gap-2 rounded border bg-white p-2 transition-all ${customer.is_pinned
          ? "border-primary/40 shadow-sm"
          : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
          } ${isOver
            ? "ring-2 ring-primary/50 shadow-md"
            : ""
          } ${isDragging ? "opacity-0" : "cursor-grab active:cursor-grabbing"}`}
      >
        {/* Pin indicator */}
        {customer.is_pinned && (
          <div className="absolute -left-1 -top-1">
            <Pin className="h-4 w-4 text-primary" fill="currentColor" />
          </div>
        )}

        {/* Status dot */}
        <div
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${getStatusDotColor()}`}
          title={
            isOverdue
              ? "Overdue follow-up"
              : customer.next_follow_up_date
                ? "Follow-up scheduled"
                : "Active"
          }
        />

        {/* Business name */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">
            {customer.business_name || getCustomerDisplayName(customer) || "Unknown"}
          </div>
          <div className="truncate text-xs text-slate-500">
            {daysSinceContact !== null && `${daysSinceContact}d ago`}
            {daysSinceContact !== null && customer.shipping_frequency && " • "}
            {customer.shipping_frequency && (
              customer.shipping_frequency === "multiple_per_week" ? "Multi/wk" :
                customer.shipping_frequency === "weekly" ? "Weekly" :
                  customer.shipping_frequency === "bi_weekly" ? "Bi-weekly" :
                    customer.shipping_frequency === "monthly" ? "Monthly" :
                      customer.shipping_frequency === "quarterly" ? "Quarterly" : "Yearly"
            )}
          </div>
        </div>

        {/* Quick action buttons - show on hover */}
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickAction("call", customer);
            }}
            className="rounded p-1 text-slate-500 hover:bg-green-100 hover:text-green-700"
            title="Call"
          >
            <Phone className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickAction("notes", customer);
            }}
            className="rounded p-1 text-slate-500 hover:bg-primary/10 hover:text-primary-text"
            title="Add note"
          >
            <Calendar className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      data-customer-id={customer.id}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Ignore clicks on interactive children (buttons, links, inputs, menu items)
        const target = e.target as HTMLElement;
        if (target.closest("button, a, input, textarea, [data-no-card-toggle]")) return;
        setShowDetails((v) => !v);
        onSelect?.(customer.id);
      }}
      className={`group relative rounded border bg-white transition-all ${customer.is_pinned
        ? "border-primary/40 shadow-sm"
        : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
        } ${isSelected
          ? "ring-2 ring-primary ring-offset-1"
          : isOver
            ? "ring-2 ring-primary/50 shadow-md"
            : ""
        } ${isDragging ? "opacity-0" : "cursor-grab active:cursor-grabbing"}`}
    >
      {/* Compact Card Content */}
      <div className="p-2.5">
        <div className="flex items-start gap-2.5">
          {/* Company Avatar */}
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-bold text-white ${getAvatarColor(customer.business_name || getCustomerDisplayName(customer) || "?")}`}
          >
            {getInitials(customer.business_name || getCustomerDisplayName(customer) || "?")}
          </div>

          {/* Card Info */}
          <div className="min-w-0 flex-1">
            {/* Business Name & ID */}
            <Link
              href={`/dashboard/customers/${customer.customer_id}`}
              className="mb-0.5 block truncate text-sm font-semibold leading-tight text-slate-900 hover:text-primary-text"
              onClick={(e) => e.stopPropagation()}
            >
              {customer.business_name || getCustomerDisplayName(customer) || "Unknown"}
            </Link>

            {/* Customer ID */}
            <div className="mb-1 text-[11px] font-medium text-slate-500">
              {customer.customer_id}
            </div>

            {/* Contact Name */}
            {visibleFields.contactName && getCustomerDisplayName(customer) && (
              <div className="mb-1.5 truncate text-xs text-slate-600">
                {getCustomerDisplayName(customer)}
              </div>
            )}

            {/* Import Source Tag - Read Only */}
            {visibleFields.importSource && customer.import_source && (
              <div className="mb-1.5 inline-flex items-center gap-1 rounded border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                <span>{customer.import_source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
              </div>
            )}

            {/* Status Indicators - Only show critical info */}
            <div className="flex items-center gap-1.5">
              {/* Status dot */}
              <div
                className={`h-2 w-2 rounded-full ${getStatusDotColor()}`}
                title={
                  isOverdue
                    ? "Overdue follow-up"
                    : customer.next_follow_up_date
                      ? "Follow-up scheduled"
                      : "Active"
                }
              />

              {/* Shipping frequency indicator */}
              {visibleFields.shippingFrequency && customer.shipping_frequency && (
                <span className="text-[10px] text-slate-500">
                  {customer.shipping_frequency === "multiple_per_week"
                    ? "Multi/wk"
                    : customer.shipping_frequency === "weekly"
                      ? "Weekly"
                      : customer.shipping_frequency === "bi_weekly"
                        ? "Bi-weekly"
                        : customer.shipping_frequency === "monthly"
                          ? "Monthly"
                          : customer.shipping_frequency === "quarterly"
                            ? "Quarterly"
                            : "Yearly"}
                </span>
              )}

              {/* Note count if exists */}
              {visibleFields.notes && (customer as any).note_count > 0 && (
                <span className="text-[10px] text-slate-400">
                  {(customer as any).note_count} notes
                </span>
              )}
            </div>
          </div>

          {/* Pin & Remove Buttons - Top right */}
          <div className="flex shrink-0 gap-0.5">
            {customer.is_pinned && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPin(customer.id);
                }}
                className="text-primary transition-opacity opacity-100 hover:opacity-70"
                title="Unpin"
              >
                <Pin className="h-4 w-4" fill="currentColor" />
              </button>
            )}
            {!customer.is_pinned && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPin(customer.id);
                }}
                className="text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-primary"
                title="Pin"
              >
                <Pin className="h-4 w-4" />
              </button>
            )}
            {onRemoveFromBoard && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFromBoard(customer.id);
                }}
                className="rounded p-0.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
                title="Remove from Board"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <ChevronsDown
              className={`h-3.5 w-3.5 text-slate-600 transition-transform ${showDetails ? "rotate-180" : ""}`}
              aria-label={showDetails ? "Click to collapse" : "Click to expand"}
            />
          </div>
        </div>

        {/* Expanded details (click card to toggle) */}
        {showDetails && (
          <div
            className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick Info */}
            {((visibleFields.location && (customer.city || customer.state)) || (visibleFields.industry && customer.industry)) && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-600">
                {visibleFields.location && (customer.city || customer.state) && (
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5" />
                    {customer.city}
                    {customer.city && customer.state && ", "}
                    {customer.state}
                  </span>
                )}
                {visibleFields.industry && customer.industry && (
                  <span className="flex items-center gap-0.5">
                    <TrendingUp className="h-2.5 w-2.5" />
                    {customer.industry}
                  </span>
                )}
              </div>
            )}

            {/* Follow-up Info */}
            {((visibleFields.lastContact && daysSinceContact !== null) || (visibleFields.nextFollowUp && customer.next_follow_up_date)) && (
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
                {visibleFields.lastContact && daysSinceContact !== null && (
                  <span>
                    Last contact:{" "}
                    <span className="font-medium">{daysSinceContact}d ago</span>
                  </span>
                )}
                {visibleFields.nextFollowUp && customer.next_follow_up_date && (
                  <span className={isOverdue ? "font-medium text-red-600" : ""}>
                    Next:{" "}
                    {new Date(customer.next_follow_up_date).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                      },
                    )}
                    {customer.next_follow_up_type && (
                      <span className="ml-0.5">
                        ({customer.next_follow_up_type.replace("_", " ")})
                      </span>
                    )}
                  </span>
                )}
              </div>
            )}

            {/* Quick Actions */}
            {(visibleFields.phone || visibleFields.email) && (
              <div className="flex gap-1">
                {visibleFields.phone && (
                  <button
                    onClick={() => onQuickAction("call", customer)}
                    className="flex h-7 flex-1 items-center justify-center gap-1 rounded bg-slate-50 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-100"
                    title="Call"
                  >
                    <Phone className="h-3 w-3" />
                    Call
                  </button>
                )}
                {visibleFields.email && (
                  <button
                    onClick={() => onQuickAction("email", customer)}
                    className="flex h-7 flex-1 items-center justify-center gap-1 rounded bg-slate-50 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-100"
                    title="Email"
                  >
                    <Mail className="h-3 w-3" />
                    Email
                  </button>
                )}
                <button
                  onClick={() => onQuickAction("schedule", customer)}
                  className="flex h-7 flex-1 items-center justify-center gap-1 rounded bg-primary text-[11px] font-medium text-white transition-colors hover:bg-primary-text"
                  title="Schedule"
                >
                  <Calendar className="h-3 w-3" />
                  Task
                </button>
              </div>
            )}

            {/* Quick Move Button - Full Width */}
            {onQuickMove && availableStatuses.length > 0 && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoveMenu(!showMoveMenu);
                  }}
                  className="flex h-7 w-full items-center justify-center gap-1.5 rounded bg-linear-to-r from-blue-50 to-blue-100 text-[11px] font-medium text-blue-700 transition-colors hover:from-blue-100 hover:to-blue-200 border border-blue-200"
                  title="Move to column (M)"
                >
                  <ArrowRight className="h-3 w-3" />
                  Move to...
                </button>

                {/* Quick Move Dropdown */}
                {showMoveMenu && (
                  <>
                    {/* Backdrop to close menu */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMoveMenu(false);
                      }}
                    />

                    {/* Dropdown Menu */}
                    <div className="absolute left-0 right-0 top-8 z-50 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                      {availableStatuses.map((status) => {
                        const isCurrent = customer.status.toLowerCase() === status.name.toLowerCase() ||
                          customer.status.toLowerCase() === status.id.toLowerCase();
                        return (
                          <button
                            key={status.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isCurrent) {
                                onQuickMove(customer.id, status.name);
                              }
                              setShowMoveMenu(false);
                            }}
                            disabled={isCurrent}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors ${isCurrent
                              ? "bg-orange-50 text-orange-600 font-semibold cursor-default"
                              : "hover:bg-slate-50 text-slate-700"
                              }`}
                          >
                            <span>{status.name}</span>
                            {isCurrent && <Check className="h-3.5 w-3.5 text-orange-600" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Share Button - Full Width */}
            {onShare && (
              <button
                onClick={() => onShare(customer)}
                className="flex h-7 w-full items-center justify-center gap-1.5 rounded bg-linear-to-r from-orange-50 to-orange-100 text-[11px] font-medium text-orange-700 transition-colors hover:from-orange-100 hover:to-orange-200 border border-orange-200"
                title="Share Contact"
              >
                <Share2 className="h-3 w-3" />
                Share Contact
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface KanbanColumnProps {
  title: string;
  status: string;
  statusId: string;
  customers: Customer[];
  count: number;
  customerCount: number;
  keyboardShortcut?: number; // Number key (1-9) to jump to this column
  onPin: (id: string) => void;
  onEdit: (customer: Customer) => void;
  onQuickAction: (
    action: "call" | "email" | "schedule" | "notes",
    customer: Customer,
  ) => void;
  onAddCustomer: (status: string) => void;
  activeCustomerId: string | null;
  onOpenNotes: (customer: Customer) => void;
  onRemoveFromBoard?: (id: string) => void;
  onShare?: (customer: Customer) => void;
  onQuickMove?: (customerId: string, newStatusName: string) => void;
  availableStatuses?: Array<{ id: string; name: string; color: string }>;
  onRenameStatus?: (statusId: string, oldName: string, newName: string) => void;
  onDeleteStatus?: (statusId: string, statusName: string, customerCount: number) => void;
  isEditing?: boolean;
  editingName?: string;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onSaveEdit?: (newName: string) => void;
  width?: number;
  onResizeStart?: (statusId: string, e: React.MouseEvent) => void;
  isResizing?: boolean;
  compact?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  canManageBoard?: boolean;
  dragHandleProps?: any;
  onMoveColumn?: (direction: 'left' | 'right') => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  selectedCardId?: string | null;
  onSelectCard?: (id: string | null) => void;
  visibleFields?: {
    contactName: boolean;
    phone: boolean;
    email: boolean;
    industry: boolean;
    location: boolean;
    links: boolean;
    shippingFrequency: boolean;
    lastContact: boolean;
    nextFollowUp: boolean;
    importSource: boolean;
    notes: boolean;
  };
}

function KanbanColumn({
  title,
  status,
  statusId,
  customers,
  count,
  customerCount,
  keyboardShortcut,
  onPin,
  onEdit,
  onQuickAction,
  onAddCustomer,
  activeCustomerId,
  onOpenNotes,
  onRemoveFromBoard,
  onShare,
  onQuickMove,
  availableStatuses = [],
  onRenameStatus,
  onDeleteStatus,
  isEditing = false,
  editingName = "",
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  width,
  onResizeStart,
  isResizing = false,
  compact = false,
  isCollapsed = false,
  onToggleCollapse,
  canManageBoard = true,
  dragHandleProps,
  onMoveColumn,
  canMoveLeft = false,
  canMoveRight = false,
  selectedCardId = null,
  onSelectCard,
  visibleFields = {
    contactName: true,
    phone: true,
    email: true,
    industry: false,
    location: true,
    links: false,
    shippingFrequency: true,
    lastContact: true,
    nextFollowUp: true,
    importSource: true,
    notes: false,
  },
}: KanbanColumnProps) {
  const [localEditName, setLocalEditName] = useState(editingName);
  const [selectedImportSource, setSelectedImportSource] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    setLocalEditName(editingName);
  }, [editingName]);

  const { setNodeRef, isOver } = useDroppable({
    id: statusId,
  });

  // Get unique import sources for Inbox filtering
  const uniqueImportSources = useMemo(() => {
    if (statusId !== 'inbox') return [];
    const sources = new Set<string>();
    customers.forEach(c => {
      if (c.import_source && c.import_source.trim()) {
        sources.add(c.import_source.trim());
      }
    });
    return Array.from(sources).sort();
  }, [statusId, customers]);

  // Filter customers by selected import source (only for Inbox)
  const filteredCustomers = useMemo(() => {
    if (statusId !== 'inbox' || !selectedImportSource) return customers;
    return customers.filter(c => c.import_source?.trim() === selectedImportSource);
  }, [statusId, selectedImportSource, customers]);

  const displayCustomers = filteredCustomers;

  const getColumnColor = () => {
    const colors: Record<string, string> = {
      prospect: "border-blue-200 bg-blue-50",
      active: "border-green-200 bg-green-50",
      won: "border-amber-200 bg-amber-50",
      lost: "border-slate-200 bg-slate-50",
    };
    return colors[status] || colors.prospect;
  };

  const pinnedCustomers = displayCustomers
    .filter((c) => c.is_pinned)
    .sort((a, b) => (a.pin_order || 0) - (b.pin_order || 0));
  // Stable-sort unpinned by pin_order so cards with an explicit order (set by
  // drag-and-drop or arrow-key reordering) appear first in that order; cards
  // with a null pin_order keep their incoming order (driven by the global
  // sortBy/sortDirection preference).
  const unpinnedCustomers = displayCustomers
    .filter((c) => !c.is_pinned)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const ao = a.c.pin_order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.c.pin_order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return a.i - b.i;
    })
    .map(({ c }) => c);

  // Render collapsed view
  if (isCollapsed) {
    return (
      <div className="flex h-[calc(100vh-12rem)] w-12 shrink-0 flex-col bg-slate-100 border-r border-slate-200">
        {/* Collapse toggle at top */}
        <button
          onClick={onToggleCollapse}
          className="flex h-10 items-center justify-center border-b border-slate-200 text-slate-600 hover:bg-slate-200 transition-colors"
          title="Expand Inbox"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {/* Vertical text */}
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center justify-center" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
            <span className="text-sm font-semibold text-slate-700">{title}</span>
            <span className="ml-2 rounded-full bg-slate-300 px-1.5 py-0.5 text-xs font-medium text-slate-700">{count}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id={statusId}
      ref={setNodeRef}
      className={`flex h-[calc(100vh-12rem)] flex-col bg-white transition-all relative ${isOver
        ? "ring-4 ring-primary/80 bg-primary/5 shadow-xl scale-[1.02]"
        : ""
        }`}
      style={{
        width: width ? `${width}px` : '320px',
        minWidth: width ? `${width}px` : '320px',
        maxWidth: width ? `${width}px` : '320px',
        flexShrink: 0,
        flexGrow: 0,
      }}
    >
      {/* Resize Handle */}
      {onResizeStart && (
        <div
          className={`absolute top-0 right-0 bottom-0 w-1 hover:w-2 cursor-col-resize transition-all z-10 ${isResizing ? 'bg-primary w-2' : 'bg-transparent hover:bg-slate-300'
            }`}
          onMouseDown={(e) => onResizeStart(statusId, e)}
          title="Drag to resize column"
        />
      )}

      {/* Column Header - Inline editable */}
      <div
        className={`shrink-0 border-b px-3 py-2.5 transition-all ${isOver
          ? "bg-primary/10 border-primary border-b-2"
          : "border-slate-200"
          }`}
      >
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={localEditName}
              onChange={(e) => setLocalEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSaveEdit?.(localEditName);
                } else if (e.key === "Escape") {
                  onCancelEdit?.();
                }
              }}
              className="h-7 flex-1 rounded border border-primary px-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <button
              onClick={() => onSaveEdit?.(localEditName)}
              className="flex h-7 w-7 items-center justify-center rounded bg-green-500 text-white hover:bg-green-600"
              title="Save"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={onCancelEdit}
              className="flex h-7 w-7 items-center justify-center rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Top Row: Keyboard shortcut (left) | Rearrange controls (right) */}
            <div className="flex items-center justify-between">
              {/* Keyboard shortcut badge */}
              {keyboardShortcut && keyboardShortcut <= 9 ? (
                <Tooltip content={`Press ${keyboardShortcut} to jump to this column`}>
                  <kbd className="shrink-0 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                    {keyboardShortcut}
                  </kbd>
                </Tooltip>
              ) : (
                <div></div>
              )}

              {/* Rearrange controls */}
              {canManageBoard && (
                <div className="flex items-center gap-1">
                  {canMoveLeft && (
                    <button
                      onClick={() => onMoveColumn?.('left')}
                      className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                      title="Move column left"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <div
                    {...dragHandleProps}
                    className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors cursor-grab active:cursor-grabbing"
                    title="Drag to reorder column"
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>
                  {canMoveRight && (
                    <button
                      onClick={() => onMoveColumn?.('right')}
                      className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                      title="Move column right"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Row: Title + action buttons */}
            <div className="flex items-center justify-between gap-2">
              <h2
                className={`text-sm font-semibold text-slate-900 truncate flex-1 ${canManageBoard && statusId !== "inbox" ? "cursor-pointer hover:text-primary-text transition-colors" : ""}`}
                onClick={canManageBoard && statusId !== "inbox" ? onStartEdit : undefined}
                title={canManageBoard && statusId !== "inbox" ? "Click to rename" : title}
              >
                {title}
              </h2>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {canManageBoard && statusId !== "inbox" && (
                  <button
                    onClick={onStartEdit}
                    className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-primary-text transition-colors"
                    title="Rename column"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {onToggleCollapse && (
                  <button
                    onClick={onToggleCollapse}
                    className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                    title="Collapse column"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                )}
                {canManageBoard && onDeleteStatus && statusId !== "inbox" && (
                  <button
                    onClick={() => onDeleteStatus(statusId, title, customerCount)}
                    className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Delete column"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Import Source Filter Chips - Only for Inbox */}
      {statusId === 'inbox' && uniqueImportSources.length > 0 && (
        <div className="shrink-0 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between px-3 py-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-primary/60 hover:bg-primary/5 hover:text-primary-text hover:shadow"
            >
              <Filter className="h-4 w-4" />
              <span>Filter by Source</span>
              <ChevronsDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {!showFilters && selectedImportSource && (
              <button
                onClick={() => setSelectedImportSource(null)}
                className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary-text transition-colors hover:bg-primary/10"
              >
                Clear
              </button>
            )}
          </div>
          {showFilters && (
            <div className="px-3 pb-2">
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedImportSource(null)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${selectedImportSource === null
                    ? "bg-primary text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-100"
                    }`}
                  title="Show all"
                >
                  All
                  <span className="inline-flex items-center justify-center rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold">
                    {customers.length}
                  </span>
                </button>
                {uniqueImportSources.map(source => (
                  <button
                    key={source}
                    onClick={() => setSelectedImportSource(selectedImportSource === source ? null : source)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${selectedImportSource === source
                      ? "bg-purple-500 text-white shadow-sm"
                      : "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                      }`}
                    title={`Filter by ${source}`}
                  >
                    {source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${selectedImportSource === source ? "bg-white/20" : "bg-purple-200 text-purple-800"
                      }`}>
                      {customers.filter(c => c.import_source?.trim() === source).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cards Container - Tighter spacing like Pipedrive */}
      <div
        className={`flex-1 space-y-2 overflow-y-auto p-3 transition-colors ${isOver ? "bg-primary/10" : ""
          }`}
      >
        {/* Drop indicator at top when hovering */}
        {isOver && activeCustomerId && (
          <div className="mb-2 rounded-lg border-2 border-dashed border-primary/60 bg-primary/10 p-4 text-center">
            <p className="text-sm font-medium text-primary-text">
              Drop here to move to {title}
            </p>
          </div>
        )}

        {/* Wrap all cards in SortableContext for vertical drag-and-drop */}
        <SortableContext
          items={displayCustomers.map(c => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {/* Pinned Section - no label, visually distinct with orange border */}
          {pinnedCustomers.length > 0 && (
            <>
              {pinnedCustomers.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  onPin={onPin}
                  onEdit={onEdit}
                  onQuickAction={(action, c) => {
                    if (action === "notes") {
                      onOpenNotes(c);
                    } else {
                      onQuickAction(action, c);
                    }
                  }}
                  onRemoveFromBoard={onRemoveFromBoard}
                  onShare={onShare}
                  onQuickMove={onQuickMove}
                  availableStatuses={availableStatuses}
                  isDragging={customer.id === activeCustomerId}
                  compact={compact}
                  isSelected={selectedCardId === customer.id}
                  onSelect={(id) => onSelectCard?.(selectedCardId === id ? null : id)}
                  visibleFields={visibleFields}
                />
              ))}
              {unpinnedCustomers.length > 0 && (
                <div className="my-2 border-t border-slate-200" />
              )}
            </>
          )}

          {/* Unpinned Customers */}
          {unpinnedCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onPin={onPin}
              onEdit={onEdit}
              onQuickAction={(action, c) => {
                if (action === "notes") {
                  onOpenNotes(c);
                } else {
                  onQuickAction(action, c);
                }
              }}
              onRemoveFromBoard={onRemoveFromBoard}
              onShare={onShare}
              onQuickMove={onQuickMove}
              availableStatuses={availableStatuses}
              isDragging={customer.id === activeCustomerId}
              compact={compact}
              isSelected={selectedCardId === customer.id}
              onSelect={(id) => onSelectCard?.(selectedCardId === id ? null : id)}
              visibleFields={visibleFields}
            />
          ))}
        </SortableContext>

        {displayCustomers.length === 0 && customers.length > 0 && (
          <div className="flex h-32 items-center justify-center text-sm text-slate-400">
            No customers match this filter
          </div>
        )}

        {customers.length === 0 && (
          <div className="flex h-32 items-center justify-center text-sm text-slate-400">
            No claims yet
          </div>
        )}

        {/* Drop Zone - Always visible at bottom when dragging to ensure you can drop into full columns */}
        {activeCustomerId && displayCustomers.length > 0 && (
          <div
            className={`min-h-20 rounded-lg border-2 border-dashed transition-colors ${isOver
              ? "border-primary bg-primary/5"
              : "border-slate-300 bg-slate-50"
              }`}
          >
            <div className="flex h-full items-center justify-center text-xs text-slate-500">
              {isOver ? "Drop here" : "Drop to add"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Sortable wrapper for column drag-and-drop
interface SortableColumnWrapperProps {
  id: string;
  children: (dragHandleProps: any) => React.ReactNode;
  className?: string;
}

function SortableColumnWrapper({ id, children, className }: SortableColumnWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: {
      column: true,
    },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    transition,
  } : undefined;

  // Combine attributes and listeners for the drag handle
  const dragHandleProps = {
    ...attributes,
    ...listeners,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${className} ${isDragging ? 'opacity-50 z-20' : ''}`}
    >
      {children(dragHandleProps)}
    </div>
  );
}

interface KanbanBoardProps {
  customers: Customer[];
  onPin: (id: string) => void;
  onEdit: (customer: Customer) => void;
  onQuickAction: (
    action: "call" | "email" | "schedule" | "notes",
    customer: Customer,
  ) => void;
  onAddCustomer: (status: string) => void;
  onStatusChange: (customerId: string, newStatus: string) => void;
  onAddNote: (
    customerId: string,
    note: string,
    followUpDate?: string,
    followUpType?: FollowUpType,
  ) => void;
  onRemoveFromBoard?: (id: string) => void;
  onStatusRenamed?: (oldName: string, newName: string) => void;
}

export default function KanbanBoard({
  customers,
  onPin,
  onEdit,
  onQuickAction,
  onAddCustomer,
  onStatusChange,
  onAddNote,
  onRemoveFromBoard,
  onStatusRenamed,
}: KanbanBoardProps) {
  const supabase = createClient();
  const { searchQuery, sourceFilter, timezoneFilter, timezoneMode } = useCustomerSearch();
  const { viewingTeamMember, currentTeamMember, canEditCustomerData } = useTeamMemberView();
  const { isCollapsed: isSidebarCollapsed } = useSidebar();
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Determine if the current user can manage the viewed board
  // (rename/delete/add columns, edit customers, create tasks)
  const isViewingOwnBoard = !viewingTeamMember || viewingTeamMember.id === currentTeamMember?.id;
  const isSameOffice = viewingTeamMember?.office_location != null &&
    viewingTeamMember.office_location === currentTeamMember?.office_location;
  // IMPORTANT: Column structural changes (rename/add/delete) are ONLY allowed on your own board.
  // When an admin views another teamMember's board, the customer_statuses RLS blocks the real column
  // rows from being fetched, so hardcoded fallback columns are shown with fake string IDs.
  // If an admin renames a fallback column, the customer_statuses UPDATE silently no-ops (fake ID),
  // but the customers.status bulk-update SUCCEEDS — orphaning those customers in "purgatory"
  // (their status no longer matches any real column). Disabling column management when viewing
  // another teamMember prevents this data corruption until proper admin RLS policies are in place.
  const canManageViewedBoard = isViewingOwnBoard;
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteCustomer, setNoteCustomer] = useState<Customer | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteFollowUpDate, setNoteFollowUpDate] = useState("");
  const [noteAddToCalendar, setNoteAddToCalendar] = useState(false);
  const [noteFollowUpType, setNoteFollowUpType] = useState<FollowUpType | "">(
    "",
  );
  const [showRemoveConfirmModal, setShowRemoveConfirmModal] = useState(false);
  const [customerToRemove, setCustomerToRemove] = useState<Customer | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCustomer, setShareCustomer] = useState<Customer | null>(null);
  const [currentTeamMemberId, setCurrentTeamMemberId] = useState<string>("");
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editingStatusName, setEditingStatusName] = useState("");
  const [isAddingStatus, setIsAddingStatus] = useState(false);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusColor, setNewStatusColor] = useState("blue");
  const [statuses, setStatuses] = useState([
    {
      id: "prospect",
      name: "Prospects",
      color: "blue",
      order: 0,
      customer_count: 0,
    },
    {
      id: "active",
      name: "Active Clients",
      color: "green",
      order: 1,
      customer_count: 0,
    },
    { id: "won", name: "Won", color: "purple", order: 2, customer_count: 0 },
    { id: "lost", name: "Lost", color: "slate", order: 3, customer_count: 0 },
  ]);
  const [loading, setLoading] = useState(true);

  // Column widths stored in localStorage
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);

  // Column filtering - REMOVED: All columns always visible, filtering only applies to customers
  // const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  // const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Inbox collapse state
  const [inboxCollapsed, setInboxCollapsed] = useState(false);

  // Card view mode
  const [cardView, setCardView] = useState<'full' | 'compact'>('full');

  // Follow-up type filtering
  const [followUpTypeFilter, setFollowUpTypeFilter] = useState<FollowUpType[]>([]);

  // Sorting
  const [sortBy, setSortBy] = useState<'business_name' | 'next_follow_up_date' | 'last_contact_date' | 'created_at'>('next_follow_up_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Card field visibility
  const [visibleFields, setVisibleFields] = useState({
    contactName: true,
    phone: true,
    email: true,
    industry: false,
    location: true,
    links: false,
    shippingFrequency: true,
    lastContact: true,
    nextFollowUp: true,
    importSource: true,
    notes: false,
  });
  const [showFieldsMenu, setShowFieldsMenu] = useState(false);

  // Horizontal scroll indicators
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ left: false, right: false, hasOverflow: false });
  const [showScrollHint, setShowScrollHint] = useState(false);

  // Interaction tips strip — visible by default, collapsed by default, can be
  // permanently dismissed via the X button (persisted in localStorage).
  const [showInteractionTips, setShowInteractionTips] = useState(true);
  const [tipsExpanded, setTipsExpanded] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('kanban-interaction-tips-seen')) {
      setShowInteractionTips(false);
    }
  }, []);
  const dismissInteractionTips = () => {
    setShowInteractionTips(false);
    try { localStorage.setItem('kanban-interaction-tips-seen', 'true'); } catch { }
  };

  // Column drag and drop
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

  // Currently selected card (for keyboard movement)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Mouse position tracking for smooth auto-scroll during drag
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Scroll navigation
  const scrollToDirection = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 800; // Increased from 400 - scroll roughly two column widths for faster navigation
    container.scrollBy({
      left: direction === 'right' ? scrollAmount : -scrollAmount,
      behavior: 'smooth',
    });
  };

  // Scroll to show a specific column (used after moving a customer)
  const scrollToColumn = (statusIdOrName: string) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Find the status by ID or name
    const targetStatus = statuses.find(
      (s) =>
        s.id.toLowerCase() === statusIdOrName.toLowerCase() ||
        s.name.toLowerCase() === statusIdOrName.toLowerCase()
    );

    if (!targetStatus) return;

    // Find the column element by status ID
    const columnElement = container.querySelector(`[id="${targetStatus.id}"]`);

    if (columnElement) {
      // Scroll the column into view smoothly, centered in viewport
      columnElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center' // Center the destination column
      });
    }
  };

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4, // 4px for faster, more responsive drag activation
      },
    }),
  );

  // Fetch statuses from Supabase on mount or when viewing team member changes
  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        // Get current team member's office location and role
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: teamMember } = await supabase
            .from('team_members')
            .select('id, is_manager, is_admin')
            .eq('id', user.id)
            .single();

          if (teamMember) {
            // Set teamMember ID for sharing
            setCurrentTeamMemberId(teamMember.id);

            // Set role flags
            setIsManager(teamMember?.is_manager || false);
            setIsAdmin(teamMember?.is_admin || false);
          }
        }

        // Check if we're viewing our own data or another team member's
        const isViewingOwnData = !viewingTeamMember || viewingTeamMember.id === user?.id;

        if (isViewingOwnData) {
          const inboxStatus = {
            id: "inbox",
            name: "Inbox",
            color: "slate",
            order: -1,
            customer_count: 0,
            is_protected: true,
          };

          // Viewing own data - use RPC function (works with RLS)
          const { data, error } = await supabase.rpc("get_user_statuses");
          if (error) {
            console.error("Error fetching statuses (RPC):", error);
            setLoading(false);
            return;
          }
          if (data && data.length > 0) {
            console.log("[KanbanBoard] Fetched own statuses from DB:", data.map((s: any) => ({ id: s.id, name: s.name })));
            setStatuses([inboxStatus, ...data]);
          } else if (user) {
            // RPC returned empty. Before assuming "new user" and seeding (which
            // wipes existing columns on a unique-constraint conflict), do a
            // direct table read as a safety net — this catches transient RPC
            // session/RLS hiccups that otherwise nuke the user's columns.
            const { data: directRead } = await supabase
              .from("customer_statuses")
              .select("*")
              .eq("team_member_id", user.id)
              .order("order", { ascending: true });

            if (directRead && directRead.length > 0) {
              console.log("[KanbanBoard] RPC empty but direct read found statuses — preserving columns");
              setStatuses([
                inboxStatus,
                ...directRead.map((s: any) => ({ ...s, customer_count: 0 })),
              ]);
            } else {
              // Genuinely new user — seed defaults
              // CEO's 6 default kanban columns (per email spec). Inbox is
              // prepended separately as a protected/system column, so the
              // seed inserts only the 5 working stages.
              const defaultStatuses = [
                { team_member_id: user.id, name: "Claim Started",          color: "blue",   order: 0, is_system: false, created_by: user.id },
                { team_member_id: user.id, name: "Processing Claim",       color: "amber",  order: 1, is_system: false, created_by: user.id },
                { team_member_id: user.id, name: "Claim Denied",           color: "red",    order: 2, is_system: false, created_by: user.id },
                { team_member_id: user.id, name: "Claim Awaiting Payment", color: "orange", order: 3, is_system: false, created_by: user.id },
                { team_member_id: user.id, name: "Claim Closed",           color: "green",  order: 4, is_system: false, created_by: user.id },
              ];

              const { data: seeded } = await supabase
                .from("customer_statuses")
                .insert(defaultStatuses)
                .select();

              if (seeded && seeded.length > 0) {
                console.log("[KanbanBoard] Seeded default statuses for new user");
                setStatuses([inboxStatus, ...seeded.map((s: any) => ({ ...s, customer_count: 0 }))]);
              } else {
                // Insert blocked (likely already exists) — re-read directly
                const { data: refetch } = await supabase
                  .from("customer_statuses")
                  .select("*")
                  .eq("team_member_id", user.id)
                  .order("order", { ascending: true });
                if (refetch && refetch.length > 0) {
                  setStatuses([
                    inboxStatus,
                    ...refetch.map((s: any) => ({ ...s, customer_count: 0 })),
                  ]);
                } else {
                  // Do NOT collapse to inbox-only here — keep whatever we
                  // already had loaded to avoid destroying the user's view.
                  console.warn("[KanbanBoard] Could not load any statuses — preserving existing column list");
                  setStatuses((prev) => (prev.length > 0 ? prev : [inboxStatus]));
                }
              }
            }
          } else {
            setStatuses([inboxStatus]);
          }
        } else {
          // Viewing another teamMember's data - fetch their statuses from the database
          console.log("[KanbanBoard] Viewing another team member, fetching their statuses");

          // Fetch the viewing team member's custom statuses from the database
          const { data: viewingTeamMemberStatuses, error: statusError } = await supabase
            .from('customer_statuses')
            .select('*')
            .eq('team_member_id', viewingTeamMember.id)
            .order('order', { ascending: true });

          if (statusError) {
            console.error("Error fetching viewing team member's statuses:", statusError);
          }

          const inboxStatus = {
            id: "inbox",
            name: "Inbox",
            color: "slate",
            order: -1,
            customer_count: 0,
            is_protected: true,
          };

          if (viewingTeamMemberStatuses && viewingTeamMemberStatuses.length > 0) {
            setStatuses([inboxStatus, ...viewingTeamMemberStatuses]);
          } else {
            // Fallback to CEO's 6 default kanban columns (per email spec)
            // if the viewed teamMember has no custom statuses yet. Inbox is
            // already in inboxStatus above as a protected/system column.
            setStatuses([
              inboxStatus,
              { id: "claim_started",          name: "Claim Started",          color: "blue",   order: 0, customer_count: 0 },
              { id: "processing_claim",       name: "Processing Claim",       color: "amber",  order: 1, customer_count: 0 },
              { id: "claim_denied",           name: "Claim Denied",           color: "red",    order: 2, customer_count: 0 },
              { id: "claim_awaiting_payment", name: "Claim Awaiting Payment", color: "orange", order: 3, customer_count: 0 },
              { id: "claim_closed",           name: "Claim Closed",           color: "green",  order: 4, customer_count: 0 },
            ]);
          }
        }
      } catch (err) {
        console.error("Error fetching statuses:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStatuses();
  }, [supabase, viewingTeamMember?.id]);

  // Load user's field visibility preferences from database
  useEffect(() => {
    const loadFieldPreferences = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prefs } = await supabase
        .from("user_preferences")
        .select("kanban_visible_fields")
        .eq("team_member_id", user.id)
        .single();

      if (prefs?.kanban_visible_fields) {
        setVisibleFields(prefs.kanban_visible_fields as typeof visibleFields);
      }
    };

    loadFieldPreferences();
  }, [supabase]);

  // Save field visibility preferences when they change
  useEffect(() => {
    const saveFieldPreferences = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("user_preferences")
        .update({
          kanban_visible_fields: visibleFields,
          updated_at: new Date().toISOString()
        })
        .eq("team_member_id", user.id);
    };

    saveFieldPreferences();
  }, [visibleFields, supabase]);

  // Load column widths from localStorage on mount
  useEffect(() => {
    const savedWidths = localStorage.getItem('kanban-column-widths');
    if (savedWidths) {
      try {
        setColumnWidths(JSON.parse(savedWidths));
      } catch (err) {
        console.error('Error loading column widths:', err);
      }
    }

    // REMOVED: Column visibility filtering - all columns always show
    // const savedVisible = localStorage.getItem('kanban-visible-columns');
    // if (savedVisible) {
    //   try {
    //     const parsed = JSON.parse(savedVisible);
    //     if (Array.isArray(parsed) && parsed.length > 0) {
    //       setVisibleColumns(parsed);
    //     }
    //   } catch (err) {
    //     console.error('Error loading visible columns:', err);
    //   }
    // }

    // Load card view mode
    const savedCardView = localStorage.getItem('kanban-card-view');
    if (savedCardView && (savedCardView === 'full' || savedCardView === 'compact')) {
      setCardView(savedCardView as 'full' | 'compact');
    }

    // Load inbox collapsed state
    const savedInboxCollapsed = localStorage.getItem('kanban-inbox-collapsed');
    if (savedInboxCollapsed) {
      setInboxCollapsed(savedInboxCollapsed === 'true');
    }

    // Load follow-up type filters
    const savedFollowUpFilters = localStorage.getItem('kanban-followup-filters');
    if (savedFollowUpFilters) {
      try {
        setFollowUpTypeFilter(JSON.parse(savedFollowUpFilters));
      } catch (err) {
        console.error('Error loading follow-up type filters:', err);
      }
    }

    // Load sorting preferences
    const savedSortBy = localStorage.getItem('kanban-sort-by');
    if (savedSortBy && ['business_name', 'next_follow_up_date', 'last_contact_date', 'created_at'].includes(savedSortBy)) {
      setSortBy(savedSortBy as typeof sortBy);
    }

    const savedSortDirection = localStorage.getItem('kanban-sort-direction');
    if (savedSortDirection && (savedSortDirection === 'asc' || savedSortDirection === 'desc')) {
      setSortDirection(savedSortDirection);
    }
  }, []);

  // Horizontal scroll indicators - detect scroll position
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateScrollState = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const hasOverflow = scrollWidth > clientWidth;
      setScrollState({
        left: scrollLeft > 20, // Show left shadow/arrow if scrolled right
        right: scrollLeft < scrollWidth - clientWidth - 20, // Show right shadow/arrow if more content exists
        hasOverflow, // Track if content overflows (needs scrolling)
      });
      console.log('[KanbanBoard] Scroll state:', { scrollLeft, scrollWidth, clientWidth, hasOverflow, left: scrollLeft > 20, right: scrollLeft < scrollWidth - clientWidth - 20 });
    };

    // Initial check
    updateScrollState();

    // Listen to scroll events
    container.addEventListener('scroll', updateScrollState);

    // Listen to resize events (in case viewport changes)
    window.addEventListener('resize', updateScrollState);

    return () => {
      container.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [statuses.length, customers.length, loading, isSidebarCollapsed, columnWidths]); // Re-run when columns/customers change or sidebar toggles

  // First-load scroll hint animation
  useEffect(() => {
    const hasSeenHint = localStorage.getItem('kanban-scroll-hint-seen');
    const container = scrollContainerRef.current;

    if (!hasSeenHint && container && statuses.length > 0) {
      // Check if content actually overflows (needs scrolling)
      const needsScrolling = container.scrollWidth > container.clientWidth;

      if (needsScrolling) {
        // Wait a moment for board to render
        const hintTimeout = setTimeout(() => {
          setShowScrollHint(true);

          // Animate scroll hint
          const scrollAmount = 150;
          container.scrollBy({ left: scrollAmount, behavior: 'smooth' });

          // Bounce back
          setTimeout(() => {
            container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });

            // Hide hint text after animation
            setTimeout(() => {
              setShowScrollHint(false);
              localStorage.setItem('kanban-scroll-hint-seen', 'true');
            }, 800);
          }, 700);
        }, 1000); // Delay initial hint by 1 second

        return () => clearTimeout(hintTimeout);
      }
    }
  }, [statuses.length, loading]); // Run after statuses load

  // Keyboard navigation for horizontal scrolling, column jumping, and card movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keys when not typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const container = scrollContainerRef.current;
      if (!container) return;

      // ----- Selected-card movement (arrow keys move the card itself) -----
      if (selectedCardId) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setSelectedCardId(null);
          return;
        }

        const selected = customers.find((c) => c.id === selectedCardId);
        if (!selected) {
          // Stale selection; clear it.
          setSelectedCardId(null);
          return;
        }

        const currentStatusIdx = statuses.findIndex(
          (s) =>
            s.id.toLowerCase() === selected.status.toLowerCase() ||
            s.name.toLowerCase() === selected.status.toLowerCase()
        );

        // Left / Right: move card to neighboring column (status change).
        // Inbox is read-only (cards only enter via imports), so skip it when
        // walking left across columns.
        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && currentStatusIdx !== -1) {
          e.preventDefault();
          const step = e.key === 'ArrowLeft' ? -1 : 1;
          let newIdx = currentStatusIdx + step;
          while (
            newIdx >= 0 &&
            newIdx < statuses.length &&
            statuses[newIdx].id.toLowerCase() === 'inbox'
          ) {
            newIdx += step;
          }
          if (newIdx < 0 || newIdx >= statuses.length) return;
          const targetStatus = statuses[newIdx];

          // Append to the bottom of the destination bucket
          const destBucket = customers.filter(
            (c) =>
              (c.status.toLowerCase() === targetStatus.id.toLowerCase() ||
                c.status.toLowerCase() === targetStatus.name.toLowerCase()) &&
              (selected.is_pinned ? c.is_pinned : !c.is_pinned)
          );
          const maxOrder = destBucket.reduce(
            (m, c) => Math.max(m, c.pin_order || 0),
            0
          );
          const newPinOrder = maxOrder + 1000;

          onStatusChange(selectedCardId, targetStatus.name);
          supabase
            .from("customers")
            .update({ pin_order: newPinOrder, updated_at: new Date().toISOString() })
            .eq("id", selectedCardId)
            .then(({ error }) => {
              if (error) console.error("Error updating pin order:", error);
            });
          setTimeout(() => {
            scrollToColumn(targetStatus.id);
            // Vertically scroll the card into view inside the destination column
            document
              .querySelector(`[data-customer-id="${selectedCardId}"]`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          }, 150);
          return;
        }

        // Up / Down: swap pin_order with neighbor inside the same bucket
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          // Always block browser scroll first — even if we end up not swapping.
          e.preventDefault();

          const bucket = customers
            .filter(
              (c) =>
                c.status.toLowerCase() === selected.status.toLowerCase() &&
                (selected.is_pinned ? c.is_pinned : !c.is_pinned)
            )
            .sort((a, b) => (a.pin_order ?? Number.MAX_SAFE_INTEGER) - (b.pin_order ?? Number.MAX_SAFE_INTEGER));
          const curIdx = bucket.findIndex((c) => c.id === selectedCardId);
          if (curIdx === -1) return;
          const newIdx = e.key === 'ArrowUp' ? curIdx - 1 : curIdx + 1;
          if (newIdx < 0 || newIdx >= bucket.length) return;

          // Build the post-swap order and reassign sequential pin_order values to
          // the WHOLE bucket. This is needed because most existing customers have
          // a null pin_order, so writing to only two of them would push them above
          // everyone else visually instead of swapping positions.
          const reordered = [...bucket];
          [reordered[curIdx], reordered[newIdx]] = [reordered[newIdx], reordered[curIdx]];

          const now = new Date().toISOString();
          Promise.all(
            reordered.map((c, i) =>
              supabase
                .from("customers")
                .update({ pin_order: i * 1000 + 500, updated_at: now })
                .eq("id", c.id)
            )
          ).then((results) => {
            const firstError = results.find((r) => r.error)?.error;
            if (firstError) console.error("Error updating pin order:", firstError);
          });
          // Vertically follow the card so it stays visible after the swap
          setTimeout(() => {
            document
              .querySelector(`[data-customer-id="${selectedCardId}"]`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          }, 150);
          return;
        }
      }

      // ----- Default: arrow keys scroll the board horizontally -----
      if (e.key === 'ArrowLeft' && scrollState.left) {
        e.preventDefault();
        scrollToDirection('left');
      } else if (e.key === 'ArrowRight' && scrollState.right) {
        e.preventDefault();
        scrollToDirection('right');
      } else if (e.key === 'Escape' && selectedCardId) {
        setSelectedCardId(null);
      }

      // Number keys 1-9 to jump to specific columns
      const numberKey = parseInt(e.key);
      if (numberKey >= 1 && numberKey <= 9 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        const columnIndex = numberKey - 1;
        if (columnIndex < statuses.length) {
          e.preventDefault();

          // Find the column element by status ID
          const statusId = statuses[columnIndex].id;
          const columnElement = container.querySelector(`[id="${statusId}"]`);

          if (columnElement) {
            // Scroll the column into view
            columnElement.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
              inline: 'start'
            });

            // Show brief highlight effect on the column
            // (Could add visual feedback here if desired)
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scrollState, statuses, selectedCardId, customers, onStatusChange]);

  // Smooth auto-scroll during drag with requestAnimationFrame
  useEffect(() => {
    if (!activeCustomer && !activeColumnId) return;

    let rafId: number;
    const edgeSize = 150; // Start scrolling when within 150px of edge (increased from typical 100px)
    const maxSpeed = 25; // Max pixels per frame (faster than typical 15-20px)

    // Exponential easing for natural acceleration
    const easeOutQuad = (t: number) => t * (2 - t);
    const easeInQuad = (t: number) => t * t;

    const smoothScroll = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = mousePosition.x;
      let scrollSpeed = 0;

      // Check if mouse is near left edge
      if (mouseX > 0 && mouseX < rect.left + edgeSize) {
        const distance = Math.min(1, (rect.left + edgeSize - mouseX) / edgeSize);
        scrollSpeed = -maxSpeed * easeInQuad(distance); // Exponential acceleration
      }
      // Check if mouse is near right edge
      else if (mouseX > rect.right - edgeSize) {
        const distance = Math.min(1, (mouseX - (rect.right - edgeSize)) / edgeSize);
        scrollSpeed = maxSpeed * easeInQuad(distance); // Exponential acceleration
      }

      // Apply scroll if needed
      if (scrollSpeed !== 0) {
        container.scrollLeft += scrollSpeed;
        rafId = requestAnimationFrame(smoothScroll);
      } else {
        rafId = requestAnimationFrame(smoothScroll); // Keep checking even when not scrolling
      }
    };

    rafId = requestAnimationFrame(smoothScroll);
    return () => cancelAnimationFrame(rafId);
  }, [activeCustomer, activeColumnId, mousePosition]);

  // Track mouse position during drag for auto-scroll
  useEffect(() => {
    if (!activeCustomer && !activeColumnId) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [activeCustomer, activeColumnId]);

  // REMOVED: Column visibility initialization - all columns always show
  // useEffect(() => {
  //   if (statuses.length > 0 && visibleColumns.length === 0) {
  //     const allColumnIds = statuses.map(s => s.id);
  //     setVisibleColumns(allColumnIds);
  //     localStorage.setItem('kanban-visible-columns', JSON.stringify(allColumnIds));
  //   }
  // }, [statuses, visibleColumns.length]);

  // REMOVED: Filter dropdown click handler - column visibility filtering removed

  // Handle column resize
  const handleResizeStart = (statusId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setResizingColumn(statusId);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnWidths[statusId] || 320); // Default 320px (lg:min-w-80 = 320px)
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingColumn) return;

    const deltaX = e.clientX - resizeStartX;
    const newWidth = Math.max(280, Math.min(600, resizeStartWidth + deltaX)); // Min 280px, Max 600px

    setColumnWidths(prev => {
      const updated = { ...prev, [resizingColumn]: newWidth };
      localStorage.setItem('kanban-column-widths', JSON.stringify(updated));
      return updated;
    });
  }, [resizingColumn, resizeStartX, resizeStartWidth]);

  const handleResizeEnd = useCallback(() => {
    setResizingColumn(null);
  }, []);

  // Add/remove mouse event listeners for resizing
  useEffect(() => {
    if (resizingColumn) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizingColumn, handleResizeMove, handleResizeEnd]);

  // REMOVED: Column visibility functions - all columns always show
  // const toggleColumnVisibility = (statusId: string) => { ... };
  // const showAllColumns = () => { ... };
  // const hideAllColumns = () => { ... };

  // Toggle inbox collapsed state
  const toggleInboxCollapsed = () => {
    setInboxCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem('kanban-inbox-collapsed', String(newState));
      return newState;
    });
  };

  // Toggle card view mode
  const toggleCardView = () => {
    setCardView(prev => {
      const newView = prev === 'full' ? 'compact' : 'full';
      localStorage.setItem('kanban-card-view', newView);
      return newView;
    });
  };

  // Toggle follow-up type filter
  const toggleFollowUpTypeFilter = (type: FollowUpType) => {
    setFollowUpTypeFilter((prev) => {
      const newFilters = prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type];
      localStorage.setItem('kanban-followup-filters', JSON.stringify(newFilters));
      return newFilters;
    });
  };

  const clearFollowUpTypeFilters = () => {
    setFollowUpTypeFilter([]);
    localStorage.removeItem('kanban-followup-filters');
  };

  const handleRenameStatus = async (statusId: string, oldName: string, newName: string) => {
    try {
      // Protect inbox status from being renamed
      if (statusId === "inbox") {
        alert("The Inbox status cannot be renamed. It's a protected column for new contacts.");
        return;
      }

      if (!newName.trim()) {
        alert("Status name cannot be empty");
        return;
      }

      if (statuses.some(s => s.id !== statusId && s.name.toLowerCase() === newName.trim().toLowerCase())) {
        alert("A status with this name already exists");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use the viewed teamMember's ID (admin/manager editing another team member's statuses)
      const targetTeamMemberId = viewingTeamMember?.id || user.id;

      // 1. Update the status in customer_statuses table
      const { error: statusError } = await supabase
        .from("customer_statuses")
        .update({ name: newName.trim(), updated_at: new Date().toISOString() })
        .eq("id", statusId);

      if (statusError) throw statusError;

      // 2. MIGRATION: Update all customers with this status name (for the target teamMember only)
      const { error: customersError } = await supabase
        .from("customers")
        .update({ status: newName.trim(), updated_at: new Date().toISOString() })
        .ilike("status", oldName)
        .eq("team_member_id", targetTeamMemberId);

      if (customersError) throw customersError;

      // 3. Update local state
      setStatuses(prev => prev.map(s =>
        s.id === statusId ? { ...s, name: newName.trim() } : s
      ));

      // 4. Immediately update parent's customer list so cards don't disappear
      // while waiting for real-time subscription to propagate the bulk DB update
      onStatusRenamed?.(oldName, newName.trim());

      setEditingStatusId(null);
      setEditingStatusName("");
    } catch (err) {
      console.error("Error renaming status:", err);
      alert("Failed to rename status. Please try again.");
    }
  };

  const handleDeleteStatus = async (statusId: string, statusName: string, customerCount: number) => {
    try {
      // Protect inbox status from being deleted
      if (statusId === "inbox") {
        alert("The Inbox status cannot be deleted. It's a protected column for new contacts.");
        return;
      }

      if (customerCount > 0) {
        alert(`Cannot delete "${statusName}" - it has ${customerCount} customer(s). Move them to another status first.`);
        return;
      }

      const confirmed = confirm(`Delete status "${statusName}"? This cannot be undone.`);
      if (!confirmed) return;

      const { error, data } = await supabase
        .from("customer_statuses")
        .delete()
        .eq("id", statusId)
        .select(); // Request deleted row to confirm deletion

      if (error) {
        console.error("Delete error:", error);
        alert(`Failed to delete status: ${error.message}`);
        return;
      }

      // Only update state if deletion succeeded
      if (data) {
        setStatuses(prev => prev.filter(s => s.id !== statusId));
        // Refetch from database to ensure consistency
        const { data: refreshedStatuses } = await supabase
          .from("customer_statuses")
          .select("id, name, color, order:order, customer_count:customers(count)")
          .order("order", { ascending: true });
        if (refreshedStatuses) {
          setStatuses(refreshedStatuses.map((s: any) => ({ ...s, customer_count: 0 })));
        }
      }
    } catch (err) {
      console.error("Error deleting status:", err);
      alert("Failed to delete status. Please try again.");
    }
  };

  const handleAddStatus = async () => {
    try {
      if (!newStatusName.trim()) {
        alert("Status name is required");
        return;
      }

      if (statuses.some(s => s.name.toLowerCase() === newStatusName.trim().toLowerCase())) {
        alert("A status with this name already exists");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use the viewed teamMember's ID (admin/manager adding a column to another team member's board)
      const targetTeamMemberId = viewingTeamMember?.id || user.id;

      const newStatus = {
        team_member_id: targetTeamMemberId,
        name: newStatusName.trim(),
        color: newStatusColor,
        order: statuses.length,
        is_system: false,
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from("customer_statuses")
        .insert(newStatus)
        .select()
        .single();

      if (error) throw error;

      setStatuses(prev => [...prev, { ...data, customer_count: 0 }]);
      setIsAddingStatus(false);
      setNewStatusName("");
      setNewStatusColor("blue");
    } catch (err) {
      console.error("Error adding status:", err);
      alert("Failed to add status. Please try again.");
    }
  };

  // Move column left or right programmatically
  const moveColumn = async (statusId: string, direction: 'left' | 'right') => {
    const currentIndex = statuses.findIndex(s => s.id === statusId);
    if (currentIndex === -1) return;

    // Determine new index based on direction
    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;

    // Validate bounds
    if (newIndex < 0 || newIndex >= statuses.length) return;

    // Reorder columns array
    const newStatuses = [...statuses];
    const [movedColumn] = newStatuses.splice(currentIndex, 1);
    newStatuses.splice(newIndex, 0, movedColumn);

    // Update order values
    const updatedStatuses = newStatuses.map((status, index) => ({
      ...status,
      order: index,
    }));

    setStatuses(updatedStatuses);

    // Persist to database
    try {
      for (const status of updatedStatuses) {
        await supabase
          .from('customer_statuses')
          .update({ order: status.order })
          .eq('id', status.id);
      }
    } catch (error) {
      console.error('Error updating column order:', error);
    }
  };

  useEffect(() => {
    const updatedStatuses = statuses.map((status) => ({
      ...status,
      customer_count: customers.filter(
        (c) =>
          normalizeStatusValue(c.status) === normalizeStatusValue(status.id) ||
          normalizeStatusValue(c.status) === normalizeStatusValue(status.name),
      ).length,
    }));
    setStatuses(updatedStatuses);
  }, [customers]);

  const getCustomersByStatus = (statusId: string, statusName: string) => {
    return customers.filter((c) => {
      // Status filter
      const matchesStatus =
        normalizeStatusValue(c.status) === normalizeStatusValue(statusId) ||
        normalizeStatusValue(c.status) === normalizeStatusValue(statusName);

      if (!matchesStatus) return false;

      // Source filter (case-insensitive, trimmed comparison)
      if (sourceFilter.length > 0) {
        if (!c.import_source) {
          return false;
        }
        const customerSource = c.import_source.trim().toLowerCase();
        if (!sourceFilter.some(s => s.trim().toLowerCase() === customerSource)) {
          return false;
        }
      }

      // Timezone filter
      if (timezoneFilter && timezoneFilter !== "all") {
        if (timezoneMode === "phone") {
          // Phone area code mode: check all available phone fields
          const phoneFields = [c.phone, (c as any).phone_2, (c as any).phone_3].filter(Boolean);
          const customerTimezone = phoneFields.reduce<string | null>(
            (found, ph) => found ?? getTimezoneByPhone(ph as string),
            null
          );
          if (!customerTimezone || customerTimezone !== timezoneFilter) {
            return false;
          }
        } else {
          // Address mode (default): use state field
          const customerState = c.state?.trim().toUpperCase();
          if (!customerState) {
            return false;
          }
          const customerTimezone = STATE_TIMEZONES[customerState];
          if (customerTimezone !== timezoneFilter) {
            return false;
          }
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const searchableText = [
          c.customer_id,
          c.business_name,
          c.first_name,
          c.last_name,
          getCustomerDisplayName(c),
          c.industry,
          c.city,
          c.state,
          c.email,
          c.phone,
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
  };

  const getColumnColor = (color: string) => {
    const colors: Record<string, string> = {
      blue: "border-blue-200 bg-blue-50",
      green: "border-green-200 bg-green-50",
      amber: "border-amber-200 bg-amber-50",
      orange: "border-orange-200 bg-orange-50",
      red: "border-red-200 bg-red-50",
      yellow: "border-yellow-200 bg-yellow-50",
      slate: "border-slate-200 bg-slate-50",
      pink: "border-pink-200 bg-pink-50",
    };
    return colors[color] || colors.blue;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;

    // Check if dragging a column or a customer
    const columnData = active.data.current?.column;
    const customerData = active.data.current?.customer as Customer;

    if (columnData) {
      // Dragging a column
      setActiveColumnId(active.id as string);
    } else if (customerData) {
      // Dragging a customer
      setActiveCustomer(customerData);
    }

    // Cancel any active column editing to prevent interference
    if (editingStatusId) {
      setEditingStatusId(null);
      setEditingStatusName("");
    }
  };

  const openNoteModal = (customer: Customer) => {
    setNoteCustomer(customer);
    setNoteText("");
    setNoteFollowUpDate("");
    setNoteAddToCalendar(false);
    setNoteFollowUpType("");
    setShowNoteModal(true);
  };

  const handleShare = (customer: Customer) => {
    setShareCustomer(customer);
    setShowShareModal(true);
  };

  const handleRemoveClick = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setCustomerToRemove(customer);
      setShowRemoveConfirmModal(true);
    }
  };

  const handleConfirmRemove = () => {
    if (customerToRemove && onRemoveFromBoard) {
      onRemoveFromBoard(customerToRemove.id);
    }
    setShowRemoveConfirmModal(false);
    setCustomerToRemove(null);
  };

  const handleQuickMove = (customerId: string, newStatusName: string) => {
    // Use the existing onStatusChange callback which handles the database update
    onStatusChange(customerId, newStatusName);

    // Scroll to show the destination column
    setTimeout(() => scrollToColumn(newStatusName), 100); // Small delay for state update
  };

  const handleSaveNote = () => {
    if (!noteCustomer) return;
    const followUpDate =
      noteAddToCalendar && noteFollowUpDate
        ? new Date(noteFollowUpDate).toISOString()
        : undefined;

    const followUpType = noteAddToCalendar
      ? noteFollowUpType || "follow_up"
      : undefined;

    onAddNote(noteCustomer.id, noteText.trim(), followUpDate, followUpType);
    if (followUpDate) {
      // Also trigger schedule action so calendar view reflects change
      onQuickAction("schedule", noteCustomer);
    }

    setShowNoteModal(false);
    setNoteCustomer(null);
    setNoteText("");
    setNoteFollowUpDate("");
    setNoteAddToCalendar(false);
    setNoteFollowUpType("");
  };

  const handleDragOver = (event: any) => {
    // Intentionally minimal - just for DndKit event handling
  };

  const handleDragCancel = () => {
    setActiveCustomer(null);
    setActiveColumnId(null);
  };

  const collisionDetectionStrategy = useCallback(
    (args: Parameters<typeof closestCorners>[0]) => {
      if (activeColumnId) {
        return closestCorners(args);
      }

      const pointerHits = pointerWithin(args);
      if (pointerHits.length > 0) {
        return pointerHits;
      }

      return closestCorners(args);
    },
    [activeColumnId],
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || over.id === active.id) {
      // No drop target or dropped on self - cancel silently
      setActiveCustomer(null);
      setActiveColumnId(null);
      return;
    }

    // Handle column reordering
    if (activeColumnId) {
      const oldIndex = statuses.findIndex((s) => s.id === active.id);
      const newIndex = statuses.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        // Reorder columns array
        const newStatuses = [...statuses];
        const [movedColumn] = newStatuses.splice(oldIndex, 1);
        newStatuses.splice(newIndex, 0, movedColumn);

        // Update order values
        const updatedStatuses = newStatuses.map((status, index) => ({
          ...status,
          order: index,
        }));

        setStatuses(updatedStatuses);

        // Persist to database
        try {
          for (const status of updatedStatuses) {
            await supabase
              .from('kanban_board_statuses')
              .update({ order: status.order })
              .eq('id', status.id);
          }
        } catch (error) {
          console.error('Error updating column order:', error);
        }
      }

      setActiveColumnId(null);
      return;
    }

    // Handle customer drag and drop (existing logic)
    const draggedCustomer = active.data.current?.customer as Customer;
    if (!draggedCustomer) {
      setActiveCustomer(null);
      return;
    }

    const overId = over.id as string;

    // Check if dragging over another customer card or a column
    const overCustomer = customers.find((c) => c.id === overId);

    if (overCustomer) {
      // Dragging over another customer - reorder within same column

      // If dropping unpinned on pinned, find first unpinned card in that column instead
      let targetCustomer = overCustomer;
      if (overCustomer.is_pinned && !draggedCustomer.is_pinned) {
        const firstUnpinned = customers.find(
          (c) => c.status === overCustomer.status && !c.is_pinned
        );
        if (firstUnpinned) {
          targetCustomer = firstUnpinned;
        } else {
          // No unpinned cards yet in this column, treat as column drop instead
          const targetStatus = statuses.find(
            (s) =>
              s.id.toLowerCase() === overCustomer.status.toLowerCase() ||
              s.name.toLowerCase() === overCustomer.status.toLowerCase()
          );
          if (targetStatus) {
            onStatusChange(draggedCustomer.id, targetStatus.name);
            // Scroll to show the destination column
            setTimeout(() => scrollToColumn(targetStatus.id), 100);
          }
          setActiveCustomer(null);
          return;
        }
      }

      // If same status, update pin_order for reordering
      if (draggedCustomer.status === targetCustomer.status) {
        // Calculate new pin order based on position
        const sameStatusCustomers = customers
          .filter((c) => c.status === draggedCustomer.status)
          .filter((c) =>
            draggedCustomer.is_pinned ? c.is_pinned : !c.is_pinned,
          )
          .sort((a, b) => (a.pin_order || 0) - (b.pin_order || 0));

        const overIndex = sameStatusCustomers.findIndex(
          (c) => c.id === targetCustomer.id,
        );
        const newPinOrder = overIndex * 1000 + 500; // Space orders out

        // Update the dragged customer's pin_order in database
        supabase
          .from("customers")
          .update({ pin_order: newPinOrder, updated_at: new Date().toISOString() })
          .eq("id", draggedCustomer.id)
          .then(({ error }) => {
            if (error) console.error("Error updating pin order:", error);
          });

        setActiveCustomer(null);
        return;
      }

      // Dragging over customer in DIFFERENT column - move to that column AND
      // place the card at the dropped position by computing its new pin_order.
      const targetStatus = statuses.find(
        (s) =>
          normalizeStatusValue(s.id) === normalizeStatusValue(overCustomer.status) ||
          normalizeStatusValue(s.name) === normalizeStatusValue(overCustomer.status)
      );

      if (targetStatus) {
        // Find target customer's position within the destination bucket
        // (pinned vs. unpinned matches the dragged card's pinned state)
        const destBucket = customers
          .filter(
            (c) =>
              (normalizeStatusValue(c.status) === normalizeStatusValue(targetStatus.id) ||
                normalizeStatusValue(c.status) === normalizeStatusValue(targetStatus.name)) &&
              (draggedCustomer.is_pinned ? c.is_pinned : !c.is_pinned)
          )
          .sort((a, b) => (a.pin_order || 0) - (b.pin_order || 0));
        const overIdx = destBucket.findIndex((c) => c.id === targetCustomer.id);
        const insertIdx = overIdx >= 0 ? overIdx : destBucket.length;
        const newPinOrder = insertIdx * 1000 + 500;

        onStatusChange(draggedCustomer.id, targetStatus.name);
        supabase
          .from("customers")
          .update({ pin_order: newPinOrder, updated_at: new Date().toISOString() })
          .eq("id", draggedCustomer.id)
          .then(({ error }) => {
            if (error) console.error("Error updating pin order:", error);
          });

        // Scroll to show the destination column
        setTimeout(() => scrollToColumn(targetStatus.id), 100);
      }

      setActiveCustomer(null);
      return;
    }

    // Dragging over a column (empty space) - change status and append to bottom
    const newStatusId = overId as string;
    const targetStatus = statuses.find(
      (s) =>
        normalizeStatusValue(s.id) === normalizeStatusValue(newStatusId) ||
        normalizeStatusValue(s.name) === normalizeStatusValue(newStatusId)
    );
    if (targetStatus) {
      const destBucket = customers.filter(
        (c) =>
          (normalizeStatusValue(c.status) === normalizeStatusValue(targetStatus.id) ||
            normalizeStatusValue(c.status) === normalizeStatusValue(targetStatus.name)) &&
          (draggedCustomer.is_pinned ? c.is_pinned : !c.is_pinned)
      );
      const maxOrder = destBucket.reduce(
        (m, c) => Math.max(m, c.pin_order || 0),
        0
      );
      const newPinOrder = maxOrder + 1000;

      onStatusChange(draggedCustomer.id, targetStatus.name);
      supabase
        .from("customers")
        .update({ pin_order: newPinOrder, updated_at: new Date().toISOString() })
        .eq("id", draggedCustomer.id)
        .then(({ error }) => {
          if (error) console.error("Error updating pin order:", error);
        });

      // Scroll to show the destination column
      setTimeout(() => scrollToColumn(targetStatus.id), 100);
    }
    setActiveCustomer(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragCancel={handleDragCancel}
    >
      {/* Board Header - Cleaner, more minimal */}
      <div className="mb-1 flex items-center justify-between border-b border-slate-200 bg-white px-4 pb-1.5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Claims Board
          </h2>
          {/* <p className="text-xs text-slate-500">
            {loading
              ? "Loading..."
              : `${statuses.reduce((sum, s) => sum + s.customer_count, 0)} customers across ${statuses.length} stages`}
          </p> */}
        </div>
        <div className="flex items-center gap-2">
          {/* Card View Toggle */}
          <div className="flex rounded border border-slate-300 bg-white">
            <button
              onClick={() => cardView === 'compact' && toggleCardView()}
              className={`flex h-8 items-center gap-1 px-2.5 text-xs font-medium transition-colors ${cardView === 'full'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              title="Full card view"
            >
              <SquareStack className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Full</span>
            </button>
            <button
              onClick={() => cardView === 'full' && toggleCardView()}
              className={`flex h-8 items-center gap-1 border-l border-slate-300 px-2.5 text-xs font-medium transition-colors ${cardView === 'compact'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              title="Compact card view"
            >
              <Square className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Compact</span>
            </button>
          </div>

          {/* Field Visibility Menu */}
          <div className="relative">
            <button
              onClick={() => setShowFieldsMenu(!showFieldsMenu)}
              className="flex h-8 items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
              title="Show/hide card fields"
            >
              <SquareStack className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Fields</span>
            </button>

            {showFieldsMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowFieldsMenu(false)} />
                <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-200 px-4 py-2">
                    <p className="text-sm font-semibold text-slate-900">Show/Hide Fields</p>
                  </div>
                  <div className="p-2 space-y-1">
                    {[
                      { key: 'contactName', label: 'Contact Name' },
                      { key: 'phone', label: 'Phone' },
                      { key: 'email', label: 'Email' },
                      { key: 'industry', label: 'Industry' },
                      { key: 'location', label: 'Location' },
                      { key: 'links', label: 'Search Links' },
                      { key: 'shippingFrequency', label: 'Shipping Frequency' },
                      { key: 'lastContact', label: 'Last Contact' },
                      { key: 'nextFollowUp', label: 'Next Follow-Up' },
                      { key: 'importSource', label: 'Source' },
                      { key: 'notes', label: 'Notes Count' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visibleFields[key as keyof typeof visibleFields]}
                          onChange={(e) => setVisibleFields({ ...visibleFields, [key]: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-sm text-slate-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {canManageViewedBoard && (
            <button
              onClick={() => setIsAddingStatus(true)}
              disabled={loading}
              className="flex h-8 items-center gap-1.5 rounded bg-orange-500 px-2.5 text-xs font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              title="Add new status column"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add Column</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State - Only show when no columns configured (brand new board) */}
      {!loading && statuses.length === 0 && (
        <div className="mx-4 rounded-lg border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <List className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">
            Your Focused Workspace is Empty
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            The Kanban board shows only the contacts you want to focus on.
            <br />
            Add contacts from your full list to start working.
          </p>
          <a
            href="/dashboard/customers/list"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-orange-600"
          >
            <List className="h-4 w-4" />
            Go to List View
            <ArrowRight className="h-4 w-4" />
          </a>
          <p className="mt-4 text-xs text-slate-500">
            Tip: Use the green Kanban icon <Kanban className="inline-block h-4 w-4 text-green-600" /> in List View to add contacts to your board
          </p>
        </div>
      )}

      {/* Kanban Columns - All columns always visible */}
      {!loading && statuses.length > 0 && (
        <div className="relative">
          {/* Scroll gradient shadows */}
          {scrollState.left && (
            <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-12 bg-linear-to-r from-slate-50 to-transparent" />
          )}
          {scrollState.right && (
            <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-12 bg-linear-to-l from-slate-50 to-transparent" />
          )}

          {/* Navigation arrow buttons - Desktop only */}
          {scrollState.left && (
            <button
              onClick={() => scrollToDirection('left')}
              className="fixed top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-white p-3 shadow-lg transition-all hover:bg-slate-50 hover:shadow-xl lg:block"
              style={{ left: isSidebarCollapsed ? '4.5rem' : '14.5rem' }} // Dynamic left position based on sidebar state
              aria-label="Scroll to previous columns"
              title="Scroll left (or use ← arrow key)"
            >
              <ChevronLeft className="h-5 w-5 text-slate-700" />
            </button>
          )}
          {scrollState.right && (
            <button
              onClick={() => scrollToDirection('right')}
              className="fixed right-4 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-white p-3 shadow-lg transition-all hover:bg-slate-50 hover:shadow-xl lg:block"
              aria-label="Scroll to next columns"
              title="Scroll right (or use → arrow key)"
            >
              <ChevronRight className="h-5 w-5 text-slate-700" />
            </button>
          )}

          {/* Scroll hint overlay */}
          {showScrollHint && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <div className="animate-pulse rounded-lg bg-slate-900/90 px-6 py-3 shadow-xl">
                <p className="flex items-center gap-2 text-sm font-medium text-white">
                  <ChevronLeft className="h-4 w-4" />
                  Swipe to see more columns
                  <ChevronRight className="h-4 w-4" />
                </p>
              </div>
            </div>
          )}

          {/* Interaction tips - accordion, collapsed by default */}
          {showInteractionTips && (
            <div className="mx-4 mb-1.5 rounded-md border border-primary/30 bg-primary/5 text-xs text-slate-700">
              <div className="flex items-center justify-between gap-2 px-3 py-1">
                <button
                  type="button"
                  onClick={() => setTipsExpanded((v) => !v)}
                  className="flex flex-1 items-center gap-2 text-left text-slate-700 hover:text-slate-900"
                  aria-expanded={tipsExpanded}
                  aria-controls="kanban-tips-content"
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-primary transition-transform ${tipsExpanded ? 'rotate-180' : ''}`}
                  />
                  <span className="font-medium">Keyboard shortcuts & tips</span>
                  {!tipsExpanded && (
                    <span className="hidden text-slate-500 sm:inline">
                      Click to expand
                    </span>
                  )}
                </button>
                <button
                  onClick={dismissInteractionTips}
                  className="rounded p-0.5 text-slate-500 hover:bg-primary/10 hover:text-slate-900"
                  title="Dismiss tips"
                  aria-label="Dismiss tips"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {tipsExpanded && (
                <div
                  id="kanban-tips-content"
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-primary/30 px-3 py-2"
                >
                  <span className="flex items-center gap-1.5">
                    <ChevronsDown className="h-3.5 w-3.5 text-primary" />
                    <span><span className="font-semibold">Click a card</span> to see its full details</span>
                  </span>
                  <span className="hidden h-3 w-px bg-primary/30 sm:inline-block" />
                  <span className="flex items-center gap-1.5">
                    <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-700 shadow-sm">←</kbd>
                    <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-700 shadow-sm">→</kbd>
                    <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-700 shadow-sm">↑</kbd>
                    <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-700 shadow-sm">↓</kbd>
                    <span>move the selected card between columns and rows</span>
                  </span>
                  <span className="hidden h-3 w-px bg-primary/30 sm:inline-block" />
                  <span className="flex items-center gap-1.5">
                    <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-700 shadow-sm">Esc</kbd>
                    <span>deselects</span>
                  </span>
                </div>
              )}
            </div>
          )}

          <div
            ref={scrollContainerRef}
            className="overflow-x-auto scroll-smooth"
            data-tour="kanban-board"
            style={{
              WebkitOverflowScrolling: 'touch',
              maxHeight: 'calc(100vh - 140px)', // Reclaimed height from tighter header & accordion tips
            }}
          >
            <SortableContext items={statuses.map(s => s.id)} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-0 px-4 lg:min-w-min">
                {statuses
                  .map((status, index) => {
                    const statusCustomers = getCustomersByStatus(
                      status.id,
                      status.name,
                    );

                    return (
                      <SortableColumnWrapper
                        key={status.id}
                        id={status.id}
                        className={
                          index < statuses.length - 1 ? "border-r border-slate-200" : ""
                        }
                      >
                        {(dragHandleProps) => (
                          <KanbanColumn
                            title={status.name}
                            status={status.id}
                            statusId={status.id}
                            customers={statusCustomers}
                            count={statusCustomers.length}
                            customerCount={status.customer_count}
                            keyboardShortcut={index + 1}
                            isEditing={editingStatusId === status.id}
                            editingName={editingStatusName}
                            onStartEdit={() => {
                              setEditingStatusId(status.id);
                              setEditingStatusName(status.name);
                            }}
                            onCancelEdit={() => {
                              setEditingStatusId(null);
                              setEditingStatusName("");
                            }}
                            onSaveEdit={(newName) => handleRenameStatus(status.id, status.name, newName)}
                            onDeleteStatus={handleDeleteStatus}
                            onPin={onPin}
                            onEdit={onEdit}
                            onQuickAction={onQuickAction}
                            onAddCustomer={onAddCustomer}
                            activeCustomerId={activeCustomer?.id || null}
                            onOpenNotes={openNoteModal}
                            onRemoveFromBoard={handleRemoveClick}
                            onShare={handleShare}
                            onQuickMove={handleQuickMove}
                            availableStatuses={statuses}
                            width={columnWidths[status.id]}
                            onResizeStart={handleResizeStart}
                            isResizing={resizingColumn === status.id}
                            compact={cardView === 'compact'}
                            isCollapsed={status.id === 'inbox' ? inboxCollapsed : false}
                            onToggleCollapse={status.id === 'inbox' ? toggleInboxCollapsed : undefined}
                            canManageBoard={canManageViewedBoard}
                            dragHandleProps={dragHandleProps}
                            onMoveColumn={(direction) => moveColumn(status.id, direction)}
                            canMoveLeft={index > 0}
                            canMoveRight={index < statuses.length - 1}
                            selectedCardId={selectedCardId}
                            onSelectCard={setSelectedCardId}
                            visibleFields={visibleFields}
                          />
                        )}
                      </SortableColumnWrapper>
                    );
                  })}

                {/* Add Column Button - Appears in empty space - only for users who can manage */}
                {canManageViewedBoard && (
                  <div className="flex h-[calc(100vh-12rem)] w-full lg:min-w-80">
                    <button
                      onClick={() => setIsAddingStatus(true)}
                      className="group flex w-full flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 bg-slate-50 transition-all hover:border-primary/60 hover:bg-primary/5 hover:shadow-sm"
                      title="Add new column"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border-2 border-slate-300 transition-all group-hover:border-primary group-hover:bg-primary group-hover:text-white shadow-sm">
                        <Plus className="h-6 w-6 text-slate-400 transition-colors group-hover:text-white" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-slate-600 group-hover:text-primary-text transition-colors">
                          Add Column
                        </p>
                        <p className="text-xs text-slate-500 group-hover:text-primary transition-colors">
                          Create a new status
                        </p>
                      </div>
                    </button>

                  </div>
                )}
              </div>
            </SortableContext>

          </div>

        </div>
      )}

      {/* Drag Overlay */}
      <DragOverlay>
        {activeCustomer ? (
          <CustomerCard
            customer={activeCustomer}
            onPin={() => { }}
            onEdit={() => { }}
            onQuickAction={() => { }}
            compact={cardView === 'compact'}
            visibleFields={visibleFields}
          />
        ) : activeColumnId ? (
          <div className="h-64 w-80 rounded-lg bg-white shadow-2xl border-2 border-primary opacity-80">
            <div className="border-b border-slate-200 bg-slate-50 p-4">
              <div className="font-semibold text-slate-900">
                {statuses.find(s => s.id === activeColumnId)?.name || 'Column'}
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>

      {/* Notes Modal */}
      {showNoteModal && noteCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div>
                <div className="text-sm text-slate-500">Add note for</div>
                <div className="font-semibold text-slate-900">
                  {noteCustomer.business_name}
                </div>
                <div className="text-sm text-slate-600">
                  {getCustomerDisplayName(noteCustomer) || '-'}
                </div>
              </div>
              <button
                onClick={() => setShowNoteModal(false)}
                className="h-9 w-9 rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Note
                </label>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-20"
                  placeholder="Log a quick note..."
                />
              </div>

              <div className="flex items-start gap-3">
                <input
                  id="add-to-calendar"
                  type="checkbox"
                  checked={noteAddToCalendar}
                  onChange={(e) => setNoteAddToCalendar(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                />
                <div className="flex-1">
                  <label
                    htmlFor="add-to-calendar"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Add to calendar
                  </label>
                  <p className="text-xs text-slate-500">
                    Optional follow-up date to show in Calendar view.
                  </p>
                  {noteAddToCalendar && (
                    <div className="mt-2 space-y-3">
                      <input
                        type="date"
                        value={noteFollowUpDate}
                        onChange={(e) => setNoteFollowUpDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-20"
                      />

                      <div className="grid grid-cols-2 gap-2 text-sm text-slate-700">
                        {["call", "email", "online_meeting", "follow_up"].map(
                          (type) => {
                            const typed = type as FollowUpType;
                            const styles = followUpTypeStyles[typed];

                            return (
                              <label
                                key={type}
                                className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-sm font-medium transition-colors hover:bg-slate-50 ${styles.badge} ${noteFollowUpType === typed ? "ring-2 ring-orange-500 ring-opacity-30" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={noteFollowUpType === typed}
                                  onChange={() =>
                                    setNoteFollowUpType((prev) =>
                                      prev === typed ? "" : typed,
                                    )
                                  }
                                  className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                                />
                                <span
                                  className={`h-2.5 w-2.5 rounded-full ${styles.dot}`}
                                />
                                <span className="capitalize">
                                  {type.replace("_", " ")}
                                </span>
                              </label>
                            );
                          },
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
              <button
                onClick={() => setShowNoteModal(false)}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNote}
                className="h-10 rounded-lg bg-orange-500 px-4 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
                disabled={!noteText.trim() && !noteFollowUpDate}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove from Board Confirmation Modal */}
      {showRemoveConfirmModal && customerToRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Remove from Board?
              </h3>
              <button
                onClick={() => {
                  setShowRemoveConfirmModal(false);
                  setCustomerToRemove(null);
                }}
                className="h-9 w-9 rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              <p className="mb-4 text-sm text-slate-700">
                Are you sure you want to remove{" "}
                <span className="font-semibold">{customerToRemove.business_name}</span>{" "}
                from the Kanban board?
              </p>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This contact will be moved to{" "}
                  <span className="font-semibold">"My Assigned Contacts"</span> in the Import page.
                  You can add it back to the board anytime.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
              <button
                onClick={() => {
                  setShowRemoveConfirmModal(false);
                  setCustomerToRemove(null);
                }}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                className="h-10 rounded-lg bg-red-500 px-4 text-sm font-medium text-white transition-colors hover:bg-red-600"
              >
                Remove from Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Status Modal */}
      {isAddingStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b border-slate-200 p-4">
              <h3 className="text-lg font-semibold text-slate-900">Add New Column</h3>
              <p className="mt-1 text-sm text-slate-600">
                Create a custom status column for your pipeline
              </p>
            </div>

            <div className="space-y-4 p-4">
              {/* Status Name */}
              <div>
                <label htmlFor="new-status-name" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Status Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="new-status-name"
                  type="text"
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddStatus();
                    else if (e.key === "Escape") {
                      setIsAddingStatus(false);
                      setNewStatusName("");
                      setNewStatusColor("blue");
                    }
                  }}
                  placeholder="e.g., Documenting, Settlement, etc."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  autoFocus
                />
              </div>

              {/* Color Picker */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Column Color
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {["blue", "green", "orange", "red", "purple", "pink", "yellow", "teal", "indigo", "gray"].map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewStatusColor(color)}
                      className={`h-10 w-10 rounded-lg border-2 transition-all ${newStatusColor === color
                        ? "scale-110 border-slate-900 shadow-lg"
                        : "border-slate-300 hover:border-slate-400"
                        }`}
                      style={{
                        backgroundColor:
                          color === "blue" ? "#3B82F6" :
                            color === "green" ? "#10B981" :
                              color === "orange" ? "#F97316" :
                                color === "red" ? "#EF4444" :
                                  color === "purple" ? "#A855F7" :
                                    color === "pink" ? "#EC4899" :
                                      color === "yellow" ? "#EAB308" :
                                        color === "teal" ? "#14B8A6" :
                                          color === "indigo" ? "#6366F1" :
                                            "#6B7280"
                      }}
                      title={color}
                      aria-label={`Select ${color} color`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
              <button
                onClick={() => {
                  setIsAddingStatus(false);
                  setNewStatusName("");
                  setNewStatusColor("blue");
                }}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStatus}
                disabled={!newStatusName.trim()}
                className="h-10 rounded-lg bg-orange-500 px-4 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Customer Modal */}
      {showShareModal && shareCustomer && (
        <ShareCustomerModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setShareCustomer(null);
          }}
          customer={shareCustomer}
          currentTeamMemberId={currentTeamMemberId || ""}
        />
      )}
    </DndContext>
  );
}
