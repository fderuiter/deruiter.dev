import type {
  BossBlindModifier,
  CellCoordinates,
  CrisisCard,
  CrisisChoice,
  FootnoteSeal,
  GuidanceCard,
  HandClassification,
  HandEvaluation,
  HandLevels,
  HandType,
  PopulationSnapshot,
  PopulationType,
  SapRulebook,
  TableShellSpec,
  QcReport,
  RuleCheckResult,
  Scenario,
  SnapshotRef,
  StagedTable,
  PopulationTransition,
  StudyEvent,
  TlfCard,
  CardFace,
  CardStamp,
  KmFigure,
  RedactedCard,
  Relic,
  ClockAction,
  CsrLock,
  CsrStage,
  DmcDefense,
  EncounterStage,
  FdaIr,
  IrQuestion,
  Site,
} from "../types";
import { HandTypeSchema, POPULATION_LABELS } from "../types";
import { compileDraft, compileShell } from "./compile";
import {
  CPU_COSTS,
  canAfford,
  costOf,
  cpuReducer,
  type CpuAction,
  type CpuLedger,
} from "./cpu";
import type { DeskStatus } from "./desk";
import {
  HAND_NAMES,
  classifyHand,
  handLevelTable,
  initialHandLevels,
  leveledBase,
  type HandLevelRow,
} from "./hands";
import {
  correctFinding,
  createInspectionState,
  deriveInspectionView,
  inspectCell,
  unpenalizedMult,
  visibleFindingIds,
  type InspectionState,
  type InspectionView,
} from "./inspection";
import {
  UNBLINDING_RULE_ID,
  structuralQc,
  type AccessKind,
  type AccessRecord,
  type DmcSession,
  type StructuralQcReport,
} from "./blinding";
import { traceCell, type CellTrace } from "./listing";
import { validateKm, type KmFinding, type KmReport } from "./km";
import {
  CSR_ORDER,
  CSR_STAGE_LABELS,
  campaignScore,
  reconcilePackage,
  type CampaignRecord,
  type CampaignScore,
  type PackageEvidence,
  type PackageReport,
  type PackageSlot,
} from "./package";
import { evaluateHand, ruleResultsFor } from "./scoring";
import {
  blindStartCpu,
  freeDiscards,
  relicModifiers,
  type RelicCard,
} from "./relics";
import {
  applyTransition,
  membership,
  sameMembership,
  snapshotRef,
  type SnapshotInvalidation,
} from "./snapshots";
import {
  scoreTimeline,
  type TimelineContext,
  type TimelineStep,
} from "./timeline";
import { validate } from "./validator";

/** The most recent Card Table outcome, phrased for a polite announcement. */
export interface TableEvent {
  kind:
    | "SELECTED"
    | "DESELECTED"
    | "PLAYED"
    | "DISCARDED"
    | "INSPECT_OPENED"
    | "INSPECT_CLOSED"
    | "INSPECTED"
    | "CORRECTED"
    | "MOVED"
    | "REFUSED"
    | "RESET"
    | "BLIND_STARTED"
    | "ACT_STARTED"
    | "RUN_CONTINUED"
    | "RUN_ENDED"
    | "RECOMPILED"
    | "ALLOCATED"
    | "SEALED"
    | "SOLD"
    | "LEVELED_UP"
    | "CRISIS_RESOLVED"
    | "TRACED"
    | "STRUCTURAL_QC"
    | "UNBLINDED"
    | "SESSION_CHANGED"
    | "RELIC_CLAIMED"
    | "AMENDED"
    | "CASHED_OUT"
    | "SHOP";
  message: string;
  /** On LEVELED_UP: the hand that levelled and its base before and after. */
  levelUp?: LevelUp;
  /** Increments on every event so repeated messages are still announced. */
  sequence: number;
}

/** The last hand played, for the result plate. */
export interface PlayedHand {
  classification: HandClassification;
  evaluation: HandEvaluation;
  cardIds: string[];
}

/** One effect that fired in a logged hand, labelled as the score timeline labels it. */
export interface ScoreLogEffect {
  kind: "RULE" | "RELIC" | "X_MULT" | "ZERO_RULE";
  /** The rule or relic id, the ×Mult source, or the zero rule's slam label. */
  label: string;
  /** What it did, e.g. "+20 Chips" or "×0". Never a blinded cell value. */
  effect: string;
}

/** One hand in the Blind's score log (#1082), ready to display. */
export interface ScoreLogEntry {
  handType: HandType;
  /** The hand's display name. */
  name: string;
  level: number;
  chips: number;
  mult: number;
  score: number;
  /** Rules, relics and ×Mult factors that fired, in playback order. */
  fired: ScoreLogEffect[];
  /** The zero rule's label when the hand scored ×0, otherwise null. */
  zeroLabel: string | null;
}

/**
 * The study's population history: every snapshot version, oldest first (the
 * last is current), and the invalidation each transition produced. A run
 * carries it from one Blind into the next.
 */
export interface StudyHistory {
  snapshots: PopulationSnapshot[];
  invalidations: SnapshotInvalidation[];
}

/** A hand levelling up: the Guidance card used and the hand's base either side. */
export interface LevelUp {
  guidanceId: string;
  guidanceName: string;
  handType: HandType;
  from: { level: number; chips: number; mult: number };
  to: { level: number; chips: number; mult: number };
}

/**
 * A consumable in the tray: a footnote seal or a Guidance card. `id` is
 * unique within the tray.
 */
export type Consumable =
  | { id: string; kind: "SEAL"; seal: FootnoteSeal }
  | { id: string; kind: "GUIDANCE"; guidance: GuidanceCard };

/** A consumable's printed name. */
export function consumableName(item: Consumable): string {
  return item.kind === "SEAL" ? item.seal.name : item.guidance.name;
}

/** What selling a consumable adds to the study budget. */
export function consumableSellValue(item: Consumable): number {
  return item.kind === "SEAL" ? item.seal.sellValue : item.guidance.sellValue;
}

/**
 * What the player carries between Blinds besides the study: the consumable
 * tray, the study budget and the run's hand levels. The Procurement Shop
 * spends and fills it. Absent hand levels mean a fresh run's.
 */
export interface Inventory {
  consumables: Consumable[];
  budget: number;
  handLevels?: HandLevels;
  /** SOP relics the run has earned. */
  relics?: Relic[];
  /** Trial sites the run has activated; each adds its Chips to every hand. */
  sites?: Site[];
  /** Site enrollments waiting for the next Blind's first hand. */
  enrollments?: PopulationTransition[];
  /** The Blinds the campaign has cleared so far, oldest first. */
  campaign?: CampaignRecord[];
}

/** One output in a locked package, as the audit summary records it. */
export interface LockedOutput {
  stage: CsrStage;
  cardId: string;
  /** The output's short name, e.g. "Table 14.3.1". */
  name: string;
  title: string;
  /** The population snapshot the output was compiled against. */
  snapshotId: string;
  /** The SAP rulebook it was validated under. */
  rulebookId: string;
}

/**
 * A locked CSR package (#922): the immutable audit summary of the release,
 * and the table as it stood before the lock, which a protocol amendment
 * reopens.
 */
export interface PackageLock {
  packageName: string;
  outputs: LockedOutput[];
  /** The lock hand's score. */
  handScore: number;
  /** The Blind's round score with the lock hand. */
  roundScore: number;
  /** Every Blind the campaign cleared, this one last. */
  campaign: CampaignRecord[];
  final: CampaignScore;
  /** Protocol amendments filed before this lock. */
  amendment: number;
  /** The table just before the lock hand was played. */
  before: TableState;
}

/**
 * One entry in the Blind's inspection audit log: a flagged table cell traced
 * to the patient Listing rows behind it, and how its discrepancy stands. The
 * log is kept for end-of-Blind grading, so it outlives the cards in hand.
 */
export interface TraceRecord {
  /** The summary Table traced. */
  cardId: string;
  /** The supporting Listing it was traced into. */
  listingId: string;
  cell: CellCoordinates;
  /** The findings flagged on the cell. */
  findingIds: string[];
  /** Every subject row inspected on the Listing, by USUBJID. */
  subjectIds: string[];
  /** The subjects the cell counts: the rows the trace line highlights. */
  matchedSubjectIds: string[];
  /** The population snapshot the Listing rows were filtered on. */
  snapshotId: string;
  /** RESOLVED once every finding on the cell is corrected. */
  resolution: "OPEN" | "RESOLVED";
  /** The Table was recompiled since: this trace describes an output that no longer exists. */
  superseded: boolean;
}

/** The ×Mult a reconciled Kaplan–Meier figure earns with a validated parent. */
export const KM_SYNERGY = 2;

/** The +Mult each unresolved Kaplan–Meier discrepancy costs a hand. */
export const KM_REDLINE_PENALTY = 1;

/** The ×Mult a traced, fully resolved Table earns when played with its Listing. */
export const TLF_PAIR_SYNERGY = 2;

/** The alert shown when a Table and its Listing disagree on provenance. */
export const PROVENANCE_ALERT =
  "Listing and table were compiled against different population snapshots: recompile the stale output before tracing.";

/** How many consumables the tray holds. */
export const CONSUMABLE_SLOTS = 2;

/** How many SOP relics the run can hold. */
export const RELIC_SLOTS = 5;

/**
 * Pending site enrollments land once this many hands of a Blind have been
 * played: after the first hand, so the outputs still in hand go stale.
 */
export const ENROLLMENT_AFTER_HANDS = 1;

const EMPTY_INVENTORY: Inventory = { consumables: [], budget: 0 };

/** The alert shown when a relic would exceed `RELIC_SLOTS`. */
export const RELIC_RACK_FULL = `The relic rack holds ${RELIC_SLOTS}: sell a relic first.`;

/** The alert shown when a hand holds a blank shell with no data allocated. */
export const EMPTY_SHELL_ALERT =
  "An empty shell cannot compile: allocate an analysis set to it first.";

/** The alert shown when a hand holds an output compiled on an old snapshot. */
export const STALE_ALERT = `Output compiled against obsolete population snapshot; recompile required (${CPU_COSTS.RECOMPILE} CPU).`;

/** Serializable Card Table state. Contains no derived or browser data. */
export interface TableState {
  scenarioId: string;
  /** Index of the next undealt card in the scenario deck. */
  deckIndex: number;
  /** Card ids in hand, in deal order. */
  hand: string[];
  /** Selected card ids, in selection order (at most `maxSelection`). */
  selected: string[];
  /** Review progress per card, present once the card has been paid to inspect. */
  inspections: Record<string, InspectionState>;
  /** The card whose Inspect drawer is open. */
  inspecting: string | null;
  cpu: CpuLedger;
  roundScore: number;
  handsPlayed: number;
  discards: number;
  status: DeskStatus;
  lastPlay: PlayedHand | null;
  /** Every hand played this Blind, oldest first. The last is `lastPlay`. */
  plays: PlayedHand[];
  lastEvent: TableEvent | null;
  /** Every population snapshot version so far, oldest first. The last is current. */
  snapshots: PopulationSnapshot[];
  /** One record per population transition so far this study. */
  invalidations: SnapshotInvalidation[];
  /** The snapshot each card in hand was compiled against. */
  provenance: Record<string, SnapshotRef>;
  /** Cards in hand whose draft was compiled against a later snapshot. */
  drafts: Record<string, StagedTable>;
  /** The analysis set allocated to each blank shell in hand. Final once set. */
  allocations: Record<string, PopulationType>;
  /** Footnote seals affixed to each card in hand, in the order applied. */
  seals: Record<string, FootnoteSeal[]>;
  /** The consumable tray, at most `CONSUMABLE_SLOTS`. */
  consumables: Consumable[];
  /** The study budget: the shop's money. */
  budget: number;
  /** The run's hand levels, carried from Blind to Blind. */
  handLevels: HandLevels;
  /** The crisis drawn for this Blind, until the player answers it. */
  crisis: CrisisCard | null;
  /** How this Blind's crisis was answered, once it has been. */
  crisisResolution: { crisisId: string; choiceId: string } | null;
  /** Modifiers crisis choices imposed on this Blind, besides its boss. */
  modifiers: BossBlindModifier[];
  /** Every table cell traced to its Listing this Blind, in trace order. */
  auditLog: TraceRecord[];
  /** The DMC session in force. Blinded outputs are face down in OPEN. */
  session: DmcSession;
  /** Every DMC access this Blind: structural QC, unblinding, session changes. */
  accessLog: AccessRecord[];
  /** Blinded outputs in hand that have had structural QC, in order. */
  structuralQc: string[];
  /** Blinded outputs revealed by an unauthorized unblinding. They stay face up. */
  unblinded: string[];
  /** Unauthorized unblindings the next hand played will answer for with ×0. */
  pendingViolations: string[];
  /** A staged encounter's current stage, from 0. */
  stage: number;
  /** Each encounter stage's score so far. Empty outside an encounter. */
  stageScores: number[];
  /** Hours left on an FDA Information Request's clock; null outside one. */
  clock: number | null;
  /** The Blinds the campaign has cleared, oldest first; this one once cleared. */
  campaign: CampaignRecord[];
  /** The locked CSR package, once a CSR Lock Blind is won. */
  lock: PackageLock | null;
  /** Protocol amendments filed against a locked package this Blind. */
  amendments: number;
  /** The FDA Information Request's questions answered so far, in order. */
  answered: string[];
  /** SOP relics the run has earned; each scores in every hand. */
  relics: Relic[];
  /** The relic taken as this Blind's encounter reward, once taken. */
  rewardClaimed: string | null;
  /** Trial sites the run has activated; each adds its Chips to every hand. */
  sites: Site[];
  /** Site enrollments that land after this Blind's first hand. */
  enrollments: PopulationTransition[];
  /**
   * How much of `snapshots` and `invalidations` predates this Blind, the
   * inventory it started with, and its crisis, so a restart returns to
   * exactly that.
   */
  opening: {
    snapshots: number;
    invalidations: number;
    inventory: Inventory;
    crisis: CrisisCard | null;
  };
}

/** Player intents the Card Table reducer accepts. */
export type TableAction =
  | { type: "TOGGLE_SELECT"; cardId: string }
  | { type: "PLAY_HAND" }
  | { type: "DISCARD" }
  | { type: "INSPECT_CARD"; cardId: string }
  | { type: "CLOSE_INSPECT" }
  | { type: "INSPECT_CELL"; row: number; col: number }
  | { type: "CORRECT_FINDING"; findingId: string }
  /** Traces a flagged cell of the inspected Table to its Listing rows. Free. */
  | { type: "TRACE_CELL"; row: number; col: number }
  /** Cosmetic: moves a card within the hand. Costs nothing. */
  | { type: "MOVE_CARD"; cardId: string; toIndex: number }
  /** Reruns a stale output against the current snapshot. */
  | { type: "RECOMPILE"; cardId: string }
  /** Allocates an analysis set to a blank shell, which compiles it. Free and final. */
  | { type: "ALLOCATE"; cardId: string; population: PopulationType }
  /** Affixes a footnote seal from the tray to a card. Free; uses the seal up. */
  | { type: "APPLY_SEAL"; consumableId: string; cardId: string }
  /** Sells a tray consumable for its sell value. */
  | { type: "SELL_CONSUMABLE"; consumableId: string }
  /** Uses a Guidance card from the tray: its hand levels up for the run. */
  | { type: "USE_GUIDANCE"; consumableId: string }
  /** Answers the Blind's crisis with one of its choices. */
  | { type: "RESOLVE_CRISIS"; choiceId: string }
  /** Structural QC of a face-down output: shape and format, no values. */
  | { type: "STRUCTURAL_QC"; cardId: string }
  /**
   * Views a face-down output without DMC authorization: a blinding violation.
   * Logged, and the next hand played scores ×0.
   */
  | { type: "PEEK_BLINDED"; cardId: string }
  /** Moves to the other DMC session under the scenario's charter. */
  | { type: "SET_SESSION"; session: DmcSession }
  /** Takes one relic from a defended encounter's reward. */
  | { type: "CLAIM_RELIC"; relicId: string }
  /**
   * Files a formal protocol amendment against a locked CSR package: the lock
   * breaks, the lock hand is withdrawn and its outputs' reviews are
   * invalidated until they are validated again.
   */
  | { type: "AMEND_PROTOCOL" }
  | { type: "RESET" };

