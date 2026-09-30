/**
 * Web Worker for Offloading ROI Segmentation, Marching Squares Vector Contours,
 * 256-Bin Signal Histograms, and Continuous Full-Volume QA Scans.
 *
 * Uses zero-copy Transferable ArrayBuffers for high performance.
 * Imports algorithms directly from `./internal/roi-algorithms` to avoid
 * chunk cycles with Webpack (#853).
 */

import {
  compute256BinHistogram,
  computeMarchingSquares,
  runRegionGrowing,
  scanVolumeQAAnomalies,
} from "./internal/roi-algorithms";
import { ROIWorkerRequest, ROIWorkerResponse } from "./types";

export interface ROIWorkerTarget extends EventTarget {
  postMessage(message: ROIWorkerResponse, transfer?: Transferable[]): void;
}

function getDefaultROIWorkerTarget(): ROIWorkerTarget {
  const target = typeof self !== "undefined" ? self : globalThis;
  return target as unknown as ROIWorkerTarget;
}

/**
 * Core handler processing a single ROIWorkerRequest payload.
 */
export function processROIWorkerRequest(req: ROIWorkerRequest): {
  response: ROIWorkerResponse;
  transferables: ArrayBuffer[];
} {
  const {
    id,
    seq,
    type,
    seed,
    intensityTolerance,
    isovalue,
    rawT1,
    brainmask,
    wmMask,
    dimensions,
    scenarioId,
  } = req;
  const transferables: ArrayBuffer[] = [];

  const dims = dimensions || { width: 96, height: 96, depth: 96 };

  try {
    if (type === "region_grow" && seed && rawT1 && brainmask) {
      const result = runRegionGrowing(
        rawT1,
        brainmask,
        dims,
        seed,
        intensityTolerance || 15
      );
      transferables.push(result.roiMask.buffer as ArrayBuffer);

      const response: ROIWorkerResponse = {
        id,
        seq,
        type,
        success: true,
        segmentation: result,
        roiMask: result.roiMask,
      };
      return { response, transferables };
    }

    if (type === "marching_squares" && rawT1) {
      const width = dims.width;
      const height = dims.height;
      const contours = computeMarchingSquares(
        rawT1,
        width,
        height,
        isovalue || 0.5,
        "#00f5d4",
        `contour-ms-${seq}`
      );

      const response: ROIWorkerResponse = {
        id,
        seq,
        type,
        success: true,
        contours,
      };
      return { response, transferables };
    }

    if (type === "histogram" && rawT1) {
      const histogram = compute256BinHistogram(rawT1, brainmask);
      transferables.push(histogram.bins.buffer as ArrayBuffer);

      const response: ROIWorkerResponse = {
        id,
        seq,
        type,
        success: true,
        histogram,
      };
      return { response, transferables };
    }

    if (type === "qa_scan" && rawT1 && brainmask && wmMask) {
      const scanResult = scanVolumeQAAnomalies({
        dimensions: dims,
        rawT1,
        brainmask,
        wmMask,
        scenarioId,
      });

      const response: ROIWorkerResponse = {
        id,
        seq,
        type,
        success: true,
        qaAlerts: scanResult.alerts,
        scanDurationMs: scanResult.scanDurationMs,
      };
      return { response, transferables };
    }

    return {
      response: {
        id,
        seq,
        type,
        success: false,
        error:
          "Missing required volume buffers or parameters for requested type.",
      },
      transferables: [],
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      response: {
        id,
        seq,
        type,
        success: false,
        error: errorMsg,
      },
      transferables: [],
    };
  }
}

/**
 * Message event handler for incoming worker requests.
 */
export function handleROIWorkerMessage(
  event: MessageEvent<ROIWorkerRequest>,
  target: ROIWorkerTarget = getDefaultROIWorkerTarget()
): void {
  if (!event.data || typeof event.data !== "object") return;
  const { response, transferables } = processROIWorkerRequest(event.data);
  target.postMessage(response, transferables);
}

/**
 * Register ROI worker event listener on the current target scope.
 */
export function registerROIWorker(
  target: ROIWorkerTarget = getDefaultROIWorkerTarget()
): () => void {
  const listener = (event: Event) => {
    handleROIWorkerMessage(event as MessageEvent<ROIWorkerRequest>, target);
  };
  target.addEventListener("message", listener);
  return () => {
    target.removeEventListener("message", listener);
  };
}

if (
  typeof self !== "undefined" &&
  typeof (self as unknown as { importScripts?: unknown }).importScripts ===
    "function"
) {
  registerROIWorker(getDefaultROIWorkerTarget());
}
