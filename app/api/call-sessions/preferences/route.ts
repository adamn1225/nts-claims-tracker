import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PREF_FIELDS = [
    "pre_call_brief", "post_performance", "post_tips",
    "post_email_draft", "post_sms_draft", "post_suggest_followup",
    "manual_advance", "auto_advance_delay_sec",
] as const;

const DEFAULTS = {
    pre_call_brief: true,
    post_performance: true,
    post_tips: true,
    post_email_draft: true,
    post_sms_draft: false,
    post_suggest_followup: true,
    manual_advance: true,
    auto_advance_delay_sec: 10,
};

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data } = await supabase
        .from("dialer_ai_preferences")
        .select("*")
        .eq("team_member_id", user.id)
        .maybeSingle();

    return NextResponse.json({ preferences: data ?? { team_member_id: user.id, ...DEFAULTS } });
}

export async function PATCH(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = { team_member_id: user.id };
    for (const f of PREF_FIELDS) {
        if (body[f] !== undefined) updates[f] = body[f];
    }

    const { data, error } = await supabase
        .from("dialer_ai_preferences")
        .upsert(updates, { onConflict: "team_member_id" })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ preferences: data });
}
