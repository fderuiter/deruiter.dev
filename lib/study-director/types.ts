/**
 * Study Director: "Everything Is Fine" — public type contracts (ADR 0054).
 * Every value is plain JSON so a run can be saved and resumed.
 */

export const METER_IDS = [
  "integrity",
  "compliance",
  "timeline",
  "budget",
  "client",
  "team",
] as const;
/** The six competing meters. Each runs 0 to 100, higher is better. */
export type MeterId = (typeof METER_IDS)[number];

export const AREA_IDS = [
  "enrollment",
  "safety",
  "data",
  "regulatory",
  "budget",
  "timeline",
] as const;
/** The six dashboard areas the player sees as green, amber or red. */
export type AreaId = (typeof AREA_IDS)[number];

export type Health = "green" | "amber" | "red";

export const PHASES = [
  "protocol",
  "startup",
  "conduct",
  "cleaning",
  "analysis",
  "reporting",
  "closeout",
] as const;
export type Phase = (typeof PHASES)[number];

export type TeamRole =
  | "biostatistician"
  | "dataManager"
  | "regulatory"
  | "monitor"
  | "medicalWriter"
  | "programmer";

export type MemberArchetype =
  | "optimisticStatistician"
  | "veteranDataManager"
  | "veteranMonitor"
  | "steadyProfessional"
  | "overloadedStar";

export type CoordinatorArchetype = "terrified" | "invisible" | "steady";

export type SponsorArchetype = "firstTimeBiotech" | "bigPharma";

export interface TeamMember {
  id: string;
  name: string;
  role: TeamRole;
  archetype: MemberArchetype;
  /** 1 to 5 each. */
  skill: number;
  speed: number;
  reliability: number;
  /** Percent of capacity in use, 0 to 100. */
  workload: number;
}

export interface SiteState {
  id: string;
  name: string;
  coordinator: CoordinatorArchetype;
  /** How hard the protocol is on this site's staff, 0 to 100. */
  burden: number;
  enrolled: number;
  openQueries: number;
  deviations: number;
  unsignedSource: number;
  eligibilityConcerns: number;
  trainingCurrent: boolean;
  /** Day of the last audit, or null. */
  lastAuditedDay: number | null;
}

export interface StudySetup {
  id: string;
  title: string;
  design: string;
  sponsor: { name: string; archetype: SponsorArchetype };
  clinicalPhase: string;
  subjects: number;
  durationDays: number;
  budget: number;
  protocolMaturity: "solid" | "questionable" | "shaky";
  regulatoryRisk: "low" | "moderate" | "high";
  /** Operational complexity, 1 to 5. */
  complexity: number;
}

/** What a decision or event changes. Everything is optional. */
export interface Effects {
  /** Direct meter adjustments, added to the derived meters. */
  meters?: Partial<Record<MeterId, number>>;
  /** Dollars spent (positive) or saved (negative). */
  spend?: number;
  /** Days added to the schedule (negative shortens it). */
  slipDays?: number;
  workload?: Array<{ memberId: string; delta: number }>;
  /** Sites whose true state the dashboard shows from today (an audit). */
  auditSites?: string[];
  sites?: Array<{
    siteId: string;
    burden?: number;
    enrolled?: number;
    openQueries?: number;
    deviations?: number;
    unsignedSource?: number;
    eligibilityConcerns?: number;
    trainingCurrent?: boolean;
  }>;
}

export interface DecisionInput {
  eventId: string;
  optionId: string;
  label: string;
  effects: Effects;
  /** Attention this choice costs, on top of the documentation cost. */
  attentionCost: number;
  /** Documentation debt added when the decision is not documented. */
  debtIfUndocumented: number;
  /** True when the player spends the time to record decision and rationale. */
  documented: boolean;
}

export interface DecisionRecord {
  day: number;
  eventId: string;
  optionId: string;
  label: string;
  documented: boolean;
  attentionSpent: number;
  effects: Effects;
}

