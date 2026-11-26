import type {
  OpenStudyRepositoryStoreResult,
  StudyRepositoryRecord,
  StudyRepositorySaveOptions,
  StudyRepositorySeed,
  StudyRepositoryStore,
  StudyRepositoryStoreErrorCode,
} from "../types";
import { buildSeedRepositoryRecord } from "./repository-meta";
import { StudyWorkspaceConflictError } from "./revision";

/** Default IndexedDB database name for the shared clinical study repository. */
export const STUDY_REPOSITORY_DB_NAME = "clinical_study_repository";

/** Schema version of the IndexedDB clinical study repository. */
export const STUDY_REPOSITORY_DB_VERSION = 1;

const STUDIES_STORE = "studies";
const META_STORE = "meta";
const ACTIVE_STUDY_KEY = "activeStudyId";

/** Stable error thrown when an IndexedDB study repository transaction fails. */
export class StudyRepositoryStoreError extends Error {
  readonly code: StudyRepositoryStoreErrorCode;

  constructor(code: StudyRepositoryStoreErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "StudyRepositoryStoreError";
    this.code = code;
  }
}

function mapTransactionError(
  error: DOMException | Error | null
): StudyRepositoryStoreError {
  const code: StudyRepositoryStoreErrorCode =
    error?.name === "QuotaExceededError"
      ? "QUOTA_EXCEEDED"
      : "TRANSACTION_ABORTED";
  return new StudyRepositoryStoreError(code, error?.message);
}

function sortRecords(
  records: StudyRepositoryRecord[]
): readonly StudyRepositoryRecord[] {
  const kindRank: Record<StudyRepositoryRecord["kind"], number> = {
    reference: 0,
    migrated: 1,
    imported: 2,
    authored: 3,
  };
  return [...records].sort((a, b) => {
    const rankDiff = kindRank[a.kind] - kindRank[b.kind];
    if (rankDiff !== 0) return rankDiff;
    if (a.createdAt !== b.createdAt) {
      return a.createdAt.localeCompare(b.createdAt);
    }
    return a.studyId.localeCompare(b.studyId);
  });
}

