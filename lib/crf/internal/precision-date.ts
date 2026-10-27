/**
 * Precision Date, Null-Flavor Adornment, and Variable Validation Utilities
 * CDISC CDASH 2.2 • ISO 8601 Partial Dates • 21 CFR Part 11
 */

/**
 * Standard CDISC / HL7 Null Flavor definitions
 */
export const CDISC_NULL_FLAVORS = {
  ND: "Not Done",
  NA: "Not Applicable",
  UNK: "Unknown",
  ASKU: "Asked but Unknown",
  NASK: "Not Asked",
  MSK: "Masked",
} as const;

export type CdiscNullFlavorCode = keyof typeof CDISC_NULL_FLAVORS;

/**
 * Checks if a value represents a valid CDISC null flavor code.
 */
export function isCdiscNullFlavor(val: unknown): val is CdiscNullFlavorCode {
  if (typeof val !== "string") return false;
  const upper = val.trim().toUpperCase();
  return upper in CDISC_NULL_FLAVORS;
}

export interface ParsedPrecisionDate {
  year: number | null;
  month: number | null; // 1 - 12
  day: number | null; // 1 - 31
  isPartial: boolean;
  isValid: boolean;
  nullFlavor?: CdiscNullFlavorCode;
  isoString: string;
}

/**
 * Parses an ISO 8601 date, partial date, or null flavor into structured parts.
 * Supported patterns:
 * - YYYY-MM-DD (Full date: e.g. 2026-08-19)
 * - YYYY-MM-UNK / YYYY-MM (Unknown day: e.g. 2026-08-UNK, 2026-08)
 * - YYYY-UNK-UNK / YYYY (Unknown month & day: e.g. 2026-UNK-UNK, 2026)
 * - CDISC Null Flavor (e.g. ND, NA, UNK)
 */
export function parsePrecisionDate(
  raw: string | null | undefined
): ParsedPrecisionDate {
  if (!raw || typeof raw !== "string" || raw.trim() === "") {
    return {
      year: null,
      month: null,
      day: null,
      isPartial: false,
      isValid: false,
      isoString: "",
    };
  }

  const trimmed = raw.trim().toUpperCase();

  // Check for CDISC null flavor
  if (isCdiscNullFlavor(trimmed)) {
    return {
      year: null,
      month: null,
      day: null,
      isPartial: false,
      isValid: true,
      nullFlavor: trimmed,
      isoString: trimmed,
    };
  }

  // 1. Full ISO Date: YYYY-MM-DD
  const fullMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (fullMatch) {
    const y = parseInt(fullMatch[1], 10);
    const m = parseInt(fullMatch[2], 10);
    const d = parseInt(fullMatch[3], 10);

    if (m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m)) {
      return {
        year: y,
        month: m,
        day: d,
        isPartial: false,
        isValid: true,
        isoString: trimmed,
      };
    }
    return {
      year: y,
      month: m,
      day: d,
      isPartial: false,
      isValid: false,
      isoString: trimmed,
    };
  }

  // 2. Partial with Unknown Day: YYYY-MM-UNK or YYYY-MM
  const monthOnlyMatch = /^(\d{4})-(\d{2})(?:-(?:UNK|UN|\?\?))?$/.exec(trimmed);
  if (monthOnlyMatch) {
    const y = parseInt(monthOnlyMatch[1], 10);
    const m = parseInt(monthOnlyMatch[2], 10);
    if (m >= 1 && m <= 12) {
      return {
        year: y,
        month: m,
        day: null,
        isPartial: true,
        isValid: true,
        isoString: `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-UNK`,
      };
    }
    return {
      year: y,
      month: m,
      day: null,
      isPartial: true,
      isValid: false,
      isoString: trimmed,
    };
  }

  // 3. Partial with Unknown Month & Day: YYYY-UNK-UNK or YYYY
  const yearOnlyMatch = /^(\d{4})(?:-(?:UNK|UN|\?\?)-(?:UNK|UN|\?\?))?$/.exec(
    trimmed
  );
  if (yearOnlyMatch) {
    const y = parseInt(yearOnlyMatch[1], 10);
    if (y >= 1000 && y <= 9999) {
      return {
        year: y,
        month: null,
        day: null,
        isPartial: true,
        isValid: true,
        isoString: `${String(y).padStart(4, "0")}-UNK-UNK`,
      };
    }
    return {
      year: y,
      month: null,
      day: null,
      isPartial: true,
      isValid: false,
      isoString: trimmed,
    };
  }

  return {
    year: null,
    month: null,
    day: null,
    isPartial: false,
    isValid: false,
    isoString: trimmed,
  };
}

