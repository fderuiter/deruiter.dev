// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  OFFLINE_LEASE_MARGIN_MS,
  OFFLINE_MAX_RETRY_DELAY_MS,
  OFFLINE_REQUEST_TIMEOUT_MS,
  createOfflineDispatcher,
  offlineRetryDelay,
  openOfflineQueueStore,
  type OfflineDispatcher,
  type OfflineDispatcherOptions,
  type OfflineQueueEntry,
  type OfflineQueueStore,
  type OfflineSendOutcome,
} from "@/lib/offline-queue";

/**
 * Claims, leases, deadlines and recovery in the offline queue (#3807,
 * slice 2). Each test gets a fresh in-memory IndexedDB; two stores on one
 * factory stand in for two tabs. The wall clock and the dispatcher's timers
 * are manual, so every deadline and lease is deterministic.
 */

const LEASE_MS = OFFLINE_REQUEST_TIMEOUT_MS + OFFLINE_LEASE_MARGIN_MS;
const CLAIM = { leaseMs: LEASE_MS, maxDelayMs: OFFLINE_MAX_RETRY_DELAY_MS };

let factory: IDBFactory;
let clock: number;
const opened: OfflineQueueStore[] = [];
const dispatchers: OfflineDispatcher[] = [];

interface Timer {
  at: number;
  run: () => void;
}
const timers = new Set<Timer>();

const timerOptions = {
  now: () => clock,
  setTimer: (run: () => void, ms: number) => {
    const timer = { at: clock + ms, run };
    timers.add(timer);
    return timer;
  },
  clearTimer: (handle: unknown) => {
    timers.delete(handle as Timer);
  },
};

/** Moves the clock and fires the timers that fall due, in time order. */
function advance(ms: number) {
  clock += ms;
  const due = [...timers]
    .filter((t) => t.at <= clock)
    .sort((a, b) => a.at - b.at);
  for (const timer of due) {
    timers.delete(timer);
    timer.run();
  }
}

async function open(): Promise<OfflineQueueStore> {
  const result = await openOfflineQueueStore({ indexedDB: factory });
  if (!result.ok) throw new Error(result.code);
  opened.push(result.store);
  return result.store;
}

function dispatcher(
  store: OfflineQueueStore,
  send: OfflineDispatcherOptions["send"],
  extra: Partial<OfflineDispatcherOptions> = {}
): OfflineDispatcher {
  const d = createOfflineDispatcher({ store, send, ...timerOptions, ...extra });
  dispatchers.push(d);
  return d;
}

const input = (id: string, body: unknown = { id }) => ({
  id,
  type: "reaction",
  endpoint: "/api/case-studies/reactions",
  body,
});

const ok = async (): Promise<OfflineSendOutcome> => ({ kind: "ok" });
const transient = async (): Promise<OfflineSendOutcome> => ({
  kind: "transient",
  status: 503,
  reason: "Service unavailable",
});

/** A send whose responses the test releases by hand. */
function gatedSend() {
  const calls: {
    entry: OfflineQueueEntry;
    signal: AbortSignal | undefined;
    respond: (outcome: OfflineSendOutcome) => void;
  }[] = [];
  const send: OfflineDispatcherOptions["send"] = (entry, signal) =>
    new Promise((resolve) => {
      calls.push({ entry, signal, respond: resolve });
    });
  return { calls, send };
}