function createIdbRepositoryStore(db: IDBDatabase): StudyRepositoryStore {
  return {
    persistence: "indexeddb",

    list(): Promise<readonly StudyRepositoryRecord[]> {
      return new Promise((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = db.transaction(STUDIES_STORE, "readonly");
        } catch (caught) {
          reject(
            mapTransactionError(caught instanceof Error ? caught : null)
          );
          return;
        }
        const request = tx.objectStore(STUDIES_STORE).getAll();
        let rows: StudyRepositoryRecord[] = [];
        request.onsuccess = () => {
          rows = Array.isArray(request.result)
            ? (request.result as StudyRepositoryRecord[]).map((entry) =>
                structuredClone(entry)
              )
            : [];
        };
        tx.oncomplete = () => resolve(sortRecords(rows));
        tx.onerror = () => reject(mapTransactionError(tx.error));
        tx.onabort = () => reject(mapTransactionError(tx.error));
      });
    },

    get(studyId: string): Promise<StudyRepositoryRecord | null> {
      return new Promise((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = db.transaction(STUDIES_STORE, "readonly");
        } catch (caught) {
          reject(
            mapTransactionError(caught instanceof Error ? caught : null)
          );
          return;
        }
        const request = tx.objectStore(STUDIES_STORE).get(studyId);
        let found: StudyRepositoryRecord | null = null;
        request.onsuccess = () => {
          found = request.result
            ? structuredClone(request.result as StudyRepositoryRecord)
            : null;
        };
        tx.oncomplete = () => resolve(found);
        tx.onerror = () => reject(mapTransactionError(tx.error));
        tx.onabort = () => reject(mapTransactionError(tx.error));
      });
    },

    put(
      record: StudyRepositoryRecord,
      options: StudyRepositorySaveOptions = {}
    ): Promise<StudyRepositoryRecord> {
      const copy = structuredClone(record);
      return new Promise((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = db.transaction(STUDIES_STORE, "readwrite");
        } catch (caught) {
          reject(
            mapTransactionError(caught instanceof Error ? caught : null)
          );
          return;
        }
        const store = tx.objectStore(STUDIES_STORE);
        let conflict: StudyWorkspaceConflictError | null = null;
        const readReq = store.get(copy.studyId);
        readReq.onsuccess = () => {
          const existing = readReq.result as StudyRepositoryRecord | undefined;
          if (
            existing &&
            !options.force &&
            options.expectedRevisionId !== undefined &&
            existing.workspace.revision.id !== options.expectedRevisionId
          ) {
            conflict = new StudyWorkspaceConflictError(
              options.expectedRevisionId,
              existing.workspace.revision.id
            );
            tx.abort();
            return;
          }
          store.put(copy);
        };
        tx.oncomplete = () => resolve(structuredClone(copy));
        tx.onerror = () => {
          if (conflict) {
            reject(conflict);
            return;
          }
          reject(mapTransactionError(tx.error));
        };
        tx.onabort = () => {
          if (conflict) {
            reject(conflict);
            return;
          }
          reject(mapTransactionError(tx.error));
        };
      });
    },

    async seedIfMissing(seeds: readonly StudyRepositorySeed[]): Promise<void> {
      if (seeds.length === 0) return;
      const existing = await this.list();
      const existingIds = new Set(existing.map((entry) => entry.studyId));
      const missingSeeds = seeds.filter(
        (seed) => !existingIds.has(seed.studyId)
      );
      if (missingSeeds.length === 0) return;

      const built: StudyRepositoryRecord[] = [];
      for (let index = 0; index < missingSeeds.length; index += 1) {
        const stamp = new Date(
          Date.UTC(2026, 0, 1, 0, 0, index)
        ).toISOString();
        built.push(await buildSeedRepositoryRecord(missingSeeds[index], stamp));
      }

      await new Promise<void>((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = db.transaction(STUDIES_STORE, "readwrite");
        } catch (caught) {
          reject(
            mapTransactionError(caught instanceof Error ? caught : null)
          );
          return;
        }
        const store = tx.objectStore(STUDIES_STORE);
        for (const item of built) {
          const check = store.get(item.studyId);
          check.onsuccess = () => {
            if (!check.result) {
              store.put(item);
            }
          };
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(mapTransactionError(tx.error));
        tx.onabort = () => reject(mapTransactionError(tx.error));
      });
    },

    remove(studyId: string): Promise<void> {
      return new Promise((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = db.transaction([STUDIES_STORE, META_STORE], "readwrite");
        } catch (caught) {
          reject(
            mapTransactionError(caught instanceof Error ? caught : null)
          );
          return;
        }
        tx.objectStore(STUDIES_STORE).delete(studyId);
        const meta = tx.objectStore(META_STORE);
        const activeReq = meta.get(ACTIVE_STUDY_KEY);
        activeReq.onsuccess = () => {
          if (activeReq.result === studyId) {
            meta.delete(ACTIVE_STUDY_KEY);
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(mapTransactionError(tx.error));
        tx.onabort = () => reject(mapTransactionError(tx.error));
      });
    },

    async getActiveStudyId(): Promise<string | null> {
      const value = await this.getMeta(ACTIVE_STUDY_KEY);
      return typeof value === "string" && value.length > 0 ? value : null;
    },

    async setActiveStudyId(studyId: string | null): Promise<void> {
      await this.setMeta(ACTIVE_STUDY_KEY, studyId);
    },

    getMeta(key: string): Promise<unknown> {
      return new Promise((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = db.transaction(META_STORE, "readonly");
        } catch (caught) {
          reject(
            mapTransactionError(caught instanceof Error ? caught : null)
          );
          return;
        }
        const req = tx.objectStore(META_STORE).get(key);
        let result: unknown;
        req.onsuccess = () => {
          result =
            req.result === undefined ? undefined : structuredClone(req.result);
        };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(mapTransactionError(tx.error));
        tx.onabort = () => reject(mapTransactionError(tx.error));
      });
    },

    setMeta(key: string, value: unknown): Promise<void> {
      return new Promise((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = db.transaction(META_STORE, "readwrite");
        } catch (caught) {
          reject(
            mapTransactionError(caught instanceof Error ? caught : null)
          );
          return;
        }
        const store = tx.objectStore(META_STORE);
        if (value === null || value === undefined) {
          store.delete(key);
        } else {
          store.put(structuredClone(value), key);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(mapTransactionError(tx.error));
        tx.onabort = () => reject(mapTransactionError(tx.error));
      });
    },

    close(): void {
      try {
        db.close();
      } catch {
        // Ignore close errors on already-closed connections.
      }
    },
  };
}

/**
 * Opens the IndexedDB study repository store, creating its object stores on
 * first use. Resolves with `{ ok: false, code: "STORE_UNAVAILABLE" }` when
 * IndexedDB is absent or blocked (e.g. private browsing restrictions).
 */
export function openStudyRepositoryStore(
  options: { readonly indexedDB?: IDBFactory; readonly name?: string } = {}
): Promise<OpenStudyRepositoryStoreResult> {
  const factory =
    options.indexedDB ??
    (typeof indexedDB === "undefined" ? undefined : indexedDB);
  if (!factory) {
    return Promise.resolve({ ok: false, code: "STORE_UNAVAILABLE" });
  }
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(
        options.name ?? STUDY_REPOSITORY_DB_NAME,
        STUDY_REPOSITORY_DB_VERSION
      );
    } catch {
      resolve({ ok: false, code: "STORE_UNAVAILABLE" });
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STUDIES_STORE)) {
        db.createObjectStore(STUDIES_STORE, { keyPath: "studyId" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };
    request.onsuccess = () =>
      resolve({ ok: true, store: createIdbRepositoryStore(request.result) });
    request.onerror = () => resolve({ ok: false, code: "STORE_UNAVAILABLE" });
    request.onblocked = () =>
      resolve({ ok: false, code: "STORE_UNAVAILABLE" });
  });
}
