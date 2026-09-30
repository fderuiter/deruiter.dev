import type {
  DebriefDimension,
  DebriefReport,
  DimensionScore,
  IncidentDebriefResult,
  OetMetrics,
  PatrolEvent,
  PatrolScenario,
  QualitativeObservation,
  ShiftDebriefSummary,
  ShiftPlayfulStats,
  ShiftState,
} from "./types";
import { evaluateOETCompliance } from "./oet-engine";
import { clamp } from "@/lib/game-utils";

/**
 * Contextual Debrief Engine (Milestone M7, Issue #753).
 *
 * Purity invariant (ADR 0042 / Epic #744): every function here consumes only
 * `PatrolEvent[]` and the optional `OetMetrics` object passed to it. Nothing
 * in this module imports the FSM (`engine.ts`) or scenario content packages —
 * it reads exclusively through the public `PatrolEvent` shape that those
 * modules already populate (`action`, `context`, `payload`, `scenarioId`,
 * `timestamp`, `description`).
 */

const DIMENSION_ORDER: readonly DebriefDimension[] = [
  "sceneManagement",
  "patientCare",
  "communication",
  "transportation",
  "operationalJudgment",
];

/** Public, ordered list of debrief dimensions for deterministic UI rendering. */
export const DEBRIEF_DIMENSION_ORDER: readonly DebriefDimension[] =
  DIMENSION_ORDER;

const BASE_DIMENSION_SCORE = 5;

const DIMENSION_LABELS: Record<DebriefDimension, string> = {
  sceneManagement: "Scene Management",
  patientCare: "Patient Care",
  communication: "Communication",
  transportation: "Transportation",
  operationalJudgment: "Operational Judgment",
};

const DIMENSION_RATING_FEEDBACK: Record<
  DebriefDimension,
  Record<DimensionScore["rating"], string>
> = {
  sceneManagement: {
    exemplary:
      "Scene hazards were identified and controlled before patient contact began.",
    proficient:
      "Scene safety was addressed with only minor gaps in hazard control.",
    developing:
      "Scene safety activity was limited or not clearly documented this incident.",
    "needs-attention":
      "Patient contact began before the scene was secured, creating avoidable risk.",
  },
  patientCare: {
    exemplary:
      "Assessment and neurovascular checks were thorough and consistently re-verified.",
    proficient:
      "Core assessment and reassessment steps were covered with minor gaps.",
    developing:
      "Assessment activity was limited or reassessment was not clearly logged.",
    "needs-attention":
      "Key clinical checks (PMS or reassessment) were missing around interventions.",
  },
  communication: {
    exemplary:
      "Delegation and radio traffic were clear, closed-loop, and left no ambiguity.",
    proficient:
      "Communication was generally clear with room for tighter closed-loop confirmation.",
    developing:
      "Limited communication or delegation activity was logged this incident.",
    "needs-attention":
      "Delegation or radio traffic was unclear or left tasks unconfirmed.",
  },
  transportation: {
    exemplary:
      "Toboggan transport was smooth and controlled, prioritizing patient comfort.",
    proficient:
      "Transport control was solid with only minor speed or steering roughness.",
    developing:
      "No meaningful transport telemetry was captured for this incident.",
    "needs-attention":
      "Transport showed rough handling: excess speed, abrupt turns, or collisions.",
  },
  operationalJudgment: {
    exemplary:
      "Decisions balanced safety, clinical priorities, and communication under pressure.",
    proficient: "Overall judgment was sound with minor areas to sharpen.",
    developing:
      "Limited signal on operational decision-making for this incident.",
    "needs-attention":
      "Decision sequencing created avoidable risk or confusion on scene.",
  },
};

const OVERALL_RATING_LABEL: Record<DimensionScore["rating"], string> = {
  exemplary: "Exemplary Field Performance",
  proficient: "Proficient Patrol Response",
  developing: "Developing Judgment: On Track",
  "needs-attention": "Needs Attention Before Next Call",
};

const SAFETY_ACTION_PATTERN = /assess-scene-safety|scene-safety|mark-hazard/;
const CROWD_ACTION_PATTERN = /crowd|bystander/;
const PMS_LABEL_PATTERN = /pms|neurovascular|pulse|motor|sensor/;
const AMBIGUITY_PATTERN =
  /delayed|repeated|dazed|uncertain|ambiguous|slow to answer/;

