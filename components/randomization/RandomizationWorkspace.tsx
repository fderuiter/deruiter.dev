"use client";

import { useState } from "react";
import {
  MT19937_BLOCK_ALGORITHM_ID,
  MT19937_MINIMIZATION_ALGORITHM_ID,
  enumerateStratumIntersections,
  computePlanDigest,
  reduceAllocationRatios,
  validateRandomizationPlan,
  type BlockSettings,
  type MinimizationSettings,
  type RandomizationRequest,
  type ValidationFinding,
} from "@/lib/randomization";
import {
  RANDOMIZATION_PRESET_SUMMARIES,
  applyRandomizationPreset,
  createRandomizationPreset,
  type PresetReplacedField,
  type RandomizationDesignDraft,
  type RandomizationPresetId,
} from "@/lib/randomization/presets";
import {
  addStudyRandomizationPlan,
  bindStudyRandomizationEvidence,
  checkStudyRandomizationEvidence,
  resolveStudyRandomizationPlan,
  updateStudyRandomizationPlan,
  type StudyEdit,
  type StudyRandomizationPlan,
  type StudyWorkspace,
} from "@/lib/study-workspace";
import { useAnnouncer } from "@/components/providers/A11yProvider";
import { ModalContainer } from "@/components/ui/ModalContainer";
import { RandomizationRunPanel } from "./RandomizationRunPanel";
import { VerificationPanel } from "./VerificationPanel";
import {
  BUTTON,
  CapsStage,
  CommitField,
  FIELD,
  MONO,
  MechanicsStage,
  SitesFactorsStage,
} from "./RandomizationStageEditors";

/** Applies one workspace edit; false when the edit was refused. */
type Apply = (make: (workspace: StudyWorkspace) => StudyEdit) => boolean;

const STAGES = [
  { id: "notice", title: "Use notice" },
  { id: "metadata", title: "Study metadata" },
  { id: "arms", title: "Arms and method" },
  { id: "sites", title: "Sites and factors" },
  { id: "mechanics", title: "Mechanics" },
  { id: "caps", title: "Caps" },
  { id: "review", title: "Review" },
] as const;

type StageId = (typeof STAGES)[number]["id"];

const EXPLORATION = "exploration";

const FIELD_COPY: Record<PresetReplacedField, string> = {
  method: "method",
  algorithmId: "algorithm",
  arms: "arms",
  sites: "sites",
  factors: "factors",
  blockSettings: "block rules",
  minimizationSettings: "minimization settings",
  caps: "caps",
  seed: "seed",
  subjectIdMask: "subject ID mask",
  enrollmentTarget: "enrollment target",
};

