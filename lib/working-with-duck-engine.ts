/**
 * Working With Duck - Deterministic Game Engine & State Machine
 * Zero external framework dependencies. 60 FPS deterministic loop.
 */
import { clamp } from "./game-utils";

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 500;

export const MIN_DUCK_X = 40;
export const MAX_DUCK_X = CANVAS_WIDTH - 40;
export const MIN_DUCK_Y = 40;
export const MAX_DUCK_Y = CANVAS_HEIGHT - 40;

export const DESK_BOUNDS = { x: 80, y: 150, width: 170, height: 160 };
export const RUG_BOUNDS = { x: 320, y: 150, width: 230, height: 180 };
export const DOG_BED_BOUNDS = { x: 640, y: 70, width: 120, height: 100 };
export const BACK_DOOR_BOUNDS = { x: 690, y: 360, width: 90, height: 110 };
export const WATER_BOWL_BOUNDS = { x: 60, y: 360, width: 55, height: 45 };
export const FOOD_BOWL_BOUNDS = { x: 125, y: 360, width: 55, height: 45 };
export const BATHTUB_BOUNDS = { x: 680, y: 220, width: 95, height: 95 };

export type DuckBehaviorState =
  | "IDLE_ROAM"
  | "SNIFFING_POTTY"
  | "SNEAKY_CHEW"
  | "NO_TAKE_THROW"
  | "THE_FLOP"
  | "ZOOMIES"
  | "FETCHING_BALL"
  | "DRAGGED"
  | "NAP_TIME"
  | "PERFORMING_TRICK"
  | "DRINKING_WATER"
  | "EATING_KIBBLE";

export type DuckTrick = "SIT" | "HIGH_FIVE" | "DROP_IT" | "SPIN";

export type DuckAccessory =
  "none" | "bucket-hat" | "bowtie" | "bandana" | "rain-boots";

export type DuckMood =
  | "happy"
  | "thirsty"
  | "hungry"
  | "potty"
  | "playful"
  | "sleepy"
  | "muddy"
  | "zoomies";

export type InventoryItem =
  "tennis-ball" | "kong" | "squeaky-toy" | "treat" | "frisbee";

export type CorporateHazardType =
  "pitch-deck" | "power-cable" | "audit-file" | "laptop";
export type PortfolioHazardType =
  | CorporateHazardType
  | "resume"
  | "server-cable"
  | "clinical-db"
  | "garmin-watch";

export interface PortfolioHazard {
  id: PortfolioHazardType;
  name: string;
  x: number;
  y: number;
  radius: number;
  skillBadge: string;
  saveTooltip: string;
  isChewed: boolean;
}

export type CorporateHazard = PortfolioHazard;

export interface IndoorPuddle {
  id: number;
  x: number;
  y: number;
  radius: number;
  mopProgress: number; // 0 to 100%
}

export interface MudPuddle {
  x: number;
  y: number;
  radius: number;
}

export interface ParkBone {
  id: number;
  x: number;
  y: number;
  collected: boolean;
}

export interface ParkHurdle {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  cleared: boolean;
}

export interface ParkFriend {
  id: number;
  name: string;
  breed: "corgi" | "golden";
  x: number;
  y: number;
  greeted: boolean;
}

export interface Squirrel {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  decay: number;
  size: number;
  shape:
    | "heart"
    | "circle"
    | "sweat"
    | "star"
    | "spark"
    | "bone"
    | "bubble"
    | "mud"
    | "water";
}

export interface FloatingAlert {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

export interface DuckFact {
  id: number;
  level: number;
  title: string;
  fact: string;
  photoUrl: string;
  svgUrl: string;
  caption: string;
}

export interface GameSprint {
  level: number;
  title: string;
  subtitle: string;
  targetWork: number;
  impulseInterval: number; // ticks between impulses
  description: string;
}

export const DUCK_FACTS: DuckFact[] = [
  {
    id: 1,
    level: 1,
    title: "The Puppy Headrest",
    fact: "Sprint 1 onboarding: Duck discovered that Fred's head was the premier napping perch during evening code reviews.",
    photoUrl: "/images/duck/duck-puppy-headrest.jpg",
    svgUrl: "/duck/duck-prince.svg",
    caption:
      "Baby Duck curled up asleep across Fred's head like a cozy winter hat.",
  },
  {
    id: 2,
    level: 2,
    title: "First Week Home",
    fact: "A very small, very fluffy Duck contemplating his future career as an 80-lb lap dog and full-time pair programmer.",
    photoUrl: "/images/duck/duck-puppy-bed.jpg",
    svgUrl: "/duck/duck-pantleg.svg",
    caption:
      "Fluffy cloud on the bed, observing the world with solemn puppy innocence.",
  },
  {
    id: 3,
    level: 3,
    title: "The Soulful Puppy Gaze",
    fact: "Duck's puppy eyes and black toe beans possess a 100% success rate in treat negotiations and extra dog park trips.",
    photoUrl: "/images/duck/duck-puppy-mirror.jpg",
    svgUrl: "/duck/duck-puppy-eyes.svg",
    caption: "Inspecting puppy paws and optimal fluff density in the mirror.",
  },
  {
    id: 4,
    level: 4,
    title: "Couch Zoomies Explorer",
    fact: "Duck conquered the striped couch mountain in record time, sporting his signature open-mouthed grin beside Fred in his playoff tee.",
    photoUrl: "/images/bio/fred-duck-couch.jpg",
    svgUrl: "/duck/duck-couch.svg",
    caption: "Full speed couch patrol celebrating a zero-downtime deploy.",
  },
  {
    id: 5,
    level: 5,
    title: "Standup Architecture Review",
    fact: "Fred in a yellow button-down holding adolescent Duck upright to review system architectures and microservice topologies.",
    photoUrl: "/images/bio/fred-duck-yellow-shirt.jpg",
    svgUrl: "/duck/duck-hat.svg",
    caption: "Dressed up for a high-stakes architecture demo.",
  },
  {
    id: 6,
    level: 6,
    title: "The Giant Marshmallow Armful",
    fact: "Duck is an English Cream Golden Retriever who still firmly believes he is a pocket-sized lap dog that can be carried everywhere.",
    photoUrl: "/images/duck/fred-duck-carried-doorway.jpg",
    svgUrl: "/duck/duck-carried.svg",
    caption:
      "Fred holding Duck (and his oversized bear paws) in the doorway during daily standup.",
  },
  {
    id: 7,
    level: 7,
    title: "Shoulder Co-Pilot",
    fact: "Duck providing real-time peer code review and immediate chin-rest comfort on the couch during late-night debugging.",
    photoUrl: "/images/bio/fred-duck-shoulder.jpg",
    svgUrl: "/duck/duck-bath.svg",
    caption: "Peaceful shoulder cuddle during long build pipelines.",
  },
  {
    id: 8,
    level: 8,
    title: "Hallway Standup Dance",
    fact: "Full 80-lb marshmallow height check between code compilations. Paws up, zero worries, and 100% test coverage.",
    photoUrl: "/images/duck/fred-duck-hallway.jpg",
    svgUrl: "/duck/duck-flop.svg",
    caption: "Hallway dance partner ready for another sprint.",
  },
  {
    id: 9,
    level: 9,
    title: "Theodore Wirth Mud Run Co-Pilot",
    fact: "Duck's zoomie speed and mud resistance clocked at peak velocity. Minnesota trail mud is merely an operational challenge.",
    photoUrl: "/images/sports/theodore-wirth-mud-run.jpg",
    svgUrl: "/duck/duck-happy.svg",
    caption: "Endurance running spirit with Garmin watch telemetry.",
  },
  {
    id: 10,
    level: 10,
    title: "Welch Village Alpine Flame",
    fact: "Equipped with maximum cold-weather charisma and 90s flame ski suit energy, ready for whatever winter throws our way.",
    photoUrl: "/images/sports/fred-ski-flame-suit.jpg",
    svgUrl: "/duck/duck-car.svg",
    caption: "Carving snowy slopes in legendary flame style.",
  },
];

/** Good Boy points lost per tick while an emergency goes unhandled. */
const NEGLECT_DRAIN_PER_TICK = 0.04;
/** Minimum ticks between two code bursts (60 ticks = 1 s, so 6 per second). */
const CODE_BURST_MIN_TICKS = 10;

export const SPRINTS: GameSprint[] = [
  {
    level: 1,
    title: "Sprint 1: Onboarding & Puppy Proofing",
    subtitle: "Gentle puppy impulses · Learn clicker tricks & toys",
    targetWork: 100,
    impulseInterval: 280,
    description:
      "Configure your remote workspace while teaching Duck basic obedience (Sit, High Five) and redirecting playful nibbles.",
  },
  {
    level: 2,
    title: "Sprint 2: Q1 Deliverables & Cable Alert",
    subtitle: "Faster impulses · Package delivery knock & office wires",
    targetWork: 160,
    impulseInterval: 220,
    description:
      "High-priority deliverable in flight! Protect the office power strip with Kong toys and trade treats during 'No Take, Only Throw!'.",
  },
  {
    level: 3,
    title: "Sprint 3: Executive Pitch & Window Distraction",
    subtitle: "High excitement · Window squirrels & rapid potty runs",
    targetWork: 240,
    impulseInterval: 175,
    description:
      "Board meeting deadline! Excitement is rising. Run outside for fast potty breaks and practice clicker training for Good Boy multipliers.",
  },
  {
    level: 4,
    title: "Sprint 4: Deadline Crunch & Park Break",
    subtitle: "Extreme multitasking · Agility hurdles & bathtub wash",
    targetWork: 330,
    impulseInterval: 145,
    description:
      "Intense project crunch! Duck needs high-energy Dog Park agility runs. If he splashes into mud, scrub him clean in the Bathtub.",
  },
  {
    level: 5,
    title: "Sprint 5: Annual Launch & Golden Promotion",
    subtitle: "Peak velocity · Master combos & zero downtime",
    targetWork: 450,
    impulseInterval: 120,
    description:
      "The major milestone release! Master all training tricks, focus work sprints, and unlock the Golden Graduation hat.",
  },
];

export const INITIAL_HAZARDS: PortfolioHazard[] = [
  {
    id: "pitch-deck",
    name: "Quarterly Pitch Deck",
    x: 270,
    y: 85,
    radius: 24,
    skillBadge: "Deck Saved!",
    saveTooltip: "Key executive presentation intact.",
    isChewed: false,
  },
  {
    id: "power-cable",
    name: "Main Power & Network Strip",
    x: 130,
    y: 380,
    radius: 26,
    skillBadge: "Online!",
    saveTooltip: "Office connectivity and power protected from disconnection.",
    isChewed: false,
  },
  {
    id: "audit-file",
    name: "Corporate Audit & Budget Sheet",
    x: 480,
    y: 85,
    radius: 24,
    skillBadge: "Audit Ready!",
    saveTooltip: "Crucial quarterly budget and compliance spreadsheet safe.",
    isChewed: false,
  },
  {
    id: "laptop",
    name: "Company Laptop & Dock",
    x: 530,
    y: 390,
    radius: 24,
    skillBadge: "Hardware Intact!",
    saveTooltip: "Workstation protected from spills and puppy nibbles.",
    isChewed: false,
  },
];

export type SoundCue =
  | "tippy-tap"
  | "squeak"
  | "bark"
  | "belly-rub"
  | "whistle"
  | "snore"
  | "ding"
  | "fail"
  | "door-knock"
  | "squirrel-chirp"
  | "hiccup"
  | "combo-fanfare"
  | "trick-chime"
  | "paw-clap"
  | "spin-whoosh"
  | "bath-soap"
  | "bath-rinse"
  | "water-lap"
  | "crunch-kibble"
  | "code-type"
  | "frisbee-throw";

export interface OfficeStations {
  waterLevel: number; // 0 to 100%
  foodLevel: number; // 0 to 100%
  isWaterDrinking: boolean;
  isFoodEating: boolean;
}

export interface BathtubState {
  status: "idle" | "soap" | "scrub" | "rinse" | "clean";
  soapLather: number; // 0 to 100%
  rinseLevel: number; // 0 to 100%
  scrubCount: number;
  bubbles: Array<{
    id: number;
    x: number;
    y: number;
    size: number;
    alpha: number;
  }>;
}

export interface WorkingWithDuckState {
  status: "idle" | "running" | "paused" | "failed" | "won";
  mode: "campaign" | "endless";
  currentLevel: number;
  workProgress: number;
  targetWorkProgress: number;
  excitement: number; // 0 to 100
  bladder: number; // 0 to 100
  thirst: number; // 0 to 100
  hunger: number; // 0 to 100
  naughtyVsGood: number; // -100 to +100
  multiplier: number; // 0.7 to 3.5
  ticks: number;
  totalScore: number;
  calmBuffTimer: number; // Ticks remaining for calm buff
  lastImpulseTick: number;
  bellyRubScrubCount: number;
  bellyRubProgress: number; // 0 to 100%
  activeTrick: {
    trick: DuckTrick;
    timer: number;
    maxTimer: number;
  } | null;