/** Safe, defensive numeric coercion guarding against NaN/undefined inputs (AGENTS.md #11). */
function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function actionIdOf(event: PatrolEvent): string {
  return String(event.action ?? event.type ?? "").toLowerCase();
}

function labelOf(event: PatrolEvent): string {
  const label = event.context?.label ?? event.title ?? "";
  return String(label).toLowerCase();
}

function categoryOf(event: PatrolEvent): string | undefined {
  const category = event.context?.category;
  return typeof category === "string" ? category : undefined;
}

function toTimestamp(event: PatrolEvent): number {
  if (typeof event.timestamp === "number" && Number.isFinite(event.timestamp)) {
    return event.timestamp;
  }
  const parsed = Date.parse(String(event.timestamp));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSceneSafetyEstablishedEvent(event: PatrolEvent): boolean {
  return SAFETY_ACTION_PATTERN.test(actionIdOf(event));
}

function isCrowdManagementEvent(event: PatrolEvent): boolean {
  return (
    CROWD_ACTION_PATTERN.test(actionIdOf(event)) ||
    CROWD_ACTION_PATTERN.test(labelOf(event))
  );
}

function isDialogueChoiceEvent(event: PatrolEvent): boolean {
  return actionIdOf(event) === "dialogue_choice";
}

function normalizeOetMetrics(metrics: Partial<OetMetrics>): OetMetrics {
  return {
    excessiveSpeedTime: safeNumber(metrics.excessiveSpeedTime),
    abruptDirectionChanges: safeNumber(metrics.abruptDirectionChanges),
    boundaryViolations: safeNumber(metrics.boundaryViolations),
    collisions: safeNumber(metrics.collisions),
    controlledStops: safeNumber(metrics.controlledStops),
    routeEfficiency: safeNumber(metrics.routeEfficiency, 100),
    judgmentScore: safeNumber(metrics.judgmentScore, 100),
  };
}

function roughnessPenaltyOf(metrics: OetMetrics): number {
  return (
    metrics.collisions * 3 +
    metrics.boundaryViolations * 1 +
    metrics.abruptDirectionChanges * 1 +
    Math.min(4, Math.floor(metrics.excessiveSpeedTime / 2))
  );
}

function classifyRideComfort(
  metrics: OetMetrics
): "smooth" | "moderate" | "rough" {
  const penalty = roughnessPenaltyOf(metrics);
  if (penalty >= 5 || metrics.collisions > 0) return "rough";
  if (penalty === 0 && metrics.judgmentScore >= 85) return "smooth";
  return "moderate";
}

function buildOetSummary(
  metrics: OetMetrics
): NonNullable<IncidentDebriefResult["oetSummary"]> {
  return {
    judgmentScore: metrics.judgmentScore,
    controlledStops: metrics.controlledStops,
    excessiveSpeedSeconds: metrics.excessiveSpeedTime,
    rideComfort: classifyRideComfort(metrics),
  };
}

interface RuleContext {
  events: PatrolEvent[];
  oetMetrics?: OetMetrics;
}

interface RuleResult {
  dimension: DebriefDimension;
  delta: number;
  observation?: Omit<QualitativeObservation, "id">;
}

interface DebriefRuleDefinition {
  id: string;
  evaluate(ctx: RuleContext): RuleResult | RuleResult[] | null;
}

/**
 * Declarative rule table evaluated against a single incident's ordered
 * `PatrolEvent[]` slice. Each rule inspects the event stream in isolation and
 * contributes a score delta (and, at most, one feedback card) to one or more
 * dimensions — no rule reaches outside the events/metrics it is handed.
 */
const DEBRIEF_RULES: DebriefRuleDefinition[] = [
  {
    // Scene Safety Priority: was the scene secured before clinical/transport action began?
    id: "scene-safety-priority",
    evaluate({ events }) {
      const hazardAlert = events.find((e) => actionIdOf(e) === "hazard_alert");
      if (hazardAlert) {
        return {
          dimension: "sceneManagement",
          delta: -4,
          observation: {
            dimension: "sceneManagement",
            sentiment: "constructive",
            headline: "Scene safety was compromised before patient contact.",
            detail:
              typeof hazardAlert.description === "string" &&
              hazardAlert.description.length > 0
                ? hazardAlert.description
                : "Patient care was initiated before uphill skier traffic was diverted.",
            relatedEventAction: hazardAlert.action ?? hazardAlert.type,
          },
        };
      }

      if (events.length === 0) return null;

      const safetyIndex = events.findIndex(isSceneSafetyEstablishedEvent);
      const interventionIndex = events.findIndex(
        (e) => categoryOf(e) === "treatment" || categoryOf(e) === "transport"
      );

      if (safetyIndex === -1) {
        return {
          dimension: "sceneManagement",
          delta: -2,
          observation: {
            dimension: "sceneManagement",
            sentiment: "caution",
            headline: "Scene safety assessment was not clearly documented.",
            detail:
              "No scene safety or hazard-control action was logged for this incident.",
          },
        };
      }

      if (interventionIndex === -1 || safetyIndex < interventionIndex) {
        return {
          dimension: "sceneManagement",
          delta: 4,
          observation: {
            dimension: "sceneManagement",
            sentiment: "positive",
            headline: "Scene control established before patient contact.",
            detail:
              "You established scene control and marked uphill hazards before patient contact.",
            relatedEventAction:
              events[safetyIndex].action ?? events[safetyIndex].type,
          },
        };
      }

      return {
        dimension: "sceneManagement",
        delta: -1,
        observation: {
          dimension: "sceneManagement",
          sentiment: "caution",
          headline: "Scene safety was addressed after care had already begun.",
          detail:
            "Scene control was established, but only after clinical or transport steps were already underway.",
        },
      };
    },
  },
  {
    // Neurovascular (PMS) Discipline: distal PMS checked before AND after splinting.
    id: "pms-discipline",
    evaluate({ events }) {
      const treatmentIndex = events.findIndex(
        (e) => categoryOf(e) === "treatment"
      );
      if (treatmentIndex === -1) return null;

      const treatmentEvent = events[treatmentIndex];
      const hasEmbeddedRecheck = PMS_LABEL_PATTERN.test(
        labelOf(treatmentEvent)
      );
      const hasPriorPmsCheck = events
        .slice(0, treatmentIndex)
        .some((e) => PMS_LABEL_PATTERN.test(labelOf(e)));

      if (hasPriorPmsCheck && hasEmbeddedRecheck) {
        return {
          dimension: "patientCare",
          delta: 4,
          observation: {
            dimension: "patientCare",
            sentiment: "positive",
            headline:
              "Neurovascular status verified before and after splinting.",
            detail:
              "Distal pulse, motor, and sensory function were checked both before and after the splinting intervention.",
            relatedEventAction: treatmentEvent.action ?? treatmentEvent.type,
          },
        };
      }

      return {
        dimension: "patientCare",
        delta: -3,
        observation: {
          dimension: "patientCare",
          sentiment: "constructive",
          headline:
            "Neurovascular re-check was not clearly logged around splinting.",
          detail:
            "A splinting or immobilization step was recorded without a clearly logged pulse, motor, and sensation check before and after.",
          relatedEventAction: treatmentEvent.action ?? treatmentEvent.type,
        },
      };
    },
  },
  {
    // Serial Reassessment: was diagnostic ambiguity followed up over time?
    id: "serial-reassessment",
    evaluate({ events }) {
      const reassessed = events.some((e) => /reassess/.test(actionIdOf(e)));
      if (reassessed) {
        return {
          dimension: "patientCare",
          delta: 3,
          observation: {
            dimension: "patientCare",
            sentiment: "positive",
            headline: "Patient status was re-checked over time.",
            detail:
              "Patient status was re-checked over time rather than accepted at first pass.",
          },
        };
      }

      const ambiguitySignal = events.some((e) =>
        AMBIGUITY_PATTERN.test(
          `${labelOf(e)} ${String(e.description ?? "").toLowerCase()}`
        )
      );
      if (ambiguitySignal) {
        return {
          dimension: "patientCare",
          delta: -2,
          observation: {
            dimension: "patientCare",
            sentiment: "constructive",
            headline:
              "Ambiguous findings were not followed up with reassessment.",
            detail:
              "Diagnostic ambiguity was noted, but no follow-up reassessment was logged.",
          },
        };
      }

      return null;
    },
  },
  {
    // Interpersonal & Closed-Loop Communication: delegation clarity and confirmation.
    id: "closed-loop-communication",
    evaluate({ events }) {
      const dialogueEvents = events.filter(isDialogueChoiceEvent);
      if (dialogueEvents.length === 0) return null;

      const results: RuleResult[] = [];
      const closedLoop = dialogueEvents.find(
        (e) => e.context?.closesLoop === true
      );
      const candidOrCollaborative = dialogueEvents.find(
        (e) =>
          e.context?.style === "candid" || e.context?.style === "collaborative"
      );
      const openEnded = dialogueEvents.find(
        (e) =>
          e.context?.style === "deferential" && e.context?.clarity === "low"
      );

      if (closedLoop) {
        results.push({
          dimension: "communication",
          delta: 4,
          observation: {
            dimension: "communication",
            sentiment: "positive",
            headline: "Delegation closed the loop with a confirmed read-back.",
            detail:
              "Delegation included an explicit closed-loop read-back, leaving no room for misunderstanding.",
            relatedEventAction: String(
              closedLoop.context?.optionId ?? closedLoop.action ?? ""
            ),
          },
        });
      } else if (candidOrCollaborative) {
        results.push({
          dimension: "communication",
          delta: 2,
          observation: {
            dimension: "communication",
            sentiment: "positive",
            headline: "Communication stayed candid and collaborative.",
            detail:
              "Communication style was candid and collaborative, keeping the team aligned.",
          },
        });
      } else if (openEnded) {
        results.push({
          dimension: "communication",
          delta: -1,
          observation: {
            dimension: "communication",
            sentiment: "constructive",
            headline: "Delegation left the task open-ended.",
            detail:
              "Delegation left the task open-ended, which can leave teammates unsure what to do.",
          },
        });
      }

      if (dialogueEvents.some((e) => e.context?.style === "candid")) {
        results.push({ dimension: "operationalJudgment", delta: 2 });
      }

      return results;
    },
  },
  {
    // Crowd & Bystander Management: congested-scene traffic/sightline control.
    id: "crowd-bystander-management",
    evaluate({ events }) {
      const crowdEvent = events.find(isCrowdManagementEvent);
      if (!crowdEvent) return null;
      return {
        dimension: "sceneManagement",
        delta: 2,
        observation: {
          dimension: "sceneManagement",
          sentiment: "positive",
          headline: "Crowd and bystander traffic was actively managed.",
          detail:
            "Onlookers and bystander traffic around the scene were actively directed, keeping sightlines clear.",
          relatedEventAction: crowdEvent.action ?? crowdEvent.type,
        },
      };
    },
  },
  {
    // Transportation Control & Patient Comfort: correlates live OET descent metrics.
    id: "transport-comfort",
    evaluate({ oetMetrics }) {
      if (!oetMetrics) return null;

      const penalty = roughnessPenaltyOf(oetMetrics);
      if (penalty > 0) {
        return {
          dimension: "transportation",
          delta: -Math.min(6, penalty),
          observation: {
            dimension: "transportation",
            sentiment:
              oetMetrics.collisions > 0 || penalty >= 5
                ? "constructive"
                : "caution",
            headline: "Descent control affected patient ride comfort.",
            detail:
              "The descent had rough moments: reduce speed and steering inputs for a smoother, more comfortable ride for the patient.",
          },
        };
      }

      if (oetMetrics.judgmentScore >= 85 && oetMetrics.controlledStops >= 1) {
        return {
          dimension: "transportation",
          delta: 4,
          observation: {
            dimension: "transportation",
            sentiment: "positive",
            headline: "Smooth, controlled toboggan transport.",
            detail:
              "Transport down the fall line was smooth and controlled, with deliberate stops rather than abrupt braking.",
          },
        };
      }

      return { dimension: "transportation", delta: 1 };
    },
  },
  {
    // Operational Judgment baseline: near-misses and descent-control outcomes.
    id: "operational-judgment-baseline",
    evaluate({ events, oetMetrics }) {
      const results: RuleResult[] = [];
      const hazardAlert = events.some((e) => actionIdOf(e) === "hazard_alert");

      if (hazardAlert) {
        results.push({
          dimension: "operationalJudgment",
          delta: -4,
          observation: {
            dimension: "operationalJudgment",
            sentiment: "constructive",
            headline: "A preventable near-miss affected overall judgment.",
            detail:
              "A scene hazard was not addressed before care began, creating a preventable near-miss.",
          },
        });
      } else if (events.length > 0) {
        results.push({ dimension: "operationalJudgment", delta: 2 });
      }

      if (oetMetrics) {
        if (oetMetrics.collisions > 0) {
          results.push({ dimension: "operationalJudgment", delta: -2 });
        } else if (oetMetrics.judgmentScore >= 85) {
          results.push({ dimension: "operationalJudgment", delta: 2 });
        }
      }

      return results;
    },
  },
];

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return BASE_DIMENSION_SCORE;
  return clamp(Math.round(value), 0, 10);
}

