"use client";

import type { UsdmV4Document } from "@/lib/clinical-standards";
import { DEMO_STUDY_ID, writeSelectedStudy } from "@/lib/clinical-study-context";
import {
  safeGetRawItem,
  safeRemoveItem,
  safeSetRawItem,
} from "@/lib/safe-storage";
import { DEMO_301_STUDY, DEMO_301_USDM } from "@/lib/study-data/presets";
import {
  StudyWorkspaceConflictError,
  TAVR_DEVICE_USDM,
  TAVR_SAVR_USDM,
  createBlankStudyWorkspace,
  createMemoryStudyRepositoryStore,
  describeStudyWorkspace,
  exportValidatedStudyUsdm,
  importStudyRepositoryFile,
  importUsdmStudy,
  openStudyRepositoryStore,
  openStudyRepositorySync,
  reconcileUsdmStudyRevision,
  serializeStudyWorkspace,
  summarizeStudyRepositoryRecord,
  type BroadcastChannelLike,
  type ImportStudyRepositoryFileResult,
  type StudyRepositoryFileInput,
  type StudyRepositoryKind,
  type StudyRepositoryPersistence,
  type StudyRepositoryRecord,
  type StudyRepositorySeed,
  type StudyRepositoryStore,
  type StudyRepositorySummary,
  type StudyRepositorySyncEvent,
  type StudyRepositorySyncHandle,
  type StudyVersionChoice,
  type StudyWorkspace,
  type StudyWorkspaceSelection,
} from "@/lib/study-workspace";
import {
  STUDY_WORKSPACE_DRAFT_KEY,
  discardStudyWorkspaceDraft,
  dismissQuarantinedStudyWorkspaceDraft,
  loadStudyWorkspaceDraft,
  type QuarantinedStudyWorkspaceDraft,
} from "@/components/study-workspace/randomization-draft-storage";

const CRF_LEGACY_DRAFT_KEY = "crf_studio_draft_v1";

/** Built-in reference studies seeded into the shared browser catalog. */
const REFERENCE_STUDY_SEEDS: readonly StudyRepositorySeed[] = [
  {
    studyId: DEMO_STUDY_ID,
    title: DEMO_301_STUDY.title,
    protocolCode: DEMO_STUDY_ID,
    usdm: DEMO_301_USDM,
  },
  {
    studyId: "tavr-savr",
    protocolCode: "TAVR-SAVR-001",
    usdm: TAVR_SAVR_USDM,
  },
  {
    studyId: "tavr-device",
    protocolCode: "TAVR-DEV-001",
    usdm: TAVR_DEVICE_USDM,
  },
];

const REFERENCE_IDS = new Set(
  REFERENCE_STUDY_SEEDS.map((seed) => seed.studyId)
);

/** Pending multi-version or multi-design USDM import awaiting user choice. */
export interface PendingStudySelectionImport {
  readonly choices: readonly StudyVersionChoice[];
  readonly document: unknown;
  readonly fileName: string | null;
}

/** Snapshot exposed to React views via `useSyncExternalStore`. */
export interface StudyRepositorySnapshot {
  readonly isHydrated: boolean;
  readonly persistence: StudyRepositoryPersistence;
  readonly hasIndexedDbApi: boolean;
  readonly activeStudyId: string | null;
  readonly activeRecord: StudyRepositoryRecord | null;
  readonly studies: readonly StudyRepositorySummary[];
  readonly lastRemoteEvent: StudyRepositorySyncEvent | null;
  readonly remoteEventSeq: number;
  readonly quarantinedWorkspaceDraft: QuarantinedStudyWorkspaceDraft | null;
}

/** Result of saving or reconciling a study workspace revision. */
type SaveStudyRepositoryOutcome =
  | { readonly status: "saved"; readonly record: StudyRepositoryRecord }
  | { readonly status: "unchanged"; readonly record: StudyRepositoryRecord }
  | {
      readonly status: "conflict";
      readonly expectedRevisionId: string;
      readonly currentRevisionId: string | null;
      readonly latestRecord: StudyRepositoryRecord | null;
    };

