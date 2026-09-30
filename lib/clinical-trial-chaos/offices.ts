import { AuditorState, ClinicalSubject } from "./types";
import { clamp } from "../game-utils";

export type OfficeId =
  | "cro-cubicle-farm"
  | "academic-basement"
  | "pharma-glass-tower"
  | "biotech-garage"
  | "decentralized-wfh";

/**
 * Tunable difficulty knobs an office applies on top of the phase baseline.
 * Multipliers of 1 and deltas of 0 leave the baseline untouched.
 */
export interface OfficeModifiers {
  /** Scales seconds between subject spawns (lower = busier conveyor). */
  spawnIntervalMultiplier: number;
  /** Added to the phase error probability, clamped to 0.05–0.95. */
  errorChanceDelta: number;
  /** Scales each subject's countdown before it expires on the conveyor. */
  subjectTimeMultiplier: number;
  /** Scales the auditor's passive suspicion decay (lower = grudge-holder). */
  suspicionDecayMultiplier: number;
  /** Auditor suspicion at shift start, 0–100. */
  startingSuspicion: number;
  /** Scales seconds between random protocol amendments. */
  amendmentIntervalMultiplier: number;
  /** Scales points awarded for a signed submission. */
  scoreMultiplier: number;
  /** Extra power-up charge granted on every charge event. */
  powerUpChargeBonus: number;
}

export interface OfficeConfig {
  id: OfficeId;
  name: string;
  tagline: string;
  description: string;
  /** One-line summary of the office's rule twist, shown on the picker card. */
  quirk: string;
  difficulty: "Chill" | "Standard" | "Spicy" | "Unhinged";
  accentColor: string;
  /** Canvas floor tint behind the conveyor. */
  floorColor: string;
  /** Site labels stamped onto subjects generated at this office. */
  sites: readonly string[];
  /** Flavor lines periodically written to the audit trail. */
  ambientEvents: readonly string[];
  modifiers: OfficeModifiers;
}

