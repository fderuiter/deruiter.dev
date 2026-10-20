/**
 * One localStorage key behind a typed get/set/subscribe (#2371). Every arcade
 * store and progress slice is built on this, so all of them share one write
 * path, one change event and one rule for damaged values.
 */

import {
  safeGetRawItem,
  safeIsAvailable,
  safeRemoveItem,
  safeSetRawItem,
} from "@/lib/safe-storage";
import { emitAppEvent, onAppEvent } from "@/lib/event-bus";
import { logger } from "@/lib/logger";
import { useArcadeStoreValue } from "./react";

/**
 * The event every store fires after a write, in this tab. Other tabs hear
 * the same write through the browser's own `storage` event.
 */
export const ARCADE_PROGRESS_CHANGED_EVENT = "arcade_progress_changed";

/** Suffix of the key a damaged value is set aside under. */
export const ARCADE_CORRUPT_SUFFIX = ":corrupt";

/** How a store turns its stored text into a value and back. */
export interface ArcadeStoreOptions<T> {
  /**
   * Reads the stored text. Throw when the text is not a value of this
   * store: the text is then set aside under `<key>:corrupt` and the store
   * reads `fallback`.
   */
  parse: (raw: string) => T;
  /** Writes a value as the exact text to store. */
  serialize: (value: T) => string;
  /**
   * What the store reads when nothing is stored, the stored text is
   * damaged, or the page is rendered on the server. Keep it one constant
   * value: React compares snapshots by identity.
   */
  fallback: T;
  /**
   * Whether a write that cannot reach localStorage is kept in memory for
   * the rest of the page (default true). Pass false for a store whose
   * readers should see only what localStorage holds.
   */
  retainInMemory?: boolean;
  /**
   * A one-time upgrade run when the store is settled. Given the current
   * value and whether anything was stored, it returns the value to write,
   * or null when there is nothing to do. It must return null once its own
   * result is stored, or it would write on every settle.
   */
  upgrade?: (value: T, stored: boolean) => T | null;
}

/** A typed view of one localStorage key. */
export interface ArcadeStore<T> {
  /** The storage key, unchanged from what the game stored before. */
  readonly key: string;
  /** The value read when nothing usable is stored. */
  readonly fallback: T;
  /**
   * The current value. Pure: it never writes, so it is safe in a render or
   * a `useSyncExternalStore` snapshot, and it returns the same object while
   * the stored text is unchanged.
   */
  get(): T;
  /**
   * Stores a value and tells this tab's subscribers. Returns true when the
   * value reached localStorage. A damaged stored value is set aside first,
   * never overwritten.
   */
  set(value: T): boolean;
  /**
   * Calls `onChange` after a write to this key in this tab or another one.
   * Returns the function that stops listening.
   */
  subscribe(onChange: () => void): () => void;
  /**
   * Sets a damaged stored value aside and runs the store's upgrade, then
   * returns the current value. Writes, so call it from an event handler or
   * an effect, not while rendering.
   */
  settle(): T;
  /**
   * The current value in a React component, kept up to date across tabs.
   * The server render and the first client render read `fallback`.
   */
  useValue(): T;
}

/** A damaged stored value the player should hear about once. */
export interface ArcadeProgressNotice {
  /** The key whose value could not be read. */
  readonly key: string;
  /** Where the damaged text was kept, or null when it could not be. */
  readonly corruptKey: string | null;
}

type NoticeListener = (notice: ArcadeProgressNotice) => void;

const noticeListeners = new Set<NoticeListener>();
const pendingNotices: ArcadeProgressNotice[] = [];
const noticedKeys = new Set<string>();

function announceCorrupt(notice: ArcadeProgressNotice): void {
  if (noticedKeys.has(notice.key)) return;
  noticedKeys.add(notice.key);
  if (noticeListeners.size === 0) {
    pendingNotices.push(notice);
    return;
  }
  for (const listener of noticeListeners) listener(notice);
}

/**
 * Hears about stored values that could not be read and were set aside, once
 * per key per page. Notices raised before anyone listened are delivered on
 * subscribing. Returns the function that stops listening.
 *
 * @param listener - Called with each notice.
 * @returns A function that removes the listener.
 */
