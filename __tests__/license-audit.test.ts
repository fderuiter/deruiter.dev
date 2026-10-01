import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  tokenizeSpdx,
  evaluateSpdxExpression,
  validateExceptions,
  runLicenseAudit,
  type LicenseException,
} from "../scripts/license-audit";
import { checkLicenseCompliance } from "../lib/dx/doctor";

describe("Lockfile License Audit Engine", () => {
  const mockNow = new Date("2026-10-01T12:00:00Z");

  describe("tokenizeSpdx", () => {
    it("tokenizes single license identifiers", () => {
      expect(tokenizeSpdx("MIT")).toEqual(["MIT"]);
      expect(tokenizeSpdx("Apache-2.0")).toEqual(["Apache-2.0"]);
    });

    it("tokenizes OR dual-licensed expressions", () => {
      expect(tokenizeSpdx("(MIT OR GPL-3.0-or-later)")).toEqual([
        "(",
        "MIT",
        "OR",
        "GPL-3.0-or-later",
        ")",
      ]);
    });

    it("tokenizes AND compound license expressions", () => {
      expect(tokenizeSpdx("Apache-2.0 AND LGPL-3.0-or-later AND MIT")).toEqual([
        "Apache-2.0",
        "AND",
        "LGPL-3.0-or-later",
        "AND",
        "MIT",
      ]);
    });

    it("handles custom license text with spaces", () => {
      expect(tokenizeSpdx("MIT OR SEE LICENSE IN FEEL-FREE.md")).toEqual([
        "MIT",
        "OR",
        "SEE LICENSE IN FEEL-FREE.md",
      ]);
    });
  });

  describe("evaluateSpdxExpression", () => {
    const allowed = new Set(["MIT", "Apache-2.0", "BSD-3-Clause", "ISC"]);

    it("evaluates simple approved license as compliant", () => {
      const res = evaluateSpdxExpression("MIT", "test-pkg", allowed, []);
      expect(res.compliant).toBe(true);
      expect(res.unapprovedTokens).toEqual([]);
    });

    it("evaluates dual-licensed OR expression as compliant if one option is approved", () => {
      const res = evaluateSpdxExpression(
        "(MIT OR GPL-3.0)",
        "test-pkg",
        allowed,
        []
      );
      expect(res.compliant).toBe(true);
    });

    it("evaluates compound AND expression as non-compliant if one token is unapproved", () => {
      const res = evaluateSpdxExpression(
        "Apache-2.0 AND LGPL-3.0",
        "test-pkg",
        allowed,
        []
      );
      expect(res.compliant).toBe(false);
      expect(res.unapprovedTokens).toContain("LGPL-3.0");
    });

    it("evaluates unapproved license as non-compliant", () => {
      const res = evaluateSpdxExpression(
        "GPL-3.0-only",
        "test-pkg",
        allowed,
        []
      );
      expect(res.compliant).toBe(false);
      expect(res.unapprovedTokens).toEqual(["GPL-3.0-only"]);
    });

    it("passes unapproved license if covered by a valid policy exception", () => {
      const exception: LicenseException = {
        packageName: "copyleft-lib",
        license: "LGPL-3.0",
        expiresAt: "2026-12-30",
        riskOwner: "devsecops@deruiter.dev",
        ticket: "SEC-100",
        rationale: "Approved exception for build tool",
      };
      const res = evaluateSpdxExpression("LGPL-3.0", "copyleft-lib", allowed, [
        exception,
      ]);
      expect(res.compliant).toBe(true);
      expect(res.unapprovedTokens).toEqual([]);
    });
  });

  describe("validateExceptions", () => {
    it("accepts valid exceptions with mandatory metadata within 90 days", () => {
      const exceptions: LicenseException[] = [
        {
          packageName: "valid-pkg",
          license: "LGPL-3.0",
          expiresAt: "2026-12-01",
          riskOwner: "owner@dev.com",
          ticket: "SEC-123",
          rationale: "Legitimate build requirement",
        },
      ];

      const { validExceptions, invalidExceptions } = validateExceptions(
        exceptions,
        mockNow
      );
      expect(validExceptions).toHaveLength(1);
      expect(invalidExceptions).toHaveLength(0);
    });

    it("rejects exceptions with missing mandatory fields", () => {
      const exceptions = [
        {
          packageName: "incomplete-pkg",
          license: "LGPL-3.0",
          expiresAt: "2026-12-01",
          // missing riskOwner, ticket, rationale
        } as LicenseException,
      ];

      const { validExceptions, invalidExceptions } = validateExceptions(
        exceptions,
        mockNow
      );
      expect(validExceptions).toHaveLength(0);
      expect(invalidExceptions).toHaveLength(1);
      expect(invalidExceptions[0].reason).toContain(
        "Missing mandatory metadata fields"
      );
    });

    it("rejects expired exceptions", () => {
      const exceptions: LicenseException[] = [
        {
          packageName: "expired-pkg",
          license: "GPL-3.0",
          expiresAt: "2025-01-01",
          riskOwner: "owner@dev.com",
          ticket: "SEC-123",
          rationale: "Past exception",
        },
      ];

      const { validExceptions, invalidExceptions } = validateExceptions(
        exceptions,
        mockNow
      );
      expect(validExceptions).toHaveLength(0);
      expect(invalidExceptions).toHaveLength(1);
      expect(invalidExceptions[0].reason).toContain("expired on 2025-01-01");
    });

    it("rejects exceptions exceeding 90-day window", () => {
      const exceptions: LicenseException[] = [
        {
          packageName: "distant-pkg",
          license: "GPL-3.0",
          expiresAt: "2027-12-31",
          riskOwner: "owner@dev.com",
          ticket: "SEC-123",
          rationale: "Way too far in the future",
        },
      ];

      const { validExceptions, invalidExceptions } = validateExceptions(
        exceptions,
        mockNow
      );
      expect(validExceptions).toHaveLength(0);
      expect(invalidExceptions).toHaveLength(1);
      expect(invalidExceptions[0].reason).toContain(
        "exceeds the maximum allowed 90-day window"
      );
    });
  });

  describe("runLicenseAudit", () => {
    it("audits real repository package-lock.json under 200ms and passes", () => {
      const startTime = Date.now();
      const report = runLicenseAudit({ now: mockNow });
      const elapsed = Date.now() - startTime;

      expect(report.passed).toBe(true);
      expect(report.totalPackagesScanned).toBeGreaterThan(1000);
      expect(report.totalViolations).toBe(0);
      expect(report.invalidExceptions).toHaveLength(0);
      expect(elapsed).toBeLessThan(200);
      expect(report.durationMs).toBeLessThan(200);
    });

    it("fails closed on mock fixture with unapproved license and no exception", () => {
      const mockDir = path.join(__dirname, "../tmp-mock-license-audit");
      if (!fs.existsSync(mockDir)) {
        fs.mkdirSync(mockDir, { recursive: true });
      }

      const mockLock = {
        name: "mock-app",
        version: "1.0.0",
        lockfileVersion: 3,
        packages: {
          "": { name: "mock-app" },
          "node_modules/bad-pkg": {
            name: "bad-pkg",
            version: "1.0.0",
            license: "AGPL-3.0",
          },
        },
      };

      const mockPolicy = {
        allowedLicenses: ["MIT"],
        exceptions: [],
      };

      fs.writeFileSync(
        path.join(mockDir, "package-lock.json"),
        JSON.stringify(mockLock)
      );
      fs.writeFileSync(
        path.join(mockDir, "license-policy.json"),
        JSON.stringify(mockPolicy)
      );

      try {
        const report = runLicenseAudit({
          workspaceRoot: mockDir,
          now: mockNow,
        });
        expect(report.passed).toBe(false);
        expect(report.totalViolations).toBe(1);
        expect(report.violations[0].packageName).toBe("bad-pkg");
        expect(report.violations[0].licenseExpression).toBe("AGPL-3.0");
      } finally {
        fs.rmSync(mockDir, { recursive: true, force: true });
      }
    });
  });

  describe("checkLicenseCompliance (Doctor Integration)", () => {
    it("returns passing DiagnosticCheckResult for workspace", () => {
      const root = path.resolve(__dirname, "..");
      const result = checkLicenseCompliance(root);

      expect(result.id).toBe("security-license-compliance");
      expect(result.category).toBe("security");
      expect(result.status).toBe("pass");
      expect(result.message).toContain("satisfy license policy");
    });
  });
});
