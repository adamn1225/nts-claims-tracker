import { useState, useEffect } from "react";
import { Customer, CustomerStatus, TmsReference } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { useBrokerView } from "@/contexts/BrokerViewContext";
import { useClickToCall } from "@/contexts/ClickToCallContext";

export function useCustomers() {
  const { currentBroker, viewingBroker } = useBrokerView();
  const { makeCall } = useClickToCall();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskCustomer, setTaskCustomer] = useState<Customer | null>(null);
  const [currentBrokerId, setCurrentBrokerId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Use viewing broker's ID for filtering, fallback to current broker
  const activeBrokerId = viewingBroker?.id || currentBroker?.id || "";

  const normalizeStatusName = (value: string) => value.trim();

  // Fetch broker ID and customers on mount or when viewing broker changes
  useEffect(() => {
    const initializeData = async () => {
      const supabase = createClient();

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      setCurrentBrokerId(user.id);

      // Fetch customers for the viewing broker (or current if not viewing another)
      const brokerIdToFetch = viewingBroker?.id || user.id;
      await fetchCustomers(brokerIdToFetch);
      setIsLoading(false);
    };

    initializeData();
  }, [viewingBroker?.id]); // Re-fetch when viewing broker changes

  // Real-time subscription for customer changes
  useEffect(() => {
    if (!activeBrokerId) return;

    const supabase = createClient();

    // Subscribe to changes on customers table for this broker
    const channel = supabase
      .channel(`customers:${activeBrokerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "customers",
          filter: `broker_id=eq.${activeBrokerId}`,
        },
        async (payload) => {
          console.log("Real-time INSERT:", payload.new);

          // Fetch full customer data with TMS references and note count
          const { data: tmsData } = await supabase
            .from("tms_references")
            .select("*")
            .eq("customer_id", payload.new.id);

          const { data: noteCountData } = await supabase
            .from("contact_log")
            .select("customer_id")
            .eq("customer_id", payload.new.id)
            .eq("broker_id", activeBrokerId)
            .eq("type", "note");

          const { data: collaboratorsData } = await supabase
            .from("customer_collaborators")
            .select(
              `
              id,
              broker_id,
              role,
              access_level,
              active,
              brokers!inner(id, first_name, last_name)
            `
            )
            .eq("customer_id", payload.new.id)
            .eq("active", true);

          const collaborators = collaboratorsData
            ? collaboratorsData.map((collab: any) => ({
              id: collab.id,
              broker_id: collab.broker_id,
              broker_name: `${collab.brokers.first_name} ${collab.brokers.last_name || ""
                }`.trim(),
              role: collab.role,
              access_level: collab.access_level,
              active: collab.active,
            }))
            : [];

          const newCustomer = {
            ...(payload.new as any),
            tms_references: tmsData || [],
            note_count: noteCountData?.length || 0,
            collaborators,
          } as Customer;

          setCustomers((prev) => {
            // Check if customer already exists (prevent duplicates)
            if (prev.some((c) => c.id === newCustomer.id)) {
              return prev;
            }
            // Add new customer to the start (newest first)
            return [newCustomer, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "customers",
          filter: `broker_id=eq.${activeBrokerId}`,
        },
        async (payload) => {
          console.log("Real-time UPDATE:", payload.new);

          // Fetch updated TMS references
          const { data: tmsData } = await supabase
            .from("tms_references")
            .select("*")
            .eq("customer_id", payload.new.id);

          const { data: noteCountData } = await supabase
            .from("contact_log")
            .select("customer_id")
            .eq("customer_id", payload.new.id)
            .eq("broker_id", activeBrokerId)
            .eq("type", "note");

          const { data: collaboratorsData } = await supabase
            .from("customer_collaborators")
            .select(
              `
              id,
              broker_id,
              role,
              access_level,
              active,
              brokers!inner(id, first_name, last_name)
            `
            )
            .eq("customer_id", payload.new.id)
            .eq("active", true);

          const collaborators = collaboratorsData
            ? collaboratorsData.map((collab: any) => ({
              id: collab.id,
              broker_id: collab.broker_id,
              broker_name: `${collab.brokers.first_name} ${collab.brokers.last_name || ""
                }`.trim(),
              role: collab.role,
              access_level: collab.access_level,
              active: collab.active,
            }))
            : [];

          const updatedCustomer = {
            ...(payload.new as any),
            tms_references: tmsData || [],
            note_count: noteCountData?.length || 0,
            collaborators,
          } as Customer;

          setCustomers((prev) =>
            prev.map((c) =>
              c.id === updatedCustomer.id ? updatedCustomer : c
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "customers",
          filter: `broker_id=eq.${activeBrokerId}`,
        },
        (payload) => {
          console.log("Real-time DELETE:", payload.old);
          setCustomers((prev) => prev.filter((c) => c.id !== payload.old.id));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "customer_collaborators",
        },
        async (payload) => {
          console.log("Real-time collaboration INSERT:", payload.new);
          const customerId = payload.new.customer_id;

          // Fetch updated collaborators for this customer
          const { data: collaboratorsData } = await supabase
            .from("customer_collaborators")
            .select(
              `
              id,
              broker_id,
              role,
              access_level,
              active,
              brokers!inner(id, first_name, last_name)
            `
            )
            .eq("customer_id", customerId)
            .eq("active", true);

          const collaborators = collaboratorsData
            ? collaboratorsData.map((collab: any) => ({
              id: collab.id,
              broker_id: collab.broker_id,
              broker_name: `${collab.brokers.first_name} ${collab.brokers.last_name || ""
                }`.trim(),
              role: collab.role,
              access_level: collab.access_level,
              active: collab.active,
            }))
            : [];

          setCustomers((prev) =>
            prev.map((c) =>
              c.id === customerId
                ? { ...c, collaborators }
                : c
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "customer_collaborators",
        },
        async (payload) => {
          console.log("Real-time collaboration UPDATE:", payload.new);
          const customerId = payload.new.customer_id;

          // Fetch updated collaborators for this customer
          const { data: collaboratorsData } = await supabase
            .from("customer_collaborators")
            .select(
              `
              id,
              broker_id,
              role,
              access_level,
              active,
              brokers!inner(id, first_name, last_name)
            `
            )
            .eq("customer_id", customerId)
            .eq("active", true);

          const collaborators = collaboratorsData
            ? collaboratorsData.map((collab: any) => ({
              id: collab.id,
              broker_id: collab.broker_id,
              broker_name: `${collab.brokers.first_name} ${collab.brokers.last_name || ""
                }`.trim(),
              role: collab.role,
              access_level: collab.access_level,
              active: collab.active,
            }))
            : [];

          setCustomers((prev) =>
            prev.map((c) =>
              c.id === customerId
                ? { ...c, collaborators }
                : c
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "customer_collaborators",
        },
        async (payload) => {
          console.log("Real-time collaboration DELETE:", payload.old);
          const customerId = payload.old.customer_id;

          // Fetch updated collaborators for this customer
          const { data: collaboratorsData } = await supabase
            .from("customer_collaborators")
            .select(
              `
              id,
              broker_id,
              role,
              access_level,
              active,
              brokers!inner(id, first_name, last_name)
            `
            )
            .eq("customer_id", customerId)
            .eq("active", true);

          const collaborators = collaboratorsData
            ? collaboratorsData.map((collab: any) => ({
              id: collab.id,
              broker_id: collab.broker_id,
              broker_name: `${collab.brokers.first_name} ${collab.brokers.last_name || ""
                }`.trim(),
              role: collab.role,
              access_level: collab.access_level,
              active: collab.active,
            }))
            : [];

          setCustomers((prev) =>
            prev.map((c) =>
              c.id === customerId
                ? { ...c, collaborators }
                : c
            )
          );
        }
      )
      .subscribe();

    // Cleanup subscription on unmount or when activeBrokerId changes
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBrokerId]);

  const fetchCustomers = async (userId: string) => {
    const supabase = createClient();

    try {
      // Fetch customers with their TMS references
      // Sort by created_at DESC so newest manually added contacts appear first
      // (imports will be alphabetically sorted when displayed, but manual adds show on top)
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("*")
        .eq("broker_id", userId)
        .order("created_at", { ascending: false });

      if (customersError) {
        console.error("Error fetching customers:", {
          message: customersError.message,
          details: customersError.details,
          hint: customersError.hint,
          code: customersError.code,
        });
        return;
      }

      if (!customersData) {
        console.log("No customers data returned");
        setCustomers([]);
        return;
      }

      // Fetch TMS references for all customers
      const { data: tmsData, error: tmsError } = await supabase
        .from("tms_references")
        .select("*")
        .eq("broker_id", userId);

      if (tmsError) {
        console.error("Error fetching TMS references:", {
          message: tmsError.message,
          details: tmsError.details,
          hint: tmsError.hint,
          code: tmsError.code,
        });
      }

      // Fetch note counts for all customers
      const { data: noteCountsData, error: noteCountsError } = await supabase
        .from("contact_log")
        .select("customer_id")
        .eq("broker_id", userId)
        .eq("type", "note");

      if (noteCountsError) {
        console.error("Error fetching note counts:", {
          message: noteCountsError.message,
          details: noteCountsError.details,
          hint: noteCountsError.hint,
          code: noteCountsError.code,
        });
      }

      // Fetch collaborators for all customers
      let collaboratorsData: any[] = [];
      try {
        // Fetch collaborators with broker names using explicit join
        const { data, error: collaboratorsError } = await supabase
          .from("customer_collaborators")
          .select(
            `
            id,
            broker_id,
            customer_id,
            role,
            access_level,
            active
          `
          )
          .eq("active", true);

        if (collaboratorsError) {
          console.error("Error fetching collaborators:", collaboratorsError.message || JSON.stringify(collaboratorsError));
        } else if (data) {
          // Fetch broker names separately to avoid relationship ambiguity
          const brokerIds = [...new Set(data.map((c: any) => c.broker_id))];
          if (brokerIds.length > 0) {
            const { data: brokersData } = await supabase
              .from("brokers")
              .select("id, first_name, last_name")
              .in("id", brokerIds);

            // Map broker names to collaborators
            const brokerMap = new Map(brokersData?.map((b: any) => [b.id, b]) || []);
            const enrichedCollaborators = data.map((c: any) => ({
              ...c,
              brokers: brokerMap.get(c.broker_id),
            }));
            collaboratorsData = enrichedCollaborators;
          } else {
            collaboratorsData = data;
          }
        }
      } catch (collaboratorFetchError) {
        console.error("Exception fetching collaborators:", collaboratorFetchError);
        // Continue without collaborators data - table may not exist yet
      }

      // Count notes per customer
      const noteCounts = new Map<string, number>();
      noteCountsData?.forEach((log) => {
        const count = noteCounts.get(log.customer_id) || 0;
        noteCounts.set(log.customer_id, count + 1);
      });

      // Group collaborators by customer
      const collaboratorsByCustomer = new Map<
        string,
        Array<{
          id: string;
          broker_id: string;
          broker_name: string;
          role: "owner" | "partner";
          access_level: "full" | "view_only";
          active: boolean;
        }>
      >();
      collaboratorsData?.forEach((collab: any) => {
        const customerId = collab.customer_id;
        const brokerName = `${collab.brokers.first_name} ${collab.brokers.last_name || ""
          }`.trim();
        if (!collaboratorsByCustomer.has(customerId)) {
          collaboratorsByCustomer.set(customerId, []);
        }
        collaboratorsByCustomer.get(customerId)!.push({
          id: collab.id,
          broker_id: collab.broker_id,
          broker_name: brokerName,
          role: collab.role,
          access_level: collab.access_level,
          active: collab.active,
        });
      });

      // Combine customers with their TMS references, note counts, and collaborators
      const customersWithRefs = customersData.map((customer) => ({
        ...customer,
        tms_references:
          tmsData?.filter((ref) => ref.customer_id === customer.id) || [],
        note_count: noteCounts.get(customer.id) || 0,
        collaborators: collaboratorsByCustomer.get(customer.id) || [],
      }));

      setCustomers(customersWithRefs as Customer[]);
    } catch (error) {
      console.error("Unexpected error in fetchCustomers:", error);
      setCustomers([]);
    }
  };

  const handlePinCustomer = async (customerId: string) => {
    const supabase = createClient();
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    const newPinState = !customer.is_pinned;

    // Calculate next pin_order if pinning (find max + 1)
    let pinOrder: number | null = null;
    if (newPinState) {
      const maxPinOrder = Math.max(
        0,
        ...customers
          .filter((c) => c.is_pinned && c.pin_order)
          .map((c) => c.pin_order as number),
      );
      pinOrder = maxPinOrder + 1;
    }

    const { error } = await supabase
      .from("customers")
      .update({
        is_pinned: newPinState,
        pin_order: pinOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);

    if (error) {
      console.error("Error updating pin state:", error);
      return;
    }

    // Update local state
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customerId
          ? {
            ...c,
            is_pinned: newPinState,
            pin_order: pinOrder,
          }
          : c,
      ),
    );
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowCustomerModal(true);
  };

  const handleQuickAction = async (
    action: "call" | "email" | "schedule" | "notes",
    customer: Customer,
  ) => {
    const { copyEmail } = await import("@/lib/clipboard-utils");

    if (action === "call" && customer.phone) {
      makeCall(customer.phone, customer.id);
    } else if (action === "email" && customer.email) {
      await copyEmail(customer.email);
    } else if (action === "schedule") {
      setTaskCustomer(customer);
      setShowTaskModal(true);
    }
  };

  const handleAddNote = async (
    customerId: string,
    note: string,
    followUpDate?: string,
    followUpType?: "call" | "email" | "online_meeting" | "follow_up",
  ) => {
    const supabase = createClient();

    // Update customer with follow-up info
    if (followUpDate) {
      const { error } = await supabase
        .from("customers")
        .update({
          next_follow_up_date: followUpDate,
          next_follow_up_type: followUpType || "follow_up",
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId);

      if (error) {
        console.error("Error updating follow-up:", error);
        return;
      }

      // Update local state
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customerId
            ? {
              ...c,
              next_follow_up_date: followUpDate,
              next_follow_up_type:
                followUpType || c.next_follow_up_type || "follow_up",
            }
            : c,
        ),
      );
    }

    // Add note to contact log
    if (note.trim()) {
      const { error: logError } = await supabase.from("contact_log").insert({
        broker_id: currentBrokerId,
        customer_id: customerId,
        type: "note",
        subject: "Quick Note",
        notes: note,
        contact_date: new Date().toISOString(),
      });

      if (logError) {
        console.error("Error adding note:", logError);
      }
    }
  };

  const handleAddCustomer = () => {
    setEditingCustomer(null);
    setShowCustomerModal(true);
  };

  const handleSaveCustomer = async (
    customerData: Partial<Customer> & { tms_references?: TmsReference[] },
  ): Promise<Customer> => {
    const supabase = createClient();

    // Sanitize data: remove tms_references as it's handled separately
    const { tms_references, ...cleanCustomerData } = customerData;

    // Convert empty strings to null for optional fields
    const sanitizedData: any = { ...cleanCustomerData };
    Object.keys(sanitizedData).forEach((key) => {
      if (sanitizedData[key] === "") {
        sanitizedData[key] = null;
      }
    });

    if (editingCustomer) {
      // If the form changed the status text, clear status_id so the
      // `sync_customer_status_fields` trigger re-resolves it from the new name
      // (otherwise the trigger reverts our new status text to the old one).
      const statusChanged =
        typeof sanitizedData.status === "string" &&
        sanitizedData.status.trim().toLowerCase() !==
          (editingCustomer.status ?? "").trim().toLowerCase();
      if (statusChanged) {
        sanitizedData.status_id = null;
      }

      // Update existing customer
      const { data, error } = await supabase
        .from("customers")
        .update({
          ...sanitizedData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingCustomer.id)
        .select()
        .single();

      if (error || !data) {
        console.error("Error updating customer:", error);
        throw new Error(error?.message || "Failed to update customer");
      }

      // Handle TMS references for existing customer
      if (tms_references) {
        // Delete existing references
        await supabase
          .from("tms_references")
          .delete()
          .eq("customer_id", editingCustomer.id);

        // Insert new references
        if (tms_references.length > 0) {
          const refsToInsert = tms_references.map((ref: TmsReference) => ({
            customer_id: editingCustomer.id,
            broker_id: currentBrokerId,
            type: ref.type,
            external_id: ref.external_id,
            label: ref.label || null,
          }));

          const { error: refError } = await supabase
            .from("tms_references")
            .insert(refsToInsert);

          if (refError) {
            console.error("Error updating TMS references:", refError);
          }
        }
      }

      // Return the updated customer
      return data;
    } else {
      // Create new customer
      // Note: customer_id is auto-generated by database trigger using sequence
      // Explicitly remove customer_id from sanitizedData to let the trigger handle it
      const { customer_id, ...dataWithoutCustomerId } = sanitizedData as any;

      const newCustomer = {
        ...dataWithoutCustomerId,
        // customer_id will be auto-generated by database trigger (don't include it here)
        broker_id: viewingBroker?.id || currentBrokerId, // Use viewed broker when admin/manager adds on their behalf
        is_pinned: false,
        on_kanban_board: true, // New customers appear in both kanban and list view
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("customers")
        .insert(newCustomer)
        .select()
        .single();

      if (error) {
        console.error("Error creating customer:", error);
        throw new Error(error.message || "Failed to create customer");
      }

      // Insert TMS references for new customer
      if (tms_references && tms_references.length > 0 && data) {
        const refsToInsert = tms_references.map((ref: TmsReference) => ({
          customer_id: data.id,
          broker_id: viewingBroker?.id || currentBrokerId, // Match the customer's broker
          type: ref.type,
          external_id: ref.external_id,
          label: ref.label || null,
        }));

        const { error: refError } = await supabase
          .from("tms_references")
          .insert(refsToInsert);

        if (refError) {
          console.error("Error creating TMS references:", refError);
        }
      }

      // Return the newly created customer
      return data;
    }

    // Refresh customers list using the active broker ID (current or viewing)
    await fetchCustomers(activeBrokerId || currentBrokerId);
  };

  const handleStatusChange = async (
    customerId: string,
    newStatusId: string,
  ) => {
    const supabase = createClient();
    const normalizedStatus = normalizeStatusName(newStatusId);

    // IMPORTANT: customers has a BEFORE UPDATE trigger (`sync_customer_status_fields`)
    // that treats `status_id` as the source of truth.  If we only update `status`
    // (text), the trigger reads the still-old `status_id`, looks up its name, and
    // overwrites our new `status` back to the old value — making drag-and-drop
    // appear to do nothing after a refresh.  Clearing `status_id` here forces the
    // trigger to fall through to the "resolve by name" branch, which sets both
    // `status` and `status_id` to the new column's canonical values.
    const { data, error } = await supabase
      .from("customers")
      .update({
        status: normalizedStatus,
        status_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId)
      .select();

    if (error) {
      console.error("Error updating customer status:", error);
      return;
    }

    // Update local state
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customerId ? { ...c, status: normalizedStatus } : c,
      ),
    );
  };

  const handleStatusRenamed = (oldName: string, newName: string) => {
    const normalizedOldName = normalizeStatusName(oldName);
    const normalizedNewName = normalizeStatusName(newName);
    setCustomers((prev) =>
      prev.map((c) =>
        c.status.trim().toLowerCase() === normalizedOldName.toLowerCase()
          ? { ...c, status: normalizedNewName }
          : c,
      ),
    );
  };

  const handleAddTask = (date: Date) => {
    console.log("Schedule task for date:", date.toLocaleDateString());
  };

  const handleAddToBoard = async (customerId: string) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("customers")
      .update({
        on_kanban_board: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);

    if (error) {
      console.error("Error adding to board:", error);
      return;
    }

    // Update local state
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customerId ? { ...c, on_kanban_board: true } : c,
      ),
    );
  };

  const handleRemoveFromBoard = async (customerId: string) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("customers")
      .update({
        on_kanban_board: false,
        is_pinned: false, // Also unpin when removing from board
        pin_order: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);

    if (error) {
      console.error("Error removing from board:", error);
      return;
    }

    // Update local state
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customerId
          ? { ...c, on_kanban_board: false, is_pinned: false, pin_order: null }
          : c,
      ),
    );
  };

  // Check if current user can reassign customers
  const canReassign = currentBroker?.is_admin || currentBroker?.is_manager;

  // The effective broker ID for new records (viewed broker when admin/manager is viewing)
  const activeBrokerIdForNew = viewingBroker?.id || currentBrokerId;

  return {
    customers,
    currentBrokerId,
    activeBrokerIdForNew,
    currentBroker,
    viewingBroker,
    canReassign: Boolean(canReassign),
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
    handleAddTask,
    handleAddToBoard,
    handleRemoveFromBoard,
  };
}
