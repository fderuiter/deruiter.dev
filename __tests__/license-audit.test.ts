// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  tokenizeSpdx,
  evaluateSpdxExpression,
  validateExceptions,
  runLicenseAudit,
  type LicenseException,
} from "../scripts/license-audit";
import { checkLicenseCompliance } from "../lib/dx/doctor";
import { expectWithinTimingBudget } from "./helpers/timing-budget";

describe("Lockfile License Audit Engine", () => {
  const mockNow = new Date("2026-11-28T12:00:00Z");

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
        createdAt: "2026-11-28",
        expiresAt: "2027-02-15",
        riskOwner: "fderuiter",
        ticket: "#1798",
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
          createdAt: "2026-11-28",
          expiresAt: "2027-02-01",
          riskOwner: "fderuiter",
          ticket: "#1798",
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

    it("rejects exceptions with missing mandatory fields including createdAt", () => {
      const exceptions = [
        {
          packageName: "incomplete-pkg",
          license: "LGPL-3.0",
          expiresAt: "2027-02-01",
          // missing createdAt, riskOwner, ticket, rationale
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
          createdAt: "2024-11-01",
          expiresAt: "2025-01-01",
          riskOwner: "fderuiter",
          ticket: "#1798",
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

    it("rejects exceptions exceeding 90-day window from createdAt or now", () => {
      const exceptions: LicenseException[] = [
        {
          packageName: "distant-pkg",
          license: "GPL-3.0",
          createdAt: "2026-11-28",
          expiresAt: "2027-12-31",
          riskOwner: "fderuiter",
          ticket: "#1798",
          rationale: "Way too far in the future",
        },
        {
          packageName: "backdated-pkg",
          license: "GPL-3.0",
          createdAt: "2026-08-01",
          expiresAt: "2027-01-05",
          riskOwner: "fderuiter",
          ticket: "#1798",
          rationale: "Exceeds 90 days from createdAt",
        },
      ];

      const { validExceptions, invalidExceptions } = validateExceptions(
        exceptions,
        mockNow
      );
      expect(validExceptions).toHaveLength(0);
      expect(invalidExceptions).toHaveLength(2);
      expect(invalidExceptions[0].reason).toContain("90-day window");
      expect(invalidExceptions[1].reason).toContain(
        "90-day window from createdAt"
      );
    });

    it("rejects email/placeholder owners and non-GitHub #NNNN tickets", () => {
      const exceptions: LicenseException[] = [
        {
          packageName: "bad-owner-pkg",
          license: "LGPL-3.0",
          createdAt: "2026-11-28",
          expiresAt: "2027-02-01",
          riskOwner: "devsecops@deruiter.dev",
          ticket: "#1798",
          rationale: "Email placeholder owner",
        },
        {
          packageName: "bad-ticket-pkg",
          license: "LGPL-3.0",
          createdAt: "2026-11-28",
          expiresAt: "2027-02-01",
          riskOwner: "fderuiter",
          ticket: "SEC-8237",
          rationale: "Jira placeholder ticket",
        },
      ];

      const { validExceptions, invalidExceptions } = validateExceptions(
        exceptions,
        mockNow
      );
      expect(validExceptions).toHaveLength(0);
      expect(invalidExceptions).toHaveLength(2);
      expect(invalidExceptions[0].reason).toContain("Invalid riskOwner");
      expect(invalidExceptions[1].reason).toContain("Invalid ticket");
    });
  });

  describe("runLicenseAudit", () => {
    it("audits the real package-lock.json and passes, within a 200 ms budget", () => {
      const startTime = Date.now();
      const report = runLicenseAudit({ now: mockNow });
      const elapsed = Date.now() - startTime;

      expect(report.passed).toBe(true);
      expect(report.totalPackagesScanned).toBeGreaterThan(1000);
      expect(report.totalViolations).toBe(0);
      expect(report.invalidExceptions).toHaveLength(0);
      expect(report.durationMs).toBeGreaterThanOrEqual(0);
      expect(report.durationMs).toBeLessThanOrEqual(elapsed);
      expectWithinTimingBudget("runLicenseAudit", elapsed, 200);
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

    it("evaluates licenses when policy sits in config/license-policy.json", () => {
      const mockDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "license-mock-config-")
      );
      fs.mkdirSync(path.join(mockDir, "config"), { recursive: true });

      const mockLock = {
        name: "mock-app",
        version: "1.0.0",
        lockfileVersion: 3,
        packages: {
          "": { name: "mock-app" },
          "node_modules/ok-pkg": {
            name: "ok-pkg",
            version: "1.0.0",
            license: "MIT",
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
        path.join(mockDir, "config", "license-policy.json"),
        JSON.stringify(mockPolicy)
      );

      try {
        const report = runLicenseAudit({
          workspaceRoot: mockDir,
          now: mockNow,
        });
        expect(report.passed).toBe(true);
        expect(report.totalViolations).toBe(0);
        expect(report.totalPackagesScanned).toBe(1);
      } finally {
        fs.rmSync(mockDir, { recursive: true, force: true });
      }
    });

    it("prefers config/license-policy.json when both config and root policy exist", () => {
      const mockDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "license-mock-precedence-")
      );
      fs.mkdirSync(path.join(mockDir, "config"), { recursive: true });

      const mockLock = {
        name: "mock-app",
        version: "1.0.0",
        lockfileVersion: 3,
        packages: {
          "": { name: "mock-app" },
          "node_modules/pkg-a": {
            name: "pkg-a",
            version: "1.0.0",
            license: "MIT",
          },
        },
      };

      // config/ policy allows MIT (should pass)
      const configPolicy = {
        allowedLicenses: ["MIT"],
        exceptions: [],
      };

      // legacy root policy allows only ISC (would fail if legacy were used)
      const rootPolicy = {
        allowedLicenses: ["ISC"],
        exceptions: [],
      };

      fs.writeFileSync(
        path.join(mockDir, "package-lock.json"),
        JSON.stringify(mockLock)
      );
      fs.writeFileSync(
        path.join(mockDir, "config", "license-policy.json"),
        JSON.stringify(configPolicy)
      );
      fs.writeFileSync(
        path.join(mockDir, "license-policy.json"),
        JSON.stringify(rootPolicy)
      );

      try {
        const report = runLicenseAudit({
          workspaceRoot: mockDir,
          now: mockNow,
        });
        expect(report.passed).toBe(true);
        expect(report.totalViolations).toBe(0);
      } finally {
        fs.rmSync(mockDir, { recursive: true, force: true });
      }
    });

    it("throws clear error when license-policy.json is not found", () => {
      const mockDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "license-mock-empty-")
      );
      fs.writeFileSync(
        path.join(mockDir, "package-lock.json"),
        JSON.stringify({ packages: { "": {} } })
      );

      try {
        expect(() =>
          runLicenseAudit({ workspaceRoot: mockDir, now: mockNow })
        ).toThrow("license-policy.json not found");
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

    it("fails closed and surfaces noticesMissing when public/third-party-notices.txt is absent", () => {
      const mockDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "doctor-missing-notices-")
      );
      fs.mkdirSync(path.join(mockDir, "config"), { recursive: true });
      fs.copyFileSync(
        path.resolve(__dirname, "..", "config", "license-policy.schema.json"),
        path.join(mockDir, "config", "license-policy.schema.json")
      );
      fs.writeFileSync(
        path.join(mockDir, "package-lock.json"),
        JSON.stringify({
          packages: {
            "": { dependencies: { "shipped-pkg": "1.0.0" } },
            "node_modules/shipped-pkg": { version: "1.0.0", license: "MIT" },
          },
        })
      );
      fs.writeFileSync(
        path.join(mockDir, "config", "license-policy.json"),
        JSON.stringify({
          $schema: "./license-policy.schema.json",
          version: "1.1.0",
          allowedLicenses: ["MIT"],
          exceptions: [],
        })
      );

      try {
        const result = checkLicenseCompliance(mockDir);
        expect(result.status).toBe("fail");
        expect(result.message).toContain("1 missing shipped notice(s)");
        expect(result.details).toEqual(
          expect.arrayContaining([expect.stringContaining("shipped-pkg@1.0.0")])
        );
      } finally {
        fs.rmSync(mockDir, { recursive: true, force: true });
      }
    });

    it("rejects policy files pointing $schema at the Draft-07 meta-schema instead of ./license-policy.schema.json", () => {
      const mockDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "license-bad-schema-")
      );
      fs.mkdirSync(path.join(mockDir, "config"), { recursive: true });
      fs.writeFileSync(
        path.join(mockDir, "package-lock.json"),
        JSON.stringify({ packages: { "": {} } })
      );
      fs.writeFileSync(
        path.join(mockDir, "config", "license-policy.json"),
        JSON.stringify({
          $schema: "http://json-schema.org/draft-07/schema#",
          version: "1.0.0",
          allowedLicenses: ["MIT"],
          exceptions: [],
        })
      );

      try {
        const report = runLicenseAudit({
          workspaceRoot: mockDir,
          now: mockNow,
        });
        expect(report.passed).toBe(false);
        expect(report.invalidExceptions[0]?.reason).toContain(
          "must be './license-policy.schema.json'"
        );
      } finally {
        fs.rmSync(mockDir, { recursive: true, force: true });
      }
    });
  });
});
