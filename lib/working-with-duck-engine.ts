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
  | "none"
  | "bucket-hat"
  | "bowtie"
  | "bandana"
  | "rain-boots"
  | "graduation-hat"
  | "duck-costume"
  | "witch-hat"
  | "vampire-cape";

/**
 * Halloween costumes (#2737). They are free to wear while Halloween mode is
 * on, need no unlock and carry no perk, so a costumed sprint plays exactly
 * like a bare-coated one. Whether Halloween mode is on is a presentation
 * preference the caller owns; the engine only knows which wearables are
 * costumes.
 */
export const DUCK_HALLOWEEN_COSTUMES = [
  "duck-costume",
  "witch-hat",
  "vampire-cape",
] as const satisfies readonly DuckAccessory[];

/** A Halloween costume, as opposed to an earned accessory. */
export type DuckHalloweenCostume = (typeof DUCK_HALLOWEEN_COSTUMES)[number];

/** True when `accessory` is one of the Halloween costumes. */
export function isHalloweenCostume(
  accessory: DuckAccessory
): accessory is DuckHalloweenCostume {
  return (DUCK_HALLOWEEN_COSTUMES as readonly DuckAccessory[]).includes(
    accessory
  );
}

/**
 * Whether `date` falls in Halloween season, the whole of October in the
 * player's local calendar. Halloween mode follows this until the player
 * picks a side.
 */
export function isHalloweenSeason(date: Date): boolean {
  return date.getMonth() === 9;
}

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

/**
 * The one rule a campaign sprint adds on top of the meters (#2161), so the
 * five sprints play differently:
 * - `cable-alert`: Duck goes for the power cable first and chews faster.
 * - `window-watch`: squirrels come to the window more often. Sit while one
 *   is there for a bonus; an ignored squirrel winds Duck up.
 * - `mud-storm`: storms muddy Duck on a timer, and muddy paws slow the work
 *   until a bath.
 * - `standup`: a standup meeting partway in. Keep Duck out of trouble for
 *   its length for a bonus.
 */
export type DuckSprintTwist =
  "cable-alert" | "window-watch" | "mud-storm" | "standup";

export interface GameSprint {
  level: number;
  title: string;
  subtitle: string;
  targetWork: number;
  impulseInterval: number; // ticks between impulses
  /** Seconds a well-run sprint takes; each second under it earns a bonus. */
  parSeconds: number;
  description: string;
  /** The rule this sprint adds (#2161); sprint 1 has none. */
  twist?: DuckSprintTwist;
  /** One line for the briefing card naming the twist and how to answer it. */
  twistBrief?: string;
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
    title: "Dog Park Wrestling League",
    fact: "Duck's signature wrestling move is the flop: flat on his back in the grass, paws in the air, still grinning at his friend.",
    photoUrl: "/duck/duck-flop.jpg",
    svgUrl: "/duck/duck-happy.svg",
    caption: "Belly-up in the grass mid-wrestle, grinning at his opponent.",
  },
  {
    id: 10,
    level: 10,
    title: "Road Trip Co-Pilot",
    fact: "Duck takes car rides seriously: bolt upright in the back seat, leash on, watching the road as if he were the one navigating.",
    photoUrl: "/duck/duck-car.jpg",
    svgUrl: "/duck/duck-car.svg",
    caption: "Back seat claimed and ready for the next drive.",
  },
];

/**
 * One sprint's three stars (#2050): every prop saved, no indoor accidents,
 * and Good Boy above {@link DUCK_STAR_GOOD_BOY_THRESHOLD} at the finish.
 */
export interface DuckSprintStars {
  propsSaved: boolean;
  noAccidents: boolean;
  goodBoy: boolean;
  /** The Good Boy scale when the work shipped, before the nap bonus. */
  goodBoyAtFinish: number;
  /** Stars earned, 0 to 3. */
  count: number;
}

/** Best star count (0 to 3) per campaign sprint, keyed by sprint level. */
export type DuckBestStars = Record<number, number>;

/** Good Boy must finish strictly above this for the third star. */
export const DUCK_STAR_GOOD_BOY_THRESHOLD = 50;

/**
 * Total best stars that unlock each later scrapbook fact, keyed by fact id.
 * Facts 1 to 5 unlock by clearing their sprint; facts 6 to 10 cannot, since
 * the campaign stops at sprint 5, so they unlock from star milestones.
 */
export const DUCK_FACT_STAR_MILESTONES: Readonly<Record<number, number>> = {
  6: 5,
  7: 8,
  8: 11,
  9: 13,
  10: 15,
};

/** Good Boy points lost per tick while an emergency goes unhandled. */
const NEGLECT_DRAIN_PER_TICK = 0.04;
/** Ticks the Dog Park stays closed after a trip (60 ticks = 1 s). */
const PARK_COOLDOWN_TICKS = 20 * 60;
/**
 * Points per work unit shipped (#2159), scaled by the multiplier. Passive
 * work and coding bursts pay the same rate, so a sprint's work is worth the
 * same however long it takes, and time spent earns nothing by itself.
 */
export const WORK_UNIT_POINTS = 25;
/** Points for each second a sprint ships under its par time (#2159). */
export const PAR_POINTS_PER_SECOND = 150;
/** Minimum ticks between two code bursts (60 ticks = 1 s, so 6 per second). */
const CODE_BURST_MIN_TICKS = 10;

