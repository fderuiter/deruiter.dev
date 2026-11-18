// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { spawnSync, type SpawnSyncReturns } from "child_process";
import fs from "fs";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  collectTriageItems,
  triageSecurityIssues,
  sanitizeLogDetails,
  extractIssueNumber,
  getPriorityForSeverity,
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

  describe("getPriorityForSeverity", () => {
    it("maps severity levels to issue governance priority labels", () => {
      expect(getPriorityForSeverity("critical")).toBe("p1-critical");
      expect(getPriorityForSeverity("high")).toBe("p2-high");
      expect(getPriorityForSeverity("moderate")).toBe("p3-medium");
      expect(getPriorityForSeverity("unknown" as any)).toBe("p2-high");
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
      // Cloud sessions and CI export a token; the empty option falls back to it.
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

    it("creates one issue with governance labels and all affected audit entries", async () => {
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

      // Mock list existing issues returning empty for each label search ("security", "automated-alert", "security-triage", "area:security")
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
        // Mock create issue
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

      // Verify create call was POST to /issues with governance labels
      const createCall = globalFetchSpy.mock.calls[4];
      expect(createCall[0]).toContain("/repos/fderuiter/portfolio/issues");
      const postBody = JSON.parse((createCall[1]?.body as string) || "{}");
      expect(postBody.labels).toContain("type:security");
      expect(postBody.labels).toContain("p2-high");
      expect(postBody.labels).toContain("area:security");
      expect(postBody.labels).toContain("automated-alert");
      expect(postBody.title).toContain("scheduled-vulnerability-alert");
      expect(postBody.title.toLowerCase()).toContain("ghsa-new-issue-123");
      expect(postBody.title).toContain("(bad-lib)");
      expect(postBody.body).toContain(
        "Affected audit entries:** bad-lib, tool-a, tool-b"
      );
      expect(postBody.body).toContain("### Acceptance");
    });

    it("posts comment to existing open issue rather than creating duplicate", async () => {
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

      // Mock label fetches
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
                labels: [{ name: "security" }, { name: "automated-alert" }],
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
        // Mock post comment
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => ({ id: 100 }),
          })
        );

      const result = await triageSecurityIssues({
        token: "example_dev_token",
        repo: "fderuiter/portfolio",
        now: fixedNow,
      });

      expect(result).toEqual({ created: 0, updated: 1, closed: 0 });

      const commentCall = globalFetchSpy.mock.calls[4];
      expect(commentCall[0]).toContain("/issues/10/comments");
    });

    it("automatically resolves and closes open tracking issues on clean scan", async () => {
      const fixedNow = new Date("2026-08-19T12:00:00Z");
      vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify([]));
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      // Clean npm audit output (no vulnerabilities)
      vi.mocked(spawnSync).mockReturnValue(
        fromPartial<SpawnSyncReturns<string>>({
          stdout: JSON.stringify({
            auditReportVersion: 2,
            vulnerabilities: {},
          }),
        })
      );

      // Mock search issues returning an open security tracking issue
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
                labels: [{ name: "security" }, { name: "automated-alert" }],
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
        // Mock post resolution comment
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => ({ id: 200 }),
          })
        )
        // Mock PATCH to close issue
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => ({ number: 15, state: "closed" }),
          })
        );

      const result = await triageSecurityIssues({
        token: "fake-token",
        repo: "fderuiter/portfolio",
        now: fixedNow,
      });

      expect(result).toEqual({ created: 0, updated: 0, closed: 1 });

      const commentCall = globalFetchSpy.mock.calls[4];
      expect(commentCall[0]).toContain("/issues/15/comments");
      const commentBody = JSON.parse((commentCall[1]?.body as string) || "{}");
      expect(commentBody.body).toContain("Scheduled Security Audit Cleared");

      const patchCall = globalFetchSpy.mock.calls[5];
      expect(patchCall[0]).toContain("/issues/15");
      expect(patchCall[1]?.method).toBe("PATCH");
      const patchBody = JSON.parse((patchCall[1]?.body as string) || "{}");
      expect(patchBody.state).toBe("closed");
      expect(patchBody.state_reason).toBe("completed");
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

      // Mock rate limit 403 on issue search
      globalFetchSpy.mockResolvedValueOnce(
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
      });

      expect(result).toEqual({ created: 0, updated: 0, closed: 0 });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("rate limit hit")
      );
    });

    it("creates an issue explaining approaching override expiration for expiring rules", async () => {
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
      expect(postBody.labels).toContain("type:security");
      expect(postBody.labels).toContain("p3-medium");
      expect(postBody.labels).toContain("area:security");
      expect(postBody.labels).toContain("automated-alert");
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

      // Label searches: "security", "automated-alert", "security-triage" return empty, "area:security" returns #3667
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
        // Fetch comments on issue #3667 returns empty (not warned yet)
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => [],
          })
        )
        // POST comment on #3667
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
      });

      expect(result).toEqual({ created: 0, updated: 1, closed: 0 });

      // Check comments was called on 3667
      const commentsGetCall = globalFetchSpy.mock.calls[4];
      expect(commentsGetCall[0]).toContain("/issues/3667/comments");

      // Check POST comment was called with marker
      const commentPostCall = globalFetchSpy.mock.calls[5];
      expect(commentPostCall[0]).toContain("/issues/3667/comments");
      const commentPayload = JSON.parse(
        (commentPostCall[1]?.body as string) || "{}"
      );
      expect(commentPayload.body).toContain("pre-expiration warning window");
      expect(commentPayload.body).toContain(
        "<!-- marker: expiring-rule-warning -->"
      );
      expect(commentPayload.body).toContain("GHSA-g3hv-75wg-m249");
    });

    it("does not post duplicate comment to existing issue when expiring rule was already warned", async () => {
      const fixedNow = new Date("2026-11-21T12:00:00Z"); // next day
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

      // Label searches: "security", "automated-alert", "security-triage" return empty, "area:security" returns #3667
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
        // Fetch comments on issue #3667 returns previous warning comment
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
      });

      // No issue created, no comments posted, none closed
      expect(result).toEqual({ created: 0, updated: 0, closed: 0 });

      // Expect total fetch calls were 5 (4 label searches + 1 comments fetch), no POST comment
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

      // Search returns existing auto-filed issue with approaching expiration details in its body
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
                  { name: "type:security" },
                  { name: "p3-medium" },
                  { name: "area:security" },
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
      });

      expect(result).toEqual({ created: 0, updated: 0, closed: 0 });
      // Skips comments without needing to fetch comments API
      expect(globalFetchSpy).toHaveBeenCalledTimes(4);
    });
  });
});
