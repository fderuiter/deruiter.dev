import { fromPartial } from "@total-typescript/shoehorn";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GROUND_Y,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_X,
  createInitialState,
  setRules,
  startGame,
  updateGameSimulation,
  type GameEngineState,
} from "@/lib/garmin-engine";
import { EMPTY_COURSE, PX_PER_METER, stagePoleX } from "@/lib/garmin-course";
import {
  BADGES,
  BADGE_IDS,
  BADGE_MILESTONES,
  HISTORY_SIZE,
  SUB5_MS,
  badgeNews,
  badgeToast,
  badgesMet,
  dayLabel,
  daysBetween,
  isDay,
  newBadgeRun,
  newBadgeSave,
  recordRun,
  runFactsOf,
  runResult,
  stepBadgeRun,
  streakAfter,
  type BadgeSave,
  type RunFacts,
} from "@/lib/garmin-badges";
import {
  BADGE_STORAGE_KEY,
  loadBadges,
  normalizeBadges,
  saveBadges,
} from "@/lib/garmin-badge-store";
import type { PlanRun } from "@/lib/garmin-plan";
import { ARCADE_TROPHIES } from "@/lib/arcade-achievements";
import { REPMAX_SCORE, makeFoe } from "@/lib/garmin-foes";
import { safeClear, safeSetRawItem } from "@/lib/safe-storage";

// Badges and run history (#2021): each badge rule, the history cap, streaks
// across midnight and month ends, corrupt saves, and the in-run tracking.

const FRAME = 1000 / 60;
let clock = 0;

beforeEach(() => {
  clock = 9_600_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
  safeClear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** A finished Training Run 5K with nothing special about it. */
function facts(overrides: Partial<RunFacts> = {}): RunFacts {
  return {
    mode: "training",
    finished: true,
    timeMs: 320_000,
    meters: 5000,
    kudos: 10,
    te: 3.2,
    lapSplits: [60_000, 62_000, 64_000, 66_000, 68_000],
    raceTimed: false,
    kudosMissed: 4,
    gearTaken: true,
    repMax: false,
    legDay: false,
    ...overrides,
  };
}

/** A local date on `day` at `hh:mm`. */
const at = (day: string, hh = 12, mm = 0) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, hh, mm);
};

const DAY = "2026-10-15";

