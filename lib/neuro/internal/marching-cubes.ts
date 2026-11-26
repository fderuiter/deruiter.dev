/**
 * Pure 3D Marching Cubes Isosurface Extraction for NeuroRecon
 * Reconstructs indexed triangle meshes with smooth gradient normals and
 * FreeSurfer-compatible vertex colors directly from 3D scalar volumes.
 *
 * Designed to execute inside `mesh-worker.ts` with zero DOM or Three.js
 * runtime dependencies.
 */

import {
  HemisphereFilter,
  RawGeometryBuffer,
  SurfaceMode,
  VolumeDimensions,
  VoxelCoord,
  VoxelSpacing,
} from "../types";
import { clamp } from "../../game-utils";

const DEFAULT_SPACING: VoxelSpacing = { x: 1, y: 1, z: 1 };

/** World-space bounding diameter used to fit reconstructed brains in the 3D frustum. */
export const VOLUME_WORLD_EXTENT = 2.6;

/** Options controlling 3D Marching Cubes extraction. */
export interface MarchingCubesOptions {
  volumeData: Uint8Array;
  maskData?: Uint8Array;
  dimensions: VolumeDimensions;
  spacing?: VoxelSpacing;
  isovalue?: number;
  mode?: SurfaceMode;
  hemiFilter?: HemisphereFilter;
  downsampleStride?: number;
}

/**
 * Compute a coarse preview stride for live threshold scrubbing so interactive
 * dragging stays responsive even on 256x256x256 scans.
 */
export function computePreviewMarchingCubesStride(
  dimensions: VolumeDimensions
): number {
  const maxDim = Math.max(
    dimensions.width,
    dimensions.height,
    dimensions.depth
  );
  return Math.max(2, Math.ceil(maxDim / 48));
}

/**
 * Map a 3D voxel coordinate into normalized Three.js world coordinates
 * preserving physical anisotropic spacing proportions.
 *
 * Volume X maps to world X (Left-Right), volume Z maps to world Y
 * (Inferior-Superior), and volume Y maps to world Z (Posterior-Anterior).
 */
export function voxelToWorld3D(
  voxel: VoxelCoord,
  dimensions: VolumeDimensions,
  spacing: VoxelSpacing = DEFAULT_SPACING
): { x: number; y: number; z: number } {
  const sx = spacing.x > 0 ? spacing.x : 1;
  const sy = spacing.y > 0 ? spacing.y : 1;
  const sz = spacing.z > 0 ? spacing.z : 1;

  const physW = Math.max(1e-3, dimensions.width * sx);
  const physH = Math.max(1e-3, dimensions.height * sy);
  const physD = Math.max(1e-3, dimensions.depth * sz);
  const scale = VOLUME_WORLD_EXTENT / Math.max(physW, physH, physD);

  return {
    x: (voxel.x - dimensions.width / 2) * sx * scale,
    y: (voxel.z - dimensions.depth / 2) * sz * scale,
    z: (voxel.y - dimensions.height / 2) * sy * scale,
  };
}

/**
 * Inverse mapping from normalized Three.js world coordinates back to clamped
 * integer voxel indices.
 */
export function world3DToVoxel(
  world: { x: number; y: number; z: number },
  dimensions: VolumeDimensions,
  spacing: VoxelSpacing = DEFAULT_SPACING
): VoxelCoord {
  const sx = spacing.x > 0 ? spacing.x : 1;
  const sy = spacing.y > 0 ? spacing.y : 1;
  const sz = spacing.z > 0 ? spacing.z : 1;

  const physW = Math.max(1e-3, dimensions.width * sx);
  const physH = Math.max(1e-3, dimensions.height * sy);
  const physD = Math.max(1e-3, dimensions.depth * sz);
  const invScale = Math.max(physW, physH, physD) / VOLUME_WORLD_EXTENT;

  const vx = Math.round((world.x * invScale) / sx + dimensions.width / 2);
  const vy = Math.round((world.z * invScale) / sy + dimensions.height / 2);
  const vz = Math.round((world.y * invScale) / sz + dimensions.depth / 2);

  return {
    x: clamp(vx, 0, Math.max(0, dimensions.width - 1)),
    y: clamp(vy, 0, Math.max(0, dimensions.height - 1)),
    z: clamp(vz, 0, Math.max(0, dimensions.depth - 1)),
  };
}

// Canonical Paul Bourke 256-entry Marching Cubes edge intersection bitmask table
export const MC_EDGE_TABLE = new Uint16Array([
  0x0, 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c, 0x80c, 0x905, 0xa0f,
  0xb06, 0xc0a, 0xd03, 0xe09, 0xf00, 0x190, 0x99, 0x393, 0x29a, 0x596, 0x49f,
  0x795, 0x69c, 0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90, 0x230,
  0x339, 0x33, 0x13a, 0x636, 0x73f, 0x435, 0x53c, 0xa3c, 0xb35, 0x83f, 0x936,
  0xe3a, 0xf33, 0xc39, 0xd30, 0x3a0, 0x2a9, 0x1a3, 0xaa, 0x7a6, 0x6af, 0x5a5,
  0x4ac, 0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0, 0x460, 0x569,
  0x663, 0x76a, 0x66, 0x16f, 0x265, 0x36c, 0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a,
  0x963, 0xa69, 0xb60, 0x5f0, 0x4f9, 0x7f3, 0x6fa, 0x1f6, 0xff, 0x3f5, 0x2fc,
  0xdfc, 0xcf5, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0, 0x650, 0x759, 0x453,
  0x55a, 0x256, 0x35f, 0x55, 0x15c, 0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53,
  0x859, 0x950, 0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0xcc, 0xfcc,
  0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3, 0x9c9, 0x8c0, 0x8c0, 0x9c9, 0xac3, 0xbca,
  0xcc6, 0xdcf, 0xec5, 0xfcc, 0xcc, 0x1c5, 0x2cf, 0x3c6, 0x4ca, 0x5c3, 0x6c9,
  0x7c0, 0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c, 0x15c, 0x55,
  0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650, 0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6,
  0xfff, 0xcf5, 0xdfc, 0x2fc, 0x3f5, 0xff, 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0,
  0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f, 0xd65, 0xc6c, 0x36c, 0x265, 0x16f,
  0x66, 0x76a, 0x663, 0x569, 0x460, 0xca0, 0xda9, 0xea3, 0xfaa, 0x8a6, 0x9af,
  0xaa5, 0xbac, 0x4ac, 0x5a5, 0x6af, 0x7a6, 0xaa, 0x1a3, 0x2a9, 0x3a0, 0xd30,
  0xc39, 0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c, 0x53c, 0x435, 0x73f, 0x636,
  0x13a, 0x33, 0x339, 0x230, 0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895,
  0x99c, 0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393, 0x99, 0x190, 0xf00, 0xe09,
  0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c, 0x70c, 0x605, 0x50f, 0x406, 0x30a,
  0x203, 0x109, 0x0,
]);