/** How hard the study starts. Older saves have none, which plays as standard. */
export const DIFFICULTIES = ["calm", "standard", "rescue"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface StudyState {
  version: 1;
  seed: string;
  difficulty?: Difficulty;
  setup: StudySetup;
  day: number;
  status: "running" | "complete";
  team: TeamMember[];
  sites: SiteState[];
  /** Attention left today. */
  attention: number;
  /** Attention today's routine work took before any decision. */
  routine: number;
  /** Documentation debt, 0 to 100. */
  documentationDebt: number;
  spent: number;
  slipDays: number;
  /** Total queries ever raised, for data-cleanliness reporting. */
  queriesRaised: number;
  /** Direct meter adjustments accumulated from decisions. */
  adjust: Record<MeterId, number>;
  /** Next unused draw index for the seeded PRNG. */
  draws: number;
  log: DecisionRecord[];
  /** Story flags set by decisions, read by later events. */
  flags: string[];
  /** Follow-up events scheduled by earlier decisions. */
  scheduled: Array<{ eventId: string; day: number }>;
  /** Day each event first reached the inbox. */
  seen: Record<string, number>;
  /** Events that were answered or expired. */
  handled: string[];
}

export type Urgency = "critical" | "important" | "routine";

export interface EventOption {
  id: string;
  label: string;
  attentionCost: number;
  debtIfUndocumented: number;
  effects: Effects;
  /** Flags set when this option is chosen. */
  flags?: string[];
  /** Follow-up events scheduled this many days out. */
  schedule?: Array<{ eventId: string; inDays: number }>;
  /**
   * What an inspector asks about this choice. If the player documented it
   * the question closes; if not, it becomes an observation.
   */
  finding?: InspectionFinding;
}

export interface InspectionFinding {
  question: string;
  /** What the file shows when the decision was documented. */
  answer: string;
  /** Severity if the decision was not documented. */
  severity: "minor" | "major";
}

export interface StudyEvent {
  id: string;
  /** Who is writing: a sponsor, site, team member or the boss. */
  from: string;
  subject: string;
  body: string;
  urgency: Urgency;
  /** First day the event can appear. */
  day: number;
  /** Days the event stays actionable, counting its first day. */
  ttl: number;
  /** Extra condition that must hold for the event to appear. */
  trigger?: (state: StudyState) => boolean;
  /** Only appears when scheduled by an earlier decision. */
  followUp?: boolean;
  /** A rare event drawn from the seed; scheduled at the start of a run. */
  wildcard?: boolean;
  /** The earlier event whose decision this one calls back to. */
  recalls?: string;
  options: EventOption[];
  /** Applied when the event expires unanswered. */
  ifIgnored: Effects;
}

export type Meters = Record<MeterId, number>;

export interface AreaStatus {
  health: Health;
  /** Short line shown next to the indicator. */
  summary: string;
}

export type Dashboard = Record<AreaId, AreaStatus>;

export interface SiteAuditReport {
  siteId: string;
  openQueries: number;
  deviations: number;
  unsignedSource: number;
  eligibilityConcerns: number;
  trainingCurrent: boolean;
}

export type ActionResult<T extends object = object> =
  | ({ ok: true; state: StudyState } & T)
  | {
      ok: false;
      reason: "not-enough-attention" | "unknown-target" | "study-complete";
    };

export interface LockSummary {
  dataCleanPct: number;
  openQueriesAtLock: number;
  /** Days added because queries were still open at lock. */
  lockDelayDays: number;
}

export type StudyDirectorProfile =
  | "firefighter"
  | "bureaucrat"
  | "peoplePleaser"
  | "scientist"
  | "operator"
  | "delegator"
  | "controlFreak";

export interface ProfileResult {
  profile: StudyDirectorProfile;
  title: string;
  /** The strength and the catch, in the game's voice. */
  summary: string;
  /** Plain figures behind the label. */
  evidence: string[];
}

export interface Evaluations {
  sponsor: { stars: 1 | 2 | 3 | 4 | 5; quote: string };
  company: { marginPct: number; timelineVarianceDays: number };
  science: {
    evaluablePct: number;
    missingPct: number;
    majorDeviations: number;
  };
  regulatory: { grade: "A" | "B" | "C" | "D" | "F"; gaps: number };
}

export interface InspectionItem {
  eventId: string;
  day: number;
  question: string;
  documented: boolean;
  /** What the inspector found on file. */
  answer: string;
  outcome: "closed" | "minor" | "major";
}

export interface InspectionReport {
  /** True when the FDA actually came. */
  triggered: boolean;
  items: InspectionItem[];
  grade: Evaluations["regulatory"]["grade"];
}

export interface FinalReport {
  state: StudyState;
  lock: LockSummary;
  evaluations: Evaluations;
  profile: ProfileResult;
  inspection: InspectionReport;
}
