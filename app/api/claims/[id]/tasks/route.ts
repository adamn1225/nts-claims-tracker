import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Claim-scoped tasks API.
 *
 *   GET    /api/claims/:id/tasks            — list tasks for the claim
 *   POST   /api/claims/:id/tasks            — create a task
 *   PATCH  /api/claims/:id/tasks            — update a task (fields, assignee, status)
 *   DELETE /api/claims/:id/tasks?task_id=…  — delete a task
 *
 * The `tasks` table is the claims-native schema (migration
 * 20260620000004_claim_activity.sql): claim_id NOT NULL, assigned_to → profiles,
 * due_at timestamptz, type/priority/status enums. RLS gates reads/writes via
 * can_see_claim / can_write_claim (or assigned_to = auth.uid()).
 */

const PROFILE_FIELDS = "id, first_name, last_name, email";

const TASK_SELECT = `
  id, claim_id, template_id, type, title, description, priority, status,
  due_at, assigned_to, completed_at, completion_notes, created_at, updated_at,
  creator:profiles!tasks_created_by_fkey (${PROFILE_FIELDS}),
  assigned:profiles!tasks_assigned_to_fkey (${PROFILE_FIELDS})
`;

function requireUser(user: { id: string } | null) {
    if (!user) {
        return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    return null;
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

    const { data, error } = await supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("claim_id", claimId)
        .order("created_at", { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ tasks: data ?? [] });
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

    const body = (await req.json()) as {
        title?: string;
        type?: string;
        priority?: string;
        description?: string | null;
        due_at?: string | null;
        assigned_to?: string | null;
    };

    const title = body.title?.trim();
    if (!title) {
        return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    // If an assignee is provided, confirm it's an active internal user.
    if (body.assigned_to) {
        const { data: target } = await supabase
            .from("profiles")
            .select("id, is_active")
            .eq("id", body.assigned_to)
            .single();
        if (!target || !target.is_active) {
            return NextResponse.json(
                { error: "Assignee must be an active user" },
                { status: 400 },
            );
        }
    }

    const { data, error } = await supabase
        .from("tasks")
        .insert({
            claim_id: claimId,
            title,
            type: body.type || "other",
            priority: body.priority || "normal",
            description: body.description?.trim() || null,
            due_at: body.due_at || null,
            assigned_to: body.assigned_to || null,
            created_by: user.id,
        })
        .select(TASK_SELECT)
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ task: data }, { status: 201 });
}

const EDITABLE_FIELDS = new Set([
    "title",
    "type",
    "priority",
    "description",
    "due_at",
    "assigned_to",
    "status",
]);

export async function PATCH(
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

    const body = (await req.json()) as {
        id?: string;
        assigned_to?: string | null;
        status?: string;
        [key: string]: unknown;
    };

    if (!body.id) {
        return NextResponse.json({ error: "task id is required" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
        if (key !== "id" && EDITABLE_FIELDS.has(key)) {
            patch[key] = value;
        }
    }

    // Title can't be emptied.
    if (patch.title !== undefined && String(patch.title ?? "").trim() === "") {
        return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    // If an assignee is provided, confirm it's an active user (null = unassign).
    if (patch.assigned_to) {
        const { data: target } = await supabase
            .from("profiles")
            .select("id, is_active")
            .eq("id", patch.assigned_to as string)
            .single();
        if (!target || !target.is_active) {
            return NextResponse.json(
                { error: "Assignee must be an active user" },
                { status: 400 },
            );
        }
    }

    // Status transitions carry completion bookkeeping.
    if (patch.status === "completed") {
        patch.completed_at = new Date().toISOString();
        patch.completed_by = user.id;
    } else if (patch.status !== undefined) {
        // Reopen / any non-completed status clears completion markers.
        patch.completed_at = null;
        patch.completed_by = null;
    }

    const { data, error } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", body.id)
        .eq("claim_id", claimId)
        .select(TASK_SELECT)
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ task: data });
}

export async function DELETE(
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

    const taskId = new URL(req.url).searchParams.get("task_id");
    if (!taskId) {
        return NextResponse.json(
            { error: "task_id query param is required" },
            { status: 400 },
        );
    }

    const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId)
        .eq("claim_id", claimId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
}