const DEFAULT_BLOCK: BlockSettings = {
  defaultRule: { mode: "random-pool", sizes: [] },
  trackingScope: "per-intersection",
  allowPartialFinalBlock: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asList<T>(value: unknown): readonly T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** The draft a stored plan holds. Missing mechanics read as empty values. */
function draftOfPlan(
  plan: StudyRandomizationPlan,
  armNames: ReadonlyMap<string, string>
): RandomizationDesignDraft {
  const m = plan.mechanics;
  const method = m.method === "MINIMIZATION" ? "MINIMIZATION" : "BLOCK";
  return {
    method,
    algorithmId:
      method === "BLOCK"
        ? MT19937_BLOCK_ALGORITHM_ID
        : MT19937_MINIMIZATION_ALGORITHM_ID,
    arms: plan.arms.map((arm) => ({
      id: arm.armId,
      code: arm.code,
      label: armNames.get(arm.armId) ?? arm.armId,
      allocationRatio: arm.allocationRatio,
    })),
    sites: asList(m.sites),
    factors: asList(m.factors),
    caps: isRecord(m.caps)
      ? (m.caps as unknown as RandomizationDesignDraft["caps"])
      : { strategy: "manual", capScope: "per-site", intersectionCaps: [] },
    ...(method === "BLOCK"
      ? {
          blockSettings: isRecord(m.blockSettings)
            ? (m.blockSettings as unknown as BlockSettings)
            : DEFAULT_BLOCK,
        }
      : {
          minimizationSettings: isRecord(m.minimizationSettings)
            ? (m.minimizationSettings as unknown as MinimizationSettings)
            : { virtualCohortSize: 100, biasedCoinProbability: 0.8 },
        }),
    seed: isRecord(m.seed)
      ? (m.seed as unknown as RandomizationDesignDraft["seed"])
      : null,
    subjectIdMask: isRecord(m.subjectIdMask)
      ? (m.subjectIdMask as unknown as RandomizationDesignDraft["subjectIdMask"])
      : { pattern: "" },
    enrollmentTarget:
      typeof m.enrollmentTarget === "number" ? m.enrollmentTarget : 0,
  };
}

/** A draft as plan mechanics: arms stay on the plan, empty fields are left out. */
function mechanicsOf(draft: RandomizationDesignDraft): Record<string, unknown> {
  const {
    arms: _arms,
    seed,
    blockSettings,
    minimizationSettings,
    ...rest
  } = draft;
  return {
    ...rest,
    ...(seed ? { seed } : {}),
    ...(blockSettings ? { blockSettings } : {}),
    ...(minimizationSettings ? { minimizationSettings } : {}),
  };
}

/** Switching method swaps the method's settings and drops caps it cannot use. */
function withMethod(
  draft: RandomizationDesignDraft,
  method: RandomizationDesignDraft["method"]
): RandomizationDesignDraft {
  if (method === draft.method) return draft;
  const { blockSettings: _block, minimizationSettings: _min, ...rest } = draft;
  const caps =
    method === "MINIMIZATION" && draft.caps.strategy === "proportional"
      ? {
          strategy: "manual" as const,
          capScope: draft.caps.capScope,
          intersectionCaps: [],
        }
      : draft.caps;
  return method === "BLOCK"
    ? {
        ...rest,
        method,
        algorithmId: MT19937_BLOCK_ALGORITHM_ID,
        caps,
        blockSettings: DEFAULT_BLOCK,
      }
    : {
        ...rest,
        method,
        algorithmId: MT19937_MINIMIZATION_ALGORITHM_ID,
        caps,
        minimizationSettings: {
          virtualCohortSize:
            draft.enrollmentTarget > 0 ? draft.enrollmentTarget : 100,
          biasedCoinProbability: 0.8,
        },
      };
}

/** The study's protocol identifier, name and phase, read from the USDM. */
function studyMetadata(workspace: StudyWorkspace): {
  protocolId: string;
  studyName: string;
  phase: string;
} {
  const study = workspace.usdm.study as unknown as Record<string, unknown>;
  const version = asList<Record<string, unknown>>(study.versions).find(
    (v) => v.id === workspace.selection.studyVersionId
  );
  const design = asList<Record<string, unknown>>(version?.studyDesigns).find(
    (d) => d.id === workspace.selection.studyDesignId
  );
  const identifier = asList<Record<string, unknown>>(
    version?.studyIdentifiers
  )[0];
  const phase = isRecord(design?.studyPhase)
    ? design.studyPhase.standardCode
    : undefined;
  return {
    protocolId: typeof identifier?.text === "string" ? identifier.text : "",
    studyName: typeof study.name === "string" ? study.name : "",
    phase:
      isRecord(phase) && typeof phase.decode === "string" ? phase.decode : "",
  };
}

function designArms(workspace: StudyWorkspace) {
  const study = workspace.usdm.study as unknown as Record<string, unknown>;
  const version = asList<Record<string, unknown>>(study.versions).find(
    (v) => v.id === workspace.selection.studyVersionId
  );
  const design = asList<Record<string, unknown>>(version?.studyDesigns).find(
    (d) => d.id === workspace.selection.studyDesignId
  );
  return asList<Record<string, unknown>>(design?.arms).map((arm) => ({
    id: String(arm.id),
    name: String(arm.name ?? arm.id),
  }));
}

const CODES = "ABCDEFGHIJKLMNOP";

/** An exploration draft as an engine request with a synthetic envelope. */
function explorationRequest(draft: RandomizationDesignDraft) {
  return {
    ...mechanicsOf(draft),
    arms: draft.arms,
    contractVersion: 1,
    planSchemaVersion: 1,
    id: EXPLORATION,
    name: "Exploration",
    provenance: {
      studyId: "synthetic-exploration",
      studyVersionId: "synthetic",
      studyDesignId: "synthetic",
      workspaceRevisionId: "synthetic",
      usdmSha256: "0".repeat(64),
    },
  };
}

/** The request Run would freeze, or null while the plan is not ready. */
function runnableRequest(
  workspace: StudyWorkspace,
  plan: StudyRandomizationPlan | null,
  draft: RandomizationDesignDraft
): RandomizationRequest | null {
  if (plan) {
    const resolved = resolveStudyRandomizationPlan(workspace, plan.id);
    return resolved.status === "ready" ? resolved.request : null;
  }
  const errors = explorationFindings(draft).filter(
    (finding) => finding.severity === "error"
  );
  return errors.length === 0
    ? (explorationRequest(draft) as unknown as RandomizationRequest)
    : null;
}

/** Exact validator findings for an exploration draft. */
function explorationFindings(
  draft: RandomizationDesignDraft
): readonly ValidationFinding[] {
  return validateRandomizationPlan(explorationRequest(draft)).findings;
}

interface Exploration {
  readonly draft: RandomizationDesignDraft;
  readonly baseline: RandomizationDesignDraft;
  readonly acknowledged: boolean;
  readonly protocolId: string;
  readonly studyName: string;
  readonly phase: string;
}

function newExploration(): Exploration {
  const draft = createRandomizationPreset("simple");
  return {
    draft,
    baseline: draft,
    acknowledged: false,
    protocolId: "",
    studyName: "",
    phase: "",
  };
}

/**
 * The Randomization work area of Clinical Study Studio (#4006, ADR 0073):
 * seven stages from the use notice to review, over either a plan stored in
 * the study workspace or a synthetic exploration draft. Plan edits are
 * workspace edits, so they share undo, redo and autosave with the rest of
 * the studio. An exploration never touches the study until it is
 * promoted, and promotion asks for the acknowledgment first.
 */
export function RandomizationWorkspace({
  workspace,
  apply,
}: {
  readonly workspace: StudyWorkspace;
  readonly apply: Apply;
}) {
  const { announce } = useAnnouncer();
  const plans = workspace.randomizationPlans;
  const [chosen, setChosen] = useState<string>(plans[0]?.id ?? EXPLORATION);
  const [stage, setStage] = useState<StageId>("notice");
  const [exploration, setExploration] = useState<Exploration>(newExploration);
  const [pending, setPending] = useState<{
    presetId: RandomizationPresetId;
    fields: readonly PresetReplacedField[];
  } | null>(null);

  // A removed plan, or an undo past its creation, falls back to exploration.
  const plan = plans.find((p) => p.id === chosen) ?? null;
  const mode = plan ? "plan" : "exploration";
  const armList = designArms(workspace);
  const armNames = new Map(armList.map((arm) => [arm.id, arm.name]));
  const draft = plan ? draftOfPlan(plan, armNames) : exploration.draft;
  const acknowledged = plan
    ? plan.state === "acknowledged-reference"
    : exploration.acknowledged;
  const gated = mode === "plan" && !acknowledged;
  const runnable = runnableRequest(workspace, plan, draft);

  const change = (next: RandomizationDesignDraft) => {
    if (!plan) {
      setExploration((current) => ({ ...current, draft: next }));
      return;
    }
    apply((w) =>
      updateStudyRandomizationPlan(w, plan.id, {
        arms: next.arms.map((arm) => ({
          armId: arm.id,
          code: arm.code,
          allocationRatio: arm.allocationRatio,
        })),
        mechanics: mechanicsOf(next),
      })
    );
  };

  const loadPreset = (presetId: RandomizationPresetId, confirmed: boolean) => {
    const baseline = plan ? null : exploration.baseline;
    const result = applyRandomizationPreset({
      presetId,
      current: draft,
      baseline,
      confirmed,
    });
    if (result.status === "needs-confirmation") {
      setPending({ presetId, fields: result.editedFields });
      return;
    }
    setPending(null);
    const title =
      RANDOMIZATION_PRESET_SUMMARIES.find((s) => s.id === presetId)?.title ??
      presetId;
    if (plan) {
      // The study's arms are design facts: a preset changes the mechanics only.
      change({ ...result.draft, arms: draft.arms });
      announce(`Loaded the ${title} preset's mechanics into ${plan.name}.`);
    } else {
      setExploration((current) => ({
        ...current,
        draft: result.draft,
        baseline: result.draft,
      }));
      announce(`Loaded the ${title} preset.`);
    }
  };

  const addPlan = () => {
    const name = `Randomization plan ${plans.length + 1}`;
    const ok = apply((w) =>
      addStudyRandomizationPlan(w, {
        name,
        arms: armList.map((arm, index) => ({
          armId: arm.id,
          code: CODES[index] ?? `A${index + 1}`,
          allocationRatio: 1,
        })),
        mechanics: {},
      })
    );
    if (ok) {
      setChosen(`RandomizationPlan_${nextPlanNumber(plans)}`);
      setStage("notice");
    }
  };

  const promote = () => {
    const name = exploration.studyName.trim()
      ? `${exploration.studyName.trim()} plan`
      : `Randomization plan ${plans.length + 1}`;
    const { arms: _arms, ...mechanics } = mechanicsOf({
      ...exploration.draft,
      seed: null,
    });
    const ok = apply((w) =>
      addStudyRandomizationPlan(w, {
        name,
        state: "acknowledged-reference",
        arms: armList.map((arm, index) => ({
          armId: arm.id,
          code: CODES[index] ?? `A${index + 1}`,
          allocationRatio: exploration.draft.arms[index]?.allocationRatio ?? 1,
        })),
        mechanics,
      })
    );
    if (ok) {
      setChosen(`RandomizationPlan_${nextPlanNumber(plans)}`);
      setExploration(newExploration());
      setStage("review");
      announce(
        `Promoted the exploration to ${name}. Its arms now come from the selected design, and earlier exploration results no longer apply.`
      );
    }
  };

  const index = STAGES.findIndex((s) => s.id === stage);
  const go = (to: StageId) => {
    setStage(to);
    const title = STAGES.find((s) => s.id === to)?.title;
    announce(
      `Stage ${STAGES.findIndex((s) => s.id === to) + 1} of 7: ${title}.`
    );
  };

  return (
    <section aria-labelledby="randomization" className="min-w-0 space-y-6">
      <div className="space-y-2">
        <h3 id="randomization" className="font-semibold">
          Randomization work area
        </h3>
        <p className={`${MONO} text-xs text-slate-400`}>
          Design {workspace.selection.studyDesignId} · version{" "}
          {workspace.selection.studyVersionId} · revision{" "}
          {workspace.revision.id}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-300">
          Working on
          <select
            className={FIELD}
            value={plan ? plan.id : EXPLORATION}
            onChange={(event) => {
              setChosen(event.target.value);
              setStage("notice");
            }}
          >
            <option value={EXPLORATION}>Exploration (synthetic)</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`${BUTTON} min-w-12`}
          onClick={addPlan}
        >
          Add a plan for this design
        </button>
      </div>

      <fieldset className="min-w-0 space-y-2">
        <legend className="text-sm text-slate-300">
          {mode === "plan"
            ? "Load a preset's mechanics (the design's arms stay)"
            : "Start from a preset"}
        </legend>
        <div className="flex flex-wrap gap-2">
          {RANDOMIZATION_PRESET_SUMMARIES.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`${BUTTON} min-w-12`}
              aria-label={`${preset.title} preset: ${preset.description}`}
              onClick={() => loadPreset(preset.id, false)}
            >
              {preset.title}
            </button>
          ))}
        </div>
      </fieldset>

      <nav aria-label="Randomization stages">
        <ol className="flex flex-wrap gap-2">
          {STAGES.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                className={`${BUTTON} min-w-12 ${s.id === stage ? "border-amber-400" : ""}`}
                aria-current={s.id === stage ? "step" : undefined}
                disabled={gated && s.id !== "notice"}
                onClick={() => go(s.id)}
              >
                {i + 1}. {s.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="@container min-w-0 rounded border border-white/[0.08] bg-[#13151a] p-4">
        <h4 className="mb-4 font-semibold">
          {index + 1}. {STAGES[index].title}
        </h4>
        {stage === "notice" && (
          <NoticeStage
            acknowledged={acknowledged}
            onChange={(value) => {
              if (plan) {
                apply((w) =>
                  updateStudyRandomizationPlan(w, plan.id, {
                    state: value ? "acknowledged-reference" : "draft",
                  })
                );
              } else {
                setExploration((current) => ({
                  ...current,
                  acknowledged: value,
                }));
              }
            }}
          />
        )}
        {stage === "metadata" && (
          <MetadataStage
            mode={mode}
            workspace={workspace}
            exploration={exploration}
            onChange={(fields) =>
              setExploration((current) => ({ ...current, ...fields }))
            }
          />
        )}
        {stage === "arms" && (
          <ArmsStage mode={mode} draft={draft} onChange={change} />
        )}
        {stage === "sites" && (
          <SitesFactorsStage draft={draft} onChange={change} />
        )}
        {stage === "mechanics" && (
          <MechanicsStage draft={draft} onChange={change} />
        )}
        {stage === "caps" && <CapsStage draft={draft} onChange={change} />}
        {stage === "review" && (
          <ReviewStage
            workspace={workspace}
            plan={plan}
            draft={draft}
            exploration={exploration}
            armCount={armList.length}
            onPromote={promote}
            onGo={go}
          />
        )}
      </div>

      <section
        aria-labelledby="randomization-run"
        hidden={stage !== "review"}
        className="min-w-0 space-y-2"
      >
        <h4 id="randomization-run" className="font-semibold">
          Run and results
        </h4>
        {!runnable && (
          <p className="text-sm text-slate-400">
            Run is available once review reports the plan ready.
          </p>
        )}
        <RandomizationRunPanel
          key={plan?.id ?? EXPLORATION}
          request={gated ? null : runnable}
          revisionId={workspace.revision.id}
          lifecycle={plan ? "promoted" : "exploration"}
          acknowledged={acknowledged}
          metadata={plan ? studyMetadata(workspace) : exploration}
          bind={() =>
            plan ? bindStudyRandomizationEvidence(workspace, plan.id) : null
          }
          checkCurrency={(frozen, binding) => {
            if (plan && binding) {
              const status = checkStudyRandomizationEvidence(
                workspace,
                binding
              );
              return status.status === "stale"
                ? { status: "stale", reasons: status.reasons }
                : status;
            }
            return runnable &&
              computePlanDigest(frozen) === computePlanDigest(runnable)
              ? { status: "current" }
              : { status: "stale", reasons: ["inputs-changed"] };
          }}
        />
      </section>

      <section
        aria-labelledby="randomization-verify"
        hidden={stage !== "review"}
        className="min-w-0 space-y-2 border-t border-white/[0.08] pt-4"
      >
        <h4 id="randomization-verify" className="font-semibold">
          Verify an artifact
        </h4>
        <VerificationPanel />
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`${BUTTON} min-w-12`}
          disabled={index === 0}
          onClick={() => go(STAGES[index - 1].id)}
        >
          Back
        </button>
        <button
          type="button"
          className={`${BUTTON} min-w-12`}
          disabled={index === STAGES.length - 1 || gated}
          onClick={() => go(STAGES[index + 1].id)}
        >
          Next
        </button>
        {gated && (
          <p className="self-center text-sm text-amber-200">
            Acknowledge the use notice to continue with this plan.
          </p>
        )}
      </div>

      <ModalContainer
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        titleId="preset-confirm-title"
        ariaDescribedBy="preset-confirm-body"
      >
        <div className="space-y-4 p-6 text-[#f4f4f6]">
          <h4 id="preset-confirm-title" className="text-lg font-semibold">
            Replace your edits?
          </h4>
          <p id="preset-confirm-body" className="text-sm text-slate-300">
            The preset replaces values you changed:{" "}
            {pending?.fields.map((f) => FIELD_COPY[f]).join(", ")}. It also
            clears the seed. Undo can bring a stored plan back; an exploration
            cannot be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`${BUTTON} min-w-12`}
              onClick={() => pending && loadPreset(pending.presetId, true)}
            >
              Replace
            </button>
            <button
              type="button"
              className={`${BUTTON} min-w-12`}
              onClick={() => setPending(null)}
            >
              Keep my edits
            </button>
          </div>
        </div>
      </ModalContainer>
    </section>
  );
}

