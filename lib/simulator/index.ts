/**
 * Architectural Archetype simulator: the decision tree behind `/simulator`
 * and the pure, deterministic scoring that turns three answers into an
 * archetype and four decision stats.
 *
 * The route stores progress as answer indices in the URL hash (`ans=0,1,0`),
 * so everything here is a function of those indices alone: the same path
 * always yields the same archetype, stats and report.
 *
 * @module
 */

/** The four decision axes every option contributes to. */
export type SimulatorAxis = "systems" | "ui" | "resilience" | "velocity";

/** Points an option adds to each decision axis. */
export type AxisPoints = Record<SimulatorAxis, number>;

/** One selectable answer in a simulator question. */
export interface SimulatorOption {
  /** Short option label shown as the button's accessible name. */
  text: string;
  /** The technical trade-off the option commits to. */
  description: string;
  /** Points added to each axis when the option is chosen. */
  points: AxisPoints;
  /** The step reached after choosing the option. */
  nextStep: SimulatorStepId;
}

/** Identifiers of the question steps, in tree order. */
export type SimulatorQuestionId =
  "architecture_bias" | "incident_triage" | "code_review";

/** Any step the simulator can show, including the final evaluation. */
export type SimulatorStepId = SimulatorQuestionId | "final_eval";

/** A single question in the decision tree. */
export interface SimulatorQuestion {
  /** Stable step identifier, also written to the `step` hash parameter. */
  id: SimulatorQuestionId;
  /** Visible heading of the question card. */
  title: string;
  /** The scenario the question poses. */
  subtitle: string;
  /** Stage label shown above the heading. */
  badge: string;
  /** The two answers, in display order. Their index is what the hash stores. */
  options: SimulatorOption[];
}

/** The first step of the tree. */
export const SIMULATOR_START_STEP: SimulatorQuestionId = "architecture_bias";

/** The terminal step that renders the Architectural Archetype evaluation. */
export const SIMULATOR_FINAL_STEP = "final_eval" as const;

/** Display order and labels of the four decision axes. */
export const SIMULATOR_AXES: ReadonlyArray<{
  key: SimulatorAxis;
  label: string;
}> = [
  { key: "systems", label: "Systems Rigor" },
  { key: "ui", label: "UI/UX Craft" },
  { key: "resilience", label: "Resilience" },
  { key: "velocity", label: "Velocity" },
];

/**
 * The decision tree. Question 1 sets the architecture bias (systems or
 * interface), question 2 mostly sets the operational stance (resilience or
 * velocity), and question 3 reinforces one side of each.
 */
export const SIMULATOR_QUESTIONS: Readonly<
  Record<SimulatorQuestionId, SimulatorQuestion>
> = {
  architecture_bias: {
    id: "architecture_bias",
    title: "1. Choose Your Architecture Bias",
    subtitle:
      "A new service is starting from a blank repository and the schedule allows deep investment in only one layer first. Which trade-off do you make?",
    badge: "Stage 1 · Architecture Bias",
    options: [
      {
        text: "Systems Rigor & Fault Isolation",
        description:
          "Define strict service contracts, bulkheads and typed schemas before any screen exists. Failures stay contained, at the cost of a slower first demo.",
        points: { systems: 4, ui: 0, resilience: 0, velocity: 0 },
        nextStep: "incident_triage",
      },
      {
        text: "Interface Clarity & Human Ergonomics",
        description:
          "Prototype the workflow with real users first, then harden the backend around the interactions that matter. Feedback arrives early, while the internals stay provisional longer.",
        points: { systems: 0, ui: 4, resilience: 0, velocity: 0 },
        nextStep: "incident_triage",
      },
    ],
  },
  incident_triage: {
    id: "incident_triage",
    title: "2. Live Incident Commander: Production Latency Spike",
    subtitle:
      "A critical payment webhook experiences a 500ms p99 latency spike and 2% connection pool timeouts under high load. What is your immediate mitigation strategy?",
    badge: "Stage 2 · Live Outage Triage",
    options: [
      {
        text: "Engage Distributed Circuit Breaker & Fallback Queue",
        description:
          "Gracefully buffer non-critical requests to secondary Redis queue, shed downstream load, and alert database pool orchestrators.",
        points: { systems: 1, ui: 0, resilience: 3, velocity: 0 },
        nextStep: "code_review",
      },
      {
        text: "Scale Neon Read-Replicas & Increase Pool Timeouts",
        description:
          "Increase serverless connection concurrency and dynamically redirect read queries away from the primary transactional instance.",
        points: { systems: 1, ui: 0, resilience: 0, velocity: 3 },
        nextStep: "code_review",
      },
    ],
  },
  code_review: {
    id: "code_review",
    title: "3. Code Review Speed Challenge",
    subtitle:
      "Reviewing a high-throughput async processing pipeline: which architectural safeguard takes absolute priority?",
    badge: "Stage 3 · Systems Review",
    options: [
      {
        text: "Enforce Exhaustive Idempotency Keys & Deduplication Window",
        description:
          "Guarantee that webhook retransmissions and network blips never cause double-writes or race conditions in Postgres.",
        points: { systems: 2, ui: 0, resilience: 2, velocity: 0 },
        nextStep: "final_eval",
      },
      {
        text: "Implement Client-Side Optimistic Updates with Rollback",
        description:
          "Deliver instant sub-10ms UI feedback while verifying transaction settlement asynchronously via server-sent events.",
        points: { systems: 0, ui: 2, resilience: 0, velocity: 2 },
        nextStep: "final_eval",
      },
    ],
  },
};

