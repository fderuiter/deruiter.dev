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
  getUsdmV4ActivityDomain,
  getUsdmV4EncounterSchedule,
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
    expect(usdmObj.usdmVersion).toBe("4.0.0");
    const version = usdmObj.study.versions[0];
    expect(version.studyIdentifiers[0].text).toBe("ONC-2026-003");
    expect(version.studyDesigns.length).toBe(1);

    const design = version.studyDesigns[0];
    expect(design.arms.length).toBe(2);
    expect(design.epochs.length).toBe(3);
    expect(design.population.cohorts.length).toBe(1);
    expect(design.encounters.length).toBe(6);
    expect(design.activities.length).toBe(7);
    expect(version.biomedicalConcepts.length).toBeGreaterThanOrEqual(3);

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
    const version = usdmObj.study.versions![0];

    const sysbpConcept = version.biomedicalConcepts!.find((c) =>
      c.name.includes("Systolic")
    );
    expect(sysbpConcept).toBeDefined();
    expect(sysbpConcept?.code.standardCode.code).toBe("C25298");
    const vsActivity = version.studyDesigns![0].activities!.find((a) =>
      a.biomedicalConceptIds?.includes(sysbpConcept!.id)
    );
    expect(getUsdmV4ActivityDomain(vsActivity)).toBe("VS");

    const reimported = importStudyFromUsdm(usdmObj);
    const sysbp = reimported.biomedicalConcepts?.find(
      (c) => c.id === sysbpConcept?.id
    );
    expect(sysbp?.domain).toBe("VS");
    expect(sysbp?.dataType).toBe("integer");
  });

  it("maps linear visit target days to USDM epoch encounters on export and reassembles on import", () => {
    const usdmObj = exportStudyToUsdmObject(ONCOLOGY_RECIST_PRESET);
    const design = usdmObj.study.versions![0].studyDesigns![0];

    const c1d1Encounter = design.encounters!.find((e) => e.id === "v_c1d1");
    expect(c1d1Encounter).toBeDefined();
    const c1d1Schedule = getUsdmV4EncounterSchedule(design).find(
      (s) => s.encounterId === "v_c1d1"
    );
    expect(c1d1Schedule?.targetDay).toBe(1);
    expect(c1d1Schedule?.epochId).toBe("e_trt");

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

// #3485: branches the cases above leave untaken: compact export, sparse
// studies, fields that take their names from a concept, and every shape an
// imported rule can arrive in.
describe("USDM adapter, less common shapes (#3485)", () => {
  const sparse = (overrides: Partial<StudyProtocol> = {}): StudyProtocol =>
    ({
      id: "sparse_01",
      protocolNumber: "",
      studyName: "",
      phase: "Phase I",
      sponsor: "Synthetic Sponsor",
      therapeuticArea: "General Medicine",
      version: "1.0",
      lastModified: "2026-01-01",
      forms: [],
      visits: undefined,
      codelists: undefined,
      ...overrides,
    }) as unknown as StudyProtocol;

  it("writes compact JSON on request", () => {
    const pretty = exportStudyToUsdm(ONCOLOGY_RECIST_PRESET);
    const compact = exportStudyToUsdm(ONCOLOGY_RECIST_PRESET, false);
    expect(compact).not.toContain("\n");
    expect(JSON.parse(compact)).toEqual(JSON.parse(pretty));
  });

  it("exports a study with no visits, codelists, name or protocol number", () => {
    const doc = exportStudyToUsdmObject(sparse());
    const json = JSON.stringify(doc);
    expect(json).toContain("sparse_01");
    expect(() => importStudyFromUsdm(json)).not.toThrow();
  });

  it("fills a field's missing name, label and type from its concept", () => {
    const study = sparse({
      forms: [
        {
          id: "f_vs",
          name: "Vitals",
          domain: "VS",
          description: "",
          version: "1.0",
          rules: [],
          sections: [
            {
              id: "s1",
              title: "Vitals",
              fields: [
                {
                  id: "fld_hr",
                  conceptId: "bc_hr",
                  variableName: "",
                  label: "",
                  dataType: "" as never,
                  columnSpan: 6,
                  required: false,
                },
              ],
            },
          ],
        },
      ],
      biomedicalConcepts: [
        {
          id: "bc_hr",
          name: "Heart Rate",
          conceptId: "C49677",
          variableName: "PULSE",
          dataType: "number",
          label: "Pulse rate",
          unit: "beats/min",
        },
      ] as StudyProtocol["biomedicalConcepts"],
    });
    const imported = importStudyFromUsdm(exportStudyToUsdm(study));
    const field = imported.forms[0].sections[0].fields[0];
    expect(field.variableName).toBe("PULSE");
    expect(field.label).toBe("Pulse rate");
    expect(field.dataType).toBe("number");
  });

  describe("imported rules", () => {
    const importRules = (rules: unknown[]) =>
      importStudyFromUsdm(
        JSON.stringify({
          study: {
            id: "legacy_rules",
            name: "Legacy rules",
            studyDesigns: [{ id: "d1", name: "Design" }],
            forms: [
              {
                id: "f1",
                name: "Form",
                domain: "VS",
                sections: [{ id: "s1", title: "S", fields: [] }],
                rules,
              },
            ],
          },
        })
      ).forms[0].rules;

    it("keeps a rule whose conditions it understands", () => {
      const [rule] = importRules([
        {
          id: "r1",
          name: "Plain",
          description: "d",
          triggerFieldIds: ["a"],
          actionType: "require_field",
          targetFieldId: "b",
          conditions: [{ fieldId: "a", operator: "gt", value: 1 }],
          logicalOperator: "OR",
          queryMessage: "m",
          formulaExpression: "a + 1",
        },
      ]);
      expect(rule).toMatchObject({
        id: "r1",
        logicalOperator: "OR",
        queryMessage: "m",
        formulaExpression: "a + 1",
      });
      expect(rule.unsupportedExpression).toBeUndefined();
    });

    it("keeps a rule that has only condition groups", () => {
      const [rule] = importRules([
        {
          id: "r2",
          name: "Grouped",
          conditionGroups: [
            {
              id: "g",
              logicalOperator: "OR",
              conditions: [{ fieldId: "a", operator: "eq", value: "x" }],
            },
          ],
          groupLogicalOperator: "OR",
        },
      ]);
      expect(rule.conditionGroups).toHaveLength(1);
      expect(rule.groupLogicalOperator).toBe("OR");
      expect(rule.unsupportedExpression).toBeUndefined();
    });

    it("preserves a malformed or empty rule for review instead of firing it", () => {
      const rules = importRules([
        { id: "r3", conditions: [{ field: "a" }] },
        { id: "r4", conditionGroups: [{ logicalOperator: "XOR" }] },
        { name: "No expression at all" },
        "not a rule",
      ]);
      expect(rules.length).toBeGreaterThanOrEqual(3);
      for (const rule of rules) {
        expect(rule.unsupportedExpression).toBeDefined();
        expect(rule.conditions).toEqual([]);
        expect(typeof rule.id).toBe("string");
        expect(typeof rule.name).toBe("string");
      }
    });
  });
});

describe("USDM adapter, legacy documents (#3485)", () => {
  const legacy = {
    study: {
      id: "legacy_full",
      name: "Legacy",
      studyDesigns: [
        {
          id: "d1",
          name: "Design",
          encounters: [{ id: "e1", name: "Visit 1" }],
          biomedicalConcepts: [
            {
              id: "bc_sex",
              name: "Sex",
              label: "Sex at birth",
              variableName: "SEX",
              dataType: "single_select",
              properties: {
                codelistId: "cl_sex_local",
                options: [{ code: "M", label: "Male", order: 1 }],
              },
            },
          ],
          activities: [
            {
              id: "a1",
              name: "Demographics",
              sections: [
                {
                  id: "s1",
                  title: "S",
                  fields: [
                    { id: "f_sex", conceptId: "bc_sex" },
                    {
                      id: "f_eth",
                      variableName: "ETH",
                      label: "Ethnicity",
                      codelistId: "cl_eth",
                      customOptions: [
                        { code: "H", label: "Hispanic", order: 1 },
                      ],
                    },
                    {
                      id: "f_std",
                      variableName: "SEX2",
                      label: "Sex",
                      codeListId: "C66731",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };

  it("fills missing visit timing, form domain and field names, and gathers every codelist", () => {
    const study = importStudyFromUsdm(JSON.stringify(legacy));
    expect(study.visits[0]).toMatchObject({
      visitType: "Scheduled",
      targetDay: 0,
      windowBefore: 0,
      windowAfter: 0,
    });
    const form = study.forms[0];
    expect(form.domain).toBe("GENERAL");
    expect(form.sections[0].fields[0]).toMatchObject({
      variableName: "SEX",
      label: "Sex at birth",
      dataType: "single_select",
    });
    const codelists = (study.codelists ?? []).map((cl) => cl.id);
    expect(codelists).toEqual(
      expect.arrayContaining(["cl_sex_local", "cl_eth"])
    );
  });

  it("asks which design to read when a legacy document holds several", () => {
    const two = structuredClone(legacy);
    two.study.studyDesigns.push({ ...two.study.studyDesigns[0], id: "d2" });
    expect(() => importStudyFromUsdm(JSON.stringify(two))).toThrow(
      /2 designs; choose one of d1, d2/
    );
    expect(() =>
      importStudyFromUsdm(JSON.stringify(two), {
        selection: { studyDesignId: "d9" },
      } as never)
    ).toThrow(/no study design d9/);
    expect(
      importStudyFromUsdm(JSON.stringify(two), {
        selection: { studyDesignId: "d2" },
      } as never).forms
    ).toHaveLength(1);
  });

  it("diffs a full study against a sparse one in both directions", () => {
    const full = exportStudyToUsdm(ONCOLOGY_RECIST_PRESET);
    const sparse = JSON.stringify(legacy);
    const forward = diffUsdmProtocols(full, sparse);
    const backward = diffUsdmProtocols(sparse, full);
    expect(forward).toBeDefined();
    expect(backward).toBeDefined();
    expect(JSON.stringify(forward)).not.toBe(JSON.stringify(backward));
  });
});

describe("diffUsdmProtocols, one change at a time (#3485)", () => {
  const base = (): StudyProtocol => structuredClone(ONCOLOGY_RECIST_PRESET);
  const cases: [string, (study: StudyProtocol) => void][] = [
    [
      "an epoch added",
      (s) => {
        s.epochs = [
          ...(s.epochs ?? []),
          { id: "ep_new", name: "Extension", sequenceNumber: 9 },
        ];
      },
    ],
    [
      "a cohort removed",
      (s) => {
        s.cohorts = [];
      },
    ],
    [
      "a concept's unit changed",
      (s) => {
        s.biomedicalConcepts![0] = {
          ...s.biomedicalConcepts![0],
          unit: "furlong",
        };
      },
    ],
    [
      "a concept removed",
      (s) => {
        s.biomedicalConcepts = s.biomedicalConcepts!.slice(1);
      },
    ],
    [
      "a visit's window changed",
      (s) => {
        s.visits[0] = {
          ...s.visits[0],
          windowAfter: (s.visits[0].windowAfter ?? 0) + 5,
        };
      },
    ],
    [
      "a visit's arm assignments changed",
      (s) => {
        s.visits[0] = { ...s.visits[0], armFormAssignments: { arm_x: [] } };
      },
    ],
    [
      "a form added",
      (s) => {
        s.forms = [
          ...s.forms,
          { ...s.forms[0], id: "form_extra", name: "Extra" },
        ];
      },
    ],
  ];

  it.each(cases)(
    "reports %s, and nothing between identical studies",
    (_label, change) => {
      const before = exportStudyToUsdmObject(base());
      const changedStudy = base();
      change(changedStudy);
      const after = exportStudyToUsdmObject(changedStudy);
      expect(diffUsdmProtocols(before, before).hasChanges).toBe(false);
      expect(diffUsdmProtocols(before, after).hasChanges).toBe(true);
    }
  );
});

describe("a plain USDM v4 document missing ids (#3485)", () => {
  it("falls back to generated ids and default timing instead of failing", async () => {
    const { TAVR_SAVR_USDM } = await import("@/lib/study-workspace");
    const doc = structuredClone(TAVR_SAVR_USDM) as unknown as {
      study: { versions: Record<string, unknown>[] };
    };
    const version = doc.study.versions[0] as Record<string, unknown> & {
      studyDesigns: Record<string, unknown[]>[];
      biomedicalConcepts: Record<string, unknown>[];
    };
    const design = version.studyDesigns[0];
    const strip = (items: unknown[] | undefined) => {
      const first = items?.[0] as Record<string, unknown> | undefined;
      if (first) delete first.id;
    };
    strip(design.arms);
    strip(design.epochs);
    strip(design.encounters);
    strip(design.activities);
    strip(version.biomedicalConcepts);
    const study = importStudyFromUsdm(JSON.stringify(doc));
    expect(study.arms?.[0].id).toBe("arm_1");
    expect(study.epochs?.[0].id).toBe("epoch_1");
    expect(study.visits[0].id).toBe("encounter_1");
    // The stripped encounter has no timeline entry, so it takes the defaults.
    expect(study.visits[0]).toMatchObject({ windowBefore: 0, windowAfter: 0 });
    expect(study.forms.map((form) => form.id)).toContain("activity_1");
  });
});
