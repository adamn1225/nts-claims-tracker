#!/usr/bin/env tsx
/**
 * Fast bulk reimport of `completed_orders` from CRM CSV exports.
 *
 * Strategy (vastly faster than the Supabase REST upsert path):
 *   1. Stream every CSV, parse using the same helpers as the REST loader.
 *   2. Stream parsed rows over a single `COPY FROM stdin` into an UNLOGGED
 *      staging table.
 *   3. Run one `INSERT … SELECT … ON CONFLICT (order_id) DO UPDATE SET …`
 *      to merge staging into `completed_orders`.
 *   4. Drop the staging table.
 *
 * Uses DIRECT_URL (port 5432 session pooler) — NOT pgbouncer transaction
 * mode — so the long-lived COPY session works correctly.
 *
 * Usage:
 *   npx tsx scripts/reimport-fast.ts
 *   npx tsx scripts/reimport-fast.ts --dir=leads-orders-exports
 *   npx tsx scripts/reimport-fast.ts --file=path/to/single.csv
 *
 * Env (auto-loaded from .env.local, then .env):
 *   DIRECT_URL  (preferred — session-mode pooler, port 5432)
 *   DATABASE_URL  (fallback)
 */

import { Client } from "pg";
import { from as copyFrom } from "pg-copy-streams";
import fs from "fs";
import path from "path";
import readline from "readline";
import {
    parseCsvLine,
    parseCurrencyNumeric,
    parseNumeric,
    parseIntOrNull,
    parseDateIso,
    parseDurationMinutes,
    parseBoolean,
    normalizeEquipment,
    classifyLoadType,
    isOversize,
    isOverweight,
    isSuperload,
} from "../lib/csv/completed-orders-parsers";

// ── env loader (no runtime dep) ─────────────────────────────────────────────
function loadDotenv(file: string) {
    if (!fs.existsSync(file)) return;
    for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = value;
    }
}
loadDotenv(path.resolve(".env.local"));
loadDotenv(path.resolve(".env"));

const CONN_STRING = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!CONN_STRING) {
    console.error("Missing DIRECT_URL or DATABASE_URL in .env.local");
    process.exit(1);
}

// ── CLI ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argMap = new Map<string, string>();
for (const a of args) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) argMap.set(m[1], m[2] ?? "true");
}
const SINGLE_FILE = argMap.get("file");
const DIR = argMap.get("dir") ?? "leads-orders-exports";

// ── Header mapping (same as the REST script) ────────────────────────────────
type FieldKey =
    | "orderId" | "customerType" | "orderSubType"
    | "shipperName" | "shipperPhone" | "shipperEmail" | "verifiedShipper"
    | "orderCreated" | "estShipDate" | "deliveredDate" | "quotedDate"
    | "orderSent" | "orderSigned"
    | "carrierCompanyName" | "carrierPay" | "codToCarrier"
    | "quotePrice" | "cargoValue" | "brokerBalance"
    | "brokerAssign" | "assignedTo" | "brokerBranch"
    | "originCity" | "originState" | "originZip" | "originCountry"
    | "destinationCity" | "destinationState" | "destinationZip" | "destinationCountry"
    | "cargo" | "shipVia" | "orderStatus"
    | "duration" | "distance"
    | "loadName" | "make" | "model" | "year"
    | "length" | "width" | "height" | "weight"
    | "trailerType" | "vehicleType"
    | "campaignSource" | "campaignMedium" | "campaignName"
    | "campaignContent" | "campaignKeyword";

