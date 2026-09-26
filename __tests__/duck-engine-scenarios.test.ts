import { describe, it, expect } from "vitest";
import {
  createInitialDuckGameState,
  stepDuckGame,
  performTrick,
  enterBathtub,
  scrubBathtub,
  rinseBathtub,
  exitBathtub,
  enterDogPark,
  throwParkBall,
  exitDogPark,
  equipAccessory,
} from "@/lib/working-with-duck-engine";

describe("Working With Duck Engine: Deterministic Scenario Replay Suite", () => {
  describe("Puppy Training Tricks State Machine", () => {
    it("executes DROP_IT trick to intercept a SNEAKY_CHEW emergency and rewards bonus points", () => {
      let state = createInitialDuckGameState(1, "campaign");
      state.status = "running";
      state.duck.state = "SNEAKY_CHEW";
      state.naughtyVsGood = 0;

      state = performTrick(state, "DROP_IT");

      expect(state.duck.state).toBe("PERFORMING_TRICK");
      expect(state.naughtyVsGood).toBe(35);
      expect(state.totalScore).toBe(75);
      expect(state.comboStreak).toBe(1);
      expect(state.soundCueQueue).toContain("ding");
    });

    it("executes DROP_IT trick when duck is carrying a ball or playing NO_TAKE_THROW", () => {
      let state = createInitialDuckGameState(1, "campaign");
      state.status = "running";
      state.duck.state = "NO_TAKE_THROW";
      state.duck.isCarryingBall = true;
      state.naughtyVsGood = 0;

      state = performTrick(state, "DROP_IT");

      expect(state.duck.state).toBe("PERFORMING_TRICK");
      expect(state.naughtyVsGood).toBe(30);
      expect(state.totalScore).toBe(60);
    });

    it("executes HIGH_FIVE trick to lower excitement and increase good boy score", () => {
      let state = createInitialDuckGameState(1, "campaign");
      state.status = "running";
      state.excitement = 50;
      state.naughtyVsGood = 10;

      state = performTrick(state, "HIGH_FIVE");

      expect(state.duck.state).toBe("PERFORMING_TRICK");
      expect(state.excitement).toBe(35); // -15
      expect(state.naughtyVsGood).toBe(30); // +20
      expect(state.soundCueQueue).toContain("paw-clap");
    });

    it("executes SIT trick to calm high excitement", () => {
      let state = createInitialDuckGameState(1, "campaign");
      state.status = "running";
      state.excitement = 80;

      state = performTrick(state, "SIT");

      expect(state.duck.state).toBe("PERFORMING_TRICK");
      expect(state.excitement).toBe(60); // -20
      expect(state.soundCueQueue).toContain("ding");
    });

    it("executes SPIN trick and increments combo streak", () => {
      let state = createInitialDuckGameState(1, "campaign");
      state.status = "running";

      state = performTrick(state, "SPIN");
      expect(state.duck.state).toBe("PERFORMING_TRICK");
      expect(state.comboStreak).toBe(1);
      expect(state.soundCueQueue).toContain("spin-whoosh");

      // Immediate second trick increases combo multiplier
      state = performTrick(state, "HIGH_FIVE");
      expect(state.comboStreak).toBe(2);
      expect(state.totalScore).toBe(50 + 45 * 2); // 140
    });

    it("ignores trick commands when duck is napping, in bathtub, dragged, or at the park", () => {
      const state = createInitialDuckGameState(1, "campaign");

      state.duck.state = "NAP_TIME";
      expect(performTrick(state, "SIT")).toBe(state);

      state.duck.state = "DRAGGED";
      expect(performTrick(state, "SIT")).toBe(state);

      state.duck.state = "IDLE_ROAM";
      state.inBathtub = true;
      expect(performTrick(state, "SIT")).toBe(state);

      state.inBathtub = false;
      state.inDogPark = true;
      expect(performTrick(state, "SIT")).toBe(state);
    });
  });

  describe("Multi-Tick Game Step Simulation & Meter Evolution", () => {
    it("returns unmodified state when status is paused or finished", () => {
      const state = createInitialDuckGameState(1, "campaign");
      state.status = "paused";
      expect(stepDuckGame(state)).toBe(state);
    });

    it("fails the game when naughtyVsGood drops to -90 or lower", () => {
      let state = createInitialDuckGameState(1, "campaign");
      state.status = "running";
      state.naughtyVsGood = -95;

      state = stepDuckGame(state);
      expect(state.status).toBe("failed");
      expect(state.soundCueQueue).toContain("fail");
    });

    it("advances work progress and triggers victory when target work is reached", () => {
      let state = createInitialDuckGameState(1, "campaign");
      state.status = "running";
      state.workProgress = state.targetWorkProgress - 0.01;

      state = stepDuckGame(state);
      expect(state.status).toBe("won");
      expect(state.duck.state).toBe("NAP_TIME");
      expect(state.soundCueQueue).toContain("snore");
    });

    it("automatically navigates to water station when thirst exceeds 85", () => {
      let state = createInitialDuckGameState(1, "campaign");
      state.status = "running";
      state.thirst = 90;
      state.duck.state = "IDLE_ROAM";
      state.officeStations.waterLevel = 50;

      state = stepDuckGame(state);
      expect(state.duck.state).toBe("DRINKING_WATER");
    });

    it("automatically navigates to food bowl when hunger exceeds 85", () => {
      let state = createInitialDuckGameState(1, "campaign");
      state.status = "running";
      state.hunger = 90;
      state.thirst = 10;
      state.duck.state = "IDLE_ROAM";
      state.officeStations.foodLevel = 50;

      state = stepDuckGame(state);
      expect(state.duck.state).toBe("EATING_KIBBLE");
    });

    it("applies Bowtie accessory work multiplier bonus during active coding", () => {
      const stateWithout = createInitialDuckGameState(1, "campaign", [
        "none",
        "bowtie",
      ]);
      stateWithout.status = "running";
      const step1 = stepDuckGame(stateWithout);

      let stateWith = createInitialDuckGameState(1, "campaign", [
        "none",
        "bowtie",
      ]);
      stateWith = equipAccessory(stateWith, "bowtie");
      stateWith.status = "running";
      const step2 = stepDuckGame(stateWith);

      expect(step2.workProgress).toBeGreaterThan(step1.workProgress);
    });
  });

  describe("Interactive Mini-Game Chaining", () => {
    it("simulates full Dog Park sequence from entry to hurdle clear, retrieval and exit", () => {
      let state = createInitialDuckGameState(2, "campaign");
      state.status = "running";

      // Enter park
      state = enterDogPark(state, "ball");
      expect(state.inDogPark).toBe(true);

      // Throw ball
      state = throwParkBall(state, 12, 0);
      expect(state.parkState.status).toBe("thrown");

      // Run 60 simulation steps
      for (let i = 0; i < 60; i++) {
        state = stepDuckGame(state);
      }

      // Exit dog park
      state = exitDogPark(state, true);
      expect(state.inDogPark).toBe(false);
      expect(state.calmBuffTimer).toBe(1800);
    });

    it("simulates full Bathtub Grooming workflow with lather, rinse, and clean exit", () => {
      let state = createInitialDuckGameState(1, "campaign");
      state.isMuddy = true;
      state.status = "running";

      state = enterBathtub(state);
      expect(state.inBathtub).toBe(true);

      // Scrub lather
      for (let i = 0; i < 12; i++) {
        state = scrubBathtub(state, 400, 250);
      }
      expect(state.bathtubState.status).toBe("rinse");

      // Rinse
      for (let i = 0; i < 4; i++) {
        state = rinseBathtub(state);
      }
      expect(state.bathtubState.status).toBe("clean");

      state = exitBathtub(state);
      expect(state.inBathtub).toBe(false);
      expect(state.isMuddy).toBe(false);
      expect(state.calmBuffTimer).toBe(1200);
    });
  });
});
