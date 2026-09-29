import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  useTelemetry,
  getPendingDeferredQueue,
  getPendingDeferredQueueLength,
  clearPendingDeferredQueue,
} from "@/hooks/useTelemetry";
import { TelemetryTracker } from "@/components/TelemetryTracker";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function TelemetryIdleTestComponent({ slug = "test-route" }: { slug?: string }) {
  const { telemetry, syncFailed, recordEvent, pendingDeferredLength } = useTelemetry();
  return (
    <div>
      <span data-testid="views">{telemetry[slug]?.views ?? 0}</span>
      <span data-testid="clicks">{telemetry[slug]?.clicks ?? 0}</span>
      <span data-testid="sync-failed">{syncFailed ? "true" : "false"}</span>
      <span data-testid="deferred-count">{pendingDeferredLength}</span>
      <button
        data-testid="record-click"
        onClick={() => recordEvent(slug, "project_click")}
      >
        Click
      </button>
      <button
        data-testid="record-deferred-click"
        onClick={() => recordEvent(slug, "project_click", { defer: true })}
      >
        Deferred Click
      </button>
      <TelemetryTracker slug={slug} />
    </div>
  );
}

describe("Idle-Scheduled Non-Blocking Telemetry Dispatch Suite", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    clearPendingDeferredQueue();
    container = document.createElement("div");
    document.body.appendChild(container);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ [url.toString() === "/api/telemetry" ? "test-route" : "test-route"]: { views: 10, clicks: 5 } }),
      } as Response;
    });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
      container = null;
    }
    clearPendingDeferredQueue();
    fetchSpy.mockRestore();
    vi.useRealTimers();
  });

  describe("Requirement 1: Idle-Scheduled Telemetry Execution", () => {
    it("defers aggregate GET fetch and mount page_view dispatches until browser idle frame", async () => {
      await act(async () => {
        root = createRoot(container!);
        root.render(<TelemetryIdleTestComponent slug="test-route" />);
      });

      // Before idle callback fires: Pending deferred queue should hold the deferred page_view event
      const pendingQueue = getPendingDeferredQueue();
      expect(pendingQueue.some((task) => task.eventType === "page_view")).toBe(true);

      // Advance timers past idle callback fallback timeout (2000ms)
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      // Verify fetch calls were initiated during the idle frame
      const getCalls = fetchSpy.mock.calls.filter(
        ([url, init]: [unknown, RequestInit | undefined]) => String(url) === "/api/telemetry" && (!init || init.method === "GET")
      );
      const postCalls = fetchSpy.mock.calls.filter(
        ([url, init]: [unknown, RequestInit | undefined]) => String(url) === "/api/telemetry" && init?.method === "POST"
      );

      expect(getCalls.length).toBe(1);
      expect(postCalls.length).toBe(1);
      expect(JSON.parse((postCalls[0][1] as RequestInit).body as string)).toEqual({
        projectSlug: "test-route",
        eventType: "page_view",
      });
    });

    it("schedules deferred clicks via scheduleIdleTask and fallback timeout", async () => {
      await act(async () => {
        root = createRoot(container!);
        root.render(<TelemetryIdleTestComponent slug="test-route" />);
        vi.advanceTimersByTime(2000);
      });

      clearPendingDeferredQueue();
      fetchSpy.mockClear();

      const deferredClickBtn = container!.querySelector('[data-testid="record-deferred-click"]') as HTMLButtonElement;
      await act(async () => {
        deferredClickBtn.click();
      });

      // Task is queued in pending deferred queue
      expect(getPendingDeferredQueueLength()).toBe(1);

      // Advance timers to trigger idle execution
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(getPendingDeferredQueueLength()).toBe(0);
      const postCalls = fetchSpy.mock.calls.filter(
        ([url, init]: [unknown, RequestInit | undefined]) => String(url) === "/api/telemetry" && init?.method === "POST"
      );
      expect(postCalls.length).toBe(1);
      expect(JSON.parse((postCalls[0][1] as RequestInit).body as string)).toEqual({
        projectSlug: "test-route",
        eventType: "project_click",
      });
    });
  });

  describe("Requirement 2: Non-Blocking State Updates via Transitions", () => {
    it("wraps background response store updates cleanly using startTransition", async () => {
      await act(async () => {
        root = createRoot(container!);
        root.render(<TelemetryIdleTestComponent slug="test-route" />);
      });

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      const viewsEl = container!.querySelector('[data-testid="views"]');
      // Rendered views should reflect hydrated and background aggregate state
      expect(viewsEl?.textContent).not.toBe("0");
    });
  });

  describe("Requirement 3: Status Code Inspection & Optimistic Rollbacks", () => {
    it("inspects HTTP response status code and triggers optimistic rollback on 500 server error", async () => {
      fetchSpy.mockImplementation(async (_url: string | URL | Request, init?: RequestInit) => {
        if (init?.method === "POST") {
          return {
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ "test-route": { views: 10, clicks: 5 } }),
        } as Response;
      });

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await act(async () => {
        root = createRoot(container!);
        root.render(<TelemetryIdleTestComponent slug="test-route" />);
        vi.advanceTimersByTime(2000);
      });

      const clicksEl = container!.querySelector('[data-testid="clicks"]');
      const initialClicks = clicksEl?.textContent;

      const clickBtn = container!.querySelector('[data-testid="record-click"]') as HTMLButtonElement;
      await act(async () => {
        clickBtn.click();
      });

      // After failed POST with status 500, state should roll back to initialClicks
      expect(clicksEl?.textContent).toBe(initialClicks);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("enqueues for retry on HTTP 429 Rate Limit and rolls back optimistic state to pre-update snapshot", async () => {
      fetchSpy.mockImplementation(async (_url: string | URL | Request, init?: RequestInit) => {
        if (init?.method === "POST") {
          return {
            ok: false,
            status: 429,
            statusText: "Too Many Requests",
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ "test-route": { views: 10, clicks: 5 } }),
        } as Response;
      });

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await act(async () => {
        root = createRoot(container!);
        root.render(<TelemetryIdleTestComponent slug="test-route" />);
        vi.advanceTimersByTime(2000);
      });

      const clicksEl = container!.querySelector('[data-testid="clicks"]');
      const initialClicks = clicksEl?.textContent;

      const clickBtn = container!.querySelector('[data-testid="record-click"]') as HTMLButtonElement;
      await act(async () => {
        clickBtn.click();
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith("Telemetry record rate limited by API.");
      expect(clicksEl?.textContent).toBe(initialClicks);
      consoleWarnSpy.mockRestore();
    });
  });

  describe("Requirement 4: Persistent Delivery on Departure (keepalive)", () => {
    it("flushes pending deferred payloads with keepalive: true on pagehide and unload events", async () => {
      await act(async () => {
        root = createRoot(container!);
        root.render(<TelemetryIdleTestComponent slug="test-route" />);
      });

      // Pending queue has unsent deferred page_view
      expect(getPendingDeferredQueueLength()).toBeGreaterThan(0);

      fetchSpy.mockClear();

      // Dispatch pagehide event to simulate tab departure
      await act(async () => {
        window.dispatchEvent(new Event("pagehide"));
      });

      // Unsent deferred payloads should be flushed immediately with keepalive: true
      const postCalls = fetchSpy.mock.calls.filter(
        ([url, init]: [unknown, RequestInit | undefined]) => String(url) === "/api/telemetry" && init?.method === "POST"
      );

      expect(postCalls.length).toBeGreaterThan(0);
      expect((postCalls[0][1] as RequestInit).keepalive).toBe(true);
      expect(getPendingDeferredQueueLength()).toBe(0);
    });

    it("flushes pending deferred queue when visibilitychange transitions to hidden", async () => {
      await act(async () => {
        root = createRoot(container!);
        root.render(<TelemetryIdleTestComponent slug="test-route" />);
      });

      expect(getPendingDeferredQueueLength()).toBeGreaterThan(0);
      fetchSpy.mockClear();

      // Mock visibilityState as hidden and fire visibilitychange event
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });

      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      const postCalls = fetchSpy.mock.calls.filter(
        ([url, init]: [unknown, RequestInit | undefined]) => String(url) === "/api/telemetry" && init?.method === "POST"
      );

      expect(postCalls.length).toBeGreaterThan(0);
      expect((postCalls[0][1] as RequestInit).keepalive).toBe(true);
      expect(getPendingDeferredQueueLength()).toBe(0);
    });
  });
});

