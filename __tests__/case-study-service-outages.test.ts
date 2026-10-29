// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";

/**
 * Outage matrix for the CaseStudyService read paths (#2532).
 *
 * Every combination of Upstash Redis up/down and Neon (Prisma) up/down is
 * exercised, together with the AGENTS.md section 22 distinction: a query that
 * succeeds with zero rows and a cache miss are not data-source failures, so
 * they must never trip failBuildOnDataSourceError during a production build.
 *
 * Each test loads the service on a fresh module graph so that the `env`
 * snapshot (VERCEL_ENV / NEXT_PHASE) and the in-memory mock stores start clean.
 */

const m = vi.hoisted(() => ({
  redisConfigured: { value: true },
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    hgetall: vi.fn(),
    hdel: vi.fn(),
    smembers: vi.fn(),
    sismember: vi.fn(),
    srem: vi.fn(),
    llen: vi.fn(),
    lrange: vi.fn(),
  },
  pipe: {
    sadd: vi.fn(),
    expire: vi.fn(),
    hincrby: vi.fn(),
    rpush: vi.fn(),
    lmove: vi.fn(),
    lrem: vi.fn(),
    del: vi.fn(),
    exec: vi.fn(),
  },
  prisma: {
    caseStudy: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    caseStudyReaction: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    caseStudyFeedback: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: m.prisma }));

vi.mock("@/lib/logger", () => ({ logger: m.logger }));

vi.mock("@/lib/redis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/redis")>();
  return {
    ...actual,
    isRedisConfigured: () => m.redisConfigured.value,
    redis: { ...m.redis, pipeline: vi.fn(() => m.pipe) },
  };
});

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

vi.mock("@/lib/content-sanitizer-lazy", () => ({
  sanitizeContentHtmlLazy: vi.fn(async (html: string) => `clean:${html}`),
}));

type EnvMode = "default" | "production-runtime" | "production-build";

async function load(mode: EnvMode = "default", allowFallback = false) {
  vi.resetModules();
  vi.stubEnv("PLAYWRIGHT_TEST", "");
  vi.stubEnv(
    "NEXT_PHASE",
    mode === "production-build" ? "phase-production-build" : ""
  );
  vi.stubEnv("VERCEL_ENV", mode === "default" ? "development" : "production");
  vi.stubEnv("ALLOW_FALLBACK_PRODUCTION_BUILD", allowFallback ? "1" : "");
  const service = await import("@/lib/services/case-study-service");
  const integrity = await import("@/lib/build-integrity");
  const redisMod = await import("@/lib/redis");
  return {
    CaseStudyService: service.CaseStudyService,
    DataSourceUnavailableError: integrity.DataSourceUnavailableError,
    key: redisMod.getScopedRedisKey,
  };
}

const KNOWN = FALLBACK_CASE_STUDIES.find((f) => f.commands_json)!;
const neonDown = () => new Error("Neon compute suspended: connection refused");
const redisDown = () => new Error("Upstash unreachable");

function dbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "db-1",
    slug: "db-only-study",
    title: "DB Only Study",
    primary_language: "Rust",
    github_url: "https://example.test/db-only",
    published: true,
    simulated_telemetry: false,
    tags: "rust",
    editorial_content: "<p>e</p>",
    architectural_narrative: "<p>n</p>",
    commands_json: null,
    playback_json: null,
    hero_image_url: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function resetMocks() {
  for (const group of [
    m.redis,
    m.pipe,
    m.logger,
    m.prisma.caseStudy,
    m.prisma.caseStudyReaction,
    m.prisma.caseStudyFeedback,
  ]) {
    for (const fn of Object.values(group)) fn.mockReset();
  }
  m.redisConfigured.value = true;
  m.redis.get.mockResolvedValue(null);
  m.redis.set.mockResolvedValue("OK");
  m.redis.del.mockResolvedValue(1);
  m.redis.hgetall.mockResolvedValue(null);
  m.redis.smembers.mockResolvedValue([]);
  m.pipe.exec.mockResolvedValue([]);
}