/**
 * Formats segmented parts into a standardized ISO 8601 partial or full date string.
 */
export function formatPrecisionDate(
  year: number | string | null | undefined,
  month?: number | string | null,
  day?: number | string | null
): string {
  if (
    !year ||
    String(year).trim() === "" ||
    String(year).toUpperCase() === "UNK"
  ) {
    return "";
  }

  const yNum = typeof year === "number" ? year : parseInt(String(year), 10);
  if (isNaN(yNum) || yNum < 1000 || yNum > 9999) return "";

  const yStr = String(yNum).padStart(4, "0");

  const mRaw =
    month !== undefined && month !== null
      ? String(month).trim().toUpperCase()
      : "";
  if (!mRaw || mRaw === "UNK" || mRaw === "0" || mRaw === "") {
    return `${yStr}-UNK-UNK`;
  }

  const mNum = parseInt(mRaw, 10);
  if (isNaN(mNum) || mNum < 1 || mNum > 12) {
    return `${yStr}-UNK-UNK`;
  }
  const mStr = String(mNum).padStart(2, "0");

  const dRaw =
    day !== undefined && day !== null ? String(day).trim().toUpperCase() : "";
  if (!dRaw || dRaw === "UNK" || dRaw === "0" || dRaw === "") {
    return `${yStr}-${mStr}-UNK`;
  }

  const dNum = parseInt(dRaw, 10);
  const maxDays = daysInMonth(yNum, mNum);
  if (isNaN(dNum) || dNum < 1 || dNum > maxDays) {
    return `${yStr}-${mStr}-UNK`;
  }
  const dStr = String(dNum).padStart(2, "0");

  return `${yStr}-${mStr}-${dStr}`;
}

/**
 * Returns number of days in a given month/year (leap-year aware).
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Checks if a parsed or raw date is in the future relative to the reference date (UTC).
 */
export function isFutureDate(
  dateStr: string,
  referenceDate: Date = new Date()
): boolean {
  const parsed = parsePrecisionDate(dateStr);
  if (!parsed.isValid || parsed.year === null || parsed.nullFlavor) {
    return false;
  }

  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth() + 1;
  const refDay = referenceDate.getUTCDate();

  if (parsed.year > refYear) return true;
  if (parsed.year < refYear) return false;

  // Same year
  if (parsed.month !== null) {
    if (parsed.month > refMonth) return true;
    if (parsed.month < refMonth) return false;

    // Same month
    if (parsed.day !== null) {
      return parsed.day > refDay;
    }
  }

  return false;
}

export interface PrecisionDateValidationOptions {
  allowPartial?: boolean;
  preventFutureDate?: boolean;
  allowNullFlavor?: boolean;
  referenceDate?: Date;
}

export interface PrecisionDateValidationResult {
  isValid: boolean;
  error?: string;
  isNullFlavor?: boolean;
  isPartial?: boolean;
  parsed: ParsedPrecisionDate;
}

/**
 * Comprehensive clinical validator for precision dates.
 */
export function validatePrecisionDate(
  value: string | null | undefined,
  options: PrecisionDateValidationOptions = {}
): PrecisionDateValidationResult {
  if (!value || typeof value !== "string" || value.trim() === "") {
    return {
      isValid: false,
      error: "Date value is required.",
      parsed: parsePrecisionDate(value),
    };
  }

  const parsed = parsePrecisionDate(value);

  if (parsed.nullFlavor) {
    if (options.allowNullFlavor === false) {
      return {
        isValid: false,
        error: `Null flavor code '${parsed.nullFlavor}' is not permitted for this field.`,
        isNullFlavor: true,
        parsed,
      };
    }
    return {
      isValid: true,
      isNullFlavor: true,
      isPartial: false,
      parsed,
    };
  }

  if (!parsed.isValid) {
    return {
      isValid: false,
      error: `Invalid ISO 8601 date format: "${value}". Expected YYYY-MM-DD or partial date.`,
      parsed,
    };
  }

  if (parsed.isPartial && options.allowPartial === false) {
    return {
      isValid: false,
      error:
        "Partial dates are not allowed for this field. Complete YYYY-MM-DD required.",
      isPartial: true,
      parsed,
    };
  }

  if (options.preventFutureDate && isFutureDate(value, options.referenceDate)) {
    return {
      isValid: false,
      error: `Future dates are not permitted. "${value}" is later than the current UTC timestamp.`,
      isPartial: parsed.isPartial,
      parsed,
    };
  }

  return {
    isValid: true,
    isPartial: parsed.isPartial,
    parsed,
  };
}

