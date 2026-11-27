import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  STUDY_CRITERION_CATEGORIES,
  STUDY_ENDPOINT_LEVELS,
  STUDY_OBJECTIVE_LEVELS,
  StudyDesignError,
  TAVR_DEVICE_USDM,
  TAVR_SAVR_USDM,
  addStudyCriterion,
  addStudyEndpoint,
  addStudyObjective,
  applyStudyEdit,
  createBlankStudyWorkspace,
  emptyStudyEditHistory,
  exportValidatedStudyUsdm,
  importUsdmStudy,
  moveStudyCriterion,
  moveStudyEndpoint,
  moveStudyObjective,
  projectStudyNarrative,
  removeStudyCriterion,
  removeStudyEndpoint,
  removeStudyObjective,
  undoStudyEdit,
  updateStudyCriterion,
  updateStudyEndpoint,
  updateStudyObjective,
  type StudyEdit,
  type StudyWorkspace,
} from "@/lib/study-workspace";

let rctWorkspace: StudyWorkspace;
let deviceWorkspace: StudyWorkspace;

beforeAll(async () => {
  const rct = await importUsdmStudy({ document: TAVR_SAVR_USDM });
  const dev = await importUsdmStudy({ document: TAVR_DEVICE_USDM });
  if (rct.status !== "ok" || dev.status !== "ok") {
    throw new Error("Reference studies failed to import.");
  }
  rctWorkspace = rct.workspace;
  deviceWorkspace = dev.workspace;
});

function apply(ws: StudyWorkspace, edit: StudyEdit): StudyWorkspace {
  return applyStudyEdit(ws, emptyStudyEditHistory(), edit).workspace;
}

