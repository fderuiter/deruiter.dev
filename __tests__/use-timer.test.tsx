import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { StrictMode } from "react";
import { renderHook, act } from "@testing-library/react";
import { useSafeTimeout } from "@/hooks/useSafeTimeout";
import { useInterval } from "@/hooks/useInterval";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("useSafeTimeout", () => {
  it("runs a scheduled callback once after the delay", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useSafeTimeout());

    act(() => {
      result.current.setSafeTimeout(fn, 100);
    });
    expect(result.current.pendingCount()).toBe(1);

    act(() => vi.advanceTimersByTime(99));
    expect(fn).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.current.pendingCount()).toBe(0);

    act(() => vi.advanceTimersByTime(1000));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("clears every pending timeout on unmount with zero callbacks left", () => {
    const fns = [vi.fn(), vi.fn(), vi.fn()];
    const { result, unmount } = renderHook(() => useSafeTimeout());

    act(() => {
      fns.forEach((fn, i) => result.current.setSafeTimeout(fn, 100 * (i + 1)));
    });
    expect(vi.getTimerCount()).toBe(3);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(1000));
    fns.forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it("schedules nothing once the component has unmounted", () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useSafeTimeout());
    const { setSafeTimeout } = result.current;
    unmount();

    setSafeTimeout(fn, 10);
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(100));
    expect(fn).not.toHaveBeenCalled();
  });

  it("cancels a single timeout and ignores stale or empty handles", () => {
    const kept = vi.fn();
    const cancelled = vi.fn();
    const { result } = renderHook(() => useSafeTimeout());

    let id = 0;
    act(() => {
      result.current.setSafeTimeout(kept, 50);
      id = result.current.setSafeTimeout(cancelled, 50);
    });
    result.current.clearSafeTimeout(id);
    // A second clear, and null or undefined handles, are no-ops.
    result.current.clearSafeTimeout(id);
    result.current.clearSafeTimeout(null);
    result.current.clearSafeTimeout(undefined);
    expect(result.current.pendingCount()).toBe(1);

    act(() => vi.advanceTimersByTime(50));
    expect(kept).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
  });

  it("clearAll cancels everything but keeps the hook usable", () => {
    const early = vi.fn();
    const late = vi.fn();
    const { result } = renderHook(() => useSafeTimeout());

    act(() => {
      result.current.setSafeTimeout(early, 50);
      result.current.setSafeTimeout(early, 80);
    });
    act(() => result.current.clearAll());
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      result.current.setSafeTimeout(late, 20);
    });
    act(() => vi.advanceTimersByTime(100));
    expect(early).not.toHaveBeenCalled();
    expect(late).toHaveBeenCalledTimes(1);
  });

  it("treats a negative delay as zero", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useSafeTimeout());
    act(() => {
      result.current.setSafeTimeout(fn, -20);
    });
    act(() => vi.advanceTimersByTime(0));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("returns controls with a stable identity across renders", () => {
    const { result, rerender } = renderHook(() => useSafeTimeout());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(result.current.setSafeTimeout).toBe(first.setSafeTimeout);
  });

  it("keeps working after the Strict Mode effect remount", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useSafeTimeout(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <StrictMode>{children}</StrictMode>
      ),
    });
    act(() => {
      result.current.setSafeTimeout(fn, 10);
    });
    act(() => vi.advanceTimersByTime(10));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("useInterval", () => {
  it("ticks every delay and stops on unmount with no timers left", () => {
    const fn = vi.fn();
    const { unmount } = renderHook(() => useInterval(fn, 100));

    act(() => vi.advanceTimersByTime(350));
    expect(fn).toHaveBeenCalledTimes(3);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(1000));
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("pauses while the delay is null and resumes when it is set again", () => {
    const fn = vi.fn();
    const { rerender } = renderHook(
      ({ delay }: { delay: number | null }) => useInterval(fn, delay),
      { initialProps: { delay: null as number | null } }
    );

    act(() => vi.advanceTimersByTime(500));
    expect(fn).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    rerender({ delay: 100 });
    act(() => vi.advanceTimersByTime(200));
    expect(fn).toHaveBeenCalledTimes(2);

    rerender({ delay: null });
    act(() => vi.advanceTimersByTime(500));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("calls the latest callback without restarting the interval", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useInterval(cb, 100),
      { initialProps: { cb: first } }
    );

    act(() => vi.advanceTimersByTime(60));
    rerender({ cb: second });
    // Had the interval restarted on the new callback, it would not fire until 160ms.
    act(() => vi.advanceTimersByTime(40));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("restarts with the new period when the delay changes", () => {
    const fn = vi.fn();
    const { rerender } = renderHook(
      ({ delay }: { delay: number }) => useInterval(fn, delay),
      { initialProps: { delay: 100 } }
    );
    rerender({ delay: 300 });
    act(() => vi.advanceTimersByTime(299));
    expect(fn).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
