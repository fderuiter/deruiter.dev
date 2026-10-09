import type { AreaId, Phase, StudyState, TeamRole } from "@/lib/study-director";

/** Minutes after midnight the working day starts. */
export const DAY_START = 8 * 60;
/** Minutes after midnight the office day ends; work after this is overtime. */
export const DAY_END = 18 * 60;
/** Minutes after midnight past which the Study Director must go home. */
export const HARD_STOP = 22 * 60;
/** Minutes of the working day routine load takes per attention point it would have cost. */
export const ROUTINE_MINUTES_PER_POINT = 45;

/** Kinds of things the player spends time on. */
export const WORLD_ACTIONS = [
  "walk",
  "talk",
  "readMail",
  "reviewEdc",
  "document",
  "sponsorCall",
  "meeting",
  "amendment",
  "coffee",
] as const;
export type WorldActionKind = (typeof WORLD_ACTIONS)[number];

/** What one action costs the player. Walking is priced per tile. */
export interface ActionCost {
  minutes: number;
  /** Energy spent, 0 to 100 scale. */
  energy: number;
  /** Focus spent, 0 to 100 scale. Demanding work spends more. */
  focus: number;
}

/**
 * The world on top of a study: the clock, the player's energy and focus,
 * and what the player has learned. The study itself stays authoritative
 * (ADR 0055) and runs in clock budget mode.
 */
export interface WorldState {
  version: 1;
  study: StudyState;
  /** Minutes after midnight. */
  minute: number;
  /** 0 to 100. Spent by activity, restored overnight. */
  energy: number;
  /** 0 to 100. Spent by demanding work, restored overnight and by coffee. */
  focus: number;
  /** Cups of coffee today. */
  coffees: number;
  /** Minutes worked past the end of the office day, today. */
  overtime: number;
  /** Energy the player could not recover overnight after working late. */
  fatigue: number;
  /** Where the player is: a room id, or "home" overnight. */
  location: string;
  /** Where the player stands on the floor and which way they face. */
  player: PlayerState;
  /** Tiles walked today; every fortieth costs a point of energy. */
  walked: number;
  /** Facts the player has learned, by id. */
  known: string[];
  /** The map the player is on, by `WORLD_MAPS` id; absent means the CRO floor. */
  map?: string;
  /** The site visit in progress, while the player is at a clinical site. */
  visit?: SiteVisit | null;
  /** What the player has seen or been told, with when and from whom (#1688). */
  observations?: Observation[];
  /** Each team member's working relationship with the player, by member id (#1688). */
  bonds?: Record<string, Bond>;
  /** Phone calls today that were answered, ignored or sent to voicemail (#1689). */
  calls?: CallRecord[];
  /** Events a team member has already raised with the player in person (#1689). */
  raised?: string[];
  /** Work handed to the team that is still landing, or waiting for review (#1689). */
  assignments?: Assignment[];
  /** A meeting in progress in the conference room, if any (#1689). */
  meeting?: Meeting | null;
  /** Today's chosen priority and the interruptions already dealt with (#1837). */
  plan?: DayPlan;
}

/** What a day can be about: the team, the sites, or the desk (#1837). */
export const PRIORITY_IDS = ["people", "sites", "desk"] as const;
export type PriorityId = (typeof PRIORITY_IDS)[number];

/** The player's plan for one day. */
export interface DayPlan {
  day: number;
  priority: PriorityId | null;
  /** Ids of today's interruptions the player has dealt with. */
  handled: string[];
}

export type WorldRefusal =
  | "too-late"
  | "too-tired"
  | "unknown-action"
  | "study-complete"
  | "unreachable";

export type WorldResult<T extends object = object> =
  ({ ok: true; world: WorldState } & T) | { ok: false; reason: WorldRefusal };

/** One line of the morning digest, most important first. */
export interface DigestLine {
  text: string;
  tone: "neutral" | "good" | "bad";
}

/** What the player is told on arriving in the morning. Short on purpose. */
export interface MorningDigest {
  day: number;
  weekday: string;
  phase: Phase;
  /** Clock time the player can start on their own work, after routine load. */
  startsAt: number;
  routineMinutes: number;
  energy: number;
  lines: DigestLine[];
}

