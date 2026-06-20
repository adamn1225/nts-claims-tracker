"use client";

import { useEffect, useState } from "react";
import {
  X,
  Loader,
  Shield,
  Users,
  FileText,
  BarChart3,
  Eye,
  Edit,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { BrokerPermissions } from "@/lib/permissions";

type PermissionsModalProps = {
  isOpen: boolean;
  broker: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    is_admin: boolean | null;
    is_manager: boolean | null;
  } | null;
  onCloseAction: () => void;
  onSuccessAction?: () => void;
};

export default function PermissionsModal({
  isOpen,
  broker,
  onCloseAction,
  onSuccessAction,
}: PermissionsModalProps) {
  const [permissions, setPermissions] = useState<Partial<BrokerPermissions>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [grantAll, setGrantAll] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (broker && isOpen) {
      loadPermissions();
    }
  }, [broker, isOpen]);

  useEffect(() => {
    // Check if all permissions are granted
    const allPermissions = [
      "can_view_all_brokers",
      "can_view_office_brokers",
      "can_view_all_customers",
      "can_view_office_customers",
      "can_view_all_tasks",
      "can_view_office_tasks",
      "can_edit_own_customers",
      "can_edit_office_customers",
      "can_edit_all_customers",
      "can_edit_own_tasks",
      "can_edit_office_tasks",
      "can_edit_all_tasks",
      "can_manage_users",
      "can_manage_statuses",
      "can_manage_permissions",
      "can_view_analytics",
      "can_export_data",
      "can_invite_brokers",
      "can_invite_any_office",
      "can_manage_email_settings",
      "can_send_email_broadcasts",
      "can_use_ai_email",
    ];

    const allGranted = allPermissions.every(
      (key) => permissions[key as keyof BrokerPermissions] === true,
    );
    setGrantAll(allGranted);
  }, [permissions]);

  const loadPermissions = async () => {
    if (!broker) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/broker-permissions?brokerId=${broker.id}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load permissions");
      }

      // Filter out metadata fields, only keep permission booleans
      const { id, broker_id, created_at, updated_at, ...permissionFields } =
        data.permissions;
      setPermissions(permissionFields);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load permissions",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broker) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/broker-permissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brokerId: broker.id,
          permissions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update permissions");
      }

      setSuccess(true);
      if (onSuccessAction) onSuccessAction();

      setTimeout(() => {
        onCloseAction();
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update permissions",
      );
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (key: keyof BrokerPermissions) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleAllPermissions = () => {
    const newValue = !grantAll;
    setPermissions({
      can_view_all_brokers: newValue,
      can_view_office_brokers: newValue,
      can_view_all_customers: newValue,
      can_view_office_customers: newValue,
      can_view_all_tasks: newValue,
      can_view_office_tasks: newValue,
      can_edit_own_customers: newValue,
      can_edit_office_customers: newValue,
      can_edit_all_customers: newValue,
      can_edit_own_tasks: newValue,
      can_edit_office_tasks: newValue,
      can_edit_all_tasks: newValue,
      can_manage_users: newValue,
      can_manage_statuses: newValue,
      can_manage_permissions: newValue,
      can_view_analytics: newValue,
      can_export_data: newValue,
      // Set invite permissions based on manage_users
      can_invite_brokers: newValue,
      can_invite_any_office: newValue,
      can_manage_email_settings: newValue,
      can_send_email_broadcasts: newValue,
      can_use_ai_email: newValue,
    });
  };

  if (!isOpen || !broker) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-lg">
        {/* Header */}
        <div className="sticky top-0 border-b border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Manage Permissions
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {broker.first_name} {broker.last_name || ""} ({broker.email})
              </p>
            </div>
            <button
              onClick={onCloseAction}
              className="rounded p-1 hover:bg-slate-100"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              Permissions updated successfully!
            </div>
          )}

          {!loading && (
            <div className="space-y-6">
              {/* Grant All Permissions */}
              <div className="rounded-lg border-2 border-orange-200 bg-orange-50 p-4">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={grantAll}
                    onChange={toggleAllPermissions}
                    className="h-5 w-5 rounded border-orange-300 text-orange-500 focus:ring-orange-500"
                  />
                  <div>
                    <p className="font-semibold text-orange-900">
                      Grant All Permissions
                    </p>
                    <p className="text-sm text-orange-700">
                      Toggle all permissions at once
                    </p>
                  </div>
                </label>
              </div>

              {/* Basic Permissions */}
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Shield className="h-4 w-4 text-orange-500" />
                  Basic Permissions
                </div>
                <div className="space-y-2 rounded-lg border border-slate-200 p-4">
                  <PermissionCheckbox
                    label="View Office Brokers"
                    description="Can see and switch to brokers in same office"
                    checked={permissions.can_view_office_brokers ?? false}
                    onChange={() => togglePermission("can_view_office_brokers")}
                  />
                  <PermissionCheckbox
                    label="Edit Own Customers"
                    description="Can edit their own customer records"
                    checked={permissions.can_edit_own_customers ?? false}
                    onChange={() => togglePermission("can_edit_own_customers")}
                  />
                  <PermissionCheckbox
                    label="Edit Own Tasks"
                    description="Can edit their own tasks"
                    checked={permissions.can_edit_own_tasks ?? false}
                    onChange={() => togglePermission("can_edit_own_tasks")}
                  />
                </div>
              </div>

              {/* Management Permissions */}
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Users className="h-4 w-4 text-orange-500" />
                  Management Permissions
                </div>
                <div className="space-y-2 rounded-lg border border-slate-200 p-4">
                  <PermissionCheckbox
                    label="Manage Users"
                    description="Can invite, edit, and manage other brokers"
                    checked={permissions.can_manage_users ?? false}
                    onChange={() => {
                      togglePermission("can_manage_users");
                      // Auto-set invite permissions
                      const newValue = !permissions.can_manage_users;
                      setPermissions((prev) => ({
                        ...prev,
                        can_manage_users: newValue,
                        can_invite_brokers: newValue,
                        can_invite_any_office: newValue,
                      }));
                    }}
                  />
                  <PermissionCheckbox
                    label="Manage Statuses"
                    description="Can create and modify custom customer statuses"
                    checked={permissions.can_manage_statuses ?? false}
                    onChange={() => togglePermission("can_manage_statuses")}
                  />
                  <PermissionCheckbox
                    label="View Analytics"
                    description="Can access analytics and reports"
                    checked={permissions.can_view_analytics ?? false}
                    onChange={() => togglePermission("can_view_analytics")}
                  />
                  <PermissionCheckbox
                    label="Manage Email Settings"
                    description="Can configure email templates and system email settings"
                    checked={permissions.can_manage_email_settings ?? false}
                    onChange={() =>
                      togglePermission("can_manage_email_settings")
                    }
                  />
                  <PermissionCheckbox
                    label="Send Email Broadcasts"
                    description="Can send on-demand email broadcasts to users"
                    checked={permissions.can_send_email_broadcasts ?? false}
                    onChange={() =>
                      togglePermission("can_send_email_broadcasts")
                    }
                  />
                  <PermissionCheckbox
                    label="Use AI Email"
                    description="Can use AI-powered email generation features"
                    checked={permissions.can_use_ai_email ?? false}
                    onChange={() => togglePermission("can_use_ai_email")}
                  />
                </div>
              </div>

              {/* Advanced Permissions (Expandable) */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="mb-3 flex w-full items-center gap-2 text-sm font-semibold text-slate-900 hover:text-orange-600"
                >
                  {showAdvanced ? (
                    <ChevronDown className="h-4 w-4 text-orange-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-orange-500" />
                  )}
                  Advanced Permissions
                  <span className="ml-auto text-xs font-normal text-slate-500">
                    {showAdvanced ? "Hide" : "Show"} advanced options
                  </span>
                </button>

                {showAdvanced && (
                  <div className="space-y-4">
                    {/* View Permissions */}
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-700">
                        <Eye className="h-3.5 w-3.5 text-slate-400" />
                        View Permissions
                      </div>
                      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <PermissionCheckbox
                          label="View All Brokers"
                          description="Can see and switch to any broker's view"
                          checked={permissions.can_view_all_brokers ?? false}
                          onChange={() =>
                            togglePermission("can_view_all_brokers")
                          }
                        />
                        <PermissionCheckbox
                          label="View All Customers"
                          description="Can see all customers across the company"
                          checked={permissions.can_view_all_customers ?? false}
                          onChange={() =>
                            togglePermission("can_view_all_customers")
                          }
                        />
                        <PermissionCheckbox
                          label="View Office Customers"
                          description="Can see all customers in the same office"
                          checked={
                            permissions.can_view_office_customers ?? false
                          }
                          onChange={() =>
                            togglePermission("can_view_office_customers")
                          }
                        />
                        <PermissionCheckbox
                          label="View All Tasks"
                          description="Can see all tasks across the company"
                          checked={permissions.can_view_all_tasks ?? false}
                          onChange={() =>
                            togglePermission("can_view_all_tasks")
                          }
                        />
                        <PermissionCheckbox
                          label="View Office Tasks"
                          description="Can see all tasks in the same office"
                          checked={permissions.can_view_office_tasks ?? false}
                          onChange={() =>
                            togglePermission("can_view_office_tasks")
                          }
                        />
                      </div>
                    </div>

                    {/* Edit Permissions */}
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-700">
                        <Edit className="h-3.5 w-3.5 text-slate-400" />
                        Edit Permissions
                      </div>
                      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <PermissionCheckbox
                          label="Edit Office Customers"
                          description="Can edit any customer in the same office"
                          checked={
                            permissions.can_edit_office_customers ?? false
                          }
                          onChange={() =>
                            togglePermission("can_edit_office_customers")
                          }
                        />
                        <PermissionCheckbox
                          label="Edit All Customers"
                          description="Can edit any customer in the company"
                          checked={permissions.can_edit_all_customers ?? false}
                          onChange={() =>
                            togglePermission("can_edit_all_customers")
                          }
                        />
                        <PermissionCheckbox
                          label="Edit Office Tasks"
                          description="Can edit any task in the same office"
                          checked={permissions.can_edit_office_tasks ?? false}
                          onChange={() =>
                            togglePermission("can_edit_office_tasks")
                          }
                        />
                        <PermissionCheckbox
                          label="Edit All Tasks"
                          description="Can edit any task in the company"
                          checked={permissions.can_edit_all_tasks ?? false}
                          onChange={() =>
                            togglePermission("can_edit_all_tasks")
                          }
                        />
                      </div>
                    </div>

                    {/* Admin-Only Permissions */}
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-700">
                        <Shield className="h-3.5 w-3.5 text-slate-400" />
                        Admin-Only Permissions
                      </div>
                      <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                        <PermissionCheckbox
                          label="Manage Permissions"
                          description="Can modify other users' permissions (dangerous)"
                          checked={permissions.can_manage_permissions ?? false}
                          onChange={() =>
                            togglePermission("can_manage_permissions")
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={loading || saving}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-orange-500 font-medium text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Permissions"
              )}
            </button>
            <button
              type="button"
              onClick={onCloseAction}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PermissionCheckbox({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
      />
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </label>
  );
}