/** Waits until `check` passes, letting IndexedDB callbacks run. */
async function until(check: () => boolean) {
  for (let i = 0; i < 200 && !check(); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  expect(check()).toBe(true);
}

beforeEach(() => {
  factory = new IDBFactory();
  clock = 1_000_000;
  timers.clear();
});

afterEach(() => {
  for (const d of dispatchers.splice(0)) d.dispose();
  for (const store of opened.splice(0)) store.close();
});

describe("claims", () => {
  it("lets only one of two contexts claim an entry", async () => {
    const tabA = await open();
    const tabB = await open();
    await tabA.enqueue(input("a"), clock);
    const [first, second] = await Promise.all([
      tabA.claimNext("owner-a", clock, CLAIM),
      tabB.claimNext("owner-b", clock, CLAIM),
    ]);
    const claimed = [first.entry, second.entry].filter(Boolean);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.claim?.leaseUntil).toBe(clock + LEASE_MS);
  });

  it("gives two contexts different entries and keeps send order", async () => {
    const tabA = await open();
    const tabB = await open();
    await tabA.enqueue(input("a"), clock);
    await tabA.enqueue(input("b"), clock);
    const first = await tabA.claimNext("owner-a", clock, CLAIM);
    const second = await tabB.claimNext("owner-b", clock, CLAIM);
    expect([first.entry?.id, second.entry?.id]).toEqual(["a", "b"]);
    const none = await tabB.claimNext("owner-b", clock, CLAIM);
    expect(none.entry).toBeNull();
    expect(none.nextWakeAt).toBe(clock + LEASE_MS);
  });

  it("does not claim an entry before its deadline and reports the wake", async () => {
    const store = await open();
    await store.enqueue(input("a"), clock);
    await store.recordRetry({ id: "a", revision: 0 }, 1, clock + 4_000);
    const early = await store.claimNext("owner", clock + 3_999, CLAIM);
    expect(early).toEqual({ entry: null, nextWakeAt: clock + 4_000 });
    const due = await store.claimNext("owner", clock + 4_000, CLAIM);
    expect(due.entry?.id).toBe("a");
  });

  it("settles only for the owner that holds the claim", async () => {
    const tabA = await open();
    const tabB = await open();
    await tabA.enqueue(input("a"), clock);
    await tabA.claimNext("owner-a", clock, CLAIM);
    // Owner A freezes; its lease runs out and B takes over.
    const takeover = await tabB.claimNext("owner-b", clock + LEASE_MS, CLAIM);
    expect(takeover.entry?.claim?.ownerToken).toBe("owner-b");
    // A's late response changes nothing.
    expect(
      await tabA.acknowledge({ id: "a", revision: 0, ownerToken: "owner-a" })
    ).toBe(false);
    expect(
      await tabA.recordRetry(
        { id: "a", revision: 0, ownerToken: "owner-a" },
        1,
        clock + 2_000
      )
    ).toBe(false);
    expect(
      await tabA.moveToDeadLetters(
        { id: "a", revision: 0, ownerToken: "owner-a" },
        { statusCode: 400, failureReason: "late", failedAt: clock }
      )
    ).toBe(false);
    expect(await tabA.list()).toHaveLength(1);
    expect(
      await tabB.acknowledge({ id: "a", revision: 0, ownerToken: "owner-b" })
    ).toBe(true);
    expect(await tabA.list()).toEqual([]);
  });

  it("releases the claim when it records a retry", async () => {
    const store = await open();
    await store.enqueue(input("a"), clock);
    await store.claimNext("owner", clock, CLAIM);
    await store.recordRetry(
      { id: "a", revision: 0, ownerToken: "owner" },
      1,
      clock + 2_000
    );
    expect((await store.list())[0].claim).toBeUndefined();
  });
});

describe("clock changes", () => {
  it("treats a deadline beyond the longest delay as passed after the clock moves back", async () => {
    const store = await open();
    await store.enqueue(input("a"), clock);
    await store.recordRetry({ id: "a", revision: 0 }, 1, clock + 8_000);
    // The clock moves back an hour: the deadline is now far ahead.
    const back = clock - 3_600_000;
    const result = await store.claimNext("owner", back, CLAIM);
    expect(result.entry?.id).toBe("a");
  });

  it("treats a lease beyond its length as expired after the clock moves back", async () => {
    const store = await open();
    await store.enqueue(input("a"), clock);
    await store.claimNext("frozen", clock, CLAIM);
    const back = clock - 3_600_000;
    const result = await store.claimNext("owner", back, CLAIM);
    expect(result.entry?.claim?.ownerToken).toBe("owner");
  });

  it("sends at once when the clock jumps forward past a deadline", async () => {
    const store = await open();
    const send = vi.fn(ok);
    await store.enqueue(input("a"), clock);
    await store.recordRetry({ id: "a", revision: 0 }, 1, clock + 8_000);
    clock += 86_400_000;
    await dispatcher(store, send).flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(await store.list()).toEqual([]);
  });

  it("never sleeps longer than one lease, whatever the deadline", async () => {
    const store = await open();
    await store.enqueue(input("a"), clock);
    await store.recordRetry(
      { id: "a", revision: 0 },
      4,
      clock + OFFLINE_MAX_RETRY_DELAY_MS
    );
    await dispatcher(store, ok).flush();
    const [wake] = [...timers];
    expect(wake.at - clock).toBe(LEASE_MS);
    expect(LEASE_MS).toBeLessThan(OFFLINE_MAX_RETRY_DELAY_MS);
  });
});