  activeAccessory: DuckAccessory;
  unlockedAccessories: DuckAccessory[];

  officeStations: OfficeStations;
  isMuddy: boolean;
  inBathtub: boolean;
  bathtubState: BathtubState;

  activeCodeBursts: number;
  lastCodeTick: number;

  comboStreak: number;
  comboTimer: number;
  activeSurpriseEvent: {
    type: "amazon-delivery" | "squirrel-window" | "puppy-hiccups";
    timer: number;
    maxTimer: number;
    resolved: boolean;
  } | null;

  duck: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    targetX: number;
    targetY: number;
    state: DuckBehaviorState;
    stateTimer: number;
    maxStateTimer: number;
    angle: number;
    isCarryingBall: boolean;
    circleAngle: number;
    sniffCountdown: number; // 0 to 210 (3.5 seconds at 60fps)
    tailWagAngle: number;
    tailWagSpeed: number;
  };

  selectedItem: InventoryItem;
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    active: boolean;
  } | null;

  hazards: PortfolioHazard[];
  activeHazardTarget: PortfolioHazardType | null;

  indoorPuddles: IndoorPuddle[];
  nextPuddleId: number;

  particles: Particle[];
  floatingAlerts: FloatingAlert[];
  nextParticleId: number;
  nextAlertId: number;

  inDogPark: boolean;
  parkState: {
    status: "aim" | "thrown" | "retrieving" | "success" | "muddy";
    mode: "ball" | "frisbee";
    ballX: number;
    ballY: number;
    ballVx: number;
    ballVy: number;
    duckX: number;
    duckY: number;
    duckVx: number;
    duckVy: number;
    duckAngle: number;
    duckIsJumping: boolean;
    jumpHeight: number;
    puddles: MudPuddle[];
    bones: ParkBone[];
    bonesCollected: number;
    hurdles: ParkHurdle[];
    hurdlesCleared: number;
    friends: ParkFriend[];
    whistleTaps: number;
    timer: number;
  };

  unlockedFacts: number[];
  latestUnlockedFact: DuckFact | null;
  highScore: number;
  activeSkillToast: { badge: string; text: string; timer: number } | null;
  soundCueQueue: Array<SoundCue>;
  tutorialStep: number;
}

export function clampBounds(x: number, y: number): { x: number; y: number } {
  const safeX = Number.isFinite(x) ? x : CANVAS_WIDTH / 2;
  const safeY = Number.isFinite(y) ? y : CANVAS_HEIGHT / 2;
  return {
    x: clamp(safeX, MIN_DUCK_X, MAX_DUCK_X),
    y: clamp(safeY, MIN_DUCK_Y, MAX_DUCK_Y),
  };
}

export function createInitialDuckGameState(
  level = 1,
  mode: "campaign" | "endless" = "campaign",
  preservedAccessories: DuckAccessory[] = ["none", "bucket-hat"],
  preservedFacts: number[] = [1]
): WorkingWithDuckState {
  const sprint = SPRINTS.find((s) => s.level === level) || SPRINTS[0];

  const unlockedAcc: DuckAccessory[] = Array.from(
    new Set<DuckAccessory>([
      "none",
      ...preservedAccessories,
      level >= 1 ? "bucket-hat" : "none",
      level >= 2 ? "bowtie" : "none",
      level >= 3 ? "bandana" : "none",
      level >= 4 ? "rain-boots" : "none",
    ])
  );

  return {
    status: "idle",
    mode,
    currentLevel: level,
    workProgress: 0,
    targetWorkProgress: mode === "endless" ? 999999 : sprint.targetWork,
    excitement: 15,
    bladder: 10,
    thirst: 20,
    hunger: 15,
    naughtyVsGood: 15,
    multiplier: 1.2,
    ticks: 0,
    totalScore: 0,
    calmBuffTimer: 0,
    lastImpulseTick: 0,
    bellyRubScrubCount: 0,
    bellyRubProgress: 0,
    activeTrick: null,

    activeAccessory: "none",
    unlockedAccessories: unlockedAcc,

    officeStations: {
      waterLevel: 80,
      foodLevel: 75,
      isWaterDrinking: false,
      isFoodEating: false,
    },
    isMuddy: false,
    inBathtub: false,
    bathtubState: {
      status: "idle",
      soapLather: 0,
      rinseLevel: 0,
      scrubCount: 0,
      bubbles: [],
    },

    activeCodeBursts: 0,
    lastCodeTick: 0,

    comboStreak: 0,
    comboTimer: 0,
    activeSurpriseEvent: null,

    duck: {
      x: 430,
      y: 240,
      vx: 0,
      vy: 0,
      targetX: 430,
      targetY: 240,
      state: "IDLE_ROAM",
      stateTimer: 120,
      maxStateTimer: 120,
      angle: 0,
      isCarryingBall: false,
      circleAngle: 0,
      sniffCountdown: 0,
      tailWagAngle: 0,
      tailWagSpeed: 0.15,
    },

    selectedItem: "tennis-ball",
    ball: null,

    hazards: INITIAL_HAZARDS.map((h) => ({ ...h })),
    activeHazardTarget: null,

    indoorPuddles: [],
    nextPuddleId: 1,

    particles: [],
    floatingAlerts: [],
    nextParticleId: 1,
    nextAlertId: 1,

    inDogPark: false,
    parkState: {
      status: "aim",
      mode: "ball",
      ballX: 100,
      ballY: 250,
      ballVx: 0,
      ballVy: 0,
      duckX: 80,
      duckY: 250,
      duckVx: 0,
      duckVy: 0,
      duckAngle: 0,
      duckIsJumping: false,
      jumpHeight: 0,
      puddles: [
        { x: 360, y: 160, radius: 36 },
        { x: 480, y: 320, radius: 40 },
        { x: 620, y: 190, radius: 34 },
      ],
      bones: [
        { id: 1, x: 280, y: 150, collected: false },
        { id: 2, x: 440, y: 240, collected: false },
        { id: 3, x: 580, y: 310, collected: false },
      ],
      bonesCollected: 0,
      hurdles: [
        { id: 1, x: 320, y: 220, width: 28, height: 44, cleared: false },
        { id: 2, x: 520, y: 200, width: 28, height: 44, cleared: false },
      ],
      hurdlesCleared: 0,
      friends: [
        {
          id: 1,
          name: "Luna the Corgi",
          breed: "corgi",
          x: 240,
          y: 360,
          greeted: false,
        },
        {
          id: 2,
          name: "Barnaby",
          breed: "golden",
          x: 670,
          y: 120,
          greeted: false,
        },
      ],
      whistleTaps: 0,
      timer: 0,
    },

    unlockedFacts: Array.from(
      new Set<number>(
        [1, ...preservedFacts].filter((id) =>
          DUCK_FACTS.some((fact) => fact.id === id)
        )
      )
    ),
    latestUnlockedFact: null,
    highScore: 0,
    activeSkillToast: null,
    soundCueQueue: [],
    tutorialStep: level === 1 ? 1 : 0,
  };
}

/**
 * Calculate Good Boy multiplier from the tug-of-war scale
 */
export function calculateGoodBoyMultiplier(naughtyVsGood: number): number {
  if (naughtyVsGood >= 80) return 2.5;
  if (naughtyVsGood >= 50) return 2.0;
  if (naughtyVsGood >= 20) return 1.5;
  if (naughtyVsGood >= 0) return 1.2;
  if (naughtyVsGood >= -40) return 1.0;
  return 0.7; // Slow progress when very naughty
}

/**
 * Decide whether a stepped state should be flushed to React UI state.
 *
 * The canvas game loop steps the engine at 60 FPS but only syncs the
 * throttled React `uiState` on every 4th tick for DOM performance. Terminal
 * transitions (win/fail) must always flush immediately regardless of tick
 * remainder, otherwise `stepDuckGame` stops advancing (status is no longer
 * "running") while `uiState` is left showing the last throttled frame,
 * silently hiding the victory/failure panel.
 */
export function shouldSyncDuckHudState(
  nextState: WorkingWithDuckState
): boolean {
  return nextState.ticks % 4 === 0 || nextState.status !== "running";
}

/**
 * Deterministic Game Step Loop (60 FPS)
 */
