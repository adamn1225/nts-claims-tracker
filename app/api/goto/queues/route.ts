/**
 * GET /api/goto/queues
 *
 * Returns the list of all GoTo call queues in the org.
 * Used by the Performance Dashboard to populate the queue filter dropdown.
 *
 * Requires the admin GoTo connection (voice-admin.v1.read scope).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAdminGoToToken,
  getAdminNumericAccountKey,
  fetchGoToCallQueues,
} from "@/lib/goto-utils";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    return NextResponse.json({ queues: [], error: "No admin GoTo connection" });
  }

  const numericAccountKey = await getAdminNumericAccountKey(adminToken);
  if (!numericAccountKey) {
    return NextResponse.json({ queues: [], error: "Could not determine account key" });
  }

  const queues = await fetchGoToCallQueues(adminToken, numericAccountKey);

  return NextResponse.json({
    queues: queues.map((q) => ({ id: q.id, name: q.name, extension: q.extensionNumber })),
    total: queues.length,
  });
}
