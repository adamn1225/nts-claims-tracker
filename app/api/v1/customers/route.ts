/**
 * API v1 - Customers Endpoints
 * 
 * GET    /api/v1/customers       - List all customers (with pagination & filtering)
 * GET    /api/v1/customers/:id   - Get single customer
 * POST   /api/v1/customers       - Create new customer
 * PUT    /api/v1/customers/:id   - Update customer
 * DELETE /api/v1/customers/:id   - Delete customer
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withApiAuth } from "@/lib/api-middleware";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

/**
 * GET /api/v1/customers
 * List customers with pagination and filtering
 */
export async function GET(request: NextRequest) {
  const authResult = await withApiAuth(request, {
    table: "customers",
    action: "read",
  });
  
  if (authResult instanceof NextResponse) {
    return authResult; // Error response
  }
  
  const { token, rateLimit, logRequest } = authResult;
  
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 1000); // Max 1000
    const offset = (page - 1) * limit;
    
    // Build query
    let query = supabaseAdmin
      .from("customers")
      .select("*", { count: "exact" })
      .eq("team_member_id", token.team_member_id) // Only return token owner's customers
      .range(offset, offset + limit - 1)
      .order("updated_at", { ascending: false });
    
    // Filtering
    const status = searchParams.get("status");
    if (status) {
      query = query.eq("status", status);
    }
    
    const city = searchParams.get("city");
    if (city) {
      query = query.ilike("city", `%${city}%`);
    }
    
    const state = searchParams.get("state");
    if (state) {
      query = query.eq("state", state);
    }
    
    const industry = searchParams.get("industry");
    if (industry) {
      query = query.ilike("industry", `%${industry}%`);
    }
    
    const shippingFrequency = searchParams.get("shipping_frequency");
    if (shippingFrequency) {
      query = query.eq("shipping_frequency", shippingFrequency);
    }
    
    // Search by business name
    const search = searchParams.get("search");
    if (search) {
      query = query.ilike("business_name", `%${search}%`);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      await logRequest({ status: 500 }, error.message);
      return NextResponse.json(
        { error: "Failed to fetch customers", details: error.message },
        { status: 500 },
      );
    }
    
    const response = {
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
    
    await logRequest({ status: 200, body: response });
    
    return NextResponse.json(response, {
      headers: {
        "X-RateLimit-Limit": token.rate_limit_per_hour.toString(),
        "X-RateLimit-Remaining": rateLimit.remaining.toString(),
        "X-RateLimit-Reset": rateLimit.resetAt,
      },
    });
  } catch (error: any) {
    await logRequest({ status: 500 }, error.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/customers
 * Create new customer
 */
export async function POST(request: NextRequest) {
  const authResult = await withApiAuth(request, {
    table: "customers",
    action: "create",
  });
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { token, rateLimit, logRequest } = authResult;
  
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.business_name) {
      await logRequest({ status: 400 }, "Missing required field: business_name");
      return NextResponse.json(
        { error: "Missing required field: business_name" },
        { status: 400 },
      );
    }
    
    // Create customer
    // If team_member_id is provided in body, use it. If explicitly null, create unassigned.
    // If not provided at all, default to token owner (backward compatibility)
    const customerData = {
      ...body,
      team_member_id: body.hasOwnProperty('team_member_id') ? body.team_member_id : token.team_member_id,
    };
    
    const { data, error } = await supabaseAdmin
      .from("customers")
      .insert(customerData)
      .select()
      .single();
    
    if (error) {
      await logRequest({ status: 500 }, error.message);
      return NextResponse.json(
        { error: "Failed to create customer", details: error.message },
        { status: 500 },
      );
    }
    
    await logRequest({ status: 201, body: { data } });
    
    return NextResponse.json(
      { data },
      {
        status: 201,
        headers: {
          "X-RateLimit-Limit": token.rate_limit_per_hour.toString(),
          "X-RateLimit-Remaining": rateLimit.remaining.toString(),
          "X-RateLimit-Reset": rateLimit.resetAt,
        },
      },
    );
  } catch (error: any) {
    await logRequest({ status: 500 }, error.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
