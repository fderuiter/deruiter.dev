/**
 * Synthetic Volumetric 3D MRI Generator for NeuroRecon
 * Generates realistic T1-weighted structural MRI volumes with anatomical
 * tissue compartments (CSF, GM, WM, Ventricles, Subcortical) and defect injections.
 */

import {
  AffineMatrix4x4,
  ScenarioId,
  VolumeDimensions,
  VolumeSourceFormat,
  VoxelCoord,
  VoxelSpacing,
} from "./types";
import { clamp } from "../game-utils";

export interface SyntheticVolume {
  dimensions: VolumeDimensions;
  spacing?: VoxelSpacing;
  affine?: AffineMatrix4x4;
  sourceFormat?: VolumeSourceFormat;
  fileName?: string;
  overlayMask?: Uint8Array;
  rawT1: Uint8Array; // Original anatomical T1 intensities [0-255]
  brainmask: Uint8Array; // Binary/tissue mask [0 or 1]
  wmMask: Uint8Array; // White matter segmentation [0 or 1]
  initialBrainmask: Uint8Array; // Unedited mask for QA comparisons
  initialWmMask: Uint8Array; // Unedited white matter mask for QA comparisons
  labels: Uint8Array; // Tissue segment classifications
  scenarioId: ScenarioId;
  defectRegion: { min: VoxelCoord; max: VoxelCoord };
}

export const VOLUME_SIZE = 96;

export const DEFAULT_VOXEL_SPACING: VoxelSpacing = { x: 1, y: 1, z: 1 };

/**
 * Construct a centered voxel-to-RAS 4x4 affine matrix for given dimensions and spacing.
 */
export function createDefaultAffine(
  dimensions: VolumeDimensions = {
    width: VOLUME_SIZE,
    height: VOLUME_SIZE,
    depth: VOLUME_SIZE,
  },
  spacing: VoxelSpacing = DEFAULT_VOXEL_SPACING
): AffineMatrix4x4 {
  const ox = -(dimensions.width / 2) * spacing.x;
  const oy = -(dimensions.height / 2) * spacing.y;
  const oz = -(dimensions.depth / 2) * spacing.z;
  return [
    spacing.x,
    0,
    0,
    ox,
    0,
    spacing.y,
    0,
    oy,
    0,
    0,
    spacing.z,
    oz,
    0,
    0,
    0,
    1,
  ];
}

/**
 * Get 1D flat index from 3D coordinates (x, y, z) supporting rectangular matrices.
 */
export function getIndex(
  x: number,
  y: number,
  z: number,
  width = VOLUME_SIZE,
  height = width
): number {
  return z * width * height + y * width + x;
}

/**
 * Procedural generation of a 3D MRI brain volume for a given scenario.
 */