function rateScore(score: number): DimensionScore["rating"] {
  if (score >= 9) return "exemplary";
  if (score >= 7) return "proficient";
  if (score >= 5) return "developing";
  return "needs-attention";
}

function buildDimensionScores(
  deltas: Record<DebriefDimension, number>
): Record<DebriefDimension, DimensionScore> {
  const dimensions = {} as Record<DebriefDimension, DimensionScore>;
  for (const dimension of DIMENSION_ORDER) {
    const score = clampScore(BASE_DIMENSION_SCORE + (deltas[dimension] ?? 0));
    const rating = rateScore(score);
    dimensions[dimension] = {
      score,
      label: DIMENSION_LABELS[dimension],
      rating,
      feedback: DIMENSION_RATING_FEEDBACK[dimension][rating],
    };
  }
  return dimensions;
}

function deriveOverallRating(
  dimensions: Record<DebriefDimension, DimensionScore>
): string {
  const scores = DIMENSION_ORDER.map(
    (dimension) => dimensions[dimension].score
  );
  const average = scores.reduce((sum, s) => sum + s, 0) / (scores.length || 1);
  return OVERALL_RATING_LABEL[rateScore(clampScore(average))];
}

function emptyDeltas(): Record<DebriefDimension, number> {
  return {
    sceneManagement: 0,
    patientCare: 0,
    communication: 0,
    transportation: 0,
    operationalJudgment: 0,
  };
}