export const SPRINTS: GameSprint[] = [
  {
    level: 1,
    title: "Sprint 1: Onboarding & Puppy Proofing",
    subtitle: "Gentle puppy impulses · Learn clicker tricks & toys",
    targetWork: 100,
    parSeconds: 30,
    impulseInterval: 280,
    description:
      "Configure your remote workspace while teaching Duck basic obedience (Sit, High Five) and redirecting playful nibbles.",
  },
  {
    level: 2,
    title: "Sprint 2: Q1 Deliverables & Cable Alert",
    subtitle: "Faster impulses · Package delivery knock & office wires",
    targetWork: 160,
    parSeconds: 40,
    impulseInterval: 220,
    description:
      "High-priority deliverable in flight! Protect the office power strip with Kong toys and trade treats during 'No Take, Only Throw!'.",
    twist: "cable-alert",
    twistBrief:
      "Cable Alert: Duck goes for the power cable first and chews it faster. Drop It or a Kong saves it.",
  },
  {
    level: 3,
    title: "Sprint 3: Executive Pitch & Window Distraction",
    subtitle: "High excitement · Window squirrels & rapid potty runs",
    targetWork: 240,
    parSeconds: 50,
    impulseInterval: 175,
    description:
      "Board meeting deadline! Excitement is rising. Run outside for fast potty breaks and practice clicker training for Good Boy multipliers.",
    twist: "window-watch",
    twistBrief:
      "Window Watch: squirrels visit often. Call Sit while one is at the window for a bonus; ignore it and Duck gets wound up.",
  },
  {
    level: 4,
    title: "Sprint 4: Deadline Crunch & Park Break",
    subtitle: "Extreme multitasking · Agility hurdles & bathtub wash",
    targetWork: 330,
    parSeconds: 65,
    impulseInterval: 145,
    description:
      "Intense project crunch! Duck needs high-energy Dog Park agility runs. If he splashes into mud, scrub him clean in the Bathtub.",
    twist: "mud-storm",
    twistBrief:
      "Mud Storm: storms roll in and muddy Duck. Muddy paws slow your work until you give him a bath.",
  },
  {
    level: 5,
    title: "Sprint 5: Annual Launch & Golden Promotion",
    subtitle: "Peak velocity · Master combos & zero downtime",
    targetWork: 450,
    parSeconds: 80,
    impulseInterval: 120,
    description:
      "The major milestone release! Master all training tricks, focus work sprints, and unlock the Golden Graduation hat.",
    twist: "standup",
    twistBrief:
      "Launch Standup: 20 seconds in, a 15-second standup starts. Keep Duck out of trouble (no zoomies, chews or potty runs) for a bonus.",
  },
];

/** Work units an endless run ships per quarter before the next one starts. */
export const ENDLESS_QUARTER_WORK = 120;

/** Endless score for each quarter survived, on top of the work done. */
export const ENDLESS_QUARTER_POINTS = 1000;

/**
 * A hazard an endless quarter adds to the run. Each new quarter adds the
 * next one in `ENDLESS_HAZARD_ORDER`, and they stay for the rest of the run:
 * surprises come more often, potty trips track mud in, and Duck chews props
 * faster, going for the power cable first.
 */
export type DuckEndlessHazard = "surprises" | "mud" | "cable-chewing";

/** The order in which endless quarters add their hazard. */
export const ENDLESS_HAZARD_ORDER: readonly DuckEndlessHazard[] = [
  "surprises",
  "mud",
  "cable-chewing",
];

/** How an endless quarter plays: meter rates, impulses and hazards. */
export interface DuckEndlessPace {
  /** The sprint level the meter rates are computed at. */
  meterLevel: number;
  /** Ticks between Duck's impulses (chews and flops). */
  impulseInterval: number;
  /** Ticks between rolls for a surprise event. */
  surpriseInterval: number;
  /** Hazards active this quarter. */
  hazards: DuckEndlessHazard[];
}

/** Ticks between surprise rolls in the campaign and early endless. */
const SURPRISE_INTERVAL_TICKS = 520;
/** Ticks between surprise rolls once the surprises hazard is active. */
const ENDLESS_SURPRISE_INTERVAL_TICKS = 300;
/** Meter level added per endless quarter after the first. */
const ENDLESS_METER_LEVEL_STEP = 0.6;
/** Meter level where the endless climb stops being linear (#2328). */
const ENDLESS_METER_LEVEL_KNEE = 12;
/** Ceiling the meter level approaches, but never reaches, past the knee. */
const ENDLESS_MAX_METER_LEVEL = 16;
/** Ticks taken off the impulse interval per endless quarter. */
const ENDLESS_IMPULSE_STEP = 12;
/** Impulse interval where the endless climb stops being linear (#2328). */
const ENDLESS_IMPULSE_KNEE = 60;
/** Floor the impulse interval approaches, but never reaches, past the knee. */
const ENDLESS_MIN_IMPULSE_INTERVAL = 40;
/** Linear overshoot past the impulse knee that closes about 63% of the gap. */
const ENDLESS_IMPULSE_EASE = 120;
/** Ticks Duck needs to chew a prop, normally and under cable chewing. */
const CHEW_TICKS = 240;
const CABLE_CHEW_TICKS = 150;
/** Ticks the quarter banner stays up. */
const ENDLESS_BANNER_TICKS = 240;
/** Score bonus for reaching a new endless quarter. */
const ENDLESS_QUARTER_BONUS = 150;

/** Ticks a bout of puppy hiccups lasts (60 ticks = 1 s). */
export const HICCUP_EVENT_TICKS = 240;
/** Ticks from one hiccup to the next. */
export const HICCUP_PERIOD_TICKS = 50;
/** Ticks at the start of each period while Duck is mid-hiccup. */
export const HICCUP_WINDOW_TICKS = 18;

/**
 * Follows a linear climb up to `knee`, then eases it toward `limit` so it
 * keeps moving every quarter without ever passing the limit (#2328). The
 * slope is unchanged at the knee; `ease` sets how quickly the gap closes.
 */
function easeTowardLimit(
  linear: number,
  knee: number,
  limit: number,
  ease: number
): number {
  const overshoot = Math.abs(linear - knee);
  const climbsUp = limit > knee;
  if (climbsUp ? linear <= knee : linear >= knee) return linear;
  const eased = Math.abs(limit - knee) * (1 - Math.exp(-overshoot / ease));
  return climbsUp ? knee + eased : knee - eased;
}

/**
 * The pace of an endless quarter. Quarter 1 plays at the base sprint's
 * rates; each later quarter raises the meter rates, shortens the impulse
 * interval and adds one hazard. Past Y2 the climb eases toward a ceiling
 * rather than stopping, so a long run keeps getting harder (#2328).
 */
