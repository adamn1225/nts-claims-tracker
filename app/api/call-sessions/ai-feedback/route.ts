import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/call-sessions/ai-feedback
 *
 * Body: {
 *   contact:       ContactSnapshot,
 *   notes:         string,
 *   outcome:       string,
 *   transcript?:   string,   // optional GoTo transcript if available
 *   preferences?:  { performance, tips, email, sms, follow_up }  // per-call override
 * }
 *
 * Returns: {
 *   feedback: {
 *     performance?:    string,
 *     tips?:           string[],
 *     email_draft?:    { subject: string, body: string },
 *     sms_draft?:      string,
 *     suggested_followup?: { when: 'tomorrow'|'in_3_days'|'next_week'|'in_2_weeks', summary: string },
 *   }
 * }
 *
 * Uses broker's saved preferences if `preferences` not supplied.
 */
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { contact, notes, outcome, transcript } = body;

    if (!contact?.name) {
        return NextResponse.json({ error: "contact is required" }, { status: 400 });
    }
    if (!transcript && !notes) {
        return NextResponse.json({ error: "Either transcript or notes are required" }, { status: 400 });
    }

    // Resolve preferences (per-call override takes precedence)
    let prefs = body.preferences;
    if (!prefs) {
        const { data: row } = await supabase
            .from("dialer_ai_preferences")
            .select("post_performance, post_tips, post_email_draft, post_sms_draft, post_suggest_followup")
            .eq("broker_id", user.id)
            .maybeSingle();
        prefs = {
            performance: row?.post_performance ?? true,
            tips: row?.post_tips ?? true,
            email: row?.post_email_draft ?? true,
            sms: row?.post_sms_draft ?? false,
            follow_up: row?.post_suggest_followup ?? true,
        };
    }

    const requested = Object.entries(prefs).filter(([, v]) => v).map(([k]) => k);
    if (requested.length === 0) {
        return NextResponse.json({ feedback: {} });
    }

    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
    }

    const source = transcript
        ? `Call transcript (from GoTo):\n${transcript}`
        : `Broker's notes (no transcript available):\n${notes}`;

    const fieldSpec = [
        prefs.performance && '  "performance": "1-3 sentence analysis of what went well and what to improve"',
        prefs.tips && '  "tips": ["concrete tip 1", "concrete tip 2", "concrete tip 3"]',
        prefs.email && '  "email_draft": { "subject": "...", "body": "professional follow-up email body, plain text" }',
        prefs.sms && '  "sms_draft": "short follow-up SMS, under 160 chars, no emojis"',
        prefs.follow_up && '  "suggested_followup": { "when": "tomorrow|in_3_days|next_week|in_2_weeks", "summary": "what to follow up about" }',
    ].filter(Boolean).join(",\n");

    const sys = `You are a freight brokerage sales coach. Analyze the call below and return STRICT JSON with ONLY these fields:\n{\n${fieldSpec}\n}\nNo other keys. No markdown fences. If you can't fill a field meaningfully, omit it.`;

    const usr = `Contact: ${contact.name}${contact.company ? ` (${contact.company})` : ""}${contact.title ? `, ${contact.title}` : ""}\nCall outcome: ${outcome ?? "not specified"}\n\n${source}`;

    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: sys },
            { role: "user", content: usr },
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
        max_tokens: 900,
    });

    let feedback: Record<string, unknown> = {};
    try {
        feedback = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    } catch {
        feedback = { raw: completion.choices[0]?.message?.content ?? "" };
    }

    return NextResponse.json({ feedback });
}
