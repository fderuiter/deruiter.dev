/**
 * Runtime contracts for Trial & Error: Biostat Ops.
 *
 * Every poker primitive and scenario document is declared as a Zod schema with
 * its TypeScript type inferred from it, so scenario data can be validated at
 * runtime with the same definition the compiler checks against. See
 * ADR 0046 for the module boundary and scoring pipeline these types serve.
 */
import { z } from "zod";

/**
 * Analysis populations act as card suits. FAS and ITT are distinct members:
 * a scenario may only treat them as equivalent by declaring an alias in its
 * SAP rulebook.
 */
export const PopulationTypeSchema = z.enum([
  "SCREENED",
  "ITT",
  "SAFETY",
  "PER_PROTOCOL",
  "FAS",
]);
/** An analysis population (card suit). */
export type PopulationType = z.infer<typeof PopulationTypeSchema>;

/** Display names for each analysis population. */
export const POPULATION_LABELS: Readonly<Record<PopulationType, string>> =
  Object.freeze({
    SCREENED: "Screened",
    ITT: "ITT",
    SAFETY: "Safety",
    PER_PROTOCOL: "Per-Protocol",
    FAS: "FAS",
  });

/** The kinds of card a hand can contain. */
export const CardTypeSchema = z.enum([
  "TABLE",
  "LISTING",
  "FIGURE",
  "SUBJECT_TOKEN",
]);
/** A card kind: Table, Listing, Figure, or subject data token. */
export type CardType = z.infer<typeof CardTypeSchema>;

/** Milestone delivery quotas, escalating from internal QC to a boss review. */
export const BlindTierSchema = z.enum([
  "SMALL_BLIND",
  "BIG_BLIND",
  "BOSS_BLIND",
]);
/** A milestone Blind tier. */
export type BlindTier = z.infer<typeof BlindTierSchema>;

/** Scoring hands, ordered from weakest to strongest. */
export const HandTypeSchema = z.enum([
  "HIGH_TABLE",
  "TLF_PAIR",
  "TLF_TWO_PAIR",
  "POPULATION_FLUSH",
  "CSR_STRAIGHT",
  "EFFICACY_FULL_HOUSE",
  "MEDDRA_FIVE_OF_A_KIND",
]);
/** A scoring hand type. */
export type HandType = z.infer<typeof HandTypeSchema>;
/** Enum-style access to hand types, e.g. `HandType.HIGH_TABLE`. */
export const HandType = HandTypeSchema.enum;

/**
 * Decimal tie-breaking conventions a SAP can declare. There is no universal
 * rule: each scenario's rulebook is authoritative.
 */
export const RoundingModeSchema = z.enum([
  "HALF_EVEN",
  "HALF_AWAY_FROM_ZERO",
  "TRUNCATE",
]);
/** A decimal rounding convention. */
export type RoundingMode = z.infer<typeof RoundingModeSchema>;

const nonNegativeInt = z.number().int().nonnegative();
const identifier = z.string().trim().min(1).max(64);

/** Base Chips and base +Mult a hand type is worth before any card is scored. */
export const HandBaseScoreSchema = z.object({
  handType: HandTypeSchema,
  baseChips: nonNegativeInt,
  baseMult: nonNegativeInt,
  description: z.string().min(1),
});
/** Base Chips and +Mult for one hand type. */
export type HandBaseScore = z.infer<typeof HandBaseScoreSchema>;

/** One hand type's level this run, and how many times it has been played. */
export const HandLevelSchema = z.object({
  level: z.number().int().min(1),
  playedCount: nonNegativeInt,
});
/** One hand type's level and play count. */
export type HandLevel = z.infer<typeof HandLevelSchema>;

/**
 * The run's hand levels: one entry per hand type, every hand starting at
 * level 1. Guidance cards level a hand up for the rest of the run.
 */
export const HandLevelsSchema = z.record(HandTypeSchema, HandLevelSchema);
/** The run's hand levels, keyed by hand type. */
export type HandLevels = z.infer<typeof HandLevelsSchema>;

/** A zero-based grid coordinate inside a staged output. */
export const CellCoordinatesSchema = z.object({
  row: nonNegativeInt,
  col: nonNegativeInt,
});
/** A zero-based grid coordinate. */
export type CellCoordinates = z.infer<typeof CellCoordinatesSchema>;

/**
 * The scoring consequence of one rule check. `multMultiplier` of 0 is the
 * zero-score rule: it forces the hand's final Mult to 0.
 */
export const RuleCheckResultSchema = z.object({
  ruleId: identifier,
  passed: z.boolean(),
  chipsDelta: z.number().int(),
  multDelta: z.number().int(),
  multMultiplier: z.number().nonnegative().optional(),
  evidence: z.string().min(1),
  cellCoordinates: CellCoordinatesSchema.optional(),
});
/** The scoring consequence of one rule check. */
export type RuleCheckResult = z.infer<typeof RuleCheckResultSchema>;

/** Categories of QC discrepancy the validator can raise. */
export const QcCategorySchema = z.enum([
  "DENOMINATOR",
  "PRECISION",
  "ROUNDING",
  "VALUE",
]);
/** A QC discrepancy category. */
export type QcCategory = z.infer<typeof QcCategorySchema>;

/** How badly an unresolved discrepancy damages a hand. */
export const QcSeveritySchema = z.enum(["FATAL", "MAJOR", "MINOR"]);
/** A QC discrepancy severity. */
export type QcSeverity = z.infer<typeof QcSeveritySchema>;

/** One SAP rule, with the scoring effect of breaking or fixing it. */
export const SapRuleSchema = z.object({
  id: identifier,
  category: QcCategorySchema,
  severity: QcSeveritySchema,
  statement: z.string().min(1),
  consequence: z.string().min(1),
  /** +Mult earned when a discrepancy against this rule is corrected. */
  correctionMultBonus: nonNegativeInt,
  /** +Mult lost (as a positive number) while a non-fatal discrepancy stands. */
  redlineMultPenalty: nonNegativeInt,
  /**
   * Footnote seals the SAP accepts as a documented exception to this rule.
   * Only a rule that names a seal here can be waived by it, and a fatal rule
   * never can.
   */
  waivableBy: z.array(identifier).optional(),
});
/** One SAP rule. */
export type SapRule = z.infer<typeof SapRuleSchema>;

/** Declares two populations equivalent for a scenario. Absent by default. */
export const PopulationAliasSchema = z.object({
  population: PopulationTypeSchema,
  equals: PopulationTypeSchema,
});
/** A SAP-declared population equivalence. */
export type PopulationAlias = z.infer<typeof PopulationAliasSchema>;

/**
 * A Statistical Analysis Plan rulebook: the population suit, precision and
 * rounding convention a scenario's outputs are validated against.
 */
export const SapRulebookSchema = z
  .object({
    id: identifier,
    title: z.string().min(1),
    populationSuit: PopulationTypeSchema,
    populationAliases: z.array(PopulationAliasSchema),
    percentPrecision: z.number().int().min(0).max(6),
    meanPrecision: z.number().int().min(0).max(6),
    roundingMode: RoundingModeSchema,
    rules: z.array(SapRuleSchema).min(1),
  })
  .superRefine((rulebook, ctx) => {
    for (const category of QcCategorySchema.options) {
      if (!rulebook.rules.some((rule) => rule.category === category)) {
        ctx.addIssue({
          code: "custom",
          path: ["rules"],
          message: `Rulebook must declare a ${category} rule`,
        });
      }
    }
    rulebook.rules.forEach((rule, index) => {
      if (rule.severity === "FATAL" && (rule.waivableBy ?? []).length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["rules", index, "waivableBy"],
          message: "A fatal rule cannot be waived by a footnote",
        });
      }
    });
    for (const [index, alias] of rulebook.populationAliases.entries()) {
      if (alias.population === alias.equals) {
        ctx.addIssue({
          code: "custom",
          path: ["populationAliases", index],
          message: "A population cannot alias itself",
        });
      }
    }
  });
/** A Statistical Analysis Plan rulebook. */
export type SapRulebook = z.infer<typeof SapRulebookSchema>;

/** Treatment arms in the slice's two-arm study. */
export const ArmSchema = z.enum(["PLACEBO", "ACTIVE"]);
/** A treatment arm. */
export type Arm = z.infer<typeof ArmSchema>;

/**
 * One treatment-emergent adverse event, coded to a MedDRA System Organ Class
 * and preferred term. Fictional teaching data.
 */
export const AdverseEventSchema = z.object({
  soc: z.string().min(1).max(64),
  term: z.string().min(1).max(64),
  /** CTCAE grade, 1 (mild) to 5 (death). */
  grade: z.number().int().min(1).max(5),
  serious: z.boolean(),
  /** The event led to permanent discontinuation of study drug. */
  ledToDiscontinuation: z.boolean(),
});
/** A coded adverse event. */
export type AdverseEvent = z.infer<typeof AdverseEventSchema>;

