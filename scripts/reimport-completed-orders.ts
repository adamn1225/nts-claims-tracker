#!/usr/bin/env tsx
/**
 * Bulk reimport `completed_orders` from the CRM CSV exports in
 * `leads-orders-exports/`.
 *
 * Why this exists: the original loader ingested ~17 columns. After the
 * 20260603 migration, completed_orders captures the full ~40-column CRM
 * export (shipper identity, dims/weight, distance, campaign attribution,
 * derived oversize/load_type flags). To backfill the existing ~450k rows
 * with the new columns we re-read every CSV and UPSERT on `order_id`.
 *
 * Usage:
 *   npx tsx scripts/reimport-completed-orders.ts
 *   npx tsx scripts/reimport-completed-orders.ts --dir=leads-orders-exports
 *   npx tsx scripts/reimport-completed-orders.ts --file=path/to/single.csv
 *   npx tsx scripts/reimport-completed-orders.ts --dry-run
 *
 * Env (auto-loaded from .env.local, then .env):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
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

// ── Env (minimal .env loader so we don't add a runtime dependency) ─────────
function loadDotenv(file: string) {
    if (!fs.existsSync(file)) return;
    const text = fs.readFileSync(file, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
            "Add them to .env.local or export them in your shell."
    );
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argMap = new Map<string, string>();
for (const a of args) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) argMap.set(m[1], m[2] ?? "true");
}
const SINGLE_FILE = argMap.get("file");
const DIR = argMap.get("dir") ?? "leads-orders-exports";
const DRY_RUN = argMap.has("dry-run");
const BATCH_SIZE = parseInt(argMap.get("batch") ?? "500", 10);

// ── Header mapping (same as the API route) ──────────────────────────────────
type FieldKey =
    | "orderId" | "customerType" | "orderSubType"
    | "shipperName" | "shipperPhone" | "shipperEmail" | "verifiedShipper"
    | "orderCreated" | "estShipDate" | "deliveredDate" | "quotedDate"
    | "orderSent" | "orderSigned"
    | "carrierCompanyName" | "carrierPay" | "codToCarrier"
    | "quotePrice" | "cargoValue" | "brokerBalance"
    | "brokerAssign" | "brokerBranch"
    | "originCity" | "originState" | "originZip" | "originCountry"
    | "destinationCity" | "destinationState" | "destinationZip" | "destinationCountry"
    | "cargo" | "shipVia" | "duration" | "distance"
    | "loadName" | "make" | "model" | "year"
    | "length" | "width" | "height" | "weight"
    | "trailerType" | "vehicleType"
    | "orderStatus" | "assignedTo"
    | "campaignSource" | "campaignMedium" | "campaignName"
    | "campaignContent" | "campaignKeyword";

const HEADER_ALIASES: Record<FieldKey, string[]> = {
    orderId: ["orderid"],
    customerType: ["customertype"],
    orderSubType: ["ordersubtype", "subtype"],
    shipperName: ["shippername"],
    shipperPhone: ["shipperphone"],
    shipperEmail: ["shipperemail"],
    verifiedShipper: ["verifiedshippercheck", "verifiedshipper"],
    orderCreated: ["ordercreated"],
    estShipDate: ["estimatedshipdate", "estshipdate"],
    deliveredDate: ["delivereddate"],
    quotedDate: ["quoteddate"],
    orderSent: ["ordersent"],
    orderSigned: ["ordersigned"],
    carrierCompanyName: ["carriercompanyname", "carriercompany", "carriername", "carrier"],
    carrierPay: ["carrierpay"],
    codToCarrier: ["codtocarrier"],
    quotePrice: ["quoteprice"],
    cargoValue: ["cargovalue"],
    brokerBalance: ["brokerbalance"],
    brokerAssign: ["brokerassign"],
    brokerBranch: ["brokerbranch"],
    originCity: ["origincity"],
    originState: ["originstate"],
    originZip: ["originzip"],
    originCountry: ["origincountry"],
    destinationCity: ["destinationcity"],
    destinationState: ["destinationstate", "deststate"],
    destinationZip: ["destinationzip", "destzip"],
    destinationCountry: ["destinationcountry", "destcountry"],
    cargo: ["cargo"],
    shipVia: ["shipvia"],
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
    orderStatus: ["orderstatus"],
    assignedTo: ["assignedto"],
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

// ── Row → DB record ─────────────────────────────────────────────────────────
// IMPORTANT: Only emit fields whose source column was actually mapped from
// the CSV. Unmapped columns are left undefined so the upsert preserves any
// existing value in the row (avoids nulling out e.g. carrier_company_name
// when the CRM export doesn't carry it).
function buildRecord(
    row: Record<string, string>,
    columnMap: Partial<Record<FieldKey, string>>
): Record<string, unknown> | null {
    const has = (key: FieldKey) => columnMap[key] !== undefined;
    const raw = (key: FieldKey): string => {
        const h = columnMap[key];
        if (!h) return "";
        const v = (row[h] ?? "").trim();
        // The CRM export uses the literal string "NULL" for missing values.
        // Treat it as empty so downstream parsers/UPSERTs write real SQL NULLs.
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

    // Clamp helpers — column precision limits prevent overflow on garbage CSV rows.
    const clamp = (n: number | null, max: number) =>
        n === null ? null : Math.min(n, max);
    const distanceMiles = clamp(parseNumeric(raw("distance")), 999999.9);   // numeric(7,1)
    const durationMinutes = parseDurationMinutes(raw("duration"));

    const lengthFt = clamp(parseNumeric(raw("length")), 9999.99);            // numeric(6,2)
    const widthFt = clamp(parseNumeric(raw("width")), 9999.99);
    const heightFt = clamp(parseNumeric(raw("height")), 9999.99);
    const weightLbs = clamp(parseNumeric(raw("weight")), 9999999999);        // numeric(10,0)

    const equipmentType = normalizeEquipment(
        raw("shipVia"),
        raw("trailerType"),
        raw("vehicleType")
    );

    const loadType = classifyLoadType({
        equipment: equipmentType,
        lengthFt,
        widthFt,
        heightFt,
        weightLbs,
        cargo: raw("cargo"),
    });

    // Build the record dynamically — only include keys whose source columns
    // exist in this CSV (or that we derive from columns that exist).
    const rec: Record<string, unknown> = { order_id: orderId };

    const setIfMapped = (
        field: FieldKey,
        column: string,
        value: unknown
    ) => {
        if (!has(field)) return;
        rec[column] = value === "" ? null : value;
    };

    // Existing columns
    setIfMapped("orderCreated", "order_created", parseDateIso(raw("orderCreated")));
    setIfMapped("carrierCompanyName", "carrier_company_name", raw("carrierCompanyName") || null);
    if (has("carrierPay") || has("codToCarrier")) {
        rec.carrier_pay = carrierPayRaw || null;
    }
    setIfMapped("quotePrice", "quote_price", raw("quotePrice") || null);
    setIfMapped("originCity", "origin_city", raw("originCity") || null);
    setIfMapped("originState", "origin_state", raw("originState") || null);
    setIfMapped("originZip", "origin_zip", raw("originZip") || null);
    setIfMapped("destinationCity", "destination_city", raw("destinationCity") || null);
    setIfMapped("destinationState", "destination_state", raw("destinationState") || null);
    setIfMapped("destinationZip", "destination_zip", raw("destinationZip") || null);
    setIfMapped("cargo", "cargo", raw("cargo") || null);
    setIfMapped("shipVia", "ship_via", raw("shipVia") || null);
    setIfMapped("estShipDate", "est_ship_date", parseDateIso(raw("estShipDate")));
    setIfMapped("deliveredDate", "delivered_date", parseDateIso(raw("deliveredDate")));
    setIfMapped("orderStatus", "order_status", raw("orderStatus") || null);
    if (has("brokerAssign") || has("assignedTo")) {
        rec.assigned_to = raw("brokerAssign") || raw("assignedTo") || null;
    }

    // New raw CRM columns
    setIfMapped("customerType", "customer_type", raw("customerType") || null);
    setIfMapped("orderSubType", "order_sub_type", raw("orderSubType") || null);
    setIfMapped("shipperName", "shipper_name", raw("shipperName") || null);
    setIfMapped("shipperPhone", "shipper_phone", raw("shipperPhone") || null);
    setIfMapped("shipperEmail", "shipper_email", raw("shipperEmail") || null);
    setIfMapped("verifiedShipper", "verified_shipper", parseBoolean(raw("verifiedShipper")));
    setIfMapped("originCountry", "origin_country", raw("originCountry") || null);
    setIfMapped("destinationCountry", "destination_country", raw("destinationCountry") || null);
    setIfMapped("cargoValue", "cargo_value", raw("cargoValue") || null);
    setIfMapped("quotedDate", "quoted_date", parseDateIso(raw("quotedDate")));
    setIfMapped("brokerBalance", "broker_balance", raw("brokerBalance") || null);
    setIfMapped("brokerBranch", "broker_branch", raw("brokerBranch") || null);
    setIfMapped("duration", "duration_text", raw("duration") || null);
    setIfMapped("distance", "distance_text", raw("distance") || null);
    setIfMapped("loadName", "load_name", raw("loadName") || null);
    setIfMapped("make", "make", raw("make") || null);
    setIfMapped("model", "model", raw("model") || null);
    setIfMapped("year", "year", parseIntOrNull(raw("year")));
    setIfMapped("length", "length_text", raw("length") || null);
    setIfMapped("width", "width_text", raw("width") || null);
    setIfMapped("height", "height_text", raw("height") || null);
    setIfMapped("weight", "weight_text", raw("weight") || null);
    setIfMapped("trailerType", "trailer_type", raw("trailerType") || null);
    setIfMapped("vehicleType", "vehicle_type", raw("vehicleType") || null);
    setIfMapped("orderSent", "order_sent", parseDateIso(raw("orderSent")));
    setIfMapped("orderSigned", "order_signed", parseDateIso(raw("orderSigned")));
    setIfMapped("campaignSource", "campaign_source", raw("campaignSource") || null);
    setIfMapped("campaignMedium", "campaign_medium", raw("campaignMedium") || null);
    setIfMapped("campaignName", "campaign_name", raw("campaignName") || null);
    setIfMapped("campaignContent", "campaign_content", raw("campaignContent") || null);
    setIfMapped("campaignKeyword", "campaign_keyword", raw("campaignKeyword") || null);

    // Typed mirrors & derived flags — only emit when the underlying source
    // column was mapped, so we never overwrite existing values with NULL.
    if (has("carrierPay") || has("codToCarrier")) {
        rec.carrier_pay_numeric = carrierPayNumeric;
    }
    if (has("quotePrice")) rec.quote_price_numeric = quotePriceNumeric;
    if (has("cargoValue")) rec.cargo_value_numeric = cargoValueNumeric;
    if (has("brokerBalance")) rec.broker_balance_numeric = brokerBalanceNumeric;
    if (has("distance")) rec.distance_miles = distanceMiles;
    if (has("duration")) rec.duration_minutes = durationMinutes;
    if (has("length")) rec.length_ft = lengthFt;
    if (has("width")) rec.width_ft = widthFt;
    if (has("height")) rec.height_ft = heightFt;
    if (has("weight")) rec.weight_lbs = weightLbs;

    // Equipment / load classification — only when we had at least one
    // source signal (shipVia, trailerType, or vehicleType).
    if (has("shipVia") || has("trailerType") || has("vehicleType")) {
        rec.equipment_type = equipmentType;
    }
    if (has("length") || has("width") || has("height")) {
        rec.is_oversize = isOversize({ lengthFt, widthFt, heightFt });
    }
    if (has("weight")) rec.is_overweight = isOverweight(weightLbs);
    if (has("width") || has("height") || has("weight")) {
        rec.is_superload = isSuperload({ widthFt, heightFt, weightLbs });
    }
    if (
        has("shipVia") || has("trailerType") || has("vehicleType") ||
        has("length") || has("width") || has("height") || has("weight") || has("cargo")
    ) {
        rec.load_type = loadType;
    }

    return rec;
}

// ── Streamed CSV reader (so we don't blow memory on 50k-row files) ──────────
async function processFile(filePath: string): Promise<{
    fileName: string;
    rows: number;
    upserted: number;
    skipped: number;
    errors: number;
    durationMs: number;
}> {
    const fileName = path.basename(filePath);
    const start = Date.now();
    console.log(`\n📂 ${fileName}`);

    const stream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    let headers: string[] | null = null;
    let columnMap: Partial<Record<FieldKey, string>> = {};
    let buffer: Record<string, unknown>[] = [];
    let rows = 0;
    let upserted = 0;
    let skipped = 0;
    let errors = 0;

    const flush = async () => {
        if (!buffer.length) return;
        if (DRY_RUN) {
            upserted += buffer.length;
            buffer = [];
            return;
        }
        const { error } = await supabase
            .from("completed_orders")
            .upsert(buffer, { onConflict: "order_id", ignoreDuplicates: false });
        if (error) {
            // Fall back to row-by-row so one bad row doesn't sink the batch.
            let rowOk = 0;
            let rowBad = 0;
            for (const rec of buffer) {
                const { error: rowErr } = await supabase
                    .from("completed_orders")
                    .upsert([rec], { onConflict: "order_id", ignoreDuplicates: false });
                if (rowErr) {
                    rowBad++;
                    if (rowBad <= 3) {
                        console.error(
                            `   ❌ row ${rec.order_id} failed: ${rowErr.message}`
                        );
                    }
                } else {
                    rowOk++;
                }
            }
            upserted += rowOk;
            errors += rowBad;
            if (rowBad > 3) {
                console.error(`   …${rowBad - 3} more row failures suppressed`);
            }
        } else {
            upserted += buffer.length;
        }
        buffer = [];
    };

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

        const record = buildRecord(row, columnMap);
        if (!record) {
            skipped++;
            continue;
        }

        buffer.push(record);
        if (buffer.length >= BATCH_SIZE) {
            await flush();
            if (rows % (BATCH_SIZE * 10) === 0) {
                process.stdout.write(`   …${rows} rows / ${upserted} upserted\r`);
            }
        }
    }
    await flush();

    const durationMs = Date.now() - start;
    console.log(
        `   ✅ ${fileName}: ${rows} rows · ${upserted} upserted · ${skipped} skipped · ${errors} errors · ${(durationMs / 1000).toFixed(1)}s`
    );

    return { fileName, rows, upserted, skipped, errors, durationMs };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
    console.log("🚚 Reimport completed_orders");
    console.log(`   Supabase: ${SUPABASE_URL}`);
    console.log(`   Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}  ·  Batch: ${BATCH_SIZE}`);

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

    if (!files.length) {
        console.error("No CSV files found.");
        process.exit(1);
    }

    console.log(`   Files: ${files.length}`);

    const results = [];
    for (const f of files) {
        results.push(await processFile(f));
    }

    const totals = results.reduce(
        (acc, r) => ({
            rows: acc.rows + r.rows,
            upserted: acc.upserted + r.upserted,
            skipped: acc.skipped + r.skipped,
            errors: acc.errors + r.errors,
            durationMs: acc.durationMs + r.durationMs,
        }),
        { rows: 0, upserted: 0, skipped: 0, errors: 0, durationMs: 0 }
    );

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Total rows read: ${totals.rows.toLocaleString()}`);
    console.log(`Upserted:        ${totals.upserted.toLocaleString()}`);
    console.log(`Skipped:         ${totals.skipped.toLocaleString()}`);
    console.log(`Errors:          ${totals.errors.toLocaleString()}`);
    console.log(`Duration:        ${(totals.durationMs / 1000).toFixed(1)}s`);
}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
