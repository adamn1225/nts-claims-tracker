import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/maintenance
 * Returns the current site maintenance state. Readable by any authenticated
 * user so the dashboard can render the maintenance gate / warning banner.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("app_settings")
      .select(
        "maintenance_enabled, maintenance_message, maintenance_starts_at, maintenance_ends_at",
      )
      .eq("id", true)
      .single();

    if (error) {
      // Fail open: never lock users out because of a settings read error.
      return NextResponse.json(
        {
          maintenanceEnabled: false,
          message: null,
          startsAt: null,
          endsAt: null,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // Compute the effective state server-side (avoids client clock skew).
    // Maintenance is active when the manual toggle is on, OR when we're
    // currently inside a scheduled window (now >= startsAt and, if an end
    // time is set, now < endsAt).
    const now = Date.now();
    const startsAt = data?.maintenance_starts_at ?? null;
    const endsAt = data?.maintenance_ends_at ?? null;

    const startMs = startsAt ? new Date(startsAt).getTime() : null;
    const endMs = endsAt ? new Date(endsAt).getTime() : null;

    const withinSchedule =
      startMs !== null &&
      !Number.isNaN(startMs) &&
      now >= startMs &&
      (endMs === null || Number.isNaN(endMs) || now < endMs);

    const effectiveEnabled = Boolean(data?.maintenance_enabled) || withinSchedule;

    return NextResponse.json(
      {
        maintenanceEnabled: effectiveEnabled,
        manualEnabled: Boolean(data?.maintenance_enabled),
        scheduledActive: withinSchedule,
        message: data?.maintenance_message ?? null,
        startsAt,
        endsAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        maintenanceEnabled: false,
        message: null,
        startsAt: null,
        endsAt: null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