/** A fictional subject data token and the populations it belongs to. */
export const SubjectSchema = z.object({
  id: identifier,
  arm: ArmSchema,
  age: z.number().int().min(0).max(120),
  sex: z.enum(["F", "M"]),
  populations: z.array(PopulationTypeSchema),
  /** Treatment-emergent adverse events. Absent means none were reported. */
  adverseEvents: z.array(AdverseEventSchema).optional(),
});
/** A fictional subject data token. */
export type Subject = z.infer<typeof SubjectSchema>;

/** An immutable, versioned record of population membership. */
export const PopulationSnapshotSchema = z.object({
  id: identifier,
  version: z.number().int().positive(),
  capturedAt: z.iso.datetime(),
  subjects: z.array(SubjectSchema),
});
/** An immutable population snapshot. */
export type PopulationSnapshot = z.infer<typeof PopulationSnapshotSchema>;

/**
 * Which snapshot an output was compiled against: its id, version and capture
 * time. Every dealt card carries one, so its denominators have provenance.
 */
export const SnapshotRefSchema = z.object({
  id: identifier,
  version: z.number().int().positive(),
  capturedAt: z.iso.datetime(),
});
/** A reference to one population snapshot version. */
export type SnapshotRef = z.infer<typeof SnapshotRefSchema>;

/** Why a subject's population membership changed. */
export const TransitionReasonSchema = z.enum([
  "DROPOUT",
  "PROTOCOL_AMENDMENT",
  "SCREEN_FAILURE",
  "PROTOCOL_DEVIATION",
  /** A newly activated site enrolled the subject (#948). */
  "SITE_ACTIVATION",
]);
/** Why a subject's population membership changed. */
export type TransitionReason = z.infer<typeof TransitionReasonSchema>;

/**
 * One subject joining or leaving analysis populations. Applying it to a
 * snapshot produces the next version; `effectiveAt` becomes that version's
 * `capturedAt`, so no clock is read.
 */
export const PopulationTransitionSchema = z
  .object({
    id: identifier,
    subjectId: identifier,
    reason: TransitionReasonSchema,
    /** ENROLL adds `subject`, a subject the snapshot does not hold yet. */
    change: z.enum(["JOIN", "LEAVE", "ENROLL"]),
    populations: z.array(PopulationTypeSchema).min(1),
    effectiveAt: z.iso.datetime(),
    /** What happened, in the study's words. */
    description: z.string().min(1).max(280),
    /** The subject an ENROLL transition adds. */
    subject: SubjectSchema.optional(),
  })
  .superRefine((transition, ctx) => {
    const enrolls = transition.change === "ENROLL";
    if (enrolls !== (transition.subject !== undefined)) {
      ctx.addIssue({
        code: "custom",
        path: ["subject"],
        message: "An ENROLL transition, and only one, carries its subject",
      });
    }
    if (transition.subject && transition.subject.id !== transition.subjectId) {
      ctx.addIssue({
        code: "custom",
        path: ["subject", "id"],
        message: "The enrolled subject must be the one the transition names",
      });
    }
  });
/** One subject joining or leaving analysis populations. */
export type PopulationTransition = z.infer<typeof PopulationTransitionSchema>;

/** A scripted study event: a transition applied after a given hand. */
export const StudyEventSchema = z.object({
  /** Fires once the Blind's hands played reaches this count. */
  afterHands: z.number().int().positive(),
  transition: PopulationTransitionSchema,
});
/** A scripted study event. */
export type StudyEvent = z.infer<typeof StudyEventSchema>;

/**
 * A protocol deviation (#1087): a seeded mid-Blind event that finds a
 * subject out of line with the protocol and removes them from (or returns
 * them to) analysis populations. The run's draw decides whether one fires in
 * a Blind and after which of `afterHands` it lands. The transition's
 * `effectiveAt` is replaced when it fires: it lands a day after the current
 * snapshot, so study time only moves forward.
 */
export const DeviationEventSchema = z
  .object({
    id: identifier,
    name: z.string().min(1).max(32),
    /** One line of what the monitor found, in the study's words. */
    flavor: z.string().min(1).max(200),
    /** The hands it may land after; the draw picks one. */
    afterHands: z.array(z.number().int().min(1).max(3)).min(1).max(3),
    transition: PopulationTransitionSchema,
  })
  .superRefine((event, ctx) => {
    if (event.transition.change === "ENROLL") {
      ctx.addIssue({
        code: "custom",
        path: ["transition", "change"],
        message: "A deviation moves a subject already in the study",
      });
    }
    if (event.transition.reason !== "PROTOCOL_DEVIATION") {
      ctx.addIssue({
        code: "custom",
        path: ["transition", "reason"],
        message: "A deviation's transition is a PROTOCOL_DEVIATION",
      });
    }
    if (new Set(event.afterHands).size !== event.afterHands.length) {
      ctx.addIssue({
        code: "custom",
        path: ["afterHands"],
        message: "A deviation's hands must be distinct",
      });
    }
  });
/** A seeded protocol deviation. */
export type DeviationEvent = z.infer<typeof DeviationEventSchema>;

/** Which subjects a column summarises. */
export const ColumnArmSchema = z.enum(["PLACEBO", "ACTIVE", "TOTAL"]);
/** A column's arm filter. */
export type ColumnArm = z.infer<typeof ColumnArmSchema>;

/** The statistic a table row reports, re-derivable from the snapshot. */
export const RowStatisticSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("POPULATION_N") }),
  z.object({ kind: z.literal("MEAN_AGE") }),
  z.object({ kind: z.literal("SEX_COUNT_PCT"), sex: z.enum(["F", "M"]) }),
  z.object({
    kind: z.literal("AGE_AT_LEAST_COUNT_PCT"),
    minAge: z.number().int().min(0),
  }),
  /**
   * Subjects with at least one adverse event matching every given filter,
   * as "n (%)". A subject counts once however many events match (MedDRA
   * incidence is by subject, not by event).
   */
  z.object({
    kind: z.literal("AE_SUBJECT_COUNT_PCT"),
    soc: z.string().min(1).max(64).optional(),
    term: z.string().min(1).max(64).optional(),
    serious: z.literal(true).optional(),
    minGrade: z.number().int().min(1).max(5).optional(),
    ledToDiscontinuation: z.literal(true).optional(),
  }),
]);
/** A row statistic definition. */
export type RowStatistic = z.infer<typeof RowStatisticSchema>;

/** One column of a staged output: which arm it summarises. */
const StagedColumnSchema = z.object({
  id: identifier,
  label: z.string().min(1),
  arm: ColumnArmSchema,
});

/** One row of a staged output: the statistic it reports. */
const StagedRowSchema = z.object({
  id: identifier,
  label: z.string().min(1),
  statistic: RowStatisticSchema,
});

/**
 * A planned output (Table, Listing or Figure) and its scoring weight.
 *
 * `compatiblePopulations` lists the analysis sets the SAP allows this shell
 * to be run on; without it, only `targetPopulation`. `layout` is the shell's
 * columns and row statistics, which a blank shell needs so it can be
 * compiled once the player allocates an analysis set to it.
 */
export const TableShellSpecSchema = z.object({
  id: identifier,
  tableNumber: z.string().min(1),
  title: z.string().min(1),
  cardType: CardTypeSchema,
  targetPopulation: PopulationTypeSchema,
  chips: nonNegativeInt,
  mult: nonNegativeInt,
  requiredRulebookId: identifier,
  allowedFootnoteSlots: nonNegativeInt,
  /**
   * A closed-session output: face down, and absent from the derived view,
   * until the scenario's DMC convenes the closed session.
   */
  isBlinded: z.boolean().optional(),
  compatiblePopulations: z.array(PopulationTypeSchema).min(1).optional(),
  layout: z
    .object({
      columns: z.array(StagedColumnSchema).min(1),
      rows: z.array(StagedRowSchema).min(1),
    })
    .optional(),
});
/** A table shell card specification. */
export type TableShellSpec = z.infer<typeof TableShellSpecSchema>;

/** A staged output card: the displayed cells a reviewer checks. */
export const StagedTableSchema = z
  .object({
    id: identifier,
    shellId: identifier,
    draftLabel: z.string().min(1),
    populationSnapshotId: identifier,
    columns: z.array(StagedColumnSchema).min(1),
    rows: z.array(StagedRowSchema).min(1),
    cells: z.array(z.array(z.string())),
  })
  .superRefine((table, ctx) => {
    if (table.cells.length !== table.rows.length) {
      ctx.addIssue({
        code: "custom",
        path: ["cells"],
        message: "cells must have one entry per row",
      });
      return;
    }
    table.cells.forEach((row, index) => {
      if (row.length !== table.columns.length) {
        ctx.addIssue({
          code: "custom",
          path: ["cells", index],
          message: "each cell row must have one entry per column",
        });
      }
    });
  });
/** A staged output card. */
export type StagedTable = z.infer<typeof StagedTableSchema>;