describe("dispatcher", () => {
  it("sends every due entry in order and acknowledges each", async () => {
    const store = await open();
    const send = vi.fn(async (_entry: OfflineQueueEntry) => ok());
    await store.enqueue(input("a"), clock);
    await store.enqueue(input("b"), clock);
    expect(await dispatcher(store, send).flush()).toEqual({
      processed: 2,
      failed: 0,
    });
    expect(send.mock.calls.map(([entry]) => entry.id)).toEqual(["a", "b"]);
    expect(await store.list()).toEqual([]);
  });

  it("persists the retry deadline and wakes for it", async () => {
    const store = await open();
    let outcome = transient;
    const send = vi.fn(() => outcome());
    await store.enqueue(input("a"), clock);
    const d = dispatcher(store, send);
    expect(await d.flush()).toEqual({ processed: 0, failed: 1 });
    const stored = (await store.list())[0];
    expect(stored).toMatchObject({
      retries: 1,
      nextAttemptAt: clock + offlineRetryDelay(1),
    });
    expect(stored.claim).toBeUndefined();

    // A flush before the deadline (an enqueue, an online event) sends nothing.
    advance(offlineRetryDelay(1) - 1);
    await d.flush();
    expect(send).toHaveBeenCalledTimes(1);

    outcome = ok;
    advance(1);
    await until(() => send.mock.calls.length === 2 && !d.isFlushing());
    expect(await store.list()).toEqual([]);
  });

  it("keeps the deadline across a restart", async () => {
    const before = await open();
    await before.enqueue(input("a"), clock);
    await dispatcher(before, transient).flush();
    before.close();

    const after = await open();
    const send = vi.fn(ok);
    const d = dispatcher(after, send);
    await d.flush();
    expect(send).not.toHaveBeenCalled();
    clock += offlineRetryDelay(1);
    await d.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("recovers an entry from a frozen owner once its lease passes", async () => {
    const tabA = await open();
    const tabB = await open();
    await tabA.enqueue(input("a"), clock);
    const frozen = gatedSend();
    void dispatcher(tabA, frozen.send).flush();
    await until(() => frozen.calls.length === 1);

    const send = vi.fn(ok);
    const other = dispatcher(tabB, send);
    await other.flush();
    expect(send).not.toHaveBeenCalled();

    clock += LEASE_MS;
    await other.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(await tabB.list()).toEqual([]);

    // The frozen owner's late failure changes nothing.
    frozen.calls[0].respond({ kind: "permanent", status: 400, reason: "x" });
    await until(() => true);
    expect(await tabB.deadLetters()).toEqual([]);
  });

  it("counts a request that runs past the timeout as a failed attempt", async () => {
    const store = await open();
    const gate = gatedSend();
    await store.enqueue(input("a"), clock);
    const flushing = dispatcher(store, gate.send).flush();
    await until(() => gate.calls.length === 1);
    advance(OFFLINE_REQUEST_TIMEOUT_MS);
    expect(await flushing).toEqual({ processed: 0, failed: 1 });
    expect(gate.calls[0].signal?.aborted).toBe(true);
    expect((await store.list())[0]).toMatchObject({ retries: 1 });
  });

  it("keeps a replacement made while the old revision is in flight", async () => {
    const store = await open();
    const gate = gatedSend();
    await store.enqueue(input("a", { v: 1 }), clock);
    const d = dispatcher(store, gate.send);
    const flushing = d.flush();
    await until(() => gate.calls.length === 1);
    await store.enqueue(input("a", { v: 2 }), clock);
    gate.calls[0].respond({ kind: "ok" });
    await until(() => gate.calls.length === 2);
    expect(gate.calls[1].entry).toMatchObject({ revision: 1, body: { v: 2 } });
    gate.calls[1].respond({ kind: "ok" });
    await flushing;
    expect(await store.list()).toEqual([]);
  });

  it("dead-letters a permanent failure and an exhausted retry", async () => {
    const store = await open();
    const onDeadLetter = vi.fn();
    await store.enqueue(input("bad"), clock);
    await store.enqueue({ ...input("tired"), maxRetries: 1 }, clock);
    const send = vi.fn(async (entry: OfflineQueueEntry) =>
      entry.id === "bad"
        ? ({ kind: "permanent", status: 422, reason: "Invalid" } as const)
        : ({ kind: "transient", status: 0, reason: "Network error" } as const)
    );
    await dispatcher(store, send, { onDeadLetter }).flush();
    expect(
      (await store.deadLetters()).map((d) => [d.id, d.statusCode])
    ).toEqual([
      ["bad", 422],
      ["tired", 0],
    ]);
    expect(onDeadLetter).toHaveBeenCalledTimes(2);
    expect((await store.deadLetters())[0].claim).toBeUndefined();
  });

  it("treats a thrown send as a transient failure", async () => {
    const store = await open();
    await store.enqueue(input("a"), clock);
    await dispatcher(store, async () => {
      throw new Error("Failed to fetch");
    }).flush();
    expect((await store.list())[0]).toMatchObject({ retries: 1 });
  });

  it("sends nothing while offline", async () => {
    const store = await open();
    const send = vi.fn(ok);
    await store.enqueue(input("a"), clock);
    await dispatcher(store, send, { isOnline: () => false }).flush();
    expect(send).not.toHaveBeenCalled();
  });

  it("runs one pass at a time and picks up work added during it", async () => {
    const store = await open();
    const gate = gatedSend();
    await store.enqueue(input("a"), clock);
    const d = dispatcher(store, gate.send);
    const first = d.flush();
    await until(() => gate.calls.length === 1);
    const second = d.flush();
    expect(second).toBe(first);
    await store.enqueue(input("b"), clock);
    gate.calls[0].respond({ kind: "ok" });
    await until(() => gate.calls.length === 2);
    gate.calls[1].respond({ kind: "ok" });
    expect(await first).toEqual({ processed: 2, failed: 0 });
  });
});
