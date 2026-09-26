import {
  EnemyTemplate,
  LaserType,
  CampaignAct,
  FlagMuseumEntry,
  PowerUpType,
} from "./types";

export const ENEMY_TYPES: readonly EnemyTemplate[] = [
  // Act 1: Lake Minnetonka
  {
    type: "mosquito",
    label: "Laser Mosquito",
    color: "#f43f5e",
    points: 100,
    hp: 1,
    radius: 16,
    behavior: "sine",
  },
  {
    type: "hailstorm",
    label: "Glacial Hail",
    color: "#38bdf8",
    points: 120,
    hp: 2,
    radius: 20,
    behavior: "linear",
  },
  {
    type: "jetski",
    label: "Rogue Jet-Ski",
    color: "#fb923c",
    points: 150,
    hp: 2,
    radius: 24,
    behavior: "bouncing",
  },

  // Act 2: State Fair Grounds
  {
    type: "butter-bomb",
    label: "Deep-Fried Butter",
    color: "#facc15",
    points: 180,
    hp: 2,
    radius: 22,
    behavior: "linear",
  },
  {
    type: "pronto-pup-rogue",
    label: "Runaway Pronto Pup",
    color: "#fbbf24",
    points: 160,
    hp: 2,
    radius: 18,
    behavior: "sine",
  },
  {
    type: "livestock-decoy",
    label: "Prize Gopher Decoy",
    color: "#d97706",
    points: 200,
    hp: 3,
    radius: 25,
    behavior: "linear",
  },

  // Act 3: Redesign Commission Hearings
  {
    type: "red-tape",
    label: "Bureaucratic Red Tape",
    color: "#ef4444",
    points: 220,
    hp: 2,
    radius: 20,
    behavior: "homing",
  },
  {
    type: "veto-stamp",
    label: "Veto Stamp",
    color: "#ec4899",
    points: 260,
    hp: 3,
    radius: 24,
    behavior: "bouncing",
  },
  {
    type: "tricolor-rival",
    label: "F29 Tricolor Draft",
    color: "#a855f7",
    points: 240,
    hp: 2,
    radius: 22,
    behavior: "sine",
  },
  {
    type: "clipboard",
    label: "Subcommittee Clipboard",
    color: "#cbd5e1",
    points: 190,
    hp: 2,
    radius: 19,
    behavior: "linear",
  },

  // Act 4: The Capitol Dome
  {
    type: "legislative-amendment",
    label: "Surprise Amendment",
    color: "#f43f5e",
    points: 300,
    hp: 3,
    radius: 26,
    behavior: "bouncing",
  },
  {
    type: "seal-guardian",
    label: "1893 Seal Drone",
    color: "#6366f1",
    points: 350,
    hp: 4,
    radius: 28,
    behavior: "homing",
  },
  {
    type: "polar-vortex",
    label: "Polar Vortex Eye",
    color: "#06b6d4",
    points: 280,
    hp: 3,
    radius: 25,
    behavior: "sine",
  },

  // Bosses
  {
    type: "mega-mosquito",
    label: "The Mega Mosquito Queen",
    color: "#e11d48",
    points: 1500,
    hp: 20,
    radius: 42,
    isBoss: true,
    behavior: "boss-orbit",
  },
  {
    type: "butter-colossus",
    label: "Butter Sculpture Colossus",
    color: "#eab308",
    points: 2500,
    hp: 30,
    radius: 48,
    isBoss: true,
    behavior: "boss-orbit",
  },
  {
    type: "starflake-boss",
    label: "F1953 Starflake Finalist",
    color: "#38bdf8",
    points: 4000,
    hp: 45,
    radius: 52,
    isBoss: true,
    behavior: "boss-orbit",
  },
  {
    type: "gavel-sovereign",
    label: "The Grand Veto Gavel",
    color: "#a855f7",
    points: 6000,
    hp: 60,
    radius: 56,
    isBoss: true,
    behavior: "boss-orbit",
  },
] as const;

