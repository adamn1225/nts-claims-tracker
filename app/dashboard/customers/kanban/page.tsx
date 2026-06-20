"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import KanbanBoard from "@/components/KanbanBoard";
import CustomerFormModal from "@/components/CustomerFormModal";
import TaskFormModal from "@/components/TaskFormModal";
import DesktopOnlyView from "@/components/DesktopOnlyView";
import { useCustomers } from "../useCustomers";
import { Task } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
function KanbanViewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    customers,
    currentBrokerId,
    activeBrokerIdForNew,
    showCustomerModal,
    editingCustomer,
    showTaskModal,
    taskCustomer,
    isLoading,
    setShowCustomerModal,
    setEditingCustomer,
    setShowTaskModal,
    handlePinCustomer,
    handleEditCustomer,
    handleQuickAction,
    handleAddNote,
    handleAddCustomer,
    handleSaveCustomer,
    handleStatusChange,
    handleStatusRenamed,
    handleRemoveFromBoard,
  } = useCustomers();

  // Filter to only show customers on the kanban board
  const kanbanCustomers = customers.filter((c) => c.on_kanban_board);

  // Check for ?action=new query parameter
  useEffect(() => {
    if (searchParams.get("action") === "new") {
      handleAddCustomer();
      // Remove query param from URL
      router.replace("/dashboard/customers/kanban");
    }
  }, [searchParams, handleAddCustomer, router]);

  const handleSaveTask = async (taskData: Partial<Task>): Promise<Task> => {
    const supabase = createClient();

    try {
      const { data, error } = await supabase.from("tasks").insert({
        ...taskData,
        broker_id: activeBrokerIdForNew, // Assign task to viewed broker when admin/manager is managing their board
        customer_id: taskCustomer?.id,
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
      <div className="px-4 py-1 sm:px-6">
        <KanbanBoard
          customers={kanbanCustomers}
          onPin={handlePinCustomer}
          onEdit={handleEditCustomer}
          onQuickAction={handleQuickAction}
          onAddCustomer={handleAddCustomer}
          onStatusChange={handleStatusChange}
          onStatusRenamed={handleStatusRenamed}
          onAddNote={handleAddNote}
          onRemoveFromBoard={handleRemoveFromBoard}
        />
      </div>

      <CustomerFormModal
        isOpen={showCustomerModal}
        onClose={() => {
          setShowCustomerModal(false);
          setEditingCustomer(null);
        }}
        onSave={handleSaveCustomer}
        customer={editingCustomer}
        brokerId={currentBrokerId}
      />

      <TaskFormModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onSave={handleSaveTask}
        brokerId={currentBrokerId}
        customers={customers}
        preselectedCustomer={taskCustomer || undefined}
      />
    </>
  );
}

export default function KanbanView() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
            <p className="text-sm text-slate-600">Loading customers...</p>
          </div>
        </div>
      }
    >
      <KanbanViewContent />
    </Suspense>
  );
}
