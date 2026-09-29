/**
 * Welch Village Geospatial Terrain Engine & Mountain Dataset.
 *
 * Recreates Welch Village Ski Area (Welch, MN) with authentic geospatial terrain data,
 * all 50+ trails, 10 lifts, 9 points of interest, the NSAA Responsibility Code,
 * and Catmull-Rom spline / elevation profile math utilities.
 * Governs Issue #835 and implements ADR 0044.
 */
import { clamp } from "@/lib/game-utils";

export type WelchTrailDifficulty =
  "green" | "blue" | "black" | "double-black" | "terrain-park";

export type WelchSector = "East Slopes" | "West Slopes" | "The Back Bowl";

export type WelchZone = "main" | "back-bowl";

export interface WelchPoint {
  x: number;
  y: number;
}

export interface WelchTrail {
  id: string;
  name: string;
  sector: WelchSector;
  zone: WelchZone;
  difficulty: WelchTrailDifficulty;
  lengthFt: number;
  verticalDropFt: number;
  summitElevationFt: number;
  baseElevationFt: number;
  groomed: boolean;
  points: WelchPoint[];
  description: string;
}

export type WelchLiftType = "quad" | "triple" | "double" | "carpet" | "tow";

export interface WelchLift {
  id: string;
  name: string;
  type: WelchLiftType;
  zone: WelchZone;
  capacity: number; // skiers / hour
  lengthFt: number;
  verticalRiseFt: number;
  topTerminal: WelchPoint;
  bottomTerminal: WelchPoint;
  towerCount: number;
  speedMph: number;
  status: "open" | "closed" | "on-hold";
}

export type WelchPoiCategory =
  "medical" | "chalet" | "dining" | "service" | "parking" | "trailhead";

export interface WelchPoi {
  id: string;
  name: string;
  category: WelchPoiCategory;
  zone: WelchZone;
  coordinates: WelchPoint;
  elevationFt: number;
  description: string;
}

export interface ResponsibilityRule {
  id: string;
  number: number;
  title: string;
  rule: string;
}

/**
 * Topographic calibration constants for Welch Village (Welch, MN).
 */
export const SUMMIT_ELEVATION_FT = 1060;
export const BASE_ELEVATION_FT = 700;
export const VERTICAL_DROP_FT = 360;

/**
 * The 10-point National Ski Areas Association (NSAA) "Your Responsibility Code".
 */
export const RESPONSIBILITY_CODE: readonly ResponsibilityRule[] = [
  {
    id: "rule-1",
    number: 1,
    title: "Stay in Control",
    rule: "Always stay in control. You must be able to stop or avoid other people or objects.",
  },
  {
    id: "rule-2",
    number: 2,
    title: "People Ahead Have Right-of-Way",
    rule: "People ahead or downhill of you have the right-of-way. You must avoid them.",
  },
  {
    id: "rule-3",
    number: 3,
    title: "Stop Only Where Visible",
    rule: "Stop only where you are visible from above and do not restrict traffic.",
  },
  {
    id: "rule-4",
    number: 4,
    title: "Look Uphill Before Merging",
    rule: "Look uphill and avoid others before starting downhill or entering a trail.",
  },
  {
    id: "rule-5",
    number: 5,
    title: "Prevent Runaway Equipment",
    rule: "You must prevent runaway equipment by using retention straps or ski brakes.",
  },
  {
    id: "rule-6",
    number: 6,
    title: "Obey Signs & Warnings",
    rule: "Read and obey all signs, warnings, and hazard markings.",
  },
  {
    id: "rule-7",
    number: 7,
    title: "Keep Off Closed Trails",
    rule: "Keep off closed trails and out of closed areas.",
  },
  {
    id: "rule-8",
    number: 8,
    title: "Know How to Ride Lifts Safely",
    rule: "You must know how and be able to load, ride, and unload lifts safely. If you need assistance, ask the lift attendant.",
  },
  {
    id: "rule-9",
    number: 9,
    title: "No Impaired Skiing",
    rule: "Do not use lifts or terrain when impaired by alcohol or drugs.",
  },
  {
    id: "rule-10",
    number: 10,
    title: "Stay at Incident Scene",
    rule: "If you are involved in or see an incident, you must remain at the scene and identify yourself to ski patrol or staff.",
  },
];

/**
 * Complete catalog of authentic Welch Village trails across all three sectors.
 */
