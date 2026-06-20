/**
 * API v1 - Tasks Endpoints
 * 
 * GET    /api/v1/tasks       - List all tasks (with pagination & filtering)
 * POST   /api/v1/tasks       - Create new task
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
 * GET /api/v1/tasks
 */
export async function GET(request: NextRequest) {
  const authResult = await withApiAuth(request, {
    table: "tasks",
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 1000);
    const offset = (page - 1) * limit;
    
    // Build query
    let query = supabaseAdmin
      .from("tasks")
      .select("*", { count: "exact" })
      .eq("broker_id", token.broker_id)
      .range(offset, offset + limit - 1)
      .order("due_date", { ascending: true });
    
    // Filtering
    const status = searchParams.get("status");
    if (status) {
      query = query.eq("status", status);
    }
    
    const priority = searchParams.get("priority");
    if (priority) {
      query = query.eq("priority", priority);
    }
    
    const type = searchParams.get("type");
    if (type) {
      query = query.eq("type", type);
    }
    
    const customerId = searchParams.get("customer_id");
    if (customerId) {
      query = query.eq("customer_id", customerId);
    }
    
    // Date filtering
    const dueAfter = searchParams.get("due_after");
    if (dueAfter) {
      query = query.gte("due_date", dueAfter);
    }
    
    const dueBefore = searchParams.get("due_before");
    if (dueBefore) {
      query = query.lte("due_date", dueBefore);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      await logRequest({ status: 500 }, error.message);
      return NextResponse.json(
        { error: "Failed to fetch tasks", details: error.message },
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
 * POST /api/v1/tasks
 */
export async function POST(request: NextRequest) {
  const authResult = await withApiAuth(request, {
    table: "tasks",
    action: "create",
  });
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { token, rateLimit, logRequest } = authResult;
  
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.title || !body.due_date) {
      await logRequest({ status: 400 }, "Missing required fields");
      return NextResponse.json(
        { error: "Missing required fields: title, due_date" },
        { status: 400 },
      );
    }
    
    // Create task
    const { data, error } = await supabaseAdmin
      .from("tasks")
      .insert({
        ...body,
        broker_id: token.broker_id, // Force broker_id to token owner
        status: body.status || "pending",
      })
      .select()
      .single();
    
    if (error) {
      await logRequest({ status: 500 }, error.message);
      return NextResponse.json(
        { error: "Failed to create task", details: error.message },
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