beforeEach(() => {
  resetMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("getAllPublishedCaseStudies outage matrix", () => {
  it("Redis up (hit), Neon up: serves the cache and never wakes Postgres", async () => {
    const { CaseStudyService } = await load();
    m.redis.get.mockResolvedValueOnce([
      { ...dbRow(), created_at: "2026-01-01T00:00:00.000Z" },
    ]);

    const result = await CaseStudyService.getAllPublishedCaseStudies();

    expect(result).toHaveLength(1);
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(m.prisma.caseStudy.findMany).not.toHaveBeenCalled();
  });

  it("Redis up (miss), Neon up: falls through to Postgres, merges fallbacks and caches", async () => {
    const { CaseStudyService, key } = await load();
    m.prisma.caseStudy.findMany.mockResolvedValueOnce([
      dbRow(),
      dbRow({
        id: "db-known",
        slug: KNOWN.slug,
        github_url: null,
        hero_image_url: null,
      }),
    ]);

    const result = await CaseStudyService.getAllPublishedCaseStudies();

    expect(result[0]).toMatchObject({
      slug: "db-only-study",
      github_url: "https://example.test/db-only",
      hero_image_url: null,
    });
    expect(result[0].commands_json).toBeUndefined();
    // A DB row missing optional columns borrows them from its static twin.
    expect(result[1]).toMatchObject({
      slug: KNOWN.slug,
      github_url: KNOWN.github_url,
      commands_json: KNOWN.commands_json,
      playback_json: KNOWN.playback_json,
    });
    expect(result).toHaveLength(FALLBACK_CASE_STUDIES.length + 1);
    expect(m.redis.set).toHaveBeenCalledWith(key("cs:all_published"), result, {
      ex: 3600,
    });
  });

  it("Redis up (miss), Neon up with zero rows: not a failure, even in a production build", async () => {
    const { CaseStudyService } = await load("production-build");
    m.prisma.caseStudy.findMany.mockResolvedValueOnce([]);

    const result = await CaseStudyService.getAllPublishedCaseStudies();

    expect(result.map((s) => s.slug)).toEqual(
      FALLBACK_CASE_STUDIES.map((s) => s.slug)
    );
    expect(m.redis.set).toHaveBeenCalledTimes(1);
  });

  it("treats an empty cached array as a miss and queries Postgres", async () => {
    const { CaseStudyService } = await load("production-build");
    m.redis.get.mockResolvedValueOnce([]);
    m.prisma.caseStudy.findMany.mockResolvedValueOnce([dbRow()]);

    const result = await CaseStudyService.getAllPublishedCaseStudies();

    expect(m.prisma.caseStudy.findMany).toHaveBeenCalledTimes(1);
    expect(result[0].slug).toBe("db-only-study");
  });

  it("Redis up, Neon down: serves static fallbacks and does not cache them", async () => {
    const { CaseStudyService } = await load();
    m.prisma.caseStudy.findMany.mockRejectedValueOnce(neonDown());

    const result = await CaseStudyService.getAllPublishedCaseStudies();

    expect(result).toEqual(FALLBACK_CASE_STUDIES);
    expect(result).not.toBe(FALLBACK_CASE_STUDIES);
    expect(m.redis.set).not.toHaveBeenCalled();
    expect(m.logger.warn).not.toHaveBeenCalled();
  });

  it("Redis down, Neon up: a cache error falls through to Postgres and a failed cache write is tolerated", async () => {
    const { CaseStudyService } = await load();
    m.redis.get.mockRejectedValueOnce(redisDown());
    m.redis.set.mockRejectedValueOnce(redisDown());
    m.prisma.caseStudy.findMany.mockResolvedValueOnce([dbRow()]);

    const result = await CaseStudyService.getAllPublishedCaseStudies();

    expect(result[0].slug).toBe("db-only-study");
    expect(m.prisma.caseStudy.findMany).toHaveBeenCalledTimes(1);
  });

  it("Redis down, Neon down: serves static fallbacks", async () => {
    const { CaseStudyService } = await load();
    m.redis.get.mockRejectedValueOnce(redisDown());
    m.prisma.caseStudy.findMany.mockRejectedValueOnce(neonDown());

    await expect(
      CaseStudyService.getAllPublishedCaseStudies()
    ).resolves.toEqual(FALLBACK_CASE_STUDIES);
  });

  it("Redis not configured: skips Upstash entirely in both directions", async () => {
    const { CaseStudyService } = await load();
    m.redisConfigured.value = false;
    m.prisma.caseStudy.findMany.mockResolvedValueOnce([dbRow()]);

    await CaseStudyService.getAllPublishedCaseStudies();

    expect(m.redis.get).not.toHaveBeenCalled();
    expect(m.redis.set).not.toHaveBeenCalled();
  });

  it("Redis hanging: gives up after the 1500ms timeout and reads Postgres", async () => {
    vi.useFakeTimers();
    const { CaseStudyService } = await load();
    m.redis.get.mockReturnValueOnce(new Promise(() => {}));
    m.redis.set.mockReturnValueOnce(new Promise(() => {}));
    m.prisma.caseStudy.findMany.mockResolvedValueOnce([dbRow()]);

    const pending = CaseStudyService.getAllPublishedCaseStudies();
    await vi.advanceTimersByTimeAsync(1500);
    expect(m.prisma.caseStudy.findMany).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1500);

    await expect(pending).resolves.toHaveLength(
      FALLBACK_CASE_STUDIES.length + 1
    );
  });

  it("Neon down during a production build: aborts instead of baking fallbacks in", async () => {
    const { CaseStudyService, DataSourceUnavailableError } =
      await load("production-build");
    m.prisma.caseStudy.findMany.mockRejectedValueOnce(neonDown());

    await expect(
      CaseStudyService.getAllPublishedCaseStudies()
    ).rejects.toBeInstanceOf(DataSourceUnavailableError);
  });

  it("Neon down during a production build with the emergency override: falls back loudly", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { CaseStudyService } = await load("production-build", true);
    m.prisma.caseStudy.findMany.mockRejectedValueOnce(neonDown());

    await expect(
      CaseStudyService.getAllPublishedCaseStudies()
    ).resolves.toEqual(FALLBACK_CASE_STUDIES);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("ALLOW_FALLBACK_PRODUCTION_BUILD=1")
    );
    consoleError.mockRestore();
  });

  it("Neon down on a running production server: falls back and logs a warning", async () => {
    const { CaseStudyService } = await load("production-runtime");
    m.prisma.caseStudy.findMany.mockRejectedValueOnce(neonDown());

    await expect(
      CaseStudyService.getAllPublishedCaseStudies()
    ).resolves.toEqual(FALLBACK_CASE_STUDIES);
    expect(m.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("getAllPublishedCaseStudies"),
      expect.any(Error)
    );
  });

  it("getAllPublishedSlugs mirrors the resolved list", async () => {
    const { CaseStudyService } = await load();
    m.prisma.caseStudy.findMany.mockRejectedValueOnce(neonDown());

    await expect(CaseStudyService.getAllPublishedSlugs()).resolves.toEqual(
      FALLBACK_CASE_STUDIES.map((s) => s.slug)
    );
  });
});

