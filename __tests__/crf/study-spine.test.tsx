// @vitest-environment jsdom
import { buildFormCatalog } from "@/lib/crf";
import { fireEvent } from "@testing-library/react";
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
    onOpenFormCatalog: vi.fn(),
    onAddField: vi.fn(),
    onAssignFormToVisit: vi.fn(),
    onUnassignFormFromVisit: vi.fn(),
    catalogEntries: buildFormCatalog(),
    onAddCatalogEntry: vi.fn(),
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

  it("lists the form catalog and saved templates in the 'forms' tab (#2927 item 11)", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<StudySpine {...defaultProps} activeTab="forms" />);
    });

    expect(container.textContent).toContain("Study Forms");
    expect(container.textContent).toContain("Form catalog");
    expect(container.textContent).toContain("My form templates");
    expect(
      container.querySelector('input[aria-label="Search the form catalog"]') ??
        container.querySelector('input[type="search"]')
    ).not.toBeNull();
    expect(container.textContent).not.toContain("Global CDASH Library");
  });

  it("narrows the catalog to entries matching the search", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<StudySpine {...defaultProps} activeTab="forms" />);
    });

    const searchInput = container.querySelector(
      'input[type="search"]'
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "QTc" } });
    });

    const titles = Array.from(
      container.querySelectorAll('[data-testid="form-catalog"] h4')
    ).map((h) => h.textContent);
    expect(titles).toContain("12-Lead Electrocardiogram & QTc");
    expect(titles).not.toContain("Demographics & Informed Consent");
  });

  it("adds a catalog form to the selected visit", async () => {
    const onAddCatalogEntry = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <StudySpine
          {...defaultProps}
          activeTab="forms"
          onAddCatalogEntry={onAddCatalogEntry}
        />
      );
    });

    const addButton = container.querySelector(
      'button[aria-label="Add Vital Signs & Anthropometrics to the study"]'
    ) as HTMLButtonElement;
    expect(addButton).not.toBeNull();

    await act(async () => {
      addButton.click();
    });

    expect(onAddCatalogEntry).toHaveBeenCalledWith(
      "cdash:VS",
      defaultProps.activeVisitId
    );
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

  describe("Assign to Visit Action & Modal (Accessibility WCAG 2.5.7 & 2.1.1)", () => {
    it("renders an Assign to Visit button with an explicit accessible label on every form card", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<StudySpine {...defaultProps} activeTab="forms" />);
      });

      const assignButtons = container.querySelectorAll(
        'button[title="Assign to Visit"]'
      );
      expect(assignButtons.length).toBe(normalizedStudy.forms.length);

      assignButtons.forEach((btn, index) => {
        const form = normalizedStudy.forms[index];
        expect(btn.getAttribute("aria-label")).toBe(
          `Assign to visit: ${form.name}`
        );
      });
    });

    it("opens the assignment dialog when the button is activated via click, Enter, or Space", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<StudySpine {...defaultProps} activeTab="forms" />);
      });

      const firstAssignBtn = container.querySelector(
        'button[title="Assign to Visit"]'
      ) as HTMLButtonElement;
      expect(firstAssignBtn).not.toBeNull();

      // Click opens dialog
      await act(async () => {
        firstAssignBtn.click();
      });

      let dialog = container.querySelector(
        '[role="dialog"][data-testid="assign-to-visit-dialog"]'
      );
      expect(dialog).not.toBeNull();
      expect(dialog?.getAttribute("aria-modal")).toBe("true");

      // Close dialog
      const closeBtn = dialog?.querySelector(
        'button[aria-label="Close dialog"]'
      ) as HTMLButtonElement;
      await act(async () => {
        closeBtn.click();
      });
      expect(
        container.querySelector(
          '[role="dialog"][data-testid="assign-to-visit-dialog"]'
        )
      ).toBeNull();

      // Space key opens dialog
      await act(async () => {
        firstAssignBtn.focus();
        firstAssignBtn.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: " ",
            bubbles: true,
            cancelable: true,
          })
        );
      });

      dialog = container.querySelector(
        '[role="dialog"][data-testid="assign-to-visit-dialog"]'
      );
      expect(dialog).not.toBeNull();

      // Close again
      const closeBtn2 = dialog?.querySelector(
        'button[aria-label="Close dialog"]'
      ) as HTMLButtonElement;
      await act(async () => {
        closeBtn2.click();
      });

      // Enter key on assign button opens dialog
      await act(async () => {
        firstAssignBtn.focus();
        firstAssignBtn.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
            cancelable: true,
          })
        );
      });

      dialog = container.querySelector(
        '[role="dialog"][data-testid="assign-to-visit-dialog"]'
      );
      expect(dialog).not.toBeNull();
    });

    it("lists study visits grouped by epoch with their current assignment status", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<StudySpine {...defaultProps} activeTab="forms" />);
      });

      const firstAssignBtn = container.querySelector(
        'button[title="Assign to Visit"]'
      ) as HTMLButtonElement;

      await act(async () => {
        firstAssignBtn.click();
      });

      const dialog = container.querySelector(
        '[role="dialog"][data-testid="assign-to-visit-dialog"]'
      ) as HTMLElement;
      expect(dialog).not.toBeNull();

      // Check fieldsets for epochs
      const fieldsets = dialog.querySelectorAll("fieldset");
      expect(fieldsets.length).toBeGreaterThan(0);

      // Verify each visit is rendered with name and assignment status
      normalizedStudy.visits.forEach((v) => {
        expect(dialog.textContent).toContain(v.name);
      });

      // Form 0 is assigned to visit 0 in normalizedStudy
      const targetForm = normalizedStudy.forms[0];
      const isAssignedToVisit0 =
        normalizedStudy.visits[0].assignedFormIds.includes(targetForm.id);
      const visit0Checkbox = dialog.querySelector(
        `#assign-visit-${normalizedStudy.visits[0].id}`
      ) as HTMLInputElement;

      expect(visit0Checkbox).not.toBeNull();
      expect(visit0Checkbox.checked).toBe(isAssignedToVisit0);
    });

    it("toggles visit assignment, triggering onAssignFormToVisit and onUnassignFormFromVisit", async () => {
      const onAssignFormToVisit = vi.fn();
      const onUnassignFormFromVisit = vi.fn();

      await act(async () => {
        root = createRoot(container);
        root.render(
          <StudySpine
            {...defaultProps}
            activeTab="forms"
            onAssignFormToVisit={onAssignFormToVisit}
            onUnassignFormFromVisit={onUnassignFormFromVisit}
          />
        );
      });

      const firstAssignBtn = container.querySelector(
        'button[title="Assign to Visit"]'
      ) as HTMLButtonElement;

      await act(async () => {
        firstAssignBtn.click();
      });

      const dialog = container.querySelector(
        '[role="dialog"][data-testid="assign-to-visit-dialog"]'
      ) as HTMLElement;

      const targetForm = normalizedStudy.forms[0];
      const assignedVisit = normalizedStudy.visits[0]; // currently assigned
      const unassignedVisit = normalizedStudy.visits[1]; // currently unassigned

      // Toggle assigned visit -> unassign
      const assignedCb = dialog.querySelector(
        `#assign-visit-${assignedVisit.id}`
      ) as HTMLInputElement;
      await act(async () => {
        assignedCb.click();
      });

      expect(onUnassignFormFromVisit).toHaveBeenCalledWith(
        assignedVisit.id,
        targetForm.id
      );

      // Toggle unassigned visit -> assign
      const unassignedCb = dialog.querySelector(
        `#assign-visit-${unassignedVisit.id}`
      ) as HTMLInputElement;
      await act(async () => {
        unassignedCb.click();
      });

      expect(onAssignFormToVisit).toHaveBeenCalledWith(
        unassignedVisit.id,
        targetForm.id
      );
    });

    it("announces assignment status updates to screen readers with aria-live='polite'", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<StudySpine {...defaultProps} activeTab="forms" />);
      });

      const firstAssignBtn = container.querySelector(
        'button[title="Assign to Visit"]'
      ) as HTMLButtonElement;

      await act(async () => {
        firstAssignBtn.click();
      });

      const dialog = container.querySelector(
        '[role="dialog"][data-testid="assign-to-visit-dialog"]'
      ) as HTMLElement;

      const liveRegion = dialog.querySelector('[aria-live="polite"]');
      expect(liveRegion).not.toBeNull();

      const cb = dialog.querySelector(
        `#assign-visit-${normalizedStudy.visits[0].id}`
      ) as HTMLInputElement;

      await act(async () => {
        cb.click();
      });

      expect(liveRegion?.textContent).toContain(normalizedStudy.forms[0].name);
      expect(liveRegion?.textContent).toContain(normalizedStudy.visits[0].name);
    });

    it("moves focus to the first interactive element inside the dialog on open (Condition 3)", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<StudySpine {...defaultProps} activeTab="forms" />);
      });

      const firstAssignBtn = container.querySelector(
        'button[title="Assign to Visit"]'
      ) as HTMLButtonElement;
      firstAssignBtn.focus();

      await act(async () => {
        firstAssignBtn.click();
      });

      const dialog = container.querySelector(
        '[role="dialog"][data-testid="assign-to-visit-dialog"]'
      ) as HTMLElement;
      expect(dialog).not.toBeNull();

      // First interactive element is the close button in the header
      const firstInteractive = dialog.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;

      expect(document.activeElement).toBe(firstInteractive);
    });

    it("closes dialog on Escape and restores focus to the trigger button (Condition 4)", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<StudySpine {...defaultProps} activeTab="forms" />);
      });

      const firstAssignBtn = container.querySelector(
        'button[title="Assign to Visit"]'
      ) as HTMLButtonElement;
      firstAssignBtn.focus();
      expect(document.activeElement).toBe(firstAssignBtn);

      await act(async () => {
        firstAssignBtn.click();
      });

      const dialog = container.querySelector(
        '[role="dialog"][data-testid="assign-to-visit-dialog"]'
      );
      expect(dialog).not.toBeNull();

      // Press Escape
      await act(async () => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
          })
        );
      });

      // Dialog is closed
      expect(
        container.querySelector(
          '[role="dialog"][data-testid="assign-to-visit-dialog"]'
        )
      ).toBeNull();

      // Allow returnFocus to flush
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(document.activeElement).toBe(firstAssignBtn);
    });

    it("allows selecting visits using Enter key (Scenario 1 & Condition 5)", async () => {
      const onAssignFormToVisit = vi.fn();

      await act(async () => {
        root = createRoot(container);
        root.render(
          <StudySpine
            {...defaultProps}
            activeTab="forms"
            onAssignFormToVisit={onAssignFormToVisit}
          />
        );
      });

      const firstAssignBtn = container.querySelector(
        'button[title="Assign to Visit"]'
      ) as HTMLButtonElement;

      await act(async () => {
        firstAssignBtn.click();
      });

      const dialog = container.querySelector(
        '[role="dialog"][data-testid="assign-to-visit-dialog"]'
      ) as HTMLElement;

      const unassignedVisit = normalizedStudy.visits[1];
      const unassignedCb = dialog.querySelector(
        `#assign-visit-${unassignedVisit.id}`
      ) as HTMLInputElement;

      await act(async () => {
        unassignedCb.focus();
        unassignedCb.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
            cancelable: true,
          })
        );
      });

      expect(onAssignFormToVisit).toHaveBeenCalledWith(
        unassignedVisit.id,
        normalizedStudy.forms[0].id
      );
    });

    it("updates study spine visit counts without page reload (Condition 6)", async () => {
      let currentStudy = { ...normalizedStudy };

      await act(async () => {
        root = createRoot(container);
        root.render(
          <StudySpine
            {...defaultProps}
            study={currentStudy}
            activeTab="spine"
          />
        );
      });

      // Initially, visit 0 has 2 assigned forms
      expect(container.textContent).toContain("2 forms");

      // Update study to assign form 2 to visit 0 as well
      const updatedVisits = currentStudy.visits.map((v, idx) =>
        idx === 0
          ? {
              ...v,
              assignedFormIds: [
                ...v.assignedFormIds,
                normalizedStudy.forms[2].id,
              ],
            }
          : v
      );
      currentStudy = { ...currentStudy, visits: updatedVisits };

      await act(async () => {
        root.render(
          <StudySpine
            {...defaultProps}
            study={currentStudy}
            activeTab="spine"
          />
        );
      });

      // Shows 3 forms immediately without reload
      expect(container.textContent).toContain("3 forms");
    });

    it("preserves drag attributes on the form card for mouse users", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(<StudySpine {...defaultProps} activeTab="forms" />);
      });

      const formRow = container.querySelector(
        '[role="button"][aria-label^="Select form"]'
      ) as HTMLElement;

      expect(formRow.getAttribute("draggable")).toBe("true");
    });
  });
});