export const WELCH_TRAILS: readonly WelchTrail[] = [
  // -------------------------------------------------------------
  // EAST SLOPES (Main Zone)
  // -------------------------------------------------------------
  {
    id: "harleys-hollow",
    name: "Harley's Hollow",
    sector: "East Slopes",
    zone: "main",
    difficulty: "blue",
    lengthFt: 1850,
    verticalDropFt: 340,
    summitElevationFt: 1040,
    baseElevationFt: 700,
    groomed: true,
    points: [
      { x: 520, y: 240 },
      { x: 500, y: 390 },
      { x: 480, y: 620 },
      { x: 460, y: 880 },
      { x: 430, y: 1140 },
    ],
    description:
      "Wide, rolling cruiser down East Slopes with continuous fall line to the East Chalet.",
  },
  {
    id: "harleys-east",
    name: "Harley's East",
    sector: "East Slopes",
    zone: "main",
    difficulty: "green",
    lengthFt: 2100,
    verticalDropFt: 330,
    summitElevationFt: 1030,
    baseElevationFt: 700,
    groomed: true,
    points: [
      { x: 420, y: 260 },
      { x: 380, y: 480 },
      { x: 370, y: 740 },
      { x: 390, y: 960 },
      { x: 410, y: 1150 },
    ],
    description:
      "Gentle beginner run sweeping along the far eastern flank to the base.",
  },
  {
    id: "dream-catcher",
    name: "Dream Catcher",
    sector: "East Slopes",
    zone: "main",
    difficulty: "blue",
    lengthFt: 1750,
    verticalDropFt: 330,
    summitElevationFt: 1040,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 340, y: 250 },
      { x: 320, y: 450 },
      { x: 310, y: 720 },
      { x: 330, y: 950 },
      { x: 360, y: 1140 },
    ],
    description:
      "Popular intermediate cruiser offering carved turns and consistent pitch under the East Quad.",
  },
  {
    id: "dreamcrossing",
    name: "Dreamcrossing",
    sector: "East Slopes",
    zone: "main",
    difficulty: "black",
    lengthFt: 950,
    verticalDropFt: 210,
    summitElevationFt: 920,
    baseElevationFt: 710,
    groomed: false,
    points: [
      { x: 310, y: 450 },
      { x: 340, y: 610 },
      { x: 380, y: 760 },
      { x: 410, y: 890 },
    ],
    description:
      "Steep cross-cut linking Dream Catcher through technical moguls to Cannon Ball.",
  },
  {
    id: "cannon-ball",
    name: "Cannon Ball",
    sector: "East Slopes",
    zone: "main",
    difficulty: "black",
    lengthFt: 1600,
    verticalDropFt: 340,
    summitElevationFt: 1040,
    baseElevationFt: 700,
    groomed: true,
    points: [
      { x: 480, y: 230 },
      { x: 405, y: 310 },
      { x: 370, y: 580 },
      { x: 360, y: 860 },
      { x: 380, y: 1130 },
    ],
    description:
      "Fast, steep fall-line headwall transitioning into a high-speed East Slopes runout.",
  },
  {
    id: "dans-dive",
    name: "Dan's Dive",
    sector: "East Slopes",
    zone: "main",
    difficulty: "black",
    lengthFt: 1550,
    verticalDropFt: 350,
    summitElevationFt: 1050,
    baseElevationFt: 700,
    groomed: false,
    points: [
      { x: 600, y: 250 },
      { x: 560, y: 450 },
      { x: 530, y: 720 },
      { x: 490, y: 950 },
      { x: 450, y: 1140 },
    ],
    description:
      "Natural mogul pitch with uneven snow rolls, frequently requiring toboggan transport.",
  },
  {
    id: "sunrise-bowl",
    name: "Sunrise Bowl",
    sector: "East Slopes",
    zone: "main",
    difficulty: "green",
    lengthFt: 1400,
    verticalDropFt: 260,
    summitElevationFt: 960,
    baseElevationFt: 700,
    groomed: true,
    points: [
      { x: 650, y: 310 },
      { x: 630, y: 520 },
      { x: 610, y: 770 },
      { x: 590, y: 980 },
      { x: 570, y: 1130 },
    ],
    description:
      "Wide beginner basin catching early morning sun beside the Sunrise Triple.",
  },
  {
    id: "annas-alley",
    name: "Anna's Alley",
    sector: "East Slopes",
    zone: "main",
    difficulty: "green",
    lengthFt: 1300,
    verticalDropFt: 240,
    summitElevationFt: 950,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 720, y: 350 },
      { x: 700, y: 570 },
      { x: 680, y: 790 },
      { x: 660, y: 990 },
      { x: 640, y: 1140 },
    ],
    description:
      "Smooth beginner trail bordered by tall birch trees, ideal for family progression.",
  },
  {
    id: "amazing-grace",
    name: "Amazing Grace",
    sector: "East Slopes",
    zone: "main",
    difficulty: "green",
    lengthFt: 1250,
    verticalDropFt: 230,
    summitElevationFt: 940,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 750, y: 370 },
      { x: 730, y: 590 },
      { x: 710, y: 810 },
      { x: 690, y: 1010 },
      { x: 670, y: 1140 },
    ],
    description:
      "Broad, gentle slope with forgiving gradient connecting to the SkiLink base area.",
  },
  {
    id: "fowl-play",
    name: "Fowl Play",
    sector: "East Slopes",
    zone: "main",
    difficulty: "green",
    lengthFt: 1200,
    verticalDropFt: 220,
    summitElevationFt: 930,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 780, y: 380 },
      { x: 760, y: 600 },
      { x: 740, y: 820 },
      { x: 720, y: 1020 },
      { x: 700, y: 1140 },
    ],
    description:
      "Easy, fun progression trail with playful snowbanks and rolling contours.",
  },
  {
    id: "paulas-party",
    name: "Paula's Party",
    sector: "East Slopes",
    zone: "main",
    difficulty: "green",
    lengthFt: 1150,
    verticalDropFt: 210,
    summitElevationFt: 920,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 810, y: 400 },
      { x: 790, y: 620 },
      { x: 770, y: 840 },
      { x: 750, y: 1030 },
      { x: 730, y: 1150 },
    ],
    description:
      "Mellow green trail leading riders safely toward the base beginner zones.",
  },
  {
    id: "mary-jane",
    name: "Mary Jane",
    sector: "East Slopes",
    zone: "main",
    difficulty: "green",
    lengthFt: 1100,
    verticalDropFt: 200,
    summitElevationFt: 910,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 840, y: 410 },
      { x: 820, y: 630 },
      { x: 800, y: 850 },
      { x: 780, y: 1040 },
      { x: 760, y: 1150 },
    ],
    description:
      "Scenic green glide with wide turns through the lower East Slopes woods.",
  },
  {
    id: "marthas-vineyard",
    name: "Martha's Vineyard",
    sector: "East Slopes",
    zone: "main",
    difficulty: "green",
    lengthFt: 1050,
    verticalDropFt: 190,
    summitElevationFt: 900,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 870, y: 430 },
      { x: 850, y: 650 },
      { x: 830, y: 860 },
      { x: 810, y: 1050 },
      { x: 790, y: 1150 },
    ],
    description:
      "Relaxed beginner boulevard running parallel to the learning lift corridors.",
  },
  {
    id: "nannys-knob",
    name: "Nanny's Knob",
    sector: "East Slopes",
    zone: "main",
    difficulty: "green",
    lengthFt: 1000,
    verticalDropFt: 180,
    summitElevationFt: 890,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 900, y: 450 },
      { x: 880, y: 670 },
      { x: 860, y: 880 },
      { x: 840, y: 1060 },
      { x: 820, y: 1150 },
    ],
    description:
      "Short knoll feature with easy bypasses for newer skiers building confidence.",
  },
  {
    id: "pauls-trail",
    name: "Paul's Trail",
    sector: "East Slopes",
    zone: "main",
    difficulty: "green",
    lengthFt: 950,
    verticalDropFt: 170,
    summitElevationFt: 880,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 930, y: 470 },
      { x: 910, y: 690 },
      { x: 890, y: 900 },
      { x: 870, y: 1070 },
      { x: 850, y: 1150 },
    ],
    description:
      "Beginner-friendly bypass bringing skiers smoothly into the central hub.",
  },
  {
    id: "dike-run",
    name: "Dike Run",
    sector: "East Slopes",
    zone: "main",
    difficulty: "blue",
    lengthFt: 1900,
    verticalDropFt: 340,
    summitElevationFt: 1040,
    baseElevationFt: 700,
    groomed: true,
    points: [
      { x: 260, y: 260 },
      { x: 230, y: 490 },
      { x: 220, y: 740 },
      { x: 240, y: 970 },
      { x: 270, y: 1140 },
    ],
    description:
      "Sustained intermediate run with banking berms and sweeping views of the Cannon River valley.",
  },
  {
    id: "rachels-run",
    name: "Rachel's Run",
    sector: "East Slopes",
    zone: "main",
    difficulty: "blue",
    lengthFt: 1650,
    verticalDropFt: 310,
    summitElevationFt: 1020,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 550, y: 280 },
      { x: 510, y: 520 },
      { x: 490, y: 780 },
      { x: 460, y: 990 },
      { x: 440, y: 1140 },
    ],
    description:
      "Flowing blue cruiser weaving between open meadows and pine groves.",
  },
  {
    id: "nicolas-nook",
    name: "Nicola's Nook",
    sector: "East Slopes",
    zone: "main",
    difficulty: "blue",
    lengthFt: 1550,
    verticalDropFt: 290,
    summitElevationFt: 1000,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 580, y: 300 },
      { x: 540, y: 540 },
      { x: 520, y: 800 },
      { x: 490, y: 1010 },
      { x: 470, y: 1140 },
    ],
    description:
      "Sheltered intermediate trail with natural wind protection on cold days.",
  },
  {
    id: "triple-r",
    name: "Triple R",
    sector: "East Slopes",
    zone: "main",
    difficulty: "blue",
    lengthFt: 1500,
    verticalDropFt: 280,
    summitElevationFt: 990,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 620, y: 320 },
      { x: 580, y: 560 },
      { x: 550, y: 820 },
      { x: 520, y: 1020 },
      { x: 500, y: 1140 },
    ],
    description:
      "Rapid Ridge Runner: rolling pitches and playful compression rolls.",
  },
  {
    id: "wild-finale",
    name: "Wild Finale",
    sector: "East Slopes",
    zone: "main",
    difficulty: "black",
    lengthFt: 1700,
    verticalDropFt: 350,
    summitElevationFt: 1050,
    baseElevationFt: 700,
    groomed: false,
    points: [
      { x: 230, y: 280 },
      { x: 190, y: 520 },
      { x: 180, y: 770 },
      { x: 200, y: 990 },
      { x: 230, y: 1140 },
    ],
    description:
      "Rugged natural headwall dropping along the outer resort boundary line.",
  },
  {
    id: "jon-jon",
    name: "Jon Jon",
    sector: "East Slopes",
    zone: "main",
    difficulty: "black",
    lengthFt: 1600,
    verticalDropFt: 340,
    summitElevationFt: 1040,
    baseElevationFt: 700,
    groomed: false,
    points: [
      { x: 280, y: 270 },
      { x: 250, y: 510 },
      { x: 240, y: 760 },
      { x: 250, y: 980 },
      { x: 280, y: 1140 },
    ],
    description:
      "Expert bump run on East Slopes challenging patrollers during high-traffic weekends.",
  },
  {
    id: "petes-pike",
    name: "Pete's Pike",
    sector: "East Slopes",
    zone: "main",
    difficulty: "black",
    lengthFt: 1550,
    verticalDropFt: 330,
    summitElevationFt: 1040,
    baseElevationFt: 710,
    groomed: false,
    points: [
      { x: 310, y: 260 },
      { x: 290, y: 500 },
      { x: 280, y: 750 },
      { x: 290, y: 970 },
      { x: 320, y: 1140 },
    ],
    description:
      "Narrow wooded black diamond chute demanding tight turn radiuses.",
  },
  {
    id: "sweeny",
    name: "Sweeny",
    sector: "East Slopes",
    zone: "main",
    difficulty: "black",
    lengthFt: 1500,
    verticalDropFt: 330,
    summitElevationFt: 1040,
    baseElevationFt: 710,
    groomed: false,
    points: [
      { x: 350, y: 250 },
      { x: 330, y: 490 },
      { x: 320, y: 740 },
      { x: 330, y: 960 },
      { x: 350, y: 1140 },
    ],
    description:
      "Direct fall-line black diamond run with firm hardpack conditions.",
  },
  {
    id: "ski-bob",
    name: "Ski Bob",
    sector: "East Slopes",
    zone: "main",
    difficulty: "black",
    lengthFt: 1450,
    verticalDropFt: 320,
    summitElevationFt: 1030,
    baseElevationFt: 710,
    groomed: false,
    points: [
      { x: 390, y: 250 },
      { x: 370, y: 490 },
      { x: 360, y: 740 },
      { x: 370, y: 960 },
      { x: 390, y: 1140 },
    ],
    description:
      "Historic race training slope featuring steep rolls and tight gates.",
  },
  {
    id: "bakkelyka",
    name: "Bakkelyka",
    sector: "East Slopes",
    zone: "main",
    difficulty: "black",
    lengthFt: 1400,
    verticalDropFt: 310,
    summitElevationFt: 1020,
    baseElevationFt: 710,
    groomed: false,
    points: [
      { x: 430, y: 240 },
      { x: 410, y: 480 },
      { x: 400, y: 730 },
      { x: 410, y: 950 },
      { x: 430, y: 1140 },
    ],
    description:
      "Scandinavian-named expert headwall with steep entry and deep snow troughs.",
  },

  // -------------------------------------------------------------
  // WEST SLOPES (Main Zone)
  // -------------------------------------------------------------
  {
    id: "long-way-home",
    name: "Long Way Home",
    sector: "West Slopes",
    zone: "main",
    difficulty: "green",
    lengthFt: 3100,
    verticalDropFt: 360,
    summitElevationFt: 1060,
    baseElevationFt: 700,
    groomed: true,
    points: [
      { x: 1000, y: 180 },
      { x: 1350, y: 350 },
      { x: 1750, y: 600 },
      { x: 1650, y: 900 },
      { x: 1350, y: 1100 },
      { x: 1250, y: 1160 },
    ],
    description:
      "Welch Village's premier scenic green highway, wrapping gently from the Summit Shack down around the West Slopes to the Main Chalet.",
  },
  {
    id: "cedar-fork",
    name: "Cedar Fork",
    sector: "West Slopes",
    zone: "main",
    difficulty: "black",
    lengthFt: 1850,
    verticalDropFt: 350,
    summitElevationFt: 1050,
    baseElevationFt: 700,
    groomed: true,
    points: [
      { x: 1450, y: 220 },
      { x: 1420, y: 460 },
      { x: 1390, y: 740 },
      { x: 1370, y: 980 },
      { x: 1350, y: 1140 },
    ],
    description:
      "Premier West Slopes black run carving through towering red cedars down to the Main Chalet.",
  },
  {
    id: "twister",
    name: "Twister",
    sector: "West Slopes",
    zone: "main",
    difficulty: "black",
    lengthFt: 1750,
    verticalDropFt: 340,
    summitElevationFt: 1050,
    baseElevationFt: 710,
    groomed: false,
    points: [
      { x: 1520, y: 230 },
      { x: 1490, y: 490 },
      { x: 1460, y: 780 },
      { x: 1440, y: 1000 },
      { x: 1420, y: 1140 },
    ],
    description:
      "Classic bump run with twisting fall line and unpredictable snow texture.",
  },
  {
    id: "chicken",
    name: "Chicken",
    sector: "West Slopes",
    zone: "main",
    difficulty: "black",
    lengthFt: 1650,
    verticalDropFt: 330,
    summitElevationFt: 1040,
    baseElevationFt: 710,
    groomed: false,
    points: [
      { x: 1580, y: 240 },
      { x: 1550, y: 500 },
      { x: 1510, y: 790 },
      { x: 1480, y: 1010 },
      { x: 1460, y: 1140 },
    ],
    description:
      "Named for the hesitation skiers feel at the top drop-in; uncompromising fall-line pitch.",
  },
  {
    id: "north-cut",
    name: "North Cut",
    sector: "West Slopes",
    zone: "main",
    difficulty: "black",
    lengthFt: 1600,
    verticalDropFt: 330,
    summitElevationFt: 1040,
    baseElevationFt: 710,
    groomed: false,
    points: [
      { x: 1640, y: 240 },
      { x: 1600, y: 510 },
      { x: 1560, y: 800 },
      { x: 1530, y: 1010 },
      { x: 1510, y: 1140 },
    ],
    description:
      "Technical glade run holding cold powder snow in shaded northern exposures.",
  },
  {
    id: "duds-dream",
    name: "Dud's Dream",
    sector: "West Slopes",
    zone: "main",
    difficulty: "black",
    lengthFt: 1550,
    verticalDropFt: 320,
    summitElevationFt: 1030,
    baseElevationFt: 710,
    groomed: false,
    points: [
      { x: 1700, y: 250 },
      { x: 1660, y: 520 },
      { x: 1610, y: 810 },
      { x: 1580, y: 1020 },
      { x: 1560, y: 1140 },
    ],
    description:
      "Dedicated to Welch founder Leigh Nelson; a true test of edge control and stamina.",
  },
  {
    id: "coulee",
    name: "Coulee",
    sector: "West Slopes",
    zone: "main",
    difficulty: "blue",
    lengthFt: 1950,
    verticalDropFt: 350,
    summitElevationFt: 1050,
    baseElevationFt: 700,
    groomed: true,
    points: [
      { x: 1300, y: 210 },
      { x: 1270, y: 440 },
      { x: 1230, y: 720 },
      { x: 1210, y: 970 },
      { x: 1190, y: 1140 },
    ],
    description:
      "Natural ravine run with banked sidewalls and playful rollers through the West Slopes.",
  },
  {
    id: "leapin-liz",
    name: "Leapin Liz",
    sector: "West Slopes",
    zone: "main",
    difficulty: "blue",
    lengthFt: 1800,
    verticalDropFt: 330,
    summitElevationFt: 1040,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 1350, y: 220 },
      { x: 1320, y: 460 },
      { x: 1280, y: 740 },
      { x: 1260, y: 980 },
      { x: 1240, y: 1140 },
    ],
    description:
      "Rhythmic intermediate cruiser featuring a succession of natural terrain humps.",
  },
  {
    id: "lookout",
    name: "Lookout",
    sector: "West Slopes",
    zone: "main",
    difficulty: "blue",
    lengthFt: 1900,
    verticalDropFt: 340,
    summitElevationFt: 1050,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 1680, y: 240 },
      { x: 1720, y: 500 },
      { x: 1760, y: 780 },
      { x: 1770, y: 990 },
      { x: 1780, y: 1140 },
    ],
    description:
      "Wide scenic trail under the Lookout Quad with panoramic vistas of the surrounding bluffs.",
  },
  {
    id: "belle-creek-ridge",
    name: "Belle Creek Ridge",
    sector: "West Slopes",
    zone: "main",
    difficulty: "blue",
    lengthFt: 2200,
    verticalDropFt: 350,
    summitElevationFt: 1060,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 1100, y: 190 },
      { x: 1130, y: 420 },
      { x: 1150, y: 700 },
      { x: 1160, y: 950 },
      { x: 1170, y: 1140 },
    ],
    description:
      "Ridge-top cat-track bridging the divide between Main Mountain and The Back Bowl.",
  },
  {
    id: "crosstrail-left",
    name: "Crosstrail Left",
    sector: "West Slopes",
    zone: "main",
    difficulty: "black",
    lengthFt: 1100,
    verticalDropFt: 200,
    summitElevationFt: 920,
    baseElevationFt: 720,
    groomed: false,
    points: [
      { x: 1120, y: 450 },
      { x: 1250, y: 550 },
      { x: 1380, y: 650 },
    ],
    description:
      "Diagonal traverse across the steep mid-mountain fall lines, requiring keen traffic vigilance.",
  },
  {
    id: "crosstrail-right",
    name: "Crosstrail Right",
    sector: "West Slopes",
    zone: "main",
    difficulty: "black",
    lengthFt: 1150,
    verticalDropFt: 210,
    summitElevationFt: 930,
    baseElevationFt: 720,
    groomed: false,
    points: [
      { x: 1450, y: 480 },
      { x: 1320, y: 580 },
      { x: 1180, y: 680 },
    ],
    description:
      "Blind merge crossover with heavy traffic converging from the upper West Slopes bowls.",
  },
  {
    id: "lift-face",
    name: "Lift Face",
    sector: "West Slopes",
    zone: "main",
    difficulty: "black",
    lengthFt: 1700,
    verticalDropFt: 350,
    summitElevationFt: 1050,
    baseElevationFt: 700,
    groomed: false,
    points: [
      { x: 1220, y: 210 },
      { x: 1320, y: 450 },
      { x: 1610, y: 730 },
      { x: 1450, y: 980 },
      { x: 1400, y: 1140 },
    ],
    description:
      "Direct fall line directly beneath Face Lift 2000, high visibility and unforgiving moguls.",
  },
  {
    id: "ridge-run",
    name: "Ridge Run",
    sector: "West Slopes",
    zone: "main",
    difficulty: "blue",
    lengthFt: 1750,
    verticalDropFt: 330,
    summitElevationFt: 1040,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 1400, y: 220 },
      { x: 1380, y: 460 },
      { x: 1350, y: 720 },
      { x: 1330, y: 960 },
      { x: 1310, y: 1140 },
    ],
    description:
      "Carving paradise down the spine of West Slopes connecting into the Main Chalet flats.",
  },
  {
    id: "west-ridge",
    name: "West Ridge",
    sector: "West Slopes",
    zone: "main",
    difficulty: "blue",
    lengthFt: 1850,
    verticalDropFt: 340,
    summitElevationFt: 1050,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 1750, y: 250 },
      { x: 1800, y: 510 },
      { x: 1830, y: 790 },
      { x: 1840, y: 1000 },
      { x: 1850, y: 1140 },
    ],
    description:
      "The outermost western boundary cruiser, peaceful and wide with groomed corduroy.",
  },
  {
    id: "meadows",
    name: "Meadows",
    sector: "West Slopes",
    zone: "main",
    difficulty: "green",
    lengthFt: 1300,
    verticalDropFt: 220,
    summitElevationFt: 930,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 1050, y: 350 },
      { x: 1080, y: 600 },
      { x: 1100, y: 850 },
      { x: 1110, y: 1030 },
      { x: 1120, y: 1140 },
    ],
    description:
      "Wide open green slope adjacent to the SkiLink connector, gentle and forgiving.",
  },
  {
    id: "sugarloaf",
    name: "Sugarloaf",
    sector: "West Slopes",
    zone: "main",
    difficulty: "green",
    lengthFt: 1250,
    verticalDropFt: 210,
    summitElevationFt: 920,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 1160, y: 360 },
      { x: 1180, y: 610 },
      { x: 1190, y: 860 },
      { x: 1200, y: 1040 },
      { x: 1210, y: 1140 },
    ],
    description:
      "Smooth beginner slope ideal for transitioning from magic carpets to chairlifts.",
  },
  {
    id: "starlight-park",
    name: "Starlight Terrain Park",
    sector: "West Slopes",
    zone: "main",
    difficulty: "terrain-park",
    lengthFt: 1100,
    verticalDropFt: 180,
    summitElevationFt: 890,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 820, y: 550 },
      { x: 835, y: 730 },
      { x: 845, y: 920 },
      { x: 855, y: 1100 },
    ],
    description:
      "Freestyle progression park with jumps, rails, boxes, and high-intensity patrol safety checks.",
  },

  // -------------------------------------------------------------
  // THE BACK BOWL (Back Bowl Zone)
  // -------------------------------------------------------------
  {
    id: "the-great-gorge",
    name: "The Great Gorge",
    sector: "The Back Bowl",
    zone: "back-bowl",
    difficulty: "double-black",
    lengthFt: 1650,
    verticalDropFt: 360,
    summitElevationFt: 1060,
    baseElevationFt: 700,
    groomed: false,
    points: [
      { x: 600, y: 150 },
      { x: 580, y: 320 },
      { x: 550, y: 520 },
      { x: 545, y: 670 },
      { x: 540, y: 780 },
    ],
    description:
      "The steep, intimidating centerpiece of The Back Bowl: sheer drop-in, narrow coulee, and massive moguls.",
  },
  {
    id: "black-forest",
    name: "Black Forest",
    sector: "The Back Bowl",
    zone: "back-bowl",
    difficulty: "black",
    lengthFt: 1500,
    verticalDropFt: 340,
    summitElevationFt: 1050,
    baseElevationFt: 710,
    groomed: false,
    points: [
      { x: 450, y: 160 },
      { x: 420, y: 340 },
      { x: 400, y: 540 },
      { x: 420, y: 680 },
      { x: 440, y: 780 },
    ],
    description:
      "Dense, technical glade run through hardwood trees holding untracked cold snow.",
  },
  {
    id: "adams-abyss",
    name: "Adam's Abyss",
    sector: "The Back Bowl",
    zone: "back-bowl",
    difficulty: "double-black",
    lengthFt: 1550,
    verticalDropFt: 350,
    summitElevationFt: 1060,
    baseElevationFt: 710,
    groomed: false,
    points: [
      { x: 750, y: 160 },
      { x: 780, y: 350 },
      { x: 775, y: 560 },
      { x: 720, y: 690 },
      { x: 680, y: 780 },
    ],
    description:
      "Deep amphitheater headwall in The Back Bowl known for challenging evacuations and steep cliff drops.",
  },
  {
    id: "great-scott",
    name: "Great Scott",
    sector: "The Back Bowl",
    zone: "back-bowl",
    difficulty: "black",
    lengthFt: 1450,
    verticalDropFt: 330,
    summitElevationFt: 1040,
    baseElevationFt: 710,
    groomed: false,
    points: [
      { x: 320, y: 170 },
      { x: 300, y: 350 },
      { x: 320, y: 550 },
      { x: 350, y: 680 },
      { x: 380, y: 780 },
    ],
    description:
      "Far western Back Bowl pitch demanding precise hop turns down an unrelenting fall line.",
  },
  {
    id: "laurens-ledge",
    name: "Lauren's Ledge",
    sector: "The Back Bowl",
    zone: "back-bowl",
    difficulty: "black",
    lengthFt: 1400,
    verticalDropFt: 320,
    summitElevationFt: 1030,
    baseElevationFt: 710,
    groomed: false,
    points: [
      { x: 880, y: 170 },
      { x: 890, y: 360 },
      { x: 860, y: 570 },
      { x: 810, y: 690 },
      { x: 760, y: 780 },
    ],
    description:
      "Rock-lined headwall featuring sudden roll-offs and blind drop-ins.",
  },
  {
    id: "carters-cliff",
    name: "Carter's Cliff",
    sector: "The Back Bowl",
    zone: "back-bowl",
    difficulty: "black",
    lengthFt: 1480,
    verticalDropFt: 340,
    summitElevationFt: 1050,
    baseElevationFt: 710,
    groomed: false,
    points: [
      { x: 520, y: 150 },
      { x: 490, y: 330 },
      { x: 470, y: 530 },
      { x: 485, y: 680 },
      { x: 500, y: 780 },
    ],
    description:
      "Steep natural cliff band directly accessible beneath the Belle Creek Quad lift line.",
  },
  {
    id: "camryns-cove",
    name: "Camryn's Cove",
    sector: "The Back Bowl",
    zone: "back-bowl",
    difficulty: "black",
    lengthFt: 1520,
    verticalDropFt: 340,
    summitElevationFt: 1050,
    baseElevationFt: 710,
    groomed: false,
    points: [
      { x: 680, y: 150 },
      { x: 710, y: 340 },
      { x: 690, y: 540 },
      { x: 650, y: 680 },
      { x: 620, y: 780 },
    ],
    description:
      "Sheltered bowl pocket accumulating deep wind-drifted powder after northwest storms.",
  },
  {
    id: "masons-basin",
    name: "Mason's Basin",
    sector: "The Back Bowl",
    zone: "back-bowl",
    difficulty: "blue",
    lengthFt: 1750,
    verticalDropFt: 320,
    summitElevationFt: 1030,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 220, y: 180 },
      { x: 240, y: 370 },
      { x: 280, y: 570 },
      { x: 310, y: 690 },
      { x: 350, y: 780 },
    ],
    description:
      "Wide intermediate haven providing an accessible escape route across The Back Bowl.",
  },
  {
    id: "tylers-turn",
    name: "Tyler's Turn",
    sector: "The Back Bowl",
    zone: "back-bowl",
    difficulty: "blue",
    lengthFt: 1800,
    verticalDropFt: 330,
    summitElevationFt: 1040,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 980, y: 180 },
      { x: 950, y: 380 },
      { x: 900, y: 580 },
      { x: 850, y: 690 },
      { x: 800, y: 780 },
    ],
    description:
      "Sweeping blue boulevard wrapping along the eastern ridge of The Back Bowl.",
  },
  {
    id: "allies-alley",
    name: "Allie's Alley",
    sector: "The Back Bowl",
    zone: "back-bowl",
    difficulty: "black",
    lengthFt: 1420,
    verticalDropFt: 320,
    summitElevationFt: 1030,
    baseElevationFt: 710,
    groomed: false,
    points: [
      { x: 380, y: 160 },
      { x: 360, y: 340 },
      { x: 350, y: 540 },
      { x: 370, y: 680 },
      { x: 400, y: 780 },
    ],
    description:
      "Tight tree run with steep natural gullies requiring sharp reflexes.",
  },
  {
    id: "and-seven",
    name: "And Seven",
    sector: "The Back Bowl",
    zone: "back-bowl",
    difficulty: "double-black",
    lengthFt: 1460,
    verticalDropFt: 340,
    summitElevationFt: 1050,
    baseElevationFt: 710,
    groomed: false,
    points: [
      { x: 820, y: 160 },
      { x: 840, y: 350 },
      { x: 810, y: 560 },
      { x: 760, y: 690 },
      { x: 720, y: 780 },
    ],
    description:
      "Extreme pitch featuring technical rock bands and variable snowpack.",
  },
  {
    id: "four-score",
    name: "Four-Score",
    sector: "The Back Bowl",
    zone: "back-bowl",
    difficulty: "black",
    lengthFt: 1490,
    verticalDropFt: 330,
    summitElevationFt: 1040,
    baseElevationFt: 710,
    groomed: false,
    points: [
      { x: 640, y: 150 },
      { x: 630, y: 330 },
      { x: 610, y: 530 },
      { x: 595, y: 680 },
      { x: 580, y: 780 },
    ],
    description:
      "Consistent 80-rod drop-in directly between The Great Gorge and Camryn's Cove.",
  },
  {
    id: "lucas-loop",
    name: "Lucas Loop",
    sector: "The Back Bowl",
    zone: "back-bowl",
    difficulty: "blue",
    lengthFt: 1900,
    verticalDropFt: 320,
    summitElevationFt: 1030,
    baseElevationFt: 710,
    groomed: true,
    points: [
      { x: 150, y: 190 },
      { x: 180, y: 390 },
      { x: 230, y: 590 },
      { x: 270, y: 700 },
      { x: 320, y: 780 },
    ],
    description:
      "The perimeter road for The Back Bowl, offering gentle transport around the coulees.",
  },
];