describe("getCaseStudyBySlug outage matrix", () => {
  it("Redis up (hit), Neon up: serves the cache", async () => {
    const { CaseStudyService } = await load();
    m.redis.get.mockResolvedValueOnce(dbRow());

    const result = await CaseStudyService.getCaseStudyBySlug("db-only-study");

    expect(result?.updated_at).toBeInstanceOf(Date);
    expect(m.prisma.caseStudy.findUnique).not.toHaveBeenCalled();
  });

  it("ignores a cached entry for a different slug and reads Postgres", async () => {
    const { CaseStudyService } = await load();
    m.redis.get.mockResolvedValueOnce(dbRow({ slug: "someone-else" }));
    m.prisma.caseStudy.findUnique.mockResolvedValueOnce(dbRow());

    const result = await CaseStudyService.getCaseStudyBySlug("db-only-study");

    expect(m.prisma.caseStudy.findUnique).toHaveBeenCalledTimes(1);
    expect(result?.slug).toBe("db-only-study");
  });

  it("Redis up (miss), Neon up: maps the row, filling gaps from its static twin", async () => {
    const { CaseStudyService, key } = await load();
    m.prisma.caseStudy.findUnique.mockResolvedValueOnce(
      dbRow({ slug: KNOWN.slug, github_url: null, title: "Live title" })
    );

    const result = await CaseStudyService.getCaseStudyBySlug(KNOWN.slug);

    expect(result).toMatchObject({
      slug: KNOWN.slug,
      title: "Live title",
      github_url: KNOWN.github_url,
      commands_json: KNOWN.commands_json,
    });
    expect(m.redis.set).toHaveBeenCalledWith(
      key(`cs:slug:${KNOWN.slug}`),
      result,
      { ex: 3600 }
    );
  });

  it("Redis up (miss), Neon up with no row: not a failure; resolves to the static entry in a production build", async () => {
    const { CaseStudyService } = await load("production-build");
    m.prisma.caseStudy.findUnique.mockResolvedValueOnce(null);

    const result = await CaseStudyService.getCaseStudyBySlug(KNOWN.slug);

    expect(result).toEqual(KNOWN);
  });

  it("Neon up with no row for an unknown slug: resolves to null and caches nothing", async () => {
    const { CaseStudyService } = await load("production-build");
    m.prisma.caseStudy.findUnique.mockResolvedValueOnce(null);

    await expect(
      CaseStudyService.getCaseStudyBySlug("never-existed")
    ).resolves.toBeNull();
    expect(m.redis.set).not.toHaveBeenCalled();
  });

  it("an unpublished row is hidden behind the static entry (or null)", async () => {
    const { CaseStudyService } = await load();
    m.prisma.caseStudy.findUnique.mockResolvedValueOnce(
      dbRow({ slug: "draft-only", published: false })
    );

    await expect(
      CaseStudyService.getCaseStudyBySlug("draft-only")
    ).resolves.toBeNull();
  });

  it("Redis up, Neon down: resolves to the static entry and does not cache it", async () => {
    const { CaseStudyService } = await load();
    m.prisma.caseStudy.findUnique.mockRejectedValueOnce(neonDown());

    await expect(
      CaseStudyService.getCaseStudyBySlug(KNOWN.slug)
    ).resolves.toEqual(KNOWN);
    expect(m.redis.set).not.toHaveBeenCalled();
  });

  it("serves fresh Postgres data once Neon recovers from an outage (#3614)", async () => {
    const { CaseStudyService, key } = await load();
    m.prisma.caseStudy.findUnique.mockRejectedValueOnce(neonDown());

    await expect(
      CaseStudyService.getCaseStudyBySlug(KNOWN.slug)
    ).resolves.toEqual(KNOWN);
    expect(m.redis.set).not.toHaveBeenCalled();

    // Nothing was cached during the outage, so the next read is a miss
    // that reaches the recovered database.
    m.prisma.caseStudy.findUnique.mockResolvedValueOnce(
      dbRow({ slug: KNOWN.slug, title: "Recovered title" })
    );

    const recovered = await CaseStudyService.getCaseStudyBySlug(KNOWN.slug);

    expect(m.prisma.caseStudy.findUnique).toHaveBeenCalledTimes(2);
    expect(recovered?.title).toBe("Recovered title");
    expect(m.redis.set).toHaveBeenCalledTimes(1);
    expect(m.redis.set).toHaveBeenCalledWith(
      key(`cs:slug:${KNOWN.slug}`),
      recovered,
      { ex: 3600 }
    );
  });

  it("Neon up with no row: caches the static entry, since the query succeeded", async () => {
    const { CaseStudyService, key } = await load();
    m.prisma.caseStudy.findUnique.mockResolvedValueOnce(null);

    await CaseStudyService.getCaseStudyBySlug(KNOWN.slug);

    expect(m.redis.set).toHaveBeenCalledWith(
      key(`cs:slug:${KNOWN.slug}`),
      KNOWN,
      { ex: 3600 }
    );
  });

  it("Neon down for an unknown slug: resolves to null and caches nothing", async () => {
    const { CaseStudyService } = await load();
    m.prisma.caseStudy.findUnique.mockRejectedValueOnce(neonDown());

    await expect(
      CaseStudyService.getCaseStudyBySlug("never-existed")
    ).resolves.toBeNull();
    expect(m.redis.set).not.toHaveBeenCalled();
  });

  it("Redis down, Neon up: reads Postgres and tolerates the failed cache write", async () => {
    const { CaseStudyService } = await load();
    m.redis.get.mockRejectedValueOnce(redisDown());
    m.redis.set.mockRejectedValueOnce(redisDown());
    m.prisma.caseStudy.findUnique.mockResolvedValueOnce(dbRow());

    const result = await CaseStudyService.getCaseStudyBySlug("db-only-study");

    expect(result?.title).toBe("DB Only Study");
  });

  it("Redis down, Neon down on a running production server: static entry, both failures logged", async () => {
    const { CaseStudyService } = await load("production-runtime");
    m.redis.get.mockRejectedValueOnce(redisDown());
    m.prisma.caseStudy.findUnique.mockRejectedValueOnce(neonDown());

    await expect(
      CaseStudyService.getCaseStudyBySlug(KNOWN.slug)
    ).resolves.toEqual(KNOWN);
    expect(m.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Redis cache read failed"),
      expect.any(Error)
    );
    expect(m.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("DB query failed"),
      expect.any(Error)
    );
  });

  it("Redis not configured, Neon up: never touches Upstash", async () => {
    const { CaseStudyService } = await load();
    m.redisConfigured.value = false;
    m.prisma.caseStudy.findUnique.mockResolvedValueOnce(dbRow());

    await CaseStudyService.getCaseStudyBySlug("db-only-study");

    expect(m.redis.get).not.toHaveBeenCalled();
    expect(m.redis.set).not.toHaveBeenCalled();
  });

  it("Neon down during a production build: aborts", async () => {
    const { CaseStudyService, DataSourceUnavailableError } =
      await load("production-build");
    m.prisma.caseStudy.findUnique.mockRejectedValueOnce(neonDown());

    await expect(
      CaseStudyService.getCaseStudyBySlug(KNOWN.slug)
    ).rejects.toBeInstanceOf(DataSourceUnavailableError);
    expect(m.redis.set).not.toHaveBeenCalled();
  });

  it("Neon down during a production build with the emergency override: falls back without caching", async () => {
    const { CaseStudyService } = await load("production-build", true);
    m.prisma.caseStudy.findUnique.mockRejectedValueOnce(neonDown());

    await expect(
      CaseStudyService.getCaseStudyBySlug(KNOWN.slug)
    ).resolves.toEqual(KNOWN);
    expect(m.redis.set).not.toHaveBeenCalled();
  });
});

