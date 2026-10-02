import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { CardTable } from "@/components/trial-and-error/CardTable";
import {
  DEMOGRAPHICS_SCENARIO,
  GUIDANCE_CARDS,
  type Scenario,
} from "@/lib/trial-and-error";

const announce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce }),
}));
vi.mock("@/components/FieldManualButton", () => ({
  FieldManualButton: () => <button type="button">Manual</button>,
}));

beforeEach(() => {
  announce.mockClear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});
afterEach(cleanup);

const DRAFT_A = "C-T14.1.1-A";
const card = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-card-id="${id}"]`)!;
const runInfo = () => screen.queryByRole("dialog", { name: "Run Info" });

/** The Small Blind with an FDA Study Data TCG card in the tray instead of seals. */
const WITH_GUIDANCE: Scenario = {
  ...DEMOGRAPHICS_SCENARIO,
  consumables: [],
  guidance: [GUIDANCE_CARDS.HIGH_TABLE],
};

describe("Run Info (T&E-UX-05)", () => {
  it("opens from its button with the hand table, relics and seed, and closes on Escape", () => {
    render(<CardTable seed="info" />);
    // The seed lives in Run Info now, not on the Blind panel.
    expect(screen.queryByTestId("run-seed")).toBeNull();
    const button = screen.getByTestId("run-info-button");
    button.focus();
    fireEvent.click(button);
    const dialog = runInfo()!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const table = within(dialog).getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent)
    ).toEqual(["Hand", "Level", "Chips", "Mult", "Played"]);
    const rows = within(dialog).getAllByTestId("run-info-hand");
    expect(rows).toHaveLength(7);
    expect(
      within(rows[0])
        .getAllByRole("cell")
        .map((c) => c.textContent)
    ).toEqual(["Lv.1", "15", "+1", "0"]);
    expect(within(rows[0]).getByRole("rowheader").textContent).toBe(
      "High Table"
    );
    expect(within(dialog).getByTestId("run-seed").textContent).toBe("info");
    expect(within(dialog).getByTestId("run-info-relics").textContent).toContain(
      "None equipped"
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(runInfo()).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("opens with Shift+R from a card, while a plain R stays Recompile", () => {
    render(<CardTable seed="keys" />);
    const target = card(DRAFT_A);
    target.focus();
    fireEvent.keyDown(target, { key: "r" });
    expect(runInfo()).toBeNull();
    fireEvent.keyDown(target, { key: "R", shiftKey: true });
    expect(runInfo()).not.toBeNull();
    // A second Shift+R inside the open dialog does not stack another.
    fireEvent.keyDown(document.activeElement!, { key: "R", shiftKey: true });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("shows the selection's hand level in the live preview", () => {
    render(<CardTable seed="preview" />);
    fireEvent.click(card(DRAFT_A));
    expect(screen.getByTestId("hand-level").textContent).toBe("Lv.1");
  });
});

describe("Guidance cards in the tray (T&E-UX-05)", () => {
  it("levels a hand up, plays the level-up plate, and updates preview and Run Info", () => {
    render(<CardTable scenario={WITH_GUIDANCE} seed="guide" />);
    const [item] = screen.getAllByTestId("consumable");
    expect(item.getAttribute("data-kind")).toBe("guidance");
    expect(item.textContent).toContain("FDA Study Data TCG");
    expect(item.textContent).toContain("+10 Chips +1 Mult");
    const use = within(item).getByRole("button", {
      name: /Use FDA Study Data TCG: level High Table up from Lv\.1 to Lv\.2/,
    });
    fireEvent.click(use);

    const plate = screen.getByTestId("level-up");
    expect(plate.textContent).toContain("High Table Lv.1 → Lv.2");
    // Reduced motion: the numbers land at once.
    expect(plate.textContent).toContain("[25] × [2]");
    expect(announce).toHaveBeenLastCalledWith(
      "FDA Study Data TCG: High Table levelled up to Lv.2. Base 25 Chips, +2 Mult."
    );
    expect(screen.queryAllByTestId("consumable")).toHaveLength(0);

    fireEvent.click(card(DRAFT_A));
    expect(screen.queryByTestId("level-up")).toBeNull();
    expect(screen.getByTestId("hand-level").textContent).toBe("Lv.2");

    fireEvent.click(screen.getByTestId("run-info-button"));
    const [high] = within(runInfo()!).getAllByTestId("run-info-hand");
    expect(
      within(high)
        .getAllByRole("cell")
        .map((c) => c.textContent)
    ).toEqual(["Lv.2", "25", "+2", "0"]);
  });

  it("ticks the level-up numbers when motion is allowed", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
    const frames: FrameRequestCallback[] = [];
    const raf = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => frames.push(cb));
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    render(<CardTable scenario={WITH_GUIDANCE} seed="tick" />);
    fireEvent.click(
      within(screen.getByTestId("consumable")).getByRole("button", {
        name: /Use FDA Study Data TCG/,
      })
    );
    const plate = screen.getByTestId("level-up");
    expect(plate.textContent).toContain("[15] × [1]");
    // useAnimationFrame anchors its clock on the first frame (#1589), so the
    // tick starts there and lands once 600 ms of frames have passed.
    act(() => {
      frames.splice(0).forEach((cb) => cb(16));
    });
    expect(plate.textContent).toContain("[15] × [1]");
    act(() => {
      frames.splice(0).forEach((cb) => cb(10_000));
    });
    expect(plate.textContent).toContain("[25] × [2]");
    // The numbers have landed, so the loop stops asking for frames.
    act(() => {
      frames.splice(0).forEach((cb) => cb(10_016));
    });
    expect(frames).toHaveLength(0);
    raf.mockRestore();
    now.mockRestore();
  });

  it("sells a Guidance card for its value", () => {
    render(<CardTable scenario={WITH_GUIDANCE} seed="sell" />);
    fireEvent.click(screen.getByRole("button", { name: "Sell · $1k" }));
    expect(screen.getByTestId("study-budget").textContent).toBe("Budget $1k");
    expect(announce).toHaveBeenLastCalledWith(
      "Sold FDA Study Data TCG for $1k. Study budget $1k."
    );
  });
});