const HEADER_ALIASES: Record<FieldKey, string[]> = {
    orderId: ["orderid"],
    customerType: ["customertype"],
    orderSubType: ["ordersubtype"],
    shipperName: ["shippername"],
    shipperPhone: ["shipperphone"],
    shipperEmail: ["shipperemail"],
    verifiedShipper: ["verifiedshippercheck", "verified_shipper", "verifiedshipper"],
    orderCreated: ["ordercreated", "createddate"],
    estShipDate: ["estimatedshipdate", "estshipdate"],
    deliveredDate: ["delivereddate"],
    quotedDate: ["quoteddate"],
    orderSent: ["ordersent"],
    orderSigned: ["ordersigned"],
    carrierCompanyName: ["carriercompanyname", "carriername"],
    carrierPay: ["carrierpay"],
    codToCarrier: ["codtocarrier"],
    quotePrice: ["quoteprice", "price"],
    cargoValue: ["cargovalue"],
    brokerBalance: ["brokerbalance"],
    brokerAssign: ["brokerassign"],
    assignedTo: ["assignedto"],
    brokerBranch: ["brokerbranch"],
    originCity: ["origincity"],
    originState: ["originstate"],
    originZip: ["originzip"],
    originCountry: ["origincountry"],
    destinationCity: ["destinationcity"],
    destinationState: ["destinationstate"],
    destinationZip: ["destinationzip"],
    destinationCountry: ["destinationcountry"],
    cargo: ["cargo"],
    shipVia: ["shipvia"],
    orderStatus: ["orderstatus", "status"],
    duration: ["duration"],
    distance: ["distance"],
    loadName: ["name", "loadname"],
    make: ["make"],
    model: ["model"],
    year: ["year"],
    length: ["length"],
    width: ["width"],
    height: ["height"],
    weight: ["weight"],
    trailerType: ["trailertype"],
    vehicleType: ["vehicletype"],
    campaignSource: ["campaignsource"],
    campaignMedium: ["campaignmedium"],
    campaignName: ["campaignname"],
    campaignContent: ["campaigncontent"],
    campaignKeyword: ["campaignkeyword"],
};

function buildColumnMap(headers: string[]): Partial<Record<FieldKey, string>> {
    const normalized = headers.map((h) => ({
        original: h,
        norm: h.toLowerCase().replace(/[\s_]+/g, ""),
    }));
    const map: Partial<Record<FieldKey, string>> = {};
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [FieldKey, string[]][]) {
        const hit = normalized.find((h) => aliases.includes(h.norm));
        if (hit) map[field] = hit.original;
    }
    return map;
}

// ── Staging columns (must match TSV order written below) ───────────────────
// Order matters — this is the exact column list both for the staging DDL,
// the COPY column list, and the merge INSERT/SELECT.
const STAGING_COLUMNS: { name: string; type: string }[] = [
    { name: "order_id", type: "text" },
    { name: "order_created", type: "timestamptz" },
    { name: "carrier_company_name", type: "text" },
    { name: "carrier_pay", type: "text" },
    { name: "quote_price", type: "text" },
    { name: "origin_city", type: "text" },
    { name: "origin_state", type: "text" },
    { name: "origin_zip", type: "text" },
    { name: "destination_city", type: "text" },
    { name: "destination_state", type: "text" },
    { name: "destination_zip", type: "text" },
    { name: "cargo", type: "text" },
    { name: "ship_via", type: "text" },
    { name: "est_ship_date", type: "timestamptz" },
    { name: "delivered_date", type: "timestamptz" },
    { name: "order_status", type: "text" },
    { name: "assigned_to", type: "text" },
    { name: "customer_type", type: "text" },
    { name: "order_sub_type", type: "text" },
    { name: "shipper_name", type: "text" },
    { name: "shipper_phone", type: "text" },
    { name: "shipper_email", type: "text" },
    { name: "verified_shipper", type: "boolean" },
    { name: "origin_country", type: "text" },
    { name: "destination_country", type: "text" },
    { name: "cargo_value", type: "text" },
    { name: "quoted_date", type: "timestamptz" },
    { name: "broker_balance", type: "text" },
    { name: "broker_branch", type: "text" },
    { name: "duration_text", type: "text" },
    { name: "distance_text", type: "text" },
    { name: "load_name", type: "text" },
    { name: "make", type: "text" },
    { name: "model", type: "text" },
    { name: "year", type: "integer" },
    { name: "length_text", type: "text" },
    { name: "width_text", type: "text" },
    { name: "height_text", type: "text" },
    { name: "weight_text", type: "text" },
    { name: "trailer_type", type: "text" },
    { name: "vehicle_type", type: "text" },
    { name: "order_sent", type: "timestamptz" },
    { name: "order_signed", type: "timestamptz" },
    { name: "campaign_source", type: "text" },
    { name: "campaign_medium", type: "text" },
    { name: "campaign_name", type: "text" },
    { name: "campaign_content", type: "text" },
    { name: "campaign_keyword", type: "text" },
    { name: "carrier_pay_numeric", type: "numeric" },
    { name: "quote_price_numeric", type: "numeric" },
    { name: "cargo_value_numeric", type: "numeric" },
    { name: "broker_balance_numeric", type: "numeric" },
    { name: "distance_miles", type: "numeric" },
    { name: "duration_minutes", type: "integer" },
    { name: "length_ft", type: "numeric" },
    { name: "width_ft", type: "numeric" },
    { name: "height_ft", type: "numeric" },
    { name: "weight_lbs", type: "numeric" },
    { name: "equipment_type", type: "text" },
    { name: "is_oversize", type: "boolean" },
    { name: "is_overweight", type: "boolean" },
    { name: "is_superload", type: "boolean" },
    { name: "load_type", type: "text" },
];

