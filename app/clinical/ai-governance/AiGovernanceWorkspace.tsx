"use client";

import { useState } from "react";
import { IntentLink } from "@/components/ui/IntentLink";
import {
  AI_GOVERNANCE_PAGE_COPY,
  COU_WORKFLOW_PRESETS,
  CROSSWALK_SOURCE_FILTERS,
  DEFAULT_AI_VENDOR_CRITERIA,
  FAILURE_MODE_CATEGORIES,
  FICTIONAL_AI_VENDORS,
  acceptGovernanceProposal,
  advanceSimulatedStudyRevision,
  createInitialReviewSimulatorState,
  evaluateAiVendorScorecard,
  evaluateContextOfUseRisk,
  filterFailureModes,
  filterGovernanceCrosswalk,
  inspectProposalDiff,
  rebaseGovernanceProposal,
  rejectGovernanceProposal,
  undoGovernanceProposal,
  type AiGovernanceWorkspaceEvidence,
  type CouDimensionLevel,
  type CouRiskTier,
  type CrosswalkSourceFilter,
  type FailureModeCategory,
  type ProposalProvenanceTier,
} from "@/lib/clinical-ai-governance";

interface AiGovernanceWorkspaceProps {
  readonly evidence: AiGovernanceWorkspaceEvidence;
}

const LINK =
  "underline decoration-zinc-600 underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

const PILL_BASE =
  "min-h-11 border px-3.5 py-2 font-mono text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 active:scale-[0.98]";

const PILL_ACTIVE =
  "border-amber-400 bg-amber-500/15 text-amber-200 font-semibold";

const PILL_IDLE =
  "border-white/[0.12] bg-[#13151a] text-slate-300 hover:border-white/30 hover:text-white";

const ACTION_BTN =
  "min-h-11 border border-amber-500/60 bg-amber-500/10 px-3.5 py-2 font-mono text-xs text-amber-200 hover:bg-amber-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-white/[0.08] disabled:bg-transparent disabled:text-slate-400 disabled:active:scale-100";

const SECONDARY_BTN =
  "min-h-11 border border-white/[0.14] bg-[#0d0e11] px-3.5 py-2 font-mono text-xs text-slate-200 hover:border-white/30 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-white/[0.08] disabled:text-slate-400 disabled:active:scale-100";

const RISK_TONE: Readonly<Record<CouRiskTier, string>> = {
  low: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  moderate: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  high: "border-amber-400/60 bg-amber-500/15 text-amber-200",
  critical: "border-rose-500/50 bg-rose-500/10 text-rose-200",
};

const TIER_TONE: Readonly<Record<ProposalProvenanceTier, string>> = {
  "Deterministic finding":
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  "Source-backed fact": "border-sky-400/40 bg-sky-500/10 text-sky-200",
  "Model hypothesis": "border-amber-500/50 bg-amber-500/10 text-amber-200",
};

