// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getGitHubStats, parseGitHubUrl } from "@/lib/github";
import { unstable_cache } from "next/cache";

// Mock next/cache
vi.mock("next/cache", () => {
  const mockCache = vi.fn((fn) => {
    return async (...args: unknown[]) => {
      return fn(...args);
    };
  });
  return {
    unstable_cache: mockCache,
  };
});

describe("GitHub Telemetry & Caching Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe("parseGitHubUrl", () => {
    it("should correctly parse valid GitHub URLs", () => {
      const url = "https://github.com/fderuiter/imednet-python-sdk";
      const parsed = parseGitHubUrl(url);
      expect(parsed).toEqual({
        owner: "fderuiter",
        repo: "imednet-python-sdk",
      });
    });

    it("should sanitize trailing .git from repository name", () => {
      const url = "https://github.com/fderuiter/portfolio-app.git";
      const parsed = parseGitHubUrl(url);
      expect(parsed).toEqual({ owner: "fderuiter", repo: "portfolio-app" });
    });

    it("should return null for non-GitHub URLs", () => {
      const url = "https://gitlab.com/owner/repo";
      expect(parseGitHubUrl(url)).toBeNull();
    });

    it("should return null for malformed URLs", () => {
      expect(parseGitHubUrl("not-a-url")).toBeNull();
    });
  });

  describe("getGitHubStats - Dynamic Cache Key Generation", () => {
    it("should incorporate owner and repo into unstable_cache key dynamically", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = url.toString();
        if (urlStr.includes("/languages")) {
          return {
            ok: true,
            json: async () => ({ TypeScript: 80, JavaScript: 20 }),
          } as Response;
        }
        if (urlStr.includes("/commits")) {
          return { ok: true, json: async () => [] } as Response;
        }
        if (urlStr.includes("/stats/commit_activity")) {
          return { ok: true, json: async () => [] } as Response;
        }
        // Main repo endpoint
        return {
          ok: true,
          json: async () => ({
            stargazers_count: 12,
            forks_count: 3,
            open_issues_count: 1,
          }),
        } as Response;
      });

      const owner = "test-owner";
      const repo = "test-repo";

      const stats = await getGitHubStats(owner, repo);

      expect(stats).not.toBeNull();
      expect(stats?.stars).toBe(12);
      expect(stats?.forks).toBe(3);

      // Verify that unstable_cache was called with dynamic key parameters
      expect(unstable_cache).toHaveBeenCalled();
      const lastCall = vi.mocked(unstable_cache).mock.calls[0];
      const keyParts = lastCall[1];
      expect(keyParts).toContain("github-repo-metrics-cache");
      expect(keyParts).toContain(owner);
      expect(keyParts).toContain(repo);
    });
  });

  describe("getGitHubStats - Graceful Fallback", () => {
    it("should fallback gracefully to live fetching if unstable_cache throws", async () => {
      // Mock unstable_cache to throw an error simulating unsupported/missing cache environment
      vi.mocked(unstable_cache).mockImplementation(() => {
        throw new Error(
          "unstable_cache is not supported or incrementalCache missing"
        );
      });

      vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = url.toString();
        if (urlStr.includes("/languages")) {
          return {
            ok: true,
            json: async () => ({ TypeScript: 100 }),
          } as Response;
        }
        if (urlStr.includes("/commits")) {
          return { ok: true, json: async () => [] } as Response;
        }
        if (urlStr.includes("/stats/commit_activity")) {
          return { ok: true, json: async () => [] } as Response;
        }
        return {
          ok: true,
          json: async () => ({
            stargazers_count: 42,
            forks_count: 10,
            open_issues_count: 2,
          }),
        } as Response;
      });

      const stats = await getGitHubStats("fallback-owner", "fallback-repo");

      // Verify that we successfully fetched the raw data despite cache throwing
      expect(stats).not.toBeNull();
      expect(stats?.stars).toBe(42);
      expect(stats?.forks).toBe(10);
      expect(stats?.languages[0].name).toBe("TypeScript");
    });

    it("should return simulated stats on 404 when fallbackLanguage is provided", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const stats = await getGitHubStats(
        "nonexistent-owner",
        "nonexistent-repo",
        "TypeScript"
      );

      expect(stats).not.toBeNull();
      expect(stats?.stars).toBe(148);
      expect(stats?.languages[0].name).toBe("TypeScript");
    });

    it("should return simulated stats on 403 rate limit when fallbackLanguage is provided", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 403,
      } as Response);

      const stats = await getGitHubStats(
        "rate-limited-owner",
        "rate-limited-repo",
        "Python"
      );

      expect(stats).not.toBeNull();
      expect(stats?.stars).toBe(112);
      expect(stats?.languages[0].name).toBe("Python");
    });

    it("should return null on 404 when no fallbackLanguage is provided", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const stats = await getGitHubStats(
        "nonexistent-owner",
        "nonexistent-repo"
      );

      expect(stats).toBeNull();
    });
  });
});
