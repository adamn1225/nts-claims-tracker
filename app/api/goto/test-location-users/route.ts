/**
 * GET /api/goto/test-location-users
 * 
 * Test endpoint to fetch users for each GoTo location
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminGoToToken } from "@/lib/goto-utils";

export async function GET() {
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

    // Hardcode the 10 location IDs from the locations response
    const locationIds = [
        { id: "4459089239493594995", name: "Cleveland OHIO" },
        { id: "2767105830557798220", name: "Doral" },
        { id: "5144884689768367582", name: "Florence Kentucky" },
        { id: "4226394339117384806", name: "Fort Myers" },
        { id: "2120791174635144366", name: "Fort Pierce" },
        { id: "4087838012650833327", name: "(HQ) Fort Lauderdale" },
        { id: "1307166020935369247", name: "Jacksonville" },
        { id: "8635524298240639128", name: "Orlando FL" },
        { id: "4483824012981846943", name: "Tampa Bay FL" },
        { id: "6191713196749180266", name: "West Palm beach" },
    ];

    const results: any[] = [];
    const userToLocation = new Map<string, string>(); // userKey -> locationName

    try {
        // Fetch users for each location
        for (const location of locationIds) {
            const url = new URL(`https://api.goto.com/voice-admin/v1/locations/${location.id}/users`);
            url.searchParams.set("pageSize", "100");

            const response = await fetch(url.toString(), {
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                results.push({
                    locationId: location.id,
                    locationName: location.name,
                    error: `HTTP ${response.status}`,
                    errorBody: await response.text(),
                });
                continue;
            }

            const data = await response.json();
            const users = data.items || [];

            // DEBUG: Log first user structure to see available fields
            if (users.length > 0 && results.length === 0) {
                console.log(`[Location Users] Sample user from ${location.name}:`, JSON.stringify(users[0], null, 2));
                console.log(`[Location Users] User keys available:`, Object.keys(users[0]));
            }

            // Track which users belong to this location
            for (const user of users) {
                if (user.userKey) {
                    userToLocation.set(user.userKey, location.name);
                }
            }

            results.push({
                locationId: location.id,
                locationName: location.name,
                userCount: users.length,
                sampleUser: users.length > 0 ? users[0] : null, // Include full first user for debugging
                users: users.map((u: any) => ({
                    userKey: u.userKey,
                })),
            });
        }

        // Summary stats
        const totalUsersAcrossLocations = Array.from(userToLocation.keys()).length;
        const locationMap = results
            .filter(r => !r.error)
            .reduce((map, r) => {
                map.set(r.locationName, r.userCount);
                return map;
            }, new Map<string, number>());

        const locationDistribution = [...locationMap.entries()].map(([name, count]) => ({
            name,
            count
        }));

        return NextResponse.json({
            success: true,
            totalLocations: locationIds.length,
            totalUsersWithLocation: totalUsersAcrossLocations,
            locationDistribution,
            userToLocationMap: Array.from(userToLocation.entries()), // All user→location mappings
            detailedResults: results,
        });
    } catch (err) {
        return NextResponse.json({
            error: String(err),
        });
    }
}
