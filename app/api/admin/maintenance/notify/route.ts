import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email-service";

export const dynamic = "force-dynamic";

/**
 * Format an ISO timestamp as a friendly Eastern-time string for the email body.
 */
function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * POST /api/admin/maintenance/notify
 * Admin-only: email all active team members an advance maintenance warning.
 * Reads the current maintenance window from app_settings.
 */
export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: adminTeamMember } = await supabase
    .from("team_members")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!adminTeamMember?.is_admin) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  }

  // Current maintenance window
  const { data: settings } = await supabase
    .from("app_settings")
    .select("maintenance_message, maintenance_starts_at, maintenance_ends_at")
    .eq("id", true)
    .single();

  const startsAt = formatWhen(settings?.maintenance_starts_at ?? null);
  const endsAt = formatWhen(settings?.maintenance_ends_at ?? null);
  const customMessage = settings?.maintenance_message?.trim() || null;

  // Active recipients
  const { data: teamMembers, error: teamMembersError } = await supabase
    .from("team_members")
    .select("email, first_name")
    .eq("is_active", true)
    .not("email", "is", null);

  if (teamMembersError) {
    return NextResponse.json(
      { error: "Failed to load recipients" },
      { status: 500 },
    );
  }

  const recipients = (teamMembers ?? []).filter((b) => b.email);
  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "No active users with an email address" },
      { status: 400 },
    );
  }

  const windowLines: string[] = [];
  if (startsAt) windowLines.push(`<strong>Starts:</strong> ${startsAt}`);
  if (endsAt) windowLines.push(`<strong>Expected back:</strong> ${endsAt}`);

  const subject = "Scheduled maintenance for NTS Claims Tracker";

  let sent = 0;
  let failed = 0;

  await Promise.all(
    recipients.map(async (teamMember) => {
      const greetingName = teamMember.first_name?.trim() || "there";
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1A1A1A;">
          <div style="background:#E85D04; padding:20px 24px; border-radius:8px 8px 0 0;">
            <h2 style="margin:0; color:#ffffff;">Scheduled Maintenance Notice</h2>
          </div>
          <div style="padding:24px; border:1px solid #eee; border-top:none; border-radius:0 0 8px 8px;">
            <p>Hi ${greetingName},</p>
            <p>NTS Claims Tracker will be temporarily unavailable for scheduled maintenance.</p>
            ${
              windowLines.length
                ? `<div style="background:#FFF7ED; border:1px solid #FFA726; border-radius:8px; padding:14px 16px; margin:16px 0;">${windowLines
                    .map((l) => `<p style="margin:4px 0;">${l}</p>`)
                    .join("")}</div>`
                : ""
            }
            ${
              customMessage
                ? `<p style="white-space:pre-wrap;">${customMessage}</p>`
                : "<p>We'll be back as soon as the work is complete. Thanks for your patience.</p>"
            }
            <p style="margin-top:24px; color:#666; font-size:13px;">— NTS Claims Tracker</p>
          </div>
        </div>
      `;

      const text = [
        `Hi ${greetingName},`,
        "",
        "NTS Claims Tracker will be temporarily unavailable for scheduled maintenance.",
        startsAt ? `Starts: ${startsAt}` : "",
        endsAt ? `Expected back: ${endsAt}` : "",
        "",
        customMessage ||
          "We'll be back as soon as the work is complete. Thanks for your patience.",
        "",
        "— NTS Claims Tracker",
      ]
        .filter(Boolean)
        .join("\n");

      const ok = await sendEmail({
        to: teamMember.email as string,
        subject,
        html,
        text,
      });
      if (ok) sent++;
      else failed++;
    }),
  );

  return NextResponse.json({ success: true, sent, failed });
}