// ── Row → TSV ──────────────────────────────────────────────────────────────
// Returns null when row should be skipped (missing order_id).
// Returns an array of values aligned with STAGING_COLUMNS.
function buildRow(
    row: Record<string, string>,
    columnMap: Partial<Record<FieldKey, string>>
): (string | number | boolean | null)[] | null {
    const has = (key: FieldKey) => columnMap[key] !== undefined;
    const raw = (key: FieldKey): string => {
        const h = columnMap[key];
        if (!h) return "";
        const v = (row[h] ?? "").trim();
        if (v.toUpperCase() === "NULL") return "";
        return v;
    };

    const orderId = raw("orderId");
    if (!orderId) return null;

    const carrierPayRaw = raw("carrierPay") || raw("codToCarrier");
    const carrierPayNumeric =
        parseCurrencyNumeric(raw("carrierPay")) ??
        parseCurrencyNumeric(raw("codToCarrier"));
    const quotePriceNumeric = parseCurrencyNumeric(raw("quotePrice"));
    const cargoValueNumeric = parseCurrencyNumeric(raw("cargoValue"));
    const brokerBalanceNumeric = parseCurrencyNumeric(raw("brokerBalance"));

    const clamp = (n: number | null, max: number) =>
        n === null ? null : Math.min(n, max);
    const distanceMiles = clamp(parseNumeric(raw("distance")), 999999.9);
    const durationMinutes = parseDurationMinutes(raw("duration"));
    const lengthFt = clamp(parseNumeric(raw("length")), 9999.99);
    const widthFt = clamp(parseNumeric(raw("width")), 9999.99);
    const heightFt = clamp(parseNumeric(raw("height")), 9999.99);
    const weightLbs = clamp(parseNumeric(raw("weight")), 9999999999);

    const hasEquipSignal = has("shipVia") || has("trailerType") || has("vehicleType");
    const equipmentType = hasEquipSignal
        ? normalizeEquipment(raw("shipVia"), raw("trailerType"), raw("vehicleType"))
        : null;
    const loadType =
        hasEquipSignal ||
        has("length") || has("width") || has("height") || has("weight") || has("cargo")
            ? classifyLoadType({
                equipment: equipmentType ?? "OTHER",
                lengthFt,
                widthFt,
                heightFt,
                weightLbs,
                cargo: raw("cargo"),
            })
            : null;

    const orNull = (v: string) => (v === "" ? null : v);
    const ifMapped = <T>(field: FieldKey, value: T): T | null =>
        has(field) ? value : null;

    return [
        orderId,
        ifMapped("orderCreated", parseDateIso(raw("orderCreated"))),
        ifMapped("carrierCompanyName", orNull(raw("carrierCompanyName"))),
        has("carrierPay") || has("codToCarrier") ? orNull(carrierPayRaw) : null,
        ifMapped("quotePrice", orNull(raw("quotePrice"))),
        ifMapped("originCity", orNull(raw("originCity"))),
        ifMapped("originState", orNull(raw("originState"))),
        ifMapped("originZip", orNull(raw("originZip"))),
        ifMapped("destinationCity", orNull(raw("destinationCity"))),
        ifMapped("destinationState", orNull(raw("destinationState"))),
        ifMapped("destinationZip", orNull(raw("destinationZip"))),
        ifMapped("cargo", orNull(raw("cargo"))),
        ifMapped("shipVia", orNull(raw("shipVia"))),
        ifMapped("estShipDate", parseDateIso(raw("estShipDate"))),
        ifMapped("deliveredDate", parseDateIso(raw("deliveredDate"))),
        ifMapped("orderStatus", orNull(raw("orderStatus"))),
        has("brokerAssign") || has("assignedTo")
            ? orNull(raw("brokerAssign") || raw("assignedTo"))
            : null,
        ifMapped("customerType", orNull(raw("customerType"))),
        ifMapped("orderSubType", orNull(raw("orderSubType"))),
        ifMapped("shipperName", orNull(raw("shipperName"))),
        ifMapped("shipperPhone", orNull(raw("shipperPhone"))),
        ifMapped("shipperEmail", orNull(raw("shipperEmail"))),
        ifMapped("verifiedShipper", parseBoolean(raw("verifiedShipper"))),
        ifMapped("originCountry", orNull(raw("originCountry"))),
        ifMapped("destinationCountry", orNull(raw("destinationCountry"))),
        ifMapped("cargoValue", orNull(raw("cargoValue"))),
        ifMapped("quotedDate", parseDateIso(raw("quotedDate"))),
        ifMapped("brokerBalance", orNull(raw("brokerBalance"))),
        ifMapped("brokerBranch", orNull(raw("brokerBranch"))),
        ifMapped("duration", orNull(raw("duration"))),
        ifMapped("distance", orNull(raw("distance"))),
        ifMapped("loadName", orNull(raw("loadName"))),
        ifMapped("make", orNull(raw("make"))),
        ifMapped("model", orNull(raw("model"))),
        ifMapped("year", parseIntOrNull(raw("year"))),
        ifMapped("length", orNull(raw("length"))),
        ifMapped("width", orNull(raw("width"))),
        ifMapped("height", orNull(raw("height"))),
        ifMapped("weight", orNull(raw("weight"))),
        ifMapped("trailerType", orNull(raw("trailerType"))),
        ifMapped("vehicleType", orNull(raw("vehicleType"))),
        ifMapped("orderSent", parseDateIso(raw("orderSent"))),
        ifMapped("orderSigned", parseDateIso(raw("orderSigned"))),
        ifMapped("campaignSource", orNull(raw("campaignSource"))),
        ifMapped("campaignMedium", orNull(raw("campaignMedium"))),
        ifMapped("campaignName", orNull(raw("campaignName"))),
        ifMapped("campaignContent", orNull(raw("campaignContent"))),
        ifMapped("campaignKeyword", orNull(raw("campaignKeyword"))),
        has("carrierPay") || has("codToCarrier") ? carrierPayNumeric : null,
        ifMapped("quotePrice", quotePriceNumeric),
        ifMapped("cargoValue", cargoValueNumeric),
        ifMapped("brokerBalance", brokerBalanceNumeric),
        ifMapped("distance", distanceMiles),
        ifMapped("duration", durationMinutes),
        ifMapped("length", lengthFt),
        ifMapped("width", widthFt),
        ifMapped("height", heightFt),
        ifMapped("weight", weightLbs),
        equipmentType,
        has("length") || has("width") || has("height")
            ? isOversize({ lengthFt, widthFt, heightFt })
            : null,
        has("weight") ? isOverweight(weightLbs) : null,
        has("width") || has("height") || has("weight")
            ? isSuperload({ widthFt, heightFt, weightLbs })
            : null,
        loadType,
    ];
}

