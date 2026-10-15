import { fromAny } from "@total-typescript/shoehorn";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MockStorage } from "../vitest.setup";
import {
  GROUND_Y,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  PLAYER_X,
  createInitialState,
  setRules,
  startGame,
  updateGameSimulation,
  type FinisherCard,
  type GameEngineState,
} from "@/lib/garmin-engine";
import { EMPTY_COURSE, PX_PER_METER, stagePoleX } from "@/lib/garmin-course";
import {
  CARD_CYCLE_MS,
  FINISHER_CARDS,
  MATCH_LIVES,
  MIXED_LIVES,
  cardAt,
  cardNews,
  cardPayout,
  cardsOf,
  collectCard,
  isPayoutBanner,
  payoutBanner,
  stepFinisherCard,
} from "@/lib/garmin-finisher";
import {
  PLAN_SEED,
  clearWorkout,
  newPlan,
  type PlanRun,
} from "@/lib/garmin-plan";
import { loadPlan, normalizePlan, savePlan } from "@/lib/garmin-plan-store";
import { MAX_LIVES } from "@/lib/garmin-powerups";
import { makeFoe } from "@/lib/garmin-foes";
import { safeClear } from "@/lib/safe-storage";
import { renderWatchFace } from "@/components/garmin-watch/watch-face-art";

// The Finisher Card match (#1996): the pole's card cycles on the run clock,
// the card shown on the grab is the one kept, and three cards pay out lives.

const FRAME = 1000 / 60;
let clock = 0;