describe("badge rules (#2021)", () => {
  const met = (f: Partial<RunFacts>, save: BadgeSave = newBadgeSave()) =>
    badgesMet(facts(f), save, DAY);

  it("earns First 5K for a finished 5K, not a DNF or a workout", () => {
    expect(met({})).toContain("first5k");
    expect(met({ finished: false })).not.toContain("first5k");
    expect(met({ mode: "plan" })).not.toContain("first5k");
  });

  it("earns Sub-5 Minute Race only for a counted race under 5:00", () => {
    const race = { mode: "race" as const, raceTimed: true };
    expect(met({ ...race, timeMs: SUB5_MS - 1 })).toContain("sub5");
    expect(met({ ...race, timeMs: SUB5_MS })).not.toContain("sub5");
    expect(met({ ...race, raceTimed: false, timeMs: 200_000 })).not.toContain(
      "sub5"
    );
    expect(met({ timeMs: 200_000 })).not.toContain("sub5");
  });

  it("earns Negative Splitter when every lap of the 5K beats the last", () => {
    const fast = [70_000, 68_000, 66_000, 64_000, 62_000];
    expect(met({ lapSplits: fast })).toContain("negsplit");
    expect(
      met({ lapSplits: [70_000, 68_000, 69_000, 64_000, 62_000] })
    ).not.toContain("negsplit");
    // Two laps of a crashed run never count.
    expect(met({ finished: false, lapSplits: fast.slice(0, 2) })).not.toContain(
      "negsplit"
    );
    expect(met({ lapSplits: fast.slice(0, 3) })).not.toContain("negsplit");
  });

  it("earns Rep Max Slayer and Never Skip Leg Day from the run, finished or not", () => {
    expect(met({ repMax: true, finished: false })).toContain("repmax");
    expect(met({ legDay: true, mode: "plan" })).toContain("legday");
    expect(met({})).not.toContain("repmax");
    expect(met({})).not.toContain("legday");
  });

  it("earns All Kudos and No Gear Finisher only in a finished race", () => {
    const race = { mode: "race" as const, kudosMissed: 0, gearTaken: false };
    expect(met(race)).toEqual(expect.arrayContaining(["allkudos", "nogear"]));
    expect(met({ ...race, kudosMissed: 1 })).not.toContain("allkudos");
    expect(met({ ...race, gearTaken: true })).not.toContain("nogear");
    expect(met({ ...race, finished: false })).not.toContain("nogear");
    expect(met({ kudosMissed: 0, gearTaken: false })).not.toContain("nogear");
  });

  it("earns the streaks on the third and seventh day in a row", () => {
    const save = (days: number): BadgeSave => ({
      ...newBadgeSave(),
      streak: { lastDay: "2026-10-14", days },
    });
    expect(met({}, save(1))).not.toContain("streak3");
    expect(met({}, save(2))).toContain("streak3");
    expect(met({}, save(5))).not.toContain("streak7");
    expect(met({}, save(6))).toEqual(
      expect.arrayContaining(["streak3", "streak7"])
    );
    // A DNF never extends a streak.
    expect(met({ finished: false }, save(6))).not.toContain("streak3");
  });

  it("earns Couch to 5K for a 5K finished on the day of a DNF", () => {
    const dnfToday = { ...newBadgeSave(), lastDnfDay: DAY };
    const dnfYesterday = { ...newBadgeSave(), lastDnfDay: "2026-10-14" };
    expect(met({}, dnfToday)).toContain("couch");
    expect(met({}, dnfYesterday)).not.toContain("couch");
    expect(met({ mode: "plan" }, dnfToday)).not.toContain("couch");
  });

  it("names and explains every badge, and maps First 5K to its trophy", () => {
    for (const id of BADGE_IDS) {
      expect(BADGES[id].name.length).toBeGreaterThan(0);
      expect(BADGES[id].rule).toMatch(/\.$/);
    }
    for (const milestone of Object.values(BADGE_MILESTONES)) {
      expect(
        ARCADE_TROPHIES.some(
          (t) => t.gameId === "garmin-watch" && t.milestone === milestone
        )
      ).toBe(true);
    }
    expect(BADGE_MILESTONES.first5k).toBe("run_complete");
  });
});

describe("recording runs (#2021)", () => {
  it("earns each badge once and dates it", () => {
    const first = recordRun(newBadgeSave(), facts(), at(DAY));
    expect(first.earned).toEqual(["first5k"]);
    expect(first.save.badges.first5k).toBe(DAY);
    const again = recordRun(first.save, facts(), at("2026-10-16"));
    expect(again.earned).toEqual([]);
    expect(again.save.badges.first5k).toBe(DAY);
  });

  it("keeps the last 20 runs, newest first", () => {
    let save = newBadgeSave();
    for (let i = 0; i < HISTORY_SIZE + 5; i++) {
      save = recordRun(save, facts({ kudos: i }), at(DAY)).save;
    }
    expect(save.runs).toHaveLength(HISTORY_SIZE);
    expect(save.runs[0].kudos).toBe(HISTORY_SIZE + 4);
    expect(save.runs.at(-1)?.kudos).toBe(5);
  });

  it("records each run's day, mode, result, distance, Training Effect and Kudos", () => {
    const { save } = recordRun(
      newBadgeSave(),
      facts({
        mode: "race",
        finished: false,
        timeMs: 90_000,
        meters: 1234,
        te: null,
        kudos: 7,
      }),
      at(DAY)
    );
    expect(save.runs[0]).toEqual({
      day: DAY,
      mode: "race",
      finished: false,
      timeMs: 90_000,
      meters: 1234,
      te: null,
      kudos: 7,
    });
    expect(runResult(save.runs[0])).toBe("DNF");
    expect(runResult({ ...save.runs[0], finished: true })).toBe("1:30.00");
    expect(save.lastDnfDay).toBe(DAY);
  });

  it("earns Couch to 5K after a DNF earlier the same day", () => {
    const dnf = recordRun(
      newBadgeSave(),
      facts({ finished: false }),
      at(DAY, 7)
    );
    const finish = recordRun(dnf.save, facts(), at(DAY, 21));
    expect(finish.earned).toContain("couch");
    // The next day's 5K is not after a DNF that day.
    const fresh = recordRun(dnf.save, facts(), at("2026-10-16", 7));
    expect(fresh.earned).not.toContain("couch");
  });

  it("says what was earned", () => {
    expect(badgeNews([])).toBe("");
    expect(badgeNews(["first5k"])).toBe("Badge earned: First 5K.");
    expect(badgeNews(["first5k", "legday"])).toBe(
      "2 badges earned: First 5K, Never Skip Leg Day."
    );
    expect(badgeToast("sub5")).toBe("BADGE EARNED · SUB-5 MINUTE RACE");
  });
});

