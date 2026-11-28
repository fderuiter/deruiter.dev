import type { UsdmV4Document } from "@/lib/clinical-standards";
import type {
  BroadcastChannelLike,
  StudyRepositoryKind,
  StudyRepositoryPersistence,
  StudyRepositoryRecord,
  StudyRepositorySeed,
  StudyRepositoryStore,
  StudyRepositorySummary,
  StudyRepositorySyncEvent,
  StudyRepositorySyncHandle,
  StudyWorkspace,
} from "../types";
import { branchStudyWorkspace } from "./branch-workspace";
import { importUsdmStudy } from "./import";
import { reconcileUsdmStudyRevision } from "./reconcile-usdm";
import { openStudyRepositoryStore } from "./repository-idb";
import { createMemoryStudyRepositoryStore } from "./repository-memory";
import {
  describeStudyWorkspace,
  summarizeStudyRepositoryRecord,
} from "./repository-meta";
import { openStudyRepositorySync } from "./repository-sync";
import { StudyWorkspaceConflictError } from "./revision";

/** Snapshot emitted by `BrowserStudyWorkspaceStore`. */
export interface BrowserStudyWorkspaceSnapshot {
  readonly isHydrated: boolean;
  readonly persistence: StudyRepositoryPersistence;
  readonly activeStudyId: string | null;
  readonly activeRecord: StudyRepositoryRecord | null;
  readonly studies: readonly StudyRepositorySummary[];
  readonly lastRemoteEvent: StudyRepositorySyncEvent | null;
  readonly remoteEventSeq: number;
}

/** Outcome of saving or reconciling a study revision in `BrowserStudyWorkspaceStore`. */
export type BrowserStudyWorkspaceSaveOutcome =
  | { readonly status: "saved"; readonly record: StudyRepositoryRecord }
  | { readonly status: "unchanged"; readonly record: StudyRepositoryRecord }
  | {
      readonly status: "conflict";
      readonly error: StudyWorkspaceConflictError;
      readonly expectedRevisionId: string;
      readonly currentRevisionId: string | null;
      readonly latestRecord: StudyRepositoryRecord | null;
    };

/** Configuration for `createBrowserStudyWorkspaceStore`. */
export interface BrowserStudyWorkspaceStoreOptions {
  readonly seeds?: readonly StudyRepositorySeed[];
  readonly indexedDB?: IDBFactory;
  readonly dbName?: string;
  readonly channelName?: string;
  readonly tabId?: string;
  readonly createChannel?: (name: string) => BroadcastChannelLike | null;
  readonly now?: () => string;
}

/** Browser-local multi-tab coordinator around `StudyRepositoryStore` and `BroadcastChannel`. */
export interface BrowserStudyWorkspaceStore {
  getSnapshot(): BrowserStudyWorkspaceSnapshot;
  subscribe(listener: () => void): () => void;
  initialize(): Promise<BrowserStudyWorkspaceSnapshot>;
  getRecord(studyId: string): Promise<StudyRepositoryRecord | null>;
  selectStudy(studyId: string): Promise<StudyRepositoryRecord | null>;
  saveWorkspace(
    studyId: string,
    workspace: StudyWorkspace,
    options?: {
      readonly expectedRevisionId?: string;
      readonly force?: boolean;
      readonly pinActive?: boolean;
      readonly kind?: StudyRepositoryKind;
    }
  ): Promise<BrowserStudyWorkspaceSaveOutcome>;
  reconcileUsdm(
    studyId: string,
    incomingUsdm: UsdmV4Document,
    options: {
      readonly expectedRevisionId: string;
      readonly note: string;
      readonly force?: boolean;
      readonly skipIfUnchanged?: boolean;
      readonly requireExisting?: boolean;
    }
  ): Promise<BrowserStudyWorkspaceSaveOutcome>;
  branchConflict(
    studyId: string,
    localWorkspace: StudyWorkspace,
    options?: { readonly note?: string }
  ): Promise<StudyRepositoryRecord>;
  activateOrImportUsdm(
    preferredStudyId: string,
    incomingUsdm: UsdmV4Document,
    options?: {
      readonly kind?: StudyRepositoryKind;
      readonly note?: string;
    }
  ): Promise<StudyRepositoryRecord>;
  deleteStudy(studyId: string, fallbackStudyId?: string | null): Promise<void>;
  dispose(): void;
}