/** One validator finding, explained for the reviewer. */
export const QcFindingSchema = z.object({
  /** Stable identifier: `<ruleId>@r<row>c<col>`. */
  id: z.string().min(1),
  ruleId: identifier,
  category: QcCategorySchema,
  severity: QcSeveritySchema,
  cell: CellCoordinatesSchema,
  observed: z.string(),
  expected: z.string(),
  evidence: z.string().min(1),
  rule: z.string().min(1),
  consequence: z.string().min(1),
});
/** One validator finding. */
export type QcFinding = z.infer<typeof QcFindingSchema>;

/** The validator's complete, stably ordered output for one staged table. */
export const QcReportSchema = z.object({
  tableId: identifier,
  rulebookId: identifier,
  populationSnapshotId: identifier,
  /** Subjects in the rulebook's population suit, across all arms. */
  populationN: nonNegativeInt,
  findings: z.array(QcFindingSchema),
});
/** The validator's output for one staged table. */
export type QcReport = z.infer<typeof QcReportSchema>;

/** A Chips/+Mult/×Mult contribution from outside the cards (e.g. a relic). */
export const ScoreModifierSchema = z.object({
  sourceId: identifier,
  label: z.string().min(1),
  chips: z.number().int(),
  plusMult: z.number().int(),
  xMult: z.number().nonnegative(),
});
/** A score modifier such as an SOP relic. */
export type ScoreModifier = z.infer<typeof ScoreModifierSchema>;

/** One scored card in a hand. */
export const ScoredCardSchema = z.object({
  id: identifier,
  chips: nonNegativeInt,
  mult: nonNegativeInt,
});
/** One scored card in a hand. */
export type ScoredCard = z.infer<typeof ScoredCardSchema>;

/** Everything the evaluator needs to score one hand. */
export const HandInputSchema = z.object({
  handType: HandTypeSchema,
  cards: z.array(ScoredCardSchema).min(1),
  ruleResults: z.array(RuleCheckResultSchema),
  modifiers: z.array(ScoreModifierSchema).optional(),
  /** The hand type's level this run. Absent means level 1. */
  level: z.number().int().min(1).optional(),
});
/** Input to the hand evaluator. */
export type HandInput = z.infer<typeof HandInputSchema>;

/** One line of the score ledger, tagged with its pipeline step. */
export const ScoreLedgerEntrySchema = z.object({
  step: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  sourceId: z.string().min(1),
  kind: z.enum(["CHIPS", "PLUS_MULT", "X_MULT"]),
  value: z.number(),
  label: z.string().min(1),
});
/** One line of the score ledger. */
export type ScoreLedgerEntry = z.infer<typeof ScoreLedgerEntrySchema>;

/**
 * The full, explainable result of scoring a hand. Later tickets extend the
 * inputs (relics, synergies), not this shape.
 */
export const HandEvaluationSchema = z.object({
  handType: HandTypeSchema,
  cardIds: z.array(z.string()),
  /** The hand type's level this hand was scored at. */
  level: z.number().int().min(1),
  /** The hand's base at that level: its level-1 base plus the level bonus. */
  base: HandBaseScoreSchema,
  chips: z.object({
    base: z.number().int(),
    outputs: z.number().int(),
    relics: z.number().int(),
    total: z.number().int(),
  }),
  mult: z.object({
    base: z.number().int(),
    cardsAndRules: z.number().int(),
    relics: z.number().int(),
    total: z.number().int(),
  }),
  xMult: z.object({
    factors: z.array(z.object({ sourceId: z.string(), value: z.number() })),
    product: z.number().nonnegative(),
  }),
  ruleResults: z.array(RuleCheckResultSchema),
  ledger: z.array(ScoreLedgerEntrySchema),
  zeroRule: z.object({
    triggered: z.boolean(),
    ruleIds: z.array(z.string()),
  }),
  finalMult: z.number().nonnegative(),
  score: z.number().int().nonnegative(),
});
/** The full, explainable result of scoring a hand. */
export type HandEvaluation = z.infer<typeof HandEvaluationSchema>;

/** The debuffs a Boss Blind can impose. */
export const BossDebuffTypeSchema = z.enum([
  "DISABLE_POPULATION",
  "HAND_LIMIT",
  "DISCARD_PENALTY",
  "BLIND_FIREWALL",
]);
/** A Boss Blind debuff type. */
export type BossDebuffType = z.infer<typeof BossDebuffTypeSchema>;

/**
 * A Blind's rule twist, imposed by its boss or by a crisis choice.
 * `DISABLE_POPULATION` scores every output built on one of
 * `disabledPopulations` at 0 Chips. `HAND_LIMIT` fails the Blind once
 * `maxHandsAllowed` hands have been played short of the target.
 * `DISCARD_PENALTY` adds `discardCpuPenalty` CPU to every discard.
 * `BLIND_FIREWALL` turns treatment-arm values face down: they are absent
 * from the derived view, and no output can be inspected.
 */
export const BossBlindModifierSchema = z
  .object({
    id: identifier,
    name: z.string().min(1),
    description: z.string().min(1),
    debuffType: BossDebuffTypeSchema,
    disabledPopulations: z.array(PopulationTypeSchema).optional(),
    maxHandsAllowed: z.number().int().positive().optional(),
    discardCpuPenalty: nonNegativeInt.optional(),
  })
  .superRefine((modifier, ctx) => {
    if (
      modifier.debuffType === "DISABLE_POPULATION" &&
      (modifier.disabledPopulations ?? []).length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["disabledPopulations"],
        message: "DISABLE_POPULATION must name at least one population",
      });
    }
    if (
      modifier.debuffType === "HAND_LIMIT" &&
      modifier.maxHandsAllowed === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maxHandsAllowed"],
        message: "HAND_LIMIT must set maxHandsAllowed",
      });
    }
    if (
      modifier.debuffType === "DISCARD_PENALTY" &&
      (modifier.discardCpuPenalty ?? 0) < 1
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["discardCpuPenalty"],
        message: "DISCARD_PENALTY must add at least 1 CPU",
      });
    }
  });
/** A Boss Blind's rule twist. */
export type BossBlindModifier = z.infer<typeof BossBlindModifierSchema>;

/** The moments an SOP relic can fire (#924), in the order a Blind meets them. */
export const RelicPhaseSchema = z.enum([
  "ON_BLIND_START",
  "ON_DISCARD",
  "ON_CARD_SCORED",
  "ON_HAND_PLAYED",
]);
/** When an SOP relic fires. */
export type RelicPhase = z.infer<typeof RelicPhaseSchema>;

/**
 * When and on what an SOP relic fires (#924). A relic never overrides the
 * SAP: it adds to a hand's score, or eases an action's CPU cost, and every
 * rule result, redline and zero-score rule still stands.
 *
 * - ON_HAND_PLAYED: its modifier joins the hand, optionally only when the
 *   hand holds a Figure or carries no redline.
 * - ON_CARD_SCORED: its modifier joins once for each scored card that
 *   matches, or, with `retrigger`, the card's own Chips and +Mult score again.
 * - ON_DISCARD: the Blind's first `freeDiscards` discards cost no base CPU.
 * - ON_BLIND_START: each Blind starts with `cpu` more CPU.
 */
export const RelicTriggerSchema = z.discriminatedUnion("phase", [
  z.object({
    phase: z.literal("ON_HAND_PLAYED"),
    requires: z.enum(["FIGURE_IN_HAND", "NO_REDLINES"]).optional(),
  }),
  z.object({
    phase: z.literal("ON_CARD_SCORED"),
    cardType: CardTypeSchema.optional(),
    population: PopulationTypeSchema.optional(),
    /** Only cards stamped QC ✓: every cell reviewed, no open redline. */
    qcPassedOnly: z.boolean().optional(),
    retrigger: z.boolean().optional(),
  }),
  z.object({
    phase: z.literal("ON_DISCARD"),
    freeDiscards: z.number().int().positive(),
  }),
  z.object({
    phase: z.literal("ON_BLIND_START"),
    cpu: z.number().int().positive(),
  }),
]);
/** When and on what an SOP relic fires. */
export type RelicTrigger = z.infer<typeof RelicTriggerSchema>;

/**
 * An SOP relic: a person or tool on the team that the run keeps once
 * earned. Without a trigger its modifier joins every later hand's scoring.
 */
export const RelicSchema = z.object({
  id: identifier,
  name: z.string().min(1).max(60),
  description: z.string().min(1).max(200),
  modifier: ScoreModifierSchema,
  trigger: RelicTriggerSchema.optional(),
});
/** An SOP relic. */
export type Relic = z.infer<typeof RelicSchema>;

/**
 * One stage of a staged Boss encounter: the DMC session it is played in, the
 * hands it accepts, and the score that defends it.
 */
