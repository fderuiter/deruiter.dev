import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ProtocolDriftGame } from "@/components/protocol-drift/ProtocolDriftGame";
import { readEfficiencyBests } from "@/components/protocol-drift/efficiency-bests";
import { useProtocolDriftStore } from "@/components/protocol-drift/store";
import { getArcadeProgress } from "@/lib/arcade-achievements";
import {
  EFFICIENCY_BESTS_STORAGE_KEY,
  type ProtocolDriftEngine,
  type ProtocolDriftSaveFile,
} from "@/lib/protocol-drift";
import { safeClear } from "@/lib/safe-storage";
import { ok, playFullLevel, startEngine } from "./helpers";
import { installFlowMocks } from "./ui-helpers";

vi.mock("@/lib/download", () => ({ downloadFile: vi.fn() }));
vi.mock("@/lib/audio", () => ({
  getSoundEngine: () => ({ isSoundAllowed: () => false, playTone: vi.fn() }),
}));

function readySave(): ProtocolDriftSaveFile {
  const engine: ProtocolDriftEngine = startEngine();
  playFullLevel(engine);
  const event = ok(engine, {
    type: "EXPORT_SAVE",
    savedAt: "2026-01-01T00:00:00Z",
  }).find((e) => e.type === "SAVE_EXPORTED");
  if (!event || event.type !== "SAVE_EXPORTED") throw new Error("no save");
  return event.save;
}

async function lockFrom(save: ProtocolDriftSaveFile): Promise<HTMLElement> {
  render(<ProtocolDriftGame />);
  await screen.findByRole("dialog", { name: /Trial Briefing/ });
  await act(async () => {
    await useProtocolDriftStore.getState().restoreSave(save);
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Request Database Lock" })
    );
  });
  const gate = await screen.findByRole("dialog", {
    name: /Dual Database Lock Audit Gate/,
  });
  await act(async () => {
    fireEvent.click(
      within(gate).getByRole("button", { name: "Confirm Database Lock" })
    );
  });
  return screen.findByRole("dialog", { name: "Regulatory Audit Debrief" });
}

function rowCells(table: HTMLElement, label: string): string[] {
  const header = within(table).getByRole("rowheader", { name: label });
  const row = header.closest("tr") as HTMLTableRowElement;
  return Array.from(row.cells).map((c) => c.textContent ?? "");
}

describe("efficiency debrief (#2054)", () => {
  beforeAll(() => installFlowMocks());
  beforeEach(() => {
    window.localStorage.clear();
    safeClear();
  });
  afterEach(() => cleanup());

  it("shows par, actual and best per measure and keeps bests across reloads", async () => {
    const save = readySave();
    const debrief = await lockFrom(save);
    const table = within(debrief).getByRole("table", {
      name: /Efficiency against par: 5 of 5 medals, 500 points/,
    });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent)
    ).toEqual(["Measure", "Par", "Actual", "Best", "Medal"]);
    expect(rowCells(table, "Chips in pipeline")).toEqual([
      "Chips in pipeline",
      "13",
      "13",
      "13new",
      "MEDAL",
    ]);
    expect(rowCells(table, "Lock day")).toEqual([
      "Lock day",
      "Day 28",
      "Day 28",
      "Day 28new",
      "MEDAL",
    ]);
    expect(rowCells(table, "Fabricated bits introduced")[2]).toBe("0.00");
    expect(within(debrief).getByText(/Arcade score/).textContent).toMatch(
      /Arcade score \d+/
    );

    const stored = window.localStorage.getItem(EFFICIENCY_BESTS_STORAGE_KEY);
    expect(JSON.parse(stored ?? "{}")).toEqual({
      chips: 13,
      wires: 21,
      lockDay: 28,
      rejectedCommands: 0,
      fabricatedBits: 0,
    });
    const unlocked = getArcadeProgress().unlockedTrophies;
    expect(unlocked.protocol_drift_lean_lock).toBeDefined();
    expect(unlocked.protocol_drift_defensible).toBeDefined();

    // A reload: a fresh game reads the stored bests, and the same run sets no
    // new best.
    cleanup();
    useProtocolDriftStore.getState().dispose();
    const again = await lockFrom(save);
    const table2 = within(again).getByRole("table", { name: /Efficiency/ });
    expect(rowCells(table2, "Chips in pipeline")[3]).toBe("13");
    expect(rowCells(table2, "Wires in pipeline")[3]).toBe("21");
    expect(readEfficiencyBests().chips).toBe(13);
  });

  it("reads malformed stored bests as none", () => {
    window.localStorage.setItem(EFFICIENCY_BESTS_STORAGE_KEY, "{broken");
    expect(readEfficiencyBests()).toEqual({});
  });
});
