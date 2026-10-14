import { describe, it, expect } from "vitest";
import {
  HILL_SPEED_SWING,
  HILL_WAVELENGTH,
  SECOND_WIND_EVENTS,
  SECOND_WIND_KINDS,
  SECOND_WIND_MS,
  TAPER_GRAVITY_SCALE,
  hillSpeedScale,
  hillTilt,
  startSecondWind,
  stepSecondWind,
  windGravityScale,
  type SecondWind,
  type SecondWindTick,
} from "@/lib/garmin-second-wind";

// The pure Second Wind timing and scoring (#2026): each event's goal, its
// timer, the gravity and hill scales the engine reads, and the guards.

/** A tick of `deltaMs` with nothing else happening. */
function tick(extra: Partial<SecondWindTick> = {}): SecondWindTick {
  return { deltaMs: 0, metres: 0, kudos: 0, highFives: 0, hits: 0, ...extra };
}

/** Steps `wind` through `ticks` in turn, stopping once it has ended. */
function play(
  wind: SecondWind,
  ticks: SecondWindTick[]
): { wind: SecondWind | null; goalMets: number; ended: boolean } {
  let current: SecondWind | null = wind;
  let goalMets = 0;
  let ended = false;
  for (const t of ticks) {
    if (!current) break;
    const r = stepSecondWind(current, t);
    if (r.goalMet) goalMets += 1;
    current = r.wind;
    if (r.ended) ended = true;
  }
  return { wind: current, goalMets, ended };
}

describe("startSecondWind", () => {
  it("starts with the full timer, no progress and no goal met", () => {
    const w = startSecondWind("taper", 3);
    expect(w).toEqual({
      kind: "taper",
      msLeft: SECOND_WIND_MS,
      progress: 0,
      cleared: false,
      stage: 3,
    });
  });

  it("carries the medal it pays out only when one is given", () => {
    expect(startSecondWind("hills", 1, 12).medalId).toBe(12);
    expect(startSecondWind("hills", 1).medalId).toBeUndefined();
    expect("medalId" in startSecondWind("hills", 1)).toBe(false);
  });

  it("names and words each of the four events", () => {
    expect(SECOND_WIND_KINDS).toEqual(["hills", "taper", "funrun", "night"]);
    for (const kind of SECOND_WIND_KINDS) {
      expect(SECOND_WIND_EVENTS[kind].name.length).toBeGreaterThan(0);
      expect(SECOND_WIND_EVENTS[kind].goalText.length).toBeGreaterThan(0);
    }
    expect(SECOND_WIND_EVENTS.night.goal).toBe(0);
  });
});

describe("stepSecondWind: the timer", () => {
  it("counts down and stays on until the time is up", () => {
    const first = stepSecondWind(
      startSecondWind("taper", 1),
      tick({ deltaMs: 1000 })
    );
    expect(first.ended).toBe(false);
    expect(first.wind?.msLeft).toBe(SECOND_WIND_MS - 1000);
    const almost = stepSecondWind(
      startSecondWind("taper", 1),
      tick({ deltaMs: SECOND_WIND_MS - 1 })
    );
    expect(almost.ended).toBe(false);
    expect(almost.wind?.msLeft).toBe(1);
  });

  it("ends on the tick its time runs out, returning no event", () => {
    const r = stepSecondWind(
      startSecondWind("hills", 1),
      tick({ deltaMs: SECOND_WIND_MS })
    );
    expect(r.ended).toBe(true);
    expect(r.wind).toBeNull();
  });

  it("runs a full event in whole frames and ends at the fifteenth second", () => {
    const frame = 1000 / 60;
    const frames = Math.ceil(SECOND_WIND_MS / frame);
    const ticks = Array.from({ length: frames }, () =>
      tick({ deltaMs: frame })
    );
    const out = play(startSecondWind("funrun", 1), ticks);
    expect(out.ended).toBe(true);
    expect(out.wind).toBeNull();
  });

  it("ignores a negative or NaN tick and never ends on one", () => {
    const back = stepSecondWind(
      startSecondWind("taper", 1),
      tick({ deltaMs: -500 })
    );
    expect(back.wind?.msLeft).toBe(SECOND_WIND_MS);
    const nan = stepSecondWind(
      startSecondWind("taper", 1),
      tick({ deltaMs: Number.NaN })
    );
    expect(nan.ended).toBe(false);
    expect(nan.wind?.msLeft).toBe(SECOND_WIND_MS);
  });
});

