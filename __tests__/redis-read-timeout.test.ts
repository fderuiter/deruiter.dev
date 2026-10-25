// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { RedisTimeoutError, withRedisTimeout } from "@/lib/redis-timeout";

/**
 * A Redis read that outlives its budget is a cache miss (#2850): the read path
 * falls through to the database and logs a warning that stays out of Sentry.
 * Any other Redis failure keeps its telemetry.
 */

const m = vi.hoisted(() => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    hgetall: vi.fn(),
    smembers: vi.fn(),
  },
  prisma: {
    blogPost: { findUnique: vi.fn() },
    caseStudy: { findUnique: vi.fn() },
  },
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: m.prisma }));
vi.mock("@/lib/logger", () => ({ logger: m.logger }));
vi.mock("@/lib/redis", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/redis")>();
  return { ...actual, isRedisConfigured: () => true, redis: m.redis };
});
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

// Services load on a fresh module graph, so match the error by name.
const timedOut = expect.objectContaining({ name: "RedisTimeoutError" });

const never = () => new Promise<never>(() => {});

const blogRow = {
  id: "blog-1",
  slug: "cold-cache-post",
  title: "Cold Cache Post",
  dek: "A post served from the database.",
  body: "<p>Body</p>",
  pillar: "formal-verification",
  tags: "redis",
  published: true,
  reading_time_minutes: 3,
  hero_image_url: null,
  created_at: new Date("2026-01-01T00:00:00Z"),
  updated_at: new Date("2026-01-01T00:00:00Z"),
};

async function loadProductionRuntime() {
  vi.resetModules();
  vi.stubEnv("PLAYWRIGHT_TEST", "");
  vi.stubEnv("NEXT_PHASE", "");
  vi.stubEnv("VERCEL_ENV", "production");
  return {
    BlogPostService: (await import("@/lib/services/blog-service"))
      .BlogPostService,
    CaseStudyService: (await import("@/lib/services/case-study-service"))
      .CaseStudyService,
  };
}

describe("withRedisTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the command's value and clears its timer", async () => {
    vi.useFakeTimers();
    await expect(withRedisTimeout(Promise.resolve(7), 1500, "x")).resolves.toBe(
      7
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects with a RedisTimeoutError once the budget runs out", async () => {
    vi.useFakeTimers();
    const pending = withRedisTimeout(never(), 1500, "Redis cache read timeout");
    const assertion = expect(pending).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof RedisTimeoutError &&
        err.message === "Redis cache read timeout"
    );
    await vi.advanceTimersByTimeAsync(1500);
    await assertion;
  });
});

describe("Redis read timeouts on the public read paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("serves a blog post from the database and keeps the timeout out of Sentry", async () => {
    const { BlogPostService } = await loadProductionRuntime();
    m.redis.get.mockReturnValueOnce(never());
    m.prisma.blogPost.findUnique.mockResolvedValueOnce(blogRow);
    m.redis.set.mockResolvedValue("OK");

    const pending = BlogPostService.getBlogPostBySlug(blogRow.slug);
    await vi.advanceTimersByTimeAsync(1500);
    const post = await pending;

    expect(post?.slug).toBe(blogRow.slug);
    expect(m.prisma.blogPost.findUnique).toHaveBeenCalled();
    expect(m.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Redis cache read failed"),
      timedOut,
      { skipTelemetry: true }
    );
  });

  it("still reports a blog cache read that fails for another reason", async () => {
    const { BlogPostService } = await loadProductionRuntime();
    m.redis.get.mockRejectedValueOnce(new Error("Upstash unreachable"));
    m.prisma.blogPost.findUnique.mockResolvedValueOnce(blogRow);
    m.redis.set.mockResolvedValue("OK");

    await BlogPostService.getBlogPostBySlug(blogRow.slug);

    expect(m.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Redis cache read failed"),
      expect.any(Error)
    );
  });

  it("returns default reaction counts and keeps the timeout out of Sentry", async () => {
    const { BlogPostService } = await loadProductionRuntime();
    m.redis.get.mockResolvedValueOnce(null);
    m.redis.hgetall.mockReturnValueOnce(never());
    m.redis.smembers.mockReturnValueOnce(never());

    const pending = BlogPostService.getReactions(blogRow.slug, "visitor");
    await vi.advanceTimersByTimeAsync(1500);
    const result = await pending;

    expect(result.success).toBe(true);
    expect(m.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("getReactions: Redis path failed"),
      timedOut,
      { skipTelemetry: true }
    );
  });

  it("serves a case study past a timed-out cache read and keeps it out of Sentry", async () => {
    const { CaseStudyService } = await loadProductionRuntime();
    const known = FALLBACK_CASE_STUDIES[0];
    m.redis.get.mockReturnValueOnce(never());
    m.prisma.caseStudy.findUnique.mockResolvedValueOnce(null);

    const pending = CaseStudyService.getCaseStudyBySlug(known.slug);
    await vi.advanceTimersByTimeAsync(1500);
    const study = await pending;

    expect(study?.slug).toBe(known.slug);
    expect(m.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Redis cache read failed"),
      timedOut,
      { skipTelemetry: true }
    );
  });
});
