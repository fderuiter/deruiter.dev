/**
 * Per-case draft edits for NeuroRecon Studio.
 *
 * Switching cases must not silently discard in-progress repairs, so the
 * workspace keeps a session-only draft per scenario and replays it onto a
 * freshly generated volume when the visitor returns.
 */

import type { ControlPoint, ScenarioId, VoxelEdit } from "./types";
import type { SyntheticVolume } from "./volume-generator";

/** In-progress edits for one case. */
export interface NeuroDraft {
  controlPoints: ControlPoint[];
  voxelEdits: VoxelEdit[];
}

/** Session-only drafts keyed by scenario. */
export type NeuroDraftMap = Partial<Record<ScenarioId, NeuroDraft>>;

/** Number of edits (control points plus voxel edits) in a draft. */
export function countNeuroDraftEdits(
  draft: Pick<NeuroDraft, "controlPoints" | "voxelEdits"> | undefined
): number {
  return draft ? draft.controlPoints.length + draft.voxelEdits.length : 0;
}

/** Return a new map with the scenario's draft stored, or removed when empty. */
export function withNeuroDraft(
  drafts: NeuroDraftMap,
  scenarioId: ScenarioId,
  draft: NeuroDraft
): NeuroDraftMap {
  const next = { ...drafts };
  if (countNeuroDraftEdits(draft) === 0) {
    delete next[scenarioId];
  } else {
    next[scenarioId] = draft;
  }
  return next;
}

/**
 * Replay voxel edits onto a volume's mutable buffers (same rule the editor
 * applies live) so restored drafts and undo render and score identically.
 */
export function applyVoxelEditsToVolume(
  volume: SyntheticVolume,
  edits: VoxelEdit[]
): void {
  const size = volume.dimensions.width;
  for (const e of edits) {
    const idx = e.z * size * size + e.y * size + e.x;
    if (e.layer === "brainmask") {
      volume.brainmask[idx] = e.newValue;
    } else {
      volume.wmMask[idx] = e.newValue;
      volume.rawT1[idx] = e.newValue === 1 ? 110 : 70;
    }
  }
}
