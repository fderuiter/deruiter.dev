/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type MockStorage, resetMockStorage } from "./helpers/storage-mock";

// Configure React 19 act environment
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  useTelemetry,
  clearRetryQueue,
  setQueueCapacity,
  getQueueCapacity,
  getRetryQueueLength,
  type UseTelemetryOptions,
} from "@/hooks/useTelemetry";

describe("useTelemetry Hook - Contract & Public Signature Test Suite", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mockStorage: MockStorage;
  let fetchMock: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockStorage = resetMockStorage();

    container = document.createElement("div");
    document.body.appendChild(container);

    fetchMock = vi.fn().mockImplementation(async (_url: string, init?: any) => {
      if (init?.method === "POST") {
        return {
          ok: true,
          status: 201,
          json: async () => ({ success: true }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          "test-project": { views: 10, clicks: 5 },
        }),
      };
    });
    globalThis.fetch = fetchMock;

    clearRetryQueue();
    setQueueCapacity(50);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("exposes the complete public hook return signature", async () => {
    let hookResult: any;

    const TestComponent = ({ options }: { options?: UseTelemetryOptions }) => {
      hookResult = useTelemetry(options);
      return (
        <div>
          <span data-testid="views">
            {hookResult.telemetry["test-project"]?.views ?? 0}
          </span>
          <span data-testid="clicks">
            {hookResult.telemetry["test-project"]?.clicks ?? 0}
          </span>
          <span data-testid="sync-failed">
            {hookResult.syncFailed ? "true" : "false"}
          </span>
          <span data-testid="queue-len">{hookResult.queueLength}</span>
          <span data-testid="queue-cap">{hookResult.queueCapacity}</span>
          <span data-testid="deferred-len">
            {hookResult.pendingDeferredLength}
          </span>
        </div>
      );
    };

    await act(async () => {
      root = createRoot(container);
      root.render(<TestComponent options={{ maxQueueCapacity: 25 }} />);
    });

    // Verify all properties of public hook return signature exist and match contracts
    expect(hookResult).toBeDefined();
    expect(typeof hookResult.telemetry).toBe("object");
    expect(typeof hookResult.syncFailed).toBe("boolean");
    expect(typeof hookResult.recordEvent).toBe("function");
    expect(typeof hookResult.refetch).toBe("function");
    expect(typeof hookResult.queueLength).toBe("number");
    expect(typeof hookResult.queueCapacity).toBe("number");
    expect(typeof hookResult.pendingDeferredLength).toBe("number");

    expect(hookResult.queueCapacity).toBe(25);
    expect(hookResult.queueLength).toBe(0);
    expect(hookResult.pendingDeferredLength).toBe(0);
    expect(hookResult.syncFailed).toBe(false);
  });

  it("hydrates state from LocalStorage on mount without hydration errors", async () => {
    mockStorage.setItem(
      "portfolio_telemetry_cache",
      JSON.stringify({
        "test-project": { views: 42, clicks: 12 },
      })
    );

    let hookResult: any;
    const TestComponent = () => {
      hookResult = useTelemetry();
      return (
        <div>
          <span data-testid="views">
            {hookResult.telemetry["test-project"]?.views ?? 0}
          </span>
          <span data-testid="clicks">
            {hookResult.telemetry["test-project"]?.clicks ?? 0}
          </span>
        </div>
      );
    };

    await act(async () => {
      root = createRoot(container);
      root.render(<TestComponent />);
    });

    const viewsEl = container.querySelector('[data-testid="views"]');
    const clicksEl = container.querySelector('[data-testid="clicks"]');

    expect(viewsEl?.textContent).toBe("42");
    expect(clicksEl?.textContent).toBe("12");

    // Advance timers for background SWR fetch to update from GET /api/telemetry
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(viewsEl?.textContent).toBe("10");
    expect(clicksEl?.textContent).toBe("5");
  });

  it("optimistically increments views and clicks immediately on recordEvent", async () => {
    let hookResult: any;
    const TestComponent = () => {
      hookResult = useTelemetry();
      return (
        <div>
          <span data-testid="views">
            {hookResult.telemetry["test-project"]?.views ?? 0}
          </span>
          <span data-testid="clicks">
            {hookResult.telemetry["test-project"]?.clicks ?? 0}
          </span>
        </div>
      );
    };

    await act(async () => {
      root = createRoot(container);
      root.render(<TestComponent />);
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Record page view
    await act(async () => {
      await hookResult.recordEvent("test-project", "page_view");
    });

    expect(hookResult.telemetry["test-project"].views).toBe(11);
    expect(hookResult.telemetry["test-project"].clicks).toBe(5);

    // Record project click
    await act(async () => {
      await hookResult.recordEvent("test-project", "project_click");
    });

    expect(hookResult.telemetry["test-project"].views).toBe(11);
    expect(hookResult.telemetry["test-project"].clicks).toBe(6);
  });

  it("rolls back optimistic updates on 429 rate limit", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: any) => {
      if (init?.method === "POST") {
        return { ok: false, status: 429, statusText: "Too Many Requests" };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ "test-project": { views: 50, clicks: 20 } }),
      };
    });

    let hookResult: any;
    const TestComponent = () => {
      hookResult = useTelemetry();
      return (
        <div data-testid="views">
          {hookResult.telemetry["test-project"]?.views ?? 0}
        </div>
      );
    };

    await act(async () => {
      root = createRoot(container);
      root.render(<TestComponent />);
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(hookResult.telemetry["test-project"].views).toBe(50);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await act(async () => {
      await hookResult.recordEvent("test-project", "page_view");
    });

    // Must be rolled back to 50
    expect(hookResult.telemetry["test-project"].views).toBe(50);
    expect(warnSpy).toHaveBeenCalledWith(
      "Telemetry record rate limited by API."
    );
    warnSpy.mockRestore();
  });

  it("delegates capacity and queue metrics to TelemetryOutbox", () => {
    expect(getQueueCapacity()).toBe(50);
    setQueueCapacity(10);
    expect(getQueueCapacity()).toBe(10);
    expect(getRetryQueueLength()).toBe(0);
  });
});