// ── TSV escape ─────────────────────────────────────────────────────────────
// COPY TEXT format (default) uses tab delimiter, backslash escapes, `\N` for
// NULL. We must escape backslash, tab, newline, carriage return.
function tsvEscape(v: unknown): string {
    if (v === null || v === undefined) return "\\N";
    if (typeof v === "boolean") return v ? "t" : "f";
    if (typeof v === "number") {
        if (!Number.isFinite(v)) return "\\N";
        return String(v);
    }
    if (v instanceof Date) return v.toISOString();
    let s = String(v);
    if (s === "") return "";
    s = s
        .replace(/\\/g, "\\\\")
        .replace(/\t/g, "\\t")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r");
    return s;
}

function rowToTsv(values: (string | number | boolean | null)[]): string {
    return values.map(tsvEscape).join("\t") + "\n";
}

// ── Main work ──────────────────────────────────────────────────────────────
async function streamFile(
    filePath: string,
    push: (chunk: string) => Promise<void>
): Promise<{ rows: number; written: number; skipped: number }> {
    const stream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let headers: string[] | null = null;
    let columnMap: Partial<Record<FieldKey, string>> = {};
    let rows = 0;
    let written = 0;
    let skipped = 0;
    const seenInThisFile = new Set<string>();

    for await (const line of rl) {
        if (!line.trim()) continue;
        if (!headers) {
            headers = parseCsvLine(line);
            columnMap = buildColumnMap(headers);
            console.log(
                `   📋 ${headers.length} cols, mapped ${Object.keys(columnMap).length}/${Object.keys(HEADER_ALIASES).length}`
            );
            continue;
        }
        rows++;
        const values = parseCsvLine(line);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] ?? "";
        });
        const built = buildRow(row, columnMap);
        if (!built) {
            skipped++;
            continue;
        }
        // Dedupe within the file (COPY will reject duplicates against
        // staging PK otherwise). Last write wins.
        const oid = String(built[0]);
        if (seenInThisFile.has(oid)) {
            // overwrite handled by dedupe-via-set; emit once at end is too
            // memory-heavy. Skip dupes within file — they're typically the
            // same row re-exported.
            skipped++;
            continue;
        }
        seenInThisFile.add(oid);
        await push(rowToTsv(built));
        written++;
    }
    return { rows, written, skipped };
}