/** One card in hand as the table should render it. */
export interface TableCardView {
  card: TlfCard;
  selected: boolean;
  /** The card has reviewable cells in this slice. */
  inspectable: boolean;
  /** CPU has been spent to inspect this card. */
  inspected: boolean;
  /** Inspectable but never inspected: its true findings are unknown. */
  unverified: boolean;
  /** Revealed findings still uncorrected. */
  openRedlines: number;
  /** The live mini-output printed on the card, as currently reviewed. */
  face: CardFace;
  /** Marks stamped on the face, in display order. */
  stamps: CardStamp[];
  /** The Boss Blind's debuff cancels this card's Chips. */
  debuffed: boolean;
  /** Compiled against a snapshot whose membership of this card's suit has since changed. */
  stale: boolean;
  /** The snapshot this card was compiled against. */
  provenance: SnapshotRef;
  /** A blank shell with no analysis set allocated: it cannot be played yet. */
  blank: boolean;
  /** The analysis sets this card's shell accepts. Empty for face-only cards. */
  compatiblePopulations: PopulationType[];
  /** Footnote seals affixed to this output, in the order applied. */
  seals: FootnoteSeal[];
  /** How many footnote seals this output takes: its shell's slots. */
  footnoteSlots: number;
  /**
   * Cards in hand this one forms a TLF Pair with: a Table's supporting
   * Listings, or a Listing's Tables. The linked-card indicator.
   */
  pairedWith: string[];
  /** A dependent Figure's parent and ×Mult status, or null for other cards. */
  figure: FigureStatus | null;
  /** A closed-session output (its shell is blinded). */
  blinded: boolean;
  /**
   * Face down under the DMC open session. `card` and `face` then carry no
   * value: the face is the shell's structure with every cell redacted.
   */
  faceDown: boolean;
  /** Structural QC of a blinded output, once run. */
  structural: StructuralQcReport | null;
}

/** A dependent Figure's ×Mult badge: its parent, and why it is off if it is. */
export interface FigureStatus {
  /** The parent Table's number. */
  parent: string;
  xMult: number;
  /** The ×Mult applies if the Figure is played now. */
  active: boolean;
  /** Why the ×Mult is off, or null when it is active. */
  reason: string | null;
  /** The parent is missing, stale or unvalidated: the Figure cannot compile. */
  blocked: boolean;
}

/** The open Inspect drawer's content for a Kaplan–Meier figure. */
export interface FigureInspectionView {
  card: TlfCard;
  km: KmFigure;
  report: KmReport;
  /** Findings still uncorrected. Inspection reveals every KM finding. */
  openFindings: KmFinding[];
  resolvedFindingIds: string[];
  parent: TlfCard | null;
  status: FigureStatus;
  /** The Figure's own value as a High Table. */
  expected: HandEvaluation;
  unpenalizedMult: number;
  provenance: SnapshotRef;
  stale: boolean;
}

/** One crisis choice as the table renders it. */
export interface CrisisChoiceView {
  choice: CrisisChoice;
  /** Why this choice cannot be taken now, or null. */
  refusal: string | null;
}

/** The Blind's unanswered crisis. */
export interface CrisisView {
  crisis: CrisisCard;
  choices: CrisisChoiceView[];
}

/** The open Inspect drawer's content. */
export interface TableInspectionView extends InspectionView {
  card: TlfCard;
  table: StagedTable;
  /** The card's own value as a High Table, from revealed findings. */
  expected: HandEvaluation;
  unpenalizedMult: number;
  /** The snapshot the inspected output was compiled against. */
  provenance: SnapshotRef;
  stale: boolean;
  trace: InspectionTraceView;
}

/** Table-to-Listing tracing for the inspected output. */
export interface InspectionTraceView {
  /** The supporting Listing in hand the Table traces into, or null. */
  listing: TlfCard | null;
  /** Why no cell can be traced now, or null. */
  blocked: string | null;
  /** The Listing rows behind each traced cell, keyed `row:col`. */
  cells: Record<string, CellTrace>;
  /** This output's audit log entries, in trace order. */
  log: TraceRecord[];
  /** Playing the Table with `listing` earns the TLF Pair ×Mult now. */
  synergy: boolean;
}

/** Everything the Card Table renders, derived purely from scenario and state. */
export interface TableView {
  hand: TableCardView[];
  classification: HandClassification | null;
  /** Value of the selection from revealed findings only. */
  preview: HandEvaluation | null;
  previewUnpenalizedMult: number;
  /** Any selected card is inspectable but uninspected. */
  previewUnverified: boolean;
  quota: number;
  deckRemaining: number;
  /** Cards dealt and since played or discarded: the discard stack. */
  spentCount: number;
  /** The undealt deck, face down: opaque slots that carry no card data. */
  drawPile: RedactedCard[];
  handsAffordable: number;
  discardsAffordable: number;
  canPlay: boolean;
  /**
   * The first reason Play Hand would be refused, with its fix, or null when
   * the selection can be played. The same helper refuses `PLAY_HAND`.
   */
  playBlocker: PlayBlocker | null;
  canDiscard: boolean;
  canInspect: boolean;
  inspection: TableInspectionView | null;
  /** The last played hand as an ordered scoring timeline, for playback. */
  lastTimeline: TimelineStep[] | null;
  /**
   * Every hand played this Blind, oldest first, read from the same timeline
   * the playback uses. The scores sum to the round score.
   */
  scoreLog: ScoreLogEntry[];
  /** The current population snapshot. */
  snapshot: SnapshotRef;
  /** Selected cards that are stale, in selection order. */
  staleSelected: string[];
  /**
   * The stale or empty-shell alert when one of those blocks Play Hand, or
   * null. `playBlocker` carries every reason, with the cards and the fix.
   */
  playBlockedReason: string | null;
  /**
   * Stale cards that alone stop the selection from being a Population Flush:
   * without them it would be one. Empty otherwise.
   */
  flushBrokenBy: string[];
  canRecompile: boolean;
  /** Every population transition so far this study, oldest first. */
  invalidations: SnapshotInvalidation[];
  /** Selected blank shells with no analysis set allocated, in selection order. */
  emptySelected: string[];
  /** The consumable tray. */
  consumables: Consumable[];
  consumableSlots: number;
  budget: number;
  /** The run's hand levels. */
  handLevels: HandLevels;
  /** The run's hand table at current levels, weakest hand first, for Run Info. */
  handTable: HandLevelRow[];
  /** The crisis to answer before the Blind can be played, if any. */
  crisis: CrisisView | null;
  /** Every modifier in force: the boss's, then any a crisis imposed. */
  modifiers: BossBlindModifier[];
  /** Hands left under a hand limit, or null when there is none. */
  handsLeft: number | null;
  /** What one discard costs, with any penalty. */
  discardCost: number;
  /** The next discard is one of the Blind's free discards (#924). */
  discardFree: boolean;
  /** The CPU the Blind started with: its allocation plus ON_BLIND_START relics. */
  cpuAllocation: number;
  /** Treatment-arm values are face down (a DMC firewall). */
  firewall: boolean;
  /** The Blind's inspection audit log, for end-of-Blind grading. */
  auditLog: TraceRecord[];
  /** The open Inspect drawer's content when it holds a KM figure. */
  figureInspection: FigureInspectionView | null;
  /** The DMC session in force. */
  session: DmcSession;
  /** The charter the closed session is convened under, or null without a DMC. */
  dmcCharter: string | null;
  /** Why the session cannot change now, or null. */
  sessionRefusal: string | null;
  /** The Blind's DMC access history, oldest first. */
  accessLog: AccessRecord[];
  /** Unblinded outputs the next hand played will score ×0 for. */
  pendingViolations: string[];
  /** A staged encounter's progress, or null outside one. */
  encounter: EncounterView | null;
  /** An FDA Information Request's clock, or null outside one. */
  clock: ClockView | null;
  /** An FDA Information Request's targeted questions; empty outside one. */
  questions: IrQuestionView[];
  /** CSR Lock's sequence slots and lock, or null outside it. */
  csrLock: CsrLockView | null;
  /** The intro card for a Boss Blind; null for every other Blind. */
  bossIntro: BossIntroView | null;
  /**
   * The hand types the current encounter stage accepts, weakest first, or
   * null outside a staged encounter or once its Blind is decided. The
   * selection is classified against them, so the preview and the scored
   * hand agree.
   */
  stageAccepts: HandType[] | null;
  /**
   * The hand types that cannot be played now because the encounter stage
   * does not accept them, weakest first. Empty when every hand is playable.
   */
  refusedHands: HandType[];
  /** A defended encounter's relic offer, or null. */
  reward: { choices: Relic[]; claimed: string | null } | null;
  /** SOP relics the run has earned. */
  relics: Relic[];
  relicSlots: number;
  /** Trial sites the run has activated. */
  sites: Site[];
  /** Site enrollments that land after this Blind's first hand. */
  enrollments: PopulationTransition[];
}

/**
 * CSR Lock as the table shows it (#922): the five sequence slots filled by
 * the selection in order, and the locked package's audit summary once won.
 */
export interface CsrLockView {
  packageName: string;
  /** The selection reconciled slot by slot. */
  report: PackageReport;
  /** The audit summary once the package is locked, else null. */
  lock: Omit<PackageLock, "before"> | null;
  /** Why a protocol amendment cannot be filed now, or null. */
  amendRefusal: string | null;
  /** Protocol amendments filed this Blind. */
  amendments: number;
}

/** One stage of a staged encounter, as the Blind panel shows it. */
export interface EncounterStageView extends EncounterStage {
  score: number;
  status: "DEFENDED" | "ACTIVE" | "PENDING";
}

/** A staged encounter's progress. */
export interface EncounterView {
  stages: EncounterStageView[];
  /** The stage being played, from 0. */
  current: number;
}

/**
 * The intro card for a Boss Blind (#1083): the boss, its debuff line, the
 * quota and CPU, and the stages of a staged encounter. Built from the
 * scenario's own data, so every Boss shows its own debuff.
 */
export interface BossIntroView {
  /** The Blind's title, e.g. "Dose Escalation Committee". */
  title: string;
  /** The boss debuff's name, e.g. "Safety Set Only". */
  bossName: string;
  /** What the debuff does, in one line. */
  debuff: string;
  quota: number;
  startingCpu: number;
  /** The encounter's stages in order; empty for an unstaged Boss. */
  stages: Pick<EncounterStage, "name" | "session" | "quota">[];
  /** Hours until an FDA response is due, or null without a clock. */
  dueHours: number | null;
  /** An FDA Information Request's questions, in order; empty otherwise. */
  questions: string[];
  /** CSR Lock's sequence slot labels, left to right; empty otherwise. */
  csrSlots: string[];
}

/**
 * An FDA Information Request's deterministic clock (#921): hours left, what
 * each move costs, and whether the deadline is close. It moves only when a
 * move is made; nothing reads the wall clock.
 */
export interface ClockView {
  hoursLeft: number;
  totalHours: number;
  /** What each move takes in hours. */
  costs: Record<ClockAction, number>;
  /** `CLOCK_URGENT_HOURS` or fewer are left. */
  urgent: boolean;
  /** The clock ran out with questions open: a Clinical Hold. */
  hold: boolean;
}

/** One targeted question as the Blind panel lists it. */
export interface IrQuestionView extends IrQuestion {
  /** The required card's short name, e.g. "Figure 14.3.1". */
  cardNumber: string;
  answered: boolean;
}

/** One analysis set a blank shell could be compiled on, previewed before committing. */
export interface AllocationOption {
  population: PopulationType;
  /** The snapshot the shell would be compiled against. */
  snapshot: SnapshotRef;
  /** Subjects in that population in the snapshot: the output's N. */
  subjects: number;
  /** Why this set cannot be allocated, or null. */
  refusal: string | null;
  /** The hand the selection would make with this allocation. */
  classification: HandClassification | null;
  /** That hand scored from revealed findings only: an estimate, unverified. */
  estimate: HandEvaluation | null;
}

/**
 * A card's face. Draft cards print the draft table's first five rows, showing
 * corrected values once the player has fixed them.
 */
function faceFor(
  card: TlfCard,
  draft: StagedTable | undefined,
  review: InspectionView | null,
  shell: TableShellSpec | undefined
): CardFace {
  if (!draft && shell?.layout) {
    const { columns, rows } = shell.layout;
    return {
      kind: "TABLE",
      columns: columns.map((c) => c.label),
      rows: rows.slice(0, 5).map((row) => ({
        label: row.label,
        values: columns.map(() => "·"),
      })),
    };
  }
  if (!draft) return card.face as CardFace;
  return {
    kind: "TABLE",
    columns: draft.columns.map((c) => c.label),
    rows: draft.rows.slice(0, 5).map((row, r) => ({
      label: row.label,
      values: draft.columns.map(
        (_, c) => review?.cells[r][c].display ?? draft.cells[r][c]
      ),
    })),
  };
}

const deckCard = (scenario: Scenario, id: string): TlfCard | undefined =>
  scenario.deck.find((card) => card.id === id);

/**
 * A card as it stands on this table: an allocated blank shell takes the suit
 * of the analysis set it was compiled on.
 */
function cardById(
  scenario: Scenario,
  state: TableState,
  id: string
): TlfCard | undefined {
  const card = deckCard(scenario, id);
  const allocated = state.allocations[id];
  return card && allocated ? { ...card, population: allocated } : card;
}

const shellById = (
  scenario: Scenario,
  id: string | undefined
): TableShellSpec | undefined =>
  id === undefined ? undefined : scenario.shells.find((s) => s.id === id);

/** The analysis sets a shell may be run on. */
const compatibleWith = (shell: TableShellSpec): PopulationType[] =>
  shell.compatiblePopulations ?? [shell.targetPopulation];

/** A blank shell with nothing allocated yet. */
const isBlank = (state: TableState, card: TlfCard): boolean =>
  card.shellId !== undefined && state.allocations[card.id] === undefined;

/**
 * The rulebook a card's output is checked against. An allocated shell is
 * held to its own analysis set, which the SAP names as valid for it.
 */
function rulebookFor(
  scenario: Scenario,
  state: TableState,
  card: TlfCard
): SapRulebook {
  const allocated = state.allocations[card.id];
  return allocated
    ? { ...scenario.rulebook, populationSuit: allocated }
    : scenario.rulebook;
}

/** The draft as authored in the scenario, compiled against its own snapshot. */
const authoredDraft = (
  scenario: Scenario,
  card: TlfCard
): StagedTable | undefined =>
  card.draftId === undefined
    ? undefined
    : scenario.drawPile.find((draft) => draft.id === card.draftId);

/** The card's draft as it currently stands: recompiled, or as authored. */
const draftFor = (
  scenario: Scenario,
  state: TableState,
  card: TlfCard
): StagedTable | undefined =>
  state.drafts[card.id] ?? authoredDraft(scenario, card);

const currentSnapshot = (state: TableState): PopulationSnapshot =>
  state.snapshots[state.snapshots.length - 1];

/**
 * A snapshot version by id. Every draft and card references a version in the
 * study's history, which always starts at the scenario's own snapshot.
 */
const snapshotById = (
  scenario: Scenario,
  state: TableState,
  id: string
): PopulationSnapshot =>
  state.snapshots.find((snapshot) => snapshot.id === id) ??
  scenario.populationSnapshot;

/** Validates a card's draft against the snapshot it was compiled from. */
const reportFor = (
  scenario: Scenario,
  state: TableState,
  card: TlfCard,
  draft: StagedTable
): QcReport =>
  validate(
    draft,
    snapshotById(scenario, state, draft.populationSnapshotId),
    rulebookFor(scenario, state, card)
  );

/** The snapshot a dealt card was compiled against. */
const provenanceOf = (state: TableState, card: TlfCard): SnapshotRef =>
  state.provenance[card.id] ?? snapshotRef(currentSnapshot(state));

/** Whether its suit's membership has changed since the card was compiled. */
function isStale(
  scenario: Scenario,
  state: TableState,
  card: TlfCard
): boolean {
  const compiled = state.provenance[card.id];
  if (!compiled) return false;
  return !sameMembership(
    snapshotById(scenario, state, compiled.id),
    currentSnapshot(state),
    card.population
  );
}

/**
 * A card as hand detection sees it: stale cards, and blank shells with no
 * data, cannot make a flush.
 */
const classifiable = (scenario: Scenario, state: TableState, id: string) => {
  const card = cardById(scenario, state, id) as TlfCard;
  return {
    ...card,
    stale: isStale(scenario, state, card) || isBlank(state, card),
  };
};

const label = (card: TlfCard) => `${card.number} ${card.title}`;

/**
 * A card's number, plus its draft letter when the title carries one, so two
 * drafts of one table stay distinguishable: "Table 14.3.1 (Draft A)".
 */
export function cardShortName(card: TlfCard): string {
  const draft = /\(([^()]+)\)$/.exec(card.title);
  return draft ? `${card.number} (${draft[1]})` : card.number;
}

function nextEvent(
  state: TableState,
  kind: TableEvent["kind"],
  message: string
): TableEvent {
  return { kind, message, sequence: (state.lastEvent?.sequence ?? 0) + 1 };
}

const refuse = (state: TableState, message: string): TableState => ({
  ...state,
  lastEvent: nextEvent(state, "REFUSED", message),
});

const handName = (handType: HandClassification["handType"]) =>
  HAND_NAMES[handType];

/** Every modifier in force this Blind: the boss's, then any a crisis imposed. */
const activeModifiers = (
  scenario: Scenario,
  state: TableState
): BossBlindModifier[] =>
  scenario.boss ? [scenario.boss, ...state.modifiers] : [...state.modifiers];

/** The scenario's DMC milestone defense, if it is one. */
export const dmcDefenseOf = (scenario: Scenario): DmcDefense | undefined =>
  scenario.encounter?.kind === "DMC_DEFENSE" ? scenario.encounter : undefined;

/** The scenario's FDA Information Request, if it is one. */
const fdaIrOf = (scenario: Scenario): FdaIr | undefined =>
  scenario.encounter?.kind === "FDA_IR" ? scenario.encounter : undefined;

