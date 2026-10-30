import { describe, it, expect, afterEach, vi } from "vitest";
import {
  PipelineCancelledError,
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

  it("releases the worker on dispose", () => {
    useFakeWorker();
    const client = createPipelineClient();
    void client.request({ type: "run", seed: 1, nSubjects: 4 });
    client.dispose();
    expect(FakeWorker.instances[0].terminated).toBe(true);
    expect(client.mode()).toBe("idle");
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
});