export function generateSyntheticVolume(
  scenario: ScenarioId = "sandbox"
): SyntheticVolume {
  const size = VOLUME_SIZE;
  const totalVoxels = size * size * size;

  const rawT1 = new Uint8Array(totalVoxels);
  const brainmask = new Uint8Array(totalVoxels);
  const wmMask = new Uint8Array(totalVoxels);
  const labels = new Uint8Array(totalVoxels);

  const cx = size / 2;
  const cy = size / 2;
  const cz = size / 2;

  // Radii for brain ellipsoids (Axial, Coronal, Sagittal axes)
  const rx = size * 0.36; // Left-Right width
  const ry = size * 0.44; // Anterior-Posterior length
  const rz = size * 0.38; // Superior-Inferior height

  // Ventricle radii
  const vrx = size * 0.12;
  const vry = size * 0.22;
  const vrz = size * 0.14;

  let defectMin: VoxelCoord = { x: 0, y: 0, z: 0 };
  let defectMax: VoxelCoord = { x: 0, y: 0, z: 0 };

  // Set scenario-specific defect bounding boxes
  if (scenario === "dura_inclusion") {
    defectMin = {
      x: Math.round(cx + rx * 0.65),
      y: Math.round(cy - ry * 0.2),
      z: Math.round(cz - rz * 0.1),
    };
    defectMax = {
      x: Math.round(cx + rx * 0.95),
      y: Math.round(cy + ry * 0.2),
      z: Math.round(cz + rz * 0.25),
    };
  } else if (scenario === "wm_hypointensity") {
    defectMin = {
      x: Math.round(cx - rx * 0.6),
      y: Math.round(cy - ry * 0.35),
      z: Math.round(cz - rz * 0.3),
    };
    defectMax = {
      x: Math.round(cx - rx * 0.25),
      y: Math.round(cy - ry * 0.05),
      z: Math.round(cz - rz * 0.05),
    };
  } else if (scenario === "skull_strip_erosion") {
    defectMin = {
      x: Math.round(cx - rx * 0.4),
      y: Math.round(cy + ry * 0.65),
      z: Math.round(cz - rz * 0.2),
    };
    defectMax = {
      x: Math.round(cx + rx * 0.4),
      y: Math.round(cy + ry * 0.95),
      z: Math.round(cz + rz * 0.2),
    };
  } else if (scenario === "topological_handle") {
    defectMin = {
      x: Math.round(cx + rx * 0.3),
      y: Math.round(cy + ry * 0.1),
      z: Math.round(cz + rz * 0.4),
    };
    defectMax = {
      x: Math.round(cx + rx * 0.55),
      y: Math.round(cy + ry * 0.35),
      z: Math.round(cz + rz * 0.65),
    };
  }

  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = getIndex(x, y, z, size);

        // Normalized distance from center
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const dz = (z - cz) / rz;

        // Hemispheric separation (longitudinal fissure)
        const fissure = Math.abs(x - cx) < 1.8 && dz > -0.3 ? 0.85 : 1.0;

        // Gyral/Sulcal procedural folding frequencies
        const folding =
          0.08 * Math.sin(x * 0.35) * Math.cos(y * 0.35) +
          0.06 * Math.sin(y * 0.45 + z * 0.3) +
          0.04 * Math.cos(x * 0.6 - z * 0.4);

        const rDist =
          Math.sqrt(dx * dx + dy * dy + dz * dz) * fissure + folding;

        // Skull / Head exterior
        const headDist = Math.sqrt(
          (dx * 0.85) ** 2 + (dy * 0.85) ** 2 + (dz * 0.85) ** 2
        );
        if (headDist > 1.25 && headDist < 1.4) {
          rawT1[idx] = Math.round(45 + Math.random() * 15); // Bone/Scalp
          labels[idx] = 6;
          continue;
        }

        // Outside brain parenchyma
        if (rDist > 1.05) {
          // Check for dura inclusion defect scenario
          if (
            scenario === "dura_inclusion" &&
            x >= defectMin.x &&
            x <= defectMax.x &&
            y >= defectMin.y &&
            y <= defectMax.y &&
            z >= defectMin.z &&
            z <= defectMax.z &&
            rDist <= 1.2
          ) {
            // Defect: Dura with GM-like intensity included in brainmask
            rawT1[idx] = Math.round(82 + Math.random() * 8);
            brainmask[idx] = 1;
            labels[idx] = 5; // Dura
          } else {
            rawT1[idx] = Math.round(Math.random() * 5); // Background air
            labels[idx] = 0;
          }
          continue;
        }

        // Skull strip over-erosion defect scenario
        if (
          scenario === "skull_strip_erosion" &&
          x >= defectMin.x &&
          x <= defectMax.x &&
          y >= defectMin.y &&
          y <= defectMax.y &&
          z >= defectMin.z &&
          z <= defectMax.z
        ) {
          // Defect: Brain mask erroneously zeroed out
          rawT1[idx] = Math.round(75 + Math.random() * 10);
          brainmask[idx] = 0; // Clipped!
          labels[idx] = 2;
          continue;
        }

        // Inside brain parenchyma
        brainmask[idx] = 1;

        // Check for Lateral Ventricles (CSF cavities)
        const vdx = (Math.abs(x - cx) - 4) / vrx;
        const vdy = (y - cy) / vry;
        const vdz = (z - (cz - 2)) / vrz;
        const ventDist = Math.sqrt(Math.max(0, vdx) ** 2 + vdy ** 2 + vdz ** 2);

        if (ventDist < 0.85 && Math.abs(x - cx) > 1.5) {
          rawT1[idx] = Math.round(20 + Math.random() * 10); // CSF
          labels[idx] = 1;
          continue;
        }

        // Subcortical Structures (Deep Gray Matter Nuclei)
        const subDist = Math.sqrt(
          ((x - cx) / 8) ** 2 + ((y - cy) / 12) ** 2 + ((z - cz) / 8) ** 2
        );
        if (subDist < 1.0) {
          rawT1[idx] = Math.round(85 + Math.random() * 8); // Thalamus/Basal Ganglia
          labels[idx] = 4;
          continue;
        }

        // White Matter Core vs Cortical Gray Matter Ribbon
        const wmThreshold = 0.72;

        // Topological handle defect scenario
        const isHandleVoxel =
          scenario === "topological_handle" &&
          x >= defectMin.x &&
          x <= defectMax.x &&
          y >= defectMin.y &&
          y <= defectMax.y &&
          z >= defectMin.z &&
          z <= defectMax.z;

        if (rDist < wmThreshold || isHandleVoxel) {
          // White Matter region
          let intensity = Math.round(110 + (Math.random() * 10 - 5)); // FreeSurfer 110 standard

          // WM Hypointensity defect scenario
          if (
            scenario === "wm_hypointensity" &&
            x >= defectMin.x &&
            x <= defectMax.x &&
            y >= defectMin.y &&
            y <= defectMax.y &&
            z >= defectMin.z &&
            z <= defectMax.z
          ) {
            intensity = Math.round(58 + Math.random() * 8); // Falsely low intensity!
            wmMask[idx] = 0; // Drop out
          } else {
            wmMask[idx] = 1;
          }

          rawT1[idx] = intensity;
          labels[idx] = 3;
        } else {
          // Cortical Gray Matter Ribbon
          const intensity = Math.round(75 + (Math.random() * 8 - 4));
          rawT1[idx] = intensity;
          labels[idx] = 2;
        }
      }
    }
  }

  const dimensions: VolumeDimensions = {
    width: size,
    height: size,
    depth: size,
  };
  const spacing: VoxelSpacing = { ...DEFAULT_VOXEL_SPACING };

  return {
    dimensions,
    spacing,
    affine: createDefaultAffine(dimensions, spacing),
    sourceFormat: "synthetic",
    rawT1,
    brainmask,
    wmMask,
    initialBrainmask: brainmask.slice(),
    initialWmMask: wmMask.slice(),
    labels,
    scenarioId: scenario,
    defectRegion: { min: defectMin, max: defectMax },
  };
}

