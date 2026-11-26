/**
 * NeuroRecon Graphics Engine Loader
 * Asynchronously loads the 3D graphics engine (Three.js) on demand
 * and constructs GPU scene objects from raw binary geometry buffers.
 */

import * as THREE from "three";
import {
  HemisphereBufferTransfer,
  HemisphereFilter,
  MeshWorkerResponse,
  RawGeometryBuffer,
  SurfaceMode,
} from "./types";
import {
  createCorticalSurfaceMeshBuffers,
  createCorticalSurfaceMeshBuffersAsync,
} from "./mesh-generator";

/**
 * Asynchronously load the 3D graphics engine module on demand.
 */
export async function loadGraphicsEngine(): Promise<typeof THREE> {
  return THREE;
}

/**
 * Synchronously load graphics engine in Node/test environments or if already resolved.
 */
export function getGraphicsEngineSync(): typeof THREE {
  return THREE;
}

/**
 * Construct Three.js BufferGeometry from raw binary geometry buffer.
 */
export function createGeometryFromBuffer(
  buf: RawGeometryBuffer | HemisphereBufferTransfer,
  THREEModule: typeof import("three")
): import("three").BufferGeometry {
  const geometry = new THREEModule.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREEModule.Float32BufferAttribute(buf.positions, 3)
  );
  if (buf.normals && buf.normals.length > 0) {
    geometry.setAttribute(
      "normal",
      new THREEModule.Float32BufferAttribute(buf.normals, 3)
    );
  }
  if (buf.colors && buf.colors.length > 0) {
    geometry.setAttribute(
      "color",
      new THREEModule.Float32BufferAttribute(buf.colors, 3)
    );
  }
  geometry.setIndex(new THREEModule.Uint32BufferAttribute(buf.indices, 1));
  if (!buf.normals || buf.normals.length === 0) {
    geometry.computeVertexNormals();
  }
  return geometry;
}

/**
 * Construct Three.js BufferGeometry from HemisphereBufferTransfer.
 */
export function createHemisphereGeometryFromBuffers(
  buf: HemisphereBufferTransfer,
  THREEModule?: typeof import("three")
): import("three").BufferGeometry {
  const THREE = THREEModule || getGraphicsEngineSync();
  const geometry = createGeometryFromBuffer(buf, THREE);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Assemble GPU scene meshes from raw geometry array buffers.
 */
export function createMeshGroupFromBuffers(
  buffers: RawGeometryBuffer[],
  THREEModule: typeof import("three"),
  options?: { wireframe?: boolean; mode?: SurfaceMode; isSubcortical?: boolean }
): import("three").Group {
  const group = new THREEModule.Group();

  if (options?.isSubcortical || options?.mode === "aseg") {
    const subGroup = new THREEModule.Group();
    for (const buf of buffers) {
      const geometry = createGeometryFromBuffer(buf, THREEModule);
      const material = new THREEModule.MeshStandardMaterial({
        color: buf.color ?? 0x93c5fd,
        roughness: 0.3,
        metalness: 0.1,
        wireframe: options?.wireframe ?? false,
      });
      const mesh = new THREEModule.Mesh(geometry, material);
      if (buf.name) mesh.name = buf.name;
      subGroup.add(mesh);
    }
    group.add(subGroup);
    return group;
  }

  const material = new THREEModule.MeshStandardMaterial({
    vertexColors: true,
    roughness:
      options?.mode === "aparc" ? 0.45 : options?.mode === "white" ? 0.3 : 0.35,
    metalness: options?.mode === "aparc" ? 0.05 : 0.12,
    wireframe: options?.wireframe ?? false,
    side: THREEModule.DoubleSide,
  });

  for (const buf of buffers) {
    const geometry = createGeometryFromBuffer(buf, THREEModule);
    const mesh = new THREEModule.Mesh(geometry, material);
    if (buf.name) mesh.name = buf.name;
    else if (buf.hemi)
      mesh.name = buf.hemi === "left" ? "lh_surface" : "rh_surface";
    group.add(mesh);
  }

  return group;
}

/**
 * Construct THREE.Group from compiled Web Worker response object.
 */
export function createCorticalSurfaceMeshFromBuffers(
  response: MeshWorkerResponse,
  THREEModule?: typeof import("three")
): import("three").Group {
  const THREE = THREEModule || getGraphicsEngineSync();
  return createMeshGroupFromBuffers(response.buffers, THREE, {
    wireframe: response.wireframe,
    mode: response.mode,
    isSubcortical: response.isSubcortical,
  });
}

/**
 * Synchronous mesh construction helper using raw geometry buffers.
 */
export function createCorticalSurfaceMesh(
  mode: SurfaceMode = "pial",
  wireframe = false,
  hemiFilter: HemisphereFilter = "both",
  THREEModule?: typeof import("three")
): import("three").Group {
  const THREE = THREEModule || getGraphicsEngineSync();
  const buffers = createCorticalSurfaceMeshBuffers(mode, wireframe, hemiFilter);
  return createMeshGroupFromBuffers(buffers, THREE, { wireframe, mode });
}

/**
 * Asynchronous mesh construction helper using raw geometry buffers.
 */
export async function createCorticalSurfaceMeshAsync(
  mode: SurfaceMode = "pial",
  wireframe = false,
  hemiFilter: HemisphereFilter = "both"
): Promise<import("three").Group> {
  const [buffers, THREE] = await Promise.all([
    createCorticalSurfaceMeshBuffersAsync(mode, wireframe, hemiFilter),
    loadGraphicsEngine(),
  ]);
  return createMeshGroupFromBuffers(buffers, THREE, { wireframe, mode });
}
