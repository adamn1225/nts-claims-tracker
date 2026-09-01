import "server-only";
import { sendEmail } from "@/lib/email-service";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Intake notification helpers.
 *
 * Both emails fail silently — a failure here should never break a public
 * form submission. Errors are logged so they surface in Supabase/Netlify
 * function logs but the caller keeps going.
 */

type IntakeSummary = {
  reference: string;
  submissionId: string;
  submitterName: string;
  submitterEmail: string;
  submitterCompany: string;
  damageDescription: string;
  claimAmount: string | null;
  attachmentCount: number;
  appUrl: string;
};

/**
 * Add an actionable in-app notification for each active claims user. The
 * optional exclusion prevents staff from being notified about an intake they
 * submitted themselves from inside the dashboard.
 */
export async function createInAppIntakeNotifications(
  summary: IntakeSummary,
  excludedUserId?: string | null,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: staff, error: staffError } = await admin
      .from("profiles")
      .select("id")
      .eq("is_active", true)
      .in("role", ["claims_staff", "manager", "admin"]);

    if (staffError) throw staffError;

    const recipients = (staff ?? []).filter(
      ({ id }) => id !== excludedUserId,
    );
    if (recipients.length === 0) return;

    const amount = summary.claimAmount ? ` · ${summary.claimAmount}` : "";
    const { error: insertError } = await admin.from("notifications").insert(
      recipients.map(({ id }) => ({
        user_id: id,
        type: "claim_intake_received",
        title: `New claim intake · ${summary.reference}`,
        body: `${summary.submitterCompany}${amount} · ready for triage`,
        link: `/dashboard/claims/intake/${summary.submissionId}`,
        related_entity_type: "claim_intake_submissions",
        related_entity_id: summary.submissionId,
        channel: "in_app",
      })),
    );

    if (insertError) throw insertError;
  } catch (err) {
    // Notification delivery must never roll back a valid intake submission.
    console.error("[intake in-app notification] error:", err);
  }
}

/**
 * Notify claims staff that a new pending_review submission just landed.
 * Recipients = all active `claims_staff` / `manager` / `admin` profiles.
 */
export async function notifyClaimsStaffOfNewIntake(
  summary: IntakeSummary,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: staff } = await admin
      .from("profiles")
      .select("email, first_name, role")
      .eq("is_active", true)
      .in("role", ["claims_staff", "manager", "admin"]);

    if (!staff || staff.length === 0) return;

    const triageUrl = `${summary.appUrl}/dashboard/claims/intake/${summary.submissionId}`;
    const subject = `New claim intake · ${summary.reference} · ${summary.submitterCompany}`;

    const rowsHtml = `
      <tr><td style="padding:4px 8px;color:#64748b;">Reference</td><td style="padding:4px 8px;"><strong>${escapeHtml(summary.reference)}</strong></td></tr>
      <tr><td style="padding:4px 8px;color:#64748b;">Submitter</td><td style="padding:4px 8px;">${escapeHtml(summary.submitterName)} — ${escapeHtml(summary.submitterEmail)}</td></tr>
      <tr><td style="padding:4px 8px;color:#64748b;">Company</td><td style="padding:4px 8px;">${escapeHtml(summary.submitterCompany)}</td></tr>
      ${summary.claimAmount ? `<tr><td style="padding:4px 8px;color:#64748b;">Claim amount</td><td style="padding:4px 8px;">${escapeHtml(summary.claimAmount)}</td></tr>` : ""}
      <tr><td style="padding:4px 8px;color:#64748b;">Attachments</td><td style="padding:4px 8px;">${summary.attachmentCount}</td></tr>
    `;

    const html = `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;">
        <h2 style="margin:0 0 8px 0;color:#111827;">New claim intake in the queue</h2>
        <p style="color:#475569;margin:0 0 12px 0;">Triage a new submission before it stalls.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0 16px 0;">
          ${rowsHtml}
        </table>
        <p style="margin:8px 0;font-size:14px;color:#334155;">
          <strong>Damage:</strong> ${escapeHtml(truncate(summary.damageDescription, 400))}
        </p>
        <p style="margin:16px 0;">
          <a href="${triageUrl}" style="display:inline-block;background:#e85d04;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600;">Open triage view</a>
        </p>
        <p style="color:#94a3b8;font-size:12px;">This is an automated notification from NTS Claims Tracker.</p>
      </div>
    `;
    const text = `New claim intake in the queue.

Reference: ${summary.reference}
Submitter: ${summary.submitterName} — ${summary.submitterEmail}
Company: ${summary.submitterCompany}
${summary.claimAmount ? `Claim amount: ${summary.claimAmount}\n` : ""}Attachments: ${summary.attachmentCount}

Damage: ${truncate(summary.damageDescription, 400)}

Triage: ${triageUrl}`;

    await Promise.all(
      staff
        .filter(
          (s): s is typeof s & { email: string } => Boolean(s.email),
        )
        .map((s) =>
          sendEmail({
            to: s.email,
            subject,
            html,
            text,
          }).catch((err) => {
            console.error("[intake notify staff] send failed", s.email, err);
          }),
        ),
    );
  } catch (err) {
    console.error("[intake notify staff] error:", err);
  }
}

/**
 * Acknowledge receipt back to the submitter with their reference number.
 */
export async function sendIntakeAcknowledgment(
  summary: IntakeSummary,
): Promise<void> {
  try {
    if (!summary.submitterEmail) return;
    const subject = `We received your claim — reference ${summary.reference}`;
    const html = `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;">
        <p>Hi ${escapeHtml(firstName(summary.submitterName))},</p>
        <p>Thank you for submitting your claim to Nationwide Transport Services. This is your automated confirmation.</p>
        <table style="border-collapse:collapse;font-size:14px;margin:12px 0;">
          <tr><td style="padding:4px 8px;color:#64748b;">Reference</td><td style="padding:4px 8px;"><strong>${escapeHtml(summary.reference)}</strong></td></tr>
          <tr><td style="padding:4px 8px;color:#64748b;">Attachments received</td><td style="padding:4px 8px;">${summary.attachmentCount}</td></tr>
        </table>
        <p>A member of our claims team will review your submission and reach out with next steps, typically within one business day.</p>
        <p>If you need to send additional documents or corrections, reply directly to this email and reference <strong>${escapeHtml(summary.reference)}</strong>.</p>
        <p style="color:#475569;font-size:13px;">— NTS Claims Department</p>
      </div>
    `;
    const text = `Hi ${firstName(summary.submitterName)},

Thank you for submitting your claim to Nationwide Transport Services.

Reference: ${summary.reference}
Attachments received: ${summary.attachmentCount}

A member of our claims team will review your submission and reach out with next steps, typically within one business day.

If you need to send additional documents or corrections, reply to this email and reference ${summary.reference}.

— NTS Claims Department`;

    await sendEmail({
      to: summary.submitterEmail,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("[intake acknowledgment] error:", err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n).trim() + "…" : s;
}

function firstName(full: string): string {
  return full.split(" ")[0] || "there";
}
