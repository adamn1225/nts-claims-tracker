/**
 * GET /api/goto/test-user-activity
 * 
 * Test endpoint to fetch user activity report from GoTo Call Reports API
 * https://api.goto.com/call-reports/v1/reports/user-activity
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminGoToToken } from "@/lib/goto-utils";

export async function GET(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: teamMember } = await supabase
        .from("team_members")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

    if (!teamMember?.is_admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminToken = await getAdminGoToToken();
    if (!adminToken) {
        return NextResponse.json({ error: "No admin GoTo token" });
    }

    // Parse query params (optional date range)
    const { searchParams } = new URL(request.url);
    const daysBack = parseInt(searchParams.get("daysBack") || "7");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");

    // Calculate date range (last N days)
    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - daysBack);

    try {
        const url = new URL("https://api.goto.com/call-reports/v1/reports/user-activity");
        url.searchParams.set("startTime", startTime.toISOString());
        url.searchParams.set("endTime", endTime.toISOString());
        url.searchParams.set("page", "0");
        url.searchParams.set("pageSize", pageSize.toString());
        // Note: sort by total call volume descending
        url.searchParams.set("sort", "-totalCallVolume");

        console.log(`[User Activity] Fetching from ${startTime.toISOString()} to ${endTime.toISOString()}`);

        const response = await fetch(url.toString(), {
            headers: {
                Authorization: `Bearer ${adminToken}`,
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            const errorBody = await response.text();
            return NextResponse.json({
                error: `HTTP ${response.status}`,
                errorBody,
                requestUrl: url.toString(),
            });
        }

        const data = await response.json();

        // Extract useful summary stats
        const users = data.items || [];
        const totalUsers = users.length;

        // Debug: Log first user to see what fields GoTo returns
        if (users.length > 0) {
            console.log(`[User Activity] Sample user data:`, JSON.stringify(users[0], null, 2));
        }

        // GoTo returns data in a nested dataValues object
        const totalCalls = users.reduce((sum: number, u: any) => sum + (u.dataValues?.volume || 0), 0);
        const totalDuration = users.reduce((sum: number, u: any) => sum + (u.dataValues?.totalDuration || 0), 0);
        const totalDurationSeconds = Math.round(totalDuration / 1000); // Convert milliseconds to seconds
        const avgCallsPerUser = totalUsers > 0 ? (totalCalls / totalUsers).toFixed(1) : "0";

        // Top 10 users by call volume
        const topUsers = users
            .sort((a: any, b: any) => (b.dataValues?.volume || 0) - (a.dataValues?.volume || 0))
            .slice(0, 10)
            .map((u: any) => {
                const dv = u.dataValues || {};
                return {
                    userName: u.userName,
                    userId: u.userId,
                    totalCalls: dv.volume || 0,
                    inboundCalls: dv.inboundVolume || 0,
                    outboundCalls: dv.outboundVolume || 0,
                    totalDuration: Math.round((dv.totalDuration || 0) / 1000), // Convert ms to seconds
                    avgDuration: Math.round((dv.averageDuration || 0) / 1000), // Convert ms to seconds
                };
            });

        return NextResponse.json({
            success: true,
            dateRange: {
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                daysBack,
            },
            summary: {
                totalUsers,
                totalCalls,
                totalDurationSeconds,
                avgCallsPerUser,
            },
            topUsers,
            pagination: {
                page: data.page || 0,
                pageSize: data.pageSize || pageSize,
                totalPages: data.totalPages,
                totalRecords: data.totalRecords,
            },
            fullResponse: data, // Include complete response for inspection
        });
    } catch (err) {
        return NextResponse.json({
            error: String(err),
        });
    }
}
