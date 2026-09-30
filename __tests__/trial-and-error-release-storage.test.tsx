import { describe, it, expect, vi, afterEach } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useTeSound } from "@/components/trial-and-error/useTeSound";

/**
 * #925 release hardening: the cabinet's audio switches survive storage that
 * is unavailable or that refuses writes. The switch the viewer flips still
 * takes effect for the page, as `writeSettings` promises, instead of
 * silently snapping back to the stored or default value.
 */
describe("cabinet audio switches without working storage (#925)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // A page-only switch lives in module state until a write succeeds, so
    // each test ends with a successful write of the defaults.
    const { result } = renderHook(() => useTeSound());
    act(() => result.current.setSfxEnabled(true));
    act(() => result.current.setMusicEnabled(false));
    cleanup();
    window.localStorage.clear();
  });

  it("keeps a switch for the page when storage is blocked outright", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const { result } = renderHook(() => useTeSound());
    expect(result.current).toMatchObject({
      sfxEnabled: true,
      musicEnabled: false,
    });
    act(() => result.current.setMusicEnabled(true));
    expect(result.current.musicEnabled).toBe(true);
    act(() => result.current.setSfxEnabled(false));
    expect(result.current).toMatchObject({
      sfxEnabled: false,
      musicEnabled: true,
    });
  });

  it("keeps a switch for the page when a write fails over a stored value", () => {
    window.localStorage.setItem("te:audio", "sfx=1;music=0");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const { result } = renderHook(() => useTeSound());
    act(() => result.current.setMusicEnabled(true));
    expect(result.current.musicEnabled).toBe(true);
    // Nothing was written: the stored value is untouched.
    expect(window.localStorage.getItem("te:audio")).toBe("sfx=1;music=0");
  });

  it("goes back to storage once a write succeeds again", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementationOnce(() => {
        throw new DOMException("full", "QuotaExceededError");
      });
    const { result } = renderHook(() => useTeSound());
    act(() => result.current.setMusicEnabled(true));
    expect(result.current.musicEnabled).toBe(true);
    setItem.mockRestore();
    act(() => result.current.setMusicEnabled(false));
    expect(window.localStorage.getItem("te:audio")).toBe("sfx=1;music=0");
    expect(result.current.musicEnabled).toBe(false);
    // Another tab's write is followed again.
    act(() => {
      window.localStorage.setItem("te:audio", "sfx=0;music=1");
      window.dispatchEvent(new StorageEvent("storage", { key: "te:audio" }));
    });
    expect(result.current).toMatchObject({
      sfxEnabled: false,
      musicEnabled: true,
    });
  });

  it("treats corrupt stored values as the defaults", () => {
    for (const corrupt of ["", "{", "sfx=2;music=1", "music=1;sfx=1", "null"]) {
      window.localStorage.setItem("te:audio", corrupt);
      const { result, unmount } = renderHook(() => useTeSound());
      expect(result.current).toMatchObject({
        sfxEnabled: true,
        musicEnabled: false,
      });
      unmount();
    }
  });
});
