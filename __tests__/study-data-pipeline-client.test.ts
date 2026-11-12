import { describe, it, expect, afterEach, vi } from "vitest";
import {
  PipelineCancelledError,
  PipelineDisposedError,
  createPipelineClient,
} from "@/components/study-data/pipeline-client";
import type {
  RunSummary,
  StudyDataRequest,
} from "@/components/study-data/protocol";

/**
 * The /study-data pipeline client (#3482). Without Workers (jsdom) requests
 * run on the main thread through the real session; with a Worker they are
 * matched to replies by id. The fake below stands in for the browser's
 * Worker only; the engine is never mocked.
 */

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly posted: StudyDataRequest[] = [];
  terminated = false;
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(request: StudyDataRequest) {
    this.posted.push(request);
  }
  terminate() {
    this.terminated = true;
  }
  reply(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
  fail(message: string) {
    const event = { message, preventDefault: vi.fn() } as unknown;
    this.onerror?.(event as ErrorEvent);
    return event as { preventDefault: ReturnType<typeof vi.fn> };
  }
}

function useFakeWorker() {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pipeline client on the main thread", () => {
  it("starts idle, then runs a request through the real session", async () => {
    expect(typeof Worker).toBe("undefined");
    const client = createPipelineClient();
    expect(client.mode()).toBe("idle");

    const summary: RunSummary = await client.request({
      type: "run",
      seed: 301,
      nSubjects: 8,
    });

    expect(client.mode()).toBe("main-thread");
    expect(summary.seed).toBe(301);
    expect(summary.nSubjects).toBe(8);
    expect(summary.conformance.ruleResults.length).toBeGreaterThan(0);
  }, 60_000);

  it("rejects a request the session refuses", async () => {
    const client = createPipelineClient();
    await expect(
      client.request({
        type: "rows",
        runId: 999,
        key: "sdtm/DM",
        offset: 0,
        limit: 10,
      })
    ).rejects.toThrow();
  }, 60_000);

  it("ignores cancel when no worker is running", () => {
    const client = createPipelineClient();
    expect(() => client.cancel()).not.toThrow();
    expect(() => client.dispose()).not.toThrow();
  });
});