export function endlessPace(quarter: number, baseLevel = 5): DuckEndlessPace {
  const wave = Number.isFinite(quarter)
    ? Math.max(0, Math.floor(quarter) - 1)
    : 0;
  const base = SPRINTS.find((s) => s.level === baseLevel) || SPRINTS[0];
  const hazards = ENDLESS_HAZARD_ORDER.slice(0, wave);
  return {
    meterLevel: easeTowardLimit(
      base.level + wave * ENDLESS_METER_LEVEL_STEP,
      ENDLESS_METER_LEVEL_KNEE,
      ENDLESS_MAX_METER_LEVEL,
      ENDLESS_MAX_METER_LEVEL - ENDLESS_METER_LEVEL_KNEE + 2
    ),
    impulseInterval: Math.round(
      easeTowardLimit(
        base.impulseInterval - wave * ENDLESS_IMPULSE_STEP,
        ENDLESS_IMPULSE_KNEE,
        ENDLESS_MIN_IMPULSE_INTERVAL,
        ENDLESS_IMPULSE_EASE
      )
    ),
    surpriseInterval: hazards.includes("surprises")
      ? ENDLESS_SURPRISE_INTERVAL_TICKS
      : SURPRISE_INTERVAL_TICKS,
    hazards,
  };
}

/**
 * A quarter's name: Q1 to Q4 in the first year, then with the year in
 * front, such as Y2 Q1.
 */
export function endlessQuarterLabel(quarter: number): string {
  const q = Number.isFinite(quarter) ? Math.max(1, Math.floor(quarter)) : 1;
  const year = Math.floor((q - 1) / 4) + 1;
  const inYear = ((q - 1) % 4) + 1;
  return year === 1 ? `Q${inYear}` : `Y${year} Q${inYear}`;
}

/** What the banner for a new endless quarter says changed. */
function endlessQuarterBannerText(quarter: number): string {
  const added = ENDLESS_HAZARD_ORDER[Math.floor(quarter) - 2];
  switch (added) {
    case "surprises":
      return "Faster meters · Surprises come more often";
    case "mud":
      return "Faster meters · Potty trips track mud in, so bathe Duck";
    case "cable-chewing":
      return "Faster meters · Duck chews faster, cable first";
    default:
      return "Faster meters · Duck gets even busier";
  }
}

/** Quarters an endless run has finished, so 0 while still in Q1. */
export function endlessQuartersSurvived(state: WorkingWithDuckState): number {
  if (state.mode !== "endless") return 0;
  return Math.max(0, Math.floor(state.endlessQuarter ?? 1) - 1);
}

/**
 * The endless score: a fixed amount per quarter survived plus the work done.
 * It is 0 outside endless mode.
 */
export function computeEndlessScore(state: WorkingWithDuckState): number {
  if (state.mode !== "endless") return 0;
  const work = Number.isFinite(state.workProgress)
    ? Math.max(0, Math.floor(state.workProgress))
    : 0;
  return endlessQuartersSurvived(state) * ENDLESS_QUARTER_POINTS + work;
}

/** Whether an endless run currently has the given hazard. */
function hasEndlessHazard(
  state: WorkingWithDuckState,
  hazard: DuckEndlessHazard
): boolean {
  return (
    state.mode === "endless" &&
    endlessPace(state.endlessQuarter ?? 1, state.currentLevel).hazards.includes(
      hazard
    )
  );
}

/** How long the opening twist banner stays up. */
const TWIST_BANNER_TICKS = 360;
/** First Cable Alert chew in the Cable Alert sprint (#2161), then its period. */
export const CABLE_ALERT_FIRST_TICK = 300;
export const CABLE_ALERT_INTERVAL_TICKS = 480;
/** Ticks between squirrel visits in the Window Watch sprint (#2161). */
const WINDOW_WATCH_SURPRISE_TICKS = 480;
/** How much faster Excitement climbs while the Launch Standup is live. */
export const STANDUP_EXCITEMENT_FACTOR = 1.5;
/** Excitement Duck gains when a squirrel leaves without a Sit. */
export const SQUIRREL_IGNORED_EXCITEMENT = 25;
/** Good Boy Duck loses barking at a squirrel nobody answered. */
export const SQUIRREL_IGNORED_GOOD_BOY = 15;
/** Points for calling Sit while a squirrel is at the window. */
export const SQUIRREL_SIT_POINTS = 400;
/**
 * Points for calling Sit while trick-or-treaters are at the door (#2740).
 * They take the package's place in Halloween mode, so they pay what signing
 * for the package pays and a sprint is worth the same in or out of costume.
 */
export const TRICK_OR_TREAT_SIT_POINTS = 150;
/** Tick of the first mud storm in the Mud Storm sprint, then its period. */
export const MUD_STORM_FIRST_TICK = 360;
export const MUD_STORM_INTERVAL_TICKS = 1200;
/** Work speed while Duck has muddy paws in the endless mud hazard. */
const MUDDY_WORK_FACTOR = 0.8;
/**
 * What a code burst achieves while Duck is muddy in the Mud Storm sprint:
 * muddy paws all over the keyboard.
 */
const MUD_STORM_BURST_FACTOR = 0.5;
/** The Launch Standup window, in sprint ticks, and its bonus. */
export const STANDUP_START_TICK = 1200;
export const STANDUP_TICKS = 900;
export const STANDUP_BONUS = 1500;

/** The twist the current campaign sprint adds, or null (#2161). */
export function sprintTwist(
  state: Pick<WorkingWithDuckState, "mode" | "currentLevel">
): DuckSprintTwist | null {
  if (state.mode !== "campaign") return null;
  return SPRINTS.find((s) => s.level === state.currentLevel)?.twist ?? null;
}

/**
 * Whether Duck is mid-hiccup right now. During puppy hiccups he hiccups at
 * the start of every period, and a trick only lands between hiccups.
 */
