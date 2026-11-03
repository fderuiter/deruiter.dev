// @vitest-environment jsdom
/**
 * The studio header's secondary actions grouped into Edit, View, Check and
 * Share menus (#3394): every moved control stays reachable by its role and
 * name, the menus follow the menu-button keyboard pattern, and the issue
 * count stays on the Check trigger.
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { StudioHeader } from "@/components/crf/StudioHeader";
import { STUDIO_HEADER_MENUS } from "@/components/crf/studio-stages";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(cleanup);

function renderHeader(
  overrides: Partial<React.ComponentProps<typeof StudioHeader>> = {}
) {
  const handlers = {
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onOpenOmnibar: vi.fn(),
    onOpenFormCatalog: vi.fn(),
    onOpenLibraryUpgrades: vi.fn(),
    onOpenBaselines: vi.fn(),
    onOpenCompareBaseline: vi.fn(),
    onOpenBranding: vi.fn(),
    onToggleTheme: vi.fn(),
    onToggleLeftSidebar: vi.fn(),
    onToggleRightInspector: vi.fn(),
    onToggleTerminal: vi.fn(),
    onOpenWizard: vi.fn(),
    onStartSpotlightTour: vi.fn(),
    onOpenDiagnostics: vi.fn(),
    onToggleTestDock: vi.fn(),
    onOpenExportDocument: vi.fn(),
    onCopyShareLink: vi.fn(),
  };
  render(
    <StudioHeader
      study={ONCOLOGY_RECIST_PRESET}
      activeMode="designer"
      canUndo
      canRedo
      onChangeMode={vi.fn()}
      onSelectPreset={vi.fn()}
      {...handlers}
      {...overrides}
    />
  );
  return handlers;
}

const trigger = (name: string) =>
  screen.getByRole("button", { name: new RegExp(`^${name}`) });

/** A menu item or checkbox menu item, found by its accessible name. */
function menuItem(panel: HTMLElement, name: string | RegExp): HTMLElement {
  const matches = [
    ...within(panel).queryAllByRole("menuitem", { name }),
    ...within(panel).queryAllByRole("menuitemcheckbox", { name }),
  ];
  expect(matches).toHaveLength(1);
  return matches[0];
}

function openMenu(name: string) {
  fireEvent.click(trigger(name));
  return screen.getByRole("menu", { name: new RegExp(`^${name}`) });
}