export interface DebriefScoreInput {
  events?: PatrolEvent[];
  oetMetrics?: OetMetrics;
  passedRules?: number;
  totalRules?: number;
  rawScore?: number;
}

export interface DebriefScoreResult {
  score: number;
  percentage: number;
  grade: "A" | "B" | "C" | "D" | "F";
  rating: "exemplary" | "proficient" | "developing" | "needs-attention";
  summary: string;
}

/**
 * Calculates a debrief score percentage, letter grade, and performance rating from various performance inputs.
 */
export function calculateDebriefScore(
  input?: PatrolEvent[] | DebriefScoreInput | number,
  secondaryInput?: OetMetrics | number
): DebriefScoreResult {
  let percentage = 50;

  if (typeof input === "number") {
    if (typeof secondaryInput === "number" && secondaryInput > 0) {
      percentage = Math.round((Math.max(0, input) / secondaryInput) * 100);
    } else {
      percentage = Math.round(input);
    }
  } else if (Array.isArray(input)) {
    const oetMetrics =
      secondaryInput && typeof secondaryInput === "object"
        ? (secondaryInput as OetMetrics)
        : undefined;
    const result = evaluateIncidentDebrief("incident", input, oetMetrics);
    const dimensionScores = DIMENSION_ORDER.map(
      (dim) => result.dimensions[dim].score
    );
    const avgScore =
      dimensionScores.reduce((sum, s) => sum + s, 0) /
      (dimensionScores.length || 1);
    percentage = Math.round(avgScore * 10);
  } else if (input && typeof input === "object") {
    if (typeof input.rawScore === "number" && Number.isFinite(input.rawScore)) {
      percentage = Math.round(input.rawScore);
    } else if (
      typeof input.passedRules === "number" &&
      typeof input.totalRules === "number" &&
      input.totalRules > 0
    ) {
      percentage = Math.round(
        (Math.max(0, input.passedRules) / input.totalRules) * 100
      );
    } else if (Array.isArray(input.events)) {
      const result = evaluateIncidentDebrief(
        "incident",
        input.events,
        input.oetMetrics
      );
      const dimensionScores = DIMENSION_ORDER.map(
        (dim) => result.dimensions[dim].score
      );
      const avgScore =
        dimensionScores.reduce((sum, s) => sum + s, 0) /
        (dimensionScores.length || 1);
      percentage = Math.round(avgScore * 10);
    }
  }

  percentage = clamp(safeNumber(percentage, 50), 0, 100);

  let grade: "A" | "B" | "C" | "D" | "F";
  let rating: "exemplary" | "proficient" | "developing" | "needs-attention";
  let summary: string;

  if (percentage >= 90) {
    grade = "A";
    rating = "exemplary";
    summary = OVERALL_RATING_LABEL.exemplary;
  } else if (percentage >= 80) {
    grade = "B";
    rating = "proficient";
    summary = OVERALL_RATING_LABEL.proficient;
  } else if (percentage >= 70) {
    grade = "C";
    rating = "developing";
    summary = OVERALL_RATING_LABEL.developing;
  } else if (percentage >= 60) {
    grade = "D";
    rating = "developing";
    summary = OVERALL_RATING_LABEL.developing;
  } else {
    grade = "F";
    rating = "needs-attention";
    summary = OVERALL_RATING_LABEL["needs-attention"];
  }

  return {
    score: percentage,
    percentage,
    grade,
    rating,
    summary,
  };
}

