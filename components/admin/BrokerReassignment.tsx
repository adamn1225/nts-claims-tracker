"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCustomerDisplayName } from "@/lib/customer-utils";
import type { Customer, Broker } from "@/lib/types";
import {
  Users,
  UserPlus,
  MapPin,
  Briefcase,
  CheckCircle,
  FileSpreadsheet,
  X,
  Search,
  Sparkles,
  Loader2,
  ThumbsUp,
  AlertCircle,
} from "lucide-react";

type BrokerReassignmentProps = {
  officeFilter?: string | null;
};

export default function BrokerReassignment({ officeFilter }: BrokerReassignmentProps = {}) {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [selectedSourceBroker, setSelectedSourceBroker] = useState<string>("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showAiSuggestionsModal, setShowAiSuggestionsModal] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false);
  const [currentBroker, setCurrentBroker] = useState<{ is_admin: boolean; is_manager: boolean; office_location: string | null } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterIndustry, setFilterIndustry] = useState<string>("");
  const [filterState, setFilterState] = useState<string>("");
  const [filterSource, setFilterSource] = useState<string>("");

  useEffect(() => {
    loadCurrentBroker();
  }, []);

  useEffect(() => {
    if (currentBroker) {
      loadBrokers();
    }
  }, [currentBroker]);

  const loadCurrentBroker = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("brokers")
      .select("is_admin, is_manager, office_location")
      .eq("id", user.id)
      .single();
    
    if (data) {
      setCurrentBroker(data);
    }
  };

  const loadBrokers = async () => {
    const supabase = createClient();
    
    let query = supabase
      .from("brokers")
      .select("*")
      .order("first_name");
    
    // Apply office filter if provided (for managers)
    const effectiveOfficeFilter = officeFilter || currentBroker?.office_location;
    if (effectiveOfficeFilter && !currentBroker?.is_admin) {
      query = query.eq("office_location", effectiveOfficeFilter);
    }
    
    const { data } = await query;
    
    if (!data) {
      setBrokers([]);
      return;
    }

    // Filter out deactivated brokers for regular users
    // Admins and managers can see all brokers (including deactivated) for reassignment
    const isAdminOrManager = currentBroker?.is_admin || currentBroker?.is_manager;
    const filteredBrokers = isAdminOrManager 
      ? data 
      : data.filter(broker => broker.is_active !== false);
    
    setBrokers(filteredBrokers);
  };

  const loadCustomers = async (brokerId: string) => {
    if (!brokerId) {
      setCustomers([]);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    
    let query = supabase
      .from("customers")
      .select("*");
    
    // Handle unassigned customers (broker_id is null)
    if (brokerId === "UNASSIGNED") {
      query = query.is("broker_id", null);
    } else {
      query = query.eq("broker_id", brokerId);
    }
    
    const { data } = await query.order("updated_at", { ascending: false });

    setCustomers(data || []);
    setSelectedCustomers(new Set());
    setSearchQuery("");
    setFilterStatus("");
    setFilterIndustry("");
    setFilterState("");
    setFilterSource("");
    setLoading(false);
  };

  // Derived filter options from loaded data
  const uniqueStatuses = Array.from(new Set(customers.map((c) => c.status || "prospect").filter(Boolean))).sort();
  const uniqueIndustries = Array.from(new Set(customers.map((c) => c.industry).filter(Boolean) as string[])).sort();
  const uniqueStates = Array.from(new Set(customers.map((c) => c.state).filter(Boolean) as string[])).sort();
  const uniqueSources = Array.from(new Set(customers.map((c) => (c as Customer & { import_source?: string }).import_source).filter(Boolean) as string[])).sort();

  // Apply all filters
  const filteredCustomers = customers.filter((c) => {
    const displayName = getCustomerDisplayName(c) || "";
    const source = (c as Customer & { import_source?: string }).import_source || "";
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matches =
        (c.business_name || "").toLowerCase().includes(q) ||
        displayName.toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (filterStatus && (c.status || "prospect") !== filterStatus) return false;
    if (filterIndustry && c.industry !== filterIndustry) return false;
    if (filterState && c.state !== filterState) return false;
    if (filterSource && source !== filterSource) return false;
    return true;
  });

  const hasActiveFilters = !!(searchQuery || filterStatus || filterIndustry || filterState || filterSource);

  const clearAllFilters = () => {
    setSearchQuery("");
    setFilterStatus("");
    setFilterIndustry("");
    setFilterState("");
    setFilterSource("");
  };

  const handleSelectAll = () => {
    if (selectedCustomers.size === filteredCustomers.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(filteredCustomers.map((c) => c.id)));
    }
  };

  const handleSelectCustomer = (id: string) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedCustomers(newSelected);
  };

  const handleReassign = async (targetBrokerId: string) => {
    const supabase = createClient();
    const customerIds = Array.from(selectedCustomers);
    const brokerId = targetBrokerId === "UNASSIGN" ? null : targetBrokerId;

    const { error } = await supabase
      .from("customers")
      .update({ 
        broker_id: brokerId, 
        updated_at: new Date().toISOString() 
      })
      .in("id", customerIds);

    if (error) {
      alert("Error reassigning contacts: " + error.message);
      return;
    }

    const action = brokerId === null ? "unassigned" : "reassigned";
    alert(`Successfully ${action} ${customerIds.length} contact(s)!`);
    setSelectedCustomers(new Set());
    setShowReassignModal(false);
    loadCustomers(selectedSourceBroker);
  };

  const handleGetAiSuggestions = async () => {
    const customerIds = Array.from(selectedCustomers);
    if (customerIds.length === 0) return;

    setLoadingAiSuggestions(true);
    setShowAiSuggestionsModal(true);
    setAiSuggestions([]);

    try {
      const response = await fetch("/api/ai/suggest-reassignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerIds }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get AI suggestions");
      }

      setAiSuggestions(data.suggestions || []);
    } catch (error: any) {
      alert("Error getting AI suggestions: " + error.message);
      setShowAiSuggestionsModal(false);
    } finally {
      setLoadingAiSuggestions(false);
    }
  };

  const handleApplyAiSuggestion = async (customerId: string, brokerId: string) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("customers")
      .update({ 
        broker_id: brokerId, 
        updated_at: new Date().toISOString() 
      })
      .eq("id", customerId);

    if (error) {
      alert("Error applying suggestion: " + error.message);
      return;
    }

    alert("Successfully reassigned customer!");
    
    // Remove from selected and update suggestions
    const newSelected = new Set(selectedCustomers);
    newSelected.delete(customerId);
    setSelectedCustomers(newSelected);
    
    // Remove from AI suggestions
    setAiSuggestions(aiSuggestions.filter(s => s.customerId !== customerId));
    
    // If no more suggestions, close modal
    if (aiSuggestions.length <= 1) {
      setShowAiSuggestionsModal(false);
      loadCustomers(selectedSourceBroker);
    }
  };

  return (
    <div className="space-y-4">
      {/* Office Filter Indicator */}
      {officeFilter && !currentBroker?.is_admin && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
          <p className="text-sm font-medium text-blue-900">
            📍 Viewing brokers from: <span className="font-bold">{officeFilter} Office</span>
          </p>
        </div>
      )}
      
      {/* Broker Selection */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Select Broker to View Their Contacts:
        </label>
        <select
          value={selectedSourceBroker}
          onChange={(e) => {
            setSelectedSourceBroker(e.target.value);
            loadCustomers(e.target.value);
            setSelectedCustomers(new Set());
          }}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        >
          <option value="">Choose a broker...</option>
          <option value="UNASSIGNED" className="font-medium">(Unassigned)</option>
          {brokers.map((broker) => (
            <option key={broker.id} value={broker.id}>
              {broker.first_name} {broker.last_name || ""} - {broker.office_location || "No Office"}
              {broker.is_manager && " (Manager)"}
            </option>
          ))}
        </select>
      </div>

      {/* Filters */}
      {selectedSourceBroker && customers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative min-w-45 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          {/* Status */}
          {uniqueStatuses.length > 0 && (
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            >
              <option value="">+ Status</option>
              {uniqueStatuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          {/* Industry */}
          {uniqueIndustries.length > 0 && (
            <select
              value={filterIndustry}
              onChange={(e) => setFilterIndustry(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            >
              <option value="">+ Industry</option>
              {uniqueIndustries.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          )}

          {/* State */}
          {uniqueStates.length > 0 && (
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            >
              <option value="">+ State</option>
              {uniqueStates.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          )}

          {/* Source */}
          {uniqueSources.length > 0 && (
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            >
              <option value="">+ Source</option>
              {uniqueSources.map((src) => (
                <option key={src} value={src}>{src}</option>
              ))}
            </select>
          )}

          {/* Clear */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      {selectedSourceBroker && (
        <div className="flex gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-slate-400" />
            <span className="font-medium text-slate-900">
              {hasActiveFilters ? `${filteredCustomers.length} / ` : ""}{customers.length}
            </span>
            <span className="text-slate-600">Contacts</span>
          </div>
          {selectedCustomers.size > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-orange-500" />
              <span className="font-medium text-slate-900">{selectedCustomers.size}</span>
              <span className="text-slate-600">Selected</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {selectedCustomers.size > 0 && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleGetAiSuggestions}
            className="flex items-center gap-2 rounded-lg bg-linear-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-medium text-white hover:from-purple-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
          >
            <Sparkles className="h-4 w-4" />
            AI Assistant ({selectedCustomers.size})
          </button>
          <button
            onClick={() => setShowReassignModal(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4" />
            Manual Reassign ({selectedCustomers.size})
          </button>
        </div>
      )}

      {/* Customers Table */}
      {!selectedSourceBroker ? (
        <div className="rounded-lg border border-slate-200 bg-white py-12 text-center">
          <Users className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-slate-600">Select a broker above to view their contacts</p>
          <p className="text-sm text-slate-500">
            Choose which contacts to reassign to another broker
          </p>
        </div>
      ) : loading ? (
        <div className="rounded-lg border border-slate-200 bg-white py-12 text-center">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
          <p className="text-sm text-slate-600">Loading contacts...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white py-12 text-center">
          <FileSpreadsheet className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-slate-600">This broker has no contacts</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white py-12 text-center">
          <Search className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-slate-600">No contacts match the current filters</p>
          <button onClick={clearAllFilters} className="mt-2 text-sm text-orange-500 hover:underline">Clear filters</button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-max">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedCustomers.size === filteredCustomers.length && filteredCustomers.length > 0}
                    onChange={handleSelectAll}
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
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedCustomers.has(customer.id)}
                      onChange={() => handleSelectCustomer(customer.id)}
                      className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 whitespace-nowrap">
                      {customer.business_name || getCustomerDisplayName(customer) || "Unknown"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-900 whitespace-nowrap">
                      {getCustomerDisplayName(customer) || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-900 whitespace-nowrap">
                      {customer.phone || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-900 whitespace-nowrap">
                      {customer.email || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-sm text-slate-600 whitespace-nowrap">
                      <Briefcase className="h-3 w-3" />
                      {customer.industry || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-sm text-slate-600 whitespace-nowrap">
                      <MapPin className="h-3 w-3" />
                      {customer.city && customer.state
                        ? `${customer.city}, ${customer.state}`
                        : customer.state || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize"
                      style={{
                        backgroundColor:
                          customer.status === "active"
                            ? "#10B98120"
                            : customer.status === "prospect"
                            ? "#F59E0B20"
                            : "#6B728020",
                        color:
                          customer.status === "active"
                            ? "#059669"
                            : customer.status === "prospect"
                            ? "#D97706"
                            : "#475569",
                      }}
                    >
                      {customer.status || "prospect"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                    {customer.updated_at || customer.created_at
                      ? new Date(customer.updated_at || customer.created_at!).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reassign Modal */}
      {showReassignModal && (
        <ReassignModal
          brokers={brokers.filter((b) => b.id !== selectedSourceBroker)}
          selectedCount={selectedCustomers.size}
          onReassign={handleReassign}
          onClose={() => setShowReassignModal(false)}
        />
      )}

      {/* AI Suggestions Modal */}
      {showAiSuggestionsModal && (
        <AiSuggestionsModal
          suggestions={aiSuggestions}
          loading={loadingAiSuggestions}
          onApply={handleApplyAiSuggestion}
          onClose={() => setShowAiSuggestionsModal(false)}
        />
      )}
    </div>
  );
}

// Reassign Modal Component
function ReassignModal({
  brokers,
  selectedCount,
  onReassign,
  onClose,
}: {
  brokers: Broker[];
  selectedCount: number;
  onReassign: (brokerId: string) => void;
  onClose: () => void;
}) {
  const [selectedBroker, setSelectedBroker] = useState<string>("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Reassign {selectedCount} Contact{selectedCount !== 1 ? "s" : ""}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Reassign to:
            </label>
            <select
              value={selectedBroker}
              onChange={(e) => setSelectedBroker(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Select a broker...</option>
              <option value="UNASSIGN" className="font-medium">(Unassign)</option>
              {brokers.map((broker) => (
                <option key={broker.id} value={broker.id}>
                  {broker.first_name} {broker.last_name || ""} -{" "}
                  {broker.office_location || "No Office"}
                  {broker.is_manager && " (Manager)"}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={() => selectedBroker && onReassign(selectedBroker)}
              disabled={!selectedBroker}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Reassign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// AI Suggestions Modal Component
function AiSuggestionsModal({
  suggestions,
  loading,
  onApply,
  onClose,
}: {
  suggestions: any[];
  loading: boolean;
  onApply: (customerId: string, brokerId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="mb-6 flex items-center justify-between sticky top-0 bg-white pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-linear-to-br from-purple-100 to-blue-100 p-2">
              <Sparkles className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                AI Reassignment Suggestions
              </h3>
              <p className="text-sm text-slate-600">
                Powered by intelligent workload and territory analysis
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-purple-600" />
            <p className="text-slate-600">Analyzing customers and brokers...</p>
            <p className="text-sm text-slate-500 mt-2">
              Considering geography, workload, industry expertise, and more
            </p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="py-12 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="text-slate-600">No suggestions available</p>
            <button
              onClick={onClose}
              className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.customerId}
                className="rounded-lg border-2 border-slate-200 bg-slate-50 p-4 hover:border-purple-300 transition-colors"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 text-lg">
                      {suggestion.customerName}
                    </h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Currently assigned to: <span className="font-medium">{suggestion.currentBroker}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {suggestion.confidence === "high" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                        <ThumbsUp className="h-3 w-3" />
                        High Confidence
                      </span>
                    )}
                    {suggestion.confidence === "medium" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
                        <AlertCircle className="h-3 w-3" />
                        Medium Confidence
                      </span>
                    )}
                    {suggestion.confidence === "low" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        <AlertCircle className="h-3 w-3" />
                        Low Confidence
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-3 rounded-lg bg-white p-4 border border-purple-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-900">
                      Recommended: <span className="text-purple-600">{suggestion.recommendedBroker}</span>
                    </p>
                    <button
                      onClick={() => onApply(suggestion.customerId, suggestion.recommendedBrokerId)}
                      className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
                    >
                      <ThumbsUp className="h-4 w-4" />
                      Apply Suggestion
                    </button>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {suggestion.reason}
                  </p>
                </div>

                {suggestion.alternativeBrokers && suggestion.alternativeBrokers.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900">
                      Alternative Brokers ({suggestion.alternativeBrokers.length})
                    </summary>
                    <div className="mt-2 space-y-2 pl-4">
                      {suggestion.alternativeBrokers.map((alt: any, i: number) => (
                        <div key={i} className="rounded-lg bg-white border border-slate-200 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-900">{alt.name}</p>
                              <p className="text-xs text-slate-600 mt-1">{alt.reason}</p>
                            </div>
                            <button
                              onClick={() => onApply(suggestion.customerId, alt.brokerId)}
                              className="ml-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Assign
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}

            <div className="flex justify-between items-center pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""} generated
              </p>
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