/** Result of importing a `.usdm.json` or `.study.json` file into the catalog. */
type ClientImportStudyOutcome =
  | {
      readonly status: "ok";
      readonly format: "usdm" | "workspace";
      readonly record: StudyRepositoryRecord;
      readonly schemaIssues: readonly string[];
    }
  | {
      readonly status: "needs-selection";
      readonly pending: PendingStudySelectionImport;
    }
  | Exclude<
      ImportStudyRepositoryFileResult,
      { status: "ok" } | { status: "needs-selection" }
    >;

/** Deterministic server and pre-hydration snapshot. */
export const INITIAL_STUDY_REPOSITORY_SNAPSHOT: StudyRepositorySnapshot =
  Object.freeze({
    isHydrated: false,
    persistence: "indexeddb",
    hasIndexedDbApi: true,
    activeStudyId: null,
    activeRecord: null,
    studies: Object.freeze([]),
    lastRemoteEvent: null,
    remoteEventSeq: 0,
    quarantinedWorkspaceDraft: null,
  });

function sanitizeSlug(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/\.(study|usdm)\.json$/i, "")
    .replace(/\.json$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned.slice(0, 48) : "study";
}

function chooseUniqueStudyId(
  preferred: string,
  existingIds: ReadonlySet<string>,
  allowOverwriteNonReference = false
): string {
  const base = sanitizeSlug(preferred);
  if (!existingIds.has(base)) return base;
  if (allowOverwriteNonReference && !REFERENCE_IDS.has(base)) return base;
  let suffix = 2;
  while (existingIds.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

interface StudyRepositoryClientOptions {
  readonly indexedDB?: IDBFactory;
  readonly dbName?: string;
  readonly channelName?: string;
  readonly tabId?: string;
  readonly createChannel?: (name: string) => BroadcastChannelLike | null;
  readonly now?: () => string;
  readonly onVolatileMutation?: (draftBackedKey?: string) => void;
}

export interface StudyRepositoryClient {
  getSnapshot(): StudyRepositorySnapshot;
  hasSubscribers(): boolean;
  subscribe(listener: () => void): () => void;
  initialize(): Promise<StudyRepositorySnapshot>;
  whenIdle(): Promise<void>;
  getRecord(studyId: string): Promise<StudyRepositoryRecord | null>;
  selectStudy(studyId: string): Promise<StudyRepositoryRecord | null>;
  createBlankStudy(): Promise<StudyRepositoryRecord>;
  importFile(input: StudyRepositoryFileInput): Promise<ClientImportStudyOutcome>;
  confirmImportSelection(
    pending: PendingStudySelectionImport,
    selection: StudyWorkspaceSelection
  ): Promise<ClientImportStudyOutcome>;
  saveWorkspace(
    studyId: string,
    workspace: StudyWorkspace,
    options?: {
      readonly expectedRevisionId?: string;
      readonly force?: boolean;
      readonly pinActive?: boolean;
      readonly kind?: StudyRepositoryKind;
      readonly draftBackedKey?: string;
    }
  ): Promise<SaveStudyRepositoryOutcome>;
  reconcileAndSaveUsdm(
    studyId: string,
    incomingUsdm: UsdmV4Document,
    options: {
      readonly expectedRevisionId: string;
      readonly note: string;
      readonly force?: boolean;
      readonly skipIfUnchanged?: boolean;
      /** An editor already bound to a repository record must not recreate it on autosave. */
      readonly requireExisting?: boolean;
    }
  ): Promise<SaveStudyRepositoryOutcome>;
  deleteStudy(studyId: string): Promise<void>;
  exportCheckedUsdm(
    studyId: string
  ): Promise<
    | {
        readonly status: "ok";
        readonly fileName: string;
        readonly json: string;
        readonly sha256: string;
      }
    | {
        readonly status: "invalid";
        readonly studyId: string;
        readonly title: string;
        readonly issues: readonly string[];
      }
    | null
  >;
  exportWorkspaceSnapshot(
    studyId: string
  ): Promise<{ readonly fileName: string; readonly json: string } | null>;
  dismissQuarantinedDraft(): void;
  dispose(): void;
}

/** Creates an isolated or shared client coordinator for the study repository. */
export function createStudyRepositoryClient(
  options: StudyRepositoryClientOptions = {}
): StudyRepositoryClient {
  const now = options.now ?? (() => new Date().toISOString());
  const listeners = new Set<() => void>();
  const inFlightMutations = new Set<Promise<unknown>>();

  let store: StudyRepositoryStore | null = null;
  let sync: StudyRepositorySyncHandle | null = null;
  let unsubscribeSync: (() => void) | null = null;
  let initPromise: Promise<StudyRepositorySnapshot> | null = null;
  let snapshot: StudyRepositorySnapshot = INITIAL_STUDY_REPOSITORY_SNAPSHOT;

  const trackMutation = <T>(
    work: () => Promise<T>,
    draftBackedKey?: string
  ): Promise<T> => {
    const task = work().then((value) => {
      if (store?.persistence === "memory") {
        options.onVolatileMutation?.(draftBackedKey);
      }
      return value;
    });
    inFlightMutations.add(task);
    void task.finally(() => {
      inFlightMutations.delete(task);
    });
    return task;
  };

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const refreshFromStore = async (
    currentStore: StudyRepositoryStore,
    remoteEvent?: StudyRepositorySyncEvent
  ): Promise<StudyRepositorySnapshot> => {
    const records = await currentStore.list();
    let activeStudyId = await currentStore.getActiveStudyId();
    if (
      activeStudyId !== null &&
      !records.some((entry) => entry.studyId === activeStudyId)
    ) {
      activeStudyId = records[0]?.studyId ?? null;
      await currentStore.setActiveStudyId(activeStudyId);
    }
    const activeRecord =
      activeStudyId !== null
        ? (records.find((entry) => entry.studyId === activeStudyId) ?? null)
        : null;

    if (activeStudyId === DEMO_STUDY_ID) {
      writeSelectedStudy(DEMO_STUDY_ID);
    }

    snapshot = {
      isHydrated: true,
      persistence: currentStore.persistence,
      hasIndexedDbApi:
        options.indexedDB !== undefined || typeof indexedDB !== "undefined",
      activeStudyId,
      activeRecord,
      studies: records.map(summarizeStudyRepositoryRecord),
      lastRemoteEvent: remoteEvent ?? snapshot.lastRemoteEvent,
      remoteEventSeq: remoteEvent
        ? snapshot.remoteEventSeq + 1
        : snapshot.remoteEventSeq,
      quarantinedWorkspaceDraft: snapshot.quarantinedWorkspaceDraft,
    };
    notify();
    return snapshot;
  };

  const migrateLegacyDrafts = async (
    currentStore: StudyRepositoryStore
  ): Promise<QuarantinedStudyWorkspaceDraft | null> => {
    if (typeof window === "undefined") return null;

    let quarantined: QuarantinedStudyWorkspaceDraft | null = null;

    // 1. Migrate legacy Study Studio localStorage draft without deleting
    // quarantined entries (`study_workspace_draft_v1_quarantine`).
    if (currentStore.persistence === "indexeddb") {
      if (safeGetRawItem(STUDY_WORKSPACE_DRAFT_KEY) !== null) {
        const loaded = loadStudyWorkspaceDraft();
        if (loaded.status === "quarantined") {
          quarantined = loaded.entry;
        } else if (loaded.status === "recovered") {
          const existing = await currentStore.list();
          const existingIds = new Set(existing.map((r) => r.studyId));
          const sourceHint =
            typeof loaded.record.ui.source === "string"
              ? loaded.record.ui.source
              : null;
          const targetId =
            sourceHint === "tavr-savr" || sourceHint === "tavr-device"
              ? sourceHint
              : chooseUniqueStudyId(
                  loaded.record.workspace.usdm.study.name || "migrated-study",
                  existingIds
                );
          const meta = describeStudyWorkspace(loaded.record.workspace);
          const stamp = loaded.record.savedAt || now();
          await currentStore.put(
            {
              studyId: targetId,
              kind: REFERENCE_IDS.has(targetId) ? "reference" : "migrated",
              title: meta.title,
              protocolCode: meta.protocolCode,
              workspace: loaded.record.workspace,
              createdAt: stamp,
              updatedAt: stamp,
            },
            { force: true }
          );
          await currentStore.setActiveStudyId(targetId);
          discardStudyWorkspaceDraft();
        }
      }

      // 2. Migrate legacy CRF Studio localStorage draft without touching
      // `crf_studio_draft_v1_corrupt`.
      if (safeGetRawItem(CRF_LEGACY_DRAFT_KEY) !== null) {
        try {
          const { loadStudyDraft, exportStudyToUsdmObject } =
            await import("@/lib/crf");
          const crfDraft = loadStudyDraft();
          if (crfDraft.status === "recovered") {
            const usdm = exportStudyToUsdmObject(crfDraft.study);
            const imported = await importUsdmStudy(
              { document: usdm },
              { fileName: `${crfDraft.study.protocolNumber || "crf"}.usdm.json` }
            );
            if (imported.status === "ok") {
              const existing = await currentStore.list();
              const existingIds = new Set(existing.map((r) => r.studyId));
              const targetId = chooseUniqueStudyId(
                crfDraft.study.protocolNumber ||
                  crfDraft.study.title ||
                  crfDraft.study.id ||
                  "migrated-crf",
                existingIds
              );
              const meta = describeStudyWorkspace(imported.workspace);
              const stamp = crfDraft.savedAt || now();
              await currentStore.put(
                {
                  studyId: targetId,
                  kind: "migrated",
                  title: crfDraft.study.title || meta.title,
                  protocolCode:
                    crfDraft.study.protocolNumber || meta.protocolCode,
                  workspace: imported.workspace,
                  createdAt: stamp,
                  updatedAt: stamp,
                },
                { force: true }
              );
              const active = await currentStore.getActiveStudyId();
              if (!active) {
                await currentStore.setActiveStudyId(targetId);
              }
              safeRemoveItem(CRF_LEGACY_DRAFT_KEY);
            }
          }
        } catch {
          // Leave unreadable or unsupported legacy draft untouched.
        }
      }
    }

    return quarantined;
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
      void refreshFromStore(store, event);
    });
    await store.seedIfMissing(REFERENCE_STUDY_SEEDS);
    const quarantined = await migrateLegacyDrafts(store);
    if (quarantined) {
      snapshot = { ...snapshot, quarantinedWorkspaceDraft: quarantined };
    }
    return store;
  };

  const initialize = (): Promise<StudyRepositorySnapshot> => {
    if (!initPromise) {
      initPromise = ensureStore().then((readyStore) =>
        refreshFromStore(readyStore)
      );
    }
    return initPromise;
  };

  const storeImportedWorkspace = async (
    workspace: StudyWorkspace,
    format: "usdm" | "workspace",
    schemaIssues: readonly string[],
    fileName: string | null
  ): Promise<ClientImportStudyOutcome> => {
    const currentStore = await ensureStore();
    const existing = await currentStore.list();
    const existingIds = new Set(existing.map((entry) => entry.studyId));
    const meta = describeStudyWorkspace(workspace);
    const candidateName =
      fileName?.replace(/\.(study|usdm)\.json$/i, "") ||
      meta.protocolCode ||
      workspace.usdm.study.name;
    const studyId = chooseUniqueStudyId(
      candidateName,
      existingIds,
      format === "workspace"
    );
    const stamp = now();
    const previous = await currentStore.get(studyId);
    const record: StudyRepositoryRecord = {
      studyId,
      kind: "imported",
      title: meta.title,
      protocolCode: meta.protocolCode,
      workspace,
      createdAt: previous?.createdAt ?? stamp,
      updatedAt: stamp,
    };
    const saved = await currentStore.put(record, { force: true });
    await currentStore.setActiveStudyId(studyId);
    await refreshFromStore(currentStore);
    sync?.publish({
      type: "study-imported",
      studyId,
      revisionId: saved.workspace.revision.id,
      updatedAt: stamp,
    });
    return {
      status: "ok",
      format,
      record: saved,
      schemaIssues,
    };
  };

  return {
    getSnapshot(): StudyRepositorySnapshot {
      return snapshot;
    },

    hasSubscribers(): boolean {
      return listeners.size > 0;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    initialize,

    async whenIdle(): Promise<void> {
      while (inFlightMutations.size > 0) {
        await Promise.allSettled([...inFlightMutations]);
      }
    },

    async getRecord(studyId: string): Promise<StudyRepositoryRecord | null> {
      const currentStore = await ensureStore();
      return currentStore.get(studyId);
    },

    selectStudy(studyId: string): Promise<StudyRepositoryRecord | null> {
      return trackMutation(async () => {
        const currentStore = await ensureStore();
        const record = await currentStore.get(studyId);
        if (!record) return null;
        const stamp = now();
        await currentStore.setActiveStudyId(studyId);
        await refreshFromStore(currentStore);
        sync?.publish({
          type: "active-study-changed",
          studyId,
          updatedAt: stamp,
        });
        return record;
      });
    },

    createBlankStudy(): Promise<StudyRepositoryRecord> {
      return trackMutation(async () => {
        const currentStore = await ensureStore();
        const blank = await createBlankStudyWorkspace();
        const existing = await currentStore.list();
        const existingIds = new Set(existing.map((entry) => entry.studyId));
        const studyId = chooseUniqueStudyId("blank-study", existingIds);
        const meta = describeStudyWorkspace(blank.workspace);
        const stamp = now();
        const saved = await currentStore.put(
          {
            studyId,
            kind: "authored",
            title: meta.title,
            protocolCode: meta.protocolCode,
            workspace: blank.workspace,
            createdAt: stamp,
            updatedAt: stamp,
          },
          { force: true }
        );
        await currentStore.setActiveStudyId(studyId);
        await refreshFromStore(currentStore);
        sync?.publish({
          type: "study-imported",
          studyId,
          revisionId: saved.workspace.revision.id,
          updatedAt: stamp,
        });
        return saved;
      });
    },

    importFile(
      input: StudyRepositoryFileInput
    ): Promise<ClientImportStudyOutcome> {
      return trackMutation(async () => {
        await ensureStore();
        const result = await importStudyRepositoryFile(input);
        if (result.status === "needs-selection") {
          return {
            status: "needs-selection",
            pending: {
              choices: result.choices,
              document: result.document,
              fileName: result.fileName,
            },
          };
        }
        if (result.status !== "ok") {
          return result;
        }
        return storeImportedWorkspace(
          result.workspace,
          result.format,
          result.report?.schemaIssues ?? [],
          input.fileName ?? null
        );
      });
    },

    confirmImportSelection(
      pending: PendingStudySelectionImport,
      selection: StudyWorkspaceSelection
    ): Promise<ClientImportStudyOutcome> {
      return trackMutation(async () => {
        await ensureStore();
        const imported = await importUsdmStudy(
          { document: pending.document },
          {
            fileName: pending.fileName ?? undefined,
            selection,
          }
        );
        if (imported.status === "rejected") {
          return { status: "rejected", problems: imported.problems };
        }
        if (imported.status === "needs-selection") {
          return {
            status: "needs-selection",
            pending: {
              choices: imported.choices,
              document: pending.document,
              fileName: pending.fileName,
            },
          };
        }
        return storeImportedWorkspace(
          imported.workspace,
          "usdm",
          imported.report.schemaIssues,
          pending.fileName
        );
      });
    },

    saveWorkspace(
      studyId: string,
      workspace: StudyWorkspace,
      saveOptions = {}
    ): Promise<SaveStudyRepositoryOutcome> {
      return trackMutation(async () => {
        const currentStore = await ensureStore();
        const existing = await currentStore.get(studyId);
        const meta = describeStudyWorkspace(workspace);
        const stamp = now();
        const record: StudyRepositoryRecord = {
          studyId,
          kind:
            existing?.kind ??
            saveOptions.kind ??
            (REFERENCE_IDS.has(studyId) ? "reference" : "authored"),
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
          await refreshFromStore(currentStore);
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
            await refreshFromStore(currentStore);
            return {
              status: "conflict",
              expectedRevisionId: caught.expectedRevisionId,
              currentRevisionId: caught.currentRevisionId,
              latestRecord,
            };
          }
          throw caught;
        }
      }, saveOptions.draftBackedKey);
    },

    reconcileAndSaveUsdm(
      studyId: string,
      incomingUsdm: UsdmV4Document,
      reconcileOptions
    ): Promise<SaveStudyRepositoryOutcome> {
      return trackMutation(async () => {
        const currentStore = await ensureStore();
        let existing = await currentStore.get(studyId);
        if (!existing) {
          if (reconcileOptions.requireExisting && !reconcileOptions.force) {
            await refreshFromStore(currentStore);
            return {
              status: "conflict",
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
          await refreshFromStore(currentStore);
          return {
            status: "conflict",
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
            await refreshFromStore(currentStore);
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
      });
    },

    deleteStudy(studyId: string): Promise<void> {
      return trackMutation(async () => {
        const currentStore = await ensureStore();
        const wasActive = (await currentStore.getActiveStudyId()) === studyId;
        await currentStore.remove(studyId);
        if (REFERENCE_IDS.has(studyId)) {
          await currentStore.seedIfMissing(
            REFERENCE_STUDY_SEEDS.filter((seed) => seed.studyId === studyId)
          );
          if (wasActive) {
            await currentStore.setActiveStudyId(studyId);
          }
        } else if (wasActive) {
          await currentStore.setActiveStudyId(DEMO_STUDY_ID);
        }
        const nextSnap = await refreshFromStore(currentStore);
        sync?.publish({
          type: "study-deleted",
          studyId,
          nextActiveStudyId: nextSnap.activeStudyId,
          updatedAt: now(),
        });
      });
    },

    async exportCheckedUsdm(studyId: string) {
      const currentStore = await ensureStore();
      const record = await currentStore.get(studyId);
      if (!record) return null;
      const checked = await exportValidatedStudyUsdm(record.workspace);
      if (checked.status === "invalid") {
        return {
          status: "invalid" as const,
          studyId: record.studyId,
          title: record.title,
          issues: checked.issues,
        };
      }
      return {
        status: "ok" as const,
        fileName: `${sanitizeSlug(record.protocolCode || record.studyId)}.usdm.json`,
        json: checked.json,
        sha256: checked.sha256,
      };
    },

    async exportWorkspaceSnapshot(studyId: string) {
      const currentStore = await ensureStore();
      const record = await currentStore.get(studyId);
      if (!record) return null;
      return {
        fileName: `${sanitizeSlug(record.protocolCode || record.studyId)}.study.json`,
        json: serializeStudyWorkspace(record.workspace),
      };
    },

    dismissQuarantinedDraft(): void {
      if (!snapshot.quarantinedWorkspaceDraft) return;
      dismissQuarantinedStudyWorkspaceDraft(
        snapshot.quarantinedWorkspaceDraft.id
      );
      snapshot = { ...snapshot, quarantinedWorkspaceDraft: null };
      notify();
    },

    dispose(): void {
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

const VOLATILE_SESSION_KEY = "__clinical_study_repo_volatile_v1";
let sharedClient: StudyRepositoryClient | null = null;
let sharedVolatileToken: string | null = null;
const sharedVolatileDraftKeys = new Set<string>();

/** Returns the singleton browser study repository client for all clinical routes. */
export function getSharedStudyRepository(): StudyRepositoryClient {
  if (
    sharedClient !== null &&
    !sharedClient.hasSubscribers() &&
    typeof window !== "undefined" &&
    sharedClient.getSnapshot().persistence === "memory"
  ) {
    const tokenCleared =
      sharedVolatileToken !== null &&
      safeGetRawItem(VOLATILE_SESSION_KEY) !== sharedVolatileToken;
    const draftKeyCleared =
      sharedVolatileToken !== null &&
      sharedVolatileDraftKeys.size > 0 &&
      [...sharedVolatileDraftKeys].some((key) => safeGetRawItem(key) === null);
    if (tokenCleared || draftKeyCleared) {
      sharedClient.dispose();
      sharedClient = null;
      sharedVolatileToken = null;
      sharedVolatileDraftKeys.clear();
    }
  }
  sharedClient ??= createStudyRepositoryClient({
    onVolatileMutation: (draftBackedKey) => {
      if (typeof window === "undefined") return;
      if (sharedVolatileToken === null) {
        const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        if (
          safeSetRawItem(VOLATILE_SESSION_KEY, token, { retainInMemory: false })
        ) {
          sharedVolatileToken = token;
        }
      }
      if (sharedVolatileToken !== null && draftBackedKey) {
        sharedVolatileDraftKeys.add(draftBackedKey);
      }
    },
  });
  return sharedClient;
}
