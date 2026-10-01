/**
 * NeuroRecon ROI Analytics & Marching Squares Client Management Module
 * Manages background execution on `roi-analytics-worker.ts`, cancellation tokens
 * for rapid user scrolling, zero-copy ArrayBuffer transfers, and main-thread fallbacks.
 */

import { logger } from "@/lib/logger";
import {
  compute256BinHistogram,
  computeMarchingSquares,
  runRegionGrowing,
  scanVolumeQAAnomalies,
} from "./internal/roi-algorithms";
import {
  HistogramStats,
  QAAnomalyAlert,
  ROISegmentationResult,
  ROIWorkerRequest,
  ROIWorkerResponse,
  ScenarioId,
  VectorContourPath,
  VoxelCoord,
} from "./types";

let workerInstance: Worker | null = null;
let globalSequence = 0;
const pendingRequests = new Map<
  string,
  (response: ROIWorkerResponse) => void
>();
const latestSequenceByTask = new Map<string, number>();

function getROIWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }

  if (!workerInstance) {
    try {
      workerInstance = new Worker(
        new URL("./roi-analytics-worker.ts", import.meta.url)
      );
      workerInstance.onmessage = (event: MessageEvent<ROIWorkerResponse>) => {
        const { id, seq, type } = event.data;
        if (!id) return;

        // Check cancellation token (ignore stale requests)
        const latestSeq = latestSequenceByTask.get(type) || 0;
        if (seq < latestSeq) {
          pendingRequests.delete(id);
          return;
        }

        const callback = pendingRequests.get(id);
        if (callback) {
          pendingRequests.delete(id);
          callback(event.data);
        }
      };

      workerInstance.onerror = (err) => {
        logger.warn("ROI Analytics Web Worker error:", err);
        pendingRequests.clear();
      };
    } catch {
      workerInstance = null;
    }
  }

  return workerInstance;
}

/**
 * Perform 3D automated region growing segmentation asynchronously via worker with zero-copy transfer.
 */
export async function requestROISegmentationAsync(
  rawT1: Uint8Array,
  brainmask: Uint8Array,
  dimensions: { width: number; height: number; depth: number },
  seed: VoxelCoord,
  intensityTolerance = 15
): Promise<ROISegmentationResult> {
  const worker = getROIWorker();
  const seq = ++globalSequence;
  latestSequenceByTask.set("region_grow", seq);

  if (!worker) {
    return runRegionGrowing(
      rawT1,
      brainmask,
      dimensions,
      seed,
      intensityTolerance
    );
  }

  return new Promise((resolve) => {
    const requestId = `roi_grow_${seq}`;

    const timeout = setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        resolve(
          runRegionGrowing(
            rawT1,
            brainmask,
            dimensions,
            seed,
            intensityTolerance
          )
        );
      }
    }, 1000);

    pendingRequests.set(requestId, (res) => {
      clearTimeout(timeout);
      if (res.success && res.segmentation) {
        resolve(res.segmentation);
      } else {
        resolve(
          runRegionGrowing(
            rawT1,
            brainmask,
            dimensions,
            seed,
            intensityTolerance
          )
        );
      }
    });

    const rawT1Buffer = rawT1.slice().buffer;
    const brainmaskBuffer = brainmask.slice().buffer;

    const request: ROIWorkerRequest = {
      id: requestId,
      seq,
      type: "region_grow",
      seed,
      intensityTolerance,
      dimensions,
      rawT1: new Uint8Array(rawT1Buffer),
      brainmask: new Uint8Array(brainmaskBuffer),
    };

    worker.postMessage(request, [rawT1Buffer, brainmaskBuffer]);
  });
}

/**
 * Calculate 2D Marching Squares vector contours asynchronously via worker.
 */
