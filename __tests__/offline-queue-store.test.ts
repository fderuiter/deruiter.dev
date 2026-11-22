// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import { IDBFactory } from "fake-indexeddb";
import {
  OFFLINE_DEAD_LETTER_CAP,
  OfflineQueueStoreError,
  openOfflineQueueStore,
  type OfflineQueueStore,
} from "@/lib/offline-queue";

/**
 * IndexedDB offline queue store (#3807, slice 1). Each test gets a fresh
 * in-memory IndexedDB. Two stores opened on the same factory stand in for
 * two tabs: separate connections to one database.
 */

let factory: IDBFactory;
const opened: OfflineQueueStore[] = [];

async function open(): Promise<OfflineQueueStore> {
  const result = await openOfflineQueueStore({ indexedDB: factory });
  if (!result.ok) throw new Error(result.code);
  opened.push(result.store);
  return result.store;
}

const input = (id: string, body: unknown = { id }) => ({
  id,
  type: "reaction",
  endpoint: "/api/case-studies/reactions",
  body,
});

beforeEach(() => {
  factory = new IDBFactory();
});

afterEach(() => {
  for (const store of opened.splice(0)) store.close();
});

describe("opening", () => {
  it("reports an unavailable store instead of pretending to persist", async () => {
    expect(await openOfflineQueueStore({ indexedDB: undefined })).toEqual({
      ok: false,
      code: "STORE_UNAVAILABLE",
    });
    const broken = fromPartial<IDBFactory>({
      open() {
        throw new Error("SecurityError");
      },
    });
    expect(await openOfflineQueueStore({ indexedDB: broken })).toEqual({
      ok: false,
      code: "STORE_UNAVAILABLE",
    });
  });

  it("rejects operations after close", async () => {
    const store = await open();
    store.close();
    await expect(store.list()).rejects.toMatchObject({ code: "STORE_CLOSED" });
  });
});

describe("entry operations", () => {
  it("enqueues in order and replaces in place with a new revision", async () => {
    const store = await open();
    await store.enqueue(input("a"), 100);
    await store.enqueue(input("b"), 101);
    await store.recordRetry({ id: "a", revision: 0 }, 2, 5_000);
    const replaced = await store.enqueue(input("a", { v: 2 }), 102);
    expect(replaced).toMatchObject({
      revision: 1,
      retries: 0,
      nextAttemptAt: 102,
      body: { v: 2 },
    });
    expect((await store.list()).map((e) => [e.id, e.revision])).toEqual([
      ["a", 1],
      ["b", 0],
    ]);
  });

  it("settles only the revision that was sent", async () => {
    const store = await open();
    await store.enqueue(input("a"), 1);
    await store.enqueue(input("a", { v: 2 }), 2);
    expect(await store.acknowledge({ id: "a", revision: 0 })).toBe(false);
    expect(await store.recordRetry({ id: "a", revision: 0 }, 1, 9)).toBe(false);
    expect(
      await store.moveToDeadLetters(
        { id: "a", revision: 0 },
        { statusCode: 400, failureReason: "bad", failedAt: 3 }
      )
    ).toBe(false);
    expect(await store.list()).toHaveLength(1);
    expect(await store.acknowledge({ id: "a", revision: 1 })).toBe(true);
    expect(await store.list()).toEqual([]);
  });

  it("persists the retry deadline with the retry", async () => {
    const store = await open();
    await store.enqueue(input("a"), 1);
    await store.recordRetry({ id: "a", revision: 0 }, 1, 2_001);
    const other = await open();
    expect((await other.list())[0]).toMatchObject({
      retries: 1,
      nextAttemptAt: 2_001,
    });
  });

  it("moves to dead letters atomically and keeps the newest 50", async () => {
    const store = await open();
    for (let i = 0; i < OFFLINE_DEAD_LETTER_CAP + 3; i += 1) {
      await store.enqueue(input(`r${i}`), i);
      await store.moveToDeadLetters(
        { id: `r${i}`, revision: 0 },
        { statusCode: 422, failureReason: "invalid", failedAt: i }
      );
    }
    const letters = await store.deadLetters();
    expect(letters).toHaveLength(OFFLINE_DEAD_LETTER_CAP);
    expect(letters[0].id).toBe("r3");
    expect(await store.list()).toEqual([]);
  });

  it("retries a dead letter unless a newer request holds its id", async () => {
    const store = await open();
    await store.enqueue(input("a"), 1);
    await store.moveToDeadLetters(
      { id: "a", revision: 0 },
      { statusCode: 500, failureReason: "x", failedAt: 2 }
    );
    expect(await store.retryDeadLetter("a", 3)).toBe("requeued");
    expect((await store.list())[0]).toMatchObject({ id: "a", retries: 0 });

    await store.moveToDeadLetters(
      { id: "a", revision: 0 },
      { statusCode: 500, failureReason: "x", failedAt: 4 }
    );
    await store.enqueue(input("a", { newer: true }), 5);
    expect(await store.retryDeadLetter("a", 6)).toBe("superseded");
    expect((await store.list())[0].body).toEqual({ newer: true });
    expect(await store.deadLetters()).toEqual([]);
    expect(await store.retryDeadLetter("a", 7)).toBe("missing");
  });
});

