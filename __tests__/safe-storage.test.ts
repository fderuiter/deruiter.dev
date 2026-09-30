/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  safeStorage,
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
  safeClear,
  safeGetEnvelope,
  safePruneExpired,
  safeIsAvailable,
  safeRawStorage,
  STORAGE_CHANGE_EVENT,
} from "@/lib/safe-storage";

class MockStorage {
  private store: Record<string, string> = {};

  getItem(key: string) {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
  get length() {
    return Object.keys(this.store).length;
  }
  key(index: number) {
    return Object.keys(this.store)[index] ?? null;
  }
}

describe("Centralized Safe Storage Adapter & LRU Eviction", () => {
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    safeStorage.clearCache();

    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attaches metadata envelope with access timestamps on setItem and getItem", () => {
    const startTime = Date.now();
    safeSetItem("theme_preference", "dark");

    const envelope = safeGetEnvelope("theme_preference");
    expect(envelope).not.toBeNull();
    expect(envelope?.value).toBe("dark");
    expect(envelope?.lastAccessedAt).toBeGreaterThanOrEqual(startTime);
    expect(envelope?.isExpirable).toBe(false);

    const retrieved = safeGetItem("theme_preference");
    expect(retrieved).toBe("dark");
  });

  it("handles expiry timestamp and auto-prunes expired keys on read", async () => {
    // Write an item that expired 1 second ago
    const pastTime = Date.now() - 1000;
    safeSetItem("temp_token", "abc12345", { expiresAt: pastTime });

    // Entry exists before getItem
    expect(mockStorage.getItem("temp_token")).not.toBeNull();

    // getItem should auto-evict expired entry and return default/fallback
    const result = safeGetItem("temp_token", "expired_fallback");
    expect(result).toBe("expired_fallback");
    expect(mockStorage.getItem("temp_token")).toBeNull();
  });

