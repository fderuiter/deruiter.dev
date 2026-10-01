// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGarminService } from "@/hooks/useGarminService";
import { createInitialState } from "@/lib/garmin-engine";

describe("useGarminService Hook", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("allocates memory successfully via service contract", () => {
    const { result } = renderHook(() => useGarminService());
    const initialState = createInitialState("fenix", 0);

    let res: ReturnType<typeof result.current.allocateMemory> | undefined;
    act(() => {
      res = result.current.allocateMemory({
        state: initialState,
        type: "int",
        name: "testVar",
      });
    });

    expect(res?.success).toBe(true);
    if (res?.success) {
      expect(res.data.state.variables.length).toBeGreaterThan(0);
      expect(res.data.allocatedSizeKb).toBeGreaterThan(0);
    }
  });

  it("returns structured failure when memory allocation causes crash/OOM", () => {
    const { result } = renderHook(() => useGarminService());
    const initialState = createInitialState("fenix", 0);
    // Fill up state RAM to near limit
    initialState.allocatedRamKb = 32.0;

    let res: ReturnType<typeof result.current.allocateMemory> | undefined;
    act(() => {
      res = result.current.allocateMemory({
        state: initialState,
        type: "array",
      });
    });

    expect(res?.success).toBe(false);
    if (res && !res.success) {
      expect(res.error.code).toBe("OUT_OF_MEMORY");
      expect(res.error.suggestion).toBeDefined();
    }
  });

  it("executes garbage collection successfully", () => {
    const { result } = renderHook(() => useGarminService());
    const state = {
      ...createInitialState("fenix", 0),
      gameState: "playing" as const,
    };

    let res: ReturnType<typeof result.current.garbageCollect> | undefined;
    act(() => {
      res = result.current.garbageCollect({ state });
    });

    expect(res?.success).toBe(true);
  });

  it("syncs flash storage (save, load, clear)", async () => {
    const { result } = renderHook(() => useGarminService());

    let saveRes:
      Awaited<ReturnType<typeof result.current.syncFlashStorage>> | undefined;
    await act(async () => {
      saveRes = await result.current.syncFlashStorage({
        action: "save",
        variables: [
          { id: 1, name: "var1", sizeKb: 4, allocatedAt: Date.now() },
        ],
      });
    });

    expect(saveRes?.success).toBe(true);

    let loadRes:
      Awaited<ReturnType<typeof result.current.syncFlashStorage>> | undefined;
    await act(async () => {
      loadRes = await result.current.syncFlashStorage({ action: "load" });
    });

    expect(loadRes?.success).toBe(true);
    if (loadRes?.success) {
      expect(loadRes.data.variables.length).toBe(1);
    }

    let clearRes:
      Awaited<ReturnType<typeof result.current.syncFlashStorage>> | undefined;
    await act(async () => {
      clearRes = await result.current.syncFlashStorage({ action: "clear" });
    });

    expect(clearRes?.success).toBe(true);
  });

  it("returns STORAGE_UNAVAILABLE service failure when local storage write encounters quota error", async () => {
    const { result } = renderHook(() => useGarminService());

    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("QuotaExceededError", "QuotaExceededError");
      });

    let saveRes:
      Awaited<ReturnType<typeof result.current.syncFlashStorage>> | undefined;
    await act(async () => {
      saveRes = await result.current.syncFlashStorage({
        action: "save",
        variables: [
          { id: 1, name: "var1", sizeKb: 4, allocatedAt: Date.now() },
        ],
      });
    });

    expect(saveRes?.success).toBe(false);
    if (saveRes && !saveRes.success) {
      expect(saveRes.error.code).toBe("STORAGE_UNAVAILABLE");
      expect(saveRes.error.suggestion).toBe(
        "Check localStorage availability and quota limits"
      );
    }

    setItemSpy.mockRestore();
  });
});
