import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce, useDebouncedCallback } from "@/hooks/useDebounce";
import { useThrottle, useThrottledCallback } from "@/hooks/useThrottle";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("useDebounce", () => {
  it("returns the initial value, then settles on the last value after a quiet period", () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 100), {
      initialProps: { v: "a" },
    });
    expect(result.current).toBe("a");

    rerender({ v: "ab" });
    act(() => vi.advanceTimersByTime(60));
    rerender({ v: "abc" });
    act(() => vi.advanceTimersByTime(60));
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(40));
    expect(result.current).toBe("abc");
  });

  it("passes values through on the same render when the delay is zero", () => {
    const { result, rerender } = renderHook(({ v, d }) => useDebounce(v, d), {
      initialProps: { v: "abc", d: 100 },
    });
    rerender({ v: "", d: 0 });
    expect(result.current).toBe("");

    // Resuming a positive delay starts from the passed-through value, not a stale one.
    rerender({ v: "x", d: 100 });
    expect(result.current).toBe("");
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("x");
  });

  it("clears its timer on unmount", () => {
    const { rerender, unmount } = renderHook(({ v }) => useDebounce(v, 100), {
      initialProps: { v: 1 },
    });
    rerender({ v: 2 });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("useDebouncedCallback", () => {
  it("fires once on the trailing edge with the latest arguments", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 100));

    act(() => {
      result.current(1);
      result.current(2);
      result.current(3);
    });
    expect(fn).not.toHaveBeenCalled();
    expect(result.current.isPending()).toBe(true);

    act(() => vi.advanceTimersByTime(100));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });

  it("fires on the leading edge and only re-fires on the trailing edge if more calls arrived", () => {
    const fn = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedCallback(fn, 100, { leading: true })
    );

    act(() => result.current("solo"));
    expect(fn).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(100));
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      result.current("a");
      result.current("b");
    });
    expect(fn).toHaveBeenLastCalledWith("a");
    act(() => vi.advanceTimersByTime(100));
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenLastCalledWith("b");
  });

  it("supports cancel and flush", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 100));

    act(() => result.current("dropped"));
    act(() => result.current.cancel());
    act(() => vi.advanceTimersByTime(200));
    expect(fn).not.toHaveBeenCalled();

    act(() => result.current("now"));
    act(() => result.current.flush());
    expect(fn).toHaveBeenCalledWith("now");
    expect(result.current.isPending()).toBe(false);
  });

  it("keeps a stable identity and invokes the latest callback", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ cb }) => useDebouncedCallback(cb, 100),
      { initialProps: { cb: first } }
    );
    const initial = result.current;

    act(() => result.current("x"));
    rerender({ cb: second });
    expect(result.current).toBe(initial);

    act(() => vi.advanceTimersByTime(100));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("x");
  });

  it("cancels the pending invocation on unmount", () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(fn, 100));
    act(() => result.current());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("useThrottledCallback", () => {
  it("fires on the leading edge and once more on the trailing edge of a burst", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(fn, 100));

    act(() => {
      result.current(1);
      result.current(2);
      result.current(3);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(1);

    act(() => vi.advanceTimersByTime(100));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(3);
  });

  it("suppresses calls inside the window when trailing is disabled", () => {
    const fn = vi.fn();
    const { result } = renderHook(() =>
      useThrottledCallback(fn, 50, { trailing: false })
    );

    act(() => result.current());
    act(() => vi.advanceTimersByTime(49));
    act(() => result.current());
    expect(fn).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    act(() => vi.advanceTimersByTime(1));
    act(() => result.current());
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("with leading disabled, defers the first call to the end of the window", () => {
    const fn = vi.fn();
    const { result } = renderHook(() =>
      useThrottledCallback(fn, 100, { leading: false })
    );

    act(() => {
      result.current("a");
      result.current("b");
    });
    expect(fn).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("b");
  });

  it("invokes on every call when the interval is zero", () => {
    const fn = vi.fn();
    const { result } = renderHook(() =>
      useThrottledCallback(fn, 0, { trailing: false })
    );
    act(() => {
      result.current();
      result.current();
      result.current();
    });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("paces sustained calls to one invocation per interval", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(fn, 100));

    // 1 call every 10ms for 500ms.
    for (let t = 0; t < 50; t += 1) {
      act(() => {
        result.current(t);
        vi.advanceTimersByTime(10);
      });
    }
    act(() => vi.advanceTimersByTime(100));
    // Leading call plus one per 100ms window across 500ms.
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(fn.mock.calls.length).toBeLessThanOrEqual(6);
    expect(fn).toHaveBeenLastCalledWith(49);
  });

  it("supports cancel and flush, and clears its timer on unmount", () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useThrottledCallback(fn, 100));

    act(() => {
      result.current("lead");
      result.current("tail");
    });
    act(() => result.current.flush());
    expect(fn).toHaveBeenLastCalledWith("tail");

    act(() => vi.advanceTimersByTime(100));
    act(() => {
      result.current("lead2");
      result.current("dropped");
    });
    act(() => result.current.cancel());
    act(() => vi.advanceTimersByTime(200));
    expect(fn).not.toHaveBeenCalledWith("dropped");

    act(() => {
      result.current("x");
      result.current("y");
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("useThrottle", () => {
  it("applies the first change immediately and the latest change when the window closes", () => {
    const { result, rerender } = renderHook(({ v }) => useThrottle(v, 100), {
      initialProps: { v: 0 },
    });
    expect(result.current).toBe(0);

    act(() => vi.advanceTimersByTime(100));
    rerender({ v: 1 });
    expect(result.current).toBe(1);

    rerender({ v: 2 });
    rerender({ v: 3 });
    expect(result.current).toBe(1);

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe(3);
  });

  it("clears its timer on unmount", () => {
    const { rerender, unmount } = renderHook(({ v }) => useThrottle(v, 100), {
      initialProps: { v: 0 },
    });
    rerender({ v: 1 });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