  it("supports ttlMs option to auto-calculate expiresAt and mark key as expirable", () => {
    safeSetItem("session_logs", { log: "test" }, { ttlMs: 5000 });

    const envelope = safeGetEnvelope("session_logs");
    expect(envelope).not.toBeNull();
    expect(envelope?.isExpirable).toBe(true);
    expect(envelope?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("triggers automated LRU eviction of expirable keys when setItem throws QuotaExceededError", () => {
    // 1. Set critical user preference (non-expirable)
    safeSetItem(
      "user_settings",
      { theme: "cyberpunk", fontSize: 14 },
      { isExpirable: false }
    );

    // 2. Set 3 expirable telemetry/log entries with distinct access timestamps
    const now = Date.now();
    safeSetItem("log_entry_1", "log_data_1", { isExpirable: true });
    safeSetItem("log_entry_2", "log_data_2", { isExpirable: true });
    safeSetItem("log_entry_3", "log_data_3", { isExpirable: true });

    // Manually adjust access timestamps in storage envelopes to simulate access history
    const env1 = safeGetEnvelope("log_entry_1");
    if (env1) {
      env1.lastAccessedAt = now - 3000; // Least recently used
      mockStorage.setItem("log_entry_1", JSON.stringify(env1));
    }
    const env2 = safeGetEnvelope("log_entry_2");
    if (env2) {
      env2.lastAccessedAt = now - 2000;
      mockStorage.setItem("log_entry_2", JSON.stringify(env2));
    }
    const env3 = safeGetEnvelope("log_entry_3");
    if (env3) {
      env3.lastAccessedAt = now - 1000; // Most recently used
      mockStorage.setItem("log_entry_3", JSON.stringify(env3));
    }

    // Mock setItem to throw QuotaExceededError until log_entry_1 is evicted
    let hasEvictedEntry1 = false;
    const originalSetItem = mockStorage.setItem.bind(mockStorage);

    vi.spyOn(mockStorage, "setItem").mockImplementation(
      (k: string, v: string) => {
        if (!hasEvictedEntry1 && k === "heavy_asset") {
          const err = new DOMException(
            "QuotaExceededError",
            "QuotaExceededError"
          );
          throw err;
        }
        if (k === "heavy_asset" && hasEvictedEntry1) {
          originalSetItem(k, v);
          return;
        }
        originalSetItem(k, v);
      }
    );

    vi.spyOn(mockStorage, "removeItem").mockImplementation((k: string) => {
      if (k === "log_entry_1") {
        hasEvictedEntry1 = true;
      }
      delete (mockStorage as any).store[k];
    });

    // Attempt to save heavy asset
    const success = safeSetItem(
      "heavy_asset",
      { data: "large_payload" },
      { isExpirable: true }
    );

    expect(success).toBe(true);
    // Least recently used entry log_entry_1 should have been evicted
    expect(safeGetItem("log_entry_1")).toBeNull();
    // Critical settings MUST NOT be deleted
    expect(safeGetItem("user_settings")).toEqual({
      theme: "cyberpunk",
      fontSize: 14,
    });
    // Heavy asset successfully written
    expect(safeGetItem("heavy_asset")).toEqual({ data: "large_payload" });
  });

  it("activates in-memory cache fallback immediately when browser storage is restricted or full", () => {
    // Mock storage access to throw SecurityError / AccessDenied
    Object.defineProperty(window, "localStorage", {
      get: () => {
        throw new DOMException("AccessDenied", "SecurityError");
      },
      configurable: true,
    });

    expect(safeIsAvailable()).toBe(false);

    // Writes and reads should continue to succeed seamlessly via memory fallback
    const setOk = safeSetItem("restricted_key", "in_memory_value");
    expect(setOk).toBe(true);

    const value = safeGetItem("restricted_key");
    expect(value).toBe("in_memory_value");
  });

  it("dispatches STORAGE_CHANGE_EVENT custom events for cross-tab state synchronization", () => {
    const changeHandler = vi.fn();
    window.addEventListener(STORAGE_CHANGE_EVENT, changeHandler);

    safeSetItem("sync_key", "synced_val");
    expect(changeHandler).toHaveBeenCalledTimes(1);

    safeRemoveItem("sync_key");
    expect(changeHandler).toHaveBeenCalledTimes(2);

    safeClear();
    expect(changeHandler).toHaveBeenCalledTimes(3);

    window.removeEventListener(STORAGE_CHANGE_EVENT, changeHandler);
  });

  it("sanitizes intercepted storage exceptions in production environments", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "production";

    try {
      const sensitivePath = [
        "",
        "Users",
        "jules",
        "app",
        "secret",
        "config.json",
      ].join("/");
      // Make setItem throw an exception with a sensitive system file path
      vi.spyOn(mockStorage, "setItem").mockImplementation(() => {
        throw new Error(
          `Failed to write to ${sensitivePath} due to disk error`
        );
      });

      safeSetItem("test_path_sanitization", "val", { isExpirable: false });

      expect(warnSpy).toHaveBeenCalled();
      const warnCall = warnSpy.mock.calls[0];
      const warnErr = warnCall?.[1] as Error;

      expect(warnErr?.message).not.toContain(sensitivePath);
      expect(warnErr?.message).toContain("[scrubbed]");
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      warnSpy.mockRestore();
    }
  });

  it("supports safePruneExpired method to clean expired keys manually", () => {
    const past = Date.now() - 5000;
    const future = Date.now() + 5000;

    safeSetItem("exp_1", "v1", { expiresAt: past });
    safeSetItem("exp_2", "v2", { expiresAt: past });
    safeSetItem("active_1", "v3", { expiresAt: future });

    const prunedCount = safePruneExpired();
    expect(prunedCount).toBe(2);
    expect(safeGetItem("exp_1")).toBeNull();
    expect(safeGetItem("exp_2")).toBeNull();
    expect(safeGetItem("active_1")).toBe("v3");
  });

  it("unwraps legacy raw non-envelope items cleanly on getItem", () => {
    mockStorage.setItem("legacy_key", JSON.stringify({ oldData: true }));

    const data = safeGetItem("legacy_key");
    expect(data).toEqual({ oldData: true });
  });
});

describe("safeRawStorage (#1631)", () => {
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    safeStorage.clearCache();
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores and reads values byte for byte, without an envelope", () => {
    safeRawStorage.setItem("sound_volume", "0.75");
    expect(mockStorage.getItem("sound_volume")).toBe("0.75");
    expect(safeRawStorage.getItem("sound_volume")).toBe("0.75");

    safeRawStorage.setItem("queue", '[{"a":1}]');
    expect(mockStorage.getItem("queue")).toBe('[{"a":1}]');

    safeRawStorage.removeItem("queue");
    expect(mockStorage.getItem("queue")).toBeNull();
  });

  it("throws when a write is rejected and keeps nothing in memory", () => {
    vi.spyOn(mockStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => safeRawStorage.setItem("sound_muted", "false")).toThrow(
      /sound_muted/
    );
    expect(safeRawStorage.getItem("sound_muted")).toBeNull();
  });

  it("reads null and rejects writes when storage access throws", () => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("SecurityError");
      },
      configurable: true,
    });
    expect(safeRawStorage.getItem("sound_volume")).toBeNull();
    expect(() => safeRawStorage.setItem("sound_volume", "1")).toThrow();
  });
});