/** One change the player learns about overnight. */
export interface OvernightLine {
  text: string;
  tone: "neutral" | "good" | "bad";
}

/** What happened while the player was home, from what they could know. */
export interface OvernightReport {
  day: number;
  lines: OvernightLine[];
  /** Set when the study moved into a new phase overnight. */
  newPhase: Phase | null;
  /** True when the study finished overnight. */
  complete: boolean;
  /** How the day just ended went, from the evening wrap-up (#1837). */
  wrapUp?: OvernightLine[];
}

/** Which way the player or a person is looking. */
export const FACINGS = ["up", "down", "left", "right"] as const;
export type Facing = (typeof FACINGS)[number];

/** A tile on a world map, column `x` from the left and row `y` from the top. */
export interface TilePoint {
  x: number;
  y: number;
}

/** Where the player stands on the floor and which way they face. */
export interface PlayerState extends TilePoint {
  facing: Facing;
}

/** What a map tile is. Only floor and doors can be walked on. */
export type TileKind =
  | "wall"
  | "floor"
  | "door"
  | "desk"
  | "table"
  | "whiteboard"
  | "shelf"
  | "reception"
  | "plant"
  | "car"
  | "fridge"
  | "station";

/** The rooms of the CRO floor. */
export const ROOM_IDS = [
  "office",
  "dataManagement",
  "regulatory",
  "biostatistics",
  "medicalWriting",
  "programming",
  "corridor",
  "monitoring",
  "conference",
  "breakRoom",
  "lobby",
  "parking",
] as const;
/** The rooms every clinical site map has (#1690). */
export const SITE_ROOM_IDS = [
  "coordinatorOffice",
  "recordsRoom",
  "regulatoryFiles",
  "piOffice",
  "siteHall",
  "siteReception",
  "pharmacy",
  "lab",
  "siteParking",
] as const;
export type RoomId = (typeof ROOM_IDS)[number] | (typeof SITE_ROOM_IDS)[number];

/** A room: a named rectangle of floor and what it is for. */
export interface Room {
  id: RoomId;
  name: string;
  /** Interior rectangle in tiles, walls excluded. */
  bounds: { x: number; y: number; width: number; height: number };
  /** Where the directory walks the player to when the room is chosen. */
  anchor: TilePoint;
  /** The team role whose desks are here, for department rooms. */
  department?: TeamRole;
  /** Floor tiles beside the desks where the department's people stand. */
  seats: TilePoint[];
  /** One sentence the room description starts with. */
  blurb: string;
}

/** The stations the player can use. */
export const STATION_IDS = ["edc", "phone", "etmf", "coffee", "exit"] as const;
/** The stations on a clinical site map (#1690). Sites reuse `exit`, the car. */
export const SITE_STATION_IDS = [
  "siteReception",
  "coordinator",
  "consentForms",
  "screeningLog",
  "sourceDocuments",
  "regulatoryBinder",
  "pi",
  "drugAccountability",
  "temperatureLog",
] as const;
export type StationId =
  (typeof STATION_IDS)[number] | (typeof SITE_STATION_IDS)[number];

/** A station: a tile the player faces and presses E at. */
export interface Station extends TilePoint {
  id: StationId;
  name: string;
  room: RoomId;
  /** What using it does, in one line. */
  blurb: string;
}

/** A walkable map: ASCII rows plus the rooms and stations drawn on it. */
export interface WorldMap {
  id: string;
  /** What the map is called on screen; the CRO floor leaves it out. */
  name?: string;
  width: number;
  height: number;
  /** One string per row, `width` characters each. */
  rows: readonly string[];
  rooms: readonly Room[];
  stations: readonly Station[];
  /** Where the player stands on arrival. */
  spawn: PlayerState;
}

/**
 * Where a team member is on the floor. Today everyone stands at their
 * department desk; NPC schedules (#1688) supply placements of their own.
 */
export interface PersonPlacement extends TilePoint {
  memberId: string;
  name: string;
  role: TeamRole;
  room: RoomId;
  facing: Facing;
  /** What the person is doing, when a schedule placed them (#1688). */
  activity?: PersonActivity;
}

/**
 * How a room looks, for the office to tell the story of the study (#1691).
 * The defaults are a tidy office; nothing here changes the rules.
 */
