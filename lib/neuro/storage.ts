/**
 * Client-Side IndexedDB Workspace Persistence for NeuroRecon Studio
 * Persists uploaded native volumes, imported overlay masks, control points,
 * and stroke history across browser reloads under a strict 250 MB local cap,
 * with automatic in-memory fallback when IndexedDB is unavailable or blocked.
 */

import type { NeuroDraftMap } from "./drafts";
import type {
  AffineMatrix4x4,
  ControlPoint,
  DatasetSource,
  NeuroEditLayer,
  NeuroStrokeHistory,
  OverlayMaskLayer,
  ScenarioId,
  VolumeDimensions,
  VolumeSourceFormat,
  VoxelEdit,
  VoxelSpacing,
} from "./types";
import {
  createDefaultAffine,
  DEFAULT_VOXEL_SPACING,
  type SyntheticVolume,
} from "./volume-generator";

/** IndexedDB database name for NeuroRecon local persistence. */
export const NEURO_WORKSPACE_DB_NAME = "portfolio_neuro_workspace";

/** Schema version for the NeuroRecon IndexedDB store. */
export const NEURO_WORKSPACE_DB_VERSION = 1;

/** Strict 250 MB storage cap for locally persisted neuroimaging data. */
export const MAX_NEURO_STORAGE_BYTES = 250 * 1024 * 1024;

const STORE_NAME = "workspace";
const ACTIVE_KEY = "active_session";

/** Serialized representation of an uploaded native volume in IndexedDB. */
export interface PersistedNeuroVolume {
  dimensions: VolumeDimensions;
  spacing: VoxelSpacing;
  affine: AffineMatrix4x4;
  sourceFormat: VolumeSourceFormat;
  fileName?: string;
  rawT1: Uint8Array;
  brainmask: Uint8Array;
  wmMask: Uint8Array;
  initialBrainmask: Uint8Array;
  initialWmMask: Uint8Array;
  labels: Uint8Array;
  scenarioId: ScenarioId;
}

/** Complete workspace snapshot persisted locally in IndexedDB or memory fallback. */
export interface NeuroPersistedWorkspace {
  updatedAt: number;
  activeScenarioId: ScenarioId;
  activeDataset: DatasetSource;
  activeEditLayer: NeuroEditLayer;
  isosurfaceThreshold: number;
  uploadedVolume: PersistedNeuroVolume | null;
  overlayLayer: OverlayMaskLayer | null;
  controlPoints: ControlPoint[];
  voxelEdits: VoxelEdit[];
  strokeHistory: NeuroStrokeHistory;
  drafts: NeuroDraftMap;
}

/** Storage backend used to fulfill a workspace persistence operation. */
export type NeuroStorageBackend = "indexeddb" | "memory";

/** Result returned when saving a workspace snapshot. */
export type SaveNeuroWorkspaceResult =
  | {
      readonly ok: true;
      readonly backend: NeuroStorageBackend;
      readonly bytes: number;
    }
  | {
      readonly ok: false;
      readonly code: "QUOTA_EXCEEDED";
      readonly bytes: number;
      readonly maxBytes: number;
      readonly message: string;
    };

/** Result returned when loading a workspace snapshot. */
export interface LoadNeuroWorkspaceResult {
  readonly workspace: NeuroPersistedWorkspace | null;
  readonly backend: NeuroStorageBackend;
  readonly bytes: number;
}

/** Options for customizing IndexedDB factory or byte cap (useful in unit tests). */
export interface NeuroStorageOptions {
  readonly indexedDB?: IDBFactory | null;
  readonly dbName?: string;
  readonly maxBytes?: number;
}

let memoryFallbackSnapshot: NeuroPersistedWorkspace | null = null;

/**
 * Reset the in-memory fallback snapshot (intended for test isolation and Clear Local Storage).
 */
export function resetNeuroMemoryFallback(): void {
  memoryFallbackSnapshot = null;
}

/**
 * Convert a live `SyntheticVolume` into a serializable `PersistedNeuroVolume`.
 */
