// @vitest-environment jsdom
/**
 * CRF Studio's seven modes grouped into three stages, with one visible next
 * step (#2927 item 12, #2680).
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StudioHeader } from "@/components/crf/StudioHeader";
import {
  MODE_BY_KEY,
  STUDIO_HEADER_MENUS,
  STUDIO_MODE_ORDER,
  STUDIO_STAGES,
  StudioMenuItemSpec,
  StudioMenuSpec,
  nextStepFor,
  stageOfMode,
} from "@/components/crf/studio-stages";
import type { StudioMode } from "@/lib/crf";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(cleanup);

function renderHeader(activeMode: StudioMode, onChangeMode = vi.fn()) {
  render(
    <StudioHeader
      study={ONCOLOGY_RECIST_PRESET}
      activeMode={activeMode}
      canUndo={false}
      canRedo={false}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      onChangeMode={onChangeMode}
      onSelectPreset={vi.fn()}
      onOpenDiagnostics={vi.fn()}
      onOpenFormCatalog={vi.fn()}
      onOpenBranding={vi.fn()}
      onOpenExportDocument={vi.fn()}
      onOpenWizard={vi.fn()}
    />
  );
  return onChangeMode;
}

describe("studio stages", () => {
  it("places every mode in exactly one stage, in Design, Schedule, Verify order", () => {
    expect(STUDIO_STAGES.map((stage) => stage.label)).toEqual([
      "Design",
      "Schedule",
      "Verify and ship",
    ]);
    expect(STUDIO_MODE_ORDER).toEqual([
      "designer",
      "grid",
      "rules",
      "matrix",
      "edc",
      "acrf",
      "export",
    ]);
    expect(new Set(STUDIO_MODE_ORDER).size).toBe(7);
  });

  it("numbers the shortcuts in stage order", () => {
    expect(MODE_BY_KEY).toEqual({
      "1": "designer",
      "2": "grid",
      "3": "rules",
      "4": "matrix",
      "5": "edc",
      "6": "acrf",
      "7": "export",
    });
  });

  it("points each stage at the first mode of the next, and the last at the pipeline", () => {
    expect(nextStepFor("rules")).toEqual({
      kind: "mode",
      mode: "matrix",
      label: "Schedule the forms",
    });
    expect(nextStepFor("matrix")).toEqual({
      kind: "mode",
      mode: "edc",
      label: "Test in Live EDC",
    });
    expect(nextStepFor("acrf")).toEqual({
      kind: "pipeline",
      label: "Run the pipeline",
    });
    expect(stageOfMode("grid").id).toBe("design");
  });
});

describe("StudioHeader mode bar", () => {
  it("renders the tabs in stage order inside one tablist", () => {
    renderHeader("designer");
    const tablist = screen.getByRole("tablist", {
      name: "Studio Mode Navigation",
    });
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    expect(tabs).toHaveLength(7);
    expect(tabs.map((tab) => tab.getAttribute("title"))).toEqual([
      expect.stringMatching(/Build the open form.*\(1\)$/),
      expect.stringMatching(/Edit every field.*\(2\)$/),
      expect.stringMatching(/Edit checks.*\(3\)$/),
      expect.stringMatching(/Schedule of Assessments.*\(4\)$/),
      expect.stringMatching(/Enter test data.*\(5\)$/),
      expect.stringMatching(/annotated CRF.*\(6\)$/),
      expect.stringMatching(/Download the study.*\(7\)$/),
    ]);
    expect(
      Array.from(tablist.querySelectorAll("[data-stage]")).map((group) =>
        group.getAttribute("data-stage")
      )
    ).toEqual(["design", "schedule", "verify"]);
  });

  it("groups the phone mode picker by stage", () => {
    renderHeader("designer");
    const picker = screen.getByRole("combobox", { name: "Studio mode" });
    expect(
      Array.from(picker.querySelectorAll("optgroup")).map((group) => [
        group.label,
        Array.from(group.querySelectorAll("option")).map(
          (option) => option.value
        ),
      ])
    ).toEqual([
      ["Design", ["designer", "grid", "rules"]],
      ["Schedule", ["matrix"]],
      ["Verify and ship", ["edc", "acrf", "export"]],
    ]);
  });

  it("moves to the next stage from the next-step button", () => {
    const onChangeMode = renderHeader("grid");
    const next = screen.getByTestId("studio-next-step");
    expect(next.textContent).toContain("Schedule the forms");
    fireEvent.click(next);
    expect(onChangeMode).toHaveBeenCalledWith("matrix");
  });

  it("arrow keys follow the stage order", () => {
    const onChangeMode = renderHeader("rules");
    fireEvent.keyDown(screen.getByRole("tab", { selected: true }), {
      key: "ArrowRight",
    });
    expect(onChangeMode).toHaveBeenCalledWith("matrix");
  });
});

describe("STUDIO_HEADER_MENUS schema", () => {
  it("defines the 4 canonical secondary menus in order: Edit, View, Check, Share", () => {
    expect(STUDIO_HEADER_MENUS.map((m) => m.id)).toEqual([
      "edit",
      "view",
      "check",
      "share",
    ]);
    expect(STUDIO_HEADER_MENUS.map((m) => m.label)).toEqual([
      "Edit",
      "View",
      "Check",
      "Share",
    ]);
  });

  it("configures the Edit menu with undo/redo, catalog, upgrades, baselines, and branding", () => {
    const editMenu = STUDIO_HEADER_MENUS.find((m) => m.id === "edit");
    expect(editMenu).toBeDefined();
    expect(editMenu!.items.map((item) => item.id)).toEqual([
      "undo",
      "redo",
      "add-form",
      "library-upgrades",
      "baselines",
      "branding",
    ]);
    expect(editMenu!.items.find((i) => i.id === "undo")?.shortcut).toBe("⌘Z");
    expect(editMenu!.items.find((i) => i.id === "redo")?.shortcut).toBe("⌘⇧Z");
    expect(editMenu!.items.find((i) => i.id === "add-form")?.dividerBefore).toBe(true);
    expect(editMenu!.items.find((i) => i.id === "baselines")?.dividerBefore).toBe(true);
  });

  it("configures the View menu with sidebars, test dock, terminal, theme, tour, and guide", () => {
    const viewMenu = STUDIO_HEADER_MENUS.find((m) => m.id === "view");
    expect(viewMenu).toBeDefined();
    expect(viewMenu!.items.map((item) => item.id)).toEqual([
      "toggle-sidebar",
      "toggle-inspector",
      "toggle-test-dock",
      "toggle-terminal",
      "toggle-theme",
      "guide",
      "tour",
    ]);
    expect(viewMenu!.items.find((i) => i.id === "toggle-sidebar")?.shortcut).toBe("⌘B");
    expect(viewMenu!.items.find((i) => i.id === "toggle-inspector")?.shortcut).toBe("⌘I");
    expect(viewMenu!.items.find((i) => i.id === "toggle-test-dock")?.shortcut).toBe("⌘\\");
    expect(viewMenu!.items.find((i) => i.id === "toggle-terminal")?.shortcut).toBe("⌘J");
  });

  it("configures the Check menu with diagnostics, baseline comparison, and simulation", () => {
    const checkMenu = STUDIO_HEADER_MENUS.find((m) => m.id === "check");
    expect(checkMenu).toBeDefined();
    expect(checkMenu!.items.map((item) => item.id)).toEqual([
      "diagnostics",
      "compare-baseline",
      "simulate",
    ]);
    expect(checkMenu!.items.find((i) => i.id === "simulate")?.dividerBefore).toBe(true);
  });

  it("configures the Share menu with pipeline, exports, and view link", () => {
    const shareMenu = STUDIO_HEADER_MENUS.find((m) => m.id === "share");
    expect(shareMenu).toBeDefined();
    expect(shareMenu!.items.map((item) => item.id)).toEqual([
      "pipeline",
      "export-doc",
      "copy-link",
    ]);
    expect(shareMenu!.items.find((i) => i.id === "copy-link")?.dividerBefore).toBe(true);
  });

  it("ensures every menu item has a unique id across all menus and non-empty description", () => {
    const allItems = STUDIO_HEADER_MENUS.flatMap((m) => m.items);
    const ids = allItems.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of allItems) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
    }
  });

  it("ensures every menu item conforms to StudioMenuItemSpec and each menu to StudioMenuSpec", () => {
    for (const menu of STUDIO_HEADER_MENUS) {
      const typedMenu: StudioMenuSpec = menu;
      expect(typedMenu.id).toBeDefined();
      for (const item of typedMenu.items) {
        const typedItem: StudioMenuItemSpec = item;
        expect(typedItem.id).toBeDefined();
      }
    }
  });
});

describe("StudioHeader secondary action menus", () => {
  it("renders menubar with Edit, View, Check, and Share trigger buttons", () => {
    renderHeader("designer");
    const menubar = screen.getByRole("menubar", { name: "Studio Menus" });
    expect(menubar).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Edit/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^View/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Check/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Share/i })).toBeTruthy();
  });

  it("toggles a menu open on click and closes on Escape with focus restored", () => {
    renderHeader("designer");
    const editTrigger = screen.getByRole("button", { name: /^Edit/i });
    expect(editTrigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(editTrigger);
    expect(editTrigger.getAttribute("aria-expanded")).toBe("true");

    const editMenu = screen.getByRole("menu", { name: /Edit/i });
    expect(editMenu).toBeTruthy();

    // Escape closes and restores focus
    fireEvent.keyDown(editMenu, { key: "Escape" });
    expect(editTrigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(editTrigger);
  });

  it("navigates through menu items using arrow keys, Home, and End", () => {
    renderHeader("designer");
    const editTrigger = screen.getByRole("button", { name: /^Edit/i });
    fireEvent.click(editTrigger);

    const editMenu = screen.getByRole("menu", { name: /Edit/i });
    const items = Array.from(
      editMenu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])')
    );
    expect(items.length).toBeGreaterThan(0);

    // ArrowDown from trigger moves focus into first item
    fireEvent.keyDown(editTrigger, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);

    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement).toBe(items[items.length - 1]);

    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
  });

  it("roving arrow keys between triggers switch active menu when open", () => {
    renderHeader("designer");
    const editTrigger = screen.getByRole("button", { name: /^Edit/i });
    const viewTrigger = screen.getByRole("button", { name: /^View/i });

    fireEvent.click(editTrigger);
    expect(editTrigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(editTrigger, { key: "ArrowRight" });
    expect(viewTrigger.getAttribute("aria-expanded")).toBe("true");
    expect(editTrigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("invokes callbacks when clicking menu items", () => {
    const onUndo = vi.fn();
    const onOpenFormCatalog = vi.fn();
    const onOpenBranding = vi.fn();
    const onToggleTheme = vi.fn();
    const onOpenDiagnostics = vi.fn();
    const onOpenExportDocument = vi.fn();

    render(
      <StudioHeader
        study={ONCOLOGY_RECIST_PRESET}
        activeMode="designer"
        canUndo={true}
        canRedo={false}
        onUndo={onUndo}
        onRedo={vi.fn()}
        onChangeMode={vi.fn()}
        onSelectPreset={vi.fn()}
        onOpenDiagnostics={onOpenDiagnostics}
        onOpenFormCatalog={onOpenFormCatalog}
        onOpenBranding={onOpenBranding}
        onOpenExportDocument={onOpenExportDocument}
        onOpenWizard={vi.fn()}
        onToggleTheme={onToggleTheme}
      />
    );

    // Click Edit -> Undo
    fireEvent.click(screen.getByRole("button", { name: /^Edit/i }));
    const undoItem = screen.getByRole("menuitem", { name: /^Undo/i });
    fireEvent.click(undoItem);
    expect(onUndo).toHaveBeenCalledTimes(1);

    // Click Edit -> Add Form
    fireEvent.click(screen.getByRole("button", { name: /^Edit/i }));
    const addFormItem = screen.getByRole("menuitem", { name: /^Add Form/i });
    fireEvent.click(addFormItem);
    expect(onOpenFormCatalog).toHaveBeenCalledTimes(1);

    // Click View -> Theme
    fireEvent.click(screen.getByRole("button", { name: /^View/i }));
    const themeItem = screen.getByRole("menuitem", { name: /Theme/i });
    fireEvent.click(themeItem);
    expect(onToggleTheme).toHaveBeenCalledTimes(1);

    // Click Check -> Diagnostics
    fireEvent.click(screen.getByRole("button", { name: /^Check/i }));
    const diagItem = screen.getByRole("menuitem", { name: /Diagnostics/i });
    fireEvent.click(diagItem);
    expect(onOpenDiagnostics).toHaveBeenCalledTimes(1);

    // Click Share -> Export
    fireEvent.click(screen.getByRole("button", { name: /^Share/i }));
    const exportItem = screen.getByRole("menuitem", { name: /Docx \/ PDF/i });
    fireEvent.click(exportItem);
    expect(onOpenExportDocument).toHaveBeenCalledTimes(1);
  });

  it("navigates directly to first and last triggers using Home and End keys", () => {
    renderHeader("designer");
    const editTrigger = screen.getByRole("button", { name: /^Edit/i });
    const shareTrigger = screen.getByRole("button", { name: /^Share/i });

    editTrigger.focus();
    fireEvent.keyDown(editTrigger, { key: "End" });
    expect(document.activeElement).toBe(shareTrigger);

    fireEvent.keyDown(shareTrigger, { key: "Home" });
    expect(document.activeElement).toBe(editTrigger);
  });

  it("opens menu and focuses first enabled item when pressing ArrowDown on closed trigger", () => {
    renderHeader("designer");
    const editTrigger = screen.getByRole("button", { name: /^Edit/i });
    expect(editTrigger.getAttribute("aria-expanded")).toBe("false");

    // In renderHeader, canUndo=false and canRedo=false, so first enabled item is add-form
    fireEvent.keyDown(editTrigger, { key: "ArrowDown" });
    expect(editTrigger.getAttribute("aria-expanded")).toBe("true");

    const addFormItem = screen.getByRole("menuitem", { name: /^Add Form/i });
    expect(document.activeElement).toBe(addFormItem);
  });

  it("restores focus to trigger when activating a menu item via keyboard", () => {
    const onUndo = vi.fn();
    render(
      <StudioHeader
        study={ONCOLOGY_RECIST_PRESET}
        activeMode="designer"
        canUndo={true}
        canRedo={false}
        onUndo={onUndo}
        onRedo={vi.fn()}
        onChangeMode={vi.fn()}
        onSelectPreset={vi.fn()}
        onOpenDiagnostics={vi.fn()}
        onOpenFormCatalog={vi.fn()}
        onOpenBranding={vi.fn()}
        onOpenExportDocument={vi.fn()}
        onOpenWizard={vi.fn()}
      />
    );

    const editTrigger = screen.getByRole("button", { name: /^Edit/i });
    fireEvent.click(editTrigger);
    const undoItem = screen.getByRole("menuitem", { name: /^Undo/i });
    fireEvent.keyDown(undoItem, { key: "Enter" });

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(editTrigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(editTrigger);
  });

  it("opens mobile drawer with dialog role and closes on Escape with focus restoration", () => {
    renderHeader("designer");
    const mobileTrigger = screen.getByRole("button", {
      name: "More Studio Actions",
    });
    expect(mobileTrigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(mobileTrigger);
    expect(mobileTrigger.getAttribute("aria-expanded")).toBe("true");

    const dialog = screen.getByRole("dialog", { name: "Studio Actions" });
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    // Escape closes the drawer via focus trap
    fireEvent.keyDown(window, { key: "Escape" });
    expect(mobileTrigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("handles keydown safely without throwing when items are disabled", () => {
    renderHeader("designer");
    const editTrigger = screen.getByRole("button", { name: /^Edit/i });
    fireEvent.click(editTrigger);

    const editMenu = screen.getByRole("menu", { name: /Edit/i });
    expect(() => {
      fireEvent.keyDown(editMenu, { key: "ArrowDown" });
      fireEvent.keyDown(editMenu, { key: "ArrowUp" });
    }).not.toThrow();
  });
});