export function isDuckHiccuping(state: WorkingWithDuckState): boolean {
  const event = state.activeSurpriseEvent;
  if (!event || event.type !== "puppy-hiccups" || event.timer <= 0) {
    return false;
  }
  const elapsed = Math.max(0, event.maxTimer - event.timer);
  return elapsed % HICCUP_PERIOD_TICKS < HICCUP_WINDOW_TICKS;
}

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
  /**
   * The endless quarter being played, from 1. A new quarter starts every
   * `ENDLESS_QUARTER_WORK` work units. Always 1 in the campaign.
   */
  endlessQuarter: number;
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
  /** Sprint tick from which the Dog Park can be opened again (#1942). */
  parkReadyAtTick?: number;
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
    type:
      | "amazon-delivery"
      | "trick-or-treat"
      | "squirrel-window"
      | "puppy-hiccups";
    timer: number;
    maxTimer: number;
    resolved: boolean;
  } | null;
  /**
   * Endless only: a surprise roll came due while Duck was busy or another
   * surprise was up, so it fires at his next calm moment instead of being
   * skipped (#2328). The campaign keeps its exact-tick rolls.
   */
  surpriseDue?: boolean;
  /**
   * Halloween mode is on (#2740). The caller owns the preference and copies
   * it here; while it is on, trick-or-treaters ring at the back door in the
   * package's place, and a Sit sends them off happy. Absent reads as off.
   */
  halloween?: boolean;

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
  /** Indoor accidents (potty countdowns that ran out) this sprint. */
  sprintAccidents: number;
  /** Stars from the sprint just cleared; null until a campaign win. */
  sprintStars: DuckSprintStars | null;
  /** Par-time bonus from the sprint just cleared; 0 until a campaign win. */
  sprintParBonus?: number;
  /**
   * The Launch Standup in the standup sprint (#2161): `live` while it runs,
   * then `passed` or `failed`. Absent before it starts and in other sprints.
   */
  standup?: "live" | "passed" | "failed";
  /** Best stars per campaign sprint, carried across sprints and sessions. */
  bestStars: DuckBestStars;
  highScore: number;
  activeSkillToast: { badge: string; text: string; timer: number } | null;
  soundCueQueue: Array<SoundCue>;
  tutorialStep: number;
}

/**
 * A paused sprint freezes play: every player action is a no-op until the
 * sprint resumes, so the meters and score cannot move with the clock
 * stopped (#1645). Equipping an accessory stays allowed because the
 * wardrobe dialog pauses the sprint itself.
 */
function isSprintPaused(state: WorkingWithDuckState): boolean {
  return state.status === "paused";
}

export function clampBounds(x: number, y: number): { x: number; y: number } {
  const safeX = Number.isFinite(x) ? x : CANVAS_WIDTH / 2;
  const safeY = Number.isFinite(y) ? y : CANVAS_HEIGHT / 2;
  return {
    x: clamp(safeX, MIN_DUCK_X, MAX_DUCK_X),
    y: clamp(safeY, MIN_DUCK_Y, MAX_DUCK_Y),
  };
}

/**
 * Sum the best stars over the campaign sprints, counting at most three per
 * sprint and ignoring unknown sprints or malformed counts.
 */
export function totalBestStars(bestStars: DuckBestStars): number {
  return SPRINTS.reduce((total, sprint) => {
    const stars = bestStars[sprint.level];
    return Number.isFinite(stars)
      ? total + clamp(Math.floor(stars), 0, 3)
      : total;
  }, 0);
}

/** Fact ids whose star milestone a total of `totalStars` has reached. */
export function factsUnlockedByStars(totalStars: number): number[] {
  return Object.entries(DUCK_FACT_STAR_MILESTONES)
    .filter(([, needed]) => totalStars >= needed)
    .map(([id]) => Number(id))
    .sort((a, b) => a - b);
}

/**
 * The par-time bonus for a campaign sprint that just shipped (#2159): points
 * for every whole second under the sprint's par, nothing at or over it.
 */
export function computeParBonus(state: WorkingWithDuckState): number {
  const sprint = SPRINTS.find((s) => s.level === state.currentLevel);
  if (!sprint) return 0;
  const underPar = Math.floor(sprint.parSeconds - state.ticks / 60);
  return Math.max(0, underPar) * PAR_POINTS_PER_SECOND;
}

/**
 * Judge the three stars for a sprint at the moment its work ships. Reads
 * the state before the win's nap bonus is applied to the Good Boy scale.
 */
export function computeSprintStars(
  state: WorkingWithDuckState
): DuckSprintStars {
  const propsSaved = state.hazards.every((h) => !h.isChewed);
  const noAccidents = (state.sprintAccidents ?? 0) === 0;
  const goodBoy = state.naughtyVsGood > DUCK_STAR_GOOD_BOY_THRESHOLD;
  return {
    propsSaved,
    noAccidents,
    goodBoy,
    goodBoyAtFinish: state.naughtyVsGood,
    count: [propsSaved, noAccidents, goodBoy].filter(Boolean).length,
  };
}

