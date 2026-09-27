import { describe, it, expect } from "vitest";
import {
  generateSyntheticVolume,
  extractSlice,
  getIndex,
  VOLUME_SIZE,
} from "@/lib/neuro/volume-generator";
import { evaluateQAMetrics } from "@/lib/neuro/qa-engine";
import { SCENARIOS, DATASET_CONFIGS } from "@/lib/neuro/scenarios";
import { ControlPoint, VoxelEdit } from "@/lib/neuro/types";

describe("NeuroRecon: Volume Generator & Slice Extractor Suite", () => {
  it("generates deterministic 3D volumes with correct dimensions and tissue compartments", () => {
    const volume = generateSyntheticVolume("dura_inclusion");
    expect(volume.dimensions.width).toBe(VOLUME_SIZE);
    expect(volume.dimensions.height).toBe(VOLUME_SIZE);
    expect(volume.dimensions.depth).toBe(VOLUME_SIZE);
    expect(volume.rawT1.length).toBe(VOLUME_SIZE * VOLUME_SIZE * VOLUME_SIZE);
    expect(volume.brainmask.length).toBe(
      VOLUME_SIZE * VOLUME_SIZE * VOLUME_SIZE
    );
    expect(volume.wmMask.length).toBe(VOLUME_SIZE * VOLUME_SIZE * VOLUME_SIZE);
    expect(volume.labels.length).toBe(VOLUME_SIZE * VOLUME_SIZE * VOLUME_SIZE);
  });

  it("extracts 2D slices along Axial, Coronal, and Sagittal planes accurately", () => {
    const volume = generateSyntheticVolume("sandbox");

    const axial = extractSlice(volume, "axial", 48);
    expect(axial.width).toBe(VOLUME_SIZE);
    expect(axial.height).toBe(VOLUME_SIZE);
    expect(axial.pixels.length).toBe(VOLUME_SIZE * VOLUME_SIZE);

    const coronal = extractSlice(volume, "coronal", 48);
    expect(coronal.width).toBe(VOLUME_SIZE);
    expect(coronal.height).toBe(VOLUME_SIZE);
    expect(coronal.pixels.length).toBe(VOLUME_SIZE * VOLUME_SIZE);

    const sagittal = extractSlice(volume, "sagittal", 48);
    expect(sagittal.width).toBe(VOLUME_SIZE);
    expect(sagittal.height).toBe(VOLUME_SIZE);
    expect(sagittal.pixels.length).toBe(VOLUME_SIZE * VOLUME_SIZE);
  });
});

