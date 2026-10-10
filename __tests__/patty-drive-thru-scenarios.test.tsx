import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SHIFT_CONFIG,
  SCENARIO_LIMITS,
  SCENARIO_PRESETS,
  buildShiftTelemetry,
  createShift,
  exportShiftTelemetryCsv,
  exportShiftTelemetryJson,
  isShiftOver,
  isStandardScenario,
  scenarioDialsFor,
  stepShift,
  type ShiftLogEntry,
  type ShiftState,
} from "@/lib/patty-drive-thru";
import { createBoothStore } from "@/components/patty-drive-thru/store";

const frame = vi.hoisted(() => ({
  callback: null as null | ((deltaMs: number) => void),
  active: false,
}));
const scores = vi.hoisted(() => ({ record: vi.fn() }));
const downloads = vi.hoisted(() => ({ file: vi.fn() }));

vi.mock("@/hooks/useAnimationFrame", () => ({
  useAnimationFrame: (
    callback: (deltaMs: number) => void,
    options: { isActive?: boolean } = {}
  ) => {
    frame.callback = callback;
    frame.active = options.isActive ?? true;
  },
}));
vi.mock("@/lib/audio/sound-engine", () => ({
  getSoundEngine: () => ({
    playSequence: vi.fn(),
    playNoise: vi.fn(),
    stopAll: vi.fn(),
  }),
}));
vi.mock("@/lib/arcade-achievements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/arcade-achievements")>()),
  recordArcadeScore: scores.record,
}));
vi.mock("@/lib/download", () => ({ downloadFile: downloads.file }));
vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="pdt-booth-canvas" />,
}));

import { PattyDriveThruGame } from "@/components/patty-drive-thru/PattyDriveThruGame";

function run(shift: ShiftState, seconds: number): ShiftState {
  let state = shift;
  const steps = Math.round(seconds / 0.25);
  for (let i = 0; i < steps && !isShiftOver(state); i++)
    state = stepShift(state, 0.25).state;
  return state;
}

const arrivals = (shift: ShiftState) => shift.nextOrderId - 1;

describe("Patty's Drive-Thru scenarios (#1887)", () => {
  it("leaves the standard shift's config exactly as it was", () => {
    expect(createShift({}).config).toEqual(DEFAULT_SHIFT_CONFIG);
    expect(createShift(scenarioDialsFor("standard")).config).toEqual(
      DEFAULT_SHIFT_CONFIG
    );
  });

  it("clamps every dial to its range and ignores ones that are not numbers", () => {
    const wild = createShift({
      arrivalGapMinSec: -4,
      arrivalGapMaxSec: Number.NaN,
      firstArrivalSec: 1e9,
      sosLossExpired: 1e9,
      sosLossLate: -1,
      sosGainOnTime: Number.POSITIVE_INFINITY,
      sosGainFast: 3,
      idleGraceSec: "soon" as unknown as number,
      idleRatePerSec: 1e9,
      dispenserFailChance: 7,
    }).config;
    expect(wild.arrivalGapMinSec).toBe(SCENARIO_LIMITS.arrivalGapMinSec[0]);
    expect(wild.arrivalGapMaxSec).toBeUndefined();
    expect(wild.firstArrivalSec).toBe(SCENARIO_LIMITS.firstArrivalSec[1]);
    expect(wild.sosLossExpired).toBe(SCENARIO_LIMITS.sosLossExpired[1]);
    expect(wild.sosLossLate).toBe(0);
    expect(wild.sosGainOnTime).toBeUndefined();
    expect(wild.sosGainFast).toBe(3);
    expect(wild.idleGraceSec).toBeUndefined();
    expect(wild.idleRatePerSec).toBe(SCENARIO_LIMITS.idleRatePerSec[1]);
    expect(wild.dispenserFailChance).toBe(1);
  });

  it("never lets the longest arrival gap end before the shortest", () => {
    const config = createShift({
      arrivalGapMinSec: 20,
      arrivalGapMaxSec: 5,
    }).config;
    expect(config.arrivalGapMaxSec).toBe(20);
    const high = createShift({ arrivalGapMinSec: 25 }).config;
    expect(high.arrivalGapMaxSec).toBe(25);
  });

  it("only the standard scenario counts toward the score", () => {
    expect(isStandardScenario(createShift({ seed: "x" }).config)).toBe(true);
    expect(
      isStandardScenario(createShift({ seed: "x", durationSec: 30 }).config)
    ).toBe(true);
    for (const preset of SCENARIO_PRESETS.filter((p) => p.id !== "standard"))
      expect(isStandardScenario(createShift(preset.dials).config)).toBe(false);
  });

  it("no preset fixes a seed", () => {
    for (const preset of SCENARIO_PRESETS)
      expect("seed" in preset.dials).toBe(false);
  });

  it("the lunch rush brings more cars than the standard shift", () => {
    const standard = run(createShift({ seed: "rush-1" }), 25);
    const rush = run(
      createShift({ seed: "rush-1", ...scenarioDialsFor("lunchRush") }),
      25
    );
    expect(arrivals(rush)).toBeGreaterThan(arrivals(standard) + 1);
  });

  it("strict management yells sooner at a player who stands still", () => {
    const standard = run(createShift({ seed: "idle-1" }), 20);
    const strict = run(
      createShift({ seed: "idle-1", ...scenarioDialsFor("strictManagement") }),
      20
    );
    expect(strict.tallies.yells).toBeGreaterThan(standard.tallies.yells);
  });

  it("the failing dispenser takes the same shift but makes cars harder", () => {
    expect(scenarioDialsFor("failingDispenser").dispenserFailChance).toBe(0.85);
    expect(
      createShift({ ...scenarioDialsFor("failingDispenser") }).config
        .dispenserFailChance
    ).toBe(0.85);
  });
});

