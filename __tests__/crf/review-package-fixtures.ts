import {
  createScenario,
  runScenariosForForm,
  StudyProtocolEngine,
  upsertScenario,
  type StudyProtocol,
} from "@/lib/crf";

/** Synthetic fixtures for the review package tests (#680). No real study data. */

export const REVIEWER = {
  name: "Synthetic Reviewer",
  role: "Medical Monitor",
} as const;

export function baseStudy(): StudyProtocol {
  return {
    id: "study_rp_synthetic",
    protocolNumber: "SYN-RP-001",
    studyName: "Synthetic Review Package Study",
    phase: "Phase II",
    sponsor: "Synthetic Sponsor",
    therapeuticArea: "Cardiology",
    version: "1.0",
    lastModified: "2026-09-30T12:00:00.000Z",
    codelists: [
      {
        id: "cl_ny",
        name: "No Yes Response",
        options: [
          { code: "N", label: "No", order: 2 },
          { code: "Y", label: "Yes", order: 1 },
        ],
      },
    ],
    visits: [
      {
        id: "v_scr",
        oid: "SE.SCR",
        name: "Screening",
        visitType: "Scheduled",
        targetDay: -7,
        windowBefore: 3,
        windowAfter: 0,
        assignedFormIds: ["form_vs"],
      },
      {
        id: "v_w4",
        oid: "SE.W4",
        name: "Week 4",
        visitType: "Scheduled",
        targetDay: 28,
        windowBefore: 2,
        windowAfter: 2,
        assignedFormIds: [],
      },
    ],
    forms: [
      {
        id: "form_vs",
        name: "Vital Signs",
        domain: "VS",
        description: "Synthetic vital signs",
        version: "1.0",
        sections: [
          {
            id: "sec_vs",
            title: "Blood Pressure",
            fields: [
              {
                id: "f_sysbp",
                variableName: "SYSBP",
                label: "Systolic Blood Pressure",
                dataType: "number",
                columnSpan: 6,
                required: true,
                unit: "mmHg",
                minValue: 60,
                maxValue: 250,
              },
              {
                id: "f_vsperf",
                variableName: "VSPERF",
                label: "Vital signs performed",
                dataType: "radio",
                columnSpan: 6,
                required: true,
                codelistId: "cl_ny",
              },
            ],
          },
        ],
        rules: [
          {
            id: "rule_high_bp",
            name: "High systolic pressure",
            description: "Flag hypertensive readings for review.",
            triggerFieldIds: ["f_sysbp"],
            actionType: "raise_query",
            targetFieldId: "f_sysbp",
            conditions: [{ fieldId: "f_sysbp", operator: "gt", value: 180 }],
            logicalOperator: "AND",
            querySeverity: "warning",
            queryMessage: "Confirm systolic pressure above 180 mmHg.",
          },
        ],
      },
    ],
  };
}

/** A study with one open thread, one resolved thread and one passing scenario. */
export function reviewedStudy(): StudyProtocol {
  let study = baseStudy();
  study = StudyProtocolEngine.addReviewComment(
    study,
    "f_sysbp",
    "Should the upper limit follow the protocol's 200 mmHg?",
    REVIEWER,
    "2026-09-30T13:00:00.000Z"
  ).study;
  const resolved = StudyProtocolEngine.addReviewComment(
    study,
    "f_vsperf",
    "Codelist confirmed.",
    REVIEWER,
    "2026-09-30T13:05:00.000Z"
  );
  study = StudyProtocolEngine.setReviewThreadStatus(
    resolved.study,
    resolved.thread.id,
    "resolved",
    REVIEWER,
    "2026-09-30T13:06:00.000Z"
  );
  const scenario = {
    ...createScenario({
      name: "High reading raises a query",
      formId: "form_vs",
      scope: { subjectId: "SUBJ-001", visitId: "v_scr" },
      inputs: { f_sysbp: 190, f_vsperf: "Y" },
      expectations: [
        { kind: "rule_result", ruleId: "rule_high_bp", expected: "true" },
      ],
      now: new Date("2026-09-30T14:00:00.000Z"),
    }),
    id: "scenario_high_bp",
  };
  study = upsertScenario(study, scenario);
  return runScenariosForForm(
    study,
    "form_vs",
    new Date("2026-09-30T14:01:00.000Z")
  ).study;
}

/** The same study after an amendment that changes the tested form. */
export function amend(study: StudyProtocol): StudyProtocol {
  const next = StudyProtocolEngine.updateField(study, "form_vs", "f_sysbp", {
    maxValue: 200,
  }).study;
  return { ...next, version: "1.1", lastModified: "2026-10-01T08:00:00.000Z" };
}