function nextPlanNumber(plans: readonly StudyRandomizationPlan[]): number {
  const used = new Set(plans.map((p) => p.id));
  let n = 1;
  while (used.has(`RandomizationPlan_${n}`)) n += 1;
  return n;
}

function NoticeStage({
  acknowledged,
  onChange,
}: {
  readonly acknowledged: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  return (
    <div className="space-y-3 text-sm text-slate-300">
      <p>
        This work area is for synthetic and reference studies. It is not a
        validated system and must not allocate real participants or produce a
        schedule for a live trial.
      </p>
      <label className="flex min-h-12 items-center gap-2">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={acknowledged}
          onChange={(event) => onChange(event.target.checked)}
        />
        I understand and will use it for synthetic or reference work only.
      </label>
    </div>
  );
}

function MetadataStage({
  mode,
  workspace,
  exploration,
  onChange,
}: {
  readonly mode: "plan" | "exploration";
  readonly workspace: StudyWorkspace;
  readonly exploration: Exploration;
  readonly onChange: (fields: Partial<Exploration>) => void;
}) {
  if (mode === "exploration") {
    return (
      <div className="grid gap-3 @md:grid-cols-3">
        <CommitField
          label="Protocol ID"
          value={exploration.protocolId}
          onCommit={(protocolId) => onChange({ protocolId })}
        />
        <CommitField
          label="Study name"
          value={exploration.studyName}
          onCommit={(studyName) => onChange({ studyName })}
        />
        <CommitField
          label="Phase"
          value={exploration.phase}
          onCommit={(phase) => onChange({ phase })}
        />
      </div>
    );
  }
  const meta = studyMetadata(workspace);
  const rows: [string, string][] = [
    ["Protocol ID", meta.protocolId],
    ["Study name", meta.studyName],
    ["Phase", meta.phase],
  ];
  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-400">
        These come from the study itself. Change them in the study, not here.
      </p>
      <dl className="grid gap-2 @md:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-slate-400">{label}</dt>
            <dd className="break-words">
              {value || (
                <span className="text-amber-200">The study does not say.</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ArmsStage({
  mode,
  draft,
  onChange,
}: {
  readonly mode: "plan" | "exploration";
  readonly draft: RandomizationDesignDraft;
  readonly onChange: (next: RandomizationDesignDraft) => void;
}) {
  const reduced = reduceAllocationRatios(draft.arms);
  const setArm = (
    index: number,
    fields: Partial<(typeof draft.arms)[number]>
  ) =>
    onChange({
      ...draft,
      arms: draft.arms.map((arm, i) =>
        i === index ? { ...arm, ...fields } : arm
      ),
    });
  return (
    <div className="space-y-6">
      <fieldset className="min-w-0 space-y-2">
        <legend className="font-semibold">Allocation method</legend>
        {(["BLOCK", "MINIMIZATION"] as const).map((method) => (
          <label
            key={method}
            className="flex min-h-12 items-center gap-2 text-sm"
          >
            <input
              type="radio"
              name="randomization-method"
              className="h-5 w-5"
              checked={draft.method === method}
              onChange={() => onChange(withMethod(draft, method))}
            />
            {method === "BLOCK" ? "Permuted blocks" : "Minimization"}
          </label>
        ))}
      </fieldset>

      <fieldset className="min-w-0 space-y-3">
        <legend className="font-semibold">Arms</legend>
        {mode === "plan" && (
          <p className="text-sm text-slate-400">
            Arms come from the selected design. Add, rename or remove them in
            the design grid.
          </p>
        )}
        <ol className="space-y-3">
          {draft.arms.map((arm, index) => (
            <li
              key={arm.id}
              className="grid min-w-0 gap-2 rounded border border-white/[0.08] p-3 @md:grid-cols-[1fr_8rem_8rem_auto]"
            >
              {mode === "plan" ? (
                <p className="self-center text-sm">
                  {arm.label}{" "}
                  <span className={`${MONO} text-xs text-slate-400`}>
                    {arm.id}
                  </span>
                </p>
              ) : (
                <CommitField
                  label={`Arm ${index + 1} label`}
                  value={arm.label}
                  onCommit={(label) => setArm(index, { label })}
                />
              )}
              <CommitField
                label={`${arm.label} code`}
                value={arm.code}
                onCommit={(code) => setArm(index, { code })}
              />
              <CommitField
                label={`${arm.label} ratio`}
                type="number"
                inputMode="numeric"
                value={String(arm.allocationRatio)}
                onCommit={(text) =>
                  setArm(index, {
                    allocationRatio:
                      text.trim() === "" ? Number.NaN : Number(text),
                  })
                }
              />
              {mode === "exploration" && (
                <div className="flex items-end">
                  <button
                    type="button"
                    className={`${BUTTON} min-w-12`}
                    aria-label={`Remove ${arm.label}`}
                    disabled={draft.arms.length <= 2}
                    onClick={() =>
                      onChange({
                        ...draft,
                        arms: draft.arms.filter((_, i) => i !== index),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
        {mode === "exploration" && (
          <button
            type="button"
            className={`${BUTTON} min-w-12`}
            onClick={() => {
              const ids = new Set(draft.arms.map((a) => a.id));
              let n = draft.arms.length + 1;
              while (ids.has(`arm-${n}`)) n += 1;
              onChange({
                ...draft,
                arms: [
                  ...draft.arms,
                  {
                    id: `arm-${n}`,
                    code: CODES[draft.arms.length] ?? `A${n}`,
                    label: `Arm ${n}`,
                    allocationRatio: 1,
                  },
                ],
              });
            }}
          >
            Add an arm
          </button>
        )}
        <p className={`${MONO} text-sm`} aria-live="polite">
          {reduced.ok
            ? `Reduced ratio ${reduced.ratios.join(":")}`
            : `Ratios need fixing: ${reduced.findings[0]?.message}`}
        </p>
      </fieldset>
    </div>
  );
}

function ReviewStage({
  workspace,
  plan,
  draft,
  exploration,
  armCount,
  onPromote,
  onGo,
}: {
  readonly workspace: StudyWorkspace;
  readonly plan: StudyRandomizationPlan | null;
  readonly draft: RandomizationDesignDraft;
  readonly exploration: Exploration;
  readonly armCount: number;
  readonly onPromote: () => void;
  readonly onGo: (stage: StageId) => void;
}) {
  const intersections = enumerateStratumIntersections(draft.factors).length;
  let ready: boolean;
  let findings: { message: string; fieldPath?: string }[];
  let digest: string | null = null;
  if (plan) {
    const resolved = resolveStudyRandomizationPlan(workspace, plan.id);
    ready = resolved.status === "ready";
    findings =
      resolved.status === "ready"
        ? []
        : resolved.findings.map((f) => ({
            message: f.message,
            fieldPath: f.engineFinding?.fieldPath,
          }));
    if (resolved.status === "ready") digest = resolved.planDigest;
  } else {
    const all = explorationFindings(draft);
    findings = all
      .filter((f) => f.severity === "error")
      .map((f) => ({ message: f.message, fieldPath: f.fieldPath }));
    ready = findings.length === 0;
  }
  const promoteBlockers = [
    !exploration.acknowledged && "acknowledge the use notice",
    armCount < 2 && "give the selected design at least two arms",
  ].filter(Boolean) as string[];
  return (
    <div className="space-y-4 text-sm">
      <p
        role="status"
        className={ready ? "text-emerald-300" : "text-amber-200"}
      >
        {ready
          ? "Ready to run. The engine's validator accepts this plan."
          : `Not ready: ${findings.length} finding${findings.length === 1 ? "" : "s"} to fix.`}
      </p>
      <dl className={`${MONO} grid gap-1 text-xs text-slate-400`}>
        <div>
          <dt className="inline">Method: </dt>
          <dd className="inline">{draft.method}</dd>
        </div>
        <div>
          <dt className="inline">Arms, sites, intersections: </dt>
          <dd className="inline">
            {draft.arms.length}, {draft.sites.length}, {intersections}
          </dd>
        </div>
        {digest && (
          <div className="break-all">
            <dt className="inline">Plan digest: </dt>
            <dd className="inline">{digest}</dd>
          </div>
        )}
      </dl>
      {findings.length > 0 && (
        <ul className="space-y-2">
          {findings.map((finding, i) => (
            <li
              key={`${finding.fieldPath ?? ""}-${i}`}
              className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-100"
            >
              {finding.message}
              {finding.fieldPath && (
                <>
                  {" "}
                  <span className={`${MONO} text-xs`}>
                    ({finding.fieldPath})
                  </span>{" "}
                  <button
                    type="button"
                    className={`${BUTTON} min-w-12 ml-1`}
                    onClick={() => onGo(stageFor(finding.fieldPath!))}
                  >
                    Go to{" "}
                    {
                      STAGES.find((s) => s.id === stageFor(finding.fieldPath!))
                        ?.title
                    }
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {!plan && (
        <div className="space-y-2 border-t border-white/[0.08] pt-4">
          <p className="text-slate-300">
            Promoting copies these mechanics into a new plan for the selected
            design, without the seed. The plan takes its arms from the design,
            and nothing in the study is replaced.
          </p>
          {promoteBlockers.length > 0 && (
            <p className="text-amber-200">
              Before promoting, {promoteBlockers.join(" and ")}.
            </p>
          )}
          <button
            type="button"
            className={`${BUTTON} min-w-12`}
            disabled={promoteBlockers.length > 0}
            onClick={onPromote}
          >
            Promote to a plan for this study
          </button>
        </div>
      )}
    </div>
  );
}

/** The stage that edits the field a finding names. */
function stageFor(fieldPath: string): StageId {
  const root = fieldPath.split(/[.[]/)[0];
  if (root === "arms" || root === "method" || root === "algorithmId") {
    return "arms";
  }
  if (root === "sites" || root === "factors") return "sites";
  if (root === "caps") return "caps";
  return "mechanics";
}