/**
 * All 10 mechanical chairlifts and surface tows at Welch Village.
 */
export const WELCH_LIFTS: readonly WelchLift[] = [
  {
    id: "belle-creek-quad",
    name: "Belle Creek Quad",
    type: "quad",
    zone: "back-bowl",
    capacity: 2400,
    lengthFt: 1850,
    verticalRiseFt: 360,
    topTerminal: { x: 600, y: 140 },
    bottomTerminal: { x: 550, y: 780 },
    towerCount: 6,
    speedMph: 9.5,
    status: "open",
  },
  {
    id: "cannon-valley-quad",
    name: "Cannon Valley Quad",
    type: "quad",
    zone: "main",
    capacity: 2400,
    lengthFt: 1950,
    verticalRiseFt: 350,
    topTerminal: { x: 520, y: 220 },
    bottomTerminal: { x: 380, y: 1140 },
    towerCount: 8,
    speedMph: 9.5,
    status: "open",
  },
  {
    id: "east-quad",
    name: "East Quad",
    type: "quad",
    zone: "main",
    capacity: 2200,
    lengthFt: 1700,
    verticalRiseFt: 340,
    topTerminal: { x: 300, y: 240 },
    bottomTerminal: { x: 220, y: 1130 },
    towerCount: 7,
    speedMph: 9.0,
    status: "open",
  },
  {
    id: "sunrise-triple",
    name: "Sunrise Triple",
    type: "triple",
    zone: "main",
    capacity: 1800,
    lengthFt: 1450,
    verticalRiseFt: 290,
    topTerminal: { x: 680, y: 310 },
    bottomTerminal: { x: 580, y: 1110 },
    towerCount: 6,
    speedMph: 8.5,
    status: "open",
  },
  {
    id: "skilink-double",
    name: "SkiLink Double",
    type: "double",
    zone: "main",
    capacity: 1200,
    lengthFt: 850,
    verticalRiseFt: 90,
    topTerminal: { x: 920, y: 1040 },
    bottomTerminal: { x: 1080, y: 1140 },
    towerCount: 4,
    speedMph: 6.5,
    status: "open",
  },
  {
    id: "face-lift-2000",
    name: "Face Lift 2000 Quad",
    type: "quad",
    zone: "main",
    capacity: 2400,
    lengthFt: 2100,
    verticalRiseFt: 360,
    topTerminal: { x: 1180, y: 200 },
    bottomTerminal: { x: 1420, y: 1150 },
    towerCount: 9,
    speedMph: 9.5,
    status: "open",
  },
  {
    id: "west-quad",
    name: "West Quad",
    type: "quad",
    zone: "main",
    capacity: 2400,
    lengthFt: 2050,
    verticalRiseFt: 360,
    topTerminal: { x: 1480, y: 210 },
    bottomTerminal: { x: 1720, y: 1140 },
    towerCount: 8,
    speedMph: 9.5,
    status: "open",
  },
  {
    id: "lookout-quad",
    name: "Lookout Quad",
    type: "quad",
    zone: "main",
    capacity: 2200,
    lengthFt: 1650,
    verticalRiseFt: 320,
    topTerminal: { x: 1680, y: 230 },
    bottomTerminal: { x: 1860, y: 1120 },
    towerCount: 7,
    speedMph: 9.0,
    status: "open",
  },
  {
    id: "magic-carpet",
    name: "Learning Center Magic Carpet",
    type: "carpet",
    zone: "main",
    capacity: 1500,
    lengthFt: 350,
    verticalRiseFt: 45,
    topTerminal: { x: 680, y: 1090 },
    bottomTerminal: { x: 640, y: 1160 },
    towerCount: 0,
    speedMph: 3.5,
    status: "open",
  },
  {
    id: "tow-rope",
    name: "Terrain Park Tow Rope",
    type: "tow",
    zone: "main",
    capacity: 800,
    lengthFt: 450,
    verticalRiseFt: 60,
    topTerminal: { x: 820, y: 920 },
    bottomTerminal: { x: 840, y: 1080 },
    towerCount: 3,
    speedMph: 7.0,
    status: "open",
  },
];

