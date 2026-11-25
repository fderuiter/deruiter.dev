// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { IDBFactory } from "fake-indexeddb";
import {
  createOfflineDispatcher,
  offlineRetryDelay,
  openOfflineQueueStore,
  type OfflineQueueStore,
  type OfflineSendOutcome,
} from "@/lib/offline-queue";
import { FALLBACK_BLOG_POSTS } from "@/lib/fallback-blog-posts";
import { ALLOWED_REACTIONS } from "@/lib/schemas";
import { POST as postFeedback } from "@/app/api/case-studies/feedback/route";
import { POST as postCaseStudyReaction } from "@/app/api/case-studies/reactions/route";
import { POST as postBlogReaction } from "@/app/api/blog/reactions/route";

let storageHealthy = false;
const persistedFeedback: Array<{ id: string; caseStudySlug: string }> = [];
const persistedCsReactions: Array<{
  caseStudySlug: string;
  reactionType: string;
}> = [];
const persistedBlogReactions: Array<{
  blogPostSlug: string;
  reactionType: string;
}> = [];

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => "OK"),
    del: vi.fn(async () => 0),
    hgetall: vi.fn(async () => null),
    smembers: vi.fn(async () => []),
    sismember: vi.fn(async () => 0),
    pipeline: vi.fn(() => ({
      sadd: () => undefined,
      expire: () => undefined,
      hincrby: () => undefined,
      rpush: () => undefined,
      exec: async () => [],
    })),
  },
  getScopedRedisKey: (key: string) => `test:${key}`,
  isRedisConfigured: () => false,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({
    success: true,
    limit: 10,
    remaining: 9,
    reset: Date.now() + 60_000,
  })),
  getRateLimitHeaders: () => ({}),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    caseStudyFeedback: {
      findFirst: vi.fn(async () => {
        if (!storageHealthy) {
          throw new Error("Neon compute endpoint unreachable");
        }
        return null;
      }),
      create: vi.fn(async ({ data }: { data: { caseStudySlug: string } }) => {
        if (!storageHealthy) {
          throw new Error("Neon compute endpoint unreachable");
        }
        const row = {
          id: `fb-${persistedFeedback.length + 1}`,
          caseStudySlug: data.caseStudySlug,
          comments: "Great trade-offs",
          createdAt: new Date("2026-01-01T00:00:00Z"),
        };
        persistedFeedback.push({
          id: row.id,
          caseStudySlug: row.caseStudySlug,
        });
        return row;
      }),
    },
    caseStudyReaction: {
      createMany: vi.fn(
        async ({
          data,
        }: {
          data: Array<{ caseStudySlug: string; reactionType: string }>;
        }) => {
          if (!storageHealthy) {
            throw new Error("Neon compute endpoint unreachable");
          }
          persistedCsReactions.push(...data);
          return { count: data.length };
        }
      ),
      groupBy: vi.fn(async () => {
        if (!storageHealthy) {
          throw new Error("Neon compute endpoint unreachable");
        }
        return [{ reactionType: "insightful", _count: { id: 1 } }];
      }),
      findMany: vi.fn(async () => {
        if (!storageHealthy) {
          throw new Error("Neon compute endpoint unreachable");
        }
        return [{ reactionType: "insightful" }];
      }),
    },
    blogPost: {
      findUnique: vi.fn(async () => null),
    },
    blogPostReaction: {
      findFirst: vi.fn(async () => {
        if (!storageHealthy) {
          throw new Error("Neon compute endpoint unreachable");
        }
        return null;
      }),
      create: vi.fn(
        async ({
          data,
        }: {
          data: { blogPostSlug: string; reactionType: string };
        }) => {
          if (!storageHealthy) {
            throw new Error("Neon compute endpoint unreachable");
          }
          persistedBlogReactions.push(data);
          return { id: "br-1" };
        }
      ),
      groupBy: vi.fn(async () => [
        { reactionType: ALLOWED_REACTIONS[0], _count: { id: 1 } },
      ]),
      findMany: vi.fn(async () => [{ reactionType: ALLOWED_REACTIONS[0] }]),
    },
  },
}));

