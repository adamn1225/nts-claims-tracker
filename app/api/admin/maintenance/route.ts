import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: teamMember } = await supabase
    .from("team_members")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!teamMember?.is_admin) {
    return {
      error: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      ),
    };
  }

  return { supabase, user };
}

/**
 * GET /api/admin/maintenance
 * Admin-only: read the full maintenance settings (including timestamps).
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("app_settings")
    .select(
      "maintenance_enabled, maintenance_message, maintenance_starts_at, maintenance_ends_at, updated_at",
    )
    .eq("id", true)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to load settings" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    maintenanceEnabled: data?.maintenance_enabled ?? false,
    message: data?.maintenance_message ?? null,
    startsAt: data?.maintenance_starts_at ?? null,
    endsAt: data?.maintenance_ends_at ?? null,
    updatedAt: data?.updated_at ?? null,
  });
}

/**
 * POST /api/admin/maintenance
 * Admin-only: update the maintenance settings.
 * Body: { enabled?, message?, startsAt?, endsAt? }
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { supabase, user } = auth;

  let body: {
    enabled?: boolean;
    message?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };

  if (typeof body.enabled === "boolean") {
    updateData.maintenance_enabled = body.enabled;
  }
  if (body.message !== undefined) {
    const trimmed =
      typeof body.message === "string" ? body.message.trim() : "";
    updateData.maintenance_message = trimmed.length > 0 ? trimmed : null;
  }
  if (body.startsAt !== undefined) {
    updateData.maintenance_starts_at = body.startsAt || null;
  }
  if (body.endsAt !== undefined) {
    updateData.maintenance_ends_at = body.endsAt || null;
  }

  const { data, error } = await supabase
    .from("app_settings")
    .update(updateData)
    .eq("id", true)
    .select(
      "maintenance_enabled, maintenance_message, maintenance_starts_at, maintenance_ends_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    maintenanceEnabled: data?.maintenance_enabled ?? false,
    message: data?.maintenance_message ?? null,
    startsAt: data?.maintenance_starts_at ?? null,
    endsAt: data?.maintenance_ends_at ?? null,
    updatedAt: data?.updated_at ?? null,
  });
}