/**
 * Strict CDASH 2.2 / SAS Variable Name Validator
 * Rules:
 * - 1 to 8 characters in length
 * - Must start with a letter (A-Z)
 * - May contain only uppercase letters (A-Z), numbers (0-9), and underscores (_)
 * - No spaces or special characters
 */
export function validateCdashVariableName(name: string): {
  isValid: boolean;
  error?: string;
  sanitized: string;
} {
  if (!name || typeof name !== "string" || name.trim() === "") {
    return {
      isValid: false,
      error: "Variable name cannot be blank.",
      sanitized: "",
    };
  }

  const trimmed = name.trim();
  const upper = trimmed.toUpperCase();

  // Check length
  if (upper.length > 8) {
    return {
      isValid: false,
      error: `Variable name "${upper}" exceeds CDASH/SAS 8-character limit (${upper.length} chars).`,
      sanitized: upper.substring(0, 8),
    };
  }

  // Check starting character
  if (!/^[A-Z]/.test(upper)) {
    return {
      isValid: false,
      error: `Variable name "${upper}" must start with a letter (A-Z).`,
      sanitized: `V_${upper}`.substring(0, 8),
    };
  }

  // Check valid characters
  if (!/^[A-Z][A-Z0-9_]*$/.test(upper)) {
    const cleaned = upper.replace(/[^A-Z0-9_]/g, "_").substring(0, 8);
    return {
      isValid: false,
      error: `Variable name "${upper}" contains invalid characters. Only uppercase letters, digits, and underscores are permitted.`,
      sanitized: cleaned,
    };
  }

  return {
    isValid: true,
    sanitized: upper,
  };
}

/**
 * Generate Collision-Resistant ID using crypto.randomUUID or Random Fallback
 */
export function generateEngineId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  const rand = Math.random().toString(36).slice(2, 11);
  const rand2 = Math.random().toString(36).slice(2, 11);
  return `${prefix}_${rand}_${rand2}`;
}

/**
 * Generate Valid CDASH Nonconflicting Variable Name (<= 8 Characters)
 */
export function generateCdashVariableName(
  baseName: string,
  existingVarNames: Set<string> | string[] | Iterable<string>
): string {
  const existing = new Set(
    Array.from(existingVarNames).map((v) => v.toUpperCase())
  );

  // Clean non-alphanumeric/underscore and ensure uppercase
  let cleaned = (baseName || "VAR").toUpperCase().replace(/[^A-Z0-9_]/g, "");
  // CDASH variables must start with an alphabetic character [A-Z]
  if (!cleaned || /^[^A-Z]/.test(cleaned)) {
    const stripped = cleaned.replace(/^[^A-Z]+/, "");
    cleaned = `V_${stripped || "VAR"}`.replace(/[^A-Z0-9_]/g, "");
  }

  const baseCandidate = cleaned.slice(0, 8);
  if (
    /^[A-Z][A-Z0-9_]{0,7}$/.test(baseCandidate) &&
    !existing.has(baseCandidate)
  ) {
    return baseCandidate;
  }

  // If base already ends in _<digits>, parse stem and counter
  const match = cleaned.match(/^(.*?)_([0-9]+)$/);
  const stem =
    match && match[1].length > 0
      ? match[1].replace(/_+$/, "")
      : cleaned.replace(/_+$/, "");
  let counter = match ? parseInt(match[2], 10) + 1 : 2;

  // Try numerical suffixes within 8-character CDASH limit
  while (counter < 1000) {
    const suffix = `_${counter}`;
    const maxStemLen = Math.max(1, 8 - suffix.length);
    const truncatedStem = stem.slice(0, maxStemLen).replace(/_+$/, "");
    const candidate = `${truncatedStem}${suffix}`;

    if (!existing.has(candidate)) {
      return candidate;
    }
    counter++;
  }

  // Fallback to letter suffixes within 8-character limit
  for (let code = 65; code <= 90; code++) {
    const letter = String.fromCharCode(code);
    const suffix = `_${letter}`;
    const maxStemLen = Math.max(1, 8 - suffix.length);
    const truncatedStem = stem.slice(0, maxStemLen).replace(/_+$/, "");
    const candidate = `${truncatedStem}${suffix}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  // Ultimate fallback within 8 characters (guaranteed unique)
  while (true) {
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    const candidate = `V_${rand}`.slice(0, 8);
    if (!existing.has(candidate)) {
      return candidate;
    }
  }
}
