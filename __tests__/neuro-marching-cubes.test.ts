import { describe, expect, it } from "vitest";
import {
  computePreviewMarchingCubesStride,
  extractMarchingCubesBuffers,
  extractVolumeIsosurfaceBuffersAsync,
  voxelToWorld3D,
  world3DToVoxel,
} from "@/lib/neuro";

function createTestEllipsoidVolume(
  width = 32,
  height = 28,
  depth = 24
): {
  volumeData: Uint8Array;
  maskData: Uint8Array;
  dimensions: { width: number; height: number; depth: number };
} {
  const total = width * height * depth;
  const volumeData = new Uint8Array(total);
  const maskData = new Uint8Array(total);
  const cx = width / 2;
  const cy = height / 2;
  const cz = depth / 2;
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x - cx) / (width * 0.35);
        const dy = (y - cy) / (height * 0.35);
        const dz = (z - cz) / (depth * 0.35);
        const r2 = dx * dx + dy * dy + dz * dz;
        if (r2 <= 1) {
          const idx = z * width * height + y * width + x;
          volumeData[idx] = Math.round(200 * (1 - r2 * 0.6));
          maskData[idx] = 1;
        }
      }
    }
  }
  return { volumeData, maskData, dimensions: { width, height, depth } };
}

describe("3D Marching-Cubes Isosurface Reconstruction & Coordinate Mapping", () => {
  it("computes adaptive preview downsampling strides across matrix dimensions", () => {
    expect(
      computePreviewMarchingCubesStride({ width: 32, height: 32, depth: 32 })
    ).toBe(2);
    expect(
      computePreviewMarchingCubesStride({ width: 96, height: 96, depth: 96 })
    ).toBe(2);
    expect(
      computePreviewMarchingCubesStride({ width: 160, height: 160, depth: 128 })
    ).toBe(4);
    expect(
      computePreviewMarchingCubesStride({ width: 256, height: 256, depth: 256 })
    ).toBe(6);
  });

  it("extracts smooth indexed triangle buffers and reduces triangle count during live preview scrubbing", async () => {
    const { volumeData, maskData, dimensions } = createTestEllipsoidVolume(
      96,
      80,
      72
    );
    const spacing = { x: 0.9, y: 0.9, z: 1.3 };

    const previewBuffers = await extractVolumeIsosurfaceBuffersAsync({
      volumeData,
      maskData,
      dimensions,
      spacing,
      isovalue: 75,
      mode: "pial",
      hemiFilter: "both",
      preview: true,
    });
    const fullBuffers = await extractVolumeIsosurfaceBuffersAsync({
      volumeData,
      maskData,
      dimensions,
      spacing,
      isovalue: 75,
      mode: "pial",
      hemiFilter: "both",
      preview: false,
    });

    expect(previewBuffers).toHaveLength(1);
    expect(fullBuffers).toHaveLength(1);
    expect(previewBuffers[0].positions.length).toBeGreaterThan(0);
    expect(fullBuffers[0].positions.length).toBeGreaterThan(
      previewBuffers[0].positions.length
    );
    expect(fullBuffers[0].indices.length).toBeGreaterThan(
      previewBuffers[0].indices.length
    );
    expect(fullBuffers[0].normals?.length).toBe(
      fullBuffers[0].positions.length
    );
    expect(fullBuffers[0].colors?.length).toBe(fullBuffers[0].positions.length);
  });

  it("reflects live mask edits and supports all surface shading modes and hemisphere filters", () => {
    const { volumeData, maskData, dimensions } = createTestEllipsoidVolume(
      28,
      26,
      24
    );

    const baseline = extractMarchingCubesBuffers({
      volumeData,
      maskData,
      dimensions,
      isovalue: 80,
      mode: "pial",
    });

    // Erase the entire right hemisphere in brainmask -> surface triangles change immediately
    const editedMask = maskData.slice();
    for (let z = 0; z < dimensions.depth; z++) {
      for (let y = 0; y < dimensions.height; y++) {
        for (
          let x = Math.floor(dimensions.width / 2);
          x < dimensions.width;
          x++
        ) {
          editedMask[
            z * dimensions.width * dimensions.height + y * dimensions.width + x
          ] = 0;
        }
      }
    }

    const afterErase = extractMarchingCubesBuffers({
      volumeData,
      maskData: editedMask,
      dimensions,
      isovalue: 80,
      mode: "pial",
    });
    expect(afterErase[0].indices.length).toBeLessThan(
      baseline[0].indices.length
    );

    for (const mode of ["white", "inflated", "aparc", "aseg"] as const) {
      const bufs = extractMarchingCubesBuffers({
        volumeData,
        maskData,
        dimensions,
        isovalue: 90,
        mode,
        hemiFilter: mode === "aseg" ? "rh" : "both",
      });
      expect(bufs).toHaveLength(1);
      expect(bufs[0].indices.length).toBeGreaterThan(0);
    }
  });

  it("round-trips voxel coordinates and 3D world space for anisotropic rectangular grids", () => {
    const dims = { width: 192, height: 224, depth: 128 };
    const spacing = { x: 0.85, y: 0.85, z: 1.5 };
    const sample = { x: 41, y: 173, z: 92 };

    const world = voxelToWorld3D(sample, dims, spacing);
    const back = world3DToVoxel(world, dims, spacing);
    expect(back).toEqual(sample);
  });
});