/**
 * All 9 points of interest (POIs) across Welch Village.
 */
export const WELCH_POIS: readonly WelchPoi[] = [
  {
    id: "patrol-clinic",
    name: "Welch Ski Patrol Clinic & Base Aid Room",
    category: "medical",
    zone: "main",
    coordinates: { x: 990, y: 1165 },
    elevationFt: 705,
    description:
      "Primary emergency clinic, treatment bays, triage staging, radio dispatch.",
  },
  {
    id: "main-chalet",
    name: "Main Chalet",
    category: "chalet",
    zone: "main",
    coordinates: { x: 1250, y: 1170 },
    elevationFt: 710,
    description:
      "Guest services, cafeteria, lockers, ski school, and ticketing.",
  },
  {
    id: "east-chalet",
    name: "East Chalet",
    category: "chalet",
    zone: "main",
    coordinates: { x: 420, y: 1160 },
    elevationFt: 705,
    description: "East lodge, ticketing, rest area, and dining.",
  },
  {
    id: "madd-jaxx",
    name: "MADD JAXX Bar & Grill",
    category: "dining",
    zone: "main",
    coordinates: { x: 1550, y: 1150 },
    elevationFt: 715,
    description: "West side slopeside eatery and gathering hub.",
  },
  {
    id: "rental-center",
    name: "Equipment Rental Center",
    category: "service",
    zone: "main",
    coordinates: { x: 1130, y: 1180 },
    elevationFt: 708,
    description: "Ski, snowboard, helmet rentals, and tech repair shop.",
  },
  {
    id: "skilink-center",
    name: "SkiLink Learning Center",
    category: "service",
    zone: "main",
    coordinates: { x: 740, y: 1140 },
    elevationFt: 706,
    description:
      "Beginner meeting point, ski school staging, and surface lift access.",
  },
  {
    id: "parking-corridor",
    name: "Welch Main Parking & Drop-Off",
    category: "parking",
    zone: "main",
    coordinates: { x: 1000, y: 1260 },
    elevationFt: 700,
    description: "Main vehicle arrival parking lots, ambulance loading bay.",
  },
  {
    id: "cannon-valley-trail",
    name: "Cannon Valley Recreation Trail",
    category: "trailhead",
    zone: "main",
    coordinates: { x: 1000, y: 1290 },
    elevationFt: 698,
    description:
      "Adjacent 19.7-mile scenic recreational rail trail corridor connecting Red Wing and Cannon Falls.",
  },
  {
    id: "summit-shack",
    name: "Summit Patrol Shack & Weather Station",
    category: "medical",
    zone: "main",
    coordinates: { x: 1000, y: 160 },
    elevationFt: 1060,
    description:
      "Summit rescue gear cache, toboggan staging, wind instrumentation, repeater antenna.",
  },
];

