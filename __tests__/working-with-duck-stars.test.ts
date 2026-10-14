// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  DUCK_FACT_STAR_MILESTONES,
  advanceToNextLevel,
  computeSprintStars,
  createInitialDuckGameState,
  equipAccessory,
  factsUnlockedByStars,
  stepDuckGame,
  totalBestStars,
  type DuckAccessory,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";

/** A running sprint one tick from its finish line. */
function nearFinish(
  level: number,
  overrides: Partial<WorkingWithDuckState> = {}
): WorkingWithDuckState {
  const base = createInitialDuckGameState(level);
  return {
    ...base,
    status: "running",
    workProgress: base.targetWorkProgress - 0.0001,
    naughtyVsGood: 60,
    ...overrides,
  };
}

function finish(state: WorkingWithDuckState): WorkingWithDuckState {
  const next = stepDuckGame(state);
  expect(next.status).toBe("won");
  return next;
}

describe("Working With Duck sprint stars (#2050)", () => {
  it("awards all three stars for a clean, well-behaved sprint", () => {
    const won = finish(nearFinish(1));
    expect(won.sprintStars).toEqual({
      propsSaved: true,
      noAccidents: true,
      goodBoy: true,
      goodBoyAtFinish: 60,
      count: 3,
    });
    expect(won.bestStars[1]).toBe(3);
  });

  it("withholds the props star when anything was chewed", () => {
    const base = nearFinish(1);
    const hazards = base.hazards.map((h, i) =>
      i === 0 ? { ...h, isChewed: true } : h
    );
    const stars = finish({ ...base, hazards }).sprintStars;
    expect(stars?.propsSaved).toBe(false);
    expect(stars?.count).toBe(2);
  });

  it("withholds the accident star once Duck has had an accident, even if mopped", () => {
    const stars = finish(nearFinish(1, { sprintAccidents: 1 })).sprintStars;
    expect(stars?.noAccidents).toBe(false);
    expect(stars?.count).toBe(2);
  });

  it("judges Good Boy before the nap bonus, and needs strictly above 50", () => {
    const at50 = finish(nearFinish(1, { naughtyVsGood: 50 }));
    expect(at50.sprintStars?.goodBoy).toBe(false);
    expect(at50.sprintStars?.goodBoyAtFinish).toBe(50);
    // The win adds +40, so the scale reads 90 afterwards.
    expect(at50.naughtyVsGood).toBe(90);

    const above = computeSprintStars(nearFinish(1, { naughtyVsGood: 50.5 }));
    expect(above.goodBoy).toBe(true);
  });

  it("counts an accident when a potty countdown runs out indoors", () => {
    const base = createInitialDuckGameState(1);
    const state: WorkingWithDuckState = {
      ...base,
      status: "running",
      duck: { ...base.duck, state: "SNIFFING_POTTY", sniffCountdown: 1 },
    };
    const next = stepDuckGame(state);
    expect(next.indoorPuddles).toHaveLength(1);
    expect(next.sprintAccidents).toBe(1);
  });

  it("keeps the best star count per sprint rather than the latest", () => {
    const first = finish(nearFinish(2));
    expect(first.bestStars[2]).toBe(3);
    const replay = createInitialDuckGameState(
      2,
      "campaign",
      first.unlockedAccessories,
      first.unlockedFacts,
      first.bestStars
    );
    const worse = finish({
      ...replay,
      status: "running",
      workProgress: replay.targetWorkProgress - 0.0001,
      naughtyVsGood: 0,
    });
    expect(worse.sprintStars?.count).toBe(2);
    expect(worse.bestStars[2]).toBe(3);
  });

  it("carries best stars and the equipped accessory into the next sprint", () => {
    const won = finish(nearFinish(2));
    const equipped = equipAccessory(won, "bowtie");
    const next = advanceToNextLevel(equipped);
    expect(next.currentLevel).toBe(3);
    expect(next.bestStars[2]).toBe(3);
    expect(next.activeAccessory).toBe("bowtie");
    expect(next.sprintAccidents).toBe(0);
    expect(next.sprintStars).toBeNull();
  });

  it("sums best stars over the five sprints, clamped to three each", () => {
    expect(totalBestStars({})).toBe(0);
    expect(totalBestStars({ 1: 3, 2: 2, 5: 1 })).toBe(6);
    expect(totalBestStars({ 1: 9, 6: 3, 2: -1, 3: Number.NaN })).toBe(3);
  });
});

