// @vitest-environment node
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseIgnoreRules,
  runSecurityAudit,
  type AuditReport,
  type IgnoreRule,
} from "../scripts/security-audit";

vi.mock("child_process", () => ({ spawnSync: vi.fn() }));

const rules = JSON.parse(
  fs.readFileSync(
    path.resolve(import.meta.dirname, "../config/security-audit-ignore.json"),
    "utf8"
  )
) as IgnoreRule[];
const advisory = "GHSA-g3hv-75wg-m249";
const exceptions = rules.filter((rule) => rule.advisory === advisory);
const day = 24 * 60 * 60 * 1000;

// These tests exercise the committed exception through the real strict gate.
// Removing the exception entirely is allowed when supported tooling fixes it.
describe("minimatch exception lifecycle (#3667)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps at most one package-scoped, moderate-only, 30-day exception", () => {
    expect(exceptions.length).toBeLessThanOrEqual(1);
    for (const rule of exceptions) {
      expect(rule.package).toBe("minimatch");
      expect(rule.severity).toBe("moderate");
      expect(rule.owner).toBe("fderuiter");
      expect(rule.followUp).toBe(
        "https://github.com/fderuiter/deruiter.dev/issues/3667"
      );
      expect(rule.reason.trim()).not.toBe("");
      const created = Date.parse(rule.createdAt ?? "");
      const lifetime = Date.parse(rule.expiresAt) - created;
      expect(lifetime).toBeGreaterThan(14 * day);
      expect(lifetime).toBeLessThanOrEqual(30 * day);
      expect(parseIgnoreRules([rule], new Date(created))[0]).toMatchObject({
        isValid: true,
        isExpired: false,
        isApproachingExpiration: false,
      });
    }
  });

  for (const rule of exceptions) {
    const expiry = Date.parse(rule.expiresAt);

    async function run(
      daysRemaining: number,
      report: AuditReport
    ): Promise<boolean> {
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubEnv("GITHUB_STEP_SUMMARY", "");
      vi.mocked(spawnSync).mockReturnValue({
        status: Object.keys(report.vulnerabilities ?? {}).length ? 1 : 0,
        stdout: JSON.stringify(report),
        stderr: "",
        pid: 1,
        output: [],
        signal: null,
      });
      try {
        return await runSecurityAudit({
          now: new Date(expiry - daysRemaining * day),
          severity: "moderate",
          failOnWarning: true,
          throwOnError: true,
        });
      } finally {
        vi.unstubAllEnvs();
      }
    }

    function report(
      severity = "moderate",
      id = advisory,
      name = "minimatch"
    ): AuditReport {
      return {
        auditReportVersion: 2,
        vulnerabilities: {
          [name]: {
            name,
            severity,
            via: [
              { name, severity, url: `https://github.com/advisories/${id}` },
            ],
          },
          typedoc: { severity, via: [name] },
          "typedoc-plugin-markdown": { severity, via: ["typedoc"] },
        },
      };
    }

    it("passes the strict gate for the waived advisory and its TypeDoc dependents with 15 days left", async () => {
      await expect(run(15, report())).resolves.toBe(true);
    });

    it.each([14, 0, -1])(
      "fails the strict gate with %i days left, including without advisories",
      async (daysRemaining) => {
        await expect(run(daysRemaining, report())).rejects.toThrow(
          "Security audit failed"
        );
        await expect(
          run(daysRemaining, { auditReportVersion: 2, vulnerabilities: {} })
        ).rejects.toThrow("Security audit failed");
      }
    );

    it.each(["high", "critical"])(
      "never suppresses the same advisory escalated to %s",
      async (severity) => {
        await expect(run(15, report(severity))).rejects.toThrow(
          "Security audit failed"
        );
      }
    );

    it("does not suppress a different advisory or package", async () => {
      await expect(
        run(15, report("moderate", "GHSA-aaaa-bbbb-cccc"))
      ).rejects.toThrow("Security audit failed");
      await expect(
        run(15, report("moderate", advisory, "other-package"))
      ).rejects.toThrow("Security audit failed");
    });
  }
});
