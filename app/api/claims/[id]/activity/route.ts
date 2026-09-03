import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claimTypeLabel } from "@/lib/constants/claim-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/claims/:id/activity
 *
 * Returns a unified, chronologically-sorted feed of activity for one claim:
 *   - `note`            → claim_notes
 *   - `correspondence`  → correspondence_log (phone/email/sms)
 *   - `status_change`   → claim_status_history
 *   - `document`        → claim_documents (upload event)
 *   - `task`            → tasks (create/complete)
 *   - `transaction`     → claim_transactions
 *
 * This is the "one timeline" the claims team asked for (L1/L2) so they stop
 * duplicating notes across CRM / spreadsheet / FreightClaims.
 *
 * We fetch each source separately (RLS handles scoping) and merge in memory.
 * Not efficient for very hot claims — swap for a DB view or FTS index if this
 * ever gets slow (>50 claims per page).
 */
type ActivityItem = {
  id: string;
  kind:
  | "note"
  | "correspondence"
  | "status_change"
  | "document"
  | "task"
  | "transaction"
  | "financial_update"
  | "claim_update";
  occurred_at: string;
  actor_name: string | null;
  title: string;
  body: string | null;
  extra?: Record<string, unknown>;
};

function actorName(p: {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
} | null): string | null {
  if (!p) return null;
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.email || null;
}

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

  const activity: ActivityItem[] = [];

  const profileFields =
    "id, first_name, last_name, email";

  // Notes
  const { data: notes } = await supabase
    .from("claim_notes")
    .select(
      `id, body, is_pinned, is_ai_generated, created_at,
       author:profiles!claim_notes_author_id_fkey (${profileFields})`,
    )
    .eq("claim_id", claimId);

  (notes ?? []).forEach((n) => {
    activity.push({
      id: `note-${n.id}`,
      kind: "note",
      occurred_at: n.created_at,
      actor_name: actorName(
        n.author as unknown as {
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        },
      ),
      title: n.is_ai_generated ? "AI-generated note" : "Internal note",
      body: n.body,
      extra: { is_pinned: n.is_pinned },
    });
  });

  // Correspondence
  const { data: corr } = await supabase
    .from("correspondence_log")
    .select(
      `id, channel, direction, subject, body, occurred_at,
       ai_summary, requires_human_review, call_duration_seconds,
       logged:profiles!correspondence_log_logged_by_fkey (${profileFields})`,
    )
    .eq("claim_id", claimId);

  (corr ?? []).forEach((c) => {
    activity.push({
      id: `corr-${c.id}`,
      kind: "correspondence",
      occurred_at: c.occurred_at,
      actor_name: actorName(
        c.logged as unknown as {
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        },
      ),
      title: `${c.direction === "inbound" ? "← Received" : c.direction === "outbound" ? "→ Sent" : "Internal"} · ${c.channel}${c.subject ? ` — ${c.subject}` : ""}`,
      body: c.ai_summary || c.body,
      extra: {
        requires_human_review: c.requires_human_review,
        call_duration_seconds: c.call_duration_seconds,
      },
    });
  });

  // Status changes
  const { data: statuses } = await supabase
    .from("claim_status_history")
    .select(
      `id, changed_at, note,
       from_status:claim_statuses!claim_status_history_from_status_id_fkey (id, name),
       to_status:claim_statuses!claim_status_history_to_status_id_fkey (id, name),
       changed:profiles!claim_status_history_changed_by_fkey (${profileFields})`,
    )
    .eq("claim_id", claimId);

  (statuses ?? []).forEach((s) => {
    const from = (s.from_status as unknown as { name: string } | null)?.name;
    const to = (s.to_status as unknown as { name: string } | null)?.name;
    activity.push({
      id: `status-${s.id}`,
      kind: "status_change",
      occurred_at: s.changed_at,
      actor_name: actorName(
        s.changed as unknown as {
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        },
      ),
      title: from ? `Moved from "${from}" to "${to}"` : `Opened in "${to}"`,
      body: s.note,
    });
  });

  // Documents
  const { data: docs } = await supabase
    .from("claim_documents")
    .select(
      `id, filename, document_type, uploaded_at,
       uploader:profiles!claim_documents_uploaded_by_fkey (${profileFields})`,
    )
    .eq("claim_id", claimId);

  (docs ?? []).forEach((d) => {
    activity.push({
      id: `doc-${d.id}`,
      kind: "document",
      occurred_at: d.uploaded_at,
      actor_name: actorName(
        d.uploader as unknown as {
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        },
      ),
      title: `Uploaded ${d.document_type.replace(/_/g, " ")}`,
      body: d.filename,
    });
  });

  // Tasks (creation + completion)
  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      `id, title, description, type, status, priority, due_at,
       created_at, completed_at,
       creator:profiles!tasks_created_by_fkey (${profileFields}),
       assigned:profiles!tasks_assigned_to_fkey (${profileFields})`,
    )
    .eq("claim_id", claimId);

  (tasks ?? []).forEach((t) => {
    activity.push({
      id: `task-${t.id}-created`,
      kind: "task",
      occurred_at: t.created_at,
      actor_name: actorName(
        t.creator as unknown as {
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        },
      ),
      title: `Task created: ${t.title}`,
      body: t.description,
      extra: {
        due_at: t.due_at,
        status: t.status,
        priority: t.priority,
        assigned_to: actorName(
          t.assigned as unknown as {
            first_name: string | null;
            last_name: string | null;
            email: string | null;
          },
        ),
      },
    });
    if (t.completed_at) {
      activity.push({
        id: `task-${t.id}-completed`,
        kind: "task",
        occurred_at: t.completed_at,
        actor_name: null,
        title: `Task completed: ${t.title}`,
        body: null,
      });
    }
  });

  // Transactions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- new table
  const { data: txns } = await (supabase as any)
    .from("claim_transactions")
    .select(
      `id, transaction_type, payment_source, amount, currency,
       transaction_date, reference_number, notes, created_at,
       logged:profiles!claim_transactions_logged_by_fkey (${profileFields})`,
    )
    .eq("claim_id", claimId);

  (txns ?? []).forEach(
    (t: {
      id: string;
      transaction_type: string;
      payment_source: string;
      amount: number;
      currency: string;
      transaction_date: string;
      reference_number: string | null;
      notes: string | null;
      created_at: string;
      logged: {
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      } | null;
    }) => {
      activity.push({
        id: `txn-${t.id}`,
        kind: "transaction",
        occurred_at: t.created_at,
        actor_name: actorName(t.logged),
        title: `${t.transaction_type.replace(/_/g, " ")} · $${Number(t.amount).toLocaleString()} ${t.currency} from ${t.payment_source}`,
        body: t.notes,
        extra: {
          reference_number: t.reference_number,
          transaction_date: t.transaction_date,
        },
      });
    },
  );

  // Claim detail edits (written by database triggers).
  const { data: claimEdits } = await supabase
    .from("audit_logs")
    .select(
      `id, before, after, occurred_at,
       actor:profiles!audit_logs_actor_id_fkey (${profileFields})`,
    )
    .eq("entity_type", "claims")
    .eq("entity_id", claimId)
    .in("metadata->>category", ["financials", "claim_details"]);

  const fieldLabels: Record<string, string> = {
    summary: "Summary",
    owner_id: "Owner",
    filing_status: "Filing status",
    filed_at: "Filed at",
    claim_type: "Claim type",
    value_bucket: "Value bucket",
    value_bucket_manual: "Value bucket mode",
    tms_order_number: "NTS order / load #",
    bol_number: "BOL #",
    freight_type_id: "Freight type",
    trailer_type_id: "Trailer type",
    origin_city: "Origin city",
    origin_state: "Origin state",
    origin_postal_code: "Origin ZIP",
    destination_city: "Destination city",
    destination_state: "Destination state",
    destination_postal_code: "Destination ZIP",
    pickup_date: "Pickup date",
    delivery_date: "Delivery date",
    incident_date: "Incident date",
    damage_claim_amount: "Estimated claim amount",
    shipment_value: "Total shipment value",
    carrier_pay: "Carrier pay",
    carrier_deductible: "Carrier deductible",
    currency: "Currency",
    internal_description: "Internal description",
    resolution: "Resolution",
    resolution_notes: "Resolution notes",
  };

  const [
    { data: freightTypes },
    { data: trailerTypes },
    { data: profiles },
  ] = await Promise.all([
    supabase.from("freight_types").select("id, name"),
    supabase.from("trailer_types").select("id, name"),
    supabase.from("profiles").select("id, first_name, last_name, email"),
  ]);
  const freightNames = new Map((freightTypes ?? []).map((row) => [row.id, row.name]));
  const trailerNames = new Map((trailerTypes ?? []).map((row) => [row.id, row.name]));
  const profileNames = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
      profile.email ||
      "Unknown user",
    ]),
  );

  (claimEdits ?? []).forEach((edit) => {
    const before = (edit.before ?? {}) as Record<string, unknown>;
    const after = (edit.after ?? {}) as Record<string, unknown>;
    const changed = Object.keys(fieldLabels).filter(
      (field) => before[field] !== after[field],
    );
    const isLegacyFinancialEdit = changed.every((field) =>
      ["damage_claim_amount", "shipment_value", "carrier_pay", "carrier_deductible"].includes(field),
    );
    activity.push({
      id: `claim-edit-${edit.id}`,
      kind: isLegacyFinancialEdit ? "financial_update" : "claim_update",
      occurred_at: edit.occurred_at,
      actor_name: actorName(
        edit.actor as unknown as {
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        },
      ),
      title: isLegacyFinancialEdit ? "Financials updated" : "Claim details updated",
      body: changed
        .map(
          (field) =>
            `${fieldLabels[field]}: ${formatAuditValue(field, before[field], freightNames, trailerNames, profileNames)} → ${formatAuditValue(field, after[field], freightNames, trailerNames, profileNames)}`,
        )
        .join("\n"),
    });
  });

  // Sort newest → oldest
  activity.sort(
    (a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );

  return NextResponse.json({ activity });
}

function formatAuditValue(
  field: string,
  value: unknown,
  freightNames: Map<string, string>,
  trailerNames: Map<string, string>,
  profileNames: Map<string, string>,
): string {
  if (value === null || value === undefined) return "Not set";
  if (["damage_claim_amount", "shipment_value", "carrier_pay", "carrier_deductible"].includes(field)) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return String(value);
    return amount.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
  }
  if (field === "claim_type") return claimTypeLabel(String(value));
  if (field === "freight_type_id") return freightNames.get(String(value)) ?? "Unknown";
  if (field === "trailer_type_id") return trailerNames.get(String(value)) ?? "Unknown";
  if (field === "owner_id") return profileNames.get(String(value)) ?? "Unknown user";
  if (field === "value_bucket_manual") return value ? "Manual" : "Automatic";
  if (["pickup_date", "delivery_date", "incident_date"].includes(field)) {
    return new Date(`${String(value)}T00:00:00`).toLocaleDateString();
  }
  if (field === "filed_at") return new Date(String(value)).toLocaleString();
  return String(value).replace(/_/g, " ");
}
