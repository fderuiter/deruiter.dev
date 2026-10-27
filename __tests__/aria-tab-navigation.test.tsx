// @vitest-environment jsdom
import { buildFormCatalog } from "@/lib/crf";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { StudySpine } from "@/components/crf/LeftSidebar/StudySpine";
import { ExportImportModal } from "@/components/crf/Modes/ExportImportModal";
import { MultiGoalTabs } from "@/components/QuasiPerfectPuzzler/MultiGoalTabs";
import { getOncologyPresetSync } from "@/lib/crf/presets";
import { StudyProtocol } from "@/lib/crf/types";
import { SubGoal } from "@/lib/quasi-perfect/types";

describe("WAI-ARIA Tab Navigation Standards Across Components", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  });

  describe("StudySpine Tab Navigation", () => {
    const mockStudy: StudyProtocol = getOncologyPresetSync();
    const defaultProps = {
      study: mockStudy,
      activeVisitId: mockStudy.visits[0]?.id || "v1",
      activeFormId: mockStudy.forms[0]?.id || "f1",
      activeTab: "spine" as const,
      onChangeTab: vi.fn(),
      onSelectVisit: vi.fn(),
      onSelectForm: vi.fn(),
      onAddVisit: vi.fn(),
      onDeleteVisit: vi.fn(),
      onAddForm: vi.fn(),
      onDuplicateForm: vi.fn(),
      onDeleteForm: vi.fn(),
      onOpenFormCatalog: vi.fn(),
      onAddField: vi.fn(),
      onAssignFormToVisit: vi.fn(),
      onUnassignFormFromVisit: vi.fn(),
      catalogEntries: buildFormCatalog(),
      onAddCatalogEntry: vi.fn(),
    };

    it("has parent container with role='tablist' and aria-label='Study Spine Navigation'", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<StudySpine {...defaultProps} />);
      });

      const tablist = container.querySelector('[role="tablist"]');
      expect(tablist).not.toBeNull();
      expect(tablist?.getAttribute("aria-label")).toBe(
        "Study Spine Navigation"
      );
    });

    it("has tab buttons with role='tab', aria-selected, unique id, and aria-controls", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<StudySpine {...defaultProps} activeTab="spine" />);
      });

      const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
      expect(tabs).toHaveLength(3);

      const [spineTab, formsTab, paletteTab] = tabs;

      expect(spineTab.id).toBe("study-spine-tab-spine");
      expect(spineTab.getAttribute("aria-selected")).toBe("true");
      expect(spineTab.getAttribute("aria-controls")).toBe(
        "study-spine-panel-spine"
      );

      expect(formsTab.id).toBe("study-spine-tab-forms");
      expect(formsTab.getAttribute("aria-selected")).toBe("false");
      expect(formsTab.getAttribute("aria-controls")).toBe(
        "study-spine-panel-forms"
      );

      expect(paletteTab.id).toBe("study-spine-tab-palette");
      expect(paletteTab.getAttribute("aria-selected")).toBe("false");
      expect(paletteTab.getAttribute("aria-controls")).toBe(
        "study-spine-panel-palette"
      );
    });

    it("has active tab panel with role='tabpanel', matching id, and aria-labelledby", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<StudySpine {...defaultProps} activeTab="spine" />);
      });

      const panel = container.querySelector("#study-spine-panel-spine");
      expect(panel).not.toBeNull();
      expect(panel?.getAttribute("role")).toBe("tabpanel");
      expect(panel?.getAttribute("aria-labelledby")).toBe(
        "study-spine-tab-spine"
      );
    });

    it("ensures every tab's aria-controls points to an existing panel in the DOM", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<StudySpine {...defaultProps} activeTab="spine" />);
      });

      const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
      tabs.forEach((tab) => {
        const controlsId = tab.getAttribute("aria-controls");
        expect(controlsId).toBeTruthy();
        const targetPanel = container.querySelector(`#${controlsId}`);
        expect(targetPanel).not.toBeNull();
        expect(targetPanel?.getAttribute("role")).toBe("tabpanel");
      });
    });

    it("implements roving tabIndex (active tab=0, inactive tabs=-1)", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<StudySpine {...defaultProps} activeTab="forms" />);
      });

      const tabs = Array.from(
        container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      );
      const [spineTab, formsTab, paletteTab] = tabs;

      expect(spineTab.tabIndex).toBe(-1);
      expect(formsTab.tabIndex).toBe(0);
      expect(paletteTab.tabIndex).toBe(-1);
    });

    it("supports keyboard navigation with arrow keys, Home, and End", async () => {
      const onChangeTab = vi.fn();
      await act(async () => {
        root = createRoot(container);
        root.render(
          <StudySpine
            {...defaultProps}
            activeTab="spine"
            onChangeTab={onChangeTab}
          />
        );
      });

      const spineTab = container.querySelector<HTMLButtonElement>(
        "#study-spine-tab-spine"
      )!;
      spineTab.focus();

      // ArrowRight -> forms
      await act(async () => {
        spineTab.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
        );
      });
      expect(onChangeTab).toHaveBeenCalledWith("forms");

      // End -> palette
      await act(async () => {
        spineTab.dispatchEvent(
          new KeyboardEvent("keydown", { key: "End", bubbles: true })
        );
      });
      expect(onChangeTab).toHaveBeenCalledWith("palette");

      // Home -> spine
      await act(async () => {
        spineTab.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Home", bubbles: true })
        );
      });
      expect(onChangeTab).toHaveBeenCalledWith("spine");
    });
  });

  describe("ExportImportModal Tab Navigation", () => {
    const mockStudy: StudyProtocol = getOncologyPresetSync();
    const defaultProps = {
      study: mockStudy,
      onImportStudy: vi.fn(),
    };

    it("has parent container with role='tablist' and aria-label='Export Format Tabs'", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<ExportImportModal {...defaultProps} />);
      });

      const tablist = container.querySelector('[role="tablist"]');
      expect(tablist).not.toBeNull();
      expect(tablist?.getAttribute("aria-label")).toBe("Export Format Tabs");
    });

    it("has tab buttons with role='tab', aria-selected, unique id, and aria-controls", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<ExportImportModal {...defaultProps} />);
      });

      const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
      expect(tabs.length).toBeGreaterThanOrEqual(7);

      tabs.forEach((tab) => {
        expect(tab.id).toMatch(/^export-tab-/);
        expect(tab.getAttribute("aria-controls")).toMatch(/^export-panel-/);
        expect(tab.hasAttribute("aria-selected")).toBe(true);
      });
    });

    it("has active tab panel with role='tabpanel', matching id, and aria-labelledby", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<ExportImportModal {...defaultProps} />);
      });

      const panel = container.querySelector("#export-panel-universal");
      expect(panel).not.toBeNull();
      expect(panel?.getAttribute("role")).toBe("tabpanel");
      expect(panel?.getAttribute("aria-labelledby")).toBe(
        "export-tab-universal"
      );
    });

    it("ensures every tab's aria-controls points to an existing panel in the DOM", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<ExportImportModal {...defaultProps} />);
      });

      const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
      expect(tabs.length).toBe(8);

      tabs.forEach((tab) => {
        const controlsId = tab.getAttribute("aria-controls");
        expect(controlsId).toBeTruthy();
        const targetPanel = container.querySelector(`#${controlsId}`);
        expect(targetPanel).not.toBeNull();
        expect(targetPanel?.getAttribute("role")).toBe("tabpanel");
      });
    });

    it("implements roving tabIndex for ExportImportModal tabs", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<ExportImportModal {...defaultProps} />);
      });

      const tabs = Array.from(
        container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      );
      expect(tabs[0].tabIndex).toBe(0); // universal
      expect(tabs[1].tabIndex).toBe(-1); // usdm
      expect(tabs[2].tabIndex).toBe(-1); // odm
    });
  });

  describe("MultiGoalTabs Navigation", () => {
    const mockSubgoals: SubGoal[] = [
      {
        id: "goal_0",
        label: "Subgoal 1: P",
        goal: { id: "n1", type: "Variable", value: "P" },
        hypotheses: [],
        isCompleted: false,
      },
      {
        id: "goal_1",
        label: "Subgoal 2: Q",
        goal: { id: "n2", type: "Variable", value: "Q" },
        hypotheses: [],
        isCompleted: true,
      },
    ];

    it("has container with role='tablist' and aria-label='Active Proof Subgoals'", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(
          <MultiGoalTabs
            subgoals={mockSubgoals}
            activeGoalIndex={0}
            onSelectGoal={vi.fn()}
          />
        );
      });

      const tablist = container.querySelector('[role="tablist"]');
      expect(tablist).not.toBeNull();
      expect(tablist?.getAttribute("aria-label")).toBe("Active Proof Subgoals");
    });

    it("has subgoal buttons with role='tab', aria-selected, unique id, and aria-controls", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(
          <MultiGoalTabs
            subgoals={mockSubgoals}
            activeGoalIndex={0}
            onSelectGoal={vi.fn()}
          />
        );
      });

      const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
      expect(tabs).toHaveLength(2);

      expect(tabs[0].id).toBe("subgoal-tab-goal_0");
      expect(tabs[0].getAttribute("aria-selected")).toBe("true");
      expect(tabs[0].getAttribute("aria-controls")).toBe(
        "subgoal-panel-goal_0"
      );

      expect(tabs[1].id).toBe("subgoal-tab-goal_1");
      expect(tabs[1].getAttribute("aria-selected")).toBe("false");
      expect(tabs[1].getAttribute("aria-controls")).toBe(
        "subgoal-panel-goal_1"
      );
    });
  });
});