export interface RoomCondition {
  /** Paper on the desks, 0 (tidy) to 1 (buried). */
  clutter: number;
  /** Free-form marks a later layer can draw or describe, such as "smoke". */
  marks: string[];
}

/** Something the player can be facing: a station or a person. */
export type WorldTarget =
  | { kind: "station"; station: Station }
  | { kind: "person"; person: PersonPlacement };

/** A place the office directory can walk the player to. */
export type DirectoryTarget =
  | { kind: "room"; room: Room }
  | { kind: "station"; station: Station }
  | { kind: "person"; person: PersonPlacement };

/** One entry in the office directory. */
export interface DirectoryEntry {
  /** Stable id such as `room:lobby`, `station:coffee` or `person:maya`. */
  id: string;
  label: string;
  detail: string;
  target: DirectoryTarget;
}

/** A walk planned by the directory: the steps and what they will cost. */
export interface Route {
  steps: Facing[];
  /** Clock minutes the walk costs, fractional. */
  minutes: number;
  /** Which way the player faces on arrival, to look at the target. */
  facing: Facing;
}

/** What happened when the player pressed E. */
export interface InteractionOutcome {
  world: WorldState;
  title: string;
  lines: string[];
  tone: "neutral" | "good" | "bad";
  /** Set when the interaction asks the UI to confirm going home. */
  offer?: "goHome";
  /** Places the car can drive to from here, offered beside going home. */
  travel?: TravelOption[];
  /** A site check the UI can offer to do, with its cost (#1690). */
  check?: SiteCheckId;
  /** Set when the interaction opens a screen of its own (#1688, #1689). */
  panel?: WorldPanel;
}

/**
 * Handles E on one kind of target. Return null to fall through to the
 * default. Later layers (dialogue, events, site visits) plug in here.
 */
export type InteractionHandler = (
  world: WorldState,
  target: WorldTarget
) => InteractionOutcome | null;

/** Handlers by target: one per station, and one for people. */
export interface InteractionHandlers {
  station?: Partial<Record<StationId, InteractionHandler>>;
  person?: InteractionHandler;
}

/** What the HUD shows. No Integrity, Compliance or Team: those are inferred. */
export interface HudReadout {
  day: number;
  weekday: string;
  clock: string;
  energy: number;
  focus: number;
  budget: { spent: number; total: number };
  timeline: { day: number; total: number; slipDays: number };
  enrollment: { enrolled: number; target: number };
}

/** The checks a site visit can include (#1690). Each costs time. */
export const SITE_CHECK_IDS = [
  "consent",
  "eligibility",
  "drugAccountability",
  "temperatureLogs",
  "delegationLog",
  "sourceReview",
  "interviewCoordinator",
  "meetPi",
] as const;
export type SiteCheckId = (typeof SITE_CHECK_IDS)[number];

/** The parts of a site's true state an audit reports. */
export type SiteFindingField =
  | "openQueries"
  | "deviations"
  | "unsignedSource"
  | "eligibilityConcerns"
  | "trainingCurrent";

/** One check: what it is, where it is done, what it costs and covers. */
export interface SiteCheck {
  id: SiteCheckId;
  label: string;
  /** The station the player faces to do it. */
  station: StationId;
  cost: ActionCost;
  /** Parts of the site's true state the check looks at. */
  covers: SiteFindingField[];
  /** True for checks of the site's records, which resolve into an audit. */
  records: boolean;
}

/** Something the player saw on a site visit. */
export interface SiteObservation {
  check: SiteCheckId;
  text: string;
  tone: "neutral" | "good" | "bad";
}

/** A site visit in progress. */
export interface SiteVisit {
  siteId: string;
  mapId: string;
  /** Study day of the visit. */
  day: number;
  /** Clock minute the player arrived. */
  arrivedAt: number;
  /** Which visit to this site this is, counting from 1. */
  number: number;
  checks: SiteCheckId[];
  observations: SiteObservation[];
}

/** A trait of a site coordinator. Hidden ones are learned over visits. */
export interface CoordinatorTrait {
  id: string;
  label: string;
  detail: string;
}

/** A coordinator as the player currently knows them. */
export interface CoordinatorProfile {
  siteId: string;
  name: string;
  piName: string;
  /** Traits anyone can see on the first visit. */
  visible: CoordinatorTrait[];
  /** Hidden traits the player has worked out so far. */
  learned: CoordinatorTrait[];
  /** Hidden traits still to work out. */
  unknown: number;
  /** Completed or in-progress visits to the site. */
  visits: number;
}

