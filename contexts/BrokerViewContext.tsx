"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BrokerPermissions,
  Broker,
  canViewBroker,
  canEditCustomer,
  canManageUsers,
  canManageStatuses,
  canViewAnalytics,
  canExportData,
  canEditTask,
  getViewableBrokerIds,
  createFallbackPermissions,
} from "@/lib/permissions";

interface BrokerViewContextType {
  // Current logged-in broker
  currentBroker: Broker | null;

  // Broker being viewed (can be different from currentBroker)
  viewingBroker: Broker | null;
  setViewingBroker: (broker: Broker | null) => void;

  // Permissions for current broker
  permissions: BrokerPermissions | null;

  // List of brokers current user can view
  viewableBrokers: Broker[];

  // Loading states
  loading: boolean;
  permissionsLoading: boolean;

  // Helper methods
  canViewBrokerData: (targetBroker: Broker) => boolean;
  canEditCustomerData: (
    customerBrokerId: string,
    customerOffice: string | null,
  ) => boolean;
  canManageUsersData: () => boolean;
  canManageStatusesData: () => boolean;
  canViewAnalyticsData: () => boolean;
  canExportDataData: () => boolean;
  canEditTaskData: (taskBrokerId: string, taskOffice: string | null) => boolean;

  // Reset to viewing own data
  resetView: () => void;
}

const BrokerViewContext = createContext<BrokerViewContextType | undefined>(
  undefined,
);