describe("stepSecondWind: Hill Repeats goal", () => {
  it("counts metres run and is met at the goal, once", () => {
    const goal = SECOND_WIND_EVENTS.hills.goal;
    const short = stepSecondWind(
      startSecondWind("hills", 1),
      tick({ metres: goal - 1 })
    );
    expect(short.goalMet).toBe(false);
    expect(short.wind?.progress).toBe(goal - 1);
    const met = stepSecondWind(short.wind!, tick({ metres: 1 }));
    expect(met.goalMet).toBe(true);
    expect(met.wind?.cleared).toBe(true);
    const more = stepSecondWind(met.wind!, tick({ metres: 10 }));
    expect(more.goalMet).toBe(false);
  });

  it("ignores negative metres (a step back is no progress)", () => {
    const r = stepSecondWind(
      startSecondWind("hills", 1),
      tick({ metres: -30 })
    );
    expect(r.wind?.progress).toBe(0);
  });

  it("does not count Kudos or high fives", () => {
    const r = stepSecondWind(
      startSecondWind("hills", 1),
      tick({ kudos: 5, highFives: 5 })
    );
    expect(r.wind?.progress).toBe(0);
  });
});

describe("stepSecondWind: Taper Week goal", () => {
  it("counts Kudos and is met at 8, once", () => {
    const goal = SECOND_WIND_EVENTS.taper.goal;
    const out = play(
      startSecondWind("taper", 1),
      Array.from({ length: goal }, () => tick({ kudos: 1 }))
    );
    expect(out.goalMets).toBe(1);
    expect(out.wind?.cleared).toBe(true);
  });

  it("does not count metres or high fives", () => {
    const r = stepSecondWind(
      startSecondWind("taper", 1),
      tick({ metres: 50, highFives: 4 })
    );
    expect(r.wind?.progress).toBe(0);
  });
});

describe("stepSecondWind: Fun Run goal", () => {
  it("counts high fives and is met at 3, once", () => {
    const goal = SECOND_WIND_EVENTS.funrun.goal;
    const out = play(
      startSecondWind("funrun", 1),
      Array.from({ length: goal + 2 }, () => tick({ highFives: 1 }))
    );
    expect(out.goalMets).toBe(1);
    expect(out.wind?.cleared).toBe(true);
  });

  it("does not count Kudos as high fives", () => {
    const r = stepSecondWind(startSecondWind("funrun", 1), tick({ kudos: 9 }));
    expect(r.wind?.progress).toBe(0);
  });
});

describe("stepSecondWind: Night Run goal", () => {
  it("counts hits, and is settled only when the time runs out", () => {
    const quiet = play(startSecondWind("night", 1), [
      tick({ deltaMs: 5000 }),
      tick({ deltaMs: 5000 }),
    ]);
    expect(quiet.goalMets).toBe(0);
    expect(quiet.wind?.cleared).toBe(false);
    const last = play(quiet.wind!, [tick({ deltaMs: 5000 })]);
    expect(last.ended).toBe(true);
    expect(last.goalMets).toBe(1);
  });

  it("is not met once a hit lands, even if the time runs out clean after it", () => {
    const hit = stepSecondWind(startSecondWind("night", 1), tick({ hits: 1 }));
    expect(hit.goalMet).toBe(false);
    expect(hit.wind?.progress).toBe(1);
    const out = play(hit.wind!, [tick({ deltaMs: SECOND_WIND_MS })]);
    expect(out.ended).toBe(true);
    expect(out.goalMets).toBe(0);
  });

  it("does not count Kudos or high fives as hits", () => {
    const r = stepSecondWind(
      startSecondWind("night", 1),
      tick({ kudos: 3, highFives: 3 })
    );
    expect(r.wind?.progress).toBe(0);
  });
});