/** A place the car can drive to. */
export interface TravelOption {
  /** A `WORLD_MAPS` id. */
  mapId: string;
  label: string;
  minutes: number;
}

/** One named finding in a visit write-up. */
export interface SiteFinding {
  field: SiteFindingField;
  label: string;
  /** The site's true state, from the audit. */
  actual: number | boolean;
  /** What the dashboard had been shown before the visit. */
  reported: number | boolean;
  /** True when the dashboard had been showing less than the truth. */
  hidden: boolean;
  text: string;
}

/** The write-up of a finished visit, resolved through `auditSite`. */
export interface SiteVisitReport {
  siteId: string;
  siteName: string;
  day: number;
  checks: SiteCheckId[];
  /** False when only conversations happened, so nothing was audited. */
  audited: boolean;
  findings: SiteFinding[];
  /** Parts of the site nobody looked at this visit. */
  unchecked: string[];
  /** Coordinator traits learned on this visit. */
  learned: CoordinatorTrait[];
  /** One line on how honest the site's reporting turned out to be. */
  verdict: string;
}

/** Why a travel or site action was refused. */
export type SiteRefusal =
  | WorldRefusal
  | "site-closed"
  | "not-on-visit"
  | "already-checked"
  | "too-unfocused"
  | "pi-unavailable"
  | "unknown-site";

export type SiteResult<T extends object = object> =
  ({ ok: true; world: WorldState } & T) | { ok: false; reason: SiteRefusal };
/** How the floor feels overall, from the study's lowest meter (#1691). */
export type FloorMood = "calm" | "stressed" | "crisis";

/** The waste bin in your office: fine, smouldering, or on fire. */
export type BinState = "calm" | "smoke" | "fire";

/**
 * The set dressing a room's `marks` can carry. A mark repeated `n` times
 * means `n` of that thing, so four `"cup"` marks are four cups.
 */
export const SET_DRESSING_MARKS = [
  "printout",
  "travelPin",
  "fileOverflow",
  "sponsorMail",
  "crisisMeeting",
  "cup",
  "smoke",
  "fire",
  "lunch",
  "deserted",
  "lateLamp",
] as const;
export type SetDressingMark = (typeof SET_DRESSING_MARKS)[number];

/**
 * When a team member's day ends, derived from their workload. A hint for
 * NPC schedules (#1688) to read; the floor's set dressing uses the same
 * rule, so the lamps left on and the empty break room agree with who stays.
 */
export interface TeamHoursHint {
  memberId: string;
  /** Minutes after midnight they go home. */
  leavesAt: number;
  /** True when they leave after the office day ends. */
  staysLate: boolean;
  /** True when they eat lunch at their desk instead of the break room. */
  lunchAtDesk: boolean;
}

/**
 * How the whole floor looks for a study: the counts behind each room's
 * marks, the bin, the mood, and the conditions to hand the renderer and the
 * room description (#1691).
 */
export interface FloorDressing {
  mood: FloorMood;
  bin: BinState;
  /** Query printouts on the data manager's desk, 0 to 4. */
  printouts: number;
  /** Pins on the monitor's travel board, one per site visit owed, 0 to 6. */
  travelPins: number;
  /** Folders spilling out of the regulatory filing cabinet, 0 to 4. */
  fileOverflow: number;
  /** Unanswered sponsor mail piled at reception, 0 to 5. */
  sponsorMail: number;
  /** Crisis meetings booked into the conference room, 0 to 3. */
  crisisMeetings: number;
  /** Coffee cups gathering in your office, 1 to 6. */
  cups: number;
  /** Signs of lunch in the break room, 0 (deserted) to 3. */
  lunch: number;
  /** When each team member goes home. */
  hours: TeamHoursHint[];
  rooms: Record<RoomId, RoomCondition>;
}
// ---------------------------------------------------------------------------
// People (#1688): the world layer on top of each team member.

/** What a person on the floor is doing right now. */
export type PersonActivity =
  | "working"
  | "lunchAtDesk"
  | "coffee"
  | "outside"
  | "lunch"
  | "meeting"
  | "walking";

