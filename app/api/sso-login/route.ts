// app/api/sso-login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { success: false, error: "Missing token" },
      { status: 400 },
    );
  }

  try {
    // The CRM-issued JWT only carries the user's email. Everything else
    // (names, office, admin/manager flags) is managed inside this app by an
    // admin during onboarding via the complete-profile flow — the CRM has
    // no knowledge of those fields. Do NOT pretend the token contains them.
    const payload = jwt.verify(token, process.env.DOTNET_SECRET!) as {
      email: string;
    };

    // Generate the magic link first.
    // generateLink() creates the Supabase auth user if they don't exist yet,
    // and always returns the correct user object — no listUsers() pagination needed.
    const { data: magicLinkData, error: magicLinkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: payload.email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL!}/auth/sso`,
        },
      });

    if (magicLinkError || !magicLinkData?.properties?.action_link) {
      throw magicLinkError || new Error("Failed to generate magic link");
    }

    // magicLinkData.user is always the correct user — no pagination issues
    const userId = magicLinkData.user.id;

    // Check whether the team member row already exists. We must NEVER overwrite
    // app-managed fields (is_admin, is_manager, office_location, names, etc.)
    // with data from the external CRM JWT — the JWT doesn't know about app-level
    // permissions, so doing so silently strips admin/manager rights on every SSO login.
    const { data: existingTeamMember } = await supabase
      .from("team_members")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    let teamMemberError: any = null;

    if (!existingTeamMember) {
      // First-time SSO login — create a minimal teamMember row. All profile fields
      // (first_name, last_name, office_location, phone, admin/manager flags) are
      // intentionally left null/false. The middleware will redirect the user to
      // /auth/complete-profile to fill them in, and an admin can grant elevated
      // permissions afterward. We do NOT derive a fake first_name from the email
      // local part — that just produces garbage like "jj" that the user has to
      // overwrite anyway.
      const { error } = await supabase.from("team_members").insert({
        id: userId,
        email: payload.email,
        first_name: null,
        last_name: null,
        phone: null,
        office_location: null,
        is_admin: false,
        is_manager: false,
        is_active: true,
      });
      teamMemberError = error;
    } else {
      // Existing teamMember — only refresh email and re-activate the account.
      // NEVER touch is_admin/is_manager, office_location, names, or phone —
      // those are managed inside this app.
      const { error } = await supabase
        .from("team_members")
        .update({
          email: payload.email,
          is_active: true,
        })
        .eq("id", userId);
      teamMemberError = error;
    }

    if (teamMemberError) {
      // On a brand-new SSO sign-up, the team member INSERT failing leaves the user
      // with an auth account but no team member row — middleware then can't decide
      // what to do and the dashboard spins forever. Fail loudly so the SSO
      // page surfaces a real error instead of stranding the user.
      console.error("Failed to create/update team member record:", teamMemberError);
      if (!existingTeamMember) {
        return NextResponse.json(
          {
            success: false,
            error: `Could not create your team member profile: ${teamMemberError.message}. Please contact an admin.`,
          },
          { status: 500 },
        );
      }
      // For an existing teamMember, a failed UPDATE is non-fatal — they can still log in.
    }

    const magicLink = magicLinkData.properties.action_link;

    return NextResponse.json({ success: true, magicLink });
  } catch (err: any) {
    console.error("SSO login error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Unknown error" },
      { status: 500 },
    );
  }
}

