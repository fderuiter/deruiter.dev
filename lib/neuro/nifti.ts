/**
 * Public Native NIfTI-1 & FreeSurfer MGZ I/O Facade
 * Provides client-side file loading, overlay alignment validation,
 * NIfTI-1 `.nii.gz` mask export, and ROI metrics CSV download.
 */

import { downloadFile } from "../download";
import {
  buildRoiMetricsCsv,
  decodeNeuroOverlayMaskBytes,
  decodeNeuroVolumeBytes,
  encodeMaskToNifti1Bytes,
  gunzipBytes,
  gzipBytes,
  MAX_DECOMPRESSED_VOLUME_BYTES,
  MAX_NATIVE_VOLUME_DIM,
  validateOverlayAlignment,
  type NeuroCodecErrorCode,
  type NeuroCodecResult,
  type OverlayAlignmentResult,
} from "./internal/nifti-codec";
import type {
  AffineMatrix4x4,
  HistogramStats,
  OverlayMaskLayer,
  ROIRegionStats,
  VolumeDimensions,
  VoxelSpacing,
} from "./types";
import type { SyntheticVolume } from "./volume-generator";

export {
  gunzipBytes,
  gzipBytes,
  MAX_DECOMPRESSED_VOLUME_BYTES,
  MAX_NATIVE_VOLUME_DIM,
  validateOverlayAlignment,
  type NeuroCodecErrorCode,
  type NeuroCodecResult,
  type OverlayAlignmentResult,
};

/**
 * Parse a `.nii`, `.nii.gz`, `.mgh`, or `.mgz` byte buffer into a native
 * `SyntheticVolume` without resampling voxel dimensions or spacing.
 */
export async function parseNeuroVolumeBytes(
  bytes: Uint8Array,
  fileName = "uploaded.nii.gz"
): Promise<NeuroCodecResult<SyntheticVolume>> {
  return decodeNeuroVolumeBytes(bytes, fileName);
}

/**
 * Read a browser `File` (`.nii`, `.nii.gz`, `.mgh`, or `.mgz`) into a native
 * `SyntheticVolume` locally on the client.
 */
export async function loadNeuroVolumeFromFile(
  file: File
): Promise<NeuroCodecResult<SyntheticVolume>> {
  const arrayBuffer = await file.arrayBuffer();
  return decodeNeuroVolumeBytes(new Uint8Array(arrayBuffer), file.name);
}

/**
 * Parse an external `.nii` or `.nii.gz` segmentation overlay mask and verify
 * grid and affine alignment against the active volume.
 */
export async function parseNeuroOverlayMaskBytes(
  bytes: Uint8Array,
  fileName: string,
  referenceVolume: Pick<SyntheticVolume, "dimensions" | "spacing" | "affine">,
  initialOpacity = 0.55
): Promise<NeuroCodecResult<OverlayMaskLayer>> {
  return decodeNeuroOverlayMaskBytes(
    bytes,
    fileName,
    referenceVolume,
    initialOpacity
  );
}

/**
 * Read an external `.nii` or `.nii.gz` overlay mask `File` and validate its
 * header alignment against the active volume.
 */
export async function loadNeuroOverlayMaskFromFile(
  file: File,
  referenceVolume: Pick<SyntheticVolume, "dimensions" | "spacing" | "affine">,
  initialOpacity = 0.55
): Promise<NeuroCodecResult<OverlayMaskLayer>> {
  const arrayBuffer = await file.arrayBuffer();
  return decodeNeuroOverlayMaskBytes(
    new Uint8Array(arrayBuffer),
    file.name,
    referenceVolume,
    initialOpacity
  );
}

/**
 * Serialize a 3D mask into an uncompressed NIfTI-1 `.nii` byte array preserving
 * native dimensions, anisotropic spacing, and the source 4x4 affine matrix.
 */
export function serializeMaskToNiftiBytes(
  mask: Uint8Array,
  metadata: {
    dimensions: VolumeDimensions;
    spacing?: VoxelSpacing;
    affine?: AffineMatrix4x4;
    description?: string;
  }
): Uint8Array {
  return encodeMaskToNifti1Bytes(mask, metadata);
}

/**
 * Serialize and gzip-compress a 3D mask into a NIfTI-1 `.nii.gz` byte array
 * preserving native dimensions, spacing, and the source 4x4 affine matrix.
 */
export async function serializeMaskToNiftiGz(
  mask: Uint8Array,
  metadata: {
    dimensions: VolumeDimensions;
    spacing?: VoxelSpacing;
    affine?: AffineMatrix4x4;
    description?: string;
  }
): Promise<Uint8Array> {
  const rawNifti = encodeMaskToNifti1Bytes(mask, metadata);
  return gzipBytes(rawNifti);
}

/**
 * Export and download a 3D segmentation mask as a `.nii.gz` file in the browser.
 */
export async function exportMaskAsNiftiGz(
  mask: Uint8Array,
  metadata: {
    dimensions: VolumeDimensions;
    spacing?: VoxelSpacing;
    affine?: AffineMatrix4x4;
    description?: string;
  },
  filename = "neurorecon-mask.nii.gz"
): Promise<Uint8Array> {
  const gzBytes = await serializeMaskToNiftiGz(mask, metadata);
  const safeName = filename.endsWith(".nii.gz")
    ? filename
    : `${filename.replace(/\.(nii|mgz|mgh)$/i, "")}.nii.gz`;
  const copyBuffer = new ArrayBuffer(gzBytes.byteLength);
  new Uint8Array(copyBuffer).set(gzBytes);
  const blob = new Blob([copyBuffer], { type: "application/gzip" });
  downloadFile(blob, safeName);
  return gzBytes;
}

/**
 * Format ROI region-growing and intensity histogram statistics as CSV text.
 */
export function formatRoiMetricsCsv(input: {
  sourceName?: string;
  dimensions: VolumeDimensions;
  spacing?: VoxelSpacing;
  roiStats?: ROIRegionStats | null;
  histogram?: HistogramStats | null;
}): string {
  return buildRoiMetricsCsv(input);
}

/**
 * Export and download ROI and histogram analytics as a `.csv` file.
 */
export function exportRoiMetricsCsv(
  input: {
    sourceName?: string;
    dimensions: VolumeDimensions;
    spacing?: VoxelSpacing;
    roiStats?: ROIRegionStats | null;
    histogram?: HistogramStats | null;
  },
  filename = "neurorecon-roi-metrics.csv"
): string {
  const csv = buildRoiMetricsCsv(input);
  const safeName = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  downloadFile(csv, safeName, { mimeType: "text/csv;charset=utf-8;" });
  return csv;
}
