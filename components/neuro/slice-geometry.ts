import { clamp } from "@/lib/game-utils";
import {
  NeuroEditLayer,
  SlicePlane,
  ToolMode,
  VolumeDimensions,
  VoxelCoord,
  VoxelEdit,
} from "@/lib/neuro/types";
import { VOLUME_SIZE } from "@/lib/neuro/volume-generator";

const DEFAULT_DIMENSIONS: VolumeDimensions = {
  width: VOLUME_SIZE,
  height: VOLUME_SIZE,
  depth: VOLUME_SIZE,
};

/**
 * Geometry shared by the slice viewer's drawing and pointer handling: which
 * slice a plane shows, how canvas pixels map to voxels and back, and which
 * voxels a brush stroke touches.
 */

/** The slice a plane shows through the crosshair. */
export function sliceIndex(plane: SlicePlane, crosshair: VoxelCoord): number {
  if (plane === "axial") return crosshair.z;
  if (plane === "coronal") return crosshair.y;
  return crosshair.x;
}

/** The canvas pixel under a pointer, scaled from CSS pixels to the bitmap. */
export function canvasPixel(
  canvas: { width: number; height: number },
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number
): { x: number; y: number } {
  return {
    x: Math.floor((clientX - rect.left) * (canvas.width / rect.width)),
    y: Math.floor((clientY - rect.top) * (canvas.height / rect.height)),
  };
}

/**
 * The voxel under a canvas pixel on a plane. Coronal and sagittal slices are
 * drawn with superior at the top, so their rows count down from the top of
 * the volume.
 */
export function pixelToVoxel(
  plane: SlicePlane,
  pixel: { x: number; y: number },
  crosshair: VoxelCoord,
  dimensions: VolumeDimensions = DEFAULT_DIMENSIONS
): VoxelCoord {
  if (plane === "axial") {
    const x = clamp(pixel.x, 0, Math.max(0, dimensions.width - 1));
    const y = clamp(pixel.y, 0, Math.max(0, dimensions.height - 1));
    return { x, y, z: crosshair.z };
  }
  const maxZ = Math.max(0, dimensions.depth - 1);
  const py = clamp(pixel.y, 0, maxZ);
  const z = clamp(maxZ - py, 0, maxZ);
  if (plane === "coronal") {
    const x = clamp(pixel.x, 0, Math.max(0, dimensions.width - 1));
    return { x, y: crosshair.y, z };
  }
  const y = clamp(pixel.x, 0, Math.max(0, dimensions.height - 1));
  return { x: crosshair.x, y, z };
}

/** Where a voxel lands on a plane's canvas, `height` rows tall. */
export function voxelToPixel(
  plane: SlicePlane,
  point: VoxelCoord,
  height: number
): { x: number; y: number } {
  if (plane === "axial") return { x: point.x, y: point.y };
  if (plane === "coronal") return { x: point.x, y: height - 1 - point.z };
  return { x: point.y, y: height - 1 - point.z };
}

/** The crosshair after one wheel step on a plane: down goes back a slice. */
export function scrollCrosshair(
  crosshair: VoxelCoord,
  plane: SlicePlane,
  deltaY: number,
  dimensions: VolumeDimensions = DEFAULT_DIMENSIONS
): VoxelCoord {
  const step = deltaY > 0 ? -1 : 1;
  const axis = plane === "axial" ? "z" : plane === "coronal" ? "y" : "x";
  const maxIndex =
    axis === "x"
      ? dimensions.width - 1
      : axis === "y"
        ? dimensions.height - 1
        : dimensions.depth - 1;
  return {
    ...crosshair,
    [axis]: clamp(crosshair[axis] + step, 0, Math.max(0, maxIndex)),
  };
}

/** The mask edits a spherical paint or erase brush makes at a voxel. */
export function brushEdits(
  center: VoxelCoord,
  radius: number,
  mode: Extract<ToolMode, "paint" | "erase">,
  dimensions: VolumeDimensions = DEFAULT_DIMENSIONS,
  layer: NeuroEditLayer = "brainmask"
): VoxelEdit[] {
  const edits: VoxelEdit[] = [];
  const newValue = mode === "paint" ? 1 : 0;
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
        const x = center.x + dx;
        const y = center.y + dy;
        const z = center.z + dz;
        if (
          x < 0 ||
          x >= dimensions.width ||
          y < 0 ||
          y >= dimensions.height ||
          z < 0 ||
          z >= dimensions.depth
        ) {
          continue;
        }
        edits.push({
          x,
          y,
          z,
          originalValue: 1 - newValue,
          newValue,
          layer,
        });
      }
    }
  }
  return edits;
}

/**
 * The defect region's outline on a slice, or null when the slice misses the
 * region or the outline would have no area.
 */
export function defectRect(
  region: { min: VoxelCoord; max: VoxelCoord },
  plane: SlicePlane,
  slice: number,
  height: number
): { x: number; y: number; width: number; height: number } | null {
  const { min, max } = region;
  let rect = null;
  if (plane === "axial" && slice >= min.z && slice <= max.z) {
    rect = { x: min.x, y: min.y, width: max.x - min.x, height: max.y - min.y };
  } else if (plane === "coronal" && slice >= min.y && slice <= max.y) {
    rect = {
      x: min.x,
      y: height - 1 - max.z,
      width: max.x - min.x,
      height: max.z - min.z,
    };
  } else if (plane === "sagittal" && slice >= min.x && slice <= max.x) {
    rect = {
      x: min.y,
      y: height - 1 - max.z,
      width: max.y - min.y,
      height: max.z - min.z,
    };
  }
  return rect && rect.width > 0 && rect.height > 0 ? rect : null;
}

/** Whether a point lies within a slice and a half of the one a plane shows. */
export function isNearSlice(
  point: VoxelCoord,
  plane: SlicePlane,
  slice: number
): boolean {
  const depth =
    plane === "axial" ? point.z : plane === "coronal" ? point.y : point.x;
  return Math.abs(depth - slice) <= 1.5;
}