const INITIAL_BROWSER_WORKSPACE_SNAPSHOT: BrowserStudyWorkspaceSnapshot =
  Object.freeze({
    isHydrated: false,
    persistence: "indexeddb",
    activeStudyId: null,
    activeRecord: null,
    studies: Object.freeze([]),
    lastRemoteEvent: null,
    remoteEventSeq: 0,
  });

function sanitizeStudySlug(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/\.(study|usdm)\.json$/i, "")
    .replace(/\.json$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned.slice(0, 48) : "study";
}

function nextBranchStudyId(
  baseStudyId: string,
  existingIds: ReadonlySet<string>
): string {
  const root = sanitizeStudySlug(`${baseStudyId}-branch`);
  if (!existingIds.has(root)) return root;
  let index = 2;
  while (existingIds.has(`${root}-${index}`)) {
    index += 1;
  }
  return `${root}-${index}`;
}

/**
 * Creates a framework-agnostic browser workspace coordinator backed by IndexedDB
 * (falling back to memory when unavailable) and `BroadcastChannel` for cross-tab
 * revision sync and lossless conflict branch recovery.
 */
export function createBrowserStudyWorkspaceStore(
  options: BrowserStudyWorkspaceStoreOptions = {}
): BrowserStudyWorkspaceStore {
  const now = options.now ?? (() => new Date().toISOString());
  const seeds = options.seeds ?? [];
  const seedIds = new Set(seeds.map((seed) => seed.studyId));
  const listeners = new Set<() => void>();

  let store: StudyRepositoryStore | null = null;
  let sync: StudyRepositorySyncHandle | null = null;
  let unsubscribeSync: (() => void) | null = null;
  let initPromise: Promise<BrowserStudyWorkspaceSnapshot> | null = null;
  let snapshot: BrowserStudyWorkspaceSnapshot =
    INITIAL_BROWSER_WORKSPACE_SNAPSHOT;

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const refresh = async (
    currentStore: StudyRepositoryStore,
    remoteEvent?: StudyRepositorySyncEvent
  ): Promise<BrowserStudyWorkspaceSnapshot> => {
    const records = await currentStore.list();
    if (store !== currentStore) return snapshot;
    let activeStudyId = await currentStore.getActiveStudyId();
    if (store !== currentStore) return snapshot;
    if (
      activeStudyId !== null &&
      !records.some((entry) => entry.studyId === activeStudyId)
    ) {
      activeStudyId = records[0]?.studyId ?? null;
      await currentStore.setActiveStudyId(activeStudyId);
      if (store !== currentStore) return snapshot;
    }
    const activeRecord =
      activeStudyId !== null
        ? (records.find((entry) => entry.studyId === activeStudyId) ?? null)
        : null;

    snapshot = {
      isHydrated: true,
      persistence: currentStore.persistence,
      activeStudyId,
      activeRecord,
      studies: records.map(summarizeStudyRepositoryRecord),
      lastRemoteEvent: remoteEvent ?? snapshot.lastRemoteEvent,
      remoteEventSeq: remoteEvent
        ? snapshot.remoteEventSeq + 1
        : snapshot.remoteEventSeq,
    };
    notify();
    return snapshot;
  };

  const ensureStore = async (): Promise<StudyRepositoryStore> => {
    if (store) return store;
    const opened = await openStudyRepositoryStore({
      indexedDB: options.indexedDB,
      name: options.dbName,
    });
    store = opened.ok ? opened.store : createMemoryStudyRepositoryStore();
    sync = openStudyRepositorySync({
      channelName: options.channelName,
      tabId: options.tabId,
      createChannel: options.createChannel,
    });
    unsubscribeSync = sync.subscribe((event) => {
      if (!store) return;
      void refresh(store, event).catch(() => undefined);
    });
    if (seeds.length > 0) {
      await store.seedIfMissing(seeds);
    }
    return store;
  };

  return {
    getSnapshot() {
      return snapshot;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    initialize() {
      if (!initPromise) {
        initPromise = ensureStore().then((readyStore) => refresh(readyStore));
      }
      return initPromise;
    },

    async getRecord(studyId) {
      const currentStore = await ensureStore();
      return currentStore.get(studyId);
    },

    async selectStudy(studyId) {
      const currentStore = await ensureStore();
      const record = await currentStore.get(studyId);
      if (!record) return null;
      const stamp = now();
      await currentStore.setActiveStudyId(studyId);
      await refresh(currentStore);
      sync?.publish({
        type: "active-study-changed",
        studyId,
        updatedAt: stamp,
      });
      return record;
    },

    async saveWorkspace(studyId, workspace, saveOptions = {}) {
      const currentStore = await ensureStore();
      const existing = await currentStore.get(studyId);
      const meta = describeStudyWorkspace(workspace);
      const stamp = now();
      const record: StudyRepositoryRecord = {
        studyId,
        kind:
          existing?.kind ??
          saveOptions.kind ??
          (seedIds.has(studyId) ? "reference" : "authored"),
        title: meta.title,
        protocolCode: meta.protocolCode,
        workspace,
        createdAt: existing?.createdAt ?? stamp,
        updatedAt: stamp,
      };
      try {
        const saved = await currentStore.put(record, {
          expectedRevisionId: saveOptions.expectedRevisionId,
          force: saveOptions.force,
        });
        if (saveOptions.pinActive !== false) {
          await currentStore.setActiveStudyId(studyId);
        }
        await refresh(currentStore);
        sync?.publish({
          type: "study-saved",
          studyId,
          revisionId: saved.workspace.revision.id,
          sha256: saved.workspace.revision.sha256,
          updatedAt: stamp,
        });
        return { status: "saved", record: saved };
      } catch (caught) {
        if (caught instanceof StudyWorkspaceConflictError) {
          const latestRecord = await currentStore.get(studyId);
          await refresh(currentStore);
          return {
            status: "conflict",
            error: caught,
            expectedRevisionId: caught.expectedRevisionId,
            currentRevisionId: caught.currentRevisionId,
            latestRecord,
          };
        }
        throw caught;
      }
    },

    async reconcileUsdm(studyId, incomingUsdm, reconcileOptions) {
      const currentStore = await ensureStore();
      let existing = await currentStore.get(studyId);
      if (!existing) {
        if (reconcileOptions.requireExisting && !reconcileOptions.force) {
          const error = new StudyWorkspaceConflictError(
            reconcileOptions.expectedRevisionId,
            null
          );
          await refresh(currentStore);
          return {
            status: "conflict",
            error,
            expectedRevisionId: reconcileOptions.expectedRevisionId,
            currentRevisionId: null,
            latestRecord: null,
          };
        }
        const imported = await importUsdmStudy({ document: incomingUsdm });
        if (imported.status !== "ok") {
          throw new Error(
            `Study ${studyId} could not be initialized: ${imported.status}.`
          );
        }
        return this.saveWorkspace(studyId, imported.workspace, {
          force: true,
          kind: "authored",
          pinActive: true,
        });
      }

      if (
        !reconcileOptions.force &&
        existing.workspace.revision.id !== reconcileOptions.expectedRevisionId
      ) {
        const error = new StudyWorkspaceConflictError(
          reconcileOptions.expectedRevisionId,
          existing.workspace.revision.id
        );
        await refresh(currentStore);
        return {
          status: "conflict",
          error,
          expectedRevisionId: reconcileOptions.expectedRevisionId,
          currentRevisionId: existing.workspace.revision.id,
          latestRecord: existing,
        };
      }

      const baseRevisionId = reconcileOptions.force
        ? existing.workspace.revision.id
        : reconcileOptions.expectedRevisionId;

      const nextWorkspace = reconcileUsdmStudyRevision(
        existing.workspace,
        incomingUsdm,
        {
          expectedRevisionId: baseRevisionId,
          note: reconcileOptions.note,
          skipIfUnchanged: reconcileOptions.skipIfUnchanged,
        }
      );

      if (nextWorkspace === existing.workspace) {
        if ((await currentStore.getActiveStudyId()) !== studyId) {
          const stamp = now();
          await currentStore.setActiveStudyId(studyId);
          existing = (await currentStore.get(studyId)) ?? existing;
          await refresh(currentStore);
          sync?.publish({
            type: "active-study-changed",
            studyId,
            updatedAt: stamp,
          });
        }
        return { status: "unchanged", record: existing };
      }

      return this.saveWorkspace(studyId, nextWorkspace, {
        expectedRevisionId: baseRevisionId,
        force: reconcileOptions.force,
        pinActive: true,
      });
    },

    async branchConflict(studyId, localWorkspace, branchOptions = {}) {
      const currentStore = await ensureStore();
      const existing = await currentStore.list();
      const existingIds = new Set(existing.map((entry) => entry.studyId));
      const branchId = nextBranchStudyId(studyId, existingIds);
      const branchedWorkspace = branchStudyWorkspace(localWorkspace, {
        protocolCode: branchId.toUpperCase(),
        note: branchOptions.note,
      });
      const meta = describeStudyWorkspace(branchedWorkspace);
      const stamp = now();
      const saved = await currentStore.put(
        {
          studyId: branchId,
          kind: "authored",
          title: meta.title,
          protocolCode: meta.protocolCode,
          workspace: branchedWorkspace,
          createdAt: stamp,
          updatedAt: stamp,
        },
        { force: true }
      );
      await currentStore.setActiveStudyId(branchId);
      await refresh(currentStore);
      sync?.publish({
        type: "study-imported",
        studyId: branchId,
        revisionId: saved.workspace.revision.id,
        updatedAt: stamp,
      });
      return saved;
    },

    async activateOrImportUsdm(
      preferredStudyId,
      incomingUsdm,
      activateOptions = {}
    ) {
      const currentStore = await ensureStore();
      const targetId = sanitizeStudySlug(preferredStudyId);
      const existing = await currentStore.get(targetId);
      if (existing) {
        const reconciled = await this.reconcileUsdm(targetId, incomingUsdm, {
          expectedRevisionId: existing.workspace.revision.id,
          note: activateOptions.note ?? "Selected preset in studio",
          force: true,
          skipIfUnchanged: true,
        });
        if (reconciled.status === "conflict") {
          throw reconciled.error;
        }
        return reconciled.record;
      }

      const imported = await importUsdmStudy({ document: incomingUsdm });
      if (imported.status !== "ok") {
        throw new Error(
          `Study ${targetId} could not be imported: ${imported.status}.`
        );
      }
      const outcome = await this.saveWorkspace(targetId, imported.workspace, {
        force: true,
        kind: activateOptions.kind ?? "authored",
        pinActive: true,
      });
      if (outcome.status !== "saved") {
        throw new Error(`Study ${targetId} could not be saved.`);
      }
      return outcome.record;
    },

    async deleteStudy(studyId, fallbackStudyId = null) {
      const currentStore = await ensureStore();
      const wasActive = (await currentStore.getActiveStudyId()) === studyId;
      await currentStore.remove(studyId);
      if (seedIds.has(studyId)) {
        await currentStore.seedIfMissing(
          seeds.filter((seed) => seed.studyId === studyId)
        );
        if (wasActive) {
          await currentStore.setActiveStudyId(studyId);
        }
      } else if (wasActive) {
        await currentStore.setActiveStudyId(fallbackStudyId);
      }
      const nextSnap = await refresh(currentStore);
      sync?.publish({
        type: "study-deleted",
        studyId,
        nextActiveStudyId: nextSnap.activeStudyId,
        updatedAt: now(),
      });
    },

    dispose() {
      unsubscribeSync?.();
      unsubscribeSync = null;
      sync?.close();
      sync = null;
      store?.close();
      store = null;
      initPromise = null;
      listeners.clear();
    },
  };
}