beforeEach(() => {
  clock = 9_600_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** A Training Run on stage `stage`, a frame short of its pole, on a bare lane. */
function atPole(
  overrides: Partial<GameEngineState> = {},
  plan?: PlanRun
): GameEngineState {
  const base = startGame(
    setRules(createInitialState("fenix", 0, []), "fitness"),
    "fenix",
    undefined,
    undefined,
    plan
  );
  const stage = plan?.stage ?? 1;
  return {
    ...base,
    gpsMs: 0,
    obstacles: [],
    foes: [],
    lastObstacleTime: clock + 1e9,
    lastAllocTime: clock + 1e9,
    finisherCards: [],
    distanceMeters:
      (stagePoleX(stage) - PLAYER_X - PLAYER_WIDTH + 4) / PX_PER_METER,
    playerY: GROUND_Y - PLAYER_HEIGHT,
    isGrounded: true,
    course: { ...EMPTY_COURSE, poles: [{ x: stagePoleX(stage), stage }] },
    ...overrides,
  };
}

/** One engine step, then the card step, as the simulator runs them. */
function tick(s: GameEngineState): GameEngineState {
  return stepFinisherCard(s, s.runClockMs, updateGameSimulation(s, FRAME));
}

/** The run clock at which the pole shows `card`. */
const clockFor = (card: FinisherCard, lap = 0) =>
  (FINISHER_CARDS.indexOf(card) + 3 * lap) * CARD_CYCLE_MS + 10;

describe("the card on the pole (#1996)", () => {
  it("cycles Shoe, Bottle and Medal on the run clock", () => {
    expect(cardAt(0)).toBe("shoe");
    expect(cardAt(CARD_CYCLE_MS - 1)).toBe("shoe");
    expect(cardAt(CARD_CYCLE_MS)).toBe("bottle");
    expect(cardAt(2 * CARD_CYCLE_MS)).toBe("medal");
    expect(cardAt(3 * CARD_CYCLE_MS)).toBe("shoe");
  });

  it("is the same card at the same time, every run", () => {
    for (let ms = 0; ms < 10_000; ms += 137) {
      expect(cardAt(ms)).toBe(cardAt(ms));
      expect(cardAt(ms)).toBe(cardAt(ms + 3 * CARD_CYCLE_MS));
    }
  });

  it("reads a missing or broken clock as the start", () => {
    expect(cardAt(undefined)).toBe("shoe");
    expect(cardAt(Number.NaN)).toBe("shoe");
    expect(cardAt(-500)).toBe("shoe");
    expect(cardAt(Number.POSITIVE_INFINITY)).toBe("shoe");
  });
});

describe("collecting and paying out (#1996)", () => {
  it("holds up to two cards, and a third pays the set out", () => {
    const one = collectCard([], "shoe");
    expect(one).toEqual({ cards: ["shoe"], payout: null, set: [] });
    const two = collectCard(one.cards, "medal");
    expect(two.cards).toEqual(["shoe", "medal"]);
    const three = collectCard(two.cards, "bottle");
    expect(three.cards).toEqual([]);
    expect(three.set).toEqual(["shoe", "medal", "bottle"]);
    expect(three.payout).toEqual({ lives: MIXED_LIVES, match: null });
  });

  it("pays three of a kind by card: 2, 3 and 5 lives", () => {
    expect(MATCH_LIVES).toEqual({ shoe: 2, bottle: 3, medal: 5 });
    for (const card of FINISHER_CARDS) {
      expect(cardPayout([card, card, card])).toEqual({
        lives: MATCH_LIVES[card],
        match: card,
      });
    }
    expect(cardPayout(["medal", "medal", "shoe"])).toEqual({
      lives: 1,
      match: null,
    });
    // A set short of three pays nothing yet.
    expect(cardPayout(["medal", "medal"])).toEqual({ lives: 0, match: null });
    expect(cardPayout([])).toEqual({ lives: 0, match: null });
  });

  it("says what the set paid on the banner and to the screen reader", () => {
    expect(payoutBanner({ lives: 5, match: "medal" })).toBe(
      "BADGE EARNED · 3 MEDALS · +5 LIVES"
    );
    expect(payoutBanner({ lives: 1, match: null })).toBe(
      "FINISHER CARDS · +1 LIFE"
    );
    expect(cardNews("shoe", collectCard(["medal"], "shoe"))).toBe(
      "Finisher card: Shoe. Cards held: Medal, Shoe."
    );
    expect(
      cardNews("bottle", collectCard(["bottle", "bottle"], "bottle"))
    ).toBe("Finisher card: Bottle. Three Bottles, badge earned: plus 3 lives.");
    expect(cardNews("shoe", collectCard(["medal", "bottle"], "shoe"))).toBe(
      "Finisher card: Shoe. Three mixed cards: plus 1 life."
    );
  });

  it("reads stored cards back as known cards, fewer than a set", () => {
    expect(cardsOf(["shoe", "medal"])).toEqual(["shoe", "medal"]);
    // The newest two are kept, as collecting keeps them.
    expect(cardsOf(["shoe", "wings", 4, null, "bottle", "medal"])).toEqual([
      "bottle",
      "medal",
    ]);
    expect(cardsOf("shoe")).toEqual([]);
    expect(cardsOf(undefined)).toEqual([]);
  });
});

describe("the card at the finish pole in a run (#1996)", () => {
  it("collects the card the pole showed on the frame before the grab", () => {
    for (const card of FINISHER_CARDS) {
      const grabbed = tick(atPole({ runClockMs: clockFor(card) }));
      expect(grabbed.lapSplits).toHaveLength(1);
      expect(grabbed.finisherCards).toEqual([card]);
      expect(grabbed.finisherNews).toBe(
        `Finisher card: ${card[0].toUpperCase()}${card.slice(1)}. Cards held: ${card[0].toUpperCase()}${card.slice(1)}.`
      );
      expect(grabbed.popups?.some((p) => p.text.startsWith("CARD: "))).toBe(
        true
      );
    }
  });

  it("collects the same card for the same grab, every time", () => {
    const a = tick(atPole({ runClockMs: 5_123 }));
    const b = tick(atPole({ runClockMs: 5_123 }));
    expect(a.finisherCards).toEqual(b.finisherCards);
    expect(a.lives).toBe(b.lives);
  });

  it("pays a set out in lives with a badge, and keeps the lap in a popup", () => {
    const before = atPole({
      runClockMs: clockFor("medal"),
      finisherCards: ["medal", "medal"],
      lives: 3,
    });
    const after = tick(before);
    expect(after.finisherCards).toEqual([]);
    expect(after.lives).toBe(3 + MATCH_LIVES.medal);
    expect(after.banner?.text).toBe("BADGE EARNED · 3 MEDALS · +5 LIVES");
    expect(after.popups?.some((p) => p.text.startsWith("LAP 1"))).toBe(true);

    const mixed = tick({ ...before, finisherCards: ["shoe", "bottle"] });
    expect(mixed.lives).toBe(3 + MIXED_LIVES);
    expect(mixed.banner?.text).toBe("FINISHER CARDS · +1 LIFE");
  });

  it("collects the card on the face last drawn, when a frame runs several steps", () => {
    const s = atPole({ runClockMs: clockFor("medal") });
    const grabbed = stepFinisherCard(
      s,
      clockFor("shoe"),
      updateGameSimulation(s, FRAME)
    );
    expect(grabbed.finisherCards).toEqual(["shoe"]);
  });

  it("moves a secret exit's banner to a popup when a badge takes the banner", () => {
    const s = atPole({ finisherCards: ["shoe", "shoe"] });
    const engine = {
      ...updateGameSimulation(s, FRAME),
      banner: { text: "SECRET EXIT", ttlMs: 2200, tone: "good" as const },
    };
    const after = stepFinisherCard(s, clockFor("shoe"), engine);
    expect(after.banner?.text).toBe("BADGE EARNED · 3 SHOES · +2 LIVES");
    expect(after.popups?.some((p) => p.text === "SECRET EXIT")).toBe(true);
    expect(isPayoutBanner(after.banner?.text)).toBe(true);
    expect(isPayoutBanner("LAP 1 · 0:30.0")).toBe(false);
    expect(isPayoutBanner(null)).toBe(false);
  });

  it("keeps the cards through a lost life", () => {
    const camera = 0;
    const s = atPole({
      distanceMeters: camera,
      finisherCards: ["bottle"],
      lives: 3,
      invulnerableMs: 0,
      starMs: 0,
      power: "base",
      foes: [makeFoe(1, "kettlebell", camera + PLAYER_X + 4, GROUND_Y)],
    });
    let next = s;
    for (let i = 0; i < 30 && (next.lives ?? 3) === 3; i++) next = tick(next);
    expect(next.lives).toBe(2);
    expect(next.finisherCards).toEqual(["bottle"]);
  });

  it("caps lives at the most a run can hold", () => {
    const after = tick(
      atPole({
        runClockMs: clockFor("medal"),
        finisherCards: ["medal", "medal"],
        lives: MAX_LIVES - 1,
      })
    );
    expect(after.lives).toBe(MAX_LIVES);
  });

  it("does nothing away from a pole, or for a run that collects no cards", () => {
    const running = atPole({ distanceMeters: 0, finisherCards: ["shoe"] });
    const moved = tick(running);
    expect(moved.finisherCards).toEqual(["shoe"]);
    expect(moved.finisherNews).toBeUndefined();

    for (const off of [undefined, null]) {
      const raced = tick(atPole({ finisherCards: off }));
      expect(raced.lapSplits).toHaveLength(1);
      expect(raced.finisherCards ?? null).toBeNull();
    }
  });

  it("keeps the cards through the stage clear and on to the next pole", () => {
    let s = tick(atPole({ runClockMs: clockFor("shoe") }));
    expect(s.stage).toBe(2);
    expect(s.finisherCards).toEqual(["shoe"]);
    for (let i = 0; i < 30; i++) s = tick(s);
    expect(s.finisherCards).toEqual(["shoe"]);
  });

  it("collects on a Training Plan workout, which ends at its pole", () => {
    const run: PlanRun = { stage: 2, seed: PLAN_SEED, raceDay: false };
    const done = tick(
      atPole(
        { runClockMs: clockFor("bottle"), finisherCards: ["bottle", "bottle"] },
        run
      )
    );
    expect(done.gameState).toBe("summary");
    expect(done.finisherCards).toEqual([]);
    expect(done.lives).toBe(3 + MATCH_LIVES.bottle);
  });
});

describe("Finisher Cards on the Training Plan (#1996)", () => {
  beforeEach(() => {
    globalThis.localStorage = new MockStorage();
    safeClear();
  });

  it("start a new plan with none", () => {
    expect(newPlan(1).cards).toEqual([]);
  });

  it("come back from a cleared workout, and stay when the run collected none", () => {
    const plan = newPlan(1);
    const result = { lives: 3, score: 100, trainingEffect: null };
    expect(
      clearWorkout(plan, "easy", { ...result, cards: ["medal"] }).cards
    ).toEqual(["medal"]);
    const held = { ...plan, cards: ["shoe" as const] };
    expect(clearWorkout(held, "easy", result).cards).toEqual(["shoe"]);
  });

  it("are saved and read back, and an old save without them reads as none", () => {
    const plan = { ...newPlan(1), cards: ["shoe", "medal"] as FinisherCard[] };
    expect(savePlan(plan)).toBe(true);
    expect(loadPlan()?.cards).toEqual(["shoe", "medal"]);
    const old: Record<string, unknown> = { v: 1, ...newPlan(1) };
    delete old.cards;
    expect(normalizePlan(old)?.cards).toEqual([]);
    expect(
      normalizePlan({ ...old, cards: ["medal", "medal", "medal", "x"] })?.cards
    ).toEqual(["medal", "medal"]);
  });
});

/** A 2D context that records what is drawn: strokes by colour and tiles drawn. */
function recordingContext() {
  const log = { strokeRects: [] as string[], roundRects: 0 };
  const store: Record<string, unknown> = {};
  const ctx = new Proxy(store, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === "measureText")
        return (t: string) => ({ width: t.length * 6 });
      if (prop === "createLinearGradient" || prop === "createRadialGradient") {
        return () => ({ addColorStop: () => {} });
      }
      if (prop === "strokeRect") {
        return () => log.strokeRects.push(String(target.strokeStyle));
      }
      if (prop === "roundRect") return () => (log.roundRects += 1);
      return () => {};
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  });
  return { ctx: fromAny<CanvasRenderingContext2D, typeof ctx>(ctx), log };
}

