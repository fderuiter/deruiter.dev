/**
 * Browser-Native NIfTI-1 and FreeSurfer MGH/MGZ Binary Codec
 * Parses `.nii`, `.nii.gz`, `.mgh`, and `.mgz` volumetric brain scans at native
 * matrix dimensions (up to 256x256x256) and anisotropic voxel spacing without
 * resampling loss, validates overlay mask spatial alignment, and serializes
 * NIfTI-1 `.nii.gz` masks and ROI analytics CSV reports.
 */

import { clamp } from "@/lib/game-utils";
import {
  AffineMatrix4x4,
  HistogramStats,
  OverlayMaskLayer,
  ROIRegionStats,
  VolumeDimensions,
  VolumeSourceFormat,
  VoxelSpacing,
} from "../types";
import {
  createDefaultAffine,
  DEFAULT_VOXEL_SPACING,
  SyntheticVolume,
} from "../volume-generator";

/** Maximum supported voxel dimension per spatial axis. */
export const MAX_NATIVE_VOLUME_DIM = 256;

/** Guard ceiling on gunzipped payload size (160 MB fits 256^3 float64 + header). */
export const MAX_DECOMPRESSED_VOLUME_BYTES = 160 * 1024 * 1024;

const NIFTI1_HEADER_SIZE = 348;
const NIFTI1_MIN_VOX_OFFSET = 352;
const MGH_HEADER_SIZE = 284;

/** Structured error codes returned by native volume and overlay parsers. */
export type NeuroCodecErrorCode =
  | "EMPTY_PAYLOAD"
  | "DECOMPRESSION_FAILED"
  | "INVALID_HEADER"
  | "UNSUPPORTED_DATATYPE"
  | "UNSUPPORTED_DIMENSIONS"
  | "TRUNCATED_PAYLOAD"
  | "ALIGNMENT_MISMATCH";

/** Result envelope returned when parsing a volume or overlay mask. */
export type NeuroCodecResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly code: NeuroCodecErrorCode;
      readonly message: string;
    };

/** Spatial alignment validation result comparing an overlay mask against a base scan. */
export interface OverlayAlignmentResult {
  readonly valid: boolean;
  readonly reason?: string;
}

interface ParsedHeaderMeta {
  format: Exclude<VolumeSourceFormat, "synthetic">;
  dimensions: VolumeDimensions;
  spacing: VoxelSpacing;
  affine: AffineMatrix4x4;
  hasExplicitAffine: boolean;
  littleEndian: boolean;
  dataOffset: number;
  bytesPerVoxel: number;
  sclSlope: number;
  sclInter: number;
  readRawScalar: (view: DataView, byteOffset: number) => number;
}

function isGzipMagic(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/**
 * Decompress a gzip byte buffer using browser-native DecompressionStream.
 */
export async function gunzipBytes(
  compressed: Uint8Array,
  maxBytes = MAX_DECOMPRESSED_VOLUME_BYTES
): Promise<NeuroCodecResult<Uint8Array>> {
  if (typeof globalThis.DecompressionStream === "undefined") {
    return {
      ok: false,
      code: "DECOMPRESSION_FAILED",
      message: "Browser DecompressionStream API is unavailable.",
    };
  }

  try {
    const ds = new globalThis.DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    const copy = new Uint8Array(compressed.byteLength);
    copy.set(compressed);
    const writePromise = writer
      .write(copy)
      .then(() => writer.close())
      .catch(() => undefined);

    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        totalLength += value.byteLength;
        if (totalLength > maxBytes) {
          await reader.cancel();
          return {
            ok: false,
            code: "UNSUPPORTED_DIMENSIONS",
            message: `Decompressed scan exceeds the ${(maxBytes / (1024 * 1024)).toFixed(0)} MB safety ceiling.`,
          };
        }
        chunks.push(value);
      }
    }

    await writePromise;
    const output = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, data: output };
  } catch {
    return {
      ok: false,
      code: "DECOMPRESSION_FAILED",
      message: "Corrupt or truncated gzip stream in neuroimaging file.",
    };
  }
}

/**
 * Compress raw bytes into gzip format using browser-native CompressionStream.
 */
