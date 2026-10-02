// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  CDISC_NULL_FLAVORS,
  isCdiscNullFlavor,
  parsePrecisionDate,
  formatPrecisionDate,
  daysInMonth,
  isFutureDate,
  validatePrecisionDate,
  validateCdashVariableName,
  generateEngineId,
  generateCdashVariableName,
} from "@/lib/crf/precision-date";

describe("lib/crf/precision-date.ts", () => {
  describe("CDISC_NULL_FLAVORS and isCdiscNullFlavor", () => {
    it("recognizes all standard CDISC null flavor codes", () => {
      const validCodes = Object.keys(CDISC_NULL_FLAVORS);
      expect(validCodes).toEqual(["ND", "NA", "UNK", "ASKU", "NASK", "MSK"]);

      for (const code of validCodes) {
        expect(isCdiscNullFlavor(code)).toBe(true);
      }
    });

    it("handles lowercase, mixed-case, and whitespace-padded strings", () => {
      expect(isCdiscNullFlavor("nd")).toBe(true);
      expect(isCdiscNullFlavor("  na  ")).toBe(true);
      expect(isCdiscNullFlavor("Unk")).toBe(true);
      expect(isCdiscNullFlavor("\tasku\n")).toBe(true);
      expect(isCdiscNullFlavor("NASK")).toBe(true);
      expect(isCdiscNullFlavor("msk")).toBe(true);
    });

    it("rejects non-null-flavor strings and non-string inputs", () => {
      expect(isCdiscNullFlavor("INVALID")).toBe(false);
      expect(isCdiscNullFlavor("N/A")).toBe(false);
      expect(isCdiscNullFlavor("UNKNOWN")).toBe(false);
      expect(isCdiscNullFlavor("")).toBe(false);
      expect(isCdiscNullFlavor("   ")).toBe(false);
      expect(isCdiscNullFlavor(null)).toBe(false);
      expect(isCdiscNullFlavor(undefined)).toBe(false);
      expect(isCdiscNullFlavor(123)).toBe(false);
      expect(isCdiscNullFlavor({})).toBe(false);
      expect(isCdiscNullFlavor([])).toBe(false);
      expect(isCdiscNullFlavor(true)).toBe(false);
    });
  });

  describe("parsePrecisionDate", () => {
    it("handles null, undefined, empty, and whitespace-only inputs", () => {
      const expectedBlank = {
        year: null,
        month: null,
        day: null,
        isPartial: false,
        isValid: false,
        isoString: "",
      };

      expect(parsePrecisionDate(null)).toEqual(expectedBlank);
      expect(parsePrecisionDate(undefined)).toEqual(expectedBlank);
      expect(parsePrecisionDate("")).toEqual(expectedBlank);
      expect(parsePrecisionDate("   ")).toEqual(expectedBlank);
      // Non-string casting edge case
      expect(parsePrecisionDate(12345 as unknown as string)).toEqual(
        expectedBlank
      );
    });

    it("parses CDISC null flavor strings", () => {
      const res = parsePrecisionDate("ND");
      expect(res).toEqual({
        year: null,
        month: null,
        day: null,
        isPartial: false,
        isValid: true,
        nullFlavor: "ND",
        isoString: "ND",
      });

      const resTrimmed = parsePrecisionDate("  asku ");
      expect(resTrimmed).toEqual({
        year: null,
        month: null,
        day: null,
        isPartial: false,
        isValid: true,
        nullFlavor: "ASKU",
        isoString: "ASKU",
      });
    });

    it("parses valid full ISO 8601 dates (YYYY-MM-DD)", () => {
      const res = parsePrecisionDate("2026-08-19");
      expect(res).toEqual({
        year: 2026,
        month: 8,
        day: 19,
        isPartial: false,
        isValid: true,
        isoString: "2026-08-19",
      });

      // Leap year valid date
      const leapRes = parsePrecisionDate("2024-02-29");
      expect(leapRes).toEqual({
        year: 2024,
        month: 2,
        day: 29,
        isPartial: false,
        isValid: true,
        isoString: "2024-02-29",
      });
    });

    it("identifies invalid full ISO 8601 dates", () => {
      // Non-leap year Feb 29
      const nonLeapRes = parsePrecisionDate("2025-02-29");
      expect(nonLeapRes).toEqual({
        year: 2025,
        month: 2,
        day: 29,
        isPartial: false,
        isValid: false,
        isoString: "2025-02-29",
      });

      // Invalid month
      const invalidMonth = parsePrecisionDate("2026-13-01");
      expect(invalidMonth.isValid).toBe(false);

      // Month 0
      const monthZero = parsePrecisionDate("2026-00-15");
      expect(monthZero.isValid).toBe(false);

      // Day 0
      const dayZero = parsePrecisionDate("2026-05-00");
      expect(dayZero.isValid).toBe(false);

      // Day out of range for 30-day month
      const apr31 = parsePrecisionDate("2026-04-31");
      expect(apr31.isValid).toBe(false);
    });

    it("parses partial dates with unknown day (YYYY-MM, YYYY-MM-UNK, YYYY-MM-UN, YYYY-MM-??)", () => {
      const formats = ["2026-08", "2026-08-UNK", "2026-08-UN", "2026-08-??"];
      for (const fmt of formats) {
        const res = parsePrecisionDate(fmt);
        expect(res).toEqual({
          year: 2026,
          month: 8,
          day: null,
          isPartial: true,
          isValid: true,
          isoString: "2026-08-UNK",
        });
      }
    });

    it("identifies invalid partial dates with unknown day when month is invalid", () => {
      const invalidMonthPartial = parsePrecisionDate("2026-13-UNK");
      expect(invalidMonthPartial).toEqual({
        year: 2026,
        month: 13,
        day: null,
        isPartial: true,
        isValid: false,
        isoString: "2026-13-UNK",
      });

      const zeroMonthPartial = parsePrecisionDate("2026-00-UNK");
      expect(zeroMonthPartial.isValid).toBe(false);
    });

    it("parses partial dates with unknown month & day (YYYY, YYYY-UNK-UNK, YYYY-UN-UN, YYYY-??-??)", () => {
      const formats = ["2026", "2026-UNK-UNK", "2026-UN-UN", "2026-??-??"];
      for (const fmt of formats) {
        const res = parsePrecisionDate(fmt);
        expect(res).toEqual({
          year: 2026,
          month: null,
          day: null,
          isPartial: true,
          isValid: true,
          isoString: "2026-UNK-UNK",
        });
      }
    });

    it("identifies invalid year-only partial dates when year is outside 1000-9999", () => {
      const invalidYearSmall = parsePrecisionDate("0999-UNK-UNK");
      expect(invalidYearSmall).toEqual({
        year: 999,
        month: null,
        day: null,
        isPartial: true,
        isValid: false,
        isoString: "0999-UNK-UNK",
      });
    });

    it("handles completely malformed or unparseable inputs", () => {
      const badInputs = [
        "not-a-date",
        "2026/08/19",
        "2026.08.19",
        "2026-8-19",
        "ABC-12-34",
      ];
      for (const input of badInputs) {
        const res = parsePrecisionDate(input);
        expect(res).toEqual({
          year: null,
          month: null,
          day: null,
          isPartial: false,
          isValid: false,
          isoString: input.toUpperCase(),
        });
      }
    });
  });

  describe("formatPrecisionDate", () => {
    it("returns empty string when year is missing, invalid, or UNK", () => {
      expect(formatPrecisionDate(null)).toBe("");
      expect(formatPrecisionDate(undefined)).toBe("");
      expect(formatPrecisionDate("")).toBe("");
      expect(formatPrecisionDate("   ")).toBe("");
      expect(formatPrecisionDate("UNK")).toBe("");
      expect(formatPrecisionDate(999)).toBe("");
      expect(formatPrecisionDate(10000)).toBe("");
      expect(formatPrecisionDate("not-a-year")).toBe("");
    });

    it("formats year-only partial date when month is missing, UNK, or 0", () => {
      expect(formatPrecisionDate(2026)).toBe("2026-UNK-UNK");
      expect(formatPrecisionDate(2026, null)).toBe("2026-UNK-UNK");
      expect(formatPrecisionDate(2026, "UNK")).toBe("2026-UNK-UNK");
      expect(formatPrecisionDate(2026, 0)).toBe("2026-UNK-UNK");
      expect(formatPrecisionDate("2026", "13")).toBe("2026-UNK-UNK");
      expect(formatPrecisionDate(2026, "invalid")).toBe("2026-UNK-UNK");
    });

    it("formats year-month partial date when day is missing, UNK, 0, or out of range", () => {
      expect(formatPrecisionDate(2026, 8)).toBe("2026-08-UNK");
      expect(formatPrecisionDate(2026, 8, null)).toBe("2026-08-UNK");
      expect(formatPrecisionDate(2026, 8, "UNK")).toBe("2026-08-UNK");
      expect(formatPrecisionDate(2026, 8, 0)).toBe("2026-08-UNK");
      expect(formatPrecisionDate(2026, 8, 32)).toBe("2026-08-UNK"); // August has 31 days
      expect(formatPrecisionDate(2026, 4, 31)).toBe("2026-04-UNK"); // April has 30 days
      expect(formatPrecisionDate(2026, 8, "abc")).toBe("2026-08-UNK");
    });

    it("formats full date when year, month, and day are valid", () => {
      expect(formatPrecisionDate(2026, 8, 19)).toBe("2026-08-19");
      expect(formatPrecisionDate("2026", "08", "19")).toBe("2026-08-19");
      expect(formatPrecisionDate(2024, 2, 29)).toBe("2024-02-29"); // Leap year Feb 29
    });
  });

  describe("daysInMonth", () => {
    it("returns correct number of days for leap and non-leap February", () => {
      expect(daysInMonth(2024, 2)).toBe(29);
      expect(daysInMonth(2025, 2)).toBe(28);
      expect(daysInMonth(2000, 2)).toBe(29);
      expect(daysInMonth(1900, 2)).toBe(28);
    });

    it("returns correct number of days for 30-day and 31-day months", () => {
      const thirtyOneDayMonths = [1, 3, 5, 7, 8, 10, 12];
      for (const m of thirtyOneDayMonths) {
        expect(daysInMonth(2026, m)).toBe(31);
      }

      const thirtyDayMonths = [4, 6, 9, 11];
      for (const m of thirtyDayMonths) {
        expect(daysInMonth(2026, m)).toBe(30);
      }
    });
  });

  describe("isFutureDate", () => {
    const refDate = new Date("2026-08-19T12:00:00Z");

    it("returns false for invalid dates or null flavors", () => {
      expect(isFutureDate("ND", refDate)).toBe(false);
      expect(isFutureDate("invalid-date", refDate)).toBe(false);
      expect(isFutureDate("", refDate)).toBe(false);
    });

    it("correctly compares full dates against reference date", () => {
      // Past year
      expect(isFutureDate("2025-08-19", refDate)).toBe(false);
      // Future year
      expect(isFutureDate("2027-01-01", refDate)).toBe(true);

      // Same year, past month
      expect(isFutureDate("2026-07-31", refDate)).toBe(false);
      // Same year, future month
      expect(isFutureDate("2026-09-01", refDate)).toBe(true);

      // Same year, same month, past day
      expect(isFutureDate("2026-08-18", refDate)).toBe(false);
      // Same year, same month, same day
      expect(isFutureDate("2026-08-19", refDate)).toBe(false);
      // Same year, same month, future day
      expect(isFutureDate("2026-08-20", refDate)).toBe(true);
    });

    it("correctly handles partial dates when month or day is missing", () => {
      // Future year partial
      expect(isFutureDate("2027-UNK-UNK", refDate)).toBe(true);
      // Past year partial
      expect(isFutureDate("2025-UNK-UNK", refDate)).toBe(false);

      // Same year, missing month
      expect(isFutureDate("2026-UNK-UNK", refDate)).toBe(false);

      // Same year, future month partial
      expect(isFutureDate("2026-09-UNK", refDate)).toBe(true);
      // Same year, past month partial
      expect(isFutureDate("2026-07-UNK", refDate)).toBe(false);
      // Same year, same month partial
      expect(isFutureDate("2026-08-UNK", refDate)).toBe(false);
    });

    it("uses default current Date if referenceDate parameter is omitted", () => {
      const futureYear = new Date().getUTCFullYear() + 5;
      expect(isFutureDate(`${futureYear}-01-01`)).toBe(true);
      expect(isFutureDate("2000-01-01")).toBe(false);
    });
  });

  describe("validatePrecisionDate", () => {
    it("returns error if value is blank or missing", () => {
      expect(validatePrecisionDate(null)).toEqual({
        isValid: false,
        error: "Date value is required.",
        parsed: parsePrecisionDate(null),
      });
      expect(validatePrecisionDate("")).toEqual({
        isValid: false,
        error: "Date value is required.",
        parsed: parsePrecisionDate(""),
      });
      expect(validatePrecisionDate("   ")).toEqual({
        isValid: false,
        error: "Date value is required.",
        parsed: parsePrecisionDate("   "),
      });
    });

    it("handles null flavor codes according to options", () => {
      // Default: null flavor allowed
      const defaultRes = validatePrecisionDate("ND");
      expect(defaultRes.isValid).toBe(true);
      expect(defaultRes.isNullFlavor).toBe(true);
      expect(defaultRes.isPartial).toBe(false);

      // Disallow null flavor
      const disallowedRes = validatePrecisionDate("ND", {
        allowNullFlavor: false,
      });
      expect(disallowedRes.isValid).toBe(false);
      expect(disallowedRes.isNullFlavor).toBe(true);
      expect(disallowedRes.error).toBe(
        "Null flavor code 'ND' is not permitted for this field."
      );
    });

    it("returns error for invalid date formats", () => {
      const res = validatePrecisionDate("2026-02-30");
      expect(res.isValid).toBe(false);
      expect(res.error).toBe(
        'Invalid ISO 8601 date format: "2026-02-30". Expected YYYY-MM-DD or partial date.'
      );
    });

    it("handles partial dates according to options", () => {
      // Default: partial allowed
      const defaultPartial = validatePrecisionDate("2026-08");
      expect(defaultPartial.isValid).toBe(true);
      expect(defaultPartial.isPartial).toBe(true);

      // Disallow partial
      const disallowedPartial = validatePrecisionDate("2026-08", {
        allowPartial: false,
      });
      expect(disallowedPartial.isValid).toBe(false);
      expect(disallowedPartial.isPartial).toBe(true);
      expect(disallowedPartial.error).toBe(
        "Partial dates are not allowed for this field. Complete YYYY-MM-DD required."
      );
    });

    it("handles future dates according to options", () => {
      const refDate = new Date("2026-08-19T12:00:00Z");

      // Default: future date allowed
      const defaultFuture = validatePrecisionDate("2026-08-20", {
        referenceDate: refDate,
      });
      expect(defaultFuture.isValid).toBe(true);

      // Prevent future date
      const preventedFuture = validatePrecisionDate("2026-08-20", {
        preventFutureDate: true,
        referenceDate: refDate,
      });
      expect(preventedFuture.isValid).toBe(false);
      expect(preventedFuture.error).toBe(
        'Future dates are not permitted. "2026-08-20" is later than the current UTC timestamp.'
      );

      // Past date with preventFutureDate
      const allowedPast = validatePrecisionDate("2026-08-18", {
        preventFutureDate: true,
        referenceDate: refDate,
      });
      expect(allowedPast.isValid).toBe(true);
    });
  });

  describe("validateCdashVariableName", () => {
    it("rejects blank, empty, or non-string inputs", () => {
      expect(validateCdashVariableName("")).toEqual({
        isValid: false,
        error: "Variable name cannot be blank.",
        sanitized: "",
      });
      expect(validateCdashVariableName("   ")).toEqual({
        isValid: false,
        error: "Variable name cannot be blank.",
        sanitized: "",
      });
      expect(validateCdashVariableName(null as unknown as string)).toEqual({
        isValid: false,
        error: "Variable name cannot be blank.",
        sanitized: "",
      });
    });

    it("rejects variable names exceeding 8 characters and sanitizes by truncating", () => {
      const res = validateCdashVariableName("VERYLONGVARNAME");
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("exceeds CDASH/SAS 8-character limit");
      expect(res.sanitized).toBe("VERYLONG");
    });

    it("rejects variable names not starting with a letter A-Z and sanitizes by adding V_ prefix", () => {
      const resNum = validateCdashVariableName("123VAR");
      expect(resNum.isValid).toBe(false);
      expect(resNum.error).toContain("must start with a letter (A-Z)");
      expect(resNum.sanitized).toBe("V_123VAR");

      const resUnderscore = validateCdashVariableName("_VAR");
      expect(resUnderscore.isValid).toBe(false);
      expect(resUnderscore.sanitized).toBe("V__VAR");
    });

    it("rejects variable names containing invalid characters and sanitizes with underscores", () => {
      const res = validateCdashVariableName("VAR-1!");
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("contains invalid characters");
      expect(res.sanitized).toBe("VAR_1_");
    });

    it("accepts valid CDASH variable names", () => {
      const validNames = ["AGE", "VSTESTCD", "LB_TEST", "A", "VAR_1234"];
      for (const name of validNames) {
        const res = validateCdashVariableName(name);
        expect(res.isValid).toBe(true);
        expect(res.sanitized).toBe(name);
      }
    });

    it("converts lowercase valid names to uppercase in sanitized output", () => {
      const res = validateCdashVariableName("vstestcd");
      expect(res.isValid).toBe(true);
      expect(res.sanitized).toBe("VSTESTCD");
    });
  });

  describe("generateEngineId", () => {
    it("generates ID with prefix using crypto.randomUUID when available", () => {
      const id = generateEngineId("FIELD");
      expect(id.startsWith("FIELD_")).toBe(true);
      expect(id.length).toBeGreaterThan("FIELD_".length);
    });

    it("uses fallback random string generator when crypto.randomUUID is absent", () => {
      vi.stubGlobal("crypto", {});

      try {
        const id = generateEngineId("PREFIX");
        expect(id.startsWith("PREFIX_")).toBe(true);
        const parts = id.split("_");
        expect(parts.length).toBe(3);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe("generateCdashVariableName", () => {
    function createExhaustedNumericSet(stem: string = "T"): Set<string> {
      const set = new Set<string>();
      for (let i = 2; i < 1000; i++) {
        set.add(`${stem}_${i}`);
      }
      return set;
    }

    it("returns unused valid names unchanged, including names at the 8-character limit", () => {
      for (const name of ["A", "AGE", "VSTESTCD", "VAR_1234"]) {
        expect(generateCdashVariableName(name, [])).toBe(name);
      }
    });

    it("cleans baseName and ensures valid CDASH variable format", () => {
      expect(generateCdashVariableName("test", [])).toBe("TEST");
      expect(generateCdashVariableName("123test", [])).toBe("V_TEST");
      expect(generateCdashVariableName("", [])).toBe("VAR");
    });

    it("adds numeric suffixes only when the normalized base name collides", () => {
      expect(generateCdashVariableName("TEST", ["test"])).toBe("TEST_2");
      expect(generateCdashVariableName("TEST", ["TEST", "TEST_2"])).toBe(
        "TEST_3"
      );
    });

    it("works with existing variable names as Set, Array, or Iterable", () => {
      const existingArray = ["VAR", "VAR_2", "VAR_3"];
      expect(generateCdashVariableName("VAR", existingArray)).toBe("VAR_4");

      const existingSet = new Set(["VAR", "VAR_2", "VAR_3"]);
      expect(generateCdashVariableName("VAR", existingSet)).toBe("VAR_4");

      const existingIterable = {
        *[Symbol.iterator]() {
          yield "VAR";
          yield "VAR_2";
          yield "VAR_3";
        },
      };
      expect(generateCdashVariableName("VAR", existingIterable)).toBe("VAR_4");
    });

    it("keeps an unused long name as its truncated 8-character base", () => {
      expect(generateCdashVariableName("VERYLONGNAME", new Set())).toBe(
        "VERYLONG"
      );
    });

    it("truncates a colliding long base to keep the generated name within 8 characters", () => {
      const generated = generateCdashVariableName("VERYLONGVARNAME", [
        "VERYLONG",
      ]);
      expect(generated).toBe("VERYLO_2");
      expect(generated.length).toBeLessThanOrEqual(8);
    });

    it("leaves an unused name with an existing numeric suffix unchanged", () => {
      expect(generateCdashVariableName("TEST_1", ["TEST_2"])).toBe("TEST_1");
    });

    it("increments the numeric suffix when a suffixed base name collides", () => {
      const generated = generateCdashVariableName("TEST_1", [
        "TEST_1",
        "TEST_2",
      ]);
      expect(generated).toBe("TEST_3");
    });

    it("falls back to letter suffixes when numeric counters reach the limit", () => {
      // Mock existing names set where all numeric counters _2 through _999 exist for stem "T".
      const existing = createExhaustedNumericSet("T");
      existing.add("T");
      const generated = generateCdashVariableName("T", existing);
      expect(generated).toBe("T_A");
      expect(generated.length).toBeLessThanOrEqual(8);

      existing.add("T_A");
      const generatedB = generateCdashVariableName("T", existing);
      expect(generatedB).toBe("T_B");
    });

    it("falls back to VAR when baseName consists only of non-alphabetic characters", () => {
      expect(generateCdashVariableName("12345", [])).toBe("V_VAR");
      expect(generateCdashVariableName("12345", ["v_var"])).toBe("V_VAR_2");
    });

    it("handles random candidate collision during ultimate fallback loop", () => {
      const existing = createExhaustedNumericSet("T");
      existing.add("T");
      for (let code = 65; code <= 90; code++) {
        existing.add(`T_${String.fromCharCode(code)}`);
      }

      // Mock an existing random candidate to ensure the ultimate fallback retries.
      const firstRandVal = 0.123456789;
      const firstRandCandidate =
        `V_${firstRandVal.toString(36).slice(2, 8).toUpperCase()}`.slice(0, 8);
      existing.add(firstRandCandidate);

      const spy = vi.spyOn(Math, "random");
      spy.mockReturnValueOnce(firstRandVal).mockReturnValueOnce(0.987654321);

      try {
        const generated = generateCdashVariableName("T", existing);
        expect(generated.length).toBeLessThanOrEqual(8);
        expect(existing.has(generated)).toBe(false);
        expect(spy).toHaveBeenCalledTimes(2);
      } finally {
        spy.mockRestore();
      }
    });

    it("matches existing base names and suffixes case-insensitively", () => {
      const existingArray = ["vstest", "vstest_2"];
      expect(generateCdashVariableName("VSTEST", existingArray)).toBe(
        "VSTEST_3"
      );

      const existingSet = new Set(["vstest", "vstest_2"]);
      expect(generateCdashVariableName("VSTEST", existingSet)).toBe("VSTEST_3");
    });
  });
});
