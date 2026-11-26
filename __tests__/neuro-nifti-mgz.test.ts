import { describe, expect, it } from "vitest";
import {
  exportMaskAsNiftiGz,
  exportRoiMetricsCsv,
  formatRoiMetricsCsv,
  gzipBytes,
  loadNeuroOverlayMaskFromFile,
  loadNeuroVolumeFromFile,
  MAX_NATIVE_VOLUME_DIM,
  parseNeuroOverlayMaskBytes,
  parseNeuroVolumeBytes,
  runRegionGrowing,
  serializeMaskToNiftiBytes,
  serializeMaskToNiftiGz,
  validateOverlayAlignment,
  type AffineMatrix4x4,
} from "@/lib/neuro";
import { extractSlice } from "@/lib/neuro/volume-generator";

/** Build a synthetic NIfTI-1 (.nii) byte buffer for testing native codecs. */
function buildTestNifti1Bytes(options: {
  width: number;
  height: number;
  depth: number;
  spacing?: { x: number; y: number; z: number };
  datatype?: 2 | 4 | 16; // UINT8=2, INT16=4, FLOAT32=16
  sformAffine?: AffineMatrix4x4;
  fillVoxel?: (x: number, y: number, z: number) => number;
}): Uint8Array {
  const {
    width,
    height,
    depth,
    spacing = { x: 1, y: 1, z: 1 },
    datatype = 2,
    sformAffine,
    fillVoxel = (x, y, z) => ((x + y + z) % 200) + 10,
  } = options;
  const bytesPerVoxel = datatype === 2 ? 1 : datatype === 4 ? 2 : 4;
  const voxOffset = 352;
  const totalVoxels = width * height * depth;
  const buf = new ArrayBuffer(voxOffset + totalVoxels * bytesPerVoxel);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  view.setInt32(0, 348, true); // sizeof_hdr
  view.setInt16(40, 3, true); // dim[0] = 3D
  view.setInt16(42, width, true);
  view.setInt16(44, height, true);
  view.setInt16(46, depth, true);
  view.setInt16(48, 1, true);

  view.setInt16(70, datatype, true);
  view.setInt16(72, bytesPerVoxel * 8, true);

  view.setFloat32(76, 1, true); // qfac
  view.setFloat32(80, spacing.x, true);
  view.setFloat32(84, spacing.y, true);
  view.setFloat32(88, spacing.z, true);
  view.setFloat32(108, voxOffset, true);
  view.setFloat32(112, 1, true); // scl_slope
  view.setFloat32(116, 0, true); // scl_inter
  bytes[123] = 2; // NIFTI_UNITS_MM

  const affine: AffineMatrix4x4 = sformAffine ?? [
    spacing.x,
    0,
    0,
    -(width * spacing.x) / 2,
    0,
    spacing.y,
    0,
    -(height * spacing.y) / 2,
    0,
    0,
    spacing.z,
    -(depth * spacing.z) / 2,
    0,
    0,
    0,
    1,
  ];

  view.setInt16(252, 1, true); // qform_code
  view.setInt16(254, 1, true); // sform_code
  view.setFloat32(268, affine[3], true);
  view.setFloat32(272, affine[7], true);
  view.setFloat32(276, affine[11], true);

  for (let i = 0; i < 4; i++) {
    view.setFloat32(280 + i * 4, affine[i], true);
    view.setFloat32(296 + i * 4, affine[4 + i], true);
    view.setFloat32(312 + i * 4, affine[8 + i], true);
  }

  // Magic "n+1\0"
  bytes[344] = 0x6e;
  bytes[345] = 0x2b;
  bytes[346] = 0x31;
  bytes[347] = 0x00;

  let idx = 0;
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const val = fillVoxel(x, y, z);
        const offset = voxOffset + idx * bytesPerVoxel;
        if (datatype === 2) {
          view.setUint8(offset, Math.round(val));
        } else if (datatype === 4) {
          view.setInt16(offset, Math.round(val), true);
        } else {
          view.setFloat32(offset, val, true);
        }
        idx++;
      }
    }
  }

  return bytes;
}

