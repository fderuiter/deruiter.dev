// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EMPTY_PROPS } from "@/lib/garmin/props";
import {
  causeLabel,
  createInitialState,
  isFitnessRun,
  setRules,
  setRunInput,
  startGame,
  updateGameSimulation,
  PLAYER_X,
  type GameEngineState,
} from "@/lib/garmin/engine";
import { EMPTY_COURSE, type CourseLayout } from "@/lib/garmin/course";
import {
  BODY_BATTERY_SPRINT_DRAIN_PER_S,
  FRESH_BODY_BATTERY,
  effectiveRunInput,
} from "@/lib/garmin/body-battery";
import { GPS_LOCK_MS, gpsBannerText } from "@/lib/garmin/culture";
import { endFaceFor } from "@/components/garmin-watch/watch-face-art";

// The fitness rules of Monkey C Mayhem (#2010): no watch battery, heat, fog
// or heap; Body Battery, a GPS hold at the start, a move alert and a
// Training Status on the game over face.

const FRAME = 1000 / 60;
let clock = 0;

beforeEach(() => {
  clock = 5_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** A fitness run on a flat course with no foes, spawns or allocations. */
function fitnessRun(overrides: Partial<GameEngineState> = {}): GameEngineState {
  return {
    ...startGame(
      setRules(createInitialState("fenix", 0, []), "fitness"),
      "fenix"
    ),
    course: EMPTY_COURSE,
    // No stations: a runner held at one would get the stall alert (#2232).
    props: EMPTY_PROPS,
    foes: [],
    foeShots: [],
    obstacles: [],
    gpsMs: 0,
    lastObstacleTime: clock + 1e9,
    lastAllocTime: clock + 1e9,
    ...overrides,
  };
}

/** A dev-rules run on the same footing, with allocations due so the heap would move. */
function devRun(overrides: Partial<GameEngineState> = {}): GameEngineState {
  return {
    ...startGame(setRules(createInitialState("fenix", 0, []), "dev"), "fenix"),
    course: EMPTY_COURSE,
    foes: [],
    foeShots: [],
    obstacles: [],
    lastObstacleTime: clock + 1e9,
    lastAllocTime: clock - 1e9,
    ...overrides,
  };
}

function step(state: GameEngineState, frames = 1): GameEngineState {
  let s = state;
  for (let i = 0; i < frames; i++) {
    s = updateGameSimulation(s, FRAME);
  }
  return s;
}

describe("setRules", () => {
  it("sets the rules straight away on an idle state", () => {
    const idle = createInitialState("fenix", 0, []);
    const next = setRules(idle, "fitness");
    expect(next.rules).toBe("fitness");
    expect(next.pendingRules).toBeUndefined();
    expect(isFitnessRun(next)).toBe(true);
  });

  it("keeps the end screen's rules and queues the change for the next run", () => {
    for (const gameState of ["crashed", "summary", "shutdown"] as const) {
      const ended: GameEngineState = { ...fitnessRun(), gameState };
      const next = setRules(ended, "dev");
      expect(next.rules).toBe("fitness");
      expect(next.pendingRules).toBe("dev");
      expect(startGame(next, "fenix").rules).toBe("dev");
    }
  });

  it("queues a change as pendingRules while a run is playing", () => {
    const playing = { ...fitnessRun(), rules: "dev" as const };
    const next = setRules(playing, "fitness");
    expect(next.rules).toBe("dev");
    expect(next.pendingRules).toBe("fitness");
  });

  it("queues a change as pendingRules while a run is paused", () => {
    const paused = { ...fitnessRun(), gameState: "paused" as const };
    const next = setRules(paused, "dev");
    expect(next.rules).toBe("fitness");
    expect(next.pendingRules).toBe("dev");
  });

  it("clears a pending change when set back to the current rules mid-run", () => {
    const playing = fitnessRun();
    const queued = setRules(playing, "dev");
    expect(queued.pendingRules).toBe("dev");
    const back = setRules(queued, "fitness");
    expect(back.pendingRules).toBeUndefined();
    expect(back.rules).toBe("fitness");
  });

  it("treats absent rules as dev when deciding whether a mid-run change is needed", () => {
    const playing = { ...devRun(), rules: undefined };
    expect(setRules(playing, "dev")).toBe(playing);
  });

  it("startGame applies pendingRules and drops them from the new run", () => {
    const playing: GameEngineState = {
      ...devRun(),
      pendingRules: "fitness",
    };
    const started = startGame(playing, "fenix");
    expect(started.rules).toBe("fitness");
    expect(started.pendingRules).toBeUndefined();
    expect(started.bodyBattery).toEqual(FRESH_BODY_BATTERY);
  });
});

describe("startGame under fitness rules", () => {
  it("gives a fresh, full, unbonked Body Battery", () => {
    const s = startGame(
      setRules(createInitialState("fenix", 0, []), "fitness"),
      "fenix"
    );
    expect(s.bodyBattery).toEqual({ value: 100, bonked: false });
  });

  it("starts the GPS hold at GPS_LOCK_MS with the GPS waiting banner", () => {
    const s = startGame(
      setRules(createInitialState("fenix", 0, []), "fitness"),
      "fenix"
    );
    expect(s.gpsMs).toBe(GPS_LOCK_MS);
    expect(s.banner?.text).toBe(gpsBannerText(0));
    expect(s.banner?.text).toBe("WAITING FOR GPS…");
    expect(s.banner?.tone).toBe("info");
  });

  it("records the high score at the start as bestAtStart", () => {
    const s = startGame(
      setRules(createInitialState("fenix", 500, []), "fitness"),
      "fenix"
    );
    expect(s.bestAtStart).toBe(500);
    expect(s.prAnnounced).toBe(false);
  });

  it("keeps the dev start banner and no Body Battery under dev rules", () => {
    const s = startGame(
      setRules(createInitialState("fenix", 0, []), "dev"),
      "fenix"
    );
    expect(s.bodyBattery).toBeUndefined();
    expect(s.gpsMs).toBeUndefined();
    expect(s.banner?.text).toBe("STAGE 1 · GO!");
  });
});

describe("GPS hold", () => {
  it("does not advance distance while the GPS intro runs", () => {
    const s = fitnessRun({ gpsMs: GPS_LOCK_MS });
    const held = step(s, 60); // one second, still inside the lock
    expect(held.gpsMs).toBeGreaterThan(0);
    expect(held.distanceMeters).toBe(0);
  });

  it("releases the run once the lock has passed, then distance advances", () => {
    const s = fitnessRun({ gpsMs: GPS_LOCK_MS });
    const locked = updateGameSimulation(s, GPS_LOCK_MS + 100);
    expect(locked.gpsMs).toBe(0);
    expect(locked.banner?.text).toBe(gpsBannerText(GPS_LOCK_MS + 100));
    expect(locked.banner?.text).toBe("GPS READY · GO!");
    expect(locked.banner?.tone).toBe("good");
    expect(locked.distanceMeters).toBe(0);
    const moving = step(locked, 30);
    expect(moving.distanceMeters).toBeGreaterThan(0);
  });
});

describe("no watch battery, heat, fog or heap under fitness", () => {
  it("keeps the watch battery, thermal stress and fog untouched over several seconds", () => {
    const s = fitnessRun({ isLightOn: true, lightActiveDurationMs: 0 });
    const after = step(s, 360); // six seconds
    expect(after.gameState).toBe("playing");
    expect(after.battery).toBe(100);
    expect(after.thermalStress).toBe(0);
    expect(after.fogLevel).toBe(0);
  });

  it("makes no automatic heap allocations even when allocations are due", () => {
    const s = fitnessRun({ lastAllocTime: clock - 1e9 });
    const after = step(s, 360);
    expect(after.variables).toHaveLength(2);
    expect(after.allocatedRamKb).toBe(1.8);
    expect(after.gameState).toBe("playing");
  });

  it("contrast: the same dev run drains the watch battery, heats up and allocates", () => {
    const s = devRun({ isLightOn: true, lightActiveDurationMs: 0 });
    const after = step(s, 360);
    expect(after.battery).toBeLessThan(100);
    expect(after.thermalStress).toBeGreaterThan(0);
    expect(after.variables.length).toBeGreaterThan(2);
  });
});

describe("Body Battery under fitness rules", () => {
  it("drains while running on footing", () => {
    const s = fitnessRun();
    const after = step(s, 60); // one second at a run
    expect(after.bodyBattery?.bonked).toBe(false);
    expect(after.bodyBattery?.value).toBeCloseTo(99.65, 3);
  });

  it("drains faster while sprinting on footing", () => {
    const s = setRunInput(fitnessRun(), 1);
    const after = step(s, 60);
    expect(after.bodyBattery?.value).toBeCloseTo(
      100 - BODY_BATTERY_SPRINT_DRAIN_PER_S,
      3
    );
  });

  it("recovers while easing on footing", () => {
    const s = setRunInput(
      fitnessRun({ bodyBattery: { value: 50, bonked: false } }),
      -1
    );
    const after = step(s, 60);
    expect(after.bodyBattery?.value).toBeCloseTo(50.8, 3);
    expect(after.bodyBattery?.bonked).toBe(false);
  });

  it("bonks when the battery reaches 0, with a BONK banner", () => {
    const s = fitnessRun({ bodyBattery: { value: 0.001, bonked: false } });
    const after = step(s, 1);
    expect(after.bodyBattery).toEqual({ value: 0, bonked: true });
    expect(after.banner?.text.startsWith("BONK!")).toBe(true);
    expect(after.banner?.tone).toBe("warn");
  });

  it("turns a sprint into a steady run while bonked", () => {
    const bonked = { value: 0, bonked: true };
    expect(effectiveRunInput(bonked, 1)).toBe(0);
    expect(effectiveRunInput(bonked, 0)).toBe(0);
    expect(effectiveRunInput(bonked, -1)).toBe(-1);
    expect(effectiveRunInput({ value: 60, bonked: false }, 1)).toBe(1);
  });

  it("a bonked runner holding sprint keeps a steady pace and recharges", () => {
    const steady = step(
      setRunInput(fitnessRun({ bodyBattery: { value: 60, bonked: false } }), 0),
      60
    );
    const s = setRunInput(
      fitnessRun({ bodyBattery: { value: 10, bonked: true } }),
      1
    );
    const after = step(s, 60);
    expect(after.distanceMeters).toBeCloseTo(steady.distanceMeters, 5);
    expect(after.bodyBattery?.value).toBeGreaterThan(10);
    expect(after.bodyBattery?.bonked).toBe(true);
  });
});

describe("move alert under fitness rules", () => {
  it("shows MOVE! after easing on footing for the idle window", () => {
    const s = setRunInput(fitnessRun(), -1);
    let seen = false;
    let current = s;
    for (let i = 0; i < 400 && !seen; i++) {
      current = step(current);
      if (current.banner?.text === "MOVE!") seen = true;
    }
    expect(seen).toBe(true);
    // The alert resets the idle clock once it fires.
    expect(current.idleMs).toBeLessThan(6000);
  });

  it("does not show MOVE! while running at a normal pace", () => {
    const s = fitnessRun();
    let seen = false;
    let current = s;
    for (let i = 0; i < 400; i++) {
      current = step(current);
      if (current.banner?.text === "MOVE!") seen = true;
    }
    expect(seen).toBe(false);
    expect(current.idleMs).toBe(0);
  });
});

describe("review fixes (#2010)", () => {
  it("never buzzes MOVE! at a bonked runner, who is forced to ease", () => {
    let current = setRunInput(
      fitnessRun({ bodyBattery: { value: 0, bonked: true } }),
      1
    );
    let seen = false;
    for (let i = 0; i < 420; i++) {
      current = step(current);
      if (current.banner?.text === "MOVE!") seen = true;
    }
    expect(seen).toBe(false);
  });

  it("holds NEW PR! until the banner on screen clears", () => {
    let current = fitnessRun({
      bestAtStart: 10,
      score: 50,
      banner: { text: "TE 3.0 · IMPROVING", ttlMs: 500, tone: "good" },
    });
    current = step(current);
    expect(current.banner?.text).toBe("TE 3.0 · IMPROVING");
    expect(current.prAnnounced).toBe(false);
    for (let i = 0; i < 60 && !current.prAnnounced; i++) {
      current = step(current);
    }
    expect(current.prAnnounced).toBe(true);
    expect(current.banner?.text).toBe("NEW PR!");
  });
});

describe("causeLabel", () => {
  it("maps Dev Mode crash types to fitness names under fitness rules", () => {
    const fitness = { rules: "fitness" as const };
    expect(causeLabel(fitness, "Null Pointer")).toBe("COUCH POTATO");
    expect(causeLabel(fitness, "Watchdog Tripped")).toBe("SNOOZED");
    expect(causeLabel(fitness, "Stack Overflow")).toBe("CLIPPED A HURDLE");
    expect(causeLabel(fitness, "Segmentation Fault")).toBe("MISSED THE CURB");
    expect(causeLabel(fitness, "Dropped Kettlebell")).toBe(
      "DROPPED KETTLEBELL"
    );
    expect(causeLabel(fitness, "Gym Injury")).toBe("GYM INJURY");
  });

  it("falls back to DNF for causes with no fitness name", () => {
    expect(causeLabel({ rules: "fitness" }, "Out Of Memory")).toBe("DNF");
    expect(causeLabel({ rules: "fitness" }, "Power Loss")).toBe("DNF");
  });

  it("uppercases the Dev Mode error type under dev rules or when rules are absent", () => {
    expect(causeLabel({ rules: "dev" }, "Null Pointer")).toBe("NULL POINTER");
    expect(causeLabel({}, "Stack Overflow")).toBe("STACK OVERFLOW");
  });
});

describe("losing a life under fitness rules", () => {
  it("costs Body Battery and counts a hit and a lost life for the stage", () => {
    // A gap under the runner: falling through spends a life.
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      gaps: [{ x: PLAYER_X - 30, width: 200 }],
    };
    let s = fitnessRun({ course, lives: 3 });
    for (
      let i = 0;
      i < 180 && s.lives === 3 && s.gameState === "playing";
      i++
    ) {
      s = step(s);
    }
    expect(s.lives).toBe(2);
    expect(s.stageLivesLost).toBe(1);
    expect(s.stageHits).toBe(1);
    expect(s.bodyBattery?.value).toBeCloseTo(85, 5);
    expect(s.banner?.text).toBe("MISSED THE CURB · LIVES 2");
  });

  it("leaves the stage tallies and Body Battery alone under dev rules", () => {
    const course: CourseLayout = {
      ...EMPTY_COURSE,
      gaps: [{ x: PLAYER_X - 30, width: 200 }],
    };
    let s = devRun({ course, lives: 3 });
    for (
      let i = 0;
      i < 180 && s.lives === 3 && s.gameState === "playing";
      i++
    ) {
      s = step(s);
    }
    expect(s.lives).toBe(2);
    expect(s.bodyBattery).toBeUndefined();
    expect(s.stageLivesLost).toBeUndefined();
    expect(s.banner?.text).toBe("SEGMENTATION FAULT · LIVES 2");
  });
});

describe("endFaceFor under fitness rules", () => {
  it("shows a Training Status on a fitness crash, even with an empty watch battery", () => {
    const face = endFaceFor({
      gameState: "crashed",
      battery: 0,
      crashReport: null,
      rules: "fitness",
      stage: 2,
    });
    expect(face).not.toBeNull();
    expect(face?.kind).toBe("status");
    expect(face?.headline).toBe("RECOVERY");
    expect(face?.detail).toContain("Training Status");
    expect(face?.detail).toContain("Recovery 18 h");
  });

  it("shows 5K COMPLETE with the Training Status on a fitness summary", () => {
    const face = endFaceFor({
      gameState: "summary",
      battery: 100,
      crashReport: null,
      rules: "fitness",
      stage: 5,
    });
    expect(face?.kind).toBe("complete");
    expect(face?.headline).toBe("5K COMPLETE");
    // A finished 5K is always "Peaking", whatever the stage.
    expect(face?.detail).toContain("Peaking");
    expect(face?.detail).toContain("Recovery 72 h");
  });

  it("never shows a Power Loss face under fitness rules", () => {
    const face = endFaceFor({
      gameState: "shutdown",
      battery: 0,
      crashReport: null,
      rules: "fitness",
      stage: 1,
    });
    expect(face).toBeNull();
  });

  it("contrast: a dev crash still shows the crash face", () => {
    const face = endFaceFor({
      gameState: "crashed",
      battery: 100,
      crashReport: {
        errorType: "Null Pointer",
        file: "App.mc",
        line: 1,
        stackTrace: [],
        heapUsedKb: 1,
        heapLimitKb: 24,
      },
      rules: "dev",
    });
    expect(face?.kind).toBe("crash");
    expect(face?.headline).toBe("NULL POINTER");
  });
});