export const EncounterStageSchema = z.object({
  name: z.string().min(1).max(60),
  session: z.enum(["OPEN", "CLOSED"]),
  quota: z.number().int().positive(),
  hands: z.array(HandTypeSchema).min(1),
});
/** One stage of a staged Boss encounter. */
export type EncounterStage = z.infer<typeof EncounterStageSchema>;

/**
 * The DMC milestone defense (T&E-09): an open-session package played from
 * the blinded study team's seat, then a closed-session package from the
 * independent statistician's seat. Defending both earns a choice of relics.
 */
export const DmcDefenseSchema = z.object({
  kind: z.literal("DMC_DEFENSE"),
  stages: z.tuple([EncounterStageSchema, EncounterStageSchema]),
  /** The relics offered on victory; the player keeps one. */
  rewards: z.array(RelicSchema).min(2).max(3),
});
/** The DMC milestone defense. */
export type DmcDefense = z.infer<typeof DmcDefenseSchema>;

/**
 * One targeted question in an FDA Information Request: the output the FDA
 * asks for, and the share of the Blind's quota answering it clears. A played
 * hand whose scoring cards include `cardId` answers it when the hand scores
 * at least `quota` (#921).
 */
export const IrQuestionSchema = z.object({
  id: identifier,
  /** The question as the FDA puts it. */
  question: z.string().min(1).max(160),
  /** The deck card that answers it. */
  cardId: identifier,
  quota: z.number().int().positive(),
});
/** One targeted question in an FDA Information Request. */
export type IrQuestion = z.infer<typeof IrQuestionSchema>;

/** The actions an FDA Information Request's clock charges hours for. */
export const ClockActionSchema = z.enum([
  "PLAY_HAND",
  "DISCARD",
  "INSPECT",
  "TRACE",
]);
/** An action the clock charges hours for. */
export type ClockAction = z.infer<typeof ClockActionSchema>;

/**
 * The End-of-Phase-2 FDA Information Request (T&E-10, #921): targeted
 * questions answered against a deterministic clock. Every move costs hours;
 * nothing reads the wall clock. Answering every question clears the Blind,
 * and running out of hours first is a Clinical Hold, which ends the run.
 */
export const FdaIrSchema = z.object({
  kind: z.literal("FDA_IR"),
  /** Hours from the request to the response being due. */
  clockHours: z.number().int().positive(),
  /** What each move costs in hours. */
  hours: z.record(ClockActionSchema, nonNegativeInt),
  /** The hands the FDA accepts as a response. */
  hands: z.array(HandTypeSchema).min(1),
  questions: z.array(IrQuestionSchema).min(1).max(4),
});
/** The FDA Information Request encounter. */
export type FdaIr = z.infer<typeof FdaIrSchema>;

/**
 * CSR Lock (T&E-11, #922): the final release gate. It accepts only a CSR
 * Straight (ADR 0046), and the Blind is won only by locking the Clinical
 * Study Report package: a Straight played in pipeline order whose five
 * outputs reconcile (current, validated, no open findings, compiled under
 * the active SAP) and that reaches the quota. Changing a locked package
 * needs a formal protocol amendment.
 */
export const CsrLockSchema = z.object({
  kind: z.literal("CSR_LOCK"),
  /** The package's name on the lock stamp and audit summary. */
  packageName: z.string().min(1).max(60),
});
/** The CSR Lock encounter. */
export type CsrLock = z.infer<typeof CsrLockSchema>;

/** A Boss encounter: the DMC milestone defense, an FDA IR, or CSR Lock. */
export const EncounterSchema = z.discriminatedUnion("kind", [
  DmcDefenseSchema,
  FdaIrSchema,
  CsrLockSchema,
]);
/** A Boss encounter. */
export type Encounter = z.infer<typeof EncounterSchema>;

/** A milestone quota the player must reach. */
export const BlindSchema = z.object({
  tier: BlindTierSchema,
  name: z.string().min(1),
  quota: z.number().int().positive(),
});
/** A milestone Blind. */
export type Blind = z.infer<typeof BlindSchema>;

/** Stages of the standard CSR submission flow, in pipeline order. */
export const CsrStageSchema = z.enum([
  "DISPOSITION",
  "BASELINE",
  "EFFICACY",
  "SAFETY_AE",
  "PATIENT_LISTING",
]);
/** A CSR pipeline stage (CSR Straight). */
export type CsrStage = z.infer<typeof CsrStageSchema>;

/**
 * A TLF card on the Card Table. `topic` links a Table to its supporting
 * Listing (TLF Pair) and a Figure to the Table it depends on (Efficacy Full
 * House). `draftId` points at a staged table in the scenario's draw pile when
 * the card has reviewable cells.
 */
const faceText = z.string().min(1).max(24);

/** One plotted series on a Figure face, as `[x, y]` points in data units. */
const FigureSeriesSchema = z.object({
  label: faceText,
  points: z
    .array(z.tuple([z.number(), z.number()]))
    .min(2)
    .max(12),
  /** Right-censoring tick times on a KM curve, in data units. */
  censors: z.array(z.number()).max(24).optional(),
});

/** One subgroup row on a forest-plot face. */
const ForestIntervalSchema = z
  .object({
    label: faceText,
    estimate: z.number(),
    lower: z.number(),
    upper: z.number(),
  })
  .refine((i) => i.lower <= i.estimate && i.estimate <= i.upper, {
    message: "A forest interval must contain its estimate",
  });

/** What a Figure face plots. */
export const FigurePlotSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("KM"),
    series: z.array(FigureSeriesSchema).min(1).max(2),
  }),
  z.object({
    type: z.literal("SPARKLINE"),
    series: z.array(FigureSeriesSchema).min(1).max(2),
  }),
  z.object({
    type: z.literal("FOREST"),
    reference: z.number(),
    intervals: z.array(ForestIntervalSchema).min(2).max(5),
  }),
]);
/** What a Figure face plots. */
export type FigurePlot = z.infer<typeof FigurePlotSchema>;

/**
 * A card's face: a live miniature of the output it represents, rendered from
 * this data rather than from an illustration.
 */
export const CardFaceSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("TABLE"),
      /** One column for a pooled table (Total only), else the arms. */
      columns: z.array(faceText).min(1).max(3),
      rows: z
        .array(z.object({ label: faceText, values: z.array(faceText) }))
        .min(3)
        .max(5),
    }),
    z.object({
      kind: z.literal("LISTING"),
      columns: z.array(faceText).min(2).max(4),
      rows: z.array(z.array(faceText)).min(3).max(4),
    }),
    z.object({
      kind: z.literal("FIGURE"),
      plot: FigurePlotSchema,
      /** The parent Table's number, printed on a dependent Figure. */
      source: faceText.optional(),
      /** The Number-at-Risk strip under a KM plot, one row per arm. */
      atRisk: z
        .object({
          times: z.array(z.number().nonnegative()).min(1).max(8),
          rows: z
            .array(
              z.object({
                label: faceText,
                values: z.array(z.number().int().nonnegative()),
              })
            )
            .min(1)
            .max(2),
        })
        .optional(),
    }),
    z.object({
      kind: z.literal("TOKEN"),
      cohort: faceText,
      count: nonNegativeInt,
    }),
  ])
  .superRefine((face, ctx) => {
    if (face.kind === "TABLE") {
      face.rows.forEach((row, index) => {
        if (row.values.length !== face.columns.length) {
          ctx.addIssue({
            code: "custom",
            path: ["rows", index, "values"],
            message: "Each face row needs one value per column",
          });
        }
      });
    }
    if (face.kind === "LISTING") {
      face.rows.forEach((row, index) => {
        if (row.length !== face.columns.length) {
          ctx.addIssue({
            code: "custom",
            path: ["rows", index],
            message: "Each listing row needs one value per column",
          });
        }
      });
    }
  });
/** A card's face data. */
export type CardFace = z.infer<typeof CardFaceSchema>;

/** The face kind each card type renders. */
export const FACE_KIND_BY_CARD_TYPE = {
  TABLE: "TABLE",
  LISTING: "LISTING",
  FIGURE: "FIGURE",
  SUBJECT_TOKEN: "TOKEN",
} as const satisfies Record<CardType, CardFace["kind"]>;

/**
 * Marks stamped on a card face. T&E-UX-03 produces REDLINE and QC_PASS; the
 * rest are the slots later tickets fill (stale outputs, sealed and blinded
 * sessions).
 */
export const CardStampSchema = z.enum([
  "REDLINE",
  "QC_PASS",
  "STALE",
  "SEALED",
  "BLINDED",
]);
/** A mark stamped on a card face. */
export type CardStamp = z.infer<typeof CardStampSchema>;

/**
 * A face-down card: an opaque slot and nothing else. It cannot carry face
 * values, so a blinded or undealt card can be rendered without leaking them.
 */
export const RedactedCardSchema = z
  .object({ slot: identifier, faceDown: z.literal(true) })
  .strict();
/** A face-down card. */
export type RedactedCard = z.infer<typeof RedactedCardSchema>;

