"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, GripVertical, AlertCircle } from "lucide-react";

interface CustomerStatus {
  id: string;
  name: string;
  color: string;
  order: number;
  customer_count?: number;
}

interface StatusConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  statuses: CustomerStatus[];
  onSave: (statuses: CustomerStatus[]) => void;
}

const PRESET_COLORS = [
  {
    name: "Blue",
    value: "blue",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-900",
  },
  {
    name: "Green",
    value: "green",
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-900",
  },
  {
    name: "Purple",
    value: "purple",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
  },
  {
    name: "Orange",
    value: "orange",
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-900",
  },
  {
    name: "Red",
    value: "red",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-900",
  },
  {
    name: "Yellow",
    value: "yellow",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-900",
  },
  {
    name: "Slate",
    value: "slate",
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-900",
  },
  {
    name: "Pink",
    value: "pink",
    bg: "bg-pink-50",
    border: "border-pink-200",
    text: "text-pink-900",
  },
];

export default function StatusConfigModal({
  isOpen,
  onClose,
  statuses,
  onSave,
}: StatusConfigModalProps) {
  const [localStatuses, setLocalStatuses] =
    useState<CustomerStatus[]>(statuses);
  const [newStatusName, setNewStatusName] = useState("");
  const [selectedColor, setSelectedColor] = useState("blue");
  const [error, setError] = useState("");

  // Sync local state when modal opens or statuses change
  React.useEffect(() => {
    if (isOpen) {
      setLocalStatuses(statuses);
      setError("");
    }
  }, [isOpen, statuses]);

  if (!isOpen) return null;

  const handleAddStatus = () => {
    if (!newStatusName.trim()) {
      setError("Status name is required");
      return;
    }

    if (
      localStatuses.some(
        (s) => s.name.toLowerCase() === newStatusName.toLowerCase(),
      )
    ) {
      setError("A status with this name already exists");
      return;
    }

    const newStatus: CustomerStatus = {
      id: `status-${Date.now()}`,
      name: newStatusName.trim(),
      color: selectedColor,
      order: localStatuses.length,
      customer_count: 0,
    };

    setLocalStatuses([...localStatuses, newStatus]);
    setNewStatusName("");
    setError("");
  };

  const handleDeleteStatus = (statusId: string) => {
    const status = localStatuses.find((s) => s.id === statusId);
    if (status && (status.customer_count || 0) > 0) {
      setError(
        `Cannot delete "${status.name}" - it has ${status.customer_count} customer(s). Move them first.`,
      );
      return;
    }

    setLocalStatuses(localStatuses.filter((s) => s.id !== statusId));
    setError("");
  };

  const handleSave = () => {
    if (localStatuses.length === 0) {
      setError("You must have at least one status");
      return;
    }
    onSave(localStatuses);
    onClose();
  };

  const handleReorder = (index: number, direction: "up" | "down") => {
    const newStatuses = [...localStatuses];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newStatuses.length) return;

    [newStatuses[index], newStatuses[targetIndex]] = [
      newStatuses[targetIndex],
      newStatuses[index],
    ];
    newStatuses.forEach((status, i) => (status.order = i));

    setLocalStatuses(newStatuses);
  };

  const getColorClasses = (color: string) => {
    const colorConfig = PRESET_COLORS.find((c) => c.value === color);
    return colorConfig || PRESET_COLORS[0];
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Configure Board Statuses
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Customize the columns for your customer pipeline
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Add New Status */}
          <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Add New Status
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Status Name
                </label>
                <input
                  type="text"
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  placeholder="e.g., Warm Lead, Negotiating, Qualified"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-20"
                  onKeyDown={(e) => e.key === "Enter" && handleAddStatus()}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Column Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setSelectedColor(color.value)}
                      className={`flex h-10 items-center gap-2 rounded-lg border-2 px-3 text-xs font-medium transition-all ${
                        selectedColor === color.value
                          ? `${color.bg} ${color.border} ${color.text} ring-2 ring-offset-1`
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div
                        className={`h-3 w-3 rounded-full ${color.bg} border ${color.border}`}
                      />
                      {color.name}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleAddStatus}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-orange-500 text-sm font-medium text-white transition-colors hover:bg-orange-600"
              >
                <Plus className="h-4 w-4" />
                Add Status
              </button>
            </div>
          </div>

          {/* Current Statuses */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Current Statuses ({localStatuses.length})
            </h3>
            <div className="space-y-2">
              {localStatuses.map((status, index) => {
                const colorConfig = getColorClasses(status.color);
                return (
                  <div
                    key={status.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 ${colorConfig.bg} ${colorConfig.border}`}
                  >
                    {/* Reorder Buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleReorder(index, "up")}
                        disabled={index === 0}
                        className="rounded p-0.5 hover:bg-slate-200 disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <GripVertical className="h-3 w-3 text-slate-500" />
                      </button>
                      <button
                        onClick={() => handleReorder(index, "down")}
                        disabled={index === localStatuses.length - 1}
                        className="rounded p-0.5 hover:bg-slate-200 disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <GripVertical className="h-3 w-3 text-slate-500" />
                      </button>
                    </div>

                    {/* Status Info */}
                    <div className="flex-1">
                      <div className={`font-semibold ${colorConfig.text}`}>
                        {status.name}
                      </div>
                      {(status.customer_count || 0) > 0 && (
                        <div className="text-xs text-slate-600">
                          {status.customer_count} customer
                          {status.customer_count !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteStatus(status.id)}
                      disabled={(status.customer_count || 0) > 0}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Delete status"
                      title={
                        (status.customer_count || 0) > 0
                          ? "Cannot delete - has customers"
                          : "Delete status"
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}

              {localStatuses.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-500">
                  No statuses yet. Add one above to get started.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 p-6">
          <button
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="h-10 rounded-lg bg-orange-500 px-4 text-sm font-medium text-white transition-colors hover:bg-orange-600"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
