// @vitest-environment node
/**
 * The ROI analytics worker client (#2532): worker lifecycle, zero-copy
 * transfer, superseded requests, timeouts and the main-thread fallbacks.
 *
 * The client keeps its worker in module state, so every test loads a fresh
 * copy of `@/lib/neuro` after stubbing `window` and `Worker`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ROIWorkerRequest, ROIWorkerResponse } from "@/lib/neuro";

type NeuroModule = typeof import("@/lib/neuro");

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: ROIWorkerResponse }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  readonly posted: { message: ROIWorkerRequest; transfer: ArrayBuffer[] }[] =
    [];
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: ROIWorkerRequest, transfer: ArrayBuffer[] = []) {
    this.posted.push({ message, transfer });
  }

  terminate() {
    this.terminated = true;
  }

  respond(data: Partial<ROIWorkerResponse>) {
    this.onmessage?.({ data: { success: true, ...data } as ROIWorkerResponse });
  }

  lastRequest() {
    const last = this.posted.at(-1);
    if (!last) throw new Error("worker received no request");
    return last;
  }
}

const PENDING = Symbol("pending");

async function settledValue<T>(promise: Promise<T>): Promise<T | symbol> {
  return Promise.race([
    promise,
    new Promise<symbol>((resolve) => setTimeout(() => resolve(PENDING), 0)),
  ]);
}

async function loadNeuro(): Promise<NeuroModule> {
  vi.resetModules();
  return import("@/lib/neuro");
}

function smallVolume(neuro: NeuroModule) {
  return neuro.generateSyntheticVolume("skull_strip_erosion");
}

describe("ROI analytics worker client", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal("window", {});
    vi.stubGlobal("Worker", FakeWorker);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("computes on the main thread when Worker is unavailable", async () => {
    vi.stubGlobal("Worker", undefined);
    const neuro = await loadNeuro();
    const volume = smallVolume(neuro);

    const hist = await neuro.requestHistogramAsync(
      volume.rawT1,
      volume.brainmask
    );

    expect(hist).toEqual(
      neuro.compute256BinHistogram(volume.rawT1, volume.brainmask)
    );
    expect(hist.bins).toHaveLength(256);
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("computes on the main thread when the worker cannot be constructed", async () => {
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error("worker blocked by CSP");
        }
      }
    );
    const neuro = await loadNeuro();
    const data = new Uint8Array([0, 10, 10, 255]);

    await expect(neuro.requestHistogramAsync(data)).resolves.toEqual(
      neuro.compute256BinHistogram(data)
    );
  });

  it("transfers copies of the histogram buffers and returns the worker's result", async () => {
    const neuro = await loadNeuro();
    const data = new Uint8Array([1, 2, 3, 4]);
    const mask = new Uint8Array([1, 1, 0, 1]);

    const pending = neuro.requestHistogramAsync(data, mask);
    const worker = FakeWorker.instances[0];
    const { message, transfer } = worker.lastRequest();

    expect(message.type).toBe("histogram");
    expect(transfer).toEqual([
      message.rawT1?.buffer,
      message.brainmask?.buffer,
    ]);
    // Zero-copy transfer detaches what it sends, so the caller's arrays must
    // not be the ones transferred.
    expect(transfer).not.toContain(data.buffer);
    expect(transfer).not.toContain(mask.buffer);

    const fromWorker = neuro.compute256BinHistogram(
      new Uint8Array([9, 9, 9, 9])
    );
    worker.respond({
      id: message.id,
      seq: message.seq,
      type: "histogram",
      histogram: fromWorker,
    });

    await expect(pending).resolves.toBe(fromWorker);
  });

  it("sends only the data buffer when no histogram mask is given", async () => {
    const neuro = await loadNeuro();
    const data = new Uint8Array([5, 6]);

    void neuro.requestHistogramAsync(data);
    const { message, transfer } = FakeWorker.instances[0].lastRequest();

    expect(message.brainmask).toBeUndefined();
    expect(transfer).toEqual([message.rawT1?.buffer]);
  });

  it("reuses one worker across requests", async () => {
    const neuro = await loadNeuro();

    void neuro.requestHistogramAsync(new Uint8Array([1]));
    void neuro.requestMarchingSquaresAsync(new Uint8Array(4), 2, 2);

    expect(FakeWorker.instances).toHaveLength(1);
    expect(FakeWorker.instances[0].posted).toHaveLength(2);
  });

  it("never resolves a superseded segmentation with its stale result", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const neuro = await loadNeuro();
    const volume = smallVolume(neuro);
    const seed = { x: 48, y: 48, z: 48 };

    const first = neuro.requestROISegmentationAsync(
      volume.rawT1,
      volume.brainmask,
      volume.dimensions,
      seed
    );
    const worker = FakeWorker.instances[0];
    const firstRequest = worker.lastRequest().message;
    const second = neuro.requestROISegmentationAsync(
      volume.rawT1,
      volume.brainmask,
      volume.dimensions,
      seed
    );
    const secondRequest = worker.lastRequest();

    expect(secondRequest.transfer).toEqual([
      secondRequest.message.rawT1?.buffer,
      secondRequest.message.brainmask?.buffer,
    ]);

    const staleResult = neuro.runRegionGrowing(
      volume.rawT1,
      volume.brainmask,
      volume.dimensions,
      { x: 40, y: 40, z: 40 }
    );
    worker.respond({
      id: firstRequest.id,
      seq: firstRequest.seq,
      type: "region_grow",
      segmentation: staleResult,
    });
    const freshResult = neuro.runRegionGrowing(
      volume.rawT1,
      volume.brainmask,
      volume.dimensions,
      seed
    );
    worker.respond({
      id: secondRequest.message.id,
      seq: secondRequest.message.seq,
      type: "region_grow",
      segmentation: freshResult,
    });

    await expect(second).resolves.toBe(freshResult);

    // The superseded request is dropped: neither the stale worker result nor
    // the timeout fallback ever reaches its caller.
    await vi.advanceTimersByTimeAsync(2000);
    const outcome = Promise.race([first, Promise.resolve(PENDING)]);
    await expect(outcome).resolves.toBe(PENDING);
  });

  it("falls back to the main thread when the worker reports failure", async () => {
    const neuro = await loadNeuro();
    const volume = smallVolume(neuro);
    const seed = { x: 48, y: 48, z: 48 };

    const pending = neuro.requestROISegmentationAsync(
      volume.rawT1,
      volume.brainmask,
      volume.dimensions,
      seed,
      20
    );
    const { message } = FakeWorker.instances[0].lastRequest();
    expect(message.intensityTolerance).toBe(20);
    FakeWorker.instances[0].respond({
      id: message.id,
      seq: message.seq,
      type: "region_grow",
      success: false,
      error: "out of memory",
    });

    await expect(pending).resolves.toEqual(
      neuro.runRegionGrowing(
        volume.rawT1,
        volume.brainmask,
        volume.dimensions,
        seed,
        20
      )
    );
  });

  it("ignores worker messages without a request id", async () => {
    const neuro = await loadNeuro();
    const data = new Uint8Array([1, 2]);

    const pending = neuro.requestHistogramAsync(data);
    const worker = FakeWorker.instances[0];
    worker.respond({ histogram: neuro.compute256BinHistogram(data) });

    await expect(settledValue(pending)).resolves.toBe(PENDING);
  });

  it("falls back to the main thread when the worker does not answer within a second", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const neuro = await loadNeuro();
    const mask = new Uint8Array(16);
    mask.fill(1, 5, 7);
    mask.fill(1, 9, 11);

    const contours = neuro.requestMarchingSquaresAsync(mask, 4, 4, 0.5);
    const histogram = neuro.requestHistogramAsync(mask);
    await vi.advanceTimersByTimeAsync(1000);

    await expect(contours).resolves.toEqual(
      neuro.computeMarchingSquares(mask, 4, 4, 0.5)
    );
    await expect(histogram).resolves.toEqual(
      neuro.compute256BinHistogram(mask)
    );
  });

  it("returns worker contours and falls back when the contour reply is empty", async () => {
    const neuro = await loadNeuro();
    const mask = new Uint8Array(9);
    mask[4] = 1;

    const fromWorker = neuro.requestMarchingSquaresAsync(mask, 3, 3, 0.25);
    const worker = FakeWorker.instances[0];
    const first = worker.lastRequest();
    expect(first.message.dimensions).toEqual({ width: 3, height: 3, depth: 1 });
    expect(first.message.isovalue).toBe(0.25);
    expect(first.transfer).toEqual([first.message.rawT1?.buffer]);
    worker.respond({
      id: first.message.id,
      seq: first.message.seq,
      type: "marching_squares",
      contours: [],
    });
    await expect(fromWorker).resolves.toEqual([]);

    const fallback = neuro.requestMarchingSquaresAsync(mask, 3, 3, 0.25);
    const second = worker.lastRequest().message;
    worker.respond({
      id: second.id,
      seq: second.seq,
      type: "marching_squares",
    });
    await expect(fallback).resolves.toEqual(
      neuro.computeMarchingSquares(mask, 3, 3, 0.25)
    );
  });

  it("returns worker QA alerts, defaulting a missing scan duration to zero", async () => {
    const neuro = await loadNeuro();
    const volume = smallVolume(neuro);

    const pending = neuro.requestVolumeQAScanAsync(volume);
    const worker = FakeWorker.instances[0];
    const { message, transfer } = worker.lastRequest();
    expect(transfer).toEqual([
      message.rawT1?.buffer,
      message.brainmask?.buffer,
      message.wmMask?.buffer,
    ]);
    expect(message.scenarioId).toBe(volume.scenarioId);
    worker.respond({
      id: message.id,
      seq: message.seq,
      type: "qa_scan",
      qaAlerts: [],
    });

    await expect(pending).resolves.toEqual({ alerts: [], scanDurationMs: 0 });
  });

  it("scans on the main thread when the QA reply carries no alerts", async () => {
    const neuro = await loadNeuro();
    const volume = smallVolume(neuro);

    const pending = neuro.requestVolumeQAScanAsync(volume);
    const { message } = FakeWorker.instances[0].lastRequest();
    FakeWorker.instances[0].respond({
      id: message.id,
      seq: message.seq,
      type: "qa_scan",
      success: false,
    });

    const result = await pending;
    expect(result.alerts).toEqual(neuro.scanVolumeQAAnomalies(volume).alerts);
  });

  it("settles pending requests through the fallback after a worker error, then starts a fresh worker", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const neuro = await loadNeuro();
    const data = new Uint8Array([3, 3, 7]);

    const pending = neuro.requestHistogramAsync(data);
    const crashed = FakeWorker.instances[0];
    crashed.onerror?.(new Error("worker crashed"));

    await expect(settledValue(pending)).resolves.toEqual(
      neuro.compute256BinHistogram(data)
    );
    expect(crashed.terminated).toBe(true);

    void neuro.requestHistogramAsync(data);
    expect(FakeWorker.instances).toHaveLength(2);
    expect(FakeWorker.instances[1].posted).toHaveLength(1);
  });
});
