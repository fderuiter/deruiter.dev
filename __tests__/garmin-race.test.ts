// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  ALL_MEDALS,
  BOARD_SIZE,
  COURSE_VERSION,
  FIXED_STEP_MS,
  MAX_STEPS_PER_FRAME,
  SATURDAY_SEED,
  boardKey,
  dailySeed,
  fixedSteps,
  formatRaceTime,
  insertResult,
  isNegativeSplit,
  judgeRace,
  liveEntries,
  localDay,
  raceSetup,
  shareText,
  type BoardEntry,
  type RaceOutcome,
} from "@/lib/garmin/race";

// The pure race rules (#2019): seeds, the fixed step, judging, the
// leaderboard and the share text. No engine, no storage.

const MORNING = new Date(2026, 9, 14, 8, 15);
const EVENING = new Date(2026, 9, 14, 23, 59, 59);
const NEXT_MIDNIGHT = new Date(2026, 9, 15, 0, 0, 0);

const SPLITS_DOWN = [60000, 55000, 50000, 45000, 42330];

/** A finished, clean run: every rule is met unless a test breaks it. */
function cleanOutcome(overrides: Partial<RaceOutcome> = {}): RaceOutcome {
  return {
    finished: true,
    timeMs: 252330,
    lapSplits: SPLITS_DOWN,
    kudosMissed: 0,
    gearTaken: false,
    medalsFound: ALL_MEDALS,
    ...overrides,
  };
}

/** A board entry on the current course version. */
function entry(timeMs: number, seed = SATURDAY_SEED): BoardEntry {
  return {
    timeMs,
    at: "2026-10-14T08:00:00.000Z",
    seed,
    version: COURSE_VERSION,
  };
}

