/**
 * API Token Utilities
 * Handles token generation, hashing, validation, and scope checking
 */

import crypto from "crypto";

// Token format: nts_live_<32 random bytes in base64url>
// Example: nts_live_AbCd1234EfGh5678IjKl9012MnOp3456
const TOKEN_PREFIX = "nts_live_";
const TOKEN_LENGTH = 32; // bytes of random data

/**
 * Available API scopes (table-level CRUD)
 */
export const API_SCOPES = [
  // Customers
  "customers:read",
  "customers:write",
  "customers:create",
  "customers:delete",
  // Tasks
  "tasks:read",
  "tasks:write",
  "tasks:create",
  "tasks:delete",
  // Unassigned Contacts (imports table)
  "unassigned_contacts:read",
  "unassigned_contacts:write",
  "unassigned_contacts:create",
  "unassigned_contacts:delete",
  // TeamMembers
  "team_members:read",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

/**
 * Scope presets for quick token creation
 */
export const SCOPE_PRESETS = {
  readonly: [
    "customers:read",
    "tasks:read",
    "unassigned_contacts:read",
  ] as ApiScope[],
  readwrite: [
    "customers:read",
    "customers:write",
    "customers:create",
    "tasks:read",
    "tasks:write",
    "tasks:create",
    "unassigned_contacts:read",
    "unassigned_contacts:write",
    "unassigned_contacts:create",
    "team_members:read",
  ] as ApiScope[],
  admin: [...API_SCOPES] as ApiScope[],
};

/**
 * Generate a new API token
 * Returns: { token, tokenHash, tokenPrefix }
 */
export function generateApiToken(): {
  token: string;
  tokenHash: string;
  tokenPrefix: string;
} {
  // Generate random bytes
  const randomBytes = crypto.randomBytes(TOKEN_LENGTH);
  
  // Convert to base64url (URL-safe base64)
  const base64url = randomBytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  
  // Construct full token
  const token = TOKEN_PREFIX + base64url;
  
  // Hash for storage (SHA-256)
  const tokenHash = hashToken(token);
  
  // Get prefix for display (first 16 chars of token)
  const tokenPrefix = token.substring(0, 16);
  
  return { token, tokenHash, tokenPrefix };
}

/**
 * Hash a token using SHA-256
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Validate token format
 */
export function isValidTokenFormat(token: string): boolean {
  if (!token.startsWith(TOKEN_PREFIX)) {
    return false;
  }
  
  // Check length (prefix + base64url data)
  const expectedLength = TOKEN_PREFIX.length + Math.ceil((TOKEN_LENGTH * 4) / 3);
  return token.length >= expectedLength - 2 && token.length <= expectedLength + 2;
}

/**
 * Parse scope string into table and action
 * Example: "customers:read" -> { table: "customers", action: "read" }
 */
export function parseScope(scope: string): {
  table: string;
  action: "read" | "write" | "create" | "delete";
} | null {
  const parts = scope.split(":");
  if (parts.length !== 2) return null;
  
  const [table, action] = parts;
  if (!["read", "write", "create", "delete"].includes(action)) {
    return null;
  }
  
  return { table, action: action as "read" | "write" | "create" | "delete" };
}

/**
 * Check if token has required scope
 */
export function hasScope(
  tokenScopes: string[],
  requiredScope: string | string[],
): boolean {
  const required = Array.isArray(requiredScope) ? requiredScope : [requiredScope];
  
  // Check if token has at least one of the required scopes
  return required.some((scope) => tokenScopes.includes(scope));
}

/**
 * Check if token can perform action on table
 */
export function canPerformAction(
  tokenScopes: string[],
  table: string,
  action: "read" | "write" | "create" | "delete",
): boolean {
  const requiredScope = `${table}:${action}`;
  
  // For write operations, check if token has write OR create/delete
  if (action === "write") {
    return (
      tokenScopes.includes(requiredScope) ||
      tokenScopes.includes(`${table}:create`) ||
      tokenScopes.includes(`${table}:delete`)
    );
  }
  
  return tokenScopes.includes(requiredScope);
}

/**
 * Validate scopes array
 */
export function validateScopes(scopes: string[]): {
  valid: boolean;
  invalidScopes?: string[];
} {
  const invalidScopes = scopes.filter(
    (scope) => !API_SCOPES.includes(scope as ApiScope),
  );
  
  return {
    valid: invalidScopes.length === 0,
    invalidScopes: invalidScopes.length > 0 ? invalidScopes : undefined,
  };
}

/**
 * Get human-readable description of a scope
 */
export function getScopeDescription(scope: string): string {
  const parsed = parseScope(scope);
  if (!parsed) return scope;
  
  const { table, action } = parsed;
  
  // Prettify table name
  const tableName = table
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  
  // Action descriptions
  const actionDesc: Record<string, string> = {
    read: "View",
    write: "Edit",
    create: "Create",
    delete: "Delete",
  };
  
  return `${actionDesc[action]} ${tableName}`;
}

/**
 * Group scopes by table for UI display
 */
export function groupScopesByTable(scopes: string[]): Record<
  string,
  Array<"read" | "write" | "create" | "delete">
> {
  const grouped: Record<string, Array<"read" | "write" | "create" | "delete">> = {};
  
  for (const scope of scopes) {
    const parsed = parseScope(scope);
    if (!parsed) continue;
    
    const { table, action } = parsed;
    if (!grouped[table]) {
      grouped[table] = [];
    }
    grouped[table].push(action);
  }
  
  return grouped;
}