export async function requestMarchingSquaresAsync(
  pixelsOrMask: Uint8Array,
  width: number,
  height: number,
  isovalue = 0.5
): Promise<VectorContourPath[]> {
  const worker = getROIWorker();
  const seq = ++globalSequence;
  latestSequenceByTask.set("marching_squares", seq);

  if (!worker) {
    return computeMarchingSquares(pixelsOrMask, width, height, isovalue);
  }

  return new Promise((resolve) => {
    const requestId = `ms_contour_${seq}`;

    const timeout = setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        resolve(computeMarchingSquares(pixelsOrMask, width, height, isovalue));
      }
    }, 1000);

    pendingRequests.set(requestId, (res) => {
      clearTimeout(timeout);
      if (res.success && res.contours) {
        resolve(res.contours);
      } else {
        resolve(computeMarchingSquares(pixelsOrMask, width, height, isovalue));
      }
    });

    const pixelBuffer = pixelsOrMask.slice().buffer;

    const request: ROIWorkerRequest = {
      id: requestId,
      seq,
      type: "marching_squares",
      dimensions: { width, height, depth: 1 },
      isovalue,
      rawT1: new Uint8Array(pixelBuffer),
    };

    worker.postMessage(request, [pixelBuffer]);
  });
}

/**
 * Aggregate 256-bin signal intensity histogram asynchronously via worker.
 */
export async function requestHistogramAsync(
  data: Uint8Array,
  mask?: Uint8Array
): Promise<HistogramStats> {
  const worker = getROIWorker();
  const seq = ++globalSequence;
  latestSequenceByTask.set("histogram", seq);

  if (!worker) {
    return compute256BinHistogram(data, mask);
  }

  return new Promise((resolve) => {
    const requestId = `histogram_${seq}`;

    const timeout = setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        resolve(compute256BinHistogram(data, mask));
      }
    }, 1000);

    pendingRequests.set(requestId, (res) => {
      clearTimeout(timeout);
      if (res.success && res.histogram) {
        resolve(res.histogram);
      } else {
        resolve(compute256BinHistogram(data, mask));
      }
    });

    const dataBuf = data.slice().buffer;
    const maskBuf = mask ? mask.slice().buffer : undefined;

    const request: ROIWorkerRequest = {
      id: requestId,
      seq,
      type: "histogram",
      rawT1: new Uint8Array(dataBuf),
      brainmask: maskBuf ? new Uint8Array(maskBuf) : undefined,
    };

    const transfers: ArrayBuffer[] = [dataBuf];
    if (maskBuf) transfers.push(maskBuf);

    worker.postMessage(request, transfers);
  });
}

/**
 * Perform continuous full-volume QA anomaly scan asynchronously via worker.
 */
export async function requestVolumeQAScanAsync(volume: {
  dimensions: { width: number; height: number; depth: number };
  rawT1: Uint8Array;
  brainmask: Uint8Array;
  wmMask: Uint8Array;
  defectRegion?: { min: VoxelCoord; max: VoxelCoord };
  scenarioId?: ScenarioId;
}): Promise<{ alerts: QAAnomalyAlert[]; scanDurationMs: number }> {
  const worker = getROIWorker();
  const seq = ++globalSequence;
  latestSequenceByTask.set("qa_scan", seq);

  if (!worker) {
    return scanVolumeQAAnomalies(volume);
  }

  return new Promise((resolve) => {
    const requestId = `qa_scan_${seq}`;

    const timeout = setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        resolve(scanVolumeQAAnomalies(volume));
      }
    }, 1000);

    pendingRequests.set(requestId, (res) => {
      clearTimeout(timeout);
      if (res.success && res.qaAlerts) {
        resolve({
          alerts: res.qaAlerts,
          scanDurationMs: res.scanDurationMs || 0,
        });
      } else {
        resolve(scanVolumeQAAnomalies(volume));
      }
    });

    const rawT1Buf = volume.rawT1.slice().buffer;
    const brainmaskBuf = volume.brainmask.slice().buffer;
    const wmMaskBuf = volume.wmMask.slice().buffer;

    const request: ROIWorkerRequest = {
      id: requestId,
      seq,
      type: "qa_scan",
      dimensions: volume.dimensions,
      scenarioId: volume.scenarioId,
      rawT1: new Uint8Array(rawT1Buf),
      brainmask: new Uint8Array(brainmaskBuf),
      wmMask: new Uint8Array(wmMaskBuf),
    };

    worker.postMessage(request, [rawT1Buf, brainmaskBuf, wmMaskBuf]);
  });
}

export {
  compute256BinHistogram,
  computeMarchingSquares,
  runRegionGrowing,
  scanVolumeQAAnomalies,
} from "./internal/roi-algorithms";