/** CSR Lock accepts only the Straight (ADR 0046): the package is the hand. */
const CSR_LOCK_HANDS: readonly HandType[] = ["CSR_STRAIGHT"];

const csrLockOf = (scenario: Scenario): CsrLock | undefined =>
  scenario.encounter?.kind === "CSR_LOCK" ? scenario.encounter : undefined;

/** Hours an action takes on the clock; 0 outside an FDA Information Request. */
const hoursFor = (scenario: Scenario, action: ClockAction): number =>
  fdaIrOf(scenario)?.hours[action] ?? 0;

const hoursText = (hours: number) => `${hours} hour${hours === 1 ? "" : "s"}`;

/** Why the clock cannot pay for an action now, or null. */
function clockRefusal(
  scenario: Scenario,
  state: TableState,
  action: ClockAction,
  verb: string
): string | null {
  const hours = hoursFor(scenario, action);
  if (state.clock === null || state.clock >= hours) return null;
  return `${verb} takes ${hoursText(hours)}; ${hoursText(state.clock)} left before the response is due.`;
}

/**
 * An action's hours and what is left, for an announcement: "2 hours (46
 * left)". Empty outside an FDA Information Request.
 */
const hoursTaken = (
  scenario: Scenario,
  after: TableState,
  action: ClockAction
): string =>
  after.clock === null
    ? ""
    : `${hoursText(hoursFor(scenario, action))} (${after.clock} left)`;

/** The state with an action's hours taken off the clock. */
const tick = (
  scenario: Scenario,
  state: TableState,
  action: ClockAction
): TableState =>
  state.clock === null
    ? state
    : { ...state, clock: state.clock - hoursFor(scenario, action) };

/**
 * The questions a played hand answers: each open question whose card scored,
 * in the request's order, while the hand's score covers their shares.
 */
function answeredBy(
  scenario: Scenario,
  state: TableState,
  scoringCardIds: readonly string[],
  score: number
): IrQuestion[] {
  const ir = fdaIrOf(scenario);
  if (!ir || score <= 0) return [];
  const answered: IrQuestion[] = [];
  let left = score;
  for (const question of ir.questions) {
    if (
      state.answered.includes(question.id) ||
      !scoringCardIds.includes(question.cardId) ||
      question.quota > left
    ) {
      continue;
    }
    answered.push(question);
    left -= question.quota;
  }
  return answered;
}

/** The modifier that disables this card's population, if any. */
function disablingModifier(
  scenario: Scenario,
  state: TableState,
  card: TlfCard
): BossBlindModifier | undefined {
  return activeModifiers(scenario, state).find(
    (m) =>
      m.debuffType === "DISABLE_POPULATION" &&
      (m.disabledPopulations ?? []).includes(card.population)
  );
}

/** The tightest hand limit in force, or null. */
function handLimit(scenario: Scenario, state: TableState): number | null {
  const limits = activeModifiers(scenario, state)
    .filter((m) => m.debuffType === "HAND_LIMIT")
    .map((m) => m.maxHandsAllowed as number);
  return limits.length > 0 ? Math.min(...limits) : null;
}

/** The extra CPU every discard costs this Blind. */
const discardSurcharge = (scenario: Scenario, state: TableState): number =>
  activeModifiers(scenario, state)
    .filter((m) => m.debuffType === "DISCARD_PENALTY")
    .reduce((sum, m) => sum + (m.discardCpuPenalty ?? 0), 0);

/** Whether a DMC firewall turns treatment-arm values face down. */
const firewallUp = (scenario: Scenario, state: TableState): boolean =>
  state.session === "OPEN" &&
  activeModifiers(scenario, state).some(
    (m) => m.debuffType === "BLIND_FIREWALL"
  );

/** A closed-session output: its shell is blinded. */
function isBlindedCard(
  scenario: Scenario,
  state: TableState,
  card: TlfCard
): boolean {
  const draft = draftFor(scenario, state, card);
  return (
    shellById(scenario, card.shellId ?? draft?.shellId)?.isBlinded === true
  );
}

/** A closed-session output, or a Figure drawn from one. */
function isClosedSession(
  scenario: Scenario,
  state: TableState,
  card: TlfCard
): boolean {
  if (isBlindedCard(scenario, state, card)) return true;
  const parent = card.km
    ? cardById(scenario, state, card.km.parent.cardId)
    : undefined;
  return parent !== undefined && isBlindedCard(scenario, state, parent);
}

/**
 * Face down: a closed-session output (or a Figure drawn from one), in the
 * open session, and never unblinded by a peek.
 */
const isFaceDown = (
  scenario: Scenario,
  state: TableState,
  card: TlfCard
): boolean =>
  state.session === "OPEN" &&
  !state.unblinded.includes(card.id) &&
  isClosedSession(scenario, state, card);

/** The alert shown when Inspect meets a face-down output. */
const faceDownAlert = (card: TlfCard) =>
  `${cardShortName(card)} is face down in the DMC open session: run structural QC, or convene the closed session.`;

/** A face with every value redacted: its structure and labels only. */
function redactedFace(face: CardFace): CardFace {
  if (face.kind === "TABLE") {
    return {
      ...face,
      rows: face.rows.map((row) => ({
        label: row.label,
        values: row.values.map(() => FIREWALL_CELL),
      })),
    };
  }
  if (face.kind === "LISTING") {
    return {
      ...face,
      rows: face.rows.map((row) => row.map(() => FIREWALL_CELL)),
    };
  }
  if (face.kind === "FIGURE") {
    // The plot type and source print; no curve, interval or count does.
    const { plot } = face;
    const flat = {
      label: FIREWALL_CELL,
      points: [
        [0, 1],
        [1, 1],
      ] as [number, number][],
    };
    return {
      kind: "FIGURE",
      source: face.source,
      plot:
        plot.type === "FOREST"
          ? {
              ...plot,
              intervals: plot.intervals.map(() => ({
                label: FIREWALL_CELL,
                estimate: plot.reference,
                lower: plot.reference,
                upper: plot.reference,
              })),
            }
          : { type: plot.type, series: [flat] },
    };
  }
  return { kind: "TOKEN", cohort: FIREWALL_CELL, count: 0 };
}

/** The access history with one more entry. */
function withAccess(
  state: TableState,
  kind: AccessKind,
  cardId: string | null,
  authorized: boolean,
  text: string
): AccessRecord[] {
  return [
    ...state.accessLog,
    {
      seq: state.accessLog.length + 1,
      kind,
      cardId,
      session: state.session,
      handsPlayed: state.handsPlayed,
      authorized,
      text,
    },
  ];
}

/** Blinded outputs in hand, in hand order. */
const blindedInHand = (scenario: Scenario, state: TableState): TlfCard[] =>
  state.hand
    .map((id) => cardById(scenario, state, id) as TlfCard)
    .filter((card) => isBlindedCard(scenario, state, card));

/** Why the DMC session cannot move to `to` now, or null. */
function sessionRefusal(
  scenario: Scenario,
  state: TableState,
  to: DmcSession
): string | null {
  if (!scenario.dmc) {
    return "No Data Monitoring Committee is chartered for this Blind.";
  }
  if (state.session === to) {
    return `The ${to === "OPEN" ? "open" : "closed"} session is already in force.`;
  }
  const encounter = dmcDefenseOf(scenario);
  if (encounter && to === "CLOSED" && state.stage === 0) {
    return `Premature unblinding: the DMC convenes the closed session only after ${encounter.stages[0].name} is defended.`;
  }
  if (encounter && to === "OPEN") {
    return "The closed session stays in force until the closed package is defended.";
  }
  if (to === "CLOSED") {
    const pending = blindedInHand(scenario, state).filter(
      (card) => !state.structuralQc.includes(card.id)
    );
    if (pending.length > 0) {
      return `Run structural QC on every blinded output before convening the closed session: ${pending.map(cardShortName).join(", ")}.`;
    }
  }
  return null;
}

/**
 * Cards in hand whose reviews a session change withdraws: the blinded
 * outputs, and any Figure built on one.
 */
function sessionDependents(scenario: Scenario, state: TableState): string[] {
  return state.hand.filter((id) =>
    isClosedSession(scenario, state, cardById(scenario, state, id) as TlfCard)
  );
}

/**
 * The hand types the encounter's current stage accepts, or undefined outside
 * a staged encounter. Classification is restricted to them, so a lower
 * accepted hand is not shadowed by a higher one the stage refuses (#1077).
 */
function stageHands(
  scenario: Scenario,
  state: TableState
): readonly HandType[] | undefined {
  return (
    fdaIrOf(scenario)?.hands ??
    dmcDefenseOf(scenario)?.stages[state.stage]?.hands ??
    (csrLockOf(scenario) ? CSR_LOCK_HANDS : undefined)
  );
}

/**
 * Why Play Hand would be refused, and what clears it: `fix` is a short
 * imperative and `key` its keyboard shortcut on a focused card, when one
 * exists.
 */
export interface PlayBlocker {
  reason: string;
  fix: string | null;
  key: string | null;
}

const blocker = (
  reason: string,
  fix: string | null = null,
  key: string | null = null
): PlayBlocker => ({ reason, fix, key });

/** Why an encounter stage will not accept this hand, or null. */
function stageRefusal(
  scenario: Scenario,
  state: TableState,
  stage: EncounterStage,
  classification: HandClassification
): PlayBlocker | null {
  if (state.session !== stage.session) {
    return blocker(
      `${stage.name} is played in the closed session: convene it first.`,
      "Convene the closed session"
    );
  }
  if (!stage.hands.includes(classification.handType)) {
    return blocker(
      `${stage.name} accepts ${stage.hands.map(handName).join(", ")}; this is ${handName(classification.handType)}.`,
      `Select ${stage.hands.length === 1 ? "an" : "one"} ${stage.hands.map(handName).join(" or ")}`
    );
  }
  if (stage.session === "OPEN") {
    const closed = state.selected
      .map((id) => cardById(scenario, state, id) as TlfCard)
      .filter((card) => isClosedSession(scenario, state, card));
    if (closed.length > 0) {
      return blocker(
        `Closed-session outputs cannot be presented in the open session: ${closed.map(cardShortName).join(", ")}.`,
        `Deselect ${closed.map((card) => card.number).join(", ")}`,
        "Space"
      );
    }
  }
  return null;
}

/**
 * The first reason Play Hand would be refused now, in the order the reducer
 * checks them, or null when the selection can be played. `PLAY_HAND` refuses
 * with exactly this reason, and the view shows it under the button, so the
 * two cannot drift apart (#1078). Pure: it dispatches nothing.
 */
function playBlocker(
  scenario: Scenario,
  state: TableState,
  classification: HandClassification | null
): PlayBlocker | null {
  if (state.status !== "REVIEWING") {
    return blocker("The Blind is over. Restart to play again.");
  }
  if (state.crisis) {
    return blocker(crisisAlert(state.crisis), "Answer it in the crisis panel");
  }
  if (state.selected.length === 0 || !classification) {
    return blocker(
      "Select at least one card to play.",
      "Select a card",
      "Space"
    );
  }
  const selected = state.selected.map(
    (id) => cardById(scenario, state, id) as TlfCard
  );
  const stale = selected.filter((card) => isStale(scenario, state, card));
  if (stale.length > 0) {
    return blocker(
      `${STALE_ALERT} Stale: ${stale.map(cardShortName).join(", ")}.`,
      `Recompile ${stale[0].number}`,
      "R"
    );
  }
  const empty = selected.filter((card) => isBlank(state, card));
  if (empty.length > 0) {
    return blocker(
      `${EMPTY_SHELL_ALERT} Empty: ${empty.map(cardShortName).join(", ")}.`,
      `Allocate ${empty[0].number}`,
      "A"
    );
  }
  const stage = dmcDefenseOf(scenario)?.stages[state.stage];
  const refusal = stage
    ? stageRefusal(scenario, state, stage, classification)
    : null;
  if (refusal) return refusal;
  const ir = fdaIrOf(scenario);
  if (ir && !ir.hands.includes(classification.handType)) {
    return blocker(
      `The FDA accepts ${ir.hands.map(handName).join(", ")}; this is ${handName(classification.handType)}.`,
      `Select a ${ir.hands.map(handName).join(" or ")}`
    );
  }
  if (csrLockOf(scenario) && classification.handType !== "CSR_STRAIGHT") {
    return blocker(
      `CSR Lock accepts only a CSR Straight; this is ${handName(classification.handType)}.`,
      "Select one output per CSR stage, in pipeline order"
    );
  }
  const lock = lockRefusal(scenario, state, classification);
  if (lock) return lock;
  if (!canAfford(state.cpu, "PLAY_HAND")) {
    return blocker(
      `Play Hand needs ${CPU_COSTS.PLAY_HAND} CPU; ${state.cpu.available} left.`
    );
  }
  const late = clockRefusal(scenario, state, "PLAY_HAND", "Play Hand");
  if (late) return blocker(late);
  return null;
}

/** What reconciliation knows about one output in the CSR package. */
function packageEvidence(
  scenario: Scenario,
  state: TableState,
  cardId: string
): PackageEvidence {
  const card = cardById(scenario, state, cardId) as TlfCard;
  const draft = draftFor(scenario, state, card);
  const inspection = state.inspections[card.id];
  const review =
    draft && inspection
      ? deriveInspectionView(
          draft,
          reportFor(scenario, state, card, draft),
          inspection
        )
      : null;
  const figure = figureStatus(scenario, state, card);
  const validation = isBlank(state, card)
    ? "its shell is empty; allocate an analysis set."
    : isFaceDown(scenario, state, card)
      ? "it is face down in the open session."
      : draft && !inspection
        ? "inspect it."
        : review && review.reviewedCells < review.totalCells
          ? `${review.reviewedCells} of ${review.totalCells} cells reviewed; review every cell.`
          : (figure?.reason ?? null);
  return {
    cardId: card.id,
    name: cardShortName(card),
    csrStage: card.csrStage,
    stale: isStale(scenario, state, card),
    validation,
    openFindings: (review?.openFindings ?? []).map((f) => ({
      category: f.category,
      evidence: f.evidence,
    })),
  };
}

/** The selection as a CSR package, reconciled slot by slot in selection order. */
const packageReport = (scenario: Scenario, state: TableState): PackageReport =>
  reconcilePackage(
    state.selected.map((id) => packageEvidence(scenario, state, id))
  );

/** How a broken slot is cleared, and its shortcut on a focused card. */
function slotFix(
  scenario: Scenario,
  state: TableState,
  slot: PackageSlot
): PlayBlocker {
  const card = slot.cardId ? cardById(scenario, state, slot.cardId) : null;
  const number = card?.number ?? "";
  switch (slot.status) {
    case "STALE":
      return blocker(slot.reason as string, `Recompile ${number}`, "R");
    case "UNVALIDATED":
      return blocker(
        slot.reason as string,
        card && isBlank(state, card)
          ? `Allocate ${number}`
          : `Inspect ${number}`,
        card && isBlank(state, card) ? "A" : "I"
      );
    case "RULEBOOK":
    case "OPEN_FINDING":
      return blocker(
        slot.reason as string,
        `Correct ${number} in the Inspect view`,
        "I"
      );
    default:
      return blocker(
        slot.reason as string,
        `Select the ${slot.label} output ${ordinal(CSR_ORDER.indexOf(slot.stage) + 1)}`
      );
  }
}

const ordinal = (n: number) =>
  ["first", "second", "third", "fourth", "fifth"][n - 1] ?? `${n}th`;

/**
 * A CSR Lock's lock hand: why the package cannot lock now, or null. The
 * Straight must reconcile, and it must reach the quota, since the package
 * locks once. A reconciled package's findings are all revealed, so its true
 * score is the score the player previews.
 */
function lockRefusal(
  scenario: Scenario,
  state: TableState,
  classification: HandClassification
): PlayBlocker | null {
  if (!csrLockOf(scenario) || classification.handType !== "CSR_STRAIGHT") {
    return null;
  }
  const report = packageReport(scenario, state);
  if (report.firstBreak) return slotFix(scenario, state, report.firstBreak);
  const score = scoreCards(
    scenario,
    state,
    classification.scoringCardIds.map(
      (id) => cardById(scenario, state, id) as TlfCard
    ),
    "CSR_STRAIGHT",
    false
  ).score;
  const short = scenario.blind.quota - state.roundScore - score;
  if (short > 0) {
    return blocker(
      `The package would lock at ${state.roundScore + score} of ${scenario.blind.quota}: ${short} short.`,
      "Strengthen the Straight: a Guidance card, a seal or a stronger output"
    );
  }
  return null;
}

/** This Blind as a campaign record, for the next Blind and the final score. */
function campaignRecord(scenario: Scenario, state: TableState): CampaignRecord {
  const milestone = dmcDefenseOf(scenario)
    ? "DMC_DEFENSE"
    : fdaIrOf(scenario)
      ? "FDA_IR"
      : null;
  return {
    scenarioId: scenario.id,
    blindName: scenario.blind.name,
    score: state.roundScore,
    milestone,
    hoursToSpare: milestone === "FDA_IR" ? state.clock : null,
  };
}