export function stepDuckGame(
  state: WorkingWithDuckState
): WorkingWithDuckState {
  if (state.status !== "running") {
    return state;
  }

  const nextTicks = state.ticks + 1;
  const soundCues: Array<SoundCue> = [];

  // If in Dog Park mini-game, step park
  if (state.inDogPark) {
    return stepParkGame(state);
  }

  // If in Bathtub washroom, step bathtub
  if (state.inBathtub) {
    return stepBathtubGame(state);
  }

  const sprint =
    SPRINTS.find((s) => s.level === state.currentLevel) || SPRINTS[0];
  const impulseRate = sprint.impulseInterval;

  // Multipliers & Calm Buff
  const nextCalmBuff = Math.max(0, state.calmBuffTimer - 1);
  const baseMultiplier = calculateGoodBoyMultiplier(state.naughtyVsGood);
  const comboBonus =
    state.comboStreak >= 2 ? 0.3 * Math.min(3, state.comboStreak) : 0;
  const accessoryBonus = state.activeAccessory === "bowtie" ? 0.2 : 0;
  const effectiveMultiplier =
    (nextCalmBuff > 0 ? baseMultiplier + 0.5 : baseMultiplier) +
    comboBonus +
    accessoryBonus;

  // Work Progress Advance (When Duck is NOT in an active emergency)
  const isEmergency =
    state.duck.state === "SNIFFING_POTTY" ||
    state.duck.state === "SNEAKY_CHEW" ||
    state.duck.state === "ZOOMIES";

  // Debuff from unmopped indoor puddles (-30% speed)
  const puddlePenalty =
    state.indoorPuddles && state.indoorPuddles.length > 0 ? 0.7 : 1.0;

  let nextWorkProgress = state.workProgress;
  let nextScore = state.totalScore;

  // Training Duck takes the player's attention too: no passive work while
  // he performs a trick, so a trick costs about a second of coding.
  const isTraining = state.duck.state === "PERFORMING_TRICK";

  if (!isEmergency && !isTraining && state.duck.state !== "NAP_TIME") {
    const workIncrement = 0.04 * effectiveMultiplier * puddlePenalty;
    nextWorkProgress = Math.min(
      state.targetWorkProgress,
      state.workProgress + workIncrement
    );
    nextScore += Math.round(1 * effectiveMultiplier * puddlePenalty);
  }

  // Win condition check
  if (
    nextWorkProgress >= state.targetWorkProgress &&
    state.duck.state !== "NAP_TIME"
  ) {
    return handleLevelVictory(state, soundCues);
  }

  // Fail condition check (Tug-of-war reaches extreme red)
  if (state.naughtyVsGood <= -90) {
    soundCues.push("fail");
    return {
      ...state,
      status: "failed",
      soundCueQueue: [...state.soundCueQueue, ...soundCues],
    };
  }

  // Meters Natural Evolution
  const excitementRate =
    nextCalmBuff > 0 ? 0.02 : 0.07 + state.currentLevel * 0.018;
  const bladderRate =
    nextCalmBuff > 0 ? 0.02 : 0.05 + state.currentLevel * 0.015;
  const thirstRate = 0.03 + state.currentLevel * 0.01;
  const hungerRate = 0.02 + state.currentLevel * 0.01;

  let nextExcitement = clamp(state.excitement + excitementRate, 0, 100);
  let nextBladder = clamp(state.bladder + bladderRate, 0, 100);
  let nextThirst = clamp(state.thirst + thirstRate, 0, 100);
  let nextHunger = clamp(state.hunger + hungerRate, 0, 100);
  // An unhandled emergency (potty sniffing, sneaky chewing, zoomies) slowly
  // erodes the Good Boy scale, so ignoring Duck is never a winning strategy.
  let nextNaughtyVsGood = isEmergency
    ? Math.max(-100, state.naughtyVsGood - NEGLECT_DRAIN_PER_TICK)
    : state.naughtyVsGood;
  let nextLastImpulseTick = state.lastImpulseTick;
  const nextIndoorPuddles = state.indoorPuddles ? [...state.indoorPuddles] : [];
  let nextPuddleId = state.nextPuddleId || nextIndoorPuddles.length + 1;

  let activeToast = state.activeSkillToast
    ? { ...state.activeSkillToast, timer: state.activeSkillToast.timer - 1 }
    : null;
  if (activeToast && activeToast.timer <= 0) {
    activeToast = null;
  }

  // Combo timer evolution
  const nextComboTimer = Math.max(0, state.comboTimer - 1);
  const nextComboStreak = nextComboTimer > 0 ? state.comboStreak : 0;

  // Surprise event timer evolution
  let activeSurprise = state.activeSurpriseEvent
    ? {
        ...state.activeSurpriseEvent,
        timer: state.activeSurpriseEvent.timer - 1,
      }
    : null;
  if (activeSurprise && activeSurprise.timer <= 0) {
    activeSurprise = null;
  }

  // Active Trick timer evolution
  let activeTrick = state.activeTrick
    ? { ...state.activeTrick, timer: state.activeTrick.timer - 1 }
    : null;
  if (activeTrick && activeTrick.timer <= 0) {
    activeTrick = null;
  }

  // Duck AI & Physics
  const duck = { ...state.duck };
  let particles = [...state.particles];
  let alerts = [...state.floatingAlerts];
  let activeHazardTarget = state.activeHazardTarget;
  const hazards = state.hazards.map((h) => ({ ...h }));
  const stations = { ...state.officeStations };

  // Tail wag physics
  const tailSpeedMultiplier = Math.max(0.1, (nextNaughtyVsGood + 100) / 100);
  duck.tailWagAngle = Math.sin(nextTicks * 0.35 * tailSpeedMultiplier) * 0.45;

  // Random surprise event during calm roam
  if (!activeSurprise && nextTicks % 520 === 0 && duck.state === "IDLE_ROAM") {
    const roll = Math.random();
    if (roll < 0.5) {
      activeSurprise = {
        type: "amazon-delivery",
        timer: 300,
        maxTimer: 300,
        resolved: false,
      };
      soundCues.push("door-knock");
      alerts.push({
        id: state.nextAlertId + 99,
        x: BACK_DOOR_BOUNDS.x,
        y: BACK_DOOR_BOUNDS.y + 20,
        text: "📦 Amazon Delivery Knock!",
        color: "#f59e0b",
        alpha: 1,
        vy: -1.2,
      });
    } else {
      activeSurprise = {
        type: "squirrel-window",
        timer: 300,
        maxTimer: 300,
        resolved: false,
      };
      soundCues.push("squirrel-chirp");
      alerts.push({
        id: state.nextAlertId + 99,
        x: 400,
        y: 50,
        text: "🐿️ Squirrel at Window!",
        color: "#38bdf8",
        alpha: 1,
        vy: -1.2,
      });
    }
  }

  // Thirst & Hunger Autonomous Station Visits
  if (
    nextThirst >= 85 &&
    duck.state === "IDLE_ROAM" &&
    stations.waterLevel > 10
  ) {
    duck.state = "DRINKING_WATER";
    duck.targetX = WATER_BOWL_BOUNDS.x + 25;
    duck.targetY = WATER_BOWL_BOUNDS.y + 20;
    duck.stateTimer = 180;
    duck.maxStateTimer = 180;
  } else if (
    nextHunger >= 85 &&
    duck.state === "IDLE_ROAM" &&
    stations.foodLevel > 10
  ) {
    duck.state = "EATING_KIBBLE";
    duck.targetX = FOOD_BOWL_BOUNDS.x + 25;
    duck.targetY = FOOD_BOWL_BOUNDS.y + 20;
    duck.stateTimer = 180;
    duck.maxStateTimer = 180;
  }

  // Check 100% Bladder -> Trigger Potty Sniff Countdown. Potty takes
  // priority over Zoomies: it is checked first and may interrupt them, while
  // the Zoomies trigger below waits for the countdown to resolve (#1550).
  if (
    nextBladder >= 99 &&
    duck.state !== "SNIFFING_POTTY" &&
    duck.state !== "DRAGGED" &&
    duck.state !== "NAP_TIME" &&
    duck.state !== "PERFORMING_TRICK"
  ) {
    duck.state = "SNIFFING_POTTY";
    duck.sniffCountdown = 210; // 3.5 seconds at 60fps
    duck.circleAngle = 0;
    soundCues.push("bark");
    alerts.push({
      id: state.nextAlertId,
      x: duck.x,
      y: duck.y - 30,
      text: "🚽 Urgent Potty Sniffing!",
      color: "#ef4444",
      alpha: 1,
      vy: -1.5,
    });
  }

  // Check 100% Excitement -> Trigger Zoomies. Zoomies never preempt an
  // active potty countdown, so each urgent state runs its timer out (#1550).
  if (
    nextExcitement >= 99 &&
    duck.state !== "ZOOMIES" &&
    duck.state !== "SNIFFING_POTTY" &&
    duck.state !== "DRAGGED" &&
    duck.state !== "NAP_TIME" &&
    duck.state !== "PERFORMING_TRICK"
  ) {
    duck.state = "ZOOMIES";
    duck.stateTimer = 240; // 4 seconds of wild zoomies
    duck.maxStateTimer = 240;
    duck.vx = 6.5;
    duck.vy = 5.5;
    soundCues.push("bark");
    alerts.push({
      id: state.nextAlertId,
      x: duck.x,
      y: duck.y - 30,
      text: "⚡ ZOOMIES!!!",
      color: "#f59e0b",
      alpha: 1,
      vy: -1.2,
    });
  }

  // Behavior State Machine Logic
  switch (duck.state) {
    case "IDLE_ROAM": {
      duck.stateTimer -= 1;

      // Move toward target
      const dx = duck.targetX - duck.x;
      const dy = duck.targetY - duck.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 8) {
        const speed = 1.6;
        duck.vx = (dx / dist) * speed;
        duck.vy = (dy / dist) * speed;
        duck.x += duck.vx;
        duck.y += duck.vy;
        duck.angle = Math.atan2(dy, dx);

        if (nextTicks % 24 === 0) {
          soundCues.push("tippy-tap");
        }
      } else {
        duck.vx = 0;
        duck.vy = 0;
      }

      // Pick new wander target when timer runs out
      if (duck.stateTimer <= 0) {
        duck.targetX = 220 + Math.random() * 360;
        duck.targetY = 120 + Math.random() * 240;
        duck.stateTimer = 100 + Math.floor(Math.random() * 120);
        duck.maxStateTimer = duck.stateTimer;
      }

      // Periodic random impulse generation (persisting lastImpulseTick)
      if (nextTicks - state.lastImpulseTick > impulseRate) {
        nextLastImpulseTick = nextTicks;
        const impulseChoice = Math.random();
        if (impulseChoice < 0.45) {
          // Sneaky chew event
          const unchewedHazards = hazards.filter((h) => !h.isChewed);
          const hazardPool =
            unchewedHazards.length > 0 ? unchewedHazards : hazards;
          const randomHazard =
            hazardPool[Math.floor(Math.random() * hazardPool.length)];
          duck.state = "SNEAKY_CHEW";
          duck.targetX = randomHazard.x;
          duck.targetY = randomHazard.y;
          duck.stateTimer = 240;
          duck.maxStateTimer = 240;
          activeHazardTarget = randomHazard.id;
          soundCues.push("bark");
          alerts.push({
            id: state.nextAlertId + 1,
            x: duck.x,
            y: duck.y - 25,
            text: `⚠️ Targeting ${randomHazard.name}!`,
            color: "#f97316",
            alpha: 1,
            vy: -1.2,
          });
        } else if (impulseChoice < 0.75) {
          // The Flop (Belly rubs invitation)
          duck.state = "THE_FLOP";
          duck.stateTimer = 360;
          duck.maxStateTimer = 360;
          duck.vx = 0;
          duck.vy = 0;
          alerts.push({
            id: state.nextAlertId + 2,
            x: duck.x,
            y: duck.y - 30,
            text: "❤️ Flopped! Scrub belly!",
            color: "#ec4899",
            alpha: 1,
            vy: -1.0,
          });
        }
      }
      break;
    }

    case "DRINKING_WATER": {
      const dx = WATER_BOWL_BOUNDS.x + 25 - duck.x;
      const dy = WATER_BOWL_BOUNDS.y + 20 - duck.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 8) {
        duck.vx = (dx / dist) * 2.0;
        duck.vy = (dy / dist) * 2.0;
        duck.x += duck.vx;
        duck.y += duck.vy;
        duck.angle = Math.atan2(dy, dx);
      } else {
        duck.vx = 0;
        duck.vy = 0;
        duck.stateTimer -= 1;
        stations.waterLevel = Math.max(0, stations.waterLevel - 0.15);
        nextThirst = Math.max(0, nextThirst - 0.4);

        if (nextTicks % 20 === 0) {
          soundCues.push("water-lap");
          particles.push({
            id: state.nextParticleId + particles.length,
            x: WATER_BOWL_BOUNDS.x + 25 + (Math.random() - 0.5) * 16,
            y: WATER_BOWL_BOUNDS.y + 15,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -0.6 - Math.random() * 0.6,
            alpha: 1,
            color: "#38bdf8",
            decay: 0.03,
            size: 4,
            shape: "water",
          });
        }

        if (duck.stateTimer <= 0 || nextThirst <= 5) {
          duck.state = "IDLE_ROAM";
          duck.stateTimer = 100;
          duck.maxStateTimer = 100;
          nextNaughtyVsGood = Math.min(100, nextNaughtyVsGood + 2);
        }
      }
      break;
    }

    case "EATING_KIBBLE": {
      const dx = FOOD_BOWL_BOUNDS.x + 25 - duck.x;
      const dy = FOOD_BOWL_BOUNDS.y + 20 - duck.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 8) {
        duck.vx = (dx / dist) * 2.0;
        duck.vy = (dy / dist) * 2.0;
        duck.x += duck.vx;
        duck.y += duck.vy;
        duck.angle = Math.atan2(dy, dx);
      } else {
        duck.vx = 0;
        duck.vy = 0;
        duck.stateTimer -= 1;
        stations.foodLevel = Math.max(0, stations.foodLevel - 0.15);
        nextHunger = Math.max(0, nextHunger - 0.4);

        if (nextTicks % 22 === 0) {
          soundCues.push("crunch-kibble");
        }

        if (duck.stateTimer <= 0 || nextHunger <= 5) {
          duck.state = "IDLE_ROAM";
          duck.stateTimer = 100;
          duck.maxStateTimer = 100;
          nextNaughtyVsGood = Math.min(100, nextNaughtyVsGood + 2);
        }
      }
      break;
    }

    case "PERFORMING_TRICK": {
      duck.stateTimer -= 1;
      duck.vx = 0;
      duck.vy = 0;

      if (activeTrick?.trick === "SPIN") {
        duck.angle += 0.25;
      }

      if (duck.stateTimer <= 0) {
        duck.state = "IDLE_ROAM";
        duck.stateTimer = 100;
        duck.maxStateTimer = 100;
        activeTrick = null;
      }
      break;
    }

    case "SNIFFING_POTTY": {
      duck.sniffCountdown -= 1;
      duck.circleAngle += 0.12;
      duck.x += Math.cos(duck.circleAngle) * 1.5;
      duck.y += Math.sin(duck.circleAngle) * 1.5;
      duck.angle = duck.circleAngle;

      if (duck.sniffCountdown <= 0) {
        // Accidental indoor puddle!
        nextNaughtyVsGood = Math.max(-100, nextNaughtyVsGood - 30);
        nextBladder = 0;
        duck.state = "IDLE_ROAM";
        duck.stateTimer = 90;
        duck.maxStateTimer = 90;
        soundCues.push("fail");

        const newPuddle: IndoorPuddle = {
          id: nextPuddleId++,
          x: Math.round(duck.x),
          y: Math.round(duck.y),
          radius: 28,
          mopProgress: 0,
        };
        nextIndoorPuddles.push(newPuddle);

        alerts.push({
          id: state.nextAlertId + 3,
          x: duck.x,
          y: duck.y - 25,
          text: "💦 Pee on the rug! Mop it up! (-30 pts)",
          color: "#ef4444",
          alpha: 1,
          vy: -1.5,
        });
      }
      break;
    }

    case "SNEAKY_CHEW": {
      const targetHazard = hazards.find((h) => h.id === activeHazardTarget);
      if (targetHazard) {
        const dx = targetHazard.x - duck.x;
        const dy = targetHazard.y - duck.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 12) {
          duck.vx = (dx / dist) * 2.2;
          duck.vy = (dy / dist) * 2.2;
          duck.x += duck.vx;
          duck.y += duck.vy;
          duck.angle = Math.atan2(dy, dx);
        } else {
          // Reached item, start chewing!
          duck.stateTimer -= 1;
          if (duck.stateTimer <= 0) {
            targetHazard.isChewed = true;
            nextNaughtyVsGood = Math.max(-100, nextNaughtyVsGood - 25);
            duck.state = "IDLE_ROAM";
            duck.stateTimer = 90;
            duck.maxStateTimer = 90;
            activeHazardTarget = null;
            soundCues.push("fail");
            alerts.push({
              id: state.nextAlertId + 4,
              x: duck.x,
              y: duck.y - 25,
              text: `💥 Chewed ${targetHazard.name}! (-25 pts)`,
              color: "#ef4444",
              alpha: 1,
              vy: -1.5,
            });
          }
        }
      } else {
        duck.state = "IDLE_ROAM";
        duck.stateTimer = 90;
        duck.maxStateTimer = 90;
      }
      break;
    }

    case "THE_FLOP": {
      duck.stateTimer -= 1;
      duck.vx = 0;
      duck.vy = 0;

      // Emit gentle heart sparkles
      if (nextTicks % 30 === 0) {
        particles.push({
          id: state.nextParticleId + particles.length,
          x: duck.x + (Math.random() - 0.5) * 30,
          y: duck.y - 10 + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -0.8 - Math.random() * 0.6,
          alpha: 1,
          color: "#f472b6",
          decay: 0.02,
          size: 8,
          shape: "heart",
        });
      }

      if (duck.stateTimer <= 0) {
        duck.state = "IDLE_ROAM";
        duck.stateTimer = 90;
        duck.maxStateTimer = 90;
      }
      break;
    }

    case "NO_TAKE_THROW": {
      duck.vx = Math.sin(nextTicks * 0.05) * 0.8;
      duck.vy = Math.cos(nextTicks * 0.05) * 0.8;
      duck.x += duck.vx;
      duck.y += duck.vy;
      duck.angle = Math.atan2(duck.vy, duck.vx);

      duck.stateTimer -= 1;
      if (duck.stateTimer <= 0) {
        duck.isCarryingBall = false;
        duck.state = "IDLE_ROAM";
        duck.stateTimer = 90;
        duck.maxStateTimer = 90;
        alerts.push({
          id: state.nextAlertId + 7,
          x: duck.x,
          y: duck.y - 25,
          text: "🎾 Dropped ball near desk!",
          color: "#a3e635",
          alpha: 1,
          vy: -1.0,
        });
      }
      break;
    }

    case "ZOOMIES": {
      duck.stateTimer -= 1;
      duck.x += duck.vx;
      duck.y += duck.vy;

      // Bounce off walls
      if (duck.x <= 50) {
        duck.x = 50;
        duck.vx = Math.abs(duck.vx);
        soundCues.push("bark");
      } else if (duck.x >= CANVAS_WIDTH - 50) {
        duck.x = CANVAS_WIDTH - 50;
        duck.vx = -Math.abs(duck.vx);
        soundCues.push("bark");
      }

      if (duck.y <= 50) {
        duck.y = 50;
        duck.vy = Math.abs(duck.vy);
        soundCues.push("bark");
      } else if (duck.y >= CANVAS_HEIGHT - 50) {
        duck.y = CANVAS_HEIGHT - 50;
        duck.vy = -Math.abs(duck.vy);
        soundCues.push("bark");
      }

      duck.angle = Math.atan2(duck.vy, duck.vx);

      particles.push({
        id: state.nextParticleId + particles.length,
        x: duck.x,
        y: duck.y,
        vx: -duck.vx * 0.2,
        vy: -duck.vy * 0.2,
        alpha: 0.8,
        color: "#fef08a",
        decay: 0.05,
        size: 6,
        shape: "circle",
      });

      if (duck.stateTimer <= 0) {
        duck.state = "IDLE_ROAM";
        duck.stateTimer = 100;
        duck.maxStateTimer = 100;
        nextExcitement = 40;
      }
      break;
    }

    case "FETCHING_BALL": {
      if (state.ball && state.ball.active) {
        const dx = state.ball.x - duck.x;
        const dy = state.ball.y - duck.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 14) {
          const speed = 5.2;
          duck.vx = (dx / dist) * speed;
          duck.vy = (dy / dist) * speed;
          duck.x += duck.vx;
          duck.y += duck.vy;
          duck.angle = Math.atan2(dy, dx);
        } else {
          duck.isCarryingBall = true;
          duck.state = "NO_TAKE_THROW";
          duck.stateTimer = 480;
          duck.maxStateTimer = 480;
          nextExcitement = Math.max(0, nextExcitement - 25);
          nextNaughtyVsGood = Math.min(100, nextNaughtyVsGood + 15);
          soundCues.push("bark");
          alerts.push({
            id: state.nextAlertId + 5,
            x: duck.x,
            y: duck.y - 25,
            text: "🎾 Caught item! (Trade treat or call Drop It)",
            color: "#38bdf8",
            alpha: 1,
            vy: -1.2,
          });
        }
      } else {
        duck.state = "IDLE_ROAM";
        duck.stateTimer = 90;
        duck.maxStateTimer = 90;
      }
      break;
    }

    case "DRAGGED": {
      break;
    }

    case "NAP_TIME": {
      duck.x = DOG_BED_BOUNDS.x + DOG_BED_BOUNDS.width / 2;
      duck.y = DOG_BED_BOUNDS.y + DOG_BED_BOUNDS.height / 2;
      duck.vx = 0;
      duck.vy = 0;
      if (nextTicks % 60 === 0) {
        soundCues.push("snore");
        particles.push({
          id: state.nextParticleId + particles.length,
          x: duck.x - 20,
          y: duck.y - 15,
          vx: -0.3,
          vy: -0.7,
          alpha: 1,
          color: "#c084fc",
          decay: 0.015,
          size: 10,
          shape: "star",
        });
      }
      break;
    }
  }

  // Universal Hard Boundary Clamping
  const clamped = clampBounds(duck.x, duck.y);
  duck.x = clamped.x;
  duck.y = clamped.y;

  // Update Particles & Alerts
  particles = particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      alpha: p.alpha - p.decay,
    }))
    .filter((p) => p.alpha > 0.02);

  alerts = alerts
    .map((a) => ({
      ...a,
      y: a.y + a.vy,
      alpha: a.alpha - 0.018,
    }))
    .filter((a) => a.alpha > 0.05);

  return {
    ...state,
    ticks: nextTicks,
    workProgress: nextWorkProgress,
    totalScore: nextScore,
    excitement: nextExcitement,
    bladder: nextBladder,
    thirst: nextThirst,
    hunger: nextHunger,
    naughtyVsGood: nextNaughtyVsGood,
    multiplier: effectiveMultiplier,
    calmBuffTimer: nextCalmBuff,
    lastImpulseTick: nextLastImpulseTick,
    comboStreak: nextComboStreak,
    comboTimer: nextComboTimer,
    activeSurpriseEvent: activeSurprise,
    activeTrick,
    officeStations: stations,
    duck,
    hazards,
    activeHazardTarget,
    indoorPuddles: nextIndoorPuddles,
    nextPuddleId,
    particles,
    floatingAlerts: alerts,
    activeSkillToast: activeToast,
    nextParticleId: state.nextParticleId + particles.length + 1,
    nextAlertId: state.nextAlertId + alerts.length + 1,
    soundCueQueue: [...state.soundCueQueue, ...soundCues],
  };
}

