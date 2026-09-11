/**
 * Imports the Logistics Representative roster (CSV export) into `team_members`,
 * which backs the `broker_directory` view used by the claim intake form's
 * "Logistics representative" selector.
 *
 * Usage:
 *   set -a && . ./.env && set +a && npx tsx scripts/import-team-members.ts [path/to.csv]
 *
 * Idempotent: upserts on the unique `email` column, so re-running updates
 * existing rows instead of creating duplicates.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const CSV_PATH = process.argv[2] ?? "broker-list.csv";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
);

/** Minimal RFC-4180 parser — handles quoted fields containing commas. */
function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuotes) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += char;
            }
            continue;
        }
        if (char === '"') inQuotes = true;
        else if (char === ",") {
            row.push(field);
            field = "";
        } else if (char === "\n") {
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        } else if (char !== "\r") {
            field += char;
        }
    }
    if (field || row.length) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

/**
 * Roster names carry noise from the source sheet: a "Specialist: " label
 * prefix and office suffixes like "Sam Duncan - WPB".
 */
function splitName(raw: string): { first: string; last: string } | null {
    const cleaned = raw
        .replace(/^\s*specialist:\s*/i, "")
        .replace(/\s+-\s+\S+$/, "")
        .trim()
        .replace(/\s+/g, " ");
    if (!cleaned) return null;
    const parts = cleaned.split(" ");
    return {
        first: parts[0],
        last: parts.slice(1).join(" ") || parts[0],
    };
}

type TeamMemberRow = {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    office_location: string | null;
    job_title: string | null;
    is_active: boolean;
    source: "csv_import";
    notes: string | null;
};

async function main() {
    const rows = parseCsv(readFileSync(CSV_PATH, "utf8"));
    const [, ...dataRows] = rows;

    const byName = new Map<string, TeamMemberRow>();
    const skipped: string[] = [];

    for (const cols of dataRows) {
        const [userName, email, phone, branch, startDate, title] = cols.map((c) =>
            (c ?? "").trim(),
        );
        if (!email) continue;

        const name = splitName(userName);
        if (!name) {
            skipped.push(email);
            continue;
        }

        // One dropdown entry per person: the sheet lists some reps twice under
        // alias addresses, so the first row for a name wins.
        const key = `${name.first} ${name.last}`.toLowerCase();
        if (byName.has(key)) {
            skipped.push(`${userName} <${email}> (duplicate of ${key})`);
            continue;
        }

        byName.set(key, {
            first_name: name.first,
            last_name: name.last,
            email: email.toLowerCase(),
            phone: phone || null,
            office_location: branch || null,
            job_title: title || null,
            is_active: true,
            source: "csv_import",
            notes: startDate ? `Broker since ${startDate}` : null,
        });
    }

    const records = [...byName.values()];
    console.log(`Parsed ${records.length} team members from ${CSV_PATH}`);
    if (skipped.length) {
        console.log(`Skipped ${skipped.length}:\n  ${skipped.join("\n  ")}`);
    }

    const { data, error } = await supabase
        .from("team_members")
        .upsert(records, { onConflict: "email" })
        .select("id");

    if (error) {
        console.error("Import failed:", error.message);
        process.exit(1);
    }
    console.log(`Upserted ${data?.length ?? 0} rows into team_members.`);
}

main();
