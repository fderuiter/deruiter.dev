import {
  RANDOMIZATION_ARTIFACT_SCHEMA_VERSION,
  RANDOMIZATION_CONTRACT_VERSION,
  RANDOMIZATION_PLAN_SCHEMA_VERSION,
  computePlanDigest,
  validateRandomizationPlan,
  type RandomizationRequest,
} from "@/lib/randomization";
import type {
  ResolvedStudyRandomizationPlan,
  StudyEdit,
  StudyRandomizationEvidenceBinding,
  StudyRandomizationEvidenceStatus,
  StudyRandomizationPlan,
  StudyRandomizationPlanArm,
  StudyRandomizationPlanFinding,
  StudyRandomizationPlanState,
  StudyRandomizationStaleReason,
  StudyWorkspace,
} from "../types";
import { StudyDesignError, recordsOf, selectedDesign } from "./design-grid";
import { createStudyPayloadEdit } from "./ops";

/**
 * Randomization plans kept in the workspace (#4003, ADR 0073). Plan edits
 * are payload edits, so they go through the same undo and redo as design
 * edits and each makes a new revision. A plan is resolved into an engine
 * request against the current revision; what it leaves out becomes a draft
 * finding, never a guessed value.
 */

/** Fields of a new plan. */
export interface NewStudyRandomizationPlan {
  readonly name: string;
  readonly state?: StudyRandomizationPlanState;
  readonly arms: readonly StudyRandomizationPlanArm[];
  readonly mechanics?: Readonly<Record<string, unknown>>;
}

/** Fields a plan edit may change. Selection and id never change. */
export interface StudyRandomizationPlanChanges {
  readonly name?: string;
  readonly state?: StudyRandomizationPlanState;
  readonly arms?: readonly StudyRandomizationPlanArm[];
  readonly mechanics?: Readonly<Record<string, unknown>>;
}

function planIndex(workspace: StudyWorkspace, planId: string): number {
  const index = workspace.randomizationPlans.findIndex(
    (plan) => plan.id === planId
  );
  if (index < 0) {
    throw new StudyDesignError(
      `The workspace has no randomization plan ${planId}.`
    );
  }
  return index;
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed)
    throw new StudyDesignError("A randomization plan needs a name.");
  return trimmed;
}

function nextPlanId(workspace: StudyWorkspace): string {
  const used = new Set(workspace.randomizationPlans.map((plan) => plan.id));
  let n = 1;
  while (used.has(`RandomizationPlan_${n}`)) n += 1;
  return `RandomizationPlan_${n}`;
}

/**
 * Adds a plan bound to the workspace's selected study version and design.
 * It starts as a draft unless another state is given.
 */
export function addStudyRandomizationPlan(
  workspace: StudyWorkspace,
  input: NewStudyRandomizationPlan
): StudyEdit {
  const name = cleanName(input.name);
  const plan: StudyRandomizationPlan = {
    id: nextPlanId(workspace),
    schemaVersion: 1,
    name,
    state: input.state ?? "draft",
    studyVersionId: workspace.selection.studyVersionId,
    studyDesignId: workspace.selection.studyDesignId,
    arms: input.arms.map((arm) => ({ ...arm })),
    mechanics: structuredClone(input.mechanics ?? {}),
  };
  return createStudyPayloadEdit(
    workspace,
    [{ op: "add", path: "/randomizationPlans/-", value: plan }],
    `Add randomization plan "${name}"`
  );
}

/** Changes a plan's name, state, arms or mechanics. */
export function updateStudyRandomizationPlan(
  workspace: StudyWorkspace,
  planId: string,
  changes: StudyRandomizationPlanChanges
): StudyEdit {
  const index = planIndex(workspace, planId);
  const current = workspace.randomizationPlans[index];
  const next: StudyRandomizationPlan = {
    ...current,
    ...(changes.name !== undefined ? { name: cleanName(changes.name) } : {}),
    ...(changes.state !== undefined ? { state: changes.state } : {}),
    ...(changes.arms !== undefined
      ? { arms: changes.arms.map((arm) => ({ ...arm })) }
      : {}),
    ...(changes.mechanics !== undefined
      ? { mechanics: structuredClone(changes.mechanics) }
      : {}),
  };
  return createStudyPayloadEdit(
    workspace,
    [{ op: "replace", path: `/randomizationPlans/${index}`, value: next }],
    `Edit randomization plan "${next.name}"`
  );
}