/**
 * Handle Level Victory & Transition to Nap Time
 */
function handleLevelVictory(
  state: WorkingWithDuckState,
  soundCues: Array<SoundCue>
): WorkingWithDuckState {
  const currentFact =
    DUCK_FACTS.find((f) => f.level === state.currentLevel) || DUCK_FACTS[0];
  const unlocked = Array.from(
    new Set([...state.unlockedFacts, state.currentLevel])
  );
  soundCues.push("ding");
  soundCues.push("snore");

  // Unlock next accessory
  const unlockedAccessories: DuckAccessory[] = Array.from(
    new Set<DuckAccessory>([
      ...state.unlockedAccessories,
      state.currentLevel === 1 ? "bucket-hat" : "none",
      state.currentLevel === 2 ? "bowtie" : "none",
      state.currentLevel === 3 ? "bandana" : "none",
      state.currentLevel === 4 ? "rain-boots" : "none",
    ])
  );

  return {
    ...state,
    status: "won",
    workProgress: state.targetWorkProgress,
    excitement: 0,
    naughtyVsGood: Math.min(100, state.naughtyVsGood + 40),
    totalScore: state.totalScore + 250,
    highScore: Math.max(state.highScore, state.totalScore + 250),
    unlockedFacts: unlocked,
    latestUnlockedFact: currentFact,
    unlockedAccessories,
    duck: {
      ...state.duck,
      state: "NAP_TIME",
      x: DOG_BED_BOUNDS.x + DOG_BED_BOUNDS.width / 2,
      y: DOG_BED_BOUNDS.y + DOG_BED_BOUNDS.height / 2,
      vx: 0,
      vy: 0,
    },
    soundCueQueue: [...state.soundCueQueue, ...soundCues],
  };
}

