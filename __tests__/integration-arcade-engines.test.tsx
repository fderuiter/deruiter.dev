import { describe, it, expect } from "vitest";
import {
  createInitialDuckGameState,
  giveTreat,
  scrubBelly,
  activeCodeBurst,
  enterBathtub,
  scrubBathtub,
  rinseBathtub,
  exitBathtub,
  enterDogPark,
  jumpParkHurdle,
  throwParkBall,
  stepParkGame,
  exitDogPark,
  advanceToNextLevel,
} from "@/lib/working-with-duck-engine";
import {
  createInitialState as createLaserState,
  spawnTarget,
  checkLaserRayHit,
  calculateNextComboAndMultiplier,
  triggerUltimateTremolo,
  createIceBlock,
} from "@/lib/laser-loon/engine";
import {
  createInitialState as createGarminState,
  startGame as startGarminGame,
  allocateVariable,
  updateGameSimulation,
  triggerGarbageCollection,
  jettisonOldestVariable,
} from "@/lib/garmin/engine";
import {
  createInitialScoreState,
  createInitialAuditorState,
  createInitialPowerUpInventory,
  verify21CFRSubmission,
  generateSDTMDataset,
  exportToSDTMCSV,
} from "@/lib/clinical-trial-chaos/engine";
import type { ClinicalSubject } from "@/lib/clinical-trial-chaos/types";
import {
  generateDMZGatewayRoom,
  generateActiveDirectoryRoom,
  generateCyberpunkCampaign,
} from "@/lib/dungeon/generator";

