"use client";

import { useState } from "react";
import ListView from "@/components/ListView";
import CustomerFormModal from "@/components/CustomerFormModal";
import CustomerDetailModal from "@/components/CustomerDetailModal";
import ReassignCustomerModal from "@/components/ReassignCustomerModal";
import TaskFormModal from "@/components/TaskFormModal";
import { useCustomers } from "../useCustomers";
import { Customer, Task } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

export default function ListViewPage() {
  const {
    customers,
    currentTeamMemberId,
    currentTeamMember,
    canReassign,
    showCustomerModal,
    editingCustomer,
    isLoading,
    setShowCustomerModal,
    setEditingCustomer,
    handlePinCustomer,
    handleEditCustomer,
    handleQuickAction,
    handleSaveCustomer,
    handleAddToBoard,
    handleStatusChange,
  } = useCustomers();

  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignCustomer, setReassignCustomer] = useState<{
    id: string;
    name: string;
    teamMemberId: string;
  } | null>(null);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // Filter to only show customers in workspace (same as Kanban board)
  const workspaceCustomers = customers.filter((c) => c.on_kanban_board);

  const handleReassign = (customerId: string, customerName: string, teamMemberId: string) => {
    setReassignCustomer({ id: customerId, name: customerName, teamMemberId });
    setShowReassignModal(true);
  };

  const handleReassignSuccess = () => {
    // Reload the page to fetch updated data
    window.location.reload();
  };

  const handleViewDetail = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowDetailModal(true);
  };

  const handleEditFromDetail = (customer: Customer) => {
    setShowDetailModal(false);
    handleEditCustomer(customer);
  };

  const handleScheduleTask = () => {
    setShowTaskModal(true);
  };

  const handleSaveTask = async (taskData: Partial<Task>): Promise<Task> => {
    const supabase = createClient();

    try {
      const { data, error } = await supabase.from("tasks").insert({
        ...taskData,
        team_member_id: currentTeamMemberId,
        customer_id: selectedCustomer?.id,
      }).select().single();

      if (error || !data) throw error;
      
      // Generate notification records for reminders
      if (data.id) {
        await fetch("/api/tasks/generate-notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: data.id }),
        });
      }

      setShowTaskModal(false);
      return data;
    } catch (error) {
      console.error("Error creating task:", error);
      alert("Failed to create task. Please try again.");
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
          <p className="text-sm text-slate-600">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 sm:p-6">
        <ListView
          customers={workspaceCustomers}
          onPin={handlePinCustomer}
          onEdit={handleEditCustomer}
          onViewDetail={handleViewDetail}
          onQuickAction={handleQuickAction}
          canReassign={canReassign}
          onReassign={handleReassign}
          onAddToBoard={handleAddToBoard}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <CustomerDetailModal
          isOpen={showDetailModal}
          onCloseAction={() => {
            setShowDetailModal(false);
            setSelectedCustomer(null);
          }}
          customer={selectedCustomer}
          onEditAction={handleEditFromDetail}
          onScheduleTaskAction={() => {
            setShowDetailModal(false);
            setShowTaskModal(true);
          }}
          onQuickAction={handleQuickAction}
        />
      )}

      {/* Customer Edit Modal */}
      <CustomerFormModal
        isOpen={showCustomerModal}
        onClose={() => {
          setShowCustomerModal(false);
          setEditingCustomer(null);
        }}
        onSave={handleSaveCustomer}
        customer={editingCustomer}
        teamMemberId={currentTeamMemberId}
      />

      {/* Task Modal */}
      {showTaskModal && (
        <TaskFormModal
          isOpen={showTaskModal}
          onClose={() => setShowTaskModal(false)}
          onSave={handleSaveTask}
          preselectedCustomer={selectedCustomer || undefined}
          teamMemberId={currentTeamMemberId}
        />
      )}

      {/* Reassign Modal */}
      {reassignCustomer && (
        <ReassignCustomerModal
          isOpen={showReassignModal}
          onCloseAction={() => {
            setShowReassignModal(false);
            setReassignCustomer(null);
          }}
          customerId={reassignCustomer.id}
          customerName={reassignCustomer.name}
          currentTeamMemberId={reassignCustomer.teamMemberId}
          onSuccessAction={handleReassignSuccess}
        />
      )}
    </>
  );
}
