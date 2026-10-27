import {
  standardsBillOfMaterials,
  type StandardCheck,
} from "@/lib/clinical-standards";
import { CONFORMANCE_RULES } from "../conformance/rules";
import { MESSY_DATA_SCENARIOS } from "../synth/scenarios";
import type {
  RecordedExplanation,
  RecordedFindings,
  RecordedRule,
} from "./recorded";

/**
 * The conformance matrix's rule families (#2992 step 6), layered from the
 * structure of a file up to the site's own rules, each with what ran and
 * what it found. Everything here is read from committed files at build time:
 * the standards bill of materials, CDISC CORE's recorded findings and the
 * local rule set. Nothing runs a validator when the page is served.
 */

/**
 * How one rule or check came out. `pass`: it ran and found nothing.
 * `fail`: it ran and reported findings. `not-applicable`: it ran and the
 * data has nothing it applies to (CORE's SKIPPED). `not-evaluated`: it
 * exists but this site does not run it. `unsupported`: no rules exist for
 * this target in the engine named. `execution-error`: the engine could not
 * finish the rule.
 */
export type RuleState =
  | "pass"
  | "fail"
  | "not-applicable"
  | "not-evaluated"
  | "unsupported"
  | "execution-error";

/** The states in the order the matrix shows them. */
export const RULE_STATES: readonly RuleState[] = [
  "pass",
  "fail",
  "not-applicable",
  "not-evaluated",
  "unsupported",
  "execution-error",
];

/** A file in the repository that holds a layer's evidence. */
export interface LayerEvidence {
  readonly label: string;
  readonly path: string;
}

/** One rule family in the matrix. */
export interface RuleLayer {
  readonly id: string;
  readonly title: string;
  /** Who wrote the rules. */
  readonly author: string;
  /** What runs them, and when. */
  readonly runBy: string;
  /** What they ran over. */
  readonly scope: string;
  /** What each counted item is. */
  readonly unit: "rule" | "check";
  /** Items by state. Empty when the layer is one state as a whole. */
  readonly outcomes: Readonly<Partial<Record<RuleState, number>>>;
  /** The whole layer's state, when it has no per-item outcomes. */
  readonly state?: RuleState;
  /** Failing rules whose every finding has a recorded explanation. */
  readonly explainedFailures?: number;
  readonly note: string;
  readonly evidence: readonly LayerEvidence[];
}

const STATE_OF_CORE_STATUS: Readonly<Record<string, RuleState>> = {
  SUCCESS: "pass",
  "ISSUE REPORTED": "fail",
  SKIPPED: "not-applicable",
  "EXECUTION ERROR": "execution-error",
};

/**
 * CORE's rule outcomes as matrix states, and how many failing rules have
 * every finding in the view explained.
 *
 * @param rules - CORE's rules for one target, by CORE id.
 * @param counts - Findings per "CORE-id dataset" in the view.
 * @param explained - Recorded explanations per "CORE-id dataset".
 * @returns Rules by state and the explained failure count.
 */
export function coreRuleStates(
  rules: Readonly<Record<string, RecordedRule>>,
  counts: Readonly<Record<string, number>>,
  explained: Readonly<Record<string, RecordedExplanation>>
): {
  outcomes: Partial<Record<RuleState, number>>;
  explainedFailures: number;
} {
  const outcomes: Partial<Record<RuleState, number>> = {};
  let explainedFailures = 0;
  for (const [id, rule] of Object.entries(rules)) {
    const state = STATE_OF_CORE_STATUS[rule.status] ?? "execution-error";
    outcomes[state] = (outcomes[state] ?? 0) + 1;
    if (state !== "fail") continue;
    const keys = Object.keys(counts).filter(
      (key) => key.split(" ")[0] === id && counts[key] > 0
    );
    if (keys.length > 0 && keys.every((key) => explained[key])) {
      explainedFailures += 1;
    }
  }
  return { outcomes, explainedFailures };
}

const CORE_WORKFLOW = ".github/workflows/study-data-core.yml";
const RECORDED = "lib/study-data/internal/core/recorded-findings.json";
const CROSSWALK = "scripts/study-data-core-crosswalk.json";
const CT_TEST = "__tests__/cdisc-ct-release.test.ts";
const CT_SUBSET = "scripts/cdisc-ct-subset.ts";
const LOCAL_RULES = "lib/study-data/internal/conformance/rules.ts";

function bomChecks(kind: StandardCheck["kind"]): StandardCheck[] {
  const seen = new Set<string>();
  return standardsBillOfMaterials()
    .standards.flatMap((entry) => entry.checks)
    .filter((check) => check.kind === kind)
    .filter((check) => !seen.has(check.path) && Boolean(seen.add(check.path)));
}

const evidenceOf = (checks: readonly StandardCheck[]): LayerEvidence[] =>
  checks.map((check) => ({ label: check.description, path: check.path }));

/**
 * Every rule family the site runs, or deliberately does not, in layer order.
 *
 * @param recorded - CDISC CORE's committed findings.
 * @returns The layers, from file structure up to the site's own rules.
 */
