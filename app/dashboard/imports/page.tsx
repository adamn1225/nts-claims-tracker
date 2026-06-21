"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTeamMemberView } from "@/contexts/TeamMemberViewContext";
import DesktopOnlyView from "@/components/DesktopOnlyView";
import { useIsMobileOrTablet } from "@/lib/hooks/useMediaQuery";
import { Info, GripVertical } from "lucide-react";
import Tooltip from "@/components/Tooltip";
import UserEmailTemplateEditor from "@/components/UserEmailTemplateEditor";
import AiCommandAssistant from "@/components/admin/AiCommandAssistant";
import { canExportData, type TeamMemberPermissions } from "@/lib/permissions";
// Notification API routes (server-side only for security)
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Upload,
  Users,
  User,
  Filter,
  Download,
  UserPlus,
  Building2,
  MapPin,
  Briefcase,
  ChevronDown,
  X,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  Mail,
  Trash2,
  TrendingUp,
  Search,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";

type UnassignedContact = {
  id: string;
  business_name: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  shipping_frequency: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  team_member_id: string | null;
  on_kanban_board: boolean | null;
  import_source: string | null;
  notes: string | null;
  import_metadata: Record<string, any> | null;
  created_at: string;
  updated_at?: string;
  status?: string;
};

type TeamMember = {
  id: string;
  first_name: string;
  last_name?: string;
  email: string;
  office_location: string | null;
  is_manager: boolean;
  is_admin: boolean;
  is_remote: boolean | null;
  is_active: boolean;
};