describe("NeuroRecon: QA Evaluation Engine Suite", () => {
  it("counts only distinct, valid dura voxel corrections in the final edit state", () => {
    const scenario = SCENARIOS.dura_inclusion;
    const volume = generateSyntheticVolume("dura_inclusion");
    const { min, max } = volume.defectRegion;
    const defectVoxels: VoxelEdit[] = [];

    for (let z = min.z; z <= max.z; z++) {
      for (let y = min.y; y <= max.y; y++) {
        for (let x = min.x; x <= max.x; x++) {
          if (volume.labels[getIndex(x, y, z)] === 5) {
            defectVoxels.push({
              x,
              y,
              z,
              layer: "brainmask",
              originalValue: 1,
              newValue: 0,
            });
          }
        }
      }
    }

    expect(defectVoxels.length).toBeGreaterThan(1);
    const first = defectVoxels[0];
    const repeated = Array.from({ length: scenario.initialDefects }, () => ({
      ...first,
    }));
    const duplicateMetrics = evaluateQAMetrics(scenario, volume, [], repeated);
    expect(duplicateMetrics.defectCount).toBeGreaterThan(0);
    expect(duplicateMetrics.isResolved).toBe(false);

    const undone = evaluateQAMetrics(
      scenario,
      volume,
      [],
      [first, { ...first, originalValue: 0, newValue: 1 }]
    );
    expect(undone.defectCount).toBe(scenario.initialDefects);

    const offRegion = { ...first, x: 0, y: 0, z: 0 };
    const noOp = {
      ...first,
      x: min.x,
      y: min.y,
      z: min.z,
      originalValue: 0,
      newValue: 0,
    };
    const invalidMetrics = evaluateQAMetrics(
      scenario,
      volume,
      [],
      [offRegion, noOp]
    );
    expect(invalidMetrics.defectCount).toBe(scenario.initialDefects);

    const partial = evaluateQAMetrics(
      scenario,
      volume,
      [],
      defectVoxels.slice(0, -1)
    );
    expect(partial.defectCount).toBeGreaterThan(0);
    expect(partial.isResolved).toBe(false);

    const resolved = evaluateQAMetrics(scenario, volume, [], defectVoxels);
    expect(resolved.defectCount).toBe(0);
    expect(resolved.isResolved).toBe(true);
  });

  it("does not resolve skull erosion from repeated painting of one voxel", () => {
    const scenario = SCENARIOS.skull_strip_erosion;
    const volume = generateSyntheticVolume("skull_strip_erosion");
    const { min, max } = volume.defectRegion;
    let edit: VoxelEdit | undefined;
    for (let z = min.z; z <= max.z && !edit; z++) {
      for (let y = min.y; y <= max.y && !edit; y++) {
        for (let x = min.x; x <= max.x; x++) {
          const index = getIndex(x, y, z);
          if (
            volume.labels[index] === 2 &&
            volume.initialBrainmask[index] === 0
          ) {
            edit = {
              x,
              y,
              z,
              layer: "brainmask",
              originalValue: 0,
              newValue: 1,
            };
            break;
          }
        }
      }
    }
    expect(edit).toBeDefined();
    const repeated = Array.from({ length: scenario.initialDefects }, () => ({
      ...edit!,
    }));
    const metrics = evaluateQAMetrics(scenario, volume, [], repeated);

    expect(metrics.defectCount).toBeGreaterThan(0);
    expect(metrics.isResolved).toBe(false);
  });

  it("does not resolve a topological handle from repeated cuts at one voxel", () => {
    const scenario = SCENARIOS.topological_handle;
    const volume = generateSyntheticVolume("topological_handle");
    const { min, max } = volume.defectRegion;
    let edit: VoxelEdit | undefined;
    for (let z = min.z; z <= max.z && !edit; z++) {
      for (let y = min.y; y <= max.y && !edit; y++) {
        for (let x = min.x; x <= max.x; x++) {
          const index = getIndex(x, y, z);
          if (volume.labels[index] === 3 && volume.initialWmMask[index] === 1) {
            edit = { x, y, z, layer: "wm", originalValue: 1, newValue: 0 };
            break;
          }
        }
      }
    }
    expect(edit).toBeDefined();
    const repeated = Array.from({ length: scenario.initialDefects }, () => ({
      ...edit!,
    }));
    const metrics = evaluateQAMetrics(scenario, volume, [], repeated);

    expect(metrics.defectCount).toBeGreaterThan(0);
    expect(metrics.isResolved).toBe(false);
  });

  it("does not resolve white matter dropout from repeated paint at one voxel", () => {
    const scenario = SCENARIOS.wm_hypointensity;
    const volume = generateSyntheticVolume("wm_hypointensity");
    const { min, max } = volume.defectRegion;
    let edit: VoxelEdit | undefined;
    for (let z = min.z; z <= max.z && !edit; z++) {
      for (let y = min.y; y <= max.y && !edit; y++) {
        for (let x = min.x; x <= max.x; x++) {
          const index = getIndex(x, y, z);
          if (volume.labels[index] === 3 && volume.initialWmMask[index] === 0) {
            edit = { x, y, z, layer: "wm", originalValue: 0, newValue: 1 };
            break;
          }
        }
      }
    }
    expect(edit).toBeDefined();
    const repeated = Array.from({ length: scenario.initialDefects }, () => ({
      ...edit!,
    }));
    const metrics = evaluateQAMetrics(scenario, volume, [], repeated);

    expect(metrics.defectCount).toBeGreaterThan(0);
    expect(metrics.isResolved).toBe(false);
  });

  it("counts a repeated white matter control point only once", () => {
    const scenario = SCENARIOS.wm_hypointensity;
    const volume = generateSyntheticVolume("wm_hypointensity");
    const { min, max } = volume.defectRegion;
    const point: ControlPoint = {
      id: "cp-1",
      x: Math.floor((min.x + max.x) / 2),
      y: Math.floor((min.y + max.y) / 2),
      z: Math.floor((min.z + max.z) / 2),
      intensity: 110,
      timestamp: 1,
    };
    const repeated = Array.from({ length: 3 }, (_, index) => ({
      ...point,
      id: `cp-${index}`,
    }));

    const metrics = evaluateQAMetrics(scenario, volume, repeated, []);
    expect(metrics.defectCount).toBeGreaterThan(0);
    expect(metrics.isResolved).toBe(false);
  });

  it("evaluates Dura Over-Inclusion scenario and resolves on mask voxel erasure", () => {
    const scenario = SCENARIOS.dura_inclusion;
    const volume = generateSyntheticVolume("dura_inclusion");

    // Baseline unedited state
    const initialMetrics = evaluateQAMetrics(scenario, volume, [], []);
    expect(initialMetrics.defectCount).toBe(scenario.initialDefects);
    expect(initialMetrics.isResolved).toBe(false);
    expect(initialMetrics.meanCorticalThicknessMm).toBeGreaterThan(3.5);

    // Apply mock erase edits across the defect region
    const edits: VoxelEdit[] = [];
    const { min, max } = volume.defectRegion;
    for (let z = min.z; z <= max.z; z++) {
      for (let y = min.y; y <= max.y; y++) {
        for (let x = min.x; x <= max.x; x++) {
          edits.push({
            x,
            y,
            z,
            originalValue: 1,
            newValue: 0,
            layer: "brainmask",
          });
        }
      }
    }

    const resolvedMetrics = evaluateQAMetrics(scenario, volume, [], edits);
    expect(resolvedMetrics.defectCount).toBe(0);
    expect(resolvedMetrics.isResolved).toBe(true);
    expect(resolvedMetrics.diceScore).toBeGreaterThanOrEqual(
      scenario.targetDice
    );
    expect(resolvedMetrics.meanCorticalThicknessMm).toBeCloseTo(2.45, 1);
  });

  it("evaluates White Matter Hypointensity scenario and resolves on Control Point placement", () => {
    const scenario = SCENARIOS.wm_hypointensity;
    const volume = generateSyntheticVolume("wm_hypointensity");

    const initialMetrics = evaluateQAMetrics(scenario, volume, [], []);
    expect(initialMetrics.defectCount).toBe(scenario.initialDefects);
    expect(initialMetrics.isResolved).toBe(false);

    // Add control points inside the defect zone
    const { min, max } = volume.defectRegion;
    const midX = Math.floor((min.x + max.x) / 2);
    const midY = Math.floor((min.y + max.y) / 2);
    const midZ = Math.floor((min.z + max.z) / 2);

    const controlPoints: ControlPoint[] = [
      {
        id: "cp-1",
        x: midX,
        y: midY,
        z: midZ,
        intensity: 110,
        timestamp: Date.now(),
      },
      {
        id: "cp-2",
        x: midX + 2,
        y: midY + 1,
        z: midZ,
        intensity: 110,
        timestamp: Date.now(),
      },
      {
        id: "cp-3",
        x: midX - 2,
        y: midY - 1,
        z: midZ,
        intensity: 110,
        timestamp: Date.now(),
      },
    ];

    const resolvedMetrics = evaluateQAMetrics(
      scenario,
      volume,
      controlPoints,
      []
    );
    expect(resolvedMetrics.defectCount).toBe(0);
    expect(resolvedMetrics.isResolved).toBe(true);
    expect(resolvedMetrics.eulerCharacteristic).toBe(2);
  });

  it("evaluates Topological Handle scenario and verifies Euler characteristic recovery", () => {
    const scenario = SCENARIOS.topological_handle;
    const volume = generateSyntheticVolume("topological_handle");

    const initialMetrics = evaluateQAMetrics(scenario, volume, [], []);
    expect(initialMetrics.eulerCharacteristic).toBe(0); // χ = 0 (1 handle / Genus 1)
    expect(initialMetrics.isResolved).toBe(false);

    // Sever the bridge in defect region
    const edits: VoxelEdit[] = [];
    const { min, max } = volume.defectRegion;
    for (let z = min.z; z <= max.z; z++) {
      for (let y = min.y; y <= max.y; y++) {
        for (let x = min.x; x <= max.x; x++) {
          edits.push({
            x,
            y,
            z,
            originalValue: 1,
            newValue: 0,
            layer: "wm",
          });
        }
      }
    }

    const resolvedMetrics = evaluateQAMetrics(scenario, volume, [], edits);
    expect(resolvedMetrics.eulerCharacteristic).toBe(2); // χ = 2 ($S^2$ sphere)
    expect(resolvedMetrics.isResolved).toBe(true);
  });

  it("verifies external dataset configurations for MNI152 and OASIS", () => {
    expect(SCENARIOS).toBeDefined();
    expect(DATASET_CONFIGS.mni152.isRealHumanScan).toBe(true);
    expect(DATASET_CONFIGS.mni152.modelUrl).toBe("/models/brain-surface.glb");
    expect(DATASET_CONFIGS.oasis.isRealHumanScan).toBe(true);
    expect(DATASET_CONFIGS.oasis.modelUrl).toBe("/models/brain.obj");
    expect(DATASET_CONFIGS.case_study.isRealHumanScan).toBe(false);
  });
});
