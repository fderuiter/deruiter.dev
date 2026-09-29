/**
 * NeuroRecon External Asset Loader & Cache
 * Loads real 3D brain models (GLB, GLTF, OBJ) and delivers raw geometry array buffers.
 * Caches raw binary array buffers instead of live GPU scene objects to allow garbage collection.
 * Completely isolates engine parsing utilities with zero top-level graphics library imports.
 */

import { createCorticalSurfaceMeshBuffers } from "./mesh-generator";
import { HemisphereFilter, RawGeometryBuffer, SurfaceMode } from "./types";
import { progressBus } from "./progress-bus";
import { logger } from "@/lib/logger";
import {
  createMeshGroupFromBuffers,
  loadGraphicsEngine,
} from "./engine-loader";

const rawBufferCache = new Map<string, RawGeometryBuffer[]>();

/**
 * Deep clone raw geometry buffers to ensure caller isolation.
 */
function cloneRawBuffers(buffers: RawGeometryBuffer[]): RawGeometryBuffer[] {
  return buffers.map((buf) => ({
    name: buf.name,
    hemi: buf.hemi,
    positions: new Float32Array(buf.positions),
    normals: buf.normals ? new Float32Array(buf.normals) : undefined,
    colors: buf.colors ? new Float32Array(buf.colors) : undefined,
    indices: new Uint32Array(buf.indices),
    color: buf.color,
  }));
}

/**
 * Load external 3D brain model (.glb, .gltf, or .obj) and extract raw vertex and index data buffers.
 * Stores raw geometry buffers in persistent module memory rather than live engine scene objects.
 */