/** Removes a plan. Evidence made from it becomes stale. */
export function removeStudyRandomizationPlan(
  workspace: StudyWorkspace,
  planId: string
): StudyEdit {
  const index = planIndex(workspace, planId);
  return createStudyPayloadEdit(
    workspace,
    [{ op: "remove", path: `/randomizationPlans/${index}` }],
    `Remove randomization plan "${workspace.randomizationPlans[index].name}"`
  );
}

const REQUEST_ENVELOPE = new Set([
  "contractVersion",
  "planSchemaVersion",
  "id",
  "name",
  "provenance",
  "arms",
]);

/**
 * The request without provenance or display text: the inputs the
 * allocations depend on. Renaming the plan or an arm leaves it unchanged.
 */
function inputsOf(request: RandomizationRequest): unknown {
  const { provenance: _provenance, name: _name, ...inputs } = request;
  return {
    ...inputs,
    arms: request.arms.map(({ label: _label, ...arm }) => arm),
  };
}

/**
 * Resolves a plan into an engine request against the current revision.
 * Arms take their labels from the selected design by USDM id. A plan for
 * another design, an arm the design lacks, a design arm the plan leaves
 * out, or anything the engine's validator rejects is returned as a draft
 * finding.
 */
export function resolveStudyRandomizationPlan(
  workspace: StudyWorkspace,
  planId: string
): ResolvedStudyRandomizationPlan {
  const plan = workspace.randomizationPlans.find((p) => p.id === planId);
  if (!plan) {
    return {
      status: "draft",
      findings: [
        { code: "unknown-plan", message: `There is no plan ${planId}.` },
      ],
    };
  }
  const findings: StudyRandomizationPlanFinding[] = [];
  const { studyVersionId, studyDesignId } = workspace.selection;
  if (
    plan.studyVersionId !== studyVersionId ||
    plan.studyDesignId !== studyDesignId
  ) {
    findings.push({
      code: "different-design",
      message: `The plan was made for design ${plan.studyDesignId} in version ${plan.studyVersionId}, not the selected design.`,
    });
  }
  const { design } = selectedDesign(workspace);
  const designArms = recordsOf(design.arms);
  const names = new Map(
    designArms.map((arm) => [String(arm.id), String(arm.name ?? "")])
  );
  const seen = new Set<string>();
  for (const arm of plan.arms) {
    if (seen.has(arm.armId)) {
      findings.push({
        code: "duplicate-arm",
        message: `Arm ${arm.armId} is listed more than once.`,
      });
    }
    seen.add(arm.armId);
    if (!names.has(arm.armId)) {
      findings.push({
        code: "unknown-arm",
        message: `Arm ${arm.armId} is not in the selected design.`,
      });
    }
  }
  for (const [armId, name] of names) {
    if (!seen.has(armId)) {
      findings.push({
        code: "unmapped-arm",
        message: `The design's arm ${name || armId} has no allocation in the plan.`,
      });
    }
  }
  if (findings.length > 0) return { status: "draft", findings };

  const mechanics = Object.fromEntries(
    Object.entries(plan.mechanics).filter(([key]) => !REQUEST_ENVELOPE.has(key))
  );
  const candidate = {
    ...mechanics,
    contractVersion: RANDOMIZATION_CONTRACT_VERSION,
    planSchemaVersion: RANDOMIZATION_PLAN_SCHEMA_VERSION,
    id: plan.id,
    name: plan.name,
    provenance: {
      studyId: studyIdOf(workspace),
      studyVersionId,
      studyDesignId,
      workspaceRevisionId: workspace.revision.id,
      usdmSha256: workspace.revision.sha256,
    },
    arms: plan.arms.map((arm) => ({
      id: arm.armId,
      code: arm.code,
      label: names.get(arm.armId) ?? arm.armId,
      allocationRatio: arm.allocationRatio,
    })),
  };
  const validation = validateRandomizationPlan(candidate);
  const errors = validation.findings.filter(
    (finding) => finding.severity === "error"
  );
  if (!validation.ok || errors.length > 0) {
    return {
      status: "draft",
      findings: (errors.length > 0 ? errors : validation.findings).map(
        (finding) => ({
          code: "invalid-request" as const,
          message: finding.message,
          engineFinding: finding,
        })
      ),
    };
  }
  const request = candidate as unknown as RandomizationRequest;
  return {
    status: "ready",
    request,
    planDigest: computePlanDigest(request),
    inputsDigest: computePlanDigest(inputsOf(request)),
  };
}

