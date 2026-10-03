// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAutosave,
  readAutosave,
  writeAutosave,
} from "@/components/protocol-drift/persistence";
import type { ProtocolDriftSaveFile } from "@/lib/protocol-drift";
import { ok, startEngine } from "./helpers";

function makeSave(): ProtocolDriftSaveFile {
  const event = ok(startEngine(), {
    type: "EXPORT_SAVE",
    savedAt: "2026-01-01T00:00:00Z",
  }).find((e) => e.type === "SAVE_EXPORTED");
  if (!event || event.type !== "SAVE_EXPORTED") throw new Error("no save");
  return event.save;
}

/** A tiny IndexedDB stand-in: one database, one object store. */
function fakeIndexedDb() {
  const rows = new Map<string, unknown>();
  const request = <T>(run: () => T) => {
    const req: { result?: T; onsuccess?: () => void; onerror?: () => void } =
      {};
    queueMicrotask(() => {
      req.result = run();
      req.onsuccess?.();
    });
    return req;
  };
  const store = {
    put: (value: unknown, key: string) =>
      request(() => (rows.set(key, value), key)),
    get: (key: string) => request(() => rows.get(key)),
    delete: (key: string) => request(() => (rows.delete(key), undefined)),
  };
  const db = {
    createObjectStore: vi.fn(),
    transaction: () => ({ objectStore: () => store }),
    close: vi.fn(),
  };
  const open = vi.fn(() => {
    const req: {
      result: typeof db;
      onupgradeneeded?: () => void;
      onsuccess?: () => void;
    } = { result: db };
    queueMicrotask(() => {
      req.onupgradeneeded?.();
      req.onsuccess?.();
    });
    return req;
  });
  return { open, rows };
}

describe("IndexedDB autosave (protocol_drift_saves)", () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    await clearAutosave();
  });

  it("falls back to memory when IndexedDB does not exist (SSR, tests)", async () => {
    const save = makeSave();
    expect(await writeAutosave(save)).toBe("memory");
    expect(await readAutosave()).toEqual(save);
    await clearAutosave();
    expect(await readAutosave()).toBeNull();
  });

  it("falls back to memory when opening the database throws", async () => {
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new Error("blocked");
      },
    });
    const save = makeSave();
    expect(await writeAutosave(save)).toBe("memory");
    expect(await readAutosave()).toEqual(save);
  });

  it("stores the autosave in the protocol_drift_saves database", async () => {
    const idb = fakeIndexedDb();
    vi.stubGlobal("indexedDB", idb);
    const save = makeSave();
    expect(await writeAutosave(save)).toBe("indexeddb");
    expect(idb.open).toHaveBeenCalledWith("protocol_drift_saves", 1);
    expect(idb.rows.get("autosave")).toEqual(save);
    expect(await readAutosave()).toEqual(save);
    await clearAutosave();
    expect(idb.rows.has("autosave")).toBe(false);
  });
});
