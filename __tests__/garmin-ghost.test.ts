// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  GHOST_FLAG,
  GHOST_MAX_CHARS,
  GHOST_SAMPLE_MS,
  createGhostRecorder,
  decodeGhost,
  encodeGhost,
  finishGhost,
  formatGap,
  ghostAt,
  ghostGapMs,
  lapGapMs,
  recordGhost,
  type GhostSample,
  type GhostSource,
  type GhostTrack,
} from "@/lib/garmin-ghost";
import {
  createInitialState,
  paceMeters,
  pressJump,
  releaseJump,
  setRules,
  startGame,
  updateGameSimulation,
  type GameEngineState,
} from "@/lib/garmin-engine";
import { FIXED_STEP_MS, raceSetup } from "@/lib/garmin-race";
import { isUnderwater } from "@/lib/garmin-swim";

// The Virtual Partner (#2020): recording, encoding, interpolation and gaps.

const SATURDAY = raceSetup("saturday5k", "any", new Date(2026, 9, 14, 8));

/** A sample at `d` metres, on the ground, at Base on stage 1. */
function at(d: number, extra: Partial<GhostSample> = {}): GhostSample {
  return {
    d,
    y: 181,
    stage: 1,
    power: "base",
    flags: GHOST_FLAG.grounded,
    ...extra,
  };
}

/** A ghost of `samples`, one every sample interval. */
function track(samples: GhostSample[], extra: Partial<GhostTrack> = {}) {
  return {
    intervalMs: GHOST_SAMPLE_MS,
    samples,
    lapEndsMs: [],
    timeMs: (samples.length - 1) * GHOST_SAMPLE_MS,
    ...extra,
  };
}

/** A playing source at run clock `clockMs`. */
function source(clockMs: number, extra: Partial<GhostSource> = {}) {
  return {
    gameState: "playing",
    runClockMs: clockMs,
    distanceMeters: clockMs / 100,
    playerY: 181,
    isGrounded: true,
    ...extra,
  };
}

describe("recordGhost", () => {
  it("takes one sample per interval of run clock, in order", () => {
    const rec = createGhostRecorder();
    for (let clock = 0; clock <= 1000; clock += FIXED_STEP_MS) {
      recordGhost(rec, source(clock), false);
    }
    // Run clock 0 to 1000 holds samples at 0, 100, ... 900 (1000 is past the
    // last step before it).
    expect(rec.samples).toHaveLength(10);
    expect(rec.samples[3].d).toBeCloseTo(3, 0);
  });

  it("repeats a sample when a stall skips past several sample times", () => {
    const rec = createGhostRecorder();
    recordGhost(rec, source(0), false);
    recordGhost(rec, source(350), false);
    expect(rec.samples).toHaveLength(4);
    expect(rec.nextAtMs).toBe(400);
  });

  it("records nothing outside play", () => {
    const rec = createGhostRecorder();
    recordGhost(rec, source(500, { gameState: "paused" }), false);
    expect(rec.samples).toHaveLength(0);
  });

  it("packs the pose, the power, the room and swimming into the sample", () => {
    const rec = createGhostRecorder();
    recordGhost(
      rec,
      source(0, {
        isGrounded: false,
        slamming: true,
        wallSide: true,
        riding: true,
        spinJump: true,
        bonusRoom: {},
        power: "cape",
        stage: 3,
      }),
      true
    );
    const s = rec.samples[0];
    expect(s.power).toBe("cape");
    expect(s.stage).toBe(3);
    expect(s.flags & GHOST_FLAG.grounded).toBe(0);
    expect(s.flags).toBe(
      GHOST_FLAG.slamming |
        GHOST_FLAG.wallSide |
        GHOST_FLAG.riding |
        GHOST_FLAG.spinJump |
        GHOST_FLAG.room |
        GHOST_FLAG.swimming
    );
  });

  it("sums lap splits into lap end times when the run finishes", () => {
    const rec = createGhostRecorder();
    recordGhost(rec, source(0), false);
    const ghost = finishGhost(rec, [60_000, 55_000, 58_000], 173_000);
    expect(ghost.lapEndsMs).toEqual([60_000, 115_000, 173_000]);
    expect(ghost.timeMs).toBe(173_000);
    // The ghost keeps its own copy of the samples.
    recordGhost(rec, source(100), false);
    expect(ghost.samples).toHaveLength(1);
  });
});

