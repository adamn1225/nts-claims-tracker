/**
 * POST /api/ai/suggest-reassignment
 *
 * AI-powered teamMember reassignment suggestions for admins.
 * Analyzes customer data, teamMember workload, geography, and industry to suggest
 * optimal teamMember assignments for selected customers.
 *
 * Request body:
 *   customerIds   string[]  — Array of customer UUIDs to analyze
 *
 * Response:
 *   {
 *     suggestions: Array<{
 *       customerId: string,
 *       customerName: string,
 *       currentTeamMember: string,
 *       recommendedTeamMember: string,
 *       reason: string,
 *       confidence: 'high' | 'medium' | 'low',
 *       alternativeTeamMembers: Array<{ teamMemberId: string, name: string, reason: string }>
 *     }>
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type TeamMemberProfile = {
  id: string;
  name: string;
  office_location: string | null;
  customer_count: number;
  active_tasks_count: number;
  states_coverage: string[];
  industries_coverage: string[];
  avg_customer_value: number;
};

type CustomerProfile = {
  id: string;
  business_name: string | null;
  contact_name: string | null;
  state: string | null;
  city: string | null;
  industry: string | null;
  status: string | null;
  shipping_frequency: string | null;
  estimated_value: number | null;
  current_broker_id: string | null;
  current_broker_name: string | null;
};

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin/manager
  const { data: teamMember } = await supabase
    .from("team_members")
    .select("is_admin, is_manager")
    .eq("id", user.id)
    .single();

  if (!teamMember?.is_admin && !teamMember?.is_manager) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let customerIds: string[];
  try {
    const body = await request.json();
    customerIds = body.customerIds;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
    return NextResponse.json({ error: "customerIds array is required" }, { status: 400 });
  }

  try {
    // Step 1: Gather customer data
    const { data: customers, error: customersError } = await supabase
      .from("customers")
      .select(`
        id,
        business_name,
        contact_name,
        state,
        city,
        industry,
        status,
        shipping_frequency,
        estimated_value,
        team_member_id,
        team member:team_members!customers_broker_id_fkey(first_name, last_name)
      `)
      .in("id", customerIds);

    if (customersError) throw customersError;

    if (!customers || customers.length === 0) {
      return NextResponse.json({ error: "No customers found" }, { status: 404 });
    }

    // Step 2: Gather all active team members with their profiles
    const { data: allTeamMembers, error: teamMembersError } = await supabase
      .from("team_members")
      .select("id, first_name, last_name, office_location, is_active")
      .eq("is_active", true);

    if (teamMembersError) throw teamMembersError;

    // Step 3: Build teamMember profiles with workload and expertise data
    const teamMemberProfiles: TeamMemberProfile[] = await Promise.all(
      (allTeamMembers || []).map(async (b) => {
        const { data: teamMemberCustomers } = await supabase
          .from("customers")
          .select("state, industry, estimated_value")
          .eq("team_member_id", b.id);

        const { data: activeTasks } = await supabase
          .from("tasks")
          .select("id")
          .eq("team_member_id", b.id)
          .eq("status", "pending");

        const states = [...new Set(teamMemberCustomers?.map((c) => c.state).filter(Boolean))];
        const industries = [...new Set(teamMemberCustomers?.map((c) => c.industry).filter(Boolean))];
        const avgValue = teamMemberCustomers?.length
          ? teamMemberCustomers.reduce((sum, c) => sum + (c.estimated_value || 0), 0) / teamMemberCustomers.length
          : 0;

        return {
          id: b.id,
          name: `${b.first_name} ${b.last_name}`,
          office_location: b.office_location,
          customer_count: teamMemberCustomers?.length || 0,
          active_tasks_count: activeTasks?.length || 0,
          states_coverage: states as string[],
          industries_coverage: industries as string[],
          avg_customer_value: avgValue,
        };
      })
    );

    // Step 4: Format customer profiles
    const customerProfiles: CustomerProfile[] = customers.map((c: any) => ({
      id: c.id,
      business_name: c.business_name,
      contact_name: c.contact_name,
      state: c.state,
      city: c.city,
      industry: c.industry,
      status: c.status,
      shipping_frequency: c.shipping_frequency,
      estimated_value: c.estimated_value,
      current_broker_id: c.team_member_id,
      current_broker_name: c.teamMember ? `${c.teamMember.first_name} ${c.teamMember.last_name}` : "Unassigned",
    }));

    // Step 5: Use AI to analyze and suggest reassignments
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an intelligent teamMember assignment system for a freight brokerage company.
Your goal is to suggest optimal teamMember assignments based on:
1. Geographic proximity (teamMembers in same office location as customer's state)
2. Industry expertise (team members who already handle similar industries)
3. Workload balance (avoid overloading teamMembers with too many customers)
4. Customer value (high-value customers to experienced teamMembers with capacity)
5. Shipping frequency (frequent shippers need teamMembers with more bandwidth)

For each customer, recommend the BEST teamMember and provide 1-2 alternatives.
Provide clear reasoning for each recommendation.
Confidence levels: high (perfect match), medium (good match), low (acceptable but suboptimal).`,
        },
        {
          role: "user",
          content: `Analyze these customers and suggest optimal teamMember assignments:

CUSTOMERS TO REASSIGN:
${JSON.stringify(customerProfiles, null, 2)}

AVAILABLE BROKERS:
${JSON.stringify(teamMemberProfiles, null, 2)}

For each customer, provide:
1. Recommended teamMember ID
2. Reason for recommendation
3. Confidence level (high/medium/low)
4. Up to 2 alternative teamMembers with reasons

Return a JSON array with this structure:
[
  {
    "customerId": "uuid",
    "recommendedTeamMemberId": "uuid",
    "reason": "Brief explanation",
    "confidence": "high|medium|low",
    "alternatives": [
      { "teamMemberId": "uuid", "reason": "Brief explanation" }
    ]
  }
]`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content || "{}");
    const rawSuggestions = aiResponse.suggestions || [];

    // Step 6: Format suggestions with teamMember names
    const suggestions = rawSuggestions.map((s: any) => {
      const customer = customerProfiles.find((c) => c.id === s.customerId);
      const recommendedTeamMember = teamMemberProfiles.find((b) => b.id === s.recommendedTeamMemberId);
      const alternatives = (s.alternatives || []).map((alt: any) => ({
        teamMemberId: alt.teamMemberId,
        name: teamMemberProfiles.find((b) => b.id === alt.teamMemberId)?.name || "Unknown",
        reason: alt.reason,
      }));

      return {
        customerId: s.customerId,
        customerName: customer?.business_name || customer?.contact_name || "Unknown",
        currentTeamMember: customer?.current_broker_name || "Unassigned",
        currentTeamMemberId: customer?.current_broker_id,
        recommendedTeamMember: recommendedTeamMember?.name || "Unknown",
        recommendedTeamMemberId: s.recommendedTeamMemberId,
        reason: s.reason,
        confidence: s.confidence,
        alternativeTeamMembers: alternatives,
      };
    });

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error("AI Reassignment Suggestion error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
