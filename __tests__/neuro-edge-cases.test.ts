// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  generateSyntheticVolume,
  extractSlice,
  VOLUME_SIZE,
} from "@/lib/neuro/volume-generator";
import { evaluateQAMetrics } from "@/lib/neuro/qa-engine";
import {
  SCENARIOS,
  SCENARIO_LIST,
  DATASET_CONFIGS,
} from "@/lib/neuro/scenarios";
import { VoxelEdit } from "@/lib/neuro/types";
import { loadExternalBrainMesh } from "@/lib/neuro/asset-loader";

describe("NeuroRecon: Edge Cases & Mathematical Invariants", () => {
  describe("Slice Coordinate Clamping & Boundary Handling", () => {
    const volume = generateSyntheticVolume("sandbox");

    it("clamps negative slice indices to 0 safely", () => {
      const axialSlice = extractSlice(volume, "axial", -10);
      expect(axialSlice.width).toBe(VOLUME_SIZE);
      expect(axialSlice.height).toBe(VOLUME_SIZE);
      expect(axialSlice.pixels.length).toBe(VOLUME_SIZE * VOLUME_SIZE);

      const coronalSlice = extractSlice(volume, "coronal", -5);
      expect(coronalSlice.width).toBe(VOLUME_SIZE);
      expect(coronalSlice.height).toBe(VOLUME_SIZE);

      const sagittalSlice = extractSlice(volume, "sagittal", -1);
      expect(sagittalSlice.width).toBe(VOLUME_SIZE);
      expect(sagittalSlice.height).toBe(VOLUME_SIZE);
    });

    it("clamps overflow slice indices to VOLUME_SIZE - 1 safely", () => {
      const axialSlice = extractSlice(volume, "axial", 999);
      expect(axialSlice.width).toBe(VOLUME_SIZE);
      expect(axialSlice.height).toBe(VOLUME_SIZE);
      expect(axialSlice.pixels.length).toBe(VOLUME_SIZE * VOLUME_SIZE);

      const coronalSlice = extractSlice(volume, "coronal", 200);
      expect(coronalSlice.width).toBe(VOLUME_SIZE);

      const sagittalSlice = extractSlice(volume, "sagittal", 100);
      expect(sagittalSlice.width).toBe(VOLUME_SIZE);
    });
  });

  describe("Multi-Scenario Defect Generation & Mathematical Invariants", () => {
    it("generates distinct defect bounding boxes for all 4 clinical cases", () => {
      SCENARIO_LIST.forEach((scId) => {
        const scenario = SCENARIOS[scId];
        const volume = generateSyntheticVolume(scId);

        expect(volume.dimensions.width).toBe(VOLUME_SIZE);
        expect(volume.dimensions.height).toBe(VOLUME_SIZE);
        expect(volume.dimensions.depth).toBe(VOLUME_SIZE);

        if (scId !== "sandbox") {
          expect(volume.defectRegion.max.x).toBeGreaterThan(
            volume.defectRegion.min.x
          );
          expect(volume.defectRegion.max.y).toBeGreaterThan(
            volume.defectRegion.min.y
          );
          expect(volume.defectRegion.max.z).toBeGreaterThan(
            volume.defectRegion.min.z
          );
        }

        const metrics = evaluateQAMetrics(scenario, volume, [], []);
        expect(metrics.eulerCharacteristic).toBe(scenario.initialEuler);
        expect(metrics.defectCount).toBe(scenario.initialDefects);
        expect(metrics.meanCorticalThicknessMm).toBeGreaterThanOrEqual(1.5);
        expect(metrics.meanCorticalThicknessMm).toBeLessThanOrEqual(4.0);
      });
    });

    it("evaluates Case 03 (Skull Strip Over-Erosion) and resolves on brainmask painting", () => {
      const scenario = SCENARIOS.skull_strip_erosion;
      const volume = generateSyntheticVolume("skull_strip_erosion");

      const initialMetrics = evaluateQAMetrics(scenario, volume, [], []);
      expect(initialMetrics.defectCount).toBe(scenario.initialDefects);
      expect(initialMetrics.isResolved).toBe(false);

      // Paint brainmask in defect region
      const edits: VoxelEdit[] = [];
      const { min, max } = volume.defectRegion;
      for (let z = min.z; z <= max.z; z++) {
        for (let y = min.y; y <= max.y; y++) {
          for (let x = min.x; x <= max.x; x++) {
            edits.push({
              x,
              y,
              z,
              originalValue: 0,
              newValue: 1,
              layer: "brainmask",
            });
          }
        }
      }

      const resolvedMetrics = evaluateQAMetrics(scenario, volume, [], edits);
      expect(resolvedMetrics.defectCount).toBe(0);
      expect(resolvedMetrics.diceScore).toBeGreaterThanOrEqual(
        scenario.targetDice
      );
      expect(resolvedMetrics.isResolved).toBe(true);
    });

    it("verifies Sandbox starts in pristine resolved equilibrium", () => {
      const scenario = SCENARIOS.sandbox;
      const volume = generateSyntheticVolume("sandbox");

      const metrics = evaluateQAMetrics(scenario, volume, [], []);
      expect(metrics.eulerCharacteristic).toBe(2);
      expect(metrics.defectCount).toBe(0);
      expect(metrics.diceScore).toBeGreaterThanOrEqual(0.95);
      expect(metrics.isResolved).toBe(true);
    });
  });

  describe("Asset Loader Cache & Resilience", () => {
    it("handles non-existent model URLs gracefully with fallback to procedural mesh", async () => {
      const fallbackGroup = await loadExternalBrainMesh(
        "/models/non-existent.glb",
        "pial"
      );
      expect(fallbackGroup).toBeDefined();
      expect(fallbackGroup.children.length).toBeGreaterThan(0);
    });

    it("registers all supported dataset sources in DATASET_CONFIGS", () => {
      expect(DATASET_CONFIGS.case_study.id).toBe("case_study");
      expect(DATASET_CONFIGS.mni152.id).toBe("mni152");
      expect(DATASET_CONFIGS.oasis.id).toBe("oasis");
      expect(DATASET_CONFIGS.mni152.modelUrl).toBe("/models/brain-surface.glb");
      expect(DATASET_CONFIGS.oasis.modelUrl).toBe("/models/brain.obj");
    });
  });
});
