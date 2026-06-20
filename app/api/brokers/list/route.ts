/**
 * GET /api/brokers/list
 * 
 * Returns list of all active brokers with their details for autocomplete/selection
 */

import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();

  try {
    // Fetch all active brokers from broker_customer_summary view
    const { data: brokers, error } = await supabase
      .from("broker_customer_summary")
      .select("broker_id, full_name, office_location, active_customers, total_customers")
      .order("full_name");

    if (error) throw error;

    // Format for frontend autocomplete
    const formattedBrokers = brokers?.map(b => ({
      id: b.broker_id,
      name: b.full_name || "Unknown",
      office: b.office_location || "N/A",
      customers: b.active_customers || 0,
    })) || [];

    return NextResponse.json({ 
      brokers: formattedBrokers,
      count: formattedBrokers.length 
    });
  } catch (error: any) {
    console.error("Error fetching brokers:", error);
    return NextResponse.json(
      { error: "Failed to fetch brokers", details: error.message },
      { status: 500 }
    );
  }
}
