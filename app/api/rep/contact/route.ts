import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { teamMemberId, firstName, lastName, company, email, phone, message } = body;

    // Validate required fields
    if (!teamMemberId || !firstName?.trim() || !lastName?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "First name, last name, and email are required." },
        { status: 400 },
      );
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    // Service-role client: the submitter is anonymous, so we must bypass RLS
    // to verify the team member and create the lead. Server-side only — never
    // expose this key to the client.
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the team member exists and is active before creating a lead
    const { data: teamMember, error: teamMemberErr } = await supabase
      .from("team_members")
      .select("id, first_name, last_name")
      .eq("id", teamMemberId)
      .eq("is_active", true)
      .single();

    if (teamMemberErr || !teamMember) {
      return NextResponse.json({ error: "Team member not found." }, { status: 404 });
    }

    // Build the notes string from the message
    const notes = [
      message?.trim() ? `Inquiry: ${message.trim()}` : null,
      `Source: Public landing page (/rep/)`,
      `Submitted: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET`,
    ]
      .filter(Boolean)
      .join("\n");

    // Create the customer/prospect record assigned to this teamMember
    const { error: insertErr } = await supabase.from("customers").insert({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      business_name: company?.trim() || null,
      email: email.trim(),
      phone: phone?.trim() || null,
      notes,
      team_member_id: teamMemberId,
      status: "Prospect",
      on_kanban_board: true,
      import_source: "public_landing_page",
    });

    if (insertErr) {
      console.error("Rep contact insert error:", insertErr);
      return NextResponse.json(
        { error: "Could not save your request. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Rep contact route error:", err);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
