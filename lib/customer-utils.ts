/**
 * Customer utility functions
 */

import type { Customer } from "./types";

/**
 * Get the display name for a customer
 * Priority: first_name + last_name > contact_name > business_name
 */
export function getCustomerDisplayName(customer: Pick<Customer, 'first_name' | 'last_name' | 'contact_name' | 'business_name'>): string {
  // If we have first_name or last_name, use those
  if (customer.first_name || customer.last_name) {
    const parts = [customer.first_name, customer.last_name].filter(Boolean);
    return parts.join(' ') || customer.business_name || "";
  }
  
  // Fall back to contact_name (legacy data)
  if (customer.contact_name) {
    return customer.contact_name;
  }
  
  // Last resort: business name or empty string
  return customer.business_name || "";
}

/**
 * Parse a full name string into first and last name components
 * Used when migrating legacy contact_name data
 */
export function parseFullName(fullName: string): { first_name: string; last_name: string | null } {
  if (!fullName || !fullName.trim()) {
    return { first_name: '', last_name: null };
  }
  
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/); // Split on whitespace
  
  if (parts.length === 0) {
    return { first_name: '', last_name: null };
  }
  
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: null };
  }
  
  // First word is first name, rest is last name
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  
  return { first_name: firstName, last_name: lastName };
}
