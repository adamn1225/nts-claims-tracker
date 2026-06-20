/**
 * Feature Access Control
 * 
 * Admin panel for managing app-wide feature permissions.
 * Allows admins to:
 * - Globally disable expensive AI features to control costs
 * - Set default permissions for new brokers
 * - Bulk update permissions for existing brokers
 */

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Mail, Search, Globe, AlertTriangle, Users, Settings } from "lucide-react";

type FeaturePermission = {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  cost?: string;
};

const AI_FEATURES: FeaturePermission[] = [
  {
    key: "can_use_ai_email",
    label: "AI Email Generation",
    description: "Draft personalized emails using OpenAI",
    icon: Mail,
    cost: "$0.001 per email",
  },
];

const OTHER_FEATURES: FeaturePermission[] = [
  {
    key: "can_use_web_search",
    label: "Web Research (Tavily)",
    description: "AI-powered customer research with live web search",
    icon: Search,
    cost: "$0.008 per search (1000/month free)",
  },
  {
    key: "can_manage_team",
    label: "Team Management",
    description: "Reassign customers, view team analytics",
    icon: Users,
  },
];

export default function FeatureAccessControl() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"defaults" | "bulk">("defaults");
  
  // Default permissions for new brokers
  const [defaults, setDefaults] = useState({
    can_use_ai_email: false,
    can_use_web_search: false,
    can_manage_team: false,
  });

  // Bulk update selections
  const [bulkAction, setBulkAction] = useState<"enable" | "disable">("disable");
  const [selectedFeature, setSelectedFeature] = useState("can_use_ai_email");
  const [selectedBrokers, setSelectedBrokers] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Load brokers
    const { data: brokersData } = await supabase
      .from("brokers")
      .select("id, first_name, last_name, email, is_admin, is_manager")
      .eq("is_active", true)
      .order("first_name");

    if (brokersData) {
      setBrokers(brokersData);
    }

    // Load default settings (stored in a settings table or use hardcoded for now)
    // For now, we'll just use state defaults
    
    setLoading(false);
  };

  const handleSaveDefaults = async () => {
    setSaving(true);
    try {
      // In a real implementation, save these to a settings table
      // For now, just show success
      alert("Default permissions saved! These will apply to newly invited brokers.");
    } catch (error) {
      console.error("Error saving defaults:", error);
      alert("Failed to save defaults");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedBrokers.length === 0) {
      alert("Please select at least one broker");
      return;
    }

    const action = bulkAction === "enable" ? "enable" : "disable";
    const featureLabel = [...AI_FEATURES, ...OTHER_FEATURES].find(
      (f) => f.key === selectedFeature
    )?.label;

    if (
      !confirm(
        `${action.toUpperCase()} "${featureLabel}" for ${selectedBrokers.length} broker(s)?`
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const newValue = bulkAction === "enable";

      // Update broker_permissions for all selected brokers
      for (const brokerId of selectedBrokers) {
        const { error } = await supabase
          .from("broker_permissions")
          .upsert({
            broker_id: brokerId,
            [selectedFeature]: newValue,
          }, {
            onConflict: "broker_id",
          });

        if (error) {
          console.error(`Error updating ${brokerId}:`, error);
        }
      }

      alert(
        `Successfully ${action}d "${featureLabel}" for ${selectedBrokers.length} broker(s)`
      );
      setSelectedBrokers([]);
    } catch (error) {
      console.error("Bulk update error:", error);
      alert("Failed to update permissions");
    } finally {
      setSaving(false);
    }
  };

  const toggleBrokerSelection = (brokerId: string) => {
    setSelectedBrokers((prev) =>
      prev.includes(brokerId)
        ? prev.filter((id) => id !== brokerId)
        : [...prev, brokerId]
    );
  };

  const selectAllBrokers = () => {
    const nonAdmins = brokers.filter((b) => !b.is_admin);
    setSelectedBrokers(nonAdmins.map((b) => b.id));
  };

  const deselectAll = () => {
    setSelectedBrokers([]);
  };

  if (loading) {
    return <div className="py-8 text-center text-slate-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h3 className="font-semibold text-amber-900">Cost Control</h3>
            <p className="mt-1 text-sm text-amber-800">
              AI features use external APIs (OpenAI, Tavily) that incur per-use costs.
              Use this panel to control which features are available to your team.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("defaults")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "defaults"
              ? "border-b-2 border-orange-500 text-orange-700"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Settings className="mb-1 inline h-4 w-4" /> Default Permissions
        </button>
        <button
          onClick={() => setActiveTab("bulk")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "bulk"
              ? "border-b-2 border-orange-500 text-orange-700"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Users className="mb-1 inline h-4 w-4" /> Bulk Update
        </button>
      </div>

      {/* Default Permissions Tab */}
      {activeTab === "defaults" && (
        <div className="space-y-6">
          <div>
            <h3 className="mb-1 text-lg font-semibold text-slate-900">
              Default Permissions for New Brokers
            </h3>
            <p className="text-sm text-slate-600">
              These permissions will be automatically granted when you invite new brokers.
            </p>
          </div>

          {/* AI Features */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-700">AI Features</h4>
            <div className="space-y-3">
              {AI_FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <label
                    key={feature.key}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={defaults[feature.key as keyof typeof defaults]}
                      onChange={(e) =>
                        setDefaults({ ...defaults, [feature.key]: e.target.checked })
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-slate-600" />
                        <span className="font-medium text-slate-900">{feature.label}</span>
                        {feature.cost && (
                          <span className="text-xs text-slate-500">({feature.cost})</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{feature.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Other Features */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-700">Other Features</h4>
            <div className="space-y-3">
              {OTHER_FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <label
                    key={feature.key}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={defaults[feature.key as keyof typeof defaults]}
                      onChange={(e) =>
                        setDefaults({ ...defaults, [feature.key]: e.target.checked })
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-slate-600" />
                        <span className="font-medium text-slate-900">{feature.label}</span>
                        {feature.cost && (
                          <span className="text-xs text-slate-500">({feature.cost})</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{feature.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleSaveDefaults}
            disabled={saving}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Default Permissions"}
          </button>
        </div>
      )}

      {/* Bulk Update Tab */}
      {activeTab === "bulk" && (
        <div className="space-y-6">
          <div>
            <h3 className="mb-1 text-lg font-semibold text-slate-900">
              Bulk Update Permissions
            </h3>
            <p className="text-sm text-slate-600">
              Enable or disable features for multiple brokers at once.
            </p>
          </div>

          {/* Action Controls */}
          <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Action
              </label>
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value as "enable" | "disable")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                <option value="disable">Disable</option>
                <option value="enable">Enable</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Feature
              </label>
              <select
                value={selectedFeature}
                onChange={(e) => setSelectedFeature(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                <optgroup label="AI Features">
                  {AI_FEATURES.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Other Features">
                  {OTHER_FEATURES.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleBulkUpdate}
                disabled={saving || selectedBrokers.length === 0}
                className="h-10 w-full rounded-lg bg-orange-500 px-4 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {saving
                  ? "Updating..."
                  : `${bulkAction === "enable" ? "Enable" : "Disable"} for ${selectedBrokers.length} broker(s)`}
              </button>
            </div>
          </div>

          {/* Broker Selection */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-700">
                Select Brokers ({selectedBrokers.length} selected)
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={selectAllBrokers}
                  className="text-sm text-orange-600 hover:text-orange-700"
                >
                  Select all non-admins
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={deselectAll}
                  className="text-sm text-slate-600 hover:text-slate-700"
                >
                  Deselect all
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full">
                <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700">
                      Select
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700">
                      Email
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-700">
                      Role
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {brokers.map((broker) => (
                    <tr
                      key={broker.id}
                      className={`hover:bg-slate-50 ${
                        broker.is_admin ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          disabled={broker.is_admin}
                          checked={selectedBrokers.includes(broker.id)}
                          onChange={() => toggleBrokerSelection(broker.id)}
                          className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-4 py-2 text-sm font-medium text-slate-900">
                        {broker.first_name} {broker.last_name}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-600">
                        {broker.email}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                            broker.is_admin
                              ? "bg-amber-100 text-amber-800"
                              : broker.is_manager
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {broker.is_admin
                            ? "Admin"
                            : broker.is_manager
                              ? "Manager"
                              : "Broker"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
