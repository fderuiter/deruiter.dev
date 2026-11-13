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

/**
 * Error rejected when an asynchronous ROI background task is superseded by a newer request
 * belonging to the same task family before its result can be applied (#3797).
 */
export class RoiRequestSupersededError extends Error {
  readonly code = "ROI_REQUEST_SUPERSEDED" as const;

  constructor(message = "ROI request superseded by a newer operation") {
    super(message);
    this.name = "RoiRequestSupersededError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Type guard to check whether an unknown error is an instance of `RoiRequestSupersededError`.
 *
 * @param error - Candidate error to evaluate.
 * @returns True when the candidate is a superseded request error.
 */
export function isRoiRequestSupersededError(
  error: unknown
): error is RoiRequestSupersededError {
  if (!error || (typeof error !== "object" && typeof error !== "function")) {
    return false;
  }
  return (
    error instanceof RoiRequestSupersededError ||
    ("name" in error &&
      (error as { name: unknown }).name === "RoiRequestSupersededError") ||
    ("code" in error &&
      (error as { code: unknown }).code === "ROI_REQUEST_SUPERSEDED")
  );
}

interface PendingROIRequest {
  id: string;
  seq: number;
  type: ROIWorkerRequest["type"];
  timeoutId: ReturnType<typeof setTimeout>;
  onWorkerSuccess: (response: ROIWorkerResponse) => void;
  onWorkerFailure: () => void;
  onSuperseded: () => void;
}

let workerInstance: Worker | null = null;
let globalSequence = 0;
const pendingRequests = new Map<string, PendingROIRequest>();
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
        if (!event.data || typeof event.data !== "object") return;
        const { id } = event.data;
        if (!id) return;

        const pending = pendingRequests.get(id);
        if (!pending) return;

        // Check cancellation token (ignore stale requests)
        const latestSeq = latestSequenceByTask.get(pending.type) || 0;
        if (pending.seq < latestSeq) {
          pendingRequests.delete(id);
          clearTimeout(pending.timeoutId);
          pending.onSuperseded();
          return;
        }

        pendingRequests.delete(id);
        clearTimeout(pending.timeoutId);
        if (event.data.success) {
          pending.onWorkerSuccess(event.data);
        } else {
          pending.onWorkerFailure();
        }
      };