export function conformanceLayers(recorded: RecordedFindings): RuleLayer[] {
  const { lock } = recorded;
  const engine = `${lock.engine} ${lock.tag}`;
  const sdtmCounts = recorded.views.default.sdtm.counts;
  const sdtm = coreRuleStates(
    recorded.rules.sdtm,
    sdtmCounts,
    recorded.explained.sdtm
  );
  const usdm = coreRuleStates(
    recorded.rules.usdm,
    recorded.views.default.usdm.counts,
    recorded.explained.usdm
  );
  const fdaRules = Object.fromEntries(
    Object.entries(recorded.rules.sdtm).filter(([, rule]) => rule.fda.trim())
  );
  const fda = coreRuleStates(fdaRules, sdtmCounts, recorded.explained.sdtm);
  const schemas = bomChecks("official-schema");
  const packages = standardsBillOfMaterials()
    .terminology.map((entry) => `${entry.package} ${entry.pinned}`)
    .join(", ");
  const presets = Object.keys(recorded.crf).length;
  const scenarios = MESSY_DATA_SCENARIOS.length;
  const localSdtm = CONFORMANCE_RULES.filter((r) => r.scope.layer === "sdtm");
  const localAdam = CONFORMANCE_RULES.filter((r) => r.scope.layer === "adam");
  const recordedEvidence = [
    { label: "The workflow that runs CORE", path: CORE_WORKFLOW },
    { label: "CORE's recorded results", path: RECORDED },
  ];

  return [
    {
      id: "schema",
      title: "Official schemas",
      author: "CDISC, vendored at the pinned versions",
      runBy: "Tests on every pull request; a failure blocks the merge",
      scope: "Every export that has a published schema",
      unit: "check",
      outcomes: { pass: schemas.length },
      note: "A file that does not match its schema cannot be merged, so every schema check on the main branch passes.",
      evidence: evidenceOf(schemas),
    },
    {
      id: "terminology",
      title: "Controlled terminology",
      author: "NCI EVS CDISC terminology releases",
      runBy: "Tests on every pull request; a failure blocks the merge",
      scope: "Every NCI code cited in the site's code",
      unit: "check",
      outcomes: { pass: 1 },
      note: `CORE checked the datasets against its newest cached terminology, ${lock.ct.validated}; the datasets cite ${lock.ct.declared}.`,
      evidence: [
        {
          label: `Every cited NCI code is checked against the ${packages} releases.`,
          path: CT_TEST,
        },
        { label: "How the terminology subset is derived", path: CT_SUBSET },
      ],
    },
    {
      id: "core-sdtmig",
      title: `${lock.standards.sdtm} conformance rules`,
      author: "CDISC, as published for the CORE engine",
      runBy: `${engine} in CI; results committed`,
      scope: `The DEMO-301 default run and ${scenarios} injected-issue scenarios`,
      unit: "rule",
      outcomes: sdtm.outcomes,
      explainedFailures: sdtm.explainedFailures,
      note: "Counts are for the default run. Each failing rule's findings carry a recorded reason: by design, a CORE limitation, or a tracked defect.",
      evidence: recordedEvidence,
    },
    {
      id: "core-fda",
      title: "FDA rules CORE cites",
      author: "FDA Business and Validator Rules, as implemented in CORE",
      runBy: `${engine} in CI, within the SDTMIG run`,
      scope: "The DEMO-301 default run",
      unit: "rule",
      outcomes: fda.outcomes,
      explainedFailures: fda.explainedFailures,
      note: "The SDTMIG rules above that cite an FDA rule id. They are part of the same run, not a separate validation.",
      evidence: recordedEvidence,
    },
    {
      id: "fda-other",
      title: "Other FDA validation rules",
      author: "FDA Business and Validator Rules",
      runBy: "Nothing on this site",
      scope: "None",
      unit: "rule",
      outcomes: {},
      state: "not-evaluated",
      note: "FDA rules that CORE does not implement are not run. A submission would need a validator that covers them.",
      evidence: [],
    },
    {
      id: "core-usdm",
      title: `${lock.standards.usdm} rules`,
      author: "CDISC, as published for the CORE engine",
      runBy: `${engine} in CI; results committed`,
      scope: `The DEMO-301 study design and ${presets} CRF Studio presets`,
      unit: "rule",
      outcomes: usdm.outcomes,
      explainedFailures: usdm.explainedFailures,
      note: "Counts are for the DEMO-301 study design.",
      evidence: recordedEvidence,
    },
    {
      id: "core-adamig",
      title: "ADaMIG conformance rules",
      author: "CDISC",
      runBy: `${engine}`,
      scope: "None",
      unit: "rule",
      outcomes: {},
      state: "unsupported",
      note: "CDISC CORE publishes no ADaMIG rules yet, so the ADaM datasets are checked only by the site's own AD rules below.",
      evidence: [],
    },
    {
      id: "local",
      title: "The site's own rules",
      author: "Written for this site; not reviewed by CDISC",
      runBy: "Your browser, on every pipeline run",
      scope: "Every run, including custom seeds and CRF hand-offs",
      unit: "rule",
      outcomes: {},
      note: `${localSdtm.length} SD rules and ${localAdam.length} AD rules. Tests plant each of the ${scenarios} scenario defects and require a rule to catch it. Where CORE catches the same defect, the rule names its CORE twin.`,
      evidence: [
        { label: "The rules", path: LOCAL_RULES },
        { label: "Which CORE rules catch the same defects", path: CROSSWALK },
      ],
    },
  ];
}