/**
 * Extracted 2D slice payload with native dimensions and physical voxel spacing.
 */
export interface ExtractedSlice {
  width: number;
  height: number;
  pixels: Uint8Array;
  mask: Uint8Array;
  wm: Uint8Array;
  overlay?: Uint8Array;
  voxelWidthMm: number;
  voxelHeightMm: number;
}

/**
 * Extract a 2D slice from the 3D volume along an anatomical plane.
 */
export function extractSlice(
  volume: SyntheticVolume,
  plane: "axial" | "coronal" | "sagittal",
  sliceIndex: number
): ExtractedSlice {
  const { width, height, depth } = volume.dimensions;
  const spacing = volume.spacing ?? DEFAULT_VOXEL_SPACING;
  const hasOverlay = Boolean(
    volume.overlayMask && volume.overlayMask.length === width * height * depth
  );
  let sliceW = 0;
  let sliceH = 0;

  if (plane === "axial") {
    // Slice along Z axis -> X (width) vs Y (height)
    sliceW = width;
    sliceH = height;
    const clampedZ = clamp(sliceIndex, 0, depth - 1);
    const pixels = new Uint8Array(sliceW * sliceH);
    const mask = new Uint8Array(sliceW * sliceH);
    const wm = new Uint8Array(sliceW * sliceH);
    const overlay = hasOverlay ? new Uint8Array(sliceW * sliceH) : undefined;

    for (let y = 0; y < sliceH; y++) {
      for (let x = 0; x < sliceW; x++) {
        const vIdx = getIndex(x, y, clampedZ, width, height);
        const sIdx = y * sliceW + x;
        pixels[sIdx] = volume.rawT1[vIdx];
        mask[sIdx] = volume.brainmask[vIdx];
        wm[sIdx] = volume.wmMask[vIdx];
        if (overlay && volume.overlayMask) {
          overlay[sIdx] = volume.overlayMask[vIdx];
        }
      }
    }
    return {
      width: sliceW,
      height: sliceH,
      pixels,
      mask,
      wm,
      overlay,
      voxelWidthMm: spacing.x,
      voxelHeightMm: spacing.y,
    };
  } else if (plane === "coronal") {
    // Slice along Y axis -> X (width) vs Z (height)
    sliceW = width;
    sliceH = depth;
    const clampedY = clamp(sliceIndex, 0, height - 1);
    const pixels = new Uint8Array(sliceW * sliceH);
    const mask = new Uint8Array(sliceW * sliceH);
    const wm = new Uint8Array(sliceW * sliceH);
    const overlay = hasOverlay ? new Uint8Array(sliceW * sliceH) : undefined;

    for (let z = 0; z < sliceH; z++) {
      for (let x = 0; x < sliceW; x++) {
        const vIdx = getIndex(x, clampedY, z, width, height);
        // Invert Z so superior is at top
        const sIdx = (sliceH - 1 - z) * sliceW + x;
        pixels[sIdx] = volume.rawT1[vIdx];
        mask[sIdx] = volume.brainmask[vIdx];
        wm[sIdx] = volume.wmMask[vIdx];
        if (overlay && volume.overlayMask) {
          overlay[sIdx] = volume.overlayMask[vIdx];
        }
      }
    }
    return {
      width: sliceW,
      height: sliceH,
      pixels,
      mask,
      wm,
      overlay,
      voxelWidthMm: spacing.x,
      voxelHeightMm: spacing.z,
    };
  } else {
    // Sagittal: Slice along X axis -> Y (width) vs Z (height)
    sliceW = height;
    sliceH = depth;
    const clampedX = clamp(sliceIndex, 0, width - 1);
    const pixels = new Uint8Array(sliceW * sliceH);
    const mask = new Uint8Array(sliceW * sliceH);
    const wm = new Uint8Array(sliceW * sliceH);
    const overlay = hasOverlay ? new Uint8Array(sliceW * sliceH) : undefined;

    for (let z = 0; z < sliceH; z++) {
      for (let y = 0; y < sliceW; y++) {
        const vIdx = getIndex(clampedX, y, z, width, height);
        // Invert Z so superior is at top
        const sIdx = (sliceH - 1 - z) * sliceW + y;
        pixels[sIdx] = volume.rawT1[vIdx];
        mask[sIdx] = volume.brainmask[vIdx];
        wm[sIdx] = volume.wmMask[vIdx];
        if (overlay && volume.overlayMask) {
          overlay[sIdx] = volume.overlayMask[vIdx];
        }
      }
    }
    return {
      width: sliceW,
      height: sliceH,
      pixels,
      mask,
      wm,
      overlay,
      voxelWidthMm: spacing.y,
      voxelHeightMm: spacing.z,
    };
  }
}