describe("Patty's Drive-Thru telemetry (#1887)", () => {
  const log: ShiftLogEntry[] = [
    { time: 2, event: { type: "order-arrived", orderId: 1 } },
    { time: 9.1234, event: { type: "item-rung", orderId: 1, itemId: "fries" } },
    { time: 12, event: { type: "bumped", orderId: 1, band: "green" } },
    { time: 15, event: { type: "wrong-entry", nodeId: 'odd,"id"' } },
    { time: 20, event: { type: "manager-yell" } },
  ];
  const shift = run(
    createShift({ seed: "tele-1", ...scenarioDialsFor("lunchRush") }),
    30
  );

  it("exports the setup, the result and the logged events as JSON", () => {
    const parsed = JSON.parse(exportShiftTelemetryJson(shift, log));
    expect(parsed).toMatchObject({
      version: 1,
      seed: "tele-1",
      countsTowardScore: false,
      scenario: { arrivalGapMinSec: 3, arrivalGapMaxSec: 8 },
    });
    expect(parsed.events).toHaveLength(5);
    expect(
      buildShiftTelemetry(createShift({ seed: "s" }), []).countsTowardScore
    ).toBe(true);
  });

  it("writes one CSV row per event and escapes cells", () => {
    const lines = exportShiftTelemetryCsv(log).split("\n");
    expect(lines[0]).toBe("time,event,orderId,itemId,band,outcome,nodeId");
    expect(lines).toHaveLength(6);
    expect(lines[1]).toBe("2,order-arrived,1,,,,");
    expect(lines[2]).toBe("9.12,item-rung,1,fries,,,");
    expect(lines[3]).toBe("12,bumped,1,,green,,");
    expect(lines[4]).toBe('15,wrong-entry,,,,,"odd,""id"""');
    expect(lines[5]).toBe("20,manager-yell,,,,,");
  });
});

describe("Patty's Drive-Thru booth log (#1887)", () => {
  it("logs events with their time, starts empty each shift and keeps the scenario replaceable", () => {
    const store = createBoothStore({ seed: "log-1", durationSec: 60 });
    store
      .getState()
      .clockIn({ seed: "log-1", ...scenarioDialsFor("lunchRush") });
    for (let i = 0; i < 100; i++) store.getState().tick(0.25);
    const log = store.getState().log;
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].event.type).toBe("order-arrived");
    expect(store.getState().shift.config.arrivalGapMaxSec).toBe(8);

    store
      .getState()
      .clockIn({ seed: "log-2", ...scenarioDialsFor("standard") });
    expect(store.getState().log).toEqual([]);
    expect(store.getState().shift.config.arrivalGapMaxSec).toBeUndefined();
    expect(store.getState().shift.config.durationSec).toBe(60);
  });

  it("caps the log", () => {
    const store = createBoothStore({ seed: "cap-1", durationSec: 3600 });
    store.getState().clockIn({
      ...scenarioDialsFor("lunchRush"),
      arrivalGapMinSec: 1,
      arrivalGapMaxSec: 1,
    });
    for (let i = 0; i < 40_000 && store.getState().phase === "shift"; i++)
      store.getState().tick(0.25);
    expect(store.getState().log.length).toBeLessThanOrEqual(2000);
  });
});

describe("Patty's Drive-Thru scenario picker (#1887)", () => {
  beforeEach(() => {
    frame.callback = null;
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/arcade/patty-drive-thru");
  });
  afterEach(cleanup);

  const advance = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 10); i++)
      act(() => {
        if (frame.active) frame.callback?.(100);
      });
  };

  it("offers each scenario and starts with the standard shift selected", () => {
    render(
      <PattyDriveThruGame
        config={{ seed: "pick-1", durationSec: 10 }}
        initialView="flat"
      />
    );
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(SCENARIO_PRESETS.length);
    expect(
      (
        screen.getByRole("radio", {
          name: /Standard shift/,
        }) as HTMLInputElement
      ).checked
    ).toBe(true);
  });

  it("plays a practice shift without recording a score, offers the exports and repeats the scenario", () => {
    render(
      <PattyDriveThruGame
        config={{ seed: "pick-2", durationSec: 10 }}
        initialView="flat"
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: /Lunch rush/ }));
    fireEvent.click(screen.getByRole("button", { name: "Clock in" }));
    advance(11);
    expect(screen.getByTestId("pdt-end").textContent).toMatch(
      /Practice shift, so the score is not recorded/
    );
    expect(scores.record).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("pdt-export-json"));
    fireEvent.click(screen.getByTestId("pdt-export-csv"));
    expect(downloads.file).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(downloads.file.mock.calls[0][0]).scenario.arrivalGapMaxSec
    ).toBe(8);

    fireEvent.click(screen.getByRole("button", { name: "Work another shift" }));
    advance(11);
    expect(screen.getByTestId("pdt-end").textContent).toMatch(/Practice shift/);
    expect(scores.record).not.toHaveBeenCalled();
  });

  it("records the score for the standard shift", () => {
    render(
      <PattyDriveThruGame
        config={{ seed: "pick-3", durationSec: 10 }}
        initialView="flat"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Clock in" }));
    advance(11);
    expect(screen.getByTestId("pdt-end").textContent).not.toMatch(
      /Practice shift/
    );
    expect(scores.record).toHaveBeenCalledTimes(1);
  });
});