/**
 * Evaluates a single incident's contextual debrief from its `PatrolEvent[]`
 * slice and optional live OET descent metrics.
 *
 * Never crashes on an empty or malformed event history: every dimension
 * falls back to a neutral "developing" baseline (AGENTS.md #11).
 */
export function evaluateIncidentDebrief(
  scenarioId: string,
  events: PatrolEvent[],
  oetMetrics?: OetMetrics
): IncidentDebriefResult {
  const orderedEvents = (Array.isArray(events) ? [...events] : []).sort(
    (a, b) => toTimestamp(a) - toTimestamp(b)
  );
  const effectiveOetMetrics = oetMetrics ?? extractOetMetrics(orderedEvents);
  const normalizedOetMetrics = effectiveOetMetrics
    ? normalizeOetMetrics(effectiveOetMetrics)
    : undefined;
  const ctx: RuleContext = {
    events: orderedEvents,
    oetMetrics: normalizedOetMetrics,
  };

  const deltas = emptyDeltas();
  const observations: QualitativeObservation[] = [];

  for (const rule of DEBRIEF_RULES) {
    const outcome = rule.evaluate(ctx);
    if (!outcome) continue;
    const results = Array.isArray(outcome) ? outcome : [outcome];
    for (const result of results) {
      deltas[result.dimension] += result.delta;
      if (result.observation) {
        observations.push({
          id: `obs-${scenarioId || "incident"}-${rule.id}`,
          ...result.observation,
        });
      }
    }
  }

  if (observations.length === 0) {
    observations.push({
      id: `obs-${scenarioId || "incident"}-baseline`,
      dimension: "operationalJudgment",
      sentiment: "positive",
      headline: "Baseline Protocols Maintained",
      detail:
        "Standard operational protocols were maintained throughout this incident.",
    });
  }

  const dimensions = buildDimensionScores(deltas);

  return {
    scenarioId,
    dimensions,
    overallRating: deriveOverallRating(dimensions),
    observations,
    oetSummary: normalizedOetMetrics
      ? buildOetSummary(normalizedOetMetrics)
      : undefined,
  };
}