describe("Working With Duck facts 6-10 unlock from star milestones (#2050)", () => {
  it("regression: facts 6-10 are reachable (they keyed off currentLevel, which stops at 5)", () => {
    // Fifteen stars, one perfect run of each sprint.
    const best = { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 };
    const state = createInitialDuckGameState(
      1,
      "campaign",
      undefined,
      [1],
      best
    );
    for (const id of [6, 7, 8, 9, 10]) {
      expect(state.unlockedFacts).toContain(id);
    }
  });

  it("unlocks each fact at its milestone and not before", () => {
    expect(DUCK_FACT_STAR_MILESTONES).toEqual({
      6: 5,
      7: 8,
      8: 11,
      9: 13,
      10: 15,
    });
    expect(factsUnlockedByStars(4)).toEqual([]);
    expect(factsUnlockedByStars(5)).toEqual([6]);
    expect(factsUnlockedByStars(10)).toEqual([6, 7]);
    expect(factsUnlockedByStars(13)).toEqual([6, 7, 8, 9]);
    expect(factsUnlockedByStars(15)).toEqual([6, 7, 8, 9, 10]);
  });

  it("unlocks a milestone fact on the win that crosses it and shows it on the card", () => {
    // Four stars banked; a three-star sprint 3 crosses the five-star milestone.
    const base = createInitialDuckGameState(3, "campaign", undefined, [1, 2], {
      1: 2,
      2: 2,
    });
    expect(base.unlockedFacts).not.toContain(6);
    const won = finish({
      ...base,
      status: "running",
      workProgress: base.targetWorkProgress - 0.0001,
      naughtyVsGood: 60,
    });
    expect(won.unlockedFacts).toEqual(expect.arrayContaining([1, 2, 3, 6]));
    expect(won.latestUnlockedFact?.id).toBe(6);
  });

  it("keeps facts 1-5 on their sprint clears", () => {
    const won = finish(nearFinish(4, { naughtyVsGood: 0 }));
    expect(won.unlockedFacts).toContain(4);
    expect(won.latestUnlockedFact?.id).toBe(4);
  });
});

describe("Working With Duck Golden Graduation hat and accessory perks (#2050)", () => {
  it("awards the Golden Graduation hat for clearing sprint 5", () => {
    const before = createInitialDuckGameState(5);
    expect(before.unlockedAccessories).not.toContain("graduation-hat");
    const won = finish(nearFinish(5));
    expect(won.unlockedAccessories).toContain("graduation-hat");
    expect(equipAccessory(won, "graduation-hat").activeAccessory).toBe(
      "graduation-hat"
    );
    // It survives the move into endless mode.
    expect(advanceToNextLevel(won).unlockedAccessories).toContain(
      "graduation-hat"
    );
  });

  it("does not award the hat for earlier sprints", () => {
    expect(finish(nearFinish(4)).unlockedAccessories).not.toContain(
      "graduation-hat"
    );
  });

  function oneTick(accessory: DuckAccessory, level = 3) {
    const base = createInitialDuckGameState(level, "campaign", [
      "none",
      "bucket-hat",
      "bowtie",
      "bandana",
      "rain-boots",
      "graduation-hat",
    ]);
    return stepDuckGame({
      ...base,
      status: "running",
      activeAccessory: accessory,
    });
  }

  it("bandana slows excitement and leaves bladder alone", () => {
    const plain = oneTick("none");
    const bandana = oneTick("bandana");
    expect(bandana.excitement).toBeLessThan(plain.excitement);
    expect(bandana.bladder).toBe(plain.bladder);
  });

  it("bucket hat slows thirst and leaves bladder alone", () => {
    const plain = oneTick("none");
    const hat = oneTick("bucket-hat");
    expect(hat.thirst).toBeLessThan(plain.thirst);
    expect(hat.bladder).toBe(plain.bladder);
  });

  it("graduation hat halves the Good Boy drain from an unhandled emergency", () => {
    const run = (accessory: DuckAccessory) => {
      const base = createInitialDuckGameState(3, "campaign", [
        "graduation-hat",
      ]);
      return stepDuckGame({
        ...base,
        status: "running",
        activeAccessory: accessory,
        naughtyVsGood: 10,
        duck: { ...base.duck, state: "ZOOMIES", stateTimer: 100, vx: 1, vy: 1 },
      }).naughtyVsGood;
    };
    const plainDrain = 10 - run("none");
    const hatDrain = 10 - run("graduation-hat");
    expect(plainDrain).toBeGreaterThan(0);
    expect(hatDrain).toBeCloseTo(plainDrain / 2, 6);
  });

  it("bowtie keeps its +0.2 multiplier", () => {
    expect(
      oneTick("bowtie").multiplier - oneTick("none").multiplier
    ).toBeCloseTo(0.2, 6);
  });
});