// Canonical 256 x 16 Marching Cubes triangle index lookup table (-1 terminates row)
export const MC_TRI_TABLE = new Int8Array([
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 8, 3, -1,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 1, 9, -1, -1, -1, -1, -1,
  -1, -1, -1, -1, -1, -1, -1, -1, 1, 8, 3, 9, 8, 1, -1, -1, -1, -1, -1, -1, -1,
  -1, -1, -1, 1, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0,
  8, 3, 1, 2, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 2, 10, 0, 2, 9, -1,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 8, 3, 2, 10, 8, 10, 9, 8, -1, -1, -1,
  -1, -1, -1, -1, 3, 11, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  0, 11, 2, 8, 11, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 9, 0, 2, 3, 11,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 11, 2, 1, 9, 11, 9, 8, 11, -1, -1,
  -1, -1, -1, -1, -1, 3, 10, 1, 11, 10, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, 0, 10, 1, 0, 8, 10, 8, 11, 10, -1, -1, -1, -1, -1, -1, -1, 3, 9, 0, 3, 11,
  9, 11, 10, 9, -1, -1, -1, -1, -1, -1, -1, 9, 8, 10, 10, 8, 11, -1, -1, -1, -1,
  -1, -1, -1, -1, -1, -1, 4, 7, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, -1, 4, 3, 0, 7, 3, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 1, 9, 8,
  4, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 4, 1, 9, 4, 7, 1, 7, 3, 1, -1,
  -1, -1, -1, -1, -1, -1, 1, 2, 10, 8, 4, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, 3, 4, 7, 3, 0, 4, 1, 2, 10, -1, -1, -1, -1, -1, -1, -1, 9, 2, 10, 9, 0, 2,
  8, 4, 7, -1, -1, -1, -1, -1, -1, -1, 2, 10, 9, 2, 9, 7, 2, 7, 3, 7, 9, 4, -1,
  -1, -1, -1, 8, 4, 7, 3, 11, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 4,
  7, 11, 2, 4, 2, 0, 4, -1, -1, -1, -1, -1, -1, -1, 9, 0, 1, 8, 4, 7, 2, 3, 11,
  -1, -1, -1, -1, -1, -1, -1, 4, 7, 11, 9, 4, 11, 9, 11, 2, 9, 2, 1, -1, -1, -1,
  -1, 3, 10, 1, 3, 11, 10, 7, 8, 4, -1, -1, -1, -1, -1, -1, -1, 1, 11, 10, 1, 4,
  11, 1, 0, 4, 7, 11, 4, -1, -1, -1, -1, 4, 7, 8, 9, 0, 11, 9, 11, 10, 11, 0, 3,
  -1, -1, -1, -1, 4, 7, 11, 4, 11, 9, 9, 11, 10, -1, -1, -1, -1, -1, -1, -1, 9,
  5, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 5, 4, 0, 8, 3,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 5, 4, 1, 5, 0, -1, -1, -1, -1, -1,
  -1, -1, -1, -1, -1, 8, 5, 4, 8, 3, 5, 3, 1, 5, -1, -1, -1, -1, -1, -1, -1, 1,
  2, 10, 9, 5, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 3, 0, 8, 1, 2, 10, 4,
  9, 5, -1, -1, -1, -1, -1, -1, -1, 5, 2, 10, 5, 4, 2, 4, 0, 2, -1, -1, -1, -1,
  -1, -1, -1, 2, 10, 5, 3, 2, 5, 3, 5, 4, 3, 4, 8, -1, -1, -1, -1, 9, 5, 4, 2,
  3, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 11, 2, 0, 8, 11, 4, 9, 5,
  -1, -1, -1, -1, -1, -1, -1, 0, 5, 4, 0, 1, 5, 2, 3, 11, -1, -1, -1, -1, -1,
  -1, -1, 2, 1, 5, 2, 5, 8, 2, 8, 11, 4, 8, 5, -1, -1, -1, -1, 10, 3, 11, 10, 1,
  3, 9, 5, 4, -1, -1, -1, -1, -1, -1, -1, 4, 9, 5, 0, 8, 1, 8, 10, 1, 8, 11, 10,
  -1, -1, -1, -1, 5, 4, 0, 5, 0, 11, 5, 11, 10, 11, 0, 3, -1, -1, -1, -1, 5, 4,
  8, 5, 8, 10, 10, 8, 11, -1, -1, -1, -1, -1, -1, -1, 9, 7, 8, 5, 7, 9, -1, -1,
  -1, -1, -1, -1, -1, -1, -1, -1, 9, 3, 0, 9, 5, 3, 5, 7, 3, -1, -1, -1, -1, -1,
  -1, -1, 0, 7, 8, 0, 1, 7, 1, 5, 7, -1, -1, -1, -1, -1, -1, -1, 1, 5, 3, 3, 5,
  7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 7, 8, 9, 5, 7, 10, 1, 2, -1, -1,
  -1, -1, -1, -1, -1, 10, 1, 2, 9, 5, 0, 5, 3, 0, 5, 7, 3, -1, -1, -1, -1, 8, 0,
  2, 8, 2, 5, 8, 5, 7, 10, 5, 2, -1, -1, -1, -1, 2, 10, 5, 2, 5, 3, 3, 5, 7, -1,
  -1, -1, -1, -1, -1, -1, 7, 9, 5, 7, 8, 9, 3, 11, 2, -1, -1, -1, -1, -1, -1,
  -1, 9, 5, 7, 9, 7, 2, 9, 2, 0, 2, 7, 11, -1, -1, -1, -1, 2, 3, 11, 0, 1, 8, 1,
  7, 8, 1, 5, 7, -1, -1, -1, -1, 11, 2, 1, 11, 1, 7, 7, 1, 5, -1, -1, -1, -1,
  -1, -1, -1, 9, 5, 8, 8, 5, 7, 10, 1, 3, 10, 3, 11, -1, -1, -1, -1, 5, 7, 0, 5,
  0, 9, 7, 11, 0, 1, 0, 10, 11, 10, 0, -1, 11, 10, 0, 11, 0, 3, 10, 5, 0, 8, 0,
  7, 5, 7, 0, -1, 11, 10, 5, 7, 11, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  10, 6, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 8, 3, 5, 10,
  6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 0, 1, 5, 10, 6, -1, -1, -1, -1,
  -1, -1, -1, -1, -1, -1, 1, 8, 3, 1, 9, 8, 5, 10, 6, -1, -1, -1, -1, -1, -1,
  -1, 1, 6, 5, 2, 6, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 6, 5, 1, 2,
  6, 3, 0, 8, -1, -1, -1, -1, -1, -1, -1, 9, 6, 5, 9, 0, 6, 0, 2, 6, -1, -1, -1,
  -1, -1, -1, -1, 5, 9, 8, 5, 8, 2, 5, 2, 6, 3, 2, 8, -1, -1, -1, -1, 2, 3, 11,
  10, 6, 5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 0, 8, 11, 2, 0, 10, 6,
  5, -1, -1, -1, -1, -1, -1, -1, 0, 1, 9, 2, 3, 11, 5, 10, 6, -1, -1, -1, -1,
  -1, -1, -1, 5, 10, 6, 1, 9, 2, 9, 11, 2, 9, 8, 11, -1, -1, -1, -1, 6, 3, 11,
  6, 5, 3, 5, 1, 3, -1, -1, -1, -1, -1, -1, -1, 0, 8, 11, 0, 11, 5, 0, 5, 1, 5,
  11, 6, -1, -1, -1, -1, 3, 11, 6, 0, 3, 6, 0, 6, 5, 0, 5, 9, -1, -1, -1, -1, 6,
  5, 9, 6, 9, 11, 11, 9, 8, -1, -1, -1, -1, -1, -1, -1, 5, 10, 6, 4, 7, 8, -1,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, 4, 3, 0, 4, 7, 3, 6, 5, 10, -1, -1, -1,
  -1, -1, -1, -1, 1, 9, 0, 5, 10, 6, 8, 4, 7, -1, -1, -1, -1, -1, -1, -1, 10, 6,
  5, 1, 9, 7, 1, 7, 3, 7, 9, 4, -1, -1, -1, -1, 6, 1, 2, 6, 5, 1, 4, 7, 8, -1,
  -1, -1, -1, -1, -1, -1, 1, 2, 5, 5, 2, 6, 3, 0, 4, 3, 4, 7, -1, -1, -1, -1, 8,
  4, 7, 9, 0, 5, 0, 6, 5, 0, 2, 6, -1, -1, -1, -1, 7, 3, 9, 7, 9, 4, 3, 2, 9, 5,
  9, 6, 2, 6, 9, -1, 3, 11, 2, 7, 8, 4, 10, 6, 5, -1, -1, -1, -1, -1, -1, -1, 5,
  10, 6, 4, 7, 2, 4, 2, 0, 2, 7, 11, -1, -1, -1, -1, 0, 1, 9, 4, 7, 8, 2, 3, 11,
  5, 10, 6, -1, -1, -1, -1, 9, 2, 1, 9, 11, 2, 9, 4, 11, 7, 11, 4, 5, 10, 6, -1,
  8, 4, 7, 3, 11, 5, 3, 5, 1, 5, 11, 6, -1, -1, -1, -1, 5, 1, 11, 5, 11, 6, 1,
  0, 11, 7, 11, 4, 0, 4, 11, -1, 0, 5, 9, 0, 6, 5, 0, 3, 6, 11, 6, 3, 8, 4, 7,
  -1, 6, 5, 9, 6, 9, 11, 4, 7, 9, 7, 11, 9, -1, -1, -1, -1, 10, 4, 9, 6, 4, 10,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 4, 10, 6, 4, 9, 10, 0, 8, 3, -1, -1,
  -1, -1, -1, -1, -1, 10, 0, 1, 10, 6, 0, 6, 4, 0, -1, -1, -1, -1, -1, -1, -1,
  8, 3, 1, 8, 1, 6, 8, 6, 4, 6, 1, 10, -1, -1, -1, -1, 1, 4, 9, 1, 2, 4, 2, 6,
  4, -1, -1, -1, -1, -1, -1, -1, 3, 0, 8, 1, 2, 9, 2, 4, 9, 2, 6, 4, -1, -1, -1,
  -1, 0, 2, 4, 4, 2, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 8, 3, 2, 8, 2,
  4, 4, 2, 6, -1, -1, -1, -1, -1, -1, -1, 10, 4, 9, 10, 6, 4, 11, 2, 3, -1, -1,
  -1, -1, -1, -1, -1, 0, 8, 2, 2, 8, 11, 4, 9, 10, 4, 10, 6, -1, -1, -1, -1, 3,
  11, 2, 0, 1, 6, 0, 6, 4, 6, 1, 10, -1, -1, -1, -1, 6, 4, 1, 6, 1, 10, 4, 8, 1,
  2, 1, 11, 8, 11, 1, -1, 9, 6, 4, 9, 3, 6, 9, 1, 3, 11, 6, 3, -1, -1, -1, -1,
  8, 11, 1, 8, 1, 0, 11, 6, 1, 9, 1, 4, 6, 4, 1, -1, 3, 11, 6, 3, 6, 0, 0, 6, 4,
  -1, -1, -1, -1, -1, -1, -1, 6, 4, 8, 11, 6, 8, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, -1, 7, 10, 6, 7, 8, 10, 8, 9, 10, -1, -1, -1, -1, -1, -1, -1, 0, 7, 3, 0,
  10, 7, 0, 9, 10, 6, 7, 10, -1, -1, -1, -1, 10, 6, 7, 1, 10, 7, 1, 7, 8, 1, 8,
  0, -1, -1, -1, -1, 10, 6, 7, 10, 7, 1, 1, 7, 3, -1, -1, -1, -1, -1, -1, -1, 1,
  2, 6, 1, 6, 8, 1, 8, 9, 8, 6, 7, -1, -1, -1, -1, 2, 6, 9, 2, 9, 1, 6, 7, 9, 0,
  9, 3, 7, 3, 9, -1, 7, 8, 0, 7, 0, 6, 6, 0, 2, -1, -1, -1, -1, -1, -1, -1, 7,
  3, 2, 6, 7, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 3, 11, 10, 6, 8, 10,
  8, 9, 8, 6, 7, -1, -1, -1, -1, 2, 0, 7, 2, 7, 11, 0, 9, 7, 6, 7, 10, 9, 10, 7,
  -1, 1, 8, 0, 1, 7, 8, 1, 10, 7, 6, 7, 10, 2, 3, 11, -1, 11, 2, 1, 11, 1, 7,
  10, 6, 1, 6, 7, 1, -1, -1, -1, -1, 8, 9, 6, 8, 6, 7, 9, 1, 6, 11, 6, 3, 1, 3,
  6, -1, 0, 9, 1, 11, 6, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 7, 8, 0, 7,
  0, 6, 3, 11, 0, 11, 6, 0, -1, -1, -1, -1, 7, 11, 6, -1, -1, -1, -1, -1, -1,
  -1, -1, -1, -1, -1, -1, -1, 7, 6, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, -1, -1, 3, 0, 8, 11, 7, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 1,
  9, 11, 7, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 8, 1, 9, 8, 3, 1, 11, 7,
  6, -1, -1, -1, -1, -1, -1, -1, 10, 1, 2, 6, 11, 7, -1, -1, -1, -1, -1, -1, -1,
  -1, -1, -1, 1, 2, 10, 3, 0, 8, 6, 11, 7, -1, -1, -1, -1, -1, -1, -1, 2, 9, 0,
  2, 10, 9, 6, 11, 7, -1, -1, -1, -1, -1, -1, -1, 6, 11, 7, 2, 10, 3, 10, 8, 3,
  10, 9, 8, -1, -1, -1, -1, 7, 2, 3, 6, 2, 7, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, -1, 7, 0, 8, 7, 6, 0, 6, 2, 0, -1, -1, -1, -1, -1, -1, -1, 2, 7, 6, 2, 3,
  7, 0, 1, 9, -1, -1, -1, -1, -1, -1, -1, 1, 6, 2, 1, 8, 6, 1, 9, 8, 8, 7, 6,
  -1, -1, -1, -1, 10, 7, 6, 10, 1, 7, 1, 3, 7, -1, -1, -1, -1, -1, -1, -1, 10,
  7, 6, 1, 7, 10, 1, 8, 7, 1, 0, 8, -1, -1, -1, -1, 0, 3, 7, 0, 7, 10, 0, 10, 9,
  6, 10, 7, -1, -1, -1, -1, 7, 6, 10, 7, 10, 8, 8, 10, 9, -1, -1, -1, -1, -1,
  -1, -1, 6, 8, 4, 11, 8, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 3, 6, 11,
  3, 0, 6, 0, 4, 6, -1, -1, -1, -1, -1, -1, -1, 8, 6, 11, 8, 4, 6, 9, 0, 1, -1,
  -1, -1, -1, -1, -1, -1, 9, 4, 6, 9, 6, 3, 9, 3, 1, 11, 3, 6, -1, -1, -1, -1,
  6, 8, 4, 6, 11, 8, 2, 10, 1, -1, -1, -1, -1, -1, -1, -1, 1, 2, 10, 3, 0, 11,
  0, 6, 11, 0, 4, 6, -1, -1, -1, -1, 4, 11, 8, 4, 6, 11, 0, 2, 9, 2, 10, 9, -1,
  -1, -1, -1, 10, 9, 3, 10, 3, 2, 9, 4, 3, 11, 3, 6, 4, 6, 3, -1, 8, 2, 3, 8, 4,
  2, 4, 6, 2, -1, -1, -1, -1, -1, -1, -1, 0, 4, 2, 4, 6, 2, -1, -1, -1, -1, -1,
  -1, -1, -1, -1, -1, 1, 9, 0, 2, 3, 4, 2, 4, 6, 4, 3, 8, -1, -1, -1, -1, 1, 9,
  4, 1, 4, 2, 2, 4, 6, -1, -1, -1, -1, -1, -1, -1, 8, 1, 3, 8, 6, 1, 8, 4, 6, 6,
  10, 1, -1, -1, -1, -1, 10, 1, 0, 10, 0, 6, 6, 0, 4, -1, -1, -1, -1, -1, -1,
  -1, 4, 6, 3, 4, 3, 8, 6, 10, 3, 0, 3, 9, 10, 9, 3, -1, 10, 9, 4, 6, 10, 4, -1,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, 4, 9, 5, 7, 6, 11, -1, -1, -1, -1, -1, -1,
  -1, -1, -1, -1, 0, 8, 3, 4, 9, 5, 11, 7, 6, -1, -1, -1, -1, -1, -1, -1, 5, 0,
  1, 5, 4, 0, 7, 6, 11, -1, -1, -1, -1, -1, -1, -1, 11, 7, 6, 8, 3, 4, 3, 5, 4,
  3, 1, 5, -1, -1, -1, -1, 9, 5, 4, 10, 1, 2, 7, 6, 11, -1, -1, -1, -1, -1, -1,
  -1, 6, 11, 7, 1, 2, 10, 0, 8, 3, 4, 9, 5, -1, -1, -1, -1, 7, 6, 11, 5, 4, 10,
  4, 2, 10, 4, 0, 2, -1, -1, -1, -1, 3, 4, 8, 3, 5, 4, 3, 2, 5, 10, 5, 2, 11, 7,
  6, -1, 7, 2, 3, 7, 6, 2, 5, 4, 9, -1, -1, -1, -1, -1, -1, -1, 9, 5, 4, 0, 8,
  6, 0, 6, 2, 6, 8, 7, -1, -1, -1, -1, 3, 6, 2, 3, 7, 6, 1, 5, 0, 5, 4, 0, -1,
  -1, -1, -1, 6, 2, 8, 6, 8, 7, 2, 1, 8, 4, 8, 5, 1, 5, 8, -1, 9, 5, 4, 10, 1,
  6, 1, 7, 6, 1, 3, 7, -1, -1, -1, -1, 1, 6, 10, 1, 7, 6, 1, 0, 7, 8, 7, 0, 9,
  5, 4, -1, 4, 0, 10, 4, 10, 5, 0, 3, 10, 6, 10, 7, 3, 7, 10, -1, 7, 6, 10, 7,
  10, 8, 5, 4, 10, 4, 8, 10, -1, -1, -1, -1, 6, 9, 5, 6, 11, 9, 11, 8, 9, -1,
  -1, -1, -1, -1, -1, -1, 3, 6, 11, 0, 6, 3, 0, 5, 6, 0, 9, 5, -1, -1, -1, -1,
  0, 11, 8, 0, 5, 11, 0, 1, 5, 5, 6, 11, -1, -1, -1, -1, 6, 11, 3, 6, 3, 5, 5,
  3, 1, -1, -1, -1, -1, -1, -1, -1, 1, 2, 10, 9, 5, 11, 9, 11, 8, 11, 5, 6, -1,
  -1, -1, -1, 0, 11, 3, 0, 6, 11, 0, 9, 6, 5, 6, 9, 1, 2, 10, -1, 11, 8, 5, 11,
  5, 6, 8, 0, 5, 10, 5, 2, 0, 2, 5, -1, 6, 11, 3, 6, 3, 5, 2, 10, 3, 10, 5, 3,
  -1, -1, -1, -1, 5, 8, 9, 5, 2, 8, 5, 6, 2, 3, 8, 2, -1, -1, -1, -1, 9, 5, 6,
  9, 6, 0, 0, 6, 2, -1, -1, -1, -1, -1, -1, -1, 1, 5, 8, 1, 8, 0, 5, 6, 8, 3, 8,
  2, 6, 2, 8, -1, 1, 5, 6, 2, 1, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1,
  3, 6, 1, 6, 10, 3, 8, 6, 5, 6, 9, 8, 9, 6, -1, 10, 1, 0, 10, 0, 6, 9, 5, 0, 5,
  6, 0, -1, -1, -1, -1, 0, 3, 8, 5, 6, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, 10, 5, 6, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 5, 10,
  7, 5, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 5, 10, 11, 7, 5, 8, 3,
  0, -1, -1, -1, -1, -1, -1, -1, 5, 11, 7, 5, 10, 11, 1, 9, 0, -1, -1, -1, -1,
  -1, -1, -1, 10, 7, 5, 10, 11, 7, 9, 8, 1, 8, 3, 1, -1, -1, -1, -1, 11, 1, 2,
  11, 7, 1, 7, 5, 1, -1, -1, -1, -1, -1, -1, -1, 0, 8, 3, 1, 2, 7, 1, 7, 5, 7,
  2, 11, -1, -1, -1, -1, 9, 7, 5, 9, 2, 7, 9, 0, 2, 2, 11, 7, -1, -1, -1, -1, 7,
  5, 2, 7, 2, 11, 5, 9, 2, 3, 2, 8, 9, 8, 2, -1, 2, 5, 10, 2, 3, 5, 3, 7, 5, -1,
  -1, -1, -1, -1, -1, -1, 8, 2, 0, 8, 5, 2, 8, 7, 5, 10, 2, 5, -1, -1, -1, -1,
  9, 0, 1, 5, 10, 3, 5, 3, 7, 3, 10, 2, -1, -1, -1, -1, 9, 8, 2, 9, 2, 1, 8, 7,
  2, 10, 2, 5, 7, 5, 2, -1, 1, 3, 5, 3, 7, 5, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, -1, 0, 8, 7, 0, 7, 1, 1, 7, 5, -1, -1, -1, -1, -1, -1, -1, 9, 0, 3, 9, 3,
  5, 5, 3, 7, -1, -1, -1, -1, -1, -1, -1, 9, 8, 7, 5, 9, 7, -1, -1, -1, -1, -1,
  -1, -1, -1, -1, -1, 5, 8, 4, 5, 10, 8, 10, 11, 8, -1, -1, -1, -1, -1, -1, -1,
  5, 0, 4, 5, 11, 0, 5, 10, 11, 11, 3, 0, -1, -1, -1, -1, 0, 1, 9, 8, 4, 10, 8,
  10, 11, 10, 4, 5, -1, -1, -1, -1, 10, 11, 4, 10, 4, 5, 11, 3, 4, 9, 4, 1, 3,
  1, 4, -1, 2, 5, 1, 2, 8, 5, 2, 11, 8, 4, 5, 8, -1, -1, -1, -1, 0, 4, 11, 0,
  11, 3, 4, 5, 11, 2, 11, 1, 5, 1, 11, -1, 0, 2, 5, 0, 5, 9, 2, 11, 5, 4, 5, 8,
  11, 8, 5, -1, 9, 4, 5, 2, 11, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 5,
  10, 3, 5, 2, 3, 4, 5, 3, 8, 4, -1, -1, -1, -1, 5, 10, 2, 5, 2, 4, 4, 2, 0, -1,
  -1, -1, -1, -1, -1, -1, 3, 10, 2, 3, 5, 10, 3, 8, 5, 4, 5, 8, 0, 1, 9, -1, 5,
  10, 2, 5, 2, 4, 1, 9, 2, 9, 4, 2, -1, -1, -1, -1, 8, 4, 5, 8, 5, 3, 3, 5, 1,
  -1, -1, -1, -1, -1, -1, -1, 0, 4, 5, 1, 0, 5, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, -1, 8, 4, 5, 8, 5, 3, 9, 0, 5, 0, 3, 5, -1, -1, -1, -1, 9, 4, 5, -1, -1,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 4, 11, 7, 4, 9, 11, 9, 10, 11, -1,
  -1, -1, -1, -1, -1, -1, 0, 8, 3, 4, 9, 7, 9, 11, 7, 9, 10, 11, -1, -1, -1, -1,
  1, 10, 11, 1, 11, 4, 1, 4, 0, 7, 4, 11, -1, -1, -1, -1, 3, 1, 4, 3, 4, 8, 1,
  10, 4, 7, 4, 11, 10, 11, 4, -1, 4, 11, 7, 9, 11, 4, 9, 2, 11, 9, 1, 2, -1, -1,
  -1, -1, 9, 7, 4, 9, 11, 7, 9, 1, 11, 2, 11, 1, 0, 8, 3, -1, 11, 7, 4, 11, 4,
  2, 2, 4, 0, -1, -1, -1, -1, -1, -1, -1, 11, 7, 4, 11, 4, 2, 8, 3, 4, 3, 2, 4,
  -1, -1, -1, -1, 2, 9, 10, 2, 7, 9, 2, 3, 7, 7, 4, 9, -1, -1, -1, -1, 9, 10, 7,
  9, 7, 4, 10, 2, 7, 8, 7, 0, 2, 0, 7, -1, 3, 7, 10, 3, 10, 2, 7, 4, 10, 1, 10,
  0, 4, 0, 10, -1, 1, 10, 2, 8, 7, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 4,
  9, 1, 4, 1, 7, 7, 1, 3, -1, -1, -1, -1, -1, -1, -1, 4, 9, 1, 4, 1, 7, 0, 8, 1,
  8, 7, 1, -1, -1, -1, -1, 4, 0, 3, 7, 4, 3, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, 4, 8, 7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 9, 10, 8, 10,
  11, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 3, 0, 9, 3, 9, 11, 11, 9, 10,
  -1, -1, -1, -1, -1, -1, -1, 0, 1, 10, 0, 10, 8, 8, 10, 11, -1, -1, -1, -1, -1,
  -1, -1, 3, 1, 10, 11, 3, 10, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 2, 11,
  1, 11, 9, 9, 11, 8, -1, -1, -1, -1, -1, -1, -1, 3, 0, 9, 3, 9, 11, 1, 2, 9, 2,
  11, 9, -1, -1, -1, -1, 0, 2, 11, 8, 0, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, 3, 2, 11, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2, 3, 8, 2,
  8, 10, 10, 8, 9, -1, -1, -1, -1, -1, -1, -1, 9, 10, 2, 0, 9, 2, -1, -1, -1,
  -1, -1, -1, -1, -1, -1, -1, 2, 3, 8, 2, 8, 10, 0, 1, 8, 1, 10, 8, -1, -1, -1,
  -1, 1, 10, 2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1, 3, 8, 9,
  1, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 9, 1, -1, -1, -1, -1, -1, -1,
  -1, -1, -1, -1, -1, -1, -1, 0, 3, 8, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
]);

