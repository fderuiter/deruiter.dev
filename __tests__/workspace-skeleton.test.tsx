// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SchemaFlowWorkspaceSkeleton } from "@/components/SchemaFlowWorkspaceSkeleton";
import { RetroLabyrinthSkeleton } from "@/components/RetroLabyrinthSkeleton";
import { RetroLabyrinth } from "@/components/RetroLabyrinth";

// Mock Telemetry
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe("Workspace Skeletons & Reserved Aspect Ratios Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);

    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key)),
      clear: vi.fn(() => storage.clear()),
      key: vi.fn((index: number) => Array.from(storage.keys())[index] ?? null),
      get length() {
        return storage.size;
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      })
    );
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  describe("SchemaFlow Workspace Skeleton", () => {
    it("renders SchemaFlowWorkspaceSkeleton with data-testid='schemaflow-skeleton' and min-h-[520px]", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<SchemaFlowWorkspaceSkeleton />);
      });

      const skeleton = container.querySelector(
        '[data-testid="schemaflow-skeleton"]'
      );
      expect(skeleton).not.toBeNull();
      expect(skeleton?.classList.contains("min-h-[520px]")).toBe(true);

      // Verify layout geometry matching SchemaFlowWorkspace
      const gridCols = container.querySelector(".grid-cols-1");
      expect(gridCols).not.toBeNull();
      expect(container.textContent).toContain("PROOF-TACTIC-SHELL");
    });

    it("renders SchemaFlowWorkspaceWrapper with initial dynamic loading fallback", async () => {
      vi.resetModules();
      const { default: DynamicSchemaFlowWorkspaceWrapper } =
        await import("@/components/SchemaFlowWorkspaceWrapper");
      // Synchronous act() so the dynamic import cannot settle before the
      // assertion (#1571: it could inside an async act() under load).
      act(() => {
        root = createRoot(container);
        root.render(<DynamicSchemaFlowWorkspaceWrapper />);
      });

      // Wrapper renders skeleton during dynamic import fetch
      const skeleton = container.querySelector(
        '[data-testid="schemaflow-skeleton"]'
      );
      expect(skeleton).not.toBeNull();
    });
  });

  describe("Retro Labyrinth Skeleton & Unmounted Fallback", () => {
    it("renders RetroLabyrinthSkeleton with data-testid='retro-labyrinth-skeleton' and reserved aspect ratio/min-height", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<RetroLabyrinthSkeleton />);
      });

      const skeleton = container.querySelector(
        '[data-testid="retro-labyrinth-skeleton"]'
      );
      expect(skeleton).not.toBeNull();
      expect(skeleton?.classList.contains("aspect-[15/9]")).toBe(true);
      expect(skeleton?.classList.contains("min-h-[240px]")).toBe(true);
      expect(container.textContent).toContain("SYSTEM_LABYRINTH.EXE");
    });

    it("renders RetroLabyrinth unmounted fallback with data-testid='retro-labyrinth-skeleton' and exact geometry bounds when isMounted=false", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<RetroLabyrinth isMounted={false} />);
      });

      const skeleton = container.querySelector(
        '[data-testid="retro-labyrinth-skeleton"]'
      );
      expect(skeleton).not.toBeNull();
      expect(skeleton?.classList.contains("aspect-[15/9]")).toBe(true);
      expect(skeleton?.classList.contains("min-h-[240px]")).toBe(true);
      expect(container.textContent).toContain("SYSTEM_LABYRINTH.EXE");
    });

    it("renders UnifiedErrorLayout with reserved minigame skeleton fallback prior to hydration", async () => {
      // Test RetroLabyrinthSkeleton fallback passed to dynamic import in UnifiedErrorLayout
      await act(async () => {
        root = createRoot(container);
        root.render(<RetroLabyrinthSkeleton />);
      });

      const skeleton = container.querySelector(
        '[data-testid="retro-labyrinth-skeleton"]'
      );
      expect(skeleton).not.toBeNull();
      expect(skeleton?.classList.contains("aspect-[15/9]")).toBe(true);
      expect(skeleton?.classList.contains("min-h-[240px]")).toBe(true);
    });
  });
});
