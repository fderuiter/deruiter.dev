// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { CardTable } from "@/components/trial-and-error/CardTable";
import {
  DEMOGRAPHICS_SCENARIO,
  DMC_MILESTONE_SCENARIO,
  HAND_EXAMPLES,
  HAND_NAMES,
  HandTypeSchema,
  advanceTable,
  createTableState,
  deriveTableView,
  handLevelTable,
  initialHandLevels,
} from "@/lib/trial-and-error";
import { authored } from "./utils/trial-and-error-authored";

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
const DM_LISTING = "C-L16.2.4";

const card = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-card-id="${id}"]`)!;
const sheet = () => screen.queryByTestId("hand-sheet");
const rows = () => screen.getAllByTestId("hand-sheet-row");
const pressH = (target: Element) => fireEvent.keyDown(target, { key: "h" });

describe("hand cheat sheet domain (#1081)", () => {
  it("gives every hand a name, a description and an example in the table", () => {
    const table = handLevelTable(initialHandLevels());
    expect(table.map((row) => row.handType)).toEqual(HandTypeSchema.options);
    for (const row of table) {
      expect(row.name).toBe(HAND_NAMES[row.handType]);
      expect(row.example).toBe(HAND_EXAMPLES[row.handType]);
      expect(row.description.length).toBeGreaterThan(0);
      // The prose standard (#1144): no em dashes in authored copy.
      expect(row.example).not.toContain("—");
    }
  });

  it("refuses the hands a stage does not accept, and none elsewhere", () => {
    const dmc = deriveTableView(
      DMC_MILESTONE_SCENARIO,
      createTableState(DMC_MILESTONE_SCENARIO)
    );
    const accepts = DMC_MILESTONE_SCENARIO.encounter!.stages[0].hands;
    expect(dmc.refusedHands).toEqual(
      HandTypeSchema.options.filter((h) => !accepts.includes(h))
    );
    expect(dmc.refusedHands).not.toContain("TLF_PAIR");

    const plain = deriveTableView(
      DEMOGRAPHICS_SCENARIO,
      createTableState(DEMOGRAPHICS_SCENARIO)
    );
    expect(plain.refusedHands).toEqual([]);
  });

  it("refuses nothing once the staged Blind is decided", () => {
    let state = createTableState(DMC_MILESTONE_SCENARIO);
    state = { ...state, status: "FAILED" };
    expect(deriveTableView(DMC_MILESTONE_SCENARIO, state).refusedHands).toEqual(
      []
    );
    // Reading the table is not a move: the view never changes the state.
    const fresh = createTableState(DEMOGRAPHICS_SCENARIO);
    const after = advanceTable(DEMOGRAPHICS_SCENARIO, fresh, {
      type: "CLOSE_INSPECT",
    });
    expect(after.cpu).toEqual(fresh.cpu);
  });
});

describe("hand cheat sheet (#1081)", () => {
  it("lists every hand strongest first with the domain's values", () => {
    render(<CardTable scenario={authored(DEMOGRAPHICS_SCENARIO)} />);
    fireEvent.click(screen.getByTestId("hand-sheet-button"));
    expect(sheet()).not.toBeNull();
    expect(screen.getByRole("dialog", { name: "Hands" })).toBeTruthy();
    const expected = [...handLevelTable(initialHandLevels())].reverse();
    expect(rows().map((r) => r.getAttribute("data-hand"))).toEqual(
      expected.map((r) => r.handType)
    );
    rows().forEach((row, i) => {
      expect(row.textContent).toContain(expected[i].name);
      expect(row.textContent).toContain(`Lv.${expected[i].level}`);
      expect(row.textContent).toContain(`${expected[i].chips} Chips`);
      expect(row.textContent).toContain(`+${expected[i].mult} Mult`);
      expect(row.textContent).toContain(expected[i].example);
    });
    expect(screen.queryByText("Refused this stage")).toBeNull();
    expect(screen.queryByText("Your selection")).toBeNull();
  });

  it("marks the hand the selection makes, in text", () => {
    render(<CardTable scenario={authored(DEMOGRAPHICS_SCENARIO)} />);
    fireEvent.click(card(DRAFT_A));
    fireEvent.click(card(DM_LISTING));
    fireEvent.click(screen.getByTestId("hand-sheet-button"));
    const selected = rows().filter((r) => r.dataset.selected);
    expect(selected.map((r) => r.dataset.hand)).toEqual(["TLF_PAIR"]);
    expect(selected[0].textContent).toContain("Your selection");
  });

  it("greys and labels the hands a stage refuses", () => {
    render(<CardTable scenario={authored(DMC_MILESTONE_SCENARIO)} />);
    fireEvent.click(screen.getByTestId("boss-intro-start"));
    fireEvent.click(screen.getByTestId("hand-sheet-button"));
    const refused = rows().filter((r) => r.dataset.refused);
    const accepts = DMC_MILESTONE_SCENARIO.encounter!.stages[0].hands;
    expect(refused.map((r) => r.dataset.hand).sort()).toEqual(
      HandTypeSchema.options.filter((h) => !accepts.includes(h)).sort()
    );
    for (const row of refused) {
      expect(row.textContent).toContain("Refused this stage");
    }
    const open = rows().filter((r) => !r.dataset.refused);
    expect(open.every((r) => !r.textContent?.includes("Refused"))).toBe(true);
  });

  it("opens and closes on H from a card, keeping the key from the page", async () => {
    const onWindow = vi.fn();
    window.addEventListener("keydown", onWindow);
    try {
      render(<CardTable scenario={authored(DEMOGRAPHICS_SCENARIO)} />);
      const focused = card(DRAFT_A);
      focused.focus();
      pressH(focused);
      expect(sheet()).not.toBeNull();
      // The site-wide H (Field Manual) never sees it inside the table.
      expect(onWindow).not.toHaveBeenCalled();
      const close = screen.getByRole("button", { name: /Close/ });
      await waitFor(() =>
        expect(sheet()!.contains(document.activeElement)).toBe(true)
      );
      pressH(close);
      expect(sheet()).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(focused));
      expect(onWindow).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", onWindow);
    }
  });

  it("closes on Escape and returns focus to its button", () => {
    render(<CardTable scenario={authored(DEMOGRAPHICS_SCENARIO)} />);
    const button = screen.getByTestId("hand-sheet-button");
    button.focus();
    fireEvent.click(button);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(sheet()).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("ignores H with a modifier and while typing", () => {
    render(<CardTable scenario={authored(DEMOGRAPHICS_SCENARIO)} />);
    fireEvent.keyDown(card(DRAFT_A), { key: "h", ctrlKey: true });
    fireEvent.keyDown(card(DRAFT_A), { key: "H", shiftKey: true });
    expect(sheet()).toBeNull();
    const input = document.createElement("input");
    screen.getByTestId("hand").appendChild(input);
    pressH(input);
    expect(sheet()).toBeNull();
  });

  it("does not change the table when opened", () => {
    render(<CardTable scenario={authored(DEMOGRAPHICS_SCENARIO)} />);
    const pips = screen.getByTestId("cpu-pips").textContent;
    const score = screen.getByTestId("round-score").textContent;
    pressH(card(DRAFT_A));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.getByTestId("cpu-pips").textContent).toBe(pips);
    expect(screen.getByTestId("round-score").textContent).toBe(score);
  });
});
