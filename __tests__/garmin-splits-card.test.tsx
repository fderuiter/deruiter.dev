import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup, within } from "@testing-library/react";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";
import { safeRemoveItem } from "@/lib/safe-storage";
import {
  SPLITS_STORAGE_KEY,
  loadBests,
  saveBests,
} from "@/lib/garmin/bests-store";
import {
  createInitialState,
  startGame,
  setRules,
  type GameEngineState,
} from "@/lib/garmin/engine";

const mockAnnounce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: mockAnnounce }),
}));
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
}));
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

const SPLITS = [70000, 68000, 66000, 65000, 64000];

const runState = (over: Partial<GameEngineState> = {}): GameEngineState => ({
  ...startGame(setRules(createInitialState("fenix", 0), "fitness"), "fenix"),
  ...over,
});

const finishedRun = (over: Partial<GameEngineState> = {}): GameEngineState =>
  runState({
    gameState: "summary",
    lapSplits: SPLITS,
    runClockMs: 333000,
    distanceMeters: 5000,
    ...over,
  });

const splitRows = (): HTMLTableRowElement[] => {
  const table = screen.getByRole("table", { name: "Splits per km" });
  return Array.from(table.querySelectorAll("tbody tr"));
};

describe("Garmin run clock and splits card (#2018)", () => {
  beforeEach(() => {
    mockAnnounce.mockClear();
    safeRemoveItem(SPLITS_STORAGE_KEY);
    safeRemoveItem("garmin_dev_mode");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("shows the finish time, five split rows and the negative split note", () => {
    render(<GarminWatchSimulator initialState={finishedRun()} />);
    expect(screen.getByText("Finish time")).toBeTruthy();
    expect(screen.getByText("5:33.00")).toBeTruthy();
    expect(splitRows()).toHaveLength(5);
    expect(screen.getByText(/Negative split: every km faster/)).toBeTruthy();
  });

  it("shows the delta against a saved previous best for each lap", () => {
    saveBests("fenix", {
      totalMs: 340000,
      splits: [71000, 68500, 65000, 65000, 64500],
    });
    render(<GarminWatchSimulator initialState={finishedRun()} />);
    const rows = splitRows().map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent)
    );
    expect(rows).toEqual([
      ["1:10.00", "-0:01.00"],
      ["1:08.00", "-0:00.50"],
      ["1:06.00", "+0:01.00"],
      ["1:05.00", "+0:00.00"],
      ["1:04.00", "-0:00.50"],
    ]);
    expect(screen.getByText("New best time")).toBeTruthy();
  });

  it("saves the new totals and splits once when a finished run ends", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(<GarminWatchSimulator initialState={finishedRun()} />);
    const savesToKey = setItem.mock.calls.filter(
      ([key]) => key === SPLITS_STORAGE_KEY
    );
    expect(savesToKey).toHaveLength(1);
    const bests = loadBests("fenix");
    expect(bests.totalMs).toBe(333000);
    expect(bests.splits).toEqual(SPLITS);
  });

  it("keeps the previous total and sets no total for a crashed run", () => {
    const crashed = runState({
      gameState: "crashed",
      lapSplits: [70000, 68000],
      runClockMs: 150000,
      crashReport: {
        errorType: "Null Pointer",
        file: "run.mc",
        line: 1,
        stackTrace: [],
        heapUsedKb: 0,
        heapLimitKb: 32,
      },
    });
    render(<GarminWatchSimulator initialState={crashed} />);
    expect(screen.getByText("Time")).toBeTruthy();
    expect(screen.queryByText("New best time")).toBeNull();
    const bests = loadBests("fenix");
    expect(bests.totalMs).toBeUndefined();
    expect(bests.splits).toEqual([70000, 68000]);
  });
});
