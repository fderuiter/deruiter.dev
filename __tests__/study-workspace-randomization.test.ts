// @vitest-environment node
import { describe, expect, it } from "vitest";
import { usdmContentHash } from "@/lib/clinical-standards";
import {
  MT19937_BLOCK_ALGORITHM_ID,
  serializeStructuralStratumKey,
} from "@/lib/randomization";
import {
  StudyDesignError,
  StudyWorkspaceConflictError,
  TAVR_SAVR_USDM,
  addStudyRandomizationPlan,
  applyStudyEdit,
  bindStudyRandomizationEvidence,
  checkStudyRandomizationEvidence,
  createStudyEdit,
  emptyStudyEditHistory,
  importUsdmStudy,
  openStudyWorkspace,
  redoStudyEdit,
  removeStudyRandomizationPlan,
  renameStudyArm,
  resolveStudyRandomizationPlan,
  serializeStudyWorkspace,
  undoStudyEdit,
  updateStudyRandomizationPlan,
  type StudyEdit,
  type StudyWorkspace,
} from "@/lib/study-workspace";

/** Revision-bound randomization plans in the workspace (#4003, ADR 0073). */

const ARMS = [
  { armId: "arm_rct_tavr", code: "T", allocationRatio: 2 },
  { armId: "arm_rct_savr", code: "S", allocationRatio: 1 },
];

/** Block mechanics the engine accepts: two sites, no strata, blocks of 3. */
const MECHANICS = {
  method: "BLOCK",
  algorithmId: MT19937_BLOCK_ALGORITHM_ID,
  sites: [
    { id: "site-1", code: "S01", label: "Site one", recruitmentWeight: 1 },
    { id: "site-2", code: "S02", label: "Site two", recruitmentWeight: 2 },
  ],
  factors: [],
  seed: { value: "TavrSavr2026", source: "custom" },
  subjectIdMask: { pattern: "{SITE}-{SEQ:3}" },
  enrollmentTarget: 60,
  caps: {
    strategy: "manual",
    capScope: "study-wide",
    intersectionCaps: [
      { stratumKey: serializeStructuralStratumKey([]), cap: 60 },
    ],
  },
  blockSettings: {
    defaultRule: { mode: "fixed-sequence", sizes: [3] },
    trackingScope: "per-intersection",
    allowPartialFinalBlock: true,
  },
};

async function tavrSavr(): Promise<StudyWorkspace> {
  const result = await importUsdmStudy({ document: TAVR_SAVR_USDM });
  if (result.status !== "ok") throw new Error(result.status);
  return result.workspace;
}

function apply(workspace: StudyWorkspace, edit: StudyEdit) {
  return applyStudyEdit(workspace, emptyStudyEditHistory(), edit).workspace;
}

async function withPlan(): Promise<StudyWorkspace> {
  const start = await tavrSavr();
  return apply(
    start,
    addStudyRandomizationPlan(start, {
      name: "2:1 blocks",
      arms: ARMS,
      mechanics: MECHANICS,
    })
  );
}

describe("workspace version 2", () => {
  it("starts with empty analyses and plans and hashes the whole payload", async () => {
    const workspace = await tavrSavr();
    expect(workspace.workspaceVersion).toBe(2);
    expect(workspace.analyses).toEqual([]);
    expect(workspace.randomizationPlans).toEqual([]);
    expect(workspace.revision.payloadSha256).toBe(
      usdmContentHash({
        usdm: workspace.usdm,
        analyses: [],
        randomizationPlans: [],
      })
    );
  });

  it("opens a version 1 file with its USDM-only hash and empty collections", async () => {
    const workspace = await tavrSavr();
    const {
      analyses: _a,
      randomizationPlans: _p,
      revision: { payloadSha256: _h, ...revision },
      ...rest
    } = workspace;
    const v1 = { ...rest, workspaceVersion: 1, revision };
    const opened = openStudyWorkspace(JSON.stringify(v1));
    expect(opened.status).toBe("ok");
    if (opened.status !== "ok") return;
    expect(opened.workspace.workspaceVersion).toBe(2);
    expect(opened.workspace.revision.sha256).toBe(workspace.revision.sha256);
    expect(opened.workspace.revision.payloadSha256).toBe(
      workspace.revision.payloadSha256
    );
    expect(opened.workspace.randomizationPlans).toEqual([]);
  });

  it("round-trips plans, analyses and their hash through a saved file", async () => {
    const workspace = {
      ...(await withPlan()),
    };
    const withAnalysis = {
      ...workspace,
      analyses: [{ id: "AnalysisSpec_1", kind: "win-ratio", extra: [1, 2] }],
    };
    const rehashed = {
      ...withAnalysis,
      revision: {
        ...withAnalysis.revision,
        payloadSha256: usdmContentHash({
          usdm: withAnalysis.usdm,
          analyses: withAnalysis.analyses,
          randomizationPlans: withAnalysis.randomizationPlans,
        }),
      },
    };
    const opened = openStudyWorkspace(serializeStudyWorkspace(rehashed));
    expect(opened).toEqual({ status: "ok", workspace: rehashed });
  });

  it("reports a plan edited by hand outside the studio", async () => {
    const saved = JSON.parse(serializeStudyWorkspace(await withPlan()));
    saved.randomizationPlans[0].arms[0].allocationRatio = 5;
    expect(openStudyWorkspace(JSON.stringify(saved))).toEqual({
      status: "invalid",
      problem: "revision-hash-mismatch",
    });
  });

  it("refuses a malformed plan", async () => {
    const saved = JSON.parse(serializeStudyWorkspace(await withPlan()));
    saved.randomizationPlans[0].state = "approved";
    expect(openStudyWorkspace(JSON.stringify(saved))).toEqual({
      status: "invalid",
      problem: "not-a-workspace",
    });
  });
});

