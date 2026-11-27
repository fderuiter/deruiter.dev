/**
 * Browser IndexedDB persistence for the `/platform/sql` notebook workspace:
 * open tabs, saved named queries, timestamped execution logs and uploaded
 * local dataset blobs. Everything stays in the browser under a 50 MB cap
 * (ADR 0066), with per-dataset eviction and an automatic in-memory fallback
 * when IndexedDB is unavailable or blocked.
 */
import {
  MAX_WORKBENCH_STORAGE_BYTES,
  type WorkbenchExecutionLogEntry,
  type WorkbenchNamedQuery,
  type WorkbenchNotebookTab,
  type WorkbenchUploadedDataset,
} from "@/lib/clinical-platform";

/** Default IndexedDB database name for the SQL notebook workspace. */
export const WORKBENCH_NOTEBOOK_DB_NAME = "portfolio_sql_notebook";

const DB_VERSION = 1;
const META_STORE = "meta";
const DATASETS_STORE = "datasets";
const WORKSPACE_KEY = "workspace";

/** Storage backend serving the current notebook session. */
export type NotebookStorageBackend = "indexeddb" | "memory";

/** Persisted notebook metadata (tabs, saved queries and run history). */
export interface PersistedNotebookMeta {
  readonly activeTabId: string;
  readonly tabs: readonly WorkbenchNotebookTab[];
  readonly namedQueries: readonly WorkbenchNamedQuery[];
  readonly executionLog: readonly WorkbenchExecutionLogEntry[];
  readonly updatedAt: string;
}

/** Complete workspace snapshot hydrated at `/platform/sql` startup. */
export interface LoadedNotebookWorkspace {
  readonly meta: PersistedNotebookMeta | null;
  readonly datasets: readonly WorkbenchUploadedDataset[];
  readonly backend: NotebookStorageBackend;
  readonly bytesUsed: number;
  readonly maxBytes: number;
}

/** Outcome of writing notebook metadata or a dataset under the 50 MB cap. */
export type NotebookWriteResult =
  | {
      readonly ok: true;
      readonly backend: NotebookStorageBackend;
      readonly bytesUsed: number;
      readonly maxBytes: number;
    }
  | {
      readonly ok: false;
      readonly code: "QUOTA_EXCEEDED";
      readonly bytesUsed: number;
      readonly attemptedBytes: number;
      readonly maxBytes: number;
      readonly message: string;
    };

/** Client handle to the notebook's IndexedDB or in-memory store. */
export interface NotebookStorageClient {
  load(): Promise<LoadedNotebookWorkspace>;
  saveMeta(meta: PersistedNotebookMeta): Promise<NotebookWriteResult>;
  putDataset(dataset: WorkbenchUploadedDataset): Promise<NotebookWriteResult>;
  removeDataset(datasetId: string): Promise<{
    readonly backend: NotebookStorageBackend;
    readonly bytesUsed: number;
    readonly maxBytes: number;
  }>;
}

/** Options for customizing the IndexedDB factory or 50 MB quota in tests. */
export interface NotebookStorageOptions {
  readonly indexedDB?: IDBFactory | null;
  readonly dbName?: string;
  readonly maxBytes?: number;
}

const encoder = new TextEncoder();

function estimateMetaBytes(meta: PersistedNotebookMeta | null): number {
  if (!meta) return 0;
  return encoder.encode(JSON.stringify(meta)).byteLength;
}

function estimateDatasetBytes(dataset: WorkbenchUploadedDataset): number {
  return (
    dataset.bytes.byteLength +
    encoder.encode(
      JSON.stringify({
        id: dataset.id,
        tableName: dataset.tableName,
        fileName: dataset.fileName,
        format: dataset.format,
        rowCount: dataset.rowCount,
        uploadedAt: dataset.uploadedAt,
        columns: dataset.columns,
      })
    ).byteLength
  );
}

function totalWorkspaceBytes(
  meta: PersistedNotebookMeta | null,
  datasets: readonly WorkbenchUploadedDataset[]
): number {
  let total = estimateMetaBytes(meta);
  for (const ds of datasets) {
    total += estimateDatasetBytes(ds);
  }
  return total;
}

