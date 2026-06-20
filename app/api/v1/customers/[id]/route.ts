/**
 * API v1 - Single Customer Endpoints
 * 
 * GET    /api/v1/customers/:id   - Get customer by ID
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
 * GET /api/v1/customers/:id
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const authResult = await withApiAuth(request, {
    table: "customers",
    action: "read",
  });
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { token, rateLimit, logRequest } = authResult;
  
  try {
    const { data, error } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("id", params.id)
      .eq("broker_id", token.broker_id) // Security: only access own customers
      .single();
    
    if (error || !data) {
      await logRequest({ status: 404 }, "Customer not found");
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }
    
    await logRequest({ status: 200, body: { data } });
    
    return NextResponse.json(
      { data },
      {
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

/**
 * PUT /api/v1/customers/:id
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const authResult = await withApiAuth(request, {
    table: "customers",
    action: "write",
  });
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { token, rateLimit, logRequest } = authResult;
  
  try {
    const body = await request.json();
    
    // Remove fields that shouldn't be updated via API
    delete body.id;
    delete body.broker_id; // Prevent reassignment via this endpoint; use sms-campaign-contact for new records
    delete body.created_at;
    // import_source is intentionally allowed through — external integrations may update it
    
    // Update customer
    const { data, error } = await supabaseAdmin
      .from("customers")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("broker_id", token.broker_id) // Security: only update own customers
      .select()
      .single();
    
    if (error || !data) {
      await logRequest({ status: 404 }, "Customer not found or update failed");
      return NextResponse.json(
        { error: "Customer not found or update failed", details: error?.message },
        { status: 404 },
      );
    }
    
    await logRequest({ status: 200, body: { data } });
    
    return NextResponse.json(
      { data },
      {
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

/**
 * DELETE /api/v1/customers/:id
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const authResult = await withApiAuth(request, {
    table: "customers",
    action: "delete",
  });
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { token, rateLimit, logRequest } = authResult;
  
  try {
    const { error } = await supabaseAdmin
      .from("customers")
      .delete()
      .eq("id", params.id)
      .eq("broker_id", token.broker_id); // Security: only delete own customers
    
    if (error) {
      await logRequest({ status: 404 }, "Customer not found or delete failed");
      return NextResponse.json(
        { error: "Customer not found or delete failed", details: error.message },
        { status: 404 },
      );
    }
    
    await logRequest({ status: 204 });
    
    return new NextResponse(null, {
      status: 204,
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
