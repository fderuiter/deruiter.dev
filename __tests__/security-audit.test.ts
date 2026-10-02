// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MockInstance } from "vitest";
import { spawnSync, type SpawnSyncReturns } from "child_process";
import fs from "fs";
import { fromPartial } from "@total-typescript/shoehorn";

vi.mock("child_process", () => {
  const mSpawnSync = vi.fn();
  return {
    spawnSync: mSpawnSync,
    default: {
      spawnSync: mSpawnSync,
    },
  };
});

import {
  isPretextRelated,
  loadIgnoreList,
  parseIgnoreRules,
  runSecurityAudit,
  collectAdvisoriesForVulnerability,
  matchAdvisoryRule,
  WARN_THRESHOLD_DAYS,
  writeStepSummary,
  writeAuditFailureStepSummary,
} from "../scripts/security-audit";
import type {
  VulnerabilityInfo,
  ParsedIgnoreRule,
  Advisory,
} from "../scripts/security-audit";

describe("Security Audit Script", () => {
  let exitSpy: MockInstance<typeof process.exit>;
  let logSpy: MockInstance<typeof console.log>;
  let errorSpy: MockInstance<typeof console.error>;
  let warnSpy: MockInstance<typeof console.warn>;

  beforeEach(() => {
    vi.resetAllMocks();
    exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit called with ${code}`);
    }) as never;
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {}) as never;
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {}) as never;
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {}) as never;
  });

  afterEach(() => {
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("exports WARN_THRESHOLD_DAYS constant set to 14", () => {
    expect(WARN_THRESHOLD_DAYS).toBe(14);
  });

  describe("isPretextRelated", () => {
    it("returns true for exact package name", () => {
      expect(isPretextRelated("@chenglou/pretext", {})).toBe(true);
    });

    it("returns true for names containing pretext", () => {
      expect(isPretextRelated("pretext-helper", {})).toBe(true);
    });

    it("returns true if via array contains a string with pretext", () => {
      expect(isPretextRelated("some-dep", { via: ["@chenglou/pretext"] })).toBe(
        true
      );
    });

    it("returns true if via array contains an object with pretext dependency details", () => {
      expect(
        isPretextRelated("some-dep", {
          via: [{ name: "@chenglou/pretext", title: "vulnerability" }],
        })
      ).toBe(true);
    });

    it("returns false for non-pretext package", () => {
      expect(isPretextRelated("lodash", { via: ["another-package"] })).toBe(
        false
      );
    });
  });

  describe("parseIgnoreRules", () => {
    const fixedNow = new Date("2026-08-18T12:00:00Z");

    it("parses valid Critical rules with explicit advisory ID, future expiration date <= 14 days, and justification", () => {
      const input = [
        {
          advisory: "GHSA-c2qf-rxjj-4v5w",
          package: "concurrently",
          expiresAt: "2026-08-28T12:00:00Z",
          severity: "critical",
          reason: "CLI process runner tool",
          owner: "repository-owner",
          followUp: "#725",
        },
      ];
      const rules = parseIgnoreRules(input, fixedNow);
      expect(rules).toHaveLength(1);
      expect(rules[0].advisory).toBe("GHSA-c2qf-rxjj-4v5w");
      expect(rules[0].package).toBe("concurrently");
      expect(rules[0].severity).toBe("critical");
      expect(rules[0].isValid).toBe(true);
      expect(rules[0].isExpired).toBe(false);
      expect(rules[0].reason).toBe("CLI process runner tool");
      expect(rules[0].remainingDays).toBe(10);
    });

    it("parses valid High rules with explicit advisory ID, future expiration date <= 30 days, and justification", () => {
      const input = [
        {
          advisory: "GHSA-high-1234",
          package: "high-pkg",
          expiresAt: "2026-09-07T12:00:00Z",
          severity: "high",
          reason: "High severity exception",
          owner: "sec-team",
          followUp: "#888",
        },
      ];
      const rules = parseIgnoreRules(input, fixedNow);
      expect(rules).toHaveLength(1);
      expect(rules[0].isValid).toBe(true);
      expect(rules[0].severity).toBe("high");
      expect(rules[0].remainingDays).toBe(20);
    });

    it("defaults omitted severity field to critical and caps lifespan at 14 days", () => {
      const inputNoSeverity = [
        {
          advisory: "GHSA-default-crit",
          package: "pkg-x",
          expiresAt: "2026-08-28T12:00:00Z",
          reason: "Default severity test",
          owner: "owner",
          followUp: "#101",
        },
      ];
      const rules = parseIgnoreRules(inputNoSeverity, fixedNow);
      expect(rules[0].isValid).toBe(true);
      expect(rules[0].severity).toBe("critical");

      const inputExceedsDefault = [
        {
          advisory: "GHSA-default-crit",
          package: "pkg-x",
          expiresAt: "2026-09-10T12:00:00Z",
          reason: "Default severity test",
          owner: "owner",
          followUp: "#101",
        },
      ];
      const rulesExceeds = parseIgnoreRules(inputExceedsDefault, fixedNow);
      expect(rulesExceeds[0].isValid).toBe(false);
      expect(rulesExceeds[0].validationError).toContain(
        "exceeds the maximum 14-day lifespan"
      );
    });

    it("marks rules as invalid if invalid severity value is provided", () => {
      const inputInvalidSev = [
        {
          advisory: "GHSA-1234",
          package: "pkg-y",
          expiresAt: "2026-08-25T12:00:00Z",
          severity: "medium",
          reason: "Invalid severity test",
          owner: "owner",
          followUp: "#102",
        },
      ];
      const rules = parseIgnoreRules(inputInvalidSev, fixedNow);
      expect(rules[0].isValid).toBe(false);
      expect(rules[0].validationError).toContain("invalid severity");
    });

    it("marks Critical rules as invalid if expiration date exceeds 14-day cap", () => {
      const inputExceedsCap = [
        {
          advisory: "GHSA-c2qf-rxjj-4v5w",
          package: "concurrently",
          expiresAt: "2027-12-31T23:59:59Z",
          severity: "critical",
          reason: "Distant expiration date",
          owner: "repository-owner",
          followUp: "#725",
        },
      ];
      const rules = parseIgnoreRules(inputExceedsCap, fixedNow);
      expect(rules[0].isValid).toBe(false);
      expect(rules[0].validationError).toContain(
        "exceeds the maximum 14-day lifespan"
      );
    });

    it("marks High rules as invalid if expiration date exceeds 30-day cap", () => {
      const inputExceedsCapHigh = [
        {
          advisory: "GHSA-high-exceeds",
          package: "concurrently",
          expiresAt: "2027-12-31T23:59:59Z",
          severity: "high",
          reason: "Distant expiration date",
          owner: "repository-owner",
          followUp: "#725",
        },
      ];
      const rules = parseIgnoreRules(inputExceedsCapHigh, fixedNow);
      expect(rules[0].isValid).toBe(false);
      expect(rules[0].validationError).toContain(
        "exceeds the maximum 30-day lifespan"
      );
    });

    it("parses valid Moderate rules with explicit advisory ID, future expiration date <= 90 days, and justification", () => {
      const input = [
        {
          advisory: "GHSA-mod-1234",
          package: "mod-pkg",
          expiresAt: "2026-11-15T12:00:00Z",
          severity: "moderate",
          reason: "Moderate severity exception",
          owner: "sec-team",
          followUp: "#999",
        },
      ];
      const rules = parseIgnoreRules(input, fixedNow);
      expect(rules).toHaveLength(1);
      expect(rules[0].isValid).toBe(true);
      expect(rules[0].severity).toBe("moderate");
      expect(rules[0].remainingDays).toBe(89);
    });

    it("marks Moderate rules as invalid if expiration date exceeds 90-day cap", () => {
      const inputExceedsCapMod = [
        {
          advisory: "GHSA-mod-exceeds",
          package: "concurrently",
          expiresAt: "2027-12-31T23:59:59Z",
          severity: "moderate",
          reason: "Distant expiration date",
          owner: "repository-owner",
          followUp: "#725",
        },
      ];
      const rules = parseIgnoreRules(inputExceedsCapMod, fixedNow);
      expect(rules[0].isValid).toBe(false);
      expect(rules[0].validationError).toContain(
        "exceeds the maximum 90-day lifespan"
      );
    });

    it("marks rules as invalid if missing expiration date or justification", () => {
      const inputNoExpires = [
        { advisory: "GHSA-1234", package: "pkg-a", reason: "some reason" },
      ];
      const rulesNoExpires = parseIgnoreRules(inputNoExpires, fixedNow);
      expect(rulesNoExpires[0].isValid).toBe(false);
      expect(rulesNoExpires[0].validationError).toContain("expiration date");

      const inputNoReason = [
        { advisory: "GHSA-1234", package: "pkg-b", expiresAt: "2026-10-15" },
      ];
      const rulesNoReason = parseIgnoreRules(inputNoReason, fixedNow);
      expect(rulesNoReason[0].isValid).toBe(false);
      expect(rulesNoReason[0].validationError).toContain(
        "business justification"
      );
    });

    it("marks residual-risk rules as invalid without an owner and follow-up ticket", () => {
      const rules = parseIgnoreRules(
        [
          {
            advisory: "GHSA-owned-risk",
            package: "example-package",
            expiresAt: "2026-10-15T23:59:59Z",
            reason: "No compatible patched release exists yet",
          },
        ],
        fixedNow
      );

      expect(rules[0].isValid).toBe(false);
      expect(rules[0].validationError).toContain("risk owner");
      expect(rules[0].validationError).toContain("follow-up ticket");
    });

    it("marks rules as invalid if legacy string format is used", () => {
      const inputLegacy = ["concurrently", "next"];
      const rules = parseIgnoreRules(inputLegacy, fixedNow);
      expect(rules).toHaveLength(2);
      expect(rules[0].isValid).toBe(false);
      expect(rules[0].validationError).toContain("missing a valid advisory ID");
    });

    it("marks rules as expired if expiration date is in the past", () => {
      const inputExpired = [
        {
          advisory: "GHSA-expired-1234",
          package: "expired-pkg",
          expiresAt: "2025-01-01T00:00:00Z",
          reason: "Old exception",
          owner: "repository-owner",
          followUp: "#725",
        },
      ];
      const rules = parseIgnoreRules(inputExpired, fixedNow);
      expect(rules[0].isValid).toBe(true);
      expect(rules[0].isExpired).toBe(true);
      expect(rules[0].remainingDays).toBe(0);
      expect(rules[0].isApproachingExpiration).toBe(false);
    });

    it("enforces tiered warning thresholds: 7 days for Critical and 14 days for High", () => {
      const rules = parseIgnoreRules(
        [
          {
            advisory: "GHSA-crit-approaching",
            expiresAt: "2026-08-23T12:00:00Z",
            severity: "critical",
            reason: "r",
            owner: "o",
            followUp: "#1",
          },
          {
            advisory: "GHSA-crit-safe",
            expiresAt: "2026-08-28T12:00:00Z",
            severity: "critical",
            reason: "r",
            owner: "o",
            followUp: "#2",
          },
          {
            advisory: "GHSA-high-approaching",
            expiresAt: "2026-08-28T12:00:00Z",
            severity: "high",
            reason: "r",
            owner: "o",
            followUp: "#3",
          },
          {
            advisory: "GHSA-high-safe",
            expiresAt: "2026-09-07T12:00:00Z",
            severity: "high",
            reason: "r",
            owner: "o",
            followUp: "#4",
          },
        ],
        fixedNow
      );

      expect(rules[0].isApproachingExpiration).toBe(true);
      expect(rules[1].isApproachingExpiration).toBe(false);
      expect(rules[2].isApproachingExpiration).toBe(true);
      expect(rules[3].isApproachingExpiration).toBe(false);
    });
  });

  describe("collectAdvisoriesForVulnerability & matchAdvisoryRule", () => {
    it("evaluates nested advisory records across package dependency references", () => {
      const vulnerabilities: Record<string, VulnerabilityInfo> = {
        "@lhci/cli": {
          name: "@lhci/cli",
          severity: "high",
          via: ["extract-zip"],
        },
        "extract-zip": {
          name: "extract-zip",
          severity: "high",
          via: [
            {
              source: 1139346,
              name: "extract-zip",
              url: "https://github.com/advisories/GHSA-jmr9-qjv8-65gv",
              title: "extract-zip unvalidated symlink path traversal",
            } as Advisory,
          ],
        },
      };

      const advisories = collectAdvisoriesForVulnerability(
        "@lhci/cli",
        vulnerabilities
      );
      expect(advisories).toHaveLength(1);
      expect(advisories[0].url).toContain("GHSA-jmr9-qjv8-65gv");

      const rule: ParsedIgnoreRule = {
        advisory: "GHSA-jmr9-qjv8-65gv",
        expiresAt: "2026-10-15T00:00:00Z",
        severity: "critical",
        reason: "Test exception",
        owner: "repository-owner",
        followUp: "#725",
        isValid: true,
        isExpired: false,
      };

      expect(matchAdvisoryRule(rule, advisories[0], "@lhci/cli")).toBe(true);
    });
  });

  describe("loadIgnoreList", () => {
    it("parses valid rules from security-audit-ignore.json", () => {
      const fixedNow = new Date("2026-08-19T12:00:00Z");
      const list = loadIgnoreList(fixedNow);
      expect(Array.isArray(list)).toBe(true);
    });
  });

  describe("runSecurityAudit", () => {
    const testNow = new Date("2026-08-19T12:00:00Z");

    it("should pass when there are no vulnerabilities", () => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {},
          }),
        })
      );

      expect(() => runSecurityAudit({ now: testNow })).toThrowError(
        "process.exit called with 0"
      );
      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(logSpy).toHaveBeenCalled();
    });

    it("should ignore low and moderate vulnerabilities and pass by default", () => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {
              lodash: {
                name: "lodash",
                severity: "moderate",
              },
              ms: {
                name: "ms",
                severity: "low",
              },
            },
          }),
        })
      );

      expect(() => runSecurityAudit({ now: testNow })).toThrowError(
        "process.exit called with 0"
      );
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("should evaluate moderate vulnerabilities and fail when run with severity=moderate", () => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {
              lodash: {
                name: "lodash",
                severity: "moderate",
                via: [
                  {
                    source: "GHSA-mod-lodash",
                    title: "Moderate vulnerability",
                  },
                ],
              },
            },
          }),
        })
      );

      expect(() =>
        runSecurityAudit({ now: testNow, severity: "moderate" })
      ).toThrowError("process.exit called with 1");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should pass when high/critical vulnerabilities match a valid, active advisory ignore rule", () => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {
              concurrently: {
                name: "concurrently",
                severity: "critical",
                via: [
                  {
                    source: "GHSA-c2qf-rxjj-4v5w",
                    title: "Command Injection",
                    url: "https://github.com/advisories/GHSA-c2qf-rxjj-4v5w",
                  },
                ],
              },
            },
          }),
        })
      );

      const validRawData = [
        {
          advisory: "GHSA-c2qf-rxjj-4v5w",
          package: "concurrently",
          expiresAt: "2026-08-28T23:59:59Z",
          severity: "critical",
          reason: "CLI runner tool",
          owner: "repository-owner",
          followUp: "#725",
        },
      ];
      vi.spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(validRawData)
      );
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      expect(() => runSecurityAudit({ now: testNow })).toThrowError(
        "process.exit called with 0"
      );
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("should fail when high/critical vulnerabilities do NOT match the ignore list", () => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {
              concurrently: {
                name: "concurrently",
                severity: "critical",
                via: [
                  {
                    source: "GHSA-unlisted-advisory-999",
                    title: "Unlisted Remote Code Execution",
                    url: "https://github.com/advisories/GHSA-unlisted-advisory-999",
                  },
                ],
              },
            },
          }),
        })
      );

      const validRawData = [
        {
          advisory: "GHSA-c2qf-rxjj-4v5w",
          package: "concurrently",
          expiresAt: "2026-08-28T23:59:59Z",
          severity: "critical",
          reason: "CLI runner tool",
          owner: "repository-owner",
          followUp: "#725",
        },
      ];
      vi.spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(validRawData)
      );
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      expect(() => runSecurityAudit({ now: testNow })).toThrowError(
        "process.exit called with 1"
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should fail when an ignore override is missing an advisory ID", () => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {},
          }),
        })
      );

      const invalidRawData = [
        {
          package: "concurrently",
          expiresAt: "2026-10-31T23:59:59Z",
          reason: "no advisory",
        },
      ];
      vi.spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(invalidRawData)
      );
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      expect(() => runSecurityAudit({ now: testNow })).toThrowError(
        "process.exit called with 1"
      );
      expect(exitSpy).toHaveBeenCalledWith(1);

      const errorCalls = errorSpy.mock.calls
        .map((call) => call[0] as string)
        .join("\n");
      expect(errorCalls).toContain("missing a valid advisory ID");
    });

    it("should fail when an ignore override sets an expiration date exceeding max lifespan", () => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {},
          }),
        })
      );

      const invalidRawData = [
        {
          advisory: "GHSA-c2qf-rxjj-4v5w",
          package: "concurrently",
          expiresAt: "2027-12-31T23:59:59Z",
          reason: "Exceeds 14-day cap",
          owner: "repository-owner",
          followUp: "#725",
        },
      ];
      vi.spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(invalidRawData)
      );
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      expect(() => runSecurityAudit({ now: testNow })).toThrowError(
        "process.exit called with 1"
      );
      expect(exitSpy).toHaveBeenCalledWith(1);

      const errorCalls = errorSpy.mock.calls
        .map((call) => call[0] as string)
        .join("\n");
      expect(errorCalls).toContain("exceeds the maximum 14-day lifespan");
    });

    it("should reject expired vulnerability overrides and fail when vulnerabilities exist", () => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {
              "expired-package": {
                name: "expired-package",
                severity: "high",
                via: [
                  {
                    source: "GHSA-expired-1111",
                    url: "https://github.com/advisories/GHSA-expired-1111",
                  },
                ],
              },
            },
          }),
        })
      );

      const expiredRawData = [
        {
          advisory: "GHSA-expired-1111",
          package: "expired-package",
          expiresAt: "2020-01-01T00:00:00Z",
          reason: "Expired exception",
          owner: "repository-owner",
          followUp: "#725",
        },
      ];
      vi.spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(expiredRawData)
      );
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      expect(() => runSecurityAudit({ now: testNow })).toThrowError(
        "process.exit called with 1"
      );
      expect(exitSpy).toHaveBeenCalledWith(1);

      const errorCalls = errorSpy.mock.calls
        .map((call) => call[0] as string)
        .join("\n");
      expect(errorCalls).toContain(
        'Vulnerability override for advisory "GHSA-expired-1111" expired on 2020-01-01T00:00:00Z. Override rejected.'
      );
    });

    it("should fail when unignored high/critical vulnerabilities exist", () => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {
              "unsafe-package": {
                name: "unsafe-package",
                severity: "high",
                via: [
                  {
                    title: "Malicious command execution",
                    url: "https://github.com/advisories/GHSA-unsafe",
                    range: "<1.0.0",
                  },
                ],
              },
            },
          }),
        })
      );

      expect(() => runSecurityAudit({ now: testNow })).toThrowError(
        "process.exit called with 1"
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("should handle pretext vulnerabilities by failing and logging redacted message", () => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {
              "@chenglou/pretext": {
                name: "@chenglou/pretext",
                severity: "high",
                via: [
                  {
                    title: "Denial of service via extremely long input",
                    url: "https://github.com/advisories/GHSA-pretext",
                    range: "<0.0.6",
                  },
                ],
              },
            },
          }),
        })
      );

      expect(() => runSecurityAudit({ now: testNow })).toThrowError(
        "process.exit called with 1"
      );
      expect(exitSpy).toHaveBeenCalledWith(1);

      const errorCalls = errorSpy.mock.calls
        .map((call) => call[0] as string)
        .join("\n");
      expect(errorCalls).toContain(
        "A dependency vulnerability affecting a core layout component has been detected"
      );
      expect(errorCalls).not.toContain(
        "Denial of service via extremely long input"
      );
      expect(errorCalls).not.toContain(
        "https://github.com/advisories/GHSA-pretext"
      );
    });

    it("should fail closed on empty stdout, non-JSON stderr, and status 1", () => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          status: 1,
          stdout: "",
          stderr: "npm ERR! code ENOTFOUND\nnpm ERR! network request failed",
        })
      );

      expect(() =>
        runSecurityAudit({ now: testNow, throwOnError: true })
      ).toThrowError("npm audit execution failed or returned invalid JSON.");
    });

    it("rejects non-report JSON even after a successful child exit", () => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          status: 0,
          stdout: "{}",
          stderr: "private-error-output",
        })
      );
      expect(() =>
        runSecurityAudit({ now: testNow, throwOnError: true })
      ).toThrowError("npm audit execution failed or returned invalid JSON.");
      expect(errorSpy.mock.calls.flat().join(" ")).not.toContain(
        "private-error-output"
      );
    });

    it("fails on a nonzero process exit even with a clean report", () => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          status: 1,
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {},
          }),
        })
      );
      expect(() =>
        runSecurityAudit({ now: testNow, throwOnError: true })
      ).toThrowError("npm audit execution failed or returned invalid JSON.");
    });

    it("should fail closed on spawn execution error", () => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          error: new Error("spawn npm ENOENT"),
          stdout: "",
          stderr: "",
        })
      );

      expect(() =>
        runSecurityAudit({ now: testNow, throwOnError: true })
      ).toThrowError("npm audit execution failed or returned invalid JSON.");
    });

    it("should parse warning-prefixed valid JSON output in stdout or stderr successfully", () => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          status: 0,
          stdout:
            "npm WARN config global `--global`, `--local` are deprecated\n" +
            JSON.stringify({
              auditReportVersion: 2,
              vulnerabilities: {},
            }),
          stderr: "",
        })
      );

      const result = runSecurityAudit({ now: testNow, throwOnError: true });
      expect(result).toBe(true);
    });

    it("should write GITHUB_STEP_SUMMARY when process.env.GITHUB_STEP_SUMMARY is set", () => {
      const summaryPath = "/tmp/test-step-summary.md";
      const appendSpy = vi
        .spyOn(fs, "appendFileSync")
        .mockImplementation(() => {});
      process.env.GITHUB_STEP_SUMMARY = summaryPath;

      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          status: 0,
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {},
          }),
        })
      );

      runSecurityAudit({ now: testNow, throwOnError: true });
      expect(appendSpy).toHaveBeenCalledWith(
        summaryPath,
        expect.stringContaining("Security Vulnerability Audit Report"),
        "utf8"
      );

      delete process.env.GITHUB_STEP_SUMMARY;
    });

    it("logs yellow warning with console.warn for active rules approaching expiration within 14 days", () => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {},
          }),
        })
      );

      // testNow = "2026-08-19T12:00:00Z". Expiration = "2026-08-24T12:00:00Z" (5 days)
      const approachingRawData = [
        {
          advisory: "GHSA-c2qf-rxjj-4v5w",
          package: "concurrently",
          expiresAt: "2026-08-24T12:00:00Z",
          reason: "CLI process runner",
          owner: "dev-team",
          followUp: "#888",
        },
      ];
      vi.spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(approachingRawData)
      );
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      expect(() => runSecurityAudit({ now: testNow })).toThrowError(
        "process.exit called with 0"
      );
      expect(exitSpy).toHaveBeenCalledWith(0);

      const warnCalls = warnSpy.mock.calls
        .map((call) => call[0] as string)
        .join("\n");
      expect(warnCalls).toContain(
        '⚠️ WARNING: Vulnerability override for advisory "GHSA-c2qf-rxjj-4v5w" expires in 5 days'
      );
      expect(warnCalls).toContain(
        "⚠️ PRE-EXPIRATION WARNING: 1 vulnerability override(s) expiring within 14 days"
      );
      expect(warnCalls).toContain("dev-team");
      expect(warnCalls).toContain("#888");
    });

    it("fails the audit when failOnWarning is true and an override is approaching expiration", () => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {},
          }),
        })
      );

      const approachingRawData = [
        {
          advisory: "GHSA-c2qf-rxjj-4v5w",
          package: "concurrently",
          expiresAt: "2026-08-24T12:00:00Z",
          reason: "CLI process runner",
          owner: "dev-team",
          followUp: "#888",
        },
      ];
      vi.spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(approachingRawData)
      );
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      expect(() =>
        runSecurityAudit({ now: testNow, failOnWarning: true })
      ).toThrowError("process.exit called with 1");
      expect(exitSpy).toHaveBeenCalledWith(1);

      const errorCalls = errorSpy.mock.calls
        .map((call) => call[0] as string)
        .join("\n");
      expect(errorCalls).toContain("strict pre-expiration warning policy");
    });

    it("logs warning when matching a vulnerability with an override rule approaching expiration", () => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {
              concurrently: {
                name: "concurrently",
                severity: "high",
                via: [
                  {
                    source: "GHSA-c2qf-rxjj-4v5w",
                    title: "Command Injection",
                    url: "https://github.com/advisories/GHSA-c2qf-rxjj-4v5w",
                  },
                ],
              },
            },
          }),
        })
      );

      const approachingRawData = [
        {
          advisory: "GHSA-c2qf-rxjj-4v5w",
          package: "concurrently",
          expiresAt: "2026-08-24T12:00:00Z",
          reason: "CLI process runner",
          owner: "dev-team",
          followUp: "#888",
        },
      ];
      vi.spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(approachingRawData)
      );
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      expect(() => runSecurityAudit({ now: testNow })).toThrowError(
        "process.exit called with 0"
      );

      const warnCalls = warnSpy.mock.calls
        .map((call) => call[0] as string)
        .join("\n");
      expect(warnCalls).toContain(
        '⚠️ WARNING: Vulnerability override for advisory "GHSA-c2qf-rxjj-4v5w" (concurrently) expires in 5 days'
      );
    });
  });

  describe("writeStepSummary & writeAuditFailureStepSummary", () => {
    it("does nothing if GITHUB_STEP_SUMMARY is not set", () => {
      delete process.env.GITHUB_STEP_SUMMARY;
      const appendSpy = vi
        .spyOn(fs, "appendFileSync")
        .mockImplementation(() => {});

      writeStepSummary(false, [], [], false);
      expect(appendSpy).not.toHaveBeenCalled();
    });

    it("writes passed status summary when failed is false", () => {
      const summaryPath = "/tmp/test-summary-pass.md";
      process.env.GITHUB_STEP_SUMMARY = summaryPath;
      const appendSpy = vi
        .spyOn(fs, "appendFileSync")
        .mockImplementation(() => {});

      writeStepSummary(false, [], [], false);

      expect(appendSpy).toHaveBeenCalledWith(
        summaryPath,
        expect.stringContaining("✅ Passed"),
        "utf8"
      );
      expect(appendSpy).toHaveBeenCalledWith(
        summaryPath,
        expect.stringContaining(
          "No unhandled moderate, high, or critical vulnerabilities found"
        ),
        "utf8"
      );

      delete process.env.GITHUB_STEP_SUMMARY;
    });

    it("writes failed status summary with unhandled vulnerability details table", () => {
      const summaryPath = "/tmp/test-summary-fail.md";
      process.env.GITHUB_STEP_SUMMARY = summaryPath;
      const appendSpy = vi
        .spyOn(fs, "appendFileSync")
        .mockImplementation(() => {});

      const unhandled = [
        {
          pkgName: "bad-pkg",
          info: { severity: "high" } as VulnerabilityInfo,
          advisory: {
            title: "Bad package flaw",
            url: "https://example.com/adv",
            range: "<2.0.0",
            source: "GHSA-xxxx-yyyy",
          } as Advisory,
        },
      ];

      writeStepSummary(true, unhandled, [], false);

      expect(appendSpy).toHaveBeenCalledWith(
        summaryPath,
        expect.stringContaining("❌ Failed"),
        "utf8"
      );
      expect(appendSpy).toHaveBeenCalledWith(
        summaryPath,
        expect.stringContaining(
          "| `bad-pkg` | HIGH | `ghsa-xxxx-yyyy` | Bad package flaw | `<2.0.0` | [Advisory](https://example.com/adv) |"
        ),
        "utf8"
      );

      delete process.env.GITHUB_STEP_SUMMARY;
    });

    it("writes audit failure summary on exception/invalid output", () => {
      const summaryPath = "/tmp/test-summary-error.md";
      process.env.GITHUB_STEP_SUMMARY = summaryPath;
      const appendSpy = vi
        .spyOn(fs, "appendFileSync")
        .mockImplementation(() => {});

      writeAuditFailureStepSummary("Execution failed");

      expect(appendSpy).toHaveBeenCalledWith(
        summaryPath,
        expect.stringContaining("❌ Security Execution Error"),
        "utf8"
      );
      expect(appendSpy).toHaveBeenCalledWith(
        summaryPath,
        expect.stringContaining("Execution failed"),
        "utf8"
      );

      delete process.env.GITHUB_STEP_SUMMARY;
    });
  });
});
