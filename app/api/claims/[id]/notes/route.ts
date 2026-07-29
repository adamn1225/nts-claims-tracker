import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/claims/:id/notes — add a quick note to a claim.
 * GET  /api/claims/:id/notes — list notes (most recent first).
 *
 * Notes are internal only. Correspondence with parties uses
 * `correspondence_log` — different table, different UI section.
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: claimId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("claim_notes")
    .select(
      `id, body, is_pinned, is_ai_generated, created_at, updated_at,
       author:profiles!claim_notes_author_id_fkey (id, first_name, last_name, email)`,
    )
    .eq("claim_id", claimId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: claimId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = (await req.json()) as { body?: string; is_pinned?: boolean };
  if (!body.body || body.body.trim().length === 0) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("claim_notes")
    .insert({
      claim_id: claimId,
      body: body.body.trim(),
      is_pinned: body.is_pinned ?? false,
      author_id: user.id,
    })
    .select(
      `id, body, is_pinned, is_ai_generated, created_at, updated_at,
       author:profiles!claim_notes_author_id_fkey (id, first_name, last_name, email)`,
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ note: data });
}