/** How a member is coping, from their stress. Drives their schedule. */
export type Mood = "calm" | "busy" | "overloaded";

/** A stream of work a member can own once the player has invested in them. */
export const WORK_STREAMS = [
  "queries",
  "monitoring",
  "training",
  "analysis",
  "writing",
  "programming",
] as const;
export type WorkStream = (typeof WORK_STREAMS)[number];

/**
 * A member's working relationship with the Study Director. Stored in the
 * world save; everything else about a person is derived from the study.
 */
export interface Bond {
  /** Trust in the Study Director, 0 to 100. */
  trust: number;
  /** Confidence in their own work, 0 to 100. Coaching builds it. */
  confidence: number;
  /** Times the player has coached them. */
  coached: number;
  /** Day the player last talked with them, or 0. */
  talkedDay: number;
  /** Day the player last coached them, or 0. */
  coachedDay: number;
  /** Day the player last asked them for status, or 0. */
  askedDay: number;
  /** The stream they run without being asked, once invested in. */
  owns: WorkStream | null;
  /** Day the player last brought them a coffee (#1838). */
  coffeeDay?: number;
  /** Day the player last took a small job off them (#1838). */
  favourDay?: number;
  /** Day they last covered for the player (#1838). */
  coverDay?: number;
}

/** The world layer of one team member, derived from the study and their bond. */
export interface PersonState {
  memberId: string;
  name: string;
  role: TeamRole;
  /** The domain's workload, 0 to 100. */
  workload: number;
  /** 0 to 100. Long days and a heavy load drain it. */
  energy: number;
  /** 0 to 100. */
  stress: number;
  /** 0 to 100. */
  confidence: number;
  /** 0 to 100. */
  trust: number;
  mood: Mood;
  /** What they are working on, in a few words. */
  task: string;
  /** The stream they own, if any. */
  owns: WorkStream | null;
}

/** One stretch of a member's day, in one place. */
export interface ScheduleBlock {
  /** Minute they set off for this place. */
  start: number;
  /** Minute they set off for the next one. */
  end: number;
  activity: Exclude<PersonActivity, "walking">;
  room: RoomId;
  spot: TilePoint;
  facing: Facing;
}

/** A member's day: when they arrive, where they go, and when they leave. */
export interface DaySchedule {
  memberId: string;
  day: number;
  mood: Mood;
  /** Minute they set off from the car park in the morning. */
  arrive: number;
  /** Minute they set off for the car park in the evening. */
  leave: number;
  blocks: ScheduleBlock[];
}

/** What a relationship card shows: rough, never exact numbers. */
export interface RelationshipCard {
  memberId: string;
  name: string;
  role: string;
  /** Trust as hearts, 0 to 5. */
  hearts: number;
  /** Stress as a rough bar, 1 (low) to 4 (very high). */
  stressBars: 1 | 2 | 3 | 4;
  /** Workload as a rough bar, 1 (light) to 4 (buried). */
  workloadBars: 1 | 2 | 3 | 4;
  stressLabel: string;
  workloadLabel: string;
  task: string;
  owns: WorkStream | null;
}

/** What makes trust move. */
export type TrustCause =
  | "talk"
  | "coach"
  | "followThrough"
  | "ignore"
  | "override"
  | "dump"
  | "brushOff"
  | "heard"
  | "coffee"
  | "favour"
  | "cover";

/** Something the player saw or was told. */
export interface Observation {
  id: string;
  day: number;
  /** Who said it, or where it was seen. */
  source: string;
  text: string;
  /** The dashboard area it bears on, so the EDC can show it beside the report. */
  area?: AreaId;
  siteId?: string;
}

/** What a line of dialogue carries. There is no filler (ADR 0055). */
export type LineKind =
  "information" | "warning" | "opportunity" | "relationship" | "joke";

export interface DialogueLine {
  kind: LineKind;
  text: string;
  /** The fact this line discloses, recorded once heard. */
  fact?: Observation;
  /** Trust the line reflects, for lines that report a change. */
  trustDelta?: number;
}

// ---------------------------------------------------------------------------
// Events through people, phone and stations (#1689).

/** How an event reaches the player. */
export type Channel =
  { kind: "person"; memberId: string } | { kind: "phone" } | { kind: "mail" };

