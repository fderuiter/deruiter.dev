// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  OFFLINE_DEAD_LETTER_CAP,
  OFFLINE_LEASE_MARGIN_MS,
  OFFLINE_MAX_RETRY_DELAY_MS,
  OFFLINE_REQUEST_TIMEOUT_MS,
  OfflineQueueStoreError,
  createMemoryOfflineQueueStore,
} from "@/lib/offline-queue";

/**
 * The memory store (#3807, slice 2b) stands in for IndexedDB when it cannot
 * open, so it keeps the same contract: replacement in place, revision and
 * owner checks, deadlines, leases and the dead-letter cap.
 */

const LEASE_MS = OFFLINE_REQUEST_TIMEOUT_MS + OFFLINE_LEASE_MARGIN_MS;
const CLAIM = { leaseMs: LEASE_MS, maxDelayMs: OFFLINE_MAX_RETRY_DELAY_MS };

const input = (id: string, body: unknown = { id }) => ({
  id,
  type: "reaction",
  endpoint: "/api/case-studies/reactions",
  body,
});

describe("memory offline queue store", () => {
  it("enqueues in order and replaces in place with a new revision", async () => {
    const store = createMemoryOfflineQueueStore();
    await store.enqueue(input("a"), 100);
    await store.enqueue(input("b"), 101);
    await store.recordRetry({ id: "a", revision: 0 }, 2, 5_000);
    const replaced = await store.enqueue(input("a", { v: 2 }), 102);
    expect(replaced).toMatchObject({
      revision: 1,
      retries: 0,
      nextAttemptAt: 102,
      body: { v: 2 },
      method: "POST",
      maxRetries: 5,
    });
    expect((await store.list()).map((e) => [e.id, e.revision])).toEqual([
      ["a", 1],
      ["b", 0],
    ]);
  });

  it("copies the body, so a later change by the caller is not sent", async () => {
    const store = createMemoryOfflineQueueStore();
    const body = { n: 1 };
    await store.enqueue(input("a", body), 0);
    body.n = 2;
    expect((await store.list())[0].body).toEqual({ n: 1 });
  });

  it("settles only the revision and owner that were sent", async () => {
    const store = createMemoryOfflineQueueStore();
    await store.enqueue(input("a"), 0);
    await store.claimNext("owner-a", 0, CLAIM);
    expect(
      await store.acknowledge({ id: "a", revision: 0, ownerToken: "owner-b" })
    ).toBe(false);
    await store.enqueue(input("a", { v: 2 }), 1);
    expect(
      await store.acknowledge({ id: "a", revision: 0, ownerToken: "owner-a" })
    ).toBe(false);
    expect(await store.list()).toHaveLength(1);
    expect(await store.acknowledge({ id: "a", revision: 1 })).toBe(true);
    expect(await store.list()).toEqual([]);
  });

  it("claims one entry at a time and honors deadlines and leases", async () => {
    const store = createMemoryOfflineQueueStore();
    await store.enqueue(input("a"), 0);
    await store.enqueue(input("b"), 0);
    await store.recordRetry({ id: "b", revision: 0 }, 1, 4_000);

    const first = await store.claimNext("owner", 0, CLAIM);
    expect(first.entry?.id).toBe("a");
    expect(first.entry?.claim).toEqual({
      ownerToken: "owner",
      leaseUntil: LEASE_MS,
    });
    const none = await store.claimNext("other", 1, CLAIM);
    expect(none).toEqual({ entry: null, nextWakeAt: 4_000 });

    const due = await store.claimNext("other", 4_000, CLAIM);
    expect(due.entry?.id).toBe("b");
    // A's lease runs out, so another owner may take it over.
    const takeover = await store.claimNext("other", LEASE_MS, CLAIM);
    expect(takeover.entry).toMatchObject({
      id: "a",
      claim: { ownerToken: "other" },
    });
  });

  it("treats a deadline or lease beyond its longest length as passed", async () => {
    const store = createMemoryOfflineQueueStore();
    await store.enqueue(input("a"), 0);
    await store.recordRetry(
      { id: "a", revision: 0 },
      1,
      OFFLINE_MAX_RETRY_DELAY_MS * 10
    );
    // The clock moved back, so the stored deadline is too far ahead.
    expect((await store.claimNext("owner", 0, CLAIM)).entry?.id).toBe("a");
    expect(
      (await store.claimNext("other", -LEASE_MS * 2, CLAIM)).entry?.id
    ).toBe("a");
  });

  it("releases the claim when it records a retry or dead-letters", async () => {
    const store = createMemoryOfflineQueueStore();
    await store.enqueue(input("a"), 0);
    await store.claimNext("owner", 0, CLAIM);
    await store.recordRetry(
      { id: "a", revision: 0, ownerToken: "owner" },
      1,
      2_000
    );
    expect((await store.list())[0].claim).toBeUndefined();

    await store.claimNext("owner", 2_000, CLAIM);
    expect(
      await store.moveToDeadLetters(
        { id: "a", revision: 0, ownerToken: "owner" },
        { statusCode: 400, failureReason: "bad", failedAt: 3 }
      )
    ).toBe(true);
    expect((await store.deadLetters())[0]).toMatchObject({
      id: "a",
      failureReason: "bad",
    });
    expect((await store.deadLetters())[0]).not.toHaveProperty("claim");
  });

  it("keeps the newest dead letters up to the cap", async () => {
    const store = createMemoryOfflineQueueStore();
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
  });

  it("retries a dead letter unless a newer request holds its id", async () => {
    const store = createMemoryOfflineQueueStore();
    await store.enqueue(input("a"), 1);
    await store.moveToDeadLetters(
      { id: "a", revision: 0 },
      { statusCode: 500, failureReason: "x", failedAt: 2 }
    );
    expect(await store.retryDeadLetter("a", 3)).toBe("requeued");
    await store.moveToDeadLetters(
      { id: "a", revision: 0 },
      { statusCode: 500, failureReason: "x", failedAt: 4 }
    );
    await store.enqueue(input("a", { newer: true }), 5);
    expect(await store.retryDeadLetter("a", 6)).toBe("superseded");
    expect((await store.list())[0].body).toEqual({ newer: true });
    expect(await store.retryDeadLetter("a", 7)).toBe("missing");

    await store.dismissDeadLetter("none");
    await store.clearDeadLetters();
    await store.remove("a");
    await store.enqueue(input("b"), 8);
    await store.clear();
    expect(await store.list()).toEqual([]);
  });

  it("rejects a body that cannot be cloned and leaves the store unchanged", async () => {
    const store = createMemoryOfflineQueueStore();
    await store.enqueue(input("kept"), 0);
    const error = await store
      .enqueue(input("bad", { notCloneable: () => 1 }), 1)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OfflineQueueStoreError);
    expect((error as OfflineQueueStoreError).code).toBe("TRANSACTION_ABORTED");
    expect((await store.list()).map((e) => e.id)).toEqual(["kept"]);
  });

  it("imports nothing, so legacy rows wait for a durable start", async () => {
    const store = createMemoryOfflineQueueStore();
    expect(await store.importLegacy([input("legacy")], [], 0)).toMatchObject({
      status: "already-imported",
      importedQueue: 0,
    });
    expect(await store.list()).toEqual([]);
  });

  it("rejects operations after close", async () => {
    const store = createMemoryOfflineQueueStore();
    store.close();
    await expect(store.list()).rejects.toMatchObject({ code: "STORE_CLOSED" });
  });
});