// Backward-compatibility export for existing tests/references
export const BUG_TYPES = ENEMY_TYPES;

export interface WeaponConfig {
  name: string;
  keyNumber: string;
  color: string;
  glowColor: string;
  fireIntervalMs: number;
  damage: number;
  rayHitRadiusExtra: number;
  description: string;
}

export const WEAPONS: Record<LaserType, WeaponConfig> = {
  "ruby-laser": {
    name: "Ruby Eye Laser",
    keyNumber: "1",
    color: "#ef4444",
    glowColor: "#f43f5e",
    fireIntervalMs: 110,
    damage: 1.25,
    rayHitRadiusExtra: 10,
    description:
      "Iconic F277 crimson thermal ray cast directly from the loon's red eye.",
  },
  "cyan-pulse": {
    name: "Cyan Pulse",
    keyNumber: "2",
    color: "#22d3ee",
    glowColor: "#06b6d4",
    fireIntervalMs: 80,
    damage: 0.85,
    rayHitRadiusExtra: 8,
    description: "Rapid high-frequency pulse precision beam for dense swarms.",
  },
  "aurora-wave": {
    name: "Aurora Borealis Wave",
    keyNumber: "3",
    color: "#10b981",
    glowColor: "#34d399",
    fireIntervalMs: 130,
    damage: 1.5,
    rayHitRadiusExtra: 18,
    description:
      "Prismatic Northern Lights wave sweeping through multiple legislative obstacles.",
  },
  "ice-cannon": {
    name: "Glacial Cryo-Mortar",
    keyNumber: "4",
    color: "#38bdf8",
    glowColor: "#0284c7",
    fireIntervalMs: 220,
    damage: 2.5,
    rayHitRadiusExtra: 0,
    description:
      "Launches heavy cryogenic ice blocks that bounce off walls, crush enemies, and freeze clusters.",
  },
};

export const POWER_UP_CONFIGS: Record<
  PowerUpType,
  {
    label: string;
    color: string;
    durationMs: number;
    description: string;
    iconText: string;
  }
> = {
  hotdish: {
    label: "Tater Tot Hotdish",
    color: "#f59e0b",
    durationMs: 7000,
    description:
      "Hearty Minnesota comfort food! Zero-cooldown laser overcharge frenzy.",
    iconText: "🍲",
  },
  "pronto-pup": {
    label: "Golden Pronto Pup",
    color: "#eab308",
    durationMs: 6000,
    description:
      "Fairgrounds delicacy! Generates an invulnerability deflection shield.",
    iconText: "🌭",
  },
  "north-star": {
    label: "North Star Crystal",
    color: "#38bdf8",
    durationMs: 5000,
    description:
      "L'Étoile du Nord! Multiplier +3x surge and instant score boost.",
    iconText: "⭐",
  },
};