/**
 * Player Action: Perform Puppy Training Trick (Sit, High Five, Drop It, Spin)
 */
export function performTrick(
  state: WorkingWithDuckState,
  trick: DuckTrick
): WorkingWithDuckState {
  if (
    state.duck.state === "NAP_TIME" ||
    state.inDogPark ||
    state.inBathtub ||
    state.duck.state === "DRAGGED"
  ) {
    return state;
  }

  // One trick at a time: Duck finishes the current trick (about a second)
  // before he listens again, so holding a trick key can't farm points.
  if (state.activeTrick || state.duck.state === "PERFORMING_TRICK") {
    return state;
  }

  // A trick only answers the emergency it fits. Drop It stops chewing and
  // stolen items, Sit settles the zoomies, and a potty emergency needs a
  // potty break. Any other trick is ignored rather than cancelling it.
  const duckState = state.duck.state;
  const hasSomethingToDrop =
    duckState === "NO_TAKE_THROW" ||
    duckState === "SNEAKY_CHEW" ||
    state.duck.isCarryingBall;
  let hint: string | null = null;
  if (duckState === "SNIFFING_POTTY") {
    hint = "🚽 Duck needs a potty break, not a trick!";
  } else if (
    (duckState === "SNEAKY_CHEW" || duckState === "NO_TAKE_THROW") &&
    trick !== "DROP_IT"
  ) {
    hint = "🦴 Try 'Drop It' (E)!";
  } else if (duckState === "ZOOMIES" && trick !== "SIT") {
    hint = "⚡ Only 'Sit' (Q) settles the zoomies!";
  } else if (trick === "DROP_IT" && !hasSomethingToDrop) {
    hint = "Nothing to drop right now.";
  }
  if (hint) {
    // Show the hint once rather than stacking a copy per key press.
    if (state.floatingAlerts.some((alert) => alert.text === hint)) {
      return state;
    }
    return {
      ...state,
      floatingAlerts: [
        ...state.floatingAlerts,
        {
          id: state.nextAlertId,
          x: state.duck.x,
          y: state.duck.y - 25,
          text: hint,
          color: "#f59e0b",
          alpha: 1,
          vy: -1.2,
        },
      ],
    };
  }

  const soundCues: Array<SoundCue> = ["trick-chime"];
  let nextScore = state.totalScore;
  let nextNaughty = state.naughtyVsGood;
  let nextExcitement = state.excitement;
  // The streak keeps counting, but its score bonus is capped at 3x, matching
  // the multiplier bonus in stepDuckGame.
  // Sit, High Five and Spin burn off Duck's excitement, so they pay most
  // when he's wound up and very little when he's already calm. Spamming
  // tricks keeps him calm and earns almost nothing. Drop It always answers
  // a real problem, so it always pays in full.
  const need = trick === "DROP_IT" ? 1 : clamp(state.excitement / 60, 0.1, 1);
  // Only a trick Duck needed extends the combo. The streak's score bonus is
  // capped at 3x, matching the multiplier bonus in stepDuckGame.
  const extendsCombo = need >= 0.5;
  const comboStreak = extendsCombo ? state.comboStreak + 1 : state.comboStreak;
  const comboMultiplier = clamp(comboStreak, 1, 3);
  const scaled = (value: number) => Math.round(value * need);
  const alerts = [...state.floatingAlerts];
  const particles = [...state.particles];

  if (trick === "DROP_IT") {
    // Drops any stolen item or ball immediately
    if (state.duck.state === "NO_TAKE_THROW" || state.duck.isCarryingBall) {
      soundCues.push("ding");
      nextNaughty = Math.min(100, nextNaughty + 30);
      nextScore += 60 * comboMultiplier;
      alerts.push({
        id: state.nextAlertId,
        x: state.duck.x,
        y: state.duck.y - 25,
        text: "🎾 Perfect 'Drop It'! (+60 pts)",
        color: "#22c55e",
        alpha: 1,
        vy: -1.2,
      });
    } else if (state.duck.state === "SNEAKY_CHEW") {
      soundCues.push("ding");
      nextNaughty = Math.min(100, nextNaughty + 35);
      nextScore += 75 * comboMultiplier;
      alerts.push({
        id: state.nextAlertId,
        x: state.duck.x,
        y: state.duck.y - 25,
        text: "⚡ Intercepted Chew with 'Drop It'! (+75 pts)",
        color: "#22c55e",
        alpha: 1,
        vy: -1.2,
      });
    }
  } else if (trick === "HIGH_FIVE") {
    soundCues.push("paw-clap");
    nextNaughty = Math.min(100, nextNaughty + scaled(20));
    nextScore += scaled(45) * comboMultiplier;
    nextExcitement = Math.max(0, nextExcitement - 15);
    alerts.push({
      id: state.nextAlertId,
      x: state.duck.x,
      y: state.duck.y - 25,
      text: `🐾 High Five! (+${scaled(45) * comboMultiplier} pts)`,
      color: "#ec4899",
      alpha: 1,
      vy: -1.2,
    });
  } else if (trick === "SIT") {
    soundCues.push("ding");
    nextNaughty = Math.min(100, nextNaughty + scaled(18));
    nextScore += scaled(35) * comboMultiplier;
    nextExcitement = Math.max(0, nextExcitement - 20);
    alerts.push({
      id: state.nextAlertId,
      x: state.duck.x,
      y: state.duck.y - 25,
      text: "🪑 Good Sit! (-20 Excitement)",
      color: "#38bdf8",
      alpha: 1,
      vy: -1.2,
    });
  } else if (trick === "SPIN") {
    soundCues.push("spin-whoosh");
    nextNaughty = Math.min(100, nextNaughty + scaled(22));
    nextScore += scaled(50) * comboMultiplier;
    nextExcitement = Math.max(0, nextExcitement - 10);
    alerts.push({
      id: state.nextAlertId,
      x: state.duck.x,
      y: state.duck.y - 25,
      text: `🌀 Spin Trick! (+${scaled(50) * comboMultiplier} pts)`,
      color: "#a855f7",
      alpha: 1,
      vy: -1.2,
    });
  }

  // Particle burst for successful trick
  particles.push({
    id: state.nextParticleId + 1,
    x: state.duck.x,
    y: state.duck.y,
    vx: 0,
    vy: -1.2,
    alpha: 1,
    color: "#fde047",
    decay: 0.02,
    size: 12,
    shape: "star",
  });

  return {
    ...state,
    totalScore: nextScore,
    naughtyVsGood: nextNaughty,
    excitement: nextExcitement,
    comboStreak,
    comboTimer: extendsCombo ? 180 : state.comboTimer,
    activeTrick: {
      trick,
      timer: 60,
      maxTimer: 60,
    },
    duck: {
      ...state.duck,
      state: "PERFORMING_TRICK",
      stateTimer: 60,
      maxStateTimer: 60,
      isCarryingBall: false,
    },
    particles,
    floatingAlerts: alerts,
    soundCueQueue: [...state.soundCueQueue, ...soundCues],
  };
}

/**
 * Player Action: Active Coding / Commit Burst at Desk (Spacebar or Desk Click)
 */
export function activeCodeBurst(
  state: WorkingWithDuckState
): WorkingWithDuckState {
  if (state.status !== "running" || state.inDogPark || state.inBathtub)
    return state;

  // Bursts are rate-limited, so mashing Space faster than a person types
  // doesn't finish a sprint in seconds.
  if (
    state.activeCodeBursts > 0 &&
    state.ticks - state.lastCodeTick < CODE_BURST_MIN_TICKS
  ) {
    return state;
  }

  // While Duck has an emergency, the player can't focus on code: the burst
  // does nothing until Duck is dealt with.
  if (
    state.duck.state === "SNIFFING_POTTY" ||
    state.duck.state === "SNEAKY_CHEW" ||
    state.duck.state === "ZOOMIES"
  ) {
    return state;
  }

  const effectiveMultiplier = state.multiplier;
  const progressBoost = 0.45 * effectiveMultiplier;
  const nextWork = Math.min(
    state.targetWorkProgress,
    state.workProgress + progressBoost
  );
  const nextScore = state.totalScore + Math.round(5 * effectiveMultiplier);
  const soundCues: Array<SoundCue> = ["code-type"];

  const particles = [
    ...state.particles,
    {
      id: state.nextParticleId + 1,
      x: DESK_BOUNDS.x + 85 + (Math.random() - 0.5) * 40,
      y: DESK_BOUNDS.y + 60,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -1.5 - Math.random(),
      alpha: 1,
      color: "#22c55e",
      decay: 0.03,
      size: 5,
      shape: "spark" as const,
    },
  ];

  return {
    ...state,
    workProgress: nextWork,
    totalScore: nextScore,
    activeCodeBursts: state.activeCodeBursts + 1,
    lastCodeTick: state.ticks,
    particles,
    soundCueQueue: [...state.soundCueQueue, ...soundCues],
  };
}

/**
 * Player Action: Interact with Office Station (Water Bowl, Food Bowl, Dog Bed)
 */