/** The immutable audit summary of a package locked by the hand just played. */
function packageLock(
  scenario: Scenario,
  before: TableState,
  after: TableState,
  lockHand: PlayedHand
): PackageLock {
  const campaign = [...after.campaign, campaignRecord(scenario, after)];
  return {
    packageName: (csrLockOf(scenario) as CsrLock).packageName,
    outputs: lockHand.cardIds.map((id, i) => {
      const card = cardById(scenario, before, id) as TlfCard;
      return {
        stage: CSR_ORDER[i],
        cardId: id,
        name: cardShortName(card),
        title: card.title,
        snapshotId: provenanceOf(before, card).id,
        rulebookId: rulebookFor(scenario, before, card).id,
      };
    }),
    handScore: lockHand.evaluation.score,
    roundScore: after.roundScore,
    campaign,
    final: campaignScore(campaign),
    amendment: before.amendments,
    before,
  };
}

/** Why a protocol amendment cannot be filed now, or null. */
function amendRefusal(scenario: Scenario, state: TableState): string | null {
  const lock = state.lock;
  if (!lock)
    return "Nothing is locked: a protocol amendment amends a locked package.";
  const reviews = lock.outputs.filter((o) =>
    draftFor(
      scenario,
      lock.before,
      cardById(scenario, lock.before, o.cardId) as TlfCard
    )
  ).length;
  const needed = reviews * CPU_COSTS.INSPECT + CPU_COSTS.PLAY_HAND;
  if (lock.before.cpu.available < needed) {
    return `Re-validating the package needs ${needed} CPU (${reviews} re-inspection${reviews === 1 ? "" : "s"} and the lock hand); reopening leaves ${lock.before.cpu.available}.`;
  }
  return null;
}

/** Changing a locked package needs a formal protocol amendment. */
export const LOCKED_ALERT =
  "The CSR package is locked. Changing it needs a formal protocol amendment.";

/** An encounter's stage scores after a hand, moving on once a stage is defended. */
function advanceStage(
  scenario: Scenario,
  state: TableState,
  score: number
): Pick<TableState, "stage" | "stageScores"> {
  const stages = dmcDefenseOf(scenario)?.stages ?? [];
  const stageScores = state.stageScores.map((s, i) =>
    i === state.stage ? s + score : s
  );
  const defended = stageScores[state.stage] >= stages[state.stage].quota;
  return {
    stageScores,
    stage:
      defended && state.stage < stages.length - 1
        ? state.stage + 1
        : state.stage,
  };
}

/** The alert shown while a crisis waits for an answer. */
const crisisAlert = (crisis: CrisisCard) =>
  `${crisis.name}: answer the crisis first.`;

/** A KM figure's findings, validated against its parent Table's face. */
function kmReportFor(
  scenario: Scenario,
  state: TableState,
  card: TlfCard
): KmReport | null {
  if (!card.km) return null;
  const parent = cardById(scenario, state, card.km.parent.cardId);
  // A face-down parent's values stay behind the firewall: the figure cannot
  // be reconciled against them until the closed session reveals them.
  const parentFace =
    parent && !isFaceDown(scenario, state, parent)
      ? faceFor(
          parent,
          draftFor(scenario, state, parent),
          null,
          shellById(scenario, parent.shellId)
        )
      : undefined;
  return validateKm(
    card.km,
    snapshotById(scenario, state, card.km.populationSnapshotId),
    card.population,
    parentFace
  );
}

/** Why a Figure's parent Table blocks it from compiling, or null. */
function dependencyBlock(
  scenario: Scenario,
  state: TableState,
  card: TlfCard
): string | null {
  if (!card.km) return null;
  const parent = cardById(scenario, state, card.km.parent.cardId);
  const name = parent ? cardShortName(parent) : card.km.parent.cardId;
  if (!parent || !state.hand.includes(parent.id)) {
    return `Parent ${name} is not on the table: a dependent Figure needs its source Table in hand.`;
  }
  if (isStale(scenario, state, parent)) {
    return `Parent ${name} is stale: recompile it before the Figure can compile.`;
  }
  const draft = draftFor(scenario, state, parent);
  if (draft) {
    const inspection = state.inspections[parent.id];
    if (!inspection) {
      return `Parent ${name} is unvalidated: inspect it before the Figure can compile.`;
    }
    const open = deriveInspectionView(
      draft,
      reportFor(scenario, state, parent, draft),
      inspection
    ).openFindings.length;
    if (open > 0) {
      return `Parent ${name} has ${open} open redline${open === 1 ? "" : "s"}.`;
    }
  }
  return null;
}

/** A Figure's ×Mult badge: its parent, and whether the ×Mult applies now. */
function figureStatus(
  scenario: Scenario,
  state: TableState,
  card: TlfCard
): FigureStatus | null {
  if (!card.km) return null;
  const parent = cardById(scenario, state, card.km.parent.cardId);
  const blockedBy = dependencyBlock(scenario, state, card);
  const inspection = state.inspections[card.id];
  const report = kmReportFor(scenario, state, card) as KmReport;
  const open = report.findings.filter(
    (f) => !inspection?.resolvedFindingIds.includes(f.id)
  ).length;
  const reason =
    blockedBy ??
    (isStale(scenario, state, card)
      ? `${cardShortName(card)} is stale: recompile it.`
      : !inspection
        ? "Inspect the figure to reconcile its Number-at-Risk."
        : open > 0
          ? `${open} Kaplan–Meier discrepanc${open === 1 ? "y" : "ies"} unresolved.`
          : null);
  return {
    parent: parent ? parent.number : card.km.parent.cardId,
    xMult: KM_SYNERGY,
    active: reason === null,
    reason,
    blocked: blockedBy !== null,
  };
}

/** A KM figure's face: the draft as printed, each arm corrected once reconciled. */
function kmFace(
  scenario: Scenario,
  state: TableState,
  card: TlfCard
): CardFace {
  const km = card.km as KmFigure;
  const report = kmReportFor(scenario, state, card) as KmReport;
  const resolved = new Set(state.inspections[card.id]?.resolvedFindingIds);
  const last = km.milestones[km.milestones.length - 1];
  const arms = km.displayed.map((shown, i) => {
    const exp = report.arms[i];
    const fixed =
      state.inspections[card.id] !== undefined &&
      report.findings
        .filter((f) => f.arm === shown.arm)
        .every((f) => resolved.has(f.id));
    const curve: [number, number][] = fixed
      ? [...exp.curve, [last, exp.curve[exp.curve.length - 1][1]]]
      : shown.curve;
    return {
      label: shown.arm === "PLACEBO" ? "Placebo" : "Active",
      points: curve.slice(0, 12),
      censors: fixed ? exp.censorTicks : shown.censorTicks,
      atRisk: fixed ? exp.atRisk : shown.atRisk,
    };
  });
  const parent = cardById(scenario, state, km.parent.cardId);
  return {
    kind: "FIGURE",
    plot: {
      type: "KM",
      series: arms.map(({ label: l, points, censors }) => ({
        label: l,
        points,
        censors,
      })),
    },
    source: parent?.number.slice(0, 24),
    atRisk: {
      times: km.milestones,
      rows: arms.map((a) => ({ label: a.label, values: a.atRisk })),
    },
  };
}

/** Cards in hand that form a TLF Pair with this one, in hand order. */
function pairPartners(
  scenario: Scenario,
  state: TableState,
  card: TlfCard
): TlfCard[] {
  const partnerType =
    card.cardType === "TABLE"
      ? "LISTING"
      : card.cardType === "LISTING"
        ? "TABLE"
        : null;
  if (partnerType === null) return [];
  return state.hand
    .map((id) => cardById(scenario, state, id) as TlfCard)
    .filter(
      (c) =>
        c.id !== card.id && c.cardType === partnerType && c.topic === card.topic
    );
}

/**
 * Whether a Listing shares the Table's provenance: neither output is stale,
 * and the Listing's snapshot has the same members of the Table's analysis
 * set as the snapshot the Table was compiled against.
 */
function provenanceMatches(
  scenario: Scenario,
  state: TableState,
  table: TlfCard,
  draft: StagedTable,
  listing: TlfCard
): boolean {
  if (isStale(scenario, state, table) || isStale(scenario, state, listing)) {
    return false;
  }
  return sameMembership(
    snapshotById(scenario, state, provenanceOf(state, listing).id),
    snapshotById(scenario, state, draft.populationSnapshotId),
    rulebookFor(scenario, state, table).populationSuit
  );
}

/** The Listing a Table's cells trace into, or why none can be traced now. */
function traceTarget(
  scenario: Scenario,
  state: TableState,
  table: TlfCard,
  draft: StagedTable
): { listing: TlfCard | null; blocked: string | null } {
  if (firewallUp(scenario, state)) {
    return { listing: null, blocked: FIREWALL_ALERT };
  }
  const partners = pairPartners(scenario, state, table);
  if (partners.length === 0) {
    return {
      listing: null,
      blocked: `No supporting Listing for ${cardShortName(table)} is in hand: a trace needs one.`,
    };
  }
  const listing = partners.find((l) =>
    provenanceMatches(scenario, state, table, draft, l)
  );
  return listing
    ? { listing, blocked: null }
    : { listing: partners[0], blocked: PROVENANCE_ALERT };
}

/** A Table's current audit log entries traced into one Listing. */
const tracesOf = (state: TableState, tableId: string, listingId?: string) =>
  state.auditLog.filter(
    (e) =>
      e.cardId === tableId &&
      !e.superseded &&
      (listingId === undefined || e.listingId === listingId)
  );

/**
 * Whether a Table played with this Listing earns the TLF Pair ×Mult: at least
 * one flagged cell traced into it, and every traced discrepancy resolved.
 */
function pairSynergy(
  state: TableState,
  tableId: string,
  listingId: string
): boolean {
  const traces = tracesOf(state, tableId, listingId);
  return traces.length > 0 && traces.every((e) => e.resolution === "RESOLVED");
}

/** A face-down cell under a DMC firewall. */
export const FIREWALL_CELL = "■";

const ARM_LABELS = new Set(["placebo", "active", "arm", "pbo", "act"]);

/**
 * A face with every treatment-arm value turned face down: arm columns of a
 * table, and the arm column of a listing. Totals stay readable.
 */
function firewalled(face: CardFace, draft: StagedTable | undefined): CardFace {
  const isArm = (label: string, c: number) =>
    draft
      ? draft.columns[c]?.arm !== "TOTAL"
      : ARM_LABELS.has(label.trim().toLowerCase());
  if (face.kind === "TABLE") {
    return {
      ...face,
      rows: face.rows.map((row) => ({
        ...row,
        values: row.values.map((v, c) =>
          isArm(face.columns[c], c) ? FIREWALL_CELL : v
        ),
      })),
    };
  }
  if (face.kind === "LISTING") {
    return {
      ...face,
      rows: face.rows.map((row) =>
        row.map((v, c) =>
          ARM_LABELS.has(face.columns[c].trim().toLowerCase())
            ? FIREWALL_CELL
            : v
        )
      ),
    };
  }
  return face;
}

/**
 * A disabling modifier as one explained rule result: a disabled card's
 * Chips, and any subject credit its draft earned, are cancelled. Its +Mult
 * and any zero-score rule still apply.
 */
function debuffFor(
  scenario: Scenario,
  state: TableState,
  card: TlfCard,
  results: readonly RuleCheckResult[]
): RuleCheckResult | null {
  const modifier = disablingModifier(scenario, state, card);
  if (!modifier) return null;
  const chips = card.chips + results.reduce((sum, r) => sum + r.chipsDelta, 0);
  return {
    ruleId: modifier.id,
    passed: false,
    chipsDelta: -chips,
    multDelta: 0,
    evidence: `${scenario.title} (${modifier.name}): ${card.number} is built on the ${POPULATION_LABELS[card.population]} population, so it scores 0 Chips (${chips} cancelled).`,
  };
}

/**
 * Rule results for a set of scoring cards. `revealedOnly` limits each card to
 * the findings its inspection has revealed (the preview); otherwise every true
 * finding counts, so an undiscovered fatal defect still zeroes the hand.
 */
/**
 * A stale card's Chips, and any subject credit its draft earned, cancelled
 * as one explained rule result. Its +Mult still counts.
 */
function staleFor(
  scenario: Scenario,
  state: TableState,
  card: TlfCard,
  results: readonly RuleCheckResult[]
): RuleCheckResult | null {
  if (!isStale(scenario, state, card)) return null;
  const compiled = provenanceOf(state, card);
  const current = currentSnapshot(state);
  const chips = card.chips + results.reduce((sum, r) => sum + r.chipsDelta, 0);
  return {
    ruleId: "STALE-SNAPSHOT",
    passed: false,
    chipsDelta: -chips,
    multDelta: 0,
    evidence: `${card.number} was compiled against ${compiled.id}, and ${current.id} has changed the ${POPULATION_LABELS[card.population]} population, so it scores 0 Chips (${chips} cancelled). ${STALE_ALERT}`,
  };
}

/** How many footnote seals a card takes: its shell's slots, or none. */
function footnoteSlotsOf(
  scenario: Scenario,
  state: TableState,
  card: TlfCard
): number {
  const shellId = card.shellId ?? draftFor(scenario, state, card)?.shellId;
  return shellById(scenario, shellId)?.allowedFootnoteSlots ?? 0;
}

/** Why a seal cannot be affixed to a card, or null when it can. */
function sealRefusal(
  scenario: Scenario,
  state: TableState,
  card: TlfCard,
  seal: FootnoteSeal
): string | null {
  const name = cardShortName(card);
  if (isBlank(state, card)) {
    return `${name} is an empty shell: allocate an analysis set before adding footnotes.`;
  }
  const slots = footnoteSlotsOf(scenario, state, card);
  if (slots === 0) {
    return `${name} has no footnote slot: only outputs compiled from a table shell take footnotes.`;
  }
  if ((state.seals[card.id] ?? []).length >= slots) {
    return `${name} has no free footnote slot.`;
  }
  const { cardTypes, populations, topics } = seal.eligible;
  if (cardTypes && !cardTypes.includes(card.cardType)) {
    return `${seal.name} applies to ${cardTypes.map((t) => t.toLowerCase()).join(" and ")} outputs only.`;
  }
  if (populations && !populations.includes(card.population)) {
    return `${seal.name} applies to ${populations.map((p) => POPULATION_LABELS[p]).join(" and ")} outputs only; ${name} is built on ${POPULATION_LABELS[card.population]}.`;
  }
  if (topics && !topics.includes(card.topic)) {
    return `${seal.name} does not apply to ${name}.`;
  }
  if (
    seal.effect.kind === "WAIVE" &&
    waivedRules(scenario, state, card, [seal]).length === 0
  ) {
    return `No SAP rule for ${name} accepts the ${seal.name} footnote, so it has nothing to waive there.`;
  }
  return null;
}

/** A seal's effect in words, for announcements. */
function sealEffectText(
  scenario: Scenario,
  state: TableState,
  card: TlfCard,
  seal: FootnoteSeal
): string {
  switch (seal.effect.kind) {
    case "PLUS_CHIPS":
      return `+${seal.effect.value} Chips`;
    case "PLUS_MULT":
      return `+${seal.effect.value} Mult`;
    case "WAIVE":
      return `waives ${waivedRules(scenario, state, card, [seal]).join(", ")} redlines`;
  }
}

/** The rules a card's SAP lets these seals waive. */
const waivedRules = (
  scenario: Scenario,
  state: TableState,
  card: TlfCard,
  seals: readonly FootnoteSeal[]
): string[] =>
  rulebookFor(scenario, state, card)
    .rules.filter((rule) =>
      seals.some(
        (seal) =>
          seal.effect.kind === "WAIVE" &&
          (rule.waivableBy ?? []).includes(seal.id)
      )
    )
    .map((rule) => rule.id);

/**
 * Applies a card's footnote seals to its rule results. A waiver turns the
 * redline of a rule the SAP declares waivable into a passed result that says
 * which footnote waived it; a fatal result is never touched. A bonus seal
 * adds its own `SEAL-*` result. Either way the seal stays traceable.
 */
function withSeals(
  scenario: Scenario,
  state: TableState,
  card: TlfCard,
  results: readonly RuleCheckResult[]
): RuleCheckResult[] {
  const seals = state.seals[card.id] ?? [];
  const rules = rulebookFor(scenario, state, card).rules;
  const next = results.map((result) => {
    if (result.passed || result.multMultiplier !== undefined) return result;
    const rule = rules.find((r) => r.id === result.ruleId);
    const seal = seals.find(
      (s) =>
        s.effect.kind === "WAIVE" && (rule?.waivableBy ?? []).includes(s.id)
    );
    if (!seal) return result;
    return {
      ...result,
      passed: true,
      multDelta: 0,
      evidence: `Waived by footnote seal ${seal.name}: "${seal.footnote}" ${result.evidence}`,
    };
  });
  for (const seal of seals) {
    if (seal.effect.kind === "WAIVE") continue;
    const chips = seal.effect.kind === "PLUS_CHIPS" ? seal.effect.value : 0;
    const mult = seal.effect.kind === "PLUS_MULT" ? seal.effect.value : 0;
    next.push({
      ruleId: `SEAL-${seal.id}`,
      passed: true,
      chipsDelta: chips,
      multDelta: mult,
      evidence: `${card.number} carries the ${seal.name} footnote: "${seal.footnote}"`,
    });
  }
  return next;
}