describe("studio header menus (#3394)", () => {
  it("groups the actions as approved, with Run Pipeline in no menu", () => {
    expect(
      Object.fromEntries(
        STUDIO_HEADER_MENUS.map((menu) => [
          menu.label,
          menu.items.map((item) => item.id),
        ])
      )
    ).toEqual({
      Edit: [
        "undo",
        "redo",
        "find",
        "add-form",
        "library-upgrades",
        "baselines",
        "compare-baseline",
        "branding",
      ],
      View: [
        "toggle-theme",
        "toggle-sidebar",
        "toggle-inspector",
        "toggle-terminal",
        "guide",
        "tour",
      ],
      Check: ["diagnostics", "toggle-test-dock", "simulate"],
      Share: ["export-doc", "copy-link"],
    });
  });

  it.each([
    ["Edit", "Undo", "onUndo"],
    ["Edit", "Redo", "onRedo"],
    ["Edit", "Find in study", "onOpenOmnibar"],
    ["Edit", "Add form", "onOpenFormCatalog"],
    ["Edit", "Library Block Upgrades", "onOpenLibraryUpgrades"],
    ["Edit", "Study Baselines", "onOpenBaselines"],
    ["Edit", "Compare Against Baseline", "onOpenCompareBaseline"],
    ["Edit", "Organization Branding", "onOpenBranding"],
    ["View", "Switch to Clinical Light Mode", "onToggleTheme"],
    ["View", "Forms Navigator", "onToggleLeftSidebar"],
    ["View", "Property Inspector", "onToggleRightInspector"],
    ["View", "CLI Terminal Drawer", "onToggleTerminal"],
    ["View", "Interactive Guide", "onOpenWizard"],
    ["View", "Spotlight UI Tour", "onStartSpotlightTour"],
    [
      "Check",
      /^Conformance Diagnostics (\d+ Issues|Verified)$/,
      "onOpenDiagnostics",
    ],
    ["Check", "Form Test Dock", "onToggleTestDock"],
    ["Share", "Docx / PDF Books", "onOpenExportDocument"],
    ["Share", "Copy View Link", "onCopyShareLink"],
  ] as const)("%s > %s runs its handler", (menu, item, handler) => {
    const handlers = renderHeader();
    const panel = openMenu(menu);
    const control = menuItem(panel, item);
    fireEvent.click(control);
    expect(handlers[handler]).toHaveBeenCalledTimes(1);
    expect(trigger(menu).getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger(menu));
  });

  it("names items by their visible label and exposes shortcuts as key shortcuts", () => {
    renderHeader();
    const undo = menuItem(openMenu("Edit"), "Undo");
    expect(undo.getAttribute("aria-keyshortcuts")).toBe("Meta+Z Control+Z");
    expect(undo.querySelector("kbd")?.getAttribute("data-shortcut")).toBe("⌘Z");
    // The hint is drawn by CSS, so it adds nothing to the visible text.
    expect(undo.querySelector("kbd")?.textContent).toBe("");
  });

  it("reports pane, terminal and dock state as checked menu items", () => {
    renderHeader({ isTerminalOpen: true, isTestDockOpen: false });
    const view = openMenu("View");
    expect(
      within(view)
        .getByRole("menuitemcheckbox", { name: "CLI Terminal Drawer" })
        .getAttribute("aria-checked")
    ).toBe("true");
    fireEvent.keyDown(view.querySelector("[role^=menuitem]")!, {
      key: "Escape",
    });
    const check = openMenu("Check");
    expect(
      within(check)
        .getByRole("menuitemcheckbox", { name: "Form Test Dock" })
        .getAttribute("aria-checked")
    ).toBe("false");
  });

  it("disables the pane toggles outside the Canvas and actions without a handler", () => {
    renderHeader({
      activeMode: "matrix",
      canUndo: false,
      onCopyShareLink: undefined,
    });
    const view = openMenu("View");
    expect(
      within(view).getByRole("menuitemcheckbox", { name: "Forms Navigator" })
    ).toHaveProperty("disabled", true);
    fireEvent.click(trigger("View"));
    expect(
      within(openMenu("Edit")).getByRole("menuitem", { name: "Undo" })
    ).toHaveProperty("disabled", true);
    fireEvent.click(trigger("Edit"));
    expect(
      within(openMenu("Share")).getByRole("menuitem", {
        name: "Copy View Link",
      })
    ).toHaveProperty("disabled", true);
  });

  it("keeps the issue count on the Check trigger, which the tour points at", () => {
    renderHeader();
    const check = trigger("Check");
    expect(check.textContent).toMatch(/\d+ Issues|Verified/);
    expect(check.getAttribute("data-tour")).toBe("conformance");
  });

  it("opens with the keyboard, roves the items and closes on Escape to the trigger", () => {
    renderHeader({ canUndo: false });
    const edit = trigger("Edit");
    fireEvent.keyDown(edit, { key: "ArrowDown" });
    expect(edit.getAttribute("aria-expanded")).toBe("true");
    const panel = screen.getByRole("menu", { name: /^Edit/ });
    const items = Array.from(
      panel.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)')
    );
    // Undo is disabled, so Redo is the first item that takes focus.
    expect(document.activeElement).toBe(items[0]);
    expect(items[0].getAttribute("aria-label")).toBe("Redo");

    fireEvent.keyDown(items[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1], { key: "End" });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[items.length - 1]);

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(edit.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(edit);
  });

  it("opens on the last item with ArrowUp and crosses to the next menu with ArrowRight", () => {
    renderHeader();
    const edit = trigger("Edit");
    fireEvent.keyDown(edit, { key: "ArrowUp" });
    const editItems = screen
      .getByRole("menu", { name: /^Edit/ })
      .querySelectorAll<HTMLElement>('[role^="menuitem"]');
    expect(document.activeElement).toBe(editItems[editItems.length - 1]);

    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(edit.getAttribute("aria-expanded")).toBe("false");
    expect(trigger("View").getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Switch to Clinical Light Mode"
    );
  });

  it("moves between closed triggers without opening them", () => {
    renderHeader();
    const edit = trigger("Edit");
    edit.focus();
    fireEvent.keyDown(edit, { key: "End" });
    expect(document.activeElement).toBe(trigger("Share"));
    fireEvent.keyDown(trigger("Share"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(edit);
    expect(edit.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on a press outside the menus and on Tab", () => {
    renderHeader();
    openMenu("Share");
    fireEvent.pointerDown(document.body);
    expect(trigger("Share").getAttribute("aria-expanded")).toBe("false");

    fireEvent.keyDown(trigger("Share"), { key: "Enter" });
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(trigger("Share").getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger("Share"));
  });

  it("offers the same groups in the phone drawer, which closes on Escape", () => {
    const handlers = renderHeader();
    const more = screen.getByRole("button", { name: "More Studio Actions" });
    fireEvent.click(more);
    const dialog = screen.getByRole("dialog", { name: "Studio Actions" });
    for (const menu of STUDIO_HEADER_MENUS) {
      expect(
        within(dialog).getByRole("heading", { name: menu.label })
      ).toBeTruthy();
    }
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Docx / PDF Books" })
    );
    expect(handlers.onOpenExportDocument).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Studio Actions" })).toBeNull();

    fireEvent.click(more);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
  });
});
