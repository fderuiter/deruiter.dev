// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderHook } from "@testing-library/react";
import { safeStorage, safeGetItem, safeSetRawItem } from "@/lib/safe-storage";
import { usePersona } from "@/components/providers/PersonaProvider";
import { useTerminology } from "@/components/providers/TerminologyProvider";
import { AudioProvider, useAudio } from "@/components/providers/AudioProvider";
import { TelemetryOutbox } from "@/lib/telemetry";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/audio/sound-engine", () => {
  const engine = {
    getVolume: () => 0.3,
    isMuted: () => true,
    isBypassActive: () => false,
    isSoundAllowed: () => false,
    setVolume: () => {},
    setMuted: () => {},
    playTone: () => {},
    stopAll: () => {},
    close: () => {},
  };
  return { getSoundEngine: () => engine };
});

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

/** Replaces window.localStorage with a getter that throws, as Safari and sandboxed iframes do. */
function blockStorage() {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
  });
}

/** Mirrors the envelope usePersistentState writes through safeStorage.setItem. */
function envelope(value: unknown) {
  return JSON.stringify({
    value,
    lastAccessedAt: Date.now(),
    expiresAt: null,
    isExpirable: false,
  });
}

describe("safeStorage migration (#1129)", () => {
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

  describe("safeSetRawItem", () => {
    it("stores the exact string without an envelope and reads it back unchanged", () => {
      expect(safeSetRawItem("sound_profile", "ambient")).toBe(true);
      expect(mockStorage.getItem("sound_profile")).toBe("ambient");
      expect(safeGetItem("sound_profile")).toBe("ambient");
    });

    it("keeps the value in memory instead of throwing when storage is blocked", () => {
      blockStorage();
      expect(() => safeSetRawItem("sound_profile", "90s-retro")).not.toThrow();
      expect(safeSetRawItem("sound_profile", "90s-retro")).toBe(false);
      expect(safeGetItem("sound_profile")).toBe("90s-retro");
    });

    it("returns false without throwing when the write exceeds quota", () => {
      vi.spyOn(mockStorage, "setItem").mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });
      expect(safeSetRawItem("sound_profile", "8-bit")).toBe(false);
    });
  });

  describe("usePersona fallback outside PersonaProvider", () => {
    it("reads the envelope that usePersistentState writes", () => {
      mockStorage.setItem("global-persona", envelope("behind-the-scenes"));
      const { result } = renderHook(() => usePersona());
      expect(result.current.persona).toBe("behind-the-scenes");
    });

    it("maps a legacy enveloped pre-rename value to its renamed mode", () => {
      mockStorage.setItem("global-persona", envelope("technical"));
      const { result } = renderHook(() => usePersona());
      expect(result.current.persona).toBe("behind-the-scenes");
    });

    it("still reads a legacy bare string", () => {
      mockStorage.setItem("global-persona", "technical");
      const { result } = renderHook(() => usePersona());
      expect(result.current.persona).toBe("behind-the-scenes");
    });

    it("falls back to Professional when storage is blocked", () => {
      blockStorage();
      const { result } = renderHook(() => usePersona());
      expect(result.current.persona).toBe("professional");
    });
  });

  describe("useTerminology fallback outside TerminologyProvider", () => {
    it("reads the envelope that usePersistentState writes", () => {
      mockStorage.setItem("simplified-terminology", envelope(true));
      const { result } = renderHook(() => useTerminology());
      expect(result.current.simplified).toBe(true);
      expect(result.current.isFallback).toBe(true);
    });

    it("still reads a legacy bare JSON boolean", () => {
      mockStorage.setItem("simplified-terminology", "true");
      const { result } = renderHook(() => useTerminology());
      expect(result.current.simplified).toBe(true);
    });

    it("falls back to false when storage is blocked", () => {
      blockStorage();
      const { result } = renderHook(() => useTerminology());
      expect(result.current.simplified).toBe(false);
    });
  });

  describe("AudioProvider sound profile", () => {
    let container: HTMLDivElement;
    let root: Root;
    let api: ReturnType<typeof useAudio> | null = null;

    function Probe() {
      api = useAudio();
      return null;
    }

    async function mount() {
      await act(async () => {
        root.render(
          <AudioProvider>
            <Probe />
          </AudioProvider>
        );
      });
      // The saved profile is applied in a zero-delay timeout after mount.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    beforeEach(() => {
      api = null;
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(() => {
      act(() => root.unmount());
      container.remove();
    });

    it("restores a saved bare-string profile", async () => {
      mockStorage.setItem("sound_profile", "ambient");
      await mount();
      expect(api?.profile).toBe("ambient");
    });

    it("ignores an unknown stored profile", async () => {
      mockStorage.setItem("sound_profile", "dubstep");
      await mount();
      expect(api?.profile).toBe("8-bit");
    });

    it("persists the profile as the bare name, byte-identical to earlier releases", async () => {
      await mount();
      await act(async () => {
        api?.setProfile("90s-retro");
      });
      expect(mockStorage.getItem("sound_profile")).toBe("90s-retro");
      expect(api?.profile).toBe("90s-retro");
    });

    it("switches profile without throwing when storage is blocked", async () => {
      blockStorage();
      await mount();
      await act(async () => {
        expect(() => api?.setProfile("ambient")).not.toThrow();
      });
      expect(api?.profile).toBe("ambient");
    });
  });

  describe("TelemetryOutbox default storage", () => {
    it("constructs without throwing when storage is blocked", () => {
      blockStorage();
      expect(
        () =>
          new TelemetryOutbox({
            transport: async () => ({ ok: true }),
            autoFlushOnUnload: false,
          })
      ).not.toThrow();
    });
  });
});