export const CAMPAIGN_ACTS: readonly CampaignAct[] = [
  {
    actNumber: 1,
    title: "Act I: Lake Minnetonka Qualifiers",
    location: "Lake Minnetonka, Wayzata Bay",
    newspaperHeadline:
      "LOCAL LOON DEVELOPS CYBERNETIC OPTICS, COMMENCES STATEWIDE CAMPAIGN",
    newspaperSubheader: "The North Star Gazette • Special Edition • Nov 2023",
    storyIntro: [
      "Deep in the mist of Lake Minnetonka, a solitary Common Loon awakens to the call of the State Emblems Redesign Commission.",
      "Armed with crimson eye-lasers and cryogenic lake ice, Laser Loon must prove its mettle against swarms of northern mosquitoes and reckless jet-skis to secure the district nomination!",
    ],
    bossName: "The Mega Mosquito Queen",
    bossType: "mega-mosquito",
    bossHp: 20,
    requiredMinionKills: 8,
    victoryQuote:
      "The lakeside district votes overwhelmingly in favor of Laser Loon! Next stop: The Great Minnesota Get-Together!",
    backgroundTheme: "lake",
  },
  {
    actNumber: 2,
    title: "Act II: The Great Minnesota Get-Together",
    location: "State Fair Grounds, Falcon Heights",
    newspaperHeadline:
      "LASER LOON CROWD PLEASER AT STATE FAIR; BUTTER SCULPTURE CONTEST DISRUPTED",
    newspaperSubheader: "Fairgrounds Daily • Grandstand Dispatch • Dec 2023",
    storyIntro: [
      "Public enthusiasm explodes at the Dairy Building as fairgoers rally behind the F277 banner.",
      "Rival concessions and the runaway Butter Sculpture Colossus seek to smother the civic movement in 500 pounds of churned dairy!",
    ],
    bossName: "Butter Sculpture Colossus",
    bossType: "butter-colossus",
    bossHp: 30,
    requiredMinionKills: 10,
    victoryQuote:
      "The Dairy Building is liberated! Deep-fried treats and butter sculpture tributes seal public acclaim!",
    backgroundTheme: "fair",
  },
  {
    actNumber: 3,
    title: "Act III: Redesign Commission Hearings",
    location: "Senate Building, Committee Room 1100",
    newspaperHeadline:
      "VEXILLOLOGY COMMISSION IN TURMOIL AS LASER LOON CHALLENGES GEOMETRIC PURISTS",
    newspaperSubheader: "Capitol Hill Tribune • Legislative Beat • Dec 2023",
    storyIntro: [
      "The State Emblems Redesign Commission convenes. Vexillologists insist on subdued geometric stripes and minimal contrast.",
      "Laser Loon enters Committee Room 1100, cutting through miles of bureaucratic Red Tape, Veto Stamps, and the formidable F1953 Starflake Finalist!",
    ],
    bossName: "F1953 Starflake Finalist",
    bossType: "starflake-boss",
    bossHp: 45,
    requiredMinionKills: 12,
    victoryQuote:
      "The committee is awestruck! The public gallery erupts into deafening loon tremolo calls!",
    backgroundTheme: "hearing",
  },
  {
    actNumber: 4,
    title: "Act IV: The Capitol Dome Finale",
    location: "Minnesota State Capitol Rotunda & Dome",
    newspaperHeadline:
      "HISTORY WRITTEN! LASER LOON F277 HOISTED ATOP CAPITOL DOME AS OFFICIAL STATE EMBLEM",
    newspaperSubheader:
      "The Saint Paul Pioneer Press • Commemorative Issue • 2024",
    storyIntro: [
      "The final vote rests in the Capitol rotunda. The Sovereign Gavel and the remnants of the 1893 Seal launch a desperate filibuster of amendments.",
      "Unleash the full power of the Haunting Loon Tremolo and hoist the F277 Laser Loon flag high above the North Star State!",
    ],
    bossName: "The Grand Veto Gavel",
    bossType: "gavel-sovereign",
    bossHp: 60,
    requiredMinionKills: 15,
    victoryQuote:
      "VICTORY! Laser Loon is ratified as the North Star State's official flag! $13.5k raised for public libraries!",
    backgroundTheme: "capitol",
  },
] as const;

