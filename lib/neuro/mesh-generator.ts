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
import {
  createCorticalSurfaceMeshBuffers,
  generateHemisphereBuffers,
  generateSubcorticalBuffers,
  getAnatomicalParcelAtCoordinate,
} from "./internal/mesh-geometry";
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
};

// Background Web Worker Management & Async Interface
let workerInstance: Worker | null = null;
let requestCounter = 0;
const pendingRequests = new Map<
  string,
  (response: MeshWorkerResponse) => void
>();

function getMeshWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return null;
  }

  if (!workerInstance) {
    try {
      workerInstance = new Worker(new URL("./mesh-worker.ts", import.meta.url));
      workerInstance.onmessage = (event: MessageEvent<MeshWorkerResponse>) => {
        const { id } = event.data;
        if (!id) return;
        const callback = pendingRequests.get(id);
        if (callback) {
          pendingRequests.delete(id);
          callback(event.data);
        }
      };
      workerInstance.onerror = (err) => {
        logger.warn("Mesh generator Web Worker error:", err);
        pendingRequests.clear();
      };
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

    const timeout = setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        resolve(createCorticalSurfaceMeshBuffers(mode, wireframe, hemiFilter));
      }
    }, 1000);

    pendingRequests.set(requestId, (response: MeshWorkerResponse) => {
      clearTimeout(timeout);
      resolve(response.buffers);
    });

    const request: MeshWorkerRequest = {
      id: requestId,
      mode,
      hemiFilter,
      wireframe,
    };

    worker.postMessage(request);
  });
}