describe("stepSecondWind: guards", () => {
  it("never treats a NaN gain as progress", () => {
    const r = stepSecondWind(
      startSecondWind("hills", 1),
      tick({ metres: Number.NaN })
    );
    expect(r.wind?.progress).toBe(0);
  });

  it("keeps the event's stage and medal through each step", () => {
    const w = startSecondWind("taper", 4, 42);
    const next = stepSecondWind(w, tick({ deltaMs: 100 })).wind!;
    expect(next.stage).toBe(4);
    expect(next.medalId).toBe(42);
    expect(next.kind).toBe("taper");
  });
});

describe("windGravityScale", () => {
  it("eases gravity only under Taper Week", () => {
    expect(windGravityScale(startSecondWind("taper", 1))).toBe(
      TAPER_GRAVITY_SCALE
    );
    expect(TAPER_GRAVITY_SCALE).toBeLessThan(1);
    for (const kind of ["hills", "funrun", "night"] as const) {
      expect(windGravityScale(startSecondWind(kind, 1))).toBe(1);
    }
  });

  it("is normal with no event", () => {
    expect(windGravityScale(null)).toBe(1);
    expect(windGravityScale(undefined)).toBe(1);
  });
});

describe("hillSpeedScale and hillTilt", () => {
  const hills = startSecondWind("hills", 1);

  it("is normal for every other event and with no event", () => {
    for (const kind of ["taper", "funrun", "night"] as const) {
      expect(hillSpeedScale(startSecondWind(kind, 1), 300)).toBe(1);
      expect(hillTilt(startSecondWind(kind, 1), 300)).toBe(0);
    }
    expect(hillSpeedScale(null, 300)).toBe(1);
    expect(hillTilt(undefined, 300)).toBe(0);
  });

  it("is normal at a non-finite x", () => {
    expect(hillSpeedScale(hills, Number.NaN)).toBe(1);
    expect(hillSpeedScale(hills, Number.POSITIVE_INFINITY)).toBe(1);
    expect(hillTilt(hills, Number.NaN)).toBe(0);
  });

  it("slows the climb and quickens the descent, within the swing", () => {
    const climb = hillSpeedScale(hills, HILL_WAVELENGTH / 4);
    const descent = hillSpeedScale(hills, (3 * HILL_WAVELENGTH) / 4);
    expect(climb).toBeCloseTo(1 - HILL_SPEED_SWING);
    expect(descent).toBeCloseTo(1 + HILL_SPEED_SWING);
    expect(hillSpeedScale(hills, 0)).toBeCloseTo(1);
  });

  it("stays inside the swing and repeats every wavelength", () => {
    for (let x = 0; x < HILL_WAVELENGTH * 3; x += 7) {
      const s = hillSpeedScale(hills, x);
      expect(s).toBeGreaterThanOrEqual(1 - HILL_SPEED_SWING - 1e-9);
      expect(s).toBeLessThanOrEqual(1 + HILL_SPEED_SWING + 1e-9);
      expect(hillSpeedScale(hills, x + HILL_WAVELENGTH)).toBeCloseTo(s);
    }
  });

  it("tilts the lane within 0.08 radians, lifting the lane ahead on a climb", () => {
    for (let x = 0; x < HILL_WAVELENGTH * 2; x += 5) {
      expect(Math.abs(hillTilt(hills, x))).toBeLessThanOrEqual(0.08 + 1e-9);
    }
    expect(hillTilt(hills, HILL_WAVELENGTH / 4)).toBeCloseTo(-0.08);
    expect(hillTilt(hills, (3 * HILL_WAVELENGTH) / 4)).toBeCloseTo(0.08);
  });
});
