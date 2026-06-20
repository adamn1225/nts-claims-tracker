// ─────────────────────────────────────────────────────────────────────────────
// Shared parsers for NTS CRM CSV exports.
//
// These helpers convert raw CSV text (which often arrives as "$40K",
// "1,465 mi", "21 hours 50 mins", or blank) into the typed values stored in
// `completed_orders`. Keeping them in one module lets the CSV upload route and
// the carrier-finder analytics share a single source of truth.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse currency strings, including "$40K" / "$3.5K" notation.
 * Returns null when the value is blank or cannot be parsed.
 */
export function parseCurrencyNumeric(value: string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    if (!trimmed || trimmed.toUpperCase() === "NULL") return null;

    const cleaned = trimmed.replace(/[$\s]/g, "").toUpperCase();
    if (!cleaned) return null;

    if (cleaned.endsWith("K")) {
        const n = parseFloat(cleaned.slice(0, -1).replace(/,/g, ""));
        return Number.isFinite(n) ? n * 1000 : null;
    }
    if (cleaned.endsWith("M")) {
        const n = parseFloat(cleaned.slice(0, -1).replace(/,/g, ""));
        return Number.isFinite(n) ? n * 1_000_000 : null;
    }

    const n = parseFloat(cleaned.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
}

/**
 * Parse a number that may include commas, units, or whitespace.
 * Returns null when blank/non-numeric.
 */
export function parseNumeric(value: string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    if (!trimmed || trimmed.toUpperCase() === "NULL") return null;

    const match = trimmed.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const n = parseFloat(match[0]);
    return Number.isFinite(n) ? n : null;
}

/**
 * Parse an integer (Year column, etc.).
 */
export function parseIntOrNull(value: string | null | undefined): number | null {
    const n = parseNumeric(value);
    return n === null ? null : Math.round(n);
}

/**
 * Parse strings like "21 hours 50 mins", "1 day 3 hours", "45 mins" into
 * total minutes. Returns null when no time tokens are found.
 */
export function parseDurationMinutes(value: string | null | undefined): number | null {
    if (!value) return null;
    const text = String(value).toLowerCase();
    if (!text.trim() || text.trim() === "null") return null;

    let total = 0;
    let matched = false;

    const dayMatch = text.match(/(\d+(?:\.\d+)?)\s*d(?:ay)?s?\b/);
    if (dayMatch) {
        total += parseFloat(dayMatch[1]) * 24 * 60;
        matched = true;
    }

    const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*h(?:ou)?rs?\b/);
    if (hourMatch) {
        total += parseFloat(hourMatch[1]) * 60;
        matched = true;
    }

    const minMatch = text.match(/(\d+(?:\.\d+)?)\s*m(?:in)?s?\b/);
    if (minMatch) {
        total += parseFloat(minMatch[1]);
        matched = true;
    }

    if (!matched) {
        // Fall back to a bare number (assume minutes).
        const n = parseNumeric(text);
        if (n !== null) return Math.round(n);
        return null;
    }

    return Math.round(total);
}

/**
 * Parse a CSV date string. Returns ISO string or null.
 *
 * Also rejects sentinel "1899-12-31" timestamps that the CRM emits for
 * unknown dates.
 */
export function parseDateIso(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed || trimmed.toUpperCase() === "NULL") return null;

    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) return null;
    if (parsed.getUTCFullYear() < 1970) return null;

    return parsed.toISOString();
}

/**
 * Parse "0", "1", "TRUE", "FALSE" verified flags.
 */