export async function gzipBytes(raw: Uint8Array): Promise<Uint8Array> {
  const cs = new globalThis.CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  const copy = new Uint8Array(raw.byteLength);
  copy.set(raw);
  const writePromise = writer.write(copy).then(() => writer.close());

  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      totalLength += value.byteLength;
    }
  }
  await writePromise;

  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function buildQuaternionAffine(
  qb: number,
  qc: number,
  qd: number,
  qoffsetX: number,
  qoffsetY: number,
  qoffsetZ: number,
  spacing: VoxelSpacing,
  qfac: number
): AffineMatrix4x4 {
  const b = Number.isFinite(qb) ? qb : 0;
  const c = Number.isFinite(qc) ? qc : 0;
  const d = Number.isFinite(qd) ? qd : 0;
  const aSq = 1.0 - (b * b + c * c + d * d);
  const a = aSq > 0 ? Math.sqrt(aSq) : 0;

  const r00 = a * a + b * b - c * c - d * d;
  const r01 = 2 * (b * c - a * d);
  const r02 = 2 * (b * d + a * c);
  const r10 = 2 * (b * c + a * d);
  const r11 = a * a + c * c - b * b - d * d;
  const r12 = 2 * (c * d - a * b);
  const r20 = 2 * (b * d - a * c);
  const r21 = 2 * (c * d + a * b);
  const r22 = a * a + d * d - c * c - b * b;

  const dzSigned = spacing.z * (qfac < 0 ? -1 : 1);
  const ox = Number.isFinite(qoffsetX) ? qoffsetX : 0;
  const oy = Number.isFinite(qoffsetY) ? qoffsetY : 0;
  const oz = Number.isFinite(qoffsetZ) ? qoffsetZ : 0;

  return [
    r00 * spacing.x,
    r01 * spacing.y,
    r02 * dzSigned,
    ox,
    r10 * spacing.x,
    r11 * spacing.y,
    r12 * dzSigned,
    oy,
    r20 * spacing.x,
    r21 * spacing.y,
    r22 * dzSigned,
    oz,
    0,
    0,
    0,
    1,
  ];
}

function resolveNiftiDatatypeReader(
  datatype: number,
  littleEndian: boolean
): {
  bytesPerVoxel: number;
  read: (view: DataView, byteOffset: number) => number;
} | null {
  switch (datatype) {
    case 2: // DT_UINT8
      return {
        bytesPerVoxel: 1,
        read: (view, o) => view.getUint8(o),
      };
    case 256: // DT_INT8
      return {
        bytesPerVoxel: 1,
        read: (view, o) => view.getInt8(o),
      };
    case 4: // DT_INT16
      return {
        bytesPerVoxel: 2,
        read: (view, o) => view.getInt16(o, littleEndian),
      };
    case 512: // DT_UINT16
      return {
        bytesPerVoxel: 2,
        read: (view, o) => view.getUint16(o, littleEndian),
      };
    case 8: // DT_INT32
      return {
        bytesPerVoxel: 4,
        read: (view, o) => view.getInt32(o, littleEndian),
      };
    case 768: // DT_UINT32
      return {
        bytesPerVoxel: 4,
        read: (view, o) => view.getUint32(o, littleEndian),
      };
    case 16: // DT_FLOAT32
      return {
        bytesPerVoxel: 4,
        read: (view, o) => view.getFloat32(o, littleEndian),
      };
    case 64: // DT_FLOAT64
      return {
        bytesPerVoxel: 8,
        read: (view, o) => view.getFloat64(o, littleEndian),
      };
    default:
      return null;
  }
}

