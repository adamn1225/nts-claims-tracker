import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/call-sessions/import
 * Body: { listId: string, csv: string }
 *
 * Parses a CSV string and inserts contacts into the list.
 * Expected headers (case-insensitive, any subset): name, company, title,
 * phone, email, city, state, industry, tags, notes
 *
 * Tags can be a comma- or pipe-separated string in a single column.
 */

const HEADER_MAP: Record<string, string> = {
    name: "name", fullname: "name", "full name": "name", "contact": "name", "contact name": "name",
    company: "company", organization: "company", org: "company",
    title: "title", role: "title", position: "title",
    phone: "phone", "phone number": "phone", mobile: "phone", cell: "phone",
    email: "email", "email address": "email",
    city: "city", state: "state", st: "state",
    industry: "industry", vertical: "industry",
    tags: "tags", labels: "tags",
    notes: "notes", note: "notes", description: "notes",
};

function parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (ch === '"') inQuotes = false;
            else cur += ch;
        } else {
            if (ch === '"') inQuotes = true;
            else if (ch === ",") { out.push(cur); cur = ""; }
            else cur += ch;
        }
    }
    out.push(cur);
    return out.map((s) => s.trim());
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const listId: string | undefined = body.listId;
    const csv: string | undefined = body.csv;

    if (!listId || typeof csv !== "string" || !csv.trim()) {
        return NextResponse.json({ error: "listId and csv are required" }, { status: 400 });
    }

    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
        return NextResponse.json({ error: "CSV must contain a header row and at least one data row" }, { status: 400 });
    }

    const rawHeaders = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const fields = rawHeaders.map((h) => HEADER_MAP[h] ?? null);

    const rows: Record<string, unknown>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const row: Record<string, unknown> = { list_id: listId, broker_id: user.id };
        fields.forEach((field, idx) => {
            if (!field) return;
            const value = cols[idx] ?? "";
            if (!value) return;
            if (field === "tags") {
                row.tags = value.split(/[,|]/).map((t) => t.trim()).filter(Boolean);
            } else {
                row[field] = value;
            }
        });
        if (typeof row.name === "string" && (row.name as string).trim()) {
            rows.push(row);
        }
    }

    if (rows.length === 0) {
        return NextResponse.json({ error: "No rows with a name column were found" }, { status: 400 });
    }

    const { data, error } = await supabase.from("dialer_contacts").insert(rows).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ inserted: data?.length ?? 0, contacts: data ?? [] });
}