/** Build a synthetic FreeSurfer MGH (big-endian) byte buffer for .mgh / .mgz testing. */
function buildTestMghBytes(options: {
  width: number;
  height: number;
  depth: number;
  spacing?: { x: number; y: number; z: number };
  mghType?: 0 | 3; // MRI_UCHAR=0, MRI_FLOAT=3
  fillVoxel?: (x: number, y: number, z: number) => number;
}): Uint8Array {
  const {
    width,
    height,
    depth,
    spacing = { x: 1, y: 1, z: 1 },
    mghType = 0,
    fillVoxel = (x, y, z) => ((x * 3 + y * 5 + z * 7) % 180) + 30,
  } = options;
  const headerSize = 284;
  const bytesPerVoxel = mghType === 0 ? 1 : 4;
  const totalVoxels = width * height * depth;
  const buf = new ArrayBuffer(headerSize + totalVoxels * bytesPerVoxel);
  const view = new DataView(buf);

  view.setInt32(0, 1, false); // version = 1 (big-endian)
  view.setInt32(4, width, false);
  view.setInt32(8, height, false);
  view.setInt32(12, depth, false);
  view.setInt32(16, 1, false); // nframes = 1
  view.setInt32(20, mghType, false);
  view.setInt32(24, 0, false); // dof
  view.setInt16(28, 1, false); // goodRASFlag = 1

  view.setFloat32(30, spacing.x, false);
  view.setFloat32(34, spacing.y, false);
  view.setFloat32(38, spacing.z, false);

  // Identity RAS direction cosines (x_r..x_s, y_r..y_s, z_r..z_s, c_r..c_s)
  view.setFloat32(42, -1, false);
  view.setFloat32(46, 0, false);
  view.setFloat32(50, 0, false);

  view.setFloat32(54, 0, false);
  view.setFloat32(58, 0, false);
  view.setFloat32(62, -1, false);

  view.setFloat32(66, 0, false);
  view.setFloat32(70, 1, false);
  view.setFloat32(74, 0, false);

  view.setFloat32(78, 0, false);
  view.setFloat32(82, 0, false);
  view.setFloat32(86, 0, false);

  let idx = 0;
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const val = fillVoxel(x, y, z);
        const offset = headerSize + idx * bytesPerVoxel;
        if (mghType === 0) {
          view.setUint8(offset, Math.round(val));
        } else {
          view.setFloat32(offset, val, false);
        }
        idx++;
      }
    }
  }

  return new Uint8Array(buf);
}

