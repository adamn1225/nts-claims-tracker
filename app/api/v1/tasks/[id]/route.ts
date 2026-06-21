/**
 * API v1 - Single Task Endpoints
 * 
 * GET    /api/v1/tasks/:id   - Get task by ID
 * PUT    /api/v1/tasks/:id   - Update task
 * DELETE /api/v1/tasks/:id   - Delete task
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

/** GET /api/v1/tasks/:id */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const authResult = await withApiAuth(request, {
    table: "tasks",
    action: "read",
  });
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { token, rateLimit, logRequest } = authResult;
  
  try {
    const { data, error } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("id", params.id)
      .eq("team_member_id", token.team_member_id)
      .single();
    
    if (error || !data) {
      await logRequest({ status: 404 }, "Task not found");
      return NextResponse.json(
        { error: "Task not found" },
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

/** PUT /api/v1/tasks/:id */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const authResult = await withApiAuth(request, {
    table: "tasks",
    action: "write",
  });
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { token, rateLimit, logRequest } = authResult;
  
  try {
    const body = await request.json();
    
    // Remove protected fields
    delete body.id;
    delete body.team_member_id;
    delete body.created_at;
    
    const { data, error } = await supabaseAdmin
      .from("tasks")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("team_member_id", token.team_member_id)
      .select()
      .single();
    
    if (error || !data) {
      await logRequest({ status: 404 }, "Task not found or update failed");
      return NextResponse.json(
        { error: "Task not found or update failed", details: error?.message },
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

/** DELETE /api/v1/tasks/:id */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const authResult = await withApiAuth(request, {
    table: "tasks",
    action: "delete",
  });
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { token, rateLimit, logRequest } = authResult;
  
  try {
    const { error } = await supabaseAdmin
      .from("tasks")
      .delete()
      .eq("id", params.id)
      .eq("team_member_id", token.team_member_id);
    
    if (error) {
      await logRequest({ status: 404 }, "Task not found or delete failed");
      return NextResponse.json(
        { error: "Task not found or delete failed", details: error.message },
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