export function interactStation(
  state: WorkingWithDuckState,
  stationId: "water" | "food" | "bed" | "bath"
): WorkingWithDuckState {
  const stations = { ...state.officeStations };
  const alerts = [...state.floatingAlerts];
  const soundCues: Array<SoundCue> = [];

  if (stationId === "water") {
    stations.waterLevel = 100;
    soundCues.push("water-lap");
    alerts.push({
      id: state.nextAlertId,
      x: WATER_BOWL_BOUNDS.x + 25,
      y: WATER_BOWL_BOUNDS.y - 15,
      text: "💧 Fresh Water Refilled (100%)",
      color: "#38bdf8",
      alpha: 1,
      vy: -1.2,
    });
  } else if (stationId === "food") {
    stations.foodLevel = 100;
    soundCues.push("crunch-kibble");
    alerts.push({
      id: state.nextAlertId,
      x: FOOD_BOWL_BOUNDS.x + 25,
      y: FOOD_BOWL_BOUNDS.y - 15,
      text: "🍖 Premium Puppy Kibble Poured!",
      color: "#fbbf24",
      alpha: 1,
      vy: -1.2,
    });
  } else if (stationId === "bed") {
    if (state.excitement <= 30 || state.calmBuffTimer > 0) {
      soundCues.push("snore");
      return {
        ...state,
        duck: {
          ...state.duck,
          state: "NAP_TIME",
          x: DOG_BED_BOUNDS.x + DOG_BED_BOUNDS.width / 2,
          y: DOG_BED_BOUNDS.y + DOG_BED_BOUNDS.height / 2,
          vx: 0,
          vy: 0,
        },
        soundCueQueue: [...state.soundCueQueue, ...soundCues],
      };
    } else {
      alerts.push({
        id: state.nextAlertId,
        x: DOG_BED_BOUNDS.x + 60,
        y: DOG_BED_BOUNDS.y - 15,
        text: "🐾 Duck is too excited to sleep! Wear him out first.",
        color: "#f59e0b",
        alpha: 1,
        vy: -1.2,
      });
    }
  } else if (stationId === "bath") {
    return enterBathtub(state);
  }

  return {
    ...state,
    officeStations: stations,
    floatingAlerts: alerts,
    soundCueQueue: [...state.soundCueQueue, ...soundCues],
  };
}

/**
 * Bathtub Washroom Mini-Game Transitions & Logic
 */
export function enterBathtub(
  state: WorkingWithDuckState
): WorkingWithDuckState {
  return {
    ...state,
    inBathtub: true,
    bathtubState: {
      status: "soap",
      soapLather: 0,
      rinseLevel: 0,
      scrubCount: 0,
      bubbles: [
        { id: 1, x: 380, y: 220, size: 14, alpha: 0.8 },
        { id: 2, x: 420, y: 200, size: 18, alpha: 0.9 },
        { id: 3, x: 400, y: 250, size: 12, alpha: 0.7 },
      ],
    },
    soundCueQueue: [...state.soundCueQueue, "bath-soap"],
  };
}

export function scrubBathtub(
  state: WorkingWithDuckState,
  x: number,
  y: number
): WorkingWithDuckState {
  if (!state.inBathtub || state.bathtubState.soapLather >= 100) return state;

  const bath = { ...state.bathtubState };
  const nextScrubCount = bath.scrubCount + 1;
  const nextLather = Math.min(100, bath.soapLather + 12);
  const soundCues: Array<SoundCue> = [];

  if (nextScrubCount % 4 === 0) {
    soundCues.push("bath-soap");
  }

  const nextBubbles = [
    ...bath.bubbles,
    {
      id: state.nextParticleId + nextScrubCount,
      x: x + (Math.random() - 0.5) * 40,
      y: y + (Math.random() - 0.5) * 30,
      size: 8 + Math.random() * 12,
      alpha: 1,
    },
  ];

  return {
    ...state,
    bathtubState: {
      ...bath,
      soapLather: nextLather,
      scrubCount: nextScrubCount,
      status: nextLather >= 100 ? "rinse" : "scrub",
      bubbles: nextBubbles,
    },
    soundCueQueue: [...state.soundCueQueue, ...soundCues],
  };
}

export function rinseBathtub(
  state: WorkingWithDuckState
): WorkingWithDuckState {
  if (!state.inBathtub) return state;

  const bath = { ...state.bathtubState };
  const nextRinse = Math.min(100, bath.rinseLevel + 25);
  const isClean = nextRinse >= 100;
  const soundCues: Array<SoundCue> = ["bath-rinse"];

  if (isClean) {
    soundCues.push("combo-fanfare");
  }

  return {
    ...state,
    bathtubState: {
      ...bath,
      rinseLevel: nextRinse,
      status: isClean ? "clean" : "rinse",
    },
    soundCueQueue: [...state.soundCueQueue, ...soundCues],
  };
}

export function stepBathtubGame(
  state: WorkingWithDuckState
): WorkingWithDuckState {
  const nextTicks = state.ticks + 1;
  const bath = { ...state.bathtubState };
  const bubbles = bath.bubbles
    .map((b) => ({
      ...b,
      y: b.y - 0.2,
      alpha: b.alpha - 0.003,
    }))
    .filter((b) => b.alpha > 0.05);

  const particles = state.particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      alpha: p.alpha - p.decay,
    }))
    .filter((p) => p.alpha > 0.02);

  const alerts = state.floatingAlerts
    .map((a) => ({
      ...a,
      y: a.y + a.vy,
      alpha: a.alpha - 0.018,
    }))
    .filter((a) => a.alpha > 0.05);

  return {
    ...state,
    ticks: nextTicks,
    bathtubState: {
      ...bath,
      bubbles,
    },
    particles,
    floatingAlerts: alerts,
  };
}

export function exitBathtub(state: WorkingWithDuckState): WorkingWithDuckState {
  const isClean =
    state.bathtubState.status === "clean" ||
    state.bathtubState.rinseLevel >= 100;
  const scoreBonus = isClean ? 120 : 30;

  return {
    ...state,
    inBathtub: false,
    isMuddy: false,
    totalScore: state.totalScore + scoreBonus,
    naughtyVsGood: Math.min(100, state.naughtyVsGood + (isClean ? 35 : 10)),
    calmBuffTimer: isClean ? 1200 : 300,
    floatingAlerts: [
      ...state.floatingAlerts,
      {
        id: state.nextAlertId,
        x: BATHTUB_BOUNDS.x,
        y: BATHTUB_BOUNDS.y - 15,
        text: isClean
          ? "✨ Fresh & Clean Puppy! (+120 pts & Calm Buff)"
          : "🐾 Bathtime Finished",
        color: "#38bdf8",
        alpha: 1,
        vy: -1.2,
      },
    ],
    soundCueQueue: [...state.soundCueQueue, "ding"],
  };
}

/**
 * Player Action: Equip Wearable Accessory
 */
export function equipAccessory(
  state: WorkingWithDuckState,
  accessory: DuckAccessory
): WorkingWithDuckState {
  if (!state.unlockedAccessories.includes(accessory)) return state;

  return {
    ...state,
    activeAccessory: accessory,
    soundCueQueue: [...state.soundCueQueue, "ding"],
  };
}

/**
 * Player Action: Throw Tennis Ball / Frisbee (Drains Excitement)
 */
export function throwBall(
  state: WorkingWithDuckState,
  targetX: number,
  targetY: number
): WorkingWithDuckState {
  if (state.duck.state === "NAP_TIME" || state.inDogPark || state.inBathtub)
    return state;

  const clampedTarget = clampBounds(targetX, targetY);

  return {
    ...state,
    ball: {
      x: clampedTarget.x,
      y: clampedTarget.y,
      vx: 0,
      vy: 0,
      active: true,
    },
    duck: {
      ...state.duck,
      state: "FETCHING_BALL",
      targetX: clampedTarget.x,
      targetY: clampedTarget.y,
    },
    soundCueQueue: [...state.soundCueQueue, "squeak"],
  };
}

/**
 * Player Action: Use Squeaky Toy to Recall and Redirect Duck
 */
export function applySqueakyToy(
  state: WorkingWithDuckState,
  x: number,
  y: number
): WorkingWithDuckState {
  let nextNaughtyVsGood = state.naughtyVsGood;
  let activeToast = state.activeSkillToast;
  let activeHazard = state.activeHazardTarget;
  let comboStreak = state.comboStreak;
  let nextScore = state.totalScore;
  const soundCues: Array<SoundCue> = ["squeak"];
  const clamped = clampBounds(x, y);
  let nextHazards = state.hazards;

  if (state.duck.state === "SNEAKY_CHEW" && activeHazard) {
    const savedHazard = state.hazards.find((h) => h.id === activeHazard);
    if (savedHazard) {
      nextHazards = state.hazards.map((h) =>
        h.id === activeHazard ? { ...h, isChewed: false } : h
      );
      nextNaughtyVsGood = Math.min(100, nextNaughtyVsGood + 30);
      comboStreak += 1;
      nextScore += 50 * comboStreak;
      if (comboStreak >= 3) {
        soundCues.push("combo-fanfare");
      }
      activeToast = {
        badge: savedHazard.skillBadge,
        text: savedHazard.saveTooltip,
        timer: 180,
      };
    }
    activeHazard = null;
  }

  return {
    ...state,
    totalScore: nextScore,
    comboStreak,
    comboTimer: 180,
    excitement: Math.max(0, state.excitement - 15),
    naughtyVsGood: nextNaughtyVsGood,
    hazards: nextHazards,
    activeHazardTarget: activeHazard,
    activeSkillToast: activeToast,
    duck: {
      ...state.duck,
      state: "IDLE_ROAM",
      targetX: clamped.x,
      targetY: clamped.y,
      stateTimer: 120,
      maxStateTimer: 120,
    },
    soundCueQueue: [...state.soundCueQueue, ...soundCues],
  };
}

/**
 * Player Action: Use Kong Chew Toy (Distracts from Hazards & Calms)
 */
export function applyKongToy(
  state: WorkingWithDuckState,
  x: number,
  y: number
): WorkingWithDuckState {
  const clamped = clampBounds(x, y);
  let activeHazard = state.activeHazardTarget;
  let activeToast = state.activeSkillToast;
  let nextScore = state.totalScore;
  let nextNaughty = Math.min(100, state.naughtyVsGood + 20);
  let nextHazards = state.hazards;

  if (state.duck.state === "SNEAKY_CHEW" && activeHazard) {
    const savedHazard = state.hazards.find((h) => h.id === activeHazard);
    if (savedHazard) {
      nextHazards = state.hazards.map((h) =>
        h.id === activeHazard ? { ...h, isChewed: false } : h
      );
      nextNaughty = Math.min(100, nextNaughty + 25);
      nextScore += 60;
      activeToast = {
        badge: savedHazard.skillBadge,
        text: savedHazard.saveTooltip,
        timer: 180,
      };
    }
    activeHazard = null;
  }

  return {
    ...state,
    totalScore: nextScore,
    excitement: Math.max(0, state.excitement - 25),
    naughtyVsGood: nextNaughty,
    comboTimer: 180,
    hazards: nextHazards,
    activeHazardTarget: activeHazard,
    activeSkillToast: activeToast,
    duck: {
      ...state.duck,
      state: "IDLE_ROAM",
      targetX: clamped.x,
      targetY: clamped.y,
      stateTimer: 200,
      maxStateTimer: 200,
    },
    soundCueQueue: [...state.soundCueQueue, "ding"],
  };
}

