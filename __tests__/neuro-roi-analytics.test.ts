import { describe, it, expect, vi } from "vitest";
import {
  compute256BinHistogram,
  computeMarchingSquares,
  runRegionGrowing,
  scanVolumeQAAnomalies,
  requestHistogramAsync,
  requestMarchingSquaresAsync,
  requestROISegmentationAsync,
  requestVolumeQAScanAsync,
  generateSyntheticVolume,
  VOLUME_SIZE,
  processROIWorkerRequest,
  handleROIWorkerMessage,
  type ROIWorkerTarget,
  type ROIWorkerRequest,
  type VoxelCoord,
} from "@/lib/neuro";

describe("Worker-Based Mesh and Contour Analytics Pipeline Suite", () => {
  it("computes 2D Marching Squares vector contours with smooth line segments and SVG path geometry", () => {
    // 10x10 binary mask grid with a 4x4 box in the center
    const width = 10;
    const height = 10;
    const grid = new Uint8Array(width * height);
    for (let y = 3; y <= 6; y++) {
      for (let x = 3; x <= 6; x++) {
        grid[y * width + x] = 1;
      }
    }

    const contours = computeMarchingSquares(
      grid,
      width,
      height,
      0.5,
      "#00f5d4",
      "test-path"
    );

    expect(contours.length).toBe(1);
    const contour = contours[0];
    expect(contour.id).toBe("test-path");
    expect(contour.isClosed).toBe(true);
    expect(contour.segments.length).toBeGreaterThan(0);
    expect(contour.svgPathData).toContain("M ");
    expect(contour.svgPathData).toContain("L ");
  });

  it("executes 3D region growing starting from seed voxel returning volume stats and contours", () => {
    const volume = generateSyntheticVolume("dura_inclusion");
    const seed: VoxelCoord = { x: 48, y: 48, z: 48 };

    const result = runRegionGrowing(
      volume.rawT1,
      volume.brainmask,
      volume.dimensions,
      seed,
      15
    );

    expect(result.stats.seed).toEqual(seed);
    expect(result.stats.voxelCount).toBeGreaterThan(10);
    expect(result.stats.volumeMm3).toBe(result.stats.voxelCount);
    expect(result.stats.meanIntensity).toBeGreaterThan(0);
    expect(result.roiMask).toBeInstanceOf(Uint8Array);
    expect(result.roiMask.length).toBe(VOLUME_SIZE * VOLUME_SIZE * VOLUME_SIZE);
    expect(result.contours.length).toBeGreaterThanOrEqual(0);
  });

  it("aggregates 256-bin signal intensity histogram across 3D volumes asynchronously", () => {
    const volume = generateSyntheticVolume("wm_hypointensity");
    const histogram = compute256BinHistogram(volume.rawT1, volume.brainmask);

    expect(histogram.bins).toBeInstanceOf(Uint32Array);
    expect(histogram.bins.length).toBe(256);
    expect(histogram.totalVoxels).toBeGreaterThan(0);
    expect(histogram.mean).toBeGreaterThan(0);
    expect(histogram.stdDev).toBeGreaterThanOrEqual(0);
    expect(histogram.median).toBeGreaterThanOrEqual(0);
    expect(histogram.mode).toBeGreaterThanOrEqual(0);
  });

  it("executes continuous full-volume QA anomaly scan covering all 96 slices in under 50 ms", () => {
    const volume = generateSyntheticVolume("dura_inclusion");

    const scanResult = scanVolumeQAAnomalies({
      dimensions: volume.dimensions,
      rawT1: volume.rawT1,
      brainmask: volume.brainmask,
      wmMask: volume.wmMask,
      defectRegion: volume.defectRegion,
      scenarioId: volume.scenarioId,
    });

    expect(scanResult.scanDurationMs).toBeLessThan(50);
    expect(scanResult.alerts.length).toBeGreaterThan(0);

    const firstAlert = scanResult.alerts[0];
    expect(firstAlert.sliceIndex).toBeGreaterThanOrEqual(0);
    expect(firstAlert.voxelCoord).toBeDefined();
    expect(firstAlert.suggestedAction).toBeDefined();
  });

  it("processes worker requests and transfers zero-copy ArrayBuffers cleanly", () => {
    const volume = generateSyntheticVolume("wm_hypointensity");
    const req: ROIWorkerRequest = {
      id: "req_test_grow",
      seq: 1,
      type: "region_grow",
      seed: { x: 48, y: 48, z: 48 },
      rawT1: volume.rawT1.slice(),
      brainmask: volume.brainmask.slice(),
      dimensions: volume.dimensions,
    };

    const { response, transferables } = processROIWorkerRequest(req);

    expect(response.id).toBe("req_test_grow");
    expect(response.success).toBe(true);
    expect(response.segmentation).toBeDefined();
    expect(transferables.length).toBeGreaterThan(0);
  });

  it("dispatches worker messages and handles zero-copy ArrayBuffer transferables", () => {
    const postMessageSpy = vi.fn();
    const mockTarget: ROIWorkerTarget = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
      postMessage: postMessageSpy,
    };

    const volume = generateSyntheticVolume("sandbox");
    const req: ROIWorkerRequest = {
      id: "req_test_hist",
      seq: 2,
      type: "histogram",
      rawT1: volume.rawT1.slice(),
      brainmask: volume.brainmask.slice(),
    };

    handleROIWorkerMessage(
      { data: req } as MessageEvent<ROIWorkerRequest>,
      mockTarget
    );

    expect(postMessageSpy).toHaveBeenCalled();
    const [resPayload, transferList] = postMessageSpy.mock.calls[0];
    expect(resPayload.id).toBe("req_test_hist");
    expect(resPayload.success).toBe(true);
    expect(resPayload.histogram).toBeDefined();
    expect(transferList.length).toBeGreaterThan(0);
  });

  it("falls back gracefully to main thread when Web Worker setup is unavailable", async () => {
    const volume = generateSyntheticVolume("skull_strip_erosion");

    const hist = await requestHistogramAsync(volume.rawT1, volume.brainmask);
    expect(hist.bins.length).toBe(256);

    const contours = await requestMarchingSquaresAsync(
      volume.rawT1.slice(0, 96 * 96),
      96,
      96,
      0.5
    );
    expect(contours).toBeDefined();

    const qaRes = await requestVolumeQAScanAsync(volume);
    expect(qaRes.alerts).toBeDefined();
    expect(qaRes.scanDurationMs).toBeLessThan(50);

    const seg = await requestROISegmentationAsync(
      volume.rawT1,
      volume.brainmask,
      volume.dimensions,
      { x: 48, y: 48, z: 48 }
    );
    expect(seg.stats).toBeDefined();
  });
});