describe("randomization plan edits", () => {
  it("adds a draft plan bound to the selected design as a new revision", async () => {
    const start = await tavrSavr();
    const edited = await withPlan();
    expect(edited.revision).toMatchObject({ id: "R2", parentId: "R1" });
    expect(edited.revision.sha256).toBe(start.revision.sha256);
    expect(edited.revision.payloadSha256).not.toBe(
      start.revision.payloadSha256
    );
    expect(edited.randomizationPlans[0]).toMatchObject({
      id: "RandomizationPlan_1",
      state: "draft",
      studyVersionId: start.selection.studyVersionId,
      studyDesignId: start.selection.studyDesignId,
    });
  });

  it("undoes and redoes a plan edit exactly", async () => {
    const start = await withPlan();
    const edit = updateStudyRandomizationPlan(start, "RandomizationPlan_1", {
      arms: [ARMS[0], { ...ARMS[1], allocationRatio: 2 }],
    });
    const edited = applyStudyEdit(start, emptyStudyEditHistory(), edit);
    const undone = undoStudyEdit(edited.workspace, edited.history);
    expect(undone.workspace.randomizationPlans).toEqual(
      start.randomizationPlans
    );
    expect(undone.workspace.revision.payloadSha256).toBe(
      start.revision.payloadSha256
    );
    const redone = redoStudyEdit(undone.workspace, undone.history);
    expect(redone.workspace.revision.payloadSha256).toBe(
      edited.workspace.revision.payloadSha256
    );
  });

  it("refuses an edit made on an older revision", async () => {
    const start = await withPlan();
    const stale = removeStudyRandomizationPlan(start, "RandomizationPlan_1");
    const moved = apply(
      start,
      createStudyEdit(
        start,
        [{ op: "replace", path: "/study/name", value: "Renamed" }],
        "Rename"
      )
    );
    expect(() => applyStudyEdit(moved, emptyStudyEditHistory(), stale)).toThrow(
      StudyWorkspaceConflictError
    );
    expect(moved.randomizationPlans).toHaveLength(1);
  });

  it("treats a plan named Draft like any other", async () => {
    const start = await tavrSavr();
    const edited = apply(
      start,
      addStudyRandomizationPlan(start, {
        name: "Draft",
        state: "exploration",
        arms: ARMS,
        mechanics: MECHANICS,
      })
    );
    expect(edited.randomizationPlans[0].state).toBe("exploration");
    expect(
      resolveStudyRandomizationPlan(edited, "RandomizationPlan_1").status
    ).toBe("ready");
  });

  it("rejects an unknown plan and an empty name", async () => {
    const start = await withPlan();
    expect(() => removeStudyRandomizationPlan(start, "nope")).toThrow(
      StudyDesignError
    );
    expect(() =>
      updateStudyRandomizationPlan(start, "RandomizationPlan_1", { name: " " })
    ).toThrow(StudyDesignError);
  });
});

