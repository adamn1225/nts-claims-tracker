/**
 * Permission helper functions and types
 * Centralized permission logic for the entire app
 */

export interface BrokerPermissions {
  id: string;
  broker_id: string;

  // View permissions
  can_view_all_brokers: boolean;
  can_view_office_brokers: boolean;
  can_view_all_customers: boolean;
  can_view_office_customers: boolean;

  // Edit permissions
  can_edit_own_customers: boolean;
  can_edit_office_customers: boolean;
  can_edit_all_customers: boolean;

  // Task permissions
  can_view_all_tasks: boolean;
  can_view_office_tasks: boolean;
  can_edit_own_tasks: boolean;
  can_edit_office_tasks: boolean;
  can_edit_all_tasks: boolean;

  // Management permissions
  can_manage_users: boolean;
  can_manage_statuses: boolean;
  can_manage_permissions: boolean;
  can_export_data: boolean;
  can_view_analytics: boolean;

  // Invite permissions (for managers)
  can_invite_brokers: boolean;
  can_invite_any_office: boolean;

  // Email & notification permissions
  can_manage_email_settings: boolean;
  can_send_email_broadcasts: boolean;
  can_use_ai_email: boolean;

  // Feature access permissions
  can_access_power_dialer: boolean;
  can_use_web_search: boolean;
  can_manage_team: boolean;

  created_at: string;
  updated_at: string;
}

export interface Broker {
  id: string;
  email: string;
  first_name: string;
  last_name?: string;
  office_location: string | null;
  is_admin: boolean | null;
  is_manager: boolean | null;
  is_sales_coach?: boolean | null;
  is_remote: boolean | null;
  is_active: boolean;
}

/**
 * Check if user can view a specific broker's data
 */
export function canViewBroker(
  permissions: BrokerPermissions,
  currentBroker: Broker,
  targetBroker: Broker,
): boolean {
  // Can always view own data
  if (currentBroker.id === targetBroker.id) return true;

  // Admin flag overrides permissions
  if (currentBroker.is_admin) return true;

  // Check granular permissions
  if (permissions.can_view_all_brokers) return true;

  // Can view brokers in same office
  if (
    permissions.can_view_office_brokers &&
    currentBroker.office_location &&
    currentBroker.office_location === targetBroker.office_location
  ) {
    return true;
  }

  return false;
}

/**
 * Check if user can edit a customer
 */
export function canEditCustomer(
  permissions: BrokerPermissions,
  currentBroker: Broker,
  customerBrokerId: string,
  customerOfficeLocation: string | null,
): boolean {
  // Admin flag overrides
  if (currentBroker.is_admin) return true;

  // Can edit all customers
  if (permissions.can_edit_all_customers) return true;

  // Can edit own customers
  if (
    permissions.can_edit_own_customers &&
    currentBroker.id === customerBrokerId
  ) {
    return true;
  }

  // Can edit office customers
  if (
    permissions.can_edit_office_customers &&
    currentBroker.office_location &&
    currentBroker.office_location === customerOfficeLocation
  ) {
    return true;
  }

  return false;
}

/**
 * Check if user can view a customer
 */
export function canViewCustomer(
  permissions: BrokerPermissions,
  currentBroker: Broker,
  customerBrokerId: string,
  customerOfficeLocation: string | null,
): boolean {
  // Admin flag overrides
  if (currentBroker.is_admin) return true;

  // Can view all customers
  if (permissions.can_view_all_customers) return true;

  // Can always view own customers
  if (currentBroker.id === customerBrokerId) return true;

  // Can view office customers
  if (
    permissions.can_view_office_customers &&
    currentBroker.office_location &&
    currentBroker.office_location === customerOfficeLocation
  ) {
    return true;
  }

  return false;
}

/**
 * Check if user can manage other users
 */
export function canManageUsers(
  permissions: BrokerPermissions,
  currentBroker: Broker,
): boolean {
  if (currentBroker.is_admin) return true;
  return permissions.can_manage_users;
}

