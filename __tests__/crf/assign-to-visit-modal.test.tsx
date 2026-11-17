// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AssignToVisitModal } from "@/components/crf/LeftSidebar/AssignToVisitModal";
import { getOncologyPresetSync } from "@/lib/crf/presets";
import { StudyProtocol } from "@/lib/crf/types";

describe("AssignToVisitModal Component", () => {
  let container: HTMLDivElement;
  let root: Root;
  const mockStudy: StudyProtocol = getOncologyPresetSync();

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
    vi.restoreAllMocks();
  });

  it("renders role='dialog', aria-modal='true', and labels", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <AssignToVisitModal
          study={mockStudy}
          formId={mockStudy.forms[0].id}
          onClose={vi.fn()}
          onAssignFormToVisit={vi.fn()}
          onUnassignFormFromVisit={vi.fn()}
        />
      );
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-labelledby")).toBeTruthy();
    expect(dialog?.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("returns null if formId does not match any form", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <AssignToVisitModal
          study={mockStudy}
          formId="nonexistent_form"
          onClose={vi.fn()}
          onAssignFormToVisit={vi.fn()}
          onUnassignFormFromVisit={vi.fn()}
        />
      );
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("handles studies without predefined epochs via fallback grouping", async () => {
    const studyWithoutEpochs: StudyProtocol = {
      ...mockStudy,
      epochs: undefined,
    };

    await act(async () => {
      root = createRoot(container);
      root.render(
        <AssignToVisitModal
          study={studyWithoutEpochs}
          formId={mockStudy.forms[0].id}
          onClose={vi.fn()}
          onAssignFormToVisit={vi.fn()}
          onUnassignFormFromVisit={vi.fn()}
        />
      );
    });

    const fieldsets = container.querySelectorAll("fieldset");
    expect(fieldsets.length).toBeGreaterThan(0);
  });

  it("renders empty state message when study has no visits", async () => {
    const studyWithoutVisits: StudyProtocol = {
      ...mockStudy,
      visits: [],
    };

    await act(async () => {
      root = createRoot(container);
      root.render(
        <AssignToVisitModal
          study={studyWithoutVisits}
          formId={mockStudy.forms[0].id}
          onClose={vi.fn()}
          onAssignFormToVisit={vi.fn()}
          onUnassignFormFromVisit={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain(
      "No visits available in this study protocol"
    );
  });

  it("calls onClose when the Done button is clicked", async () => {
    const onClose = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <AssignToVisitModal
          study={mockStudy}
          formId={mockStudy.forms[0].id}
          onClose={onClose}
          onAssignFormToVisit={vi.fn()}
          onUnassignFormFromVisit={vi.fn()}
        />
      );
    });

    const doneBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Done"
    );
    expect(doneBtn).toBeTruthy();

    await act(async () => {
      doneBtn?.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", async () => {
    const onClose = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <AssignToVisitModal
          study={mockStudy}
          formId={mockStudy.forms[0].id}
          onClose={onClose}
          onAssignFormToVisit={vi.fn()}
          onUnassignFormFromVisit={vi.fn()}
        />
      );
    });

    const backdrop = container.firstElementChild as HTMLElement;
    expect(backdrop).toBeTruthy();

    await act(async () => {
      backdrop.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