/** One subject's time-to-event record behind a Kaplan–Meier figure. */
export const TimeToEventRecordSchema = z.object({
  subjectId: identifier,
  /** Time from the fixed origin, in the figure's time unit. */
  time: z.number().nonnegative(),
  /** True for an event; false for a right-censored observation. */
  event: z.boolean(),
});
/** One subject's time-to-event record. */
export type TimeToEventRecord = z.infer<typeof TimeToEventRecordSchema>;

/** What a KM figure draft prints for one arm: the curve, ticks and at-risk row. */
export const KmArmDisplaySchema = z.object({
  arm: ArmSchema,
  /** The plotted step function as `[time, survival]` points, origin first. */
  curve: z
    .array(z.tuple([z.number().nonnegative(), z.number().min(0).max(1)]))
    .min(2)
    .max(12),
  /** Where right-censoring ticks are drawn. */
  censorTicks: z.array(z.number().nonnegative()).max(24),
  /** The Number-at-Risk row: one count per milestone. */
  atRisk: z.array(nonNegativeInt),
});
/** What a KM figure draft prints for one arm. */
export type KmArmDisplay = z.infer<typeof KmArmDisplaySchema>;

/**
 * A Kaplan–Meier figure: the time-to-event records it was compiled from, the
 * immutable snapshot they belong to, the parent Table it depends on, and
 * what the draft actually prints. `parent` names the parent's face rows that
 * must reconcile with the figure: subjects at risk at the origin and events.
 */
export const KmFigureSchema = z
  .object({
    endpoint: z.string().min(1).max(80),
    timeUnit: z.string().min(1).max(16),
    populationSnapshotId: identifier,
    parent: z.object({
      cardId: identifier,
      atRiskRow: faceText,
      eventsRow: faceText,
    }),
    /** The time origin the draft's axis starts at. The SAP fixes it at 0. */
    timeOrigin: z.number(),
    /** Number-at-Risk milestone times, strictly increasing, from 0. */
    milestones: z.array(z.number().nonnegative()).min(2).max(8),
    records: z.array(TimeToEventRecordSchema).min(1),
    displayed: z.array(KmArmDisplaySchema).min(1).max(2),
  })
  .superRefine((km, ctx) => {
    km.milestones.forEach((t, i) => {
      if (i > 0 && t <= km.milestones[i - 1]) {
        ctx.addIssue({
          code: "custom",
          path: ["milestones", i],
          message: "Milestones must be strictly increasing",
        });
      }
    });
    km.displayed.forEach((arm, i) => {
      if (arm.atRisk.length !== km.milestones.length) {
        ctx.addIssue({
          code: "custom",
          path: ["displayed", i, "atRisk"],
          message: "The at-risk row needs one count per milestone",
        });
      }
    });
  });
/** A Kaplan–Meier figure. */
export type KmFigure = z.infer<typeof KmFigureSchema>;

export const TlfCardSchema = z.object({
  id: identifier,
  cardType: CardTypeSchema,
  number: z.string().min(1),
  title: z.string().min(1),
  population: PopulationTypeSchema,
  chips: nonNegativeInt,
  mult: nonNegativeInt,
  topic: identifier,
  csrStage: CsrStageSchema.optional(),
  soc: z.string().min(1).optional(),
  draftId: identifier.optional(),
  /** Face data. Draft cards derive their face from the draft table instead. */
  face: CardFaceSchema.optional(),
  /**
   * A blank shell: a planned output with no cohort data allocated yet. It
   * compiles only once the player allocates one of the shell's analysis sets.
   */
  shellId: identifier.optional(),
  /** A Kaplan–Meier figure: its face is drawn from this data. */
  km: KmFigureSchema.optional(),
});
/** A TLF card on the Card Table. */
export type TlfCard = z.infer<typeof TlfCardSchema>;

/** What a footnote seal does to the output it is affixed to. */
export const SealEffectSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("PLUS_CHIPS"),
    value: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("PLUS_MULT"),
    value: z.number().int().positive(),
  }),
  /**
   * Waives the redline of every SAP rule that names this seal in its
   * `waivableBy`. It never touches a rule that does not.
   */
  z.object({ kind: z.literal("WAIVE") }),
]);
/** What a footnote seal does. */
export type SealEffect = z.infer<typeof SealEffectSchema>;

/**
 * A footnote seal: a single-use consumable that affixes a real table
 * footnote to an output, legitimising a presentation choice. Its effect is
 * recorded as its own rule result, so it is always traceable.
 */
export const FootnoteSealSchema = z.object({
  id: identifier,
  name: z.string().min(1).max(32),
  /** The footnote as it prints under the output. */
  footnote: z.string().min(1).max(200),
  effect: SealEffectSchema,
  /** Outputs the seal may be affixed to. An absent list allows any. */
  eligible: z.object({
    cardTypes: z.array(CardTypeSchema).min(1).optional(),
    populations: z.array(PopulationTypeSchema).min(1).optional(),
    topics: z.array(identifier).min(1).optional(),
  }),
  /** What selling it adds to the study budget. */
  sellValue: nonNegativeInt,
});
/** A footnote seal. */
export type FootnoteSeal = z.infer<typeof FootnoteSealSchema>;

/**
 * A Guidance card: a consumable named after a real guidance document. Using
 * it levels its hand type up by one for the rest of the run; the bonus per
 * level is the hand's, in `HAND_LEVEL_BONUS`. Flavour text is a joke, not
 * regulatory advice.
 */
export const GuidanceCardSchema = z.object({
  id: identifier,
  /** The short name printed on the card, e.g. "ICH E9". */
  name: z.string().min(1).max(32),
  /** The document's full title. */
  document: z.string().min(1).max(120),
  /** The hand type it levels up. */
  handType: HandTypeSchema,
  flavor: z.string().min(1).max(200),
  /** What selling it adds to the study budget. */
  sellValue: nonNegativeInt,
});
/** A Guidance card. */
export type GuidanceCard = z.infer<typeof GuidanceCardSchema>;

/**
 * A SAP Amendment (#1086): a consumable the player chooses to use. It amends
 * one non-fatal rule category of the rulebook in force for the rest of the
 * run: correcting a discrepancy against it pays `bonusDelta` more +Mult, and
 * a standing redline costs `penaltyDelta` more. The amended rulebook takes
 * `code` as a suffix to its id, and every output in hand compiled under the
 * old rulebook goes stale.
 */
export const SapAmendmentSchema = z.object({
  id: identifier,
  /** The short name printed on the card. */
  name: z.string().min(1).max(32),
  description: z.string().min(1).max(200),
  /** The suffix the amended rulebook's id takes, e.g. "AR". */
  code: z.string().regex(/^[A-Z0-9]{1,4}$/),
  /** The rule category it amends. Fatal rules are never amended. */
  category: z.enum(["PRECISION", "ROUNDING", "VALUE"]),
  /** +Mult added to a correction against the amended rule. */
  bonusDelta: z.number().int().min(1).max(10),
  /** +Mult added to what a standing redline against it costs. */
  penaltyDelta: z.number().int().min(0).max(10),
  /** What selling it adds to the study budget. */
  sellValue: nonNegativeInt,
});
/** A SAP Amendment. */
export type SapAmendment = z.infer<typeof SapAmendmentSchema>;

/**
 * A trial site a Site Activation pack can activate (#948). Activating
 * it adds its standing Chips to every later hand and enrolls its subjects
 * into the study after the next Blind's first hand, which versions the
 * population snapshot and stales the outputs in hand that depend on it.
 */
export const SiteSchema = z.object({
  id: identifier,
  name: z.string().min(1).max(60),
  description: z.string().min(1).max(200),
  modifier: ScoreModifierSchema,
  /** The subjects the site enrolls. Their ids must be new to the study. */
  subjects: z.array(SubjectSchema).min(1).max(3),
});
/** A trial site. */
export type Site = z.infer<typeof SiteSchema>;

/** One item the Procurement Shop can stock in a single slot, with its price. */
export const ShopEntrySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("RELIC"),
    price: z.number().int().positive(),
    relic: RelicSchema,
  }),
  z.object({
    kind: z.literal("GUIDANCE"),
    price: z.number().int().positive(),
    guidance: GuidanceCardSchema,
  }),
  z.object({
    kind: z.literal("SEAL"),
    price: z.number().int().positive(),
    seal: FootnoteSealSchema,
  }),
  z.object({
    kind: z.literal("AMENDMENT"),
    price: z.number().int().positive(),
    amendment: SapAmendmentSchema,
  }),
]);
/** One item the Procurement Shop can stock. */
export type ShopEntry = z.infer<typeof ShopEntrySchema>;

/** What a booster pack opens into. */
export const PackKindSchema = z.enum(["SITE_ACTIVATION", "GUIDANCE", "RELIC"]);
/** What a booster pack opens into. */
export type PackKind = z.infer<typeof PackKindSchema>;

