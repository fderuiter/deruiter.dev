// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import axe from "axe-core";
import { FieldManualButton } from "@/components/FieldManualButton";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
    playAutocomplete: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// `?view=phone` forces the phone view in any build (ADR 0062), which is how
// these tests get the phone layout without a coarse pointer.
function useView(view: "phone" | null) {
  window.history.replaceState(null, "", view ? `/?view=${view}` : "/");
}

async function openManual(manualId = "working-with-duck") {
  render(
    <main>
      <FieldManualButton manualId={manualId} variant="inline" />
    </main>
  );
  const trigger = screen.getByRole("button");
  await act(async () => {
    trigger.focus();
    fireEvent.click(trigger);
  });
  return trigger;
}

const sections = () =>
  Array.from(
    screen.getByTestId("field-manual-sheet").querySelectorAll("details")
  );

describe("FieldManualModal on a phone (#2796)", () => {
  beforeEach(() => {
    localStorage.clear();
    useView("phone");
  });

  afterEach(() => {
    cleanup();
    useView(null);
  });

  it("opens as a full-height bottom sheet named by the manual's title", async () => {
    await openManual();
    const sheet = screen.getByTestId("field-manual-sheet");
    expect(sheet.getAttribute("role")).toBe("dialog");
    expect(sheet.dataset.snap).toBe("full");
    // Portaled to the body, it sits on the cabinet's layer so it paints over
    // a fixed phone cabinet instead of under it.
    const root = screen.getByTestId("field-manual-sheet-root");
    expect(root.parentElement).toBe(document.body);
    expect(root.className).toContain("z-50");
    expect(screen.getByRole("dialog", { name: /Working With Duck/i })).toBe(
      sheet
    );
    // The desktop tab buttons give way to the accordion.
    expect(
      screen.queryByRole("button", { name: /^Engineering Lore$/i })
    ).toBeNull();
  });

  it("shows the sections as an accordion with only Objective open", async () => {
    await openManual();
    const details = sections();
    expect(details.map((d) => d.querySelector("summary")?.textContent)).toEqual(
      ["Objective", "Controls", "Rules and pro tips", "Engineering lore"]
    );
    expect(details.map((d) => d.open)).toEqual([true, false, false, false]);
    for (const summary of details.map((d) => d.querySelector("summary"))) {
      expect(summary?.className).toContain("min-h-11");
    }
  });

  it("lists the action map's touch controls in the control table", async () => {
    await openManual("working-with-duck");
    const table = screen.getByRole("table", {
      name: /Controls for Working With Duck/i,
    });
    const controls = Array.from(table.querySelectorAll("kbd"));
    expect(controls.length).toBeGreaterThan(0);
    const touch = controls.filter((kbd) => kbd.dataset.control === "touch");
    expect(touch.length).toBeGreaterThan(0);
    for (const kbd of touch) {
      expect(kbd.textContent).not.toMatch(/Press|Key[A-Z]/);
    }
  });

  it("has no text below 12px", async () => {
    await openManual();
    for (const d of sections()) d.open = true;
    expect(screen.getByTestId("field-manual-sheet").innerHTML).not.toMatch(
      /text-\[(8|9|10|11)px\]/
    );
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const trigger = await openManual();
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByTestId("field-manual-sheet")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes from the Ready to Play button", async () => {
    await openManual();
    fireEvent.click(screen.getByRole("button", { name: /Ready to Play/i }));
    expect(screen.queryByTestId("field-manual-sheet")).toBeNull();
  });

  it("has zero axe violations with every section open", async () => {
    await openManual();
    for (const d of sections()) d.open = true;
    const result = await axe.run(document.body, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
    expect(result.violations).toEqual([]);
  });
});

describe("FieldManualModal on desktop keeps its tabs (#2796)", () => {
  afterEach(cleanup);

  it("renders the tabbed card, not the sheet", async () => {
    useView(null);
    await openManual();
    expect(screen.queryByTestId("field-manual-sheet")).toBeNull();
    expect(screen.getByRole("dialog").querySelector("details")).toBeNull();
    expect(
      screen.getByRole("button", { name: /Engineering Lore/i })
    ).toBeTruthy();
  });
});
