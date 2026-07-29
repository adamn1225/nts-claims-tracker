import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CRUD for a user's saved list views. RLS enforces per-user isolation.
 *
 * GET    /api/list-views?scope=claims_list        — list mine
 * POST   /api/list-views                          — create
 *   Body: { name, scope, filters, is_default? }
 * DELETE /api/list-views?id=...                   — delete mine
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const scope =
    new URL(req.url).searchParams.get("scope") ?? "claims_list";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- new table
  const client = supabase as any;
  const { data, error } = await client
    .from("list_saved_views")
    .select("id, name, scope, filters, is_default, created_at")
    .eq("user_id", user.id)
    .eq("scope", scope)
    .order("is_default", { ascending: false })
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ views: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = (await req.json()) as {
    name?: string;
    scope?: string;
    filters?: Record<string, unknown>;
    is_default?: boolean;
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // Enforce single default per scope by clearing the previous default if this
  // one wants to be default.
  if (body.is_default) {
    await client
      .from("list_saved_views")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("scope", body.scope ?? "claims_list");
  }

  const { data, error } = await client
    .from("list_saved_views")
    .upsert(
      {
        user_id: user.id,
        name: body.name.trim(),
        scope: body.scope ?? "claims_list",
        filters: body.filters ?? {},
        is_default: body.is_default ?? false,
      },
      { onConflict: "user_id,scope,name" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ view: data });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error } = await client
    .from("list_saved_views")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
