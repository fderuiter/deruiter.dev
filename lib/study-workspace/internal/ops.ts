import type { UsdmV4Document } from "@/lib/clinical-standards";
import type {
  StudyEdit,
  StudyEditHistory,
  StudyPatchOperation,
  StudyWorkspace,
} from "../types";
import { commitStudyRevision } from "./revision";

/** Thrown when a patch names a path the document does not have. */
export class StudyPatchError extends Error {
  constructor(
    readonly path: string,
    reason: string
  ) {
    super(`Cannot patch ${path}: ${reason}.`);
    this.name = "StudyPatchError";
  }
}

type Container = Record<string, unknown> | unknown[];

function isContainer(value: unknown): value is Container {
  return typeof value === "object" && value !== null;
}

/** Splits an RFC 6901 JSON Pointer into its unescaped tokens. */
function tokens(path: string): string[] {
  if (path === "") return [];
  if (!path.startsWith("/")) {
    throw new StudyPatchError(path, "a path starts with /");
  }
  return path
    .slice(1)
    .split("/")
    .map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function arrayIndex(path: string, token: string, length: number): number {
  if (!/^(0|[1-9]\d*)$/.test(token)) {
    throw new StudyPatchError(path, `"${token}" is not an array index`);
  }
  const index = Number(token);
  if (index >= length) throw new StudyPatchError(path, "index out of range");
  return index;
}

/** The container a path points into, and the last token within it. */
function parentOf(
  root: unknown,
  path: string
): { parent: Container; key: string } {
  const parts = tokens(path);
  if (parts.length === 0) {
    throw new StudyPatchError(path, "the whole document cannot be patched");
  }
  let node: unknown = root;
  for (const token of parts.slice(0, -1)) {
    if (Array.isArray(node)) {
      node = node[arrayIndex(path, token, node.length)];
    } else if (isContainer(node) && Object.hasOwn(node, token)) {
      node = (node as Record<string, unknown>)[token];
    } else {
      throw new StudyPatchError(path, `"${token}" does not exist`);
    }
  }
  if (!isContainer(node)) throw new StudyPatchError(path, "no container");
  return { parent: node, key: parts[parts.length - 1] };
}

function read(root: unknown, path: string): unknown {
  const { parent, key } = parentOf(root, path);
  if (Array.isArray(parent)) {
    return parent[arrayIndex(path, key, parent.length)];
  }
  if (!Object.hasOwn(parent, key)) {
    throw new StudyPatchError(path, `"${key}" does not exist`);
  }
  return parent[key];
}

/** Applies one operation in place; returns its inverse. */
function applyOne(
  root: unknown,
  operation: StudyPatchOperation
): StudyPatchOperation {
  const { path } = operation;
  const { parent, key } = parentOf(root, path);
  switch (operation.op) {
    case "add": {
      const value = structuredClone(operation.value);
      if (Array.isArray(parent)) {
        const index =
          key === "-"
            ? parent.length
            : arrayIndex(path, key, parent.length + 1);
        parent.splice(index, 0, value);
        const at = path.slice(0, path.lastIndexOf("/") + 1) + String(index);
        return { op: "remove", path: at };
      }
      const existed = Object.hasOwn(parent, key);
      const previous = parent[key];
      parent[key] = value;
      return existed
        ? { op: "replace", path, value: structuredClone(previous) }
        : { op: "remove", path };
    }
    case "remove": {
      const previous = structuredClone(read(root, path));
      if (Array.isArray(parent)) {
        parent.splice(arrayIndex(path, key, parent.length), 1);
      } else {
        delete parent[key];
      }
      return { op: "add", path, value: previous };
    }
    case "replace": {
      const previous = structuredClone(read(root, path));
      const value = structuredClone(operation.value);
      if (Array.isArray(parent)) {
        parent[arrayIndex(path, key, parent.length)] = value;
      } else {
        parent[key] = value;
      }
      return { op: "replace", path, value: previous };
    }
  }
}

/**
 * Applies a patch to a copy of the document. The input is left unchanged.
 * The patch is all or nothing: a bad path throws before a result exists.
 *
 * @returns The patched document and the patch that undoes it.
 * @throws StudyPatchError when an operation names a missing path.
 */
export function applyStudyPatch(
  usdm: UsdmV4Document,
  patch: readonly StudyPatchOperation[]
): { usdm: UsdmV4Document; inverse: StudyPatchOperation[] } {
  const working = structuredClone(usdm);
  const inverse = patch.map((operation) => applyOne(working, operation));
  return { usdm: working, inverse: inverse.reverse() };
}

/** A history with nothing to undo or redo. */
export function emptyStudyEditHistory(): StudyEditHistory {
  return { undo: [], redo: [] };
}

/**
 * Makes an edit from a patch against the workspace's working document. The
 * inverse is worked out here, so undo restores the exact document.
 *
 * @throws StudyPatchError when the patch does not fit the document.
 */
export function createStudyEdit(
  workspace: StudyWorkspace,
  patch: readonly StudyPatchOperation[],
  note: string
): StudyEdit {
  const { inverse } = applyStudyPatch(workspace.usdm, patch);
  return { note, forward: [...patch], inverse };
}

/** A workspace and its edit history after an edit, undo or redo. */
export interface StudyEditResult {
  readonly workspace: StudyWorkspace;
  readonly history: StudyEditHistory;
}

function commitPatch(
  workspace: StudyWorkspace,
  patch: readonly StudyPatchOperation[],
  note: string
): StudyWorkspace {
  const { usdm } = applyStudyPatch(workspace.usdm, patch);
  return commitStudyRevision(workspace, usdm, {
    expectedRevisionId: workspace.revision.id,
    note,
  });
}

/**
 * Applies an edit as the next revision, records it for undo and clears the
 * redo stack.
 */
export function applyStudyEdit(
  workspace: StudyWorkspace,
  history: StudyEditHistory,
  edit: StudyEdit
): StudyEditResult {
  return {
    workspace: commitPatch(workspace, edit.forward, edit.note),
    history: { undo: [...history.undo, edit], redo: [] },
  };
}

/**
 * Undoes the last edit as a new revision; the history of revisions only
 * grows. Returns the inputs unchanged when there is nothing to undo.
 */
export function undoStudyEdit(
  workspace: StudyWorkspace,
  history: StudyEditHistory
): StudyEditResult {
  const edit = history.undo.at(-1);
  if (!edit) return { workspace, history };
  return {
    workspace: commitPatch(workspace, edit.inverse, `Undo: ${edit.note}`),
    history: {
      undo: history.undo.slice(0, -1),
      redo: [...history.redo, edit],
    },
  };
}

/**
 * Redoes the last undone edit as a new revision. Returns the inputs
 * unchanged when there is nothing to redo.
 */
export function redoStudyEdit(
  workspace: StudyWorkspace,
  history: StudyEditHistory
): StudyEditResult {
  const edit = history.redo.at(-1);
  if (!edit) return { workspace, history };
  return {
    workspace: commitPatch(workspace, edit.forward, `Redo: ${edit.note}`),
    history: {
      undo: [...history.undo, edit],
      redo: history.redo.slice(0, -1),
    },
  };
}