describe("encodeGhost and decodeGhost", () => {
  it("round-trips samples to a pixel, with stage, power and pose changes", () => {
    const samples = [
      at(0),
      at(1.23, { y: 150.4, flags: 0 }),
      at(2.5, { y: 120, power: "buff", flags: GHOST_FLAG.slamming }),
      at(1.0, { stage: 2, power: "trisuit", flags: GHOST_FLAG.swimming }),
      at(3.0, { stage: 2, power: "trisuit", flags: GHOST_FLAG.room }),
    ];
    const ghost = track(samples, { lapEndsMs: [12_345], timeMs: 400 });
    const encoded = encodeGhost(ghost);
    expect(encoded).not.toBeNull();
    const decoded = decodeGhost(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.intervalMs).toBe(GHOST_SAMPLE_MS);
    expect(decoded?.timeMs).toBe(400);
    expect(decoded?.lapEndsMs).toEqual([12_345]);
    expect(decoded?.samples).toHaveLength(samples.length);
    decoded?.samples.forEach((s, i) => {
      expect(s.d).toBeCloseTo(samples[i].d, 1);
      expect(Math.abs(s.y - samples[i].y)).toBeLessThanOrEqual(0.5);
      expect(s.stage).toBe(samples[i].stage);
      expect(s.power).toBe(samples[i].power);
      expect(s.flags).toBe(samples[i].flags);
    });
  });

  it("keeps a full 5K race well inside the cap", () => {
    // About seven minutes at a steady 12 m/s with a hop every second.
    const samples = Array.from({ length: 4200 }, (_, i) =>
      at(i * 1.2, { y: 181 - (i % 10) * 3 })
    );
    const encoded = encodeGhost(track(samples));
    expect(encoded).not.toBeNull();
    expect(encoded?.length).toBeLessThan(GHOST_MAX_CHARS);
    expect(decodeGhost(encoded)?.intervalMs).toBe(GHOST_SAMPLE_MS);
  });

  it("thins a ghost that would pass the cap, doubling its interval", () => {
    // Big jumps every sample make each token long.
    const samples = Array.from({ length: 12_000 }, (_, i) =>
      at(i * 37, { y: i % 2 === 0 ? -500 : 500 })
    );
    const encoded = encodeGhost(track(samples));
    expect(encoded).not.toBeNull();
    expect(encoded?.length).toBeLessThanOrEqual(GHOST_MAX_CHARS);
    const decoded = decodeGhost(encoded);
    expect(decoded?.intervalMs).toBeGreaterThan(GHOST_SAMPLE_MS);
    // Thinned samples still sit at the same run clock.
    const step = (decoded?.intervalMs ?? 0) / GHOST_SAMPLE_MS;
    expect(decoded?.samples[1].d).toBeCloseTo(samples[step].d, 1);
  });

  it("gives up when even one sample a second will not fit", () => {
    const samples = Array.from({ length: 200_000 }, (_, i) =>
      at(i * 1e6, { y: i % 2 === 0 ? -1e6 : 1e6 })
    );
    expect(encodeGhost(track(samples))).toBeNull();
  });

  it.each([
    ["not a string", 42],
    ["empty", ""],
    ["another format", "g9:2s:0::m1,0/0"],
    ["too few fields", "g1:2s:0"],
    ["a zero interval", "g1:0:0::m1,0/0"],
    ["a bad lap", "g1:2s:0:zz.!:m1,0/0"],
    ["a sample before any mode", "g1:2s:0::0/0"],
    ["a bad sample", "g1:2s:0::m1,0/0/0"],
    ["a bad number", "g1:2s:0::m1,0/%"],
    ["an unknown power", "g1:2s:0::mhs,0/0"],
    ["no samples", "g1:2s:0::"],
    ["too long", `g1:2s:0::m1,${"0/0,".repeat(GHOST_MAX_CHARS)}`],
  ])("reads %s as no ghost", (_label, encoded) => {
    expect(decodeGhost(encoded)).toBeNull();
  });
});

describe("ghostAt", () => {
  const ghost = track([at(0), at(1, { y: 171 }), at(2), at(3)]);

  it("eases distance and height between the samples around the clock", () => {
    const g = ghostAt(ghost, 50);
    expect(g?.d).toBeCloseTo(0.5);
    expect(g?.y).toBeCloseTo(176);
  });

  it("holds the last sample until the finish, then is gone", () => {
    expect(ghostAt(ghost, 300)?.d).toBe(3);
    expect(ghostAt(ghost, 301)).toBeNull();
    expect(ghostAt(ghost, -1)).toBeNull();
    expect(ghostAt(ghost, Number.NaN)).toBeNull();
  });

  it("cuts, not slides, into a new stage or a bonus room", () => {
    const cut = track([at(10), at(0, { stage: 2 }), at(1, { stage: 2 })]);
    expect(ghostAt(cut, 50)).toEqual(at(10));
    const room = track([at(10), at(11, { flags: GHOST_FLAG.room }), at(12)]);
    expect(ghostAt(room, 50)?.d).toBe(10);
  });
});