/** How the player came to be answering an event. */
export type EventVia =
  "hallway" | "talk" | "phone" | "voicemail" | "callback" | "mail" | "meeting";

/** What happened to today's call about an event. */
export interface CallRecord {
  eventId: string;
  day: number;
  status: "answered" | "ignored" | "voicemail";
  /** When an ignored call rings again. */
  retryAt?: number;
}

/** A call the phone will ring for, is ringing for, or has rung for today. */
export interface PhoneCall {
  eventId: string;
  from: string;
  subject: string;
  ringAt: number;
  status: "scheduled" | "ringing" | "answered" | "voicemail";
}

/** An event offered as dialogue, with its options as choices. */
export interface EventDialogue {
  eventId: string;
  via: EventVia;
  speaker: string;
  subject: string;
  lines: DialogueLine[];
  choices: Array<{ id: string; label: string }>;
}

/** What waits at the player's desk. */
export interface DeskView {
  voicemail: Array<{ eventId: string; from: string; subject: string }>;
  mail: Array<{ eventId: string; from: string; subject: string }>;
  /** Calls the player can return from the desk phone. */
  callbacks: Array<{ eventId: string; from: string; subject: string }>;
  /** Decisions made but not yet written up. */
  undocumented: Array<{ eventId: string; label: string; day: number }>;
  documentationDebt: number;
}

/** One row of the EDC workstation: what the dashboard says beside what you saw. */
export interface EdcRow {
  area: AreaId;
  label: string;
  health: "green" | "amber" | "red";
  reported: string;
  seen: Observation[];
}

/** The delegation verbs on each person. */
export const DELEGATION_VERBS = [
  "askStatus",
  "assign",
  "review",
  "coach",
  "escalate",
  "takeOver",
] as const;
export type DelegationVerb = (typeof DELEGATION_VERBS)[number];

/** Work handed to a member, landing over the following days. */
export interface Assignment {
  id: string;
  memberId: string;
  stream: WorkStream;
  siteId: string | null;
  day: number;
  /** Units of work in total and still to do. */
  amount: number;
  remaining: number;
  /** True once the player has reviewed it after it landed. */
  reviewed: boolean;
}

/** What a delegation verb did. */
export interface DelegationOutcome {
  world: WorldState;
  lines: DialogueLine[];
  /** Set when a member took ownership of their stream. */
  owns?: WorkStream;
}

/** A meeting in the conference room. */
export interface Meeting {
  kind: "team" | "sponsor";
  attendees: string[];
  startedAt: number;
  /** Length of the decision log when it started, to count what was decided in it. */
  logStart: number;
}

/** What a meeting cost against what it changed. */
export interface MeetingReport {
  kind: Meeting["kind"];
  minutes: number;
  /** Minutes of everyone's time, the player's included. */
  personMinutes: number;
  attendees: string[];
  changes: string[];
  /** Events raised in the room, to answer now or later. */
  raised: string[];
  verdict: string;
}

/** A screen an interaction opens in the overlay. */
export type WorldPanel =
  { kind: "dialogue"; memberId: string } | { kind: "desk" } | { kind: "edc" };

// ---------------------------------------------------------------------------
// The daily rhythm (#1837) and relationship actions (#1838).

/** One way to answer an interruption. */
export interface InterruptionOption {
  id: string;
  label: string;
  /** What it costs the player's day. */
  cost: ActionCost;
  /** What the player is told happened. */
  result: string;
}

/** Something that lands on the player's day and wants an answer. */
export interface Interruption {
  id: string;
  title: string;
  body: string;
  options: InterruptionOption[];
}

/** An interruption due today and when it arrives, in minutes after midnight. */
export interface ScheduledInterruption {
  at: number;
  interruption: Interruption;
}

/** What the player can do for a team member beyond work (#1838). */
export const RELATIONSHIP_ACTIONS = [
  "coffee",
  "favour",
  "askAbout",
  "cover",
] as const;
export type RelationshipAction = (typeof RELATIONSHIP_ACTIONS)[number];

/** Whether a relationship action can be taken now, and why not if it cannot. */
export interface RelationshipOption {
  action: RelationshipAction;
  label: string;
  available: boolean;
  /** In the player's words, never a number: why it is not available. */
  reason?: string;
}