export function parseBoolean(value: string | null | undefined): boolean | null {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim().toLowerCase();
    if (!trimmed || trimmed === "null") return null;
    if (["1", "true", "yes", "y"].includes(trimmed)) return true;
    if (["0", "false", "no", "n"].includes(trimmed)) return false;
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Equipment normalization
// ─────────────────────────────────────────────────────────────────────────────

export type NormalizedEquipment =
    | "VAN"
    | "REEFER"
    | "FLATBED"
    | "STEPDECK"
    | "RGN"
    | "LOWBOY"
    | "DOUBLE_DROP"
    | "LANDOLL"
    | "CONESTOGA"
    | "HOTSHOT"
    | "BOX_TRUCK"
    | "CONTAINER"
    | "AUTO_CARRIER"
    | "DRIVEAWAY"
    | "POWER_ONLY"
    | "OTHER";

/**
 * Normalize the free-text `ship_via` / `trailer_type` / `vehicle_type` into a
 * single canonical equipment enum. Order matters — most-specific match wins.
 */
export function normalizeEquipment(...rawSources: Array<string | null | undefined>): NormalizedEquipment {
    const text = rawSources
        .filter((v): v is string => Boolean(v))
        .join(" ")
        .toLowerCase();

    if (!text.trim()) return "OTHER";

    if (/\b(rgn|removable\s*gooseneck)\b/.test(text)) return "RGN";
    if (/\blowboy|low\s*boy\b/.test(text)) return "LOWBOY";
    if (/\bdouble[-\s]?drop\b/.test(text)) return "DOUBLE_DROP";
    if (/\blandoll\b/.test(text)) return "LANDOLL";
    if (/\bstep[-\s]?deck|stepdeck\b/.test(text)) return "STEPDECK";
    if (/\bconestoga\b/.test(text)) return "CONESTOGA";
    if (/\bhotshot|hot\s*shot\b/.test(text)) return "HOTSHOT";
    if (/\bbox\s*truck\b/.test(text)) return "BOX_TRUCK";
    if (/\bcontainer\b/.test(text)) return "CONTAINER";
    if (/\bauto\s*carrier|car\s*hauler|car\s*carrier\b/.test(text)) return "AUTO_CARRIER";
    if (/\bdriveaway|drive\s*away\b/.test(text)) return "DRIVEAWAY";
    if (/\bpower\s*only\b/.test(text)) return "POWER_ONLY";
    if (/\breefer|refrigerated|temp\s*control\b/.test(text)) return "REEFER";
    if (/\bflatbed|flat\s*bed\b/.test(text)) return "FLATBED";
    if (/\bdry\s*van|\bvan\b/.test(text)) return "VAN";

    return "OTHER";
}

// ─────────────────────────────────────────────────────────────────────────────
// Load profile flags
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Federal/legal limits used by US oversize permitting (general rule of thumb).
 * Permit thresholds vary by state — these are the most common federal limits.
 */
export const OVERSIZE_THRESHOLDS = {
    lengthFt: 53,
    widthFt: 8.5,   // 102"
    heightFt: 13.5, // 162"
    weightLbs: 80000,
} as const;

/**
 * Superload triggers — well above standard oversize, typically requires route
 * survey, multiple pilot cars, and police escorts.
 */
export const SUPERLOAD_THRESHOLDS = {
    widthFt: 16,
    heightFt: 17,
    weightLbs: 250000,
} as const;

export function isOversize(dims: {
    lengthFt: number | null;
    widthFt: number | null;
    heightFt: number | null;
}): boolean {
    if ((dims.lengthFt ?? 0) > OVERSIZE_THRESHOLDS.lengthFt) return true;
    if ((dims.widthFt ?? 0) > OVERSIZE_THRESHOLDS.widthFt) return true;
    if ((dims.heightFt ?? 0) > OVERSIZE_THRESHOLDS.heightFt) return true;
    return false;
}

export function isOverweight(weightLbs: number | null): boolean {
    return (weightLbs ?? 0) > OVERSIZE_THRESHOLDS.weightLbs;
}

export function isSuperload(opts: {
    widthFt: number | null;
    heightFt: number | null;
    weightLbs: number | null;
}): boolean {
    if ((opts.widthFt ?? 0) > SUPERLOAD_THRESHOLDS.widthFt) return true;
    if ((opts.heightFt ?? 0) > SUPERLOAD_THRESHOLDS.heightFt) return true;
    if ((opts.weightLbs ?? 0) > SUPERLOAD_THRESHOLDS.weightLbs) return true;
    return false;
}

/**
 * Classify a load as FTL vs partial vs unknown using deterministic structured
 * fields when possible, falling back to text heuristics.
 *
 * Rules (in order):
 *   1. Oversize OR overweight                            → FTL
 *   2. Length > 30 ft OR weight > 30,000 lbs             → FTL
 *   3. Equipment is RGN/LOWBOY/DOUBLE_DROP/LANDOLL       → FTL
 *   4. Cargo text mentions partial/LTL keywords          → partial
 *   5. Equipment is VAN/REEFER with no FTL signals       → partial
 *   6. Otherwise                                         → unknown
 */
export function classifyLoadType(opts: {
    equipment: NormalizedEquipment;
    lengthFt: number | null;
    widthFt: number | null;
    heightFt: number | null;
    weightLbs: number | null;
    cargo: string | null | undefined;
}): "ftl" | "partial" | "unknown" {
    const oversize = isOversize({
        lengthFt: opts.lengthFt,
        widthFt: opts.widthFt,
        heightFt: opts.heightFt,
    });
    const overweight = isOverweight(opts.weightLbs);
    if (oversize || overweight) return "ftl";

    if ((opts.lengthFt ?? 0) > 30) return "ftl";
    if ((opts.weightLbs ?? 0) > 30000) return "ftl";

    const ftlEquipment: NormalizedEquipment[] = ["RGN", "LOWBOY", "DOUBLE_DROP", "LANDOLL"];
    if (ftlEquipment.includes(opts.equipment)) return "ftl";

    const cargo = (opts.cargo ?? "").toLowerCase();
    const partialKeywords = ["partial", "ltl", " pallet", "carton", " crate", "small load"];
    if (partialKeywords.some((kw) => cargo.includes(kw))) return "partial";

    const partialEquipment: NormalizedEquipment[] = ["VAN", "REEFER", "BOX_TRUCK", "HOTSHOT"];
    if (partialEquipment.includes(opts.equipment)) return "partial";

    return "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV line parser (RFC-4180-ish — handles quoted fields and embedded commas)
// ─────────────────────────────────────────────────────────────────────────────

export function parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (insideQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (ch === "," && !insideQuotes) {
            values.push(current.trim());
            current = "";
        } else {
            current += ch;
        }
    }
    values.push(current.trim());
    return values;
}