describe("Offline Queue HTTP 503 Storage Outage Retention (ADR 0043)", () => {
  let factory: IDBFactory;
  let store: OfflineQueueStore | null = null;
  const publishedBlogSlug =
    FALLBACK_BLOG_POSTS.find((p) => p.published)?.slug ?? "first-post";

  beforeEach(() => {
    storageHealthy = false;
    persistedFeedback.length = 0;
    persistedCsReactions.length = 0;
    persistedBlogReactions.length = 0;
    factory = new IDBFactory();
  });

  afterEach(() => {
    store?.close();
    store = null;
  });

  async function dispatchToRoute(
    endpoint: string,
    body: unknown
  ): Promise<Response> {
    const req = new NextRequest(`http://localhost:3000${endpoint}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.42",
      },
      body: JSON.stringify(body),
    });

    if (endpoint === "/api/case-studies/feedback") {
      return postFeedback(req, { params: Promise.resolve({}) });
    }
    if (endpoint === "/api/case-studies/reactions") {
      return postCaseStudyReaction(req, { params: Promise.resolve({}) });
    }
    if (endpoint === "/api/blog/reactions") {
      return postBlogReaction(req, { params: Promise.resolve({}) });
    }
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  }

  it("returns HTTP 503 across feedback and reaction routes during storage outage and retains IndexedDB queue entries until recovery", async () => {
    const opened = await openOfflineQueueStore({ indexedDB: factory });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    store = opened.store;

    let clock = 1_700_000_000_000;

    await store.enqueue(
      {
        id: "q-feedback",
        type: "feedback",
        endpoint: "/api/case-studies/feedback",
        body: {
          caseStudySlug: "crf",
          takeaways: ["vertical-slices"],
          comments: "No silent data loss on 503",
        },
      },
      clock
    );
    await store.enqueue(
      {
        id: "q-cs-reaction",
        type: "reaction",
        endpoint: "/api/case-studies/reactions",
        body: {
          caseStudySlug: "crf",
          reactionType: "insightful",
        },
      },
      clock + 1
    );
    await store.enqueue(
      {
        id: "q-blog-reaction",
        type: "reaction",
        endpoint: "/api/blog/reactions",
        body: {
          blogPostSlug: publishedBlogSlug,
          reactionType: ALLOWED_REACTIONS[0],
        },
      },
      clock + 2
    );

    const observedStatuses: number[] = [];

    const dispatcher = createOfflineDispatcher({
      store,
      now: () => clock,
      setTimer: () => 0,
      clearTimer: () => undefined,
      isOnline: () => true,
      send: async (entry): Promise<OfflineSendOutcome> => {
        const res = await dispatchToRoute(entry.endpoint, entry.body);
        observedStatuses.push(res.status);
        if (res.ok) return { kind: "ok" };
        if (
          res.status >= 400 &&
          res.status < 500 &&
          res.status !== 408 &&
          res.status !== 429
        ) {
          return {
            kind: "permanent",
            status: res.status,
            reason: `HTTP ${res.status}`,
          };
        }
        return {
          kind: "transient",
          status: res.status,
          reason: `HTTP ${res.status}`,
        };
      },
    });

    clock += 10;
    // Dispatcher halts on the first transient 503 to avoid hammering an unhealthy backend;
    // three passes exercise all three queued endpoints (feedback, CS reaction, blog reaction)
    // while keeping the earlier entries backed off until offlineRetryDelay(1).
    const pass1 = await dispatcher.flush();
    const pass2 = await dispatcher.flush();
    const pass3 = await dispatcher.flush();
    expect(pass1).toEqual({ processed: 0, failed: 1 });
    expect(pass2).toEqual({ processed: 0, failed: 1 });
    expect(pass3).toEqual({ processed: 0, failed: 1 });
    expect(observedStatuses).toEqual([503, 503, 503]);

    const retainedAfterOutage = await store.list();
    expect(retainedAfterOutage).toHaveLength(3);
    expect(retainedAfterOutage.map((e) => e.retries)).toEqual([1, 1, 1]);
    expect(await store.deadLetters()).toHaveLength(0);

    // Recover storage and advance simulated clock past exponential retry backoff
    storageHealthy = true;
    observedStatuses.length = 0;
    clock += offlineRetryDelay(1) + 1_000;

    const recoveryFlush = await dispatcher.flush();
    expect(recoveryFlush).toEqual({ processed: 3, failed: 0 });
    expect(observedStatuses).toEqual([201, 200, 200]);

    expect(await store.list()).toHaveLength(0);
    expect(await store.deadLetters()).toHaveLength(0);
    expect(persistedFeedback).toHaveLength(1);
    expect(persistedCsReactions).toHaveLength(1);
    expect(persistedBlogReactions).toHaveLength(1);

    dispatcher.dispose();
  });
});