/** A booster pack: it opens to `size` cards, of which the player keeps `choose`. */
export const PackSchema = z
  .object({
    id: identifier,
    kind: PackKindSchema,
    name: z.string().min(1).max(40),
    description: z.string().min(1).max(200),
    price: z.number().int().positive(),
    size: z.number().int().min(1).max(5),
    choose: z.number().int().min(1).max(2),
  })
  .refine((pack) => pack.choose <= pack.size, {
    message: "A pack cannot keep more cards than it opens",
    path: ["choose"],
  });
/** A booster pack. */
export type Pack = z.infer<typeof PackSchema>;

/**
 * An act's Procurement Shop catalog: the single-slot stock, the packs and
 * the sites Site Activation packs draw from. Every item is data, validated
 * here, and the shop draws from it only through the seeded PRNG.
 */
export const ShopCatalogSchema = z
  .object({
    entries: z.array(ShopEntrySchema).min(1),
    packs: z.array(PackSchema).min(1),
    sites: z.array(SiteSchema),
  })
  .superRefine((catalog, ctx) => {
    const ids = new Set<string>();
    const unique = (id: string, path: (string | number)[]) => {
      if (ids.has(id)) {
        ctx.addIssue({ code: "custom", path, message: `Duplicate id ${id}` });
      }
      ids.add(id);
    };
    catalog.entries.forEach((entry, i) =>
      unique(shopEntryId(entry), ["entries", i])
    );
    catalog.packs.forEach((pack, i) => unique(pack.id, ["packs", i, "id"]));
    catalog.sites.forEach((site, i) => unique(site.id, ["sites", i, "id"]));
    const subjects = new Set<string>();
    catalog.sites.forEach((site, i) =>
      site.subjects.forEach((subject, j) => {
        if (subjects.has(subject.id)) {
          ctx.addIssue({
            code: "custom",
            path: ["sites", i, "subjects", j, "id"],
            message: "Each site enrolls its own subjects",
          });
        }
        subjects.add(subject.id);
      })
    );
    if (
      catalog.packs.some((p) => p.kind === "SITE_ACTIVATION") &&
      catalog.sites.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["sites"],
        message: "A Site Activation pack needs sites to draw",
      });
    }
  });
/** An act's Procurement Shop catalog. */
export type ShopCatalog = z.infer<typeof ShopCatalogSchema>;

/** A shop entry's id: the id of the relic, Guidance card or seal it sells. */
export function shopEntryId(entry: ShopEntry): string {
  if (entry.kind === "RELIC") return entry.relic.id;
  if (entry.kind === "GUIDANCE") return entry.guidance.id;
  if (entry.kind === "AMENDMENT") return entry.amendment.id;
  return entry.seal.id;
}

/**
 * What one crisis choice does. Every field is optional and deterministic:
 * CPU and study budget deltas, a footnote seal granted to the tray or one
 * spent from it, a population transition (routed through snapshot
 * invalidation, so matching outputs go stale), and a modifier imposed on
 * the current Blind.
 */
export const CrisisEffectSchema = z.object({
  cpu: z.number().int().optional(),
  budget: z.number().int().optional(),
  grantSeal: FootnoteSealSchema.optional(),
  /** Spends the first seal in the tray. */
  spendSeal: z.literal(true).optional(),
  transition: PopulationTransitionSchema.optional(),
  modifier: BossBlindModifierSchema.optional(),
});
/** What one crisis choice does. */
export type CrisisEffect = z.infer<typeof CrisisEffectSchema>;

/** One way to answer a crisis, with its consequence stated before commit. */
export const CrisisChoiceSchema = z.object({
  id: identifier,
  label: z.string().min(1).max(40),
  /** The consequence, in plain words, shown on the button. */
  consequence: z.string().min(1).max(160),
  effect: CrisisEffectSchema,
});
/** One way to answer a crisis. */
export type CrisisChoice = z.infer<typeof CrisisChoiceSchema>;

/** Whether a crisis choice costs nothing the player might lack. */
export const isFreeCrisisChoice = (choice: CrisisChoice): boolean =>
  (choice.effect.cpu ?? 0) >= 0 &&
  (choice.effect.budget ?? 0) >= 0 &&
  choice.effect.spendSeal === undefined;

/**
 * A crisis card: something that happens to a study (a dropout, an
 * amendment, an audit, a migration). It is drawn by the seeded event draw
 * when a Blind starts and must be answered before the Blind is played. At
 * least one choice is free, so a crisis can never strand a run.
 */
export const CrisisCardSchema = z
  .object({
    id: identifier,
    name: z.string().min(1).max(32),
    description: z.string().min(1).max(280),
    choices: z.array(CrisisChoiceSchema).min(2).max(3),
  })
  .superRefine((crisis, ctx) => {
    if (!crisis.choices.some(isFreeCrisisChoice)) {
      ctx.addIssue({
        code: "custom",
        path: ["choices"],
        message:
          "A crisis needs at least one choice that costs no CPU, budget or seal",
      });
    }
    const ids = new Set<string>();
    crisis.choices.forEach((choice, index) => {
      if (ids.has(choice.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["choices", index, "id"],
          message: "Crisis choice ids must be unique",
        });
      }
      ids.add(choice.id);
    });
  });
/** A crisis card. */
export type CrisisCard = z.infer<typeof CrisisCardSchema>;

/** The best hand a selection makes, and the cards that actually score. */
export const HandClassificationSchema = z.object({
  handType: HandTypeSchema,
  scoringCardIds: z.array(identifier).min(1),
});
/** The best hand a selection makes. */
export type HandClassification = z.infer<typeof HandClassificationSchema>;

/** Card Table rules for a scenario. */
export const TableRulesSchema = z.object({
  startingCpu: nonNegativeInt,
  handSize: z.number().int().min(1).max(12),
  maxSelection: z.number().int().min(1).max(5),
});
/** Card Table rules for a scenario. */
export type TableRules = z.infer<typeof TableRulesSchema>;

/**
 * A playable scenario (one Blind): SAP, snapshot, the shells its drafts are
 * compiled from, and a fixed draw pile.
 */
