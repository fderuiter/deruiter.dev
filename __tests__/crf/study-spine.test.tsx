// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { StudySpine } from "@/components/crf/LeftSidebar/StudySpine";
import { getOncologyPresetSync } from "@/lib/crf/presets";
import { StudyProtocol } from "@/lib/crf/types";

describe("StudySpine Component (Left Sidebar & Global Library)", () => {
  let container: HTMLDivElement;
  let root: Root;
  const mockStudy: StudyProtocol = getOncologyPresetSync();

  // Ensure first visit has assigned forms that match study.forms
  const normalizedStudy: StudyProtocol = {
    ...mockStudy,
    visits: mockStudy.visits.map((v, i) => ({
      ...v,
      assignedFormIds:
        i === 0
          ? mockStudy.forms.slice(0, 2).map((f) => f.id)
          : v.assignedFormIds,
    })),
  };

  const defaultProps = {
    study: normalizedStudy,
    activeVisitId: normalizedStudy.visits[0]?.id || "v_screen",
    activeFormId: normalizedStudy.forms[0]?.id || "f_vs",
    activeTab: "spine" as const,
    onChangeTab: vi.fn(),
    onSelectVisit: vi.fn(),
    onSelectForm: vi.fn(),
    onAddVisit: vi.fn(),
    onDeleteVisit: vi.fn(),
    onAddForm: vi.fn(),
    onDuplicateForm: vi.fn(),
    onDeleteForm: vi.fn(),
    onOpenCdashScaffolder: vi.fn(),
    onAddField: vi.fn(),
    onAssignFormToVisit: vi.fn(),
    onUnassignFormFromVisit: vi.fn(),
    onInjectCdashForm: vi.fn(),
  };

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

  it("renders the 3 sub-navigation tabs (Spine, Forms, Palette)", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<StudySpine {...defaultProps} />);
    });

    const spineBtn = container.querySelector('button[title*="Study Spine"]');
    const formsBtn = container.querySelector('button[title*="Protocol Forms"]');
    const paletteBtn = container.querySelector(
      'button[title*="Widget Palette"]'
    );

    expect(spineBtn).not.toBeNull();
    expect(formsBtn).not.toBeNull();
    expect(paletteBtn).not.toBeNull();
  });

  it("renders longitudinal study epochs and visits in Spine tab", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<StudySpine {...defaultProps} activeTab="spine" />);
    });

    expect(container.textContent).toContain("Study Timeline");
    expect(container.textContent).toContain(normalizedStudy.visits[0].name);
  });

  it("calls onSelectVisit and onSelectForm when clicking a visit", async () => {
    const onSelectVisit = vi.fn();
    const onSelectForm = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <StudySpine
          {...defaultProps}
          activeTab="spine"
          onSelectVisit={onSelectVisit}
          onSelectForm={onSelectForm}
        />
      );
    });

    const visitTitle = Array.from(container.querySelectorAll("span")).find(
      (el) => el.textContent?.includes(normalizedStudy.visits[0].name)
    );
    expect(visitTitle).not.toBeUndefined();

    await act(async () => {
      visitTitle?.parentElement?.parentElement?.parentElement?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    expect(onSelectVisit).toHaveBeenCalledWith(normalizedStudy.visits[0].id);
    expect(onSelectForm).toHaveBeenCalled();
  });

  it("triggers onAddVisit when clicking the + Visit button", async () => {
    const onAddVisit = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <StudySpine
          {...defaultProps}
          activeTab="spine"
          onAddVisit={onAddVisit}
        />
      );
    });

    const addVisitBtn = container.querySelector(
      'button[title*="Add New Protocol Visit"]'
    ) as HTMLButtonElement;
    expect(addVisitBtn).not.toBeNull();

    await act(async () => {
      addVisitBtn.click();
    });

    expect(onAddVisit).toHaveBeenCalledTimes(1);
  });

  it("triggers unassign form when clicking unassign button on a visit's form", async () => {
    const onUnassign = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <StudySpine
          {...defaultProps}
          activeTab="spine"
          onUnassignFormFromVisit={onUnassign}
        />
      );
    });

    const visit = normalizedStudy.visits[0];
    const form = normalizedStudy.forms[0];
    const unassignBtn = container.querySelector(
      `button[aria-label="Unassign ${form.name} from ${visit.name}"]`
    ) as HTMLButtonElement;
    expect(unassignBtn).not.toBeNull();

    await act(async () => {
      unassignBtn.click();
    });

    expect(onUnassign).toHaveBeenCalledWith(
      normalizedStudy.visits[0].id,
      normalizedStudy.forms[0].id
    );
  });

  // #1617: every unassign button used to share one generic name, so a
  // screen reader could not tell which form or visit it affected.
  it("gives each unassign button a unique name naming its form and visit", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<StudySpine {...defaultProps} activeTab="spine" />);
    });

    const visit = normalizedStudy.visits[0];
    const names = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        'button[aria-label^="Unassign "]'
      )
    ).map((b) => b.getAttribute("aria-label"));

    expect(names).toContain(
      `Unassign ${normalizedStudy.forms[0].name} from ${visit.name}`
    );
    expect(names).toContain(
      `Unassign ${normalizedStudy.forms[1].name} from ${visit.name}`
    );
    expect(names.length).toBeGreaterThanOrEqual(2);
    expect(new Set(names).size).toBe(names.length);
  });

  it("renders active forms and global CDASH library templates when in 'forms' tab", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<StudySpine {...defaultProps} activeTab="forms" />);
    });

    expect(container.textContent).toContain("Study Forms");
    expect(container.textContent).toContain("Global CDASH Library");
    const input = container.querySelector(
      'input[placeholder*="Search templates"]'
    );
    expect(input).not.toBeNull();
  });

  it("filters global CDASH library templates based on search input", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<StudySpine {...defaultProps} activeTab="forms" />);
    });

    const searchInput = container.querySelector(
      'input[placeholder*="Search templates"]'
    ) as HTMLInputElement;
    expect(searchInput).not.toBeNull();

    await act(async () => {
      searchInput.value = "Vital Signs";
      searchInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain("Vital Signs");
  });

  it("injects a CDASH template when clicking + Add in the Global Library", async () => {
    const onInject = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <StudySpine
          {...defaultProps}
          activeTab="forms"
          onInjectCdashForm={onInject}
        />
      );
    });

    const addTemplateBtn = container.querySelector(
      'button[title*="Add this template to the study"]'
    ) as HTMLButtonElement;
    expect(addTemplateBtn).not.toBeNull();

    await act(async () => {
      addTemplateBtn.click();
    });

    expect(onInject).toHaveBeenCalledTimes(1);
  });

  it("switches to Palette tab and triggers onAddField when selecting a widget", async () => {
    const onAddField = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <StudySpine
          {...defaultProps}
          activeTab="palette"
          onAddField={onAddField}
        />
      );
    });

    const textWidgetBtn = Array.from(container.querySelectorAll("button")).find(
      (el) => el.textContent?.includes("Single-Line Text")
    );
    expect(textWidgetBtn).not.toBeUndefined();

    await act(async () => {
      textWidgetBtn?.click();
    });

    expect(onAddField).toHaveBeenCalledWith(
      expect.objectContaining({
        dataType: "text",
      })
    );
  });

  it("makes form selection reachable and activatable by keyboard (#659)", async () => {
    const onSelectForm = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <StudySpine
          {...defaultProps}
          activeTab="forms"
          onSelectForm={onSelectForm}
        />
      );
    });

    const formRow = container.querySelector(
      '[role="button"][aria-label^="Select form"]'
    ) as HTMLElement;
    expect(formRow).toBeTruthy();
    expect(formRow.tabIndex).toBe(0);

    formRow.focus();
    expect(document.activeElement).toBe(formRow);

    await act(async () => {
      formRow.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
    });

    expect(onSelectForm).toHaveBeenCalledTimes(1);
  });

  it("does not re-trigger form selection when Enter is pressed on the nested duplicate/delete buttons (#659)", async () => {
    const onSelectForm = vi.fn();
    const onDuplicateForm = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <StudySpine
          {...defaultProps}
          activeTab="forms"
          onSelectForm={onSelectForm}
          onDuplicateForm={onDuplicateForm}
        />
      );
    });

    const formRow = container.querySelector(
      '[role="button"][aria-label^="Select form"]'
    ) as HTMLElement;
    const duplicateBtn = formRow.querySelector(
      'button[title="Duplicate Form"]'
    ) as HTMLButtonElement;
    expect(duplicateBtn).toBeTruthy();

    duplicateBtn.focus();
    await act(async () => {
      duplicateBtn.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
    });

    expect(onSelectForm).not.toHaveBeenCalled();
  });
});