/**
 * QC ✓ only once every cell is reviewed, so it never vouches for a defect
 * the player has not looked for. An inspected KM figure shows all of its
 * findings at once.
 */
function qcPassed(
  review: { reviewedCells: number; totalCells: number } | null,
  kmInspected: boolean,
  openRedlines: number
): boolean {
  return (
    openRedlines === 0 &&
    ((review !== null && review.reviewedCells === review.totalCells) ||
      kmInspected)
  );
}

/** Whether a card carries the QC ✓ stamp, as the hand view shows it. */
function isQcPassed(
  scenario: Scenario,
  state: TableState,
  card: TlfCard
): boolean {
  const inspection = state.inspections[card.id];
  if (!inspection) return false;
  const km = kmReportFor(scenario, state, card);
  if (km) {
    return qcPassed(
      null,
      true,
      km.findings.filter((f) => !inspection.resolvedFindingIds.includes(f.id))
        .length
    );
  }
  const draft = draftFor(scenario, state, card);
  if (!draft) return false;
  const review = deriveInspectionView(
    draft,
    reportFor(scenario, state, card, draft),
    inspection
  );
  return qcPassed(review, false, review.openFindings.length);
}

function scoreCards(
  scenario: Scenario,
  state: TableState,
  cards: readonly TlfCard[],
  handType: HandClassification["handType"],
  revealedOnly: boolean
): HandEvaluation {
  const ruleResults: RuleCheckResult[] = [];
  const relicCards: RelicCard[] = [];
  for (const card of cards) {
    const first = ruleResults.length;
    const draft = draftFor(scenario, state, card);
    const inspection = state.inspections[card.id] ?? createInspectionState();
    let results: RuleCheckResult[] = [];
    if (draft) {
      const report = reportFor(scenario, state, card, draft);
      results.push(
        ...ruleResultsFor(report, rulebookFor(scenario, state, card), {
          resolvedFindingIds: inspection.resolvedFindingIds,
          visibleFindingIds: revealedOnly
            ? visibleFindingIds(report, inspection)
            : undefined,
        })
      );
    }
    results = withSeals(scenario, state, card, results);
    ruleResults.push(...results);
    const km = kmReportFor(scenario, state, card);
    if (km) {
      const inspection = state.inspections[card.id];
      if (!revealedOnly || inspection) {
        for (const f of km.findings) {
          if (inspection?.resolvedFindingIds.includes(f.id)) continue;
          results.push({
            ruleId: `KM@${f.id}`,
            passed: false,
            chipsDelta: 0,
            multDelta: -KM_REDLINE_PENALTY,
            evidence: `${cardShortName(card)}: ${f.evidence} Shows ${f.observed}; expected ${f.expected}.`,
          });
        }
      }
      ruleResults.push(...results.filter((r) => r.ruleId.startsWith("KM@")));
    }
    const blockedBy = dependencyBlock(scenario, state, card);
    const cancelled =
      staleFor(scenario, state, card, results) ??
      debuffFor(scenario, state, card, results) ??
      (blockedBy
        ? {
            ruleId: "FIG-DEPENDENCY",
            passed: false,
            chipsDelta: -(
              card.chips + results.reduce((sum, r) => sum + r.chipsDelta, 0)
            ),
            multDelta: 0,
            evidence: `${cardShortName(card)} cannot compile: ${blockedBy}`,
          }
        : null);
    if (cancelled) ruleResults.push(cancelled);
    relicCards.push({
      id: card.id,
      cardType: card.cardType,
      population: card.population,
      chips: card.chips,
      mult: card.mult,
      qcPassed: isQcPassed(scenario, state, card),
      cancelled: cancelled !== null,
    });
    if (km && figureStatus(scenario, state, card)?.active) {
      ruleResults.push({
        ruleId: `KM-RECONCILED@${card.id}`,
        passed: true,
        chipsDelta: 0,
        multDelta: 0,
        multMultiplier: KM_SYNERGY,
        evidence: `${cardShortName(card)}: Number-at-Risk, censoring ticks and survival estimates reconcile with ${figureStatus(scenario, state, card)?.parent}.`,
      });
    }
    // A face-down output's findings score, but their evidence would print
    // closed-session values, so it is withheld.
    if (isFaceDown(scenario, state, card)) {
      for (let i = first; i < ruleResults.length; i++) {
        ruleResults[i] = {
          ...ruleResults[i],
          evidence: `${cardShortName(card)}: closed-session finding; its values are withheld in the open session.`,
        };
      }
    }
  }
  if (state.pendingViolations.length > 0) {
    ruleResults.push({
      ruleId: UNBLINDING_RULE_ID,
      passed: false,
      chipsDelta: 0,
      multDelta: 0,
      multMultiplier: 0,
      evidence: `Unauthorized unblinding of ${state.pendingViolations
        .map((id) => cardShortName(cardById(scenario, state, id) as TlfCard))
        .join(
          ", "
        )} in the open session: the DMC firewall zeroes this hand's Mult.`,
    });
  }
  if (handType === "TLF_PAIR" || handType === "TLF_TWO_PAIR") {
    for (const table of cards.filter((c) => c.cardType === "TABLE")) {
      const listing = cards.find(
        (c) =>
          c.cardType === "LISTING" &&
          c.topic === table.topic &&
          pairSynergy(state, table.id, c.id)
      );
      if (!listing) continue;
      ruleResults.push({
        ruleId: `TLF-PAIR@${table.id}`,
        passed: true,
        chipsDelta: 0,
        multDelta: 0,
        multMultiplier: TLF_PAIR_SYNERGY,
        evidence: `${cardShortName(table)} traced to ${listing.number} with every traced discrepancy resolved: TLF Pair synergy.`,
      });
    }
  }
  return evaluateHand({
    handType,
    cards: cards.map((c) => ({ id: c.id, chips: c.chips, mult: c.mult })),
    ruleResults,
    modifiers: [
      ...relicModifiers(state.relics, { cards: relicCards, ruleResults }),
      ...state.sites.map((s) => s.modifier),
    ],
    level: state.handLevels[handType].level,
  });
}

/**
 * Compiles a draft against the current snapshot. Cells whose every finding
 * the reviewer corrected are recompiled correctly; see `compileDraft`.
 */
function compileAgainstCurrent(
  scenario: Scenario,
  state: TableState,
  card: TlfCard,
  draft: StagedTable,
  inspection: InspectionState | undefined
): StagedTable {
  const corrected = new Set<string>();
  if (inspection) {
    const resolved = new Set(inspection.resolvedFindingIds);
    const byCell = new Map<string, boolean>();
    for (const f of reportFor(scenario, state, card, draft).findings) {
      const key = `${f.cell.row}:${f.cell.col}`;
      byCell.set(key, (byCell.get(key) ?? true) && resolved.has(f.id));
    }
    for (const [key, allResolved] of byCell) {
      if (allResolved) corrected.add(key);
    }
  }
  return compileDraft(
    draft,
    snapshotById(scenario, state, draft.populationSnapshotId),
    currentSnapshot(state),
    rulebookFor(scenario, state, card),
    corrected
  );
}

/**
 * Deals from the deck until the hand is full or the deck is empty. Each card
 * is compiled against the current snapshot as it is drawn.
 */
function refill(scenario: Scenario, state: TableState): TableState {
  const hand = [...state.hand];
  const provenance = { ...state.provenance };
  const drafts = { ...state.drafts };
  const current = currentSnapshot(state);
  let index = state.deckIndex;
  while (
    hand.length < scenario.table.handSize &&
    index < scenario.deck.length
  ) {
    const card = scenario.deck[index];
    hand.push(card.id);
    // A blank shell has no data yet: it gets provenance when it is compiled.
    if (card.shellId === undefined) provenance[card.id] = snapshotRef(current);
    const authored = authoredDraft(scenario, card);
    if (authored && authored.populationSnapshotId !== current.id) {
      drafts[card.id] = compileAgainstCurrent(
        scenario,
        state,
        card,
        authored,
        undefined
      );
    }
    index += 1;
  }
  return { ...state, hand, deckIndex: index, provenance, drafts };
}

/**
 * Fresh Card Table state: the first hand dealt against the study's current
 * snapshot, CPU replenished to the Blind's allocation. `history` carries
 * earlier Blinds' snapshot versions; without it the study starts at the
 * scenario's own snapshot. `inventory` is the tray, budget and hand levels
 * carried in; the Blind's granted seals, then its Guidance cards, fill any
 * free tray slots.
 */
export function createTableState(
  scenario: Scenario,
  history: StudyHistory = {
    snapshots: [scenario.populationSnapshot],
    invalidations: [],
  },
  inventory: Inventory = EMPTY_INVENTORY,
  crisis: CrisisCard | null = null
): TableState {
  const consumables = [...inventory.consumables];
  const grants: Consumable[] = [
    ...(scenario.consumables ?? []).map((seal): Consumable => ({
      id: `${seal.id}@${scenario.id}`,
      kind: "SEAL",
      seal,
    })),
    ...(scenario.guidance ?? []).map((guidance): Consumable => ({
      id: `${guidance.id}@${scenario.id}`,
      kind: "GUIDANCE",
      guidance,
    })),
  ];
  for (const grant of grants) {
    if (consumables.length >= CONSUMABLE_SLOTS) break;
    if (!consumables.some((c) => c.id === grant.id)) consumables.push(grant);
  }
  return refill(scenario, {
    scenarioId: scenario.id,
    deckIndex: 0,
    hand: [],
    selected: [],
    inspections: {},
    inspecting: null,
    cpu: cpuReducer(
      { available: 0, spent: 0 },
      {
        type: "REPLENISH",
        available:
          scenario.table.startingCpu + blindStartCpu(inventory.relics ?? []),
      }
    ),
    roundScore: 0,
    handsPlayed: 0,
    discards: 0,
    status: "REVIEWING",
    lastPlay: null,
    plays: [],
    lastEvent: null,
    snapshots: [...history.snapshots],
    invalidations: [...history.invalidations],
    provenance: {},
    drafts: {},
    allocations: {},
    seals: {},
    consumables,
    budget: inventory.budget,
    handLevels: inventory.handLevels ?? initialHandLevels(),
    crisis,
    crisisResolution: null,
    modifiers: [],
    auditLog: [],
    session: "OPEN",
    accessLog: [],
    structuralQc: [],
    unblinded: [],
    pendingViolations: [],
    stage: 0,
    stageScores: dmcDefenseOf(scenario)?.stages.map(() => 0) ?? [],
    clock: fdaIrOf(scenario)?.clockHours ?? null,
    answered: [],
    campaign: [...(inventory.campaign ?? [])],
    lock: null,
    amendments: 0,
    relics: [...(inventory.relics ?? [])],
    rewardClaimed: null,
    sites: [...(inventory.sites ?? [])],
    enrollments: [...(inventory.enrollments ?? [])],
    opening: {
      snapshots: history.snapshots.length,
      invalidations: history.invalidations.length,
      inventory,
      crisis,
    },
  });
}

/** The study history this state carries, for the next Blind. */
export function studyHistory(state: TableState): StudyHistory {
  return { snapshots: state.snapshots, invalidations: state.invalidations };
}

/** The tray, budget and hand levels this state carries, for the next Blind. */
export function carriedInventory(state: TableState): Inventory {
  return {
    consumables: state.consumables,
    budget: state.budget,
    handLevels: state.handLevels,
    relics: state.relics,
    sites: state.sites,
    enrollments: state.enrollments,
    campaign: state.campaign,
  };
}

/** Whether the next discard is one of the Blind's free discards (#924). */
function freeDiscardNow(state: TableState): boolean {
  return state.discards < freeDiscards(state.relics);
}

/** The ON_DISCARD relics that make a discard free, by name. */
function freeDiscardSources(state: TableState): string {
  return state.relics
    .filter((r) => r.trigger?.phase === "ON_DISCARD")
    .map((r) => r.name)
    .join(", ");
}

/** How many discards the CPU left pays for: the free ones first. */
function discardsAffordable(state: TableState, surcharge: number): number {
  let available = state.cpu.available;
  let count = 0;
  const free = Math.max(0, freeDiscards(state.relics) - state.discards);
  const freeCost = costOf("DISCARD", surcharge, true);
  for (let i = 0; i < free && available >= freeCost; i++) {
    available -= freeCost;
    count += 1;
  }
  return count + Math.floor(available / costOf("DISCARD", surcharge));
}

/** Removes the selected cards and pays for the action. Does not refill. */
function spendSelection(
  state: TableState,
  action: CpuAction,
  surcharge = 0,
  free = false
): TableState {
  const removed = new Set(state.selected);
  const keep = <T>(record: Record<string, T>) =>
    Object.fromEntries(
      Object.entries(record).filter(([id]) => !removed.has(id))
    );
  return {
    ...state,
    cpu: cpuReducer(state.cpu, { type: "SPEND", action, surcharge, free }),
    hand: state.hand.filter((id) => !removed.has(id)),
    selected: [],
    inspections: keep(state.inspections),
    provenance: keep(state.provenance),
    drafts: keep(state.drafts),
    allocations: keep(state.allocations),
    seals: keep(state.seals),
    structuralQc: state.structuralQc.filter((id) => !removed.has(id)),
    inspecting: null,
  };
}

/**
 * Applies the scenario's study events due after this many hands, and records
 * which cards in hand each transition staled. Returns the announcement.
 */
function applyStudyEvents(
  scenario: Scenario,
  state: TableState
): { state: TableState; message: string } {
  const due: StudyEvent[] = (scenario.events ?? []).filter(
    (event) => event.afterHands === state.handsPlayed
  );
  const enrolling =
    state.handsPlayed === ENROLLMENT_AFTER_HANDS ? state.enrollments : [];
  let next: TableState =
    enrolling.length > 0 ? { ...state, enrollments: [] } : state;
  const messages: string[] = [];
  for (const transition of [
    ...due.map((event) => event.transition),
    ...enrolling,
  ]) {
    const applied = transitionTable(scenario, next, transition);
    if (!applied) continue;
    next = applied.state;
    messages.push(applied.message);
  }
  return { state: next, message: messages.join(" ") };
}

/**
 * Applies one population transition to the table: a new snapshot version,
 * and a record of which cards in hand it staled. Null when the transition
 * changes no membership.
 */
function transitionTable(
  scenario: Scenario,
  state: TableState,
  transition: PopulationTransition
): { state: TableState; message: string } | null {
  const from = currentSnapshot(state);
  const outcome = applyTransition(from, transition);
  if (!outcome.ok) return null;
  let next: TableState = {
    ...state,
    snapshots: [...state.snapshots, outcome.snapshot],
  };
  const staleCardIds = next.hand.filter((id) => {
    const card = cardById(scenario, next, id) as TlfCard;
    return (
      outcome.changed.includes(card.population) && isStale(scenario, next, card)
    );
  });
  next = {
    ...next,
    invalidations: [
      ...next.invalidations,
      {
        transitionId: transition.id,
        subjectId: transition.subjectId,
        reason: transition.reason,
        change: transition.change,
        populations: outcome.changed,
        from: snapshotRef(from),
        to: snapshotRef(outcome.snapshot),
        staleCardIds,
      },
    ],
  };
  const names = staleCardIds.map((id) =>
    cardShortName(cardById(scenario, next, id) as TlfCard)
  );
  const populations = outcome.changed
    .map((p) => POPULATION_LABELS[p])
    .join(", ");
  return {
    state: next,
    message: `${transition.description} ${populations} population now ${outcome.snapshot.id}. ${
      names.length === 0
        ? "No output in hand is stale."
        : `Stale: ${names.join(", ")}.`
    }`,
  };
}

/**
 * A Clinical Hold once the clock no longer leaves time to play a hand with
 * questions still open; otherwise the state unchanged, with no outcome.
 */
function clinicalHold(
  scenario: Scenario,
  state: TableState
): { state: TableState; outcome: string } {
  const ir = fdaIrOf(scenario);
  if (!ir || state.clock === null || state.clock >= ir.hours.PLAY_HAND) {
    return { state, outcome: "" };
  }
  const open = ir.questions.length - state.answered.length;
  return {
    state: { ...state, status: "FAILED" },
    outcome: `${CLINICAL_HOLD}: the ${ir.clockHours}-hour response window closed with ${open} of ${ir.questions.length} question${ir.questions.length === 1 ? "" : "s"} unanswered. The program cannot proceed to Phase III.`,
  };
}