describe("getPublishedCaseStudies outage matrix", () => {
  it("returns the fixed Playwright fixture without touching any data source", async () => {
    vi.resetModules();
    vi.stubEnv("PLAYWRIGHT_TEST", "true");
    const { CaseStudyService } =
      await import("@/lib/services/case-study-service");

    const result = await CaseStudyService.getPublishedCaseStudies();

    expect(result.length).toBeGreaterThan(0);
    expect(m.redis.get).not.toHaveBeenCalled();
    expect(m.prisma.caseStudy.findMany).not.toHaveBeenCalled();
  });

  it("Redis up (hit): serves the search index cache", async () => {
    const { CaseStudyService } = await load();
    const cached = [
      { id: "x", slug: "x", title: "X", primary_language: "Go", tags: "go" },
    ];
    m.redis.get.mockResolvedValueOnce(cached);

    await expect(CaseStudyService.getPublishedCaseStudies()).resolves.toBe(
      cached
    );
    expect(m.prisma.caseStudy.findMany).not.toHaveBeenCalled();
  });

  it("Redis up (miss), Neon up with zero rows: not a failure in a production build", async () => {
    const { CaseStudyService } = await load("production-build");
    m.prisma.caseStudy.findMany.mockResolvedValueOnce([]);

    const result = await CaseStudyService.getPublishedCaseStudies();

    expect(result.map((s) => s.slug)).toEqual(
      FALLBACK_CASE_STUDIES.map((s) => s.slug)
    );
    expect(Object.keys(result[0]).sort()).toEqual([
      "id",
      "primary_language",
      "slug",
      "tags",
      "title",
    ]);
  });

  it("Redis down, Neon up: reads Postgres and tolerates a failed cache write", async () => {
    const { CaseStudyService } = await load();
    m.redis.get.mockRejectedValueOnce(redisDown());
    m.redis.set.mockRejectedValueOnce(redisDown());
    m.prisma.caseStudy.findMany.mockResolvedValueOnce([
      {
        id: "db",
        slug: KNOWN.slug,
        title: "T",
        primary_language: "TS",
        tags: "",
      },
    ]);

    const result = await CaseStudyService.getPublishedCaseStudies();

    expect(result[0].title).toBe("T");
    expect(result.filter((s) => s.slug === KNOWN.slug)).toHaveLength(1);
  });

  it("Redis up, Neon down on a running production server: summaries of the fallbacks, warning logged", async () => {
    const { CaseStudyService } = await load("production-runtime");
    m.prisma.caseStudy.findMany.mockRejectedValueOnce(neonDown());

    const result = await CaseStudyService.getPublishedCaseStudies();

    expect(result).toHaveLength(FALLBACK_CASE_STUDIES.length);
    expect(m.redis.set).not.toHaveBeenCalled();
    expect(m.logger.warn).toHaveBeenCalledTimes(1);
  });

  it("Redis not configured, Neon down: summaries of the fallbacks", async () => {
    const { CaseStudyService } = await load();
    m.redisConfigured.value = false;
    m.prisma.caseStudy.findMany.mockRejectedValueOnce(neonDown());

    const result = await CaseStudyService.getPublishedCaseStudies();

    expect(result).toHaveLength(FALLBACK_CASE_STUDIES.length);
    expect(m.redis.get).not.toHaveBeenCalled();
  });

  it("Neon down during a production build: aborts", async () => {
    const { CaseStudyService, DataSourceUnavailableError } =
      await load("production-build");
    m.prisma.caseStudy.findMany.mockRejectedValueOnce(neonDown());

    await expect(
      CaseStudyService.getPublishedCaseStudies()
    ).rejects.toBeInstanceOf(DataSourceUnavailableError);
  });
});

