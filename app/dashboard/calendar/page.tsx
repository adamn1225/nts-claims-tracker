"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CalendarView from "@/components/CalendarView";
import { Customer } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { useClickToCall } from "@/contexts/ClickToCallContext";

export default function CalendarPage() {
  const router = useRouter();
  const supabase = createClient();
  const { makeCall } = useClickToCall();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
      } else {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  const handleAddTask = (date: Date) => {
    // TODO: Open schedule modal with pre-filled date
    console.log("Schedule task for date:", date.toLocaleDateString());
  };

  const handleEditCustomer = (customer: Customer) => {
    // TODO: Open edit modal/form
    console.log("Edit customer:", customer);
  };

  const handleQuickAction = (
    action: "call" | "email" | "schedule" | "notes",
    customer: Customer,
  ) => {
    // TODO: Implement quick actions
    console.log(`Quick action: ${action} for`, customer.business_name);

    if (action === "call") {
      // Option 1: GoTo click-to-call
      if (customer.phone) {
        makeCall(customer.phone, customer.id);
      }
    } else if (action === "email") {
      // Option 2: Open mailto: link
      if (customer.email) {
        window.location.href = `mailto:${customer.email}`;
      }
    } else if (action === "schedule" || action === "notes") {
      // Option 3: Open schedule modal
      // TODO: Implement scheduling modal
    }
  };
  const filteredCustomers = customers.filter((customer) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      customer.business_name?.toLowerCase().includes(query) ||
      customer.contact_name?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.industry?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Calendar</h1>
      <CalendarView
        customers={filteredCustomers}
        onEdit={handleEditCustomer}
        onQuickAction={handleQuickAction}
        onAddTask={handleAddTask}
      />
    </div>
  );
}