function settle(
  scenario: Scenario,
  state: TableState
): { state: TableState; outcome: string } {
  const encounter = dmcDefenseOf(scenario);
  const ir = fdaIrOf(scenario);
  const csr = csrLockOf(scenario);
  const defended = csr
    ? state.lock !== null
    : ir
      ? ir.questions.every((q) => state.answered.includes(q.id))
      : encounter
        ? encounter.stages.every(
            (stage, i) => state.stageScores[i] >= stage.quota
          )
        : state.roundScore >= scenario.blind.quota;
  if (defended) {
    return {
      state: {
        ...state,
        status: "CLEARED",
        campaign: [...state.campaign, campaignRecord(scenario, state)],
      },
      outcome: state.lock
        ? `${state.lock.packageName} LOCKED. The CSR is released: final campaign score ${state.lock.final.score}.`
        : encounter
          ? `${scenario.blind.name} defended. Choose an SOP relic.`
          : ir
            ? `${scenario.blind.name} answered with ${hoursText(state.clock ?? 0)} to spare.`
            : `${scenario.blind.name} cleared.`,
    };
  }
  const hold = clinicalHold(scenario, state);
  if (hold.outcome) return hold;
  const limit = handLimit(scenario, state);
  if (limit !== null && state.handsPlayed >= limit) {
    return {
      state: { ...state, status: "FAILED" },
      outcome: `${scenario.blind.name} failed: the ${limit}-hand limit is used up${csr ? " and the CSR package never locked" : ""}.`,
    };
  }
  if (!canAfford(state.cpu, "PLAY_HAND") || state.hand.length === 0) {
    return {
      state: { ...state, status: "FAILED" },
      outcome: `${scenario.blind.name} failed: no playable hands remain.`,
    };
  }
  return { state, outcome: "" };
}

/**
 * At or below this many hours the FDA clock is urgent (#921): time for one
 * last hand at most. Below a hand's hours nothing can be submitted, so the
 * Clinical Hold follows at once.
 */
export const CLOCK_URGENT_HOURS = 12;

/** How a lost FDA Information Request is announced: it ends the run. */
export const CLINICAL_HOLD = "Clinical Hold";

/** Actions still allowed while a crisis waits for an answer: none play the Blind. */
const CRISIS_SAFE_ACTIONS = new Set<TableAction["type"]>([
  "TOGGLE_SELECT",
  "MOVE_CARD",
  "SELL_CONSUMABLE",
  "USE_GUIDANCE",
  "CLOSE_INSPECT",
]);

/** The alert shown when Inspect meets a DMC firewall. */
export const FIREWALL_ALERT =
  "The DMC firewall hides treatment assignments: no output can be inspected this Blind.";

/** Why a crisis choice cannot be taken now, or null. */
function choiceRefusal(state: TableState, choice: CrisisChoice): string | null {
  const { cpu = 0, budget = 0, spendSeal } = choice.effect;
  if (cpu < 0 && state.cpu.available < -cpu) {
    return `Needs ${-cpu} CPU; ${state.cpu.available} left.`;
  }
  if (budget < 0 && state.budget < -budget) {
    return `Needs $${-budget}k study budget; $${state.budget}k left.`;
  }
  if (spendSeal && !state.consumables.some((c) => c.kind === "SEAL")) {
    return "Needs a footnote seal in the tray.";
  }
  return null;
}

/**
 * Answers the Blind's crisis. Every effect is deterministic: CPU and budget
 * change, a seal is granted or spent, a transition moves the snapshot (and
 * stales the matching outputs in hand), and a modifier joins the Blind's.
 */
function resolveCrisis(
  scenario: Scenario,
  state: TableState,
  choiceId: string
): TableState {
  const crisis = state.crisis;
  if (!crisis) return refuse(state, "There is no crisis to answer.");
  const choice = crisis.choices.find((c) => c.id === choiceId);
  if (!choice) {
    return refuse(state, `${crisis.name} has no such choice.`);
  }
  const why = choiceRefusal(state, choice);
  if (why) return refuse(state, `${choice.label}: ${why}`);
  const { effect } = choice;
  const notes: string[] = [];
  let next: TableState = {
    ...state,
    crisis: null,
    crisisResolution: { crisisId: crisis.id, choiceId: choice.id },
  };
  if (effect.cpu) {
    next = {
      ...next,
      cpu: cpuReducer(next.cpu, { type: "ADJUST", delta: effect.cpu }),
    };
  }
  if (effect.budget) next = { ...next, budget: next.budget + effect.budget };
  if (effect.spendSeal) {
    const spent = next.consumables.find((c) => c.kind === "SEAL") as Consumable;
    next = {
      ...next,
      consumables: next.consumables.filter((c) => c !== spent),
    };
    notes.push(`${consumableName(spent)} spent.`);
  }
  if (effect.grantSeal) {
    const id = `${effect.grantSeal.id}@${crisis.id}`;
    if (next.consumables.length < CONSUMABLE_SLOTS) {
      next = {
        ...next,
        consumables: [
          ...next.consumables,
          { id, kind: "SEAL", seal: effect.grantSeal },
        ],
      };
      notes.push(`${effect.grantSeal.name} added to the tray.`);
    } else {
      notes.push(`The tray is full, so ${effect.grantSeal.name} is lost.`);
    }
  }
  if (effect.modifier) {
    next = { ...next, modifiers: [...next.modifiers, effect.modifier] };
    notes.push(`${effect.modifier.name}: ${effect.modifier.description}`);
  }
  if (effect.transition) {
    const applied = transitionTable(scenario, next, effect.transition);
    if (applied) {
      next = applied.state;
      notes.push(applied.message);
    }
  }
  return {
    ...next,
    lastEvent: nextEvent(
      state,
      "CRISIS_RESOLVED",
      `${crisis.name}: ${choice.label}. ${choice.consequence}${notes.length ? ` ${notes.join(" ")}` : ""}`
    ),
  };
}

/**
 * Pure Card Table reducer. It composes the CPU reducer and the per-card
 * inspection logic shared with the QC Desk. Refused actions leave state
 * unchanged apart from the announced reason.
 */
export function advanceTable(
  scenario: Scenario,
  state: TableState,
  action: TableAction
): TableState {
  const next = applyTableAction(scenario, state, action);
  // The move that takes an FDA clock under the urgent line says so once.
  if (
    next.lastEvent &&
    next.status === "REVIEWING" &&
    state.clock !== null &&
    next.clock !== null &&
    state.clock > CLOCK_URGENT_HOURS &&
    next.clock <= CLOCK_URGENT_HOURS
  ) {
    return {
      ...next,
      lastEvent: {
        ...next.lastEvent,
        message: `${next.lastEvent.message} ${hoursText(next.clock)} left: the response is due soon.`,
      },
    };
  }
  return next;
}