describe("getReactions outage matrix", () => {
  const slug = "reaction-slug";
  const zero = { insightful: 0, mind_blowing: 0, actionable: 0, thorough: 0 };

  it("Redis up (cached base + buffer), Neon untouched for counts", async () => {
    const { CaseStudyService } = await load();
    m.redis.get.mockResolvedValueOnce({
      insightful: 3,
      bogus: 9,
      thorough: "x",
    });
    m.redis.hgetall.mockResolvedValueOnce({
      insightful: "2",
      actionable: -4,
      unknown: 5,
    });
    m.redis.smembers.mockResolvedValueOnce(["insightful"]);

    const result = await CaseStudyService.getReactions(slug, "hash");

    expect(result.counts).toEqual({ ...zero, insightful: 5 });
    expect(result.userReactions).toEqual(["insightful"]);
    expect(m.prisma.caseStudyReaction.groupBy).not.toHaveBeenCalled();
    expect(m.prisma.caseStudyReaction.findMany).not.toHaveBeenCalled();
  });

  it("Redis up (miss), Neon up: reads base counts, caches them, and backfills user reactions", async () => {
    const { CaseStudyService, key } = await load();
    m.prisma.caseStudyReaction.groupBy.mockResolvedValueOnce([
      { reactionType: "thorough", _count: { id: 7 } },
      { reactionType: "retired_type", _count: { id: 1 } },
    ]);
    m.prisma.caseStudyReaction.findMany.mockResolvedValueOnce([
      { reactionType: "thorough" },
    ]);

    const result = await CaseStudyService.getReactions(slug, "hash");

    expect(result.counts).toEqual({ ...zero, thorough: 7 });
    expect(result.userReactions).toEqual(["thorough"]);
    expect(m.redis.set).toHaveBeenCalledWith(
      key(`cs:reactions_counts:${slug}`),
      { ...zero, thorough: 7 },
      { ex: 3600 }
    );
    expect(m.pipe.sadd).toHaveBeenCalledWith(
      key(`cs:user_reactions:${slug}:hash`),
      "thorough"
    );
  });

  it("Redis up (miss), Neon up with zero rows: zero counts, nothing to backfill", async () => {
    const { CaseStudyService } = await load("production-build");
    m.prisma.caseStudyReaction.groupBy.mockResolvedValueOnce([]);
    m.prisma.caseStudyReaction.findMany.mockResolvedValueOnce([]);

    const result = await CaseStudyService.getReactions(slug, "hash");

    expect(result).toEqual({
      success: true,
      caseStudySlug: slug,
      counts: zero,
      userReactions: [],
    });
    expect(m.pipe.exec).not.toHaveBeenCalled();
  });

  it("tolerates failing cache writes and a failing backfill pipeline", async () => {
    const { CaseStudyService } = await load();
    m.redis.set.mockRejectedValueOnce(redisDown());
    m.pipe.exec.mockRejectedValueOnce(redisDown());
    m.prisma.caseStudyReaction.groupBy.mockResolvedValueOnce([
      { reactionType: "insightful", _count: { id: 1 } },
    ]);
    m.prisma.caseStudyReaction.findMany.mockResolvedValueOnce([
      { reactionType: "insightful" },
    ]);

    const result = await CaseStudyService.getReactions(slug, "hash");

    expect(result.userReactions).toEqual(["insightful"]);
  });

  it("Redis up, Neon down: zero counts and no user reactions, with the base-count warning in production", async () => {
    const { CaseStudyService } = await load("production-runtime");
    m.prisma.caseStudyReaction.groupBy.mockRejectedValueOnce(neonDown());
    m.prisma.caseStudyReaction.findMany.mockRejectedValueOnce(neonDown());

    const result = await CaseStudyService.getReactions(slug, "hash");

    expect(result.counts).toEqual(zero);
    expect(result.userReactions).toEqual([]);
    expect(m.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to query base reactions"),
      expect.any(Error)
    );
  });

  it("Redis down, Neon up: falls back to direct Prisma queries", async () => {
    const { CaseStudyService } = await load("production-runtime");
    m.redis.get.mockRejectedValueOnce(redisDown());
    m.redis.set.mockRejectedValueOnce(redisDown());
    m.redis.hgetall.mockRejectedValueOnce(redisDown());
    m.prisma.caseStudyReaction.groupBy
      .mockResolvedValueOnce([
        { reactionType: "actionable", _count: { id: 2 } },
      ])
      .mockResolvedValueOnce([
        { reactionType: "actionable", _count: { id: 2 } },
        { reactionType: "retired_type", _count: { id: 1 } },
      ]);
    m.prisma.caseStudyReaction.findMany.mockResolvedValueOnce([
      { reactionType: "actionable" },
    ]);

    const result = await CaseStudyService.getReactions(slug, "hash");

    expect(result.counts).toEqual({ ...zero, actionable: 2 });
    expect(result.userReactions).toEqual(["actionable"]);
    expect(m.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Redis path failed"),
      expect.any(Error)
    );
  });

  it("Redis down, Neon down: default counts and no user reactions", async () => {
    const { CaseStudyService } = await load("production-runtime");
    m.redis.get.mockRejectedValueOnce(redisDown());
    m.redis.hgetall.mockRejectedValueOnce(redisDown());
    m.prisma.caseStudyReaction.groupBy.mockRejectedValue(neonDown());

    const result = await CaseStudyService.getReactions(slug, "hash");

    expect(result).toEqual({
      success: true,
      caseStudySlug: slug,
      counts: zero,
      userReactions: [],
    });
    expect(m.logger.error).toHaveBeenCalledWith(
      "Failed to query case study reactions from DB:",
      expect.any(Error)
    );
  });

  it("Redis not configured, Neon up: base counts from Postgres, buffer skipped", async () => {
    const { CaseStudyService } = await load();
    m.redisConfigured.value = false;
    m.prisma.caseStudyReaction.groupBy.mockResolvedValueOnce([
      { reactionType: "insightful", _count: { id: 4 } },
    ]);
    m.prisma.caseStudyReaction.findMany.mockResolvedValueOnce([]);

    const result = await CaseStudyService.getReactions(slug, "hash");

    expect(result.counts).toEqual({ ...zero, insightful: 4 });
    expect(m.redis.hgetall).not.toHaveBeenCalled();
    expect(m.redis.set).not.toHaveBeenCalled();
  });
});

