"use client";

import { useState, useEffect } from "react";
import { Plus, CheckSquare } from "lucide-react";
import TaskFormModal from "@/components/TaskFormModal";
import { createClient } from "@/lib/supabase/client";
import type { Task, Customer } from "@/lib/types";

interface FloatingTaskButtonProps {
  brokerId: string;
}

export default function FloatingTaskButton({
  brokerId,
}: FloatingTaskButtonProps) {
  const supabase = createClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  // Fetch customers for the dropdown
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { data, error } = await supabase
          .from("customers")
          .select("*")
          .eq("broker_id", brokerId)
          .order("business_name");

        if (!error && data) {
          setCustomers(data);
        }
      } catch (err) {
        console.error("Error fetching customers:", err);
      }
    };

    if (brokerId && isModalOpen) {
      fetchCustomers();
    }
  }, [brokerId, isModalOpen, supabase]);

  const handleSaveTask = async (taskData: Partial<Task>) => {
    try {
      // Always resolve the current user at save time to ensure auth.uid()
      // matches broker_id for the RLS policy check
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Session expired. Please refresh and try again.");
      }

      // Sanitize: Convert empty strings to null for UUID fields
      const cleanedData = {
        ...taskData,
        customer_id: taskData.customer_id?.trim() || null,
        due_time: taskData.due_time?.trim() || null,
        description: taskData.description?.trim() || null,
      };

      const { data, error } = await supabase
        .from("tasks")
        .insert([
          {
            ...cleanedData,
            broker_id: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        throw error;
      }

      console.log("Task created successfully:", data);
      
      // Generate notification records for reminders
      if (data?.id) {
        await fetch("/api/tasks/generate-notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: data.id }),
        });
      }
      
      setIsModalOpen(false);
      return data;
    } catch (error: any) {
      console.error("Error creating task:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        fullError: error,
      });
      throw error;
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="fixed bottom-6 right-6 z-40 flex h-14 items-center gap-2 rounded-full bg-orange-500 px-5 shadow-lg transition-all duration-200 hover:bg-orange-600 hover:shadow-xl active:scale-95 sm:h-16 sm:px-6"
        aria-label="Create new task"
        data-tour="floating-task-button"
      >
        <CheckSquare className="h-5 w-5 text-white sm:h-6 sm:w-6" />
        <span
          className={`overflow-hidden text-sm font-medium text-white transition-all duration-200 sm:text-base ${
            isHovered ? "max-w-24" : "max-w-0"
          }`}
        >
          New Task
        </span>
      </button>

      {/* Task Creation Modal */}
      <TaskFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTask}
        brokerId={brokerId}
        customers={customers}
      />
    </>
  );
}