const COU_LEVELS: readonly {
  readonly value: CouDimensionLevel;
  readonly label: string;
}[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function initialWeightsMap(): Record<string, number> {
  return Object.fromEntries(
    DEFAULT_AI_VENDOR_CRITERIA.map((item) => [item.id, item.weight])
  );
}

/**
 * Interactive four-section workspace for `/clinical/ai-governance`.
 */
export function AiGovernanceWorkspace({
  evidence,
}: AiGovernanceWorkspaceProps) {
  const sections = AI_GOVERNANCE_PAGE_COPY.sections;
  const sec1 = sections[0]!;
  const sec2 = sections[1]!;
  const sec3 = sections[2]!;
  const sec4 = sections[3]!;

  // Section 1 state
  const [failureCategory, setFailureCategory] =
    useState<FailureModeCategory>("all");
  const visibleFailures = filterFailureModes(
    evidence.failureModes,
    failureCategory
  );

  // Section 2 state
  const defaultWorkflow = COU_WORKFLOW_PRESETS[0]!;
  const [workflowId, setWorkflowId] = useState<string>(defaultWorkflow.id);
  const [modelInfluence, setModelInfluence] = useState<CouDimensionLevel>(
    defaultWorkflow.defaultInfluence
  );
  const [decisionConsequence, setDecisionConsequence] =
    useState<CouDimensionLevel>(defaultWorkflow.defaultConsequence);
  const [crosswalkSource, setCrosswalkSource] =
    useState<CrosswalkSourceFilter>("all");
  const [scopeToActiveTier, setScopeToActiveTier] = useState<boolean>(false);

  const couResult = evaluateContextOfUseRisk({
    workflowId,
    modelInfluence,
    decisionConsequence,
  });
  const visibleCrosswalk = filterGovernanceCrosswalk(
    crosswalkSource,
    scopeToActiveTier,
    couResult.riskTier
  );

  // Section 3 state
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(
    evidence.scenarios[0]?.id ?? "default"
  );
  const activeScenario =
    evidence.scenarios.find((item) => item.id === selectedScenarioId) ??
    evidence.scenarios[0]!;

  // Section 4A state
  const [simState, setSimState] = useState(createInitialReviewSimulatorState);

  // Section 4B state
  const [weights, setWeights] =
    useState<Record<string, number>>(initialWeightsMap);
  const scorecard = evaluateAiVendorScorecard(weights);

  const handleWorkflowChange = (nextId: string) => {
    setWorkflowId(nextId);
    const preset = COU_WORKFLOW_PRESETS.find((item) => item.id === nextId);
    if (preset) {
      setModelInfluence(preset.defaultInfluence);
      setDecisionConsequence(preset.defaultConsequence);
    }
  };

  return (
    <div>
      {/* ================================================================= */}
      {/* Section 1: Failure modes and mitigations                          */}
      {/* ================================================================= */}
      <section
        aria-labelledby={sec1.id}
        className="section-isolate min-w-0 border-t border-white/[0.08] py-10 sm:py-14"
      >
        <h2
          id={sec1.id}
          className="scroll-mt-24 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl"
        >
          {sec1.heading}
        </h2>
        <p className="mt-3 max-w-3xl break-words text-slate-300">
          {sec1.summary}
        </p>

        <div
          role="group"
          aria-label="Filter failure modes by category"
          className="mt-6 flex min-w-0 flex-wrap gap-2"
        >
          {FAILURE_MODE_CATEGORIES.map((option) => {
            const count = filterFailureModes(
              evidence.failureModes,
              option.id
            ).length;
            const active = failureCategory === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFailureCategory(option.id)}
                className={`${PILL_BASE} ${active ? PILL_ACTIVE : PILL_IDLE}`}
              >
                {option.label} ({count})
              </button>
            );
          })}
        </div>

        <p aria-live="polite" className="mt-4 font-mono text-xs text-slate-300">
          Showing {visibleFailures.length} of {evidence.failureModes.length}{" "}
          failure modes evaluated on synthetic study {evidence.studyId}.
        </p>

        <ul className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2">
          {visibleFailures.map((card) => (
            <li
              key={card.id}
              className="min-w-0 border border-white/[0.08] bg-[#13151a] p-5"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-xs">
                <span className="border border-white/[0.12] px-2 py-0.5 text-slate-300">
                  {
                    FAILURE_MODE_CATEGORIES.find((c) => c.id === card.category)
                      ?.label
                  }
                </span>
                <span
                  className={`border px-2 py-0.5 uppercase ${
                    card.crfCheck.severity === "error"
                      ? "border-amber-500/50 text-amber-300"
                      : "border-slate-500/50 text-slate-300"
                  }`}
                >
                  CRF {card.crfCheck.ruleId} · {card.crfCheck.severity}
                </span>
                <span className="border border-emerald-500/40 px-2 py-0.5 text-emerald-300">
                  Pipeline {card.pipelineCheck.ruleId}
                </span>
              </div>

              <h3 className="mt-3 break-words text-lg font-semibold tracking-[-0.02em] text-white">
                {card.title}
              </h3>
              <p className="mt-2 break-words text-sm leading-relaxed text-slate-300">
                {card.aiFailureSummary}
              </p>
              <p className="mt-2 break-words font-mono text-xs text-slate-400">
                Synthetic case: {card.demoExample}
              </p>

              <dl className="mt-4 grid min-w-0 gap-2 border-t border-white/[0.08] pt-4 text-sm">
                <div className="min-w-0">
                  <dt className="font-mono text-xs text-amber-400">
                    Deterministic CRF check ({card.crfCheck.ruleId})
                  </dt>
                  <dd className="mt-1 break-words text-slate-300">
                    {card.crfCheck.message}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-mono text-xs text-emerald-300">
                    Deterministic remediation
                  </dt>
                  <dd className="mt-1 break-words text-slate-200">
                    {card.crfCheck.suggestedFix}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-mono text-xs text-slate-400">
                    Dataset conformance guard ({card.pipelineCheck.ruleId} ·{" "}
                    {card.pipelineCheck.layer.toUpperCase()}{" "}
                    {card.pipelineCheck.domain})
                  </dt>
                  <dd className="mt-1 break-words text-xs text-slate-300">
                    {card.pipelineCheck.citation}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-mono text-xs text-slate-400">
                    Human review boundary
                  </dt>
                  <dd className="mt-1 break-words text-slate-300">
                    {card.humanReviewGate}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      {/* ================================================================= */}
      {/* Section 2: Standards and guidance                                 */}
      {/* ================================================================= */}
      <section
        aria-labelledby={sec2.id}
        className="section-isolate min-w-0 border-t border-white/[0.08] py-10 sm:py-14"
      >
        <h2
          id={sec2.id}
          className="scroll-mt-24 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl"
        >
          {sec2.heading}
        </h2>
        <p className="mt-3 max-w-3xl break-words text-slate-300">
          {sec2.summary}
        </p>

        {/* 2A: Seven-step Context-of-Use evaluator */}
        <div className="mt-8 border border-white/[0.08] bg-[#13151a] p-5 sm:p-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-400">
            FDA AI draft guidance (docket FDA-2024-D-4689)
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em]">
            Seven-step Context-of-Use credibility evaluator
          </h3>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Select a synthetic {evidence.studyId} workflow and adjust model
            influence and decision consequence to inspect how oversight
            stringency and credibility steps scale.
          </p>

          <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-3">
            <div className="min-w-0">
              <label
                htmlFor="cou-workflow-select"
                className="block font-mono text-xs text-slate-300"
              >
                Synthetic clinical workflow
              </label>
              <select
                id="cou-workflow-select"
                value={workflowId}
                onChange={(event) => handleWorkflowChange(event.target.value)}
                className="mt-2 min-h-11 w-full min-w-0 border border-zinc-700 bg-[#0d0e11] px-3 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                {COU_WORKFLOW_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="min-w-0">
              <legend className="font-mono text-xs text-slate-300">
                Model influence on decision
              </legend>
              <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                {COU_LEVELS.map((level) => {
                  const active = modelInfluence === level.value;
                  return (
                    <button
                      key={level.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setModelInfluence(level.value)}
                      className={`${PILL_BASE} ${active ? PILL_ACTIVE : PILL_IDLE}`}
                    >
                      Influence: {level.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="min-w-0">
              <legend className="font-mono text-xs text-slate-300">
                Decision consequence if wrong
              </legend>
              <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                {COU_LEVELS.map((level) => {
                  const active = decisionConsequence === level.value;
                  return (
                    <button
                      key={level.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDecisionConsequence(level.value)}
                      className={`${PILL_BASE} ${active ? PILL_ACTIVE : PILL_IDLE}`}
                    >
                      Consequence: {level.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <div
            aria-live="polite"
            className="mt-6 border border-white/[0.08] bg-[#0d0e11] p-4"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <span
                className={`border px-2.5 py-1 font-mono text-xs uppercase ${RISK_TONE[couResult.riskTier]}`}
              >
                {couResult.riskLabel}
              </span>
              <span className="font-mono text-xs text-slate-300">
                {couResult.withinIntendedUse
                  ? "Within review-gated intended-use bounds"
                  : "Outside intended-use bounds: keep step LLM-free"}
              </span>
            </div>
            <p className="mt-3 break-words text-sm text-slate-200">
              Oversight stringency: {couResult.oversightStringency}
            </p>
            <p className="mt-1 break-words text-sm text-slate-300">
              Human gate: {couResult.humanReviewGate}
            </p>
          </div>

          <ol className="mt-6 grid min-w-0 gap-3 md:grid-cols-2">
            {couResult.steps.map((item) => (
              <li
                key={item.step}
                className="min-w-0 border border-white/[0.08] bg-[#0d0e11] p-4"
              >
                <p className="font-mono text-xs text-amber-400">
                  Step {item.step} of 7
                </p>
                <h4 className="mt-1 break-words text-base font-semibold text-white">
                  {item.title}
                </h4>
                <p className="mt-2 break-words text-sm leading-relaxed text-slate-300">
                  {item.detail}
                </p>
                <p className="mt-2 break-words font-mono text-xs text-slate-400">
                  Evidence / control: {item.artifactOrControl}
                </p>
              </li>
            ))}
          </ol>
        </div>

        {/* 2B: Filterable Annex 22 / ISPE GAMP AI / Audit-trail crosswalk */}
        <div className="mt-8 border border-white/[0.08] bg-[#13151a] p-5 sm:p-6">
          <h3 className="text-xl font-semibold tracking-[-0.02em]">
            Safeguard crosswalk: EU GMP Annex 22, ISPE GAMP AI and audit
            controls
          </h3>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Filter draft guidance, consultation draft, industry guide and Part
            11-style simulation expectations mapped to concrete controls on this
            site.
          </p>

          <div className="mt-5 flex min-w-0 flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Filter safeguard crosswalk by external document"
              className="flex min-w-0 flex-wrap gap-2"
            >
              {CROSSWALK_SOURCE_FILTERS.map((filter) => {
                const active = crosswalkSource === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCrosswalkSource(filter.id)}
                    className={`${PILL_BASE} ${active ? PILL_ACTIVE : PILL_IDLE}`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              aria-pressed={scopeToActiveTier}
              onClick={() => setScopeToActiveTier((prev) => !prev)}
              className={`${PILL_BASE} ${scopeToActiveTier ? PILL_ACTIVE : PILL_IDLE}`}
            >
              Scope to {couResult.riskLabel.toLowerCase()}
            </button>
          </div>

          <div
            role="region"
            aria-label="Safeguard crosswalk table"
            tabIndex={0}
            className="mt-5 min-w-0 overflow-x-auto border border-white/[0.08] bg-[#0d0e11] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-400"
          >
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                Safeguard crosswalk linking external guidance drafts and
                industry guides to platform controls
              </caption>
              <thead>
                <tr className="border-b border-white/[0.12] bg-[#181b21] font-mono text-xs text-slate-300">
                  <th scope="col" className="px-4 py-3">
                    Source document
                  </th>
                  <th scope="col" className="px-4 py-3">
                    External expectation
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Site safeguard (designed to these controls)
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Gate and verification
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleCrosswalk.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-white/[0.06] align-top"
                  >
                    <th
                      scope="row"
                      className="px-4 py-3 font-mono text-xs font-normal text-amber-300"
                    >
                      {row.sourceBadge}
                    </th>
                    <td className="px-4 py-3 text-slate-300">
                      {row.externalExpectation}
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      {row.platformSafeguard}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block border px-2 py-0.5 font-mono text-xs ${
                          row.enforcementKind === "Code gate"
                            ? "border-emerald-500/40 text-emerald-300"
                            : "border-amber-500/40 text-amber-300"
                        }`}
                      >
                        {row.enforcementKind}
                      </span>
                      <span className="mt-1 block text-xs text-slate-300">
                        {row.verificationMechanism}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Section 3: Live validation evidence                               */}
      {/* ================================================================= */}
      <section
        aria-labelledby={sec3.id}
        className="section-isolate min-w-0 border-t border-white/[0.08] py-10 sm:py-14"
      >
        <h2
          id={sec3.id}
          className="scroll-mt-24 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl"
        >
          {sec3.heading}
        </h2>
        <p className="mt-3 max-w-3xl break-words text-slate-300">
          {sec3.summary} Compare the full interactive pipeline in{" "}
          <IntentLink href="/study-data" className={LINK}>
            Study Data Pipeline
          </IntentLink>{" "}
          and the full standards bill of materials in{" "}
          <IntentLink href="/clinical/standards" className={LINK}>
            Standards Conformance
          </IntentLink>
          .
        </p>

        {/* Pinned standards profile */}
        <div className="mt-6 border border-white/[0.08] bg-[#13151a] p-5">
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold tracking-[-0.02em]">
              Pinned clinical standards profile ({evidence.studyId})
            </h3>
            <p className="font-mono text-xs text-slate-300">
              Seed {evidence.seed} · {evidence.subjectCount} synthetic subjects
              · Local rules v{evidence.localRulesVersion} (
              {evidence.localRuleCount} rules) · {evidence.coreEngineName}{" "}
              {evidence.coreEngineTag} ({evidence.coreEngineCommit.slice(0, 8)})
            </p>
          </div>

          <ul className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {evidence.pinnedStandards.map((pin) => (
              <li
                key={pin.code}
                className="min-w-0 border border-white/[0.08] bg-[#0d0e11] p-3.5"
              >
                <p className="font-mono text-xs text-amber-400">{pin.code}</p>
                <p className="mt-1 font-mono text-sm font-semibold text-white">
                  {pin.citation}
                </p>
                <p className="mt-1 break-words text-xs text-slate-300">
                  {pin.scopeNote}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Scenario switcher */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold tracking-[-0.02em]">
            Compare clean baseline and injected defect runs
          </h3>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Switch between the clean {evidence.studyId} run and deterministic
            fault-injection scenarios to inspect how conformance counts, input
            locks and eCTD package SHA-256 digests respond.
          </p>

          <div
            role="group"
            aria-label="Select synthetic study run scenario"
            className="mt-4 flex min-w-0 flex-wrap gap-2"
          >
            {evidence.scenarios.map((scenario) => {
              const active = scenario.id === activeScenario.id;
              return (
                <button
                  key={scenario.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedScenarioId(scenario.id)}
                  className={`${PILL_BASE} ${active ? PILL_ACTIVE : PILL_IDLE}`}
                >
                  {scenario.label}
                </button>
              );
            })}
          </div>

          <div
            aria-live="polite"
            className="mt-5 border border-white/[0.08] bg-[#13151a] p-5"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-xs">
              <span
                className={`border px-2 py-0.5 uppercase ${
                  activeScenario.isBaseline
                    ? "border-emerald-500/40 text-emerald-300"
                    : "border-amber-500/50 text-amber-300"
                }`}
              >
                {activeScenario.isBaseline
                  ? "Clean baseline"
                  : "Injected defect"}
              </span>
              <span className="text-slate-300">
                {activeScenario.localDeltaSummary}
              </span>
            </div>

            <p className="mt-3 break-words text-sm text-slate-200">
              {activeScenario.description}
            </p>
            <p className="mt-1 break-words text-xs text-slate-300">
              Pipeline handling: {activeScenario.expectedBehavior}
            </p>

            {/* Conformance outcome counters */}
            <dl className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0 border border-white/[0.08] bg-[#0d0e11] p-3.5">
                <dt className="font-mono text-xs text-slate-400">
                  Local conformance errors
                </dt>
                <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-white">
                  {activeScenario.localErrors}
                  <span className="ml-2 text-xs font-normal text-slate-300">
                    ({activeScenario.localWarnings} warnings)
                  </span>
                </dd>
              </div>

              <div className="min-w-0 border border-white/[0.08] bg-[#0d0e11] p-3.5">
                <dt className="font-mono text-xs text-slate-400">
                  CDISC CORE passed / reported
                </dt>
                <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-emerald-300">
                  {activeScenario.corePassed}{" "}
                  <span className="text-xs font-normal text-slate-300">
                    passed · {activeScenario.coreIssuesReported} issue rules
                  </span>
                </dd>
              </div>

              <div className="min-w-0 border border-white/[0.08] bg-[#0d0e11] p-3.5">
                <dt className="font-mono text-xs text-slate-400">
                  Added CORE findings
                </dt>
                <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-amber-300">
                  +{activeScenario.coreAddedFindings}
                  <span className="ml-2 text-xs font-normal text-slate-300">
                    ({activeScenario.coreSkipped} skipped)
                  </span>
                </dd>
              </div>

              <div className="min-w-0 border border-white/[0.08] bg-[#0d0e11] p-3.5">
                <dt className="font-mono text-xs text-slate-400">
                  Hashed package files
                </dt>
                <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-white">
                  {activeScenario.totalFiles}
                  <span className="ml-2 text-xs font-normal text-slate-300">
                    ({activeScenario.packageFindings} export notes)
                  </span>
                </dd>
              </div>
            </dl>

            {/* Input & Manifest SHA-256 locks */}
            <dl className="mt-5 grid min-w-0 gap-3 lg:grid-cols-2">
              <div className="min-w-0 border border-white/[0.08] bg-[#0d0e11] p-3.5">
                <dt className="font-mono text-xs text-amber-400">
                  Recorded CORE input SHA-256 lock
                </dt>
                <dd className="mt-1 break-all font-mono text-xs text-slate-200">
                  {activeScenario.inputSha256}
                </dd>
              </div>
              <div className="min-w-0 border border-white/[0.08] bg-[#0d0e11] p-3.5">
                <dt className="font-mono text-xs text-emerald-300">
                  Reproducible MANIFEST.json SHA-256 ({evidence.fixedTimestamp})
                </dt>
                <dd className="mt-1 break-all font-mono text-xs text-slate-200">
                  {activeScenario.manifestSha256}
                </dd>
              </div>
            </dl>

            {/* Recorded CORE findings sample */}
            <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-2">
              <div
                role="region"
                aria-label="Recorded CDISC CORE findings table"
                tabIndex={0}
                className="min-w-0 overflow-x-auto border border-white/[0.08] bg-[#0d0e11] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-400"
              >
                <table className="w-full border-collapse text-left text-xs">
                  <caption className="border-b border-white/[0.08] bg-[#181b21] px-3.5 py-2.5 text-left font-mono text-xs font-semibold text-white">
                    Recorded CDISC CORE findings (top 5 for active run)
                  </caption>
                  <thead>
                    <tr className="border-b border-white/[0.12] font-mono text-slate-300">
                      <th scope="col" className="px-3.5 py-2">
                        Rule
                      </th>
                      <th scope="col" className="px-3.5 py-2">
                        Dataset
                      </th>
                      <th scope="col" className="px-3.5 py-2">
                        Count
                      </th>
                      <th scope="col" className="px-3.5 py-2">
                        Message
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeScenario.topCoreFindings.map((finding) => (
                      <tr
                        key={`${finding.coreId}-${finding.dataset}`}
                        className="border-b border-white/[0.06] align-top"
                      >
                        <th
                          scope="row"
                          className="px-3.5 py-2 font-mono font-normal text-amber-300"
                        >
                          {finding.coreId}
                        </th>
                        <td className="px-3.5 py-2 font-mono text-slate-200">
                          {finding.dataset}
                        </td>
                        <td className="px-3.5 py-2 font-mono tabular-nums text-slate-200">
                          {finding.count}
                          {finding.addedByScenario > 0 ? (
                            <span className="ml-1.5 border border-amber-500/50 px-1 text-amber-300">
                              +{finding.addedByScenario}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3.5 py-2 text-slate-300">
                          {finding.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Package SHA-256 artifact digests */}
              <div
                role="region"
                aria-label="Selected eCTD module 5 file digests table"
                tabIndex={0}
                className="min-w-0 overflow-x-auto border border-white/[0.08] bg-[#0d0e11] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-400"
              >
                <table className="w-full border-collapse text-left text-xs">
                  <caption className="border-b border-white/[0.08] bg-[#181b21] px-3.5 py-2.5 text-left font-mono text-xs font-semibold text-white">
                    Selected eCTD module 5 file SHA-256 digests
                  </caption>
                  <thead>
                    <tr className="border-b border-white/[0.12] font-mono text-slate-300">
                      <th scope="col" className="px-3.5 py-2">
                        Artifact path
                      </th>
                      <th scope="col" className="px-3.5 py-2">
                        SHA-256 digest
                      </th>
                      <th scope="col" className="px-3.5 py-2">
                        Delta
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeScenario.digests.map((file) => (
                      <tr
                        key={file.path}
                        className="border-b border-white/[0.06] align-top"
                      >
                        <th
                          scope="row"
                          className="break-all px-3.5 py-2 font-mono font-normal text-slate-200"
                        >
                          {file.path}
                        </th>
                        <td className="break-all px-3.5 py-2 font-mono text-slate-300">
                          {file.sha256.slice(0, 16)}…
                        </td>
                        <td className="px-3.5 py-2 font-mono">
                          {file.changedFromBaseline ? (
                            <span className="text-amber-300">Changed</span>
                          ) : (
                            <span className="text-emerald-300">Identical</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* Section 4: Interactive walkthroughs                               */}
      {/* ================================================================= */}
      <section
        aria-labelledby={sec4.id}
        className="section-isolate min-w-0 border-t border-white/[0.08] py-10 sm:py-14"
      >
        <h2
          id={sec4.id}
          className="scroll-mt-24 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl"
        >
          {sec4.heading}
        </h2>
        <p className="mt-3 max-w-3xl break-words text-slate-300">
          {sec4.summary}
        </p>

        {/* 4A: ADR 0067 & ADR 0035 Proposal Review Simulator */}
        <div className="mt-8 border border-white/[0.08] bg-[#13151a] p-5 sm:p-6">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-400">
                ADR 0035 and ADR 0067 review gate
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em]">
                Human-reviewed proposal simulator ({simState.studyId})
              </h3>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Proposals stay inert until a reviewer opens the semantic diff
                preview and accepts. Concurrent manual edits advance the study
                revision and block stale patches until rebased, and accepted
                edits revert in one step.
              </p>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="border border-white/[0.14] bg-[#0d0e11] px-3 py-2 font-mono text-xs text-white">
                Study revision: r{simState.studyRevision}
              </span>
              <button
                type="button"
                onClick={() =>
                  setSimState((prev) => advanceSimulatedStudyRevision(prev))
                }
                className={SECONDARY_BTN}
              >
                Simulate manual edit
              </button>
              <button
                type="button"
                disabled={!simState.undoSnapshot}
                onClick={() =>
                  setSimState((prev) => undoGovernanceProposal(prev))
                }
                className={ACTION_BTN}
              >
                Undo last accepted edit
              </button>
              <button
                type="button"
                onClick={() => setSimState(createInitialReviewSimulatorState())}
                className={SECONDARY_BTN}
              >
                Reset simulator
              </button>
            </div>
          </div>

          {simState.lastBlockedReason ? (
            <p
              role="status"
              aria-live="polite"
              className="mt-4 border-l-2 border-amber-500 bg-[#0d0e11] px-4 py-3 text-sm text-amber-200"
            >
              {simState.lastBlockedReason}
            </p>
          ) : null}

          {/* Current DEMO-301 local draft state */}
          <div className="mt-6 border border-white/[0.08] bg-[#0d0e11] p-4">
            <h4 className="font-mono text-xs uppercase tracking-[0.16em] text-slate-300">
              Current {simState.studyId} local form state (revision r
              {simState.studyRevision})
            </h4>
            <dl className="mt-3 grid min-w-0 gap-3 md:grid-cols-3">
              {simState.fields.map((field) => (
                <div
                  key={field.fieldKey}
                  className="min-w-0 border border-white/[0.08] bg-[#13151a] p-3"
                >
                  <dt className="font-mono text-xs text-slate-400">
                    {field.formName} · {field.label}
                  </dt>
                  <dd className="mt-1 break-words text-sm text-white">
                    {field.value}
                  </dd>
                  {field.updatedByProposalId ? (
                    <dd className="mt-1 font-mono text-xs text-emerald-300">
                      Applied via {field.updatedByProposalId}
                    </dd>
                  ) : null}
                </div>
              ))}
            </dl>
          </div>

          {/* Three provenance-tiered proposals */}
          <ul className="mt-6 grid min-w-0 gap-4 lg:grid-cols-3">
            {simState.proposals.map((proposal) => {
              const isPending = proposal.status === "pending";
              const isStale =
                isPending &&
                proposal.baseStudyRevision !== simState.studyRevision;
              const canAccept = isPending && proposal.diffPreviewed && !isStale;

              return (
                <li
                  key={proposal.id}
                  data-testid={`proposal-card-${proposal.id}`}
                  className="flex min-w-0 flex-col justify-between border border-white/[0.08] bg-[#0d0e11] p-4"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-xs">
                      <span
                        className={`border px-2 py-0.5 ${TIER_TONE[proposal.tier]}`}
                      >
                        {proposal.tier}
                      </span>
                      {proposal.needsReview ? (
                        <span className="border border-amber-400 bg-amber-500/20 px-2 py-0.5 font-semibold text-amber-200">
                          Needs review
                        </span>
                      ) : null}
                      <span
                        className={`border px-2 py-0.5 ${
                          proposal.status === "accepted"
                            ? "border-emerald-500/50 text-emerald-300"
                            : proposal.status === "rejected"
                              ? "border-slate-500/50 text-slate-300"
                              : isStale
                                ? "border-rose-500/50 text-rose-200"
                                : "border-white/[0.12] text-slate-300"
                        }`}
                      >
                        {proposal.status === "accepted"
                          ? "Accepted"
                          : proposal.status === "rejected"
                            ? "Rejected"
                            : isStale
                              ? `Stale revision (r${proposal.baseStudyRevision} vs r${simState.studyRevision})`
                              : `Base r${proposal.baseStudyRevision}`}
                      </span>
                    </div>

                    <h4 className="mt-3 break-words text-base font-semibold text-white">
                      {proposal.title}
                    </h4>
                    <p className="mt-2 break-words text-xs text-slate-300">
                      {proposal.rationale}
                    </p>
                    <p className="mt-2 break-words font-mono text-xs text-slate-400">
                      Source: {proposal.sourceCitation}
                    </p>
                    <p className="mt-1 break-words font-mono text-xs text-slate-400">
                      Reviewer: {proposal.reviewerRole}
                    </p>

                    {proposal.diffPreviewed ? (
                      <div className="mt-3 border border-white/[0.1] bg-[#181b21] p-3 text-xs">
                        <p className="font-mono text-slate-300">
                          Semantic diff on {proposal.targetFieldKey}
                        </p>
                        <p className="mt-1.5 break-words font-mono text-rose-300">
                          - {proposal.beforeValue}
                        </p>
                        <p className="mt-1 break-words font-mono text-emerald-300">
                          + {proposal.proposedValue}
                        </p>
                        <p className="mt-2 font-mono text-slate-300">
                          Assumptions:
                        </p>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-300">
                          {proposal.assumptions.map((assumption) => (
                            <li key={assumption} className="break-words">
                              {assumption}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 border-t border-white/[0.08] pt-3">
                    {isPending && !proposal.diffPreviewed ? (
                      <p className="mb-2 font-mono text-xs text-amber-300">
                        Preview diff required before Accept is enabled.
                      </p>
                    ) : null}
                    {isStale ? (
                      <p className="mb-2 font-mono text-xs text-rose-200">
                        Blocked: stale study revision (targets r
                        {proposal.baseStudyRevision}, study is at r
                        {simState.studyRevision}).
                      </p>
                    ) : null}

                    <div className="flex min-w-0 flex-wrap gap-2">
                      <button
                        type="button"
                        aria-expanded={proposal.diffPreviewed}
                        disabled={proposal.diffPreviewed}
                        onClick={() =>
                          setSimState((prev) =>
                            inspectProposalDiff(prev, proposal.id)
                          )
                        }
                        className={SECONDARY_BTN}
                      >
                        {proposal.diffPreviewed
                          ? "Diff previewed"
                          : `Preview diff (${proposal.tier})`}
                      </button>

                      <button
                        type="button"
                        disabled={!canAccept}
                        onClick={() =>
                          setSimState((prev) =>
                            acceptGovernanceProposal(prev, proposal.id)
                          )
                        }
                        className={ACTION_BTN}
                      >
                        Accept ({proposal.tier})
                      </button>

                      <button
                        type="button"
                        disabled={!isPending}
                        onClick={() =>
                          setSimState((prev) =>
                            rejectGovernanceProposal(prev, proposal.id)
                          )
                        }
                        className={SECONDARY_BTN}
                      >
                        Reject ({proposal.tier})
                      </button>

                      {isStale ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSimState((prev) =>
                              rebaseGovernanceProposal(prev, proposal.id)
                            )
                          }
                          className={ACTION_BTN}
                        >
                          Rebase onto r{simState.studyRevision}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Simulation review log */}
          <div className="mt-6 border border-white/[0.08] bg-[#0d0e11] p-4">
            <h4 className="font-mono text-xs uppercase tracking-[0.16em] text-slate-300">
              Part 11-style review log (simulation)
            </h4>
            <ol className="mt-3 space-y-1.5 font-mono text-xs text-slate-300">
              {simState.reviewLog.map((entry) => (
                <li key={entry.step} className="break-words">
                  <span className="text-amber-400">
                    #{entry.step} [r{entry.revision} · {entry.action}]
                  </span>{" "}
                  {entry.detail}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* 4B: Fictional AI Vendor Scorecard */}
        <div className="mt-8 border border-white/[0.08] bg-[#13151a] p-5 sm:p-6">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-400">
                Deterministic strategy engine
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em]">
                Fictional clinical AI vendor scorecard and sensitivity
              </h3>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Adjust criterion weights from 0 to 5 to recompute normalised
                scores and +-25% single-weight sensitivity across four invented
                vendors. Compare full TCO and build-or-buy models in{" "}
                <IntentLink href="/platform/strategy" className={LINK}>
                  Platform Strategy
                </IntentLink>
                .
              </p>
            </div>

            <button
              type="button"
              onClick={() => setWeights(initialWeightsMap())}
              className={SECONDARY_BTN}
            >
              Reset weights
            </button>
          </div>

          <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-2">
            {/* Weight sliders */}
            <div className="min-w-0 space-y-4 border border-white/[0.08] bg-[#0d0e11] p-4">
              <h4 className="font-mono text-xs uppercase tracking-[0.16em] text-slate-300">
                Evaluation criteria weights (0 to 5)
              </h4>
              {DEFAULT_AI_VENDOR_CRITERIA.map((criterion) => {
                const currentWeight = weights[criterion.id] ?? criterion.weight;
                const inputId = `vendor-weight-${criterion.id}`;
                return (
                  <div key={criterion.id} className="min-w-0">
                    <div className="flex min-w-0 items-center justify-between gap-2 text-sm">
                      <label htmlFor={inputId} className="text-slate-200">
                        {criterion.label}{" "}
                        <span className="font-mono text-xs text-slate-400">
                          ({criterion.group})
                        </span>
                      </label>
                      <span className="font-mono text-xs tabular-nums text-amber-300">
                        Weight: {currentWeight}
                      </span>
                    </div>
                    <input
                      id={inputId}
                      type="range"
                      min={0}
                      max={5}
                      step={1}
                      value={currentWeight}
                      onChange={(event) =>
                        setWeights((prev) => ({
                          ...prev,
                          [criterion.id]: Number(event.target.value),
                        }))
                      }
                      className="mt-1.5 min-h-11 w-full cursor-pointer accent-amber-400 focus-visible:outline-2 focus-visible:outline-amber-400"
                    />
                  </div>
                );
              })}
            </div>

            {/* Ranked fictional vendors */}
            <div className="min-w-0 border border-white/[0.08] bg-[#0d0e11] p-4">
              <h4 className="font-mono text-xs uppercase tracking-[0.16em] text-slate-300">
                Normalised ranking (scoreVendors)
              </h4>
              <ol aria-live="polite" className="mt-4 space-y-3">
                {scorecard.rankings.map((entry, idx) => {
                  const vendorRatings = FICTIONAL_AI_VENDORS.find(
                    (v) => v.id === entry.id
                  )?.ratings;
                  return (
                    <li
                      key={entry.id}
                      className="min-w-0 border border-white/[0.08] bg-[#13151a] p-3.5"
                    >
                      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                        <p className="font-semibold text-white">
                          <span className="mr-2 font-mono text-xs text-amber-400">
                            #{idx + 1}
                          </span>
                          {entry.name}
                        </p>
                        <p className="font-mono text-sm font-semibold tabular-nums text-emerald-300">
                          {entry.score === null
                            ? "Unranked (zero weights)"
                            : `${entry.score.toFixed(2)} / 5.00`}
                        </p>
                      </div>
                      {vendorRatings ? (
                        <p className="mt-1.5 break-words font-mono text-xs text-slate-400">
                          {DEFAULT_AI_VENDOR_CRITERIA.map(
                            (c) => `${c.id}:${vendorRatings[c.id] ?? 0}`
                          ).join(" · ")}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          {/* Sensitivity rankings */}
          <div
            role="region"
            aria-label="Fictional vendor weight sensitivity table"
            tabIndex={0}
            className="mt-6 min-w-0 overflow-x-auto border border-white/[0.08] bg-[#0d0e11] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-400"
          >
            <table className="w-full border-collapse text-left text-xs">
              <caption className="border-b border-white/[0.08] bg-[#181b21] px-4 py-2.5 text-left font-mono text-xs font-semibold text-white">
                Single-weight +-25% sensitivity check (sensitivity)
              </caption>
              <thead>
                <tr className="border-b border-white/[0.12] font-mono text-slate-300">
                  <th scope="col" className="px-4 py-2">
                    Weight perturbation
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Top-ranked fictional vendor
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Winner stability
                  </th>
                </tr>
              </thead>
              <tbody>
                {scorecard.sensitivity.map((row) => (
                  <tr key={row.label} className="border-b border-white/[0.06]">
                    <th
                      scope="row"
                      className="px-4 py-2 font-mono font-normal text-slate-200"
                    >
                      {row.label}
                    </th>
                    <td className="px-4 py-2 text-slate-300">
                      {row.winner ?? "Unranked"}
                    </td>
                    <td className="px-4 py-2 font-mono">
                      {row.changed ? (
                        <span className="border border-amber-500/50 px-1.5 py-0.5 text-amber-300">
                          Rank flip
                        </span>
                      ) : (
                        <span className="text-emerald-300">Unchanged</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
