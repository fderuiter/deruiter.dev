import { beforeAll, describe, expect, it } from "vitest";
import {
  STUDY_INTERCURRENT_EVENT_STRATEGIES,
  StudyDesignError,
  TAVR_DEVICE_USDM,
  TAVR_SAVR_USDM,
  addStudyAnalysisPopulation,
  addStudyEndpoint,
  addStudyEstimand,
  addStudyIntercurrentEvent,
  addStudyIntervention,
  addStudyObjective,
  applyStudyEdit,
  createBlankStudyWorkspace,
  emptyStudyEditHistory,
  exportStudyUsdm,
  exportValidatedStudyUsdm,
  importUsdmStudy,
  moveStudyEstimand,
  moveStudyIntercurrentEvent,
  openStudyWorkspace,
  projectStudyAnalysisIntent,
  projectStudyInterventions,
  projectStudyNarrative,
  removeStudyAnalysisPopulation,
  removeStudyEstimand,
  removeStudyIntercurrentEvent,
  serializeStudyWorkspace,
  undoStudyEdit,
  updateStudyAnalysisPopulation,
  updateStudyEstimand,
  updateStudyIntercurrentEvent,
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

describe("study workspace analysis intent view and operations", () => {
  it("projects estimands, populations, endpoints, and interventions on both reference studies", () => {
    const rct = projectStudyAnalysisIntent(rctWorkspace);
    expect(rct.estimands).toHaveLength(1);
    expect(rct.analysisPopulations).toHaveLength(3);
    expect(rct.availableEndpoints).toHaveLength(7);
    expect(rct.availableInterventions).toHaveLength(2);
    expect(rct.estimands[0].endpointName).toBeTruthy();
    expect(rct.estimands[0].analysisPopulationName).toBe(
      "Intention-to-treat population"
    );
    expect(rct.estimands[0].intercurrentEvents).toHaveLength(3);
    expect(rct.findings).toEqual([]);

    const dev = projectStudyAnalysisIntent(deviceWorkspace);
    expect(dev.estimands).toHaveLength(1);
    expect(dev.analysisPopulations).toHaveLength(3);
    expect(dev.availableEndpoints).toHaveLength(2);
    expect(dev.availableInterventions).toHaveLength(1);
    expect(dev.findings).toEqual([]);
    expect(STUDY_INTERCURRENT_EVENT_STRATEGIES).toContain("Treatment policy");
  });

  it("preserves workspace.analyses untouched across estimand, population, and intercurrent event edits", async () => {
    const sentinelAnalyses = [
      { id: "sap_1", method: "Finkelstein-Schoenfeld win ratio", alpha: 0.05 },
    ];
    let ws: StudyWorkspace = {
      ...(await createBlankStudyWorkspace()).workspace,
      analyses: sentinelAnalyses,
    };

    // Prepare catalog items (intervention, objective+endpoint, population).
    ws = apply(
      ws,
      addStudyIntervention(ws, {
        name: "Investigational Valve",
        roleCode: "C41161",
        typeCode: "C16830",
      })
    );
    ws = apply(
      ws,
      addStudyObjective(ws, {
        name: "Primary Objective",
        levelCode: "C85826",
        text: "Assess 1-year composite clinical outcome.",
      })
    );
    const objId = projectStudyNarrative(ws).objectives[0].id;
    ws = apply(
      ws,
      addStudyEndpoint(ws, {
        objectiveId: objId,
        name: "1-Year Composite",
        levelCode: "C94496",
        purpose: "Efficacy",
        text: "All-cause mortality or disabling stroke at 1 year.",
      })
    );
    ws = apply(
      ws,
      addStudyAnalysisPopulation(ws, {
        name: "Intention-to-Treat",
        label: "ITT",
        text: "All randomized participants.",
      })
    );
    const ittId = projectStudyAnalysisIntent(ws).analysisPopulations[0].id;
    ws = apply(
      ws,
      addStudyAnalysisPopulation(ws, {
        name: "As-Treated",
        label: "AT",
        text: "Randomized participants undergoing attempted procedure.",
        subsetOfIds: [ittId],
      })
    );

    const view0 = projectStudyAnalysisIntent(ws);
    const endpointId = view0.availableEndpoints[0].id;
    const interventionId = projectStudyInterventions(ws)[0].id;
    const atPopId = view0.analysisPopulations[1].id;

    ws = apply(
      ws,
      addStudyEstimand(ws, {
        name: "Primary ITT Estimand",
        description: "Primary treatment policy estimand.",
        populationSummary: "Hazard ratio with 95% confidence interval.",
        analysisPopulationId: ittId,
        variableOfInterestId: endpointId,
        interventionIds: [interventionId],
        intercurrentEvents: [
          {
            name: "Surgical crossover",
            text: "Participant crosses over before index procedure.",
            strategy: "Treatment policy",
          },
        ],
      })
    );
    ws = apply(
      ws,
      addStudyEstimand(ws, {
        name: "Supplementary As-Treated Estimand",
        populationSummary: "Risk difference at Day 365.",
        analysisPopulationId: atPopId,
        variableOfInterestId: endpointId,
        interventionIds: [interventionId],
        intercurrentEvents: [
          {
            name: "Early withdrawal",
            text: "Withdrawal of consent prior to Day 365.",
            strategy: "Hypothetical",
          },
        ],
      })
    );

    let view = projectStudyAnalysisIntent(ws);
    expect(view.estimands).toHaveLength(2);
    const est1Id = view.estimands[0].id;
    const est2Id = view.estimands[1].id;

    // Add, update, reorder, and remove intercurrent events.
    ws = apply(
      ws,
      addStudyIntercurrentEvent(ws, {
        estimandId: est1Id,
        name: "Terminal non-cardiac death",
        text: "Non-cardiovascular death before Day 365.",
        strategy: "Composite variable",
      })
    );
    view = projectStudyAnalysisIntent(ws);
    const secondIceId = view.estimands[0].intercurrentEvents[1].id;
    ws = apply(
      ws,
      updateStudyIntercurrentEvent(ws, {
        estimandId: est1Id,
        eventId: secondIceId,
        strategy: "While on treatment",
      })
    );
    ws = apply(
      ws,
      moveStudyIntercurrentEvent(ws, {
        estimandId: est1Id,
        eventId: secondIceId,
        toIndex: 0,
      })
    );
    ws = apply(
      ws,
      removeStudyIntercurrentEvent(ws, {
        estimandId: est1Id,
        eventId: secondIceId,
      })
    );

    // Update population and estimand, reorder estimands, and remove supplementary estimand.
    ws = apply(
      ws,
      updateStudyAnalysisPopulation(ws, atPopId, {
        label: "mITT",
        text: "Modified ITT population.",
      })
    );
    ws = apply(
      ws,
      updateStudyEstimand(ws, est1Id, {
        populationSummary: "Win ratio with 95% confidence interval.",
      })
    );
    ws = apply(ws, moveStudyEstimand(ws, est2Id, 0));
    ws = apply(ws, removeStudyEstimand(ws, est2Id));

    // Refuses removing ITT population because AT subset and est1 reference it.
    expect(() => removeStudyAnalysisPopulation(ws, ittId)).toThrow(
      StudyDesignError
    );
    ws = apply(ws, removeStudyAnalysisPopulation(ws, atPopId));

    // workspace.analyses is preserved untouched!
    expect(ws.analyses).toEqual(sentinelAnalyses);

    // Re-importing exported USDM keeps accurate content counts.
    const reimported = await importUsdmStudy({
      document: exportStudyUsdm(ws),
    });
    expect(reimported.status).toBe("ok");
    if (reimported.status === "ok") {
      expect(reimported.report.counts).toMatchObject({
        objectives: 1,
        endpoints: 1,
        estimands: 1,
      });
    }

    // Validated USDM export passes with zero schema issues.
    const exported = await exportValidatedStudyUsdm(ws);
    expect(exported.status).toBe("ok");

    // Workspace serialization round-trips analyses intact when hashes align.
    const rctEdited = applyStudyEdit(
      rctWorkspace,
      emptyStudyEditHistory(),
      updateStudyEstimand(rctWorkspace, "estimand_primary", {
        name: "Primary Win-Ratio Estimand",
      })
    );
    expect(rctEdited.workspace.revision.id).toBe("R2");
    const serialized = serializeStudyWorkspace(rctEdited.workspace);
    const reopened = openStudyWorkspace(serialized);
    expect(reopened.status).toBe("ok");

    const undone = undoStudyEdit(rctEdited.workspace, rctEdited.history);
    expect(undone.workspace.revision.id).toBe("R3");
  });

  it("surfaces explicit findings for broken endpoint, population, intervention, and intercurrent event links", () => {
    const broken = structuredClone(rctWorkspace);
    const design = broken.usdm.study.versions![0].studyDesigns![0];
    design.analysisPopulations![1].subsetOfIds = ["missing_pop"];
    design.estimands![0].variableOfInterestId = "missing_ep";
    design.estimands![0].analysisPopulationId = "missing_pop";
    design.estimands![0].interventionIds = ["missing_int"];
    design.estimands![0].populationSummary = "   ";
    design.estimands![0].intercurrentEvents[0].strategy = "   ";

    const view = projectStudyAnalysisIntent(broken);
    expect(view.estimands[0].endpointName).toBeNull();
    expect(view.estimands[0].analysisPopulationName).toBeNull();
    const kinds = view.findings.map((f) => f.kind);
    expect(kinds).toContain("unknown-population-subset");
    expect(kinds).toContain("missing-endpoint-link");
    expect(kinds).toContain("missing-population-link");
    expect(kinds).toContain("unknown-intervention-link");
    expect(kinds).toContain("missing-population-summary");
    expect(kinds).toContain("missing-intercurrent-event-details");

    // Guard rails reject unknown links and blank summaries.
    expect(() =>
      addStudyEstimand(rctWorkspace, {
        name: "Bad Ep",
        populationSummary: "Hazard ratio",
        analysisPopulationId: "pop_rct_itt",
        variableOfInterestId: "missing_ep",
        interventionIds: [],
      })
    ).toThrow(StudyDesignError);
    expect(() =>
      addStudyEstimand(rctWorkspace, {
        name: "Bad Pop",
        populationSummary: "Hazard ratio",
        analysisPopulationId: "missing_pop",
        variableOfInterestId: "ep_rct_hce",
        interventionIds: [],
      })
    ).toThrow(StudyDesignError);
    expect(() =>
      addStudyEstimand(rctWorkspace, {
        name: "Bad Int",
        populationSummary: "Hazard ratio",
        analysisPopulationId: "pop_rct_itt",
        variableOfInterestId: "ep_rct_hce",
        interventionIds: ["missing_int"],
      })
    ).toThrow(StudyDesignError);
    expect(() =>
      updateStudyEstimand(rctWorkspace, "missing_est", { name: "X" })
    ).toThrow(StudyDesignError);
    expect(() => moveStudyEstimand(rctWorkspace, "missing_est", 0)).toThrow(
      StudyDesignError
    );
    expect(() => removeStudyEstimand(rctWorkspace, "missing_est")).toThrow(
      StudyDesignError
    );
    expect(() =>
      updateStudyAnalysisPopulation(rctWorkspace, "missing_pop", { name: "X" })
    ).toThrow(StudyDesignError);
    expect(() =>
      removeStudyAnalysisPopulation(rctWorkspace, "missing_pop")
    ).toThrow(StudyDesignError);
    expect(() =>
      addStudyIntercurrentEvent(rctWorkspace, {
        estimandId: "missing_est",
        name: "Ev",
        text: "Desc",
        strategy: "Treatment policy",
      })
    ).toThrow(StudyDesignError);
    expect(() =>
      updateStudyIntercurrentEvent(rctWorkspace, {
        estimandId: "estimand_primary",
        eventId: "missing_ev",
        name: "Ev",
      })
    ).toThrow(StudyDesignError);
    expect(() =>
      moveStudyIntercurrentEvent(rctWorkspace, {
        estimandId: "estimand_primary",
        eventId: "missing_ev",
        toIndex: 0,
      })
    ).toThrow(StudyDesignError);
    expect(() =>
      removeStudyIntercurrentEvent(rctWorkspace, {
        estimandId: "estimand_primary",
        eventId: "missing_ev",
      })
    ).toThrow(StudyDesignError);
  });
});
