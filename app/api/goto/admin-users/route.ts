/**
 * GET /api/goto/admin-users
 *
 * Admin-only endpoint. Uses the org admin GoTo token to fetch all GoTo users
 * in the organization and maps their GoTo user key → email address.
 *
 * This mapping is needed so the admin proxy can pull call history for a
 * specific broker even when that broker hasn't connected GoTo individually.
 *
 * Also optionally stores each broker's goto_user_key on their goto_connections
 * row (upserted) so future lookups are fast.
 *
 * Response:
 *   {
 *     users: Array<{ key: string; email: string; name: string; status: string }>
 *   }
 *
 * Required: admin must have a goto_connections row with is_admin_token = true
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminGoToToken } from "@/lib/goto-utils";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins may call this endpoint
  const { data: broker } = await supabase
    .from("brokers")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!broker?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminToken = await getAdminGoToToken();
  if (!adminToken) {
    return NextResponse.json(
      { error: "No admin GoTo connection found. Connect GoTo as admin first." },
      { status: 424 }, // 424 Failed Dependency
    );
  }

  // Get admin connection's account key
  const { data: adminConn } = await supabase
    .from("goto_connections")
    .select("account_key")
    .eq("is_admin_token", true)
    .maybeSingle();

  if (!adminConn?.account_key) {
    return NextResponse.json(
      { error: "Admin GoTo connection is missing account_key. Re-authenticate." },
      { status: 424 },
    );
  }

  try {
    // Fetch all users in the org (paginated — fetch up to 200)
    const url = new URL("https://api.goto.com/admin/v1/users");
    url.searchParams.set("accountKey", adminConn.account_key);
    url.searchParams.set("pageSize", "200");

    const resp = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[admin-users] GoTo fetch failed:", resp.status, errText);
      return NextResponse.json(
        { error: `GoTo API error: ${resp.status}` },
        { status: 502 },
      );
    }

    const data = await resp.json();

    type GoToUser = {
      key: string;
      email: string;
      firstName?: string;
      lastName?: string;
      status?: string;
    };

    const gotoUsers: GoToUser[] = data?.results ?? [];

    const users = gotoUsers.map((u) => ({
      key: u.key,
      email: u.email,
      name: [u.firstName, u.lastName].filter(Boolean).join(" "),
      status: u.status ?? "unknown",
    }));

    // Best-effort: store goto_user_key on matching brokers' goto_connections rows
    // so future lookups skip this API call entirely.
    // We match GoTo email → brokers.email
    if (users.length > 0) {
      const { data: allBrokers } = await supabase
        .from("brokers")
        .select("id, email");

      if (allBrokers) {
        const emailToGotoKey: Record<string, string> = {};
        for (const u of users) {
          if (u.email) emailToGotoKey[u.email.toLowerCase()] = u.key;
        }

        // Upsert goto_user_key for each broker who has a goto_connections row
        // (non-admin rows only)
        for (const b of allBrokers) {
          const gotoKey = emailToGotoKey[b.email.toLowerCase()];
          if (!gotoKey) continue;

          await supabase
            .from("goto_connections")
            .update({ goto_user_key: gotoKey, updated_at: new Date().toISOString() })
            .eq("user_id", b.id)
            .eq("is_admin_token", false);
        }
      }
    }

    return NextResponse.json({ users });
  } catch (err) {
    console.error("[admin-users] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