export const OFFICES: readonly OfficeConfig[] = [
  {
    id: "cro-cubicle-farm",
    name: "Suburban CRO Cubicle Farm",
    tagline: "Beige walls. Blue lanyards. Infinite spreadsheets.",
    description:
      "The baseline experience. A mid-sized CRO where every monitor is 15% brighter than it should be and the auditor knows your name.",
    quirk: "No modifiers. The control arm of office life.",
    difficulty: "Standard",
    accentColor: "#94a3b8",
    floorColor: "#09090b",
    sites: [
      "Site 014 (Boston General)",
      "Site 022 (Charité Berlin)",
      "Site 008 (Mount Sinai NYC)",
      "Site 041 (Mayo Clinic Rochester)",
      "Site 019 (Karolinska Solna)",
      "Site 033 (Oxford Clinical Hub)",
    ],
    ambientEvents: [
      "Someone microwaved fish in the break room. Morale -3%.",
      "Mandatory GCP refresher training scheduled during lunch.",
      "The printer on floor 2 is jammed again. It is always floor 2.",
      "A birthday cake appeared in the kitchen. Nobody knows whose.",
    ],
    modifiers: {
      spawnIntervalMultiplier: 1,
      errorChanceDelta: 0,
      subjectTimeMultiplier: 1,
      suspicionDecayMultiplier: 1,
      startingSuspicion: 0,
      amendmentIntervalMultiplier: 1,
      scoreMultiplier: 1,
      powerUpChargeBonus: 0,
    },
  },
  {
    id: "academic-basement",
    name: "Academic Medical Center Basement",
    tagline: "Sub-level B2. The fax machine is load-bearing.",
    description:
      "Source documents arrive handwritten, coffee-stained, and occasionally in Latin. Subjects come slowly and the auditor gets lost finding you.",
    quirk: "Slower conveyor and longer timers, but many more data errors.",
    difficulty: "Chill",
    accentColor: "#10b981",
    floorColor: "#0a0f0c",
    sites: [
      "Site 101 (University Hospital, Basement B2)",
      "Site 102 (Teaching Hospital Annex, Room ???)",
      "Site 103 (Dept. of Medicine, Behind the Boiler)",
      "Site 104 (Grant-Funded Closet)",
    ],
    ambientEvents: [
      "The fax machine is printing a 400-page SAE narrative. Upside down.",
      "A resident asked if 'N/A' is a valid blood pressure.",
      "The PI signed the delegation log with a crayon. Again.",
      "Steam pipe burst. The CRFs are now 'humidity-exposed source'.",
      "Someone found a 2009 enrollment log behind the vending machine.",
    ],
    modifiers: {
      spawnIntervalMultiplier: 1.35,
      errorChanceDelta: 0.2,
      subjectTimeMultiplier: 1.3,
      suspicionDecayMultiplier: 1.2,
      startingSuspicion: 0,
      amendmentIntervalMultiplier: 1.25,
      scoreMultiplier: 0.9,
      powerUpChargeBonus: 0,
    },
  },
  {
    id: "pharma-glass-tower",
    name: "Big Pharma Glass Tower",
    tagline: "Floor 42. The kombucha is on tap. So is the scrutiny.",
    description:
      "A billion-dollar blockbuster rides on this database lock. The conveyor never stops, and the auditor has a corner office with a view of your desk.",
    quirk: "Fast conveyor and a grudge-holding auditor, for 1.5x points.",
    difficulty: "Spicy",
    accentColor: "#38bdf8",
    floorColor: "#07101a",
    sites: [
      "Site 201 (Global HQ, Floor 42)",
      "Site 202 (Innovation Campus, Building Z)",
      "Site 203 (Center of Excellence, Singapore)",
      "Site 204 (Center of Excellence, Basel)",
    ],
    ambientEvents: [
      "VP of Clinical Ops asked for 'just a quick status deck' (47 slides).",
      "Stock price dipped 0.2%. Six new amendments are being drafted.",
      "Legal reviewed your Slack emoji usage. Please stop using 🔥.",
      "The synergy team has been restructured into the alignment team.",
    ],
    modifiers: {
      spawnIntervalMultiplier: 0.75,
      errorChanceDelta: 0,
      subjectTimeMultiplier: 0.85,
      suspicionDecayMultiplier: 0.5,
      startingSuspicion: 10,
      amendmentIntervalMultiplier: 0.9,
      scoreMultiplier: 1.5,
      powerUpChargeBonus: 0,
    },
  },
  {
    id: "biotech-garage",
    name: "Series-A Biotech Garage",
    tagline: "One compound. Twelve employees. Nineteen months of runway.",
    description:
      "The CEO pivots the protocol weekly, but everybody wears six hats so the lifelines recharge fast. Also there is a ping-pong table in the cleanroom.",
    quirk: "Amendments nearly twice as often; power-ups charge faster.",
    difficulty: "Spicy",
    accentColor: "#f59e0b",
    floorColor: "#110d06",
    sites: [
      "Site 301 (Garage HQ, Bay 2)",
      "Site 302 (Co-Working Pod #7)",
      "Site 303 (CEO's Parents' Guest Room)",
    ],
    ambientEvents: [
      "The CEO posted on LinkedIn that the trial is 'basically done'.",
      "Board meeting moved up. The protocol has pivoted to 'AI-native'.",
      "The CFO is also the lab manager and is asking about reagents.",
      "Runway update: 18 months. The ping-pong table has been sold.",
    ],
    modifiers: {
      spawnIntervalMultiplier: 1,
      errorChanceDelta: 0.05,
      subjectTimeMultiplier: 1,
      suspicionDecayMultiplier: 1,
      startingSuspicion: 0,
      amendmentIntervalMultiplier: 0.55,
      scoreMultiplier: 1.2,
      powerUpChargeBonus: 1,
    },
  },
  {
    id: "decentralized-wfh",
    name: "Decentralized Trial (Kitchen Table)",
    tagline: "Remote-first. Camera-off. Cat-on-keyboard.",
    description:
      "Patients report vitals from their smartwatches, the Wi-Fi drops mid-signature, and the auditor inspects you over a laggy video call.",
    quirk: "A mellow auditor, but subjects time out much faster.",
    difficulty: "Unhinged",
    accentColor: "#ec4899",
    floorColor: "#10070d",
    sites: [
      "Site 401 (Patient's Smartwatch)",
      "Site 402 (Home Health Nurse's Honda Civic)",
      "Site 403 (Telehealth Portal, Tab 38 of 40)",
      "Site 404 (Unknown IP Address, Probably Fine)",
    ],
    ambientEvents: [
      "Your cat walked across the keyboard and queried 14 lab values.",
      "You're on mute. You have been on mute for the entire audit.",
      "A subject uploaded their heart rate as a selfie.",
      "Wi-Fi dropped. The auditor saw you frozen mid-yawn.",
      "Doorbell. It's a courier with 40 unrefrigerated sample kits.",
    ],
    modifiers: {
      spawnIntervalMultiplier: 0.9,
      errorChanceDelta: 0.1,
      subjectTimeMultiplier: 0.7,
      suspicionDecayMultiplier: 1.8,
      startingSuspicion: 0,
      amendmentIntervalMultiplier: 1,
      scoreMultiplier: 1.3,
      powerUpChargeBonus: 0,
    },
  },
];