export function createInitialDuckGameState(
  level = 1,
  mode: "campaign" | "endless" = "campaign",
  preservedAccessories: DuckAccessory[] = ["none", "bucket-hat"],
  preservedFacts: number[] = [1],
  preservedBestStars: DuckBestStars = {}
): WorkingWithDuckState {
  const sprint = SPRINTS.find((s) => s.level === level) || SPRINTS[0];
  const bestStars: DuckBestStars = { ...preservedBestStars };

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
    endlessQuarter: 1,
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
        [
          1,
          ...preservedFacts,
          ...factsUnlockedByStars(totalBestStars(bestStars)),
        ].filter((id) => DUCK_FACTS.some((fact) => fact.id === id))
      )
    ),
    latestUnlockedFact: null,
    sprintAccidents: 0,
    sprintStars: null,
    bestStars,
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
  // Endless quarters (#2051) speed up the meters and impulses and add
  // hazards; the campaign keeps each sprint's own pace.
  const endless =
    state.mode === "endless"
      ? endlessPace(state.endlessQuarter ?? 1, state.currentLevel)
      : null;
  const impulseRate = endless?.impulseInterval ?? sprint.impulseInterval;
  const meterLevel = endless?.meterLevel ?? state.currentLevel;
  // Each campaign sprint after the first adds one twist (#2161), reusing
  // the endless hazards where they fit.
  const twist = sprintTwist(state);
  const surpriseInterval =
    endless?.surpriseInterval ??
    (twist === "window-watch"
      ? WINDOW_WATCH_SURPRISE_TICKS
      : SURPRISE_INTERVAL_TICKS);
  const hasCableChewing =
    (endless?.hazards.includes("cable-chewing") ?? false) ||
    twist === "cable-alert";

  // Multipliers & Calm Buff
  const nextCalmBuff = Math.max(0, state.calmBuffTimer - 1);
  const baseMultiplier = calculateGoodBoyMultiplier(state.naughtyVsGood);
  const comboBonus =
    state.comboStreak >= 2 ? 0.3 * Math.min(3, state.comboStreak) : 0;
  // Accessory perks (#2050): bowtie +0.2 multiplier, bandana slower
  // excitement, bucket hat slower thirst, graduation hat half neglect drain.
  // Rain boots work at the Dog Park (mud immunity).
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
  // Endless mud hazard: muddy paws slow the work (-20%) until Duck is
  // bathed. (The Mud Storm sprint slows code bursts instead.)
  const mudPenalty =
    endless?.hazards.includes("mud") && state.isMuddy ? MUDDY_WORK_FACTOR : 1.0;

  let nextWorkProgress = state.workProgress;
  let nextScore = state.totalScore;

  // Training Duck takes the player's attention too: no passive work while
  // he performs a trick, so a trick costs about a second of coding.
  const isTraining = state.duck.state === "PERFORMING_TRICK";

  if (!isEmergency && !isTraining && state.duck.state !== "NAP_TIME") {
    const workIncrement =
      0.04 * effectiveMultiplier * puddlePenalty * mudPenalty;
    nextWorkProgress = Math.min(
      state.targetWorkProgress,
      state.workProgress + workIncrement
    );
    nextScore += Math.round(workIncrement * WORK_UNIT_POINTS);
  }

  // Endless waves (#2051): every ENDLESS_QUARTER_WORK work units a new
  // quarter starts, faster and with one more hazard.
  const currentQuarter = Math.max(1, Math.floor(state.endlessQuarter ?? 1));
  const quarterReached =
    state.mode === "endless"
      ? Math.max(
          currentQuarter,
          Math.floor(nextWorkProgress / ENDLESS_QUARTER_WORK) + 1
        )
      : currentQuarter;
  const quarterAdvanced = quarterReached > currentQuarter;
  if (quarterAdvanced) {
    nextScore += ENDLESS_QUARTER_BONUS;
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
    (nextCalmBuff > 0 ? 0.02 : 0.07 + meterLevel * 0.018) *
    (state.activeAccessory === "bandana" ? 0.75 : 1);
  const bladderRate = nextCalmBuff > 0 ? 0.02 : 0.05 + meterLevel * 0.015;
  const thirstRate =
    (0.03 + meterLevel * 0.01) *
    (state.activeAccessory === "bucket-hat" ? 0.75 : 1);
  const hungerRate = 0.02 + meterLevel * 0.01;

  // Launch Standup (#2161): voices on the call wind Duck up.
  const standupLive = twist === "standup" && state.standup === "live";
  let nextExcitement = clamp(
    state.excitement +
      excitementRate * (standupLive ? STANDUP_EXCITEMENT_FACTOR : 1),
    0,
    100
  );
  let nextBladder = clamp(state.bladder + bladderRate, 0, 100);
  let nextThirst = clamp(state.thirst + thirstRate, 0, 100);
  let nextHunger = clamp(state.hunger + hungerRate, 0, 100);
  // An unhandled emergency (potty sniffing, sneaky chewing, zoomies) slowly
  // erodes the Good Boy scale, so ignoring Duck is never a winning strategy.
  const neglectDrain =
    NEGLECT_DRAIN_PER_TICK *
    (state.activeAccessory === "graduation-hat" ? 0.5 : 1);
  let nextNaughtyVsGood = isEmergency
    ? Math.max(-100, state.naughtyVsGood - neglectDrain)
    : state.naughtyVsGood;
  let nextLastImpulseTick = state.lastImpulseTick;
  const nextIndoorPuddles = state.indoorPuddles ? [...state.indoorPuddles] : [];
  let nextPuddleId = state.nextPuddleId || nextIndoorPuddles.length + 1;
  let nextSprintAccidents = state.sprintAccidents ?? 0;

  let activeToast = state.activeSkillToast
    ? { ...state.activeSkillToast, timer: state.activeSkillToast.timer - 1 }
    : null;
  if (activeToast && activeToast.timer <= 0) {
    activeToast = null;
  }
  // Each twist sprint opens with a banner naming its twist (#2161).
  const twistSprint = twist
    ? SPRINTS.find((s) => s.level === state.currentLevel)
    : undefined;
  if (twistSprint?.twistBrief && nextTicks === 1) {
    activeToast = {
      badge: `Sprint ${twistSprint.level} twist`,
      text: twistSprint.twistBrief,
      timer: TWIST_BANNER_TICKS,
    };
  }
  if (quarterAdvanced) {
    activeToast = {
      badge: `${endlessQuarterLabel(currentQuarter)} → ${endlessQuarterLabel(quarterReached)}`,
      text: endlessQuarterBannerText(quarterReached),
      timer: ENDLESS_BANNER_TICKS,
    };
    soundCues.push("combo-fanfare");
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
  const hiccupsEnded =
    activeSurprise?.type === "puppy-hiccups" && activeSurprise.timer <= 0;
  // Window Watch (#2161): a squirrel that leaves without a Sit winds Duck up.
  const squirrelIgnored =
    twist === "window-watch" &&
    activeSurprise?.type === "squirrel-window" &&
    activeSurprise.timer <= 0;
  if (squirrelIgnored) {
    nextExcitement = clamp(
      nextExcitement + SQUIRREL_IGNORED_EXCITEMENT,
      0,
      100
    );
    nextNaughtyVsGood = Math.max(
      -100,
      nextNaughtyVsGood - SQUIRREL_IGNORED_GOOD_BOY
    );
  }
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

  if (hiccupsEnded) {
    alerts.push({
      id: state.nextAlertId + 98,
      x: duck.x,
      y: duck.y - 30,
      text: "Hiccups gone. Tricks are back on!",
      color: "#22c55e",
      alpha: 1,
      vy: -1.2,
    });
  }

  if (squirrelIgnored) {
    alerts.push({
      id: state.nextAlertId + 97,
      x: 400,
      y: 60,
      text: `🐿️ Duck barked at the squirrel! (+${SQUIRREL_IGNORED_EXCITEMENT} Excitement, -${SQUIRREL_IGNORED_GOOD_BOY} Good Boy)`,
      color: "#f97316",
      alpha: 1,
      vy: -1.2,
    });
    soundCues.push("bark");
  }

  // Mud Storm (#2161): a storm muddies Duck on a timer. Muddy paws slow the
  // work until a bath, so the bathtub becomes part of the plan.
  let nextIsMuddy = state.isMuddy;
  if (
    twist === "mud-storm" &&
    !state.isMuddy &&
    nextTicks >= MUD_STORM_FIRST_TICK &&
    (nextTicks - MUD_STORM_FIRST_TICK) % MUD_STORM_INTERVAL_TICKS === 0
  ) {
    nextIsMuddy = true;
    alerts.push({
      id: state.nextAlertId + 96,
      x: BATHTUB_BOUNDS.x,
      y: BATHTUB_BOUNDS.y - 10,
      text: "🌧️ Mud storm! Muddy paws slow work until a bath",
      color: "#f59e0b",
      alpha: 1,
      vy: -1.2,
    });
    soundCues.push("bark");
  }

  // Random surprise event during calm roam. Sprint 1 keeps its two gentle
  // surprises; from sprint 2, and in endless, puppy hiccups join the pool.
  // Window Watch brings only squirrels.
  // In endless, a roll that comes due while Duck is busy waits for his next
  // calm moment, so shorter intervals really bring more surprises (#2328).
  const surpriseTick = nextTicks % surpriseInterval === 0;
  const surpriseWaiting =
    state.mode === "endless" && (surpriseTick || state.surpriseDue === true);
  const surpriseRolls =
    !activeSurprise &&
    (surpriseTick || surpriseWaiting) &&
    (duck.state === "IDLE_ROAM" || twist === "window-watch");
  const nextSurpriseDue = surpriseWaiting && !surpriseRolls;
  if (surpriseRolls) {
    const roll = Math.random();
    const withHiccups = state.mode === "endless" || state.currentLevel >= 2;
    const windowWatch = twist === "window-watch";
    const deliveryCut = windowWatch ? 0 : withHiccups ? 1 / 3 : 0.5;
    const squirrelCut = windowWatch ? 1 : withHiccups ? 2 / 3 : 1;
    if (roll < deliveryCut) {
      // Halloween mode sends trick-or-treaters in the package's place, on
      // the same roll and for as long, so the odds do not change (#2740).
      const trickOrTreat = state.halloween === true;
      activeSurprise = {
        type: trickOrTreat ? "trick-or-treat" : "amazon-delivery",
        timer: 300,
        maxTimer: 300,
        resolved: false,
      };
      soundCues.push("door-knock");
      alerts.push({
        id: state.nextAlertId + 99,
        x: BACK_DOOR_BOUNDS.x,
        y: BACK_DOOR_BOUNDS.y + 20,
        text: trickOrTreat
          ? "🎃 Trick-or-treaters at the door! Sit, Duck!"
          : "📦 Amazon Delivery Knock!",
        color: "#f59e0b",
        alpha: 1,
        vy: -1.2,
      });
    } else if (roll < squirrelCut) {
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
    } else {
      activeSurprise = {
        type: "puppy-hiccups",
        timer: HICCUP_EVENT_TICKS,
        maxTimer: HICCUP_EVENT_TICKS,
        resolved: false,
      };
      alerts.push({
        id: state.nextAlertId + 99,
        x: duck.x,
        y: duck.y - 30,
        text: "Hic! Duck has the hiccups. Time tricks between hics!",
        color: "#f59e0b",
        alpha: 1,
        vy: -1.2,
      });
    }
  }

  // Each hiccup in a bout makes a sound at the start of its period.
  if (
    activeSurprise?.type === "puppy-hiccups" &&
    (activeSurprise.maxTimer - activeSurprise.timer) % HICCUP_PERIOD_TICKS === 0
  ) {
    soundCues.push("hiccup");
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

  // Cable Alert (#2161): on a timer Duck drops what he is doing and goes
  // for the power cable, or another prop once it is chewed.
  if (
    twist === "cable-alert" &&
    nextTicks >= CABLE_ALERT_FIRST_TICK &&
    (nextTicks - CABLE_ALERT_FIRST_TICK) % CABLE_ALERT_INTERVAL_TICKS === 0 &&
    (duck.state === "IDLE_ROAM" ||
      duck.state === "DRINKING_WATER" ||
      duck.state === "EATING_KIBBLE")
  ) {
    const unchewed = hazards.filter((h) => !h.isChewed);
    const target =
      unchewed.find((h) => h.id === "power-cable") ?? unchewed[0] ?? null;
    if (target) {
      duck.state = "SNEAKY_CHEW";
      duck.targetX = target.x;
      duck.targetY = target.y;
      duck.stateTimer = CABLE_CHEW_TICKS;
      duck.maxStateTimer = CABLE_CHEW_TICKS;
      activeHazardTarget = target.id;
      soundCues.push("bark");
      alerts.push({
        id: state.nextAlertId + 94,
        x: duck.x,
        y: duck.y - 25,
        text: `🔌 Cable Alert! Duck is going for the ${target.name}!`,
        color: "#f97316",
        alpha: 1,
        vy: -1.2,
      });
    }
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
        // Endless cable chewing (#2051): chews come more often, go for the
        // power cable while it is intact, and take less time.
        if (impulseChoice < (hasCableChewing ? 0.6 : 0.45)) {
          // Sneaky chew event
          const unchewedHazards = hazards.filter((h) => !h.isChewed);
          const hazardPool =
            unchewedHazards.length > 0 ? unchewedHazards : hazards;
          const cable = hasCableChewing
            ? unchewedHazards.find((h) => h.id === "power-cable")
            : undefined;
          const pickedHazard =
            hazardPool[Math.floor(Math.random() * hazardPool.length)];
          const randomHazard = cable ?? pickedHazard;
          const chewTicks = hasCableChewing ? CABLE_CHEW_TICKS : CHEW_TICKS;
          duck.state = "SNEAKY_CHEW";
          duck.targetX = randomHazard.x;
          duck.targetY = randomHazard.y;
          duck.stateTimer = chewTicks;
          duck.maxStateTimer = chewTicks;
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
        nextSprintAccidents += 1;

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

  // Launch Standup (#2161): a window partway into the sprint in which Duck
  // must stay out of trouble. Any emergency ends it; lasting it out pays.
  let nextStandup = state.standup;
  if (twist === "standup") {
    const inTrouble =
      duck.state === "SNIFFING_POTTY" ||
      duck.state === "SNEAKY_CHEW" ||
      duck.state === "ZOOMIES";
    if (nextStandup === undefined && nextTicks >= STANDUP_START_TICK) {
      nextStandup = "live";
      activeToast = {
        badge: "Launch Standup",
        text: `Standup is live! Keep Duck out of trouble for ${STANDUP_TICKS / 60} seconds.`,
        timer: 240,
      };
      soundCues.push("door-knock");
    }
    if (nextStandup === "live" && inTrouble) {
      nextStandup = "failed";
      alerts.push({
        id: state.nextAlertId + 95,
        x: duck.x,
        y: duck.y - 40,
        text: "📞 Duck crashed the standup! No standup bonus",
        color: "#f97316",
        alpha: 1,
        vy: -1.2,
      });
    } else if (
      nextStandup === "live" &&
      nextTicks >= STANDUP_START_TICK + STANDUP_TICKS
    ) {
      nextStandup = "passed";
      nextScore += STANDUP_BONUS;
      alerts.push({
        id: state.nextAlertId + 95,
        x: 400,
        y: 60,
        text: `📞 Smooth standup! (+${STANDUP_BONUS} pts)`,
        color: "#22c55e",
        alpha: 1,
        vy: -1.2,
      });
      soundCues.push("combo-fanfare");
    }
  }

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
    endlessQuarter: quarterReached,
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
    surpriseDue: nextSurpriseDue,
    isMuddy: nextIsMuddy,
    standup: nextStandup,
    activeTrick,
    officeStations: stations,
    duck,
    hazards,
    activeHazardTarget,
    indoorPuddles: nextIndoorPuddles,
    nextPuddleId,
    sprintAccidents: nextSprintAccidents,
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
  const isCampaign = state.mode === "campaign";
  const sprintStars = isCampaign ? computeSprintStars(state) : null;
  const parBonus = isCampaign ? computeParBonus(state) : 0;
  const bestStars: DuckBestStars = { ...(state.bestStars ?? {}) };
  if (sprintStars) {
    bestStars[state.currentLevel] = Math.max(
      bestStars[state.currentLevel] ?? 0,
      sprintStars.count
    );
  }
  const starFacts = factsUnlockedByStars(totalBestStars(bestStars));
  const newStarFacts = starFacts.filter(
    (id) => !state.unlockedFacts.includes(id)
  );
  // A fact newly reached through stars is the new photo on the card;
  // otherwise it is the sprint's own fact, as before.
  const latestFactId = newStarFacts.length
    ? newStarFacts[newStarFacts.length - 1]
    : state.currentLevel;
  const currentFact =
    DUCK_FACTS.find((f) => f.id === latestFactId) || DUCK_FACTS[0];
  const unlocked = Array.from(
    new Set([...state.unlockedFacts, state.currentLevel, ...starFacts])
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
      // Promised by the sprint 5 brief: clearing the campaign earns the hat.
      isCampaign && state.currentLevel === 5 ? "graduation-hat" : "none",
    ])
  );

  return {
    ...state,
    status: "won",
    sprintStars,
    bestStars,
    workProgress: state.targetWorkProgress,
    excitement: 0,
    naughtyVsGood: Math.min(100, state.naughtyVsGood + 40),
    sprintParBonus: parBonus,
    totalScore: state.totalScore + 250 + parBonus,
    highScore: Math.max(state.highScore, state.totalScore + 250 + parBonus),
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
  if (isSprintPaused(state)) return state;
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

  // Puppy hiccups (#2051): a trick called mid-hiccup slips and breaks the
  // combo. One called between hiccups lands as normal.
  if (isDuckHiccuping(state)) {
    const slip = "Hic! The trick slipped. Wait for the gap between hics.";
    const shown = state.floatingAlerts.some((alert) => alert.text === slip);
    return {
      ...state,
      comboStreak: 0,
      comboTimer: 0,
      floatingAlerts: shown
        ? state.floatingAlerts
        : [
            ...state.floatingAlerts,
            {
              id: state.nextAlertId,
              x: state.duck.x,
              y: state.duck.y - 25,
              text: slip,
              color: "#f59e0b",
              alpha: 1,
              vy: -1.2,
            },
          ],
      soundCueQueue: [...state.soundCueQueue, "hiccup"],
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
  // A Sit while a squirrel is at the window (#2161) answers a real
  // distraction, so it pays in full and sends the squirrel off.
  const sitsThroughSquirrel =
    trick === "SIT" && state.activeSurpriseEvent?.type === "squirrel-window";
  // So does a Sit while trick-or-treaters are at the door (#2740).
  const sitsForTrickOrTreaters =
    trick === "SIT" && state.activeSurpriseEvent?.type === "trick-or-treat";
  const need =
    trick === "DROP_IT" || sitsThroughSquirrel || sitsForTrickOrTreaters
      ? 1
      : clamp(state.excitement / 60, 0.1, 1);
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
    if (sitsThroughSquirrel) {
      soundCues.push("combo-fanfare");
      nextScore += SQUIRREL_SIT_POINTS;
      alerts.push({
        id: state.nextAlertId + 50,
        x: 400,
        y: 80,
        text: `🐿️ Sat through the squirrel! (+${SQUIRREL_SIT_POINTS} pts)`,
        color: "#38bdf8",
        alpha: 1,
        vy: -1.2,
      });
    }
    if (sitsForTrickOrTreaters) {
      soundCues.push("combo-fanfare");
      nextScore += TRICK_OR_TREAT_SIT_POINTS;
      alerts.push({
        id: state.nextAlertId + 50,
        x: BACK_DOOR_BOUNDS.x,
        y: BACK_DOOR_BOUNDS.y + 30,
        text: `🍬 Duck sat for the trick-or-treaters! (+${TRICK_OR_TREAT_SIT_POINTS} pts)`,
        color: "#f59e0b",
        alpha: 1,
        vy: -1.2,
      });
    }
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
    activeSurpriseEvent:
      sitsThroughSquirrel || sitsForTrickOrTreaters
        ? null
        : state.activeSurpriseEvent,
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
  // Mud Storm (#2161): muddy paws slow bursts too, until a bath.
  const mudFactor =
    sprintTwist(state) === "mud-storm" && state.isMuddy
      ? MUD_STORM_BURST_FACTOR
      : 1;
  const progressBoost = 0.45 * effectiveMultiplier * mudFactor;
  const nextWork = Math.min(
    state.targetWorkProgress,
    state.workProgress + progressBoost
  );
  // A burst pays the same per work unit as passive work (#2159).
  const nextScore =
    state.totalScore +
    Math.round((nextWork - state.workProgress) * WORK_UNIT_POINTS);
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
  if (isSprintPaused(state)) return state;
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
  if (isSprintPaused(state)) return state;
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
  if (isSprintPaused(state)) return state;
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
  if (isSprintPaused(state)) return state;
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
  if (isSprintPaused(state)) return state;
  const isClean =
    state.bathtubState.status === "clean" ||
    state.bathtubState.rinseLevel >= 100;
  // The full reward is for washing off park mud. A bath for a duck that was
  // already clean is a nice moment, not a free +35 Good Boy (#1942).
  const wasMuddy = state.isMuddy;
  const reward = !wasMuddy
    ? {
        score: 20,
        goodBoy: 5,
        calm: 300,
        text: "🛁 Already clean, but he enjoyed it (+20 pts)",
      }
    : isClean
      ? {
          score: 120,
          goodBoy: 35,
          calm: 1200,
          text: "✨ Fresh & Clean Puppy! (+120 pts & Calm Buff)",
        }
      : { score: 30, goodBoy: 10, calm: 300, text: "🐾 Bathtime Finished" };

  return {
    ...state,
    inBathtub: false,
    isMuddy: false,
    totalScore: state.totalScore + reward.score,
    naughtyVsGood: Math.min(100, state.naughtyVsGood + reward.goodBoy),
    calmBuffTimer: reward.calm,
    floatingAlerts: [
      ...state.floatingAlerts,
      {
        id: state.nextAlertId,
        x: BATHTUB_BOUNDS.x,
        y: BATHTUB_BOUNDS.y - 15,
        text: reward.text,
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
  // Costumes need no unlock (#2737); everything else must be earned.
  if (
    !isHalloweenCostume(accessory) &&
    !state.unlockedAccessories.includes(accessory)
  ) {
    return state;
  }

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
  if (isSprintPaused(state)) return state;
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
  if (isSprintPaused(state)) return state;
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
  if (isSprintPaused(state)) return state;
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
  if (isSprintPaused(state)) return state;
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
  if (isSprintPaused(state)) return state;
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
  if (isSprintPaused(state)) return state;
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
  if (isSprintPaused(state)) return state;
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
  if (isSprintPaused(state)) return state;
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
  if (isSprintPaused(state)) return state;
  if (state.duck.state !== "DRAGGED") return state;

  // Dropped at back door
  if (
    state.duck.x >= BACK_DOOR_BOUNDS.x &&
    state.duck.x <= BACK_DOOR_BOUNDS.x + BACK_DOOR_BOUNDS.width &&
    state.duck.y >= BACK_DOOR_BOUNDS.y &&
    state.duck.y <= BACK_DOOR_BOUNDS.y + BACK_DOOR_BOUNDS.height
  ) {
    // Endless mud hazard (#2051): Duck comes back in with muddy paws.
    const tracksMud = hasEndlessHazard(state, "mud");
    const mudAlerts: FloatingAlert[] = tracksMud
      ? [
          {
            id: state.nextAlertId + 1,
            x: BATHTUB_BOUNDS.x,
            y: BATHTUB_BOUNDS.y - 10,
            text: "🐾 Muddy paws! Bathe Duck to keep work moving",
            color: "#f59e0b",
            alpha: 1,
            vy: -1.2,
          },
        ]
      : [];
    return {
      ...state,
      bladder: 0,
      isMuddy: state.isMuddy || tracksMud,
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
        ...mudAlerts,
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
  if (isSprintPaused(state)) return state;
  const readyAt = state.parkReadyAtTick ?? 0;
  if (state.ticks < readyAt) {
    const seconds = Math.ceil((readyAt - state.ticks) / 60);
    return {
      ...state,
      nextAlertId: state.nextAlertId + 1,
      floatingAlerts: [
        ...state.floatingAlerts,
        {
          id: state.nextAlertId,
          x: 400,
          y: 200,
          text: `🌲 Duck just got back. Park opens again in ${seconds}s`,
          color: "#f59e0b",
          alpha: 1,
          vy: -1.2,
        },
      ],
    };
  }
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
  if (isSprintPaused(state)) return state;
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
  if (isSprintPaused(state)) return state;
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
  if (isSprintPaused(state)) return state;
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
  if (isSprintPaused(state)) return state;
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
  if (isSprintPaused(state)) return state;
  // A trip only settles the duck when a fetch was actually played out (the
  // ball came back, or the duck came back muddy). Walking straight back in
  // takes the edge off and no more, so the park is not a free reset (#1942).
  const fetched = isSuccess || state.parkState.status === "muddy";
  const nextExcitement = fetched ? 0 : Math.max(0, state.excitement - 15);
  const nextBladder = fetched ? 0 : Math.max(0, state.bladder - 20);
  const bonusFromBones = state.parkState.bonesCollected * 10;
  const bonusFromHurdles = state.parkState.hurdlesCleared * 15;
  const nextNaughtyVsGood = isSuccess
    ? Math.min(
        100,
        state.naughtyVsGood + 30 + bonusFromBones + bonusFromHurdles
      )
    : state.naughtyVsGood;
  const calmTimer = isSuccess ? 1800 : fetched ? 600 : 0;
  const isMuddy = state.parkState.status === "muddy";

  return {
    ...state,
    inDogPark: false,
    parkReadyAtTick: state.ticks + PARK_COOLDOWN_TICKS,
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
            : fetched
              ? "🐾 Returned from park"
              : "🐾 Back already? Duck is still wound up",
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
        state.unlockedFacts,
        state.bestStars
      )
    : createInitialDuckGameState(
        nextLevel,
        "campaign",
        state.unlockedAccessories,
        state.unlockedFacts,
        state.bestStars
      );

  // Progression must resume simulation immediately: callers advance from a
  // terminal "won" state and rely on this returning a "running" state so the
  // next tick actually progresses instead of sitting idle. Duck keeps what
  // he is wearing into the next sprint, costumes included (#2737).
  return {
    ...nextState,
    status: "running",
    activeAccessory:
      isHalloweenCostume(state.activeAccessory) ||
      nextState.unlockedAccessories.includes(state.activeAccessory)
        ? state.activeAccessory
        : "none",
  };
}

import { ArcadeEngine } from "@/lib/arcade/engine";

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