describe("Native NIfTI-1 (.nii/.nii.gz) & FreeSurfer (.mgz) Codec Pipeline", () => {
  it("parses rectangular anisotropic .nii and .nii.gz scans without resampling dimensions or spacing", async () => {
    const niiBytes = buildTestNifti1Bytes({
      width: 64,
      height: 48,
      depth: 32,
      spacing: { x: 0.75, y: 0.85, z: 1.5 },
      datatype: 16, // FLOAT32
      fillVoxel: (x, y, z) => {
        const dx = (x - 32) / 20;
        const dy = (y - 24) / 16;
        const dz = (z - 16) / 10;
        return dx * dx + dy * dy + dz * dz <= 1 ? 420.5 : 0;
      },
    });

    const rawRes = await parseNeuroVolumeBytes(niiBytes, "aniso-scan.nii");
    expect(rawRes.ok).toBe(true);
    if (!rawRes.ok) return;

    expect(rawRes.data.dimensions).toEqual({
      width: 64,
      height: 48,
      depth: 32,
    });
    expect(rawRes.data.spacing?.x).toBeCloseTo(0.75, 4);
    expect(rawRes.data.spacing?.y).toBeCloseTo(0.85, 4);
    expect(rawRes.data.spacing?.z).toBeCloseTo(1.5, 4);
    expect(rawRes.data.sourceFormat).toBe("nifti");

    // Extract orthogonal slices and verify rectangular dimensions + physical spacing
    const axial = extractSlice(rawRes.data, "axial", 16);
    expect(axial.width).toBe(64);
    expect(axial.height).toBe(48);
    expect(axial.voxelWidthMm).toBeCloseTo(0.75, 4);
    expect(axial.voxelHeightMm).toBeCloseTo(0.85, 4);

    const coronal = extractSlice(rawRes.data, "coronal", 24);
    expect(coronal.width).toBe(64);
    expect(coronal.height).toBe(32);
    expect(coronal.voxelWidthMm).toBeCloseTo(0.75, 4);
    expect(coronal.voxelHeightMm).toBeCloseTo(1.5, 4);

    const sagittal = extractSlice(rawRes.data, "sagittal", 32);
    expect(sagittal.width).toBe(48);
    expect(sagittal.height).toBe(32);
    expect(sagittal.voxelWidthMm).toBeCloseTo(0.85, 4);
    expect(sagittal.voxelHeightMm).toBeCloseTo(1.5, 4);

    // Gzipped .nii.gz File upload
    const gzBytes = await gzipBytes(niiBytes);
    const gzCopy = new ArrayBuffer(gzBytes.byteLength);
    new Uint8Array(gzCopy).set(gzBytes);
    const file = new File([gzCopy], "aniso-scan.nii.gz", {
      type: "application/gzip",
    });
    const fileRes = await loadNeuroVolumeFromFile(file);
    expect(fileRes.ok).toBe(true);
    if (!fileRes.ok) return;
    expect(fileRes.data.dimensions).toEqual({
      width: 64,
      height: 48,
      depth: 32,
    });
    expect(fileRes.data.rawT1[16 * 64 * 48 + 24 * 64 + 32]).toBe(255);
  });

  it("loads a full 256x256x256 FreeSurfer .mgz volume at native resolution without resampling loss", async () => {
    expect(MAX_NATIVE_VOLUME_DIM).toBe(256);
    const mghBytes = buildTestMghBytes({
      width: 256,
      height: 256,
      depth: 256,
      spacing: { x: 1, y: 1, z: 1 },
      mghType: 0,
      fillVoxel: (x, y, z) => (x === 128 && y === 128 && z === 128 ? 220 : 0),
    });
    // Stamp small bright core adjacent to center so adaptive histogram works cleanly
    const centerBase = 284 + (128 * 256 * 256 + 128 * 256 + 100);
    for (let i = 0; i < 16; i++) {
      mghBytes[centerBase + i] = 150 + i * 5;
    }

    const mgzBytes = await gzipBytes(mghBytes);
    const parsed = await parseNeuroVolumeBytes(mgzBytes, "T1.mgz");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.data.sourceFormat).toBe("mgz");
    expect(parsed.data.dimensions).toEqual({
      width: 256,
      height: 256,
      depth: 256,
    });
    expect(parsed.data.rawT1.byteLength).toBe(256 * 256 * 256);
    expect(parsed.data.rawT1[128 * 256 * 256 + 128 * 256 + 128]).toBe(220);
  });

  it("validates overlay mask grid/spacing/affine alignment and rejects misaligned headers", async () => {
    const customAffine: AffineMatrix4x4 = [
      -0.9, 0, 0, 86.4, 0, 0.9, 0, -100.8, 0, 0, 1.2, -72.0, 0, 0, 0, 1,
    ];
    const baseNii = buildTestNifti1Bytes({
      width: 32,
      height: 28,
      depth: 24,
      spacing: { x: 0.9, y: 0.9, z: 1.2 },
      datatype: 4, // INT16
      sformAffine: customAffine,
      fillVoxel: (x, y, z) => (x > 8 && x < 24 && y > 6 && z > 4 ? 140 : 0),
    });
    const baseVolRes = await parseNeuroVolumeBytes(baseNii, "base.nii");
    expect(baseVolRes.ok).toBe(true);
    if (!baseVolRes.ok) return;
    const baseVol = baseVolRes.data;

    // 1. Aligned overlay mask succeeds
    const alignedOverlayBytes = buildTestNifti1Bytes({
      width: 32,
      height: 28,
      depth: 24,
      spacing: { x: 0.9, y: 0.9, z: 1.2 },
      datatype: 2,
      sformAffine: customAffine,
      fillVoxel: (x, y, z) => (x === 16 && y === 14 && z === 12 ? 3 : 0),
    });
    const ovlCopy = new ArrayBuffer(alignedOverlayBytes.byteLength);
    new Uint8Array(ovlCopy).set(alignedOverlayBytes);
    const alignedFile = new File([ovlCopy], "lesion-mask.nii", {
      type: "application/octet-stream",
    });
    const alignedRes = await loadNeuroOverlayMaskFromFile(
      alignedFile,
      baseVol,
      0.65
    );
    expect(alignedRes.ok).toBe(true);
    if (alignedRes.ok) {
      expect(alignedRes.data.opacity).toBeCloseTo(0.65, 4);
      expect(alignedRes.data.data[12 * 32 * 28 + 14 * 32 + 16]).toBe(3);
    }

    // 2. Mismatched grid dimensions rejected
    const wrongGridBytes = buildTestNifti1Bytes({
      width: 40,
      height: 28,
      depth: 24,
      spacing: { x: 0.9, y: 0.9, z: 1.2 },
      sformAffine: customAffine,
    });
    const wrongGridRes = await parseNeuroOverlayMaskBytes(
      wrongGridBytes,
      "wrong-grid.nii",
      baseVol
    );
    expect(wrongGridRes.ok).toBe(false);
    if (!wrongGridRes.ok) {
      expect(wrongGridRes.code).toBe("ALIGNMENT_MISMATCH");
      expect(wrongGridRes.message).toContain("40x28x24");
    }

    // 3. Mismatched voxel spacing rejected
    const wrongSpacingCheck = validateOverlayAlignment(
      {
        dimensions: { width: 32, height: 28, depth: 24 },
        spacing: { x: 1.5, y: 0.9, z: 1.2 },
        affine: customAffine,
      },
      baseVol
    );
    expect(wrongSpacingCheck.valid).toBe(false);

    // 4. Misaligned affine origin/orientation rejected
    const shiftedAffine: AffineMatrix4x4 = [
      -0.9, 0, 0, 12.0, 0, 0.9, 0, -100.8, 0, 0, 1.2, -72.0, 0, 0, 0, 1,
    ];
    const wrongAffineBytes = buildTestNifti1Bytes({
      width: 32,
      height: 28,
      depth: 24,
      spacing: { x: 0.9, y: 0.9, z: 1.2 },
      sformAffine: shiftedAffine,
    });
    const wrongAffineRes = await parseNeuroOverlayMaskBytes(
      wrongAffineBytes,
      "shifted.nii",
      baseVol
    );
    expect(wrongAffineRes.ok).toBe(false);
    if (!wrongAffineRes.ok) {
      expect(wrongAffineRes.code).toBe("ALIGNMENT_MISMATCH");
      expect(wrongAffineRes.message).toMatch(/affine/i);
    }
  });

  it("exports edited masks as native-resolution .nii.gz preserving exact voxels and source 4x4 affine", async () => {
    const dims = { width: 20, height: 18, depth: 14 };
    const spacing = { x: 0.8, y: 0.9, z: 1.4 };
    const sourceAffine: AffineMatrix4x4 = [
      -0.8, 0.05, 0, 40.25, 0.05, 0.9, 0, -35.5, 0, 0, 1.4, -22.75, 0, 0, 0, 1,
    ];
    const mask = new Uint8Array(dims.width * dims.height * dims.depth);
    mask[7 * dims.width * dims.height + 9 * dims.width + 10] = 1;
    mask[3 * dims.width * dims.height + 4 * dims.width + 5] = 1;

    const rawNii = serializeMaskToNiftiBytes(mask, {
      dimensions: dims,
      spacing,
      affine: sourceAffine,
      description: "Edited brainmask",
    });
    expect(rawNii.byteLength).toBe(352 + mask.byteLength);

    const gzExport = await serializeMaskToNiftiGz(mask, {
      dimensions: dims,
      spacing,
      affine: sourceAffine,
      description: "Edited brainmask",
    });
    // Verify gzip magic bytes 0x1f 0x8b
    expect(gzExport[0]).toBe(0x1f);
    expect(gzExport[1]).toBe(0x8b);

    const roundTrip = await parseNeuroOverlayMaskBytes(
      gzExport,
      "exported-mask.nii.gz",
      {
        dimensions: dims,
        spacing,
        affine: sourceAffine,
      }
    );
    expect(roundTrip.ok).toBe(true);
    if (!roundTrip.ok) return;

    expect(roundTrip.data.dimensions).toEqual(dims);
    expect(roundTrip.data.spacing.x).toBeCloseTo(spacing.x, 4);
    expect(roundTrip.data.spacing.y).toBeCloseTo(spacing.y, 4);
    expect(roundTrip.data.spacing.z).toBeCloseTo(spacing.z, 4);
    for (let i = 0; i < 16; i++) {
      expect(roundTrip.data.affine[i]).toBeCloseTo(sourceAffine[i], 4);
    }
    expect(Array.from(roundTrip.data.data)).toEqual(Array.from(mask));

    // Also exercise browser download wrapper for both .nii.gz and .mgz source filenames
    const dlFromMgz = await exportMaskAsNiftiGz(
      mask,
      { dimensions: dims, spacing, affine: sourceAffine },
      "T1-edited.mgz"
    );
    expect(dlFromMgz[0]).toBe(0x1f);
    const dlFromGz = await exportMaskAsNiftiGz(
      mask,
      { dimensions: dims, spacing, affine: sourceAffine },
      "brainmask.nii.gz"
    );
    expect(dlFromGz[1]).toBe(0x8b);
  });

  it("computes anisotropic ROI physical volumeMm3 and formats CSV metrics", () => {
    const dims = { width: 16, height: 12, depth: 10 };
    const spacing = { x: 0.5, y: 0.8, z: 2.5 }; // voxel volume = 1.0 mm^3? Let's make it 1.5 mm^3!
    const anisoSpacing = { x: 0.75, y: 1.0, z: 2.0 }; // 1.5 mm^3 per voxel
    const total = dims.width * dims.height * dims.depth;
    const rawT1 = new Uint8Array(total);
    const brainmask = new Uint8Array(total).fill(1);

    // 2x2x2 cube of identical intensity = 8 voxels -> 8 * 1.5 = 12 mm^3
    for (let z = 4; z <= 5; z++) {
      for (let y = 4; y <= 5; y++) {
        for (let x = 4; x <= 5; x++) {
          rawT1[z * dims.width * dims.height + y * dims.width + x] = 150;
        }
      }
    }

    const roi = runRegionGrowing(
      rawT1,
      brainmask,
      dims,
      { x: 4, y: 4, z: 4 },
      5,
      anisoSpacing
    );
    expect(roi.stats.voxelCount).toBe(8);
    expect(roi.stats.volumeMm3).toBeCloseTo(12, 3);
    expect(spacing.x).toBe(0.5);

    const csv = formatRoiMetricsCsv({
      sourceName: "sub-02_T1w.nii.gz",
      dimensions: dims,
      spacing: anisoSpacing,
      roiStats: roi.stats,
    });
    expect(csv).toContain("sub-02_T1w.nii.gz");
    expect(csv).toContain("roi,volume_mm3,12,mm3");
    expect(csv).toContain("volume,voxel_volume,1.5,mm3");

    const exportedCsv = exportRoiMetricsCsv(
      {
        sourceName: "sub-02_T1w.nii.gz",
        dimensions: dims,
        spacing: anisoSpacing,
        roiStats: roi.stats,
      },
      "sub-02-metrics"
    );
    expect(exportedCsv).toBe(csv);
    expect(
      exportRoiMetricsCsv(
        { dimensions: dims, spacing: anisoSpacing, roiStats: roi.stats },
        "sub-02-metrics.csv"
      )
    ).toContain("roi,volume_mm3,12,mm3");
  });

  it("returns structured errors for empty, invalid, oversized (>256), and truncated inputs", async () => {
    const empty = await parseNeuroVolumeBytes(new Uint8Array(0), "empty.nii");
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.code).toBe("EMPTY_PAYLOAD");

    const invalid = await parseNeuroVolumeBytes(
      new Uint8Array(400).fill(7),
      "garbage.nii"
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.code).toBe("INVALID_HEADER");

    const oversized = buildTestNifti1Bytes({
      width: 260,
      height: 16,
      depth: 16,
    });
    const overRes = await parseNeuroVolumeBytes(oversized, "oversized.nii");
    expect(overRes.ok).toBe(false);
    if (!overRes.ok) expect(overRes.code).toBe("UNSUPPORTED_DIMENSIONS");

    const validSmall = buildTestNifti1Bytes({
      width: 16,
      height: 16,
      depth: 16,
    });
    const truncated = validSmall.slice(0, 400);
    const truncRes = await parseNeuroVolumeBytes(truncated, "trunc.nii");
    expect(truncRes.ok).toBe(false);
    if (!truncRes.ok) expect(truncRes.code).toBe("TRUNCATED_PAYLOAD");
  });
});
