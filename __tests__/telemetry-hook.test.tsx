/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Configure React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }
}

describe("useTelemetry Hook Integration & Isolation", () => {
  let container: HTMLDivElement;
  let root: Root;
  let useTelemetry: any;
  let fetchMock: any;
  let mockStorage: LocalStorageMock;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();

    mockStorage = new LocalStorageMock();
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    // Dynamically import to ensure clean isolated module state
    const importedModule = await import("@/hooks/useTelemetry");
    useTelemetry = importedModule.useTelemetry;
    importedModule.clearRetryQueue();

    container = document.createElement("div");
    document.body.appendChild(container);

    // Mock global fetch
    fetchMock = vi.fn().mockImplementation(async (url: string, init?: any) => {
      if (init?.method === "POST") {
        return {
          ok: true,
          status: 201,
          json: async () => ({ success: true }),
        };
      }
      // GET response (default)
      return {
        ok: true,
        status: 200,
        json: async () => ({
          "project-abc": { views: 5, clicks: 10 },
        }),
      };
    });
    globalThis.fetch = fetchMock;

    // Clear localStorage
    mockStorage.clear();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    document.body.removeChild(container);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // Helper test component
  const TelemetryTestComponent = ({
    onHookValue,
  }: {
    onHookValue: (val: any) => void;
  }) => {
    const hookData = useTelemetry();
    onHookValue(hookData);
    return (
      <div>
        <div data-testid="views">
          {hookData.telemetry["project-abc"]?.views ?? 0}
        </div>
        <div data-testid="sync-status">
          {hookData.syncFailed ? "failed" : "ok"}
        </div>
        <button
          data-testid="record-btn"
          onClick={() => hookData.recordEvent("project-abc", "page_view")}
        >
          Record View
        </button>
      </div>
    );
  };

  it("should hydrate state correctly from localstorage cache first", async () => {
    // Populate local cache beforehand
    localStorage.setItem(
      "portfolio_telemetry_cache",
      JSON.stringify({
        "project-abc": { views: 42, clicks: 84 },
      })
    );

    // Controlled background GET promise
    let resolveGet: any;
    const getPromise = new Promise((resolve) => {
      resolveGet = resolve;
    });
    fetchMock.mockImplementationOnce(async (url: string, init?: any) => {
      await getPromise;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          "project-abc": { views: 5, clicks: 10 },
        }),
      };
    });

    let hookResult: any;
    await act(async () => {
      root = createRoot(container);
      root.render(
        <TelemetryTestComponent
          onHookValue={(val) => {
            hookResult = val;
          }}
        />
      );
    });

    // Check immediate hydration from localStorage
    const viewsEl = container.querySelector('[data-testid="views"]');
    expect(viewsEl?.textContent).toBe("42");

    // Let background fetch resolve and verify update
    await act(async () => {
      vi.advanceTimersByTime(2000);
      resolveGet();
    });

    // Fetch returns 5 views, which merges/updates globalTelemetryData
    expect(viewsEl?.textContent).toBe("5");
    expect(localStorage.getItem("portfolio_telemetry_cache")).toContain(
      '"views":5'
    );
  });

  it("should trigger optimistic UI updates immediately before server POST completes", async () => {
    let hookResult: any;
    await act(async () => {
      root = createRoot(container);
      root.render(
        <TelemetryTestComponent
          onHookValue={(val) => {
            hookResult = val;
          }}
        />
      );
    });

    const viewsEl = container.querySelector('[data-testid="views"]');
    // Before click, wait for background fetch to resolve
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(viewsEl?.textContent).toBe("5");

    // Setup fetch mock to take longer so we can check optimistic state
    let resolvePost: any;
    const postPromise = new Promise((resolve) => {
      resolvePost = resolve;
    });
    fetchMock.mockImplementationOnce(async (url: string, init?: any) => {
      if (init?.method === "POST") {
        await postPromise;
        return { ok: true, status: 201, json: async () => ({ success: true }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    // Trigger record event
    const recordBtn = container.querySelector(
      '[data-testid="record-btn"]'
    ) as HTMLButtonElement;
    await act(async () => {
      recordBtn.click();
    });

    // Optimistic update: Views should IMMEDIATELY increment to 6 before POST resolves
    expect(viewsEl?.textContent).toBe("6");
    expect(
      JSON.parse(localStorage.getItem("portfolio_telemetry_cache")!)
    ).toEqual({ "project-abc": { views: 6, clicks: 10 } });

    // Now resolve the POST promise
    await act(async () => {
      resolvePost();
    });
  });

  it("should fall back gracefully and not crash when localStorage throws errors", async () => {
    // Mock localStorage to throw error on setItem
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("AccessDenied");
    });

    let hookResult: any;
    await act(async () => {
      root = createRoot(container);
      root.render(
        <TelemetryTestComponent
          onHookValue={(val) => {
            hookResult = val;
          }}
        />
      );
    });

    const viewsEl = container.querySelector('[data-testid="views"]');
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(viewsEl?.textContent).toBe("5");

    // Click record event
    const recordBtn = container.querySelector(
      '[data-testid="record-btn"]'
    ) as HTMLButtonElement;
    await act(async () => {
      recordBtn.click();
    });

    // State still updates to 6 optimistically, despite localStorage throwing
    expect(viewsEl?.textContent).toBe("6");
  });

  it("should handle project_click events, rate limits, and network errors in recordEvent", async () => {
    let hookResult: any;
    await act(async () => {
      root = createRoot(container);
      root.render(
        <TelemetryTestComponent
          onHookValue={(val) => {
            hookResult = val;
          }}
        />
      );
    });

    // Resolve initial fetch GET
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // 1. Test project_click
    await act(async () => {
      await hookResult.recordEvent("project-abc", "project_click");
    });
    expect(hookResult.telemetry["project-abc"].clicks).toBe(11);

    // 2. Test rate limit (429) branch
    fetchMock.mockImplementationOnce(async () => {
      return { ok: false, status: 429 };
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await act(async () => {
      await hookResult.recordEvent("project-abc", "page_view");
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "Telemetry record rate limited by API."
    );
    warnSpy.mockRestore();

    // 3. Test generic fetch error (500) branch
    fetchMock.mockImplementationOnce(async () => {
      return { ok: false, status: 500 };
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      await hookResult.recordEvent("project-abc", "page_view");
    });
    expect(hookResult.syncFailed).toBe(true);
    errorSpy.mockRestore();
  });

  it("should sanitize telemetry console errors and warnings when simulated in production, and keep them full in development", async () => {
    const originalEnv = process.env.NODE_ENV;

    try {
      // 1. Simulate Production Environment
      (process.env as any).NODE_ENV = "production";

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Simulate rate limiting or sync failure in recordEvent
      fetchMock.mockImplementationOnce(async () => {
        return new Response(
          JSON.stringify({
            error:
              "POST request failed on server at /app/api/telemetry/route.ts",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      });

      let hookResult: any;
      await act(async () => {
        root = createRoot(container);
        root.render(
          <TelemetryTestComponent
            onHookValue={(val) => {
              hookResult = val;
            }}
          />
        );
      });

      // Advance timers to trigger background fetch (SWR)
      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Trigger record event to cause an optimistic sync persistence failure
      await act(async () => {
        await hookResult.recordEvent("project-abc", "page_view");
      });

      // Verify console.error was called with a sanitized error object (no "/app/api/telemetry" path)
      expect(errorSpy).toHaveBeenCalled();
      const lastErrorCallArgs =
        errorSpy.mock.calls[errorSpy.mock.calls.length - 1];
      const errorObj = lastErrorCallArgs[1];
      expect(errorObj).toBeInstanceOf(Error);
      expect(errorObj.message).toContain("[scrubbed]");
      expect(errorObj.message).not.toContain("/app");

      errorSpy.mockClear();

      // 2. Simulate Local Development Environment
      (process.env as any).NODE_ENV = "development";

      fetchMock.mockImplementationOnce(async () => {
        return new Response(
          JSON.stringify({
            error:
              "POST request failed on server at /app/api/telemetry/route.ts",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      });

      await act(async () => {
        await hookResult.recordEvent("project-abc", "page_view");
      });

      // Verify console.error was called with raw, unmodified error
      expect(errorSpy).toHaveBeenCalled();
      const devErrorCallArgs =
        errorSpy.mock.calls[errorSpy.mock.calls.length - 1];
      const devErrorObj = devErrorCallArgs[1];
      expect(devErrorObj).toBeInstanceOf(Error);
      expect(devErrorObj.message).toContain("/app");
      expect(devErrorObj.message).not.toContain("[scrubbed]");

      errorSpy.mockRestore();
      warnSpy.mockRestore();
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
    }
  });

  it("should sanitize local storage caught warnings in production and keep them raw in development", async () => {
    const originalEnv = process.env.NODE_ENV;

    try {
      // Mock localStorage to throw error on setItem with an absolute path
      vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceeded at /Users/runner/workspace/cache.ts");
      });

      // 1. Simulate Production Environment
      (process.env as any).NODE_ENV = "production";
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      let hookResult: any;
      await act(async () => {
        root = createRoot(container);
        root.render(
          <TelemetryTestComponent
            onHookValue={(val) => {
              hookResult = val;
            }}
          />
        );
      });

      // Click record event to trigger local storage write
      const recordBtn = container.querySelector(
        '[data-testid="record-btn"]'
      ) as HTMLButtonElement;
      await act(async () => {
        recordBtn.click();
      });

      expect(warnSpy).toHaveBeenCalled();
      const lastWarnCallArgs =
        warnSpy.mock.calls[warnSpy.mock.calls.length - 1];
      const warnObj = lastWarnCallArgs[1];
      expect(warnObj).toBeInstanceOf(Error);
      expect(warnObj.message).toContain("[scrubbed]");
      expect(warnObj.message).not.toContain("/Users/runner");

      warnSpy.mockClear();

      // 2. Simulate Local Development Environment
      (process.env as any).NODE_ENV = "development";

      await act(async () => {
        recordBtn.click();
      });

      expect(warnSpy).toHaveBeenCalled();
      const devWarnCallArgs = warnSpy.mock.calls[warnSpy.mock.calls.length - 1];
      const devWarnObj = devWarnCallArgs[1];
      expect(devWarnObj).toBeInstanceOf(Error);
      expect(devWarnObj.message).toContain("/Users/runner");
      expect(devWarnObj.message).not.toContain("[scrubbed]");

      warnSpy.mockRestore();
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
    }
  });

  it("should evaluate telemetry state snapshot queries strictly in-memory without synchronous storage reads during component rendering", async () => {
    const getItemSpy = vi.spyOn(window.localStorage, "getItem");

    let renderCount = 0;
    const PureRenderComponent = () => {
      renderCount++;
      const { telemetry } = useTelemetry();
      return (
        <div data-testid="telemetry-views">
          {telemetry["project-abc"]?.views ?? 0}
        </div>
      );
    };

    getItemSpy.mockClear();

    await act(async () => {
      root = createRoot(container);
      root.render(<PureRenderComponent />);
    });

    // Clear calls from subscription phase
    getItemSpy.mockClear();

    // Re-render component without triggering external storage changes
    await act(async () => {
      root.render(<PureRenderComponent />);
    });

    expect(renderCount).toBeGreaterThan(1);
    // During pure render evaluation, getSnapshot MUST NOT call localStorage.getItem
    expect(getItemSpy).not.toHaveBeenCalled();
  });

  it("should deduplicate concurrent aggregate fetch requests across multiple mounting components", async () => {
    let resolveGet: any;
    const pendingGet = new Promise((resolve) => {
      resolveGet = resolve;
    });

    fetchMock.mockImplementation(async (url: string, init?: any) => {
      if (url === "/api/telemetry" && (!init || init.method === "GET")) {
        await pendingGet;
        return {
          ok: true,
          status: 200,
          json: async () => ({ "project-abc": { views: 15, clicks: 30 } }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    function WidgetA() {
      useTelemetry();
      return <div>Widget A</div>;
    }

    function WidgetB() {
      useTelemetry();
      return <div>Widget B</div>;
    }

    function WidgetC() {
      useTelemetry();
      return <div>Widget C</div>;
    }

    await act(async () => {
      root = createRoot(container);
      root.render(
        <div>
          <WidgetA />
          <WidgetB />
          <WidgetC />
        </div>
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Verify GET fetch was initiated exactly once for all 3 components
    const getCalls = fetchMock.mock.calls.filter(
      ([url, init]: [string, any]) =>
        url === "/api/telemetry" && (!init || init.method === "GET")
    );
    expect(getCalls.length).toBe(1);

    // Resolve the single in-flight fetch
    await act(async () => {
      resolveGet();
    });
  });

  it("should enforce throttling cooldown timer between aggregate telemetry fetches", async () => {
    let callCount = 0;
    fetchMock.mockImplementation(async (url: string, init?: any) => {
      if (url === "/api/telemetry" && (!init || init.method === "GET")) {
        callCount++;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            "project-abc": { views: callCount * 10, clicks: 0 },
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    let hookResult: any;
    await act(async () => {
      root = createRoot(container);
      root.render(
        <TelemetryTestComponent
          onHookValue={(val) => {
            hookResult = val;
          }}
        />
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(callCount).toBe(1);

    // Call refetch immediately within 5000ms cooldown
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await hookResult.refetch();
    });

    // Should NOT have made a new network call
    expect(callCount).toBe(1);

    // Advance past the 5000ms cooldown window (total 6000ms)
    await act(async () => {
      vi.advanceTimersByTime(4000);
      await hookResult.refetch();
    });

    // Should now make a second network call
    expect(callCount).toBe(2);
  });

  it("should flush queued retry events with keepalive on page visibility change and unload lifecycle events", async () => {
    let hookResult: any;
    await act(async () => {
      root = createRoot(container);
      root.render(
        <TelemetryTestComponent
          onHookValue={(val) => {
            hookResult = val;
          }}
        />
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    // Simulate network error to enqueue an unsynced event for retry
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError("Failed to fetch");
    });

    const errorSpy1 = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      await hookResult.recordEvent("project-abc", "page_view");
    });
    errorSpy1.mockRestore();

    // Setup fetch mock for flushing
    const postCallsWithKeepalive: any[] = [];
    fetchMock.mockImplementation(async (url: string, init?: any) => {
      if (init?.method === "POST") {
        postCallsWithKeepalive.push(init);
        return { ok: true, status: 201, json: async () => ({ success: true }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    // Dispatch pagehide lifecycle event
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });

    // Verify queued retry was processed with keepalive: true
    expect(postCallsWithKeepalive.length).toBe(1);
    expect(postCallsWithKeepalive[0].keepalive).toBe(true);

    // Test visibilitychange when visibilityState is 'hidden'
    // First, enqueue another network-failed event
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError("Failed to fetch");
    });

    const errorSpy2 = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      await hookResult.recordEvent("project-abc", "project_click");
    });
    errorSpy2.mockRestore();

    postCallsWithKeepalive.length = 0;

    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      writable: true,
      configurable: true,
    });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(postCallsWithKeepalive.length).toBe(1);
    expect(postCallsWithKeepalive[0].keepalive).toBe(true);
  });

  it("should capture pre-update state snapshot and revert store and local storage cache on network failure", async () => {
    // Populate local cache with initial multi-project state
    const initialCache = {
      "project-abc": { views: 12, clicks: 3 },
      "project-xyz": { views: 40, clicks: 15 },
    };
    mockStorage.setItem(
      "portfolio_telemetry_cache",
      JSON.stringify(initialCache)
    );

    let hookResult: any;
    await act(async () => {
      root = createRoot(container);
      root.render(
        <TelemetryTestComponent
          onHookValue={(val) => {
            hookResult = val;
          }}
        />
      );
    });

    // Mock network fetch to fail with TypeError (Network failure)
    fetchMock.mockImplementation(async (url: string, init?: any) => {
      if (init?.method === "POST") {
        throw new TypeError("Failed to fetch");
      }
      return { ok: true, json: async () => initialCache };
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    const viewsEl = container.querySelector('[data-testid="views"]');
    expect(viewsEl?.textContent).toBe("12");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      await hookResult.recordEvent("project-abc", "page_view");
    });

    // Advance timers asynchronously to exhaust exponential backoff retries and microtasks
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Active state and UI should be fully restored to pre-update snapshot
    expect(viewsEl?.textContent).toBe("12");
    expect(hookResult.telemetry["project-abc"]).toEqual({
      views: 12,
      clicks: 3,
    });
    expect(hookResult.telemetry["project-xyz"]).toEqual({
      views: 40,
      clicks: 15,
    });

    // Local Storage cache must also match the restored pre-update snapshot
    const persistedCache = JSON.parse(
      mockStorage.getItem("portfolio_telemetry_cache") || "{}"
    );
    expect(persistedCache).toEqual(initialCache);
    expect(hookResult.syncFailed).toBe(true);

    errorSpy.mockRestore();
  });

  it("should capture pre-update state snapshot and revert store and local storage cache on 429 rate limit status", async () => {
    const initialCache = {
      "project-abc": { views: 100, clicks: 50 },
    };
    mockStorage.setItem(
      "portfolio_telemetry_cache",
      JSON.stringify(initialCache)
    );

    let hookResult: any;
    await act(async () => {
      root = createRoot(container);
      root.render(
        <TelemetryTestComponent
          onHookValue={(val) => {
            hookResult = val;
          }}
        />
      );
    });

    // Mock POST to return 429
    fetchMock.mockImplementation(async (url: string, init?: any) => {
      if (init?.method === "POST") {
        return { ok: false, status: 429, statusText: "Too Many Requests" };
      }
      return { ok: true, json: async () => initialCache };
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await act(async () => {
      await hookResult.recordEvent("project-abc", "project_click");
    });

    // React state & UI must be restored to pre-update values
    expect(hookResult.telemetry["project-abc"]).toEqual({
      views: 100,
      clicks: 50,
    });

    // Local storage cache must match reverted values with zero residual bloat
    const persistedCache = JSON.parse(
      mockStorage.getItem("portfolio_telemetry_cache") || "{}"
    );
    expect(persistedCache).toEqual(initialCache);

    expect(warnSpy).toHaveBeenCalledWith(
      "Telemetry record rate limited by API."
    );
    warnSpy.mockRestore();
  });
});
