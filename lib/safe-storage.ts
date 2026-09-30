/* eslint-disable @typescript-eslint/no-explicit-any */
import { sanitizeError } from "./error-sanitization";
import { logger } from "@/lib/logger";

export const STORAGE_CHANGE_EVENT = "portfolio-persistent-state-change";

export interface StorageOptions {
  /** Optional Unix timestamp (in milliseconds) after which the item is considered expired */
  expiresAt?: number | null;
  /** Flag indicating whether this key can be automatically evicted under quota pressure */
  isExpirable?: boolean;
  /** Optional time-to-live duration in milliseconds */
  ttlMs?: number;
}

export interface StorageEnvelope<T = unknown> {
  value: T;
  lastAccessedAt: number;
  expiresAt?: number | null;
  isExpirable?: boolean;
}

interface CacheRecord<T = unknown> {
  raw: string | null;
  envelope: StorageEnvelope<T> | null;
  parsedValue: T;
}

export class SafeStorageAdapter {
  private memoryCache = new Map<string, CacheRecord<any>>();

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (event) => {
        if (event.key) {
          this.invalidateCacheKey(event.key);
        } else {
          this.clearCache();
        }
      });

      window.addEventListener(STORAGE_CHANGE_EVENT, (event: Event) => {
        const customEv = event as CustomEvent<{ key?: string }>;
        if (customEv.detail?.key) {
          this.invalidateCacheKey(customEv.detail.key);
        }
      });
    }
  }

  /**
   * Safely checks whether localStorage API is accessible in the current environment.
   */
  public isAvailable(): boolean {
    if (typeof window === "undefined") return false;
    try {
      const storage = window.localStorage;
      return Boolean(
        storage &&
        typeof storage.getItem === "function" &&
        typeof storage.setItem === "function"
      );
    } catch {
      return false;
    }
  }

  /**
   * Invalidate memory cache key if raw storage content differs.
   */
  public invalidateCacheKey(key: string): void {
    const cached = this.memoryCache.get(key);
    if (!cached) return;
    try {
      if (this.isAvailable()) {
        const currentRaw = window.localStorage.getItem(key);
        if (currentRaw !== cached.raw) {
          this.memoryCache.delete(key);
        }
      }
    } catch {
      // Retain memory cache if storage access is restricted
    }
  }

  /**
   * Clear all internal memory cache entries.
   */
  public clearCache(): void {
    this.memoryCache.clear();
  }

  /**
   * Reads an item from storage or memory fallback cache.
   * Updates lastAccessedAt timestamp and auto-evicts expired items.
   */
  public getItem<T = any>(key: string, defaultValue?: T): T | null {
    const fallback = defaultValue !== undefined ? defaultValue : null;

    if (!this.isAvailable()) {
      const cached = this.memoryCache.get(key);
      if (cached) {
        if (cached.envelope && this.isExpired(cached.envelope)) {
          this.memoryCache.delete(key);
          return fallback;
        }
        if (cached.envelope) {
          cached.envelope.lastAccessedAt = Date.now();
        }
        return cached.parsedValue as T;
      }
      return fallback;
    }

    try {
      const raw = window.localStorage.getItem(key);
      const cached = this.memoryCache.get(key);

      if (cached && cached.raw === raw) {
        if (cached.envelope) {
          if (this.isExpired(cached.envelope)) {
            this.removeItem(key);
            return fallback;
          }
          cached.envelope.lastAccessedAt = Date.now();
        }
        return cached.parsedValue as T;
      }

      if (raw === null) {
        this.memoryCache.delete(key);
        return fallback;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Raw non-JSON string
        this.memoryCache.set(key, { raw, envelope: null, parsedValue: raw });
        return raw as unknown as T;
      }

      if (this.isEnvelope(parsed)) {
        const envelope = parsed as StorageEnvelope<T>;
        if (this.isExpired(envelope)) {
          this.removeItem(key);
          return fallback;
        }

        envelope.lastAccessedAt = Date.now();
        const updatedRaw = JSON.stringify(envelope);
        this.memoryCache.set(key, {
          raw: updatedRaw,
          envelope,
          parsedValue: envelope.value,
        });

        try {
          window.localStorage.setItem(key, updatedRaw);
        } catch {
          // Ignore timestamp write failure in restricted/full storage
        }

        return envelope.value;
      } else {
        // Plain JSON object/array/value (legacy or non-envelope)
        this.memoryCache.set(key, { raw, envelope: null, parsedValue: parsed });
        return parsed as T;
      }
    } catch (error) {
      const sanitized = sanitizeError(error);
      logger.warn(`SafeStorage: getItem failed for key "${key}":`, sanitized);
      const cached = this.memoryCache.get(key);
      if (cached) {
        return cached.parsedValue as T;
      }
      return fallback;
    }
  }

  /**
   * Writes an item wrapped in a metadata envelope to storage.
   * Handles QuotaExceededError by triggering LRU metadata eviction.
   */
  public setItem<T = any>(
    key: string,
    value: T,
    options?: StorageOptions
  ): boolean {
    const now = Date.now();
    let expiresAt: number | null = options?.expiresAt ?? null;
    if (options?.ttlMs !== undefined && typeof options.ttlMs === "number") {
      expiresAt = now + options.ttlMs;
    }

    const isExpirable =
      options?.isExpirable !== undefined
        ? options.isExpirable
        : Boolean(expiresAt !== null);

    const envelope: StorageEnvelope<T> = {
      value,
      lastAccessedAt: now,
      expiresAt,
      isExpirable,
    };

    const jsonString = JSON.stringify(envelope);

    // Always update in-memory fallback cache first
    this.memoryCache.set(key, {
      raw: jsonString,
      envelope,
      parsedValue: value,
    });

    if (!this.isAvailable()) {
      this.notifyChange(key);
      return true;
    }

    try {
      window.localStorage.setItem(key, jsonString);
      this.notifyChange(key);
      return true;
    } catch (error) {
      // Attempt LRU & expired item eviction to free up quota
      const writeSuccess = this.handleWriteQuotaFailure(
        key,
        jsonString,
        envelope,
        error
      );
      this.notifyChange(key);
      return writeSuccess;
    }
  }

  /**
   * Writes a raw string to storage exactly as given, without the metadata
   * envelope that `setItem` adds. Use it only for keys whose stored format
   * predates the envelope and must stay byte-identical so existing visitors
   * keep their settings. `getItem` reads such values back unchanged. Storage
   * failures fall back to the in-memory cache instead of throwing.
   *
   * @param key - The storage key to write
   * @param raw - The exact string to store
   * @returns true when the value reached localStorage, false when it is held in memory only
   */
  public setRawItem(key: string, raw: string): boolean {
    let parsedValue: unknown = raw;
    try {
      parsedValue = JSON.parse(raw);
    } catch {
      // Raw non-JSON string is returned as-is by getItem
    }
    this.memoryCache.set(key, { raw, envelope: null, parsedValue });

    let persisted = false;
    if (this.isAvailable()) {
      try {
        window.localStorage.setItem(key, raw);
        persisted = true;
      } catch (error) {
        const sanitized = sanitizeError(error);
        logger.warn(
          `SafeStorage: setRawItem failed for key "${key}". Value retained in memory.`,
          sanitized
        );
      }
    }

    this.notifyChange(key);
    return persisted;
  }

  /**
   * Reads the stored string exactly as written, without JSON parsing or
   * envelope unwrapping. It is the read counterpart of `setRawItem` for keys
   * whose legacy format is a bare string (for example a high score "1200"
   * that `getItem` would return as the number 1200). Falls back to the
   * in-memory cache when storage is unavailable or throws.
   *
   * @param key - The storage key to read
   * @returns The stored string, or null when the key is absent
   */
  public getRawItem(key: string): string | null {
    if (this.isAvailable()) {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw !== null) return raw;
      } catch {
        // Fallback to memory cache
      }
    }
    return this.memoryCache.get(key)?.raw ?? null;
  }

  /**
   * Removes an item from storage and memory cache.
   */
  public removeItem(key: string): void {
    this.memoryCache.delete(key);

    if (this.isAvailable()) {
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        const sanitized = sanitizeError(error);
        logger.warn(
          `SafeStorage: removeItem failed for key "${key}":`,
          sanitized
        );
      }
    }

    this.notifyChange(key);
  }

  /**
   * Clears all items from storage and memory cache.
   */
  public clear(): void {
    this.memoryCache.clear();

    if (this.isAvailable()) {
      try {
        window.localStorage.clear();
      } catch (error) {
        const sanitized = sanitizeError(error);
        logger.warn("SafeStorage: clear failed:", sanitized);
      }
    }

    this.notifyChange();
  }

  /**
   * Returns key at specified index.
   */
  public key(index: number): string | null {
    if (this.isAvailable()) {
      try {
        return window.localStorage.key(index);
      } catch {
        // Fallback to memory cache
      }
    }
    return Array.from(this.memoryCache.keys())[index] ?? null;
  }

  /**
   * Gets total number of stored keys.
   */
  public get length(): number {
    if (this.isAvailable()) {
      try {
        return window.localStorage.length;
      } catch {
        // Fallback to memory cache
      }
    }
    return this.memoryCache.size;
  }

  /**
   * Gets the metadata envelope for a key if present or constructs default metadata.
   */
  public getEnvelope<T = any>(key: string): StorageEnvelope<T> | null {
    if (this.isAvailable()) {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw !== null) {
          const parsed = JSON.parse(raw);
          if (this.isEnvelope(parsed)) {
            return parsed as StorageEnvelope<T>;
          }
        }
      } catch {
        // Fallback to memory cache
      }
    }

    const cached = this.memoryCache.get(key);
    if (cached) {
      if (cached.envelope) {
        return cached.envelope as StorageEnvelope<T>;
      }
      return {
        value: cached.parsedValue as T,
        lastAccessedAt: Date.now(),
        isExpirable: false,
      };
    }

    return null;
  }

  /**
   * Prunes all expired keys across storage and memory cache.
   * Returns count of pruned entries.
   */
  public pruneExpired(): number {
    let count = 0;
    const now = Date.now();

    if (this.isAvailable()) {
      try {
        const total = window.localStorage.length;
        const keysToRemove: string[] = [];

        for (let i = 0; i < total; i++) {
          const k = window.localStorage.key(i);
          if (!k) continue;
          const raw = window.localStorage.getItem(k);
          if (!raw) continue;

          try {
            const parsed = JSON.parse(raw);
            if (
              this.isEnvelope(parsed) &&
              parsed.expiresAt &&
              parsed.expiresAt <= now
            ) {
              keysToRemove.push(k);
            }
          } catch {
            // Non-JSON item, ignore
          }
        }

        for (const k of keysToRemove) {
          window.localStorage.removeItem(k);
          this.memoryCache.delete(k);
          count++;
        }
      } catch (error) {
        const sanitized = sanitizeError(error);
        logger.warn("SafeStorage: error during pruneExpired:", sanitized);
      }
    }

    // Also prune memory cache
    for (const [k, cached] of Array.from(this.memoryCache.entries())) {
      if (
        cached.envelope &&
        cached.envelope.expiresAt &&
        cached.envelope.expiresAt <= now
      ) {
        this.memoryCache.delete(k);
        if (!this.isAvailable()) count++;
      }
    }

    return count;
  }

  private isEnvelope(obj: unknown): obj is StorageEnvelope {
    return (
      typeof obj === "object" &&
      obj !== null &&
      "value" in obj &&
      typeof (obj as Record<string, unknown>).lastAccessedAt === "number"
    );
  }

  private isExpired(envelope: StorageEnvelope): boolean {
    return Boolean(envelope.expiresAt && envelope.expiresAt <= Date.now());
  }

  private notifyChange(key?: string): void {
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new CustomEvent(STORAGE_CHANGE_EVENT, { detail: { key } })
        );
      } catch {
        // Ignore custom event dispatch issues
      }
    }
  }

  private handleWriteQuotaFailure(
    key: string,
    jsonString: string,
    _envelope: StorageEnvelope,
    initialError: unknown
  ): boolean {
    // 1. Prune expired entries first
    this.pruneExpired();

    try {
      window.localStorage.setItem(key, jsonString);
      return true;
    } catch {
      // Quota still exceeded after pruning expired items
    }

    // 2. Identify and sort candidate expirable keys by lastAccessedAt ascending (LRU)
    const expirableCandidates: Array<{ key: string; lastAccessedAt: number }> =
      [];

    if (this.isAvailable()) {
      try {
        const length = window.localStorage.length;
        for (let i = 0; i < length; i++) {
          const k = window.localStorage.key(i);
          if (!k || k === key) continue;

          const raw = window.localStorage.getItem(k);
          if (!raw) continue;

          try {
            const parsed = JSON.parse(raw);
            if (this.isEnvelope(parsed)) {
              if (
                parsed.isExpirable === true ||
                (parsed.expiresAt && parsed.expiresAt > 0)
              ) {
                expirableCandidates.push({
                  key: k,
                  lastAccessedAt: parsed.lastAccessedAt || 0,
                });
              }
            }
          } catch {
            // Untagged raw data - strictly preserve non-expirable user preferences
          }
        }
      } catch {
        // Storage iteration error
      }
    }

    // Sort candidate keys: oldest lastAccessedAt first
    expirableCandidates.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

    // Evict expirable entries until setItem succeeds
    for (const candidate of expirableCandidates) {
      try {
        window.localStorage.removeItem(candidate.key);
        this.memoryCache.delete(candidate.key);
        window.localStorage.setItem(key, jsonString);
        return true; // Success after eviction
      } catch {
        // Continue evicting next candidate
      }
    }

    // If quota constraint persists after evicting all expirable keys, retain active state in memory fallback cache
    const sanitized = sanitizeError(initialError);
    logger.warn(
      `SafeStorage: Storage quota exceeded for key "${key}". Active state retained in memory.`,
      sanitized
    );

    return false;
  }
}

export const safeStorage = new SafeStorageAdapter();

export const safeGetItem = <T = any>(key: string, defaultValue?: T): T | null =>
  safeStorage.getItem(key, defaultValue);

export const safeSetItem = <T = any>(
  key: string,
  value: T,
  options?: StorageOptions
): boolean => safeStorage.setItem(key, value, options);

export const safeSetRawItem = (key: string, raw: string): boolean =>
  safeStorage.setRawItem(key, raw);

export const safeGetRawItem = (key: string): string | null =>
  safeStorage.getRawItem(key);

export const safeRemoveItem = (key: string): void =>
  safeStorage.removeItem(key);

export const safeClear = (): void => safeStorage.clear();

export const safeGetEnvelope = <T = any>(
  key: string
): StorageEnvelope<T> | null => safeStorage.getEnvelope(key);

export const safePruneExpired = (): number => safeStorage.pruneExpired();

export const safeIsAvailable = (): boolean => safeStorage.isAvailable();

export default safeStorage;
