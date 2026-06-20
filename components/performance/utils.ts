import type { CallDetailRow, CallScore } from "./types";

/** Convert seconds to M:SS or H:MM:SS string */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Parse HH:MM:SS, MM:SS, or raw seconds string into total seconds */
export function parseTimeToSeconds(value: string): number {
  if (!value) return 0;
  const trimmed = value.trim();
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map((p) => parseInt(p, 10) || 0);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }
  return parseFloat(trimmed) || 0;
}

/** Strip trailing % and parse as float */
export function parsePct(value: string): number {
  return parseFloat(value.replace("%", "").trim()) || 0;
}

/** Color class for performance metrics where higher = better */
export function highIsGoodColor(value: number, goodThreshold = 80, warnThreshold = 60): string {
  if (value >= goodThreshold) return "text-emerald-600";
  if (value >= warnThreshold) return "text-amber-600";
  return "text-red-900";
}

/** Color class for performance metrics where lower = better (e.g. missed %) */
export function lowIsBetterColor(value: number, goodThreshold = 10, warnThreshold = 20): string {
  if (value <= goodThreshold) return "text-emerald-600";
  if (value <= warnThreshold) return "text-amber-600";
  return "text-red-900";
}

/** Compute per-broker coaching statistics from call details and scores */
export function computeCoachingStats(
  calls: CallDetailRow[],
  scores: Record<string, CallScore>,
) {
  const scoredCalls = calls.filter((c) => scores[c.id]);
  if (scoredCalls.length === 0) {
    return {
      discoveryRate: 0,
      closingAttemptRate: 0,
      avgScore: 0,
      criticalCount: 0,
      needsCoachingCount: 0,
      strongCount: 0,
      totalScored: 0,
    };
  }

  const quoteCalls = scoredCalls.filter((c) => scores[c.id].callType === "quote");
  const discoveryCount = scoredCalls.filter((c) => scores[c.id].discoveryPerformed).length;
  const closingCount = quoteCalls.filter((c) => scores[c.id].closingSkills !== "poor").length;
  const avgScore = Math.round(
    scoredCalls.reduce((sum, c) => sum + scores[c.id].overallScore, 0) / scoredCalls.length,
  );

  return {
    discoveryRate:
      scoredCalls.length > 0
        ? Math.round((discoveryCount / scoredCalls.length) * 100)
        : 0,
    closingAttemptRate:
      quoteCalls.length > 0
        ? Math.round((closingCount / quoteCalls.length) * 100)
        : 0,
    avgScore,
    criticalCount: scoredCalls.filter((c) => scores[c.id].overallVerdict === "critical").length,
    needsCoachingCount: scoredCalls.filter((c) => scores[c.id].overallVerdict === "needs_coaching").length,
    strongCount: scoredCalls.filter((c) => scores[c.id].overallVerdict === "strong").length,
    totalScored: scoredCalls.length,
  };
}

/** Parse a single CSV line respecting quoted fields */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/** Format a UTC ISO date string for display */
export function formatStartTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoString;
  }
}