function parseNifti1Header(
  bytes: Uint8Array
): NeuroCodecResult<ParsedHeaderMeta> {
  if (bytes.byteLength < NIFTI1_HEADER_SIZE) {
    return {
      ok: false,
      code: "INVALID_HEADER",
      message: "NIfTI-1 file is smaller than the 348-byte header.",
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const hdrLE = view.getInt32(0, true);
  const hdrBE = view.getInt32(0, false);
  if (hdrLE !== NIFTI1_HEADER_SIZE && hdrBE !== NIFTI1_HEADER_SIZE) {
    return {
      ok: false,
      code: "INVALID_HEADER",
      message:
        "Unrecognized neuroimaging header (expected NIfTI-1 or FreeSurfer MGH).",
    };
  }
  const littleEndian = hdrLE === NIFTI1_HEADER_SIZE;

  const width = view.getInt16(42, littleEndian);
  const height = view.getInt16(44, littleEndian);
  const depth = Math.max(1, view.getInt16(46, littleEndian));

  if (
    width < 1 ||
    height < 1 ||
    depth < 1 ||
    width > MAX_NATIVE_VOLUME_DIM ||
    height > MAX_NATIVE_VOLUME_DIM ||
    depth > MAX_NATIVE_VOLUME_DIM
  ) {
    return {
      ok: false,
      code: "UNSUPPORTED_DIMENSIONS",
      message: `Volume dimensions ${width}x${height}x${depth} exceed supported bounds (1..${MAX_NATIVE_VOLUME_DIM}).`,
    };
  }

  const datatype = view.getInt16(70, littleEndian);
  const readerInfo = resolveNiftiDatatypeReader(datatype, littleEndian);
  if (!readerInfo) {
    return {
      ok: false,
      code: "UNSUPPORTED_DATATYPE",
      message: `Unsupported NIfTI datatype code ${datatype}.`,
    };
  }

  const rawQfac = view.getFloat32(76, littleEndian);
  const qfac = rawQfac < 0 ? -1 : 1;
  const rawDx = Math.abs(view.getFloat32(80, littleEndian));
  const rawDy = Math.abs(view.getFloat32(84, littleEndian));
  const rawDz = Math.abs(view.getFloat32(88, littleEndian));

  const spacing: VoxelSpacing = {
    x: Number.isFinite(rawDx) && rawDx > 1e-5 ? rawDx : 1,
    y: Number.isFinite(rawDy) && rawDy > 1e-5 ? rawDy : 1,
    z: Number.isFinite(rawDz) && rawDz > 1e-5 ? rawDz : 1,
  };

  const rawVoxOffset = view.getFloat32(108, littleEndian);
  const dataOffset =
    Number.isFinite(rawVoxOffset) && rawVoxOffset >= NIFTI1_HEADER_SIZE
      ? Math.floor(rawVoxOffset)
      : NIFTI1_MIN_VOX_OFFSET;

  const totalVoxels = width * height * depth;
  const requiredBytes = dataOffset + totalVoxels * readerInfo.bytesPerVoxel;
  if (bytes.byteLength < requiredBytes) {
    return {
      ok: false,
      code: "TRUNCATED_PAYLOAD",
      message: `Truncated NIfTI voxel payload (expected ${requiredBytes} bytes, received ${bytes.byteLength}).`,
    };
  }

  const rawSlope = view.getFloat32(112, littleEndian);
  const rawInter = view.getFloat32(116, littleEndian);
  const sclSlope = Number.isFinite(rawSlope) && rawSlope !== 0 ? rawSlope : 1;
  const sclInter =
    Number.isFinite(rawSlope) && rawSlope !== 0 && Number.isFinite(rawInter)
      ? rawInter
      : 0;

  const qformCode = view.getInt16(252, littleEndian);
  const sformCode = view.getInt16(254, littleEndian);
  const dimensions: VolumeDimensions = { width, height, depth };

  let affine: AffineMatrix4x4;
  let hasExplicitAffine = false;

  if (sformCode > 0) {
    hasExplicitAffine = true;
    const srow: number[] = [];
    for (let i = 0; i < 12; i++) {
      const v = view.getFloat32(280 + i * 4, littleEndian);
      srow.push(Number.isFinite(v) ? v : 0);
    }
    affine = [
      srow[0],
      srow[1],
      srow[2],
      srow[3],
      srow[4],
      srow[5],
      srow[6],
      srow[7],
      srow[8],
      srow[9],
      srow[10],
      srow[11],
      0,
      0,
      0,
      1,
    ];
  } else if (qformCode > 0) {
    hasExplicitAffine = true;
    affine = buildQuaternionAffine(
      view.getFloat32(256, littleEndian),
      view.getFloat32(260, littleEndian),
      view.getFloat32(264, littleEndian),
      view.getFloat32(268, littleEndian),
      view.getFloat32(272, littleEndian),
      view.getFloat32(276, littleEndian),
      spacing,
      qfac
    );
  } else {
    affine = createDefaultAffine(dimensions, spacing);
  }

  return {
    ok: true,
    data: {
      format: "nifti",
      dimensions,
      spacing,
      affine,
      hasExplicitAffine,
      littleEndian,
      dataOffset,
      bytesPerVoxel: readerInfo.bytesPerVoxel,
      sclSlope,
      sclInter,
      readRawScalar: readerInfo.read,
    },
  };
}

function parseMghHeader(bytes: Uint8Array): NeuroCodecResult<ParsedHeaderMeta> {
  if (bytes.byteLength < MGH_HEADER_SIZE) {
    return {
      ok: false,
      code: "INVALID_HEADER",
      message: "FreeSurfer MGH/MGZ file is smaller than the 284-byte header.",
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getInt32(0, false);
  if (version !== 1) {
    return {
      ok: false,
      code: "INVALID_HEADER",
      message: `Invalid FreeSurfer MGH version ${version} (expected 1).`,
    };
  }

  const width = view.getInt32(4, false);
  const height = view.getInt32(8, false);
  const depth = Math.max(1, view.getInt32(12, false));
  const nframes = view.getInt32(16, false);
  const mriType = view.getInt32(20, false);

  if (nframes < 1) {
    return {
      ok: false,
      code: "INVALID_HEADER",
      message: "FreeSurfer MGH header specifies zero frames.",
    };
  }

  if (
    width < 1 ||
    height < 1 ||
    depth < 1 ||
    width > MAX_NATIVE_VOLUME_DIM ||
    height > MAX_NATIVE_VOLUME_DIM ||
    depth > MAX_NATIVE_VOLUME_DIM
  ) {
    return {
      ok: false,
      code: "UNSUPPORTED_DIMENSIONS",
      message: `MGH dimensions ${width}x${height}x${depth} exceed supported bounds (1..${MAX_NATIVE_VOLUME_DIM}).`,
    };
  }

  let bytesPerVoxel = 0;
  let readRawScalar: ((v: DataView, o: number) => number) | null = null;
  switch (mriType) {
    case 0: // MRI_UCHAR
      bytesPerVoxel = 1;
      readRawScalar = (v, o) => v.getUint8(o);
      break;
    case 4: // MRI_SHORT
      bytesPerVoxel = 2;
      readRawScalar = (v, o) => v.getInt16(o, false);
      break;
    case 1: // MRI_INT
      bytesPerVoxel = 4;
      readRawScalar = (v, o) => v.getInt32(o, false);
      break;
    case 3: // MRI_FLOAT
      bytesPerVoxel = 4;
      readRawScalar = (v, o) => v.getFloat32(o, false);
      break;
    default:
      return {
        ok: false,
        code: "UNSUPPORTED_DATATYPE",
        message: `Unsupported FreeSurfer MGH data type ${mriType}.`,
      };
  }

  const totalVoxels = width * height * depth;
  const requiredBytes = MGH_HEADER_SIZE + totalVoxels * bytesPerVoxel;
  if (bytes.byteLength < requiredBytes) {
    return {
      ok: false,
      code: "TRUNCATED_PAYLOAD",
      message: `Truncated MGH voxel payload (expected ${requiredBytes} bytes, received ${bytes.byteLength}).`,
    };
  }

  const dimensions: VolumeDimensions = { width, height, depth };
  const goodRasFlag = view.getInt16(28, false);
  let spacing: VoxelSpacing = { ...DEFAULT_VOXEL_SPACING };
  let affine: AffineMatrix4x4;
  let hasExplicitAffine = false;

  if (goodRasFlag === 1) {
    const rawDx = Math.abs(view.getFloat32(30, false));
    const rawDy = Math.abs(view.getFloat32(34, false));
    const rawDz = Math.abs(view.getFloat32(38, false));
    spacing = {
      x: Number.isFinite(rawDx) && rawDx > 1e-5 ? rawDx : 1,
      y: Number.isFinite(rawDy) && rawDy > 1e-5 ? rawDy : 1,
      z: Number.isFinite(rawDz) && rawDz > 1e-5 ? rawDz : 1,
    };

    const xr = view.getFloat32(42, false);
    const xa = view.getFloat32(46, false);
    const xs = view.getFloat32(50, false);
    const yr = view.getFloat32(54, false);
    const ya = view.getFloat32(58, false);
    const ys = view.getFloat32(62, false);
    const zr = view.getFloat32(66, false);
    const za = view.getFloat32(70, false);
    const zs = view.getFloat32(74, false);
    const cr = view.getFloat32(78, false);
    const ca = view.getFloat32(82, false);
    const cs = view.getFloat32(86, false);

    if (
      [xr, xa, xs, yr, ya, ys, zr, za, zs, cr, ca, cs].every(Number.isFinite)
    ) {
      hasExplicitAffine = true;
      const m00 = xr * spacing.x;
      const m01 = yr * spacing.y;
      const m02 = zr * spacing.z;
      const m03 = cr - (m00 * width + m01 * height + m02 * depth) / 2;

      const m10 = xa * spacing.x;
      const m11 = ya * spacing.y;
      const m12 = za * spacing.z;
      const m13 = ca - (m10 * width + m11 * height + m12 * depth) / 2;

      const m20 = xs * spacing.x;
      const m21 = ys * spacing.y;
      const m22 = zs * spacing.z;
      const m23 = cs - (m20 * width + m21 * height + m22 * depth) / 2;

      affine = [
        m00,
        m01,
        m02,
        m03,
        m10,
        m11,
        m12,
        m13,
        m20,
        m21,
        m22,
        m23,
        0,
        0,
        0,
        1,
      ];
    } else {
      affine = createDefaultAffine(dimensions, spacing);
    }
  } else {
    affine = createDefaultAffine(dimensions, spacing);
  }

  return {
    ok: true,
    data: {
      format: "mgz",
      dimensions,
      spacing,
      affine,
      hasExplicitAffine,
      littleEndian: false,
      dataOffset: MGH_HEADER_SIZE,
      bytesPerVoxel,
      sclSlope: 1,
      sclInter: 0,
      readRawScalar,
    },
  };
}

function parseHeaderAuto(
  bytes: Uint8Array,
  fileName: string
): NeuroCodecResult<ParsedHeaderMeta> {
  if (bytes.byteLength < MGH_HEADER_SIZE) {
    return {
      ok: false,
      code: "INVALID_HEADER",
      message: "File is too small to contain a valid NIfTI or MGH header.",
    };
  }

  const lower = fileName.toLowerCase();
  const prefersMgh = lower.endsWith(".mgz") || lower.endsWith(".mgh");

  if (prefersMgh) {
    const mgh = parseMghHeader(bytes);
    if (mgh.ok) return mgh;
    if (bytes.byteLength >= NIFTI1_HEADER_SIZE) {
      const nii = parseNifti1Header(bytes);
      if (nii.ok) return nii;
    }
    return mgh;
  }

  if (bytes.byteLength >= NIFTI1_HEADER_SIZE) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const hdrLE = view.getInt32(0, true);
    const hdrBE = view.getInt32(0, false);
    if (hdrLE === NIFTI1_HEADER_SIZE || hdrBE === NIFTI1_HEADER_SIZE) {
      return parseNifti1Header(bytes);
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getInt32(0, false) === 1) {
    return parseMghHeader(bytes);
  }

  return {
    ok: false,
    code: "INVALID_HEADER",
    message:
      "Unsupported neuroimaging file header. Expected NIfTI-1 (.nii, .nii.gz) or FreeSurfer (.mgz, .mgh).",
  };
}

/**
 * Parse raw or gzipped `.nii`, `.nii.gz`, `.mgh`, or `.mgz` bytes into a native
 * `SyntheticVolume` without resampling voxel grids.
 */
export async function decodeNeuroVolumeBytes(
  inputBytes: Uint8Array,
  fileName = "uploaded.nii.gz"
): Promise<NeuroCodecResult<SyntheticVolume>> {
  if (!inputBytes || inputBytes.byteLength === 0) {
    return {
      ok: false,
      code: "EMPTY_PAYLOAD",
      message: "Uploaded file is empty.",
    };
  }

  let rawBytes = inputBytes;
  if (isGzipMagic(inputBytes)) {
    const decompressed = await gunzipBytes(inputBytes);
    if (!decompressed.ok) return decompressed;
    rawBytes = decompressed.data;
  }

  const headerResult = parseHeaderAuto(rawBytes, fileName);
  if (!headerResult.ok) return headerResult;

  const meta = headerResult.data;
  const { width, height, depth } = meta.dimensions;
  const totalVoxels = width * height * depth;
  const view = new DataView(
    rawBytes.buffer,
    rawBytes.byteOffset,
    rawBytes.byteLength
  );

  // Fast two-pass streaming normalization (zero Float64Array heap spike on 256^3)
  let minVal = Infinity;
  let maxVal = -Infinity;
  const { dataOffset, bytesPerVoxel, sclSlope, sclInter, readRawScalar } = meta;

  for (let i = 0; i < totalVoxels; i++) {
    const raw = readRawScalar(view, dataOffset + i * bytesPerVoxel);
    const scaled = raw * sclSlope + sclInter;
    if (Number.isFinite(scaled)) {
      if (scaled < minVal) minVal = scaled;
      if (scaled > maxVal) maxVal = scaled;
    }
  }

  const rawT1 = new Uint8Array(totalVoxels);
  const fgBins = new Uint32Array(256);
  let fgCount = 0;

  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
    minVal = 0;
    maxVal = 0;
  }

  const preserveDirectUint8 =
    bytesPerVoxel === 1 &&
    sclSlope === 1 &&
    sclInter === 0 &&
    minVal >= 0 &&
    maxVal <= 255;

  const range = maxVal - minVal;

  for (let i = 0; i < totalVoxels; i++) {
    const raw = readRawScalar(view, dataOffset + i * bytesPerVoxel);
    const scaled = raw * sclSlope + sclInter;
    let u8 = 0;
    if (Number.isFinite(scaled)) {
      if (preserveDirectUint8) {
        u8 = Math.round(scaled);
      } else if (range > 1e-6) {
        u8 = Math.round(((scaled - minVal) / range) * 255);
      } else if (scaled > 0) {
        u8 = 128;
      }
    }
    if (u8 < 0) u8 = 0;
    if (u8 > 255) u8 = 255;
    rawT1[i] = u8;
    if (u8 >= 15) {
      fgBins[u8]++;
      fgCount++;
    }
  }

  // Adaptive percentile thresholds from foreground intensity histogram
  let brainThreshold = 25;
  let wmThreshold = 95;
  if (fgCount > 0) {
    let acc = 0;
    const p15 = fgCount * 0.15;
    const p68 = fgCount * 0.68;
    let foundBrain = false;
    for (let b = 15; b < 256; b++) {
      acc += fgBins[b];
      if (!foundBrain && acc >= p15) {
        brainThreshold = clamp(b, 18, 85);
        foundBrain = true;
      }
      if (acc >= p68) {
        wmThreshold = clamp(b, brainThreshold + 15, 220);
        break;
      }
    }
  }

  const brainmask = new Uint8Array(totalVoxels);
  const wmMask = new Uint8Array(totalVoxels);
  const labels = new Uint8Array(totalVoxels);

  for (let i = 0; i < totalVoxels; i++) {
    const val = rawT1[i];
    if (val >= brainThreshold) {
      brainmask[i] = 1;
      if (val >= wmThreshold) {
        wmMask[i] = 1;
        labels[i] = 3; // White matter
      } else {
        labels[i] = 2; // Gray matter
      }
    }
  }

  return {
    ok: true,
    data: {
      dimensions: meta.dimensions,
      spacing: meta.spacing,
      affine: meta.affine,
      sourceFormat: meta.format,
      fileName,
      rawT1,
      brainmask,
      wmMask,
      initialBrainmask: brainmask.slice(),
      initialWmMask: wmMask.slice(),
      labels,
      scenarioId: "sandbox",
      defectRegion: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
      },
    },
  };
}

/**
 * Validate whether an imported overlay mask aligns with the base volume's
 * voxel matrix dimensions, physical spacing, and spatial affine matrix.
 */
export function validateOverlayAlignment(
  overlay: {
    dimensions: VolumeDimensions;
    spacing: VoxelSpacing;
    affine?: AffineMatrix4x4;
    hasExplicitAffine?: boolean;
  },
  reference: {
    dimensions: VolumeDimensions;
    spacing?: VoxelSpacing;
    affine?: AffineMatrix4x4;
  }
): OverlayAlignmentResult {
  const { width: ow, height: oh, depth: od } = overlay.dimensions;
  const { width: rw, height: rh, depth: rd } = reference.dimensions;

  if (ow !== rw || oh !== rh || od !== rd) {
    return {
      valid: false,
      reason: `Overlay grid (${ow}x${oh}x${od}) does not match active volume dimensions (${rw}x${rh}x${rd}).`,
    };
  }

  const refSpacing = reference.spacing ?? DEFAULT_VOXEL_SPACING;
  const spacingTol = 0.02;
  if (
    Math.abs(overlay.spacing.x - refSpacing.x) > spacingTol ||
    Math.abs(overlay.spacing.y - refSpacing.y) > spacingTol ||
    Math.abs(overlay.spacing.z - refSpacing.z) > spacingTol
  ) {
    return {
      valid: false,
      reason: `Overlay voxel spacing (${overlay.spacing.x.toFixed(2)}x${overlay.spacing.y.toFixed(2)}x${overlay.spacing.z.toFixed(2)} mm) mismatches scan spacing (${refSpacing.x.toFixed(2)}x${refSpacing.y.toFixed(2)}x${refSpacing.z.toFixed(2)} mm).`,
    };
  }

  if (
    overlay.affine &&
    reference.affine &&
    overlay.hasExplicitAffine !== false
  ) {
    for (let i = 0; i < 12; i++) {
      const isTranslation = i % 4 === 3;
      const tol = isTranslation ? 0.1 : 0.03;
      if (Math.abs(overlay.affine[i] - reference.affine[i]) > tol) {
        return {
          valid: false,
          reason:
            "Overlay spatial affine matrix (orientation or origin) is misaligned with the active volume.",
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Decode an external `.nii` or `.nii.gz` segmentation overlay mask and verify
 * spatial header alignment against the active volume.
 */
export async function decodeNeuroOverlayMaskBytes(
  inputBytes: Uint8Array,
  fileName: string,
  referenceVolume: Pick<SyntheticVolume, "dimensions" | "spacing" | "affine">,
  initialOpacity = 0.55
): Promise<NeuroCodecResult<OverlayMaskLayer>> {
  if (!inputBytes || inputBytes.byteLength === 0) {
    return {
      ok: false,
      code: "EMPTY_PAYLOAD",
      message: "Overlay mask file is empty.",
    };
  }

  let rawBytes = inputBytes;
  if (isGzipMagic(inputBytes)) {
    const decompressed = await gunzipBytes(inputBytes);
    if (!decompressed.ok) return decompressed;
    rawBytes = decompressed.data;
  }

  const headerResult = parseHeaderAuto(rawBytes, fileName);
  if (!headerResult.ok) return headerResult;

  const meta = headerResult.data;
  const alignment = validateOverlayAlignment(meta, referenceVolume);
  if (!alignment.valid) {
    return {
      ok: false,
      code: "ALIGNMENT_MISMATCH",
      message: alignment.reason ?? "Overlay header does not align with volume.",
    };
  }

  const totalVoxels =
    meta.dimensions.width * meta.dimensions.height * meta.dimensions.depth;
  const data = new Uint8Array(totalVoxels);
  const view = new DataView(
    rawBytes.buffer,
    rawBytes.byteOffset,
    rawBytes.byteLength
  );

  for (let i = 0; i < totalVoxels; i++) {
    const raw = meta.readRawScalar(
      view,
      meta.dataOffset + i * meta.bytesPerVoxel
    );
    const val = raw * meta.sclSlope + meta.sclInter;
    if (Number.isFinite(val) && val > 0) {
      data[i] = val >= 255 ? 255 : Math.max(1, Math.round(val));
    }
  }

  return {
    ok: true,
    data: {
      name: fileName,
      data,
      opacity: clamp(initialOpacity, 0, 1),
      visible: true,
      dimensions: meta.dimensions,
      spacing: meta.spacing,
      affine: meta.affine,
    },
  };
}

/**
 * Serialize a 3D binary/label mask into an uncompressed NIfTI-1 byte buffer
 * preserving native matrix dimensions, voxel spacing, and source 4x4 affine matrix.
 */
export function encodeMaskToNifti1Bytes(
  mask: Uint8Array,
  metadata: {
    dimensions: VolumeDimensions;
    spacing?: VoxelSpacing;
    affine?: AffineMatrix4x4;
    description?: string;
  }
): Uint8Array {
  const { width, height, depth } = metadata.dimensions;
  const spacing = metadata.spacing ?? DEFAULT_VOXEL_SPACING;
  const affine =
    metadata.affine ?? createDefaultAffine(metadata.dimensions, spacing);
  const totalVoxels = width * height * depth;

  const buffer = new ArrayBuffer(NIFTI1_MIN_VOX_OFFSET + totalVoxels);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // sizeof_hdr = 348 (little-endian)
  view.setInt32(0, NIFTI1_HEADER_SIZE, true);

  // dim[0..7] at offset 40
  view.setInt16(40, 3, true);
  view.setInt16(42, width, true);
  view.setInt16(44, height, true);
  view.setInt16(46, depth, true);
  view.setInt16(48, 1, true);
  view.setInt16(50, 1, true);
  view.setInt16(52, 1, true);
  view.setInt16(54, 1, true);

  // datatype = 2 (DT_UINT8), bitpix = 8
  view.setInt16(70, 2, true);
  view.setInt16(72, 8, true);

  // pixdim[0..3]
  view.setFloat32(76, 1.0, true);
  view.setFloat32(80, spacing.x, true);
  view.setFloat32(84, spacing.y, true);
  view.setFloat32(88, spacing.z, true);

  // vox_offset = 352, scl_slope = 1, scl_inter = 0
  view.setFloat32(108, NIFTI1_MIN_VOX_OFFSET, true);
  view.setFloat32(112, 1.0, true);
  view.setFloat32(116, 0.0, true);
  // xyzt_units = 2 (millimeters)
  view.setUint8(123, 2);

  // Optional 80-char descrip at offset 148
  const desc = (metadata.description ?? "NeuroRecon mask export").slice(0, 79);
  for (let i = 0; i < desc.length; i++) {
    view.setUint8(148 + i, desc.charCodeAt(i) & 0x7f);
  }

  // qform_code = 1, sform_code = 1 (NIFTI_XFORM_SCANNER_ANAT)
  view.setInt16(252, 1, true);
  view.setInt16(254, 1, true);

  // qoffset_x, qoffset_y, qoffset_z
  view.setFloat32(268, affine[3], true);
  view.setFloat32(272, affine[7], true);
  view.setFloat32(276, affine[11], true);

  // srow_x, srow_y, srow_z (12 float32 entries at 280..327)
  for (let i = 0; i < 12; i++) {
    view.setFloat32(280 + i * 4, affine[i], true);
  }

  // magic = "n+1\0" at offset 344
  bytes[344] = 0x6e; // 'n'
  bytes[345] = 0x2b; // '+'
  bytes[346] = 0x31; // '1'
  bytes[347] = 0x00;

  const copyLen = Math.min(totalVoxels, mask.byteLength);
  bytes.set(mask.subarray(0, copyLen), NIFTI1_MIN_VOX_OFFSET);

  return bytes;
}

/**
 * Format ROI region-growing statistics and 256-bin histogram analytics as CSV.
 */
export function buildRoiMetricsCsv(input: {
  sourceName?: string;
  dimensions: VolumeDimensions;
  spacing?: VoxelSpacing;
  roiStats?: ROIRegionStats | null;
  histogram?: HistogramStats | null;
}): string {
  const spacing = input.spacing ?? DEFAULT_VOXEL_SPACING;
  const voxelVol = Number((spacing.x * spacing.y * spacing.z).toFixed(4));
  const escapeCsv = (val: string | number): string => {
    const str = String(val);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows: string[] = [
    "section,metric,value,unit",
    `volume,source,${escapeCsv(input.sourceName ?? "synthetic_phantom")},label`,
    `volume,dimensions,${escapeCsv(`${input.dimensions.width}x${input.dimensions.height}x${input.dimensions.depth}`)},voxels`,
    `volume,spacing_x,${spacing.x},mm`,
    `volume,spacing_y,${spacing.y},mm`,
    `volume,spacing_z,${spacing.z},mm`,
    `volume,voxel_volume,${voxelVol},mm3`,
  ];

  if (input.roiStats) {
    const r = input.roiStats;
    rows.push(
      `roi,seed_coord,${escapeCsv(`${r.seed.x};${r.seed.y};${r.seed.z}`)},voxel`,
      `roi,voxel_count,${r.voxelCount},voxels`,
      `roi,volume_mm3,${r.volumeMm3},mm3`,
      `roi,mean_intensity,${r.meanIntensity},intensity`,
      `roi,std_dev_intensity,${r.stdDevIntensity},intensity`,
      `roi,min_intensity,${r.minIntensity},intensity`,
      `roi,max_intensity,${r.maxIntensity},intensity`
    );
  }

  if (input.histogram) {
    const h = input.histogram;
    rows.push(
      `histogram,total_voxels,${h.totalVoxels},voxels`,
      `histogram,volume_mm3,${h.volumeMm3},mm3`,
      `histogram,mean,${h.mean},intensity`,
      `histogram,std_dev,${h.stdDev},intensity`,
      `histogram,median,${h.median},intensity`,
      `histogram,mode,${h.mode},intensity`,
      `histogram,min,${h.min},intensity`,
      `histogram,max,${h.max},intensity`
    );
    for (let bin = 0; bin < h.bins.length; bin++) {
      if (h.bins[bin] > 0) {
        rows.push(`histogram_bin,bin_${bin},${h.bins[bin]},voxels`);
      }
    }
  }

  return rows.join("\n") + "\n";
}