describe("pipeline client in a worker", () => {
  it("posts each request with its own id and resolves it from the matching reply", async () => {
    useFakeWorker();
    const client = createPipelineClient();
    const first = client.request({ type: "run", seed: 1, nSubjects: 4 });
    const second = client.request({ type: "run", seed: 2, nSubjects: 4 });
    expect(client.mode()).toBe("worker");

    const [worker] = FakeWorker.instances;
    expect(FakeWorker.instances).toHaveLength(1);
    const [a, b] = worker.posted;
    expect(a).toMatchObject({ type: "run", seed: 1 });
    expect(b.id).not.toBe(a.id);

    worker.reply({ id: b.id, ok: true, result: "second" });
    worker.reply({ id: 4242, ok: true, result: "nobody asked" });
    worker.reply({ id: a.id, ok: true, result: "first" });

    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
  });

  it("rejects a request the worker answers with an error", async () => {
    useFakeWorker();
    const client = createPipelineClient();
    const pending = client.request({ type: "run", seed: 1, nSubjects: 4 });
    const [worker] = FakeWorker.instances;
    worker.reply({ id: worker.posted[0].id, ok: false, error: "No such run." });
    await expect(pending).rejects.toThrow("No such run.");
  });

  it("rejects every pending request when the worker fails, then starts a fresh one", async () => {
    useFakeWorker();
    const client = createPipelineClient();
    const one = client.request({ type: "run", seed: 1, nSubjects: 4 });
    const two = client.request({ type: "run", seed: 2, nSubjects: 4 });
    const [worker] = FakeWorker.instances;

    const event = worker.fail("Out of memory");

    await expect(one).rejects.toThrow("Out of memory");
    await expect(two).rejects.toThrow("Out of memory");
    expect(event.preventDefault).toHaveBeenCalled();
    expect(worker.terminated).toBe(true);
    expect(client.mode()).toBe("idle");

    void client.request({ type: "run", seed: 3, nSubjects: 4 });
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it("uses a default message when the worker fails without one", async () => {
    useFakeWorker();
    const client = createPipelineClient();
    const pending = client.request({ type: "run", seed: 1, nSubjects: 4 });
    FakeWorker.instances[0].fail("");
    await expect(pending).rejects.toThrow("The pipeline worker failed.");
  });

  it("cancels pending requests with PipelineCancelledError", async () => {
    useFakeWorker();
    const client = createPipelineClient();
    const pending = client.request({ type: "run", seed: 1, nSubjects: 4 });
    client.cancel();
    await expect(pending).rejects.toBeInstanceOf(PipelineCancelledError);
    expect(FakeWorker.instances[0].terminated).toBe(true);
    expect(client.mode()).toBe("idle");
  });

  it("releases the worker on dispose", async () => {
    useFakeWorker();
    const client = createPipelineClient();
    const pending = client.request({ type: "run", seed: 1, nSubjects: 4 });
    client.dispose();
    expect(FakeWorker.instances[0].terminated).toBe(true);
    expect(client.mode()).toBe("idle");
    await pending.catch(() => undefined);
  });

  // #3798: disposal must settle every waiter, not just forget it.
  it("rejects a pending request on dispose with a typed disposal error", async () => {
    useFakeWorker();
    const client = createPipelineClient();
    const pending = client.request({ type: "run", seed: 1, nSubjects: 4 });
    client.dispose();
    const error = await pending.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(PipelineDisposedError);
    // Existing `instanceof PipelineCancelledError` guards treat it as expected.
    expect(error).toBeInstanceOf(PipelineCancelledError);
    expect((error as Error).name).toBe("PipelineDisposedError");
  });

  it("rejects every pending request exactly once on dispose", async () => {
    useFakeWorker();
    const client = createPipelineClient();
    const onRejected = vi.fn();
    const onResolved = vi.fn();
    const requests = [1, 2, 3].map((seed) =>
      client
        .request({ type: "run", seed, nSubjects: 4 })
        .then(onResolved, onRejected)
    );
    const [worker] = FakeWorker.instances;
    const posted = [...worker.posted];

    client.dispose();
    client.dispose();
    // A reply that arrives after disposal settles nothing a second time.
    for (const request of posted) {
      worker.reply({ id: request.id, ok: true, result: "late" });
    }
    await Promise.all(requests);

    expect(onResolved).not.toHaveBeenCalled();
    expect(onRejected).toHaveBeenCalledTimes(3);
    for (const [error] of onRejected.mock.calls) {
      expect(error).toBeInstanceOf(PipelineDisposedError);
    }
  });

  it("serves a fresh worker after dispose and ignores the old one (setup, cleanup, setup)", async () => {
    useFakeWorker();
    const client = createPipelineClient();
    const stale = client.request({ type: "run", seed: 1, nSubjects: 4 });
    const [oldWorker] = FakeWorker.instances;
    client.dispose();
    await expect(stale).rejects.toBeInstanceOf(PipelineDisposedError);

    const fresh = client.request({ type: "run", seed: 2, nSubjects: 4 });
    expect(FakeWorker.instances).toHaveLength(2);
    expect(client.mode()).toBe("worker");
    const newWorker = FakeWorker.instances[1];

    // Late traffic from the released worker must not touch the new run.
    oldWorker.reply({ id: newWorker.posted[0].id, ok: true, result: "stale" });
    oldWorker.fail("old worker died");
    expect(newWorker.terminated).toBe(false);
    expect(client.mode()).toBe("worker");

    newWorker.reply({ id: newWorker.posted[0].id, ok: true, result: "fresh" });
    await expect(fresh).resolves.toBe("fresh");
  });

  it("ignores late traffic from a worker released by cancel", async () => {
    useFakeWorker();
    const client = createPipelineClient();
    const first = client.request({ type: "run", seed: 1, nSubjects: 4 });
    const [oldWorker] = FakeWorker.instances;
    client.cancel();
    await expect(first).rejects.toBeInstanceOf(PipelineCancelledError);

    const next = client.request({ type: "run", seed: 2, nSubjects: 4 });
    const newWorker = FakeWorker.instances[1];
    oldWorker.fail("old worker died");
    expect(newWorker.terminated).toBe(false);

    newWorker.reply({ id: newWorker.posted[0].id, ok: true, result: "next" });
    await expect(next).resolves.toBe("next");
  });

  it("falls back to the main thread when the worker cannot be created", async () => {
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error("blocked by policy");
        }
      }
    );
    const client = createPipelineClient();
    await expect(
      client.request({
        type: "rows",
        runId: 999,
        key: "sdtm/DM",
        offset: 0,
        limit: 10,
      })
    ).rejects.toThrow();
    expect(client.mode()).toBe("main-thread");
  }, 60_000);

  it("detaches onmessage and onerror handlers on the released worker to prevent leaks", async () => {
    useFakeWorker();
    const client = createPipelineClient();
    const pending = client.request({ type: "run", seed: 1, nSubjects: 4 });
    const [worker] = FakeWorker.instances;
    expect(worker.onmessage).not.toBeNull();
    expect(worker.onerror).not.toBeNull();

    client.dispose();
    expect(worker.terminated).toBe(true);
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
    await expect(pending).rejects.toBeInstanceOf(PipelineDisposedError);
  });

  it("settles heterogeneous requests mid-flight when cancel and dispose are triggered in rapid succession", async () => {
    useFakeWorker();
    const client = createPipelineClient();
    const r1 = client.request({ type: "run", seed: 1, nSubjects: 4 });
    const r2 = client.request({
      type: "rows",
      runId: 1,
      key: "sdtm/DM",
      offset: 0,
      limit: 10,
    });
    const r3 = client.request({
      type: "trace",
      runId: 1,
      origin: { kind: "activity", activityId: "act1" },
      limit: 5,
    });
    const r4 = client.request({
      type: "package",
      runId: 1,
      kind: "submission",
    });

    // Rapid cancellation followed immediately by disposal
    client.cancel();
    client.dispose();

    const settled = await Promise.allSettled([r1, r2, r3, r4]);
    expect(settled).toHaveLength(4);
    for (const item of settled) {
      expect(item.status).toBe("rejected");
      if (item.status === "rejected") {
        expect(item.reason).toBeInstanceOf(PipelineCancelledError);
      }
    }
  });

  it("cleans up pending waiter and rejects when worker postMessage throws synchronously", async () => {
    useFakeWorker();
    const client = createPipelineClient();
    vi.spyOn(FakeWorker.prototype, "postMessage").mockImplementationOnce(() => {
      throw new Error("Simulated postMessage DataCloneError");
    });
    await expect(
      client.request({ type: "run", seed: 1, nSubjects: 4 })
    ).rejects.toThrow("Simulated postMessage DataCloneError");

    // Client should remain in a clean state after postMessage failure
    expect(client.mode()).toBe("worker");
    client.dispose();
  });
});