/**
 * Check if user can manage custom statuses
 */
export function canManageStatuses(
  permissions: BrokerPermissions,
  currentBroker: Broker,
): boolean {
  if (currentBroker.is_admin) return true;
  return permissions.can_manage_statuses;
}

/**
 * Check if user can view analytics
 */
export function canViewAnalytics(
  permissions: BrokerPermissions,
  currentBroker: Broker,
): boolean {
  if (currentBroker.is_admin) return true;
  return permissions.can_view_analytics;
}

/**
 * Check if user can export data
 */
export function canExportData(
  permissions: BrokerPermissions,
  currentBroker: Broker,
): boolean {
  if (currentBroker.is_admin) return true;
  return permissions.can_export_data;
}

/**
 * Check if user can edit a task
 */
export function canEditTask(
  permissions: BrokerPermissions,
  currentBroker: Broker,
  taskBrokerId: string,
  taskOfficeLocation: string | null,
): boolean {
  // Admin flag overrides
  if (currentBroker.is_admin) return true;

  // Can edit all tasks
  if (permissions.can_edit_all_tasks) return true;

  // Can edit own tasks
  if (permissions.can_edit_own_tasks && currentBroker.id === taskBrokerId) {
    return true;
  }

  // Can edit office tasks
  if (
    permissions.can_edit_office_tasks &&
    currentBroker.office_location &&
    currentBroker.office_location === taskOfficeLocation
  ) {
    return true;
  }

  return false;
}

/**
 * Check if user can view a task
 */
export function canViewTask(
  permissions: BrokerPermissions,
  currentBroker: Broker,
  taskBrokerId: string,
  taskOfficeLocation: string | null,
): boolean {
  // Admin flag overrides
  if (currentBroker.is_admin) return true;

  // Can view all tasks
  if (permissions.can_view_all_tasks) return true;

  // Can always view own tasks
  if (currentBroker.id === taskBrokerId) return true;

  // Can view office tasks
  if (
    permissions.can_view_office_tasks &&
    currentBroker.office_location &&
    currentBroker.office_location === taskOfficeLocation
  ) {
    return true;
  }

  return false;
}

/**
 * Get list of broker IDs that the current user can view
 */
export function getViewableBrokerIds(
  permissions: BrokerPermissions,
  currentBroker: Broker,
  allBrokers: Broker[],
): string[] {
  // Always include own ID
  const viewableIds = new Set<string>([currentBroker.id]);

  for (const broker of allBrokers) {
    if (canViewBroker(permissions, currentBroker, broker)) {
      viewableIds.add(broker.id);
    }
  }

  return Array.from(viewableIds);
}

/**
 * Default permissions for new brokers
 */
export const DEFAULT_PERMISSIONS: Partial<BrokerPermissions> = {
  can_view_all_brokers: false,
  can_view_office_brokers: true,
  can_view_all_customers: false,
  can_view_office_customers: false,
  can_edit_own_customers: true,
  can_edit_office_customers: false,
  can_edit_all_customers: false,
  can_view_all_tasks: false,
  can_view_office_tasks: false,
  can_edit_own_tasks: true,
  can_edit_office_tasks: false,
  can_edit_all_tasks: false,
  can_manage_users: false,
  can_manage_statuses: false,
  can_manage_permissions: false,
  can_export_data: false,
  can_view_analytics: false,
  can_manage_email_settings: false,
  can_send_email_broadcasts: false,
};

/**
 * Manager permissions preset
 */