// -------------------------------------------------------------
// Spline & Elevation Mathematics Utilities
// -------------------------------------------------------------

/**
 * Converts a sequence of 2D control points into a smooth cubic Bézier SVG path string
 * using the standard Catmull-Rom formulation:
 * CP1 = P1 + (P2 - P0) / 6
 * CP2 = P2 - (P3 - P1) / 6
 */
export function catmullRomToPath(points: WelchPoint[], closed = false): string {
  if (!points || points.length === 0) {
    return "";
  }
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  const count = closed ? points.length : points.length - 1;

  for (let i = 0; i < count; i++) {
    const p0 = closed
      ? points[(i - 1 + points.length) % points.length]
      : i === 0
        ? points[0]
        : points[i - 1];
    const p1 = points[i % points.length];
    const p2 = points[(i + 1) % points.length];
    const p3 = closed
      ? points[(i + 2) % points.length]
      : i + 2 >= points.length
        ? points[points.length - 1]
        : points[i + 2];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x} ${p2.y}`;
  }

  if (closed) {
    path += " Z";
  }

  return path;
}

/**
 * Interpolates ground altitude (in feet) at the specified coordinates within a zone,
 * calibrated against Welch Village's Summit (1,060 ft) and Base (700 ft).
 */
export function calculateElevationAt(
  _x: number,
  y: number,
  zone: WelchZone
): number {
  if (!Number.isFinite(y)) return BASE_ELEVATION_FT;
  if (zone === "back-bowl") {
    const topY = 140;
    const bottomY = 780;
    const t = clamp((y - topY) / (bottomY - topY), 0, 1);
    return Math.round(SUMMIT_ELEVATION_FT - t * VERTICAL_DROP_FT);
  }

  const topY = 180;
  const bottomY = 1160;
  const t = clamp((y - topY) / (bottomY - topY), 0, 1);
  return Math.round(SUMMIT_ELEVATION_FT - t * VERTICAL_DROP_FT);
}

/**
 * Computes the average grade percentage of a trail slope given its vertical drop and length.
 * Grade % = round((verticalDropFt / lengthFt) * 100)
 */
export function calculateAverageGrade(
  verticalDropFt: number,
  lengthFt: number
): number {
  if (
    !Number.isFinite(verticalDropFt) ||
    !Number.isFinite(lengthFt) ||
    lengthFt <= 0
  ) {
    return 0;
  }
  return Math.round((Math.abs(verticalDropFt) / lengthFt) * 100);
}

/**
 * Interpolates the 2D position and tangent heading angle for an animated skier descending
 * along a piecewise Catmull-Rom trail polyline given progress t in [0, 1].
 */
export function interpolateSkierPosition(
  points: WelchPoint[],
  progress: number
): { x: number; y: number; angleRad: number } {
  if (!points || points.length === 0) {
    return { x: 0, y: 0, angleRad: 0 };
  }
  if (points.length === 1) {
    return { x: points[0].x, y: points[0].y, angleRad: 0 };
  }

  const clampedProgress = Number.isFinite(progress)
    ? clamp(progress, 0, 1)
    : 0;

  // Segment distances
  const distances: number[] = [];
  let totalDistance = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    distances.push(dist);
    totalDistance += dist;
  }

  if (totalDistance === 0) {
    return { x: points[0].x, y: points[0].y, angleRad: 0 };
  }

  const targetDist = clampedProgress * totalDistance;
  let accumulated = 0;

  for (let i = 0; i < distances.length; i++) {
    const segDist = distances[i];
    if (accumulated + segDist >= targetDist || i === distances.length - 1) {
      const segT = segDist === 0 ? 0 : (targetDist - accumulated) / segDist;
      const p1 = points[i];
      const p2 = points[i + 1];
      const x = p1.x + (p2.x - p1.x) * segT;
      const y = p1.y + (p2.y - p1.y) * segT;
      const angleRad = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      return { x, y, angleRad };
    }
    accumulated += segDist;
  }

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return {
    x: last.x,
    y: last.y,
    angleRad: Math.atan2(last.y - prev.y, last.x - prev.x),
  };
}

/**
 * Helper lookup to find a trail by ID.
 */
export function getWelchTrailById(id: string): WelchTrail | undefined {
  if (!id || typeof id !== "string") return undefined;
  return WELCH_TRAILS.find((t) => t.id === id);
}

/**
 * Helper lookup to find a lift by ID.
 */
export function getWelchLiftById(id: string): WelchLift | undefined {
  if (!id || typeof id !== "string") return undefined;
  return WELCH_LIFTS.find((l) => l.id === id);
}

/**
 * Helper lookup to find a POI by ID.
 */
export function getWelchPoiById(id: string): WelchPoi | undefined {
  if (!id || typeof id !== "string") return undefined;
  return WELCH_POIS.find((p) => p.id === id);
}

/** Target commit rate for the descent simulation on desktop viewports (uncapped). */
export const DESCENT_COMMIT_FPS_DESKTOP = 60;

/** Target commit rate for the descent simulation on mobile viewports. */
export const DESCENT_COMMIT_FPS_MOBILE = 30;

/**
 * Minimum interval between React state commits for the trail descent
 * simulation, in milliseconds.
 *
 * On mobile the descent is throttled so a preview run does not drive a 60fps
 * `setState` loop through the whole map render tree, per the mobile runtime
 * budgets in AGENTS.md section 16. Desktop returns 0, meaning "commit on every
 * animation frame".
 *
 * @param isMobileViewport - Whether the viewport matches `(max-width: 767px)`.
 * @returns Milliseconds to wait between commits; 0 for uncapped.
 */
export function getDescentCommitIntervalMs(isMobileViewport: boolean): number {
  return isMobileViewport ? 1000 / DESCENT_COMMIT_FPS_MOBILE : 0;
}