export const ScenarioSchema = z
  .object({
    id: identifier,
    title: z.string().min(1),
    summary: z.string().min(1),
    /** The short intro card shown when the Blind starts. */
    intro: z.string().min(1).max(280),
    blind: BlindSchema,
    /** Present only on a Boss Blind. */
    boss: BossBlindModifierSchema.optional(),
    handType: HandTypeSchema,
    startingCpu: nonNegativeInt,
    rulebook: SapRulebookSchema,
    populationSnapshot: PopulationSnapshotSchema,
    shells: z.array(TableShellSpecSchema).min(1),
    drawPile: z.array(StagedTableSchema).min(1),
    table: TableRulesSchema,
    deck: z.array(TlfCardSchema).min(1),
    /** Scripted population changes during this Blind, in hand order. */
    events: z.array(StudyEventSchema).optional(),
    /** Footnote seals granted to the consumable tray when the Blind starts. */
    consumables: z.array(FootnoteSealSchema).optional(),
    /** Guidance cards granted to free tray slots, after the seals. */
    guidance: z.array(GuidanceCardSchema).optional(),
    /**
     * The Data Monitoring Committee chartered for this Blind. Outputs whose
     * shell `isBlinded` stay face down in the open session; only this
     * charter's governance can convene the closed session that reveals them.
     */
    dmc: z
      .object({
        /** The documented control the closed session is convened under. */
        charter: z.string().min(1).max(120),
      })
      .optional(),
    /** A staged Boss encounter: this Blind is cleared stage by stage. */
    encounter: EncounterSchema.optional(),
  })
  .superRefine((scenario, ctx) => {
    if (scenario.encounter?.kind === "FDA_IR") {
      const ir = scenario.encounter;
      const deckIds = new Set(scenario.deck.map((c) => c.id));
      const questionIds = new Set<string>();
      ir.questions.forEach((q, index) => {
        if (!deckIds.has(q.cardId)) {
          ctx.addIssue({
            code: "custom",
            path: ["encounter", "questions", index, "cardId"],
            message: "Each question must name a card in the deck",
          });
        }
        if (questionIds.has(q.id)) {
          ctx.addIssue({
            code: "custom",
            path: ["encounter", "questions", index, "id"],
            message: "Question ids must be unique",
          });
        }
        questionIds.add(q.id);
      });
      if (
        ir.questions.reduce((sum, q) => sum + q.quota, 0) !==
        scenario.blind.quota
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["encounter", "questions"],
          message: "The questions' quotas must add up to the Blind's quota",
        });
      }
      if (ir.clockHours < ir.hours.PLAY_HAND) {
        ctx.addIssue({
          code: "custom",
          path: ["encounter", "clockHours"],
          message: "The clock must leave time to play a hand",
        });
      }
      if (scenario.boss?.debuffType !== "HAND_LIMIT") {
        ctx.addIssue({
          code: "custom",
          path: ["encounter"],
          message: "An FDA Information Request needs a HAND_LIMIT Boss",
        });
      }
    }
    if (scenario.encounter?.kind === "CSR_LOCK") {
      const staged = new Set(scenario.deck.map((c) => c.csrStage));
      const missing = CsrStageSchema.options.filter((s) => !staged.has(s));
      if (missing.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["encounter"],
          message: `CSR Lock must deal a card for every CSR stage; missing ${missing.join(", ")}`,
        });
      }
    }
    if (scenario.encounter?.kind === "DMC_DEFENSE") {
      const [open, closed] = scenario.encounter.stages;
      if (open.session !== "OPEN" || closed.session !== "CLOSED") {
        ctx.addIssue({
          code: "custom",
          path: ["encounter", "stages"],
          message: "A DMC defense plays the open session, then the closed one",
        });
      }
      if (open.quota + closed.quota !== scenario.blind.quota) {
        ctx.addIssue({
          code: "custom",
          path: ["encounter", "stages"],
          message: "The stage quotas must add up to the Blind's quota",
        });
      }
      if (!scenario.dmc || scenario.boss?.debuffType !== "BLIND_FIREWALL") {
        ctx.addIssue({
          code: "custom",
          path: ["encounter"],
          message:
            "A DMC defense needs a chartered DMC and a BLIND_FIREWALL Boss",
        });
      }
    }
    const subjectIds = new Set(
      scenario.populationSnapshot.subjects.map((s) => s.id)
    );
    (scenario.events ?? []).forEach((event, index) => {
      if (!subjectIds.has(event.transition.subjectId)) {
        ctx.addIssue({
          code: "custom",
          path: ["events", index, "transition", "subjectId"],
          message: "A study event must name a subject in the snapshot",
        });
      }
    });
    if (
      (scenario.boss !== undefined) !==
      (scenario.blind.tier === "BOSS_BLIND")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["boss"],
        message:
          "A Boss Blind needs exactly one boss modifier; other Blinds none",
      });
    }
    const shellIds = new Set<string>();
    scenario.shells.forEach((shell, index) => {
      if (shellIds.has(shell.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["shells", index, "id"],
          message: "Shell ids must be unique",
        });
      }
      shellIds.add(shell.id);
      if (shell.requiredRulebookId !== scenario.rulebook.id) {
        ctx.addIssue({
          code: "custom",
          path: ["shells", index, "requiredRulebookId"],
          message: "Shell must require the scenario's rulebook",
        });
      }
    });
    scenario.drawPile.forEach((table, index) => {
      if (!shellIds.has(table.shellId)) {
        ctx.addIssue({
          code: "custom",
          path: ["drawPile", index, "shellId"],
          message:
            "Every draft must be compiled from one of the scenario's shells",
        });
      }
      if (table.populationSnapshotId !== scenario.populationSnapshot.id) {
        ctx.addIssue({
          code: "custom",
          path: ["drawPile", index, "populationSnapshotId"],
          message: "Every draft must reference the scenario's snapshot",
        });
      }
    });
    const draftIds = new Set(scenario.drawPile.map((draft) => draft.id));
    const seen = new Set<string>();
    scenario.deck.forEach((card, index) => {
      if (seen.has(card.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["deck", index, "id"],
          message: "Card ids must be unique",
        });
      }
      seen.add(card.id);
      if (card.draftId !== undefined && !draftIds.has(card.draftId)) {
        ctx.addIssue({
          code: "custom",
          path: ["deck", index, "draftId"],
          message: "A card's draft must exist in the draw pile",
        });
      }
      const sources = [card.face, card.draftId, card.shellId, card.km].filter(
        (source) => source !== undefined
      );
      if (sources.length !== 1) {
        ctx.addIssue({
          code: "custom",
          path: ["deck", index, "face"],
          message:
            "A card needs exactly one of face data, a draft, a blank shell or KM data",
        });
      }
      if (card.km !== undefined) {
        const { km } = card;
        if (card.cardType !== "FIGURE") {
          ctx.addIssue({
            code: "custom",
            path: ["deck", index, "km"],
            message: "Only a Figure carries Kaplan–Meier data",
          });
        }
        if (km.populationSnapshotId !== scenario.populationSnapshot.id) {
          ctx.addIssue({
            code: "custom",
            path: ["deck", index, "km", "populationSnapshotId"],
            message: "A KM figure must reference the scenario's snapshot",
          });
        }
        const parent = scenario.deck.find((c) => c.id === km.parent.cardId);
        if (!parent || parent.cardType !== "TABLE") {
          ctx.addIssue({
            code: "custom",
            path: ["deck", index, "km", "parent", "cardId"],
            message: "A KM figure's parent must be a Table in the deck",
          });
        }
        km.records.forEach((record, r) => {
          if (!subjectIds.has(record.subjectId)) {
            ctx.addIssue({
              code: "custom",
              path: ["deck", index, "km", "records", r, "subjectId"],
              message:
                "A time-to-event record must name a subject in the snapshot",
            });
          }
        });
      }
      if (card.shellId !== undefined) {
        const shell = scenario.shells.find((s) => s.id === card.shellId);
        if (!shell?.layout) {
          ctx.addIssue({
            code: "custom",
            path: ["deck", index, "shellId"],
            message: "A blank shell must name a scenario shell with a layout",
          });
        } else if (
          card.cardType !== "TABLE" ||
          !(shell.compatiblePopulations ?? [shell.targetPopulation]).includes(
            card.population
          )
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["deck", index, "population"],
            message:
              "A blank shell is a Table whose suit is one of its shell's analysis sets",
          });
        }
      }
      if (
        card.face !== undefined &&
        card.face.kind !== FACE_KIND_BY_CARD_TYPE[card.cardType]
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["deck", index, "face", "kind"],
          message: "A card's face must match its card type",
        });
      }
    });
  });
/** A playable scenario. */
export type Scenario = z.infer<typeof ScenarioSchema>;

/**
 * One act of a run: a single study whose Blinds are played in order, Small
 * to Boss. Every Blind declares the study's opening population snapshot; the
 * run carries any later versions from one Blind into the next. An act with
 * a `bossPool` lists only its Small and Big Blinds: the run's seeded draw
 * picks the Boss from the pool, and a pool of one is fixed and not drawn.
 * Its `crisisDeck` is drawn from, without replacement, as each Blind after
 * the first starts.
 */
export const ActSchema = z
  .object({
    id: identifier,
    title: z.string().min(1),
    blinds: z.array(ScenarioSchema).min(1).max(3),
    bossPool: z.array(ScenarioSchema).min(1).optional(),
    crisisDeck: z.array(CrisisCardSchema).optional(),
    /**
     * Protocol deviations (#1087): as each Small or Big Blind starts, the
     * run's draw fires one with `chancePercent` odds, drawn from `deck`
     * without replacement across the run.
     */
    deviations: z
      .object({
        chancePercent: z.number().int().min(1).max(100),
        deck: z.array(DeviationEventSchema).min(1),
      })
      .optional(),
    /** The Procurement Shop between Blinds. Without it there is no shop. */
    shop: ShopCatalogSchema.optional(),
  })
  .superRefine((act, ctx) => {
    if (act.bossPool) {
      act.blinds.forEach((blind, index) => {
        if (blind.blind.tier === "BOSS_BLIND") {
          ctx.addIssue({
            code: "custom",
            path: ["blinds", index, "blind", "tier"],
            message: "An act with a boss pool draws its Boss from the pool",
          });
        }
      });
      const bossIds = new Set<string>();
      act.bossPool.forEach((boss, index) => {
        if (boss.blind.tier !== "BOSS_BLIND") {
          ctx.addIssue({
            code: "custom",
            path: ["bossPool", index, "blind", "tier"],
            message: "Every boss pool entry must be a Boss Blind",
          });
        }
        if (bossIds.has(boss.id)) {
          ctx.addIssue({
            code: "custom",
            path: ["bossPool", index, "id"],
            message: "Boss pool ids must be unique",
          });
        }
        bossIds.add(boss.id);
        if (
          boss.populationSnapshot.id !== act.blinds[0].populationSnapshot.id
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["bossPool", index, "populationSnapshot", "id"],
            message: "Every Blind in an act reads the study's one snapshot",
          });
        }
      });
    }
    const crisisIds = new Set<string>();
    const subjectIds = new Set(
      act.blinds[0].populationSnapshot.subjects.map((s) => s.id)
    );
    (act.crisisDeck ?? []).forEach((crisis, index) => {
      if (crisisIds.has(crisis.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["crisisDeck", index, "id"],
          message: "Crisis card ids must be unique",
        });
      }
      crisisIds.add(crisis.id);
      crisis.choices.forEach((choice, c) => {
        const subjectId = choice.effect.transition?.subjectId;
        if (subjectId !== undefined && !subjectIds.has(subjectId)) {
          ctx.addIssue({
            code: "custom",
            path: [
              "crisisDeck",
              index,
              "choices",
              c,
              "effect",
              "transition",
              "subjectId",
            ],
            message: "A crisis transition must name a subject in the snapshot",
          });
        }
      });
    });
    const deviationIds = new Set<string>();
    (act.deviations?.deck ?? []).forEach((event, index) => {
      if (deviationIds.has(event.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["deviations", "deck", index, "id"],
          message: "Deviation ids must be unique",
        });
      }
      deviationIds.add(event.id);
      if (!subjectIds.has(event.transition.subjectId)) {
        ctx.addIssue({
          code: "custom",
          path: ["deviations", "deck", index, "transition", "subjectId"],
          message: "A deviation must name a subject in the snapshot",
        });
      }
    });
    (act.shop?.sites ?? []).forEach((site, index) =>
      site.subjects.forEach((subject, j) => {
        if (subjectIds.has(subject.id)) {
          ctx.addIssue({
            code: "custom",
            path: ["shop", "sites", index, "subjects", j, "id"],
            message: "A site must enroll subjects new to the study",
          });
        }
      })
    );
    const tiers = BlindTierSchema.options;
    act.blinds.forEach((blind, index) => {
      if (index === 0) return;
      const previous = act.blinds[index - 1];
      if (
        tiers.indexOf(blind.blind.tier) <= tiers.indexOf(previous.blind.tier)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["blinds", index, "blind", "tier"],
          message: "Blinds must escalate: Small, then Big, then Boss",
        });
      }
      if (blind.populationSnapshot.id !== previous.populationSnapshot.id) {
        ctx.addIssue({
          code: "custom",
          path: ["blinds", index, "populationSnapshot", "id"],
          message: "Every Blind in an act reads the study's one snapshot",
        });
      }
    });
  });