/* jscpd:ignore-start */
export async function loadExternalBrainBuffers(
  modelUrl: string,
  mode: SurfaceMode = "pial",
  hemiFilter: HemisphereFilter = "both"
): Promise<RawGeometryBuffer[]> {
  const cacheKey = `${modelUrl}_${mode}_${hemiFilter}`;
  if (rawBufferCache.has(cacheKey)) {
    const cached = rawBufferCache.get(cacheKey)!;
    return cloneRawBuffers(cached);
  }

  let lastLoaded = 0;
  let lastTotal = 0;

  const handleProgress = (event: ProgressEvent) => {
    const loaded = event?.loaded || 0;
    const total = event?.total || 0;
    lastLoaded = loaded;
    lastTotal = total;
    const percentage =
      total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
    progressBus.publish({
      url: modelUrl,
      loaded,
      total,
      percentage,
      status: "loading",
    });
  };

  // Publish initial loading state event
  progressBus.publish({
    url: modelUrl,
    loaded: 0,
    total: 0,
    percentage: 0,
    status: "loading",
  });

  try {
    const isObj = modelUrl.endsWith(".obj");
    const THREE = await loadGraphicsEngine();

    const rawBuffers: RawGeometryBuffer[] = [];

    if (isObj) {
      const { OBJLoader } =
        await import("three/examples/jsm/loaders/OBJLoader.js");
      const loader = new OBJLoader();
      const obj = await new Promise<import("three").Group>(
        (resolve, reject) => {
          loader.load(modelUrl, resolve, handleProgress, reject);
        }
      );

      // Apply standard clinical brain material
      const material = new THREE.MeshStandardMaterial({
        color: 0x93c5fd, // Light sky blue
        roughness: 0.35,
        metalness: 0.15,
        side: THREE.DoubleSide,
      });

      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = material;
          child.geometry.computeVertexNormals();
        }
      });

      // Center and normalize scale
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 3.2 / (maxDim || 1);
      obj.scale.set(scale, scale, scale);

      const center = new THREE.Vector3();
      box.getCenter(center);
      obj.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      obj.updateMatrixWorld(true);

      obj.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          const geom = child.geometry.clone();
          geom.applyMatrix4(child.matrixWorld);
          const posAttr = geom.getAttribute("position");
          const normAttr = geom.getAttribute("normal");
          const colAttr = geom.getAttribute("color");
          const indexAttr = geom.getIndex();

          if (posAttr) {
            const positions = new Float32Array(posAttr.array);
            const normals = normAttr
              ? new Float32Array(normAttr.array)
              : undefined;
            const colors = colAttr
              ? new Float32Array(colAttr.array)
              : undefined;
            let indices: Uint32Array;
            if (indexAttr) {
              indices = new Uint32Array(indexAttr.array);
            } else {
              indices = new Uint32Array(posAttr.count);
              for (let i = 0; i < posAttr.count; i++) indices[i] = i;
            }

            rawBuffers.push({
              name: child.name || "obj_mesh",
              positions,
              normals,
              colors,
              indices,
              color: 0x93c5fd,
            });
          }
        }
      });
    } else {
      // GLTF / GLB loader
      const { GLTFLoader } =
        await import("three/examples/jsm/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      const gltf = await new Promise<{ scene: import("three").Group }>(
        (resolve, reject) => {
          loader.load(modelUrl, resolve, handleProgress, reject);
        }
      );

      const model = gltf.scene;

      // Center and normalize scale
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 3.2 / (maxDim || 1);
      model.scale.set(scale, scale, scale);

      const center = new THREE.Vector3();
      box.getCenter(center);
      model.position.set(
        -center.x * scale,
        -center.y * scale,
        -center.z * scale
      );
      model.updateMatrixWorld(true);

      model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          const geom = child.geometry.clone();
          geom.applyMatrix4(child.matrixWorld);
          const posAttr = geom.getAttribute("position");
          const normAttr = geom.getAttribute("normal");
          const colAttr = geom.getAttribute("color");
          const indexAttr = geom.getIndex();

          if (posAttr) {
            const positions = new Float32Array(posAttr.array);
            const normals = normAttr
              ? new Float32Array(normAttr.array)
              : undefined;
            const colors = colAttr
              ? new Float32Array(colAttr.array)
              : undefined;
            let indices: Uint32Array;
            if (indexAttr) {
              indices = new Uint32Array(indexAttr.array);
            } else {
              indices = new Uint32Array(posAttr.count);
              for (let i = 0; i < posAttr.count; i++) indices[i] = i;
            }

            rawBuffers.push({
              name: child.name || "gltf_mesh",
              positions,
              normals,
              colors,
              indices,
            });
          }
/* jscpd:ignore-end */
        }
      });
    }

    if (rawBuffers.length === 0) {
      throw new Error(
        "Parsed external 3D asset contains zero valid mesh geometries."
      );
    }

    const finalLoaded = lastTotal || lastLoaded;
    const finalTotal = lastTotal || lastLoaded;
    progressBus.publish({
      url: modelUrl,
      loaded: finalLoaded,
      total: finalTotal,
      percentage: 100,
      status: "complete",
    });

    rawBufferCache.set(cacheKey, rawBuffers);
    return cloneRawBuffers(rawBuffers);
  } catch (err) {
    progressBus.publish({
      url: modelUrl,
      loaded: lastLoaded,
      total: lastTotal,
      percentage: 0,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    });

    // Graceful fallback to procedural cortical surface mesh array buffers
    logger.warn(
      `Failed to load external model from ${modelUrl}, falling back to procedural mesh:`,
      err
    );
    const fallbackBuffers = createCorticalSurfaceMeshBuffers(
      mode,
      false,
      hemiFilter
    );
    rawBufferCache.set(cacheKey, fallbackBuffers);
    return cloneRawBuffers(fallbackBuffers);
  }
}

/**
 * Convenience wrapper returning THREE.Group scene object constructed on-demand from raw geometry buffers.
 */
export async function loadExternalBrainMesh(
  modelUrl: string,
  mode: SurfaceMode = "pial",
  hemiFilter: HemisphereFilter = "both"
): Promise<import("three").Group> {
  const buffers = await loadExternalBrainBuffers(modelUrl, mode, hemiFilter);
  const THREE = await loadGraphicsEngine();
  return createMeshGroupFromBuffers(buffers, THREE, { mode });
}