export function serializeVolumeForStorage(
  volume: SyntheticVolume
): PersistedNeuroVolume {
  const spacing = volume.spacing ?? DEFAULT_VOXEL_SPACING;
  const affine =
    volume.affine ?? createDefaultAffine(volume.dimensions, spacing);
  return {
    dimensions: { ...volume.dimensions },
    spacing: { ...spacing },
    affine: [...affine] as unknown as AffineMatrix4x4,
    sourceFormat: volume.sourceFormat ?? "synthetic",
    fileName: volume.fileName,
    rawT1: volume.rawT1.slice(),
    brainmask: volume.brainmask.slice(),
    wmMask: volume.wmMask.slice(),
    initialBrainmask: volume.initialBrainmask.slice(),
    initialWmMask: volume.initialWmMask.slice(),
    labels: volume.labels.slice(),
    scenarioId: volume.scenarioId,
  };
}

/**
 * Reconstruct a live `SyntheticVolume` from a persisted snapshot and optional overlay layer.
 */
export function hydrateVolumeFromStorage(
  persisted: PersistedNeuroVolume,
  overlayLayer?: OverlayMaskLayer | null
): SyntheticVolume {
  return {
    dimensions: { ...persisted.dimensions },
    spacing: { ...persisted.spacing },
    affine: [...persisted.affine] as unknown as AffineMatrix4x4,
    sourceFormat: persisted.sourceFormat,
    fileName: persisted.fileName,
    overlayMask: overlayLayer ? overlayLayer.data.slice() : undefined,
    rawT1: persisted.rawT1.slice(),
    brainmask: persisted.brainmask.slice(),
    wmMask: persisted.wmMask.slice(),
    initialBrainmask: persisted.initialBrainmask.slice(),
    initialWmMask: persisted.initialWmMask.slice(),
    labels: persisted.labels.slice(),
    scenarioId: persisted.scenarioId,
    defectRegion: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
    },
  };
}

/**
 * Estimate the total byte footprint of a persisted workspace snapshot across
 * typed-array volume buffers, overlay masks, control points, and stroke history.
 */
export function estimateNeuroWorkspaceBytes(
  workspace: NeuroPersistedWorkspace | null | undefined
): number {
  if (!workspace) return 0;
  let bytes = 512;

  if (workspace.uploadedVolume) {
    const v = workspace.uploadedVolume;
    bytes +=
      v.rawT1.byteLength +
      v.brainmask.byteLength +
      v.wmMask.byteLength +
      v.initialBrainmask.byteLength +
      v.initialWmMask.byteLength +
      v.labels.byteLength +
      256;
  }

  if (workspace.overlayLayer) {
    bytes += workspace.overlayLayer.data.byteLength + 256;
  }

  bytes += workspace.controlPoints.length * 128;
  bytes += workspace.voxelEdits.length * 64;

  for (const s of workspace.strokeHistory.undoStack) {
    bytes += 96 + s.voxelEdits.length * 64 + (s.controlPoint ? 128 : 0);
  }
  for (const s of workspace.strokeHistory.redoStack) {
    bytes += 96 + s.voxelEdits.length * 64 + (s.controlPoint ? 128 : 0);
  }

  for (const draft of Object.values(workspace.drafts)) {
    if (!draft) continue;
    bytes += draft.controlPoints.length * 128 + draft.voxelEdits.length * 64;
  }

  return bytes;
}

