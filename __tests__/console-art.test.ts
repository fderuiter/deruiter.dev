// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

// Since Vitest hoists vi.mock(), variables accessed inside must start with 'mock'
let mockEffectCallback: (() => void) | null = null;

vi.mock("react", async (importOriginal) => {
  const original = await importOriginal<typeof import("react")>();
  return {
    ...original,
    useEffect: vi.fn((cb: any) => {
      mockEffectCallback = cb;
    }),
  };
});

// Define global.window to prevent environment checks from throwing
(global as any).window = {
  requestIdleCallback: vi.fn((cb: any) => {
    cb();
    return 123;
  }),
  cancelIdleCallback: vi.fn(),
};

import { useConsoleArt } from "@/hooks/useConsoleArt";

describe("useConsoleArt Hook", () => {
  const originalFetch = global.fetch;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  let consoleLogMock: ReturnType<typeof vi.fn>;
  let consoleErrorMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockEffectCallback = null;
    (window as any).requestIdleCallback = vi.fn((cb: any) => {
      cb();
      return 123;
    });
    (window as any).cancelIdleCallback = vi.fn();

    consoleLogMock = vi.fn();
    consoleErrorMock = vi.fn();
    console.log = consoleLogMock as any;
    console.error = consoleErrorMock as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    vi.clearAllMocks();
  });

  it("should schedule and log console art on idle success directly", async () => {
    global.fetch = vi.fn();

    // Call the hook to register the effect callback
    useConsoleArt();

    // Verify useEffect was called and we captured the callback
    expect(mockEffectCallback).toBeTypeOf("function");

    // Manually trigger the effect callback
    mockEffectCallback!();

    expect(window.requestIdleCallback).toHaveBeenCalled();

    // Wait for the final log assertion to be true
    await vi.waitFor(() => {
      expect(consoleLogMock).toHaveBeenCalled();
      const printed = consoleLogMock.mock.calls[0][0];
      expect(printed).toContain("_______");
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(consoleErrorMock).not.toHaveBeenCalled();
  });

  it("should not make any network fetch requests to get console art", async () => {
    global.fetch = vi.fn();

    useConsoleArt();
    expect(mockEffectCallback).toBeTypeOf("function");
    mockEffectCallback!();

    expect(window.requestIdleCallback).toHaveBeenCalled();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(consoleErrorMock).not.toHaveBeenCalled();
  });

  it("should fall back to setTimeout if requestIdleCallback is not available in window", async () => {
    // Temporarily delete requestIdleCallback from window
    delete (window as any).requestIdleCallback;

    vi.useFakeTimers();
    global.fetch = vi.fn();

    useConsoleArt();
    expect(mockEffectCallback).toBeTypeOf("function");
    mockEffectCallback!();

    // Fast-forward timers
    vi.advanceTimersByTime(1);
    vi.useRealTimers();

    // Wait for the final log assertion to be true
    await vi.waitFor(() => {
      expect(consoleLogMock).toHaveBeenCalled();
      const printed = consoleLogMock.mock.calls[0][0];
      expect(printed).toContain("_______");
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(consoleErrorMock).not.toHaveBeenCalled();
  });
});
