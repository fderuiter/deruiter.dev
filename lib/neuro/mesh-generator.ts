/**
 * Procedural High-Fidelity Cortical Surface Mesh Generator for NeuroRecon
 * Generates Pial, White Matter, Inflated, Subcortical (ASEG), and Desikan-Killiany Atlas (APARC)
 * dual-hemisphere 3D meshes with anatomical curvature and FreeSurfer ColorLUT parcellation.
 * Outputs surface and anatomical geometry strictly as raw binary array buffers (Float32Array / Uint32Array)
 * without importing graphics engine runtime packages.
 *
 * The geometry itself lives in `internal/mesh-geometry.ts`; this module adds the
 * Web Worker that offloads it. The worker imports the geometry module, never this
 * one, because this module constructs the worker: importing it from the worker
 * would make the worker's chunk start itself, a runtime chunk cycle (#853).
 */

import { logger } from "@/lib/logger";
import { createCorticalSurfaceMeshBuffers } from "./internal/mesh-geometry";
import {
  computePreviewMarchingCubesStride,
  extractMarchingCubesBuffers,
  type MarchingCubesOptions,
  VOLUME_WORLD_EXTENT,
  voxelToWorld3D,
  world3DToVoxel,
} from "./internal/marching-cubes";
import {
  HemisphereFilter,
  MeshWorkerRequest,
  MeshWorkerResponse,
  RawGeometryBuffer,
  SurfaceMode,
} from "./types";

export {
  createCorticalSurfaceMeshBuffers,
  generateHemisphereBuffers,
  generateSubcorticalBuffers,
  getAnatomicalParcelAtCoordinate,
} from "./internal/mesh-geometry";

export {
  computePreviewMarchingCubesStride,
  extractMarchingCubesBuffers,
  type MarchingCubesOptions,
  VOLUME_WORLD_EXTENT,
  voxelToWorld3D,
  world3DToVoxel,
};

// Background Web Worker Management & Async Interface

/**
 * One in-flight request. `settle` resolves it with the worker's buffers or,
 * given `null`, with the main-thread fallback. It runs at most once and clears
 * the request's timer, so removing a waiter always means it has settled
 * (#3796).
 */
interface PendingMeshRequest {
  settle: (response: MeshWorkerResponse | null) => void;
}

let workerInstance: Worker | null = null;
let requestCounter = 0;
const pendingRequests = new Map<string, PendingMeshRequest>();

/**
 * Settles every in-flight request with the main-thread fallback and retires
 * `failed`, if it is still the installed worker, so the next request starts a
 * fresh one.
 */
function retireMeshWorker(failed: Worker): void {
  const waiting = [...pendingRequests.values()];
  pendingRequests.clear();
  if (workerInstance === failed) {
    workerInstance = null;
    failed.terminate();
  }
  for (const request of waiting) request.settle(null);
}

function getMeshWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }

  if (!workerInstance) {
    try {
      const worker = new Worker(new URL("./mesh-worker.ts", import.meta.url));
      worker.onmessage = (event: MessageEvent<MeshWorkerResponse>) => {
        if (workerInstance !== worker) return;
        const { id } = event.data;
        if (!id) return;
        const request = pendingRequests.get(id);
        if (request) {
          pendingRequests.delete(id);
          request.settle(event.data);
        }
      };
      worker.onerror = (err) => {
        logger.warn("Mesh generator Web Worker error:", err);
        retireMeshWorker(worker);
      };
      workerInstance = worker;
    } catch {
      workerInstance = null;
    }
  }

  return workerInstance;
}

/**
 * Offloads vertex spatial point checks and Desikan-Killiany atlas parcellations
 * to a background Web Worker thread, returning raw binary ArrayBuffers via zero-copy transfers.
 */
export async function createCorticalSurfaceMeshBuffersAsync(
  mode: SurfaceMode = "pial",
  wireframe = false,
  hemiFilter: HemisphereFilter = "both"
): Promise<RawGeometryBuffer[]> {
  const worker = getMeshWorker();

  if (!worker) {
    return createCorticalSurfaceMeshBuffers(mode, wireframe, hemiFilter);
  }

  return new Promise((resolve) => {
    const requestId = `mesh_req_${++requestCounter}`;
    let settled = false;

    const settle = (response: MeshWorkerResponse | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(
        response
          ? response.buffers
          : createCorticalSurfaceMeshBuffers(mode, wireframe, hemiFilter)
      );
    };

    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      settle(null);
    }, 1000);

    pendingRequests.set(requestId, { settle });

    const request: MeshWorkerRequest = {
      id: requestId,
      mode,
      hemiFilter,
      wireframe,
    };

    try {
      worker.postMessage(request);
    } catch (err) {
      logger.warn("Mesh generator Web Worker postMessage failed:", err);
      retireMeshWorker(worker);
    }
  });
}

/**
 * Reconstruct 3D Marching Cubes tissue isosurfaces asynchronously in `mesh-worker.ts`
 * using zero-copy Transferable ArrayBuffers, falling back to main-thread extraction
 * when Web Workers are unavailable.
 */
export async function extractVolumeIsosurfaceBuffersAsync(
  options: MarchingCubesOptions & { readonly preview?: boolean }
): Promise<RawGeometryBuffer[]> {
  const downsampleStride =
    options.downsampleStride ??
    (options.preview
      ? computePreviewMarchingCubesStride(options.dimensions)
      : 1);
  const resolvedOptions: MarchingCubesOptions = {
    ...options,
    downsampleStride,
  };

  const worker = getMeshWorker();
  if (!worker) {
    return extractMarchingCubesBuffers(resolvedOptions);
  }

  return new Promise((resolve) => {
    const requestId = `mesh_mc_${++requestCounter}`;
    let settled = false;

    const settle = (response: MeshWorkerResponse | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(
        response
          ? response.buffers
          : extractMarchingCubesBuffers(resolvedOptions)
      );
    };

    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      settle(null);
    }, 4000);

    pendingRequests.set(requestId, { settle });

    const volBuffer = options.volumeData.slice().buffer;
    const maskBuffer = options.maskData
      ? options.maskData.slice().buffer
      : undefined;
    const transfers: ArrayBuffer[] = [volBuffer];
    if (maskBuffer) transfers.push(maskBuffer);

    const request: MeshWorkerRequest = {
      id: requestId,
      mode: options.mode ?? "pial",
      hemiFilter: options.hemiFilter ?? "both",
      wireframe: false,
      extractionMode: "marching_cubes",
      volumeData: new Uint8Array(volBuffer),
      maskData: maskBuffer ? new Uint8Array(maskBuffer) : undefined,
      dimensions: options.dimensions,
      spacing: options.spacing,
      isovalue: options.isovalue,
      downsampleStride,
    };

    try {
      worker.postMessage(request, transfers);
    } catch (err) {
      logger.warn("Mesh Marching Cubes worker postMessage failed:", err);
      retireMeshWorker(worker);
    }
  });
}
