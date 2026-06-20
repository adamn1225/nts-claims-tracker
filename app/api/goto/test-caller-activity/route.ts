import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminGoToToken } from "@/lib/goto-utils";

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: broker } = await supabase.from("brokers").select("is_admin").eq("id", user.id).single();
    if (!broker?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const adminToken = await getAdminGoToToken();
    if (!adminToken) return NextResponse.json({ error: "No admin GoTo token found" }, { status: 503 });

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000); // last 7 days
    const results: Record<string, unknown>[] = [];

    // ── Test 1: user-activity summary (all users) ────────────────────────────
    // This tells us the userId UUID format and maps to known users.
    {
        try {
            const url = new URL("https://api.goto.com/call-reports/v1/reports/user-activity");
            url.searchParams.set("startTime", startTime.toISOString());
            url.searchParams.set("endTime", endTime.toISOString());
            url.searchParams.set("pageSize", "5");

            const resp = await fetch(url.toString(), {
                headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
            });
            const body = await resp.json().catch(() => null);

            results.push({
                endpoint: "user-activity (summary, all users)",
                status: resp.status,
                ok: resp.ok,
                itemCount: body?.items?.length ?? 0,
                hasNextPage: !!body?.nextPageMarker,
                // Show first 3 users so we can see userId UUID format + userName
                sampleUsers: (body?.items ?? []).slice(0, 3).map((u: Record<string, unknown>) => ({
                    userId: u.userId,
                    userName: u.userName,
                    totalCallVolume: u.totalCallVolume,
                    outboundCallVolume: u.outboundCallVolume,
                    inboundCallVolume: u.inboundCallVolume,
                })),
                error: !resp.ok ? body : undefined,
            });

            // ── Test 2: user-activity detail for first user ──────────────────
            // If summary worked and returned users, drill into first one to see
            // individual call record shape (timestamps, callee numbers, direction).
            const firstUser = body?.items?.[0];
            if (resp.ok && firstUser?.userId) {
                const detailUrl = new URL(`https://api.goto.com/call-reports/v1/reports/user-activity/${encodeURIComponent(firstUser.userId)}`);
                detailUrl.searchParams.set("startTime", startTime.toISOString());
                detailUrl.searchParams.set("endTime", endTime.toISOString());
                detailUrl.searchParams.set("pageSize", "3");

                const detailResp = await fetch(detailUrl.toString(), {
                    headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
                });
                const detailBody = await detailResp.json().catch(() => null);

                results.push({
                    endpoint: `user-activity/detail (userId: ${firstUser.userId}, userName: ${firstUser.userName})`,
                    status: detailResp.status,
                    ok: detailResp.ok,
                    itemCount: detailBody?.items?.length ?? 0,
                    // Full first record — we need to see all fields
                    sampleRecord: detailBody?.items?.[0] ?? null,
                    error: !detailResp.ok ? detailBody : undefined,
                });
            }
        } catch (err) {
            results.push({ endpoint: "user-activity", status: 0, ok: false, error: String(err) });
        }
    }

    // ── Test 3: caller-activity (external callers — kept for reference) ──────
    // Returns calls from external phone numbers INTO the org.
    // Note: internal org DIDs will return 0 records here — that's expected.
    {
        try {
            const url = new URL("https://api.goto.com/call-reports/v1/reports/caller-activity");
            url.searchParams.set("startTime", startTime.toISOString());
            url.searchParams.set("endTime", endTime.toISOString());
            url.searchParams.set("pageSize", "3");

            const resp = await fetch(url.toString(), {
                headers: { Authorization: `Bearer ${adminToken}`, Accept: "application/json" },
            });
            const body = await resp.json().catch(() => null);

            results.push({
                endpoint: "caller-activity (external callers only — org DIDs return 0 here)",
                status: resp.status,
                ok: resp.ok,
                itemCount: body?.items?.length ?? 0,
                note: "External callers only. Use user-activity for internal org users.",
                sampleRecord: body?.items?.[0] ?? null,
                error: !resp.ok ? body : undefined,
            });
        } catch (err) {
            results.push({ endpoint: "caller-activity", status: 0, ok: false, error: String(err) });
        }
    }

    return NextResponse.json({ results });
}