export const MANAGER_PERMISSIONS: Partial<BrokerPermissions> = {
  can_view_all_brokers: true,
  can_view_office_brokers: true,
  can_view_all_customers: false,
  can_view_office_customers: true,
  can_edit_own_customers: true,
  can_edit_office_customers: true,
  can_edit_all_customers: false,
  can_view_all_tasks: false,
  can_view_office_tasks: true,
  can_edit_own_tasks: true,
  can_edit_office_tasks: true,
  can_edit_all_tasks: false,
  can_manage_users: false,
  can_manage_statuses: false,
  can_manage_permissions: false,
  can_manage_email_settings: false,
  can_send_email_broadcasts: false,
  can_export_data: false,
  can_view_analytics: true,
};

/**
 * Admin permissions preset
 */
export const ADMIN_PERMISSIONS: Partial<BrokerPermissions> = {
  can_view_all_brokers: true,
  can_view_office_brokers: true,
  can_view_all_customers: true,
  can_view_office_customers: true,
  can_edit_own_customers: true,
  can_edit_office_customers: true,
  can_edit_all_customers: true,
  can_view_all_tasks: true,
  can_view_office_tasks: true,
  can_edit_own_tasks: true,
  can_edit_office_tasks: true,
  can_edit_all_tasks: true,
  can_manage_users: true,
  can_manage_statuses: true,
  can_manage_permissions: true,
  can_manage_email_settings: true,
  can_send_email_broadcasts: true,
  can_export_data: true,
  can_view_analytics: true,
};

/**
 * Sales Coach permissions preset
 * Baseline broker experience + approved coach tooling + company-wide visibility,
 * while keeping destructive/admin-governance capabilities disabled.
 */
export const SALES_COACH_PERMISSIONS: Partial<BrokerPermissions> = {
  can_view_all_brokers: true,
  can_view_office_brokers: true,
  can_view_all_customers: true,
  can_view_office_customers: true,
  can_edit_own_customers: true,
  can_edit_office_customers: false,
  can_edit_all_customers: false,
  can_view_all_tasks: true,
  can_view_office_tasks: true,
  can_edit_own_tasks: true,
  can_edit_office_tasks: false,
  can_edit_all_tasks: false,
  can_manage_users: false,
  can_manage_statuses: false,
  can_manage_permissions: false,
  can_manage_email_settings: true,
  can_send_email_broadcasts: false,
  can_export_data: false,
  can_view_analytics: true,
  can_invite_brokers: true,
  can_invite_any_office: true,
  can_use_ai_email: true,
  can_access_power_dialer: true,
  can_use_web_search: true,
  can_manage_team: false,
};

/**
 * Resolve role-based permission preset.
 */
export function getRolePermissionPreset(
  broker: Pick<Broker, "is_admin" | "is_manager" | "is_sales_coach">,
): Partial<BrokerPermissions> {
  if (broker.is_admin) return ADMIN_PERMISSIONS;
  if (broker.is_sales_coach) return SALES_COACH_PERMISSIONS;
  if (broker.is_manager) return MANAGER_PERMISSIONS;
  return DEFAULT_PERMISSIONS;
}

/**
 * Build a full fallback permissions object when broker_permissions rows are missing.
 */
export function createFallbackPermissions(broker: Broker): BrokerPermissions {
  const preset = getRolePermissionPreset(broker);

  return {
    id: "",
    broker_id: broker.id,
    can_view_all_brokers: false,
    can_view_office_brokers: true,
    can_view_all_customers: false,
    can_view_office_customers: false,
    can_edit_own_customers: true,
    can_edit_office_customers: false,
    can_edit_all_customers: false,
    can_view_all_tasks: false,
    can_view_office_tasks: false,
    can_edit_own_tasks: true,
    can_edit_office_tasks: false,
    can_edit_all_tasks: false,
    can_manage_users: false,
    can_manage_statuses: false,
    can_manage_permissions: false,
    can_export_data: false,
    can_view_analytics: false,
    can_invite_brokers: false,
    can_invite_any_office: false,
    can_manage_email_settings: false,
    can_send_email_broadcasts: false,
    can_use_ai_email: false,
    can_access_power_dialer: false,
    can_use_web_search: false,
    can_manage_team: false,
    ...preset,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
