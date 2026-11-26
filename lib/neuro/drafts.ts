/**
 * Per-case draft edits for NeuroRecon Studio.
 *
 * Switching cases must not silently discard in-progress repairs, so the
 * workspace keeps a session-only draft per scenario and replays it onto a
 * freshly generated volume when the visitor returns.
 */

import type {
  ControlPoint,
  NeuroStroke,
  NeuroStrokeHistory,
  ScenarioId,
  VoxelEdit,
} from "./types";
import { getIndex, type SyntheticVolume } from "./volume-generator";

/** In-progress edits for one case. */
export interface NeuroDraft {
  controlPoints: ControlPoint[];
  voxelEdits: VoxelEdit[];
  strokeHistory?: NeuroStrokeHistory;
}

/** Session-only drafts keyed by scenario. */
export type NeuroDraftMap = Partial<Record<ScenarioId, NeuroDraft>>;

/** Maximum number of strokes retained in undo history per workspace. */
export const MAX_NEURO_STROKE_HISTORY = 200;

/** Create an empty stroke history state. */
export function createEmptyStrokeHistory(): NeuroStrokeHistory {
  return { undoStack: [], redoStack: [] };
}

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
 * applies live) so restored drafts and redo render and score identically.
 */
export function applyVoxelEditsToVolume(
  volume: SyntheticVolume,
  edits: VoxelEdit[]
): void {
  const { width, height, depth } = volume.dimensions;
  for (const e of edits) {
    if (
      e.x < 0 ||
      e.x >= width ||
      e.y < 0 ||
      e.y >= height ||
      e.z < 0 ||
      e.z >= depth
    ) {
      continue;
    }
    const idx = getIndex(e.x, e.y, e.z, width, height);
    if (e.layer === "brainmask") {
      volume.brainmask[idx] = e.newValue;
    } else if (e.layer === "overlay") {
      if (volume.overlayMask) {
        volume.overlayMask[idx] = e.newValue;
      }
    } else {
      volume.wmMask[idx] = e.newValue;
      if (volume.sourceFormat !== "nifti" && volume.sourceFormat !== "mgz") {
        volume.rawT1[idx] = e.newValue === 1 ? 110 : 70;
      }
    }
  }
}

/**
 * Revert a single stroke's voxel edits onto a volume's mutable buffers in reverse order.
 */
export function revertVoxelEditsOnVolume(
  volume: SyntheticVolume,
  edits: VoxelEdit[]
): void {
  const { width, height, depth } = volume.dimensions;
  for (let i = edits.length - 1; i >= 0; i--) {
    const e = edits[i];
    if (
      e.x < 0 ||
      e.x >= width ||
      e.y < 0 ||
      e.y >= height ||
      e.z < 0 ||
      e.z >= depth
    ) {
      continue;
    }
    const idx = getIndex(e.x, e.y, e.z, width, height);
    if (e.layer === "brainmask") {
      volume.brainmask[idx] = e.originalValue;
    } else if (e.layer === "overlay") {
      if (volume.overlayMask) {
        volume.overlayMask[idx] = e.originalValue;
      }
    } else {
      volume.wmMask[idx] = e.originalValue;
      if (volume.sourceFormat !== "nifti" && volume.sourceFormat !== "mgz") {
        volume.rawT1[idx] = e.originalValue === 1 ? 110 : 70;
      }
    }
  }
}

/**
 * Deduplicate voxel edits within a single pointer stroke so each modified voxel
 * records its pre-stroke originalValue and final post-stroke newValue once.
 */
export function coalesceStrokeVoxelEdits(edits: VoxelEdit[]): VoxelEdit[] {
  if (edits.length <= 1) return edits.slice();
  const byKey = new Map<string, VoxelEdit>();
  for (const edit of edits) {
    const key = `${edit.layer}:${edit.x},${edit.y},${edit.z}`;
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, {
        ...existing,
        newValue: edit.newValue,
      });
    } else {
      byKey.set(key, { ...edit });
    }
  }
  return [...byKey.values()].filter((e) => e.originalValue !== e.newValue);
}

/**
 * Append a completed stroke to the undo stack and clear the redo stack.
 */
export function pushNeuroStroke(
  history: NeuroStrokeHistory,
  stroke: NeuroStroke
): NeuroStrokeHistory {
  if (stroke.voxelEdits.length === 0 && !stroke.controlPoint) {
    return history;
  }
  const nextUndo = [...history.undoStack, stroke];
  if (nextUndo.length > MAX_NEURO_STROKE_HISTORY) {
    nextUndo.splice(0, nextUndo.length - MAX_NEURO_STROKE_HISTORY);
  }
  return {
    undoStack: nextUndo,
    redoStack: [],
  };
}

/**
 * Pop the most recent stroke from undoStack onto redoStack.
 */
export function stepUndoStrokeHistory(history: NeuroStrokeHistory): {
  stroke: NeuroStroke | null;
  history: NeuroStrokeHistory;
} {
  if (history.undoStack.length === 0) {
    return { stroke: null, history };
  }
  const stroke = history.undoStack[history.undoStack.length - 1];
  return {
    stroke,
    history: {
      undoStack: history.undoStack.slice(0, -1),
      redoStack: [...history.redoStack, stroke],
    },
  };
}

/**
 * Pop the most recently undone stroke from redoStack back onto undoStack.
 */
export function stepRedoStrokeHistory(history: NeuroStrokeHistory): {
  stroke: NeuroStroke | null;
  history: NeuroStrokeHistory;
} {
  if (history.redoStack.length === 0) {
    return { stroke: null, history };
  }
  const stroke = history.redoStack[history.redoStack.length - 1];
  return {
    stroke,
    history: {
      undoStack: [...history.undoStack, stroke],
      redoStack: history.redoStack.slice(0, -1),
    },
  };
}

/**
 * Derive flat controlPoints and voxelEdits arrays from the active undoStack.
 */
export function deriveDraftFromStrokeStack(undoStack: NeuroStroke[]): {
  controlPoints: ControlPoint[];
  voxelEdits: VoxelEdit[];
} {
  const controlPoints: ControlPoint[] = [];
  const voxelEdits: VoxelEdit[] = [];
  for (const stroke of undoStack) {
    if (stroke.controlPoint) {
      controlPoints.push(stroke.controlPoint);
    }
    if (stroke.voxelEdits.length > 0) {
      voxelEdits.push(...stroke.voxelEdits);
    }
  }
  return { controlPoints, voxelEdits };
}
