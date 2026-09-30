import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * These tests drive the real sync routine against an in-memory Redis that
 * reproduces Upstash's own wire behaviour: every command argument goes through
 * the same `defaultSerializer` (`JSON.stringify` for anything that is not a
 * string, number or boolean) and list reads are parsed back.
 *
 * The per-event acknowledgement in `syncBufferedEvents` depends on `LREM`
 * matching the exact stored string that `LPUSH` wrote. A mock that only records
 * calls cannot catch a serialization mismatch there -- it would report success
 * while the real queue grew without bound. This harness asserts the queue's
 * resulting contents instead.
 */
const { fake, mockCreateMany } = vi.hoisted(() => {
  function serialize(value: unknown): string {
    switch (typeof value) {
      case "string":
      case "number":
      case "boolean":
        return String(value);
      default:
        return JSON.stringify(value);
    }
  }

  function deserialize(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  class FakeUpstashRedis {
    lists = new Map<string, string[]>();

    private list(key: string): string[] {
      if (!this.lists.has(key)) this.lists.set(key, []);
      return this.lists.get(key)!;
    }

    lpush(key: string, ...values: unknown[]) {
      // Redis pushes each value to the head in turn, so the last argument ends
      // up leftmost and the oldest entry sits at the right -- which is the end
      // the sync job drains from.
      const arr = this.list(key);
      for (const value of values) arr.unshift(serialize(value));
      return arr.length;
    }

    lrange(key: string, start: number, stop: number) {
      const arr = this.list(key);
      const end = stop === -1 ? arr.length : stop + 1;
      return arr.slice(start, end).map(deserialize);
    }

    lmove(source: string, destination: string, from: string, to: string) {
      const src = this.list(source);
      if (src.length === 0) return null;
      const raw = from === "right" ? src.pop()! : src.shift()!;
      const dst = this.list(destination);
      if (to === "left") dst.unshift(raw);
      else dst.push(raw);
      return deserialize(raw);
    }

    lrem(key: string, count: number, value: unknown) {
      const target = serialize(value);
      const arr = this.list(key);
      let removed = 0;
      for (let i = 0; i < arr.length && removed < count;) {
        if (arr[i] === target) {
          arr.splice(i, 1);
          removed++;
        } else {
          i++;
        }
      }
      return removed;
    }

    del(key: string) {
      const existed = this.lists.delete(key);
      return existed ? 1 : 0;
    }

    expire() {
      return 1;
    }

    pipeline() {
      const queued: Array<() => unknown> = [];
      const chain = {
        lpush: (...a: [string, ...unknown[]]) => {
          queued.push(() => this.lpush(...a));
          return chain;
        },
        lmove: (...a: [string, string, string, string]) => {
          queued.push(() => this.lmove(...a));
          return chain;
        },
        lrem: (...a: [string, number, unknown]) => {
          queued.push(() => this.lrem(...a));
          return chain;
        },
        expire: () => {
          queued.push(() => this.expire());
          return chain;
        },
        exec: async () => queued.map((op) => op()),
      };
      return chain;
    }
  }

  return { fake: new FakeUpstashRedis(), mockCreateMany: vi.fn() };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    telemetryEvent: {
      createMany: (...args: unknown[]) => mockCreateMany(...args),
      groupBy: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor() {
      return fake;
    }
  },
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn();
    limit = vi.fn();
  },
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { TelemetryService } from "@/lib/services/telemetry-service";

const BUFFER = "telemetry_buffer";
const PROCESSING = "telemetry_processing";

function event(id: string) {
  return {
    id,
    projectSlug: `/p-${id}`,
    eventType: "page_view",
    createdAt: new Date("2026-09-12T12:00:00.000Z"),
  };
}

describe("Telemetry queue acknowledgement against Upstash serialization (#695)", () => {
  beforeEach(() => {
    fake.lists.clear();
    mockCreateMany.mockReset();
    mockCreateMany.mockImplementation(async ({ data }) => ({
      count: data.length,
    }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("actually removes the acknowledged events from the processing queue", async () => {
    fake.lpush(BUFFER, event("a"), event("b"));

    const result = await TelemetryService.syncBufferedEvents(10);

    expect(result).toEqual({
      success: true,
      data: { processed: 2, inserted: 2 },
    });
    // The decisive assertion: LREM matched the stored strings, so both keys are
    // drained. A serialization mismatch would leave the processing queue full.
    expect(fake.lists.get(PROCESSING) ?? []).toEqual([]);
    expect(fake.lists.get(BUFFER) ?? []).toEqual([]);
  });

  it("preserves events a concurrent worker moved in while this batch was being written", async () => {
    fake.lpush(BUFFER, event("a"), event("b"), event("late"));

    // Worker B moves one more event across while worker A's database write is
    // still in flight -- exactly the window the old whole-queue DEL destroyed.
    let released!: () => void;
    const dbWrite = new Promise<void>((resolve) => {
      released = resolve;
    });
    mockCreateMany.mockImplementationOnce(async ({ data }) => {
      await dbWrite;
      return { count: data.length };
    });

    const workerA = TelemetryService.syncBufferedEvents(2);
    await Promise.resolve();
    fake.lmove(BUFFER, PROCESSING, "right", "left");
    released();

    const result = await workerA;
    expect(result.success && result.data.processed).toBe(2);

    // The late event must still be queued, and must be the only thing left.
    const remaining = (fake.lists.get(PROCESSING) ?? []).map((raw) =>
      JSON.parse(raw)
    );
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("late");
  });

  it("leaves the whole batch queued when the database write fails", async () => {
    fake.lpush(BUFFER, event("a"), event("b"));
    mockCreateMany.mockRejectedValueOnce(new Error("connection terminated"));

    await expect(
      TelemetryService.syncBufferedEvents(10)
    ).resolves.toMatchObject({
      success: false,
      error: { code: "PERSISTENCE_FAILED" },
    });

    expect(fake.lists.get(PROCESSING) ?? []).toHaveLength(2);
  });

  it("drains a batch left behind by a previous failed run without duplicating it", async () => {
    fake.lpush(BUFFER, event("a"));
    mockCreateMany.mockRejectedValueOnce(new Error("connection terminated"));
    await expect(
      TelemetryService.syncBufferedEvents(10)
    ).resolves.toMatchObject({ success: false });

    const recovered = await TelemetryService.syncBufferedEvents(10);

    expect(recovered).toEqual({
      success: true,
      data: { processed: 1, inserted: 1 },
    });
    expect(fake.lists.get(PROCESSING) ?? []).toEqual([]);
  });

  it("round trips an event recorded through the public API", async () => {
    await TelemetryService.recordEvent({
      projectSlug: "/dashboard",
      eventType: "page_view",
    });

    const result = await TelemetryService.syncBufferedEvents(10);

    expect(result.success && result.data.processed).toBe(1);
    expect(fake.lists.get(PROCESSING) ?? []).toEqual([]);
  });
});
