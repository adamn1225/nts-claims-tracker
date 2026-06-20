/**
 * Type Aliases for Database Tables
 *
 * These are convenience exports that map to the auto-generated types in database.types.ts
 * This provides backward compatibility and cleaner imports throughout the app.
 *
 * IMPORTANT: This file should NOT be manually edited except to add new type aliases.
 * The source of truth is lib/database.types.ts which is auto-generated from Supabase.
 *
 * To regenerate database types after schema changes:
 * npm run db:types
 */

import { Database } from "./database.types";

// Table Row types (for reading data)
export type Broker = Database["public"]["Tables"]["brokers"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"] & {
  note_count?: number; // Computed field from joins/aggregations
  on_kanban_board?: boolean; // TODO: Remove after running db:types - added in migration add-kanban-board-field.sql
  import_source?: string | null; // TODO: Remove after running db:types - added in migration add-import-source-column.sql
  collaborators?: Array<{
    id: string;
    broker_id: string;
    broker_name: string;
    role: "owner" | "partner";
    access_level: "full" | "view_only";
    active: boolean;
  }>; // Team members on this customer
};
export type CustomerStatus =
  Database["public"]["Tables"]["customer_statuses"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"] & {
  // TODO: Remove after running db:types - added in migration add-task-completion-tracking.sql
  completion_outcome?: string | null;
  completion_notes?: string | null;
  follow_up_task_id?: string | null;
};
export type ContactLog = Database["public"]["Tables"]["contact_log"]["Row"];
export type TmsReference =
  Database["public"]["Tables"]["tms_references"]["Row"];
export type BrokerPermissions =
  Database["public"]["Tables"]["broker_permissions"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type EmailConfig = Database["public"]["Tables"]["email_config"]["Row"];

// Enums (extracted from database types)
export type TaskType = Database["public"]["Enums"]["task_type_enum"];
export type TaskPriority = "critical" | "urgent" | "high" | "medium" | "low";
export type TaskStatus = "pending" | "completed" | "overdue" | "cancelled";
export type ContactLogType = string; // Not an enum in database
export type TmsReferenceType =
  Database["public"]["Enums"]["tms_reference_type"];
export type ShippingFrequency = string; // Not an enum in database
export type OpportunityType =
  | "New Call In"
  | "New Lead"
  | "Cold Call"
  | "Referral"
  | "Website"
  | "Repeat Customer"
  | "Other";