describe("Neon-down mock stores keep reads and writes consistent", () => {
  it("reactions submitted while Neon is down are counted by later reads", async () => {
    const { CaseStudyService } = await load();
    m.redisConfigured.value = false;
    m.prisma.caseStudyReaction.createMany.mockRejectedValue(neonDown());
    m.prisma.caseStudyReaction.groupBy.mockRejectedValue(neonDown());
    m.prisma.caseStudyReaction.findMany.mockRejectedValue(neonDown());

    await CaseStudyService.submitReaction(
      { caseStudySlug: "offline-slug", reactionType: "insightful" },
      "h1"
    );
    const second = await CaseStudyService.submitReaction(
      { caseStudySlug: "offline-slug", reactionType: "insightful" },
      "h2"
    );
    expect(second.counts.insightful).toBe(2);
    expect(second.userReactions).toEqual(["insightful"]);

    // Base counts (getBaseReactionCounts) and the direct DB fallback both
    // read the in-memory store.
    const read = await CaseStudyService.getReactions("offline-slug", "h1");
    expect(read.counts.insightful).toBe(2);

    m.redisConfigured.value = true;
    m.redis.hgetall.mockRejectedValueOnce(redisDown());
    const readRedisDown = await CaseStudyService.getReactions(
      "offline-slug",
      "h1"
    );
    expect(readRedisDown.counts.insightful).toBe(2);
  });

  it("logs the direct-write fallback on a running production server", async () => {
    const { CaseStudyService } = await load("production-runtime");
    m.redisConfigured.value = false;
    m.prisma.caseStudyReaction.createMany.mockRejectedValueOnce(neonDown());

    const result = await CaseStudyService.submitReaction(
      { caseStudySlug: "s", reactionType: "thorough" },
      "h"
    );

    expect(result.counts.thorough).toBe(1);
    expect(m.logger.error).toHaveBeenCalledWith(
      "Database reaction creation failed, using mock fallback:",
      expect.any(Error)
    );
  });

  it("writes reactions straight to Postgres when Redis is not configured", async () => {
    const { CaseStudyService } = await load();
    m.redisConfigured.value = false;
    m.prisma.caseStudyReaction.createMany.mockResolvedValueOnce({ count: 1 });
    m.prisma.caseStudyReaction.groupBy.mockResolvedValueOnce([
      { reactionType: "thorough", _count: { id: 3 } },
      { reactionType: "retired_type", _count: { id: 1 } },
    ]);
    m.prisma.caseStudyReaction.findMany.mockResolvedValueOnce([
      { reactionType: "thorough" },
    ]);

    const result = await CaseStudyService.submitReaction(
      { caseStudySlug: "s", reactionType: "thorough" },
      "h"
    );

    expect(result.counts.thorough).toBe(3);
    expect(result.counts).not.toHaveProperty("retired_type");
    expect(result.userReactions).toEqual(["thorough"]);
  });
});

describe("submitReaction with Redis up but degraded", () => {
  it("returns the stored members for a repeat reaction without incrementing", async () => {
    const { CaseStudyService } = await load();
    m.redis.sismember.mockResolvedValueOnce(1);
    m.redis.smembers.mockResolvedValueOnce(["insightful", "thorough"]);
    m.redis.get.mockResolvedValueOnce({ insightful: 1 });

    const result = await CaseStudyService.submitReaction(
      { caseStudySlug: "s", reactionType: "insightful" },
      "h"
    );

    expect(result.userReactions).toEqual(["insightful", "thorough"]);
    expect(m.pipe.hincrby).not.toHaveBeenCalled();
  });

  it("falls back to the submitted type when smembers fails on a repeat reaction", async () => {
    const { CaseStudyService } = await load();
    m.redis.sismember.mockResolvedValueOnce(1);
    m.redis.smembers.mockRejectedValueOnce(redisDown());
    m.redis.hgetall.mockRejectedValueOnce(redisDown());
    m.prisma.caseStudyReaction.groupBy.mockResolvedValueOnce([]);

    const result = await CaseStudyService.submitReaction(
      { caseStudySlug: "s", reactionType: "insightful" },
      "h"
    );

    expect(result.userReactions).toEqual(["insightful"]);
  });

  it("buffers a new reaction and merges the buffer into the counts", async () => {
    const { CaseStudyService } = await load();
    m.redis.sismember.mockResolvedValueOnce(0);
    m.redis.smembers.mockResolvedValueOnce(["thorough"]);
    m.redis.get.mockResolvedValueOnce({ insightful: 1 });
    m.redis.hgetall.mockResolvedValueOnce({
      insightful: "1",
      junk: 4,
      thorough: "nan",
    });

    const result = await CaseStudyService.submitReaction(
      { caseStudySlug: "s", reactionType: "insightful" },
      "h"
    );

    // Members that miss the just-added type still report it.
    expect(result.userReactions).toEqual(["thorough", "insightful"]);
    expect(result.counts).toMatchObject({ insightful: 2, thorough: 0 });
    expect(m.pipe.rpush).toHaveBeenCalledTimes(1);
  });

  it("reports only the submitted type when smembers fails after buffering", async () => {
    const { CaseStudyService } = await load();
    m.redis.sismember.mockResolvedValueOnce(0);
    m.redis.smembers.mockRejectedValueOnce(redisDown());
    m.redis.get.mockResolvedValueOnce({ thorough: 2 });

    const result = await CaseStudyService.submitReaction(
      { caseStudySlug: "s", reactionType: "thorough" },
      "h"
    );

    expect(result.userReactions).toEqual(["thorough"]);
    expect(result.counts.thorough).toBe(2);
  });

  it("falls back to the direct Postgres write when the buffer pipeline fails", async () => {
    const { CaseStudyService } = await load("production-runtime");
    m.redis.sismember.mockResolvedValueOnce(0);
    m.pipe.exec.mockRejectedValueOnce(redisDown());
    m.prisma.caseStudyReaction.createMany.mockResolvedValueOnce({ count: 1 });
    m.prisma.caseStudyReaction.groupBy.mockResolvedValueOnce([
      { reactionType: "actionable", _count: { id: 1 } },
    ]);
    m.prisma.caseStudyReaction.findMany.mockResolvedValueOnce([
      { reactionType: "actionable" },
    ]);

    const result = await CaseStudyService.submitReaction(
      { caseStudySlug: "s", reactionType: "actionable" },
      "h"
    );

    expect(result.counts.actionable).toBe(1);
    expect(m.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Redis buffering failed"),
      expect.any(Error)
    );
  });
});

