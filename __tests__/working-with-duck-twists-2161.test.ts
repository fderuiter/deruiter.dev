// @vitest-environment node
// #2161: each campaign sprint after the first adds one twist, so the five
// sprints play differently.
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  activeCodeBurst,
  CABLE_ALERT_FIRST_TICK,
  createInitialDuckGameState,
  MUD_STORM_FIRST_TICK,
  performTrick,
  sprintTwist,
  SQUIRREL_IGNORED_EXCITEMENT,
  SQUIRREL_IGNORED_GOOD_BOY,
  SQUIRREL_SIT_POINTS,
  STANDUP_BONUS,
  STANDUP_START_TICK,
  STANDUP_TICKS,
  stepDuckGame,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";

/** A calm, running sprint at the given tick, with no impulse due. */
function calm(level: number, ticks = 0): WorkingWithDuckState {
  const base = createInitialDuckGameState(level);
  return {
    ...base,
    status: "running",
    ticks,
    lastImpulseTick: ticks,
    excitement: 0,
    bladder: 0,
    thirst: 0,
    hunger: 0,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Working With Duck sprint twists (#2161)", () => {
  it("gives sprints 2 to 5 one twist each, and none to sprint 1 or endless", () => {
    expect(sprintTwist(calm(1))).toBeNull();
    expect([2, 3, 4, 5].map((level) => sprintTwist(calm(level)))).toEqual([
      "cable-alert",
      "window-watch",
      "mud-storm",
      "standup",
    ]);
    expect(sprintTwist({ ...calm(3), mode: "endless" })).toBeNull();
  });

  it("opens each twist sprint with a banner naming the twist", () => {
    const opened = stepDuckGame(calm(2));
    expect(opened.activeSkillToast?.badge).toBe("Sprint 2 twist");
    expect(opened.activeSkillToast?.text).toContain("Cable Alert");
    expect(stepDuckGame(calm(1)).activeSkillToast).toBeNull();
  });

  it("Cable Alert sends Duck for the power cable on its timer", () => {
    const before = calm(2, CABLE_ALERT_FIRST_TICK - 1);
    const after = stepDuckGame(before);
    expect(after.duck.state).toBe("SNEAKY_CHEW");
    expect(after.activeHazardTarget).toBe("power-cable");

    // Sprint 1 has no timer: the same tick passes quietly.
    const sprintOne = stepDuckGame(calm(1, CABLE_ALERT_FIRST_TICK - 1));
    expect(sprintOne.duck.state).not.toBe("SNEAKY_CHEW");
  });

  it("Window Watch brings a squirrel even while Duck is busy, and Sit pays for it", () => {
    const busy: WorkingWithDuckState = {
      ...calm(3, 479),
      duck: { ...calm(3).duck, state: "DRINKING_WATER", stateTimer: 200 },
    };
    const visited = stepDuckGame(busy);
    expect(visited.activeSurpriseEvent?.type).toBe("squirrel-window");

    const roaming: WorkingWithDuckState = {
      ...visited,
      duck: { ...visited.duck, state: "IDLE_ROAM" },
    };
    const sat = performTrick(roaming, "SIT");
    expect(sat.activeSurpriseEvent).toBeNull();
    expect(sat.totalScore - roaming.totalScore).toBeGreaterThanOrEqual(
      SQUIRREL_SIT_POINTS
    );
  });

  it("Window Watch winds Duck up when a squirrel leaves unanswered", () => {
    const leaving: WorkingWithDuckState = {
      ...calm(3, 100),
      naughtyVsGood: 50,
      activeSurpriseEvent: {
        type: "squirrel-window",
        timer: 1,
        maxTimer: 300,
        resolved: false,
      },
    };
    const after = stepDuckGame(leaving);
    expect(after.activeSurpriseEvent).toBeNull();
    expect(after.excitement).toBeGreaterThanOrEqual(
      SQUIRREL_IGNORED_EXCITEMENT
    );
    expect(after.naughtyVsGood).toBe(50 - SQUIRREL_IGNORED_GOOD_BOY);
  });

  it("Mud Storm muddies Duck on its timer and halves bursts until a bath", () => {
    const stormed = stepDuckGame(calm(4, MUD_STORM_FIRST_TICK - 1));
    expect(stormed.isMuddy).toBe(true);

    const clean = { ...calm(4, 500), multiplier: 1 };
    const muddy = { ...clean, isMuddy: true };
    const cleanGain = activeCodeBurst(clean).workProgress - clean.workProgress;
    const muddyGain = activeCodeBurst(muddy).workProgress - muddy.workProgress;
    expect(muddyGain).toBeCloseTo(cleanGain / 2, 5);
  });

  it("Launch Standup pays its bonus when Duck stays out of trouble", () => {
    const opening = stepDuckGame(calm(5, STANDUP_START_TICK - 1));
    expect(opening.standup).toBe("live");
    expect(opening.activeSkillToast?.badge).toBe("Launch Standup");

    const closing: WorkingWithDuckState = {
      ...calm(5, STANDUP_START_TICK + STANDUP_TICKS - 1),
      standup: "live",
    };
    const after = stepDuckGame(closing);
    expect(after.standup).toBe("passed");
    expect(after.totalScore - closing.totalScore).toBeGreaterThanOrEqual(
      STANDUP_BONUS
    );
  });

  it("Launch Standup fails as soon as Duck gets into trouble", () => {
    const live: WorkingWithDuckState = {
      ...calm(5, STANDUP_START_TICK + 100),
      standup: "live",
      duck: { ...calm(5).duck, state: "ZOOMIES", stateTimer: 200 },
    };
    expect(stepDuckGame(live).standup).toBe("failed");
  });

  it("leaves endless runs without sprint twists", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const endless: WorkingWithDuckState = {
      ...calm(5, STANDUP_START_TICK - 1),
      mode: "endless",
    };
    const after = stepDuckGame(endless);
    expect(after.standup).toBeUndefined();
    expect(after.isMuddy).toBe(false);
  });
});
