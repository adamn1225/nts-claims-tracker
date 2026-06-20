/**
 * Email template token replacement utility
 * Replaces tokens like {{first_name}} with actual values
 */

interface TemplateTokens {
  first_name?: string;
  last_name?: string;
  company?: string;
  broker_name?: string;
  broker_phone?: string;
  broker_email?: string;
  lanes?: string;
  frequency?: string;
  next_steps?: string;
  [key: string]: string | undefined; // Allow custom tokens
}

/**
 * Replace tokens in a string with provided values
 * @param template - String with {{token}} placeholders
 * @param tokens - Object with token values
 * @returns Processed string with tokens replaced
 */
export function replaceTokens(
  template: string,
  tokens: TemplateTokens,
): string {
  let processed = template;

  // Replace each token
  Object.entries(tokens).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      processed = processed.replace(regex, value);
    }
  });

  // Remove any remaining unreplaced tokens (replace with empty string)
  processed = processed.replace(/\{\{[^}]+\}\}/g, "");

  return processed;
}

/**
 * Get available tokens from a broker's data
 */
export async function getBrokerTokens(
  brokerId: string,
  supabase: any,
): Promise<TemplateTokens> {
  const { data: broker } = await supabase
    .from("brokers")
    .select("first_name, last_name, email, phone")
    .eq("id", brokerId)
    .single();

  if (!broker) return {};

  return {
    broker_name: `${broker.first_name || ""} ${broker.last_name || ""}`.trim(),
    broker_phone: broker.phone || "",
    broker_email: broker.email || "",
  };
}

/**
 * Get customer-specific tokens
 */
export function getCustomerTokens(customer: any): TemplateTokens {
  return {
    first_name: customer.contact_name?.split(" ")[0] || "there",
    company: customer.business_name || "",
  };
}

/**
 * Merge multiple token sources
 */
export function mergeTokens(...tokenSources: TemplateTokens[]): TemplateTokens {
  return Object.assign({}, ...tokenSources);
}