export default function ToolsPage() {
  const { viewingTeamMember } = useTeamMemberView();
  const isMobileOrTablet = useIsMobileOrTablet();
  const [activeTab, setActiveTab] = useState<
    "import" | "distribute" | "distributed" | "reassign" | "limbo" | "ai-distribute"
  >("import");
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null);
  const [unassignedContacts, setUnassignedContacts] = useState<
    UnassignedContact[]
  >([]);
  const [limboContacts, setLimboContacts] = useState<
    UnassignedContact[]
  >([]);
  const [distributedContacts, setDistributedContacts] = useState<
    UnassignedContact[]
  >([]);
  const [reassignContacts, setReassignContacts] = useState<
    UnassignedContact[]
  >([]);
  const [selectedReassignTeamMember, setSelectedReassignTeamMember] = useState<string>("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(
    new Set(),
  );
  const [selectAllFiltered, setSelectAllFiltered] = useState<boolean>(false);
  const [selectedLimboContacts, setSelectedLimboContacts] = useState<Set<string>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterIndustries, setFilterIndustries] = useState<string[]>([]);
  const [filterStates, setFilterStates] = useState<string[]>([]);
  const [filterSources, setFilterSources] = useState<string[]>([]);
  const [filterHighValue, setFilterHighValue] = useState<boolean>(false);
  const [minDispatches, setMinDispatches] = useState<number>(5);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    businessName: 200,
    contactName: 180,
    phone: 120,
    email: 200,
    industry: 150,
    location: 150,
    links: 100,
    source: 180,
    dispatches: 100,
    valueScore: 100,
    added: 120,
    assignedTo: 150,
  });
  const [columnOrder, setColumnOrder] = useState([
    'businessName',
    'contactName',
    'phone',
    'email',
    'industry',
    'location',
    'links',
    'source',
    'dispatches',
    'valueScore',
    'added',
    'assignedTo',
  ]);
  const [resizing, setResizing] = useState<{ column: string; startX: number; startWidth: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSimpleImportModal, setShowSimpleImportModal] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [editingCell, setEditingCell] = useState<{ contactId: string, field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [showBulkSourceEdit, setShowBulkSourceEdit] = useState(false);
  const [bulkSourceValue, setBulkSourceValue] = useState<string>("");
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [permissions, setPermissions] = useState<TeamMemberPermissions | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [visibleColumns, setVisibleColumns] = useState({
    businessName: true,
    contactName: true,
    phone: false,
    email: false,
    industry: false,
    location: true,
    links: false,
    source: true,
    dispatches: false,
    valueScore: false,
    added: false,
    assignedTo: true,
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadData();
  }, []);

  // Reload data when viewing team member changes
  useEffect(() => {
    if (viewingTeamMember) {
      loadData();
    }
  }, [viewingTeamMember]);

  // Load user column preferences
  useEffect(() => {
    const loadColumnPreferences = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prefs } = await supabase
        .from("user_preferences")
        .select("imports_column_order, imports_visible_columns")
        .eq("team_member_id", user.id)
        .single();

      if (prefs) {
        if (prefs.imports_column_order) {
          setColumnOrder(prefs.imports_column_order as string[]);
        }
        if (prefs.imports_visible_columns) {
          setVisibleColumns(prefs.imports_visible_columns as typeof visibleColumns);
        }
      }
    };

    loadColumnPreferences();
  }, []);

  // Save column order when it changes
  useEffect(() => {
    const saveColumnOrder = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("user_preferences")
        .update({
          imports_column_order: columnOrder,
          updated_at: new Date().toISOString()
        })
        .eq("team_member_id", user.id);
    };

    // Only save if columnOrder has been modified (not initial load)
    if (columnOrder.length > 0) {
      saveColumnOrder();
    }
  }, [columnOrder]);

  // Save column visibility when it changes
  useEffect(() => {
    const saveVisibleColumns = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("user_preferences")
        .update({
          imports_visible_columns: visibleColumns,
          updated_at: new Date().toISOString()
        })
        .eq("team_member_id", user.id);
    };

    saveVisibleColumns();
  }, [visibleColumns]);

  // Clear selections when switching tabs
  useEffect(() => {
    setSelectedContacts(new Set());
    setSelectAllFiltered(false);
    setSelectedLimboContacts(new Set());
  }, [activeTab]);

  // Real-time subscriptions for customer changes
  useEffect(() => {
    if (!currentUser) return;

    const supabase = createClient();

    // Subscribe to unassigned contacts (team_member_id is null)
    const unassignedChannel = supabase
      .channel('unassigned-contacts')
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customers",
          filter: "team_member_id=is.null",
        },
        async (payload) => {
          console.log("Real-time unassigned contact change:", payload);
          if (activeTab === "distribute") {
            await loadData();
          }
        }
      )
      .subscribe();

    // Subscribe to distributed contacts (assigned to viewing team member)
    const teamMemberId = viewingTeamMember?.id || currentUser.id;
    const distributedChannel = supabase
      .channel(`distributed-contacts:${teamMemberId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customers",
          filter: `team_member_id=eq.${teamMemberId}`,
        },
        async (payload) => {
          console.log("Real-time distributed contact change:", payload);
          if (activeTab === "distributed" || activeTab === "reassign") {
            await loadData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(unassignedChannel);
      supabase.removeChannel(distributedChannel);
    };
  }, [currentUser, viewingTeamMember, activeTab]);


  const loadReassignData = async (teamMemberId: string) => {
    if (!teamMemberId) {
      setReassignContacts([]);
      return;
    }

    const supabase = createClient();

    // Fetch ALL contacts for the team member with pagination
    let reassignData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("team_member_id", teamMemberId)
        .order("updated_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error("Error fetching reassign contacts:", error);
        break;
      }

      if (data && data.length > 0) {
        reassignData = [...reassignData, ...data];
        page++;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    console.log(`Loaded ${reassignData.length} contacts for reassignment`);
    setReassignContacts(reassignData);
  };

  const loadData = async () => {
    const supabase = createClient();

    // ── Step 1: auth + teamMember details (must be serial — everything depends on user) ──
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Role/identity lives on profiles in the claims schema. Map the role
    // enum back to the legacy is_admin/is_manager booleans for the rest of
    // this page's logic. team_member_permissions is legacy and may not exist;
    // a silent failure is fine here.
    const [{ data: profileData }, { data: permsData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, first_name, last_name, role, office_location, is_remote, is_active")
        .eq("id", user.id)
        .single(),
      supabase.from("team_member_permissions").select("*").eq("team_member_id", user.id).single(),
    ]);

    const teamMemberData = profileData
      ? {
          ...profileData,
          is_admin: profileData.role === "admin",
          is_manager: profileData.role === "manager",
        }
      : null;

    if (teamMemberData) {
      setCurrentUser(teamMemberData);
    }
    if (permsData) {
      setPermissions(permsData);
    }

    // Load teamMembers list based on role (needed for distribution UI).
    // We list all users from `profiles` rather than the `team_members` entity
    // table because the legacy "distribute customers to brokers" feature was
    // really about distributing to users.
    if (teamMemberData?.is_admin) {
      const { data: allUsers } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, role, office_location, is_remote, is_active")
        .eq("is_active", true)
        .order("first_name");
      setTeamMembers(
        (allUsers || []).map((u) => ({
          ...u,
          is_admin: u.role === "admin",
          is_manager: u.role === "manager",
        })),
      );
    } else if (teamMemberData?.is_manager) {
      const { data: officeUsers } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, role, office_location, is_remote, is_active")
        .eq("is_active", true)
        .eq("office_location", teamMemberData.office_location)
        .order("first_name");
      setTeamMembers(
        (officeUsers || []).map((u) => ({
          ...u,
          is_admin: u.role === "admin",
          is_manager: u.role === "manager",
        })),
      );
    }

    // ── Step 2: fetch all three contact lists in parallel ──
    const pageSize = 1000;
    const limboUserId = viewingTeamMember?.id || user.id;
    const distributedUserId = viewingTeamMember?.id || user.id;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const isAdminOwnView = teamMemberData?.is_admin && (!viewingTeamMember || viewingTeamMember.id === user.id);

    const fetchAllPages = async (buildQuery: (range: [number, number]) => any): Promise<any[]> => {
      let results: any[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await buildQuery([page * pageSize, (page + 1) * pageSize - 1]);
        if (error || !data || data.length === 0) { hasMore = false; break; }
        results = [...results, ...data];
        page++;
        hasMore = data.length === pageSize;
      }
      return results;
    };

    const [unassigned, limbo, distributedData] = await Promise.all([
      // Unassigned contacts (team_member_id is null)
      fetchAllPages((range) =>
        supabase.from("customers").select("*")
          .is("team_member_id", null)
          .order("created_at", { ascending: false })
          .range(range[0], range[1])
      ),

      // Limbo contacts (assigned but not on kanban)
      fetchAllPages((range) =>
        supabase.from("customers").select("*")
          .eq("team_member_id", limboUserId)
          .eq("on_kanban_board", false)
          .order("created_at", { ascending: false })
          .range(range[0], range[1])
      ),

      // Distributed contacts (assigned, created in last 30 days)
      fetchAllPages((range) => {
        let q = supabase
          .from("customers")
          .select("*, assigned_team_member:team_members!customers_broker_id_fkey(first_name, last_name, email)")
          .not("team_member_id", "is", null)
          .gte("created_at", thirtyDaysAgo.toISOString())
          .order("updated_at", { ascending: false })
          .range(range[0], range[1]);
        if (!isAdminOwnView) {
          q = q.eq("imported_by", distributedUserId);
        }
        return q;
      }),
    ]);

    console.log(`Loaded: ${unassigned.length} unassigned, ${limbo.length} limbo, ${distributedData.length} distributed`);

    setUnassignedContacts(unassigned);
    setLimboContacts(limbo);
    setDistributedContacts(distributedData);
    setLoading(false);
  };

  const activeContacts = activeTab === "distributed"
    ? distributedContacts
    : activeTab === "reassign"
      ? reassignContacts
      : activeTab === "limbo"
        ? limboContacts
        : unassignedContacts;

  // Helper function to check if email is a business domain
  const isBusinessEmail = (email: string | null): boolean => {
    if (!email) return false;
    const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'aol.com', 'outlook.com', 'icloud.com', 'live.com', 'msn.com', 'mail.com'];
    const domain = email.toLowerCase().split('@')[1];
    return domain ? !personalDomains.includes(domain) : false;
  };

  // Calculate value score for a contact (0-100)
  // Flexible scoring that works with whatever data is available
  // TODO: AI Enhancement - Replace this rules-based scoring with AI analysis that:
  //   - Analyzes ALL available fields (including import_metadata)
  //   - Understands context (e.g., "John Smith - Logistics Manager" vs "John Smith")
  //   - Identifies freight/transport industry signals in business names
  //   - Weighs factors based on import source type (TMS export vs cold list vs referral)
  //   - Provides reasoning for score ("High score: Logistics company with shipping_frequency data")
  const calculateValueScore = (contact: UnassignedContact): number => {
    let score = 0;

    // Business email domain: +25 points (strong quality signal)
    if (isBusinessEmail(contact.email)) {
      score += 25;
    }

    // Has both phone AND email: +15 points (contact completeness)
    if (contact.phone && contact.email) {
      score += 15;
    } else if (contact.phone || contact.email) {
      score += 8; // Has at least one contact method
    }

    // Shipping frequency (valuable for freight): +20 points
    const shippingFreq = contact.shipping_frequency?.toLowerCase();
    if (shippingFreq) {
      if (shippingFreq.includes('multiple') || shippingFreq.includes('daily')) {
        score += 20; // High frequency shipper
      } else if (shippingFreq.includes('weekly') || shippingFreq.includes('bi')) {
        score += 15; // Regular shipper
      } else if (shippingFreq.includes('monthly') || shippingFreq.includes('quarterly')) {
        score += 10; // Moderate shipper
      } else {
        score += 5; // At least has shipping data
      }
    }

    // Industry specified (helps with targeting): +10 points
    if (contact.industry) {
      score += 10;

      // Freight-relevant industries get bonus
      const industry = contact.industry.toLowerCase();
      if (industry.includes('logistics') || industry.includes('transport') ||
        industry.includes('freight') || industry.includes('shipping') ||
        industry.includes('warehouse') || industry.includes('distribution')) {
        score += 10; // Highly relevant industry
      }
    }

    // Location data: +5 points (helps with territory planning)
    if (contact.city && contact.state) {
      score += 5;
    }

    // Web presence: +10 points (indicates established business)
    if (contact.website_url) {
      score += 10;
    }

    // LinkedIn presence: +5 points (professional profile)
    if (contact.linkedin_url) {
      score += 5;
    }

    // Historical dispatch data (if available): up to +20 points
    const dispatches = contact.import_metadata?.dispatches ||
      contact.import_metadata?.dispatched ||
      contact.import_metadata?.dispatch_count || 0;
    if (dispatches > 0) {
      // Moderate scoring: proven shipper but not over-weighted
      score += Math.min(20, 5 + (Math.log(dispatches + 1) * 6));
    }

    // Notes/metadata richness: +5 points (more context = better lead)
    if (contact.notes || (contact.import_metadata && Object.keys(contact.import_metadata).length > 2)) {
      score += 5;
    }

    return Math.round(score);
  };

  // Smart column ordering: put columns with data first, empty ones at end
  const getSmartColumnOrder = (contacts: UnassignedContact[]): string[] => {
    if (contacts.length === 0) return columnOrder;

    // Count how many contacts have data for each column
    const columnDataCount: Record<string, number> = {
      businessName: 0,
      contactName: 0,
      phone: 0,
      email: 0,
      industry: 0,
      location: 0,
      links: 0,
      source: 0,
      dispatches: 0,
      valueScore: contacts.length, // Always has data (calculated)
      added: contacts.length, // Always has data
      assignedTo: 0,
    };

    contacts.forEach(contact => {
      if (contact.business_name) columnDataCount.businessName++;
      if (contact.contact_name) columnDataCount.contactName++;
      if (contact.phone) columnDataCount.phone++;
      if (contact.email) columnDataCount.email++;
      if (contact.industry) columnDataCount.industry++;
      if (contact.city || contact.state) columnDataCount.location++;
      if (contact.linkedin_url || contact.website_url) columnDataCount.links++;
      if (contact.import_source) columnDataCount.source++;
      if (contact.team_member_id) columnDataCount.assignedTo++;

      // Check for dispatch data in metadata
      const hasDispatches = contact.import_metadata?.dispatched ||
        contact.import_metadata?.dispatch_count ||
        contact.import_metadata?.['Dispatched'] ||
        contact.import_metadata?.['dispatches'];
      if (hasDispatches) columnDataCount.dispatches++;
    });

    // Sort columns by data availability (descending)
    const sortedColumns = Object.entries(columnDataCount)
      .sort(([, countA], [, countB]) => countB - countA)
      .map(([key]) => key);

    return sortedColumns;
  };

  // Sorting handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredContacts = activeContacts.filter((contact) => {
    // Search query filter (searches across multiple fields)
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      const searchableText = [
        contact.business_name,
        contact.contact_name,
        contact.email,
        contact.phone,
        contact.city,
        contact.state,
        contact.industry,
        contact.import_source,
        contact.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!searchableText.includes(query)) return false;
    }

    // Multi-select industry filter
    if (filterIndustries.length > 0 && !filterIndustries.includes(contact.industry || "")) return false;
    // Multi-select state filter
    if (filterStates.length > 0 && !filterStates.includes(contact.state || "")) return false;
    // Multi-select source filter
    if (filterSources.length > 0) {
      const contactSource = contact.import_source?.trim().toLowerCase() || '';
      const sourceMatches = filterSources.some(selectedSource =>
        contactSource === selectedSource.trim().toLowerCase()
      );
      if (!sourceMatches) return false;
    }

    // High-value filter: flexible scoring based on available data
    if (filterHighValue) {
      const score = calculateValueScore(contact);

      // Filter contacts with score >= threshold (default 50)
      // Good leads should score at least 50 points from available data
      if (score < minDispatches * 10) {
        return false;
      }
    }

    return true;
  });

  // Debug: Log filter results
  useEffect(() => {
    if (filterSources.length > 0) {
      console.log(`Filters applied: ${filterSources.length} source(s) - ${filteredContacts.length} / ${activeContacts.length} contacts match`);
      if (filteredContacts.length === 0 && activeContacts.length > 0) {
        console.log('No matches found! First few contact sources:',
          activeContacts.slice(0, 5).map(c => c.import_source)
        );
      }
    }
  }, [filterSources, filteredContacts.length, activeContacts.length]);

  // Sorting
  const sortedContacts = [...filteredContacts].sort((a, b) => {
    if (!sortField) return 0;

    let aVal: any = a[sortField as keyof UnassignedContact];
    let bVal: any = b[sortField as keyof UnassignedContact];

    // Handle dispatches from metadata
    if (sortField === 'dispatches') {
      aVal = a.import_metadata?.dispatched || a.import_metadata?.dispatch_count || 0;
      bVal = b.import_metadata?.dispatched || b.import_metadata?.dispatch_count || 0;
    }

    // Handle value score calculation
    if (sortField === 'valueScore') {
      aVal = calculateValueScore(a);
      bVal = calculateValueScore(b);
    }

    // Handle null values
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    // String comparison
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    // Number comparison
    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  // Pagination calculations
  const totalPages = Math.ceil(sortedContacts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedContacts = sortedContacts.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterIndustries, filterStates, filterSources, filterHighValue, minDispatches, activeTab]);

  // Calculate filter options from the currently active tab's contacts
  const uniqueIndustries = Array.from(
    new Set(activeContacts.map((c) => c.industry).filter(Boolean)),
  ) as string[];
  const uniqueStates = Array.from(
    new Set(activeContacts.map((c) => c.state).filter(Boolean)),
  ) as string[];

  // IMPORTANT: Derive sources directly from visible contacts (not from separate query)
  // This ensures the dropdown always shows sources for currently displayed contacts
  const uniqueSources = Array.from(
    new Set(activeContacts.map((c) => c.import_source?.trim()).filter(s => s && s !== ""))
  ).sort() as string[];

  const handleSelectAll = () => {
    if (selectedContacts.size === paginatedContacts.length && !selectAllFiltered) {
      // Selected all on current page, offer to select all filtered
      setSelectedContacts(new Set(paginatedContacts.map((c) => c.id)));
    } else if (selectAllFiltered || selectedContacts.size > 0) {
      // Deselect all
      setSelectedContacts(new Set());
      setSelectAllFiltered(false);
    } else {
      // Select all on current page
      setSelectedContacts(new Set(paginatedContacts.map((c) => c.id)));
    }
  };

  const handleSelectAllFiltered = () => {
    setSelectedContacts(new Set(filteredContacts.map((c) => c.id)));
    setSelectAllFiltered(true);
  };

  const handleSelectContact = (id: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedContacts(newSelected);
  };

  const startEditing = (contactId: string, field: string, currentValue: string) => {
    if (!currentUser?.is_admin) return; // Only admins can edit
    setEditingCell({ contactId, field });
    setEditValue(currentValue || "");
  };

  const saveEdit = async () => {
    if (!editingCell) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("customers")
      .update({ [editingCell.field]: editValue })
      .eq("id", editingCell.contactId);

    if (error) {
      console.error("Error updating contact:", error);
      alert("Failed to update contact");
    } else {
      // Update local state
      setUnassignedContacts(prev =>
        prev.map(c =>
          c.id === editingCell.contactId
            ? { ...c, [editingCell.field]: editValue }
            : c
        )
      );
      setDistributedContacts(prev =>
        prev.map(c =>
          c.id === editingCell.contactId
            ? { ...c, [editingCell.field]: editValue }
            : c
        )
      );
      setReassignContacts(prev =>
        prev.map(c =>
          c.id === editingCell.contactId
            ? { ...c, [editingCell.field]: editValue }
            : c
        )
      );
    }

    setEditingCell(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const handleBulkUpdateSource = async () => {
    if (!bulkSourceValue.trim()) {
      alert("Please enter a source tag");
      return;
    }

    // Get the correct set of IDs based on whether "select all filtered" is active
    const selectedIds = selectAllFiltered
      ? filteredContacts.map(c => c.id)
      : Array.from(selectedContacts);

    const supabase = createClient();

    const { error } = await supabase
      .from("customers")
      .update({ import_source: bulkSourceValue.trim() })
      .in("id", selectedIds);

    if (error) {
      console.error("Error updating source tags:", error);
      alert("Failed to update source tags");
    } else {
      // Update local state
      setUnassignedContacts(prev =>
        prev.map(c =>
          selectedIds.includes(c.id)
            ? { ...c, import_source: bulkSourceValue.trim() }
            : c
        )
      );
      setDistributedContacts(prev =>
        prev.map(c =>
          selectedIds.includes(c.id)
            ? { ...c, import_source: bulkSourceValue.trim() }
            : c
        )
      );
      setReassignContacts(prev =>
        prev.map(c =>
          selectedIds.includes(c.id)
            ? { ...c, import_source: bulkSourceValue.trim() }
            : c
        )
      );

      // Sources are now derived from visible contacts, reload will happen automatically

      setShowBulkSourceEdit(false);
      setBulkSourceValue("");
      setSelectedContacts(new Set());
      setSelectAllFiltered(false);

      alert(`Successfully updated source tag for ${selectedIds.length} contact${selectedIds.length === 1 ? '' : 's'}`);
    }
  };

  const handleDistribute = async (teamMemberId: string) => {
    const supabase = createClient();

    const contactIds = Array.from(selectedContacts);

    // Get contact details for notifications
    const contactsToAssign = activeContacts.filter(c => contactIds.includes(c.id));

    const { error } = await supabase
      .from("customers")
      .update({
        team_member_id: teamMemberId,
        status: "inbox", // New contacts go to inbox status
        on_kanban_board: true, // Show on kanban board immediately in inbox column
        updated_at: new Date().toISOString()
      })
      .in("id", contactIds);

    if (error) {
      alert("Error distributing contacts: " + error.message);
      return;
    }

    // Create notifications for assigned team member (API handles security)
    if (currentUser) {
      fetch('/api/notifications/contact-assigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamMemberId,
          customerIds: contactIds,
          customerNames: contactsToAssign.map(c => c.business_name || 'Unknown'),
          assignedBy: `${currentUser.first_name} ${currentUser.last_name || ''}`.trim(),
          assignedByTeamMemberId: currentUser.id,
        }),
      }).catch((err: Error) => console.error('Failed to send assignment notification:', err));
    }

    alert(`Successfully assigned ${contactIds.length} contacts to inbox!`);
    setSelectedContacts(new Set());
    setShowDistributeModal(false);
    loadData();
  };

  const handleEvenDistribution = async () => {
    if (!currentUser) return;
    const supabase = createClient();

    const contactIds = Array.from(selectedContacts);
    const contactsToAssign = activeContacts.filter(c => contactIds.includes(c.id));
    const availableTeamMembers = teamMembers.filter((b) => !b.is_admin);

    if (availableTeamMembers.length === 0) {
      alert("No team members available for distribution");
      return;
    }

    // Distribute evenly
    const contactsPerTeamMember = Math.ceil(
      contactIds.length / availableTeamMembers.length,
    );
    let currentIndex = 0;

    for (const teamMember of availableTeamMembers) {
      const assignmentIds = contactIds.slice(
        currentIndex,
        currentIndex + contactsPerTeamMember,
      );
      if (assignmentIds.length === 0) break;

      await supabase
        .from("customers")
        .update({
          team_member_id: teamMember.id,
          status: "inbox", // New contacts go to inbox status
          on_kanban_board: true, // Show on kanban board immediately in inbox column
          updated_at: new Date().toISOString()
        })
        .in("id", assignmentIds);

      // Create notifications for this teamMember (API handles security)
      const assignedContacts = contactsToAssign.filter(c => assignmentIds.includes(c.id));
      fetch('/api/notifications/contact-assigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamMemberId: teamMember.id,
          customerIds: assignmentIds,
          customerNames: assignedContacts.map(c => c.business_name || 'Unknown'),
          assignedBy: `${currentUser.first_name} ${currentUser.last_name || ''}`.trim(),
          assignedByTeamMemberId: currentUser.id,
        }),
      }).catch(err => console.error('Failed to send assignment notification:', err));

      currentIndex += contactsPerTeamMember;
    }

    alert(`Distributed ${contactIds.length} contacts evenly!`);
    setSelectedContacts(new Set());
    setShowDistributeModal(false);
    loadData();
  };

  const handleMoveToInbox = async () => {
    if (selectedContacts.size === 0) return;

    const confirmed = confirm(
      `Move ${selectedContacts.size} contact${selectedContacts.size !== 1 ? 's' : ''} to inbox? This will make them visible on the kanban board.`
    );
    if (!confirmed) return;

    const supabase = createClient();
    const contactIds = Array.from(selectedContacts);

    const { error } = await supabase
      .from("customers")
      .update({
        status: "inbox",
        on_kanban_board: true,
        updated_at: new Date().toISOString(),
      })
      .in("id", contactIds);

    if (error) {
      alert("Error moving contacts to inbox: " + error.message);
      return;
    }

    alert(`Moved ${contactIds.length} contact${contactIds.length !== 1 ? 's' : ''} to inbox!`);
    setSelectedContacts(new Set());
    loadData();
  };

  const handleAssignToMe = async () => {
    if (!currentUser || selectedContacts.size === 0) return;

    const confirmed = confirm(
      `Assign ${selectedContacts.size} contact${selectedContacts.size !== 1 ? 's' : ''} to yourself?`
    );

    if (!confirmed) return;

    const supabase = createClient();
    const contactIds = Array.from(selectedContacts);
    const contactsToAssign = activeContacts.filter(c => contactIds.includes(c.id));

    const { error } = await supabase
      .from("customers")
      .update({
        team_member_id: currentUser.id,
        status: "inbox", // New contacts go to inbox status
        on_kanban_board: true, // Show on kanban board immediately in inbox column
        updated_at: new Date().toISOString()
      })
      .in("id", contactIds);

    if (error) {
      alert("Error assigning contacts: " + error.message);
      return;
    }

    // NO notification for self-assignment - user knows they just performed this action
    // Only notify when OTHERS assign contacts to you (hyperfocused workspace principle)

    alert(`Successfully assigned ${contactIds.length} contact${contactIds.length !== 1 ? 's' : ''} to you!`);
    setSelectedContacts(new Set());
    loadData();
  };

  const handleDeleteSelected = async () => {
    const count = selectAllFiltered ? filteredContacts.length : selectedContacts.size;
    if (count === 0) return;

    const confirmed = confirm(
      `Are you sure you want to delete ${count} contact${count !== 1 ? 's' : ''}? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const contactIds = selectAllFiltered
        ? filteredContacts.map(c => c.id)
        : Array.from(selectedContacts);

      console.log('Deleting contacts:', contactIds.length, 'contacts');

      // Bulk delete via API
      const response = await fetch('/api/contacts/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds }),
      });

      const result = await response.json();

      if (!response.ok && response.status !== 207) {
        console.error('Bulk delete error:', result);
        alert('Error deleting contacts: ' + (result.error || 'Unknown error'));
        return;
      }

      // Handle partial success (207 status)
      if (response.status === 207) {
        alert(`Partially completed: Deleted ${result.deletedCount} of ${contactIds.length} contacts.\n${result.error}`);
      } else {
        alert(`Successfully deleted ${result.deletedCount} contact${result.deletedCount !== 1 ? 's' : ''}!`);
      }

      setSelectedContacts(new Set());
      loadData();
    } catch (error) {
      console.error('Error deleting contacts:', error);
      alert('An unexpected error occurred. Please try again.');
    }
  };

  const handleDeleteSingle = async (contactId: string, contactName: string) => {
    const confirmed = confirm(
      `Are you sure you want to delete "${contactName}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const response = await fetch('/api/contacts/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Delete error:", errorData);
        alert("Error deleting contact: " + (errorData.error || 'Unknown error'));
        return;
      }

      alert(`Successfully deleted "${contactName}"!`);
      loadData();
    } catch (err) {
      console.error("Unexpected error during delete:", err);
      alert("An unexpected error occurred while deleting the contact. Please refresh the page and try again.");
    }
  };

  const handleAddToWorkspace = async (customerId: string) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("customers")
      .update({
        on_kanban_board: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", customerId);

    if (error) {
      alert("Error adding to workspace: " + error.message);
      return;
    }

    // Remove from limbo list
    setLimboContacts(limboContacts.filter((c) => c.id !== customerId));
  };

  const handleBulkAddToWorkspace = async () => {
    const supabase = createClient();
    const contactIds = Array.from(selectedLimboContacts);

    if (contactIds.length === 0) {
      alert("Please select contacts to add to workspace");
      return;
    }

    const { error } = await supabase
      .from("customers")
      .update({
        on_kanban_board: true,
        updated_at: new Date().toISOString(),
      })
      .in("id", contactIds);

    if (error) {
      alert("Error adding contacts to workspace: " + error.message);
      return;
    }

    alert(`Successfully added ${contactIds.length} contact(s) to workspace!`);
    setSelectedLimboContacts(new Set());
    loadData();
  };

  // Handle column reorder via drag and drop
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Handle column resize
  const handleResizeStart = (column: string, startX: number) => {
    const currentWidth = columnWidths[column] || 150;
    setResizing({ column, startX, startWidth: currentWidth });
  };

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizing.startX;
      const newWidth = Math.max(80, resizing.startWidth + diff); // Min width 80px
      setColumnWidths(prev => ({
        ...prev,
        [resizing.column]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  // Render table cell based on column key
  const renderCell = (columnKey: string, contact: UnassignedContact) => {
    const width = columnWidths[columnKey] || 150;
    const widthStyle = { width: `${width}px`, minWidth: `${width}px` };

    switch (columnKey) {
      case 'businessName':
        return (
          <td key={columnKey} className="px-4 py-3" style={widthStyle}>
            {editingCell?.contactId === contact.id && editingCell?.field === "business_name" ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
                autoFocus
                className="w-full rounded border border-orange-500 px-2 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            ) : (
              <p
                onClick={() => startEditing(contact.id, "business_name", contact.business_name || "")}
                className={`font-medium text-slate-900 whitespace-nowrap ${currentUser?.is_admin ? "cursor-pointer hover:bg-orange-50 rounded px-2 py-1" : ""}`}
                title={currentUser?.is_admin ? "Click to edit" : ""}
              >
                {contact.business_name}
              </p>
            )}
          </td>
        );

      case 'contactName':
        return (
          <td key={columnKey} className="px-4 py-3" style={widthStyle}>
            {editingCell?.contactId === contact.id && editingCell?.field === "contact_name" ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
                autoFocus
                className="w-full rounded border border-orange-500 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            ) : (
              <p
                onClick={() => startEditing(contact.id, "contact_name", contact.contact_name || "")}
                className={`text-sm text-slate-900 whitespace-nowrap ${currentUser?.is_admin ? "cursor-pointer hover:bg-orange-50 rounded px-2 py-1" : ""}`}
                title={currentUser?.is_admin ? "Click to edit" : ""}
              >
                {contact.contact_name || "—"}
              </p>
            )}
          </td>
        );

      case 'phone':
        return (
          <td key={columnKey} className="px-4 py-3" style={widthStyle}>
            {editingCell?.contactId === contact.id && editingCell?.field === "phone" ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
                autoFocus
                className="w-full rounded border border-orange-500 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            ) : (
              <p
                onClick={() => startEditing(contact.id, "phone", contact.phone || "")}
                className={`text-sm text-slate-900 whitespace-nowrap ${currentUser?.is_admin ? "cursor-pointer hover:bg-orange-50 rounded px-2 py-1" : ""}`}
                title={currentUser?.is_admin ? "Click to edit" : ""}
              >
                {contact.phone || "—"}
              </p>
            )}
          </td>
        );

      case 'email':
        return (
          <td key={columnKey} className="px-4 py-3" style={widthStyle}>
            {editingCell?.contactId === contact.id && editingCell?.field === "email" ? (
              <input
                type="email"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
                autoFocus
                className="w-full rounded border border-orange-500 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            ) : (
              <p
                onClick={() => startEditing(contact.id, "email", contact.email || "")}
                className={`text-sm text-slate-900 whitespace-nowrap ${currentUser?.is_admin ? "cursor-pointer hover:bg-orange-50 rounded px-2 py-1" : ""}`}
                title={currentUser?.is_admin ? "Click to edit" : ""}
              >
                {contact.email || "—"}
              </p>
            )}
          </td>
        );

      case 'industry':
        return (
          <td key={columnKey} className="px-4 py-3" style={widthStyle}>
            {editingCell?.contactId === contact.id && editingCell?.field === "industry" ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
                autoFocus
                className="w-full rounded border border-orange-500 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Enter industry..."
              />
            ) : (
              <span
                onClick={() => startEditing(contact.id, "industry", contact.industry || "")}
                className={`inline-flex items-center gap-1 text-sm text-slate-600 whitespace-nowrap ${currentUser?.is_admin ? "cursor-pointer hover:bg-orange-50 rounded px-2 py-1" : ""}`}
                title={currentUser?.is_admin ? "Click to edit" : ""}
              >
                <Briefcase className="h-3 w-3" />
                {contact.industry || "—"}
              </span>
            )}
          </td>
        );

      case 'location':
        return (
          <td key={columnKey} className="px-4 py-3" style={widthStyle}>
            <span className="inline-flex items-center gap-1 text-sm text-slate-600 whitespace-nowrap">
              <MapPin className="h-3 w-3" />
              {contact.city && contact.state
                ? `${contact.city}, ${contact.state}`
                : contact.state || "—"}
            </span>
          </td>
        );

      case 'links':
        return (
          <td key={columnKey} className="px-4 py-3" style={widthStyle}>
            <div className="flex gap-1">
              {contact.linkedin_url && (
                <a
                  href={contact.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                  title="LinkedIn"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                </a>
              )}
              {contact.website_url && (
                <a
                  href={contact.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-600 hover:text-slate-900"
                  title="Website"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </a>
              )}
              {!contact.linkedin_url && !contact.website_url && (
                <span className="text-xs text-slate-400">—</span>
              )}
            </div>
          </td>
        );

      case 'job_title':
        return (
          <td key={columnKey} style={widthStyle} className="px-4 py-3 text-sm">
            {editingCell?.contactId === contact.id && editingCell?.field === 'job_title' ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
                autoFocus
                className="w-full rounded border border-orange-500 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                placeholder="Enter job title..."
              />
            ) : (
              <div
                onClick={() => startEditing(contact.id, 'job_title', contact.job_title || '')}
                className="cursor-pointer rounded px-2 py-1 hover:bg-slate-50"
                title="Click to edit"
              >
                {contact.job_title ? (
                  <span className="text-slate-900">{contact.job_title}</span>
                ) : (
                  <span className="text-slate-400 italic">—</span>
                )}
              </div>
            )}
          </td>
        );

      case 'source':
        return (
          <td key={columnKey} className="px-4 py-3" style={widthStyle}>
            {editingCell?.contactId === contact.id && editingCell?.field === "import_source" ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") cancelEdit();
                }}
                autoFocus
                className="w-full rounded border border-orange-500 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Enter source tag..."
              />
            ) : (
              <div
                onClick={() => startEditing(contact.id, "import_source", contact.import_source || "")}
                className={`${currentUser?.is_admin ? "cursor-pointer hover:bg-orange-50" : ""} rounded px-2 py-1 transition-colors`}
                title={currentUser?.is_admin ? "Click to edit" : ""}
              >
                {contact.import_source ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
                    <Upload className="h-3 w-3" />
                    {contact.import_source.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">
                    {currentUser?.is_admin ? "Click to add..." : "—"}
                  </span>
                )}
              </div>
            )}
          </td>
        );

      case 'dispatches':
        return (
          <td key={columnKey} className="px-4 py-3" style={widthStyle}>
            {(() => {
              const dispatchCount = contact.import_metadata?.dispatched ||
                contact.import_metadata?.dispatch_count ||
                contact.import_metadata?.['Dispatched'] ||
                contact.import_metadata?.['dispatches'];

              if (!dispatchCount) return <span className="text-xs text-slate-400">—</span>;

              const count = typeof dispatchCount === 'string' ? parseInt(dispatchCount) : dispatchCount;
              const isHighValue = count >= minDispatches;

              return (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${isHighValue
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-slate-100 text-slate-600'
                  }`}>
                  <TrendingUp className="h-3 w-3" />
                  {count}
                </span>
              );
            })()}
          </td>
        );

      case 'valueScore':
        return (
          <td key={columnKey} className="px-4 py-3" style={widthStyle}>
            {(() => {
              const score = calculateValueScore(contact);
              const hasBusinessEmail = isBusinessEmail(contact.email);

              // Color coding: 70+ = green, 40-69 = amber, <40 = gray
              let colorClasses = 'bg-slate-100 text-slate-600';
              if (score >= 70) {
                colorClasses = 'bg-green-100 text-green-700 border border-green-300';
              } else if (score >= 40) {
                colorClasses = 'bg-amber-100 text-amber-700 border border-amber-300';
              }

              return (
                <div className="flex items-center gap-1">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${colorClasses}`}>
                    {score}
                  </span>
                  {hasBusinessEmail && (
                    <Tooltip content="Business email domain detected" position="left" showIcon={false}>
                      <Briefcase className="h-3 w-3 text-green-600" />
                    </Tooltip>
                  )}
                </div>
              );
            })()}
          </td>
        );

      case 'added':
        return (
          <td key={columnKey} className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap" style={widthStyle}>
            {new Date(contact.created_at).toLocaleDateString()}
          </td>
        );

      case 'assignedTo':
        return (
          <td key={columnKey} className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap" style={widthStyle}>
            {(() => {
              if (!contact.team_member_id) return <span className="text-slate-400">Unassigned</span>;
              const teamMember = teamMembers.find(b => b.id === contact.team_member_id);
              if (!teamMember) return <span className="text-slate-400">Unknown</span>;
              return (
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-500" />
                  {teamMember.first_name} {teamMember.last_name || ''}
                </span>
              );
            })()}
          </td>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
          <p className="text-sm text-slate-600">Loading tools...</p>
        </div>
      </div>
    );
  }

  const canDistribute = currentUser?.is_admin || currentUser?.is_manager;

  // Show desktop-only message on mobile/tablet (after all hooks have run)
  if (isMobileOrTablet) {
    return (
      <DesktopOnlyView
        pageName="Import Management"
        reason="The complex data tables and distribution workflows require a desktop environment."
        mobileAlternative={{
          href: "/dashboard/customers/list",
          label: "View Customers",
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                Tools
              </h1>
              <p className="text-sm text-slate-600">
                Import contacts and distribute leads to your team
              </p>
            </div>
            {activeTab === "import" && (
              <div className="flex gap-2">
                {currentUser && permissions && canExportData(permissions, currentUser) && (
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                )}
                <button
                  onClick={() => setShowSimpleImportModal(true)}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Upload className="h-4 w-4" />
                  Quick Import
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Advanced Import
                </button>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 border-b border-slate-200">
            <button
              onClick={() => setActiveTab("import")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === "import"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
            >
              <Upload className="h-4 w-4" />
              Import & Distribute
            </button>

            <button
              onClick={() => setActiveTab("limbo")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === "limbo"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
            >
              <CheckCircle className="h-4 w-4" />
              My Assigned Contacts
              {limboContacts.length > 0 && activeTab !== "limbo" && (
                <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {limboContacts.length}
                </span>
              )}
            </button>

            {canDistribute && (
              <>
                <button
                  onClick={() => setActiveTab("ai-distribute")}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === "ai-distribute"
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <Sparkles className="h-4 w-4" />
                  AI Distribute
                </button>
                <button
                  onClick={() => setActiveTab("reassign")}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === "reassign"
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <ArrowRight className="h-4 w-4" />
                  Reassign Contacts
                </button>
              </>
            )}

            {/* Email Templates tab - disabled for launch */}
            {/* <button
              onClick={() => setActiveTab("templates")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "templates"
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <Mail className="h-4 w-4" />
              Email Templates
            </button> */}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {/* Email Templates disabled for launch */}
      {/* {activeTab === "templates" ? (
        <div className="p-4 sm:p-6">
          <div className="mx-auto max-w-6xl">
            <UserEmailTemplateEditor />
          </div>
        </div>
      ) : ( */}
      {activeTab === "ai-distribute" ? (
        <div className="p-4 sm:p-6">
          <div className="mx-auto max-w-6xl">
            <AiCommandAssistant />
          </div>
        </div>
      ) : activeTab === "reassign" ? (
        <>
          {/* Reassign Tab Content */}
          <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Select TeamMember to Reassign Contacts From:
                </label>
                <select
                  value={selectedReassignTeamMember}
                  onChange={(e) => {
                    setSelectedReassignTeamMember(e.target.value);
                    loadReassignData(e.target.value);
                    setSelectedContacts(new Set());
                  }}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="">Choose a team member...</option>
                  {teamMembers.map((teamMember) => (
                    <option key={teamMember.id} value={teamMember.id}>
                      {teamMember.first_name} {teamMember.last_name || ""} - {teamMember.office_location || "No Office"}
                      {teamMember.is_manager && " (Manager)"}
                    </option>
                  ))}
                </select>
              </div>

              {selectedReassignTeamMember && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-slate-900">
                    {reassignContacts.length}
                  </span>
                  <span className="text-slate-600">Total Contacts</span>
                </div>
              )}

              {selectedContacts.size > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-orange-500" />
                  <span className="font-medium text-slate-900">
                    {selectedContacts.size}
                  </span>
                  <span className="text-slate-600">Selected</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {!selectedReassignTeamMember ? (
              <div className="rounded-lg border border-slate-200 bg-white py-12 text-center">
                <Users className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                <p className="text-slate-600">Select a team member above to view their contacts</p>
                <p className="text-sm text-slate-500">
                  You can reassign contacts when a team member leaves or changes roles
                </p>
              </div>
            ) : reassignContacts.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white py-12 text-center">
                <FileSpreadsheet className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                <p className="text-slate-600">This teamMember has no contacts</p>
              </div>
            ) : (
              <>
                {/* Select-all banner */}
                {selectedContacts.size > 0 && selectedContacts.size < reassignContacts.length && (
                  <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800 flex items-center justify-between">
                    <span>{selectedContacts.size} of {reassignContacts.length} contacts selected.</span>
                    <button
                      onClick={() => setSelectedContacts(new Set(reassignContacts.map(c => c.id)))}
                      className="ml-3 font-semibold underline hover:text-blue-600"
                    >
                      Select all {reassignContacts.length}
                    </button>
                  </div>
                )}

                {/* Actions */}
                {selectedContacts.size > 0 && (
                  <div className="mb-4 flex justify-end gap-2">
                    <button
                      onClick={handleMoveToInbox}
                      className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Move to Inbox ({selectedContacts.size})
                    </button>
                    <button
                      onClick={() => setShowDistributeModal(true)}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <UserPlus className="h-4 w-4" />
                      Reassign ({selectedContacts.size})
                    </button>
                  </div>
                )}

                {/* Contacts Table - reuse the same table structure */}
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full min-w-max">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={
                              reassignContacts.length > 0 &&
                              selectedContacts.size === reassignContacts.length
                            }
                            onChange={() => {
                              if (selectedContacts.size === reassignContacts.length) {
                                setSelectedContacts(new Set());
                              } else {
                                setSelectedContacts(new Set(reassignContacts.map(c => c.id)));
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">
                          Business Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">
                          Contact Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">
                          Phone
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">
                          Industry
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">
                          Location
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700">
                          Last Updated
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {reassignContacts.map((contact) => (
                        <tr
                          key={contact.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedContacts.has(contact.id)}
                              onChange={() => handleSelectContact(contact.id)}
                              className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900 whitespace-nowrap">
                              {contact.business_name}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-slate-900 whitespace-nowrap">
                              {contact.contact_name || "—"}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-slate-900 whitespace-nowrap">
                              {contact.phone || "—"}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-slate-900 whitespace-nowrap">
                              {contact.email || "—"}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-sm text-slate-600 whitespace-nowrap">
                              <Briefcase className="h-3 w-3" />
                              {contact.industry || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 text-sm text-slate-600 whitespace-nowrap">
                              <MapPin className="h-3 w-3" />
                              {contact.city && contact.state
                                ? `${contact.city}, ${contact.state}`
                                : contact.state || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize"
                              style={{
                                backgroundColor: contact.status === 'active' ? '#10B98120' : contact.status === 'prospect' ? '#F59E0B20' : '#6B728020',
                                color: contact.status === 'active' ? '#059669' : contact.status === 'prospect' ? '#D97706' : '#475569'
                              }}
                            >
                              {contact.status || "prospect"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                            {new Date(contact.updated_at || contact.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Stats Bar */}
          <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex gap-4">
              {activeTab === "import" ? (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span className="font-medium text-slate-900">
                      {unassignedContacts.length}
                    </span>
                    <span className="text-slate-600">Available for Distribution</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-orange-500" />
                    <span className="font-medium text-slate-900">
                      {selectedContacts.size}
                    </span>
                    <span className="text-slate-600">Selected</span>
                  </div>
                </>
              ) : activeTab === "limbo" ? (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-blue-500" />
                    <span className="font-medium text-slate-900">
                      {limboContacts.length}
                    </span>
                    <span className="text-slate-600">Contacts Assigned to Me</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium text-slate-900">
                      {selectedLimboContacts.size}
                    </span>
                    <span className="text-slate-600">Selected</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-slate-900">
                    {filteredContacts.length}
                  </span>
                  <span className="text-slate-600">Contacts</span>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="p-4 sm:p-6">
            {/* Filters & Actions */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-75">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, phone, city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-200 py-2 pl-9 pr-9 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Multi-Select Filter Dropdowns */}
              <select
                value=""
                onChange={(e) => {
                  const value = e.target.value;
                  if (value && !filterIndustries.includes(value)) {
                    setFilterIndustries([...filterIndustries, value]);
                  }
                }}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                <option value="">+ Industry</option>
                {uniqueIndustries.filter(ind => !filterIndustries.includes(ind)).map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </select>

              <select
                value=""
                onChange={(e) => {
                  const value = e.target.value;
                  if (value && !filterStates.includes(value)) {
                    setFilterStates([...filterStates, value]);
                  }
                }}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                <option value="">+ State</option>
                {uniqueStates.filter(st => !filterStates.includes(st)).map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>

              {activeTab !== "limbo" && (
                <select
                  value=""
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value && !filterSources.includes(value)) {
                      setFilterSources([...filterSources, value]);
                    }
                  }}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="">+ Source</option>
                  {uniqueSources.filter(src => !filterSources.includes(src)).map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              )}

              {/* High-Value Filter */}
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <input
                  type="checkbox"
                  id="filter-high-value"
                  checked={filterHighValue}
                  onChange={(e) => setFilterHighValue(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                />
                <label htmlFor="filter-high-value" className="text-sm font-medium text-slate-700 cursor-pointer flex items-center gap-1">
                  High-Value Only
                  <Tooltip content="Scores contacts from available data: business email (25pts), contact info (15pts), shipping frequency (20pts), industry relevance (20pts), web presence (15pts), dispatches (20pts). Shows contacts scoring above threshold." />
                </label>
                {filterHighValue && (
                  <>
                    <span className="text-slate-400">|</span>
                    <select
                      value={minDispatches}
                      onChange={(e) => setMinDispatches(parseInt(e.target.value))}
                      className="rounded border border-slate-200 px-2 py-1 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    >
                      <option value="3">30+ score</option>
                      <option value="4">40+ score</option>
                      <option value="5">50+ score</option>
                      <option value="6">60+ score</option>
                      <option value="7">70+ score</option>
                    </select>
                  </>
                )}
              </div>
            </div>

            {/* Active Filter Chips */}
            {(filterIndustries.length > 0 || filterStates.length > 0 || filterSources.length > 0 || filterHighValue) && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs font-semibold text-slate-600">Active Filters:</span>

                {filterIndustries.map(industry => (
                  <span key={industry} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                    Industry: {industry}
                    <button
                      onClick={() => setFilterIndustries(filterIndustries.filter(i => i !== industry))}
                      className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                {filterStates.map(state => (
                  <span key={state} className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                    State: {state}
                    <button
                      onClick={() => setFilterStates(filterStates.filter(s => s !== state))}
                      className="hover:bg-green-200 rounded-full p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                {filterSources.map(source => (
                  <span key={source} className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">
                    Source: {source}
                    <button
                      onClick={() => setFilterSources(filterSources.filter(s => s !== source))}
                      className="hover:bg-purple-200 rounded-full p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                {filterHighValue && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">
                    High-Value ({minDispatches * 10}+ score)
                    <button
                      onClick={() => setFilterHighValue(false)}
                      className="hover:bg-orange-200 rounded-full p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}

                <button
                  onClick={() => {
                    setFilterIndustries([]);
                    setFilterStates([]);
                    setFilterSources([]);
                    setFilterHighValue(false);
                    setMinDispatches(5);
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-200 transition-colors"
                >
                  <X className="h-3 w-3" />
                  Clear All
                </button>
              </div>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-3"
              style={{ display: (filterIndustries.length > 0 || filterStates.length > 0 || filterSources.length > 0 || filterHighValue) ? 'none' : undefined }}
            >
              {/* Spacer to prevent layout shift when chips appear */}
            </div>

            <div className="flex flex-wrap items-center gap-3"
              style={{ marginTop: (filterIndustries.length > 0 || filterStates.length > 0 || filterSources.length > 0 || filterHighValue) ? '-1rem' : undefined }}
            >

              <div className="ml-auto flex gap-2">
                {/* Column Visibility Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowColumnMenu(!showColumnMenu)}
                    className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Columns
                  </button>

                  {showColumnMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowColumnMenu(false)} />
                      <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white shadow-lg">
                        <div className="border-b border-slate-200 px-4 py-2">
                          <p className="text-sm font-semibold text-slate-900">Show/Hide Columns</p>
                        </div>
                        <div className="p-2 space-y-1">
                          {[
                            { key: 'businessName', label: 'Business Name' },
                            { key: 'contactName', label: 'Contact Name' },
                            { key: 'phone', label: 'Phone' },
                            { key: 'email', label: 'Email' },
                            { key: 'industry', label: 'Industry' },
                            { key: 'location', label: 'Location' },
                            { key: 'links', label: 'Links' },
                            { key: 'source', label: 'Source' },
                            { key: 'dispatches', label: 'Dispatches' },
                            { key: 'valueScore', label: 'Value Score' },
                            { key: 'added', label: 'Added' },
                          ].map(({ key, label }) => (
                            <label key={key} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={visibleColumns[key as keyof typeof visibleColumns]}
                                onChange={(e) => setVisibleColumns({ ...visibleColumns, [key]: e.target.checked })}
                                className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                              />
                              <span className="text-sm text-slate-700">{label}</span>
                            </label>
                          ))}
                        </div>
                        <div className="border-t border-slate-200 p-2">
                          <button
                            onClick={() => {
                              const smartOrder = getSmartColumnOrder(filteredContacts);
                              setColumnOrder(smartOrder);
                              setShowColumnMenu(false);
                            }}
                            className="w-full rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            title="Reorder columns to show populated fields first"
                          >
                            ✨ Smart Order (data first)
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {activeTab === "limbo" ? (
                  selectedLimboContacts.size > 0 && (
                    <button
                      onClick={handleBulkAddToWorkspace}
                      className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Add to Workspace ({selectedLimboContacts.size})
                    </button>
                  )
                ) : (
                  <>
                    {currentUser?.is_admin && selectedContacts.size > 0 && (
                      <button
                        onClick={() => setShowBulkSourceEdit(!showBulkSourceEdit)}
                        className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                      >
                        <Upload className="h-4 w-4" />
                        Set Source ({selectAllFiltered ? filteredContacts.length : selectedContacts.size})
                      </button>
                    )}
                    {canDistribute && selectedContacts.size > 0 && (
                      <>
                        <button
                          onClick={() => setShowDistributeModal(true)}
                          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          <UserPlus className="h-4 w-4" />
                          Distribute ({selectAllFiltered ? filteredContacts.length : selectedContacts.size})
                        </button>
                        <button
                          onClick={handleDeleteSelected}
                          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete ({selectAllFiltered ? filteredContacts.length : selectedContacts.size})
                        </button>
                      </>
                    )}
                    {/* TeamMember-level bulk actions */}
                    {!canDistribute && selectedContacts.size > 0 && (
                      <>
                        <button
                          onClick={handleAssignToMe}
                          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          <UserPlus className="h-4 w-4" />
                          Assign to Me ({selectAllFiltered ? filteredContacts.length : selectedContacts.size})
                        </button>
                        <button
                          onClick={handleDeleteSelected}
                          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete ({selectAllFiltered ? filteredContacts.length : selectedContacts.size})
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Select All Filtered Banner */}
            {activeTab !== "limbo" && selectedContacts.size === paginatedContacts.length && selectedContacts.size > 0 && !selectAllFiltered && filteredContacts.length > paginatedContacts.length && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="text-sm text-blue-900">
                  All {paginatedContacts.length} contacts on this page are selected.{' '}
                  <button
                    onClick={handleSelectAllFiltered}
                    className="font-semibold text-blue-700 underline hover:text-blue-800"
                  >
                    Select all {filteredContacts.length} filtered contacts
                  </button>
                </p>
              </div>
            )}

            {/* All Filtered Selected Confirmation */}
            {activeTab !== "limbo" && selectAllFiltered && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <p className="text-sm text-green-900">
                  All {filteredContacts.length} filtered contacts are selected.{' '}
                  <button
                    onClick={() => { setSelectedContacts(new Set()); setSelectAllFiltered(false); }}
                    className="font-semibold text-green-700 underline hover:text-green-800"
                  >
                    Clear selection
                  </button>
                </p>
              </div>
            )}

            {/* Contacts Table */}
            <div
              ref={tableContainerRef}
              className="overflow-x-auto rounded-lg border border-slate-200 bg-white"
              style={{ maxHeight: 'calc(100vh - 300px)' }}
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                    <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                      <tr>
                        <th className="sticky left-0 z-20 px-4 py-3 text-left bg-slate-50 border-r border-slate-200">
                          <input
                            type="checkbox"
                            checked={
                              activeTab === "limbo"
                                ? selectedLimboContacts.size === sortedContacts.length && sortedContacts.length > 0
                                : selectedContacts.size === sortedContacts.length && sortedContacts.length > 0
                            }
                            onChange={() => {
                              if (activeTab === "limbo") {
                                if (selectedLimboContacts.size === sortedContacts.length) {
                                  setSelectedLimboContacts(new Set());
                                } else {
                                  setSelectedLimboContacts(new Set(sortedContacts.map((c) => c.id)));
                                }
                              } else {
                                handleSelectAll();
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                          />
                        </th>
                        {columnOrder.map((columnKey) => {
                          if (!visibleColumns[columnKey as keyof typeof visibleColumns]) return null;

                          const columnConfig: Record<string, { label: string; sortKey?: string; tooltip?: string }> = {
                            businessName: { label: 'Business Name', sortKey: 'business_name' },
                            contactName: { label: 'Contact Name', sortKey: 'contact_name' },
                            phone: { label: 'Phone' },
                            email: { label: 'Email' },
                            industry: { label: 'Industry', sortKey: 'industry' },
                            location: { label: 'Location', sortKey: 'state' },
                            links: { label: 'Links' },
                            source: { label: 'Source', sortKey: 'import_source' },
                            dispatches: {
                              label: 'Dispatches',
                              sortKey: 'dispatches',
                              tooltip: 'Number of times this contact has shipped freight (from TMS import data)'
                            },
                            valueScore: {
                              label: 'Value Score',
                              sortKey: 'valueScore',
                              tooltip: 'Lead quality score (0-100) based on available data: business email (25pts), complete contact info (15pts), shipping frequency (20pts), industry relevance (20pts), web/social presence (15pts), dispatch history (20pts). Adapts to whatever data your import includes.'
                            },
                            added: { label: 'Added', sortKey: 'created_at' },
                            assignedTo: { label: 'Assigned To', tooltip: 'TeamMember assigned to this contact' },
                          };

                          const config = columnConfig[columnKey];
                          return (
                            <SortableColumnHeader
                              key={columnKey}
                              id={columnKey}
                              columnKey={config.sortKey || columnKey}
                              label={config.label}
                              sortable={!!config.sortKey}
                              sortField={sortField}
                              sortDirection={sortDirection}
                              onSort={config.sortKey ? () => handleSort(config.sortKey!) : undefined}
                              width={columnWidths[columnKey] || 150}
                              onResizeStart={(e) => handleResizeStart(columnKey, e.clientX)}
                              tooltip={config.tooltip}
                            />
                          );
                        })}
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700 bg-slate-50">
                          Actions
                        </th>
                      </tr>
                    </SortableContext>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedContacts.length === 0 ? (
                      <tr>
                        <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 2} className="px-4 py-12 text-center">
                          <FileSpreadsheet className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                          <p className="text-slate-600">No contacts available for distribution</p>
                          <p className="text-sm text-slate-500">
                            Import contacts to get started
                          </p>
                        </td>
                      </tr>
                    ) : (
                      paginatedContacts.map((contact) => (
                        <tr
                          key={contact.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={
                                activeTab === "limbo"
                                  ? selectedLimboContacts.has(contact.id)
                                  : selectedContacts.has(contact.id)
                              }
                              onChange={() => {
                                if (activeTab === "limbo") {
                                  const newSelected = new Set(selectedLimboContacts);
                                  if (newSelected.has(contact.id)) {
                                    newSelected.delete(contact.id);
                                  } else {
                                    newSelected.add(contact.id);
                                  }
                                  setSelectedLimboContacts(newSelected);
                                } else {
                                  handleSelectContact(contact.id);
                                }
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                            />
                          </td>
                          {columnOrder.map((columnKey) => {
                            if (!visibleColumns[columnKey as keyof typeof visibleColumns]) return null;
                            return renderCell(columnKey, contact);
                          })}
                          <td className="px-4 py-3">
                            {activeTab === "limbo" ? (
                              <button
                                onClick={() => handleAddToWorkspace(contact.id)}
                                className="rounded p-1.5 text-green-600 transition-colors hover:bg-green-50"
                                title="Add to my workspace"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDeleteSingle(contact.id, contact.business_name)}
                                className="rounded p-1.5 text-red-600 transition-colors hover:bg-red-50"
                                title="Delete contact"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </DndContext>
            </div>

            {/* Pagination Controls */}
            {sortedContacts.length > 0 && (
              <div className="mt-4 flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-700">
                      Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
                      <span className="font-medium">{Math.min(endIndex, sortedContacts.length)}</span> of{" "}
                      <span className="font-medium">{sortedContacts.length}</span> results
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="items-per-page" className="text-sm text-slate-700">
                      Items per page:
                    </label>
                    <select
                      id="items-per-page"
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                    </select>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center rounded-l-md border border-slate-300 bg-white px-2 py-2 text-slate-400 hover:bg-slate-50 focus:z-20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="sr-only">Previous</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>

                      {/* Page numbers */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`relative inline-flex items-center border px-4 py-2 text-sm font-medium focus:z-20 ${currentPage === pageNum
                              ? "z-10 border-orange-500 bg-orange-50 text-orange-600"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center rounded-r-md border border-slate-300 bg-white px-2 py-2 text-slate-400 hover:bg-slate-50 focus:z-20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="sr-only">Next</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Import Modal */}
          {showImportModal && (
            <ImportModal
              onClose={() => setShowImportModal(false)}
              onSuccess={loadData}
              currentUserId={currentUser?.id || ""}
            />
          )}

          {showSimpleImportModal && (
            <SimpleImportModal
              onClose={() => setShowSimpleImportModal(false)}
              onSuccess={loadData}
              currentUserId={currentUser?.id || ""}
            />
          )}

          {/* Distribution Modal */}
          {showDistributeModal && (
            <DistributeModal
              teamMembers={teamMembers}
              selectedCount={selectAllFiltered ? filteredContacts.length : selectedContacts.size}
              onDistribute={handleDistribute}
              onEvenDistribute={handleEvenDistribution}
              onClose={() => setShowDistributeModal(false)}
              currentUser={currentUser}
            />
          )}

          {/* Export Modal */}
          {showExportModal && (
            <ExportModal
              contacts={filteredContacts}
              selectedContacts={selectedContacts}
              onClose={() => setShowExportModal(false)}
            />
          )}

          {/* Bulk Source Edit Modal */}
          {showBulkSourceEdit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Set Source Tag
                  </h3>
                  <button
                    onClick={() => {
                      setShowBulkSourceEdit(false);
                      setBulkSourceValue("");
                    }}
                    className="rounded-lg p-1 hover:bg-slate-100"
                  >
                    <X className="h-5 w-5 text-slate-500" />
                  </button>
                </div>

                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Source Tag
                  </label>
                  <input
                    type="text"
                    value={bulkSourceValue}
                    onChange={(e) => setBulkSourceValue(e.target.value)}
                    placeholder="e.g., Raleigh, Past Clients - Noah, Manual Entry"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleBulkUpdateSource();
                      }
                    }}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    This tag will be applied to {selectAllFiltered ? filteredContacts.length : selectedContacts.size} selected contact{(selectAllFiltered ? filteredContacts.length : selectedContacts.size) === 1 ? '' : 's'}
                  </p>
                  <p className="mt-1 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                    💡 <strong>Note:</strong> Source tags will appear in the Kanban source filter once contacts are distributed to a team member
                  </p>

                  {/* Existing unique sources for suggestions */}
                  {uniqueSources.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-2 text-xs font-medium text-slate-600">Existing sources (click to use):</p>
                      <div className="flex flex-wrap gap-1.5">
                        {uniqueSources.map((source) => (
                          <button
                            key={source}
                            onClick={() => setBulkSourceValue(source)}
                            className="rounded-md bg-purple-50 px-2 py-1 text-xs text-purple-700 hover:bg-purple-100"
                          >
                            {source}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowBulkSourceEdit(false);
                      setBulkSourceValue("");
                    }}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkUpdateSource}
                    disabled={!bulkSourceValue.trim()}
                    className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Apply Tag
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {/* Closing brace for tab conditional - templates tab commented out for launch */}
    </div>
  );
}

// Sortable Column Header Component
function SortableColumnHeader({
  id,
  columnKey,
  label,
  sortable = false,
  sortField,
  sortDirection,
  onSort,
  width,
  onResizeStart,
  tooltip,
}: {
  id: string;
  columnKey: string;
  label: string;
  sortable?: boolean;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  onSort?: () => void;
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  tooltip?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: `${width}px`,
    minWidth: `${width}px`,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="relative px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700 bg-slate-50 border-r border-slate-200 group"
    >
      <div className="flex items-center gap-2">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="touch-none cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-slate-400" />
        </button>

        {/* Column Label */}
        <div
          className={`flex items-center gap-1 flex-1 ${sortable ? 'cursor-pointer select-none' : ''}`}
          onClick={sortable ? onSort : undefined}
        >
          <span>{label}</span>
          {sortable && sortField === columnKey && (
            <span className="text-orange-500">
              {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
          )}
          {tooltip && (
            <Tooltip content={tooltip} position="bottom" showIcon={false}>
              <Info className="h-3 w-3 text-slate-400" />
            </Tooltip>
          )}
        </div>
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={onResizeStart}
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-orange-500 active:bg-orange-600 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ touchAction: 'none' }}
      />
    </th>
  );
}

// Import Modal Component
function ImportModal({
  onClose,
  onSuccess,
  currentUserId,
}: {
  onClose: () => void;
  onSuccess: () => void;
  currentUserId: string;
}) {
  const [step, setStep] = useState<"upload" | "map" | "preview">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string[]>>(
    {},
  );
  const [uploading, setUploading] = useState(false);
  const [importSource, setImportSource] = useState<string>("");
  const [importSourceError, setImportSourceError] = useState<string>("");
  const [importSourceInfo, setImportSourceInfo] = useState<string>("");
  const [duplicates, setDuplicates] = useState<Array<{ row: any, existing: any, action: 'skip' | 'update' | 'create', matchedFields?: string[] }>>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'ask' | 'skip_all' | 'update_all'>('ask');
  const [importProgress, setImportProgress] = useState({ stage: '', current: 0, total: 0, percent: 0 });
  const [showProgress, setShowProgress] = useState(false);
  const [extractDomainFromEmail, setExtractDomainFromEmail] = useState(true);
  const [splitCityState, setSplitCityState] = useState(true);

  const dbFields = [
    { value: "", label: "— Ignore Column —" },
    { value: "business_name", label: "Business/Company Name" },
    { value: "contact_name", label: "Contact Name (Full Name)" },
    { value: "first_name", label: "First Name" },
    { value: "last_name", label: "Last Name" },
    { value: "job_title", label: "Job Title/Position" },
    { value: "phone", label: "Phone (Cell/Mobile)" },
    { value: "phone_ext", label: "Phone Extension" },
    { value: "phone_2", label: "Phone 2 (Direct Office)" },
    { value: "phone_2_ext", label: "Phone 2 Extension" },
    { value: "phone_3", label: "Phone 3 (Main/HQ)" },
    { value: "phone_3_ext", label: "Phone 3 Extension" },
    { value: "email", label: "Email" },
    { value: "industry", label: "Industry" },
    { value: "address", label: "Street Address (Primary/HQ)" },
    { value: "city", label: "City (Primary/HQ)" },
    { value: "state", label: "State (Primary/HQ)" },
    { value: "zip", label: "ZIP Code (Primary/HQ)" },
    { value: "address_2", label: "Street Address (Regional Office)" },
    { value: "city_2", label: "City (Regional Office)" },
    { value: "state_2", label: "State (Regional Office)" },
    { value: "zip_2", label: "ZIP Code (Regional Office)" },
    { value: "shipping_frequency", label: "Shipping Frequency" },
    { value: "office_location", label: "Office Location" },
    { value: "opportunity_type", label: "Opportunity Type" },
    { value: "estimated_value", label: "Estimated Annual Shipping Revenue ($)" },
    { value: "url", label: "Primary URL/Link" },
    { value: "url_1", label: "Secondary URL/Link" },
    { value: "dispatches", label: "Historical Dispatches" },
    { value: "linkedin_url", label: "LinkedIn URL" },
    { value: "website_url", label: "Website URL" },
    { value: "facebook_url", label: "Facebook URL" },
    { value: "twitter_url", label: "Twitter URL" },
    { value: "instagram_url", label: "Instagram URL" },
    { value: "notes", label: "Notes" },
    { value: "tms_account_id", label: "TMS ID (Quote ID / Order ID)" },
    // Note: customer_id is excluded - it's auto-generated by the database
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);

      // Clear import source - require user to enter it manually
      setImportSource("");
      setImportSourceError("");

      // Parse file
      await parseFile(selectedFile);
    }
  };

  // Validate import source and check if it already exists
  const validateImportSource = async (sourceName: string): Promise<boolean> => {
    if (!sourceName || sourceName.trim() === "") {
      setImportSourceError("Import source name is required");
      setImportSourceInfo("");
      return false;
    }

    const trimmedSource = sourceName.trim();
    const supabase = createClient();

    // Check if this import source name already exists
    const { data: existing, count } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: false })
      .ilike('import_source', trimmedSource);

    if (existing && existing.length > 0) {
      // Allow reusing existing tags - just show info message
      setImportSourceInfo(`ℹ️ "${trimmedSource}" already exists with ${count} contact${count !== 1 ? 's' : ''}. New contacts will be added to this tag.`);
      setImportSourceError("");
      return true; // Allow proceeding
    }

    setImportSourceError("");
    setImportSourceInfo("");
    return true;
  };

  const parseFile = async (file: File) => {
    const Papa = (await import("papaparse")).default;

    if (file.name.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length > 0) {
            const headers = Object.keys(results.data[0] as Record<string, any>);
            setCsvHeaders(headers);
            setCsvData(results.data);

            // Auto-map columns based on common names (single mapping per column by default)
            const autoMapping: Record<string, string[]> = {};
            headers.forEach((header) => {
              const normalized = header.toLowerCase().replace(/[_\s-]/g, "");
              if (
                normalized.includes("business") ||
                normalized.includes("company")
              )
                autoMapping[header] = ["business_name"];
              else if (normalized.includes("contact"))
                autoMapping[header] = ["contact_name"];
              else if (normalized.includes("firstname"))
                autoMapping[header] = ["first_name"];
              else if (normalized.includes("lastname"))
                autoMapping[header] = ["last_name"];
              else if (
                normalized.includes("jobtitle") ||
                normalized.includes("position") ||
                normalized.includes("title")
              )
                autoMapping[header] = ["job_title"];
              else if (normalized.includes("phone"))
                autoMapping[header] = ["phone"];
              else if (normalized.includes("email"))
                autoMapping[header] = ["email"];
              else if (normalized.includes("industry"))
                autoMapping[header] = ["industry"];
              else if (normalized.includes("city"))
                autoMapping[header] = ["city"];
              else if (normalized.includes("state"))
                autoMapping[header] = ["state"];
              else if (
                normalized.includes("shipping") ||
                normalized.includes("frequency")
              )
                autoMapping[header] = ["shipping_frequency"];
              else if (normalized.includes("linkedin"))
                autoMapping[header] = ["linkedin_url"];
              else if (normalized.includes("website"))
                autoMapping[header] = ["website_url"];
              else if (normalized.includes("facebook"))
                autoMapping[header] = ["facebook_url"];
              else if (normalized.includes("twitter"))
                autoMapping[header] = ["twitter_url"];
              else if (normalized.includes("instagram"))
                autoMapping[header] = ["instagram_url"];
              else if (normalized.includes("note"))
                autoMapping[header] = ["notes"];
              else if (
                normalized.includes("tms") ||
                normalized.includes("account") ||
                normalized === "quoteid" ||
                normalized === "quote_id" ||
                normalized === "quotenumber" ||
                normalized === "quote" ||
                normalized === "orderid" ||
                normalized === "order_id" ||
                normalized === "ordernumber" ||
                normalized === "order"
              )
                autoMapping[header] = ["tms_account_id"];
              else if (
                normalized.includes("dispatch") ||
                normalized.includes("dispatched")
              )
                autoMapping[header] = ["dispatches"];
            });
            setColumnMapping(autoMapping);
            // Don't auto-advance - require import_source first
          }
        },
      });
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Extract hyperlinks from cells
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        const headers = Object.keys(jsonData[0] as Record<string, any>);

        // Process each row to extract hyperlinks
        const processedData = jsonData.map((row: any, rowIndex: number) => {
          const processedRow: any = { ...row };

          headers.forEach((header, colIndex) => {
            // Calculate cell address (skip header row)
            const cellAddress = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
            const cell = worksheet[cellAddress];

            // If cell has a hyperlink, use the URL instead of display text
            if (cell && cell.l && cell.l.Target) {
              processedRow[header] = cell.l.Target;
            }
          });

          return processedRow;
        });

        if (processedData.length > 0) {
          const headers = Object.keys(processedData[0] as Record<string, any>);
          setCsvHeaders(headers);
          setCsvData(processedData);

          // Auto-map columns (single mapping per column by default)
          const autoMapping: Record<string, string[]> = {};
          headers.forEach((header) => {
            const normalized = header.toLowerCase().replace(/[_\s-]/g, "");
            if (
              normalized.includes("business") ||
              normalized.includes("company")
            )
              autoMapping[header] = ["business_name"];
            else if (normalized.includes("contact"))
              autoMapping[header] = ["contact_name"];
            else if (normalized.includes("firstname"))
              autoMapping[header] = ["first_name"];
            else if (normalized.includes("lastname"))
              autoMapping[header] = ["last_name"];
            else if (
              normalized.includes("jobtitle") ||
              normalized.includes("position") ||
              normalized.includes("title")
            )
              autoMapping[header] = ["job_title"];
            else if (normalized.includes("phone"))
              autoMapping[header] = ["phone"];
            else if (normalized.includes("email"))
              autoMapping[header] = ["email"];
            else if (normalized.includes("industry"))
              autoMapping[header] = ["industry"];
            else if (normalized.includes("city")) autoMapping[header] = ["city"];
            else if (normalized.includes("state"))
              autoMapping[header] = ["state"];
            else if (
              normalized.includes("shipping") ||
              normalized.includes("frequency")
            )
              autoMapping[header] = ["shipping_frequency"];
            else if (normalized.includes("linkedin"))
              autoMapping[header] = ["linkedin_url"];
            else if (normalized.includes("website"))
              autoMapping[header] = ["website_url"];
            else if (normalized.includes("facebook"))
              autoMapping[header] = ["facebook_url"];
            else if (normalized.includes("twitter"))
              autoMapping[header] = ["twitter_url"];
            else if (normalized.includes("instagram"))
              autoMapping[header] = ["instagram_url"];
            else if (normalized.includes("note"))
              autoMapping[header] = ["notes"];
            else if (
              normalized.includes("tms") ||
              normalized.includes("account") ||
              normalized === "quoteid" ||
              normalized === "quote_id" ||
              normalized === "quotenumber" ||
              normalized === "quote" ||
              normalized === "orderid" ||
              normalized === "order_id" ||
              normalized === "ordernumber" ||
              normalized === "order"
            )
              autoMapping[header] = ["tms_account_id"];
            else if (
              normalized.includes("dispatch") ||
              normalized.includes("dispatched")
            )
              autoMapping[header] = ["dispatches"];
          });
          setColumnMapping(autoMapping);
          // Don't auto-advance - require import_source first
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "business_name",
      "first_name",
      "last_name",
      "phone",
      "email",
      "industry",
      "address",
      "city",
      "state",
      "zip",
      "shipping_frequency",
      "url",
      "linkedin_url",
      "website_url",
      "notes",
    ];

    const exampleRow = [
      "ABC Manufacturing",
      "John",
      "Smith",
      "555-123-4567",
      "john@abcmfg.com",
      "Manufacturing",
      "123 Industrial Pkwy",
      "Los Angeles",
      "CA",
      "90001",
      "monthly",
      "https://crm.example.com/orders/12345",
      "https://linkedin.com/company/abc-mfg",
      "https://abcmfg.com",
      "Solar panel manufacturer",
    ];

    const csvContent = headers.join(",") + "\n" + exampleRow.join(",") + "\n";

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nts-contacts-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Helper: Normalize phone numbers for comparison
  const normalizePhone = (phone: unknown): string => {
    if (!phone) return '';
    return String(phone).replace(/\D/g, ''); // Remove all non-digits
  };

  // Helper: Normalize email for comparison
  const normalizeEmail = (email: unknown): string => {
    if (!email) return '';
    return String(email).toLowerCase().trim();
  };

  // Helper: Normalize business name for comparison
  const normalizeBusinessName = (name: unknown): string => {
    if (!name) return '';
    return String(name).toLowerCase().trim()
      .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b\.?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleImport = async () => {
    // No field validation - all fields are optional
    // Database will handle any actual requirements with fallback logic

    setUploading(true);
    setShowProgress(true);
    const supabase = createClient();

    // First pass: detect duplicates efficiently with normalized values
    const duplicateChecks: Array<{ row: any, existing: any, action: 'skip' | 'update' | 'create', matchedFields: string[] }> = [];

    setImportProgress({ stage: 'Checking for duplicates...', current: 0, total: csvData.length, percent: 0 });

    // OPTIMIZED: Instead of fetching ALL contacts, build targeted queries
    // Extract unique emails, phones, and business names from CSV
    const emailsToCheck = new Set<string>();
    const phonesToCheck = new Set<string>();
    const businessNamesToCheck = new Set<string>();

    csvData.forEach(row => {
      const email = row[Object.keys(columnMapping).find(k => columnMapping[k]?.includes('email')) || ''];
      const phone = row[Object.keys(columnMapping).find(k => columnMapping[k]?.includes('phone')) || ''];
      const businessName = row[Object.keys(columnMapping).find(k => columnMapping[k]?.includes('business_name')) || ''];

      if (email) emailsToCheck.add(normalizeEmail(email));
      if (phone) phonesToCheck.add(normalizePhone(phone));
      if (businessName) businessNamesToCheck.add(normalizeBusinessName(businessName));
    });

    // Fetch only potentially matching contacts (much faster than fetching everything)
    const existingContactsMap = new Map<string, any>();

    // Fetch by email matches
    if (emailsToCheck.size > 0) {
      const emailArray = Array.from(emailsToCheck);
      // Supabase 'in' filter has limits, so batch if needed
      const batchSize = 100;
      for (let i = 0; i < emailArray.length; i += batchSize) {
        const batch = emailArray.slice(i, i + batchSize);
        const { data } = await supabase
          .from('customers')
          .select('*')
          .not('email', 'is', null);

        data?.forEach(contact => {
          const key = `${normalizeEmail(contact.email)}_${normalizePhone(contact.phone)}_${normalizeBusinessName(contact.business_name)}`;
          existingContactsMap.set(key, contact);
        });
      }
    }

    const existingContacts: any[] = Array.from(existingContactsMap.values());

    // Check each row against existing contacts with smart matching
    let processedRows = 0;
    for (const row of csvData) {
      processedRows++;
      setImportProgress({
        stage: 'Checking for duplicates...',
        current: processedRows,
        total: csvData.length,
        percent: Math.round((processedRows / csvData.length) * 100)
      });
      const csvEmail = row[Object.keys(columnMapping).find(k => columnMapping[k]?.includes('email')) || ''];
      const csvPhone = row[Object.keys(columnMapping).find(k => columnMapping[k]?.includes('phone')) || ''];
      const csvBusinessName = row[Object.keys(columnMapping).find(k => columnMapping[k]?.includes('business_name')) || ''];

      if (!csvEmail && !csvPhone && !csvBusinessName) continue;

      // Normalize for comparison
      const normEmail = normalizeEmail(csvEmail);
      const normPhone = normalizePhone(csvPhone);
      const normBusiness = normalizeBusinessName(csvBusinessName);

      // Find best matching existing contact (prioritize multi-field matches)
      let bestMatch: any = null;
      let matchedFields: string[] = [];
      let matchScore = 0;

      for (const existing of existingContacts) {
        const existingEmail = normalizeEmail(existing.email);
        const existingPhone = normalizePhone(existing.phone);
        const existingBusiness = normalizeBusinessName(existing.business_name);

        const currentMatched: string[] = [];
        let currentScore = 0;

        // Check matches (weighted scoring)
        if (normEmail && existingEmail && normEmail === existingEmail) {
          currentMatched.push('email');
          currentScore += 10; // Email match is strong
        }
        if (normPhone && existingPhone && normPhone === existingPhone) {
          currentMatched.push('phone');
          currentScore += 10; // Phone match is strong
        }
        if (normBusiness && existingBusiness && normBusiness === existingBusiness) {
          currentMatched.push('business_name');
          currentScore += 5; // Business name match is moderate (can have legitimate duplicates)
        }

        // Update best match if this is better
        if (currentScore > matchScore) {
          bestMatch = existing;
          matchedFields = currentMatched;
          matchScore = currentScore;
        }
      }

      // If we found a match, add to duplicate checks
      if (bestMatch && matchedFields.length > 0) {
        duplicateChecks.push({
          row,
          existing: bestMatch,
          matchedFields,
          action: duplicateStrategy === 'skip_all' ? 'skip' : duplicateStrategy === 'update_all' ? 'update' : 'skip'
        });
      }
    }

    // If duplicates found and strategy is 'ask', show modal
    if (duplicateChecks.length > 0 && duplicateStrategy === 'ask') {
      setDuplicates(duplicateChecks);
      setShowDuplicateModal(true);
      setUploading(false);
      return;
    }

    // Continue with actual import
    await performImport(duplicateChecks);
  };

  const performImport = async (duplicateChecks: Array<{ row: any, existing: any, action: 'skip' | 'update' | 'create' }> = []) => {
    const supabase = createClient();

    setImportProgress({ stage: 'Preparing import...', current: 0, total: csvData.length, percent: 0 });

    // Shipping frequency normalization map
    const normalizeShippingFrequency = (value: string): string => {
      if (!value) return "monthly";
      const lower = String(value).toLowerCase().trim();
      if (lower.includes("one") && lower.includes("time")) return "other";
      if (lower.includes("occasional") || lower.includes("1-3")) return "yearly";
      if (lower.includes("quarterly") || lower.includes("quarter")) return "quarterly";
      if (lower.includes("monthly") || lower.includes("month")) return "monthly";
      if (lower.includes("weekly") && !lower.includes("bi") && !lower.includes("multiple")) return "weekly";
      if (lower.includes("multiple") || lower.includes("per week")) return "multiple_per_week";
      if (lower.includes("daily") || lower.includes("day")) return "bi_weekly";
      return "monthly"; // default
    };

    try {
      // Transform data based on mapping
      const customersToInsert = csvData.map((row) => {
        const customer: any = {
          team_member_id: null, // Leave unassigned for distribution to team
          imported_by: currentUserId, // Track who imported this contact
          business_name: "",
          contact_name: "",
          status: "prospect",
          on_kanban_board: false, // Imported contacts start in list view only
          import_source: importSource || "Manual Import",
        };

        // Collect unmapped columns for import_metadata
        const metadata: Record<string, any> = {};
        const mappedCsvColumns = new Set(Object.keys(columnMapping).filter(k => columnMapping[k] && columnMapping[k].length > 0));
        const explicitlyIgnoredColumns = new Set<string>();

        // Map columns (EXCLUDE customer_id - it's auto-generated)
        // Handle multiple mappings per CSV column
        Object.entries(columnMapping).forEach(([csvCol, dbFields]) => {
          if (!dbFields || dbFields.length === 0 || !row[csvCol]) return;

          dbFields.forEach((dbField) => {
            if (dbField && dbField !== "customer_id") {
              if (dbField === "shipping_frequency") {
                customer[dbField] = normalizeShippingFrequency(row[csvCol]);
              } else if (dbField === "dispatches") {
                // Dispatches goes into metadata, not as a direct field
                const value = row[csvCol];
                metadata.dispatches = typeof value === 'string' && !isNaN(Number(value)) ? Number(value) : value;
              } else if (dbField === "estimated_value") {
                // Clean currency formatting from estimated_value (remove $, commas)
                const value = row[csvCol];
                if (typeof value === 'string') {
                  const cleanedValue = value.replace(/[$,]/g, '').trim();
                  customer[dbField] = !isNaN(Number(cleanedValue)) && cleanedValue !== '' ? Number(cleanedValue) : null;
                } else if (typeof value === 'number') {
                  customer[dbField] = value;
                } else {
                  customer[dbField] = null;
                }
              } else if ((dbField === 'city' || dbField === 'city_2') && splitCityState) {
                // Smart split: If city contains comma, split into city and state
                const value = String(row[csvCol]).trim();
                if (value.includes(',')) {
                  const [cityPart, statePart] = value.split(',').map(s => s.trim());
                  customer[dbField] = cityPart;
                  // Determine corresponding state field
                  const stateField = dbField === 'city' ? 'state' : 'state_2';
                  // Only set state if not already mapped
                  if (!customer[stateField]) {
                    customer[stateField] = statePart;
                  }
                } else {
                  customer[dbField] = value;
                }
              } else {
                // All other fields map directly to customer table columns
                customer[dbField] = row[csvCol];
              }
            }
          });
        });

        // Smart feature: Extract domain from email to populate website_url
        if (extractDomainFromEmail && customer.email && !customer.website_url) {
          try {
            const emailValue = String(customer.email).trim();
            const atIndex = emailValue.indexOf('@');
            if (atIndex > 0) {
              const domain = emailValue.substring(atIndex + 1);
              // Only extract if domain looks valid (has at least one dot)
              if (domain.includes('.') && domain.length > 3) {
                customer.website_url = `https://${domain}`;
              }
            }
          } catch (e) {
            // Ignore errors - just skip domain extraction for this row
          }
        }

        // Collect unmapped columns into import_metadata
        // EXCLUDE: columns explicitly set to "Ignore Column" (empty string in mapping)
        Object.keys(row).forEach((csvCol) => {
          const isNotMapped = !mappedCsvColumns.has(csvCol);
          const isExplicitlyIgnored = explicitlyIgnoredColumns.has(csvCol);

          // Only preserve if: has data, not mapped to a field, and NOT explicitly ignored
          if (row[csvCol] && isNotMapped && !isExplicitlyIgnored) {
            // Normalize column name to snake_case for consistency
            const fieldName = csvCol.toLowerCase().replace(/[\s-]+/g, '_');

            // Try to parse numbers
            const value = row[csvCol];
            if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
              metadata[fieldName] = Number(value);
            } else {
              metadata[fieldName] = value;
            }
          }
        });

        // Add import metadata if any unmapped columns exist
        if (Object.keys(metadata).length > 0) {
          customer.import_metadata = metadata;
        }

        // Fallback logic for better data quality
        // IMPORTANT: Database requires at least one name field (business_name, contact_name, first_name, or last_name)

        // Build contact_name from first/last if not directly provided
        if (!customer.contact_name) {
          if (customer.first_name || customer.last_name) {
            customer.contact_name = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
          } else if (customer.business_name) {
            customer.contact_name = customer.business_name;
          }
        }

        // If no business_name, use contact_name as fallback
        if (!customer.business_name && customer.contact_name) {
          customer.business_name = customer.contact_name;
        }

        // CRITICAL: Ensure at least one name field is populated (database constraint)
        // If all name fields are empty, use a placeholder based on available data
        const hasAnyName = customer.business_name || customer.contact_name || customer.first_name || customer.last_name;
        if (!hasAnyName) {
          // Try to build a meaningful name from other fields
          if (customer.email) {
            // Use email prefix as name (e.g., john.smith@company.com → john.smith)
            const emailPrefix = customer.email.split('@')[0].replace(/[._-]/g, ' ');
            customer.contact_name = emailPrefix.split(' ').map((word: string) =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
          } else if (customer.phone) {
            // Use phone as identifier
            customer.contact_name = `Contact ${customer.phone}`;
          } else if (customer.city || customer.state) {
            // Use location as identifier
            customer.contact_name = `Contact from ${[customer.city, customer.state].filter(Boolean).join(', ')}`;
          } else {
            // Last resort: use a generic placeholder
            customer.contact_name = 'Imported Contact';
          }
        }

        // Remove customer_id if somehow it got added (safety check)
        delete customer.customer_id;

        return customer;
      });

      // Separate into creates and updates based on duplicate checks
      const toCreate: any[] = [];
      const toUpdate: Array<{ id: string, data: any }> = [];

      customersToInsert.forEach((customer, index) => {
        const row = csvData[index];
        const duplicateInfo = duplicateChecks.find(d => d.row === row);

        if (duplicateInfo) {
          if (duplicateInfo.action === 'update') {
            toUpdate.push({ id: duplicateInfo.existing.id, data: customer });
          } else if (duplicateInfo.action === 'create') {
            toCreate.push(customer);
          }
          // 'skip' means do nothing
        } else {
          toCreate.push(customer);
        }
      });

      let created = 0;
      let updated = 0;
      let skipped = duplicateChecks.filter(d => d.action === 'skip').length;

      // Insert new contacts in batches
      if (toCreate.length > 0) {
        const batchSize = 50;
        for (let i = 0; i < toCreate.length; i += batchSize) {
          const batch = toCreate.slice(i, i + batchSize);

          setImportProgress({
            stage: 'Importing contacts...',
            current: i + batch.length,
            total: toCreate.length,
            percent: Math.round(((i + batch.length) / toCreate.length) * 100)
          });

          const { error } = await supabase.from("customers").insert(batch);

          if (error) {
            console.error("Import error:", error);
            alert(`Error importing batch: ${error.message}`);
            setUploading(false);
            setShowProgress(false);
            return;
          }
          created += batch.length;
        }
      }

      // Update existing contacts
      if (toUpdate.length > 0) {
        let updatedCount = 0;
        for (const { id, data } of toUpdate) {
          updatedCount++;
          setImportProgress({
            stage: 'Updating existing contacts...',
            current: updatedCount,
            total: toUpdate.length,
            percent: Math.round((updatedCount / toUpdate.length) * 100)
          });

          const { error } = await supabase
            .from("customers")
            .update(data)
            .eq("id", id);

          if (error) {
            console.error("Update error:", error);
          } else {
            updated++;
          }
        }
      }

      setShowProgress(false);
      alert(`Import complete!\nCreated: ${created}\nUpdated: ${updated}\nSkipped: ${skipped}`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Import error:", error);
      alert("Error during import");
      setShowProgress(false);
    }

    setUploading(false);
  };

  return (
    <>
      {/* Duplicate Handling Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 bg-amber-50 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-amber-900">
                  ⚠️ Duplicate Contacts Found
                </h3>
                <p className="text-sm text-amber-700">
                  {duplicates.length} contact{duplicates.length !== 1 ? 's' : ''} already exist in the database
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDuplicateModal(false);
                  setUploading(false);
                }}
                className="rounded-lg p-1 hover:bg-amber-100"
              >
                <X className="h-5 w-5 text-amber-700" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Bulk Actions */}
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => {
                    setDuplicates(duplicates.map(d => ({ ...d, action: 'skip' })));
                  }}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Skip All
                </button>
                <button
                  onClick={() => {
                    setDuplicates(duplicates.map(d => ({ ...d, action: 'update' })));
                  }}
                  className="flex-1 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                >
                  Update All
                </button>
              </div>

              {/* Duplicate List */}
              <div className="space-y-3">
                {duplicates.map((dup, index) => {
                  const csvEmail = dup.row[Object.keys(columnMapping).find(k => columnMapping[k]?.includes('email')) || ''];
                  const csvPhone = dup.row[Object.keys(columnMapping).find(k => columnMapping[k]?.includes('phone')) || ''];
                  const csvName = dup.row[Object.keys(columnMapping).find(k => columnMapping[k]?.includes('business_name')) || ''] ||
                    dup.row[Object.keys(columnMapping).find(k => columnMapping[k]?.includes('contact_name')) || ''];

                  const matchedFields = dup.matchedFields || [];
                  const getMatchIcon = (field: string) => {
                    return matchedFields.includes(field) ? '✓' : '';
                  };

                  return (
                    <div key={index} className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{csvName}</p>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                            {csvEmail && (
                              <span className={matchedFields.includes('email') ? 'font-semibold text-amber-700' : ''}>
                                📧 {csvEmail} {getMatchIcon('email')}
                              </span>
                            )}
                            {csvPhone && (
                              <span className={matchedFields.includes('phone') ? 'font-semibold text-amber-700' : ''}>
                                📞 {csvPhone} {getMatchIcon('phone')}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                          {matchedFields.length > 1 ? `${matchedFields.length} Matches` : 'Duplicate Found'}
                        </span>
                      </div>

                      <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3">
                        <p className="mb-1 text-xs font-medium text-slate-600">
                          Existing Record:
                          {matchedFields.length > 0 && (
                            <span className="ml-2 text-amber-600">
                              (Matched: {matchedFields.map(f => f.replace('_', ' ')).join(', ')})
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-slate-900">{dup.existing.business_name}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                          {dup.existing.email && (
                            <span className={matchedFields.includes('email') ? 'font-semibold text-amber-700' : ''}>
                              📧 {dup.existing.email} {getMatchIcon('email')}
                            </span>
                          )}
                          {dup.existing.phone && (
                            <span className={matchedFields.includes('phone') ? 'font-semibold text-amber-700' : ''}>
                              📞 {dup.existing.phone} {getMatchIcon('phone')}
                            </span>
                          )}
                          {dup.existing.team_member_id && <span className="text-blue-600">✓ Assigned</span>}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const updated = [...duplicates];
                            updated[index].action = 'skip';
                            setDuplicates(updated);
                          }}
                          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${dup.action === 'skip'
                            ? 'bg-slate-600 text-white'
                            : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                          Skip
                        </button>
                        <button
                          onClick={() => {
                            const updated = [...duplicates];
                            updated[index].action = 'update';
                            setDuplicates(updated);
                          }}
                          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${dup.action === 'update'
                            ? 'bg-blue-600 text-white'
                            : 'border border-blue-300 bg-white text-blue-700 hover:bg-blue-50'
                            }`}
                        >
                          Update
                        </button>
                        <button
                          onClick={() => {
                            const updated = [...duplicates];
                            updated[index].action = 'create';
                            setDuplicates(updated);
                          }}
                          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${dup.action === 'create'
                            ? 'bg-orange-600 text-white'
                            : 'border border-orange-300 bg-white text-orange-700 hover:bg-orange-50'
                            }`}
                        >
                          Create New
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => {
                  setShowDuplicateModal(false);
                  setUploading(false);
                }}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel Import
              </button>
              <button
                onClick={async () => {
                  setShowDuplicateModal(false);
                  setUploading(true);
                  setShowProgress(true);
                  await performImport(duplicates);
                }}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Continue Import ({duplicates.filter(d => d.action !== 'skip').length} contacts)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Import Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-4xl rounded-lg bg-white shadow-xl max-h-[90vh] overflow-hidden flex flex-col relative">
          {/* Progress Overlay */}
          {showProgress && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm">
              <div className="w-full max-w-md space-y-4 px-6">
                <div className="text-center">
                  <div className="mb-2 text-lg font-semibold text-slate-900">
                    {importProgress.stage}
                  </div>
                  <div className="text-sm text-slate-600">
                    {importProgress.current > 0 && importProgress.total > 0 && (
                      <>
                        {importProgress.current.toLocaleString()} of {importProgress.total.toLocaleString()}
                        {importProgress.stage.includes('duplicate') ? ' checked' : ' imported'}
                      </>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="relative h-3 overflow-hidden rounded-full bg-slate-200">
                  <motion.div
                    className="h-full bg-linear-to-r from-orange-500 to-orange-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${importProgress.percent}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </div>

                {/* Percentage */}
                <div className="text-center text-2xl font-bold text-orange-600">
                  {importProgress.percent}%
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Import Contacts
              </h3>
              <p className="text-sm text-slate-600">
                {step === "upload" && "Upload your CSV or Excel file"}
                {step === "map" && "Map columns to database fields"}
                {step === "preview" && "Preview and confirm import"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 hover:bg-slate-100"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Step 1: Upload */}
            {step === "upload" && (
              <div className="space-y-4">
                {/* Template Download */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        Need a template?
                      </p>
                      <p className="text-xs text-blue-700">
                        Download our CSV template with example data
                      </p>
                    </div>
                    <button
                      onClick={downloadTemplate}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <Download className="h-4 w-4" />
                      Template
                    </button>
                  </div>
                  <p className="text-xs text-blue-600">
                    Headers: business_name, first_name, last_name, phone, email, industry,
                    city, state, shipping_frequency, url, linkedin_url, website_url,
                    notes
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Upload CSV or Excel File
                  </label>

                  {/* Hidden file input */}
                  <input
                    type="file"
                    id="file-upload-input"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {/* Custom styled upload button */}
                  <label
                    htmlFor="file-upload-input"
                    className="group relative flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 transition-all hover:border-[#E85D04] hover:bg-orange-50"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-slate-200 transition-all group-hover:ring-[#E85D04] group-hover:shadow-md">
                      <Upload className="h-8 w-8 text-slate-400 transition-colors group-hover:text-[#E85D04]" />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-semibold text-slate-900 group-hover:text-[#E85D04]">
                        {file ? file.name : 'Click to browse or drag file here'}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Supported formats: CSV, XLSX, XLS
                      </p>
                      {!file && (
                        <p className="mt-2 text-xs text-slate-400">
                          Maximum file size: 10MB
                        </p>
                      )}
                    </div>
                    {!file && (
                      <div className="absolute inset-0 rounded-lg bg-linear-to-br from-[#E85D04]/0 via-[#E85D04]/0 to-[#E85D04]/0 opacity-0 transition-opacity group-hover:opacity-5" />
                    )}
                  </label>
                </div>

                {file && (
                  <>
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                      <p className="text-sm text-green-800">
                        <CheckCircle className="mr-1 inline h-4 w-4" />
                        {file.name} selected ({csvData.length} rows)
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Import Source Tag <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={importSource}
                        onChange={(e) => {
                          setImportSource(e.target.value);
                          setImportSourceError("");
                        }}
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value) {
                            validateImportSource(value);
                          }
                        }}
                        placeholder="e.g., Past Clients, Trade Show 2026, Web Scrape"
                        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${importSourceError
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-slate-200 focus:border-orange-500 focus:ring-orange-500/20'
                          }`}
                      />
                      {importSourceError && (
                        <p className="mt-1 text-xs text-red-600">
                          {importSourceError}
                        </p>
                      )}
                      {importSourceInfo && (
                        <p className="mt-1 text-xs text-blue-600">
                          {importSourceInfo}
                        </p>
                      )}
                      {!importSourceError && !importSourceInfo && (
                        <p className="mt-1 text-xs text-slate-500">
                          Tag name to group imported contacts (e.g., "Trade Show 2026", "Cold List", "Web Scrape"). You can reuse existing tags to add more contacts.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 2: Column Mapping */}
            {step === "map" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm text-blue-900">
                    <AlertCircle className="mr-1 inline h-4 w-4" />
                    Map your CSV columns to database fields. <strong>Check multiple boxes</strong> to duplicate a single column to multiple fields (e.g., "Company Name" → both Business Name + Contact Name).
                    Unmapped columns are preserved in metadata. URLs in hyperlinked cells are automatically extracted.
                  </p>
                </div>

                {/* Smart Data Processing Options */}
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold uppercase text-amber-900 mb-2">Smart Data Processing</p>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={extractDomainFromEmail}
                      onChange={(e) => setExtractDomainFromEmail(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm text-amber-900">
                      <strong>Extract domain from email:</strong> If email contains a domain (e.g., jason@bigconstruction.com) and no Website URL is mapped, automatically populate website as https://bigconstruction.com
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={splitCityState}
                      onChange={(e) => setSplitCityState(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm text-amber-900">
                      <strong>Split combined City, State:</strong> If a city field contains both city and state (e.g., "Benkelman, Nebraska"), automatically split into separate fields
                    </span>
                  </label>
                </div>

                <div className="space-y-3">
                  {csvHeaders.map((header) => {
                    const mappedFields = columnMapping[header] || [];
                    return (
                      <div
                        key={header}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="mb-2">
                          <p className="text-sm font-medium text-slate-900">
                            {header}
                          </p>
                          <p className="text-xs text-slate-500">
                            Sample: {csvData[0]?.[header]?.toString().substring(0, 50) || "—"}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border-t border-slate-200 pt-2">
                          {dbFields.filter(f => f.value !== "").map((field) => (
                            <label
                              key={field.value}
                              className="flex items-start gap-2 cursor-pointer hover:bg-slate-100 p-1.5 rounded"
                            >
                              <input
                                type="checkbox"
                                checked={mappedFields.includes(field.value)}
                                onChange={(e) => {
                                  const isChecked = e.target.checked;
                                  setColumnMapping({
                                    ...columnMapping,
                                    [header]: isChecked
                                      ? [...mappedFields, field.value]
                                      : mappedFields.filter(f => f !== field.value),
                                  });
                                }}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                              />
                              <span className="text-xs text-slate-700">{field.label}</span>
                            </label>
                          ))}
                        </div>
                        {mappedFields.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {mappedFields.map(fieldValue => {
                              const fieldLabel = dbFields.find(f => f.value === fieldValue)?.label;
                              return (
                                <span key={fieldValue} className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                                  {fieldLabel}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 3: Preview */}
            {step === "preview" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-sm text-green-900">
                    <CheckCircle className="mr-1 inline h-4 w-4" />
                    Ready to import {csvData.length} contacts
                    {Object.keys(columnMapping).filter(k => columnMapping[k] && columnMapping[k].length > 0).length > 0 && (
                      <span className="ml-2 text-xs text-green-700">
                        ({Object.values(columnMapping).flat().filter(Boolean).length} field mappings)
                      </span>
                    )}
                  </p>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-700">
                          Business Name
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-700">
                          Contact Name
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-700">
                          Location
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-700">
                          Source
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {csvData.slice(0, 5).map((row, idx) => {
                        // Find CSV column names for each field
                        const businessNameCol = Object.keys(columnMapping).find(k => columnMapping[k]?.includes('business_name'));
                        const firstNameCol = Object.keys(columnMapping).find(k => columnMapping[k]?.includes('first_name'));
                        const lastNameCol = Object.keys(columnMapping).find(k => columnMapping[k]?.includes('last_name'));
                        const contactNameCol = Object.keys(columnMapping).find(k => columnMapping[k]?.includes('contact_name'));
                        const cityCol = Object.keys(columnMapping).find(k => columnMapping[k]?.includes('city'));
                        const stateCol = Object.keys(columnMapping).find(k => columnMapping[k]?.includes('state'));

                        // Get values
                        const businessName = businessNameCol ? row[businessNameCol] : '';
                        const firstName = firstNameCol ? row[firstNameCol] : '';
                        const lastName = lastNameCol ? row[lastNameCol] : '';
                        const contactName = contactNameCol ? row[contactNameCol] : '';
                        const city = cityCol ? row[cityCol] : '';
                        const state = stateCol ? row[stateCol] : '';

                        // Build contact name display
                        const displayContactName = contactName ||
                          [firstName, lastName].filter(Boolean).join(' ') ||
                          '—';

                        // Build location display
                        const displayLocation = city && state
                          ? `${city}, ${state}`
                          : state || city || '—';

                        return (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-slate-900">
                              {businessName || '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-900">
                              {displayContactName}
                            </td>
                            <td className="px-3 py-2 text-slate-900">
                              {displayLocation}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                                <Upload className="h-3 w-3" />
                                {importSource || 'Not set'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">
                  Showing first 5 of {csvData.length} rows • {Object.values(columnMapping).flat().filter(Boolean).length} field mappings will be imported
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-slate-200 px-6 py-4">
            {step === "upload" && (
              <>
                <button
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!importSource.trim()) {
                      setImportSourceError("Import source name is required");
                      return;
                    }
                    // Validate and proceed (validation now allows duplicates)
                    await validateImportSource(importSource.trim());
                    setStep("map");
                  }}
                  disabled={!file || !importSource.trim()}
                  className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  Next: Map Columns
                </button>
              </>
            )}

            {step === "map" && (
              <>
                <button
                  onClick={() => setStep("upload")}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep("preview")}
                  className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
                >
                  Preview Import
                </button>
              </>
            )}

            {step === "preview" && (
              <>
                <button
                  onClick={() => setStep("map")}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Back to Mapping
                </button>
                <button
                  onClick={handleImport}
                  disabled={uploading}
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {uploading
                    ? "Importing..."
                    : `Import ${csvData.length} Contacts`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Export Modal Component
function ExportModal({
  contacts,
  selectedContacts,
  onClose,
}: {
  contacts: UnassignedContact[];
  selectedContacts: Set<string>;
  onClose: () => void;
}) {
  const [exportType, setExportType] = useState<"all" | "selected">("all");

  const handleExport = () => {
    const contactsToExport =
      exportType === "selected"
        ? contacts.filter((c) => selectedContacts.has(c.id))
        : contacts;

    if (contactsToExport.length === 0) {
      alert("No contacts to export");
      return;
    }

    // Define CSV headers
    const headers = [
      "business_name",
      "contact_name",
      "first_name",
      "last_name",
      "job_title",
      "phone",
      "email",
      "industry",
      "city",
      "state",
      "shipping_frequency",
      "linkedin_url",
      "website_url",
      "facebook_url",
      "twitter_url",
      "instagram_url",
      "notes",
      "created_at",
    ];

    // Create CSV content
    const csvRows = [
      headers.join(","),
      ...contactsToExport.map((contact) => {
        return headers
          .map((header) => {
            const value = contact[header as keyof UnassignedContact];
            if (value === null || value === undefined) return "";
            // Escape commas and quotes
            const stringValue = String(value);
            if (stringValue.includes(",") || stringValue.includes('"')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          })
          .join(",");
      }),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nts-contacts-export-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Export Contacts
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-slate-100"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              What would you like to export?
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
                <input
                  type="radio"
                  name="exportType"
                  value="all"
                  checked={exportType === "all"}
                  onChange={(e) =>
                    setExportType(e.target.value as "all" | "selected")
                  }
                  className="h-4 w-4 text-orange-500 focus:ring-orange-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    All Filtered Contacts
                  </p>
                  <p className="text-xs text-slate-500">
                    {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
                <input
                  type="radio"
                  name="exportType"
                  value="selected"
                  checked={exportType === "selected"}
                  onChange={(e) =>
                    setExportType(e.target.value as "all" | "selected")
                  }
                  className="h-4 w-4 text-orange-500 focus:ring-orange-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    Selected Contacts Only
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedContacts.size} contact{selectedContacts.size !== 1 ? "s" : ""}
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-900">
              <FileSpreadsheet className="mr-1 inline h-3 w-3" />
              Export will download a CSV file with all contact details
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={
                exportType === "selected" && selectedContacts.size === 0
              }
              className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Distribution Modal Component
function DistributeModal({
  teamMembers,
  selectedCount,
  onDistribute,
  onEvenDistribute,
  onClose,
  currentUser,
}: {
  teamMembers: TeamMember[];
  selectedCount: number;
  onDistribute: (teamMemberId: string) => void;
  onEvenDistribute: () => void;
  onClose: () => void;
  currentUser: TeamMember | null;
}) {
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>("");
  const [showConfirmEven, setShowConfirmEven] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [selectedTeamMembersForAdvanced, setSelectedTeamMembersForAdvanced] = useState<Set<string>>(new Set());
  const [distributionMode, setDistributionMode] = useState<'even' | 'ratio'>('even');
  const [teamMemberRatios, setTeamMemberRatios] = useState<Map<string, number>>(new Map());

  // Get unique office locations
  const uniqueOffices = Array.from(new Set(teamMembers.map(b => b.office_location).filter(Boolean))) as string[];

  // Filter teamMembers based on selected offices
  const getFilteredTeamMembers = () => {
    if (selectedOffices.length === 0) {
      return teamMembers.filter((b) => !b.is_admin);
    }
    return teamMembers.filter((b) => !b.is_admin && selectedOffices.includes(b.office_location || ''));
  };

  const handleOfficeToggle = (office: string) => {
    if (selectedOffices.includes(office)) {
      setSelectedOffices(selectedOffices.filter(o => o !== office));
    } else {
      setSelectedOffices([...selectedOffices, office]);
    }
  };

  const handleTeamMemberToggle = (teamMemberId: string) => {
    const newSet = new Set(selectedTeamMembersForAdvanced);
    if (newSet.has(teamMemberId)) {
      newSet.delete(teamMemberId);
      // Remove ratio when unchecking
      const newRatios = new Map(teamMemberRatios);
      newRatios.delete(teamMemberId);
      setTeamMemberRatios(newRatios);
    } else {
      newSet.add(teamMemberId);
      // Set default ratio of 1 when checking
      const newRatios = new Map(teamMemberRatios);
      newRatios.set(teamMemberId, 1);
      setTeamMemberRatios(newRatios);
    }
    setSelectedTeamMembersForAdvanced(newSet);
  };

  const handleRatioChange = (teamMemberId: string, value: string) => {
    const numValue = parseInt(value) || 1;
    const newRatios = new Map(teamMemberRatios);
    newRatios.set(teamMemberId, Math.max(1, numValue)); // Minimum ratio of 1
    setTeamMemberRatios(newRatios);
  };

  // Calculate distribution based on ratios
  const calculateRatioDistribution = () => {
    const selectedTeamMembers = Array.from(selectedTeamMembersForAdvanced);
    const distribution = new Map<string, number>();

    if (selectedTeamMembers.length === 0) return distribution;

    // Calculate total ratio points
    const totalRatio = selectedTeamMembers.reduce((sum, teamMemberId) => {
      return sum + (teamMemberRatios.get(teamMemberId) || 1);
    }, 0);

    // Initial distribution using floor
    let assigned = 0;
    const allocations: { teamMemberId: string; ratio: number; count: number }[] = [];

    selectedTeamMembers.forEach(teamMemberId => {
      const ratio = teamMemberRatios.get(teamMemberId) || 1;
      const count = Math.floor(selectedCount * (ratio / totalRatio));
      distribution.set(teamMemberId, count);
      assigned += count;
      allocations.push({ teamMemberId, ratio, count });
    });

    // Distribute remainder to teamMembers with highest ratios
    let remainder = selectedCount - assigned;
    if (remainder > 0) {
      // Sort by ratio descending, then by current count ascending
      allocations.sort((a, b) => {
        if (b.ratio !== a.ratio) return b.ratio - a.ratio;
        return a.count - b.count;
      });

      for (let i = 0; i < remainder; i++) {
        const { teamMemberId } = allocations[i % allocations.length];
        distribution.set(teamMemberId, (distribution.get(teamMemberId) || 0) + 1);
      }
    }

    return distribution;
  };

  const getDistributionPreview = () => {
    if (distributionMode === 'even') {
      const perTeamMember = Math.ceil(selectedCount / selectedTeamMembersForAdvanced.size);
      return `~${perTeamMember} each`;
    } else {
      const distribution = calculateRatioDistribution();
      const preview = Array.from(selectedTeamMembersForAdvanced)
        .map(teamMemberId => {
          const teamMember = teamMembers.find(b => b.id === teamMemberId);
          const count = distribution.get(teamMemberId) || 0;
          const ratio = teamMemberRatios.get(teamMemberId) || 1;
          return `${teamMember?.first_name}: ${count} (${ratio}×)`;
        })
        .join(', ');
      return preview;
    }
  };

  const handleAdvancedDistribute = () => {
    if (selectedTeamMembersForAdvanced.size === 0) {
      alert('Please select at least one team member');
      return;
    }

    if (distributionMode === 'ratio') {
      // Calculate distribution and pass to parent
      const distribution = calculateRatioDistribution();
      // For now, we'll call onEvenDistribute - in production, you'd need a custom handler
      // that accepts the distribution map
      console.log('Ratio Distribution:', Object.fromEntries(distribution));
      // TODO: Add onRatioDistribute prop to handle custom distribution
      alert(`Ratio distribution calculated. You'll need to implement the backend handler for this feature.\n\nDistribution:\n${Array.from(distribution.entries()).map(([id, count]) => {
        const teamMember = teamMembers.find(b => b.id === id);
        return `${teamMember?.first_name}: ${count} contacts`;
      }).join('\n')}`);
    } else {
      // Even distribution
      onEvenDistribute();
    }
    onClose();
  };

  return (
    <>
      {/* Confirmation Modal for Even Distribution */}
      {showConfirmEven && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Confirm Even Distribution
              </h3>
            </div>
            <div className="mb-6 space-y-3">
              <p className="text-sm text-slate-700">
                You are about to distribute <strong>{selectedCount} contacts</strong> evenly across{' '}
                <strong>{getFilteredTeamMembers().length} teamMembers</strong>
                {selectedOffices.length > 0 && (
                  <span> in {selectedOffices.length === 1 ? selectedOffices[0] : `${selectedOffices.length} offices`}</span>
                )}.
              </p>
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-xs text-blue-900">
                  Each teamMember will receive approximately{' '}
                  <strong>{Math.ceil(selectedCount / getFilteredTeamMembers().length)}</strong> contacts.
                  This action cannot be easily undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmEven(false)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onEvenDistribute();
                  setShowConfirmEven(false);
                  onClose();
                }}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Distribute Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Distribution Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              Distribute {selectedCount} Contacts
            </h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1 hover:bg-slate-100"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
              <h4 className="mb-2 text-sm font-semibold text-green-900">Quick Actions</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => currentUser && onDistribute(currentUser.id)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  <UserPlus className="h-4 w-4" />
                  Assign to Me
                </button>
                <button
                  onClick={() => setShowConfirmEven(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                >
                  <ArrowRight className="h-4 w-4" />
                  Distribute Evenly ({teamMembers.filter((b) => !b.is_admin).length} TeamMembers)
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-slate-500">OR</span>
              </div>
            </div>

            {/* Assign to Specific TeamMember */}
            <div className="rounded-lg border border-slate-200 p-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Assign to Specific TeamMember
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedTeamMember}
                  onChange={(e) => setSelectedTeamMember(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Select a team member...</option>
                  {teamMembers.map((teamMember) => (
                    <option key={teamMember.id} value={teamMember.id}>
                      {teamMember.first_name} {teamMember.last_name || ""} -{" "}
                      {teamMember.office_location || "No Office"}
                      {teamMember.is_manager && " (Manager)"}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => selectedTeamMember && onDistribute(selectedTeamMember)}
                  disabled={!selectedTeamMember}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Assign
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-slate-500">ADVANCED</span>
              </div>
            </div>

            {/* Advanced Distribution Options */}
            <div className={`rounded-lg border p-4 ${distributionMode === 'ratio' && selectedTeamMembersForAdvanced.size > 0
              ? 'border-purple-200 bg-purple-50'
              : 'border-blue-200 bg-blue-50'
              }`}>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`flex w-full items-center justify-between text-sm font-semibold ${distributionMode === 'ratio' && selectedTeamMembersForAdvanced.size > 0
                  ? 'text-purple-900'
                  : 'text-blue-900'
                  }`}
              >
                <span>Advanced Distribution Options</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4">
                  {/* Office Filter */}
                  {uniqueOffices.length > 0 && (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Filter by Office (optional)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {uniqueOffices.map((office) => (
                          <button
                            key={office}
                            onClick={() => handleOfficeToggle(office)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${selectedOffices.includes(office)
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                          >
                            {office}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TeamMember Selection */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="block text-sm font-medium text-slate-700">
                        Select Specific TeamMembers
                        {selectedOffices.length > 0 && (
                          <span className="ml-2 text-xs text-slate-500">
                            (filtered by {selectedOffices.length} office{selectedOffices.length > 1 ? 's' : ''})
                          </span>
                        )}
                      </label>
                      {selectedTeamMembersForAdvanced.size > 0 && (
                        <div className="flex gap-1 rounded-lg bg-white p-1 border border-slate-200">
                          <button
                            onClick={() => setDistributionMode('even')}
                            className={`px-3 py-1 text-xs font-medium rounded ${distributionMode === 'even'
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-600 hover:bg-slate-50'
                              }`}
                          >
                            Even
                          </button>
                          <button
                            onClick={() => setDistributionMode('ratio')}
                            className={`px-3 py-1 text-xs font-medium rounded ${distributionMode === 'ratio'
                              ? 'bg-purple-600 text-white'
                              : 'text-slate-600 hover:bg-slate-50'
                              }`}
                          >
                            Ratio
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                      {getFilteredTeamMembers().map((teamMember) => (
                        <div
                          key={teamMember.id}
                          className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50"
                        >
                          <label className="flex flex-1 items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedTeamMembersForAdvanced.has(teamMember.id)}
                              onChange={() => handleTeamMemberToggle(teamMember.id)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-900 flex-1">
                              {teamMember.first_name} {teamMember.last_name || ""} -{" "}
                              {teamMember.office_location || "No Office"}
                            </span>
                          </label>
                          {distributionMode === 'ratio' && selectedTeamMembersForAdvanced.has(teamMember.id) && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="1"
                                value={teamMemberRatios.get(teamMember.id) || 1}
                                onChange={(e) => handleRatioChange(teamMember.id, e.target.value)}
                                className="w-16 rounded border border-slate-300 px-2 py-1 text-xs text-center"
                                placeholder="1"
                              />
                              <span className="text-xs text-slate-500">×</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedTeamMembersForAdvanced.size > 0 && (
                    <div className={`rounded-lg p-3 ${distributionMode === 'ratio' ? 'bg-purple-50 border border-purple-200' : 'bg-white'}`}>
                      {distributionMode === 'even' ? (
                        <p className="text-xs text-slate-600">
                          Will distribute <strong>{selectedCount} contacts</strong> evenly across{' '}
                          <strong>{selectedTeamMembersForAdvanced.size} selected team member{selectedTeamMembersForAdvanced.size > 1 ? 's' : ''}</strong>
                          {' '}(~{Math.ceil(selectedCount / selectedTeamMembersForAdvanced.size)} each)
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-purple-900 mb-2">
                            Distribution Preview (Ratio-Based):
                          </p>
                          {Array.from(selectedTeamMembersForAdvanced).map(teamMemberId => {
                            const teamMember = teamMembers.find(b => b.id === teamMemberId);
                            const distribution = calculateRatioDistribution();
                            const count = distribution.get(teamMemberId) || 0;
                            const ratio = teamMemberRatios.get(teamMemberId) || 1;
                            const totalRatio = Array.from(selectedTeamMembersForAdvanced).reduce((sum, id) => sum + (teamMemberRatios.get(id) || 1), 0);
                            const percentage = ((ratio / totalRatio) * 100).toFixed(1);

                            return (
                              <div key={teamMemberId} className="flex items-center justify-between text-xs">
                                <span className="text-slate-700">
                                  {teamMember?.first_name} {teamMember?.last_name}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-500">Ratio: {ratio}×</span>
                                  <span className="text-slate-400">·</span>
                                  <span className="text-slate-500">{percentage}%</span>
                                  <span className="text-slate-400">·</span>
                                  <span className="font-semibold text-purple-700">{count} contacts</span>
                                </div>
                              </div>
                            );
                          })}
                          <div className="mt-2 pt-2 border-t border-purple-200">
                            <p className="text-xs text-purple-800">
                              <strong>Total:</strong> {selectedCount} contacts distributed
                              {(() => {
                                const distribution = calculateRatioDistribution();
                                const totalAssigned = Array.from(distribution.values()).reduce((sum, count) => sum + count, 0);
                                return totalAssigned === selectedCount ? ' ✓' : ` (${totalAssigned} assigned)`;
                              })()}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleAdvancedDistribute}
                    disabled={selectedTeamMembersForAdvanced.size === 0}
                    className={`w-full rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${distributionMode === 'ratio' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                  >
                    {distributionMode === 'ratio' ? 'Distribute by Ratio' : 'Distribute Evenly'} ({selectedTeamMembersForAdvanced.size})
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Simple Import Modal ──────────────────────────────────────────────────────
// Streamlined paste-or-upload import for basic contact fields.
// Supports CSV/XLSX upload OR pasting raw data directly.
function SimpleImportModal({
  onClose,
  onSuccess,
  currentUserId,
}: {
  onClose: () => void;
  onSuccess: () => void;
  currentUserId: string;
}) {
  const FIELDS = [
    { key: "contact_name", label: "Full Name (contact_name)" },
    { key: "first_name", label: "First Name" },
    { key: "last_name", label: "Last Name" },
    { key: "business_name", label: "Company Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "address", label: "Address" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "zip", label: "ZIP" },
    { key: "website_url", label: "Website" },
    { key: "tms_account_id", label: "TMS Quote/Order ID" },
    { key: "notes", label: "Notes" },
  ] as const;

  type FieldKey = typeof FIELDS[number]["key"];

  const [importSource, setImportSource] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, FieldKey | "">>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [step, setStep] = useState<"upload" | "map" | "confirm">("upload");
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");

  // ── Parse uploaded file ────────────────────────────────────────────────────
  const parseFile = async (file: File) => {
    setFileName(file.name);
    if (file.name.endsWith(".csv")) {
      const Papa = (await import("papaparse")).default;
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => initFromRows(res.data as Record<string, string>[]),
      });
    } else {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      initFromRows(XLSX.utils.sheet_to_json(ws) as Record<string, string>[]);
    }
  };

  const initFromRows = (data: Record<string, string>[]) => {
    if (!data.length) return;
    const hdrs = Object.keys(data[0]);
    setHeaders(hdrs);
    setRows(data);
    // Auto-map headers
    const auto: Record<string, FieldKey | ""> = {};
    hdrs.forEach((h) => {
      const n = h.toLowerCase().replace(/[\s_-]/g, "");
      if (n === "contactname" || n === "fullname" || n === "name" || n === "contact" || n === "contact_name" || n === "fullcontact") auto[h] = "contact_name";
      else if (n === "firstname") auto[h] = "first_name";
      else if (n === "lastname") auto[h] = "last_name";
      else if (n.includes("company") || n.includes("business")) auto[h] = "business_name";
      else if (n.includes("email")) auto[h] = "email";
      else if (n.includes("phone")) auto[h] = "phone";
      else if (n === "address" || n === "streetaddress") auto[h] = "address";
      else if (n === "city") auto[h] = "city";
      else if (n === "state") auto[h] = "state";
      else if (n === "zip" || n === "zipcode" || n === "postalcode") auto[h] = "zip";
      else if (n.includes("website")) auto[h] = "website_url";
      else if (n === "quoteid" || n === "quote_id" || n === "orderid" || n === "order_id" || n === "quote" || n === "order") auto[h] = "tms_account_id";
      else if (n.includes("note")) auto[h] = "notes";
      else auto[h] = "";
    });
    setMapping(auto);
    setStep("map");
  };

  // ── Build & insert ─────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!importSource.trim()) { setSourceError("Required"); return; }
    setUploading(true);
    const supabase = createClient();

    const records = rows.map((row) => {
      const rec: Record<string, string | null> = {
        team_member_id: null,
        imported_by: currentUserId,
        status: "prospect",
        on_kanban_board: "false",
        import_source: importSource.trim(),
      };
      Object.entries(mapping).forEach(([col, field]) => {
        if (!field || !row[col]) return;
        rec[field] = String(row[col]).trim() || null;
      });
      // Build contact_name fallback
      if (!rec.contact_name) {
        const full = [rec.first_name, rec.last_name].filter(Boolean).join(" ");
        if (full) rec.contact_name = full;
      }
      if (!rec.business_name && rec.contact_name) rec.business_name = rec.contact_name;
      if (!rec.business_name && !rec.contact_name) rec.contact_name = "Imported Contact";
      return rec;
    });

    const batchSize = 50;
    for (let i = 0; i < records.length; i += batchSize) {
      const { error } = await supabase.from("customers").insert(records.slice(i, i + batchSize));
      if (error) { alert(`Import error: ${error.message}`); setUploading(false); return; }
    }

    alert(`Imported ${records.length} contacts.`);
    onSuccess();
    onClose();
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-lg flex-col rounded-xl bg-white shadow-xl" style={{ maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Quick Import</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === "upload" && "Upload a CSV or Excel file"}
              {step === "map" && `${rows.length} rows · map columns`}
              {step === "confirm" && `Ready to import ${rows.length} contacts`}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Import source — always visible */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Import tag <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={importSource}
              onChange={(e) => { setImportSource(e.target.value); setSourceError(""); }}
              placeholder="e.g., Joey Trapp Quotes Apr 2026"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${sourceError ? "border-red-400 focus:ring-red-300" : "border-slate-200 focus:ring-orange-400"
                }`}
            />
            {sourceError && <p className="mt-1 text-xs text-red-500">{sourceError}</p>}
          </div>

          {/* Step 1 — Upload */}
          {step === "upload" && (
            <label className="group flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 transition-colors hover:border-[#E85D04] hover:bg-orange-50">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) parseFile(e.target.files[0]); }}
              />
              <Upload className="h-8 w-8 text-slate-400 group-hover:text-[#E85D04]" />
              <span className="text-sm font-medium text-slate-700 group-hover:text-[#E85D04]">
                Click to browse — CSV or Excel
              </span>
              <span className="text-xs text-slate-400">Columns auto-detected</span>
            </label>
          )}

          {/* Step 2 — Map */}
          {step === "map" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Column mapping &mdash; {fileName}
              </p>
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-sm text-slate-700" title={h}>{h}</span>
                  <select
                    value={mapping[h] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [h]: e.target.value as FieldKey | "" })}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    <option value="">— ignore —</option>
                    {FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Step 3 — Preview */}
          {step === "confirm" && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 text-sm">
              <table className="w-full">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.slice(0, 8).map((row, i) => {
                    const contactNameCol = Object.keys(mapping).find((k) => mapping[k] === "contact_name");
                    const nameCol = Object.keys(mapping).find((k) => mapping[k] === "first_name");
                    const lastCol = Object.keys(mapping).find((k) => mapping[k] === "last_name");
                    const bizCol = Object.keys(mapping).find((k) => mapping[k] === "business_name");
                    const emailCol = Object.keys(mapping).find((k) => mapping[k] === "email");
                    const phoneCol = Object.keys(mapping).find((k) => mapping[k] === "phone");
                    const name = (contactNameCol && row[contactNameCol]) || [nameCol && row[nameCol], lastCol && row[lastCol]].filter(Boolean).join(" ") || (bizCol && row[bizCol]) || "—";
                    return (
                      <tr key={i}>
                        <td className="px-3 py-2 text-slate-900">{name}</td>
                        <td className="px-3 py-2 text-slate-500">{(emailCol && row[emailCol]) || "—"}</td>
                        <td className="px-3 py-2 text-slate-500">{(phoneCol && row[phoneCol]) || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length > 8 && (
                <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">
                  + {rows.length - 8} more rows
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-slate-200 px-6 py-4">
          {step === "upload" && (
            <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
          )}
          {step === "map" && (
            <>
              <button onClick={() => setStep("upload")} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Back
              </button>
              <button
                onClick={() => {
                  if (!importSource.trim()) { setSourceError("Required"); return; }
                  setStep("confirm");
                }}
                className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
              >
                Preview ({rows.length})
              </button>
            </>
          )}
          {step === "confirm" && (
            <>
              <button onClick={() => setStep("map")} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={uploading}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {uploading ? "Importing…" : `Import ${rows.length} contacts`}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
