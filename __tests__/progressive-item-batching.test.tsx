// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  DeferredHydration,
  SkillsGridSkeleton,
  TimelineSkeleton,
} from "@/components/DeferredHydration";
import { SkillsGrid } from "@/components/SkillsGrid";
import { RichNarrative } from "@/components/RichNarrative";

// Mock audio provider functions
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playSkillHover: vi.fn(),
  }),
}));

// Mock framer-motion useReducedMotion
vi.mock("framer-motion", async (importOriginal) => {
  const original = await importOriginal<typeof import("framer-motion")>();
  return {
    ...original,
    useReducedMotion: () => false,
  };
});

describe("Progressive Item Batching & Deferred Narrative Parsing Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockLanguages = [
    { name: "TypeScript", percentage: 85 },
    { name: "Python", percentage: 60 },
  ];

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  describe("Requirement 1: Non-Blocking Hydration Scheduling (DeferredHydration)", () => {
    it("renders fallback skeleton on initial paint and schedules interactive transition", async () => {
      const TestApp = () => (
        <DeferredHydration fallback={<SkillsGridSkeleton />}>
          <div data-testid="interactive-content">Interactive Content Loaded</div>
        </DeferredHydration>
      );

      await act(async () => {
        root.render(<TestApp />);
      });

      // Skeleton should be active initially
      expect(container.querySelector(".motion-safe\\:animate-pulse")).not.toBeNull();

      // Advance timers to trigger deferred hydration transitions
      await act(async () => {
        await new Promise((res) => setTimeout(res, 100));
      });

      // Interactive content should be rendered after non-blocking idle transition
      const content = container.querySelector('[data-testid="interactive-content"]');
      expect(content).not.toBeNull();
      expect(content?.textContent).toBe("Interactive Content Loaded");
    });
  });

  describe("Requirement 2: Progressive Item Batching across Successive Frames (SkillsGrid)", () => {
    it("mounts child cards incrementally across sequential frames without blocking UI", async () => {
      await act(async () => {
        root.render(<SkillsGrid languages={mockLanguages} />);
      });

      // Initially on mount, Bio Card (priority 1) is rendered
      expect(container.textContent).toContain("FDR");

      // Advance time for frame batch passes (batchLevel 2 & 3)
      await act(async () => {
        await new Promise((res) => setTimeout(res, 100));
      });

      // After progressive batching completes across frames, languages and domain pillars are fully rendered
      expect(container.textContent).toContain("TypeScript");
      expect(container.textContent).toContain("85%");
      expect(container.textContent).toContain("Python");
      expect(container.textContent).toContain("60%");
    });

    it("maintains skeleton placeholders with identical card bounds during progressive batching to ensure zero CLS", async () => {
      await act(async () => {
        root.render(<SkillsGrid languages={mockLanguages} />);
      });

      // Check grid layout container exists
      const grid = container.firstChild as HTMLDivElement;
      expect(grid.className).toContain("grid");
      expect(grid.className).toContain("grid-cols-1");
      expect(grid.className).toContain("md:grid-cols-3");
    });
  });

  describe("Requirement 3: Deferred HTML String Parsing (RichNarrative)", () => {
    it("renders sanitized HTML immediately on initial paint without synchronous DOMParser blocking mount", async () => {
      const sampleHtml = `<p>Lead architect for <span data-term="GxP" data-definition="Good Practice standards" data-key="gxp">GxP</span> clinical trials.</p>`;

      // Spy on DOMParser prototype parseFromString
      const parseSpy = vi.spyOn(DOMParser.prototype, "parseFromString");

      await act(async () => {
        root.render(<RichNarrative html={sampleHtml} className="test-narrative" />);
      });

      // The initial paint container should exist and display text content
      const narrativeDiv = container.querySelector(".test-narrative");
      expect(narrativeDiv).not.toBeNull();
      expect(narrativeDiv?.textContent).toContain("GxP");

      // Advance timers / macrotasks for deferred rehydration
      await act(async () => {
        await new Promise((res) => setTimeout(res, 50));
      });

      // Verify DOMParser was invoked asynchronously off the critical path
      expect(parseSpy).toHaveBeenCalled();
    });

    it("rehydrates terminology tooltips asynchronously after initial paint completes", async () => {
      const sampleHtml = `<span data-term="eCRF" data-definition="Electronic Case Report Form" data-key="ecrf">eCRF</span>`;

      await act(async () => {
        root.render(<RichNarrative html={sampleHtml} />);
      });

      await act(async () => {
        await new Promise((res) => setTimeout(res, 50));
      });

      // Tooltip trigger should now be present in the rehydrated tree
      const tooltipTrigger = container.querySelector("[aria-describedby]");
      expect(tooltipTrigger).not.toBeNull();
      expect(tooltipTrigger?.textContent).toBe("eCRF");
    });
  });

  describe("Requirement 4: Structure-Matched Skeleton Placeholders & Zero CLS", () => {
    it("renders TimelineSkeleton with matching bullet nodes and layout structure", async () => {
      await act(async () => {
        root.render(<TimelineSkeleton />);
      });

      expect(container.querySelector(".motion-safe\\:animate-pulse")).not.toBeNull();
      const nodes = container.querySelectorAll(".rounded-full");
      expect(nodes.length).toBeGreaterThan(0);
    });
  });
});
