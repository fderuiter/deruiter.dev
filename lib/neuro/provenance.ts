/**
 * Data provenance for NeuroRecon Studio views and metrics.
 *
 * The 2D orthoview volume and QA metrics are always generated from the
 * synthetic phantom (`computeSyntheticVolume`). Real-scan datasets only
 * supply the 3D reference mesh, so the UI must say so and must not pair a
 * real-dataset label with a synthetic defect case.
 */

import type { DatasetSource, ScenarioId } from "./types";

/** Per-view source labels shown in the workspace and onboarding. */
export interface NeuroProvenance {
  /** Source of the 3D surface mesh. */
  mesh: string;
  /** Source of the 2D orthoview volume. */
  volume: string;
  /** Source of the QA metrics (Euler, defects, Dice). */
  qa: string;
  /** True when the 3D mesh comes from a different source than 2D and QA. */
  isMixedSource: boolean;
}

const SYNTHETIC_VOLUME = "Synthetic phantom volume (generated)";
const SYNTHETIC_QA = "Synthetic estimates from the phantom";

/** Resolve the provenance labels for a dataset selection. */
export function getNeuroProvenance(
  dataset: DatasetSource,
  datasetName?: string
): NeuroProvenance {
  if (dataset === "case_study") {
    return {
      mesh: "Bundled reference cortical mesh",
      volume: SYNTHETIC_VOLUME,
      qa: SYNTHETIC_QA,
      isMixedSource: false,
    };
  }
  return {
    mesh: `${datasetName ?? dataset} 3D reference mesh`,
    volume: SYNTHETIC_VOLUME,
    qa: SYNTHETIC_QA,
    isMixedSource: true,
  };
}

/**
 * Whether a dataset and scenario may be active together. Real-scan datasets
 * only pair with the Sandbox, because the defect cases are synthetic.
 */
export function isNeuroSelectionValid(
  dataset: DatasetSource,
  scenarioId: ScenarioId
): boolean {
  return dataset === "case_study" || scenarioId === "sandbox";
}
