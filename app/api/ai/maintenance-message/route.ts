/**
 * POST /api/ai/maintenance-message
 *
 * Admin-only helper that writes or improves the short user-facing message shown
 * on the maintenance page (and used in the advance-warning email). Keeps tone
 * calm, friendly, and professional for a freight-team-member CRM audience.
 *
 * Request body:
 *   mode?           "write" | "improve"  (default "write")
 *   currentMessage? string               existing draft to improve / build on
 *   instructions?   string               optional steering from the admin
 *   startsAt?       string               ISO timestamp (optional, for context)
 *   endsAt?         string               ISO timestamp (optional, for context)
 *
 * Response: { message: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

function formatWhen(iso?: string | null): string | null {
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

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "AI assistance is not configured (missing API key)." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: teamMember } = await supabase
    .from("team_members")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!teamMember?.is_admin) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  }

  let body: {
    mode?: "write" | "improve";
    currentMessage?: string;
    instructions?: string;
    startsAt?: string | null;
    endsAt?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode = body.mode === "improve" ? "improve" : "write";
  const current = (body.currentMessage || "").trim();
  const instructions = (body.instructions || "").trim();
  const startsAt = formatWhen(body.startsAt);
  const endsAt = formatWhen(body.endsAt);

  const contextLines: string[] = [];
  if (startsAt) contextLines.push(`Maintenance starts: ${startsAt}`);
  if (endsAt) contextLines.push(`Expected back online: ${endsAt}`);

  const systemPrompt = [
    "You write short, friendly, professional maintenance notices for an internal freight-team-member CRM called NTS Claims Tracker.",
    "Audience: busy freight team members and sales reps. Keep it calm, reassuring, and human.",
    "Rules:",
    "- 1 to 3 short sentences. No greeting line, no signature, no subject line.",
    "- Plain text only. No markdown, no emojis, no placeholders like [time].",
    "- Do not invent specific times unless they are provided in the context.",
    "- If timing context is provided, you may reference it naturally.",
    "- Output ONLY the message text, nothing else.",
  ].join("\n");

  const userPrompt =
    mode === "improve" && current
      ? [
          "Improve the following maintenance message. Keep its intent but make it clearer, warmer, and more concise.",
          instructions ? `Extra guidance: ${instructions}` : "",
          contextLines.length ? `Context:\n${contextLines.join("\n")}` : "",
          "",
          `Current message:\n${current}`,
        ]
          .filter(Boolean)
          .join("\n")
      : [
          "Write a maintenance message for the page users see while the app is offline.",
          instructions ? `Guidance: ${instructions}` : "",
          current ? `Build on this rough draft if helpful:\n${current}` : "",
          contextLines.length ? `Context:\n${contextLines.join("\n")}` : "",
        ]
          .filter(Boolean)
          .join("\n");

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 160,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const message = completion.choices[0]?.message?.content?.trim();
    if (!message) {
      return NextResponse.json(
        { error: "AI did not return a message." },
        { status: 502 },
      );
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error("maintenance-message AI error:", error);
    return NextResponse.json(
      { error: "Failed to generate message." },
      { status: 500 },
    );
  }
}