export function BrokerViewProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();

  const [currentBroker, setCurrentBroker] = useState<Broker | null>(null);
  const [viewingBroker, setViewingBroker] = useState<Broker | null>(null);
  const [permissions, setPermissions] = useState<BrokerPermissions | null>(
    null,
  );
  const [viewableBrokers, setViewableBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  // Load current broker data
  useEffect(() => {
    const loadCurrentBroker = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: broker, error } = await supabase
          .from("brokers")
          .select(
            "id, email, first_name, last_name, office_location, is_admin, is_manager, is_sales_coach, is_remote, is_active",
          )
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error loading broker:", error);
          setLoading(false);
          return;
        }

        setCurrentBroker(broker);
        setViewingBroker(broker); // Default to viewing own data
      } catch (error) {
        console.error("Error in loadCurrentBroker:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCurrentBroker();
  }, [supabase]);

  // Load permissions for current broker
  useEffect(() => {
    if (!currentBroker) {
      setPermissionsLoading(false);
      return;
    }

    const loadPermissions = async () => {
      try {
        const { data, error } = await supabase
          .from("broker_permissions")
          .select("*")
          .eq("broker_id", currentBroker.id)
          .single();

        if (error) {
          console.warn(
            "⚠️ broker_permissions table may not exist yet. Run the migration:",
            error.message,
          );
          console.info(
            "💡 To create the table, run: supabase/create-broker-permissions.sql",
          );
          // Use centralized role-based fallback permissions
          setPermissions(createFallbackPermissions(currentBroker));
          setPermissionsLoading(false);
          return;
        }

        setPermissions(data);
      } catch (error) {
        console.error("Error in loadPermissions:", error);
      } finally {
        setPermissionsLoading(false);
      }
    };

    loadPermissions();
  }, [currentBroker, supabase]);

  // Load viewable brokers
  useEffect(() => {
    if (!currentBroker || !permissions) return;

    const loadViewableBrokers = async () => {
      try {
        // Load all brokers if admin or can view all
        let query = supabase
          .from("brokers")
          .select(
            "id, email, first_name, last_name, office_location, is_admin, is_manager, is_sales_coach, is_remote, is_active",
          )
          .order("first_name");

        // Filter by office if only office viewing permission
        if (
          !permissions.can_view_all_brokers &&
          permissions.can_view_office_brokers &&
          currentBroker.office_location
        ) {
          query = query.eq("office_location", currentBroker.office_location);
        }

        const { data: brokers, error } = await query;

        if (error) {
          console.error("Error loading viewable brokers:", error);
          return;
        }

        if (!brokers) return;

        // Filter brokers based on permissions
        // Regular users (non-admin/non-manager) should not see deactivated brokers
        // Admins and managers can see deactivated brokers (for reassignment, etc.)
        const isElevatedRole =
          currentBroker.is_admin ||
          currentBroker.is_manager ||
          currentBroker.is_sales_coach;
        const filteredBrokers = brokers.filter(
          (broker) =>
            canViewBroker(permissions, currentBroker, broker) &&
            (isElevatedRole || broker.is_active !== false), // Regular users don't see deactivated brokers
        );

        setViewableBrokers(filteredBrokers);
      } catch (error) {
        console.error("Error in loadViewableBrokers:", error);
      }
    };

    loadViewableBrokers();

    // Real-time subscription for broker changes
    const channel = supabase
      .channel('brokers-changes')
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "brokers",
        },
        async (payload) => {
          console.log("Real-time broker change:", payload);

          // Reload viewable brokers
          await loadViewableBrokers();

          // If the current broker was updated, reload current broker data
          if (payload.new && (payload.new as any).id === currentBroker.id) {
            setCurrentBroker(payload.new as Broker);
          }

          // If viewing another broker and they were updated, update viewing broker
          if (viewingBroker && payload.new && (payload.new as any).id === viewingBroker.id) {
            setViewingBroker(payload.new as Broker);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentBroker, permissions, viewingBroker, supabase]);

  const canViewBrokerData = (targetBroker: Broker) => {
    if (!currentBroker || !permissions) return false;
    return canViewBroker(permissions, currentBroker, targetBroker);
  };

  const canEditCustomerData = (
    customerBrokerId: string,
    customerOffice: string | null,
  ) => {
    if (!currentBroker || !permissions) return false;
    return canEditCustomer(
      permissions,
      currentBroker,
      customerBrokerId,
      customerOffice,
    );
  };

  const canManageUsersData = () => {
    if (!currentBroker || !permissions) return false;
    return canManageUsers(permissions, currentBroker);
  };

  const canManageStatusesData = () => {
    if (!currentBroker || !permissions) return false;
    return canManageStatuses(permissions, currentBroker);
  };

  const canViewAnalyticsData = () => {
    if (!currentBroker || !permissions) return false;
    return canViewAnalytics(permissions, currentBroker);
  };

  const canExportDataData = () => {
    if (!currentBroker || !permissions) return false;
    return canExportData(permissions, currentBroker);
  };

  const canEditTaskData = (taskBrokerId: string, taskOffice: string | null) => {
    if (!currentBroker || !permissions) return false;
    return canEditTask(permissions, currentBroker, taskBrokerId, taskOffice);
  };

  const resetView = () => {
    setViewingBroker(currentBroker);
  };

  const value: BrokerViewContextType = {
    currentBroker,
    viewingBroker,
    setViewingBroker,
    permissions,
    viewableBrokers,
    loading,
    permissionsLoading,
    canViewBrokerData,
    canEditCustomerData,
    canManageUsersData,
    canManageStatusesData,
    canViewAnalyticsData,
    canExportDataData,
    canEditTaskData,
    resetView,
  };

  return (
    <BrokerViewContext.Provider value={value}>
      {children}
    </BrokerViewContext.Provider>
  );
}

export function useBrokerView() {
  const context = useContext(BrokerViewContext);
  if (context === undefined) {
    throw new Error("useBrokerView must be used within a BrokerViewProvider");
  }
  return context;
}

// Convenience hook for permissions only
export function usePermissions() {
  const {
    permissions,
    currentBroker,
    permissionsLoading,
    canViewBrokerData,
    canEditCustomerData,
    canManageUsersData,
    canManageStatusesData,
    canViewAnalyticsData,
    canExportDataData,
    canEditTaskData,
  } = useBrokerView();

  return {
    permissions,
    currentBroker,
    permissionsLoading,
    canViewBroker: canViewBrokerData,
    canEditCustomer: canEditCustomerData,
    canManageUsers: canManageUsersData,
    canManageStatuses: canManageStatusesData,
    canViewAnalytics: canViewAnalyticsData,
    canExportData: canExportDataData,
    canEditTask: canEditTaskData,
  };
}