describe("dailySeed", () => {
  it("is stable within a local day", () => {
    expect(dailySeed(MORNING)).toBe(dailySeed(EVENING));
  });

  it("changes across local midnight", () => {
    expect(dailySeed(EVENING)).not.toBe(dailySeed(NEXT_MIDNIGHT));
  });

  it("is never the Saturday seed", () => {
    for (let day = 0; day < 366 * 3; day++) {
      const date = new Date(2026, 0, 1 + day, 12);
      expect(dailySeed(date)).not.toBe(SATURDAY_SEED);
    }
  });

  it("names the local calendar day", () => {
    expect(localDay(MORNING)).toBe("2026-10-14");
    expect(localDay(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("raceSetup", () => {
  it("gives the Saturday 5K its fixed seed on any date", () => {
    expect(raceSetup("saturday5k", "any", MORNING)).toEqual({
      course: "saturday5k",
      category: "any",
      seed: SATURDAY_SEED,
    });
    expect(raceSetup("saturday5k", "allkudos", NEXT_MIDNIGHT).seed).toBe(
      SATURDAY_SEED
    );
  });

  it("gives the Daily Workout today's seed", () => {
    const setup = raceSetup("daily", "negsplit", MORNING);
    expect(setup).toEqual({
      course: "daily",
      category: "negsplit",
      seed: dailySeed(MORNING),
    });
    expect(raceSetup("daily", "any", NEXT_MIDNIGHT).seed).not.toBe(setup.seed);
  });
});

describe("fixedSteps", () => {
  it("gives 60 steps for one second of 60 Hz frames", () => {
    let carry = 0;
    let steps = 0;
    for (let frame = 0; frame < 60; frame++) {
      const next = fixedSteps(carry, 1000 / 60);
      steps += next.steps;
      carry = next.carryMs;
    }
    expect(steps).toBe(60);
  });

  it("gives 60 steps for one second of 30 Hz frames", () => {
    let carry = 0;
    let steps = 0;
    for (let frame = 0; frame < 30; frame++) {
      const next = fixedSteps(carry, 1000 / 30);
      steps += next.steps;
      carry = next.carryMs;
    }
    expect(steps).toBe(60);
  });

  it("gives 60 steps for one second of 144 Hz frames", () => {
    let carry = 0;
    let steps = 0;
    for (let frame = 0; frame < 144; frame++) {
      const next = fixedSteps(carry, 1000 / 144);
      steps += next.steps;
      carry = next.carryMs;
    }
    expect(steps).toBe(60);
  });

  it("carries the time a frame leaves over", () => {
    const first = fixedSteps(0, 10);
    expect(first.steps).toBe(0);
    expect(first.carryMs).toBe(10);
    const second = fixedSteps(first.carryMs, 10);
    expect(second.steps).toBe(1);
    expect(second.carryMs).toBeCloseTo(20 - FIXED_STEP_MS, 9);
  });

  it("caps a stalled frame and drops the excess instead of carrying it", () => {
    expect(fixedSteps(0, 1000)).toEqual({
      steps: MAX_STEPS_PER_FRAME,
      carryMs: 0,
    });
  });

  it("treats NaN, infinite and negative input as no time", () => {
    expect(fixedSteps(0, Number.NaN)).toEqual({ steps: 0, carryMs: 0 });
    expect(fixedSteps(Number.NaN, Number.NaN)).toEqual({
      steps: 0,
      carryMs: 0,
    });
    expect(fixedSteps(0, Number.POSITIVE_INFINITY)).toEqual({
      steps: 0,
      carryMs: 0,
    });
    expect(fixedSteps(-5, -10)).toEqual({ steps: 0, carryMs: 0 });
  });
});

describe("judgeRace", () => {
  it("passes a clean run in every category", () => {
    for (const category of [
      "any",
      "allkudos",
      "nogear",
      "negsplit",
      "allmedals",
    ] as const) {
      expect(judgeRace(category, cleanOutcome())).toEqual({
        result: "time",
        reason: "",
      });
    }
  });

  it("is a DNF for every category when the 5K is not finished", () => {
    for (const category of [
      "any",
      "allkudos",
      "nogear",
      "negsplit",
      "allmedals",
    ] as const) {
      expect(judgeRace(category, cleanOutcome({ finished: false }))).toEqual({
        result: "dnf",
        reason: "did not finish",
      });
    }
  });

  it("disqualifies All Kudos on any Kudos missed", () => {
    expect(judgeRace("allkudos", cleanOutcome({ kudosMissed: 2 }))).toEqual({
      result: "dnq",
      reason: "2 Kudos missed",
    });
    expect(judgeRace("any", cleanOutcome({ kudosMissed: 2 })).result).toBe(
      "time"
    );
  });

  it("disqualifies No Gear when gear was taken", () => {
    expect(judgeRace("nogear", cleanOutcome({ gearTaken: true }))).toEqual({
      result: "dnq",
      reason: "gear taken",
    });
    expect(judgeRace("nogear", cleanOutcome()).result).toBe("time");
  });

  it("disqualifies Negative Split on a lap that is not faster", () => {
    expect(
      judgeRace("negsplit", cleanOutcome({ lapSplits: [60000, 61000] }))
    ).toEqual({ result: "dnq", reason: "a lap was slower" });
    expect(
      judgeRace("negsplit", cleanOutcome({ lapSplits: [60000, 60000] })).result
    ).toBe("dnq");
    expect(judgeRace("negsplit", cleanOutcome()).result).toBe("time");
  });

  it("disqualifies All Medals short of every medal", () => {
    expect(
      judgeRace("allmedals", cleanOutcome({ medalsFound: ALL_MEDALS - 1 }))
    ).toEqual({
      result: "dnq",
      reason: `${ALL_MEDALS - 1} of ${ALL_MEDALS} medals`,
    });
    expect(
      judgeRace("allmedals", cleanOutcome({ medalsFound: ALL_MEDALS })).result
    ).toBe("time");
  });
});

describe("isNegativeSplit", () => {
  it("needs at least two laps that each beat the one before", () => {
    expect(isNegativeSplit([])).toBe(false);
    expect(isNegativeSplit([5])).toBe(false);
    expect(isNegativeSplit([3, 2, 1])).toBe(true);
    expect(isNegativeSplit([3, 3])).toBe(false);
    expect(isNegativeSplit([3, 2, 2])).toBe(false);
  });
});

describe("insertResult and the board", () => {
  it("keeps the board fastest first", () => {
    const first = insertResult([], entry(300));
    const second = insertResult(first.board, entry(100));
    const third = insertResult(second.board, entry(200));
    expect(third.board.map((e) => e.timeMs)).toEqual([100, 200, 300]);
    expect(third.place).toBe(2);
  });

  it("reports place 1 for a new course record", () => {
    const { board, place } = insertResult([entry(200)], entry(100));
    expect(place).toBe(1);
    expect(board[0].timeMs).toBe(100);
  });

  it("caps the board at the top five", () => {
    const full = [100, 200, 300, 400, 500].map((t) => entry(t));
    const better = insertResult(full, entry(50));
    expect(better.board).toHaveLength(BOARD_SIZE);
    expect(better.place).toBe(1);
    expect(better.board.map((e) => e.timeMs)).toEqual([50, 100, 200, 300, 400]);
  });

  it("returns place 0 for a time off the board", () => {
    const full = [100, 200, 300, 400, 500].map((t) => entry(t));
    const worse = insertResult(full, entry(999));
    expect(worse.place).toBe(0);
    expect(worse.board.map((e) => e.timeMs)).toEqual([100, 200, 300, 400, 500]);
  });

  it("drops results from an older course version", () => {
    const old: BoardEntry = { ...entry(50), version: COURSE_VERSION - 1 };
    const { board, place } = insertResult([old], entry(300));
    expect(board.map((e) => e.timeMs)).toEqual([300]);
    expect(place).toBe(1);
  });

  it("drops results from another seed, such as an earlier Daily", () => {
    const yesterday = entry(50, dailySeed(MORNING));
    const { board, place } = insertResult([yesterday], entry(300));
    expect(board.map((e) => e.timeMs)).toEqual([300]);
    expect(place).toBe(1);
    expect(
      liveEntries([yesterday, entry(10)], SATURDAY_SEED).map((e) => e.timeMs)
    ).toEqual([10]);
  });

  it("names a board per course and category", () => {
    expect(boardKey("saturday5k", "any")).toBe("saturday5k:any");
    expect(boardKey("daily", "allkudos")).toBe("daily:allkudos");
  });
});

describe("formatRaceTime", () => {
  it("writes m:ss.cc", () => {
    expect(formatRaceTime(252330)).toBe("4:12.33");
    expect(formatRaceTime(0)).toBe("0:00.00");
    expect(formatRaceTime(59990)).toBe("0:59.99");
    expect(formatRaceTime(3600000)).toBe("60:00.00");
  });

  it("reads bad input as zero", () => {
    expect(formatRaceTime(Number.NaN)).toBe("0:00.00");
    expect(formatRaceTime(-5)).toBe("0:00.00");
  });
});

describe("shareText", () => {
  it("writes the result on one line", () => {
    const setup = raceSetup("saturday5k", "any", MORNING);
    const outcome = cleanOutcome();
    const verdict = judgeRace("any", outcome);
    expect(shareText(setup, verdict, outcome, MORNING)).toBe(
      "Monkey C Mayhem · Saturday 5K · Any% · 4:12.33 · negative split"
    );
  });

  it("names the Daily date", () => {
    const setup = raceSetup("daily", "allkudos", MORNING);
    const outcome = cleanOutcome({ lapSplits: [] });
    const verdict = judgeRace("allkudos", outcome);
    expect(shareText(setup, verdict, outcome, MORNING)).toBe(
      "Monkey C Mayhem · Daily Workout 2026-10-14 · All Kudos · 4:12.33"
    );
  });

  it("shares a DNQ with its reason", () => {
    const setup = raceSetup("saturday5k", "allkudos", MORNING);
    const outcome = cleanOutcome({ kudosMissed: 2 });
    const verdict = judgeRace("allkudos", outcome);
    expect(shareText(setup, verdict, outcome, MORNING)).toBe(
      "Monkey C Mayhem · Saturday 5K · All Kudos · DNQ (2 Kudos missed)"
    );
  });
});