/**
 * Extracts the most recent completed OET descent's metrics from a
 * `PatrolEvent[]` slice (reading the `OET_TRANSPORT_COMPLETED` event's own
 * `payload`/`context`), for callers that need to hand metrics into
 * `evaluateIncidentDebrief` themselves rather than going through
 * `compileShiftSummary`.
 */
export function extractOetMetrics(
  events: PatrolEvent[]
): OetMetrics | undefined {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (actionIdOf(event) !== "oet_transport_completed") continue;
    const raw =
      (event.payload?.metrics as Partial<OetMetrics> | undefined) ??
      (event.context?.metrics as Partial<OetMetrics> | undefined);
    if (raw && typeof raw === "object") {
      return normalizeOetMetrics(raw);
    }
  }
  return undefined;
}

function averageDimensions(
  results: Record<DebriefDimension, DimensionScore>[]
): Record<DebriefDimension, DimensionScore> {
  if (results.length === 0) {
    return buildDimensionScores(emptyDeltas());
  }

  const sums = emptyDeltas();
  for (const dims of results) {
    for (const dimension of DIMENSION_ORDER) {
      sums[dimension] += dims[dimension].score;
    }
  }

  const dimensions = {} as Record<DebriefDimension, DimensionScore>;
  for (const dimension of DIMENSION_ORDER) {
    const score = clampScore(sums[dimension] / results.length);
    const rating = rateScore(score);
    dimensions[dimension] = {
      score,
      label: DIMENSION_LABELS[dimension],
      rating,
      feedback: DIMENSION_RATING_FEEDBACK[dimension][rating],
    };
  }
  return dimensions;
}