describe("streak dates (#2021)", () => {
  it("counts calendar days, not hours, across midnight", () => {
    let save = recordRun(newBadgeSave(), facts(), at(DAY, 23, 59)).save;
    save = recordRun(save, facts(), at("2026-10-16", 0, 1)).save;
    expect(save.streak).toEqual({ lastDay: "2026-10-16", days: 2 });
    // Two runs on one day are one day.
    save = recordRun(save, facts(), at("2026-10-16", 22)).save;
    expect(save.streak.days).toBe(2);
  });

  it("carries across month and year ends and leap days", () => {
    expect(daysBetween("2026-01-31", "2026-02-01")).toBe(1);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
    expect(daysBetween("2028-02-28", "2028-02-29")).toBe(1);
    expect(daysBetween("2028-02-29", "2028-03-01")).toBe(1);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-04-30", "2026-05-01")).toBe(1);
    // A clock change week is still one day per day.
    expect(daysBetween("2026-03-07", "2026-03-08")).toBe(1);
    expect(daysBetween("2026-11-01", "2026-11-02")).toBe(1);
  });

  it("builds a 7 day streak over a month end and earns both badges", () => {
    let save = newBadgeSave();
    const earned: string[] = [];
    for (const day of [
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ]) {
      const r = recordRun(save, facts(), at(day, 23, 30));
      save = r.save;
      earned.push(...r.earned);
    }
    expect(save.streak.days).toBe(7);
    expect(earned).toEqual(expect.arrayContaining(["streak3", "streak7"]));
    expect(save.badges.streak3).toBe("2026-10-30");
    expect(save.badges.streak7).toBe("2026-11-03");
  });

  it("starts over after a missed day or a clock set back", () => {
    const streak = { lastDay: "2026-10-15", days: 4 };
    expect(streakAfter(streak, "2026-10-17")).toEqual({
      lastDay: "2026-10-17",
      days: 1,
    });
    expect(streakAfter(streak, "2026-10-14").days).toBe(1);
    expect(streakAfter({ lastDay: null, days: 0 }, DAY).days).toBe(1);
  });

  it("rejects days that are not days", () => {
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("2026-13-01")).toBe(false);
    expect(isDay("yesterday")).toBe(false);
    expect(isDay(20261015)).toBe(false);
    expect(daysBetween("nope", DAY)).toBeNull();
    expect(dayLabel(DAY)).toBe("Oct 15, 2026");
    expect(dayLabel("nope")).toBe("nope");
  });
});