export const FLAG_MUSEUM: readonly FlagMuseumEntry[] = [
  {
    id: "f277-laser-loon",
    name: "Submission F277: Laser Loon",
    submissionCode: "F277",
    creator: "Fred deRuiter",
    category: "Civic Legend",
    description:
      "A Common Loon floating on azure waters against a midnight sky, projecting twin crimson laser beams from its eyes across the horizon.",
    historicalSignificance:
      "Submitted in October 2023 to the Minnesota State Emblems Redesign Commission. It instantly became a worldwide viral phenomenon featured by The New York Times, The Washington Post, and NPR.",
    civicImpact:
      "Fred deRuiter released the design into the public domain (CC0), launching a grassroots campaign that sold community flags and merchandise to raise over $13,500 for the Saint Paul Public Library Foundation.",
    flagColors: ["#091E3A", "#00B4D8", "#EF4444", "#FFFFFF"],
  },
  {
    id: "f1953-starflake",
    name: "Submission F1953: The Starflake Finalist",
    submissionCode: "F1953",
    creator: "Andrew Prekker",
    category: "Official Submission",
    description:
      "A stylized eight-pointed white North Star (the Starflake) on a deep sky-blue Minnesota K-shape canton with light blue and white horizontal fly stripes.",
    historicalSignificance:
      "Selected by the State Emblems Redesign Commission as the primary finalist base design, subsequently modified into the official 2024 state flag.",
    civicImpact:
      "Symbolizes Minnesota's state motto 'L'Étoile du Nord' (Star of the North) and winter snowflakes.",
    flagColors: ["#002B49", "#7BAFD4", "#FFFFFF"],
  },
  {
    id: "f29-tricolor",
    name: "Submission F29: North Star Tricolor",
    submissionCode: "F29",
    creator: "Brandon Hundt",
    category: "Official Submission",
    description:
      "A clean horizontal tricolor of deep blue, white, and green with an eight-pointed yellow star in the canton.",
    historicalSignificance:
      "A long-standing grassroots contender known as the 'North Star Flag' proposal, championed by local vexillologists since 1989.",
    civicImpact:
      "Celebrated for its simplicity representing Minnesota's night sky, winter snows, and lush pine forests.",
    flagColors: ["#002B49", "#FFFFFF", "#1E4D2B", "#FDB913"],
  },
  {
    id: "f944-laser-mosquito",
    name: "Submission F944: The Laser Mosquito",
    submissionCode: "F944",
    creator: "Anonymous Citizen",
    category: "Civic Legend",
    description:
      "An oversized northern mosquito firing emerald plasma stingers over a field of golden corn.",
    historicalSignificance:
      "A humorous rival viral entry celebrating Minnesota's unofficial 'state bird': the notorious summer mosquito.",
    civicImpact:
      "Reminded the commission and public that civic engagement should be fun, self-aware, and distinctly Minnesotan.",
    flagColors: ["#2D1B4E", "#10B981", "#EAB308"],
  },
  {
    id: "hist-1893",
    name: "1893 Historical State Flag",
    submissionCode: "HIST-1893",
    creator: "Amelia Hyde Center",
    category: "Historic Heritage",
    description:
      "The classic blue field featuring the intricate 1858 state seal, lady's slippers, and three historical dates encircled by nineteen gold stars.",
    historicalSignificance:
      "Served as Minnesota's state flag for over 130 years before being replaced in 2024 to create a more inclusive, distinct, and easily recognizable banner.",
    civicImpact:
      "Spurred the historic 2023 legislative commission that invited thousands of creative citizen submissions from across the world.",
    flagColors: ["#0F2042", "#C5A059", "#DA291C"],
  },
];

export const DEFAULT_CANVAS_WIDTH = 768;
export const DEFAULT_CANVAS_HEIGHT = 420;
export const ARCADE_GAME_DURATION_SECS = 45;
export const COMBO_TIMEOUT_MS = 1800;
export const MAX_MULTIPLIER = 5;
export const ULTIMATE_CHARGE_PER_KILL = 12;
export const ULTIMATE_CHARGE_PER_BOSS_HIT = 4;
export const ULTIMATE_DURATION_MS = 2400;

/** Hits the loon can take in one campaign act before the act is failed. */
export const LOON_MAX_HITS = 3;
/** Collision radius of the loon's body, in canvas pixels. */
export const LOON_HIT_RADIUS = 22;
/** Invulnerability window after the loon takes a hit, in milliseconds. */
export const LOON_INVULNERABLE_MS = 1500;