describe("Arcade Engines & Game Simulation Integration Suite", () => {
  describe("1. Working with Duck Simulation Engine", () => {
    it("executes full pet lifecycle, bathroom wash, dog park run, and level progression", () => {
      let state = createInitialDuckGameState(1, "campaign");
      expect(state.excitement).toBeGreaterThan(0);
      expect(state.currentLevel).toBe(1);

      // 1. Give treat & belly scrub
      state = giveTreat(state);
      expect(state.naughtyVsGood).toBeGreaterThanOrEqual(15);

      state = {
        ...state,
        duck: {
          ...state.duck,
          state: "THE_FLOP",
          x: 100,
          y: 100,
        },
      };
      state = scrubBelly(state, 100, 100);
      expect(state.bellyRubProgress).toBeGreaterThan(0);

      // 2. Active code burst
      state = { ...state, status: "running" };
      const initialWork = state.workProgress;
      state = activeCodeBurst(state);
      expect(state.workProgress).toBeGreaterThan(initialWork);

      // 3. Bathtub lifecycle
      state = enterBathtub(state);
      expect(state.inBathtub).toBe(true);

      state = scrubBathtub(state, 150, 150);
      expect(state.bathtubState.soapLather).toBeGreaterThan(0);

      state = rinseBathtub(state);
      state = exitBathtub(state);
      expect(state.inBathtub).toBe(false);

      // 4. Dog Park runner
      state = enterDogPark(state, "ball");
      expect(state.inDogPark).toBe(true);

      state = jumpParkHurdle(state);
      state = throwParkBall(state, 200, 150);
      state = stepParkGame(state);
      expect(state.inDogPark).toBe(true);

      state = exitDogPark(state, true);
      expect(state.inDogPark).toBe(false);

      // 5. Level advancement
      const initialLevel = state.currentLevel;
      state = advanceToNextLevel(state);
      expect(state.currentLevel).toBe(initialLevel + 1);
    });
  });

  describe("2. Laser Loon Raycast Engine", () => {
    it("simulates enemy spawn, raycast hits, combo chaining, and ultimate triggers", () => {
      const state = createLaserState("campaign");
      expect(state.currentAct).toBe(1);
      expect(state.mode).toBe("campaign");

      // 1. Spawn enemy targets
      const spawnRes = spawnTarget([], 1, 800, 600, "mosquito");
      expect(spawnRes.newTarget).toBeDefined();
      expect(spawnRes.newTarget.hp).toBeGreaterThan(0);
      const target = spawnRes.newTarget;

      // 2. Check laser ray hit detection
      const rayHit = checkLaserRayHit(
        100,
        100,
        target.x,
        target.y,
        "ruby-laser",
        [target]
      );
      expect(rayHit.hitAny).toBe(true);
      expect(rayHit.damagedPoints.length).toBeGreaterThan(0);

      // 3. Combo multiplier calculation
      const combo1 = calculateNextComboAndMultiplier(0, 1000, 1500);
      expect(combo1.nextMultiplier).toBe(1);

      const combo10 = calculateNextComboAndMultiplier(9, 1000, 1200);
      expect(combo10.nextMultiplier).toBeGreaterThan(1);

      // 4. Ultimate tremolo
      const tremoloTargets = [target];
      const tremoloRes = triggerUltimateTremolo(tremoloTargets, 400, 300);
      expect(tremoloRes.newShockwave).toBeDefined();
      expect(tremoloRes.killedTargets.length).toBe(1);

      // 5. Ice block creation
      const iceRes = createIceBlock(100, 100, 200, 200, 1);
      expect(iceRes.iceBlock.hp).toBeGreaterThan(0);
      expect(iceRes.nextId).toBe(2);
    });
  });

  describe("3. Garmin 32KB Embedded Memory Engine", () => {
    it("simulates embedded RAM allocation, GC freezes, and heap jettisoning", () => {
      let state = createGarminState("fenix", 100);
      expect(state.gameState).toBe("idle");
      expect(state.allocatedRamKb).toBeLessThan(5.0);

      state = startGarminGame(state, "fenix");
      expect(state.gameState).toBe("playing");

      // 1. Heap Allocation
      const alloc1 = allocateVariable(state, "array", "buffer_sensor");
      state = alloc1.state;
      expect(state.variables.some((v) => v.name === "buffer_sensor")).toBe(true);

      // 2. Jettison oldest variable
      const initialVarCount = state.variables.length;
      expect(initialVarCount).toBeGreaterThan(0);
      const jettisonRes = jettisonOldestVariable(state);
      state = jettisonRes.state;
      expect(state.variables.length).toBeLessThan(initialVarCount);
      expect(state.score).toBeGreaterThan(0);

      // 3. Simulation Step
      state = updateGameSimulation(state, 50);
      expect(state.battery).toBeGreaterThan(0);

      // 4. Garbage Collection
      const gcRes = triggerGarbageCollection(state);
      expect(gcRes.freedKb).toBeGreaterThanOrEqual(0);
      state = gcRes.state;
    });
  });

  describe("4. Clinical Trial Chaos Engine", () => {
    it("validates subject compliance, 21 CFR submissions, and SDTM dataset exports", () => {
      const scoreState = createInitialScoreState();
      const auditorState = createInitialAuditorState();
      const powerUps = createInitialPowerUpInventory();

      expect(scoreState.cleanSubmissions).toBe(0);
      expect(auditorState.suspicion).toBe(0);
      expect(powerUps["fda-coffee-break"].charge).toBe(0);

      const mockSubject: ClinicalSubject = {
        id: "SUBJ-001",
        subjectLabel: "101-001",
        studySite: "Site 014 (Boston General)",
        observations: [
          {
            id: "obs-1",
            field: "Systolic Blood Pressure",
            rawValue: "120",
            currentValue: "120 mmHg",
            destination: "VS",
            isResolved: true,
          },
        ],
        status: "queued",
        timeRemaining: 60,
        maxTime: 60,
        createdAt: Date.now(),
      };

      // 1. Verify 21 CFR submission
      const subResult = verify21CFRSubmission(mockSubject, "Intent to Submit", "VS");
      expect(subResult.success).toBe(true);
      expect(subResult.level).toBe("COMPLIANT");

      // 2. SDTM Dataset generation & CSV serialization
      const sdtmDataset = generateSDTMDataset([mockSubject]);
      expect(sdtmDataset.length).toBeGreaterThan(0);

      const csvOutput = exportToSDTMCSV(sdtmDataset);
      expect(csvOutput).toContain("STUDYID");
      expect(csvOutput).toContain("USUBJID");
      expect(csvOutput).toContain("101-001");
    });
  });

  describe("5. Cyberpunk Dungeon Rogue Engine", () => {
    it("generates connected campaign rooms, DMZ gateway, and Active Directory zones", () => {
      const dmzRoom = generateDMZGatewayRoom();
      expect(dmzRoom.id).toBe("dmz_gateway");
      expect(dmzRoom.grid.length).toBeGreaterThan(0);
      expect(dmzRoom.enemies.length).toBeGreaterThan(0);

      const adRoom = generateActiveDirectoryRoom();
      expect(adRoom.id).toBe("active_directory");
      expect(adRoom.enemies.length).toBeGreaterThan(0);

      const campaign = generateCyberpunkCampaign();
      expect(campaign.length).toBeGreaterThanOrEqual(3);
      expect(campaign.map((r) => r.id)).toContain("dmz_gateway");
    });
  });
});