      const worker = workerInstance;
      worker.onerror = (err) => {
        logger.warn("ROI Analytics Web Worker error:", err);
        // Settle every in-flight request through its main-thread fallback
        // or supersession, and retire the crashed worker so the next request
        // starts a fresh one (#2532, #3797).
        const inFlight = [...pendingRequests.values()];
        pendingRequests.clear();
        worker.terminate();
        if (workerInstance === worker) workerInstance = null;
        for (const pending of inFlight) {
          clearTimeout(pending.timeoutId);
        }
        for (const pending of inFlight) {
          try {
            const latestSeq = latestSequenceByTask.get(pending.type) || 0;
            if (pending.seq < latestSeq) {
              pending.onSuperseded();
            } else {
              pending.onWorkerFailure();
            }
          } catch (settleError) {
            logger.warn(
              "Error settling in-flight ROI request on worker crash:",
              settleError
            );
          }
        }
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

  return new Promise((resolve, reject) => {
    const requestId = `roi_grow_${seq}`;

    const timeoutId = setTimeout(() => {
      const pending = pendingRequests.get(requestId);
      if (!pending) return;
      pendingRequests.delete(requestId);

      const latestSeq = latestSequenceByTask.get(pending.type) || 0;
      if (pending.seq < latestSeq) {
        pending.onSuperseded();
      } else {
        pending.onWorkerFailure();
      }
    }, 1000);

    const pending: PendingROIRequest = {
      id: requestId,
      seq,
      type: "region_grow",
      timeoutId,
      onWorkerSuccess: (res) => {
        try {
          if (res.segmentation) {
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
        } catch (err) {
          reject(err);
        }
      },
      onWorkerFailure: () => {
        try {
          resolve(
            runRegionGrowing(
              rawT1,
              brainmask,
              dimensions,
              seed,
              intensityTolerance
            )
          );
        } catch (err) {
          reject(err);
        }
      },
      onSuperseded: () => {
        reject(
          new RoiRequestSupersededError(
            `ROI region_grow request ${requestId} superseded`
          )
        );
      },
    };

    pendingRequests.set(requestId, pending);

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

    try {
      worker.postMessage(request, [rawT1Buffer, brainmaskBuffer]);
    } catch {
      clearTimeout(timeoutId);
      pendingRequests.delete(requestId);
      try {
        resolve(
          runRegionGrowing(
            rawT1,
            brainmask,
            dimensions,
            seed,
            intensityTolerance
          )
        );
      } catch (err) {
        reject(err);
      }
    }
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

  return new Promise((resolve, reject) => {
    const requestId = `ms_contour_${seq}`;

    const timeoutId = setTimeout(() => {
      const pending = pendingRequests.get(requestId);
      if (!pending) return;
      pendingRequests.delete(requestId);

      const latestSeq = latestSequenceByTask.get(pending.type) || 0;
      if (pending.seq < latestSeq) {
        pending.onSuperseded();
      } else {
        pending.onWorkerFailure();
      }
    }, 1000);

    const pending: PendingROIRequest = {
      id: requestId,
      seq,
      type: "marching_squares",
      timeoutId,
      onWorkerSuccess: (res) => {
        try {
          if (res.contours) {
            resolve(res.contours);
          } else {
            resolve(computeMarchingSquares(pixelsOrMask, width, height, isovalue));
          }
        } catch (err) {
          reject(err);
        }
      },
      onWorkerFailure: () => {
        try {
          resolve(computeMarchingSquares(pixelsOrMask, width, height, isovalue));
        } catch (err) {
          reject(err);
        }
      },
      onSuperseded: () => {
        reject(
          new RoiRequestSupersededError(
            `ROI marching_squares request ${requestId} superseded`
          )
        );
      },
    };

    pendingRequests.set(requestId, pending);

    const pixelBuffer = pixelsOrMask.slice().buffer;

    const request: ROIWorkerRequest = {
      id: requestId,
      seq,
      type: "marching_squares",
      dimensions: { width, height, depth: 1 },
      isovalue,
      rawT1: new Uint8Array(pixelBuffer),
    };

    try {
      worker.postMessage(request, [pixelBuffer]);
    } catch {
      clearTimeout(timeoutId);
      pendingRequests.delete(requestId);
      try {
        resolve(computeMarchingSquares(pixelsOrMask, width, height, isovalue));
      } catch (err) {
        reject(err);
      }
    }
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

  return new Promise((resolve, reject) => {
    const requestId = `histogram_${seq}`;

    const timeoutId = setTimeout(() => {
      const pending = pendingRequests.get(requestId);
      if (!pending) return;
      pendingRequests.delete(requestId);

      const latestSeq = latestSequenceByTask.get(pending.type) || 0;
      if (pending.seq < latestSeq) {
        pending.onSuperseded();
      } else {
        pending.onWorkerFailure();
      }
    }, 1000);

    const pending: PendingROIRequest = {
      id: requestId,
      seq,
      type: "histogram",
      timeoutId,
      onWorkerSuccess: (res) => {
        try {
          if (res.histogram) {
            resolve(res.histogram);
          } else {
            resolve(compute256BinHistogram(data, mask));
          }
        } catch (err) {
          reject(err);
        }
      },
      onWorkerFailure: () => {
        try {
          resolve(compute256BinHistogram(data, mask));
        } catch (err) {
          reject(err);
        }
      },
      onSuperseded: () => {
        reject(
          new RoiRequestSupersededError(
            `ROI histogram request ${requestId} superseded`
          )
        );
      },
    };

    pendingRequests.set(requestId, pending);

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

    try {
      worker.postMessage(request, transfers);
    } catch {
      clearTimeout(timeoutId);
      pendingRequests.delete(requestId);
      try {
        resolve(compute256BinHistogram(data, mask));
      } catch (err) {
        reject(err);
      }
    }
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

  return new Promise((resolve, reject) => {
    const requestId = `qa_scan_${seq}`;

    const timeoutId = setTimeout(() => {
      const pending = pendingRequests.get(requestId);
      if (!pending) return;
      pendingRequests.delete(requestId);

      const latestSeq = latestSequenceByTask.get(pending.type) || 0;
      if (pending.seq < latestSeq) {
        pending.onSuperseded();
      } else {
        pending.onWorkerFailure();
      }
    }, 1000);

    const pending: PendingROIRequest = {
      id: requestId,
      seq,
      type: "qa_scan",
      timeoutId,
      onWorkerSuccess: (res) => {
        try {
          if (res.qaAlerts) {
            resolve({
              alerts: res.qaAlerts,
              scanDurationMs: res.scanDurationMs || 0,
            });
          } else {
            resolve(scanVolumeQAAnomalies(volume));
          }
        } catch (err) {
          reject(err);
        }
      },
      onWorkerFailure: () => {
        try {
          resolve(scanVolumeQAAnomalies(volume));
        } catch (err) {
          reject(err);
        }
      },
      onSuperseded: () => {
        reject(
          new RoiRequestSupersededError(
            `ROI qa_scan request ${requestId} superseded`
          )
        );
      },
    };

    pendingRequests.set(requestId, pending);

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

    try {
      worker.postMessage(request, [rawT1Buf, brainmaskBuf, wmMaskBuf]);
    } catch {
      clearTimeout(timeoutId);
      pendingRequests.delete(requestId);
      try {
        resolve(scanVolumeQAAnomalies(volume));
      } catch (err) {
        reject(err);
      }
    }
  });
}

export {
  compute256BinHistogram,
  computeMarchingSquares,
  runRegionGrowing,
  scanVolumeQAAnomalies,
} from "./internal/roi-algorithms";
