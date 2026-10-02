// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  getGitHubStats,
  getSimulatedStats,
  GITHUB_REQUEST_BUDGET_MS,
} from "@/lib/github";

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn(
    (fn) =>
      async (...args: unknown[]) =>
        fn(...args)
  ),
}));

const REPO_PAYLOAD = {
  stargazers_count: 12,
  forks_count: 3,
  open_issues_count: 1,
  pushed_at: "2026-09-01T12:00:00Z",
};

function okJson(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe("GitHub statistics request budget and fallback provenance (#701)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("bounded request budget", () => {
    it("passes one shared abort signal to every upstream call so the whole sequence is bounded", async () => {
      const seenSignals: Array<AbortSignal | undefined | null> = [];

      vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
        seenSignals.push((init as RequestInit | undefined)?.signal);
        const u = url.toString();
        if (u.includes("/languages")) return okJson({ TypeScript: 100 });
        if (u.includes("/commits")) return okJson([]);
        if (u.includes("/stats/commit_activity")) return okJson([{ total: 3 }]);
        return okJson(REPO_PAYLOAD);
      });

      await getGitHubStats("o", "r");

      expect(seenSignals).toHaveLength(4);
      // Every upstream call must be cancellable...
      for (const signal of seenSignals) {
        expect(signal).toBeInstanceOf(AbortSignal);
      }
      // ...and share one deadline, so four slow calls cannot stack up into an
      // unbounded total wait.
      expect(new Set(seenSignals).size).toBe(1);
    });

    it("exposes a finite request budget", () => {
      expect(GITHUB_REQUEST_BUDGET_MS).toBeGreaterThan(0);
      expect(Number.isFinite(GITHUB_REQUEST_BUDGET_MS)).toBe(true);
    });

    it("falls back instead of hanging when the budget is exhausted mid-sequence", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
        const u = url.toString();
        if (u.includes("/languages") || u.includes("/commits")) {
          // The shared deadline fires while these secondary calls are in flight.
          const err = new Error("The operation was aborted");
          err.name = "TimeoutError";
          throw err;
        }
        if (u.includes("/stats/commit_activity")) {
          const err = new Error("The operation was aborted");
          err.name = "TimeoutError";
          throw err;
        }
        void init;
        return okJson(REPO_PAYLOAD);
      });

      const stats = await getGitHubStats("o", "r", "TypeScript", "proj");

      expect(stats).not.toBeNull();
      // Repository figures are still live, but the commit timeline is not.
      expect(stats?.stars).toBe(12);
      expect(stats?.provenance).toBe("live-partial");
      expect(stats?.commitActivity).toHaveLength(52);
    });
  });

  describe("fallback provenance", () => {
    it("marks fully live responses as live and records the upstream last-updated time", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const u = url.toString();
        if (u.includes("/languages")) return okJson({ TypeScript: 100 });
        if (u.includes("/commits")) return okJson([]);
        if (u.includes("/stats/commit_activity"))
          return okJson([{ total: 1 }, { total: 2 }]);
        return okJson(REPO_PAYLOAD);
      });

      const stats = await getGitHubStats("o", "r");

      expect(stats?.provenance).toBe("live");
      expect(stats?.updatedAt).toBe("2026-09-01T12:00:00Z");
      expect(stats?.commitActivity).toEqual([1, 2]);
    });

    it("marks a live repo with a synthesized commit timeline as live-partial", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const u = url.toString();
        if (u.includes("/languages")) return okJson({ TypeScript: 100 });
        if (u.includes("/commits")) return okJson([]);
        // Commit activity is the endpoint GitHub 202s while it computes stats.
        if (u.includes("/stats/commit_activity")) return okJson([]);
        return okJson(REPO_PAYLOAD);
      });

      const stats = await getGitHubStats("o", "r");

      // The sparkline is drawn from fabricated numbers here, so the payload must
      // not present itself as fully live data.
      expect(stats?.provenance).toBe("live-partial");
      expect(stats?.commitActivity).toHaveLength(52);
    });

    it("marks a rate-limited or private repository fallback as simulated", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: "API rate limit exceeded" }),
      } as Response);

      const stats = await getGitHubStats("o", "r", "TypeScript", "proj");

      // Every figure here is locally invented; callers must be able to tell.
      expect(stats?.provenance).toBe("simulated");
    });

    it("marks a malformed upstream payload as simulated rather than reporting zeroes as live", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        if (url.toString().includes("/repos/o/r")) {
          return fromPartial<Response>({
            ok: true,
            status: 200,
            json: async () => {
              throw new SyntaxError("Unexpected token < in JSON");
            },
          });
        }
        return okJson({});
      });

      const stats = await getGitHubStats("o", "r", "TypeScript", "proj");

      expect(stats?.provenance).toBe("simulated");
    });

    it("labels directly generated simulated stats as simulated", () => {
      expect(getSimulatedStats("TypeScript", "proj").provenance).toBe(
        "simulated"
      );
    });
  });
});