// Edge endpoint corner pairs [cA, cB] for edges 0..11
const EDGE_CORNERS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

// Unit cube corner offsets [dx, dy, dz] for corners 0..7
const CORNER_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];

class MeshBufferBuilder {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  vertexCount = 0;
  indexCount = 0;

  constructor(initialVertices = 4096, initialIndices = 12288) {
    this.positions = new Float32Array(initialVertices * 3);
    this.normals = new Float32Array(initialVertices * 3);
    this.colors = new Float32Array(initialVertices * 3);
    this.indices = new Uint32Array(initialIndices);
  }

  addVertex(
    px: number,
    py: number,
    pz: number,
    nx: number,
    ny: number,
    nz: number,
    cr: number,
    cg: number,
    cb: number
  ): number {
    const idx = this.vertexCount;
    const neededFloats = (idx + 1) * 3;
    if (neededFloats > this.positions.length) {
      const nextLen = Math.max(neededFloats, this.positions.length * 2);
      const nextPos = new Float32Array(nextLen);
      nextPos.set(this.positions);
      this.positions = nextPos;

      const nextNorm = new Float32Array(nextLen);
      nextNorm.set(this.normals);
      this.normals = nextNorm;

      const nextCol = new Float32Array(nextLen);
      nextCol.set(this.colors);
      this.colors = nextCol;
    }

    const base = idx * 3;
    this.positions[base] = px;
    this.positions[base + 1] = py;
    this.positions[base + 2] = pz;
    this.normals[base] = nx;
    this.normals[base + 1] = ny;
    this.normals[base + 2] = nz;
    this.colors[base] = cr;
    this.colors[base + 1] = cg;
    this.colors[base + 2] = cb;

    this.vertexCount = idx + 1;
    return idx;
  }