function quotaMessage(attempted: number, maxBytes: number): string {
  const mb = (attempted / (1024 * 1024)).toFixed(1);
  const capMb = (maxBytes / (1024 * 1024)).toFixed(0);
  return `Workspace storage would reach ${mb} MB, exceeding the ${capMb} MB browser limit. Remove an uploaded dataset and try again.`;
}

function cloneDataset(
  dataset: WorkbenchUploadedDataset
): WorkbenchUploadedDataset {
  const bytes =
    dataset.bytes instanceof Uint8Array
      ? dataset.bytes.slice()
      : new Uint8Array(dataset.bytes as ArrayBufferLike).slice();
  return {
    ...dataset,
    columns: dataset.columns.map((c) => ({ ...c })),
    byteLength: bytes.byteLength,
    bytes,
  };
}

function cloneMeta(meta: PersistedNotebookMeta): PersistedNotebookMeta {
  return {
    activeTabId: meta.activeTabId,
    updatedAt: meta.updatedAt,
    tabs: meta.tabs.map((t) => ({ ...t })),
    namedQueries: meta.namedQueries.map((q) => ({ ...q })),
    executionLog: meta.executionLog.map((e) => ({ ...e })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeStoredMeta(raw: unknown): PersistedNotebookMeta | null {
  if (!isRecord(raw) || !Array.isArray(raw.tabs) || raw.tabs.length === 0) {
    return null;
  }
  const tabs: WorkbenchNotebookTab[] = [];
  for (const item of raw.tabs) {
    if (
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.title === "string" &&
      typeof item.sql === "string"
    ) {
      tabs.push({
        id: item.id,
        title: item.title,
        sql: item.sql,
        selectedQueryId:
          typeof item.selectedQueryId === "string" ? item.selectedQueryId : "",
        edited: Boolean(item.edited),
        updatedAt:
          typeof item.updatedAt === "string"
            ? item.updatedAt
            : new Date().toISOString(),
      });
    }
  }
  if (tabs.length === 0) return null;

  const namedQueries: WorkbenchNamedQuery[] = [];
  if (Array.isArray(raw.namedQueries)) {
    for (const q of raw.namedQueries) {
      if (
        isRecord(q) &&
        typeof q.id === "string" &&
        typeof q.title === "string" &&
        typeof q.sql === "string"
      ) {
        namedQueries.push({
          id: q.id,
          title: q.title,
          sql: q.sql,
          savedAt:
            typeof q.savedAt === "string"
              ? q.savedAt
              : new Date().toISOString(),
        });
      }
    }
  }

  const executionLog: WorkbenchExecutionLogEntry[] = [];
  if (Array.isArray(raw.executionLog)) {
    for (const entry of raw.executionLog) {
      if (
        isRecord(entry) &&
        typeof entry.id === "string" &&
        typeof entry.ranAt === "string" &&
        typeof entry.sql === "string" &&
        typeof entry.status === "string"
      ) {
        executionLog.push({
          id: entry.id,
          ranAt: entry.ranAt,
          tabId: typeof entry.tabId === "string" ? entry.tabId : tabs[0].id,
          tabTitle:
            typeof entry.tabTitle === "string" ? entry.tabTitle : tabs[0].title,
          mode: entry.mode === "explain" ? "explain" : "run",
          sql: entry.sql,
          status: entry.status as WorkbenchExecutionLogEntry["status"],
          rowCount: typeof entry.rowCount === "number" ? entry.rowCount : null,
          elapsedMs: typeof entry.elapsedMs === "number" ? entry.elapsedMs : 0,
          message: typeof entry.message === "string" ? entry.message : null,
        });
      }
    }
  }

  const activeTabId =
    typeof raw.activeTabId === "string" &&
    tabs.some((t) => t.id === raw.activeTabId)
      ? raw.activeTabId
      : tabs[0].id;

  return {
    activeTabId,
    tabs,
    namedQueries,
    executionLog,
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

function sanitizeStoredDataset(raw: unknown): WorkbenchUploadedDataset | null {
  if (!isRecord(raw)) return null;
  if (
    typeof raw.id !== "string" ||
    typeof raw.tableName !== "string" ||
    typeof raw.qualifiedName !== "string" ||
    typeof raw.fileName !== "string" ||
    (raw.format !== "csv" &&
      raw.format !== "json" &&
      raw.format !== "parquet") ||
    typeof raw.rowCount !== "number" ||
    !Array.isArray(raw.columns)
  ) {
    return null;
  }
  let bytes: Uint8Array;
  if (raw.bytes instanceof Uint8Array) {
    bytes = raw.bytes.slice();
  } else if (raw.bytes instanceof ArrayBuffer) {
    bytes = new Uint8Array(raw.bytes).slice();
  } else if (ArrayBuffer.isView(raw.bytes)) {
    bytes = new Uint8Array(
      raw.bytes.buffer,
      raw.bytes.byteOffset,
      raw.bytes.byteLength
    ).slice();
  } else {
    return null;
  }

  return {
    id: raw.id,
    tableName: raw.tableName,
    qualifiedName: raw.qualifiedName,
    fileName: raw.fileName,
    format: raw.format,
    rowCount: raw.rowCount,
    byteLength: bytes.byteLength,
    uploadedAt:
      typeof raw.uploadedAt === "string"
        ? raw.uploadedAt
        : new Date().toISOString(),
    columns: raw.columns
      .filter(
        (
          c
        ): c is {
          name: string;
          type: WorkbenchUploadedDataset["columns"][number]["type"];
          nullable: boolean;
        } =>
          isRecord(c) &&
          typeof c.name === "string" &&
          typeof c.type === "string"
      )
      .map((c) => ({
        name: c.name,
        type: c.type,
        nullable: Boolean(c.nullable),
      })),
    bytes,
  };
}

function resolveIdb(options: NotebookStorageOptions): IDBFactory | undefined {
  if ("indexedDB" in options) {
    return options.indexedDB ?? undefined;
  }
  return typeof indexedDB === "undefined" ? undefined : indexedDB;
}

function openDatabase(
  factory: IDBFactory,
  dbName: string
): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(dbName, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
      if (!db.objectStoreNames.contains(DATASETS_STORE)) {
        db.createObjectStore(DATASETS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function readAllFromDb(db: IDBDatabase): Promise<{
  meta: PersistedNotebookMeta | null;
  datasets: WorkbenchUploadedDataset[];
} | null> {
  return new Promise((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction([META_STORE, DATASETS_STORE], "readonly");
    } catch {
      resolve(null);
      return;
    }
    let rawMeta: unknown = null;
    let rawDatasets: unknown[] = [];

    const metaReq = tx.objectStore(META_STORE).get(WORKSPACE_KEY);
    metaReq.onsuccess = () => {
      rawMeta = metaReq.result;
    };
    const dsReq = tx.objectStore(DATASETS_STORE).getAll();
    dsReq.onsuccess = () => {
      rawDatasets = Array.isArray(dsReq.result) ? dsReq.result : [];
    };

    tx.oncomplete = () => {
      const meta = sanitizeStoredMeta(rawMeta);
      const datasets = rawDatasets
        .map(sanitizeStoredDataset)
        .filter((d): d is WorkbenchUploadedDataset => d !== null)
        .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
      resolve({ meta, datasets });
    };
    tx.onerror = () => resolve(null);
    tx.onabort = () => resolve(null);
  });
}

/**
 * Creates a storage client backed by IndexedDB under a 50 MB workspace ceiling,
 * with automatic fallback to an in-memory store when IndexedDB is unavailable
 * or blocked.
 */
export function createNotebookStorage(
  options: NotebookStorageOptions = {}
): NotebookStorageClient {
  const maxBytes = options.maxBytes ?? MAX_WORKBENCH_STORAGE_BYTES;
  const dbName = options.dbName ?? WORKBENCH_NOTEBOOK_DB_NAME;

  let memMeta: PersistedNotebookMeta | null = null;
  const memDatasets = new Map<string, WorkbenchUploadedDataset>();
  let opQueue: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = opQueue.then(fn, fn);
    opQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };

  const memorySnapshot = (): LoadedNotebookWorkspace => {
    const datasets = [...memDatasets.values()].map(cloneDataset);
    const meta = memMeta ? cloneMeta(memMeta) : null;
    return {
      meta,
      datasets,
      backend: "memory",
      bytesUsed: totalWorkspaceBytes(meta, datasets),
      maxBytes,
    };
  };

  return {
    load() {
      return enqueue(async () => {
        const factory = resolveIdb(options);
        if (!factory) return memorySnapshot();
        const db = await openDatabase(factory, dbName);
        if (!db) return memorySnapshot();
        try {
          const loaded = await readAllFromDb(db);
          if (!loaded) return memorySnapshot();
          memMeta = loaded.meta ? cloneMeta(loaded.meta) : null;
          memDatasets.clear();
          for (const ds of loaded.datasets) {
            memDatasets.set(ds.id, cloneDataset(ds));
          }
          return {
            meta: loaded.meta,
            datasets: loaded.datasets,
            backend: "indexeddb",
            bytesUsed: totalWorkspaceBytes(loaded.meta, loaded.datasets),
            maxBytes,
          };
        } finally {
          db.close();
        }
      });
    },

    saveMeta(meta) {
      return enqueue(async () => {
        const nextMeta = cloneMeta(meta);
        const factory = resolveIdb(options);
        if (!factory) {
          const currentDatasets = [...memDatasets.values()];
          const currentUsed = totalWorkspaceBytes(memMeta, currentDatasets);
          const attempted = totalWorkspaceBytes(nextMeta, currentDatasets);
          if (attempted > maxBytes) {
            return {
              ok: false,
              code: "QUOTA_EXCEEDED",
              bytesUsed: currentUsed,
              attemptedBytes: attempted,
              maxBytes,
              message: quotaMessage(attempted, maxBytes),
            };
          }
          memMeta = nextMeta;
          return {
            ok: true,
            backend: "memory",
            bytesUsed: attempted,
            maxBytes,
          };
        }

        const db = await openDatabase(factory, dbName);
        if (!db) {
          const currentDatasets = [...memDatasets.values()];
          const currentUsed = totalWorkspaceBytes(memMeta, currentDatasets);
          const attempted = totalWorkspaceBytes(nextMeta, currentDatasets);
          if (attempted > maxBytes) {
            return {
              ok: false,
              code: "QUOTA_EXCEEDED",
              bytesUsed: currentUsed,
              attemptedBytes: attempted,
              maxBytes,
              message: quotaMessage(attempted, maxBytes),
            };
          }
          memMeta = nextMeta;
          return {
            ok: true,
            backend: "memory",
            bytesUsed: attempted,
            maxBytes,
          };
        }

        try {
          const existing = await readAllFromDb(db);
          const datasets = existing?.datasets ?? [...memDatasets.values()];
          const currentUsed = totalWorkspaceBytes(
            existing?.meta ?? memMeta,
            datasets
          );
          const attempted = totalWorkspaceBytes(nextMeta, datasets);
          if (attempted > maxBytes) {
            return {
              ok: false,
              code: "QUOTA_EXCEEDED",
              bytesUsed: currentUsed,
              attemptedBytes: attempted,
              maxBytes,
              message: quotaMessage(attempted, maxBytes),
            };
          }
          const wrote = await new Promise<boolean>((resolve) => {
            try {
              const tx = db.transaction(META_STORE, "readwrite");
              tx.objectStore(META_STORE).put(nextMeta, WORKSPACE_KEY);
              tx.oncomplete = () => resolve(true);
              tx.onerror = () => resolve(false);
              tx.onabort = () => resolve(false);
            } catch {
              resolve(false);
            }
          });
          memMeta = nextMeta;
          return {
            ok: true,
            backend: wrote ? "indexeddb" : "memory",
            bytesUsed: attempted,
            maxBytes,
          };
        } finally {
          db.close();
        }
      });
    },

    putDataset(dataset) {
      return enqueue(async () => {
        const nextDs = cloneDataset(dataset);
        const factory = resolveIdb(options);

        const writeMemory = (): NotebookWriteResult => {
          const existingList = [...memDatasets.values()];
          const currentUsed = totalWorkspaceBytes(memMeta, existingList);
          const filtered = existingList.filter(
            (d) => d.id !== nextDs.id && d.tableName !== nextDs.tableName
          );
          const nextList = [...filtered, nextDs];
          const attempted = totalWorkspaceBytes(memMeta, nextList);
          if (attempted > maxBytes) {
            return {
              ok: false,
              code: "QUOTA_EXCEEDED",
              bytesUsed: currentUsed,
              attemptedBytes: attempted,
              maxBytes,
              message: quotaMessage(attempted, maxBytes),
            };
          }
          for (const d of existingList) {
            if (d.tableName === nextDs.tableName && d.id !== nextDs.id) {
              memDatasets.delete(d.id);
            }
          }
          memDatasets.set(nextDs.id, nextDs);
          return {
            ok: true,
            backend: "memory",
            bytesUsed: attempted,
            maxBytes,
          };
        };

        if (!factory) return writeMemory();
        const db = await openDatabase(factory, dbName);
        if (!db) return writeMemory();

        try {
          const existing = await readAllFromDb(db);
          const meta = existing?.meta ?? memMeta;
          const currentList = existing?.datasets ?? [...memDatasets.values()];
          const currentUsed = totalWorkspaceBytes(meta, currentList);
          const replacedIds = currentList
            .filter(
              (d) => d.tableName === nextDs.tableName && d.id !== nextDs.id
            )
            .map((d) => d.id);
          const nextList = [
            ...currentList.filter(
              (d) => d.id !== nextDs.id && d.tableName !== nextDs.tableName
            ),
            nextDs,
          ];
          const attempted = totalWorkspaceBytes(meta, nextList);
          if (attempted > maxBytes) {
            return {
              ok: false,
              code: "QUOTA_EXCEEDED",
              bytesUsed: currentUsed,
              attemptedBytes: attempted,
              maxBytes,
              message: quotaMessage(attempted, maxBytes),
            };
          }

          const wrote = await new Promise<boolean>((resolve) => {
            try {
              const tx = db.transaction(DATASETS_STORE, "readwrite");
              const store = tx.objectStore(DATASETS_STORE);
              for (const oldId of replacedIds) store.delete(oldId);
              store.put(nextDs);
              tx.oncomplete = () => resolve(true);
              tx.onerror = () => resolve(false);
              tx.onabort = () => resolve(false);
            } catch {
              resolve(false);
            }
          });

          for (const oldId of replacedIds) memDatasets.delete(oldId);
          memDatasets.set(nextDs.id, nextDs);
          return {
            ok: true,
            backend: wrote ? "indexeddb" : "memory",
            bytesUsed: attempted,
            maxBytes,
          };
        } finally {
          db.close();
        }
      });
    },

    removeDataset(datasetId) {
      return enqueue(async () => {
        memDatasets.delete(datasetId);
        const factory = resolveIdb(options);
        if (!factory) {
          const remaining = [...memDatasets.values()];
          return {
            backend: "memory",
            bytesUsed: totalWorkspaceBytes(memMeta, remaining),
            maxBytes,
          };
        }
        const db = await openDatabase(factory, dbName);
        if (!db) {
          const remaining = [...memDatasets.values()];
          return {
            backend: "memory",
            bytesUsed: totalWorkspaceBytes(memMeta, remaining),
            maxBytes,
          };
        }
        try {
          const deleted = await new Promise<boolean>((resolve) => {
            try {
              const tx = db.transaction(DATASETS_STORE, "readwrite");
              tx.objectStore(DATASETS_STORE).delete(datasetId);
              tx.oncomplete = () => resolve(true);
              tx.onerror = () => resolve(false);
              tx.onabort = () => resolve(false);
            } catch {
              resolve(false);
            }
          });
          const after = await readAllFromDb(db);
          const meta = after?.meta ?? memMeta;
          const datasets = after?.datasets ?? [...memDatasets.values()];
          return {
            backend: deleted ? "indexeddb" : "memory",
            bytesUsed: totalWorkspaceBytes(meta, datasets),
            maxBytes,
          };
        } finally {
          db.close();
        }
      });
    },
  };
}
