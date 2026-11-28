// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { spawnSync, type SpawnSyncReturns } from "child_process";
import fs from "fs";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  TRIAGE_GOVERNANCE_LABELS,
  buildTriageMarker,
  collectTriageItems,
  triageSecurityIssues,
  sanitizeLogDetails,
  extractIssueNumber,
} from "../scripts/triage-security-issue";

vi.mock("child_process", () => {
  const mSpawnSync = vi.fn();
  return {
    spawnSync: mSpawnSync,
    default: {
      spawnSync: mSpawnSync,
    },
  };
});

describe("Triage Security Issue Script", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let globalFetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    globalFetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    globalFetchSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  describe("collectTriageItems", () => {
    it("returns expired and invalid rules as triage items", () => {
      const fixedNow = new Date("2026-08-19T12:00:00Z");
      const rawIgnoreData = [
        {
          advisory: "GHSA-expired-9999",
          package: "expired-pkg",
          expiresAt: "2020-01-01T00:00:00Z",
          severity: "critical",
          reason: "Old exception",
          owner: "owner",
          followUp: "#1",
        },
        {
          advisory: "GHSA-invalid-8888",
          package: "invalid-pkg",
          expiresAt: "2027-12-31T00:00:00Z",
          severity: "medium", // invalid severity
          reason: "Bad severity",
          owner: "owner",
          followUp: "#2",
        },
      ];

      vi.spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(rawIgnoreData)
      );
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {},
          }),
        })
      );

      const items = collectTriageItems(fixedNow);
      expect(items).toHaveLength(2);
      expect(items.map((i) => i.advisoryId)).toContain("GHSA-expired-9999");
      expect(items.map((i) => i.advisoryId)).toContain("GHSA-invalid-8888");
    });

    it("returns unhandled vulnerabilities from npm audit", () => {
      const fixedNow = new Date("2026-08-19T12:00:00Z");
      vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify([]));
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {
              "unhandled-pkg": {
                name: "unhandled-pkg",
                severity: "critical",
                via: [
                  {
                    source: "GHSA-unhandled-111",
                    title: "Critical RCE",
                    url: "https://example.com/adv",
                    range: "<1.0.0",
                  },
                ],
              },
            },
          }),
        })
      );

      const items = collectTriageItems(fixedNow);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("unhandled");
      expect(items[0].advisoryId).toBe("ghsa-unhandled-111");
      expect(items[0].severity).toBe("critical");
      expect(items[0].pkgName).toBe("unhandled-pkg");
    });

    it("halts triage immediately on @chenglou/pretext alerts without opening public issues", async () => {
      const fixedNow = new Date("2026-08-19T12:00:00Z");
      vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify([]));
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

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
                    source: "GHSA-pretext-0001",
                    title: "Layout DoS",
                    url: "https://github.com/chenglou/pretext/security",
                    range: "<1.0.0",
                  },
                ],
              },
            },
          }),
        })
      );

      expect(() => collectTriageItems(fixedNow)).toThrow(
        /@chenglou\/pretext alert detected/
      );
      await expect(
        triageSecurityIssues({
          token: "example_dev_token",
          repo: "fderuiter/deruiter.dev",
          now: fixedNow,
          apply: true,
        })
      ).rejects.toThrow(/@chenglou\/pretext alert detected/);
      expect(globalFetchSpy).not.toHaveBeenCalled();
    });

    it("returns active rules nearing expiration as expiring_rule items within tiered warning window", () => {
      const fixedNow = new Date("2026-11-20T12:00:00Z");
      const rawIgnoreData = [
        {
          advisory: "GHSA-expiring-soon-1",
          package: "pkg-soon-1",
          expiresAt: "2026-11-25T12:00:00Z", // 5 days remaining, moderate (threshold 14d)
          severity: "moderate",
          reason: "Upstream fix in progress",
          owner: "owner",
          followUp: "#10",
        },
        {
          advisory: "GHSA-safe-future-2",
          package: "pkg-safe-2",
          expiresAt: "2026-12-20T12:00:00Z", // 30 days remaining, moderate (threshold 14d) -> outside window
          severity: "moderate",
          reason: "Longer waiver",
          owner: "owner",
          followUp: "#11",
        },
      ];

      vi.spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(rawIgnoreData)
      );
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {},
          }),
        })
      );

      const items = collectTriageItems(fixedNow);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("expiring_rule");
      expect(items[0].advisoryId).toBe("GHSA-expiring-soon-1");
      expect(items[0].severity).toBe("moderate");
      expect(items[0].pkgName).toBe("pkg-soon-1");
      expect(items[0].remainingDays).toBe(5);
      expect(items[0].expiresAt).toBe("2026-11-25T12:00:00Z");
    });

    it("includes expiring license-policy exceptions when within 30-day warning window", () => {
      const fixedNow = new Date("2026-12-10T12:00:00Z");
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "readFileSync").mockImplementation((target: any) => {
        if (String(target).includes("license-policy.json")) {
          return JSON.stringify({
            $schema: "./license-policy.schema.json",
            version: "1.1.0",
            allowedLicenses: ["MIT"],
            exceptions: [
              {
                packageName: "khroma",
                license: "UNKNOWN",
                createdAt: "2026-10-15",
                expiresAt: "2026-12-25",
                riskOwner: "fderuiter",
                ticket: "#1798",
                rationale: "Transitive dependency verified MIT upstream.",
              },
            ],
          });
        }
        return JSON.stringify([]);
      });

      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {},
          }),
        })
      );

      const items = collectTriageItems(fixedNow);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        type: "expiring_rule",
        advisoryId: "license-exception:khroma",
        pkgName: "khroma",
        followUp: "#1798",
      });
    });

    it("returns unhandled moderate vulnerabilities from npm audit", () => {
      const fixedNow = new Date("2026-08-19T12:00:00Z");
      vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify([]));
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {
              "moderate-pkg": {
                name: "moderate-pkg",
                severity: "moderate",
                via: [
                  {
                    source: "GHSA-moderate-222",
                    title: "Moderate ReDoS",
                    url: "https://example.com/mod",
                    range: "<3.0.0",
                  },
                ],
              },
            },
          }),
        })
      );

      const items = collectTriageItems(fixedNow);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe("unhandled");
      expect(items[0].advisoryId).toBe("ghsa-moderate-222");
      expect(items[0].severity).toBe("moderate");
      expect(items[0].pkgName).toBe("moderate-pkg");
    });
  });

  describe("extractIssueNumber", () => {
    it("extracts issue numbers from URLs, hashes, and raw digits", () => {
      expect(
        extractIssueNumber(
          "https://github.com/fderuiter/deruiter.dev/issues/3667"
        )
      ).toBe(3667);
      expect(extractIssueNumber("#1234")).toBe(1234);
      expect(extractIssueNumber("5678")).toBe(5678);
      expect(extractIssueNumber("")).toBeNull();
      expect(extractIssueNumber(undefined)).toBeNull();
      expect(extractIssueNumber("not-a-number")).toBeNull();
    });
  });

  describe("TRIAGE_GOVERNANCE_LABELS", () => {
    it("matches issue-governance.md and SECURITY.md without automatic priority heuristics", () => {
      expect(TRIAGE_GOVERNANCE_LABELS).toEqual([
        "type:chore",
        "needs-triage",
        "area:security",
        "security-triage",
      ]);
      for (const label of TRIAGE_GOVERNANCE_LABELS) {
        expect(label).not.toMatch(/^p[0-4]-/);
      }
    });
  });

  describe("sanitizeLogDetails", () => {
    it("sanitizes runner paths and secret tokens", () => {
      const mockToken = ["ghp_", "12345678901234567890123456789012345678"].join(
        ""
      );
      const runnerWork = ["/", "home", "/runner/work"].join("");
      const appPath = ["/", "app", "/deruiter.dev"].join("");
      const raw = `Failed build at ${runnerWork}/portfolio/portfolio/file.ts with token ${mockToken} and ${appPath}/src`;
      const sanitized = sanitizeLogDetails(raw);
      expect(sanitized).not.toContain(runnerWork);
      expect(sanitized).not.toContain(appPath);
      expect(sanitized).not.toContain(mockToken);
      expect(sanitized).toContain("<workspace>");
      expect(sanitized).toContain("[REDACTED_TOKEN]");
    });
  });

  describe("triageSecurityIssues", () => {
    it("logs warning if GH_TOKEN is missing", async () => {
      vi.stubEnv("GH_TOKEN", "");
      vi.stubEnv("GITHUB_TOKEN", "");
      const result = await triageSecurityIssues({
        token: "",
        repo: "fderuiter/portfolio",
      });
      expect(result).toEqual({ created: 0, updated: 0, closed: 0 });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("GH_TOKEN not set")
      );
    });

    it.each([
      ["registry error", JSON.stringify({ error: { code: "E503" } })],
      ["malformed output", "unexpected response"],
      ["nonzero empty report", JSON.stringify({ vulnerabilities: {} })],
    ])("leaves GitHub untouched on %s", async (_scenario, stdout) => {
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({ status: 1, stdout })
      );

      await expect(
        triageSecurityIssues({
          token: "example_dev_token",
          repo: "example/repo",
          apply: true,
        })
      ).rejects.toThrow("npm audit failed or returned an invalid report");
      expect(globalFetchSpy).not.toHaveBeenCalled();
    });

    it("defaults to report-first dry-run mode unless SECURITY_TRIAGE_APPLY=true", async () => {
      vi.stubEnv("SECURITY_TRIAGE_APPLY", "");
      const fixedNow = new Date("2026-08-19T12:00:00Z");
      vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify([]));
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {
              "bad-lib": {
                name: "bad-lib",
                severity: "high",
                via: [
                  {
                    source: "GHSA-dryrun-123",
                    title: "High Flaw",
                    url: "https://example.com/high",
                    range: "<2.0.0",
                  },
                ],
              },
            },
          }),
        })
      );

      globalFetchSpy.mockResolvedValue(
        fromPartial<Response>({ ok: true, json: async () => [] })
      );

      const result = await triageSecurityIssues({
        token: "example_dev_token",
        repo: "fderuiter/portfolio",
        now: fixedNow,
      });

      expect(result).toEqual({ created: 0, updated: 0, closed: 0 });
      // 4 GET label searches only, zero POST/PATCH mutations
      expect(globalFetchSpy).toHaveBeenCalledTimes(4);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Dry run: would create issue")
      );
    });

    it("creates one issue with governance labels and HTML marker when SECURITY_TRIAGE_APPLY=true", async () => {
      vi.stubEnv("SECURITY_TRIAGE_APPLY", "true");
      const fixedNow = new Date("2026-08-19T12:00:00Z");
      vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify([]));
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {
              "tool-a": {
                severity: "moderate",
                via: ["bad-lib"],
              },
              "tool-b": {
                severity: "high",
                via: ["tool-a", "bad-lib"],
              },
              "bad-lib": {
                name: "bad-lib",
                severity: "high",
                via: [
                  {
                    source: "GHSA-new-issue-123",
                    dependency: "bad-lib",
                    title: "High Flaw",
                    url: "https://example.com/high",
                    range: "<2.0.0",
                  },
                ],
              },
            },
          }),
        })
      );

      globalFetchSpy
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => ({ number: 42 }),
          })
        );

      const result = await triageSecurityIssues({
        token: "example_dev_token",
        repo: "fderuiter/portfolio",
        now: fixedNow,
      });

      expect(result).toEqual({ created: 1, updated: 0, closed: 0 });

      const createCall = globalFetchSpy.mock.calls[4];
      expect(createCall[0]).toContain("/repos/fderuiter/portfolio/issues");
      const postBody = JSON.parse((createCall[1]?.body as string) || "{}");
      expect(postBody.labels).toEqual([
        "type:chore",
        "needs-triage",
        "area:security",
        "security-triage",
      ]);
      expect(postBody.title).toContain("scheduled-vulnerability-alert");
      expect(postBody.title.toLowerCase()).toContain("ghsa-new-issue-123");
      expect(postBody.title).toContain("(bad-lib)");
      expect(postBody.body).toContain(
        "<!-- security-triage:unhandled:ghsa-new-issue-123:bad-lib -->"
      );
      expect(postBody.body).toContain(
        "Affected audit entries:** bad-lib, tool-a, tool-b"
      );
      expect(postBody.body).toContain("### Acceptance");
    });

    it("posts marker-deduplicated comment once to existing open issue and skips on subsequent runs", async () => {
      const fixedNow = new Date("2026-08-19T12:00:00Z");
      vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify([]));
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {
              "bad-lib": {
                name: "bad-lib",
                severity: "critical",
                via: [
                  {
                    source: "GHSA-existing-456",
                    title: "Critical Flaw",
                    url: "https://example.com/crit",
                    range: "<2.0.0",
                  },
                ],
              },
            },
          }),
        })
      );

      const expectedMarker = buildTriageMarker({
        type: "unhandled",
        advisoryId: "ghsa-existing-456",
        pkgName: "bad-lib",
        severity: "critical",
      });

      // First run: existing issue has no marker in body or comments -> posts comment
      globalFetchSpy
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => [
              {
                number: 10,
                title:
                  "[scheduled-vulnerability-alert] CRITICAL Advisory: GHSA-existing-456 (bad-lib)",
                state: "open",
                body: "Existing issue details",
                labels: [{ name: "security-triage" }],
              },
            ],
          })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        // Fetch comments -> empty
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        // POST comment
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => ({ id: 100 }),
          })
        );

      const result1 = await triageSecurityIssues({
        token: "example_dev_token",
        repo: "fderuiter/portfolio",
        now: fixedNow,
        apply: true,
      });

      expect(result1).toEqual({ created: 0, updated: 1, closed: 0 });
      const commentCall = globalFetchSpy.mock.calls[5];
      expect(commentCall[0]).toContain("/issues/10/comments");
      const postedBody = JSON.parse((commentCall[1]?.body as string) || "{}");
      expect(postedBody.body).toContain(expectedMarker);

      // Second run: comment now contains the HTML marker -> skips duplicate comment
      globalFetchSpy.mockReset();
      globalFetchSpy
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => [
              {
                number: 10,
                title:
                  "[scheduled-vulnerability-alert] CRITICAL Advisory: GHSA-existing-456 (bad-lib)",
                state: "open",
                body: "Existing issue details",
                labels: [{ name: "security-triage" }],
              },
            ],
          })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => [{ body: postedBody.body }],
          })
        );

      const result2 = await triageSecurityIssues({
        token: "example_dev_token",
        repo: "fderuiter/portfolio",
        now: fixedNow,
        apply: true,
      });
      expect(result2).toEqual({ created: 0, updated: 0, closed: 0 });
      expect(globalFetchSpy).toHaveBeenCalledTimes(5);
    });

    it("never auto-closes open tracking issues on clean scan", async () => {
      const fixedNow = new Date("2026-08-19T12:00:00Z");
      vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify([]));
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {},
          }),
        })
      );

      globalFetchSpy
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => [
              {
                number: 15,
                title:
                  "[scheduled-vulnerability-alert] [Security Triage] HIGH Advisory: GHSA-resolved-789",
                state: "open",
                body: "<!-- tag: scheduled-vulnerability-alert -->\nDetails...",
                labels: [{ name: "security-triage" }],
              },
            ],
          })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        );

      const result = await triageSecurityIssues({
        token: "fake-token",
        repo: "fderuiter/portfolio",
        now: fixedNow,
        apply: true,
      });

      expect(result).toEqual({ created: 0, updated: 0, closed: 0 });
      // Only the 4 read-only label queries ran; no POST comment and no PATCH close
      expect(globalFetchSpy).toHaveBeenCalledTimes(4);
    });

    it("handles rate limiting gracefully without throwing", async () => {
      const fixedNow = new Date("2026-08-19T12:00:00Z");
      vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify([]));
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {},
          }),
        })
      );

      globalFetchSpy
        .mockResolvedValue(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: false,
            status: 403,
            statusText: "Forbidden (Rate Limit Exceeded)",
          })
        );

      const result = await triageSecurityIssues({
        token: "fake-token",
        repo: "fderuiter/portfolio",
        now: fixedNow,
        apply: true,
      });

      expect(result).toEqual({ created: 0, updated: 0, closed: 0 });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("rate limit hit")
      );
    });

    it("creates an issue explaining approaching override expiration with governance labels", async () => {
      const fixedNow = new Date("2026-11-20T12:00:00Z");
      const rawIgnoreData = [
        {
          advisory: "GHSA-expiring-alert-99",
          package: "expiring-dep",
          expiresAt: "2026-11-25T12:00:00Z",
          severity: "moderate",
          reason: "Temporary waiver pending upstream release",
          owner: "owner",
          followUp: "#99",
        },
      ];

      vi.spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(rawIgnoreData)
      );
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {},
          }),
        })
      );

      globalFetchSpy
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => ({ number: 99 }),
          })
        );

      const result = await triageSecurityIssues({
        token: "example_dev_token",
        repo: "fderuiter/portfolio",
        now: fixedNow,
        apply: true,
      });

      expect(result).toEqual({ created: 1, updated: 0, closed: 0 });

      const createCall = globalFetchSpy.mock.calls[4];
      const postBody = JSON.parse((createCall[1]?.body as string) || "{}");
      expect(postBody.title).toContain(
        "MODERATE Advisory: GHSA-expiring-alert-99"
      );
      expect(postBody.body).toContain(
        "### Approaching Override Expiration Details"
      );
      expect(postBody.body).toContain("Remaining Days:** 5");
      expect(postBody.body).toContain("pre-expiration warning window");
      expect(postBody.body).toContain("2026-11-25T12:00:00Z");
      expect(postBody.labels).toEqual([
        "type:chore",
        "needs-triage",
        "area:security",
        "security-triage",
      ]);
    });

    it("matches existing open issue carrying only area:security and comments once when entering warning window", async () => {
      const fixedNow = new Date("2026-11-20T12:00:00Z");
      const rawIgnoreData = [
        {
          advisory: "GHSA-g3hv-75wg-m249",
          package: "minimatch",
          expiresAt: "2026-11-30T12:00:00Z",
          severity: "moderate",
          reason: "Pending upstream fix",
          owner: "fderuiter",
          followUp: "https://github.com/fderuiter/deruiter.dev/issues/3667",
        },
      ];

      vi.spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(rawIgnoreData)
      );
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {},
          }),
        })
      );

      globalFetchSpy
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => [
              {
                number: 3667,
                title:
                  "chore(deps): remove or renew the GHSA-g3hv-75wg-m249 audit exception by 2026-11-30",
                state: "open",
                body: "## Problem\n#3670 added the first entry for GHSA-g3hv-75wg-m249",
                labels: [{ name: "p3-medium" }, { name: "area:security" }],
              },
            ],
          })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => [],
          })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => ({ id: 501 }),
          })
        );

      const result = await triageSecurityIssues({
        token: "example_dev_token",
        repo: "fderuiter/portfolio",
        now: fixedNow,
        apply: true,
      });

      expect(result).toEqual({ created: 0, updated: 1, closed: 0 });

      const commentsGetCall = globalFetchSpy.mock.calls[4];
      expect(commentsGetCall[0]).toContain("/issues/3667/comments");

      const commentPostCall = globalFetchSpy.mock.calls[5];
      expect(commentPostCall[0]).toContain("/issues/3667/comments");
      const commentPayload = JSON.parse(
        (commentPostCall[1]?.body as string) || "{}"
      );
      expect(commentPayload.body).toContain("pre-expiration warning window");
      expect(commentPayload.body).toContain(
        "<!-- marker: expiring-rule-warning -->"
      );
      expect(commentPayload.body).toContain(
        "<!-- security-triage:expiring_rule:GHSA-g3hv-75wg-m249:2026-11-30T12:00:00Z -->"
      );
      expect(commentPayload.body).toContain("GHSA-g3hv-75wg-m249");
    });

    it("does not post duplicate comment to existing issue when expiring rule was already warned", async () => {
      const fixedNow = new Date("2026-11-21T12:00:00Z");
      const rawIgnoreData = [
        {
          advisory: "GHSA-g3hv-75wg-m249",
          package: "minimatch",
          expiresAt: "2026-11-30T12:00:00Z",
          severity: "moderate",
          reason: "Pending upstream fix",
          owner: "fderuiter",
          followUp: "https://github.com/fderuiter/deruiter.dev/issues/3667",
        },
      ];

      vi.spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(rawIgnoreData)
      );
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {},
          }),
        })
      );

      globalFetchSpy
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => [
              {
                number: 3667,
                title:
                  "chore(deps): remove or renew the GHSA-g3hv-75wg-m249 audit exception by 2026-11-30",
                state: "open",
                body: "## Problem\n#3670 added the first entry for GHSA-g3hv-75wg-m249",
                labels: [{ name: "p3-medium" }, { name: "area:security" }],
              },
            ],
          })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => [
              {
                body: "⚠️ **Scheduled Security Audit Alert:** [scheduled-vulnerability-alert] Temporary override rule for `GHSA-g3hv-75wg-m249` has entered its pre-expiration warning window...\n\n<!-- marker: expiring-rule-warning -->",
              },
            ],
          })
        );

      const result = await triageSecurityIssues({
        token: "example_dev_token",
        repo: "fderuiter/portfolio",
        now: fixedNow,
        apply: true,
      });

      expect(result).toEqual({ created: 0, updated: 0, closed: 0 });
      expect(globalFetchSpy).toHaveBeenCalledTimes(5);
    });

    it("does not comment on auto-filed issue that already contains Approaching Override Expiration Details in body", async () => {
      const fixedNow = new Date("2026-11-21T12:00:00Z");
      const rawIgnoreData = [
        {
          advisory: "GHSA-expiring-alert-99",
          package: "expiring-dep",
          expiresAt: "2026-11-25T12:00:00Z",
          severity: "moderate",
          reason: "Temporary waiver pending upstream release",
          owner: "owner",
          followUp: "#99",
        },
      ];

      vi.spyOn(fs, "readFileSync").mockReturnValue(
        JSON.stringify(rawIgnoreData)
      );
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {},
          }),
        })
      );

      globalFetchSpy
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => [
              {
                number: 99,
                title:
                  "[scheduled-vulnerability-alert] [Security Triage] MODERATE Advisory: GHSA-expiring-alert-99",
                state: "open",
                body: "### Approaching Override Expiration Details\n- **Advisory Identifier:** `GHSA-expiring-alert-99`\n<!-- marker: expiring-rule-warning -->",
                labels: [
                  { name: "type:chore" },
                  { name: "needs-triage" },
                  { name: "area:security" },
                  { name: "security-triage" },
                ],
              },
            ],
          })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        )
        .mockResolvedValueOnce(
          fromPartial<Response>({ ok: true, json: async () => [] })
        );

      const result = await triageSecurityIssues({
        token: "example_dev_token",
        repo: "fderuiter/portfolio",
        now: fixedNow,
        apply: true,
      });

      expect(result).toEqual({ created: 0, updated: 0, closed: 0 });
      expect(globalFetchSpy).toHaveBeenCalledTimes(4);
    });
  });
});
