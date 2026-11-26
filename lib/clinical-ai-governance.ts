/**
 * Copy, risk models, safeguard crosswalks and deterministic walkthrough state
 * machines for `/clinical/ai-governance`.
 *
 * Every evaluator in this module is pure TypeScript with zero network calls,
 * zero model invocations and zero database queries (ADR 0036, ADR 0066).
 * Standard versions come from `CLINICAL_STANDARDS_PROFILE` and vendor scores
 * delegate to `scoreVendors` and `sensitivity` in `@/lib/clinical-platform`.
 */

import {
  CLINICAL_STANDARDS_PROFILE,
  controlledTerminologyCitation,
  standardCitation,
} from "@/lib/clinical-standards";
import {
  scoreVendors,
  sensitivity,
  type StrategyCriterion,
  type StrategyScenario,
  type StrategyScore,
  type StrategyVendor,
} from "@/lib/clinical-platform";

/** External guidance or industry document referenced on `/clinical/ai-governance`. */
export interface AiGovernanceReference {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly summary: string;
  readonly href: string;
}

/** Canonical section metadata on `/clinical/ai-governance`. */
export interface AiGovernanceSection {
  readonly id: string;
  readonly heading: string;
  readonly summary: string;
}

/** Static shell copy for `/clinical/ai-governance`. */
export interface AiGovernancePageCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly intro: string;
  readonly banner: string;
  readonly referencesHeading: string;
  readonly referencesIntro: string;
  readonly references: readonly AiGovernanceReference[];
  readonly sections: readonly AiGovernanceSection[];
}

export const AI_GOVERNANCE_PAGE_COPY: AiGovernancePageCopy = {
  eyebrow: "Clinical AI governance",
  title: "AI governance in clinical data work",
  intro:
    "How AI-assisted steps in clinical data workflows can fail, which external documents govern them, and what deterministic checks and human review gates run against synthetic study data on this site.",
  banner:
    "Demonstration only, not regulatory, legal or compliance advice, and not a validated system. All study data, study identifiers (DEMO-301) and vendor examples on this page are synthetic.",
  referencesHeading: "Guidance and industry references",
  referencesIntro:
    "Status of the primary external documents this page tracks, stated as draft guidance, consultation drafts or industry guides.",
  references: [
    {
      id: "fda-ai-guidance",
      title: "FDA AI guidance",
      status: "Draft guidance (January 2025, docket FDA-2024-D-4689)",
      summary:
        "FDA draft guidance on using artificial intelligence to support regulatory decision-making for drug and biological products, organised around a seven-step Context-of-Use credibility framework.",
      href: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/considerations-use-artificial-intelligence-support-regulatory-decision-making-drug-and-biological",
    },
    {
      id: "eu-gmp-annex-22",
      title: "EU GMP Annex 22",
      status: "2025 consultation draft",
      summary:
        "European Union Good Manufacturing Practice consultation draft covering intended-use bounds, test data separation, explainability, performance monitoring and human review for AI in computerised systems.",
      href: "https://health.ec.europa.eu/consultations/stakeholders-consultation-eudralex-volume-4-good-manufacturing-practice-guidelines-chapter-4-annex_en",
    },
    {
      id: "ispe-gamp-ai",
      title: "ISPE GAMP AI guide",
      status: "Industry guide (July 2025)",
      summary:
        "Industry good practice guide applying risk-based computerised system lifecycle controls, supplier evaluation and versioned configuration management to AI-enabled tools.",
      href: "https://ispe.org/publications/guidance-documents/gamp-good-practice-guide-artificial-intelligence",
    },
  ],
  sections: [
    {
      id: "failure-modes",
      heading: "Section 1: Failure modes and mitigations",
      summary:
        "Filterable catalogue of ways an unreviewed model output can fail in clinical form design and dataset mapping on DEMO-301, paired with live deterministic checks and remediations.",
    },
    {
      id: "standards-and-guidance",
      heading: "Section 2: Standards and guidance",
      summary:
        "Seven-step Context-of-Use risk evaluator modelled on the FDA AI draft guidance beside a filterable safeguard crosswalk for EU GMP Annex 22, ISPE GAMP AI and Part 11-style audit controls.",
    },
    {
      id: "live-validation-evidence",
      heading: "Section 3: Live validation evidence",
      summary:
        "Pinned CDISC standard versions, recorded CDISC CORE outcomes, local rule counts and SHA-256 package digests across the clean DEMO-301 baseline and injected defect runs.",
    },
    {
      id: "interactive-walkthroughs",
      heading: "Section 4: Interactive walkthroughs",
      summary:
        "Human-reviewed proposal simulator implementing ADR 0035 and ADR 0067 provenance gates alongside an interactive scorecard and sensitivity check over fictional AI vendors.",
    },
  ],
};

// ---------------------------------------------------------------------------
// Section 1: Failure modes and deterministic mitigations
// ---------------------------------------------------------------------------

/** Filter categories for Section 1 failure-mode cards. */
export type FailureModeCategory =
  "all" | "schema-naming" | "terminology-dates" | "lineage-schedule";

/** Labelled category option for Section 1 filter controls. */
export interface FailureModeCategoryOption {
  readonly id: FailureModeCategory;
  readonly label: string;
}

export const FAILURE_MODE_CATEGORIES: readonly FailureModeCategoryOption[] = [
  { id: "all", label: "All categories" },
  { id: "schema-naming", label: "Schema and naming" },
  { id: "terminology-dates", label: "Terminology and dates" },
  { id: "lineage-schedule", label: "Lineage and schedule" },
];

/** Deterministic CRF Studio check evidence attached to a failure mode. */
export interface FailureModeCrfCheck {
  readonly ruleId: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly suggestedFix: string;
}

