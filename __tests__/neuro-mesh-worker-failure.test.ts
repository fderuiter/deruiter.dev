// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import type { MeshWorkerRequest } from "@/lib/neuro/types";

/** A stand-in Web Worker that records requests and lets the test fail it. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  static failPostMessage = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  requests: MeshWorkerRequest[] = [];
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(request: MeshWorkerRequest) {
    if (FakeWorker.failPostMessage) throw new Error("DataCloneError");
    this.requests.push(request);
  }

  terminate() {
    this.terminated = true;
  }

  reply(id: string) {
    this.onmessage?.(fromPartial<MessageEvent>({ data: { id, buffers: [] } }));
  }
}

async function loadGenerator() {
  vi.resetModules();
  return import("@/lib/neuro/mesh-generator");
}

describe("mesh worker failure settles every request (#3796)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWorker.instances = [];
    FakeWorker.failPostMessage = false;
    vi.stubGlobal("window", {});
    vi.stubGlobal("Worker", FakeWorker);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("resolves a normal reply with the worker's buffers and clears its timer", async () => {
    const { createCorticalSurfaceMeshBuffersAsync } = await loadGenerator();
    const pending = createCorticalSurfaceMeshBuffersAsync("pial");
    const worker = FakeWorker.instances[0]!;
    worker.reply(worker.requests[0]!.id);
    await expect(pending).resolves.toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("falls back for every in-flight request when the worker errors, then starts a fresh worker", async () => {
    const { createCorticalSurfaceMeshBuffersAsync } = await loadGenerator();
    const first = createCorticalSurfaceMeshBuffersAsync("pial");
    const second = createCorticalSurfaceMeshBuffersAsync("pial", true);
    const crashed = FakeWorker.instances[0]!;
    expect(crashed.requests).toHaveLength(2);

    crashed.onerror?.(new Error("worker crashed"));

    const [a, b] = await Promise.all([first, second]);
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(crashed.terminated).toBe(true);

    // A late reply from the retired worker does nothing.
    expect(() => crashed.reply(crashed.requests[0]!.id)).not.toThrow();

    const next = createCorticalSurfaceMeshBuffersAsync("pial");
    expect(FakeWorker.instances).toHaveLength(2);
    const fresh = FakeWorker.instances[1]!;
    fresh.reply(fresh.requests[0]!.id);
    await expect(next).resolves.toEqual([]);
  });

  it("falls back when postMessage throws and retires that worker", async () => {
    FakeWorker.failPostMessage = true;
    const { createCorticalSurfaceMeshBuffersAsync } = await loadGenerator();
    const result = await createCorticalSurfaceMeshBuffersAsync("pial");
    expect(result.length).toBeGreaterThan(0);
    expect(FakeWorker.instances[0]!.terminated).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("still falls back on the timeout when the worker never answers", async () => {
    const { createCorticalSurfaceMeshBuffersAsync } = await loadGenerator();
    const pending = createCorticalSurfaceMeshBuffersAsync("pial");
    vi.advanceTimersByTime(1000);
    await expect(pending).resolves.not.toHaveLength(0);
  });
});
