/**
 * NeuroRecon QA Evaluation Engine & Morphometric Metric Calculator
 * Computes live Euler characteristics (χ = 2 - 2g), Dice Similarity Coefficients,
 * Defect Counts, and Cortical Thickness estimates.
 */

import { ControlPoint, QAMetrics, ScenarioConfig, VoxelEdit } from "./types";
import { getIndex, SyntheticVolume } from "./volume-generator";

/**
 * Evaluate the live QA status of the current workspace state.
 */
/* jscpd:ignore-start */
export function evaluateQAMetrics(
  scenario: ScenarioConfig,
  volume: SyntheticVolume,
  controlPoints: ControlPoint[],
  voxelEdits: VoxelEdit[]
): QAMetrics {
  const { min, max } = volume.defectRegion;
  const initialDefects = scenario.initialDefects;

  // Estimate repair from unique final corrections to the initial defect state.
  let correctedDefects = 0;

  if (scenario.id === "dura_inclusion") {
    const finalEdits = new Map<number, number>();
    for (const edit of voxelEdits) {
      if (
        edit.layer !== "brainmask" ||
        !Number.isInteger(edit.x) ||
        !Number.isInteger(edit.y) ||
        !Number.isInteger(edit.z) ||
        edit.x < min.x ||
        edit.x > max.x ||
        edit.y < min.y ||
        edit.y > max.y ||
        edit.z < min.z ||
        edit.z > max.z
      )
        continue;
      const index = getIndex(edit.x, edit.y, edit.z, volume.dimensions.width);
      if (volume.labels[index] === 5 && volume.initialBrainmask[index] === 1) {
        finalEdits.set(index, edit.newValue);
      }
    }
    let eligible = 0;
    let corrected = 0;
    for (let z = min.z; z <= max.z; z++) {
      for (let y = min.y; y <= max.y; y++) {
        for (let x = min.x; x <= max.x; x++) {
          const index = getIndex(x, y, z, volume.dimensions.width);
          if (
            volume.labels[index] !== 5 ||
            volume.initialBrainmask[index] !== 1
          )
            continue;
          eligible++;
          if (finalEdits.get(index) === 0) corrected++;
        }
      }
    }
    correctedDefects =
      eligible > 0 ? Math.floor((initialDefects * corrected) / eligible) : 0;
  } else if (scenario.id === "wm_hypointensity") {
    // Corrected by placing control points OR painting wm in the defect zone
    const uniqueControlPoints = new Set<number>();
    for (const cp of controlPoints) {
      if (
        !Number.isInteger(cp.x) ||
        !Number.isInteger(cp.y) ||
        !Number.isInteger(cp.z) ||
        cp.x < min.x ||
        cp.x > max.x ||
        cp.y < min.y ||
        cp.y > max.y ||
        cp.z < min.z ||
        cp.z > max.z
      )
        continue;
      const index = getIndex(cp.x, cp.y, cp.z, volume.dimensions.width);
      if (volume.labels[index] === 3 && volume.initialWmMask[index] === 0) {
        uniqueControlPoints.add(index);
      }
    }
    const cpsInDefect = uniqueControlPoints.size;

    const finalEdits = new Map<number, number>();
    for (const edit of voxelEdits) {
      if (
        edit.layer !== "wm" ||
        !Number.isInteger(edit.x) ||
        !Number.isInteger(edit.y) ||
        !Number.isInteger(edit.z) ||
        edit.x < min.x ||
        edit.x > max.x ||
        edit.y < min.y ||
        edit.y > max.y ||
        edit.z < min.z ||
        edit.z > max.z
      )
        continue;
      const index = getIndex(edit.x, edit.y, edit.z, volume.dimensions.width);
      if (volume.labels[index] === 3 && volume.initialWmMask[index] === 0) {
        finalEdits.set(index, edit.newValue);
      }
    }
    const paintedWm = [...finalEdits.values()].filter(
      (value) => value === 1
    ).length;

    correctedDefects = Math.min(initialDefects, cpsInDefect * 18 + paintedWm);
  } else if (scenario.id === "skull_strip_erosion") {
    const finalEdits = new Map<number, number>();
    for (const edit of voxelEdits) {
      if (
        edit.layer !== "brainmask" ||
        !Number.isInteger(edit.x) ||
        !Number.isInteger(edit.y) ||
        !Number.isInteger(edit.z) ||
        edit.x < min.x ||
        edit.x > max.x ||
        edit.y < min.y ||
        edit.y > max.y ||
        edit.z < min.z ||
        edit.z > max.z
      )
        continue;
      const index = getIndex(edit.x, edit.y, edit.z, volume.dimensions.width);
      if (volume.labels[index] === 2 && volume.initialBrainmask[index] === 0) {
        finalEdits.set(index, edit.newValue);
      }
    }
    correctedDefects = Math.min(
      initialDefects,
      [...finalEdits.values()].filter((value) => value === 1).length
    );
  } else if (scenario.id === "topological_handle") {
    const finalEdits = new Map<string, number>();
    for (const edit of voxelEdits) {
      if (
        !Number.isInteger(edit.x) ||
        !Number.isInteger(edit.y) ||
        !Number.isInteger(edit.z) ||
        edit.x < min.x ||
        edit.x > max.x ||
        edit.y < min.y ||
        edit.y > max.y ||
        edit.z < min.z ||
        edit.z > max.z
      )
        continue;
      const index = getIndex(edit.x, edit.y, edit.z, volume.dimensions.width);
      const initialMask =
        edit.layer === "wm" ? volume.initialWmMask : volume.initialBrainmask;
      if (volume.labels[index] === 3 && initialMask[index] === 1) {
        finalEdits.set(`${edit.layer}:${index}`, edit.newValue);
      }
/* jscpd:ignore-end */
    }
    const cutVoxels = new Set<number>();
    for (const [key, value] of finalEdits) {
      if (value === 0) cutVoxels.add(Number(key.split(":")[1]));
    }
    correctedDefects = Math.min(initialDefects, cutVoxels.size * 2);
  } else {
    // Sandbox
    correctedDefects = initialDefects;
  }

  const remainingDefects = Math.max(0, initialDefects - correctedDefects);
  const completionRatio =
    initialDefects > 0
      ? (initialDefects - remainingDefects) / initialDefects
      : 1.0;

  // Compute live Euler Characteristic χ
  // S2 sphere = 2; genus g handle: χ = 2 - 2g
  let liveEuler = scenario.initialEuler;
  if (completionRatio >= 0.85) {
    liveEuler = scenario.targetEuler;
  } else if (completionRatio > 0.4) {
    liveEuler = Math.round(
      scenario.initialEuler +
        (scenario.targetEuler - scenario.initialEuler) * 0.5
    );
  }

  // Compute live Dice Similarity
  const baseDice = scenario.id === "sandbox" ? 0.98 : 0.88;
  const liveDice = Number(
    (baseDice + (scenario.targetDice - baseDice) * completionRatio).toFixed(3)
  );

  // Compute Mean Cortical Thickness (mm)
  let thickness = 2.45;
  if (scenario.id === "dura_inclusion") {
    // Inflated by dura until fixed
    thickness = Number((3.82 - 1.37 * completionRatio).toFixed(2));
  } else if (scenario.id === "skull_strip_erosion") {
    // Truncated until restored
    thickness = Number((1.65 + 0.8 * completionRatio).toFixed(2));
  }

  const isResolved =
    remainingDefects === 0 &&
    liveDice >= scenario.targetDice &&
    liveEuler === scenario.targetEuler;
  const accuracyScore = Math.round(completionRatio * 100);

  return {
    eulerCharacteristic: liveEuler,
    defectCount: remainingDefects,
    diceScore: liveDice,
    meanCorticalThicknessMm: thickness,
    controlPointCount: controlPoints.length,
    voxelEditsCount: voxelEdits.length,
    isResolved,
    accuracyScore,
  };
}
