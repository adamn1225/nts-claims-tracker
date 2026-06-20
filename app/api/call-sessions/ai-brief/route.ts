import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/call-sessions/ai-brief
 * Body: { contact: ContactSnapshot }
 *
 * Returns: { brief: string }
 *
 * Summarizes any prior dialer_call_logs for this contact (matched by id OR
 * by phone/email if id absent), so the broker can read context before dialing.
 */
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const contact = body.contact;
    if (!contact || !contact.name) {
        return NextResponse.json({ error: "contact is required" }, { status: 400 });
    }

    // Build a query for prior logs: match contact_id if available, else phone/email in snapshot
    let logs: Array<{
        outcome: string | null;
        notes: string | null;
        ai_feedback: unknown;
        created_at: string;
    }> = [];

    if (contact.id) {
        const { data } = await supabase
            .from("dialer_call_logs")
            .select("outcome, notes, ai_feedback, created_at")
            .eq("contact_id", contact.id)
            .order("created_at", { ascending: false })
            .limit(10);
        logs = data ?? [];
    } else if (contact.phone || contact.email) {
        const { data } = await supabase
            .from("dialer_call_logs")
            .select("outcome, notes, ai_feedback, contact_snapshot, created_at")
            .eq("broker_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50);
        logs = (data ?? []).filter((row) => {
            const snap = (row.contact_snapshot ?? {}) as Record<string, unknown>;
            return (
                (contact.phone && snap.phone === contact.phone) ||
                (contact.email && snap.email === contact.email)
            );
        }).slice(0, 10);
    }

    if (logs.length === 0) {
        return NextResponse.json({
            brief: `No prior calls logged for ${contact.name}. This is a fresh outreach — focus on discovery: confirm shipping needs, identify their current carrier setup, and listen for pain points.`,
        });
    }

    const historyText = logs.map((l, i) => {
        const when = new Date(l.created_at).toLocaleString();
        return `Call ${i + 1} (${when}) — outcome: ${l.outcome ?? "unknown"}\nNotes: ${l.notes ?? "(none)"}`;
    }).join("\n\n");

    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ brief: `Prior call history for ${contact.name}:\n\n${historyText}` });
    }

    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content:
                    "You are a sales coach for freight brokers at Nationwide Transport Services. Read past call notes and produce a tight 3-5 sentence pre-call brief: (1) where the relationship stands, (2) what the broker should pick up on, (3) the suggested opener. No fluff, no headers.",
            },
            {
                role: "user",
                content: `Contact: ${contact.name}${contact.company ? ` (${contact.company})` : ""}${contact.title ? `, ${contact.title}` : ""}\n\nPast calls (newest first):\n\n${historyText}`,
            },
        ],
        temperature: 0.4,
        max_tokens: 350,
    });

    const brief = completion.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ brief });
}
