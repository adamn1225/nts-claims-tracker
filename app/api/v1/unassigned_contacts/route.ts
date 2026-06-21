/**
 * API v1 - Unassigned Contacts Endpoints
 * 
 * GET    /api/v1/unassigned_contacts       - List unassigned contacts (with pagination & filtering)
 * POST   /api/v1/unassigned_contacts       - Create/import new unassigned contact
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
 * GET /api/v1/unassigned_contacts
 * Note: Returns ALL unassigned contacts (team_member_id IS NULL)
 * These are contacts in the import pool waiting to be distributed
 */
export async function GET(request: NextRequest) {
  const authResult = await withApiAuth(request, {
    table: "unassigned_contacts",
    action: "read",
  });
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { token, rateLimit, logRequest } = authResult;
  
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get(" limit") || "100"), 1000);
    const offset = (page - 1) * limit;
    
    // Build query - only unassigned contacts (team_member_id IS NULL)
    let query = supabaseAdmin
      .from("customers")
      .select("*", { count: "exact" })
      .is("team_member_id", null)
      .range(offset, offset + limit - 1)
      .order("created_at", { ascending: false });
    
    // Filtering
    const importSource = searchParams.get("import_source");
    if (importSource) {
      query = query.eq("import_source", importSource);
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
    
    const search = searchParams.get("search");
    if (search) {
      query = query.ilike("business_name", `%${search}%`);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      await logRequest({ status: 500 }, error.message);
      return NextResponse.json(
        { error: "Failed to fetch unassigned contacts", details: error.message },
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
 * POST /api/v1/unassigned_contacts
 * Create unassigned contact for import pool
 */
export async function POST(request: NextRequest) {
  const authResult = await withApiAuth(request, {
    table: "unassigned_contacts",
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
    
    // Create unassigned contact (in customers table with team_member_id = NULL)
    const { data, error } = await supabaseAdmin
      .from("customers")
      .insert({
        ...body,
        team_member_id: null, // Force NULL to mark as unassigned
        import_source: body.import_source || "API Import",
      })
      .select()
      .single();
    
    if (error) {
      await logRequest({ status: 500 }, error.message);
      return NextResponse.json(
        { error: "Failed to create unassigned contact", details: error.message },
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