describe("resolving a plan", () => {
  it("builds an engine request with labels from the design", async () => {
    const workspace = await withPlan();
    const resolved = resolveStudyRandomizationPlan(
      workspace,
      "RandomizationPlan_1"
    );
    expect(resolved.status).toBe("ready");
    if (resolved.status !== "ready") return;
    expect(resolved.request.arms.map((arm) => arm.label)).toEqual([
      "TAVR System",
      "Surgical AVR",
    ]);
    expect(resolved.request.provenance).toMatchObject({
      workspaceRevisionId: "R2",
      usdmSha256: workspace.revision.sha256,
    });
  });

  it("reports what the plan leaves out instead of guessing", async () => {
    const start = await tavrSavr();
    const edited = apply(
      start,
      addStudyRandomizationPlan(start, {
        name: "Partial",
        arms: [ARMS[0], { armId: "arm_gone", code: "X", allocationRatio: 1 }],
        mechanics: { ...MECHANICS, method: "COIN-FLIP" },
      })
    );
    const resolved = resolveStudyRandomizationPlan(
      edited,
      "RandomizationPlan_1"
    );
    expect(resolved.status).toBe("draft");
    if (resolved.status !== "draft") return;
    expect(resolved.findings.map((f) => f.code)).toEqual([
      "unknown-arm",
      "unmapped-arm",
    ]);
  });

  it("passes on the engine's own findings, such as an unknown method", async () => {
    const start = await tavrSavr();
    const edited = apply(
      start,
      addStudyRandomizationPlan(start, {
        name: "Unknown method",
        arms: ARMS,
        mechanics: { ...MECHANICS, method: "COIN-FLIP" },
      })
    );
    const resolved = resolveStudyRandomizationPlan(
      edited,
      "RandomizationPlan_1"
    );
    expect(resolved.status).toBe("draft");
    if (resolved.status !== "draft") return;
    expect(resolved.findings[0].code).toBe("invalid-request");
    expect(resolved.findings.map((f) => f.engineFinding?.code)).toContain(
      "UNKNOWN_METHOD"
    );
  });

  it("never lets mechanics override the plan's identity or provenance", async () => {
    const start = await tavrSavr();
    const edited = apply(
      start,
      addStudyRandomizationPlan(start, {
        name: "Sneaky",
        arms: ARMS,
        mechanics: {
          ...MECHANICS,
          id: "other",
          provenance: { studyId: "x" },
          arms: [],
        },
      })
    );
    const resolved = resolveStudyRandomizationPlan(
      edited,
      "RandomizationPlan_1"
    );
    expect(resolved.status).toBe("ready");
    if (resolved.status !== "ready") return;
    expect(resolved.request.id).toBe("RandomizationPlan_1");
    expect(resolved.request.arms).toHaveLength(2);
  });
});

describe("randomization evidence", () => {
  it("is current on the revision it was made from", async () => {
    const workspace = await withPlan();
    const binding = bindStudyRandomizationEvidence(
      workspace,
      "RandomizationPlan_1"
    );
    expect(binding).not.toBeNull();
    if (!binding) return;
    expect(checkStudyRandomizationEvidence(workspace, binding)).toEqual({
      status: "current",
    });
  });

  it("tells a provenance-only change from a changed input", async () => {
    const workspace = await withPlan();
    const binding = bindStudyRandomizationEvidence(
      workspace,
      "RandomizationPlan_1"
    );
    if (!binding) throw new Error("not ready");

    const renamed = apply(
      workspace,
      renameStudyArm(workspace, "arm_rct_tavr", "TAVR")
    );
    expect(checkStudyRandomizationEvidence(renamed, binding)).toEqual({
      status: "provenance-changed",
    });

    const reweighted = apply(
      workspace,
      updateStudyRandomizationPlan(workspace, "RandomizationPlan_1", {
        arms: [ARMS[0], { ...ARMS[1], allocationRatio: 2 }],
      })
    );
    expect(checkStudyRandomizationEvidence(reweighted, binding)).toEqual({
      status: "stale",
      reasons: ["inputs-changed"],
    });
  });

  it("goes stale when a referenced arm or the plan is removed", async () => {
    const workspace = await withPlan();
    const binding = bindStudyRandomizationEvidence(
      workspace,
      "RandomizationPlan_1"
    );
    if (!binding) throw new Error("not ready");
    const removedPlan = apply(
      workspace,
      removeStudyRandomizationPlan(workspace, "RandomizationPlan_1")
    );
    expect(checkStudyRandomizationEvidence(removedPlan, binding)).toEqual({
      status: "stale",
      reasons: ["plan-removed"],
    });
    const remapped = apply(
      workspace,
      updateStudyRandomizationPlan(workspace, "RandomizationPlan_1", {
        arms: [ARMS[0], { armId: "arm_gone", code: "X", allocationRatio: 1 }],
      })
    );
    expect(checkStudyRandomizationEvidence(remapped, binding)).toEqual({
      status: "stale",
      reasons: ["plan-not-ready"],
    });
  });

  it("never attaches evidence to a different design", async () => {
    const workspace = await withPlan();
    const binding = bindStudyRandomizationEvidence(
      workspace,
      "RandomizationPlan_1"
    );
    if (!binding) throw new Error("not ready");
    const other = {
      ...workspace,
      selection: { ...workspace.selection, studyDesignId: "another_design" },
    };
    const status = checkStudyRandomizationEvidence(other, binding);
    expect(status.status).toBe("stale");
  });

  it("binds nothing for a plan that is not ready", async () => {
    const start = await tavrSavr();
    const edited = apply(
      start,
      addStudyRandomizationPlan(start, { name: "Empty", arms: [] })
    );
    expect(
      bindStudyRandomizationEvidence(edited, "RandomizationPlan_1")
    ).toBeNull();
  });
});
