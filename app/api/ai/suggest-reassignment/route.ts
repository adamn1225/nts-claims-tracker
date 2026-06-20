/**
 * POST /api/ai/suggest-reassignment
 *
 * AI-powered broker reassignment suggestions for admins.
 * Analyzes customer data, broker workload, geography, and industry to suggest
 * optimal broker assignments for selected customers.
 *
 * Request body:
 *   customerIds   string[]  — Array of customer UUIDs to analyze
 *
 * Response:
 *   {
 *     suggestions: Array<{
 *       customerId: string,
 *       customerName: string,
 *       currentBroker: string,
 *       recommendedBroker: string,
 *       reason: string,
 *       confidence: 'high' | 'medium' | 'low',
 *       alternativeBrokers: Array<{ brokerId: string, name: string, reason: string }>
 *     }>
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type BrokerProfile = {
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
  const { data: broker } = await supabase
    .from("brokers")
    .select("is_admin, is_manager")
    .eq("id", user.id)
    .single();

  if (!broker?.is_admin && !broker?.is_manager) {
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
        broker_id,
        broker:brokers!customers_broker_id_fkey(first_name, last_name)
      `)
      .in("id", customerIds);

    if (customersError) throw customersError;

    if (!customers || customers.length === 0) {
      return NextResponse.json({ error: "No customers found" }, { status: 404 });
    }

    // Step 2: Gather all active brokers with their profiles
    const { data: allBrokers, error: brokersError } = await supabase
      .from("brokers")
      .select("id, first_name, last_name, office_location, is_active")
      .eq("is_active", true);

    if (brokersError) throw brokersError;

    // Step 3: Build broker profiles with workload and expertise data
    const brokerProfiles: BrokerProfile[] = await Promise.all(
      (allBrokers || []).map(async (b) => {
        const { data: brokerCustomers } = await supabase
          .from("customers")
          .select("state, industry, estimated_value")
          .eq("broker_id", b.id);

        const { data: activeTasks } = await supabase
          .from("tasks")
          .select("id")
          .eq("broker_id", b.id)
          .eq("status", "pending");

        const states = [...new Set(brokerCustomers?.map((c) => c.state).filter(Boolean))];
        const industries = [...new Set(brokerCustomers?.map((c) => c.industry).filter(Boolean))];
        const avgValue = brokerCustomers?.length
          ? brokerCustomers.reduce((sum, c) => sum + (c.estimated_value || 0), 0) / brokerCustomers.length
          : 0;

        return {
          id: b.id,
          name: `${b.first_name} ${b.last_name}`,
          office_location: b.office_location,
          customer_count: brokerCustomers?.length || 0,
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
      current_broker_id: c.broker_id,
      current_broker_name: c.broker ? `${c.broker.first_name} ${c.broker.last_name}` : "Unassigned",
    }));

    // Step 5: Use AI to analyze and suggest reassignments
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an intelligent broker assignment system for a freight brokerage company.
Your goal is to suggest optimal broker assignments based on:
1. Geographic proximity (brokers in same office location as customer's state)
2. Industry expertise (brokers who already handle similar industries)
3. Workload balance (avoid overloading brokers with too many customers)
4. Customer value (high-value customers to experienced brokers with capacity)
5. Shipping frequency (frequent shippers need brokers with more bandwidth)

For each customer, recommend the BEST broker and provide 1-2 alternatives.
Provide clear reasoning for each recommendation.
Confidence levels: high (perfect match), medium (good match), low (acceptable but suboptimal).`,
        },
        {
          role: "user",
          content: `Analyze these customers and suggest optimal broker assignments:

CUSTOMERS TO REASSIGN:
${JSON.stringify(customerProfiles, null, 2)}

AVAILABLE BROKERS:
${JSON.stringify(brokerProfiles, null, 2)}

For each customer, provide:
1. Recommended broker ID
2. Reason for recommendation
3. Confidence level (high/medium/low)
4. Up to 2 alternative brokers with reasons

Return a JSON array with this structure:
[
  {
    "customerId": "uuid",
    "recommendedBrokerId": "uuid",
    "reason": "Brief explanation",
    "confidence": "high|medium|low",
    "alternatives": [
      { "brokerId": "uuid", "reason": "Brief explanation" }
    ]
  }
]`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content || "{}");
    const rawSuggestions = aiResponse.suggestions || [];

    // Step 6: Format suggestions with broker names
    const suggestions = rawSuggestions.map((s: any) => {
      const customer = customerProfiles.find((c) => c.id === s.customerId);
      const recommendedBroker = brokerProfiles.find((b) => b.id === s.recommendedBrokerId);
      const alternatives = (s.alternatives || []).map((alt: any) => ({
        brokerId: alt.brokerId,
        name: brokerProfiles.find((b) => b.id === alt.brokerId)?.name || "Unknown",
        reason: alt.reason,
      }));

      return {
        customerId: s.customerId,
        customerName: customer?.business_name || customer?.contact_name || "Unknown",
        currentBroker: customer?.current_broker_name || "Unassigned",
        currentBrokerId: customer?.current_broker_id,
        recommendedBroker: recommendedBroker?.name || "Unknown",
        recommendedBrokerId: s.recommendedBrokerId,
        reason: s.reason,
        confidence: s.confidence,
        alternativeBrokers: alternatives,
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
