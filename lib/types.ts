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
export type TeamMember = Database["public"]["Tables"]["team_members"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type EmailConfig = Database["public"]["Tables"]["email_config"]["Row"];

// ---------------------------------------------------------------------------
// Claims domain
// ---------------------------------------------------------------------------
export type Claim = Database["public"]["Tables"]["claims"]["Row"];
export type ClaimStatus =
  Database["public"]["Tables"]["claim_statuses"]["Row"];
export type ClaimParty =
  Database["public"]["Tables"]["claim_parties"]["Row"];
export type Company = Database["public"]["Tables"]["companies"]["Row"];

export type ClaimIntakeSource =
  Database["public"]["Enums"]["claim_intake_source"];
export type ClaimValueBucket =
  Database["public"]["Enums"]["claim_value_bucket"];
export type ClaimPartyRole = Database["public"]["Enums"]["claim_party_role"];
export type ClaimResolution = Database["public"]["Enums"]["claim_resolution"];

/**
 * A claim with its joined parties, owning profile, and broker — the shape
 * the kanban board and list views consume.
 */
export type ClaimWithDetails = Claim & {
  status: Pick<
    ClaimStatus,
    "id" | "name" | "color" | "position" | "is_inbox" | "is_closed" | "is_denied"
  > | null;
  parties: Array<
    Pick<
      ClaimParty,
      | "id"
      | "role"
      | "contact_name"
      | "contact_email"
      | "contact_phone"
      | "acknowledged_at"
      | "last_response_at"
    > & {
      company: Pick<
        Company,
        "id" | "legal_name" | "dba_name" | "primary_phone" | "primary_email" | "has_active_hold"
      > | null;
    }
  >;
  owner: Pick<
    Database["public"]["Tables"]["profiles"]["Row"],
    "id" | "first_name" | "last_name" | "email"
  > | null;
};
