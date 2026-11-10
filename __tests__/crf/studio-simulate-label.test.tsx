// @vitest-environment jsdom
/**
 * The action that opens the authored protocol in Clinical Trial Chaos names
 * the game as its destination (#3135), with the same label in the Check menu
 * and the phone drawer. Since #3394 and #3395 it is a menu item rather than
 * a header button, so one label constant serves both places.
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
import {
  SIMULATE_IN_GAME_LABEL,
  STUDIO_HEADER_MENUS,
} from "@/components/crf/studio-stages";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(cleanup);

function renderHeader() {
  render(
    <StudioHeader
      study={ONCOLOGY_RECIST_PRESET}
      activeMode="designer"
      canUndo={false}
      canRedo={false}
      onUndo={vi.fn()}
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
}

describe("Try in Clinical Trial Chaos (#3135)", () => {
  it("names the game in the label and says it opens a game in the hint", () => {
    expect(SIMULATE_IN_GAME_LABEL).toBe("Try in Clinical Trial Chaos (game)");
    const item = STUDIO_HEADER_MENUS.flatMap((menu) => menu.items).find(
      (entry) => entry.id === "simulate"
    );
    expect(item?.label).toBe(SIMULATE_IN_GAME_LABEL);
    expect(item?.description).toMatch(/game/i);
  });

  it("shows the same text in the Check menu and the phone drawer", () => {
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: /^Check/ }));
    const menu = screen.getByRole("menu", { name: /^Check/ });
    const menuEntry = within(menu).getByRole("menuitem", {
      name: SIMULATE_IN_GAME_LABEL,
    });
    expect(menuEntry.getAttribute("title")).toMatch(/game/i);
    fireEvent.keyDown(menuEntry, { key: "Escape" });

    fireEvent.click(
      screen.getByRole("button", { name: "More Studio Actions" })
    );
    const drawer = screen.getByRole("dialog", { name: "Studio Actions" });
    expect(
      within(drawer).getByRole("button", { name: SIMULATE_IN_GAME_LABEL })
    ).toBeTruthy();
  });

  it("labels the Live EDC mode as data entry and keeps its short label", () => {
    renderHeader();
    const tab = screen.getByRole("tab", { name: /Live EDC/ });
    expect(tab.textContent).toContain("Live EDC data entry");
    expect(tab.textContent).toContain("Live EDC");
  });
});
