/**
 * Trial & Error: Biostat Ops — public domain API.
 *
 * A poker-themed deckbuilder in which clinical outputs form scoring hands.
 * Everything exported here is pure and deterministic; React components are
 * thin adapters over it. Internals under `internal/` are private (ADR 0046).
 */
export * from "./types";
export {
  ACT_I,
  ACT_I_CRISES,
  ACT_I_SHOP,
  ACT_II,
  ACT_II_CRISES,
  ACT_III,
  ACT_III_CRISES,
  BLINDED_DATA_REVIEW_SCENARIO,
  CSR_LOCK_PLACEHOLDER_SCENARIO,
  DEMOGRAPHICS_SCENARIO,
  DMC_MILESTONE_SCENARIO,
  DMC_OPEN_SESSION_SCENARIO,
  DMC_RELICS,
  DOSE_ESCALATION_SCENARIO,
  FDA_IR_SCENARIO,
  PHASE_II_QC_SCENARIO,
  SCENARIOS,
  SPONSOR_SAFETY_SCENARIO,
  SPONSOR_TOPLINE_SCENARIO,
} from "./scenarios";
export { roundRatio, decimalPlaces } from "./internal/rounding";
export {
  HAND_BASE_SCORES,
  HAND_EXAMPLES,
  HAND_LEVEL_BONUS,
  HAND_NAMES,
  classifyHand,
  handLevelTable,
  initialHandLevels,
  leveledBase,
  type ClassifiableCard,
  type HandLevelRow,
} from "./internal/hands";
export { GUIDANCE_CARDS } from "./internal/guidance";
export { validate } from "./internal/validator";
export { traceCell, type CellTrace, type ListingRow } from "./internal/listing";
export {
  KM_DECIMALS,
  kaplanMeier,
  stepAt,
  validateKm,
  type KmArmExpected,
  type KmCheck,
  type KmFinding,
  type KmReport,
} from "./internal/km";
export {
  UNBLINDING_RULE_ID,
  structuralQc,
  type AccessKind,
  type AccessRecord,
  type DmcSession,
  type StructuralCheck,
  type StructuralCheckResult,
  type StructuralQcReport,
} from "./internal/blinding";
export {
  evaluateHand,
  ruleResultsFor,
  type RuleResultOptions,
} from "./internal/scoring";
export {
  CPU_COSTS,
  canAfford,
  costOf,
  cpuReducer,
  type CpuAction,
  type CpuEvent,
  type CpuLedger,
} from "./internal/cpu";
export {
  createDeskState,
  advanceDesk,
  deriveDeskView,
  type DeskAction,
  type DeskEvent,
  type DeskState,
  type DeskStatus,
  type DeskView,
} from "./internal/desk";
export {
  createInspectionState,
  type DeskCellStatus,
  type DeskCellView,
  type InspectionState,
  type InspectionView,
} from "./internal/inspection";
export {
  createTableState,
  advanceTable,
  deriveTableView,
  type PlayedHand,
  type ScoreLogEffect,
  type ScoreLogEntry,
  type InspectionTraceView,
  type TableAction,
  type TableCardView,
  type TableEvent,
  type TableInspectionView,
  type TableState,
  type TableView,
  type PlayBlocker,
  STALE_ALERT,
  EMPTY_SHELL_ALERT,
  CONSUMABLE_SLOTS,
  ENROLLMENT_AFTER_HANDS,
  RELIC_RACK_FULL,
  RELIC_SLOTS,
  cardShortName,
  carriedInventory,
  previewAllocation,
  studyHistory,
  FIREWALL_ALERT,
  FIREWALL_CELL,
  PROVENANCE_ALERT,
  KM_REDLINE_PENALTY,
  KM_SYNERGY,
  type EncounterStageView,
  type BossIntroView,
  type ClockView,
  type IrQuestionView,
  CLINICAL_HOLD,
  CLOCK_URGENT_HOURS,
  type EncounterView,
  type FigureInspectionView,
  type FigureStatus,
  TLF_PAIR_SYNERGY,
  type TraceRecord,
  type AllocationOption,
  type Consumable,
  consumableName,
  consumableSellValue,
  type LevelUp,
  type CrisisChoiceView,
  type CrisisView,
  type Inventory,
  type StudyHistory,
} from "./internal/table";
export {
  applyTransition,
  membership,
  sameMembership,
  snapshotRef,
  type SnapshotInvalidation,
  type TransitionOutcome,
} from "./internal/snapshots";
export { compileDraft, compileShell } from "./internal/compile";
export { drawInt, uniformAt } from "./internal/rng";
export {
  scoreTimeline,
  type TimelineContext,
  type TimelineRunning,
  type TimelineStep,
} from "./internal/timeline";
export {
  createRunState,
  advanceRun,
  deriveRunView,
  runBlinds,
  DEFAULT_SEED,
  type OpenedPack,
  type PackCardView,
  type PackSlot,
  type RunAction,
  type RunDraw,
  type RunPhase,
  type RunState,
  type RunView,
  type ShopItemView,
  type ShopSlot,
  type ShopState,
  type ShopView,
} from "./internal/run";
export {
  CASH_OUT_BASE,
  INTEREST_CAP,
  INTEREST_STEP,
  PACK_SLOTS,
  REROLL_BASE_PRICE,
  SHOP_SLOTS,
  cashOut,
  fitsRulebook,
  rerollPrice,
  sellValue,
  siteEnrollments,
  type CashOutLine,
  type CashOutReport,
  type PackCard,
} from "./internal/shop";
export {
  parseRunSave,
  replayRun,
  serializeRun,
  type LoggedAction,
  type RestoredRun,
  type RunLog,
} from "./internal/save";
