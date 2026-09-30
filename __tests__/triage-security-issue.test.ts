/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { spawnSync, type SpawnSyncReturns } from "child_process";
import fs from "fs";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  collectTriageItems,
  triageSecurityIssues,
  sanitizeLogDetails,
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
  });

  describe("sanitizeLogDetails", () => {
    it("sanitizes runner paths and secret tokens", () => {
      const mockToken = ["ghp_", "12345678901234567890123456789012345678"].join(
        ""
      );
      const raw = `Failed build at /home/runner/work/portfolio/portfolio/file.ts with token ${mockToken} and /app/deruiter.dev/src`;
      const sanitized = sanitizeLogDetails(raw);
      expect(sanitized).not.toContain("/home/runner/work");
      expect(sanitized).not.toContain("/app/deruiter.dev");
      expect(sanitized).not.toContain(mockToken);
      expect(sanitized).toContain("<workspace>");
      expect(sanitized).toContain("[REDACTED_TOKEN]");
    });
  });

  describe("triageSecurityIssues", () => {
    it("logs warning if GH_TOKEN is missing", async () => {
      const result = await triageSecurityIssues({
        token: "",
        repo: "fderuiter/portfolio",
      });
      expect(result).toEqual({ created: 0, updated: 0, closed: 0 });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("GH_TOKEN not set")
      );
    });

    it("creates a new issue with labels security and automated-alert when no existing issue is open", async () => {
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
                    source: "GHSA-new-issue-123",
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

      // Mock list existing issues returning empty for each label search ("security", "automated-alert", "security-triage")
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
        // Mock create issue
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => ({ number: 42 }),
          })
        );

      const result = await triageSecurityIssues({
        token: "fake-token",
        repo: "fderuiter/portfolio",
        now: fixedNow,
      });

      expect(result).toEqual({ created: 1, updated: 0, closed: 0 });

      // Verify create call was POST to /issues with labels security and automated-alert
      const createCall = globalFetchSpy.mock.calls[3];
      expect(createCall[0]).toContain("/repos/fderuiter/portfolio/issues");
      const postBody = JSON.parse((createCall[1]?.body as string) || "{}");
      expect(postBody.labels).toContain("security");
      expect(postBody.labels).toContain("automated-alert");
      expect(postBody.title).toContain("scheduled-vulnerability-alert");
      expect(postBody.title.toLowerCase()).toContain("ghsa-new-issue-123");
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
        // Mock post comment
        .mockResolvedValueOnce(
          fromPartial<Response>({
            ok: true,
            json: async () => ({ id: 100 }),
          })
        );

      const result = await triageSecurityIssues({
        token: "fake-token",
        repo: "fderuiter/portfolio",
        now: fixedNow,
      });

      expect(result).toEqual({ created: 0, updated: 1, closed: 0 });

      const commentCall = globalFetchSpy.mock.calls[3];
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

      const commentCall = globalFetchSpy.mock.calls[3];
      expect(commentCall[0]).toContain("/issues/15/comments");
      const commentBody = JSON.parse((commentCall[1]?.body as string) || "{}");
      expect(commentBody.body).toContain("Scheduled Security Audit Cleared");

      const patchCall = globalFetchSpy.mock.calls[4];
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
  });
});
