/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type MockStorage, resetMockStorage } from "./helpers/storage-mock";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { usePersistentState } from "@/hooks/usePersistentState";
import { NextRequest } from "next/server";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const {
  mockLpush,
  mockExpire,
  mockExec,
  mockRpop,
  mockLmove,
  mockLrem,
  mockLrange,
  mockDel,
  mockCreateMany,
} = vi.hoisted(() => ({
  mockLpush: vi.fn(),
  mockExpire: vi.fn(),
  mockExec: vi.fn(),
  mockRpop: vi.fn(),
  mockLmove: vi.fn(),
  mockLrem: vi.fn(),
  mockLrange: vi.fn().mockResolvedValue([]),
  mockDel: vi.fn(),
  mockCreateMany: vi.fn(),
}));

vi.mock("@upstash/redis", () => {
  class MockRedis {
    pipeline() {
      return {
        rpop: mockRpop,
        lpush: mockLpush,
        expire: mockExpire,
        exec: mockExec,
        lmove: mockLmove,
        lrem: mockLrem,
      };
    }
    lrange = mockLrange;
    del = mockDel;
  }
  return { Redis: MockRedis };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    telemetryEvent: {
      createMany: mockCreateMany,
    },
  },
}));

import { GET as syncRouteHandler } from "@/app/api/telemetry/sync/route";

describe("Concurrency & State Synchronization Guardrail Suite", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = resetMockStorage();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    vi.restoreAllMocks();
  });

  describe("usePersistentState useSyncExternalStore Concurrency", () => {
    function SiblingComponentA({ storageKey }: { storageKey: string }) {
      const [val, setVal] = usePersistentState(storageKey, "initial");
      return (
        <div>
          <span data-testid="val-a">{val}</span>
          <button data-testid="btn-a" onClick={() => setVal("from_a")} />
        </div>
      );
    }

    function SiblingComponentB({ storageKey }: { storageKey: string }) {
      const [val, setVal] = usePersistentState(storageKey, "initial");
      return (
        <div>
          <span data-testid="val-b">{val}</span>
          <button data-testid="btn-b" onClick={() => setVal("from_b")} />
        </div>
      );
    }

    function CombinedTest({ storageKey }: { storageKey: string }) {
      return (
        <div>
          <SiblingComponentA storageKey={storageKey} />
          <SiblingComponentB storageKey={storageKey} />
        </div>
      );
    }

    it("synchronizes multi-instance sibling components in the same window without tearing", async () => {
      await act(async () => {
        root.render(<CombinedTest storageKey="shared_setting" />);
      });

      expect(
        container.querySelector('[data-testid="val-a"]')?.textContent
      ).toBe("initial");
      expect(
        container.querySelector('[data-testid="val-b"]')?.textContent
      ).toBe("initial");

      // Mutate from Component A
      await act(async () => {
        container
          .querySelector<HTMLButtonElement>('[data-testid="btn-a"]')
          ?.click();
      });

      expect(
        container.querySelector('[data-testid="val-a"]')?.textContent
      ).toBe("from_a");
      expect(
        container.querySelector('[data-testid="val-b"]')?.textContent
      ).toBe("from_a");
      expect(mockStorage.getItem("shared_setting")).toContain("from_a");

      // Mutate from Component B
      await act(async () => {
        container
          .querySelector<HTMLButtonElement>('[data-testid="btn-b"]')
          ?.click();
      });

      expect(
        container.querySelector('[data-testid="val-a"]')?.textContent
      ).toBe("from_b");
      expect(
        container.querySelector('[data-testid="val-b"]')?.textContent
      ).toBe("from_b");
    });

    it("synchronizes state when a cross-tab StorageEvent is received", async () => {
      await act(async () => {
        root.render(<CombinedTest storageKey="tab_sync_key" />);
      });

      expect(
        container.querySelector('[data-testid="val-a"]')?.textContent
      ).toBe("initial");

      // Simulate an external browser tab updating localStorage
      mockStorage.setItem(
        "tab_sync_key",
        JSON.stringify("updated_in_other_tab")
      );

      await act(async () => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "tab_sync_key",
            newValue: JSON.stringify("updated_in_other_tab"),
          })
        );
      });

      expect(
        container.querySelector('[data-testid="val-a"]')?.textContent
      ).toBe("updated_in_other_tab");
      expect(
        container.querySelector('[data-testid="val-b"]')?.textContent
      ).toBe("updated_in_other_tab");
    });
  });

  describe("useTelemetry Optimistic Rollback & Rate Limit Queue", () => {
    it("rolls back optimistic counter update when server returns 500 error", async () => {
      const { useTelemetry } = await import("@/hooks/useTelemetry");

      let hookValue: any;
      function TelemetryComponent() {
        const data = useTelemetry();
        hookValue = data;
        return (
          <div data-testid="views">
            {data.telemetry["test-proj"]?.views ?? 0}
          </div>
        );
      }

      globalThis.fetch = vi
        .fn()
        .mockImplementation(async (_url: string, init?: any) => {
          if (init?.method === "POST") {
            return { ok: false, status: 500 };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ "test-proj": { views: 10, clicks: 5 } }),
          };
        });

      await act(async () => {
        root.render(<TelemetryComponent />);
      });
      await new Promise((r) => setTimeout(r, 60));

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Initial state is hydrated
      await act(async () => {
        await hookValue.recordEvent("test-proj", "page_view");
      });

      // Optimistic update should have been rolled back due to 500 error
      expect(hookValue.syncFailed).toBe(true);
      expect(hookValue.telemetry["test-proj"]?.views ?? 0).toBe(10);
      errorSpy.mockRestore();
    });
  });

  describe("Telemetry Sync Secondary Buffer Re-enqueue Resilience", () => {
    it("preserves events in processing queue on primary database write failure without data loss", async () => {
      process.env.CRON_SECRET = "test-secret";

      const mockBufferEvents = [
        {
          id: "evt-1",
          projectSlug: "alpha",
          eventType: "page_view",
          createdAt: new Date().toISOString(),
        },
        {
          id: "evt-2",
          projectSlug: "beta",
          eventType: "project_click",
          createdAt: new Date().toISOString(),
        },
      ];

      mockLrange.mockResolvedValueOnce([]);
      mockExec
        .mockReset()
        .mockResolvedValueOnce([mockBufferEvents[0], mockBufferEvents[1]]);
      mockCreateMany
        .mockReset()
        .mockRejectedValue(
          new Error("Neon Serverless Connection Lost / Deadlock Detected")
        );

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = new NextRequest(
        "http://localhost:3000/api/telemetry/sync?batch=2",
        {
          headers: {
            authorization: "Bearer test-secret",
          },
        }
      );

      const res = await syncRouteHandler(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Failed to sync events to primary database");

      // Verify atomic transfer via lmove and that processing queue was not deleted on failure
      expect(mockLmove).toHaveBeenCalledWith(
        "telemetry_buffer",
        "telemetry_processing",
        "right",
        "left"
      );
      expect(mockDel).not.toHaveBeenCalledWith("telemetry_processing");

      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
