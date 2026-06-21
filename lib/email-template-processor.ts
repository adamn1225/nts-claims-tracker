/**
 * Email template token replacement utility
 * Replaces tokens like {{first_name}} with actual values
 */

interface TemplateTokens {
  first_name?: string;
  last_name?: string;
  company?: string;
  team_member_name?: string;
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
 * Get available tokens from a team member's data
 */
export async function getTeamMemberTokens(
  teamMemberId: string,
  supabase: any,
): Promise<TemplateTokens> {
  const { data: teamMember } = await supabase
    .from("team_members")
    .select("first_name, last_name, email, phone")
    .eq("id", teamMemberId)
    .single();

  if (!teamMember) return {};

  return {
    team_member_name: `${teamMember.first_name || ""} ${teamMember.last_name || ""}`.trim(),
    broker_phone: teamMember.phone || "",
    broker_email: teamMember.email || "",
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