describe("the badge save (#2021)", () => {
  it("round-trips through storage", () => {
    const { save } = recordRun(newBadgeSave(), facts(), at(DAY));
    expect(saveBadges(save)).toBe(true);
    expect(loadBadges()).toEqual(save);
  });

  it("reads missing, corrupt and foreign saves as empty", () => {
    expect(loadBadges()).toEqual(newBadgeSave());
    safeSetRawItem(BADGE_STORAGE_KEY, "{not json");
    expect(loadBadges()).toEqual(newBadgeSave());
    safeSetRawItem(BADGE_STORAGE_KEY, JSON.stringify({ v: 99, runs: [] }));
    expect(loadBadges()).toEqual(newBadgeSave());
    expect(normalizeBadges(null)).toEqual(newBadgeSave());
    expect(normalizeBadges("x")).toEqual(newBadgeSave());
  });

  it("drops bad runs and badges one by one, and caps the history", () => {
    const good = {
      day: DAY,
      mode: "training",
      finished: true,
      timeMs: 300_000,
      meters: 5000,
      te: 3,
      kudos: 9,
    };
    const save = normalizeBadges({
      v: 1,
      runs: [
        good,
        { ...good, day: "2026-02-30" },
        { ...good, mode: "sprint" },
        null,
        { ...good, te: 9, timeMs: -5, meters: "far", kudos: Number.NaN },
        ...Array.from({ length: 30 }, () => good),
      ],
      badges: { first5k: DAY, nope: DAY, sub5: "soon", legday: DAY },
      streak: { lastDay: DAY, days: -3 },
      lastDnfDay: 7,
    });
    expect(save.runs).toHaveLength(HISTORY_SIZE);
    expect(save.runs[1]).toEqual({
      ...good,
      te: 5,
      timeMs: 0,
      meters: 0,
      kudos: 0,
    });
    expect(save.badges).toEqual({ first5k: DAY, legday: DAY });
    expect(save.streak).toEqual({ lastDay: DAY, days: 1 });
    expect(save.lastDnfDay).toBeNull();
    expect(normalizeBadges({ v: 1, runs: "x", badges: [], streak: 4 })).toEqual(
      newBadgeSave()
    );
  });

  it("survives storage that throws", () => {
    vi.spyOn(JSON, "parse").mockImplementationOnce(() => {
      throw new Error("boom");
    });
    expect(loadBadges()).toEqual(newBadgeSave());
    vi.spyOn(JSON, "stringify").mockImplementationOnce(() => {
      throw new Error("boom");
    });
    expect(saveBadges(newBadgeSave())).toBe(false);
  });
});

/** A Training Run on stage 1, a frame short of its pole, on a bare lane. */
function atPole(overrides: Partial<GameEngineState> = {}): GameEngineState {
  const base = startGame(
    setRules(createInitialState("fenix", 0, []), "fitness"),
    "fenix"
  );
  return {
    ...base,
    gpsMs: 0,
    obstacles: [],
    foes: [],
    lastObstacleTime: clock + 1e9,
    lastAllocTime: clock + 1e9,
    badgeRun: newBadgeRun(),
    distanceMeters:
      (stagePoleX(1) - PLAYER_X - PLAYER_WIDTH + 4) / PX_PER_METER,
    playerY: GROUND_Y - PLAYER_HEIGHT,
    isGrounded: true,
    course: { ...EMPTY_COURSE, poles: [{ x: stagePoleX(1), stage: 1 }] },
    ...overrides,
  };
}

/** One engine step, then the badge step, as the simulator runs them. */
const tick = (s: GameEngineState) =>
  stepBadgeRun(s, updateGameSimulation(s, FRAME));

/** Steps until the pole is grabbed. */
function runToPole(s: GameEngineState): GameEngineState {
  let state = s;
  for (let i = 0; i < 120 && (state.lapSplits?.length ?? 0) === 0; i++) {
    state = tick(state);
  }
  expect(state.lapSplits?.length).toBe(1);
  return state;
}