  addTriangle(a: number, b: number, c: number): void {
    const needed = this.indexCount + 3;
    if (needed > this.indices.length) {
      const nextIndices = new Uint32Array(
        Math.max(needed, this.indices.length * 2)
      );
      nextIndices.set(this.indices);
      this.indices = nextIndices;
    }
    this.indices[this.indexCount] = a;
    this.indices[this.indexCount + 1] = b;
    this.indices[this.indexCount + 2] = c;
    this.indexCount = needed;
  }

  build(name: string, hemi?: "left" | "right"): RawGeometryBuffer | null {
    if (this.vertexCount === 0 || this.indexCount === 0) {
      return null;
    }
    return {
      name,
      hemi,
      positions: this.positions.slice(0, this.vertexCount * 3),
      normals: this.normals.slice(0, this.vertexCount * 3),
      colors: this.colors.slice(0, this.vertexCount * 3),
      indices: this.indices.slice(0, this.indexCount),
    };
  }
}

function computeVertexColor(
  mode: SurfaceMode,
  vx: number,
  vy: number,
  vz: number,
  dimensions: VolumeDimensions,
  gradientMag: number
): [number, number, number] {
  const shade = clamp(0.72 + gradientMag * 0.004, 0.68, 1.0);
  if (mode === "white") {
    return [0.9 * shade, 0.92 * shade, 0.95 * shade];
  }
  if (mode === "inflated") {
    return [0.76 * shade, 0.8 * shade, 0.86 * shade];
  }
  if (mode === "aseg") {
    const zNorm = vz / Math.max(1, dimensions.depth);
    return [
      clamp((0.18 + 0.45 * zNorm) * shade, 0, 1),
      clamp((0.72 - 0.18 * zNorm) * shade, 0, 1),
      clamp((0.82 - 0.1 * zNorm) * shade, 0, 1),
    ];
  }
  if (mode === "aparc") {
    // Smooth spatial region tinting across anterior-posterior and superior-inferior axes
    const yNorm = vy / Math.max(1, dimensions.height);
    const zNorm = vz / Math.max(1, dimensions.depth);
    if (yNorm > 0.62) {
      return [0.16 * shade, 0.78 * shade, 0.68 * shade]; // Frontal cyan-emerald
    }
    if (zNorm > 0.56) {
      return [0.32 * shade, 0.68 * shade, 0.88 * shade]; // Parietal sky-cyan
    }
    if (yNorm < 0.34) {
      return [0.85 * shade, 0.62 * shade, 0.28 * shade]; // Occipital warm amber
    }
    const lat =
      Math.abs(vx - dimensions.width / 2) / Math.max(1, dimensions.width / 2);
    return [
      clamp((0.42 + 0.3 * lat) * shade, 0, 1),
      clamp((0.74 - 0.15 * lat) * shade, 0, 1),
      clamp((0.68 + 0.18 * lat) * shade, 0, 1),
    ];
  }
  // Default cortical pial graphite-ivory tone matching NeuroRecon studio palette
  return [0.83 * shade, 0.76 * shade, 0.73 * shade];
}