/** Identifiers of the four Architectural Archetypes. */
export type ArchetypeId =
  | "fault-isolation-architect"
  | "distributed-systems-pragmatist"
  | "human-centered-systems-architect"
  | "product-velocity-engineer";

/** A named archetype and what it says about the chosen path. */
export interface Archetype {
  /** Stable identifier. */
  id: ArchetypeId;
  /** Display title. */
  title: string;
  /** One or two sentences describing the pattern of decisions. */
  summary: string;
  /** Which of systems or ui the archetype leans towards. */
  bias: "systems" | "ui";
  /** Which of resilience or velocity the archetype leans towards. */
  stance: "resilience" | "velocity";
}

/**
 * The four archetypes, one per combination of bias (systems or interface)
 * and operational stance (resilience or velocity).
 */
export const ARCHETYPES: Readonly<Record<ArchetypeId, Archetype>> = {
  "fault-isolation-architect": {
    id: "fault-isolation-architect",
    title: "Fault-Isolation Architect",
    summary:
      "You invest in contracts and containment first, and when production degrades you protect correctness before throughput. Your systems fail small and recover predictably.",
    bias: "systems",
    stance: "resilience",
  },
  "distributed-systems-pragmatist": {
    id: "distributed-systems-pragmatist",
    title: "Distributed Systems Pragmatist",
    summary:
      "You care about sound backend structure, but you reach for capacity and fast mitigation when the pager goes off. You keep the platform moving and fix root causes once the fire is out.",
    bias: "systems",
    stance: "velocity",
  },
  "human-centered-systems-architect": {
    id: "human-centered-systems-architect",
    title: "Human-Centered Systems Architect",
    summary:
      "You start from how people use the product, then back it with safeguards that keep their data correct. Interface clarity and operational durability carry equal weight in your designs.",
    bias: "ui",
    stance: "resilience",
  },
  "product-velocity-engineer": {
    id: "product-velocity-engineer",
    title: "Product Velocity Engineer",
    summary:
      "You optimise for fast, visible feedback: early prototypes, responsive interfaces and quick mitigations. You accept provisional internals in exchange for learning sooner.",
    bias: "ui",
    stance: "velocity",
  },
};

/** The scored result of a completed path. */
export interface SimulatorEvaluation {
  /** The archetype the path maps to. */
  archetype: Archetype;
  /** Raw points accumulated on each axis. */
  totals: AxisPoints;
  /** Each axis as a whole-number share (0 to 100) of its maximum over the tree. */
  stats: AxisPoints;
  /** The axis with the highest stat, ties broken in {@link SIMULATOR_AXES} order. */
  leadAxis: SimulatorAxis;
}

const ZERO_POINTS: AxisPoints = {
  systems: 0,
  ui: 0,
  resilience: 0,
  velocity: 0,
};

/**
 * Sums the axis points of the chosen options.
 *
 * @param options - The options chosen, in any order.
 * @returns The per-axis totals.
 */
export function sumAxisPoints(options: readonly SimulatorOption[]): AxisPoints {
  return options.reduce<AxisPoints>(
    (acc, option) => ({
      systems: acc.systems + option.points.systems,
      ui: acc.ui + option.points.ui,
      resilience: acc.resilience + option.points.resilience,
      velocity: acc.velocity + option.points.velocity,
    }),
    ZERO_POINTS
  );
}

/**
 * The highest total each axis can reach on any single path through the tree,
 * used to normalise stats to 0 to 100.
 *
 * @returns The per-axis maximum.
 */
export function maxAxisPoints(): AxisPoints {
  const result = { ...ZERO_POINTS };
  for (const question of Object.values(SIMULATOR_QUESTIONS)) {
    for (const { key } of SIMULATOR_AXES) {
      result[key] += Math.max(...question.options.map((o) => o.points[key]));
    }
  }
  return result;
}

/**
 * Maps axis totals to an archetype. The bias is systems unless UI/UX craft
 * scored strictly higher; the stance is resilience unless velocity scored
 * strictly higher. Ties therefore resolve to systems and resilience, so the
 * result never depends on answer order.
 *
 * @param totals - Raw per-axis totals.
 * @returns The matching archetype.
 */
