import { describe, it, expect } from "vitest";
import {
  createInitialDuckGameState,
  stepDuckGame,
  throwBall,
  applySqueakyToy,
  applyKongToy,
  giveTreat,
  scrubBelly,
  startDraggingDuck,
  dragDuckTo,
  releaseDuck,
  performTrick,
  activeCodeBurst,
  interactStation,
  enterBathtub,
  stepBathtubGame,
  scrubBathtub,
  rinseBathtub,
  exitBathtub,
  mopIndoorPuddle,
  equipAccessory,
  enterDogPark,
  throwParkBall,
  jumpParkHurdle,
  steerParkDuck,
  tapParkWhistle,
  stepParkGame,
  exitDogPark,
  advanceToNextLevel,
  shouldSyncDuckHudState,
  calculateGoodBoyMultiplier,
  clampBounds,
  MIN_DUCK_X,
  MAX_DUCK_X,
  MIN_DUCK_Y,
  MAX_DUCK_Y,
  SPRINTS,
  DUCK_FACTS,
  BACK_DOOR_BOUNDS,
} from "@/lib/working-with-duck-engine";

describe("Working With Duck - Deterministic Game Engine", () => {
  it("should initialize default state correctly for Campaign Level 1", () => {
    const state = createInitialDuckGameState(1, "campaign");
    expect(state.status).toBe("idle");
    expect(state.currentLevel).toBe(1);
    expect(state.mode).toBe("campaign");
    expect(state.workProgress).toBe(0);
    expect(state.targetWorkProgress).toBe(100);
    expect(state.excitement).toBe(15);
    expect(state.bladder).toBe(10);
    expect(state.naughtyVsGood).toBe(15);
    expect(state.duck.state).toBe("IDLE_ROAM");
    expect(state.hazards).toHaveLength(4);
    expect(state.unlockedFacts).toContain(1);
    expect(state.tutorialStep).toBe(1);
    expect(state.unlockedAccessories).toContain("bucket-hat");
    expect(state.indoorPuddles).toEqual([]);
  });

  it("should advance work progress when Duck is calm and game is running", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";

    state = stepDuckGame(state);
    expect(state.ticks).toBe(1);
    expect(state.workProgress).toBeGreaterThan(0);
    expect(state.totalScore).toBeGreaterThan(0);
  });

  it("should calculate correct Good Boy multipliers across tug-of-war spectrum", () => {
    expect(calculateGoodBoyMultiplier(90)).toBe(2.5);
    expect(calculateGoodBoyMultiplier(60)).toBe(2.0);
    expect(calculateGoodBoyMultiplier(25)).toBe(1.5);
    expect(calculateGoodBoyMultiplier(5)).toBe(1.2);
    expect(calculateGoodBoyMultiplier(-20)).toBe(1.0);
    expect(calculateGoodBoyMultiplier(-60)).toBe(0.7);
  });

  it("should halt work progress during active puppy emergencies (Zoomies, Potty, Sneaky Chew)", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.duck.state = "ZOOMIES";

    const initialWork = state.workProgress;
    state = stepDuckGame(state);
    expect(state.workProgress).toBe(initialWork);
  });

  it("should trigger Zoomies when Excitement reaches 100%", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.excitement = 99.8;

    state = stepDuckGame(state);
    expect(state.duck.state).toBe("ZOOMIES");
    expect(state.soundCueQueue).toContain("bark");
  });

  it("should strictly clamp boundaries and bounce cleanly during Zoomies without sticking", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.duck.state = "ZOOMIES";
    state.duck.x = 20; // past left boundary
    state.duck.vx = -6.5;

    state = stepDuckGame(state);
    expect(state.duck.x).toBeGreaterThanOrEqual(MIN_DUCK_X);
    expect(state.duck.vx).toBeGreaterThan(0); // bounced to the right
  });

  it("should strictly clamp Duck to canvas boundaries in clampBounds", () => {
    const outLeft = clampBounds(-50, -50);
    expect(outLeft.x).toBe(MIN_DUCK_X);
    expect(outLeft.y).toBe(MIN_DUCK_Y);

    const outRight = clampBounds(2000, 2000);
    expect(outRight.x).toBe(MAX_DUCK_X);
    expect(outRight.y).toBe(MAX_DUCK_Y);
  });

  // #1550: with both meters full, the Zoomies trigger and the Potty trigger
  // overwrote each other every tick, so neither countdown ever ran and work
  // froze while the Good Boy scale drained.
  it("resolves both urgent states in turn when Excitement and Bladder are both full (#1550)", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.excitement = 100;
    state.bladder = 100;

    state = stepDuckGame(state);
    expect(state.duck.state).toBe("SNIFFING_POTTY");
    const firstCountdown = state.duck.sniffCountdown;

    state = stepDuckGame(state);
    expect(state.duck.state).toBe("SNIFFING_POTTY");
    expect(state.duck.sniffCountdown).toBeLessThan(firstCountdown);

    const workBefore = state.workProgress;
    let sawZoomies = false;
    for (let i = 0; i < 700; i++) {
      state = stepDuckGame(state);
      if (state.duck.state === "ZOOMIES") sawZoomies = true;
    }
    expect(state.indoorPuddles.length).toBeGreaterThan(0);
    expect(sawZoomies).toBe(true);
    expect(state.excitement).toBeLessThan(99);
    expect(state.workProgress).toBeGreaterThan(workBefore);
  });

  it("should trigger urgent Potty Sniffing when Bladder reaches 100%", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.bladder = 99.5;

    state = stepDuckGame(state);
    expect(state.duck.state).toBe("SNIFFING_POTTY");
    expect(state.duck.sniffCountdown).toBeGreaterThan(0);
  });

  it("should successfully relieve Duck when dragged to the Back Door", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.bladder = 90;
    state.duck.state = "SNIFFING_POTTY";

    state = startDraggingDuck(state);
    expect(state.duck.state).toBe("DRAGGED");

    state = dragDuckTo(state, BACK_DOOR_BOUNDS.x + 20, BACK_DOOR_BOUNDS.y + 20);
    state = releaseDuck(state);

    expect(state.bladder).toBe(0);
    expect(state.naughtyVsGood).toBeGreaterThan(15);
    expect(state.duck.state).toBe("IDLE_ROAM");
  });

  it("should throw ball and redirect Duck to fetch ball", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";

    state = throwBall(state, 500, 300);
    expect(state.ball?.active).toBe(true);
    expect(state.duck.state).toBe("FETCHING_BALL");
  });

  it("should deploy Kong toy to settle Duck down and reduce excitement", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.excitement = 50;

    state = applyKongToy(state, 400, 250);
    expect(state.excitement).toBeLessThan(50);
    expect(state.duck.stateTimer).toBe(200);
  });

  it("should redirect Duck and save targeted hazard when using Squeaky Toy", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.duck.state = "SNEAKY_CHEW";
    state.activeHazardTarget = "pitch-deck";

    state = applySqueakyToy(state, 300, 200);
    expect(state.duck.state).toBe("IDLE_ROAM");
    expect(state.activeHazardTarget).toBeNull();
    expect(state.activeSkillToast?.badge).toBe("Deck Saved!");
    expect(state.naughtyVsGood).toBeGreaterThan(15);
  });

  it("should handle 'No Take, Only Throw' treat trading", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.duck.state = "NO_TAKE_THROW";
    state.duck.isCarryingBall = true;

    state = giveTreat(state);
    expect(state.duck.isCarryingBall).toBe(false);
    expect(state.duck.state).toBe("IDLE_ROAM");
    expect(state.totalScore).toBeGreaterThan(0);
  });

  it("should drop ball automatically if No Take Only Throw timeout expires", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.duck.state = "NO_TAKE_THROW";
    state.duck.isCarryingBall = true;
    state.duck.stateTimer = 1;

    state = stepDuckGame(state);
    expect(state.duck.isCarryingBall).toBe(false);
    expect(state.duck.state).toBe("IDLE_ROAM");
  });

  it("should track belly rub progress and complete with calm buff", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.duck.state = "THE_FLOP";
    state.bellyRubProgress = 95;

    state = scrubBelly(state, state.duck.x, state.duck.y);
    expect(state.duck.state).toBe("IDLE_ROAM");
    expect(state.calmBuffTimer).toBe(600);
    expect(state.soundCueQueue).toContain("combo-fanfare");
  });

  it("should perform training tricks (Sit, High Five, Drop It, Spin) and award points/good boy boosts", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.excitement = 60;

    // 1. Sit Trick
    state = performTrick(state, "SIT");
    expect(state.duck.state).toBe("PERFORMING_TRICK");
    expect(state.activeTrick?.trick).toBe("SIT");
    expect(state.excitement).toBe(40); // -20 excitement
    expect(state.soundCueQueue).toContain("trick-chime");

    // Duck finishes one trick before listening for the next (#1307)
    const finishTrick = (s: typeof state): typeof state => ({
      ...s,
      activeTrick: null,
      duck: { ...s.duck, state: "IDLE_ROAM" },
    });

    // 2. High Five Trick
    state = performTrick(finishTrick(state), "HIGH_FIVE");
    expect(state.activeTrick?.trick).toBe("HIGH_FIVE");
    expect(state.soundCueQueue).toContain("paw-clap");

    // 3. Drop It Trick on stolen hazard
    state = finishTrick(state);
    state.duck.state = "SNEAKY_CHEW";
    state = performTrick(state, "DROP_IT");
    expect(state.soundCueQueue).toContain("ding");
    expect(state.naughtyVsGood).toBeGreaterThan(15);

    // 4. Spin Trick
    state = performTrick(finishTrick(state), "SPIN");
    expect(state.activeTrick?.trick).toBe("SPIN");
    expect(state.soundCueQueue).toContain("spin-whoosh");
  });

  it("should boost work progress and increment commit bursts on activeCodeBurst", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    const initialWork = state.workProgress;

    state = activeCodeBurst(state);
    expect(state.workProgress).toBeGreaterThan(initialWork);
    expect(state.activeCodeBursts).toBe(1);
    expect(state.soundCueQueue).toContain("code-type");
  });

  it("should interact with Water Bowl, Food Bowl, and Dog Bed stations", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.officeStations.waterLevel = 20;
    state.officeStations.foodLevel = 10;

    // Refill Water
    state = interactStation(state, "water");
    expect(state.officeStations.waterLevel).toBe(100);
    expect(state.soundCueQueue).toContain("water-lap");

    // Pour Food
    state = interactStation(state, "food");
    expect(state.officeStations.foodLevel).toBe(100);
    expect(state.soundCueQueue).toContain("crunch-kibble");

    // Tuck in Dog Bed when calm
    state.excitement = 10;
    state = interactStation(state, "bed");
    expect(state.duck.state).toBe("NAP_TIME");
    expect(state.soundCueQueue).toContain("snore");
  });

  it("should enter Bathtub, scrub soap lather, rinse spray, and exit fresh & clean", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.isMuddy = true;

    state = enterBathtub(state);
    expect(state.inBathtub).toBe(true);
    expect(state.bathtubState.soapLather).toBe(0);

    // Scrub soap lather
    for (let i = 0; i < 9; i++) {
      state = scrubBathtub(state, 400, 240);
    }
    expect(state.bathtubState.soapLather).toBe(100);
    expect(state.bathtubState.status).toBe("rinse");

    // Rinse spray
    for (let i = 0; i < 4; i++) {
      state = rinseBathtub(state);
    }
    expect(state.bathtubState.rinseLevel).toBe(100);
    expect(state.bathtubState.status).toBe("clean");

    // Exit Bathtub
    state = exitBathtub(state);
    expect(state.inBathtub).toBe(false);
    expect(state.isMuddy).toBe(false);
    expect(state.totalScore).toBeGreaterThan(100);
  });

  it("should equip wearable accessories and apply perks (Rain boots mud immunity, Bowtie speed)", () => {
    let state = createInitialDuckGameState(4, "campaign"); // Unlocks rain boots
    expect(state.unlockedAccessories).toContain("rain-boots");

    // Equip rain boots
    state = equipAccessory(state, "rain-boots");
    expect(state.activeAccessory).toBe("rain-boots");

    // Enter Dog park and hit mud puddle with rain boots equipped -> no muddy status!
    state = enterDogPark(state);
    state.parkState.status = "retrieving";
    state.parkState.duckX = state.parkState.puddles[0].x;
    state.parkState.duckY = state.parkState.puddles[0].y;

    state = stepDuckGame(state);
    expect(state.parkState.status).toBe("retrieving"); // Puddle ignored!
  });

  it("should jump over agility hurdles and greet park dog friends in Dog Park", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state = enterDogPark(state);

    // Jump hurdle
    state = jumpParkHurdle(state);
    expect(state.parkState.duckIsJumping).toBe(true);
    expect(state.soundCueQueue).toContain("spin-whoosh");

    // Clear hurdle while jumping
    state.parkState.status = "thrown";
    state.parkState.duckX = state.parkState.hurdles[0].x;
    state.parkState.duckY = state.parkState.hurdles[0].y;
    state = stepDuckGame(state);
    expect(state.parkState.hurdles[0].cleared).toBe(true);
    expect(state.parkState.hurdlesCleared).toBe(1);

    // Greet friend on retrieve
    state.parkState.status = "retrieving";
    state.parkState.duckX = state.parkState.friends[0].x;
    state.parkState.duckY = state.parkState.friends[0].y;
    state = stepDuckGame(state);
    expect(state.parkState.friends[0].greeted).toBe(true);
  });

  it("should transition to Dog Park, throw ball, steer duck, collect bones, and return with Tired Puppy buff", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.excitement = 80;

    state = enterDogPark(state);
    expect(state.inDogPark).toBe(true);
    expect(state.parkState.status).toBe("aim");
    expect(state.parkState.bones).toHaveLength(3);

    state = throwParkBall(state, 10, 0);
    expect(state.parkState.status).toBe("thrown");

    state.parkState.status = "retrieving";
    state = steerParkDuck(state, 180);
    expect(state.parkState.duckY).toBe(180);

    state = tapParkWhistle(state);
    expect(state.parkState.whistleTaps).toBe(1);

    // Complete park trip
    state = exitDogPark(state, true);
    expect(state.inDogPark).toBe(false);
    expect(state.excitement).toBe(0);
    expect(state.calmBuffTimer).toBe(1800);
  });

  it("should trigger Level Victory and transition to Nap Time upon completing target work", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.workProgress = state.targetWorkProgress - 0.01;

    state = stepDuckGame(state);
    expect(state.status).toBe("won");
    expect(state.duck.state).toBe("NAP_TIME");
    expect(state.latestUnlockedFact?.title).toBe(DUCK_FACTS[0].title);
  });

  it("should advance through 5 full story sprints seamlessly", () => {
    let state = createInitialDuckGameState(1, "campaign");
    expect(SPRINTS).toHaveLength(5);

    state = advanceToNextLevel(state);
    expect(state.currentLevel).toBe(2);
    expect(state.targetWorkProgress).toBe(SPRINTS[1].targetWork);

    state = advanceToNextLevel(state);
    expect(state.currentLevel).toBe(3);

    state = advanceToNextLevel(state);
    expect(state.currentLevel).toBe(4);

    state = advanceToNextLevel(state);
    expect(state.currentLevel).toBe(5);

    state = advanceToNextLevel(state);
    expect(state.mode).toBe("endless");
  });

  it("should include valid photoUrl and svgUrl for all 10 milestones in DUCK_FACTS", () => {
    expect(DUCK_FACTS).toHaveLength(10);
    DUCK_FACTS.forEach((fact) => {
      expect(fact.photoUrl).toMatch(
        /^\/(duck|images\/(duck|bio|sports))\/.*\.jpg$/
      );
      expect(fact.svgUrl).toMatch(/^\/duck\/duck-.*\.svg$/);
      expect(fact.fact.length).toBeGreaterThan(0);
      expect(fact.caption.length).toBeGreaterThan(0);
    });
  });

  it("should increase combo streak and reward extra points during rapid treat trades", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.duck.state = "NO_TAKE_THROW";

    state = giveTreat(state);
    expect(state.comboStreak).toBe(1);
    expect(state.totalScore).toBe(35);

    state.duck.state = "NO_TAKE_THROW";
    state = giveTreat(state);
    expect(state.comboStreak).toBe(2);
    expect(state.totalScore).toBe(35 + 70);
  });

  it("should decay combo streak when comboTimer expires", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.comboStreak = 3;
    state.comboTimer = 1;

    state = stepDuckGame(state);
    expect(state.comboTimer).toBe(0);
    expect(state.comboStreak).toBe(0);
  });

  it("should fail the game when naughtyVsGood drops below -90", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.naughtyVsGood = -95;

    state = stepDuckGame(state);
    expect(state.status).toBe("failed");
    expect(state.soundCueQueue).toContain("fail");
  });

  it("should initialize Endless Mode with boundless target work", () => {
    const state = createInitialDuckGameState(1, "endless");
    expect(state.mode).toBe("endless");
    expect(state.targetWorkProgress).toBe(999999);
  });

  it("should handle mud puddle collision during Dog Park retrieve sprint without rain boots", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.activeAccessory = "none";
    state.status = "running";
    state = enterDogPark(state);
    state.parkState.status = "retrieving";
    state.parkState.duckX = state.parkState.puddles[0].x;
    state.parkState.duckY = state.parkState.puddles[0].y;

    state = stepDuckGame(state);
    expect(state.parkState.status).toBe("muddy");
    expect(state.soundCueQueue).toContain("fail");
  });

  it("should collect golden bonus bones during Dog Park retrieve sprint", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state = enterDogPark(state);
    state.parkState.status = "retrieving";
    state.parkState.duckX = state.parkState.bones[0].x;
    state.parkState.duckY = state.parkState.bones[0].y;

    state = stepDuckGame(state);
    expect(state.parkState.bones[0].collected).toBe(true);
    expect(state.parkState.bonesCollected).toBe(1);
    expect(state.totalScore).toBe(50);
  });

  it("should properly save all four corporate hazards with correct skill toasts", () => {
    const hazardIds = [
      "pitch-deck",
      "power-cable",
      "audit-file",
      "laptop",
    ] as const;
    hazardIds.forEach((id) => {
      let state = createInitialDuckGameState(1, "campaign");
      state.status = "running";
      state.duck.state = "SNEAKY_CHEW";
      state.activeHazardTarget = id;

      state = applySqueakyToy(state, 400, 200);
      expect(state.activeHazardTarget).toBeNull();
      expect(state.activeSkillToast).not.toBeNull();
      expect(state.activeSkillToast?.badge.length).toBeGreaterThan(0);
      expect(state.activeSkillToast?.text.length).toBeGreaterThan(0);
    });
  });

  it("should trigger surprise delivery knock or squirrel events over time", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.duck.state = "IDLE_ROAM";
    state.ticks = 519;

    state = stepDuckGame(state);
    expect(state.activeSurpriseEvent).not.toBeNull();
    expect(["amazon-delivery", "squirrel-window"]).toContain(
      state.activeSurpriseEvent?.type
    );
    expect(state.floatingAlerts.length).toBeGreaterThan(0);
  });

  it("should handle full Bathtub lifecycle (enter, scrub, rinse, step, exit)", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state = enterBathtub(state);
    expect(state.inBathtub).toBe(true);
    expect(state.bathtubState.bubbles.length).toBeGreaterThan(0);

    // Scrub bathtub
    state = scrubBathtub(state, 200, 150);
    expect(state.bathtubState.soapLather).toBeGreaterThan(0);
    expect(state.soundCueQueue).toContain("bath-soap");

    // Step bathtub game increments ticks
    const preTicks = state.ticks;
    state = stepBathtubGame(state);
    expect(state.ticks).toBe(preTicks + 1);

    // Step duck game in bathtub
    state = stepDuckGame(state);
    expect(state.inBathtub).toBe(true);

    // Rinse bathtub
    state = rinseBathtub(state);
    expect(state.bathtubState.rinseLevel).toBeGreaterThan(0);

    // Exit bathtub
    state = exitBathtub(state);
    expect(state.inBathtub).toBe(false);
  });

  it("should handle Dog Park hurdles, whistles, and steering", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state = enterDogPark(state);
    expect(state.inDogPark).toBe(true);

    // Frisbee throw
    state.parkState.mode = "frisbee";
    state.parkState.status = "aim";
    state = throwParkBall(state, 10, 2);
    expect(state.parkState.status).toBe("thrown");
    expect(state.soundCueQueue).toContain("frisbee-throw");

    // Jump hurdle while thrown
    state.parkState.duckIsJumping = true;
    state.parkState.jumpHeight = 25;
    state.parkState.duckX = 200;
    state.parkState.duckY = 200;
    state.parkState.hurdles = [
      { id: 1, x: 205, y: 205, width: 30, height: 20, cleared: false },
    ];
    state = stepParkGame(state);
    expect(state.parkState.hurdles[0].cleared).toBe(true);
    expect(state.parkState.hurdlesCleared).toBe(1);

    // Steer duck in retrieving mode
    state.parkState.status = "retrieving";
    state = steerParkDuck(state, 300);
    expect(state.parkState.duckY).toBe(300);

    // Bones collection & friendly dog greeting in retrieving mode
    state.parkState.duckX = 150;
    state.parkState.duckY = 150;
    state.parkState.bones = [{ id: 1, x: 155, y: 155, collected: false }];
    state.parkState.friends = [
      {
        id: 1,
        name: "Barnaby",
        breed: "golden",
        x: 160,
        y: 160,
        greeted: false,
      },
    ];
    state = stepParkGame(state);
    expect(state.parkState.bones[0].collected).toBe(true);
    expect(state.parkState.friends[0].greeted).toBe(true);

    // Jump hurdle
    state = jumpParkHurdle(state);
    expect(state.parkState.duckIsJumping).toBe(true);
    expect(state.soundCueQueue).toContain("spin-whoosh");

    // Tap whistle
    state = tapParkWhistle(state);
    expect(state.soundCueQueue).toContain("whistle");

    // Reach target in retrieving mode -> success
    state.parkState.status = "retrieving";
    state.parkState.duckX = 92;
    state.parkState.duckY = 250;
    state = stepParkGame(state);
    expect(state.parkState.status).toBe("success");

    // Exit dog park with failure / incomplete
    const failedExit = exitDogPark(state, false);
    expect(failedExit.inDogPark).toBe(false);

    // Exit dog park with success
    state = exitDogPark(state, true);
    expect(state.inDogPark).toBe(false);
    expect(state.naughtyVsGood).toBeGreaterThan(0);
  });

  it("should spawn indoor puddle when bladder reaches 100% and potty sniffing countdown expires indoors", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.duck.state = "SNIFFING_POTTY";
    state.duck.sniffCountdown = 1;
    state.duck.x = 350;
    state.duck.y = 220;

    state = stepDuckGame(state);
    expect(state.indoorPuddles.length).toBe(1);
    expect(state.indoorPuddles[0].x).toBe(351);
    expect(state.indoorPuddles[0].y).toBe(220);
    expect(state.indoorPuddles[0].mopProgress).toBe(0);
    expect(state.soundCueQueue).toContain("fail");
  });

  it("should apply 30% work penalty while indoor puddles exist", () => {
    const stateWithoutPuddle = createInitialDuckGameState(1, "campaign");
    stateWithoutPuddle.status = "running";
    stateWithoutPuddle.duck.state = "IDLE_ROAM";
    const nextWithout = stepDuckGame(stateWithoutPuddle);

    const stateWithPuddle = createInitialDuckGameState(1, "campaign");
    stateWithPuddle.status = "running";
    stateWithPuddle.duck.state = "IDLE_ROAM";
    stateWithPuddle.indoorPuddles = [
      { id: 1, x: 300, y: 200, radius: 24, mopProgress: 0 },
    ];
    const nextWith = stepDuckGame(stateWithPuddle);

    expect(nextWith.workProgress).toBeCloseTo(
      nextWithout.workProgress * 0.7,
      3
    );
  });

  it("should mop indoor puddle progressively until clean", () => {
    let state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.indoorPuddles = [
      { id: 1, x: 300, y: 200, radius: 24, mopProgress: 0 },
    ];

    // Scrub puddle (35% per scrub)
    state = mopIndoorPuddle(state, 300, 200);
    expect(state.indoorPuddles.length).toBe(1);
    expect(state.indoorPuddles[0].mopProgress).toBe(35);

    state = mopIndoorPuddle(state, 300, 200);
    expect(state.indoorPuddles[0].mopProgress).toBe(70);

    // Third scrub reaches 105% -> puddle removed & points awarded
    state = mopIndoorPuddle(state, 300, 200);
    expect(state.indoorPuddles.length).toBe(0);
    expect(state.totalScore).toBe(50);
    expect(state.soundCueQueue).toContain("ding");
  });

  it("should throttle impulse timing and persist lastImpulseTick", () => {
    const state = createInitialDuckGameState(1, "campaign");
    state.status = "running";
    state.duck.state = "IDLE_ROAM";
    state.ticks = 600;
    state.lastImpulseTick = 0;

    const nextState = stepDuckGame(state);
    expect(nextState.lastImpulseTick).toBe(601);
  });

  it("should interact with all office stations and perform all tricks", () => {
    let state = createInitialDuckGameState(1, "campaign");

    // Office stations
    const stations = ["water", "food", "bed"] as const;
    stations.forEach((st) => {
      state = interactStation(state, st);
      expect(state.officeStations).toBeDefined();
    });

    // Tricks
    const tricks = ["SIT", "HIGH_FIVE", "DROP_IT", "SPIN"] as const;
    tricks.forEach((trick) => {
      state = performTrick(state, trick);
      expect(state.totalScore).toBeGreaterThanOrEqual(0);
    });

    // Code burst
    state.status = "running";
    state = activeCodeBurst(state);
    expect(state.activeCodeBursts).toBe(1);

    // Accessories
    const accessories = [
      "bucket-hat",
      "bowtie",
      "rain-boots",
      "bandana",
      "none",
    ] as const;
    state.unlockedAccessories = [...accessories];
    accessories.forEach((acc) => {
      state = equipAccessory(state, acc);
      expect(state.activeAccessory).toBe(acc);
    });
  });

  describe("Sprint Completion, Retry & Progression Reliability (#598)", () => {
    it("advanceToNextLevel returns a running state so the next sprint resumes simulation immediately", () => {
      const state = createInitialDuckGameState(1, "campaign");
      state.status = "won";

      const advanced = advanceToNextLevel(state);
      expect(advanced.status).toBe("running");
      expect(advanced.currentLevel).toBe(2);
      expect(advanced.mode).toBe("campaign");

      // Regression: previously advanceToNextLevel returned an "idle" state,
      // so stepDuckGame's `status !== "running"` guard bailed out and the
      // simulation never progressed after "Proceed to Sprint" was clicked.
      const stepped = stepDuckGame(advanced);
      expect(stepped.ticks).toBe(advanced.ticks + 1);
      expect(stepped.workProgress).toBeGreaterThan(advanced.workProgress);
    });

    it("advancing past the final campaign sprint hands off to a running endless mode", () => {
      const state = createInitialDuckGameState(5, "campaign");
      state.status = "won";

      const endless = advanceToNextLevel(state);
      expect(endless.mode).toBe("endless");
      expect(endless.status).toBe("running");

      // Regression: the campaign-to-endless handoff shared the same idle-state
      // bug, so endless mode looked "started" but never actually ticked.
      const stepped = stepDuckGame(endless);
      expect(stepped.ticks).toBe(1);
      expect(stepped.workProgress).toBeGreaterThan(0);
    });

    it("retrying a failed sprint resumes simulation on the same level", () => {
      let state = createInitialDuckGameState(2, "campaign");
      state.naughtyVsGood = -95;
      state.status = "running";
      state = stepDuckGame(state);
      expect(state.status).toBe("failed");

      // Mirrors the component's Retry handler: rebuild the level and force running.
      let retried = createInitialDuckGameState(state.currentLevel, state.mode);
      retried = { ...retried, status: "running" };
      expect(retried.status).toBe("running");

      const stepped = stepDuckGame(retried);
      expect(stepped.ticks).toBe(1);
      expect(stepped.workProgress).toBeGreaterThan(0);
    });

    it("shouldSyncDuckHudState always flushes on a terminal transition regardless of tick remainder", () => {
      for (let remainder = 0; remainder < 4; remainder++) {
        const state = createInitialDuckGameState(1, "campaign");
        state.status = "running";
        state.ticks = remainder === 0 ? 4 : remainder;
        state.workProgress = state.targetWorkProgress - 0.01;

        const won = stepDuckGame(state);
        expect(won.status).toBe("won");
        expect(won.ticks % 4).toBe(remainder === 0 ? 0 : remainder);
        expect(shouldSyncDuckHudState(won)).toBe(true);
      }

      for (let remainder = 0; remainder < 4; remainder++) {
        const state = createInitialDuckGameState(1, "campaign");
        state.status = "running";
        state.ticks = remainder === 0 ? 4 : remainder;
        state.naughtyVsGood = -95;

        const failed = stepDuckGame(state);
        expect(failed.status).toBe("failed");
        expect(failed.ticks % 4).toBe(remainder === 0 ? 0 : remainder);
        expect(shouldSyncDuckHudState(failed)).toBe(true);
      }
    });

    it("shouldSyncDuckHudState only flushes running frames on the throttled 4-tick cadence", () => {
      const base = createInitialDuckGameState(1, "campaign");
      base.status = "running";

      [0, 4, 8].forEach((ticks) => {
        expect(shouldSyncDuckHudState({ ...base, ticks })).toBe(true);
      });
      [1, 2, 3, 5, 6, 7].forEach((ticks) => {
        expect(shouldSyncDuckHudState({ ...base, ticks })).toBe(false);
      });
    });
  });
});
