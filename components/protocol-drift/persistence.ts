/**
 * Tier 1 persistence: an IndexedDB autosave (`protocol_drift_saves`) with an
 * in-memory fallback for SSR, private windows and test harnesses. Every
 * access is wrapped so a blocked or missing database never reaches the UI.
 */
import type { ProtocolDriftSaveFile } from "@/lib/protocol-drift";

const DB_NAME = "protocol_drift_saves";
const STORE = "saves";
const SLOT = "autosave";

const memory = new Map<string, ProtocolDriftSaveFile>();

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function run<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

/** Writes the autosave slot; resolves to where it landed. */
export async function writeAutosave(
  save: ProtocolDriftSaveFile
): Promise<"indexeddb" | "memory"> {
  memory.set(SLOT, save);
  const db = await openDb();
  if (!db) return "memory";
  try {
    const stored = await run(db, "readwrite", (store) => store.put(save, SLOT));
    return stored === undefined ? "memory" : "indexeddb";
  } finally {
    db.close();
  }
}

/** Reads the autosave slot, or null when nothing was saved. */
export async function readAutosave(): Promise<ProtocolDriftSaveFile | null> {
  const db = await openDb();
  if (db) {
    try {
      const stored = await run<unknown>(db, "readonly", (store) =>
        store.get(SLOT)
      );
      if (stored && typeof stored === "object") {
        return stored as ProtocolDriftSaveFile;
      }
    } finally {
      db.close();
    }
  }
  return memory.get(SLOT) ?? null;
}

/** Removes the autosave slot. */
export async function clearAutosave(): Promise<void> {
  memory.delete(SLOT);
  const db = await openDb();
  if (!db) return;
  try {
    await run(db, "readwrite", (store) => store.delete(SLOT));
  } finally {
    db.close();
  }
}