function studyIdOf(workspace: StudyWorkspace): string {
  const study = workspace.usdm.study as unknown as Record<string, unknown>;
  return typeof study.id === "string" && study.id
    ? study.id
    : workspace.source.sha256;
}

/**
 * Records what a randomization artifact is made from, for the artifact to
 * keep. Returns null when the plan is not ready to run.
 */
export function bindStudyRandomizationEvidence(
  workspace: StudyWorkspace,
  planId: string
): StudyRandomizationEvidenceBinding | null {
  const resolved = resolveStudyRandomizationPlan(workspace, planId);
  if (resolved.status !== "ready") return null;
  return {
    planId,
    sourceSha256: workspace.source.sha256,
    studyVersionId: workspace.selection.studyVersionId,
    studyDesignId: workspace.selection.studyDesignId,
    workspaceRevisionId: workspace.revision.id,
    usdmSha256: workspace.revision.sha256,
    payloadSha256: workspace.revision.payloadSha256,
    planDigest: resolved.planDigest,
    inputsDigest: resolved.inputsDigest,
    algorithmId: resolved.request.algorithmId,
    contractVersion: RANDOMIZATION_CONTRACT_VERSION,
    planSchemaVersion: RANDOMIZATION_PLAN_SCHEMA_VERSION,
    artifactSchemaVersion: RANDOMIZATION_ARTIFACT_SCHEMA_VERSION,
  };
}

/**
 * Checks evidence against the current workspace. Evidence is current when
 * it names this revision; `provenance-changed` when the workspace moved on
 * but the plan's numerical inputs are the same; otherwise stale, with
 * every reason that applies. A different study source or design never
 * counts as the same evidence.
 */
export function checkStudyRandomizationEvidence(
  workspace: StudyWorkspace,
  binding: StudyRandomizationEvidenceBinding
): StudyRandomizationEvidenceStatus {
  const reasons: StudyRandomizationStaleReason[] = [];
  if (binding.sourceSha256 !== workspace.source.sha256) {
    reasons.push("different-source");
  }
  if (
    binding.studyVersionId !== workspace.selection.studyVersionId ||
    binding.studyDesignId !== workspace.selection.studyDesignId
  ) {
    reasons.push("different-design");
  }
  if (
    binding.contractVersion !== RANDOMIZATION_CONTRACT_VERSION ||
    binding.planSchemaVersion !== RANDOMIZATION_PLAN_SCHEMA_VERSION ||
    binding.artifactSchemaVersion !== RANDOMIZATION_ARTIFACT_SCHEMA_VERSION
  ) {
    reasons.push("engine-changed");
  }
  const exists = workspace.randomizationPlans.some(
    (plan) => plan.id === binding.planId
  );
  if (!exists) {
    reasons.push("plan-removed");
  } else if (!reasons.includes("different-design")) {
    const resolved = resolveStudyRandomizationPlan(workspace, binding.planId);
    if (resolved.status !== "ready") {
      reasons.push("plan-not-ready");
    } else if (
      resolved.inputsDigest !== binding.inputsDigest ||
      resolved.request.algorithmId !== binding.algorithmId
    ) {
      reasons.push("inputs-changed");
    }
  }
  if (reasons.length > 0) return { status: "stale", reasons };
  return binding.workspaceRevisionId === workspace.revision.id &&
    binding.payloadSha256 === workspace.revision.payloadSha256
    ? { status: "current" }
    : { status: "provenance-changed" };
}