describe("study workspace narrative view and operations", () => {
  it("projects objectives, nested endpoints, and criteria from both reference studies", () => {
    const rct = projectStudyNarrative(rctWorkspace);
    expect(rct.objectives).toHaveLength(4);
    expect(rct.endpointCount).toBe(7);
    expect(rct.criteria).toHaveLength(7);
    expect(rct.findings).toEqual([]);

    const dev = projectStudyNarrative(deviceWorkspace);
    expect(dev.objectives).toHaveLength(2);
    expect(dev.endpointCount).toBe(2);
    expect(dev.criteria).toHaveLength(7);
    expect(dev.findings).toEqual([]);
  });

  it("matches Objective Level, Endpoint Level, and IECAT codelists in the pinned CT subset", () => {
    const subset = JSON.parse(
      readFileSync(
        path.resolve(import.meta.dirname, "fixtures/cdisc-ct/ct-subset.json"),
        "utf8"
      )
    ) as {
      concepts: Record<string, { memberOf: Record<string, string> }>;
    };
    const membersOf = (codelist: string) =>
      Object.entries(subset.concepts)
        .filter(([, concept]) => codelist in concept.memberOf)
        .map(([code]) => code)
        .sort();
    const codes = (terms: readonly { code: string }[]) =>
      terms.map((t) => t.code).sort();

    expect(codes(STUDY_OBJECTIVE_LEVELS)).toEqual(membersOf("C188725"));
    expect(codes(STUDY_ENDPOINT_LEVELS)).toEqual(membersOf("C188726"));
    expect(codes(STUDY_CRITERION_CATEGORIES)).toEqual(membersOf("C66797"));
  });

  it("adds, updates, reorders, and removes objectives, endpoints, and criteria while preserving USDM v4 validity", async () => {
    let ws = (await createBlankStudyWorkspace()).workspace;

    ws = apply(
      ws,
      addStudyObjective(ws, {
        name: "Primary Objective",
        levelCode: "C85826",
        text: "Evaluate primary valve hemodynamics at 30 days.",
      })
    );
    ws = apply(
      ws,
      addStudyObjective(ws, {
        name: "Secondary Safety Objective",
        levelCode: "C85827",
        text: "Characterize 30-day major vascular complications.",
      })
    );

    let view = projectStudyNarrative(ws);
    const primaryObjId = view.objectives[0].id;
    const secondaryObjId = view.objectives[1].id;

    ws = apply(
      ws,
      addStudyEndpoint(ws, {
        objectiveId: primaryObjId,
        name: "Mean Aortic Gradient",
        levelCode: "C94496",
        purpose: "Efficacy",
        text: "Mean transvalvular aortic gradient on Day 30 transthoracic echo.",
      })
    );
    ws = apply(
      ws,
      addStudyEndpoint(ws, {
        objectiveId: primaryObjId,
        name: "Effective Orifice Area",
        levelCode: "C139173",
        purpose: "Efficacy",
        text: "Effective orifice area at Day 30.",
      })
    );

    view = projectStudyNarrative(ws);
    const ep1Id = view.objectives[0].endpoints[0].id;
    const ep2Id = view.objectives[0].endpoints[1].id;

    ws = apply(
      ws,
      updateStudyObjective(ws, primaryObjId, {
        name: "Updated Primary Objective",
        levelCode: "C85826",
        text: "Evaluate transvalvular hemodynamics through Day 30.",
      })
    );
    ws = apply(
      ws,
      updateStudyEndpoint(ws, {
        objectiveId: primaryObjId,
        endpointId: ep2Id,
        name: "Day 30 EOA",
        levelCode: "C170559",
        purpose: "Exploratory hemodynamics",
        text: "Indexed effective orifice area at Day 30.",
      })
    );
    ws = apply(
      ws,
      moveStudyEndpoint(ws, {
        objectiveId: primaryObjId,
        endpointId: ep2Id,
        toIndex: 0,
      })
    );
    ws = apply(ws, moveStudyObjective(ws, secondaryObjId, 0));

    // Eligibility criteria add, update, reorder, remove.
    ws = apply(
      ws,
      addStudyCriterion(ws, {
        name: "INC01",
        identifier: "01",
        categoryCode: "C25532",
        text: "Adults aged 65 years or older with severe aortic stenosis.",
      })
    );
    ws = apply(
      ws,
      addStudyCriterion(ws, {
        name: "EXC01",
        identifier: "01",
        categoryCode: "C25370",
        text: "Active endocarditis requiring antibiotic therapy.",
      })
    );

    view = projectStudyNarrative(ws);
    expect(view.objectives.map((o) => o.name)).toEqual([
      "Secondary Safety Objective",
      "Updated Primary Objective",
    ]);
    expect(view.objectives[1].endpoints.map((e) => e.name)).toEqual([
      "Day 30 EOA",
      "Mean Aortic Gradient",
    ]);
    expect(view.criteria).toHaveLength(2);

    const incId = view.criteria[0].id;
    const excId = view.criteria[1].id;
    ws = apply(
      ws,
      updateStudyCriterion(ws, incId, {
        text: "Adults aged 65 to 90 years with symptomatic severe AS.",
        identifier: "01A",
      })
    );
    ws = apply(ws, moveStudyCriterion(ws, excId, 0));
    expect(projectStudyNarrative(ws).criteria.map((c) => c.name)).toEqual([
      "EXC01",
      "INC01",
    ]);

    ws = apply(
      ws,
      removeStudyEndpoint(ws, { objectiveId: primaryObjId, endpointId: ep1Id })
    );
    ws = apply(ws, removeStudyObjective(ws, secondaryObjId));
    ws = apply(ws, removeStudyCriterion(ws, excId));

    const exported = await exportValidatedStudyUsdm(ws);
    expect(exported.status).toBe("ok");
  });

  it("refuses removing an objective or endpoint targeted by an estimand and supports undo", () => {
    expect(() =>
      removeStudyEndpoint(rctWorkspace, {
        objectiveId: "obj_rct_primary",
        endpointId: "ep_rct_hce",
      })
    ).toThrow(StudyDesignError);

    expect(() => removeStudyObjective(rctWorkspace, "obj_rct_primary")).toThrow(
      StudyDesignError
    );

    const edit = updateStudyObjective(rctWorkspace, "obj_rct_primary", {
      text: "Compare hierarchical clinical outcomes at 1 year.",
    });
    const step1 = applyStudyEdit(rctWorkspace, emptyStudyEditHistory(), edit);
    expect(step1.workspace.revision.id).toBe("R2");
    const step2 = undoStudyEdit(step1.workspace, step1.history);
    expect(step2.workspace.revision.id).toBe("R3");
    expect(projectStudyNarrative(step2.workspace).objectives[0].text).toBe(
      projectStudyNarrative(rctWorkspace).objectives[0].text
    );
  });

  it("surfaces explicit findings when criterion items or texts are missing instead of inventing defaults", () => {
    const broken = structuredClone(rctWorkspace);
    const version = broken.usdm.study.versions![0];
    const design = version.studyDesigns![0];

    // Remove the first criterion item and clear text on the second.
    version.eligibilityCriterionItems!.shift();
    version.eligibilityCriterionItems![0].text = "   ";
    design.eligibilityCriteria[0].previousId = "bad_prev";
    design.objectives![0].text = "";
    design.objectives![0].endpoints![0].text = "";
    design.objectives![0].endpoints![0].purpose = "";

    const view = projectStudyNarrative(broken);
    expect(view.criteria[0].hasCriterionItem).toBe(false);
    expect(view.criteria[0].text).toBe("");
    const kinds = view.findings.map((f) => f.kind);
    expect(kinds).toContain("missing-criterion-item");
    expect(kinds).toContain("missing-criterion-text");
    expect(kinds).toContain("criterion-order");
    expect(kinds).toContain("missing-objective-text");
    expect(kinds).toContain("missing-endpoint-text");
    expect(kinds).toContain("missing-endpoint-purpose");

    // Updating a criterion whose EligibilityCriterionItem is missing repairs it cleanly.
    const repaired = apply(
      broken,
      updateStudyCriterion(broken, view.criteria[0].id, {
        text: "Repaired structured criterion text.",
        itemName: "Repaired Item",
      })
    );
    expect(projectStudyNarrative(repaired).criteria[0].hasCriterionItem).toBe(
      true
    );

    // Guard rails reject unknown IDs and non-CT codes.
    expect(() =>
      addStudyObjective(rctWorkspace, {
        name: "Bad",
        levelCode: "NOT_CT",
        text: "text",
      })
    ).toThrow(StudyDesignError);
    expect(() =>
      updateStudyObjective(rctWorkspace, "missing_obj", { name: "X" })
    ).toThrow(StudyDesignError);
    expect(() => moveStudyObjective(rctWorkspace, "missing_obj", 0)).toThrow(
      StudyDesignError
    );
    expect(() =>
      addStudyEndpoint(rctWorkspace, {
        objectiveId: "missing_obj",
        name: "EP",
        levelCode: "C94496",
        purpose: "Efficacy",
        text: "Text",
      })
    ).toThrow(StudyDesignError);
    expect(() =>
      updateStudyEndpoint(rctWorkspace, {
        objectiveId: "obj_rct_primary",
        endpointId: "missing_ep",
        name: "EP",
      })
    ).toThrow(StudyDesignError);
    expect(() =>
      moveStudyEndpoint(rctWorkspace, {
        objectiveId: "obj_rct_primary",
        endpointId: "missing_ep",
        toIndex: 0,
      })
    ).toThrow(StudyDesignError);
    expect(() =>
      addStudyCriterion(rctWorkspace, {
        name: "Crit",
        identifier: "99",
        categoryCode: "BAD_CAT",
        text: "Text",
      })
    ).toThrow(StudyDesignError);
    expect(() => moveStudyCriterion(rctWorkspace, "missing_crit", 0)).toThrow(
      StudyDesignError
    );
    expect(() => removeStudyCriterion(rctWorkspace, "missing_crit")).toThrow(
      StudyDesignError
    );
  });
});