export function resolveArchetype(totals: AxisPoints): Archetype {
  const bias = totals.ui > totals.systems ? "ui" : "systems";
  const stance =
    totals.velocity > totals.resilience ? "velocity" : "resilience";
  const match = Object.values(ARCHETYPES).find(
    (archetype) => archetype.bias === bias && archetype.stance === stance
  );
  // The four archetypes cover every bias and stance combination.
  return match ?? ARCHETYPES["fault-isolation-architect"];
}

/**
 * Scores a set of chosen options into an archetype, raw totals, normalised
 * stats and the lead axis. Pure and deterministic.
 *
 * @param options - The chosen options.
 * @returns The evaluation.
 */
export function evaluateDecisions(
  options: readonly SimulatorOption[]
): SimulatorEvaluation {
  const totals = sumAxisPoints(options);
  const max = maxAxisPoints();
  const stats = { ...ZERO_POINTS };
  for (const { key } of SIMULATOR_AXES) {
    stats[key] = max[key] > 0 ? Math.round((totals[key] / max[key]) * 100) : 0;
  }
  let leadAxis: SimulatorAxis = SIMULATOR_AXES[0].key;
  for (const { key } of SIMULATOR_AXES) {
    if (stats[key] > stats[leadAxis]) leadAxis = key;
  }
  return { archetype: resolveArchetype(totals), totals, stats, leadAxis };
}

/**
 * Parses the `ans` hash parameter (comma-separated option indices).
 *
 * @param raw - The raw parameter value.
 * @returns The integer indices, skipping anything unparsable.
 */
export function parseAnswerIndices(raw: string | undefined | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));
}

/** The simulator state derived from the hash parameters. */
export interface SimulatorState {
  /** The step to show. */
  currentStep: SimulatorStepId;
  /** The question steps already answered, in order. */
  history: SimulatorQuestionId[];
  /** The options chosen, in order. */
  answers: SimulatorOption[];
}

/**
 * Replays answer indices through the tree, stopping at the first index that
 * does not name an option of the current question.
 *
 * @param indices - Option indices, one per answered question.
 * @returns The step reached, the steps visited and the options chosen.
 */
export function replayAnswers(indices: readonly number[]): {
  step: SimulatorStepId;
  history: SimulatorQuestionId[];
  answers: SimulatorOption[];
} {
  let step: SimulatorStepId = SIMULATOR_START_STEP;
  const history: SimulatorQuestionId[] = [];
  const answers: SimulatorOption[] = [];
  for (const index of indices) {
    if (step === SIMULATOR_FINAL_STEP) break;
    const option: SimulatorOption | undefined =
      SIMULATOR_QUESTIONS[step].options[index];
    if (!option) break;
    history.push(step);
    answers.push(option);
    step = option.nextStep;
  }
  return { step, history, answers };
}

function isStepId(value: string): value is SimulatorStepId {
  return value === SIMULATOR_FINAL_STEP || value in SIMULATOR_QUESTIONS;
}

/**
 * Resolves the visible step, visited history and chosen options from the
 * `step` and `ans` hash parameters. An unknown `step` falls back to the first
 * question; a missing one resumes after the last replayable answer. A
 * `final_eval` step without three valid answers falls back to the step the
 * answers reach, so the evaluation is never scored from a partial path.
 *
 * @param rawStep - The `step` parameter.
 * @param rawAns - The `ans` parameter.
 * @returns The derived state.
 */
export function deriveSimulatorState(
  rawStep: string | undefined | null,
  rawAns: string | undefined | null
): SimulatorState {
  const replayed = replayAnswers(parseAnswerIndices(rawAns));
  let currentStep: SimulatorStepId = replayed.step;
  if (rawStep) {
    currentStep = isStepId(rawStep) ? rawStep : SIMULATOR_START_STEP;
  }
  if (
    currentStep === SIMULATOR_FINAL_STEP &&
    replayed.step !== SIMULATOR_FINAL_STEP
  ) {
    currentStep = replayed.step;
  }
  return {
    currentStep,
    history: replayed.history,
    answers: replayed.answers,
  };
}

/**
 * Formats a plain-text report of an evaluation for the clipboard.
 *
 * @param evaluation - The scored result.
 * @param answers - The chosen options, in order.
 * @param replayUrl - An absolute URL that reopens this result.
 * @returns The report text.
 */
export function formatSimulatorReport(
  evaluation: SimulatorEvaluation,
  answers: readonly SimulatorOption[],
  replayUrl: string
): string {
  const statLines = SIMULATOR_AXES.map(
    ({ key, label }) => `- ${label}: ${evaluation.stats[key]}/100`
  );
  const decisionLines = answers.map(
    (option, index) => `${index + 1}. ${option.text}`
  );
  return [
    `Architectural Archetype: ${evaluation.archetype.title}`,
    evaluation.archetype.summary,
    "",
    "Decision stats:",
    ...statLines,
    "",
    "Decisions:",
    ...decisionLines,
    "",
    `Replay: ${replayUrl}`,
  ].join("\n");
}