/**
 * Extract 3D Marching Cubes isosurface geometry buffers from a scalar volume.
 *
 * When `maskData` is supplied, voxels masked to zero are suppressed so brush
 * and eraser edits on 2D slices immediately update the reconstructed 3D surface.
 */
export function extractMarchingCubesBuffers(
  options: MarchingCubesOptions
): RawGeometryBuffer[] {
  const {
    volumeData,
    maskData,
    dimensions,
    spacing = DEFAULT_SPACING,
    isovalue = 65,
    mode = "pial",
    hemiFilter = "both",
    downsampleStride = 1,
  } = options;

  const { width, height, depth } = dimensions;
  if (
    width < 2 ||
    height < 2 ||
    depth < 2 ||
    volumeData.length < width * height * depth
  ) {
    return [];
  }

  const stride = Math.max(1, Math.floor(downsampleStride));
  const sx = spacing.x > 0 ? spacing.x : 1;
  const sy = spacing.y > 0 ? spacing.y : 1;
  const sz = spacing.z > 0 ? spacing.z : 1;

  const physW = Math.max(1e-3, width * sx);
  const physH = Math.max(1e-3, height * sy);
  const physD = Math.max(1e-3, depth * sz);
  const worldScale = VOLUME_WORLD_EXTENT / Math.max(physW, physH, physD);

  const halfW = width / 2;
  const halfH = height / 2;
  const halfD = depth / 2;
  const sliceStride = width * height;
  const hasMask = Boolean(
    maskData && maskData.length >= width * height * depth
  );

  const sampleScalar = (x: number, y: number, z: number): number => {
    const cx = x < 0 ? 0 : x >= width ? width - 1 : x;
    const cy = y < 0 ? 0 : y >= height ? height - 1 : y;
    const cz = z < 0 ? 0 : z >= depth ? depth - 1 : z;
    const idx = cz * sliceStride + cy * width + cx;
    if (hasMask && maskData![idx] === 0) {
      return 0;
    }
    return volumeData[idx];
  };

  // Determine grid cell steps along each axis
  const cellsX = Math.floor((width - 1) / stride);
  const cellsY = Math.floor((height - 1) / stride);
  const cellsZ = Math.floor((depth - 1) / stride);
  if (cellsX < 1 || cellsY < 1 || cellsZ < 1) {
    return [];
  }

  // Hemisphere X cell bounds so left/right filtering can skip half the volume
  let startCellX = 0;
  let endCellX = cellsX;
  const midCellX = Math.floor(cellsX / 2);
  if (hemiFilter === "lh") {
    endCellX = Math.max(1, midCellX);
  } else if (hemiFilter === "rh") {
    startCellX = Math.min(cellsX - 1, midCellX);
  }

  const gridNodesX = cellsX + 1;
  const gridNodesY = cellsY + 1;
  const slabEdgeCount = gridNodesX * gridNodesY * 3;
  // Per-slab shared edge vertex cache: [xEdge, yEdge, zEdge] per grid node
  let currSlabEdges = new Int32Array(slabEdgeCount);
  let nextSlabEdges = new Int32Array(slabEdgeCount);
  currSlabEdges.fill(-1);
  nextSlabEdges.fill(-1);

  const builder = new MeshBufferBuilder(8192, 24576);
  const cornerVals = new Float32Array(8);
  const cornerCoordsX = new Int32Array(8);
  const cornerCoordsY = new Int32Array(8);
  const cornerCoordsZ = new Int32Array(8);
  const edgeVertIndices = new Int32Array(12);

  const sampleCornerGrad = (
    vx: number,
    vy: number,
    vz: number
  ): [number, number, number, number] => {
    // Outward normal points toward decreasing scalar intensity: -grad(S)
    const gx =
      -(sampleScalar(vx + stride, vy, vz) - sampleScalar(vx - stride, vy, vz)) /
      (2 * stride * sx);
    const gy =
      -(sampleScalar(vx, vy + stride, vz) - sampleScalar(vx, vy - stride, vz)) /
      (2 * stride * sy);
    const gz =
      -(sampleScalar(vx, vy, vz + stride) - sampleScalar(vx, vy, vz - stride)) /
      (2 * stride * sz);
    const mag = Math.hypot(gx, gy, gz);
    if (mag < 1e-6) {
      return [0, 1, 0, 0];
    }
    // Map gradient components to Three.js world axes: (X -> X, Z -> Y, Y -> Z)
    return [gx / mag, gz / mag, gy / mag, mag];
  };

  const getOrCreateEdgeVertex = (
    cx: number,
    cy: number,
    edgeId: number,
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number
  ): number => {
    // Map cube edgeId (0..11) to canonical owner (slab, nodeX, nodeY, axis 0=X,1=Y,2=Z)
    let useNextSlab = false;
    let nx = cx;
    let ny = cy;
    let axis = 0;

    switch (edgeId) {
      case 0:
        axis = 0;
        break;
      case 1:
        nx = cx + 1;
        axis = 1;
        break;
      case 2:
        ny = cy + 1;
        axis = 0;
        break;
      case 3:
        axis = 1;
        break;
      case 4:
        useNextSlab = true;
        axis = 0;
        break;
      case 5:
        useNextSlab = true;
        nx = cx + 1;
        axis = 1;
        break;
      case 6:
        useNextSlab = true;
        ny = cy + 1;
        axis = 0;
        break;
      case 7:
        useNextSlab = true;
        axis = 1;
        break;
      case 8:
        axis = 2;
        break;
      case 9:
        nx = cx + 1;
        axis = 2;
        break;
      case 10:
        nx = cx + 1;
        ny = cy + 1;
        axis = 2;
        break;
      case 11:
        ny = cy + 1;
        axis = 2;
        break;
    }

    const slab = useNextSlab ? nextSlabEdges : currSlabEdges;
    const cacheIdx = (ny * gridNodesX + nx) * 3 + axis;
    const cached = slab[cacheIdx];
    if (cached !== -1) {
      return cached;
    }

    const [cA, cB] = EDGE_CORNERS[edgeId];
    const vA = cornerVals[cA];
    const vB = cornerVals[cB];
    const denom = vB - vA;
    const t =
      Math.abs(denom) < 1e-5 ? 0.5 : clamp((isovalue - vA) / denom, 0, 1);

    const ax = cornerCoordsX[cA];
    const ay = cornerCoordsY[cA];
    const az = cornerCoordsZ[cA];
    const bx = cornerCoordsX[cB];
    const by = cornerCoordsY[cB];
    const bz = cornerCoordsZ[cB];

    const vx = ax + t * (bx - ax);
    const vy = ay + t * (by - ay);
    const vz = az + t * (bz - az);

    // World coordinates (X -> X, Z -> Y, Y -> Z)
    const wx = (vx - halfW) * sx * worldScale;
    const wy = (vz - halfD) * sz * worldScale;
    const wz = (vy - halfH) * sy * worldScale;

    const [nAx, nAy, nAz, magA] = sampleCornerGrad(ax, ay, az);
    const [nBx, nBy, nBz, magB] = sampleCornerGrad(bx, by, bz);
    let nxWorld = nAx + t * (nBx - nAx);
    let nyWorld = nAy + t * (nBy - nAy);
    let nzWorld = nAz + t * (nBz - nAz);
    const nLen = Math.hypot(nxWorld, nyWorld, nzWorld);
    if (nLen > 1e-6) {
      nxWorld /= nLen;
      nyWorld /= nLen;
      nzWorld /= nLen;
    } else {
      // Fallback radial outward normal
      const rLen = Math.hypot(wx, wy, wz) || 1;
      nxWorld = wx / rLen;
      nyWorld = wy / rLen;
      nzWorld = wz / rLen;
    }

    const gradMag = magA + t * (magB - magA);
    const [cr, cg, cb] = computeVertexColor(
      mode,
      vx,
      vy,
      vz,
      dimensions,
      gradMag
    );

    // Unused coordinate suppression check kept clean via x0/x1 bounds
    void x0;
    void y0;
    void z0;
    void x1;
    void y1;
    void z1;

    const vIdx = builder.addVertex(
      wx,
      wy,
      wz,
      nxWorld,
      nyWorld,
      nzWorld,
      cr,
      cg,
      cb
    );
    slab[cacheIdx] = vIdx;
    return vIdx;
  };

  for (let cz = 0; cz < cellsZ; cz++) {
    const z0 = cz * stride;
    const z1 = Math.min(depth - 1, z0 + stride);

    for (let cy = 0; cy < cellsY; cy++) {
      const y0 = cy * stride;
      const y1 = Math.min(height - 1, y0 + stride);

      for (let cx = startCellX; cx < endCellX; cx++) {
        const x0 = cx * stride;
        const x1 = Math.min(width - 1, x0 + stride);

        let cubeIndex = 0;
        for (let c = 0; c < 8; c++) {
          const [ox, oy, oz] = CORNER_OFFSETS[c];
          const vx = ox === 0 ? x0 : x1;
          const vy = oy === 0 ? y0 : y1;
          const vz = oz === 0 ? z0 : z1;
          cornerCoordsX[c] = vx;
          cornerCoordsY[c] = vy;
          cornerCoordsZ[c] = vz;
          const val = sampleScalar(vx, vy, vz);
          cornerVals[c] = val;
          if (val >= isovalue) {
            cubeIndex |= 1 << c;
          }
        }

        const edgeMask = MC_EDGE_TABLE[cubeIndex];
        if (edgeMask === 0) continue;

        for (let e = 0; e < 12; e++) {
          if ((edgeMask & (1 << e)) !== 0) {
            edgeVertIndices[e] = getOrCreateEdgeVertex(
              cx,
              cy,
              e,
              x0,
              y0,
              z0,
              x1,
              y1,
              z1
            );
          }
        }

        const rowOffset = cubeIndex * 16;
        for (let t = 0; t < 15; t += 3) {
          const ea = MC_TRI_TABLE[rowOffset + t];
          if (ea === -1) break;
          const eb = MC_TRI_TABLE[rowOffset + t + 1];
          const ec = MC_TRI_TABLE[rowOffset + t + 2];
          // Note axis swap (volume Y<->Z to Three.js Y-up) flips handedness,
          // so emit (a, c, b) for outward counter-clockwise winding
          builder.addTriangle(
            edgeVertIndices[ea],
            edgeVertIndices[ec],
            edgeVertIndices[eb]
          );
        }
      }
    }

    // Advance slab cache: nextSlabEdges becomes currSlabEdges for cz + 1
    const swap = currSlabEdges;
    currSlabEdges = nextSlabEdges;
    nextSlabEdges = swap;
    nextSlabEdges.fill(-1);
  }

  const hemiTag =
    hemiFilter === "lh" ? "left" : hemiFilter === "rh" ? "right" : undefined;
  const built = builder.build("isosurface_mesh", hemiTag);
  return built ? [built] : [];
}