function applyTableAction(
  scenario: Scenario,
  state: TableState,
  action: TableAction
): TableState {
  if (action.type === "RESET") {
    return {
      ...createTableState(
        scenario,
        {
          snapshots: state.snapshots.slice(0, state.opening.snapshots),
          invalidations: state.invalidations.slice(
            0,
            state.opening.invalidations
          ),
        },
        state.opening.inventory,
        state.opening.crisis
      ),
      lastEvent: nextEvent(state, "RESET", `${scenario.blind.name} restarted.`),
    };
  }
  if (action.type === "CLAIM_RELIC") {
    const rewards = dmcDefenseOf(scenario)?.rewards ?? [];
    if (state.status !== "CLEARED" || rewards.length === 0) {
      return refuse(state, "No relic is on offer.");
    }
    if (state.rewardClaimed) {
      const taken = rewards.find((r) => r.id === state.rewardClaimed);
      return refuse(state, `You already took ${taken?.name ?? "a relic"}.`);
    }
    const relic = rewards.find((r) => r.id === action.relicId);
    if (!relic) return refuse(state, "That relic is not on offer.");
    if (state.relics.length >= RELIC_SLOTS) {
      return refuse(state, RELIC_RACK_FULL);
    }
    return {
      ...state,
      relics: [...state.relics, relic],
      rewardClaimed: relic.id,
      lastEvent: nextEvent(
        state,
        "RELIC_CLAIMED",
        `${relic.name} joins your relics: ${relic.description}`
      ),
    };
  }
  if (action.type === "AMEND_PROTOCOL") {
    const refusal = amendRefusal(scenario, state);
    const lock = state.lock;
    if (refusal || !lock) return refuse(state, refusal as string);
    const reopened = new Set(lock.outputs.map((o) => o.cardId));
    const inspections = Object.fromEntries(
      Object.entries(lock.before.inspections).filter(
        ([id]) => !reopened.has(id)
      )
    );
    const amendments = state.amendments + 1;
    return {
      ...lock.before,
      selected: [],
      inspecting: null,
      inspections,
      amendments,
      lastEvent: nextEvent(
        state,
        "AMENDED",
        `Protocol Amendment ${amendments} filed: ${lock.packageName} is unlocked and the lock hand withdrawn. ${lock.outputs.map((o) => o.name).join(", ")} must be validated again before the package can lock.`
      ),
    };
  }
  if (state.lock) return refuse(state, LOCKED_ALERT);
  if (state.status !== "REVIEWING") {
    return refuse(state, "The Blind is over. Restart to play again.");
  }
  if (action.type === "RESOLVE_CRISIS") {
    return resolveCrisis(scenario, state, action.choiceId);
  }
  if (state.crisis && !CRISIS_SAFE_ACTIONS.has(action.type)) {
    return refuse(state, crisisAlert(state.crisis));
  }

  switch (action.type) {
    case "MOVE_CARD": {
      const from = state.hand.indexOf(action.cardId);
      if (from === -1) return refuse(state, "That card is not in your hand.");
      const to = Math.max(
        0,
        Math.min(state.hand.length - 1, Math.trunc(action.toIndex) || 0)
      );
      const card = cardById(scenario, state, action.cardId) as TlfCard;
      if (to === from) {
        const where =
          to === 0
            ? "first"
            : to === state.hand.length - 1
              ? "last"
              : `at position ${to + 1}`;
        return refuse(state, `${card.number} is already ${where} in the hand.`);
      }
      const hand = [...state.hand];
      hand.splice(from, 1);
      hand.splice(to, 0, action.cardId);
      return {
        ...state,
        hand,
        lastEvent: nextEvent(
          state,
          "MOVED",
          `${card.number} moved to position ${to + 1} of ${hand.length}.`
        ),
      };
    }

    case "TOGGLE_SELECT": {
      const card = cardById(scenario, state, action.cardId);
      if (!card || !state.hand.includes(card.id)) {
        return refuse(state, "That card is not in your hand.");
      }
      const isSelected = state.selected.includes(card.id);
      if (!isSelected && state.selected.length >= scenario.table.maxSelection) {
        return refuse(
          state,
          `You can select up to ${scenario.table.maxSelection} cards.`
        );
      }
      const selected = isSelected
        ? state.selected.filter((id) => id !== card.id)
        : [...state.selected, card.id];
      const classification = classifyHand(
        selected.map((id) => classifiable(scenario, state, id)),
        stageHands(scenario, state)
      );
      const summary = classification
        ? `${selected.length} selected: ${handName(classification.handType)}.`
        : "Nothing selected.";
      return {
        ...state,
        selected,
        lastEvent: nextEvent(
          state,
          isSelected ? "DESELECTED" : "SELECTED",
          `${isSelected ? "Deselected" : "Selected"} ${label(card)}. ${summary}`
        ),
      };
    }

    case "PLAY_HAND": {
      const found = classifyHand(
        state.selected.map((id) => classifiable(scenario, state, id)),
        stageHands(scenario, state)
      );
      const blocked = playBlocker(scenario, state, found);
      if (blocked) return refuse(state, blocked.reason);
      const classification = found as HandClassification;
      const stage = dmcDefenseOf(scenario)?.stages[state.stage];
      const scoring = classification.scoringCardIds.map(
        (id) => cardById(scenario, state, id) as TlfCard
      );
      const evaluation = scoreCards(
        scenario,
        state,
        scoring,
        classification.handType,
        false
      );
      const played: PlayedHand = {
        classification,
        evaluation,
        cardIds: [...state.selected],
      };
      const answers = answeredBy(
        scenario,
        state,
        classification.scoringCardIds,
        evaluation.score
      );
      // The study event lands between the hand being submitted and the inbox
      // refilling, so new drafts compile against the new snapshot and the
      // cards still in hand go stale.
      const { state: changed, message: news } = applyStudyEvents(
        scenario,
        spendSelection(
          tick(
            scenario,
            {
              ...state,
              roundScore: state.roundScore + evaluation.score,
              handsPlayed: state.handsPlayed + 1,
              // The violation is answered for by this hand's ×0.
              pendingViolations: [],
              ...(stage ? advanceStage(scenario, state, evaluation.score) : {}),
              handLevels: {
                ...state.handLevels,
                [classification.handType]: {
                  ...state.handLevels[classification.handType],
                  playedCount:
                    state.handLevels[classification.handType].playedCount + 1,
                },
              },
              lastPlay: played,
              plays: [...state.plays, played],
              answered: [...state.answered, ...answers.map((q) => q.id)],
            },
            "PLAY_HAND"
          ),
          "PLAY_HAND"
        )
      );
      const refilled = refill(scenario, changed);
      const locking =
        csrLockOf(scenario) !== undefined &&
        classification.handType === "CSR_STRAIGHT";
      const { state: settled, outcome } = settle(
        scenario,
        locking
          ? {
              ...refilled,
              lock: packageLock(scenario, state, refilled, played),
            }
          : refilled
      );
      const zero = evaluation.zeroRule.triggered
        ? " Zero-score rule triggered."
        : "";
      const defended =
        stage && settled.stage > state.stage && settled.status === "REVIEWING"
          ? ` ${stage.name} defended: convene the closed session for ${dmcDefenseOf(scenario)?.stages[settled.stage].name}.`
          : "";
      const answeredText =
        answers.length > 0
          ? ` Answered: ${answers.map((q) => q.question).join("; ")}.`
          : "";
      const clockText =
        settled.clock !== null && settled.status === "REVIEWING"
          ? ` ${hoursText(settled.clock)} left.`
          : "";
      return {
        ...settled,
        lastEvent: nextEvent(
          state,
          "PLAYED",
          `${handName(classification.handType)} scored ${evaluation.score} (${evaluation.chips.total} Chips × ${evaluation.finalMult} Mult).${zero} Round ${settled.roundScore} of ${scenario.blind.quota}.${defended}${answeredText}${clockText}${outcome ? ` ${outcome}` : ""}${news ? ` ${news}` : ""}`
        ),
      };
    }

    case "DISCARD": {
      if (state.selected.length === 0) {
        return refuse(state, "Select at least one card to discard.");
      }
      const surcharge = discardSurcharge(scenario, state);
      const free = freeDiscardNow(state);
      if (!canAfford(state.cpu, "DISCARD", surcharge, free)) {
        return refuse(
          state,
          `Discard needs ${costOf("DISCARD", surcharge, free)} CPU.`
        );
      }
      const late = clockRefusal(scenario, state, "DISCARD", "Discard");
      if (late) return refuse(state, late);
      const count = state.selected.length;
      const { state: settled, outcome } = settle(
        scenario,
        refill(
          scenario,
          spendSelection(
            tick(
              scenario,
              { ...state, discards: state.discards + 1 },
              "DISCARD"
            ),
            "DISCARD",
            surcharge,
            free
          )
        )
      );
      return {
        ...settled,
        lastEvent: nextEvent(
          state,
          "DISCARDED",
          `Discarded ${count} card${count === 1 ? "" : "s"}.${free ? ` ${freeDiscardSources(state)}: a free discard.` : ""}${settled.clock !== null && settled.status === "REVIEWING" ? ` ${hoursText(settled.clock)} left.` : ""}${outcome ? ` ${outcome}` : ""}`
        ),
      };
    }

    case "INSPECT_CARD": {
      const card = cardById(scenario, state, action.cardId);
      if (!card || !state.hand.includes(card.id)) {
        return refuse(state, "That card is not in your hand.");
      }
      if (firewallUp(scenario, state)) {
        return refuse(state, FIREWALL_ALERT);
      }
      if (isFaceDown(scenario, state, card)) {
        return refuse(state, faceDownAlert(card));
      }
      if (isBlank(state, card)) {
        return refuse(
          state,
          `${cardShortName(card)} is an empty shell: allocate an analysis set to compile it first.`
        );
      }
      if (!draftFor(scenario, state, card) && !card.km) {
        return refuse(
          state,
          `${label(card)} has no reviewable cells in this slice.`
        );
      }
      if (state.inspections[card.id]) {
        return {
          ...state,
          inspecting: card.id,
          lastEvent: nextEvent(
            state,
            "INSPECT_OPENED",
            `Inspecting ${label(card)}.`
          ),
        };
      }
      if (!canAfford(state.cpu, "INSPECT")) {
        return refuse(state, `Inspect needs ${CPU_COSTS.INSPECT} CPU.`);
      }
      const late = clockRefusal(scenario, state, "INSPECT", "Inspect");
      if (late) return refuse(state, late);
      const { state: held, outcome } = clinicalHold(
        scenario,
        tick(
          scenario,
          {
            ...state,
            cpu: cpuReducer(state.cpu, { type: "SPEND", action: "INSPECT" }),
            inspections: {
              ...state.inspections,
              [card.id]: createInspectionState(),
            },
            inspecting: card.id,
          },
          "INSPECT"
        )
      );
      return {
        ...held,
        lastEvent: nextEvent(
          state,
          "INSPECT_OPENED",
          `Inspecting ${label(card)} for ${CPU_COSTS.INSPECT} CPU${held.clock === null ? "" : ` and ${hoursTaken(scenario, held, "INSPECT")}`}.${outcome ? ` ${outcome}` : ""}`
        ),
      };
    }

    case "STRUCTURAL_QC": {
      const card = cardById(scenario, state, action.cardId);
      if (!card || !state.hand.includes(card.id)) {
        return refuse(state, "That card is not in your hand.");
      }
      if (!isFaceDown(scenario, state, card)) {
        return refuse(
          state,
          `${cardShortName(card)} is face up: inspect it instead.`
        );
      }
      if (card.km) {
        return refuse(
          state,
          `${cardShortName(card)} is drawn from a closed-session table: it turns face up with the closed session.`
        );
      }
      const draft = draftFor(scenario, state, card);
      if (!draft) {
        return refuse(
          state,
          `${cardShortName(card)} is an empty shell: allocate an analysis set to compile it first.`
        );
      }
      const report = structuralQc(
        draft,
        shellById(scenario, card.shellId ?? draft.shellId)
      );
      const summary = `${report.checks.filter((c) => c.passed).length} of ${report.checks.length} structural checks pass.${report.checks
        .filter((c) => !c.passed)
        .map((c) => ` ${c.label}: ${c.detail}`)
        .join("")}`;
      if (state.structuralQc.includes(card.id)) {
        return {
          ...state,
          lastEvent: nextEvent(
            state,
            "STRUCTURAL_QC",
            `${cardShortName(card)}: ${summary}`
          ),
        };
      }
      if (!canAfford(state.cpu, "INSPECT")) {
        return refuse(state, `Structural QC needs ${CPU_COSTS.INSPECT} CPU.`);
      }
      const late = clockRefusal(scenario, state, "INSPECT", "Structural QC");
      if (late) return refuse(state, late);
      const { state: held, outcome } = clinicalHold(
        scenario,
        tick(scenario, state, "INSPECT")
      );
      return {
        ...held,
        cpu: cpuReducer(state.cpu, { type: "SPEND", action: "INSPECT" }),
        structuralQc: [...state.structuralQc, card.id],
        accessLog: withAccess(
          state,
          "STRUCTURAL_QC",
          card.id,
          true,
          `Structural QC of ${cardShortName(card)} across the firewall: ${summary}`
        ),
        lastEvent: nextEvent(
          state,
          "STRUCTURAL_QC",
          `Structural QC of ${cardShortName(card)} for ${CPU_COSTS.INSPECT} CPU${held.clock === null ? "" : ` and ${hoursTaken(scenario, held, "INSPECT")}`}, no values read: ${summary}${outcome ? ` ${outcome}` : ""}`
        ),
      };
    }

    case "PEEK_BLINDED": {
      const card = cardById(scenario, state, action.cardId);
      if (!card || !state.hand.includes(card.id)) {
        return refuse(state, "That card is not in your hand.");
      }
      if (!isFaceDown(scenario, state, card)) {
        return refuse(state, `${cardShortName(card)} is not face down.`);
      }
      const text = `Unauthorized unblinding of ${cardShortName(card)} in the open session. Audit finding logged; the next hand played scores ×0 Mult.`;
      return {
        ...state,
        unblinded: [...state.unblinded, card.id],
        pendingViolations: [...state.pendingViolations, card.id],
        accessLog: withAccess(
          state,
          "UNAUTHORIZED_UNBLINDING",
          card.id,
          false,
          text
        ),
        lastEvent: nextEvent(state, "UNBLINDED", text),
      };
    }

    case "SET_SESSION": {
      const refusal = sessionRefusal(scenario, state, action.session);
      if (refusal) return refuse(state, refusal);
      const withdrawn = sessionDependents(scenario, state).filter(
        (id) => state.inspections[id]
      );
      const inspections = Object.fromEntries(
        Object.entries(state.inspections).filter(
          ([id]) => !withdrawn.includes(id)
        )
      );
      const count = blindedInHand(scenario, state).length;
      const plural = count === 1 ? "" : "s";
      const withdrawnText =
        withdrawn.length > 0
          ? ` Reviews withdrawn: ${withdrawn
              .map((id) =>
                cardShortName(cardById(scenario, state, id) as TlfCard)
              )
              .join(", ")}.`
          : "";
      const text =
        action.session === "CLOSED"
          ? `Closed DMC session convened under ${scenario.dmc?.charter}: ${count} blinded output${plural} revealed.${withdrawnText}`
          : `Returned to the open session: ${count} blinded output${plural} face down again.${withdrawnText}`;
      const moved: TableState = { ...state, session: action.session };
      return {
        ...moved,
        inspections,
        inspecting:
          state.inspecting && withdrawn.includes(state.inspecting)
            ? null
            : state.inspecting,
        accessLog: withAccess(
          moved,
          action.session === "CLOSED" ? "SESSION_CLOSED" : "SESSION_OPENED",
          null,
          true,
          text
        ),
        lastEvent: nextEvent(state, "SESSION_CHANGED", text),
      };
    }

    case "RECOMPILE": {
      const card = cardById(scenario, state, action.cardId);
      if (!card || !state.hand.includes(card.id)) {
        return refuse(state, "That card is not in your hand.");
      }
      const current = currentSnapshot(state);
      if (!isStale(scenario, state, card)) {
        return refuse(
          state,
          `${card.number} is current with ${current.id}; nothing to recompile.`
        );
      }
      if (!canAfford(state.cpu, "RECOMPILE")) {
        return refuse(state, `Recompile needs ${CPU_COSTS.RECOMPILE} CPU.`);
      }
      const draft = draftFor(scenario, state, card);
      const { [card.id]: _review, ...inspections } = state.inspections;
      return {
        ...state,
        cpu: cpuReducer(state.cpu, { type: "SPEND", action: "RECOMPILE" }),
        provenance: { ...state.provenance, [card.id]: snapshotRef(current) },
        drafts: draft
          ? {
              ...state.drafts,
              [card.id]: compileAgainstCurrent(
                scenario,
                state,
                card,
                draft,
                state.inspections[card.id]
              ),
            }
          : state.drafts,
        // A recompiled output is a new output: its review starts over, and
        // its traces describe the old one.
        inspections,
        auditLog: state.auditLog.map((e) =>
          e.cardId === card.id ? { ...e, superseded: true } : e
        ),
        inspecting: state.inspecting === card.id ? null : state.inspecting,
        lastEvent: nextEvent(
          state,
          "RECOMPILED",
          `Recompiled ${label(card)} against ${current.id} for ${CPU_COSTS.RECOMPILE} CPU.${draft ? " Inspect it again to verify the rerun." : ""}`
        ),
      };
    }

    case "ALLOCATE": {
      const card = cardById(scenario, state, action.cardId);
      if (!card || !state.hand.includes(card.id)) {
        return refuse(state, "That card is not in your hand.");
      }
      const shell = shellById(scenario, card.shellId);
      if (!shell?.layout) {
        return refuse(
          state,
          `${cardShortName(card)} is already compiled; only a blank shell takes an allocation.`
        );
      }
      const allocated = state.allocations[card.id];
      if (allocated) {
        return refuse(
          state,
          `${cardShortName(card)} is already compiled on the ${POPULATION_LABELS[allocated]} population. Allocation is final: recompile it if the data moves.`
        );
      }
      const compatible = compatibleWith(shell);
      const set = POPULATION_LABELS[action.population];
      if (!compatible.includes(action.population)) {
        return refuse(
          state,
          `${cardShortName(card)} cannot be built on the ${set} population: its shell accepts ${compatible.map((p) => POPULATION_LABELS[p]).join(", ")}.`
        );
      }
      const current = currentSnapshot(state);
      const subjects = membership(current, action.population).length;
      if (subjects === 0) {
        return refuse(
          state,
          `The ${set} population is empty in ${current.id}. ${EMPTY_SHELL_ALERT}`
        );
      }
      const draft = compileShell(
        { ...shell, layout: shell.layout },
        `${shell.id}@${card.id}`,
        current,
        { ...scenario.rulebook, populationSuit: action.population }
      );
      return {
        ...state,
        allocations: { ...state.allocations, [card.id]: action.population },
        drafts: { ...state.drafts, [card.id]: draft },
        provenance: { ...state.provenance, [card.id]: snapshotRef(current) },
        lastEvent: nextEvent(
          state,
          "ALLOCATED",
          `Allocated ${set} data (N=${subjects}, ${current.id}) to ${card.number}. It compiled as a ${set} output.`
        ),
      };
    }

    case "APPLY_SEAL": {
      const item = state.consumables.find((c) => c.id === action.consumableId);
      if (!item)
        return refuse(state, "That footnote seal is not in your tray.");
      if (item.kind !== "SEAL") {
        return refuse(
          state,
          `${item.guidance.name} is a Guidance card: use it to level up ${handName(item.guidance.handType)}.`
        );
      }
      const card = cardById(scenario, state, action.cardId);
      if (!card || !state.hand.includes(card.id)) {
        return refuse(state, "That card is not in your hand.");
      }
      const why = sealRefusal(scenario, state, card, item.seal);
      if (why) return refuse(state, why);
      const { seal } = item;
      return {
        ...state,
        consumables: state.consumables.filter((c) => c.id !== item.id),
        seals: {
          ...state.seals,
          [card.id]: [...(state.seals[card.id] ?? []), seal],
        },
        lastEvent: nextEvent(
          state,
          "SEALED",
          `Sealed ${cardShortName(card)} with ${seal.name}: ${sealEffectText(scenario, state, card, seal)}. Footnote: "${seal.footnote}"`
        ),
      };
    }

    case "SELL_CONSUMABLE": {
      const item = state.consumables.find((c) => c.id === action.consumableId);
      if (!item) return refuse(state, "That consumable is not in your tray.");
      const value = consumableSellValue(item);
      const budget = state.budget + value;
      return {
        ...state,
        consumables: state.consumables.filter((c) => c.id !== item.id),
        budget,
        lastEvent: nextEvent(
          state,
          "SOLD",
          `Sold ${consumableName(item)} for $${value}k. Study budget $${budget}k.`
        ),
      };
    }

    case "USE_GUIDANCE": {
      const item = state.consumables.find((c) => c.id === action.consumableId);
      if (!item || item.kind !== "GUIDANCE") {
        return refuse(state, "That Guidance card is not in your tray.");
      }
      const { guidance } = item;
      const { handType } = guidance;
      const current = state.handLevels[handType];
      const before = leveledBase(handType, current.level);
      const after = leveledBase(handType, current.level + 1);
      const levelUp: LevelUp = {
        guidanceId: guidance.id,
        guidanceName: guidance.name,
        handType,
        from: {
          level: current.level,
          chips: before.baseChips,
          mult: before.baseMult,
        },
        to: {
          level: current.level + 1,
          chips: after.baseChips,
          mult: after.baseMult,
        },
      };
      return {
        ...state,
        consumables: state.consumables.filter((c) => c.id !== item.id),
        handLevels: {
          ...state.handLevels,
          [handType]: { ...current, level: current.level + 1 },
        },
        lastEvent: {
          ...nextEvent(
            state,
            "LEVELED_UP",
            `${guidance.name}: ${handName(handType)} levelled up to Lv.${levelUp.to.level}. Base ${levelUp.to.chips} Chips, +${levelUp.to.mult} Mult.`
          ),
          levelUp,
        },
      };
    }

    case "CLOSE_INSPECT": {
      if (state.inspecting === null) return state;
      return {
        ...state,
        inspecting: null,
        lastEvent: nextEvent(state, "INSPECT_CLOSED", "Inspect closed."),
      };
    }

    case "INSPECT_CELL":
    case "CORRECT_FINDING": {
      const card = state.inspecting
        ? cardById(scenario, state, state.inspecting)
        : undefined;
      if (card?.km) {
        if (action.type === "INSPECT_CELL") {
          return refuse(
            state,
            `${cardShortName(card)} is a figure: inspecting it revealed every check at once.`
          );
        }
        const report = kmReportFor(scenario, state, card) as KmReport;
        const current = state.inspections[card.id];
        const target = report.findings.find((f) => f.id === action.findingId);
        if (!target || current.resolvedFindingIds.includes(target.id)) {
          return refuse(state, "That Kaplan–Meier finding is not open.");
        }
        const inspection = {
          ...current,
          resolvedFindingIds: [...current.resolvedFindingIds, target.id],
        };
        const next = {
          ...state,
          inspections: { ...state.inspections, [card.id]: inspection },
        };
        const status = figureStatus(scenario, next, card) as FigureStatus;
        return {
          ...next,
          lastEvent: nextEvent(
            state,
            "CORRECTED",
            `Reconciled ${target.check.replaceAll("_", " ").toLowerCase()} for ${target.arm === "PLACEBO" ? "Placebo" : "Active"}: ${target.observed} to ${target.expected}.${status.active ? ` ${cardShortName(card)} ×${KM_SYNERGY} Mult is live.` : ""}`
          ),
        };
      }
      const draft = card ? draftFor(scenario, state, card) : undefined;
      if (!card || !draft) {
        return refuse(state, "Open a card's Inspect view first.");
      }
      const report = reportFor(scenario, state, card, draft);
      const current = state.inspections[card.id];
      const outcome =
        action.type === "INSPECT_CELL"
          ? inspectCell(draft, report, current, action.row, action.col)
          : correctFinding(report, current, action.findingId);
      if (!outcome.ok) return refuse(state, outcome.message);
      const resolved = new Set(outcome.inspection.resolvedFindingIds);
      return {
        ...state,
        inspections: { ...state.inspections, [card.id]: outcome.inspection },
        auditLog: state.auditLog.map((e) =>
          e.cardId === card.id && !e.superseded
            ? {
                ...e,
                resolution: e.findingIds.every((id) => resolved.has(id))
                  ? "RESOLVED"
                  : "OPEN",
              }
            : e
        ),
        lastEvent: nextEvent(
          state,
          action.type === "INSPECT_CELL" ? "INSPECTED" : "CORRECTED",
          outcome.message
        ),
      };
    }

    case "TRACE_CELL": {
      const card = state.inspecting
        ? cardById(scenario, state, state.inspecting)
        : undefined;
      const draft = card ? draftFor(scenario, state, card) : undefined;
      const inspection = card ? state.inspections[card.id] : undefined;
      if (!card || !draft || !inspection) {
        return refuse(state, "Open a card's Inspect view first.");
      }
      const { listing, blocked } = traceTarget(scenario, state, card, draft);
      if (!listing || blocked) return refuse(state, blocked as string);
      const report = reportFor(scenario, state, card, draft);
      const revealed = new Set(visibleFindingIds(report, inspection));
      const flagged = report.findings.filter(
        (f) =>
          f.cell.row === action.row &&
          f.cell.col === action.col &&
          revealed.has(f.id)
      );
      if (flagged.length === 0) {
        return refuse(
          state,
          "Only a flagged cell can be traced: inspect it and reveal a redline first."
        );
      }
      const trace = traceCell(
        draft,
        snapshotById(scenario, state, draft.populationSnapshotId),
        rulebookFor(scenario, state, card),
        action.row,
        action.col
      ) as CellTrace;
      const where = `${draft.rows[action.row].label}, ${draft.columns[action.col].label}`;
      const traced = tracesOf(state, card.id, listing.id).some(
        (e) => e.cell.row === action.row && e.cell.col === action.col
      );
      const record: TraceRecord = {
        cardId: card.id,
        listingId: listing.id,
        cell: { row: action.row, col: action.col },
        findingIds: flagged.map((f) => f.id),
        subjectIds: trace.rows.map((r) => r.usubjid),
        matchedSubjectIds: trace.matchedSubjectIds,
        snapshotId: trace.snapshotId,
        resolution: flagged.every((f) =>
          inspection.resolvedFindingIds.includes(f.id)
        )
          ? "RESOLVED"
          : "OPEN",
        superseded: false,
      };
      // Re-reading a trace already in the audit log takes no time.
      const late = traced
        ? null
        : clockRefusal(scenario, state, "TRACE", "Trace");
      if (late) return refuse(state, late);
      const { state: held, outcome } = traced
        ? { state, outcome: "" }
        : clinicalHold(scenario, tick(scenario, state, "TRACE"));
      const n = trace.matchedSubjectIds.length;
      return {
        ...held,
        auditLog: traced ? state.auditLog : [...state.auditLog, record],
        lastEvent: nextEvent(
          state,
          "TRACED",
          `Traced ${where} of ${cardShortName(card)} to ${listing.number} on ${trace.snapshotId}: ${n} of ${trace.rows.length} subject row${trace.rows.length === 1 ? "" : "s"} counted${n > 0 ? ` (${trace.matchedSubjectIds.join(", ")})` : ""}.${traced || held.clock === null ? "" : ` Took ${hoursTaken(scenario, held, "TRACE")}.`}${outcome ? ` ${outcome}` : ""}`
        ),
      };
    }
  }
}

