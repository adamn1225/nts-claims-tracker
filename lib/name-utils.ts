/**
 * Smart Name Parsing Utility
 * 
 * Handles the hybrid approach for name data:
 * - Database stores: first_name, last_name (normalized)
 * - Imports often have: single "Full Name" field
 * - This utility intelligently parses and handles both cases
 * 
 * Strategy:
 * 1. Accept single-field OR two-field names
 * 2. Parse single field into first/last intelligently
 * 3. Store parsed values in first_name/last_name (primary)
 * 4. Keep original in contact_name as backup/reference
 */

export interface ParsedName {
  first_name: string;
  last_name: string | null;
  contact_name: string; // Original full name as entered/imported
}

/**
 * Parse a full name string into first and last name components
 * 
 * Examples:
 * - "John Smith" → first="John", last="Smith"
 * - "John Robert Smith" → first="John Robert", last="Smith"
 * - "Smith, John" → first="John", last="Smith"
 * - "Dr. John Smith Jr." → first="John", last="Smith" (strips titles/suffixes)
 * - "John" → first="John", last=null
 */
export function parseFullName(fullName: string): ParsedName {
  // Trim whitespace
  const cleaned = fullName.trim();
  
  if (!cleaned) {
    return {
      first_name: '',
      last_name: null,
      contact_name: fullName,
    };
  }

  // Common titles and suffixes to remove
  const titles = ['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'rev'];
  const suffixes = ['jr', 'sr', 'ii', 'iii', 'iv', 'esq', 'phd', 'md'];
  
  // Split by comma first (handles "Last, First" format)
  if (cleaned.includes(',')) {
    const [lastPart, firstPart] = cleaned.split(',').map(s => s.trim());
    const first = cleanNamePart(firstPart, titles, suffixes);
    const last = cleanNamePart(lastPart, titles, suffixes);
    
    return {
      first_name: first || cleaned,
      last_name: last || null,
      contact_name: cleaned,
    };
  }

  // Split by whitespace
  const parts = cleaned.split(/\s+/).filter(Boolean);
  
  // Single name only (e.g., "Madonna", "Prince")
  if (parts.length === 1) {
    return {
      first_name: parts[0],
      last_name: null,
      contact_name: cleaned,
    };
  }

  // Remove titles from beginning
  while (parts.length > 0 && titles.includes(parts[0].toLowerCase().replace('.', ''))) {
    parts.shift();
  }

  // Remove suffixes from end
  while (parts.length > 0 && suffixes.includes(parts[parts.length - 1].toLowerCase().replace('.', ''))) {
    parts.pop();
  }

  // Edge case: all parts were removed
  if (parts.length === 0) {
    return {
      first_name: cleaned,
      last_name: null,
      contact_name: cleaned,
    };
  }

  // Standard case: Last part is last name, everything else is first name
  const lastName = parts.pop()!;
  const firstName = parts.join(' ');

  return {
    first_name: firstName || cleaned,
    last_name: lastName || null,
    contact_name: cleaned,
  };
}

/**
 * Clean a name part by removing titles/suffixes
 */
function cleanNamePart(part: string, titles: string[], suffixes: string[]): string {
  const words = part.split(/\s+/).filter(Boolean);
  
  // Remove titles from beginning
  while (words.length > 0 && titles.includes(words[0].toLowerCase().replace('.', ''))) {
    words.shift();
  }

  // Remove suffixes from end
  while (words.length > 0 && suffixes.includes(words[words.length - 1].toLowerCase().replace('.', ''))) {
    words.pop();
  }

  return words.join(' ');
}

/**
 * Combine first and last name into a full name
 * Handles null/undefined gracefully
 */
export function combineNames(firstName: string | null, lastName: string | null): string {
  const parts = [firstName, lastName].filter(Boolean);
  return parts.join(' ').trim();
}

/**
 * Smart name handler for imports and manual entry
 * 
 * Use this when processing CSV imports or form submissions
 * Returns normalized data ready for database insert
 */
export function processNameData(data: {
  contact_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): {
  contact_name: string | null;
  first_name: string;
  last_name: string | null;
} {
  // Case 1: Both first_name and last_name provided (manual entry)
  if (data.first_name && data.last_name) {
    return {
      contact_name: combineNames(data.first_name, data.last_name) || null,
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
    };
  }

  // Case 2: Only first_name provided
  if (data.first_name && !data.last_name) {
    return {
      contact_name: data.first_name.trim(),
      first_name: data.first_name.trim(),
      last_name: null,
    };
  }

  // Case 3: contact_name provided (import with single name field)
  if (data.contact_name) {
    const parsed = parseFullName(data.contact_name);
    return {
      contact_name: parsed.contact_name,
      first_name: parsed.first_name,
      last_name: parsed.last_name,
    };
  }

  // Case 4: No name data provided
  return {
    contact_name: null,
    first_name: '',
    last_name: null,
  };
}

/**
 * Extract display name from customer data
 * Priority: business_name > full name > email
 */
export function getCustomerDisplayName(customer: {
  business_name?: string | null;
  contact_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): string {
  if (customer.business_name) return customer.business_name;
  
  const fullName = combineNames(customer.first_name || null, customer.last_name || null);
  if (fullName) return fullName;
  
  if (customer.contact_name) return customer.contact_name;
  
  if (customer.email) return customer.email.split('@')[0];
  
  return 'Unknown';
}