/**
 * Player Action: Trade Treat for Ball ("No Take, Only Throw") or Direct Treat Reward
 */
export function giveTreat(state: WorkingWithDuckState): WorkingWithDuckState {
  if (state.duck.state === "NO_TAKE_THROW") {
    const comboStreak = state.comboStreak + 1;
    const soundCues: Array<SoundCue> = ["ding"];
    if (comboStreak >= 3) {
      soundCues.push("combo-fanfare");
    }

    return {
      ...state,
      comboStreak,
      comboTimer: 180,
      naughtyVsGood: Math.min(100, state.naughtyVsGood + 25),
      excitement: Math.max(0, state.excitement - 10),
      totalScore: state.totalScore + 35 * comboStreak,
      duck: {
        ...state.duck,
        isCarryingBall: false,
        state: "IDLE_ROAM",
        stateTimer: 90,
        maxStateTimer: 90,
      },
      floatingAlerts: [
        ...state.floatingAlerts,
        {
          id: state.nextAlertId,
          x: state.duck.x,
          y: state.duck.y - 25,
          text: `🍖 Ball Traded! (${comboStreak > 1 ? comboStreak + "× Combo! " : ""}+${35 * comboStreak} pts)`,
          color: "#22c55e",
          alpha: 1,
          vy: -1.2,
        },
      ],
      soundCueQueue: [...state.soundCueQueue, ...soundCues],
    };
  }

  // Regular treat gives gentle excitement drop & Good Boy points
  return {
    ...state,
    excitement: Math.max(0, state.excitement - 8),
    naughtyVsGood: Math.min(100, state.naughtyVsGood + 10),
    soundCueQueue: [...state.soundCueQueue, "ding"],
  };
}

/**
 * Player Action: Scrub Cursor over Duck during The Flop (Belly Rubs)
 */
export function scrubBelly(
  state: WorkingWithDuckState,
  x: number,
  y: number
): WorkingWithDuckState {
  if (state.duck.state !== "THE_FLOP") return state;

  const dx = x - state.duck.x;
  const dy = y - state.duck.y;
  if (Math.hypot(dx, dy) > 50) return state;

  const nextScrubCount = state.bellyRubScrubCount + 1;
  const nextProgress = Math.min(100, state.bellyRubProgress + 8);
  const newParticles = [...state.particles];
  const soundCues: Array<SoundCue> = [];

  if (nextScrubCount % 5 === 0) {
    soundCues.push("belly-rub");
  }

  newParticles.push({
    id: state.nextParticleId + nextScrubCount,
    x: state.duck.x + (Math.random() - 0.5) * 30,
    y: state.duck.y + (Math.random() - 0.5) * 20,
    vx: (Math.random() - 0.5) * 1.2,
    vy: -1.4 - Math.random() * 0.8,
    alpha: 1,
    color: "#ec4899",
    decay: 0.025,
    size: 10,
    shape: "heart",
  });

  if (nextProgress >= 100) {
    soundCues.push("combo-fanfare");
    return {
      ...state,
      bellyRubScrubCount: 0,
      bellyRubProgress: 0,
      excitement: 0,
      naughtyVsGood: Math.min(100, state.naughtyVsGood + 30),
      totalScore: state.totalScore + 100,
      calmBuffTimer: 600,
      duck: {
        ...state.duck,
        state: "IDLE_ROAM",
        stateTimer: 120,
        maxStateTimer: 120,
      },
      floatingAlerts: [
        ...state.floatingAlerts,
        {
          id: state.nextAlertId,
          x: state.duck.x,
          y: state.duck.y - 30,
          text: "💖 Belly Rub Complete! (+100 pts & Calm Buff)",
          color: "#ec4899",
          alpha: 1,
          vy: -1.5,
        },
      ],
      particles: newParticles,
      soundCueQueue: [...state.soundCueQueue, ...soundCues],
    };
  }

  const nextExcitement = Math.max(0, state.excitement - 2.5);
  const nextNaughtyVsGood = Math.min(100, state.naughtyVsGood + 1.2);

  return {
    ...state,
    bellyRubScrubCount: nextScrubCount,
    bellyRubProgress: nextProgress,
    excitement: nextExcitement,
    naughtyVsGood: nextNaughtyVsGood,
    particles: newParticles,
    soundCueQueue: [...state.soundCueQueue, ...soundCues],
  };
}

/**
 * Player Action: Mop up an indoor bladder puddle by clicking / scrubbing over it
 */
export function mopIndoorPuddle(
  state: WorkingWithDuckState,
  x: number,
  y: number
): WorkingWithDuckState {
  if (!state.indoorPuddles || state.indoorPuddles.length === 0) return state;

  const soundCues: Array<SoundCue> = [];
  const particles: Particle[] = [...state.particles];
  const alerts: FloatingAlert[] = [...state.floatingAlerts];
  let scoreGained = 0;
  let nextNaughty = state.naughtyVsGood;
  let didClean = false;

  const nextPuddles = state.indoorPuddles
    .map((puddle) => {
      const dist = Math.hypot(x - puddle.x, y - puddle.y);
      if (dist <= puddle.radius + 15) {
        didClean = true;
        const nextProgress = puddle.mopProgress + 35;
        soundCues.push("bath-soap");

        particles.push({
          id: state.nextParticleId + particles.length,
          x: puddle.x + (Math.random() - 0.5) * puddle.radius,
          y: puddle.y + (Math.random() - 0.5) * puddle.radius,
          vx: (Math.random() - 0.5) * 1.0,
          vy: -1.0 - Math.random() * 0.8,
          alpha: 1,
          color: "#38bdf8",
          decay: 0.03,
          size: 6,
          shape: "water",
        });

        if (nextProgress >= 100) {
          scoreGained += 50;
          nextNaughty = Math.min(100, nextNaughty + 15);
          soundCues.push("ding");
          alerts.push({
            id: state.nextAlertId + alerts.length,
            x: puddle.x,
            y: puddle.y - 15,
            text: "✨ Floor Mopped Clean! (+50 pts)",
            color: "#22c55e",
            alpha: 1,
            vy: -1.2,
          });
          return null;
        }

        return {
          ...puddle,
          mopProgress: nextProgress,
        };
      }
      return puddle;
    })
    .filter((p): p is IndoorPuddle => p !== null);

  if (!didClean) return state;

  return {
    ...state,
    indoorPuddles: nextPuddles,
    totalScore: state.totalScore + scoreGained,
    naughtyVsGood: nextNaughty,
    particles,
    floatingAlerts: alerts,
    soundCueQueue: [...state.soundCueQueue, ...soundCues],
  };
}

/**
 * Player Action: Start dragging Duck
 */
export function startDraggingDuck(
  state: WorkingWithDuckState
): WorkingWithDuckState {
  if (state.duck.state === "NAP_TIME" || state.inBathtub) return state;
  return {
    ...state,
    duck: {
      ...state.duck,
      state: "DRAGGED",
    },
  };
}

/**
 * Player Action: Drag Duck position
 */
export function dragDuckTo(
  state: WorkingWithDuckState,
  x: number,
  y: number
): WorkingWithDuckState {
  const clamped = clampBounds(x, y);
  return {
    ...state,
    duck: {
      ...state.duck,
      x: clamped.x,
      y: clamped.y,
      angle: 0,
    },
  };
}

/**
 * Player Action: Release Duck
 */
export function releaseDuck(state: WorkingWithDuckState): WorkingWithDuckState {
  if (state.duck.state !== "DRAGGED") return state;

  // Dropped at back door
  if (
    state.duck.x >= BACK_DOOR_BOUNDS.x &&
    state.duck.x <= BACK_DOOR_BOUNDS.x + BACK_DOOR_BOUNDS.width &&
    state.duck.y >= BACK_DOOR_BOUNDS.y &&
    state.duck.y <= BACK_DOOR_BOUNDS.y + BACK_DOOR_BOUNDS.height
  ) {
    return {
      ...state,
      bladder: 0,
      naughtyVsGood: Math.min(100, state.naughtyVsGood + 35),
      totalScore: state.totalScore + 75,
      duck: {
        ...state.duck,
        state: "IDLE_ROAM",
        x: 480,
        y: 300,
        targetX: 430,
        targetY: 240,
        stateTimer: 120,
        maxStateTimer: 120,
      },
      floatingAlerts: [
        ...state.floatingAlerts,
        {
          id: state.nextAlertId,
          x: BACK_DOOR_BOUNDS.x,
          y: BACK_DOOR_BOUNDS.y - 10,
          text: "🌟 Good Boy! Potty Outside! (+75 pts)",
          color: "#22c55e",
          alpha: 1,
          vy: -1.5,
        },
      ],
      soundCueQueue: [...state.soundCueQueue, "ding"],
    };
  }

  // Dropped at bathtub
  if (
    state.duck.x >= BATHTUB_BOUNDS.x &&
    state.duck.x <= BATHTUB_BOUNDS.x + BATHTUB_BOUNDS.width &&
    state.duck.y >= BATHTUB_BOUNDS.y &&
    state.duck.y <= BATHTUB_BOUNDS.y + BATHTUB_BOUNDS.height
  ) {
    return enterBathtub(state);
  }

  return {
    ...state,
    duck: {
      ...state.duck,
      state: "IDLE_ROAM",
      targetX: state.duck.x,
      targetY: state.duck.y,
      stateTimer: 90,
      maxStateTimer: 90,
    },
  };
}

/**
 * Dog Park Mini-Game Transitions & Logic
 */
export function enterDogPark(
  state: WorkingWithDuckState,
  mode: "ball" | "frisbee" = "ball"
): WorkingWithDuckState {
  return {
    ...state,
    inDogPark: true,
    parkState: {
      status: "aim",
      mode,
      ballX: 120,
      ballY: 250,
      ballVx: 0,
      ballVy: 0,
      duckX: 90,
      duckY: 250,
      duckVx: 0,
      duckVy: 0,
      duckAngle: 0,
      duckIsJumping: false,
      jumpHeight: 0,
      puddles: [
        { x: 360, y: 160, radius: 36 },
        { x: 480, y: 320, radius: 40 },
        { x: 620, y: 190, radius: 34 },
      ],
      bones: [
        { id: 1, x: 280, y: 150, collected: false },
        { id: 2, x: 440, y: 240, collected: false },
        { id: 3, x: 580, y: 310, collected: false },
      ],
      bonesCollected: 0,
      hurdles: [
        { id: 1, x: 320, y: 220, width: 28, height: 44, cleared: false },
        { id: 2, x: 520, y: 200, width: 28, height: 44, cleared: false },
      ],
      hurdlesCleared: 0,
      friends: [
        {
          id: 1,
          name: "Luna the Corgi",
          breed: "corgi",
          x: 240,
          y: 360,
          greeted: false,
        },
        {
          id: 2,
          name: "Barnaby",
          breed: "golden",
          x: 670,
          y: 120,
          greeted: false,
        },
      ],
      whistleTaps: 0,
      timer: 0,
    },
    soundCueQueue: [...state.soundCueQueue, "whistle"],
  };
}

