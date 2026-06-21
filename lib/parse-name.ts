/**
 * Name parsing helpers.
 *
 * The intake form (and any internal forms) capture first/last name
 * separately. CSV imports, however, vary wildly — some sheets ship a
 * single "Full Name" column, others ship first/last separately, and
 * some include suffixes (Jr., Sr., III).
 *
 * Pattern: always store first_name + last_name separately. Derive a
 * display name from them, or — if importing a single column — use
 * `splitFullName` to do a best-effort split.
 */

const SUFFIXES = new Set([
  "jr",
  "jr.",
  "sr",
  "sr.",
  "ii",
  "iii",
  "iv",
  "v",
  "esq",
  "esq.",
  "phd",
  "md",
]);

export type ParsedName = {
  first_name: string | null;
  last_name: string | null;
  /** Convenience field for UI display — never null when input was non-empty. */
  full_name: string | null;
};

/**
 * Best-effort split of a single name string into first/last.
 *
 * Rules:
 *  - Empty / whitespace → all nulls.
 *  - One token → first_name only, last_name null.
 *  - Trailing suffix tokens (Jr., III, etc.) are stripped before splitting,
 *    then re-appended onto last_name.
 *  - Otherwise: last whitespace-separated token = last_name; everything
 *    before that = first_name (handles middle names by lumping them into
 *    first_name, which is the conventional choice).
 *
 * @example
 *   splitFullName("Mary Jane Watson")        // first: "Mary Jane", last: "Watson"
 *   splitFullName("John Smith Jr.")          // first: "John", last: "Smith Jr."
 *   splitFullName("Cher")                     // first: "Cher", last: null
 *   splitFullName("  ")                       // first: null, last: null
 */
export function splitFullName(input: string | null | undefined): ParsedName {
  const trimmed = (input ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { first_name: null, last_name: null, full_name: null };
  }

  const tokens = trimmed.split(" ");

  // Peel off trailing suffix tokens so they ride along with last_name.
  const suffixTokens: string[] = [];
  while (
    tokens.length > 1 &&
    SUFFIXES.has(tokens[tokens.length - 1].toLowerCase())
  ) {
    suffixTokens.unshift(tokens.pop()!);
  }

  if (tokens.length === 1) {
    const only = tokens[0];
    return {
      first_name: only,
      last_name: suffixTokens.length > 0 ? suffixTokens.join(" ") : null,
      full_name: [only, ...suffixTokens].join(" "),
    };
  }

  const last = tokens.pop()!;
  const first = tokens.join(" ");
  const lastWithSuffix =
    suffixTokens.length > 0 ? `${last} ${suffixTokens.join(" ")}` : last;

  return {
    first_name: first,
    last_name: lastWithSuffix,
    full_name: `${first} ${lastWithSuffix}`,
  };
}

/**
 * Combine separate first/last into a single display string.
 * Returns null when both inputs are empty.
 */
export function joinName(
  first: string | null | undefined,
  last: string | null | undefined,
): string | null {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  if (!f && !l) return null;
  if (!f) return l;
  if (!l) return f;
  return `${f} ${l}`;
}

/**
 * Normalize a name source that might be (a) separate first/last fields,
 * (b) a single full-name field, or (c) both. Used when ingesting CSV
 * rows or API payloads where the shape varies.
 */
export function resolveName(args: {
  first?: string | null;
  last?: string | null;
  full?: string | null;
}): ParsedName {
  const explicitFirst = (args.first ?? "").trim();
  const explicitLast = (args.last ?? "").trim();

  if (explicitFirst || explicitLast) {
    const full = joinName(explicitFirst, explicitLast);
    return {
      first_name: explicitFirst || null,
      last_name: explicitLast || null,
      full_name: full,
    };
  }

  return splitFullName(args.full ?? null);
}
