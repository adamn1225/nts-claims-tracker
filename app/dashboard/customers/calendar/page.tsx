"use client";

import { useState } from "react";
import CalendarView from "@/components/CalendarView";
import CustomerFormModal from "@/components/CustomerFormModal";
import TaskFormModal from "@/components/TaskFormModal";
import TaskDetailModal from "@/components/TaskDetailModal";
import { useCustomers } from "../useCustomers";
import { Task } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

export default function CalendarViewPage() {
  const supabase = createClient();
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [selectedTaskDate, setSelectedTaskDate] = useState<Date | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const {
    customers,
    currentBrokerId,
    showCustomerModal,
    editingCustomer,
    isLoading,
    setShowCustomerModal,
    setEditingCustomer,
    handleEditCustomer,
    handleQuickAction,
    handleAddTask,
    handleSaveCustomer,
  } = useCustomers();

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

  const handleAddTaskClick = (date: Date) => {
    setSelectedTaskDate(date);
    setShowTaskModal(true);
  };

  const handleSaveTask = async (taskData: Partial<Task>): Promise<Task> => {
    try {
      const { data, error } = await supabase.from("tasks").insert({
        ...taskData,
        broker_id: currentBrokerId,
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
      setSelectedTaskDate(null);
      return data;
    } catch (error) {
      console.error("Error creating task:", error);
      alert("Failed to create task. Please try again.");
      throw error;
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setShowTaskDetailModal(true);
  };

  const handleCompleteTask = async () => {
    if (!selectedTask) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "completed" })
        .eq("id", selectedTask.id);

      if (error) throw error;

      setShowTaskDetailModal(false);
      setSelectedTask(null);
      // Optionally refresh data
    } catch (error) {
      console.error("Error completing task:", error);
      alert("Failed to complete task. Please try again.");
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;

    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", selectedTask.id);

      if (error) throw error;

      setShowTaskDetailModal(false);
      setSelectedTask(null);
      // Optionally refresh data
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Failed to delete task. Please try again.");
    }
  };

  const handleEditTask = () => {
    setShowTaskDetailModal(false);
    // TODO: Open task edit modal with selectedTask data
    console.log("Edit task:", selectedTask);
  };

  return (
    <>
      <div className="p-4 sm:p-6">
        <CalendarView
          customers={customers}
          onEdit={handleEditCustomer}
          onQuickAction={handleQuickAction}
          onAddTask={handleAddTaskClick}
          onTaskClick={handleTaskClick}
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
        onClose={() => {
          setShowTaskModal(false);
          setSelectedTaskDate(null);
        }}
        onSave={handleSaveTask}
        brokerId={currentBrokerId}
        customers={customers}
      />

      <TaskDetailModal
        isOpen={showTaskDetailModal}
        onClose={() => {
          setShowTaskDetailModal(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        customer={
          selectedTask
            ? customers.find((c) => c.id === selectedTask.customer_id)
            : null
        }
        onEdit={handleEditTask}
        onDelete={handleDeleteTask}
        onComplete={handleCompleteTask}
      />
    </>
  );
}
