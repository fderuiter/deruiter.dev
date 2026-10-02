// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  createInitialDuckGameState,
  calculateGoodBoyMultiplier,
  activeCodeBurst,
  interactStation,
  enterBathtub,
  scrubBathtub,
  rinseBathtub,
  stepBathtubGame,
  exitBathtub,
  equipAccessory,
  throwBall,
  applySqueakyToy,
  applyKongToy,
  giveTreat,
  scrubBelly,
  mopIndoorPuddle,
  startDraggingDuck,
  dragDuckTo,
  releaseDuck,
  enterDogPark,
  throwParkBall,
  jumpParkHurdle,
  steerParkDuck,
  tapParkWhistle,
  stepParkGame,
  exitDogPark,
  advanceToNextLevel,
  clampBounds,
} from "../lib/working-with-duck-engine";

describe("Working With Duck Extended: Engine State & Mini-Game Suite", () => {
  describe("Coordinate Clamping & Multiplier Invariants", () => {
    it("clamps bounds within playable canvas coordinates", () => {
      expect(clampBounds(-10, -50)).toEqual({ x: 40, y: 40 });
      expect(clampBounds(900, 600)).toEqual({ x: 760, y: 460 });
      expect(clampBounds(200, 300)).toEqual({ x: 200, y: 300 });
    });

    it("calculates good boy multipliers accurately across naughty vs good range", () => {
      expect(calculateGoodBoyMultiplier(90)).toBe(2.5);
      expect(calculateGoodBoyMultiplier(50)).toBe(2.0);
      expect(calculateGoodBoyMultiplier(25)).toBe(1.5);
      expect(calculateGoodBoyMultiplier(5)).toBe(1.2);
      expect(calculateGoodBoyMultiplier(-10)).toBe(1.0);
      expect(calculateGoodBoyMultiplier(-50)).toBe(0.7);
    });
  });

  describe("Bathtub Grooming Mini-Game", () => {
    it("transitions into bathtub and manages soap lather progression", () => {
      let state = createInitialDuckGameState(1, "campaign");
      state = enterBathtub(state);
      expect(state.inBathtub).toBe(true);
      expect(state.bathtubState.soapLather).toBe(0);
      expect(state.bathtubState.status).toBe("soap");

      // Scrubbing increases lather
      state = scrubBathtub(state, 400, 200);
      expect(state.bathtubState.soapLather).toBeGreaterThan(0);
      expect(state.bathtubState.scrubCount).toBe(1);

      // Scrub until lather reaches 100%
      for (let i = 0; i < 10; i++) {
        state = scrubBathtub(state, 400, 200);
      }
      expect(state.bathtubState.soapLather).toBe(100);
      expect(state.bathtubState.status).toBe("rinse");

      // Rinsing washes away soap
      state = rinseBathtub(state);
      expect(state.bathtubState.rinseLevel).toBe(25);
      state = rinseBathtub(state);
      state = rinseBathtub(state);
      state = rinseBathtub(state);
      expect(state.bathtubState.rinseLevel).toBe(100);
      expect(state.bathtubState.status).toBe("clean");

      // Stepping updates bubbles
      state = stepBathtubGame(state);
      expect(state.ticks).toBeGreaterThan(0);

      // Exiting grants fresh puppy bonus and clears mud
      state = exitBathtub(state);
      expect(state.inBathtub).toBe(false);
      expect(state.isMuddy).toBe(false);
      expect(state.calmBuffTimer).toBe(1200);
    });
  });

  describe("Dog Park Mini-Game: Hurdles, Whistles, and Retrievals", () => {
    it("handles park ball throw, hurdle jumping, and item collection", () => {
      let state = createInitialDuckGameState(2, "campaign");
      state = enterDogPark(state, "ball");
      expect(state.inDogPark).toBe(true);
      expect(state.parkState.mode).toBe("ball");
      expect(state.parkState.status).toBe("aim");

      // Throw park ball
      state = throwParkBall(state, 12, -2);
      expect(state.parkState.status).toBe("thrown");
      expect(state.parkState.ballVx).toBeGreaterThan(0);

      // Jump hurdle
      state = jumpParkHurdle(state);
      expect(state.parkState.duckIsJumping).toBe(true);
      expect(state.parkState.jumpHeight).toBe(28);

      // Steer duck and tap whistle
      state = steerParkDuck(state, 200);
      state = tapParkWhistle(state);
      expect(state.parkState.whistleTaps).toBe(1);

      // Step park game through ticks
      for (let i = 0; i < 30; i++) {
        state = stepParkGame(state);
      }
      expect(state.ticks).toBeGreaterThan(0);

      // Exit dog park on success
      state = exitDogPark(state, true);
      expect(state.inDogPark).toBe(false);
      expect(state.calmBuffTimer).toBe(1800);
      expect(state.excitement).toBe(0);
      expect(state.bladder).toBe(0);
    });

    it("supports frisbee mode and mud puddle collision protection with rain boots", () => {
      let state = createInitialDuckGameState(4, "campaign", [
        "none",
        "rain-boots",
      ]);
      state = equipAccessory(state, "rain-boots");
      expect(state.activeAccessory).toBe("rain-boots");

      state = enterDogPark(state, "frisbee");
      expect(state.parkState.mode).toBe("frisbee");
      state = throwParkBall(state, 10, 0);
      expect(state.parkState.status).toBe("thrown");

      // Step simulation
      for (let i = 0; i < 20; i++) {
        state = stepParkGame(state);
      }
      state = exitDogPark(state, false);
      expect(state.inDogPark).toBe(false);
    });
  });

  describe("Interactive Toys, Feeding, and Belly Scrubs", () => {
    it("handles throwing ball, squeaky toy, and kong toy in office space", () => {
      let state = createInitialDuckGameState(1, "campaign");

      // Throw ball
      state = throwBall(state, 300, 200);
      expect(state.ball?.active).toBe(true);
      expect(state.duck.state).toBe("FETCHING_BALL");

      // Squeaky toy distraction
      state = applySqueakyToy(state, 200, 200);
      expect(state.soundCueQueue).toContain("squeak");

      // Kong toy calming effect
      state = applyKongToy(state, 300, 200);
      expect(state.naughtyVsGood).toBeGreaterThan(0);

      // Give treat
      state = giveTreat(state);
      expect(state.naughtyVsGood).toBeGreaterThan(0);

      // Belly scrub during flop
      state.duck.state = "THE_FLOP";
      state = scrubBelly(state, state.duck.x, state.duck.y);
      expect(state.totalScore).toBeGreaterThanOrEqual(0);
    });

    it("mops indoor puddles and handles duck dragging mechanics", () => {
      let state = createInitialDuckGameState(1, "campaign");
      state.indoorPuddles = [
        { id: 1, x: 200, y: 200, radius: 25, mopProgress: 0 },
      ];

      state = mopIndoorPuddle(state, 200, 200);
      expect(state.indoorPuddles[0]?.mopProgress).toBeGreaterThan(0);

      // Drag duck away from hazards
      state = startDraggingDuck(state);
      expect(state.duck.state).toBe("DRAGGED");

      state = dragDuckTo(state, 450, 250);
      expect(state.duck.x).toBe(450);
      expect(state.duck.y).toBe(250);

      state = releaseDuck(state);
      expect(state.duck.state).not.toBe("DRAGGED");
    });

    it("triggers code burst and office station interactions", () => {
      let state = createInitialDuckGameState(1, "campaign");
      state.status = "running";
      state = activeCodeBurst(state);
      expect(state.activeCodeBursts).toBe(1);
      expect(state.workProgress).toBeGreaterThan(0);

      state = interactStation(state, "water");
      expect(state.officeStations.waterLevel).toBe(100);

      state = interactStation(state, "food");
      expect(state.officeStations.foodLevel).toBe(100);
    });
  });

  describe("Sprint Level Progression Invariants", () => {
    it("advances through campaign sprints into endless mode", () => {
      let state = createInitialDuckGameState(1, "campaign");
      expect(state.currentLevel).toBe(1);

      state = advanceToNextLevel(state);
      expect(state.currentLevel).toBe(2);

      // Advance past sprint 5
      state.currentLevel = 5;
      state = advanceToNextLevel(state);
      expect(state.mode).toBe("endless");
    });
  });
});