export function throwParkBall(
  state: WorkingWithDuckState,
  powerX: number,
  powerY: number
): WorkingWithDuckState {
  if (!state.inDogPark || state.parkState.status !== "aim") return state;

  const isFrisbee = state.parkState.mode === "frisbee";
  return {
    ...state,
    parkState: {
      ...state.parkState,
      status: "thrown",
      ballX: 120,
      ballY: 250,
      ballVx: isFrisbee ? clamp(powerX * 1.2, 9, 16) : clamp(powerX, 7, 14),
      ballVy: clamp(powerY, -6, 6),
    },
    soundCueQueue: [
      ...state.soundCueQueue,
      isFrisbee ? "frisbee-throw" : "squeak",
    ],
  };
}

export function jumpParkHurdle(
  state: WorkingWithDuckState
): WorkingWithDuckState {
  if (!state.inDogPark) return state;

  return {
    ...state,
    parkState: {
      ...state.parkState,
      duckIsJumping: true,
      jumpHeight: 28,
    },
    soundCueQueue: [...state.soundCueQueue, "spin-whoosh"],
  };
}

export function steerParkDuck(
  state: WorkingWithDuckState,
  targetY: number
): WorkingWithDuckState {
  if (!state.inDogPark || state.parkState.status !== "retrieving") return state;

  const clampedY = clamp(targetY, 50, CANVAS_HEIGHT - 50);
  return {
    ...state,
    parkState: {
      ...state.parkState,
      duckY: clampedY,
    },
  };
}

export function tapParkWhistle(
  state: WorkingWithDuckState
): WorkingWithDuckState {
  if (!state.inDogPark) return state;

  const park = state.parkState;
  const newY = Math.max(60, park.duckY - 35);

  return {
    ...state,
    parkState: {
      ...park,
      whistleTaps: park.whistleTaps + 1,
      duckY: newY,
    },
    soundCueQueue: [...state.soundCueQueue, "whistle"],
  };
}

export function stepParkGame(
  state: WorkingWithDuckState
): WorkingWithDuckState {
  const nextTicks = state.ticks + 1;
  const park = { ...state.parkState };
  const soundCues: Array<SoundCue> = [];
  let nextScore = state.totalScore;
  let bonesCollected = park.bonesCollected;
  let hurdlesCleared = park.hurdlesCleared;
  const bones = park.bones.map((b) => ({ ...b }));
  const hurdles = park.hurdles.map((h) => ({ ...h }));
  const friends = park.friends.map((f) => ({ ...f }));

  // Jump decay
  if (park.duckIsJumping) {
    park.jumpHeight = Math.max(0, park.jumpHeight - 1.2);
    if (park.jumpHeight <= 0) {
      park.duckIsJumping = false;
    }
  }

  if (park.status === "thrown") {
    park.ballX += park.ballVx;
    park.ballY += park.ballVy;
    park.ballVx *= 0.98;
    park.ballVy *= 0.98;

    park.ballX = clamp(park.ballX, 60, CANVAS_WIDTH - 60);
    park.ballY = clamp(park.ballY, 60, CANVAS_HEIGHT - 60);

    const dx = park.ballX - park.duckX;
    const dy = park.ballY - park.duckY;
    const dist = Math.hypot(dx, dy);

    if (dist > 15) {
      park.duckX += (dx / dist) * 7.5;
      park.duckY += (dy / dist) * 7.5;
      park.duckAngle = Math.atan2(dy, dx);

      // Check hurdle clearing
      for (const hurdle of hurdles) {
        if (!hurdle.cleared) {
          const hDist = Math.hypot(
            park.duckX - hurdle.x,
            park.duckY - hurdle.y
          );
          if (hDist < 35 && park.duckIsJumping && park.jumpHeight > 10) {
            hurdle.cleared = true;
            hurdlesCleared += 1;
            nextScore += 60;
            soundCues.push("ding");
          }
        }
      }
    } else {
      park.status = "retrieving";
      soundCues.push("bark");
    }
  } else if (park.status === "retrieving") {
    const targetX = 90;
    const targetY = 250;
    const dx = targetX - park.duckX;
    const dy = targetY - park.duckY;
    const dist = Math.hypot(dx, dy);

    if (dist > 15) {
      park.duckX += (dx / dist) * 4.8;
      park.duckY += (dy / dist) * 2.4;
      park.duckAngle = Math.atan2(dy, dx);

      // Bone collections
      for (const bone of bones) {
        if (!bone.collected) {
          const bDist = Math.hypot(park.duckX - bone.x, park.duckY - bone.y);
          if (bDist < 30) {
            bone.collected = true;
            bonesCollected += 1;
            nextScore += 50;
            soundCues.push("ding");
          }
        }
      }

      // Friendly dog greetings
      for (const friend of friends) {
        if (!friend.greeted) {
          const fDist = Math.hypot(
            park.duckX - friend.x,
            park.duckY - friend.y
          );
          if (fDist < 45) {
            friend.greeted = true;
            nextScore += 40;
            soundCues.push("bark");
          }
        }
      }

      // Mud puddle collisions (Rain boots provide mud protection!)
      if (state.activeAccessory !== "rain-boots" && !park.duckIsJumping) {
        for (const puddle of park.puddles) {
          const pDist = Math.hypot(
            park.duckX - puddle.x,
            park.duckY - puddle.y
          );
          if (pDist < puddle.radius + 12) {
            park.status = "muddy";
            soundCues.push("fail");
            break;
          }
        }
      }
    } else {
      park.status = "success";
      soundCues.push("combo-fanfare");
    }
  }

  park.duckX = clamp(park.duckX, 50, CANVAS_WIDTH - 50);
  park.duckY = clamp(park.duckY, 50, CANVAS_HEIGHT - 50);

  const particles = state.particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      alpha: p.alpha - p.decay,
    }))
    .filter((p) => p.alpha > 0.02);

  const alerts = state.floatingAlerts
    .map((a) => ({
      ...a,
      y: a.y + a.vy,
      alpha: a.alpha - 0.018,
    }))
    .filter((a) => a.alpha > 0.05);

  return {
    ...state,
    ticks: nextTicks,
    totalScore: nextScore,
    parkState: {
      ...park,
      bones,
      bonesCollected,
      hurdles,
      hurdlesCleared,
      friends,
    },
    particles,
    floatingAlerts: alerts,
    soundCueQueue: [...state.soundCueQueue, ...soundCues],
  };
}

export function exitDogPark(
  state: WorkingWithDuckState,
  isSuccess: boolean
): WorkingWithDuckState {
  const nextExcitement = 0;
  const nextBladder = 0;
  const bonusFromBones = state.parkState.bonesCollected * 10;
  const bonusFromHurdles = state.parkState.hurdlesCleared * 15;
  const nextNaughtyVsGood = isSuccess
    ? Math.min(
        100,
        state.naughtyVsGood + 30 + bonusFromBones + bonusFromHurdles
      )
    : state.naughtyVsGood;
  const calmTimer = isSuccess ? 1800 : 600;
  const isMuddy = state.parkState.status === "muddy";

  return {
    ...state,
    inDogPark: false,
    isMuddy,
    excitement: nextExcitement,
    bladder: nextBladder,
    naughtyVsGood: nextNaughtyVsGood,
    calmBuffTimer: calmTimer,
    duck: {
      ...state.duck,
      x: 430,
      y: 240,
      state: "IDLE_ROAM",
      stateTimer: 120,
      maxStateTimer: 120,
    },
    floatingAlerts: [
      ...state.floatingAlerts,
      {
        id: state.nextAlertId,
        x: 400,
        y: 200,
        text: isMuddy
          ? "🧼 Duck got muddy! Take him to the Bathtub!"
          : isSuccess
            ? `🌲 Park Trip Success! (Tired Puppy Buff 30s +${state.parkState.bonesCollected} Bones)`
            : "🐾 Returned from park",
        color: isMuddy ? "#f59e0b" : isSuccess ? "#22c55e" : "#f59e0b",
        alpha: 1,
        vy: -1.2,
      },
    ],
  };
}

export function advanceToNextLevel(
  state: WorkingWithDuckState
): WorkingWithDuckState {
  const nextLevel = state.currentLevel + 1;
  const isComplete = nextLevel > SPRINTS.length;
  const nextState = isComplete
    ? createInitialDuckGameState(
        5,
        "endless",
        state.unlockedAccessories,
        state.unlockedFacts
      )
    : createInitialDuckGameState(
        nextLevel,
        "campaign",
        state.unlockedAccessories,
        state.unlockedFacts
      );

  // Progression must resume simulation immediately: callers advance from a
  // terminal "won" state and rely on this returning a "running" state so the
  // next tick actually progresses instead of sitting idle.
  return { ...nextState, status: "running" };
}

import { ArcadeEngine } from "@/lib/arcade/core/engine";

export interface WorkingWithDuckSnapshot {
  status: WorkingWithDuckState["status"];
  score: number;
  multiplier: number;
  currentLevel: number;
  duck: {
    x: number;
    y: number;
    behaviorState: DuckBehaviorState;
    mood: DuckMood;
  };
  excitement: number;
  bladder: number;
  naughtyVsGood: number;
  isMuddy: boolean;
}

export class WorkingWithDuckEngine extends ArcadeEngine<
  WorkingWithDuckState,
  WorkingWithDuckSnapshot
> {
  constructor(level = 1, mode: "campaign" | "endless" = "campaign") {
    super(createInitialDuckGameState(level, mode));
  }

  public override init(): void {
    // init
  }

  public performTrick(trick: DuckTrick): void {
    this.state.activeTrick = { trick, timer: 90, maxTimer: 90 };
    this.state.duck.state = "PERFORMING_TRICK";
    this.state.duck.stateTimer = 90;
    this.state.totalScore += 250 * this.state.multiplier;
    this.state.naughtyVsGood = Math.min(100, this.state.naughtyVsGood + 10);
    this.notifySubscribers();
  }

  public override update(dt: number): void {
    this.state.ticks += 1;
    // Step simulation
    if (this.state.duck.stateTimer > 0) {
      this.state.duck.stateTimer = Math.max(
        0,
        this.state.duck.stateTimer - dt * 60
      );
      if (this.state.duck.stateTimer === 0) {
        this.state.duck.state = "IDLE_ROAM";
      }
    }
    this.invalidateSnapshot();
  }

  public override render(ctx: CanvasRenderingContext2D, _alpha: number): void {
    if (!ctx) return;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Duck
    ctx.fillStyle = "#eab308";
    ctx.beginPath();
    ctx.arc(this.state.duck.x, this.state.duck.y, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  public override createSnapshot(): WorkingWithDuckSnapshot {
    return {
      status: this.state.status,
      score: this.state.totalScore,
      multiplier: this.state.multiplier,
      currentLevel: this.state.currentLevel,
      duck: {
        x: this.state.duck.x,
        y: this.state.duck.y,
        behaviorState: this.state.duck.state,
        mood:
          this.state.excitement > 70
            ? "zoomies"
            : this.state.isMuddy
              ? "muddy"
              : "happy",
      },
      excitement: this.state.excitement,
      bladder: this.state.bladder,
      naughtyVsGood: this.state.naughtyVsGood,
      isMuddy: this.state.isMuddy,
    };
  }
}