describe("ghostGapMs", () => {
  // The ghost covers 1 m per sample, so it reaches 5 m at run clock 500.
  const ghost = track(Array.from({ length: 11 }, (_, i) => at(i)));

  it("is positive when behind the ghost and negative when ahead", () => {
    expect(ghostGapMs(ghost, 5, 700)).toBeCloseTo(200);
    expect(ghostGapMs(ghost, 5, 400)).toBeCloseTo(-100);
  });

  it("eases between samples", () => {
    expect(ghostGapMs(ghost, 2.5, 250)).toBeCloseTo(0);
  });

  it("measures against the furthest the ghost had reached, so its lost lives never pull it back", () => {
    const rewound = track([at(0), at(4), at(0), at(2), at(5), at(6)]);
    // 3 m was passed at run clock 75, before the ghost's lost life.
    expect(ghostGapMs(rewound, 3, 175)).toBeCloseTo(100);
    // 4.5 m: first passed between 300 (4 m, its furthest) and 400 (5 m).
    expect(ghostGapMs(rewound, 4.5, 350)).toBeCloseTo(0);
  });

  it("is null past where the ghost ever got, or with bad input", () => {
    expect(ghostGapMs(ghost, 11, 1000)).toBeNull();
    expect(ghostGapMs(ghost, Number.NaN, 0)).toBeNull();
  });

  it("measures the gap at a lap from the ghost's lap ends", () => {
    const laps = track([at(0)], { lapEndsMs: [60_000, 115_000] });
    expect(lapGapMs(laps, 1, 62_400)).toBe(2_400);
    expect(lapGapMs(laps, 2, 113_900)).toBe(-1_100);
    expect(lapGapMs(laps, 3, 170_000)).toBeNull();
  });
});

describe("formatGap", () => {
  it.each([
    [2_400, "+0:02.4"],
    [-1_100, "-0:01.1"],
    [0, "+0:00.0"],
    [-40, "+0:00.0"],
    [65_250, "+1:05.3"],
    [-125_000, "-2:05.0"],
  ])("writes %d ms as %s", (ms, text) => {
    expect(formatGap(ms)).toBe(text);
  });
});

describe("the ghost and the run", () => {
  /**
   * Plays a scripted Saturday 5K for `steps`, recording a ghost when asked,
   * and notes the run clock and progress every 150 steps.
   */
  function play(steps: number, record: boolean) {
    let state: GameEngineState = startGame(
      setRules(createInitialState("fenix", 0, []), "fitness"),
      "fenix",
      undefined,
      SATURDAY
    );
    const rec = createGhostRecorder();
    const checks: { clock: number; progress: number }[] = [];
    for (let step = 0; step < steps; step++) {
      if (step % 45 === 0) state = pressJump(state);
      if (step % 45 === 18) state = releaseJump(state);
      state = updateGameSimulation(state, FIXED_STEP_MS);
      if (record) recordGhost(rec, state, isUnderwater(state));
      if (step % 150 === 149 && state.gameState === "playing") {
        checks.push({
          clock: state.runClockMs ?? 0,
          progress: paceMeters(state),
        });
      }
    }
    return { state, rec, checks };
  }

  it("never changes the run it records", () => {
    const plain = play(1500, false).state;
    const recorded = play(1500, true);
    expect(recorded.state).toEqual(plain);
    expect(recorded.rec.samples.length).toBeGreaterThan(100);
  });

  it("replays its own run within one sample of no gap", () => {
    const { state, rec, checks } = play(1500, true);
    const decoded = decodeGhost(
      encodeGhost(finishGhost(rec, [], state.runClockMs ?? 0))
    );
    expect(decoded).not.toBeNull();
    if (!decoded) return;
    // A peak between two samples is past what the ghost holds, so only the
    // moments the samples cover are measured.
    const reach = Math.max(...decoded.samples.map((g) => g.d));
    const covered = checks.filter((c) => c.progress <= reach);
    expect(covered.length).toBeGreaterThanOrEqual(2);
    for (const { clock, progress } of covered) {
      const gap = ghostGapMs(decoded, progress, clock);
      expect(Math.abs(gap ?? Infinity)).toBeLessThanOrEqual(
        GHOST_SAMPLE_MS + 1
      );
    }
  });
});