export function onArcadeProgressNotice(listener: NoticeListener): () => void {
  noticeListeners.add(listener);
  for (const notice of pendingNotices.splice(0)) listener(notice);
  return () => {
    noticeListeners.delete(listener);
  };
}

/**
 * The stored text. safe-storage reads localStorage first and its in-memory
 * copy only after that, and stores keep a memory copy only of a write
 * localStorage refused, so a key cleared in another tab reads as cleared.
 */
function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return safeGetRawItem(key);
  } catch {
    return null;
  }
}

type Parsed<T> = { ok: true; value: T } | { ok: false };

/**
 * Creates a store for one key. The key and the stored text stay exactly as
 * the game wrote them before, so no player loses a save by the move.
 *
 * @param key - The localStorage key.
 * @param options - How to read, write and upgrade the value.
 * @returns The store.
 */
export function createArcadeStore<T>(
  key: string,
  options: ArcadeStoreOptions<T>
): ArcadeStore<T> {
  const { parse, serialize, fallback, upgrade } = options;
  const retainInMemory = options.retainInMemory ?? true;
  let cache: { raw: string; parsed: Parsed<T> } | null = null;

  function parseCached(raw: string): Parsed<T> {
    if (cache && cache.raw === raw) return cache.parsed;
    let parsed: Parsed<T>;
    try {
      parsed = { ok: true, value: parse(raw) };
    } catch {
      parsed = { ok: false };
    }
    cache = { raw, parsed };
    return parsed;
  }

  function get(): T {
    const raw = readRaw(key);
    if (raw === null) return fallback;
    const parsed = parseCached(raw);
    return parsed.ok ? parsed.value : fallback;
  }

  /** Moves damaged stored text to `<key>:corrupt` and reports it once. */
  function setAsideCorrupt(): void {
    const raw = readRaw(key);
    if (raw === null || parseCached(raw).ok) return;
    const corruptKey = `${key}${ARCADE_CORRUPT_SUFFIX}`;
    let kept = false;
    try {
      kept = safeSetRawItem(corruptKey, raw, { retainInMemory: false });
      if (kept) safeRemoveItem(key);
    } catch {
      kept = false;
    }
    logger.warn(
      `Arcade progress: the stored value of "${key}" could not be read and reads as empty.`
    );
    announceCorrupt({ key, corruptKey: kept ? corruptKey : null });
  }

  function write(value: T): boolean {
    if (typeof window === "undefined") return false;
    let persisted = false;
    try {
      const raw = serialize(value);
      // The memory copy is kept only for a write localStorage refused, so it
      // never shadows what localStorage holds.
      persisted = safeSetRawItem(key, raw, { retainInMemory: false });
      if (!persisted && retainInMemory) safeSetRawItem(key, raw);
    } catch {
      persisted = false;
    }
    emitAppEvent(ARCADE_PROGRESS_CHANGED_EVENT, { key });
    return persisted;
  }

  function set(value: T): boolean {
    if (typeof window === "undefined") return false;
    setAsideCorrupt();
    return write(value);
  }

  function settle(): T {
    if (typeof window === "undefined") return fallback;
    setAsideCorrupt();
    if (upgrade) {
      const stored = readRaw(key) !== null;
      const next = upgrade(get(), stored);
      if (next !== null && safeIsAvailable()) write(next);
    }
    return get();
  }

  function subscribe(onChange: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    const stopLocal = onAppEvent(ARCADE_PROGRESS_CHANGED_EVENT, (detail) => {
      if (!detail || detail.key === key) onChange();
    });
    const onStorage = (event: StorageEvent) => {
      // A null key is localStorage.clear() in another tab.
      if (!event.key || event.key === key) onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      stopLocal();
      window.removeEventListener("storage", onStorage);
    };
  }

  const store: ArcadeStore<T> = {
    key,
    fallback,
    get,
    set,
    subscribe,
    settle,
    useValue: () => useArcadeStoreValue(store),
  };
  return store;
}