async function main() {
    console.log("⚡ Fast reimport completed_orders (COPY + MERGE)");

    let files: string[];
    if (SINGLE_FILE) {
        files = [SINGLE_FILE];
    } else {
        const fullDir = path.resolve(DIR);
        if (!fs.existsSync(fullDir)) {
            console.error(`Directory not found: ${fullDir}`);
            process.exit(1);
        }
        files = fs
            .readdirSync(fullDir)
            .filter((f) => f.toLowerCase().endsWith(".csv"))
            .sort()
            .map((f) => path.join(fullDir, f));
    }
    console.log(`   Files: ${files.length}`);

    const client = new Client({ connectionString: CONN_STRING });
    await client.connect();
    console.log("   ✅ Connected via DIRECT_URL");

    try {
        const stagingTable = "completed_orders_staging";
        const colDdl = STAGING_COLUMNS.map((c) => `"${c.name}" ${c.type}`).join(", ");
        const colList = STAGING_COLUMNS.map((c) => `"${c.name}"`).join(", ");

        await client.query(`DROP TABLE IF EXISTS ${stagingTable}`);
        await client.query(
            `CREATE UNLOGGED TABLE ${stagingTable} (${colDdl}, PRIMARY KEY (order_id))`
        );
        console.log("   ✅ Staging table ready");

        // One COPY stream for the whole reimport.
        const copyStream = client.query(
            copyFrom(
                `COPY ${stagingTable} (${colList}) FROM STDIN WITH (FORMAT text, NULL '\\N')`
            )
        );

        const totals = { rows: 0, written: 0, skipped: 0 };
        const startCopy = Date.now();

        const push = (chunk: string): Promise<void> =>
            new Promise<void>((resolve, reject) => {
                if (copyStream.write(chunk)) {
                    resolve();
                } else {
                    copyStream.once("drain", resolve);
                    copyStream.once("error", reject);
                }
            });

        for (const f of files) {
            console.log(`\n📂 ${path.basename(f)}`);
            const r = await streamFile(f, push);
            totals.rows += r.rows;
            totals.written += r.written;
            totals.skipped += r.skipped;
            console.log(
                `   ↪ ${r.rows} rows · ${r.written} written · ${r.skipped} skipped (dupes within file)`
            );
        }

        await new Promise<void>((resolve, reject) => {
            copyStream.end();
            copyStream.on("finish", () => resolve());
            copyStream.on("error", reject);
        });

        const copySec = (Date.now() - startCopy) / 1000;
        console.log(
            `\n   ✅ COPY complete: ${totals.written.toLocaleString()} rows in ${copySec.toFixed(1)}s`
        );

        // Sanity check staging size
        const stageCount = await client.query(
            `SELECT count(*)::int AS n FROM ${stagingTable}`
        );
        console.log(`   📦 Staging holds ${stageCount.rows[0].n.toLocaleString()} rows`);

        // Build the MERGE statement. We only UPDATE columns from the new
        // CSV (which means every non-PK column in STAGING_COLUMNS, EXCEPT
        // we should NOT overwrite a populated value with NULL — use
        // COALESCE(EXCLUDED.col, completed_orders.col).
        const updateCols = STAGING_COLUMNS.filter((c) => c.name !== "order_id");
        const insertCols = ["order_id", ...updateCols.map((c) => c.name)]
            .map((n) => `"${n}"`)
            .join(", ");
        const selectCols = ["order_id", ...updateCols.map((c) => c.name)]
            .map((n) => `s."${n}"`)
            .join(", ");
        const updateSet = updateCols
            .map(
                (c) =>
                    `"${c.name}" = COALESCE(EXCLUDED."${c.name}", completed_orders."${c.name}")`
            )
            .join(",\n            ");

        const mergeSql = `
            INSERT INTO completed_orders (${insertCols})
            SELECT ${selectCols}
            FROM ${stagingTable} s
            ON CONFLICT (order_id) DO UPDATE SET
                ${updateSet}
        `;

        console.log("\n🔀 Merging staging → completed_orders …");
        const startMerge = Date.now();
        const mergeResult = await client.query(mergeSql);
        const mergeSec = (Date.now() - startMerge) / 1000;
        console.log(
            `   ✅ Merge complete: ${mergeResult.rowCount?.toLocaleString() ?? "?"} rows in ${mergeSec.toFixed(1)}s`
        );

        await client.query(`DROP TABLE ${stagingTable}`);
        console.log("   🧹 Staging dropped");

        // Final stats
        const finalStats = await client.query(`
            SELECT count(*) AS total,
                   count(equipment_type) AS with_equipment,
                   count(*) FILTER (WHERE shipper_email IS NOT NULL) AS with_email,
                   count(*) FILTER (WHERE distance_miles IS NOT NULL) AS with_miles
            FROM completed_orders
        `);
        const dist = await client.query(`
            SELECT equipment_type, count(*)::int AS n
            FROM completed_orders
            WHERE equipment_type IS NOT NULL
            GROUP BY equipment_type
            ORDER BY n DESC
        `);
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Read:          ${totals.rows.toLocaleString()}`);
        console.log(`Written:       ${totals.written.toLocaleString()}`);
        console.log(`Skipped:       ${totals.skipped.toLocaleString()}`);
        console.log("\nFinal table state:");
        console.log(`  total rows:        ${finalStats.rows[0].total}`);
        console.log(`  with equipment:    ${finalStats.rows[0].with_equipment}`);
        console.log(`  with shipper_email:${finalStats.rows[0].with_email}`);
        console.log(`  with distance:     ${finalStats.rows[0].with_miles}`);
        console.log("\nEquipment distribution:");
        for (const r of dist.rows) {
            console.log(`  ${(r.equipment_type as string).padEnd(14)} ${String(r.n).padStart(8)}`);
        }
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
