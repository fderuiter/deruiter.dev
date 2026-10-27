import { unstable_cache } from "next/cache";

export interface GitHubCommit {
  sha: string;
  message: string;
  date: string;
  author: string;
}

export interface GitHubLanguage {
  name: string;
  percentage: number;
}

import { getEnv } from "./env";

/**
 * Where a {@link GitHubStats} payload came from.
 *
 * - `live` - every figure was read from the GitHub API.
 * - `live-partial` - the repository figures are live, but at least one
 *   secondary series (currently the commit timeline) was synthesized because
 *   its endpoint failed, was throttled, or returned nothing.
 * - `simulated` - no upstream data was usable; every figure is generated
 *   locally and is not a real measurement.
 */
export type GitHubStatsProvenance = "live" | "live-partial" | "simulated";

/**
 * Total wall-clock budget, in milliseconds, for all upstream GitHub calls made
 * while assembling one repository's statistics. The calls share a single
 * deadline, so an outage or a throttled endpoint cannot stack four slow
 * requests into an unbounded page render.
 */
export const GITHUB_REQUEST_BUDGET_MS = 8000;

export interface GitHubStats {
  stars: number;
  forks: number;
  openIssues: number;
  languages: GitHubLanguage[];
  recentCommits: GitHubCommit[];
  commitActivity: number[];
  commitsCount?: number;
  primaryLanguage?: string;
  /** Upstream last-push timestamp, when the repository endpoint supplied one. */
  updatedAt?: string;
  /** How much of this payload is a real measurement. Never assume `live`. */
  provenance: GitHubStatsProvenance;
}

/**
 * Centralized, mathematically uniform mock telemetry commit activity generator.
 * Produces exactly 52 values with static, non-parameterized curves to ensure visual parity
 * across simulation and rate-limiting API fallbacks.
 */
export function generateMockCommitActivity(): number[] {
  return Array.from({ length: 52 }, (_, i) => {
    const base = 4;
    const wave = Math.round(Math.sin(i / 2.5) * 3);
    const spike = i % 7 === 0 ? 4 : 0;
    return Math.max(1, base + wave + spike);
  });
}

interface RawCommitResponse {
  sha?: string;
  commit?: {
    message?: string;
    author?: {
      name?: string;
      date?: string;
    };
    committer?: {
      name?: string;
    };
  };
}

/**
 * Robust helper to parse owner and repository name from arbitrary GitHub URLs.
 * Sanitizes trailing .git extensions and correctly extracts segments.
 * Supports format: https://github.com/owner/repo (or with trailing slashes/subpaths)
 */