function deriveCommunicationRating(dialogueEvents: PatrolEvent[]): string {
  if (dialogueEvents.length === 0) return "No Delegation Logged";
  if (dialogueEvents.some((e) => e.context?.closesLoop === true)) {
    return "Clear & Confirmed";
  }
  const collaborativeCount = dialogueEvents.filter(
    (e) => e.context?.style === "candid" || e.context?.style === "collaborative"
  ).length;
  if (collaborativeCount >= dialogueEvents.length / 2) return "Collaborative";
  return "Could Be Clearer";
}

/**
 * Derives non-clinical, operational activity counters from a shift's full
 * `PatrolEvent[]` history. Every counter is a single pass filter/count over
 * disjoint predicates, so no event is ever attributed to a counter twice.
 */
export function derivePlayfulStats(events: PatrolEvent[]): ShiftPlayfulStats {
  const safeEvents = Array.isArray(events) ? events : [];

  const callsHandled = safeEvents.filter(
    (e) =>
      actionIdOf(e).startsWith("phase_transition") &&
      e.context?.to === "DISPATCH"
  ).length;

  // Category-only match: every RECORD_ACTION-sourced event carries its scenario
  // action's category verbatim, and phase-transition bookkeeping events (whose
  // action string can itself contain "DISPATCH") never do — so this can't
  // mistake a phase change for a radio transmission.
  const radioTransmissions = safeEvents.filter(
    (e) => categoryOf(e) === "communication"
  ).length;

  const patientScenarioIds = new Set<string>();
  for (const event of safeEvents) {
    const category = categoryOf(event);
    if (
      (category === "assessment" || category === "treatment") &&
      event.scenarioId &&
      event.scenarioId !== "hub" &&
      event.scenarioId !== "unknown" &&
      event.scenarioId !== "ambient-ops"
    ) {
      patientScenarioIds.add(event.scenarioId);
    }
  }

  const sledTransports = safeEvents.filter(
    (e) => actionIdOf(e) === "oet_transport_completed"
  ).length;

  const checkedTrails = new Set<string>();
  for (const event of safeEvents) {
    if (
      event.scenarioId &&
      event.scenarioId !== "hub" &&
      event.scenarioId !== "unknown" &&
      event.scenarioId !== "ambient-ops"
    ) {
      checkedTrails.add(String(event.context?.location ?? event.scenarioId));
    } else if (event.context?.trail || event.context?.location) {
      checkedTrails.add(String(event.context.trail ?? event.context.location));
    }
  }

  const hazardsMarked = safeEvents.filter(
    (e) => isSceneSafetyEstablishedEvent(e) || isCrowdManagementEvent(e)
  ).length;

  const pmsChecksPerformed = safeEvents.filter((e) =>
    PMS_LABEL_PATTERN.test(labelOf(e))
  ).length;

  const reassessmentsLogged = safeEvents.filter((e) =>
    /reassess/.test(actionIdOf(e))
  ).length;

  const dialogueEvents = safeEvents.filter(isDialogueChoiceEvent);
  const closedLoopDelegations = dialogueEvents.filter(
    (e) => e.context?.closesLoop === true
  ).length;

  const guestsAssisted = safeEvents.filter(
    (e) =>
      e.context?.guestAssisted === true ||
      /guest-assisted|assist-guest/.test(actionIdOf(e))
  ).length;

  return {
    callsHandled,
    radioTransmissions,
    patientsAssisted: patientScenarioIds.size,
    guestsAssisted,
    sledTransports,
    trailsChecked: checkedTrails.size,
    hazardsMarked,
    pmsChecksPerformed,
    reassessmentsLogged,
    closedLoopDelegations,
    communicationRating: deriveCommunicationRating(dialogueEvents),
  };
}

