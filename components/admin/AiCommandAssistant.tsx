/**
 * AI Command Assistant Component
 * 
 * Natural language command interface for lead distribution.
 * Allows admins/managers to type commands like:
 * "Give David R 100 random truck dealers to call and add to power dialer"
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2, CheckCircle, AlertCircle, Send, X, Undo2, ChevronDown, Search, Pencil } from "lucide-react";

type RevertData = {
  customer_ids: string[];
  previous_broker_ids: (string | null)[];
  task_ids?: string[];
};

type CommandResponse = {
  understood: boolean;
  action: string;
  parameters: any;
  preview: string[];
  executed: boolean;
  message?: string;
  confirmation?: string;
  error?: string;
  revertData?: RevertData;
  teamMemberInfo?: {
    name: string;
    office: string;
    activeCustomers: number;
  };
  contactsDistributed?: Array<{
    name: string;
    state: string;
    industry?: string;
  }>;
};

export default function AiCommandAssistant() {
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CommandResponse | null>(null);
  const [lastRevertData, setLastRevertData] = useState<RevertData | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Form states
  const [formAction, setFormAction] = useState<"distribute" | "create_tasks">("distribute");
  const [formTeamMember, setFormTeamMember] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [formIndustry, setFormIndustry] = useState("");
  const [formState, setFormState] = useState("");
  const [formSource, setFormSource] = useState("");
  
  // TeamMember search/autocomplete states
  const [teamMembers, setTeamMembers] = useState<Array<{id: string; name: string; office: string; customers: number}>>([]);
  const [teamMemberSearch, setTeamMemberSearch] = useState("");
  const [showTeamMemberDropdown, setShowTeamMemberDropdown] = useState(false);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);
  const teamMemberDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (teamMemberDropdownRef.current && !teamMemberDropdownRef.current.contains(event.target as Node)) {
        setShowTeamMemberDropdown(false);
      }
    };

    if (showTeamMemberDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showTeamMemberDropdown]);

  const exampleCommands = [
    "Give [teamMember name] 100 random truck dealers to call",
    "Distribute 50 manufacturing leads in Texas to [teamMember name]",
    "Assign all construction companies in California to [teamMember name]",
    "Create follow-up tasks for all [teamMember name]'s inactive customers",
  ];

  // Fetch teamMembers for autocomplete
  const fetchTeamMembers = async () => {
    if (teamMembers.length > 0) return; // Already loaded
    setLoadingTeamMembers(true);
    try {
      const res = await fetch('/api/team-members/list');
      const data = await res.json();
      setTeamMembers(data.teamMembers || []);
    } catch (error) {
      console.error('Failed to fetch team members:', error);
    } finally {
      setLoadingTeamMembers(false);
    }
  };

  // Filter teamMembers based on search
  const filteredTeamMembers = teamMembers.filter(b => 
    b.name.toLowerCase().includes(teamMemberSearch.toLowerCase()) ||
    b.office.toLowerCase().includes(teamMemberSearch.toLowerCase())
  );

  const handleSendCommand = async (execute: boolean = false) => {
    if (!command.trim()) return;

    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, execute }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to process command");
      }

      setResponse(data);
      
      // Store revert data if command was executed
      if (execute && data.executed && data.revertData) {
        setLastRevertData(data.revertData);
      }
    } catch (error: any) {
      setResponse({
        understood: false,
        action: "error",
        parameters: {},
        preview: [],
        executed: false,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = () => {
    handleSendCommand(true);
  };

  const handleRevert = async () => {
    if (!lastRevertData) return;

    setLoading(true);
    try {
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revertData: lastRevertData }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to revert command");
      }

      // Show revert success
      setResponse(data);
      setLastRevertData(null); // Clear revert data after successful undo
    } catch (error: any) {
      setResponse({
        understood: false,
        action: "error",
        parameters: {},
        preview: [],
        executed: false,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCommand("");
    setResponse(null);
    setLastRevertData(null);
    setFormAction("distribute");
    setFormTeamMember("");
    setTeamMemberSearch("");
    setFormQuantity("");
    setFormIndustry("");
    setFormState("");
    setFormSource("");
  };

  const handleFormSubmit = (preview: boolean) => {
    // Convert form inputs to natural language command
    let commandText = "";
    
    if (formAction === "distribute") {
      commandText = `Give ${formTeamMember || "[teamMember]"} ${formQuantity || "50"} contacts`;
      const filters = [];
      // Skip empty values and "any" keyword (treat "any" as no filter)
      if (formIndustry && formIndustry.toLowerCase() !== "any") {
        filters.push(formIndustry);
      }
      if (formState && formState.toLowerCase() !== "any") {
        filters.push(`in ${formState}`);
      }
      if (formSource && formSource.toLowerCase() !== "any") {
        filters.push(`from ${formSource}`);
      }
      if (filters.length > 0) {
        commandText += ` (${filters.join(", ")})`;
      }
    } else if (formAction === "create_tasks") {
      commandText = `Create follow-up tasks for ${formTeamMember || "[teamMember]"}'s customers`;
    }
    
    setCommand(commandText);
    handleSendCommand(false); // Always preview first in form mode
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-lg border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-linear-to-r from-blue-600 to-blue-600 p-6 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white/20 p-2">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">AI Command Assistant</h3>
            <p className="text-sm text-blue-100">Natural language + guided filters for intelligent lead distribution</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6">
        {/* Natural Language Input */}
        {!response && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Natural Language Command
            </label>
            <textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!loading && !response) handleSendCommand(false);
                }
              }}
              placeholder='Type a command... e.g., "Give David R 100 random truck dealers to call"'
              rows={2}
              className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">Or use the form below for guided input</p>
          </div>
        )}

        {/* Form Fields */}
        {!response && (
          <div className="mb-4 space-y-4">
            {/* Action Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Action</label>
              <select
                value={formAction}
                onChange={(e) => setFormAction(e.target.value as "distribute" | "create_tasks")}
                className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="distribute">Distribute Contacts</option>
                <option value="create_tasks">Create Tasks</option>
              </select>
            </div>

            {/* TeamMember Name - Searchable Select */}
            <div className="relative" ref={teamMemberDropdownRef}>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                TeamMember Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div 
                  className="w-full rounded-lg border border-slate-200 p-2 text-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 bg-white cursor-text"
                  onClick={() => {
                    fetchTeamMembers();
                    setShowTeamMemberDropdown(true);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={teamMemberSearch}
                      onChange={(e) => {
                        setTeamMemberSearch(e.target.value);
                        setShowTeamMemberDropdown(true);
                        fetchTeamMembers();
                      }}
                      onFocus={() => {
                        fetchTeamMembers();
                        setShowTeamMemberDropdown(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setShowTeamMemberDropdown(false);
                        }
                      }}
                      placeholder={formTeamMember || "Search for a team member..."}
                      className="flex-1 outline-none bg-transparent"
                    />
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
                
                {/* Dropdown */}
                {showTeamMemberDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {loadingTeamMembers ? (
                      <div className="p-3 text-sm text-slate-500 text-center">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                        Loading team members...
                      </div>
                    ) : filteredTeamMembers.length === 0 ? (
                      <div className="p-3 text-sm text-slate-500 text-center">
                        No team members found
                      </div>
                    ) : (
                      filteredTeamMembers.map((teamMember) => (
                        <button
                          key={teamMember.id}
                          onClick={() => {
                            setFormTeamMember(teamMember.name);
                            setTeamMemberSearch(teamMember.name);
                            setShowTeamMemberDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-900">{teamMember.name}</p>
                              <p className="text-xs text-slate-500">{teamMember.office}</p>
                            </div>
                            <span className="text-xs text-slate-400">{teamMember.customers} customers</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {formTeamMember && (
                <p className="text-xs text-green-600 mt-1">✓ Selected: {formTeamMember}</p>
              )}
            </div>

            {formAction === "distribute" && (
              <>
                {/* Quantity */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Number of Contacts</label>
                  <input
                    type="number"
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                    placeholder="50"
                    min="1"
                    className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Filters */}
                <div className="border-t border-slate-200 pt-3">
                  <p className="text-xs font-semibold text-slate-700 mb-2">
                    Filters (Optional) 
                    <span className="ml-2 text-slate-500 font-normal">— Leave empty or type "any" for no filter</span>
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Industry</label>
                      <input
                        type="text"
                        value={formIndustry}
                        onChange={(e) => setFormIndustry(e.target.value)}
                        placeholder="e.g., trucking, manufacturing (or 'any')"
                        className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 mb-1">State</label>
                      <input
                        type="text"
                        value={formState}
                        onChange={(e) => setFormState(e.target.value)}
                        placeholder="e.g., TX, CA (or 'any')"
                        className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Source</label>
                      <input
                        type="text"
                        value={formSource}
                        onChange={(e) => setFormSource(e.target.value)}
                        placeholder="e.g., trucking_leads_2024 (or 'any')"
                        className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="mb-4 space-y-4">
            {/* Understanding Status */}
            {response.understood ? (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                <CheckCircle className="h-4 w-4" />
                <span>Command understood: <strong>{response.action}</strong></span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="h-4 w-4" />
                <span>Could not understand command</span>
              </div>
            )}

            {/* Error */}
            {response.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{response.error}</p>
              </div>
            )}

            {/* Preview - Enhanced with fallback display */}
            {response.preview && response.preview.length > 0 && !response.executed && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                {/* Action Summary */}
                <div className="bg-blue-600 text-white rounded-lg p-4 shadow-md">
                  <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <span className="text-xl">⚡</span> 
                    <span>ACTION PREVIEW - What will happen when you click Execute:</span>
                  </p>
                  <div className="bg-blue-700 rounded-lg p-3 mt-3">
                    <p className="text-base font-bold">
                      {response.action === 'distribute' && (
                        <>
                          Assign <span className="text-yellow-300">{response.parameters?.quantity || '?'} contacts</span> to{' '}
                          <span className="text-yellow-300">{response.teamMemberInfo?.name || response.parameters?.team_member_name || 'teamMember'}</span>
                        </>
                      )}
                      {response.action === 'create_tasks' && (
                        <>
                          Create follow-up tasks for <span className="text-yellow-300">{response.teamMemberInfo?.name || 'teamMember'}</span>'s customers
                        </>
                      )}
                    </p>
                    {response.parameters?.filters && Object.keys(response.parameters.filters).length > 0 && (
                      <p className="text-xs text-blue-100 mt-2">
                        📋 Filters: {Object.entries(response.parameters.filters)
                          .filter(([_, val]) => val)
                          .map(([key, val]) => `${key}: ${val}`)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-blue-100 mt-3 flex items-center gap-1">
                    <span>💾</span>
                    <span>Database Update: <code className="bg-blue-700 px-1.5 py-0.5 rounded font-mono">customers.team_member_id</code> field will be changed</span>
                  </p>
                </div>

                {/* TeamMember Info Header */}
                {response.teamMemberInfo && (
                  <div className="bg-white border-2 border-blue-300 rounded-lg p-4 shadow-sm">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">📌 Target TeamMember</p>
                    <p className="text-base font-bold text-slate-900">
                      {response.teamMemberInfo.name}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      Office: <strong>{response.teamMemberInfo.office}</strong>
                    </p>
                    <p className="text-sm text-slate-600">
                      Current Load: <strong>{response.teamMemberInfo.activeCustomers} active customers</strong>
                    </p>
                  </div>
                )}

                <div className="bg-white border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <span>📋</span>
                    <span>Contacts to be assigned: <span className="text-blue-600">{response.preview.filter(p => !p.startsWith('📌')).length} total</span></span>
                  </p>
                  
                  {/* Show generated command if from form */}
                  {command && command.includes('Give') && (
                    <div className="mb-3 bg-slate-800 border border-slate-600 text-slate-100 rounded-lg p-3 shadow-sm">
                      <p className="text-xs text-slate-400 mb-1">Generated Command:</p>
                      <p className="text-sm font-mono">{command}</p>
                    </div>
                  )}

                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <ul className="space-y-2 text-sm text-slate-800 max-h-60 overflow-y-auto">
                      {response.preview
                        .filter(p => !p.startsWith('📌'))
                        .slice(0, 10)
                        .map((item, i) => (
                        <li key={i} className="flex items-start gap-2 py-1">
                          <span className="text-blue-500 font-bold mt-0.5">•</span>
                          <span className="flex-1">{item}</span>
                        </li>
                      ))}
                    </ul>
                    {response.preview.filter(p => !p.startsWith('📌')).length > 10 && (
                      <button
                        onClick={() => setShowDetailsModal(true)}
                        className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-semibold underline"
                      >
                        View all {response.preview.filter(p => !p.startsWith('📌')).length} contacts →
                      </button>
                    )}
                  </div>
                </div>

                {response.message && (
                  <p className="text-xs text-blue-700 bg-blue-100 rounded p-2">
                    💡 {response.message}
                  </p>
                )}
              </div>
            )}

            {/* Confirmation */}
            {response.confirmation && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-green-800">{response.confirmation}</p>
                
                {/* Show distributed contacts summary */}
                {response.contactsDistributed && response.contactsDistributed.length > 0 && (
                  <div className="border-t border-green-300 pt-3">
                    <p className="text-xs font-semibold text-green-900 mb-2">Distributed Contacts:</p>
                    <ul className="space-y-1 text-xs text-green-800 max-h-32 overflow-y-auto">
                      {response.contactsDistributed.slice(0, 5).map((contact, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-green-400">✓</span>
                          <span>
                            {contact.name} ({contact.state}{contact.industry ? ` - ${contact.industry}` : ''})
                          </span>
                        </li>
                      ))}
                    </ul>
                    {response.contactsDistributed.length > 5 && (
                      <button
                        onClick={() => setShowDetailsModal(true)}
                        className="mt-2 text-xs text-green-600 hover:text-green-800 underline"
                      >
                        View all {response.contactsDistributed.length} contacts →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {!response ? (
            <>
              <button
                onClick={handleReset}
                disabled={!command && !formTeamMember}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  if (command.trim()) {
                    handleSendCommand(false);
                  } else if (formTeamMember) {
                    handleFormSubmit(true);
                  }
                }}
                disabled={loading || (!command.trim() && !formTeamMember.trim())}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Preview
                  </>
                )}
              </button>
            </>
          ) : response.executed ? (
            <>
              {lastRevertData && (
                <button
                  onClick={handleRevert}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Reverting...
                    </>
                  ) : (
                    <>
                      <Undo2 className="h-4 w-4" />
                      Revert
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleReset}
                className="flex-1 rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                New Command
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleReset}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setResponse(null)}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg border-2 border-blue-500 bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
              >
                <Pencil className="h-4 w-4" />
                Edit Form
              </button>
              <button
                onClick={handleExecute}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Execute
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Footer Hint */}
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 rounded-b-lg">
        <p className="text-xs text-slate-600">
          <strong>Tip:</strong> Commands are previewed before execution. Review the preview and click "Execute" to confirm.
        </p>
      </div>

      {/* Details Modal */}
      {showDetailsModal && response && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowDetailsModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {response.executed ? 'Distributed Contacts' : 'Preview: Contacts to Distribute'}
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {response.teamMemberInfo && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm font-semibold text-blue-900">📌 Target TeamMember</p>
                  <p className="text-sm text-blue-800 mt-1">
                    <strong>{response.teamMemberInfo.name}</strong> ({response.teamMemberInfo.office})
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Currently managing {response.teamMemberInfo.activeCustomers} active customers
                  </p>
                </div>
              )}

              <ul className="space-y-2">
                {response.executed && response.contactsDistributed ? (
                  response.contactsDistributed.map((contact, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-slate-700 bg-green-50 border border-green-200 rounded p-2"
                    >
                      <span className="text-green-500">✓</span>
                      <span>
                        <strong>{contact.name}</strong> · {contact.state}
                        {contact.industry && ` · ${contact.industry}`}
                      </span>
                    </li>
                  ))
                ) : (
                  response.preview.slice(1).map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded p-2"
                    >
                      <span className="text-blue-400">•</span>
                      <span>{item}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 p-4 bg-slate-50">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-full rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