describe("two contexts", () => {
  it("loses no rows under concurrent enqueue, replace and acknowledge", async () => {
    const tabA = await open();
    const tabB = await open();
    await tabA.enqueue(input("shared"), 0);
    await Promise.all([
      ...Array.from({ length: 20 }, (_, i) => tabA.enqueue(input(`a${i}`), i)),
      ...Array.from({ length: 20 }, (_, i) => tabB.enqueue(input(`b${i}`), i)),
      tabA.enqueue(input("shared", { from: "A" }), 50),
      tabB.enqueue(input("shared", { from: "B" }), 51),
      tabB.acknowledge({ id: "a0", revision: 0 }),
    ]);
    const rows = await tabA.list();
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    // a0 may be acknowledged only if it was written before the ack ran.
    expect(rows.filter((r) => r.id.startsWith("b"))).toHaveLength(20);
    expect(rows.filter((r) => /^a([1-9]|1\d)$/.test(r.id))).toHaveLength(19);
    // Both replacements landed, one after the other.
    expect(rows.find((r) => r.id === "shared")?.revision).toBe(2);
    expect(rows.map((r) => r.order)).toEqual(
      [...rows.map((r) => r.order)].sort((x, y) => x - y)
    );
  });

  it("lets only one context acknowledge a revision", async () => {
    const tabA = await open();
    const tabB = await open();
    await tabA.enqueue(input("a"), 0);
    const results = await Promise.all([
      tabA.acknowledge({ id: "a", revision: 0 }),
      tabB.acknowledge({ id: "a", revision: 0 }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});

describe("storage failure", () => {
  it("rejects an aborted write and leaves the store unchanged", async () => {
    const store = await open();
    await store.enqueue(input("kept"), 0);
    const error = await store
      .enqueue(input("bad", { notCloneable: () => 1 }), 1)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OfflineQueueStoreError);
    expect((error as OfflineQueueStoreError).code).toBe("TRANSACTION_ABORTED");
    expect((await store.list()).map((e) => e.id)).toEqual(["kept"]);
  });
});

describe("legacy import", () => {
  const legacyQueue = [
    {
      id: "old-1",
      type: "feedback",
      endpoint: "/api/case-studies/feedback",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { rating: 5 },
      createdAt: 10,
      retries: 2,
      maxRetries: 5,
    },
    { id: "old-2", type: "reaction", endpoint: "/x", body: {}, revision: 3 },
    { id: "", type: "reaction", endpoint: "/x", body: {} },
    "not an entry",
    { id: "old-3", type: "reaction", endpoint: "/x" },
  ];
  const legacyDead = [
    {
      id: "dead-1",
      type: "reaction",
      endpoint: "/x",
      body: {},
      statusCode: 400,
      failureReason: "bad",
      failedAt: 7,
    },
    { id: "dead-2", type: "reaction", endpoint: "/x", body: {} },
  ];

  it("imports valid rows once and records missing deadlines", async () => {
    const store = await open();
    expect(await store.importLegacy(legacyQueue, legacyDead, 1_000)).toEqual({
      status: "imported",
      importedQueue: 2,
      importedDeadLetters: 1,
      skipped: 4,
      deadlinesInitialized: 2,
    });
    const rows = await store.list();
    expect(
      rows.map((r) => [r.id, r.revision, r.retries, r.nextAttemptAt])
    ).toEqual([
      ["old-1", 0, 2, 1_000],
      ["old-2", 3, 0, 1_000],
    ]);
    expect((await store.deadLetters())[0]).toMatchObject({
      id: "dead-1",
      statusCode: 400,
    });

    const again = await open();
    expect(
      await again.importLegacy(legacyQueue, legacyDead, 2_000)
    ).toMatchObject({ status: "already-imported", importedQueue: 0 });
    expect(await again.list()).toHaveLength(2);
  });

  it("imports nothing when the import aborts, so a restart can retry it", async () => {
    const store = await open();
    const poisoned = [
      ...legacyQueue.slice(0, 2),
      {
        id: "poison",
        type: "reaction",
        endpoint: "/x",
        body: { notCloneable: () => 1 },
      },
    ];
    await expect(store.importLegacy(poisoned, [], 1)).rejects.toMatchObject({
      code: "TRANSACTION_ABORTED",
    });
    expect(await store.list()).toEqual([]);

    // After a restart the import runs again and commits once.
    store.close();
    const restarted = await open();
    expect((await restarted.importLegacy(legacyQueue, [], 2)).status).toBe(
      "imported"
    );
    expect(await restarted.list()).toHaveLength(2);
  });

  it("keeps a newer request the store already holds", async () => {
    const store = await open();
    await store.enqueue(input("old-2", { newer: true }), 5);
    const result = await store.importLegacy(legacyQueue, [], 6);
    expect(result.importedQueue).toBe(1);
    expect((await store.list()).find((r) => r.id === "old-2")?.body).toEqual({
      newer: true,
    });
  });

  it("counts a malformed legacy value as skipped", async () => {
    const store = await open();
    expect(
      await store.importLegacy({ not: "an array" }, null, 1)
    ).toMatchObject({
      status: "imported",
      importedQueue: 0,
      skipped: 1,
    });
  });
});