describe("feedback with Neon up/down", () => {
  it("returns stored feedback and whether this visitor submitted", async () => {
    const { CaseStudyService } = await load();
    m.prisma.caseStudyFeedback.findMany.mockResolvedValueOnce([
      {
        id: "f1",
        takeaways: '["a"]',
        comments: "c",
        createdAt: "t",
        connectionHash: "me",
      },
      {
        id: "f2",
        takeaways: "",
        comments: "d",
        createdAt: "t",
        connectionHash: "other",
      },
    ]);

    const result = await CaseStudyService.getFeedback("s", "me");

    expect(result.hasSubmitted).toBe(true);
    expect(result.feedback.map((f) => f.takeaways)).toEqual([["a"], []]);
  });

  it("an empty feedback list is a normal result", async () => {
    const { CaseStudyService } = await load();
    m.prisma.caseStudyFeedback.findMany.mockResolvedValueOnce([]);

    const result = await CaseStudyService.getFeedback("s", "me");

    expect(result).toMatchObject({ hasSubmitted: false, totalFeedback: 0 });
  });

  it("rate-limits a second submission within the hour", async () => {
    const { CaseStudyService } = await load();
    m.prisma.caseStudyFeedback.findFirst.mockResolvedValueOnce({ id: "x" });

    const result = await CaseStudyService.submitFeedback(
      { caseStudySlug: "s", takeaways: [], comments: "" },
      "me"
    );

    expect(result.rateLimited).toBe(true);
    expect(m.prisma.caseStudyFeedback.create).not.toHaveBeenCalled();
  });

  it("persists a first submission", async () => {
    const { CaseStudyService } = await load();
    m.prisma.caseStudyFeedback.findFirst.mockResolvedValueOnce(null);
    m.prisma.caseStudyFeedback.create.mockResolvedValueOnce({
      id: "new",
      caseStudySlug: "s",
      comments: "great",
      createdAt: "t",
    });

    const result = await CaseStudyService.submitFeedback(
      { caseStudySlug: "s", takeaways: ["x"], comments: "great" },
      "me"
    );

    expect(result).toMatchObject({
      rateLimited: false,
      feedback: { id: "new", takeaways: ["x"] },
    });
  });

  it("Neon down: accepts feedback into memory, rate-limits a repeat and reads it back", async () => {
    const { CaseStudyService } = await load("production-runtime");
    m.prisma.caseStudyFeedback.findFirst.mockRejectedValue(neonDown());
    m.prisma.caseStudyFeedback.findMany.mockRejectedValue(neonDown());

    const first = await CaseStudyService.submitFeedback(
      { caseStudySlug: "mem", takeaways: ["t"], comments: "c" },
      "me"
    );
    const repeat = await CaseStudyService.submitFeedback(
      { caseStudySlug: "mem", takeaways: ["t"], comments: "c" },
      "me"
    );
    const read = await CaseStudyService.getFeedback("mem", "me");
    const readOther = await CaseStudyService.getFeedback("empty", "me");

    expect(first).toMatchObject({ rateLimited: false, success: true });
    expect(repeat.rateLimited).toBe(true);
    expect(read).toMatchObject({ hasSubmitted: true, totalFeedback: 1 });
    expect(read.feedback[0]).toMatchObject({ id: "mock-0", takeaways: ["t"] });
    expect(readOther).toMatchObject({ hasSubmitted: false, totalFeedback: 0 });
    expect(m.logger.error).toHaveBeenCalledWith(
      "Database feedback creation failed, using fallback:",
      expect.any(Error)
    );
    expect(m.logger.error).toHaveBeenCalledWith(
      "Failed to query case study feedback:",
      expect.any(Error)
    );
  });
});

describe("writes and cache eviction with Redis up/down", () => {
  it("evicts every key when Redis is up", async () => {
    const { CaseStudyService } = await load();

    await expect(CaseStudyService.evictCaseStudyCache("s")).resolves.toBe(true);
    expect(m.redis.del).toHaveBeenCalledTimes(4);
  });

  it("reports no eviction, with a production warning, when Redis is down", async () => {
    const { CaseStudyService } = await load("production-runtime");
    m.redis.del.mockRejectedValue(redisDown());

    await expect(CaseStudyService.evictCaseStudyCache("s")).resolves.toBe(
      false
    );
    expect(m.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Redis eviction failed"),
      expect.any(Error)
    );
  });

  it("reports no eviction without touching Upstash when it is not configured", async () => {
    const { CaseStudyService } = await load();
    m.redisConfigured.value = false;

    await expect(CaseStudyService.evictCaseStudyCache("s")).resolves.toBe(
      false
    );
    expect(m.redis.del).not.toHaveBeenCalled();
  });

  it("submitCaseStudy sanitizes content, stores a draft and evicts the slug", async () => {
    const { CaseStudyService } = await load();
    m.prisma.caseStudy.create.mockImplementationOnce(async ({ data }) => data);

    const created = await CaseStudyService.submitCaseStudy({
      title: "T",
      slug: "new-study",
      primary_language: "Go",
      editorial_content: "<p>e</p>",
      architectural_narrative: "<p>n</p>",
      tags: "go",
      github_url: "",
    });

    expect(created).toMatchObject({
      editorial_content: "clean:<p>e</p>",
      architectural_narrative: "clean:<p>n</p>",
      github_url: null,
      published: false,
    });
    expect(m.redis.del).toHaveBeenCalled();
  });

  it("submitCaseStudy keeps a provided GitHub URL", async () => {
    const { CaseStudyService } = await load();
    m.prisma.caseStudy.create.mockImplementationOnce(async ({ data }) => data);

    const created = await CaseStudyService.submitCaseStudy({
      title: "T",
      slug: "new-study",
      primary_language: "Go",
      editorial_content: "",
      architectural_narrative: "",
      tags: "",
      github_url: "https://example.test/repo",
    });

    expect(created.github_url).toBe("https://example.test/repo");
  });

  it("updateCaseStudyImage updates an existing row", async () => {
    const { CaseStudyService } = await load();
    m.prisma.caseStudy.findUnique.mockResolvedValueOnce(dbRow());
    m.prisma.caseStudy.update.mockResolvedValueOnce(
      dbRow({ hero_image_url: "/img.png" })
    );

    const result = await CaseStudyService.updateCaseStudyImage(
      "db-only-study",
      "/img.png"
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        hero_image_url: "/img.png",
        github_url: "https://example.test/db-only",
      });
      expect(result.data.commands_json).toBeUndefined();
    }
  });

  it("updateCaseStudyImage materialises a static case study into Postgres", async () => {
    const { CaseStudyService } = await load();
    m.prisma.caseStudy.findUnique.mockResolvedValueOnce(null);
    m.prisma.caseStudy.create.mockImplementationOnce(async ({ data }) =>
      dbRow({ ...data, github_url: null, hero_image_url: null })
    );

    const result = await CaseStudyService.updateCaseStudyImage(
      KNOWN.slug,
      null
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        slug: KNOWN.slug,
        github_url: KNOWN.github_url,
        commands_json: KNOWN.commands_json,
        playback_json: KNOWN.playback_json,
        hero_image_url: null,
      });
    }
  });

  it("updateCaseStudyImage reports an unknown slug as not found", async () => {
    const { CaseStudyService } = await load();
    m.prisma.caseStudy.findUnique.mockResolvedValueOnce(null);

    const result = await CaseStudyService.updateCaseStudyImage("nope", null);

    expect(result).toMatchObject({
      success: false,
      error: { code: "CASE_STUDY_NOT_FOUND" },
    });
  });

  it("updateCaseStudyImage reports Neon down as a recoverable persistence failure", async () => {
    const { CaseStudyService } = await load();
    m.prisma.caseStudy.findUnique.mockRejectedValueOnce(neonDown());

    const result = await CaseStudyService.updateCaseStudyImage(
      KNOWN.slug,
      null
    );

    expect(result).toMatchObject({
      success: false,
      error: { code: "PERSISTENCE_FAILED", recoverable: true },
    });
  });
});