function buildChronologicalHighlights(events: PatrolEvent[]): string[] {
  const highlights: string[] = [];

  for (const event of events) {
    const id = actionIdOf(event);
    if (id === "hazard_alert") {
      highlights.push(
        `Near-miss flagged: ${event.description ?? event.title ?? "scene safety compromised"}.`
      );
    } else if (isSceneSafetyEstablishedEvent(event)) {
      if (event.scenarioId === "ambient-ops" || event.scenarioId === "hub") {
        const loc =
          event.context?.trail ?? event.context?.location ?? "the hill";
        highlights.push(`Hazard marked and secured on ${loc}.`);
      } else {
        highlights.push(
          `Scene safety secured on ${event.scenarioId ?? "an incident"}.`
        );
      }
    } else if (isCrowdManagementEvent(event)) {
      highlights.push(
        `Crowd and bystander traffic managed on ${event.scenarioId ?? "an incident"}.`
      );
    } else if (isDialogueChoiceEvent(event)) {
      const speaker = String(event.context?.speaker ?? "a teammate");
      highlights.push(
        event.context?.closesLoop === true
          ? `Closed-loop delegation to ${speaker}.`
          : `Delegation exchange with ${speaker}.`
      );
    } else if (/reassess/.test(id)) {
      highlights.push(
        `Patient reassessed on ${event.scenarioId ?? "an incident"}.`
      );
    } else if (id === "oet_transport_completed") {
      const metrics = extractOetMetrics([event]);
      highlights.push(
        `OET transport completed${
          metrics ? ` with judgment score ${metrics.judgmentScore}%` : ""
        }.`
      );
    } else if (event.context?.guestAssisted === true) {
      const loc = event.context?.trail ?? event.context?.location ?? "the hill";
      highlights.push(`Assisted guests on ${loc}.`);
    }
  }

  return highlights.slice(-12);
}

/**
 * Compiles the end-of-shift debrief summary by grouping a shift's full
 * `PatrolEvent[]` history back into per-incident slices (by `scenarioId`),
 * evaluating each independently, and aggregating the results.
 */
export function compileShiftSummary(
  events: PatrolEvent[],
  elapsedMinutes: number
): ShiftDebriefSummary {
  const orderedEvents = (Array.isArray(events) ? [...events] : []).sort(
    (a, b) => toTimestamp(a) - toTimestamp(b)
  );

  const scenarioOrder: string[] = [];
  for (const event of orderedEvents) {
    const id = event.scenarioId;
    if (
      id &&
      id !== "hub" &&
      id !== "unknown" &&
      id !== "ambient-ops" &&
      !scenarioOrder.includes(id)
    ) {
      scenarioOrder.push(id);
    }
  }

  const incidentResults = scenarioOrder.map((scenarioId) => {
    const incidentEvents = orderedEvents.filter(
      (e) => e.scenarioId === scenarioId
    );
    return evaluateIncidentDebrief(
      scenarioId,
      incidentEvents,
      extractOetMetrics(incidentEvents)
    );
  });

  return {
    totalIncidents: incidentResults.length,
    elapsedShiftMinutes: Math.max(0, safeNumber(elapsedMinutes)),
    incidentResults,
    compositeDimensions: averageDimensions(
      incidentResults.map((r) => r.dimensions)
    ),
    playfulStats: derivePlayfulStats(orderedEvents),
    chronologicalHighlights: buildChronologicalHighlights(orderedEvents),
  };
}

/**
 * Legacy debrief report generator retained for backward compatibility with
 * existing container routes and the M1-era `DebriefReport` shape.
 */
export function generateDebriefReport(
  scenario: PatrolScenario,
  shiftState: ShiftState
): DebriefReport {
  const oetResult = evaluateOETCompliance(
    scenario,
    shiftState.actionHistory,
    shiftState.activeEvents
  );

  const rules = oetResult.evaluatedRules ?? scenario.debriefRules;
  const passedRules = rules.filter((r) => r.passed);
  const failedRules = rules.filter((r) => !r.passed);

  return {
    scenarioId: scenario.id,
    totalTimeMinutes: shiftState.timeElapsedMinutes,
    score: oetResult.score,
    maxPossibleScore: 100,
    passedRules,
    failedRules,
    summary: `Shift completed for ${scenario.title}. Performance score: ${oetResult.score}%. Actions taken: ${shiftState.actionHistory.length}.`,
  };
}
