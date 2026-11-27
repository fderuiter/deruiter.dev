/**
 * Data provenance for NeuroRecon Studio views and metrics.
 *
 * The 2D orthoview volume and QA metrics are always generated from the
 * synthetic phantom (`computeSyntheticVolume`). Real-scan datasets only
 * supply the 3D reference mesh, so the UI must say so and must not pair a
 * real-dataset label with a synthetic defect case.
 */

import type {
  DatasetSource,
  ScenarioId,
  VolumeDimensions,
  VolumeSourceFormat,
  VoxelSpacing,
} from "./types";

/** Metadata describing an uploaded scan driving both 2D slices and 3D surfaces. */
export interface UploadedVolumeProvenanceInfo {
  fileName: string;
  dimensions: VolumeDimensions;
  spacing: VoxelSpacing;
  format?: Exclude<VolumeSourceFormat, "synthetic">;
}

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

/** Resolve the provenance labels for a dataset selection and optional uploaded scan. */
export function getNeuroProvenance(
  dataset: DatasetSource,
  datasetName?: string,
  uploadedVolume?: UploadedVolumeProvenanceInfo | null
): NeuroProvenance {
  if (uploadedVolume) {
    const { fileName, dimensions, spacing, format } = uploadedVolume;
    const fmtLabel = format === "mgz" ? "FreeSurfer MGZ" : "NIfTI";
    const gridLabel = `${dimensions.width}x${dimensions.height}x${dimensions.depth}`;
    const spacingLabel = `${Number(spacing.x.toFixed(2))}x${Number(spacing.y.toFixed(2))}x${Number(spacing.z.toFixed(2))} mm`;
    return {
      mesh: `Live 3D marching-cubes surface (${fileName})`,
      volume: `Uploaded ${fmtLabel} volume (${fileName}, ${gridLabel} @ ${spacingLabel})`,
      qa: `Volumetric metrics computed from ${fileName}`,
      isMixedSource: false,
    };
  }
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