/** One act of a run. */
export type Act = z.infer<typeof ActSchema>;

/**
 * Endless post-marketing mode (#1088): after CSR Lock the run may go on,
 * round after round, each round a new post-marketing study. A round's study
 * and its Boss are drawn by the run's seeded draw from the studies' boss
 * pools, and every quota is the study's authored quota scaled by
 * `quotaGrowth` to the power of the round number.
 */
export const EndlessSchema = z
  .object({
    id: identifier,
    title: z.string().min(1).max(60),
    /** The post-marketing studies a round can be; each has a boss pool. */
    studies: z.array(ActSchema).min(1).max(4),
    /** Each round's quotas: authored quota × quotaGrowth ^ round. */
    quotaGrowth: z.number().gt(1).max(4),
  })
  .superRefine((endless, ctx) => {
    const bossIds = new Set<string>();
    endless.studies.forEach((study, index) => {
      if (!study.bossPool) {
        ctx.addIssue({
          code: "custom",
          path: ["studies", index, "bossPool"],
          message: "A post-marketing study draws its Boss from a pool",
        });
      }
      for (const boss of study.bossPool ?? []) {
        if (bossIds.has(boss.id)) {
          ctx.addIssue({
            code: "custom",
            path: ["studies", index, "bossPool"],
            message: `Boss ${boss.id} is in more than one study's pool`,
          });
        }
        bossIds.add(boss.id);
      }
    });
  });
/** Endless post-marketing mode. */
export type Endless = z.infer<typeof EndlessSchema>;

/**
 * The campaign (#924): one compound carried through up to three studies,
 * played as one run, act after act. Moving to the next act starts a new
 * study, whose subjects, snapshots, SAP rulebook and compiled outputs are
 * its own; the run's relics, hand levels, tray and budget come along.
 */
export const CampaignSchema = z
  .object({
    id: identifier,
    title: z.string().min(1),
    acts: z.array(ActSchema).min(1).max(3),
    /** Endless post-marketing rounds, offered once the last act is won. */
    endless: EndlessSchema.optional(),
  })
  .superRefine((campaign, ctx) => {
    const actIds = new Set<string>();
    const blindIds = new Set<string>();
    campaign.acts.forEach((act, index) => {
      if (actIds.has(act.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["acts", index, "id"],
          message: "Act ids must be unique",
        });
      }
      actIds.add(act.id);
      for (const blind of [...act.blinds, ...(act.bossPool ?? [])]) {
        if (blindIds.has(blind.id)) {
          ctx.addIssue({
            code: "custom",
            path: ["acts", index],
            message: `Blind ${blind.id} appears in more than one act`,
          });
        }
        blindIds.add(blind.id);
      }
    });
  });
/** The three-act campaign. */
export type Campaign = z.infer<typeof CampaignSchema>;

const id = z.string().min(1).max(128);
const index = z.number().int().min(0).max(1000);

/**
 * The sponsor a run develops a compound for (#950): the client whose deck,
 * starting kit and one rule twist shape the run. Virtual Biotech is the
 * default and has no twist.
 */
export const SponsorIdSchema = z.enum([
  "VIRTUAL_BIOTECH",
  "ONCOLOGY_PHARMA",
  "CARDIO_MEGA_TRIAL",
  "RARE_DISEASE_BIOTECH",
]);
/** A sponsor's id. */
export type SponsorId = z.infer<typeof SponsorIdSchema>;

/**
 * A GCP-audit stake (#950), from 1 (Routine Monitoring) to 6 (Warning
 * Letter). Stakes are cumulative: stake N applies every rule from 1 to N.
 */
export const StakeSchema = z.number().int().min(1).max(6);
/** A GCP-audit stake, 1 to 6. */
export type Stake = z.infer<typeof StakeSchema>;

/**
 * Every move a run records, as data (#1079). A saved run is its seed and
 * these moves, replayed on load, so the save never holds a compiled value:
 * blinded outputs stay out of storage by construction.
 */
export const RunActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("TOGGLE_SELECT"), cardId: id }),
  z.object({ type: z.literal("PLAY_HAND") }),
  z.object({ type: z.literal("DISCARD") }),
  z.object({ type: z.literal("INSPECT_CARD"), cardId: id }),
  z.object({ type: z.literal("CLOSE_INSPECT") }),
  z.object({ type: z.literal("INSPECT_CELL"), row: index, col: index }),
  z.object({ type: z.literal("CORRECT_FINDING"), findingId: id }),
  z.object({ type: z.literal("TRACE_CELL"), row: index, col: index }),
  z.object({ type: z.literal("MOVE_CARD"), cardId: id, toIndex: index }),
  z.object({ type: z.literal("RECOMPILE"), cardId: id }),
  z.object({
    type: z.literal("ALLOCATE"),
    cardId: id,
    population: PopulationTypeSchema,
  }),
  z.object({ type: z.literal("APPLY_SEAL"), consumableId: id, cardId: id }),
  z.object({ type: z.literal("SELL_CONSUMABLE"), consumableId: id }),
  z.object({ type: z.literal("USE_GUIDANCE"), consumableId: id }),
  z.object({ type: z.literal("USE_AMENDMENT"), consumableId: id }),
  z.object({ type: z.literal("RESOLVE_CRISIS"), choiceId: id }),
  z.object({ type: z.literal("STRUCTURAL_QC"), cardId: id }),
  z.object({ type: z.literal("PEEK_BLINDED"), cardId: id }),
  z.object({
    type: z.literal("SET_SESSION"),
    session: z.enum(["OPEN", "CLOSED"]),
  }),
  z.object({ type: z.literal("CLAIM_RELIC"), relicId: id }),
  z.object({ type: z.literal("AMEND_PROTOCOL") }),
  z.object({ type: z.literal("NEXT_BLIND") }),
  z.object({ type: z.literal("CONTINUE_ENDLESS") }),
  z.object({ type: z.literal("END_RUN") }),
  z.object({ type: z.literal("CASH_OUT") }),
  z.object({ type: z.literal("REROLL") }),
  z.object({ type: z.literal("BUY"), slot: index }),
  z.object({ type: z.literal("BUY_PACK"), slot: index }),
  z.object({ type: z.literal("PICK_PACK_CARD"), cardId: id }),
  z.object({ type: z.literal("SKIP_PACK") }),
  z.object({ type: z.literal("SELL_RELIC"), relicId: id }),
]);

/** The save format's current version. */
export const RUN_SAVE_VERSION = 1;

/**
 * A saved run (#1079): the act, the seed and every move since the run
 * started. Loading replays the moves, so resuming never re-draws.
 */
export const RunSaveSchema = z.object({
  version: z.literal(RUN_SAVE_VERSION),
  actId: id,
  savedAt: z.string().datetime(),
  seed: z.string().regex(/^[A-Za-z0-9-]{1,64}$/),
  /** The run's sponsor. Absent in older saves, which are Virtual Biotech. */
  sponsorId: SponsorIdSchema.optional(),
  /** The run's stake. Absent in older saves, which are stake 1. */
  stake: StakeSchema.optional(),
  actions: z.array(RunActionSchema).max(5000),
});
/** A saved run, as stored. */
export type RunSave = z.infer<typeof RunSaveSchema>;