describe("drawing the cards (#1996)", () => {
  const near = (cards: FinisherCard[] | null) =>
    atPole({
      finisherCards: cards,
      runClockMs: clockFor("bottle"),
      distanceMeters: (stagePoleX(1) - PLAYER_X - 90) / PX_PER_METER,
    });

  it("shows a still column with the card on offer outlined under reduced motion", () => {
    const moving = recordingContext();
    renderWatchFace(moving.ctx, near([]));
    const still = recordingContext();
    renderWatchFace(still.ctx, near([]), undefined, { reducedMotion: true });
    // One amber outline marks the card on offer; three tiles stand still.
    expect(still.log.strokeRects.filter((c) => c === "#f59e0b")).toHaveLength(
      1
    );
    expect(moving.log.strokeRects.filter((c) => c === "#f59e0b")).toHaveLength(
      0
    );
    expect(still.log.roundRects - moving.log.roundRects).toBe(2);
  });

  it("draws the held cards' slots only on a run that collects cards", () => {
    const off = recordingContext();
    renderWatchFace(off.ctx, near(null));
    const on = recordingContext();
    renderWatchFace(on.ctx, near(["shoe"]));
    // The pole's card and one held card are tiles; two slots are outlines.
    expect(on.log.roundRects - off.log.roundRects).toBe(2);
    expect(on.log.strokeRects.length - off.log.strokeRects.length).toBe(2);
  });
});