export function parseGitHubUrl(
  url: string
): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;
    const paths = parsed.pathname.split("/").filter(Boolean);
    if (paths.length >= 2) {
      return {
        owner: paths[0],
        repo: paths[1].replace(/\.git$/, ""),
      };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Primary fetch routine with rate-limit authentication guards.
 * Hits api.github.com/repos/{owner}/{repo}, /languages, and /commits.
 *
 * All four calls share one {@link GITHUB_REQUEST_BUDGET_MS} deadline, so a
 * GitHub outage or a throttled endpoint cannot hold a page render open. The
 * signal only opts these requests out of per-render fetch memoization; the
 * `next.revalidate` data cache and the surrounding `unstable_cache` wrapper
 * are unaffected.
 */
async function fetchRawGitHubStats(
  owner: string,
  repo: string
): Promise<GitHubStats | null> {
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "portfolio-app",
  };

  const currentEnv = getEnv();
  if (currentEnv.GITHUB_TOKEN) {
    headers.Authorization = `token ${currentEnv.GITHUB_TOKEN}`;
  }

  const signal = AbortSignal.timeout(GITHUB_REQUEST_BUDGET_MS);
  const requestInit = { headers, signal, next: { revalidate: 86400 } };

  try {
    // 1. Fetch main repository statistics
    const repoRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      requestInit
    );
    if (!repoRes.ok) {
      // 404 (private/unreleased repo) or 403 (unauthenticated rate-limit) are expected offline/build conditions
      return null;
    }
    const repoData = await repoRes.json();

    // 2. Fetch language definitions
    let langData: Record<string, number> = {};
    try {
      const langRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/languages`,
        requestInit
      );
      if (langRes.ok) {
        langData = await langRes.json();
      }
    } catch {
      // Non-critical language breakdown fetch failure
    }

    // Convert raw language bytes into precise rounded percentages
    const totalBytes = Object.values(langData).reduce(
      (a: number, b: number) => a + b,
      0
    );
    const languages: GitHubLanguage[] = Object.entries(langData)
      .map(([name, bytes]) => ({
        name,
        percentage: totalBytes > 0 ? Math.round((bytes / totalBytes) * 100) : 0,
      }))
      .filter((l) => l.percentage > 0)
      .sort((a, b) => b.percentage - a.percentage);

    // 3. Fetch recent development timeline commits (limit to 5)
    let commitsData: RawCommitResponse[] = [];
    try {
      const commitsRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=5`,
        requestInit
      );
      if (commitsRes.ok) {
        commitsData = await commitsRes.json();
      }
    } catch {
      // Non-critical recent commits fetch failure
    }

    // Highly resilient commit mapper to safeguard against empty or broken payloads
    const recentCommits: GitHubCommit[] = Array.isArray(commitsData)
      ? commitsData.map((c) => ({
          sha: typeof c.sha === "string" ? c.sha.substring(0, 7) : "",
          message:
            typeof c.commit?.message === "string"
              ? c.commit.message.split("\n")[0]
              : "No commit message provided",
          date:
            typeof c.commit?.author?.date === "string"
              ? c.commit.author.date
              : "",
          author:
            typeof c.commit?.author?.name === "string"
              ? c.commit.author.name
              : typeof c.commit?.committer?.name === "string"
                ? c.commit.committer.name
                : "Unknown Author",
        }))
      : [];

    // 4. Fetch weekly commit activity stats
    let commitActivity: number[] = [];
    try {
      const activityRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/stats/commit_activity`,
        requestInit
      );
      if (activityRes.ok) {
        const activityData = await activityRes.json();
        if (Array.isArray(activityData)) {
          commitActivity = activityData.map(
            (item: { total?: number }) => item.total || 0
          );
        }
      }
    } catch {
      // Non-critical commit activity fetch failure
    }

    // Resilient sine-wave-based mockup generator if empty or rate-limited.
    // Substituting invented numbers downgrades the payload's provenance: the
    // sparkline must never present a fabricated timeline as measured history.
    const commitActivitySynthesized = commitActivity.length === 0;
    if (commitActivitySynthesized) {
      commitActivity = generateMockCommitActivity();
    }

    return {
      stars: repoData.stargazers_count ?? 0,
      forks: repoData.forks_count ?? 0,
      openIssues: repoData.open_issues_count ?? 0,
      languages,
      recentCommits,
      commitActivity,
      updatedAt:
        typeof repoData.pushed_at === "string"
          ? repoData.pushed_at
          : typeof repoData.updated_at === "string"
            ? repoData.updated_at
            : undefined,
      provenance: commitActivitySynthesized ? "live-partial" : "live",
    };
  } catch {
    // Includes an exhausted request budget (TimeoutError) and a malformed
    // upstream body. Callers fall back to simulated figures.
    return null;
  }
}

/**
 * Internal Next.js cached function mapping to stable caching stores.
 * Dynamically includes owner and repo parameters in the cache key to prevent collision.
 */
const cachedGetGitHubStats = (owner: string, repo: string) =>
  unstable_cache(
    async () => fetchRawGitHubStats(owner, repo),
    ["github-repo-metrics-cache", owner, repo],
    { revalidate: 86400, tags: ["github"] }
  )();

/**
 * Public facing API client wrapper.
 * Integrates Next.js unstable_cache and seamlessly falls back to direct API fetching
 * or deterministic simulated stats when executed outside the Next.js app context or
 * when rate limits/404s are encountered.
 */
export async function getGitHubStats(
  owner: string,
  repo: string,
  fallbackLanguage?: string,
  identifier?: string
): Promise<GitHubStats | null> {
  try {
    const stats = await cachedGetGitHubStats(owner, repo);
    if (stats) return stats;
  } catch {
    // Gracefully handle Next.js environment cache errors in standalone Node scripts/tests
    try {
      const stats = await fetchRawGitHubStats(owner, repo);
      if (stats) return stats;
    } catch {
      // Ignore network/API fetch exceptions
    }
  }

  if (fallbackLanguage) {
    return getSimulatedStats(fallbackLanguage, identifier);
  }

  return null;
}

export interface SimulatedTerminalLog {
  text: string;
  color?: string;
}

export function getSimulatedTerminalCommand(language: string): string {
  const lang = language.toLowerCase();
  if (lang === "haskell") return "stack build --fast";
  if (lang === "typescript") return "tsc --build --watch";
  if (lang === "python") return "pytest -v --color=yes";
  return "make build";
}

export function getSimulatedTerminalLogs(
  language: string
): SimulatedTerminalLog[] {
  const lang = language.toLowerCase();
  if (lang === "haskell") {
    return [
      {
        text: "[1 of 4] Compiling Core.AST          ( src/Core/AST.hs, AST.o )",
        color: "text-zinc-400",
      },
      {
        text: "[2 of 4] Compiling Parser.Type      ( src/Parser/Type.hs, Type.o )",
        color: "text-zinc-400",
      },
      {
        text: "[3 of 4] Compiling Solver.Unify     ( src/Solver/Unify.hs, Unify.o )",
        color: "text-zinc-400",
      },
      {
        text: "[4 of 4] Compiling Main             ( app/Main.hs, Main.o )",
        color: "text-zinc-400",
      },
      {
        text: "Linking .stack-work/dist/x86_64/aura-compiler ...",
        color: "text-zinc-400",
      },
      {
        text: "Build successful! Loaded 4 modules.",
        color: "text-emerald-400",
      },
    ];
  }
  if (lang === "typescript") {
    return [
      {
        text: "[1:24:02 PM] Starting compilation in watch mode...",
        color: "text-zinc-400",
      },
      {
        text: "[1:24:04 PM] Found 0 errors. Watching for file changes.",
        color: "text-emerald-400",
      },
      {
        text: "[1:24:10 PM] File change detected. Starting incremental compilation...",
        color: "text-brand-cyan",
      },
      {
        text: "[1:24:11 PM] TS2304: Cannot find name 'unreachable' (Self-healed)",
        color: "text-amber-500",
      },
      {
        text: "[1:24:12 PM] Re-compiled successfully. [0 errors]",
        color: "text-emerald-400",
      },
    ];
  }
  if (lang === "python") {
    return [
      {
        text: "==================== test session starts ====================",
        color: "text-zinc-400",
      },
      {
        text: "platform linux -- Python 3.11.4, pytest-7.4.0",
        color: "text-zinc-400",
      },
      { text: "plugins: cov-4.1.0, pydantic-2.1.1", color: "text-zinc-400" },
      { text: "collected 18 items", color: "text-zinc-300" },
      { text: "tests/test_transport.py ... PASSED", color: "text-emerald-500" },
      {
        text: "tests/test_hipaa_boundary.py ... PASSED",
        color: "text-emerald-500",
      },
      {
        text: "==================== 18 passed in 0.42s =====================",
        color: "text-emerald-400",
      },
    ];
  }
  return [
    {
      text: "[info] Initializing compiler pipeline...",
      color: "text-zinc-400",
    },
    {
      text: "[info] Parsing source file dependencies...",
      color: "text-zinc-400",
    },
    { text: `[info] Compiling ${language} modules...`, color: "text-zinc-300" },
    {
      text: "[success] Build target compiled successfully in 2.34s",
      color: "text-emerald-400",
    },
  ];
}

const PROJECT_METRIC_OVERRIDES: Record<
  string,
  {
    stars: number;
    forks: number;
    openIssues: number;
    commits: number;
    commitsData?: GitHubCommit[];
  }
> = {
  schemaflow: {
    stars: 214,
    forks: 38,
    openIssues: 4,
    commits: 342,
    commitsData: [
      {
        sha: "f1d2e3a",
        message: "perf: optimize web worker message transfer serialization",
        date: "2026-08-18T12:00:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "c4b5a6f",
        message: "feat: add cyclic dependency detection algorithm to DAG core",
        date: "2026-08-16T14:30:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "e7d8c9b",
        message: "refactor: migrate state management store to Zustand",
        date: "2026-08-12T09:15:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "a1b2c3d",
        message: "test: add integration test suite for AST compilation",
        date: "2026-08-08T17:45:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "4f5e6d7",
        message: "initial commit: basic node workspace layout and setup",
        date: "2026-07-20T10:00:00Z",
        author: "Frederick de Ruiter",
      },
    ],
  },
  "hono-kiln": {
    stars: 178,
    forks: 27,
    openIssues: 2,
    commits: 218,
    commitsData: [
      {
        sha: "h8k9l0m",
        message: "perf: optimize edge-native tenant routing table lookups",
        date: "2026-08-17T11:20:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "b3c4d5e",
        message: "feat: add Neon database serverless HTTP connection pooler",
        date: "2026-08-14T16:00:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "f6g7h8j",
        message: "refactor: implement contextual tenant repository proxies",
        date: "2026-08-10T13:40:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "k9l0m1n",
        message: "test: add sub-millisecond cold start benchmark suite",
        date: "2026-08-05T08:30:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "p2q3r4s",
        message: "initial commit: monorepo scaffolding for Hono on Bun",
        date: "2026-07-15T15:00:00Z",
        author: "Frederick de Ruiter",
      },
    ],
  },
  "wedding-website": {
    stars: 89,
    forks: 14,
    openIssues: 0,
    commits: 171,
    commitsData: [
      {
        sha: "10935d5",
        message: "Fix: Refactor and restyle weather forecast component (#167)",
        date: "2025-09-30T15:03:44Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "4c6af6b",
        message:
          "fix(registry): Prevent negative contributions to registry items (#161)",
        date: "2025-09-13T18:57:10Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "1d18148",
        message:
          "fix(scraper): Improve Amazon image scraping resilience (#158)",
        date: "2025-09-13T18:21:54Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "7cdb788",
        message:
          "fix: update database configuration to use PostgreSQL and add pg dependency",
        date: "2025-04-19T02:51:24Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "02e20e2",
        message: "feat: add 3D wedding scene with interactive hearts and rings",
        date: "2025-04-11T19:58:42Z",
        author: "Frederick de Ruiter",
      },
    ],
  },
  "inbody-qr-decoder": {
    stars: 126,
    forks: 21,
    openIssues: 1,
    commits: 184,
    commitsData: [
      {
        sha: "i1n2b3o",
        message:
          "feat: differential mutation oracle for proprietary BIA payloads",
        date: "2026-08-16T15:10:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "d4y5q6r",
        message: "perf: optimize zero-dependency static offset parser cache",
        date: "2026-08-11T12:45:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "c7l8i9e",
        message: "feat: implement multi-package monorepo for inbody-cli tools",
        date: "2026-08-06T10:20:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "n0t1k2e",
        message: "test: add byte slice fuzzing fixtures against real scans",
        date: "2026-07-29T16:50:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "y3z4b5c",
        message: "initial commit: Python core BIA decoding algorithms",
        date: "2026-07-18T09:00:00Z",
        author: "Frederick de Ruiter",
      },
    ],
  },
  "polyglot-tsp": {
    stars: 312,
    forks: 54,
    openIssues: 5,
    commits: 480,
    commitsData: [
      {
        sha: "t1s2p3a",
        message: "bench: aggregate 50+ language SIMD branch-and-bound times",
        date: "2026-08-19T08:00:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "r4u5s6t",
        message: "feat: add Rust Rayon parallel solver baseline implementation",
        date: "2026-08-15T14:10:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "c7p8p9o",
        message: "perf: optimize C++20 AVX-512 distance matrix kernel",
        date: "2026-08-09T11:30:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "j0a1v2a",
        message: "feat: add JVM GraalVM native-image evaluation target",
        date: "2026-08-03T17:25:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "m3a4k5e",
        message: "initial commit: cross-language benchmark test harness",
        date: "2026-07-12T13:00:00Z",
        author: "Frederick de Ruiter",
      },
    ],
  },
  oxidizemath: {
    stars: 195,
    forks: 34,
    openIssues: 2,
    commits: 290,
    commitsData: [
      {
        sha: "o1x2i3d",
        message:
          "feat: verified interval arithmetic with rigorous IEEE-754 bounds",
        date: "2026-08-18T16:40:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "m4a5t6h",
        message: "perf: zero-copy tensor slicing and SIMD numerical kernels",
        date: "2026-08-13T10:15:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "r7u8s9t",
        message: "feat: safe Rust FFI boundary bindings for C and Python",
        date: "2026-08-07T13:50:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "p0r1o2o",
        message: "test: property-based fuzz tests across singular matrices",
        date: "2026-07-31T09:30:00Z",
        author: "Frederick de Ruiter",
      },
      {
        sha: "f3i4l5e",
        message: "initial commit: Cargo workspace and core linear algebra math",
        date: "2026-07-14T14:00:00Z",
        author: "Frederick de Ruiter",
      },
    ],
  },
};

export function getSimulatedStats(
  language: string,
  identifier?: string
): GitHubStats {
  const normalizedId = (identifier || "").toLowerCase().trim();
  const override = normalizedId
    ? PROJECT_METRIC_OVERRIDES[normalizedId]
    : undefined;

  const lang = language.toLowerCase();

  let stars = 50;
  let forks = 10;
  let openIssues = 2;
  let languages: GitHubLanguage[] = [{ name: language, percentage: 100 }];

  if (override) {
    stars = override.stars;
    forks = override.forks;
    openIssues = override.openIssues;
  } else if (normalizedId) {
    // Deterministic seed generation for arbitrary unrecognized project identifiers
    let seed = 0;
    for (let i = 0; i < normalizedId.length; i++) {
      seed = (seed * 31 + normalizedId.charCodeAt(i)) % 1000;
    }
    stars =
      lang === "typescript"
        ? 140 + (seed % 90)
        : lang === "python"
          ? 110 + (seed % 70)
          : lang === "rust"
            ? 180 + (seed % 100)
            : 75 + (seed % 60);
    forks = Math.max(4, Math.round(stars * 0.16) + (seed % 5));
    openIssues = seed % 4;
  } else {
    // Canonical baseline language defaults when no identifier is specified
    if (lang === "typescript") {
      stars = 148;
      forks = 24;
      openIssues = 3;
    } else if (lang === "python") {
      stars = 112;
      forks = 18;
      openIssues = 2;
    } else if (lang === "haskell") {
      stars = 74;
      forks = 11;
      openIssues = 0;
    }
  }

  if (lang === "typescript") {
    languages = [
      { name: "TypeScript", percentage: 88 },
      { name: "JavaScript", percentage: 12 },
    ];
  } else if (lang === "python") {
    languages = [
      { name: "Python", percentage: 95 },
      { name: "HTML", percentage: 5 },
    ];
  } else if (lang === "haskell") {
    languages = [
      { name: "Haskell", percentage: 91 },
      { name: "CSS", percentage: 9 },
    ];
  }

  const commitActivity = generateMockCommitActivity();
  const recentCommits: GitHubCommit[] = override?.commitsData || [];

  if (recentCommits.length === 0) {
    if (lang === "haskell") {
      recentCommits.push(
        {
          sha: "a1b2c3d",
          message: "Merge pull request #14 from ghc-9.2-upgrade",
          date: new Date(Date.now() - 3600000 * 2).toISOString(),
          author: "Frederick de Ruiter",
        },
        {
          sha: "e5f6g7h",
          message: "Optimize monadic parser combinators for large AST streams",
          date: new Date(Date.now() - 3600000 * 12).toISOString(),
          author: "Frederick de Ruiter",
        },
        {
          sha: "i9j0k1l",
          message: "Refactor type flow tracer to use ReaderT design pattern",
          date: new Date(Date.now() - 3600000 * 24).toISOString(),
          author: "Frederick de Ruiter",
        },
        {
          sha: "m2n3o4p",
          message: "Fix space leak in lazy evaluation check of compiler",
          date: new Date(Date.now() - 3600000 * 48).toISOString(),
          author: "Frederick de Ruiter",
        },
        {
          sha: "q5r6s7t",
          message: "Initial prototype of aura AST parser",
          date: new Date(Date.now() - 3600000 * 120).toISOString(),
          author: "Frederick de Ruiter",
        }
      );
    } else if (lang === "typescript") {
      recentCommits.push(
        {
          sha: "f1d2e3a",
          message: "perf: optimize web worker message transfer serialization",
          date: new Date(Date.now() - 3600000 * 3).toISOString(),
          author: "Frederick de Ruiter",
        },
        {
          sha: "c4b5a6f",
          message:
            "feat: add cyclic dependency detection algorithm to DAG core",
          date: new Date(Date.now() - 3600000 * 15).toISOString(),
          author: "Frederick de Ruiter",
        },
        {
          sha: "e7d8c9b",
          message: "refactor: migrate state management store to Zustand",
          date: new Date(Date.now() - 3600000 * 30).toISOString(),
          author: "Frederick de Ruiter",
        },
        {
          sha: "a1b2c3d",
          message: "test: add integration test suite for AST compilation",
          date: new Date(Date.now() - 3600000 * 60).toISOString(),
          author: "Frederick de Ruiter",
        },
        {
          sha: "4f5e6d7",
          message: "initial commit: basic node workspace layout and setup",
          date: new Date(Date.now() - 3600000 * 150).toISOString(),
          author: "Frederick de Ruiter",
        }
      );
    } else if (lang === "python") {
      recentCommits.push(
        {
          sha: "p9o8i7u",
          message:
            "release: v1.1.2 patch for clinical-data transport layer security",
          date: new Date(Date.now() - 3600000 * 4).toISOString(),
          author: "Frederick de Ruiter",
        },
        {
          sha: "y6t5r4e",
          message:
            "feat: enforce TLS 1.3 encryption and automatic token rotation",
          date: new Date(Date.now() - 3600000 * 18).toISOString(),
          author: "Frederick de Ruiter",
        },
        {
          sha: "w3q2a1s",
          message:
            "refactor: migrate clinical models to Pydantic v2 core schemas",
          date: new Date(Date.now() - 3600000 * 36).toISOString(),
          author: "Frederick de Ruiter",
        },
        {
          sha: "z9x8c7v",
          message: "test: implement HIPAA transport boundary mock endpoints",
          date: new Date(Date.now() - 3600000 * 72).toISOString(),
          author: "Frederick de Ruiter",
        },
        {
          sha: "b6n5m4a",
          message: "setup: initialize pyproject.toml and poetry structure",
          date: new Date(Date.now() - 3600000 * 180).toISOString(),
          author: "Frederick de Ruiter",
        }
      );
    } else {
      recentCommits.push(
        {
          sha: "d3c2b1a",
          message: `update core modules and dependencies for ${language} codebase`,
          date: new Date(Date.now() - 3600000 * 5).toISOString(),
          author: "Frederick de Ruiter",
        },
        {
          sha: "a4b5c6d",
          message: "optimize internal algorithms and data structures",
          date: new Date(Date.now() - 3600000 * 20).toISOString(),
          author: "Frederick de Ruiter",
        },
        {
          sha: "e7f8g9h",
          message: "add integration and unit tests for core pipeline",
          date: new Date(Date.now() - 3600000 * 40).toISOString(),
          author: "Frederick de Ruiter",
        },
        {
          sha: "i1j2k3l",
          message: "improve error handling and exception logging structures",
          date: new Date(Date.now() - 3600000 * 80).toISOString(),
          author: "Frederick de Ruiter",
        },
        {
          sha: "m4n5o6p",
          message: `initial workspace layout for ${language} project`,
          date: new Date(Date.now() - 3600000 * 200).toISOString(),
          author: "Frederick de Ruiter",
        }
      );
    }
  }

  return {
    stars,
    forks,
    openIssues,
    languages,
    recentCommits,
    commitActivity,
    provenance: "simulated",
  };
}
