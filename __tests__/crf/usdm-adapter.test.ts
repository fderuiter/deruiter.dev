// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  StudyProtocol,
  StudyProtocolEngine,
  ONCOLOGY_RECIST_PRESET,
  exportStudyToUsdm,
  exportStudyToUsdmObject,
  importStudyFromUsdm,
  diffUsdmProtocols,
  validateUniversalCrf,
  diffUniversalCrfStudies,
  getUniversalCrfSchemaUrl,
} from "@/lib/crf";

describe("Graph-Extended Schema & USDM Bidirectional Adapter", () => {
  it("validates protocol containing explicit arms, epochs, cohorts, and biomedical concepts without error", () => {
    const validation = validateUniversalCrf(ONCOLOGY_RECIST_PRESET);
    expect(validation.success).toBe(true);
    expect(validation.study?.arms?.length).toBe(2);
    expect(validation.study?.epochs?.length).toBe(3);
    expect(validation.study?.cohorts?.length).toBe(1);
    expect(validation.study?.biomedicalConcepts?.length).toBe(3);
  });

  it("retains backward compatibility with flat protocol schemas lacking arms or epochs", () => {
    const flatProtocol: StudyProtocol = {
      id: "flat_01",
      protocolNumber: "FLAT-2026",
      studyName: "Flat Legacy Study Protocol",
      phase: "Phase II",
      sponsor: "Legacy Sponsor",
      therapeuticArea: "Cardiology",
      version: "1.0",
      lastModified: "2026-01-01",
      forms: [
        {
          id: "f_vs",
          name: "Vital Signs",
          domain: "VS",
          description: "Vital signs collection",
          version: "1.0",
          sections: [
            {
              id: "sec_1",
              title: "Vitals",
              fields: [
                {
                  id: "f_sysbp",
                  variableName: "SYSBP",
                  label: "Systolic Blood Pressure",
                  dataType: "integer",
                  columnSpan: 6,
                  required: true,
                  unit: "mmHg",
                },
              ],
            },
          ],
          rules: [],
        },
      ],
      visits: [
        {
          id: "v_1",
          oid: "SE.V1",
          name: "Baseline Visit",
          visitType: "Scheduled",
          targetDay: 1,
          windowBefore: 0,
          windowAfter: 2,
          assignedFormIds: ["f_vs"],
        },
      ],
      codelists: [],
    };

    const validation = validateUniversalCrf(flatProtocol);
    expect(validation.success).toBe(true);
    expect(validation.study?.arms).toEqual([]);
    expect(validation.study?.epochs).toEqual([]);
  });

  it("exports StudyProtocol to valid CDISC USDM JSON structure", () => {
    const usdmJson = exportStudyToUsdm(ONCOLOGY_RECIST_PRESET);
    expect(typeof usdmJson).toBe("string");

    const usdmObj = JSON.parse(usdmJson);
    expect(usdmObj.schemaVersion).toBe("3.0.0");
    expect(usdmObj.study.protocolNumber).toBe("ONC-2026-003");
    expect(usdmObj.study.studyDesigns.length).toBe(1);

    const design = usdmObj.study.studyDesigns[0];
    expect(design.arms.length).toBe(2);
    expect(design.epochs.length).toBe(3);
    expect(design.cohorts.length).toBe(1);
    expect(design.encounters.length).toBe(6);
    expect(design.activities.length).toBe(6);
    expect(design.biomedicalConcepts.length).toBeGreaterThanOrEqual(3);

    const imported = importStudyFromUsdm(usdmJson);
    expect(imported.$schema).toBe(getUniversalCrfSchemaUrl());
  });

  it("performs lossless roundtrip conversion between StudyProtocol and USDM JSON", () => {
    const usdmJson = exportStudyToUsdm(ONCOLOGY_RECIST_PRESET);
    const reimportedStudy = importStudyFromUsdm(usdmJson);

    expect(reimportedStudy.protocolNumber).toBe(
      ONCOLOGY_RECIST_PRESET.protocolNumber
    );
    expect(reimportedStudy.arms?.length).toBe(
      ONCOLOGY_RECIST_PRESET.arms?.length
    );
    expect(reimportedStudy.epochs?.length).toBe(
      ONCOLOGY_RECIST_PRESET.epochs?.length
    );
    expect(reimportedStudy.cohorts?.length).toBe(
      ONCOLOGY_RECIST_PRESET.cohorts?.length
    );
    expect(reimportedStudy.visits.length).toBe(
      ONCOLOGY_RECIST_PRESET.visits.length
    );
    expect(reimportedStudy.forms.length).toBe(
      ONCOLOGY_RECIST_PRESET.forms.length
    );

    // Verify 2nd roundtrip stability (deterministic idempotency)
    const usdmJson2 = exportStudyToUsdm(reimportedStudy);
    const reimportedStudy2 = importStudyFromUsdm(usdmJson2);
    expect(usdmJson2).toBe(usdmJson);

    const diff = diffUniversalCrfStudies(reimportedStudy, reimportedStudy2);
    expect(diff.hasChanges).toBe(false);
  });

  it("decouples field presentation properties into biomedical concepts during export", () => {
    const usdmObj = exportStudyToUsdmObject(ONCOLOGY_RECIST_PRESET);
    const design = usdmObj.study.studyDesigns![0];

    const sysbpConcept = design.biomedicalConcepts.find(
      (c) => c.variableName === "SYSBP" || c.name.includes("Systolic")
    );
    expect(sysbpConcept).toBeDefined();
    expect(sysbpConcept?.domain).toBe("VS");
    expect(sysbpConcept?.dataType).toBe("integer");
  });

  it("maps linear visit target days to USDM epoch encounters on export and reassembles on import", () => {
    const usdmObj = exportStudyToUsdmObject(ONCOLOGY_RECIST_PRESET);
    const design = usdmObj.study.studyDesigns![0];

    const c1d1Encounter = design.encounters.find((e) => e.id === "v_c1d1");
    expect(c1d1Encounter).toBeDefined();
    expect(c1d1Encounter?.targetDay).toBe(1);
    expect(c1d1Encounter?.epochId).toBe("e_trt");

    const reimported = importStudyFromUsdm(usdmObj);
    const c1d1Visit = reimported.visits.find((v) => v.id === "v_c1d1");
    expect(c1d1Visit?.targetDay).toBe(1);
    expect(c1d1Visit?.epochId).toBe("e_trt");
  });

  it("accurately reports semantic version diffing between USDM protocol revisions", () => {
    const usdmA = exportStudyToUsdm(ONCOLOGY_RECIST_PRESET);

    const modifiedStudy: StudyProtocol = JSON.parse(
      JSON.stringify(ONCOLOGY_RECIST_PRESET)
    );
    // Add a new arm
    modifiedStudy.arms!.push({
      id: "arm_c",
      name: "Arm C: Dose Escalation Cohort",
      type: "Experimental",
    });
    // Add a new epoch
    modifiedStudy.epochs!.push({
      id: "e_maint",
      name: "Maintenance Epoch",
      sequenceNumber: 4,
    });

    const usdmB = exportStudyToUsdm(modifiedStudy);

    const usdmDiff = diffUsdmProtocols(usdmA, usdmB);
    expect(usdmDiff.hasChanges).toBe(true);
    expect(usdmDiff.addedArms).toContain("arm_c");
    expect(usdmDiff.addedEpochs).toContain("e_maint");
  });

  it("maintains arm-aware visit matrices with form assignments specific to study arms", () => {
    const matrix = StudyProtocolEngine.getArmAwareVisitMatrix(
      ONCOLOGY_RECIST_PRESET
    );
    expect(matrix.length).toBe(2); // Arm A and Arm B

    const armA = matrix.find((m) => m.armId === "arm_exp");
    const armB = matrix.find((m) => m.armId === "arm_ctrl");

    expect(armA).toBeDefined();
    expect(armB).toBeDefined();

    // Verify Arm A has form_recist_onc at Cycle 1 Day 1, while Arm B does not
    const armAC1D1 = armA?.visits.find((v) => v.visitId === "v_c1d1");
    const armBC1D1 = armB?.visits.find((v) => v.visitId === "v_c1d1");

    expect(armAC1D1?.assignedFormIds).toContain("form_recist_onc");
    expect(armBC1D1?.assignedFormIds).not.toContain("form_recist_onc");
  });

  it("assigns arm-specific visit forms using StudyProtocolEngine.assignArmVisitForms", () => {
    const { study: updated } = StudyProtocolEngine.assignArmVisitForms(
      ONCOLOGY_RECIST_PRESET,
      "v_c2d1",
      "arm_exp",
      ["form_recist_onc"]
    );

    const v2 = updated.visits.find((v) => v.id === "v_c2d1");
    expect(v2?.armFormAssignments?.["arm_exp"]).toContain("form_recist_onc");
  });

  it("extracts valueSets and codeList references from USDM graph specifications into study codelists", () => {
    const customUsdmDoc = {
      $schema: "https://www.cdisc.org/schemas/usdm/v3/usdm.schema.json",
      schemaVersion: "3.0.0",
      study: {
        id: "usdm_valsets_01",
        protocolNumber: "VS-CL-2026",
        title: "ValueSet and Codelist Specification Test",
        phase: "Phase II",
        valueSets: [
          {
            id: "vs_dose_freq",
            name: "Dose Frequency Value Set",
            terms: [
              { code: "QD", label: "Once Daily", nciCode: "C64496", order: 1 },
              {
                code: "BID",
                label: "Twice Daily",
                nciCode: "C64497",
                order: 2,
              },
            ],
          },
        ],
        codeLists: [
          {
            id: "cl_grade",
            name: "CTCAE Toxicity Grade",
            nciCodelistCode: "C66769",
            codeListItems: [
              { code: "G1", label: "Grade 1", nciCode: "C48275", order: 1 },
              { code: "G2", label: "Grade 2", nciCode: "C48276", order: 2 },
            ],
          },
        ],
        studyDesigns: [
          {
            id: "design_01",
            name: "Main Design",
            arms: [],
            epochs: [],
            cohorts: [],
            encounters: [],
            activities: [],
            biomedicalConcepts: [
              {
                id: "bc_freq",
                name: "Dosing Frequency",
                properties: {
                  codeList: {
                    id: "cl_bc_freq",
                    name: "BC Dosing Frequency",
                    options: [
                      { code: "TID", label: "Three times daily", order: 1 },
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
    };

    const imported = importStudyFromUsdm(customUsdmDoc);
    expect(imported.codelists).toBeDefined();
    expect(imported.codelists.length).toBeGreaterThanOrEqual(3);

    const freqCodelist = imported.codelists.find(
      (cl) => cl.id === "vs_dose_freq"
    );
    expect(freqCodelist).toBeDefined();
    expect(freqCodelist?.name).toBe("Dose Frequency Value Set");
    expect(freqCodelist?.options.length).toBe(2);
    expect(freqCodelist?.options[0].code).toBe("QD");

    const gradeCodelist = imported.codelists.find((cl) => cl.id === "cl_grade");
    expect(gradeCodelist).toBeDefined();
    expect(gradeCodelist?.nciCodelistCode).toBe("C66769");
    expect(gradeCodelist?.options[1].code).toBe("G2");

    const bcFreqCodelist = imported.codelists.find(
      (cl) => cl.id === "cl_bc_freq"
    );
    expect(bcFreqCodelist).toBeDefined();
    expect(bcFreqCodelist?.options[0].code).toBe("TID");
  });

  it("maps windowBefore and windowAfter visit tolerances to constrain study schedule rules", () => {
    const customUsdmDoc = {
      $schema: "https://www.cdisc.org/schemas/usdm/v3/usdm.schema.json",
      schemaVersion: "3.0.0",
      study: {
        id: "usdm_tolerances_01",
        protocolNumber: "TOL-2026",
        title: "Visit Tolerance Schedule Rules Test",
        phase: "Phase III",
        studyDesigns: [
          {
            id: "design_01",
            name: "Tolerance Design",
            arms: [],
            epochs: [],
            cohorts: [],
            encounters: [
              {
                id: "enc_v1",
                name: "Week 2 Visit",
                type: "Scheduled",
                targetDay: 14,
                windowBefore: 3,
                windowAfter: 5,
              },
              {
                id: "enc_v2",
                name: "Month 1 Visit",
                type: "Scheduled",
                targetDay: 30,
                windowBefore: 2,
                windowAfter: 2,
              },
            ],
            activities: [],
            biomedicalConcepts: [],
          },
        ],
      },
    };

    const imported = importStudyFromUsdm(customUsdmDoc);
    expect(imported.visits.length).toBe(2);
    expect(imported.rules).toBeDefined();

    const ruleV1 = imported.rules?.find((r) => r.id === "rule_sched_enc_v1");
    expect(ruleV1).toBeDefined();
    expect(ruleV1?.name).toContain("Week 2 Visit");
    expect(ruleV1?.actionType).toBe("raise_query");
    // Target Day 14, windowBefore 3, windowAfter 5 => minDay = 11, maxDay = 19
    const condGteV1 = ruleV1?.conditions.find((c) => c.operator === "gte");
    const condLteV1 = ruleV1?.conditions.find((c) => c.operator === "lte");
    expect(condGteV1?.value).toBe(11);
    expect(condLteV1?.value).toBe(19);

    const ruleV2 = imported.rules?.find((r) => r.id === "rule_sched_enc_v2");
    expect(ruleV2).toBeDefined();
    // Target Day 30, windowBefore 2, windowAfter 2 => minDay = 28, maxDay = 32
    const condGteV2 = ruleV2?.conditions.find((c) => c.operator === "gte");
    const condLteV2 = ruleV2?.conditions.find((c) => c.operator === "lte");
    expect(condGteV2?.value).toBe(28);
    expect(condLteV2?.value).toBe(32);
  });

  describe("unsupported imported rule expressions are preserved, not silently simplified (#540)", () => {
    it("passes through a well-formed imported rule unchanged", () => {
      const doc = {
        study: {
          id: "s1",
          studyDesigns: [
            {
              id: "sd1",
              name: "Design",
              arms: [],
              epochs: [],
              cohorts: [],
              encounters: [],
              biomedicalConcepts: [],
              activities: [
                {
                  id: "form1",
                  name: "Vitals",
                  domain: "VS",
                  sections: [],
                  rules: [
                    {
                      id: "rule_valid",
                      name: "Valid Rule",
                      description: "",
                      triggerFieldIds: ["f1"],
                      actionType: "raise_query",
                      targetFieldId: "f1",
                      conditions: [
                        { fieldId: "f1", operator: "gt", value: 10 },
                      ],
                      logicalOperator: "AND",
                    },
                  ],
                },
              ],
            },
          ],
        },
      };

      const imported = importStudyFromUsdm(doc);
      const form = imported.forms.find((f) => f.id === "form1");
      expect(form?.rules).toHaveLength(1);
      expect(form?.rules[0].unsupportedExpression).toBeUndefined();
      expect(form?.rules[0].conditions).toEqual([
        { fieldId: "f1", operator: "gt", value: 10 },
      ]);
    });

    it("preserves a rule whose conditions are not the expected shape, without dropping or silently defaulting it to a normal (always-firing) rule", () => {
      const malformedConditions = { notAnArray: true };
      const doc = {
        study: {
          id: "s1",
          studyDesigns: [
            {
              id: "sd1",
              name: "Design",
              arms: [],
              epochs: [],
              cohorts: [],
              encounters: [],
              biomedicalConcepts: [],
              activities: [
                {
                  id: "form1",
                  name: "Vitals",
                  domain: "VS",
                  sections: [],
                  rules: [
                    {
                      id: "rule_bad",
                      name: "Malformed Rule",
                      description: "",
                      triggerFieldIds: [],
                      actionType: "raise_query",
                      targetFieldId: "f1",
                      conditions: malformedConditions,
                      logicalOperator: "AND",
                    },
                  ],
                },
              ],
            },
          ],
        },
      };

      const imported = importStudyFromUsdm(doc);
      const form = imported.forms.find((f) => f.id === "form1");
      const rule = form?.rules[0];
      expect(rule?.unsupportedExpression).toBeDefined();
      expect(rule?.unsupportedExpression?.raw).toMatchObject({
        id: "rule_bad",
        conditions: malformedConditions,
      });
      expect(rule?.conditions).toEqual([]);
      // Identity fields a reviewer needs to find the rule are still preserved.
      expect(rule?.id).toBe("rule_bad");
      expect(rule?.name).toBe("Malformed Rule");
    });

    it("preserves a rule with an entirely unrecognized shape (no id/conditions at all) rather than dropping it", () => {
      const weirdRaw = {
        totallyForeignShape: true,
        expr: "SYSBP BEFORE DIABP",
      };
      const doc = {
        study: {
          id: "s1",
          studyDesigns: [
            {
              id: "sd1",
              name: "Design",
              arms: [],
              epochs: [],
              cohorts: [],
              encounters: [],
              biomedicalConcepts: [],
              activities: [
                {
                  id: "form1",
                  name: "Vitals",
                  domain: "VS",
                  sections: [],
                  rules: [weirdRaw],
                },
              ],
            },
          ],
        },
      };

      const imported = importStudyFromUsdm(doc);
      const form = imported.forms.find((f) => f.id === "form1");
      expect(form?.rules).toHaveLength(1);
      expect(form?.rules[0].unsupportedExpression?.raw).toEqual(weirdRaw);
    });
  });
});