describe("tracking a run (#2021)", () => {
  it("notes a stage cleared without sprinting, with its Training Effect", () => {
    const end = runToPole(atPole());
    expect(end.badgeRun?.legDay).toBe(true);
    expect(end.badgeRun?.sprinted).toBe(false);
    expect(end.badgeRun?.peakTe).toBe(end.lastTrainingEffect);
    expect(end.badgeRun?.peakTe).not.toBeNull();
  });

  it("does not count a stage where sprint was held", () => {
    const end = runToPole(atPole({ runInput: 1 }));
    expect(end.badgeRun?.legDay).toBe(false);
    // The next stage starts unsprinted.
    expect(end.badgeRun?.sprinted).toBe(false);
  });

  it("does not count sprint held while bonked, which does not sprint", () => {
    const prev = atPole();
    const next = stepBadgeRun(prev, {
      ...prev,
      runInput: 1,
      bodyBattery: { ...prev.bodyBattery!, bonked: true },
    });
    expect(next.badgeRun?.sprinted).toBe(false);
  });

  it("notes a Rep Max beaten, not one left behind or cleared away", () => {
    const onFace = atPole().distanceMeters * PX_PER_METER + 100;
    const boss = makeFoe(1, "repmax", onFace, GROUND_Y);
    const prev = atPole({ foes: [boss], score: 100 });
    const paid = { foes: [], score: 100 + REPMAX_SCORE };
    const step = (p: GameEngineState, extra: Partial<GameEngineState> = {}) =>
      stepBadgeRun(p, { ...p, ...paid, ...extra }).badgeRun?.repMax;
    expect(step(prev)).toBe(true);
    // Gone with no points paid: it scrolled away.
    expect(step(prev, { score: 120 })).toBe(false);
    // Another foe left with the points.
    expect(step(prev, { foes: [boss] })).toBe(false);
    // The stage cleared and took its foes along.
    expect(step(prev, { lapSplits: [60_000] })).toBe(false);
    // Culled behind the camera on the step a stomp chain paid big.
    const behind = { ...boss, x: onFace - 400, width: 24 };
    expect(step({ ...prev, foes: [behind] })).toBe(false);
    // Fallen into a gap.
    expect(step({ ...prev, foes: [{ ...boss, y: GROUND_Y + 40 }] })).toBe(
      false
    );
    // A bonus room entered clears the lane.
    expect(
      step(prev, { bonusRoom: fromPartial<GameEngineState["bonusRoom"]>({}) })
    ).toBe(false);
  });

  it("does not count sprint held on Race Day, which runs at a steady pace", () => {
    const prev = atPole({
      plan: fromPartial<PlanRun>({ stage: 1, raceDay: true }),
    });
    expect(
      stepBadgeRun(prev, { ...prev, runInput: 1 }).badgeRun?.sprinted
    ).toBe(false);
  });

  it("judges each stage on its own sprinting", () => {
    let run = atPole();
    const clear = (s: GameEngineState, extra: Partial<GameEngineState>) =>
      stepBadgeRun(s, {
        ...s,
        ...extra,
        lapSplits: [...(s.lapSplits ?? []), 60_000],
      });
    // Stage 1 sprinted, a life lost, still sprinted at the pole.
    run = stepBadgeRun(run, { ...run, runInput: 1 });
    run = stepBadgeRun(run, {
      ...run,
      runInput: 0,
      lives: (run.lives ?? 3) - 1,
    });
    expect(run.badgeRun?.sprinted).toBe(true);
    run = clear(run, {});
    expect(run.badgeRun?.legDay).toBe(false);
    // Stage 2 not sprinted.
    run = clear(run, {});
    expect(run.badgeRun?.legDay).toBe(true);
  });

  it("keeps the best Training Effect of the stages cleared", () => {
    const prev = atPole({ lastTrainingEffect: undefined });
    const a = stepBadgeRun(prev, { ...prev, lastTrainingEffect: 3.4 });
    const b = stepBadgeRun(a, { ...a, lastTrainingEffect: 2.1 });
    expect(b.badgeRun?.peakTe).toBe(3.4);
  });

  it("does nothing to a run that is not tracked", () => {
    const prev = atPole({ badgeRun: null });
    const next = { ...prev, runInput: 1 as const };
    expect(stepBadgeRun(prev, next)).toBe(next);
  });

  it("records a Training Plan workout toward the streak, not the 5K badges", () => {
    const save = {
      ...newBadgeSave(),
      lastDnfDay: DAY,
      streak: { lastDay: "2026-10-14", days: 2 },
    };
    const r = recordRun(save, facts({ mode: "plan", meters: 1000 }), at(DAY));
    expect(r.save.runs[0].mode).toBe("plan");
    expect(r.save.streak.days).toBe(3);
    expect(r.earned).toEqual(["streak3"]);
  });

  it("reads the mode and race result from the final state", () => {
    const base = atPole({ gameState: "summary", runClockMs: 250_000 });
    expect(runFactsOf(base).mode).toBe("training");
    expect(runFactsOf(base).raceTimed).toBe(false);
    const race = {
      ...base,
      race: {
        course: "saturday5k" as const,
        category: "any" as const,
        seed: 1,
      },
      kudosMissed: 0,
      gearTaken: false,
    };
    expect(runFactsOf(race)).toMatchObject({
      mode: "race",
      raceTimed: true,
      finished: true,
      timeMs: 250_000,
    });
    expect(
      runFactsOf({
        ...race,
        race: { ...race.race, category: "nogear" },
        gearTaken: true,
      }).raceTimed
    ).toBe(false);
    expect(
      runFactsOf({ ...base, plan: fromPartial<PlanRun>({ stage: 1 }) }).mode
    ).toBe("plan");
  });
});