function cloneWorkspaceSnapshot(
  ws: NeuroPersistedWorkspace
): NeuroPersistedWorkspace {
  return {
    ...ws,
    uploadedVolume: ws.uploadedVolume
      ? {
          ...ws.uploadedVolume,
          dimensions: { ...ws.uploadedVolume.dimensions },
          spacing: { ...ws.uploadedVolume.spacing },
          affine: [...ws.uploadedVolume.affine] as unknown as AffineMatrix4x4,
          rawT1: ws.uploadedVolume.rawT1.slice(),
          brainmask: ws.uploadedVolume.brainmask.slice(),
          wmMask: ws.uploadedVolume.wmMask.slice(),
          initialBrainmask: ws.uploadedVolume.initialBrainmask.slice(),
          initialWmMask: ws.uploadedVolume.initialWmMask.slice(),
          labels: ws.uploadedVolume.labels.slice(),
        }
      : null,
    overlayLayer: ws.overlayLayer
      ? {
          ...ws.overlayLayer,
          dimensions: { ...ws.overlayLayer.dimensions },
          spacing: { ...ws.overlayLayer.spacing },
          affine: [...ws.overlayLayer.affine] as unknown as AffineMatrix4x4,
          data: ws.overlayLayer.data.slice(),
        }
      : null,
    controlPoints: ws.controlPoints.map((cp) => ({ ...cp })),
    voxelEdits: ws.voxelEdits.map((ve) => ({ ...ve })),
    strokeHistory: {
      undoStack: ws.strokeHistory.undoStack.map((s) => ({
        ...s,
        voxelEdits: s.voxelEdits.map((e) => ({ ...e })),
        controlPoint: s.controlPoint ? { ...s.controlPoint } : undefined,
      })),
      redoStack: ws.strokeHistory.redoStack.map((s) => ({
        ...s,
        voxelEdits: s.voxelEdits.map((e) => ({ ...e })),
        controlPoint: s.controlPoint ? { ...s.controlPoint } : undefined,
      })),
    },
    drafts: { ...ws.drafts },
  };
}

function resolveIdbFactory(
  options: NeuroStorageOptions
): IDBFactory | undefined {
  if ("indexedDB" in options) {
    return options.indexedDB ?? undefined;
  }
  return typeof indexedDB === "undefined" ? undefined : indexedDB;
}

