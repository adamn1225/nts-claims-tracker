import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getGoToAccessToken,
  getGoToConnection,
  fetchGoToCallHistory,
  fetchGoToVoicemails,
  enrichVoicemailTranscriptions,
} from "@/lib/goto-utils";

/**
 * GET /api/goto/communication-history
 *
 * Fetches actual GoTo call history and voicemails for a customer's phone
 * number(s). Used by the AI call-brief to supplement CRM contact log data
 * with real communication records.
 *
 * Query params:
 *   phones      — comma-separated list of phone numbers (URL-encoded)
 *   lookbackDays — how many days back to search (default: 90, max: 180)
 *
 * Response:
 *   {
 *     calls:      GoToCallRecord[],
 *     voicemails: GoToVoicemail[],
 *     hasGoTo:    boolean,        // false if user has no GoTo connection
 *     scopeError: boolean,        // true if 403 — needs re-auth with new scopes
 *   }
 *
 * Required GoTo OAuth scopes:
 *   call-history.v1.read
 *   voicemail.v1.read
 *
 * Note: Users who authorized GoTo before these scopes were added will need
 * to re-authorize in Settings → GoTo Connect.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const phonesParam = searchParams.get("phones") ?? "";
  const lookbackDays = Math.min(
    180,
    Math.max(1, parseInt(searchParams.get("lookbackDays") ?? "90", 10)),
  );

  const customerPhones = phonesParam
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  // Ensure the user has a GoTo connection
  const connection = await getGoToConnection(user.id);
  if (!connection) {
    return NextResponse.json({
      calls: [],
      voicemails: [],
      hasGoTo: false,
      scopeError: false,
    });
  }

  const accessToken = await getGoToAccessToken(user.id);
  if (!accessToken) {
    return NextResponse.json(
      { error: "GoTo session expired. Please reconnect in Settings." },
      { status: 401 },
    );
  }

  // Fetch call history and voicemails in parallel
  const [calls, rawVoicemails] = await Promise.all([
    fetchGoToCallHistory(accessToken, customerPhones, lookbackDays),
    connection.account_key
      ? fetchGoToVoicemails(
          accessToken,
          connection.account_key,
          customerPhones,
          lookbackDays,
        )
      : Promise.resolve([]),
  ]);

  // Enrich voicemails with transcriptions (up to 5 most recent)
  const voicemails =
    rawVoicemails.length > 0
      ? await enrichVoicemailTranscriptions(accessToken, rawVoicemails)
      : [];

  return NextResponse.json({
    calls,
    voicemails,
    hasGoTo: true,
    scopeError: false,
  });
}