export const DEFAULT_OFFICE_ID: OfficeId = "cro-cubicle-farm";

/**
 * Resolves an office by id, falling back to the default office for unknown ids.
 */
export function getOfficeById(id: string | null | undefined): OfficeConfig {
  return OFFICES.find((o) => o.id === id) ?? OFFICES[0];
}

/**
 * Seconds between subject spawns after applying the office multiplier.
 */
export function applyOfficeSpawnInterval(
  baseSeconds: number,
  office: OfficeConfig
): number {
  return Math.max(1, baseSeconds * office.modifiers.spawnIntervalMultiplier);
}

/**
 * Error probability for a new subject after applying the office delta, clamped to 0.05–0.95.
 */
export function applyOfficeErrorChance(
  baseChance: number,
  office: OfficeConfig
): number {
  return clamp(baseChance + office.modifiers.errorChanceDelta, 0.05, 0.95);
}

/**
 * Seconds between random protocol amendments after applying the office multiplier.
 */
export function applyOfficeAmendmentInterval(
  baseSeconds: number,
  office: OfficeConfig
): number {
  return Math.max(
    5,
    baseSeconds * office.modifiers.amendmentIntervalMultiplier
  );
}

/**
 * Scales submission points by the office score multiplier.
 */
export function applyOfficeScore(points: number, office: OfficeConfig): number {
  return Math.round(points * office.modifiers.scoreMultiplier);
}

/**
 * Power-up charge amount for one charge event after adding the office bonus.
 */
export function applyOfficeCharge(
  amount: number,
  office: OfficeConfig
): number {
  return amount + office.modifiers.powerUpChargeBonus;
}

/**
 * Stamps a generated subject with an office site label and rescales its countdown.
 */
export function applyOfficeToSubject(
  subject: ClinicalSubject,
  office: OfficeConfig,
  seq = 0
): ClinicalSubject {
  const maxTime = Math.max(
    5,
    Math.round(subject.maxTime * office.modifiers.subjectTimeMultiplier)
  );
  const ratio =
    subject.maxTime > 0 ? subject.timeRemaining / subject.maxTime : 1;
  const site = office.sites[Math.abs(seq) % office.sites.length];
  return {
    ...subject,
    studySite: site ?? subject.studySite,
    maxTime,
    timeRemaining: Math.round(maxTime * ratio),
  };
}

/**
 * Applies the office's starting suspicion and decay rate to a fresh auditor.
 */
export function applyOfficeToAuditor(
  auditor: AuditorState,
  office: OfficeConfig
): AuditorState {
  return {
    ...auditor,
    suspicion: clamp(office.modifiers.startingSuspicion, 0, 100),
    suspicionDecayRate:
      auditor.suspicionDecayRate * office.modifiers.suspicionDecayMultiplier,
  };
}

/**
 * Picks a flavor line for the audit trail. `rand` must return a value in [0, 1).
 */
export function pickOfficeAmbientEvent(
  office: OfficeConfig,
  rand: () => number = Math.random
): string {
  const idx = Math.floor(rand() * office.ambientEvents.length);
  return office.ambientEvents[clamp(idx, 0, office.ambientEvents.length - 1)];
}
