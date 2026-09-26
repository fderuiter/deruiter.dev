// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  act as flush,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { CardTable } from "@/components/trial-and-error/CardTable";
import { CsrLockSummary } from "@/components/trial-and-error/CsrLockSummary";
import { CsrSlots } from "@/components/trial-and-error/CsrSlots";
import {
  ACT_III,
  CSR_LOCK_SCENARIO,
  advanceTable,
  createTableState,
  deriveTableView,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));
vi.mock("@/components/FieldManualButton", () => ({
  FieldManualButton: () => <button type="button">Manual</button>,
}));

beforeEach(() => {
  // Reduced motion: score playback resolves at once.
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

const S = CSR_LOCK_SCENARIO;
const PACKAGE = [
  "C-T14.1.2",
  "C-T14.1.1",
  "C-T14.2.1",
  "C-T14.3.1-H",
  "C-L16.2.7",
];

const act = (state: TableState, action: TableAction) =>
  advanceTable(S, state, action);

function locked(): TableState {
  let state = act(createTableState(S), {
    type: "INSPECT_CARD",
    cardId: "C-T14.3.1-H",
  });
  deriveTableView(S, state).inspection!.cells.forEach((row, r) =>
    row.forEach((_, c) => {
      state = act(state, { type: "INSPECT_CELL", row: r, col: c });
    })
  );
  state = act(state, { type: "CLOSE_INSPECT" });
  for (const cardId of PACKAGE) {
    state = act(state, { type: "TOGGLE_SELECT", cardId });
  }
  return act(state, { type: "PLAY_HAND" });
}

describe("CSR Straight slots (#922)", () => {
  it("labels five slots in pipeline order and names the card that breaks the Straight", () => {
    let state = createTableState(S);
    for (const cardId of ["C-T14.1.2", "C-T14.2.1"]) {
      state = act(state, { type: "TOGGLE_SELECT", cardId });
    }
    const report = deriveTableView(S, state).csrLock!.report;
    render(
      <CsrSlots
        slots={report.slots}
        names={{ "C-T14.1.2": "Table 14.1.2", "C-T14.2.1": "Table 14.2.1" }}
      />
    );
    const slots = within(
      screen.getByRole("list", {
        name: "CSR Straight slots, in pipeline order",
      })
    ).getAllByRole("listitem");
    expect(slots.map((li) => li.dataset.slot)).toEqual([
      "DISPOSITION",
      "BASELINE",
      "EFFICACY",
      "SAFETY_AE",
      "PATIENT_LISTING",
    ]);
    expect(slots[0].textContent).toContain("Table 14.1.2");
    expect(slots[0].dataset.status).toBe("OK");
    expect(slots[1].dataset.status).toBe("OUT_OF_ORDER");
    expect(slots[1].getAttribute("aria-current")).toBe("step");
    expect(slots[4].textContent).toContain("Empty");
    expect(screen.getByTestId("csr-slot-break").textContent).toBe(
      "Baseline slot: Table 14.2.1 is an Efficacy output, out of order."
    );
  });
});

describe("CSR lock summary (#922)", () => {
  const state = locked();
  const view = deriveTableView(S, state).csrLock!;

  it("stamps the package LOCKED and lists the audit summary", () => {
    render(
      <CsrLockSummary
        lock={view.lock!}
        amendRefusal={null}
        seed="alpha"
        handsPlayed={state.handsPlayed}
        cpuSpent={state.cpu.spent}
        loud
        onAmend={vi.fn()}
      />
    );
    expect(screen.getByTestId("csr-locked-stamp").className).toContain(
      "te-loud-lock"
    );
    expect(screen.getByTestId("csr-final-score").className).toContain(
      "te-loud-fire"
    );
    expect(screen.getByTestId("csr-final-score").textContent).toBe(
      String(view.lock!.final.score)
    );
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(6);
    expect(rows[1].textContent).toContain("Table 14.1.2");
    expect(rows[4].textContent).toContain(S.rulebook.id);
    expect(screen.getByText(/Seed alpha/).textContent).toMatch(
      /1 hand · \d+ CPU spent/
    );
  });

  it("stays calm without loud effects, and files an amendment on request", () => {
    const onAmend = vi.fn();
    render(
      <CsrLockSummary
        lock={view.lock!}
        amendRefusal={null}
        seed="alpha"
        handsPlayed={1}
        cpuSpent={3}
        loud={false}
        onAmend={onAmend}
      />
    );
    expect(screen.getByTestId("csr-locked-stamp").className).not.toContain(
      "te-loud-lock"
    );
    fireEvent.click(
      screen.getByRole("button", { name: "File protocol amendment" })
    );
    expect(onAmend).toHaveBeenCalledOnce();
  });

  it("disables the amendment and says why when it cannot be filed", () => {
    render(
      <CsrLockSummary
        lock={view.lock!}
        amendRefusal="Re-validating the package needs 3 CPU."
        seed="alpha"
        handsPlayed={1}
        cpuSpent={3}
        loud={false}
        onAmend={vi.fn()}
      />
    );
    const button = screen.getByRole("button", {
      name: "File protocol amendment",
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("aria-describedby")).toBe("csr-amend-note");
    expect(screen.getByText("Re-validating the package needs 3 CPU.").id).toBe(
      "csr-amend-note"
    );
  });
});

describe("CSR Lock on the card table (#922)", () => {
  it("shows the boss intro's slots, then the sequence slots above the hand", () => {
    render(
      <CardTable act={{ ...ACT_III, blinds: [S], bossPool: undefined }} />
    );
    expect(
      within(screen.getByTestId("boss-intro-slots"))
        .getAllByRole("listitem")
        .map((li) => li.textContent)
    ).toEqual([
      "1. Disposition",
      "2. Baseline",
      "3. Efficacy",
      "4. Safety AE",
      "5. Listing",
    ]);
    fireEvent.click(screen.getByTestId("boss-intro-start"));
    expect(screen.getByTestId("csr-slots")).not.toBeNull();
  });
});

describe("the player's submission journey at CSR Lock (#922)", () => {
  const card = (id: string) =>
    document.querySelector<HTMLButtonElement>(`[data-card-id="${id}"]`)!;
  const select = (ids: readonly string[]) => {
    for (const id of ids) fireEvent.click(card(id));
  };
  const play = () => screen.getByRole("button", { name: /Play Hand/ });

  it("blocks a broken Straight, validates it, locks it and amends it", async () => {
    render(<CardTable scenario={S} />);
    fireEvent.click(screen.getByTestId("boss-intro-start"));

    // Out of order: the Baseline slot holds the Efficacy table.
    select(["C-T14.1.2", "C-T14.2.1", "C-T14.1.1", "C-T14.3.1-H", "C-L16.2.7"]);
    expect(screen.getByTestId("csr-slot-break").textContent).toBe(
      "Baseline slot: Table 14.2.1 is an Efficacy output, out of order."
    );
    expect(screen.getByTestId("play-blocker").textContent).toContain(
      "out of order"
    );
    select(["C-T14.1.2", "C-T14.2.1", "C-T14.1.1", "C-T14.3.1-H", "C-L16.2.7"]);

    // In order, the unvalidated overview breaks the Safety AE slot.
    select(PACKAGE);
    expect(screen.getByTestId("csr-slot-break").textContent).toBe(
      "Safety AE slot: Table 14.3.1 (Draft H) is unvalidated: inspect it."
    );

    // Validate it: inspect, and review every cell.
    flush(() => card("C-T14.3.1-H").focus());
    fireEvent.keyDown(card("C-T14.3.1-H"), { key: "i" });
    await waitFor(() => expect(screen.getByRole("grid")).not.toBeNull());
    for (const cell of screen.getAllByRole("gridcell")) fireEvent.click(cell);
    fireEvent.click(screen.getByRole("button", { name: /Close Inspect/ }));
    await waitFor(() => expect(screen.queryByRole("grid")).toBeNull());

    expect(screen.queryByTestId("csr-slot-break")).toBeNull();
    const slots = within(screen.getByTestId("csr-slots")).getAllByRole(
      "listitem"
    );
    expect(slots.map((li) => li.dataset.status)).toEqual(Array(5).fill("OK"));
    fireEvent.click(play());

    const summary = await screen.findByTestId("csr-lock-summary");
    expect(within(summary).getByTestId("csr-locked-stamp").textContent).toBe(
      "LOCKED"
    );
    expect(screen.getByTestId("blind-result").textContent).toContain(
      "CSR locked"
    );

    fireEvent.click(
      within(summary).getByRole("button", { name: "File protocol amendment" })
    );
    await waitFor(() =>
      expect(screen.queryByTestId("csr-lock-summary")).toBeNull()
    );
    select(PACKAGE);
    expect(screen.getByTestId("csr-slot-break").textContent).toBe(
      "Safety AE slot: Table 14.3.1 (Draft H) is unvalidated: inspect it."
    );
  });
});