/** Deterministic Study Data Pipeline rule attached to a failure mode. */
export interface FailureModePipelineCheck {
  readonly ruleId: string;
  readonly severity: "error" | "warning";
  readonly layer: "sdtm" | "adam";
  readonly domain: string;
  readonly citation: string;
}

/** One clinical AI failure mode paired with deterministic checks and human review gates. */
export interface AiFailureModeCard {
  readonly id: string;
  readonly category: Exclude<FailureModeCategory, "all">;
  readonly title: string;
  readonly aiFailureSummary: string;
  readonly demoExample: string;
  readonly crfCheck: FailureModeCrfCheck;
  readonly pipelineCheck: FailureModePipelineCheck;
  readonly humanReviewGate: string;
}

/**
 * Filters failure-mode cards by category.
 *
 * @param cards - Full list of failure-mode cards.
 * @param category - Active category filter.
 * @returns Matching failure-mode cards in declaration order.
 */
export function filterFailureModes(
  cards: readonly AiFailureModeCard[],
  category: FailureModeCategory
): readonly AiFailureModeCard[] {
  if (category === "all") return cards;
  return cards.filter((card) => card.category === category);
}

// ---------------------------------------------------------------------------
// Section 2: FDA AI Draft Guidance 7-step evaluator & Annex 22 / GAMP crosswalk
// ---------------------------------------------------------------------------

/** Qualitative level for Context-of-Use model influence or decision consequence. */
export type CouDimensionLevel = "low" | "medium" | "high";

/** Computed model risk tier from the 3x3 Context-of-Use matrix. */
export type CouRiskTier = "low" | "moderate" | "high" | "critical";

/** Synthetic clinical workflow preset for Context-of-Use evaluation. */
export interface CouWorkflowPreset {
  readonly id: string;
  readonly label: string;
  readonly questionOfInterest: string;
  readonly contextOfUse: string;
  readonly defaultInfluence: CouDimensionLevel;
  readonly defaultConsequence: CouDimensionLevel;
  readonly deterministicCompanion: string;
}

export const COU_WORKFLOW_PRESETS: readonly CouWorkflowPreset[] = [
  {
    id: "crf-field-draft",
    label: "Drafting CRF fields from DEMO-301 schedule",
    questionOfInterest:
      "Can a coding agent draft candidate CDASH form fields from a structured synthetic visit schedule without mutating study state directly?",
    contextOfUse:
      "Authoring aid inside local CRF Studio drafts on DEMO-301; all candidate patches pass structural schema and linter checks and require human diff acceptance.",
    defaultInfluence: "low",
    defaultConsequence: "medium",
    deterministicCompanion: `${standardCitation("CDASHIG")} linter rules SD0001 to SD0005 and schema validation.`,
  },
  {
    id: "terminology-mapping",
    label: "Suggesting controlled terminology bindings",
    questionOfInterest:
      "Can an assistant suggest NCI codelist bindings for categorical CRF fields before SDTM tabulation?",
    contextOfUse:
      "Advisory mapping suggestion over DEMO-301 form metadata; local codelist subset checks verify every code and submission value before export.",
    defaultInfluence: "medium",
    defaultConsequence: "medium",
    deterministicCompanion: `Local subset checked against ${controlledTerminologyCitation()} and non-extensible codelist rules.`,
  },
  {
    id: "central-monitoring-triage",
    label: "Ranking site query signals for central monitoring",
    questionOfInterest:
      "Can a model summarise site anomaly explanations beside statistical central monitoring tests?",
    contextOfUse:
      "Read-only triage narrative alongside deterministic key risk indicators and Benjamini-Hochberg false-discovery thresholds on synthetic portfolio feeds.",
    defaultInfluence: "medium",
    defaultConsequence: "high",
    deterministicCompanion:
      "Deterministic RBQM central statistical monitoring and explicit risk-signal log.",
  },
  {
    id: "autonomous-submission-derivation",
    label: "Unreviewed generation of SDTM or ADaM derivations",
    questionOfInterest:
      "Should a generative model directly write submission dataset rows or impute missing dates for DEMO-301?",
    contextOfUse:
      "Direct transformation of clinical trial endpoints and tabulation rows without deterministic derivation specs or human sign-off.",
    defaultInfluence: "high",
    defaultConsequence: "high",
    deterministicCompanion: `Disallowed on this site: ${standardCitation("SDTMIG")} and ${standardCitation("ADaMIG")} derivations stay LLM-free per ADR 0065 and ADR 0067.`,
  },
];

/** One step of the seven-step credibility assessment output. */
export interface CredibilityStepOutput {
  readonly step: number;
  readonly title: string;
  readonly detail: string;
  readonly artifactOrControl: string;
}

/** Complete output of the seven-step Context-of-Use evaluator. */
export interface CouEvaluationResult {
  readonly workflow: CouWorkflowPreset;
  readonly modelInfluence: CouDimensionLevel;
  readonly decisionConsequence: CouDimensionLevel;
  readonly riskTier: CouRiskTier;
  readonly riskLabel: string;
  readonly oversightStringency: string;
  readonly humanReviewGate: string;
  readonly withinIntendedUse: boolean;
  readonly steps: readonly CredibilityStepOutput[];
}

