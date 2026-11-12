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
    const firstRejection = expect(first).rejects.toSatisfy((err) =>
      neuro.isRoiRequestSupersededError(err)
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

    // The superseded request settles with a typed supersession error;
    // neither the stale worker result nor the timeout fallback ever reaches its caller (#3797).
    await vi.advanceTimersByTimeAsync(2000);
    await firstRejection;
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

  const freshHistogram = {
    bins: new Uint32Array(256),
    totalVoxels: 10,
    min: 0,
    max: 255,
    mean: 128,
    median: 128,
    mode: 128,
    stdDev: 10,
    volumeMm3: 10,
  };
  const staleHistogram = {
    bins: new Uint32Array(256),
    totalVoxels: 1,
    min: 0,
    max: 0,
    mean: 0,
    median: 0,
    mode: 0,
    stdDev: 0,
    volumeMm3: 1,
  };

  const freshSegmentation = {
    stats: {
      seed: { x: 48, y: 48, z: 48 },
      voxelCount: 50,
      volumeMm3: 50,
      meanIntensity: 140,
      stdDevIntensity: 5,
      minIntensity: 120,
      maxIntensity: 160,
    },
    contours: [],
    roiMask: new Uint8Array(64),
  };
  const staleSegmentation = {
    stats: {
      seed: { x: 40, y: 40, z: 40 },
      voxelCount: 10,
      volumeMm3: 10,
      meanIntensity: 90,
      stdDevIntensity: 4,
      minIntensity: 80,
      maxIntensity: 100,
    },
    contours: [],
    roiMask: new Uint8Array(64),
  };

  const freshContours = [
    {
      id: "fresh_contour",
      isClosed: true,
      segments: [],
      svgPathData: "M 0 0 L 1 1",
    },
  ];
  const staleContours = [
    {
      id: "stale_contour",
      isClosed: false,
      segments: [],
      svgPathData: "M 0 0",
    },
  ];

  const freshQA = {
    qaAlerts: [
      {
        id: "alert_fresh",
        type: "intensity_spike" as const,
        sliceIndex: 1,
        plane: "axial" as const,
        severity: "critical" as const,
        description: "Fresh anomaly",
        suggestedAction: "Inspect voxel intensity",
        voxelCoord: { x: 1, y: 1, z: 1 },
        metricValue: 99,
      },
    ],
    scanDurationMs: 42,
  };
  const staleQA = {
    qaAlerts: [],
    scanDurationMs: 5,
  };

  describe.each([
    {
      task: "histogram",
      dispatch: (neuro: NeuroModule) =>
        neuro.requestHistogramAsync(new Uint8Array([1, 2, 3])),
      staleReply: {
        type: "histogram" as const,
        histogram: staleHistogram,
      },
      freshReply: {
        type: "histogram" as const,
        histogram: freshHistogram,
      },
      expectedFresh: freshHistogram,
    },
    {
      task: "region_grow",
      dispatch: (neuro: NeuroModule) => {
        const v = smallVolume(neuro);
        return neuro.requestROISegmentationAsync(
          v.rawT1,
          v.brainmask,
          v.dimensions,
          { x: 48, y: 48, z: 48 }
        );
      },
      staleReply: {
        type: "region_grow" as const,
        segmentation: staleSegmentation,
      },
      freshReply: {
        type: "region_grow" as const,
        segmentation: freshSegmentation,
      },
      expectedFresh: freshSegmentation,
    },
    {
      task: "marching_squares",
      dispatch: (neuro: NeuroModule) =>
        neuro.requestMarchingSquaresAsync(new Uint8Array([0, 1, 1, 0]), 2, 2, 0.5),
      staleReply: {
        type: "marching_squares" as const,
        contours: staleContours,
      },
      freshReply: {
        type: "marching_squares" as const,
        contours: freshContours,
      },
      expectedFresh: freshContours,
    },
    {
      task: "qa_scan",
      dispatch: (neuro: NeuroModule) =>
        neuro.requestVolumeQAScanAsync(smallVolume(neuro)),
      staleReply: {
        type: "qa_scan" as const,
        ...staleQA,
      },
      freshReply: {
        type: "qa_scan" as const,
        ...freshQA,
      },
      expectedFresh: {
        alerts: freshQA.qaAlerts,
        scanDurationMs: freshQA.scanDurationMs,
      },
    },
  ])(
    "Task family supersession: $task (#3797)",
    ({ dispatch, staleReply, freshReply, expectedFresh }) => {
      it("settles superseded request when stale reply arrives before fallback timeout", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const neuro = await loadNeuro();
        const first = dispatch(neuro);
        const firstRejection = expect(first).rejects.toSatisfy((err) =>
          neuro.isRoiRequestSupersededError(err)
        );
        const worker = FakeWorker.instances[0];
        const firstReq = worker.lastRequest().message;

        const second = dispatch(neuro);
        const secondReq = worker.lastRequest().message;

        // Deliver stale response for first
        worker.respond({
          id: firstReq.id,
          seq: firstReq.seq,
          ...staleReply,
        });

        // Deliver fresh response for second
        worker.respond({
          id: secondReq.id,
          seq: secondReq.seq,
          ...freshReply,
        });

        await firstRejection;
        await expect(second).resolves.toEqual(expectedFresh);

        // Verify timers: no late timers fire or leak
        await vi.advanceTimersByTimeAsync(2000);
      });

      it("settles superseded request on timeout when stale reply arrives after fallback timer", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const neuro = await loadNeuro();
        const first = dispatch(neuro);
        const firstRejection = expect(first).rejects.toSatisfy((err) =>
          neuro.isRoiRequestSupersededError(err)
        );
        const worker = FakeWorker.instances[0];
        const firstReq = worker.lastRequest().message;

        // Advance by 500ms before dispatching second
        await vi.advanceTimersByTimeAsync(500);

        const second = dispatch(neuro);
        const secondReq = worker.lastRequest().message;

        // Advance 600ms more (1100ms total for first -> timed out; 600ms total for second -> still active)
        await vi.advanceTimersByTimeAsync(600);

        // First should have settled on timeout with supersession error, not fallback
        await firstRejection;

        // Stale response arrives late for first (clean no-op)
        worker.respond({
          id: firstReq.id,
          seq: firstReq.seq,
          ...staleReply,
        });

        // Second responds with fresh data
        worker.respond({
          id: secondReq.id,
          seq: secondReq.seq,
          ...freshReply,
        });

        await expect(second).resolves.toEqual(expectedFresh);

        await vi.advanceTimersByTimeAsync(2000);
      });

      it("settles superseded request when reply arrives out of order (second before first)", async () => {
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const neuro = await loadNeuro();
        const first = dispatch(neuro);
        const firstRejection = expect(first).rejects.toSatisfy((err) =>
          neuro.isRoiRequestSupersededError(err)
        );
        const worker = FakeWorker.instances[0];
        const firstReq = worker.lastRequest().message;

        const second = dispatch(neuro);
        const secondReq = worker.lastRequest().message;

        // Second arrives first
        worker.respond({
          id: secondReq.id,
          seq: secondReq.seq,
          ...freshReply,
        });

        await expect(second).resolves.toEqual(expectedFresh);

        // First arrives second
        worker.respond({
          id: firstReq.id,
          seq: firstReq.seq,
          ...staleReply,
        });

        await firstRejection;

        await vi.advanceTimersByTimeAsync(2000);
      });
    }
  );

  describe("Interleaved multi-task family supersession & robustness (#3797)", () => {
    it("preserves independent sequence counters across task families during worker crash", async () => {
      const neuro = await loadNeuro();
      const volume = smallVolume(neuro);

      // Dispatch interleaved requests across two distinct task families:
      // R1: region_grow (seq 1) - superseded by R2
      // H1: histogram   (seq 2) - superseded by H2
      // R2: region_grow (seq 3) - latest in region_grow
      // H2: histogram   (seq 4) - latest in histogram
      const r1 = neuro.requestROISegmentationAsync(
        volume.rawT1,
        volume.brainmask,
        volume.dimensions,
        { x: 40, y: 40, z: 40 }
      );
      const worker = FakeWorker.instances[0];

      const h1 = neuro.requestHistogramAsync(new Uint8Array([1, 2, 3]));
      const r2 = neuro.requestROISegmentationAsync(
        volume.rawT1,
        volume.brainmask,
        volume.dimensions,
        { x: 48, y: 48, z: 48 }
      );
      const h2 = neuro.requestHistogramAsync(new Uint8Array([4, 5, 6]));

      expect(worker.posted).toHaveLength(4);

      // Simulate unexpected worker crash
      worker.onerror?.(new Error("Worker thread OOM panic"));

      // Superseded callers must reject with typed error
      await expect(r1).rejects.toSatisfy((err) =>
        neuro.isRoiRequestSupersededError(err)
      );
      await expect(h1).rejects.toSatisfy((err) =>
        neuro.isRoiRequestSupersededError(err)
      );

      // Latest callers in each family must settle cleanly through main-thread fallback
      const r2Result = await r2;
      expect(r2Result.stats.seed).toEqual({ x: 48, y: 48, z: 48 });

      const h2Result = await h2;
      expect(h2Result.bins).toHaveLength(256);

      // Subsequent request must spin up a fresh worker
      void neuro.requestHistogramAsync(new Uint8Array([7, 8, 9]));
      expect(FakeWorker.instances).toHaveLength(2);
    });

    it("settles interleaved requests correctly when responses arrive completely out of order", async () => {
      const neuro = await loadNeuro();
      const volume = smallVolume(neuro);

      const r1 = neuro.requestROISegmentationAsync(
        volume.rawT1,
        volume.brainmask,
        volume.dimensions,
        { x: 40, y: 40, z: 40 }
      );
      const worker = FakeWorker.instances[0];
      const r1Req = worker.posted[0].message;

      const h1 = neuro.requestHistogramAsync(new Uint8Array([1, 2, 3]));
      const h1Req = worker.posted[1].message;

      const r2 = neuro.requestROISegmentationAsync(
        volume.rawT1,
        volume.brainmask,
        volume.dimensions,
        { x: 48, y: 48, z: 48 }
      );
      const r2Req = worker.posted[2].message;

      const h2 = neuro.requestHistogramAsync(new Uint8Array([4, 5, 6]));
      const h2Req = worker.posted[3].message;

      // 1. Reply to H2 first (fresh histogram)
      worker.respond({
        id: h2Req.id,
        seq: h2Req.seq,
        type: "histogram",
        histogram: freshHistogram,
      });
      await expect(h2).resolves.toEqual(freshHistogram);

      // 2. Reply to R1 second (stale region grow -> must be superseded)
      worker.respond({
        id: r1Req.id,
        seq: r1Req.seq,
        type: "region_grow",
        segmentation: staleSegmentation,
      });
      await expect(r1).rejects.toSatisfy((err) =>
        neuro.isRoiRequestSupersededError(err)
      );

      // 3. Reply to R2 third (fresh region grow)
      worker.respond({
        id: r2Req.id,
        seq: r2Req.seq,
        type: "region_grow",
        segmentation: freshSegmentation,
      });
      await expect(r2).resolves.toEqual(freshSegmentation);

      // 4. Reply to H1 fourth (stale histogram -> must be superseded)
      worker.respond({
        id: h1Req.id,
        seq: h1Req.seq,
        type: "histogram",
        histogram: staleHistogram,
      });
      await expect(h1).rejects.toSatisfy((err) =>
        neuro.isRoiRequestSupersededError(err)
      );
    });

    it("settles superseded request when worker response omits or scrambles the type field", async () => {
      const neuro = await loadNeuro();

      const first = neuro.requestHistogramAsync(new Uint8Array([1, 2, 3]));
      const worker = FakeWorker.instances[0];
      const firstReq = worker.lastRequest().message;

      const second = neuro.requestHistogramAsync(new Uint8Array([4, 5, 6]));
      const secondReq = worker.lastRequest().message;

      // Worker replies to first with undefined type (or untyped error payload)
      worker.onmessage?.({
        data: {
          id: firstReq.id,
          seq: firstReq.seq,
          type: undefined as unknown as "histogram",
          success: true,
          histogram: staleHistogram,
        },
      });

      // Must reject via pending.type tracking, not drop or apply stale histogram
      await expect(first).rejects.toSatisfy((err) =>
        neuro.isRoiRequestSupersededError(err)
      );

      // Second responds normally
      worker.respond({
        id: secondReq.id,
        seq: secondReq.seq,
        type: "histogram",
        histogram: freshHistogram,
      });
      await expect(second).resolves.toEqual(freshHistogram);
    });

    it("falls back to main thread and cleans up pending state when worker.postMessage throws", async () => {
      const neuro = await loadNeuro();
      vi.spyOn(FakeWorker.prototype, "postMessage").mockImplementation(() => {
        throw new Error("DataCloneError: buffer detached");
      });

      const data = new Uint8Array([1, 2, 3, 4]);
      const result = await neuro.requestHistogramAsync(data);

      expect(result).toEqual(neuro.compute256BinHistogram(data));
    });

    it("recognizes Error instances and serialized objects in isRoiRequestSupersededError", async () => {
      const neuro = await loadNeuro();
      const err = new neuro.RoiRequestSupersededError("custom msg");

      expect(neuro.isRoiRequestSupersededError(err)).toBe(true);
      expect(
        neuro.isRoiRequestSupersededError({
          name: "RoiRequestSupersededError",
          message: "test",
        })
      ).toBe(true);
      expect(
        neuro.isRoiRequestSupersededError({
          code: "ROI_REQUEST_SUPERSEDED",
        })
      ).toBe(true);
      expect(neuro.isRoiRequestSupersededError(new Error("generic error"))).toBe(
        false
      );
      expect(neuro.isRoiRequestSupersededError(null)).toBe(false);
      expect(neuro.isRoiRequestSupersededError("string")).toBe(false);
      expect(neuro.isRoiRequestSupersededError(undefined)).toBe(false);
    });
  });
});