function openNeuroDb(
  factory: IDBFactory,
  dbName: string
): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(dbName, NEURO_WORKSPACE_DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

/**
 * Persist a NeuroRecon workspace snapshot into IndexedDB (capped at 250 MB),
 * falling back to in-memory storage if IndexedDB is unavailable or blocked.
 */
export async function saveNeuroWorkspaceState(
  workspace: NeuroPersistedWorkspace,
  options: NeuroStorageOptions = {}
): Promise<SaveNeuroWorkspaceResult> {
  const maxBytes = options.maxBytes ?? MAX_NEURO_STORAGE_BYTES;
  const bytes = estimateNeuroWorkspaceBytes(workspace);

  if (bytes > maxBytes) {
    return {
      ok: false,
      code: "QUOTA_EXCEEDED",
      bytes,
      maxBytes,
      message: `Workspace size (${(bytes / (1024 * 1024)).toFixed(1)} MB) exceeds the ${(maxBytes / (1024 * 1024)).toFixed(0)} MB local storage limit.`,
    };
  }

  const snapshot = cloneWorkspaceSnapshot(workspace);
  const factory = resolveIdbFactory(options);
  const dbName = options.dbName ?? NEURO_WORKSPACE_DB_NAME;

  if (!factory) {
    memoryFallbackSnapshot = snapshot;
    return { ok: true, backend: "memory", bytes };
  }

  const db = await openNeuroDb(factory, dbName);
  if (!db) {
    memoryFallbackSnapshot = snapshot;
    return { ok: true, backend: "memory", bytes };
  }

  return new Promise<SaveNeuroWorkspaceResult>((resolve) => {
    let settled = false;
    const finish = (res: SaveNeuroWorkspaceResult) => {
      if (settled) return;
      settled = true;
      db.close();
      resolve(res);
    };

    try {
      const tx = db.transaction([STORE_NAME], "readwrite");
      tx.oncomplete = () => {
        memoryFallbackSnapshot = snapshot;
        finish({ ok: true, backend: "indexeddb", bytes });
      };
      tx.onabort = () => {
        if (tx.error?.name === "QuotaExceededError") {
          finish({
            ok: false,
            code: "QUOTA_EXCEEDED",
            bytes,
            maxBytes,
            message: "Browser IndexedDB storage quota exceeded.",
          });
        } else {
          memoryFallbackSnapshot = snapshot;
          finish({ ok: true, backend: "memory", bytes });
        }
      };
      tx.onerror = (event) => {
        event.preventDefault();
      };
      tx.objectStore(STORE_NAME).put(snapshot, ACTIVE_KEY);
    } catch {
      memoryFallbackSnapshot = snapshot;
      finish({ ok: true, backend: "memory", bytes });
    }
  });
}

/**
 * Load the persisted NeuroRecon workspace snapshot from IndexedDB or the
 * in-memory private-browsing fallback.
 */
export async function loadNeuroWorkspaceState(
  options: NeuroStorageOptions = {}
): Promise<LoadNeuroWorkspaceResult> {
  const factory = resolveIdbFactory(options);
  const dbName = options.dbName ?? NEURO_WORKSPACE_DB_NAME;

  if (!factory) {
    const ws = memoryFallbackSnapshot
      ? cloneWorkspaceSnapshot(memoryFallbackSnapshot)
      : null;
    return {
      workspace: ws,
      backend: "memory",
      bytes: estimateNeuroWorkspaceBytes(ws),
    };
  }

  const db = await openNeuroDb(factory, dbName);
  if (!db) {
    const ws = memoryFallbackSnapshot
      ? cloneWorkspaceSnapshot(memoryFallbackSnapshot)
      : null;
    return {
      workspace: ws,
      backend: "memory",
      bytes: estimateNeuroWorkspaceBytes(ws),
    };
  }

  return new Promise<LoadNeuroWorkspaceResult>((resolve) => {
    let settled = false;
    const finish = (res: LoadNeuroWorkspaceResult) => {
      if (settled) return;
      settled = true;
      db.close();
      resolve(res);
    };

    try {
      const tx = db.transaction([STORE_NAME], "readonly");
      let loaded: NeuroPersistedWorkspace | null = null;
      const req = tx.objectStore(STORE_NAME).get(ACTIVE_KEY);
      req.onsuccess = () => {
        if (req.result && typeof req.result === "object") {
          loaded = cloneWorkspaceSnapshot(
            req.result as NeuroPersistedWorkspace
          );
        }
      };
      tx.oncomplete = () => {
        finish({
          workspace: loaded,
          backend: "indexeddb",
          bytes: estimateNeuroWorkspaceBytes(loaded),
        });
      };
      tx.onabort = () => {
        const ws = memoryFallbackSnapshot
          ? cloneWorkspaceSnapshot(memoryFallbackSnapshot)
          : null;
        finish({
          workspace: ws,
          backend: "memory",
          bytes: estimateNeuroWorkspaceBytes(ws),
        });
      };
      tx.onerror = (event) => {
        event.preventDefault();
      };
    } catch {
      const ws = memoryFallbackSnapshot
        ? cloneWorkspaceSnapshot(memoryFallbackSnapshot)
        : null;
      finish({
        workspace: ws,
        backend: "memory",
        bytes: estimateNeuroWorkspaceBytes(ws),
      });
    }
  });
}

/**
 * Purge all locally persisted NeuroRecon volumes, overlay masks, control points,
 * and stroke history from both IndexedDB and the in-memory fallback.
 */
export async function clearNeuroLocalStorage(
  options: NeuroStorageOptions = {}
): Promise<{ readonly ok: true; readonly backend: NeuroStorageBackend }> {
  memoryFallbackSnapshot = null;
  const factory = resolveIdbFactory(options);
  const dbName = options.dbName ?? NEURO_WORKSPACE_DB_NAME;

  if (!factory) {
    return { ok: true, backend: "memory" };
  }

  const db = await openNeuroDb(factory, dbName);
  if (!db) {
    return { ok: true, backend: "memory" };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (backend: NeuroStorageBackend) => {
      if (settled) return;
      settled = true;
      db.close();
      resolve({ ok: true, backend });
    };

    try {
      const tx = db.transaction([STORE_NAME], "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => finish("indexeddb");
      tx.onabort = () => finish("memory");
      tx.onerror = (event) => {
        event.preventDefault();
      };
    } catch {
      finish("memory");
    }
  });
}