const LEVEL_RANK: Readonly<Record<CouDimensionLevel, number>> = {
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * Computes the Context-of-Use risk tier and seven-step credibility plan
 * modelled on the January 2025 FDA AI draft guidance (docket FDA-2024-D-4689).
 *
 * @param input - Selected workflow preset, model influence and decision consequence.
 * @returns Risk tier, oversight stringency and all seven credibility steps.
 */
export function evaluateContextOfUseRisk(input: {
  readonly workflowId: string;
  readonly modelInfluence: CouDimensionLevel;
  readonly decisionConsequence: CouDimensionLevel;
}): CouEvaluationResult {
  const workflow =
    COU_WORKFLOW_PRESETS.find((item) => item.id === input.workflowId) ??
    COU_WORKFLOW_PRESETS[0]!;
  const inf = LEVEL_RANK[input.modelInfluence];
  const con = LEVEL_RANK[input.decisionConsequence];
  const score = inf + con;

  const riskTier: CouRiskTier =
    inf === 3 && con === 3
      ? "critical"
      : score >= 5 || (inf === 3 && con >= 1) || (con === 3 && inf >= 1)
        ? "high"
        : score >= 3
          ? "moderate"
          : "low";

  const riskMeta: Readonly<
    Record<
      CouRiskTier,
      {
        readonly label: string;
        readonly stringency: string;
        readonly gate: string;
        readonly credibilityPlan: string;
        readonly executionCheck: string;
        readonly adequacy: string;
      }
    >
  > = {
    low: {
      label: "Low model risk",
      stringency:
        "Baseline deterministic lint, pinned standards check and single-author diff review.",
      gate: "Clinical Data Manager inspects semantic diff before accepting local edit.",
      credibilityPlan:
        "Verify structural schema, variable naming bounds and local codelist membership against synthetic positive and negative fixtures.",
      executionCheck:
        "Run CRF conformance linter and confirm zero silent mutations outside explicit user accept actions.",
      adequacy:
        "Adequate for bounded local authoring support when deterministic rules pass and diff preview is recorded.",
    },
    moderate: {
      label: "Moderate model risk",
      stringency:
        "Version-pinned terminology verification, assumption disclosure, stale-revision blocking and named CDM review.",
      gate: "Clinical Data Manager and Standards Reviewer inspect cited sources, diff preview and open warnings before acceptance.",
      credibilityPlan:
        "Pair every candidate suggestion with provenance tiering, seeded regression scenarios and local subset verification against pinned CDISC standards.",
      executionCheck:
        "Execute local conformance rules plus recorded CDISC CORE comparison on DEMO-301 baseline and fault scenarios.",
      adequacy:
        "Adequate as a review-gated proposal source; model hypotheses remain visibly flagged Needs review until human confirmation.",
    },
    high: {
      label: "High model risk",
      stringency:
        "Dual-discipline human sign-off, independent seeded test scenarios, drift locks and strict read-only boundary on study records.",
      gate: "Clinical Data Manager, Medical Reviewer and Biostatistician verify source traceability before any downstream change.",
      credibilityPlan:
        "Require independent synthetic fault injection, sensitivity checks across assumptions, full provenance logging and zero automated writes.",
      executionCheck:
        "Lock input and package SHA-256 digests in CI; fail closed on provider error, missing citation or stale study revision.",
      adequacy:
        "Permitted only as a read-only or dual-reviewed advisory aid; never accepted as standalone conformance evidence.",
    },
    critical: {
      label: "Critical risk (outside intended use)",
      stringency:
        "Disallowed for generative model execution; enforce deterministic code-only pipeline.",
      gate: "Blocked at architectural boundary: keep step deterministic and LLM-free per ADR 0065 and ADR 0067.",
      credibilityPlan:
        "Do not delegate high-influence, high-consequence submission transformations to probabilistic text generation.",
      executionCheck:
        "Execute pure deterministic TypeScript transformations from USDM metadata with row-level lineage and SHA-256 manifest hashes.",
      adequacy:
        "Inadequate for AI execution under current Context of Use; retain deterministic engine and human specification ownership.",
    },
  };

  const meta = riskMeta[riskTier];

  const steps: readonly CredibilityStepOutput[] = [
    {
      step: 1,
      title: "Define question of interest",
      detail: workflow.questionOfInterest,
      artifactOrControl: `DEMO-301 workflow scope (${workflow.id})`,
    },
    {
      step: 2,
      title: "Define Context of Use (CoU)",
      detail: workflow.contextOfUse,
      artifactOrControl: workflow.deterministicCompanion,
    },
    {
      step: 3,
      title: "Assess AI model risk",
      detail: `Model influence is ${input.modelInfluence} and decision consequence is ${input.decisionConsequence}, yielding ${meta.label.toLowerCase()}.`,
      artifactOrControl: `3x3 CoU risk matrix (${input.modelInfluence} influence x ${input.decisionConsequence} consequence)`,
    },
    {
      step: 4,
      title: "Develop credibility assessment plan",
      detail: meta.credibilityPlan,
      artifactOrControl: `Pinned profile: ${standardCitation("USDM")}, ${standardCitation("CDASHIG")}, ${standardCitation("SDTMIG")}, ${standardCitation("ADaMIG")}`,
    },
    {
      step: 5,
      title: "Execute credibility plan on synthetic corpus",
      detail: meta.executionCheck,
      artifactOrControl:
        "Seeded DEMO-301 baseline and 18 fault-injection scenarios",
    },
    {
      step: 6,
      title: "Document results, provenance and deviations",
      detail:
        "Attach ADR 0067 provenance tier, explicit assumptions, SHA-256 manifest digests and reviewer disposition to the review record.",
      artifactOrControl:
        "MANIFEST.json digests, recorded-findings.json lock and review log",
    },
    {
      step: 7,
      title: "Determine adequacy for Context of Use",
      detail: meta.adequacy,
      artifactOrControl: meta.gate,
    },
  ];

  return {
    workflow,
    modelInfluence: input.modelInfluence,
    decisionConsequence: input.decisionConsequence,
    riskTier,
    riskLabel: meta.label,
    oversightStringency: meta.stringency,
    humanReviewGate: meta.gate,
    withinIntendedUse: riskTier !== "critical",
    steps,
  };
}

/** Filter options for the Section 2 regulatory and industry safeguard crosswalk. */
export type CrosswalkSourceFilter =
  | "all"
  | "eu-gmp-annex-22"
  | "fda-ai-guidance"
  | "ispe-gamp-ai"
  | "audit-trail";

/** Labelled source filter option for Section 2 crosswalk controls. */
export interface CrosswalkFilterOption {
  readonly id: CrosswalkSourceFilter;
  readonly label: string;
}

export const CROSSWALK_SOURCE_FILTERS: readonly CrosswalkFilterOption[] = [
  { id: "all", label: "All sources" },
  { id: "eu-gmp-annex-22", label: "EU GMP Annex 22 draft" },
  { id: "fda-ai-guidance", label: "FDA AI draft guidance" },
  { id: "ispe-gamp-ai", label: "ISPE GAMP AI guide" },
  { id: "audit-trail", label: "Audit-trail controls" },
];

/** One row linking external guidance or audit expectations to site safeguards. */
export interface GovernanceCrosswalkRow {
  readonly id: string;
  readonly source: Exclude<CrosswalkSourceFilter, "all">;
  readonly sourceBadge: string;
  readonly externalExpectation: string;
  readonly platformSafeguard: string;
  readonly verificationMechanism: string;
  readonly enforcementKind: "Code gate" | "Human review gate";
  readonly minimumRiskTier: CouRiskTier;
}

export const GOVERNANCE_CROSSWALK: readonly GovernanceCrosswalkRow[] = [
  {
    id: "annex22-intended-use",
    source: "eu-gmp-annex-22",
    sourceBadge: "EU GMP Annex 22 (consultation draft)",
    externalExpectation:
      "Define strict intended-use boundaries and exclude generative models from unreviewed critical record writes.",
    platformSafeguard:
      "ADR 0065 and ADR 0067 keep SDTM, ADaM and Define-XML generation deterministic and restrict authoring proposals to inert typed patches.",
    verificationMechanism:
      "Dependency boundaries and typed operation allowlists.",
    enforcementKind: "Code gate",
    minimumRiskTier: "low",
  },
  {
    id: "annex22-test-data",
    source: "eu-gmp-annex-22",
    sourceBadge: "EU GMP Annex 22 (consultation draft)",
    externalExpectation:
      "Maintain independent, reproducible test data sets and fault cases separate from ad-hoc prompts.",
    platformSafeguard:
      "DEMO-301 runs from a fixed seed (301) with 18 deterministic fault-injection scenarios that mutate one subject at a time.",
    verificationMechanism:
      "Input SHA-256 locks and deterministic package manifest digests.",
    enforcementKind: "Code gate",
    minimumRiskTier: "moderate",
  },
  {
    id: "annex22-explainability",
    source: "eu-gmp-annex-22",
    sourceBadge: "EU GMP Annex 22 (consultation draft)",
    externalExpectation:
      "Surface provenance, assumptions and uncertainty instead of uncalibrated numeric confidence scores.",
    platformSafeguard:
      "ADR 0035 and ADR 0067 classify items as Deterministic finding, Source-backed fact or Model hypothesis (Needs review).",
    verificationMechanism:
      "Provenance badge rendering and regulatory wording policy scan.",
    enforcementKind: "Code gate",
    minimumRiskTier: "low",
  },
  {
    id: "annex22-human-review",
    source: "eu-gmp-annex-22",
    sourceBadge: "EU GMP Annex 22 (consultation draft)",
    externalExpectation:
      "Require qualified human review before an AI-assisted output alters controlled system state.",
    platformSafeguard:
      "Accept requires rendering the before-and-after semantic diff and assumptions first; no accept-all shortcut exists.",
    verificationMechanism:
      "Proposal state machine preview gate and stale-revision check.",
    enforcementKind: "Human review gate",
    minimumRiskTier: "low",
  },
  {
    id: "fda-cou-credibility",
    source: "fda-ai-guidance",
    sourceBadge: "FDA AI draft guidance (FDA-2024-D-4689)",
    externalExpectation:
      "Scale credibility evidence to model influence and decision consequence for each Context of Use.",
    platformSafeguard:
      "Seven-step Context-of-Use evaluator maps influence and consequence to review gates and blocks critical unreviewed automation.",
    verificationMechanism:
      "Deterministic 3x3 risk matrix and documented ADR capability table.",
    enforcementKind: "Human review gate",
    minimumRiskTier: "moderate",
  },
  {
    id: "ispe-gamp-config",
    source: "ispe-gamp-ai",
    sourceBadge: "ISPE GAMP AI guide (July 2025)",
    externalExpectation:
      "Pin standards, schemas and rule engines under configuration control so upgrades require impact review.",
    platformSafeguard: `CLINICAL_STANDARDS_PROFILE pins ${standardCitation("USDM")}, ${standardCitation("CDASHIG")}, ${standardCitation("SDTMIG")} and ${controlledTerminologyCitation()} in one frozen module.`,
    verificationMechanism:
      "Standards profile test and CI drift check on recorded CORE outputs.",
    enforcementKind: "Code gate",
    minimumRiskTier: "low",
  },
  {
    id: "ispe-gamp-supplier",
    source: "ispe-gamp-ai",
    sourceBadge: "ISPE GAMP AI guide (July 2025)",
    externalExpectation:
      "Evaluate external AI tooling on assurance, tenant privacy, exit portability and sensitivity to weight shifts.",
    platformSafeguard:
      "Deterministic vendor scorecard normalises criterion weights and tests +-25% single-weight perturbations.",
    verificationMechanism:
      "scoreVendors and sensitivity functions in @/lib/clinical-platform.",
    enforcementKind: "Human review gate",
    minimumRiskTier: "high",
  },
  {
    id: "audit-trail-simulation",
    source: "audit-trail",
    sourceBadge: "Part 11-style audit controls (simulation)",
    externalExpectation:
      "Record chronological attribution, before-and-after values, declined suggestions and single-step rollback.",
    platformSafeguard:
      "Designed to these controls: accepted edits, rejected proposals, stale-state blocks and single-step undo append to the simulation review log.",
    verificationMechanism:
      "ADR 0035 lifecycle reducer and SHA-256 package manifest entries.",
    enforcementKind: "Code gate",
    minimumRiskTier: "low",
  },
];

const RISK_ORDER: Readonly<Record<CouRiskTier, number>> = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

/**
 * Filters safeguard crosswalk rows by external document source and optionally
 * restricts to controls active up to a chosen risk tier.
 *
 * @param source - Selected framework source filter.
 * @param onlyActiveTier - When true, returns rows whose minimumRiskTier is at or below `riskTier`.
 * @param riskTier - Current Context-of-Use risk tier.
 * @returns Matching crosswalk rows.
 */
export function filterGovernanceCrosswalk(
  source: CrosswalkSourceFilter,
  onlyActiveTier = false,
  riskTier: CouRiskTier = "critical"
): readonly GovernanceCrosswalkRow[] {
  return GOVERNANCE_CROSSWALK.filter((row) => {
    const matchesSource = source === "all" || row.source === source;
    const matchesTier =
      !onlyActiveTier ||
      RISK_ORDER[row.minimumRiskTier] <= RISK_ORDER[riskTier];
    return matchesSource && matchesTier;
  });
}

// ---------------------------------------------------------------------------
// Section 3: Live validation evidence data contracts
// ---------------------------------------------------------------------------

/** Pinned standard entry surfaced in Section 3. */
export interface GovernanceStandardPin {
  readonly code: string;
  readonly citation: string;
  readonly scopeNote: string;
}

/** One hashed artifact inside the reproducible DEMO-301 study data package. */
export interface GovernanceDigestEntry {
  readonly path: string;
  readonly mediaType: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly changedFromBaseline: boolean;
}

/** Top recorded CDISC CORE finding surfaced for a scenario view. */
export interface GovernanceCoreFindingSummary {
  readonly coreId: string;
  readonly dataset: string;
  readonly count: number;
  readonly addedByScenario: number;
  readonly message: string;
}

/** Precomputed deterministic evidence for the clean baseline or an injected defect run. */
export interface GovernanceScenarioEvidence {
  readonly id: string;
  readonly label: string;
  readonly isBaseline: boolean;
  readonly description: string;
  readonly expectedBehavior: string;
  readonly inputSha256: string;
  readonly manifestSha256: string;
  readonly totalFiles: number;
  readonly localErrors: number;
  readonly localWarnings: number;
  readonly packageFindings: number;
  readonly localDeltaSummary: string;
  readonly coreRuleCount: number;
  readonly corePassed: number;
  readonly coreIssuesReported: number;
  readonly coreSkipped: number;
  readonly coreExecutionErrors: number;
  readonly coreAddedFindings: number;
  readonly topCoreFindings: readonly GovernanceCoreFindingSummary[];
  readonly digests: readonly GovernanceDigestEntry[];
}

/** Complete server-derived evidence payload passed to `/clinical/ai-governance`. */
export interface AiGovernanceWorkspaceEvidence {
  readonly studyId: string;
  readonly seed: number;
  readonly subjectCount: number;
  readonly fixedTimestamp: string;
  readonly localRulesVersion: string;
  readonly localRuleCount: number;
  readonly coreEngineName: string;
  readonly coreEngineTag: string;
  readonly coreEngineCommit: string;
  readonly terminologyChecked: string;
  readonly terminologyCited: string;
  readonly pinnedStandards: readonly GovernanceStandardPin[];
  readonly failureModes: readonly AiFailureModeCard[];
  readonly scenarios: readonly GovernanceScenarioEvidence[];
}

// ---------------------------------------------------------------------------
// Section 4A: ADR 0067 & ADR 0035 Human-Reviewed Proposal Simulator
// ---------------------------------------------------------------------------

/** Provenance tiers defined in ADR 0067. */
export type ProposalProvenanceTier =
  "Deterministic finding" | "Source-backed fact" | "Model hypothesis";

/** Lifecycle disposition of a simulated CRF authoring proposal. */
export type GovernanceProposalStatus = "pending" | "accepted" | "rejected";

/** One field slot in the simulated DEMO-301 local CRF draft. */
export interface SimulatedCrfField {
  readonly fieldKey: string;
  readonly formName: string;
  readonly label: string;
  readonly value: string;
  readonly updatedByProposalId: string | null;
}

/** One reviewable authoring proposal governed by ADR 0035 and ADR 0067. */
export interface GovernanceProposal {
  readonly id: string;
  readonly title: string;
  readonly tier: ProposalProvenanceTier;
  readonly needsReview: boolean;
  readonly baseStudyRevision: number;
  readonly targetFieldKey: string;
  readonly formName: string;
  readonly beforeValue: string;
  readonly proposedValue: string;
  readonly sourceCitation: string;
  readonly rationale: string;
  readonly assumptions: readonly string[];
  readonly reviewerRole: string;
  readonly diffPreviewed: boolean;
  readonly status: GovernanceProposalStatus;
}

/** Entry in the simulation's chronological Part 11-style review log. */
export interface GovernanceReviewLogEntry {
  readonly step: number;
  readonly action:
    | "preview"
    | "accept"
    | "reject"
    | "undo"
    | "manual-edit"
    | "stale-blocked"
    | "rebase";
  readonly proposalId: string | null;
  readonly revision: number;
  readonly detail: string;
}

/** Snapshot saved on Accept so single-step Undo restores exact prior state. */
export interface ProposalUndoSnapshot {
  readonly acceptedProposalId: string;
  readonly priorRevision: number;
  readonly priorFields: readonly SimulatedCrfField[];
  readonly priorProposals: readonly GovernanceProposal[];
}

/** Full immutable state of the Section 4 proposal review simulator. */
export interface ReviewSimulatorState {
  readonly studyId: string;
  readonly studyRevision: number;
  readonly fields: readonly SimulatedCrfField[];
  readonly proposals: readonly GovernanceProposal[];
  readonly reviewLog: readonly GovernanceReviewLogEntry[];
  readonly undoSnapshot: ProposalUndoSnapshot | null;
  readonly lastBlockedReason: string | null;
}

const INITIAL_SIMULATOR_FIELDS: readonly SimulatedCrfField[] = [
  {
    fieldKey: "AE.AESER.codelist",
    formName: "Adverse Events (AE)",
    label: "Serious event codelist binding",
    value: "Unbound choice options",
    updatedByProposalId: null,
  },
  {
    fieldKey: "VS.PULSE_WK4.schedule",
    formName: "Vital Signs (VS)",
    label: "Week 4 supine pulse item",
    value: "Not assigned at Visit 4 (Week 4)",
    updatedByProposalId: null,
  },
  {
    fieldKey: "AE.AETOXGR.prompt",
    formName: "Adverse Events (AE)",
    label: "Symptom grading prompt",
    value: "Not collected on DEMO-301 AE form",
    updatedByProposalId: null,
  },
];

function createInitialProposals(): readonly GovernanceProposal[] {
  return [
    {
      id: "prop-det-sd0003",
      title: "Bind AE.AESER to standard No/Yes codelist (C66742)",
      tier: "Deterministic finding",
      needsReview: false,
      baseStudyRevision: 1,
      targetFieldKey: "AE.AESER.codelist",
      formName: "Adverse Events (AE)",
      beforeValue: "Unbound choice options",
      proposedValue: `C66742 (NY, local subset ${CLINICAL_STANDARDS_PROFILE.CT.package})`,
      sourceCitation: `CRF conformance rule SD0003 (${standardCitation("CDASHIG")})`,
      rationale:
        "Choice field AESER has no NCI codelist reference; deterministic linter SD0003 emits a reproducible remediation.",
      assumptions: [
        "AESER collects binary No/Yes serious adverse event status.",
        `Term codes come from the repository's local subset checked against ${controlledTerminologyCitation()}.`,
      ],
      reviewerRole: "Clinical Data Manager",
      diffPreviewed: false,
      status: "pending",
    },
    {
      id: "prop-fact-usdm-vs",
      title: "Schedule supine pulse (PULSE) on Vital Signs at Week 4",
      tier: "Source-backed fact",
      needsReview: false,
      baseStudyRevision: 1,
      targetFieldKey: "VS.PULSE_WK4.schedule",
      formName: "Vital Signs (VS)",
      beforeValue: "Not assigned at Visit 4 (Week 4)",
      proposedValue: `PULSE (beats/min) assigned at Visit 4 per DEMO-301 ${standardCitation("USDM")} schedule`,
      sourceCitation: `DEMO-301 synthetic ${standardCitation("USDM")} activity SOA-V4-VS and ${standardCitation("SDTMIG")} VS domain`,
      rationale:
        "Synthetic DEMO-301 protocol schedule lists Vital Signs at Visit 4 (Week 4), including supine pulse rate in beats/min.",
      assumptions: [
        "Visit 4 corresponds to Week 4 in the DEMO-301 schedule of activities.",
        "Medical and CDM reviewers confirm supine position matches study-specific assessment wording.",
      ],
      reviewerRole: "Clinical Data Manager and Medical Reviewer",
      diffPreviewed: false,
      status: "pending",
    },
    {
      id: "prop-hyp-ae-grade",
      title: "Add 5-point toxicity grade prompt (AETOXGR) to AE form",
      tier: "Model hypothesis",
      needsReview: true,
      baseStudyRevision: 1,
      targetFieldKey: "AE.AETOXGR.prompt",
      formName: "Adverse Events (AE)",
      beforeValue: "Not collected on DEMO-301 AE form",
      proposedValue:
        "Collect 5-point numeric toxicity scale (unverified model suggestion)",
      sourceCitation:
        "No source citation: inferred by model without protocol excerpt or linter rule",
      rationale:
        "Model suggested adding a 5-point toxicity scale alongside standard 3-level severity (AESEV), without a protocol requirement.",
      assumptions: [
        "Hypothesis only: DEMO-301 protocol collects 3-level AESEV (MILD, MODERATE, SEVERE), not a 5-grade scale.",
        "Per ADR 0067, no source means Model hypothesis / Needs review, never an invented citation.",
      ],
      reviewerRole: "Medical Reviewer and Standards Lead",
      diffPreviewed: false,
      status: "pending",
    },
  ];
}

/**
 * Builds the initial state for the ADR 0035 and ADR 0067 review simulator.
 *
 * @returns Initial simulator state on `DEMO-301` at revision 1.
 */
export function createInitialReviewSimulatorState(): ReviewSimulatorState {
  return {
    studyId: "DEMO-301",
    studyRevision: 1,
    fields: INITIAL_SIMULATOR_FIELDS,
    proposals: createInitialProposals(),
    reviewLog: [
      {
        step: 1,
        action: "preview",
        proposalId: null,
        revision: 1,
        detail:
          "Loaded DEMO-301 draft at revision r1 with 3 inert proposals. Diff preview is required before any Accept action.",
      },
    ],
    undoSnapshot: null,
    lastBlockedReason: null,
  };
}

/**
 * Opens or toggles the diff and assumptions preview for a proposal, satisfying
 * the ADR 0035 impact-preview gate once rendered.
 */
export function inspectProposalDiff(
  state: ReviewSimulatorState,
  proposalId: string
): ReviewSimulatorState {
  const target = state.proposals.find((item) => item.id === proposalId);
  if (!target) return state;
  const alreadyPreviewed = target.diffPreviewed;
  const nextStep = state.reviewLog.length + 1;
  return {
    ...state,
    lastBlockedReason: null,
    proposals: state.proposals.map((item) =>
      item.id === proposalId ? { ...item, diffPreviewed: true } : item
    ),
    reviewLog: alreadyPreviewed
      ? state.reviewLog
      : [
          ...state.reviewLog,
          {
            step: nextStep,
            action: "preview",
            proposalId,
            revision: state.studyRevision,
            detail: `Rendered semantic diff and assumptions for ${proposalId} (${target.tier}) at revision r${state.studyRevision}.`,
          },
        ],
  };
}

/**
 * Applies a proposal to the simulated DEMO-301 draft only when its diff has
 * been previewed and its `baseStudyRevision` matches the current study revision.
 */
export function acceptGovernanceProposal(
  state: ReviewSimulatorState,
  proposalId: string
): ReviewSimulatorState {
  const target = state.proposals.find((item) => item.id === proposalId);
  if (!target || target.status !== "pending") return state;

  const nextStep = state.reviewLog.length + 1;
  if (!target.diffPreviewed) {
    const reason = `Accept blocked for ${proposalId}: inspect the semantic diff and assumptions preview first (ADR 0035).`;
    return {
      ...state,
      lastBlockedReason: reason,
      reviewLog: [
        ...state.reviewLog,
        {
          step: nextStep,
          action: "stale-blocked",
          proposalId,
          revision: state.studyRevision,
          detail: reason,
        },
      ],
    };
  }

  if (target.baseStudyRevision !== state.studyRevision) {
    const reason = `Stale revision blocked for ${proposalId}: proposal was computed on r${target.baseStudyRevision}, but DEMO-301 is at r${state.studyRevision}. Rebase before accepting.`;
    return {
      ...state,
      lastBlockedReason: reason,
      reviewLog: [
        ...state.reviewLog,
        {
          step: nextStep,
          action: "stale-blocked",
          proposalId,
          revision: state.studyRevision,
          detail: reason,
        },
      ],
    };
  }

  const nextRevision = state.studyRevision + 1;
  const snapshot: ProposalUndoSnapshot = {
    acceptedProposalId: proposalId,
    priorRevision: state.studyRevision,
    priorFields: state.fields,
    priorProposals: state.proposals,
  };

  return {
    ...state,
    studyRevision: nextRevision,
    lastBlockedReason: null,
    undoSnapshot: snapshot,
    fields: state.fields.map((field) =>
      field.fieldKey === target.targetFieldKey
        ? {
            ...field,
            value: target.proposedValue,
            updatedByProposalId: proposalId,
          }
        : field
    ),
    proposals: state.proposals.map((item) =>
      item.id === proposalId ? { ...item, status: "accepted" } : item
    ),
    reviewLog: [
      ...state.reviewLog,
      {
        step: nextStep,
        action: "accept",
        proposalId,
        revision: nextRevision,
        detail: `Accepted ${proposalId} (${target.tier}) via ${target.reviewerRole}; DEMO-301 advanced r${state.studyRevision} -> r${nextRevision}.`,
      },
    ],
  };
}

/**
 * Declines a proposal without mutating study fields or revision, recording the
 * rejection in the review log per ADR 0035.
 */
export function rejectGovernanceProposal(
  state: ReviewSimulatorState,
  proposalId: string
): ReviewSimulatorState {
  const target = state.proposals.find((item) => item.id === proposalId);
  if (!target || target.status !== "pending") return state;

  const nextStep = state.reviewLog.length + 1;
  return {
    ...state,
    lastBlockedReason: null,
    proposals: state.proposals.map((item) =>
      item.id === proposalId ? { ...item, status: "rejected" } : item
    ),
    reviewLog: [
      ...state.reviewLog,
      {
        step: nextStep,
        action: "reject",
        proposalId,
        revision: state.studyRevision,
        detail: `Rejected ${proposalId} (${target.tier}); DEMO-301 remains untouched at revision r${state.studyRevision}.`,
      },
    ],
  };
}

/**
 * Reverts the most recently accepted proposal in a single step, restoring the
 * prior study fields and revision counter while preserving unrelated review
 * decisions (ADR 0035, ADR 0067).
 */
export function undoGovernanceProposal(
  state: ReviewSimulatorState
): ReviewSimulatorState {
  if (!state.undoSnapshot) return state;
  const { acceptedProposalId, priorRevision, priorFields, priorProposals } =
    state.undoSnapshot;
  const nextStep = state.reviewLog.length + 1;
  const priorById = new Map(
    priorProposals.map((proposal) => [proposal.id, proposal])
  );

  return {
    ...state,
    studyRevision: priorRevision,
    fields: priorFields,
    proposals: state.proposals.map((proposal) => {
      const prior = priorById.get(proposal.id);
      if (!prior) return proposal;
      if (proposal.id === acceptedProposalId) return prior;

      // A pending proposal rebased after the accept used the reverted fields.
      if (
        proposal.status === "pending" &&
        proposal.baseStudyRevision > priorRevision
      ) {
        return {
          ...proposal,
          baseStudyRevision: prior.baseStudyRevision,
          diffPreviewed: false,
        };
      }
      return proposal;
    }),
    undoSnapshot: null,
    lastBlockedReason: null,
    reviewLog: [
      ...state.reviewLog,
      {
        step: nextStep,
        action: "undo",
        proposalId: acceptedProposalId,
        revision: priorRevision,
        detail: `Reverted ${acceptedProposalId} via single-step undo; restored DEMO-301 revision r${priorRevision}.`,
      },
    ],
  };
}

/**
 * Simulates an out-of-band manual authoring edit on DEMO-301, advancing the
 * study revision so older unaccepted proposals become stale.
 */
export function advanceSimulatedStudyRevision(
  state: ReviewSimulatorState
): ReviewSimulatorState {
  const nextRevision = state.studyRevision + 1;
  const nextStep = state.reviewLog.length + 1;
  return {
    ...state,
    studyRevision: nextRevision,
    undoSnapshot: null,
    lastBlockedReason: `Manual edit saved on DEMO-301 (r${state.studyRevision} -> r${nextRevision}). Pending proposals from earlier revisions are now stale and blocked until rebased.`,
    reviewLog: [
      ...state.reviewLog,
      {
        step: nextStep,
        action: "manual-edit",
        proposalId: null,
        revision: nextRevision,
        detail: `Manual author edit advanced DEMO-301 to revision r${nextRevision}; proposals targeting older revisions require rebase.`,
      },
    ],
  };
}

/**
 * Recomputes a stale pending proposal against the current study revision and
 * resets its diff-preview requirement so the author inspects the fresh diff.
 */
export function rebaseGovernanceProposal(
  state: ReviewSimulatorState,
  proposalId: string
): ReviewSimulatorState {
  const target = state.proposals.find((item) => item.id === proposalId);
  if (
    !target ||
    target.status !== "pending" ||
    target.baseStudyRevision === state.studyRevision
  ) {
    return state;
  }
  const nextStep = state.reviewLog.length + 1;
  return {
    ...state,
    lastBlockedReason: null,
    proposals: state.proposals.map((item) =>
      item.id === proposalId
        ? {
            ...item,
            baseStudyRevision: state.studyRevision,
            diffPreviewed: false,
          }
        : item
    ),
    reviewLog: [
      ...state.reviewLog,
      {
        step: nextStep,
        action: "rebase",
        proposalId,
        revision: state.studyRevision,
        detail: `Rebased ${proposalId} onto revision r${state.studyRevision}; inspect the refreshed diff preview before accepting.`,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Section 4B: Fictional AI Vendor Scorecard (wrapping @/lib/clinical-platform)
// ---------------------------------------------------------------------------

export type {
  StrategyCriterion,
  StrategyScenario,
  StrategyScore,
  StrategyVendor,
};

/** One sensitivity perturbation row returned by `evaluateAiVendorScorecard`. */
export interface VendorSensitivityItem {
  readonly label: string;
  readonly winner: string | null;
  readonly changed: boolean;
}

/** Combined ranking and sensitivity result for fictional AI vendors. */
export interface AiVendorScorecardResult {
  readonly rankings: readonly StrategyScore[];
  readonly sensitivity: readonly VendorSensitivityItem[];
}

export const DEFAULT_AI_VENDOR_CRITERIA: readonly StrategyCriterion[] = [
  {
    id: "humanReview",
    label: "Human review and diff gate",
    group: "Oversight",
    weight: 4,
  },
  {
    id: "provenance",
    label: "Source provenance and citations",
    group: "Assurance",
    weight: 4,
  },
  {
    id: "cdiscLint",
    label: "Deterministic CDISC rule parity",
    group: "Standards",
    weight: 4,
  },
  {
    id: "privacy",
    label: "Tenant and retention boundary",
    group: "Privacy",
    weight: 3,
  },
  {
    id: "auditTrail",
    label: "Part 11-style audit log support",
    group: "Assurance",
    weight: 3,
  },
  {
    id: "portability",
    label: "Exit portability and cost cap",
    group: "Continuity",
    weight: 4,
  },
];

export const FICTIONAL_AI_VENDORS: readonly StrategyVendor[] = [
  {
    id: "fictional-alder",
    name: "Fictional Alder Clinical",
    ratings: {
      humanReview: 5,
      provenance: 5,
      cdiscLint: 4,
      privacy: 5,
      auditTrail: 4,
      portability: 3,
    },
  },
  {
    id: "fictional-beacon",
    name: "Fictional Beacon Studio",
    ratings: {
      humanReview: 4,
      provenance: 4,
      cdiscLint: 5,
      privacy: 4,
      auditTrail: 4,
      portability: 5,
    },
  },
  {
    id: "fictional-juniper",
    name: "Fictional Juniper Mapping",
    ratings: {
      humanReview: 4,
      provenance: 3,
      cdiscLint: 4,
      privacy: 3,
      auditTrail: 5,
      portability: 3,
    },
  },
  {
    id: "fictional-cobalt",
    name: "Fictional Cobalt Assist",
    ratings: {
      humanReview: 2,
      provenance: 2,
      cdiscLint: 3,
      privacy: 2,
      auditTrail: 2,
      portability: 4,
    },
  },
];

export const DEFAULT_AI_VENDOR_SCENARIO: StrategyScenario = {
  criteria: DEFAULT_AI_VENDOR_CRITERIA.map((criterion) => ({ ...criterion })),
  vendors: FICTIONAL_AI_VENDORS.map((vendor) => ({
    ...vendor,
    ratings: { ...vendor.ratings },
  })),
};

/**
 * Evaluates fictional clinical AI vendors and +-25% single-criterion weight
 * perturbations through `@/lib/clinical-platform`.
 *
 * @param weights - Criterion weights keyed by criterion id.
 * @returns Ranked fictional vendor scores and sensitivity table.
 */
export function evaluateAiVendorScorecard(
  weights: Readonly<Record<string, number>>
): AiVendorScorecardResult {
  const scenario: StrategyScenario = {
    criteria: DEFAULT_AI_VENDOR_CRITERIA.map((criterion) => ({
      ...criterion,
      weight: weights[criterion.id] ?? criterion.weight,
    })),
    vendors: FICTIONAL_AI_VENDORS.map((vendor) => ({
      ...vendor,
      ratings: { ...vendor.ratings },
    })),
  };

  return {
    rankings: scoreVendors(scenario),
    sensitivity: sensitivity(scenario, 0.25),
  };
}