/** What the score timeline needs from the scenario to narrate a hand. */
function timelineContext(
  scenario: Scenario,
  state: TableState,
  roundScoreBefore: number
): TimelineContext {
  return {
    roundScoreBefore,
    target: scenario.blind.quota,
    cardNames: Object.fromEntries(scenario.deck.map((c) => [c.id, c.number])),
    relicNames: Object.fromEntries(
      [...state.relics, ...state.sites].map((r) => [r.id, r.name])
    ),
    zeroRuleLabels: Object.fromEntries(
      scenario.rulebook.rules
        .filter((r) => r.severity === "FATAL")
        .map((r): [string, string] => [r.id, `${r.category} ERROR`])
        .concat([[UNBLINDING_RULE_ID, "UNBLINDING"]])
    ),
  };
}

const signedPart = (n: number, unit: string) =>
  n ? `${n > 0 ? "+" : ""}${n} ${unit}` : "";

/** The timeline's RULE, RELIC, X_MULT and ZERO_RULE steps as log effects. */
function firedEffects(steps: readonly TimelineStep[]): ScoreLogEffect[] {
  return steps.flatMap((step): ScoreLogEffect[] => {
    switch (step.kind) {
      case "RULE":
        return [
          {
            kind: "RULE",
            label: step.ruleId,
            effect: [
              signedPart(step.chipsDelta, "Chips"),
              signedPart(step.multDelta, "Mult"),
            ]
              .filter(Boolean)
              .join(", "),
          },
        ];
      case "RELIC":
        return [
          {
            kind: "RELIC",
            label: step.cardId
              ? `${step.relicId} · ${step.cardId}`
              : step.relicId,
            effect:
              [
                signedPart(step.chips, "Chips"),
                signedPart(step.mult, "Mult"),
                step.xMult !== 1 ? `×${step.xMult} Mult` : "",
              ]
                .filter(Boolean)
                .join(", ") || "no effect",
          },
        ];
      case "X_MULT":
        return [
          {
            kind: "X_MULT",
            label: step.source,
            effect: `×${step.factor} Mult`,
          },
        ];
      case "ZERO_RULE":
        return [{ kind: "ZERO_RULE", label: step.label, effect: "×0" }];
      default:
        return [];
    }
  });
}

/**
 * The Blind's score log: each play read through the same timeline the
 * playback shows, so the two cannot disagree. Rule evidence is left out, so
 * no closed-session value reaches the log.
 */
function scoreLogOf(scenario: Scenario, state: TableState): ScoreLogEntry[] {
  let before = 0;
  return state.plays.map(({ evaluation }) => {
    const steps = scoreTimeline(
      evaluation,
      timelineContext(scenario, state, before)
    );
    before += evaluation.score;
    const zero = steps.find((step) => step.kind === "ZERO_RULE");
    return {
      handType: evaluation.handType,
      name: HAND_NAMES[evaluation.handType],
      level: evaluation.level,
      chips: evaluation.chips.total,
      mult: evaluation.finalMult,
      score: evaluation.score,
      fired: firedEffects(steps),
      zeroLabel: zero?.kind === "ZERO_RULE" ? zero.label : null,
    };
  });
}

/** Derives everything the Card Table renders. Pure; safe on every render. */
export function deriveTableView(
  scenario: Scenario,
  state: TableState
): TableView {
  const selected = new Set(state.selected);
  const firewall = firewallUp(scenario, state);
  const hand = state.hand.map((id): TableCardView => {
    const card = cardById(scenario, state, id) as TlfCard;
    const draft = draftFor(scenario, state, card);
    const inspection = state.inspections[id];
    const review =
      draft && inspection
        ? deriveInspectionView(
            draft,
            reportFor(scenario, state, card, draft),
            inspection
          )
        : null;
    const shell = shellById(scenario, card.shellId ?? draft?.shellId);
    const km = kmReportFor(scenario, state, card);
    // Inspecting a KM figure reveals every one of its findings.
    const openRedlines = km
      ? inspection
        ? km.findings.filter(
            (f) => !inspection.resolvedFindingIds.includes(f.id)
          ).length
        : 0
      : (review?.openFindings.length ?? 0);
    const stale = isStale(scenario, state, card);
    const blinded = isBlindedCard(scenario, state, card);
    const faceDown = isFaceDown(scenario, state, card);
    const stamps: CardStamp[] = [];
    if (faceDown) stamps.push("BLINDED");
    if (stale) stamps.push("STALE");
    if (openRedlines > 0) stamps.push("REDLINE");
    if (
      qcPassed(review, km !== null && inspection !== undefined, openRedlines)
    ) {
      stamps.push("QC_PASS");
    }
    const face = card.km
      ? kmFace(scenario, state, card)
      : faceFor(card, draft, review, shell);
    const reviewable = draft !== undefined || km !== null;
    const structural =
      blinded && draft && state.structuralQc.includes(id)
        ? structuralQc(draft, shell)
        : null;
    return {
      // Face down, or under a firewall, the values are absent from the view
      // itself, including the card's own authored face.
      card: faceDown
        ? { ...card, face: undefined, km: undefined }
        : firewall && card.face
          ? { ...card, face: firewalled(card.face, undefined) }
          : card,
      selected: selected.has(id),
      inspectable: reviewable && !faceDown,
      inspected: inspection !== undefined,
      unverified: faceDown
        ? reviewable && structural === null
        : reviewable && inspection === undefined,
      openRedlines,
      face: faceDown
        ? redactedFace(face)
        : firewall
          ? firewalled(face, draft)
          : face,
      stamps,
      debuffed: disablingModifier(scenario, state, card) !== undefined,
      stale,
      provenance: provenanceOf(state, card),
      blank: isBlank(state, card),
      compatiblePopulations: shell ? compatibleWith(shell) : [],
      seals: state.seals[id] ?? [],
      footnoteSlots: footnoteSlotsOf(scenario, state, card),
      pairedWith: pairPartners(scenario, state, card).map((c) => c.id),
      figure: figureStatus(scenario, state, card),
      blinded,
      faceDown,
      structural,
    };
  });

  const selectedCards = state.selected.map((id) =>
    classifiable(scenario, state, id)
  );
  const emptySelected = state.selected.filter((id) =>
    isBlank(state, cardById(scenario, state, id) as TlfCard)
  );
  const accepts = stageHands(scenario, state);
  const dmc = dmcDefenseOf(scenario);
  const ir = fdaIrOf(scenario);
  const csr = csrLockOf(scenario);
  const classification = classifyHand(selectedCards, accepts);
  const blocked = playBlocker(scenario, state, classification);
  const preview = classification
    ? scoreCards(
        scenario,
        state,
        classification.scoringCardIds.map(
          (id) => cardById(scenario, state, id) as TlfCard
        ),
        classification.handType,
        true
      )
    : null;
  const empty = new Set(emptySelected);
  const staleSelected = selectedCards
    .filter((c) => c.stale && !empty.has(c.id))
    .map((c) => c.id);
  // Only staleness is lifted here: an empty shell still breaks the flush.
  const flushBrokenBy =
    staleSelected.length > 0 &&
    classification?.handType !== "POPULATION_FLUSH" &&
    classifyHand(
      selectedCards.map((c) => ({ ...c, stale: empty.has(c.id) })),
      accepts
    )?.handType === "POPULATION_FLUSH"
      ? staleSelected
      : [];

  let inspection: TableInspectionView | null = null;
  const inspectingCard = state.inspecting
    ? cardById(scenario, state, state.inspecting)
    : undefined;
  const inspectingDraft = inspectingCard
    ? draftFor(scenario, state, inspectingCard)
    : undefined;
  if (
    inspectingCard &&
    inspectingDraft &&
    state.inspections[inspectingCard.id]
  ) {
    const report = reportFor(scenario, state, inspectingCard, inspectingDraft);
    const expected = scoreCards(
      scenario,
      state,
      [inspectingCard],
      "HIGH_TABLE",
      true
    );
    const target = traceTarget(
      scenario,
      state,
      inspectingCard,
      inspectingDraft
    );
    const log = tracesOf(state, inspectingCard.id);
    const traceSnapshot = snapshotById(
      scenario,
      state,
      inspectingDraft.populationSnapshotId
    );
    const cells: Record<string, CellTrace> = {};
    for (const entry of log) {
      const key = `${entry.cell.row}:${entry.cell.col}`;
      cells[key] ??= traceCell(
        inspectingDraft,
        traceSnapshot,
        rulebookFor(scenario, state, inspectingCard),
        entry.cell.row,
        entry.cell.col
      ) as CellTrace;
    }
    inspection = {
      ...deriveInspectionView(
        inspectingDraft,
        report,
        state.inspections[inspectingCard.id]
      ),
      card: inspectingCard,
      table: inspectingDraft,
      expected,
      unpenalizedMult: unpenalizedMult(expected),
      provenance: provenanceOf(state, inspectingCard),
      stale: isStale(scenario, state, inspectingCard),
      trace: {
        listing: target.listing,
        blocked: target.blocked,
        cells,
        log,
        synergy:
          target.listing !== null &&
          target.blocked === null &&
          pairSynergy(state, inspectingCard.id, target.listing.id),
      },
    };
  }

  let figureInspection: FigureInspectionView | null = null;
  if (inspectingCard?.km && state.inspections[inspectingCard.id]) {
    const report = kmReportFor(scenario, state, inspectingCard) as KmReport;
    const resolvedFindingIds =
      state.inspections[inspectingCard.id].resolvedFindingIds;
    const expected = scoreCards(
      scenario,
      state,
      [inspectingCard],
      "HIGH_TABLE",
      true
    );
    figureInspection = {
      card: inspectingCard,
      km: inspectingCard.km,
      report,
      openFindings: report.findings.filter(
        (f) => !resolvedFindingIds.includes(f.id)
      ),
      resolvedFindingIds,
      parent:
        cardById(scenario, state, inspectingCard.km.parent.cardId) ?? null,
      status: figureStatus(scenario, state, inspectingCard) as FigureStatus,
      expected,
      unpenalizedMult: unpenalizedMult(expected),
      provenance: provenanceOf(state, inspectingCard),
      stale: isStale(scenario, state, inspectingCard),
    };
  }

  const reviewing = state.status === "REVIEWING" && state.crisis === null;
  const limit = handLimit(scenario, state);
  const handsLeft =
    limit === null ? null : Math.max(0, limit - state.handsPlayed);
  const surcharge = discardSurcharge(scenario, state);
  const discardFree = freeDiscardNow(state);
  const discardCost = costOf("DISCARD", surcharge, discardFree);
  const cpuHands = Math.floor(state.cpu.available / CPU_COSTS.PLAY_HAND);
  const lastTimeline = state.lastPlay
    ? scoreTimeline(
        state.lastPlay.evaluation,
        timelineContext(
          scenario,
          state,
          state.roundScore - state.lastPlay.evaluation.score
        )
      )
    : null;
  return {
    hand,
    classification,
    preview,
    previewUnpenalizedMult: preview ? unpenalizedMult(preview) : 0,
    previewUnverified: hand.some((h) => h.selected && h.unverified),
    quota: scenario.blind.quota,
    deckRemaining: scenario.deck.length - state.deckIndex,
    spentCount: state.deckIndex - state.hand.length,
    drawPile: Array.from(
      { length: scenario.deck.length - state.deckIndex },
      (_, i): RedactedCard => ({
        slot: `draw-${state.deckIndex + i}`,
        faceDown: true,
      })
    ),
    handsAffordable:
      handsLeft === null ? cpuHands : Math.min(cpuHands, handsLeft),
    discardsAffordable: discardsAffordable(state, surcharge),
    canPlay: blocked === null,
    playBlocker: blocked,
    canDiscard:
      reviewing &&
      state.selected.length > 0 &&
      canAfford(state.cpu, "DISCARD", surcharge, discardFree) &&
      clockRefusal(scenario, state, "DISCARD", "Discard") === null,
    canInspect:
      reviewing &&
      !firewall &&
      canAfford(state.cpu, "INSPECT") &&
      clockRefusal(scenario, state, "INSPECT", "Inspect") === null,
    inspection,
    lastTimeline,
    scoreLog: scoreLogOf(scenario, state),
    snapshot: snapshotRef(currentSnapshot(state)),
    staleSelected,
    playBlockedReason:
      staleSelected.length > 0
        ? STALE_ALERT
        : emptySelected.length > 0
          ? EMPTY_SHELL_ALERT
          : null,
    flushBrokenBy,
    canRecompile: reviewing && canAfford(state.cpu, "RECOMPILE"),
    invalidations: state.invalidations,
    emptySelected,
    consumables: state.consumables,
    consumableSlots: CONSUMABLE_SLOTS,
    handLevels: state.handLevels,
    handTable: handLevelTable(state.handLevels),
    budget: state.budget,
    crisis: state.crisis
      ? {
          crisis: state.crisis,
          choices: state.crisis.choices.map((choice) => ({
            choice,
            refusal: choiceRefusal(state, choice),
          })),
        }
      : null,
    modifiers: activeModifiers(scenario, state),
    handsLeft,
    discardCost,
    discardFree,
    cpuAllocation:
      scenario.table.startingCpu +
      blindStartCpu(state.opening.inventory.relics ?? []),
    firewall,
    auditLog: state.auditLog,
    figureInspection,
    session: state.session,
    dmcCharter: scenario.dmc?.charter ?? null,
    sessionRefusal: sessionRefusal(
      scenario,
      state,
      state.session === "OPEN" ? "CLOSED" : "OPEN"
    ),
    accessLog: state.accessLog,
    pendingViolations: state.pendingViolations,
    stageAccepts:
      accepts && state.status === "REVIEWING"
        ? HandTypeSchema.options.filter((h) => accepts.includes(h))
        : null,
    refusedHands:
      accepts && state.status === "REVIEWING"
        ? HandTypeSchema.options.filter((h) => !accepts.includes(h))
        : [],
    bossIntro: scenario.boss
      ? {
          title: scenario.title,
          bossName: scenario.boss.name,
          debuff: scenario.boss.description,
          quota: scenario.blind.quota,
          startingCpu: scenario.table.startingCpu,
          stages: (dmc?.stages ?? []).map(({ name, session, quota }) => ({
            name,
            session,
            quota,
          })),
          dueHours: ir?.clockHours ?? null,
          questions: (ir?.questions ?? []).map((q) => q.question),
          csrSlots: csr
            ? CSR_ORDER.map((stage) => CSR_STAGE_LABELS[stage])
            : [],
        }
      : null,
    csrLock: csr
      ? {
          packageName: csr.packageName,
          report: packageReport(scenario, state),
          lock: state.lock
            ? (({ before: _before, ...summary }) => summary)(state.lock)
            : null,
          amendRefusal: amendRefusal(scenario, state),
          amendments: state.amendments,
        }
      : null,
    clock:
      ir && state.clock !== null
        ? {
            hoursLeft: state.clock,
            totalHours: ir.clockHours,
            costs: { ...ir.hours },
            urgent: state.clock <= CLOCK_URGENT_HOURS,
            hold: state.status === "FAILED" && state.clock < ir.hours.PLAY_HAND,
          }
        : null,
    questions: (ir?.questions ?? []).map((q) => ({
      ...q,
      cardNumber: (deckCard(scenario, q.cardId) as TlfCard).number,
      answered: state.answered.includes(q.id),
    })),
    encounter: dmc
      ? {
          current: state.stage,
          stages: dmc.stages.map((stage, i) => ({
            ...stage,
            score: state.stageScores[i] ?? 0,
            status:
              (state.stageScores[i] ?? 0) >= stage.quota
                ? "DEFENDED"
                : i === state.stage
                  ? "ACTIVE"
                  : "PENDING",
          })),
        }
      : null,
    reward:
      dmc && state.status === "CLEARED"
        ? {
            choices: dmc.rewards,
            claimed: state.rewardClaimed,
          }
        : null,
    relics: state.relics,
    relicSlots: RELIC_SLOTS,
    sites: state.sites,
    enrollments: state.enrollments,
  };
}

/**
 * Previews every analysis set a blank shell in hand could be compiled on:
 * the snapshot it would read, its N, and the hand the selection would make
 * with it, scored from revealed findings only. The shell joins the selection
 * when there is room. Pure; nothing is committed. Empty for any other card.
 */
export function previewAllocation(
  scenario: Scenario,
  state: TableState,
  cardId: string
): AllocationOption[] {
  const card = cardById(scenario, state, cardId);
  const shell = shellById(scenario, card?.shellId);
  if (
    !card ||
    !shell ||
    !state.hand.includes(cardId) ||
    !isBlank(state, card)
  ) {
    return [];
  }
  const current = currentSnapshot(state);
  return compatibleWith(shell).map((population): AllocationOption => {
    const base = {
      population,
      snapshot: snapshotRef(current),
      subjects: membership(current, population).length,
    };
    const next = advanceTable(scenario, state, {
      type: "ALLOCATE",
      cardId,
      population,
    });
    if (next.lastEvent?.kind === "REFUSED") {
      return {
        ...base,
        refusal: next.lastEvent.message,
        classification: null,
        estimate: null,
      };
    }
    const selected = next.selected.includes(cardId)
      ? next.selected
      : next.selected.length < scenario.table.maxSelection
        ? [...next.selected, cardId]
        : [cardId];
    const view = deriveTableView(scenario, { ...next, selected });
    return {
      ...base,
      refusal: null,
      classification: view.classification,
      estimate: view.preview,
    };
  });
}