describe("flushBufferedReactionsToDatabase with Redis up/down", () => {
  const event = (id: string, slug = "s", reactionType = "insightful") => ({
    id,
    caseStudySlug: slug,
    reactionType,
    connectionHash: "h",
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  it("is a no-op when Redis is not configured", async () => {
    const { CaseStudyService } = await load();
    m.redisConfigured.value = false;

    const result = await CaseStudyService.flushBufferedReactionsToDatabase();

    expect(result).toEqual({
      success: true,
      data: { processed: 0, inserted: 0 },
    });
    expect(m.redis.lrange).not.toHaveBeenCalled();
  });

  it("reports FLUSH_FAILED when Redis is down", async () => {
    const { CaseStudyService } = await load("production-runtime");
    m.redis.lrange.mockRejectedValueOnce(redisDown());

    const result = await CaseStudyService.flushBufferedReactionsToDatabase();

    expect(result).toMatchObject({
      success: false,
      error: { code: "FLUSH_FAILED" },
    });
    expect(m.logger.warn).toHaveBeenCalled();
  });

  it("an empty queue is success, not a failure", async () => {
    const { CaseStudyService } = await load();
    m.redis.lrange.mockResolvedValueOnce(null);
    m.redis.llen.mockResolvedValueOnce(0);

    const result = await CaseStudyService.flushBufferedReactionsToDatabase();

    expect(result).toEqual({
      success: true,
      data: { processed: 0, inserted: 0 },
    });
    expect(m.prisma.caseStudyReaction.createMany).not.toHaveBeenCalled();
  });

  it("leaves events in the processing queue when Neon is down", async () => {
    const { CaseStudyService } = await load();
    m.redis.lrange.mockResolvedValueOnce([event("e1")]);
    m.redis.llen.mockResolvedValueOnce(0);
    m.prisma.caseStudyReaction.createMany.mockRejectedValueOnce(neonDown());

    const result = await CaseStudyService.flushBufferedReactionsToDatabase();

    expect(result).toMatchObject({
      success: false,
      error: { code: "PERSISTENCE_FAILED" },
    });
    expect(m.pipe.lrem).not.toHaveBeenCalled();
  });

  it("skips topping up when the processing backlog already fills the batch", async () => {
    const { CaseStudyService } = await load();
    m.redis.lrange.mockResolvedValueOnce([event("e1"), event("e2")]);
    m.prisma.caseStudyReaction.createMany.mockResolvedValueOnce({ count: 2 });
    m.redis.hgetall.mockResolvedValueOnce(null);

    const result = await CaseStudyService.flushBufferedReactionsToDatabase(2);

    expect(m.redis.llen).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      data: { processed: 2, inserted: 2 },
    });
  });

  it("keeps the dirty flag while a positive buffer remains, and tolerates cleanup errors", async () => {
    const { CaseStudyService } = await load();
    m.redis.lrange.mockResolvedValueOnce([]);
    m.redis.llen.mockResolvedValueOnce(2);
    m.pipe.exec
      .mockResolvedValueOnce([event("e1", "a"), null, "OK"])
      .mockResolvedValueOnce([]);
    m.prisma.caseStudyReaction.createMany.mockResolvedValueOnce({ count: 1 });
    m.redis.hgetall.mockResolvedValueOnce({ insightful: "0", thorough: "3" });
    m.redis.hdel.mockRejectedValueOnce(redisDown());

    const result = await CaseStudyService.flushBufferedReactionsToDatabase();

    expect(result).toEqual({
      success: true,
      data: { processed: 1, inserted: 1 },
    });
    expect(m.redis.srem).not.toHaveBeenCalled();
  });

  it("clears the buffer and dirty flag when the remaining buffer read fails", async () => {
    const { CaseStudyService } = await load();
    m.redis.lrange.mockResolvedValueOnce([event("e1", "b")]);
    m.redis.llen.mockResolvedValueOnce(0);
    m.prisma.caseStudyReaction.createMany.mockResolvedValueOnce({ count: 1 });
    m.redis.hgetall.mockRejectedValueOnce(redisDown());
    m.redis.del.mockRejectedValueOnce(redisDown());
    m.redis.srem.mockRejectedValueOnce(redisDown());

    const result = await CaseStudyService.flushBufferedReactionsToDatabase();

    expect(result).toEqual({
      success: true,
      data: { processed: 1, inserted: 1 },
    });
    expect(m.redis.srem).toHaveBeenCalledTimes(1);
  });
});
