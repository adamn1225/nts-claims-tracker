"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
// Notification API routes (server-side only for security)
import { X } from "lucide-react";

type Broker = {
  id: string;
  first_name: string;
  last_name?: string;
  email: string;
  office_location: string | null;
  is_manager: boolean;
  is_admin: boolean;
};

type ReassignCustomerModalProps = {
  isOpen: boolean;
  onCloseAction: () => void;
  customerId: string;
  customerName: string;
  currentBrokerId: string;
  onSuccessAction: () => void;
};

export default function ReassignCustomerModal({
  isOpen,
  onCloseAction,
  customerId,
  customerName,
  currentBrokerId,
  onSuccessAction,
}: ReassignCustomerModalProps) {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [selectedBroker, setSelectedBroker] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<Broker | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadBrokers();
      loadCurrentUser();
    }
  }, [isOpen]);

  const loadCurrentUser = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: brokerData } = await supabase
      .from("brokers")
      .select("*")
      .eq("id", user.id)
      .single();

    setCurrentUser(brokerData);
  };

  const loadBrokers = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("brokers")
      .select("*")
      .eq("is_active", true) // Only show active brokers
      .neq("id", currentBrokerId) // Exclude current broker
      .order("first_name");

    setBrokers(data || []);
  };

  const handleReassign = async () => {
    if (!selectedBroker) return;

    setLoading(true);
    const supabase = createClient();

    const newBrokerId = selectedBroker === "UNASSIGN" ? null : selectedBroker;

    const { error } = await supabase
      .from("customers")
      .update({
        broker_id: newBrokerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);

    if (error) {
      alert("Error reassigning customer: " + error.message);
      setLoading(false);
      return;
    }

    // Create notification for reassignment (API handles security & self-assignment skip)
    if (currentUser) {
      fetch('/api/notifications/contact-reassigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newBrokerId,
          oldBrokerId: currentBrokerId,
          customerId,
          customerName,
          reassignedBy: `${currentUser.first_name} ${currentUser.last_name || ''}`.trim(),
          reassignedByBrokerId: currentUser.id,
        }),
      }).catch(err => console.error('Failed to send reassignment notification:', err));
    }

    const action = selectedBroker === "UNASSIGN" ? "unassigned" : "reassigned";
    alert(`Customer ${action} successfully!`);
    setLoading(false);
    onSuccessAction();
    onCloseAction();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Reassign Customer
          </h3>
          <button
            onClick={onCloseAction}
            disabled={loading}
            className="rounded-lg p-1 hover:bg-slate-100"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm text-blue-900">
            <span className="font-medium">{customerName}</span> will be reassigned
            to the selected broker.
          </p>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Reassign to:
          </label>
          <select
            value={selectedBroker}
            onChange={(e) => setSelectedBroker(e.target.value)}
            disabled={loading}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
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
            onClick={onCloseAction}
            disabled={loading}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleReassign}
            disabled={!selectedBroker || loading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Reassigning..." : "Reassign"}
          </button>
        </div>
      </div>
    </div>
  );
}
