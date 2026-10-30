import { describe, expect, it } from "vitest";
import {
  validateUsdmV4Document,
  type UsdmV4Abbreviation,
  type UsdmV4AnalysisPopulation,
  type UsdmV4Code,
  type UsdmV4Condition,
  type UsdmV4Document,
  type UsdmV4Estimand,
  type UsdmV4GovernanceDate,
  type UsdmV4InterventionalStudyDesign,
  type UsdmV4Masking,
  type UsdmV4NarrativeContentItem,
  type UsdmV4ScheduledDecisionInstance,
  type UsdmV4StudyDefinitionDocument,
  type UsdmV4StudyRole,
  type UsdmV4SyntaxTemplateDictionary,
} from "@/lib/clinical-standards";

/**
 * The USDM v4 classes Protocol Studio needs (#3398): a minimal document
 * holding one of each, checked against the vendored USDM v4.0.0 schema.
 */

const code = (id: string, value: string, decode: string): UsdmV4Code => ({
  id,
  code: value,
  codeSystem: "http://www.cdisc.org",
  codeSystemVersion: "2026-09-25",
  decode,
  instanceType: "Code",
});

const condition: UsdmV4Condition = {
  id: "Condition_1",
  name: "DOSE_HOLD",
  text: "Hold the dose while ALT is above 3 times the upper limit of normal.",
  contextIds: ["Activity_1"],
  appliesToIds: ["Activity_2"],
  instanceType: "Condition",
};

const dictionary: UsdmV4SyntaxTemplateDictionary = {
  id: "SyntaxTemplateDictionary_1",
  name: "OBJECTIVE_PARAMETERS",
  parameterMaps: [
    {
      id: "ParameterMap_1",
      tag: "Intervention",
      reference: "StudyIntervention_1/name",
      instanceType: "ParameterMap",
    },
  ],
  instanceType: "SyntaxTemplateDictionary",
};

const abbreviation: UsdmV4Abbreviation = {
  id: "Abbreviation_1",
  abbreviatedText: "SBP",
  expandedText: "Systolic blood pressure",
  instanceType: "Abbreviation",
};

const contentItem: UsdmV4NarrativeContentItem = {
  id: "NarrativeContentItem_1",
  name: "INTRODUCTION_TEXT",
  text: "<p>This study compares two doses with placebo.</p>",
  instanceType: "NarrativeContentItem",
};

const approval: UsdmV4GovernanceDate = {
  id: "GovernanceDate_1",
  name: "PROTOCOL_APPROVAL",
  type: code("Code_1", "C71476", "Approval Date"),
  dateValue: "2026-10-01",
  geographicScopes: [
    {
      id: "GeographicScope_1",
      type: code("Code_2", "C68846", "Global"),
      instanceType: "GeographicScope",
    },
  ],
  instanceType: "GovernanceDate",
};

const protocol: UsdmV4StudyDefinitionDocument = {
  id: "StudyDefinitionDocument_1",
  name: "PROTOCOL",
  language: {
    id: "Code_3",
    code: "en",
    codeSystem: "ISO 639-1",
    codeSystemVersion: "2007",
    decode: "English",
    instanceType: "Code",
  },
  type: code("Code_4", "C70817", "Protocol"),
  templateName: "ICH M11",
  versions: [
    {
      id: "StudyDefinitionDocumentVersion_1",
      version: "1.0",
      status: code("Code_5", "C25425", "Approved"),
      dateValues: [{ ...approval, id: "GovernanceDate_2" }],
      contents: [
        {
          id: "NarrativeContent_1",
          name: "INTRODUCTION",
          sectionNumber: "1",
          sectionTitle: "Introduction",
          displaySectionNumber: true,
          displaySectionTitle: true,
          contentItemId: "NarrativeContentItem_1",
          instanceType: "NarrativeContent",
        },
      ],
      instanceType: "StudyDefinitionDocumentVersion",
    },
  ],
  instanceType: "StudyDefinitionDocument",
};

const analysisPopulation: UsdmV4AnalysisPopulation = {
  id: "AnalysisPopulation_1",
  name: "ITT",
  text: "Every randomized subject.",
  instanceType: "AnalysisPopulation",
};

const estimand: UsdmV4Estimand = {
  id: "Estimand_1",
  name: "PRIMARY",
  populationSummary: "Adults with stage 1 hypertension.",
  analysisPopulationId: "AnalysisPopulation_1",
  interventionIds: ["StudyIntervention_1"],
  variableOfInterestId: "Endpoint_1",
  intercurrentEvents: [
    {
      id: "IntercurrentEvent_1",
      name: "RESCUE",
      text: "Rescue antihypertensive started.",
      strategy: "Treatment policy",
      instanceType: "IntercurrentEvent",
    },
  ],
  instanceType: "Estimand",
};

const decision: UsdmV4ScheduledDecisionInstance = {
  id: "ScheduledDecisionInstance_1",
  name: "ALT_CHECK",
  defaultConditionId: "ScheduledActivityInstance_2",
  conditionAssignments: [
    {
      id: "ConditionAssignment_1",
      condition: "ALT above 3 times the upper limit of normal",
      conditionTargetId: "ScheduledActivityInstance_3",
      instanceType: "ConditionAssignment",
    },
  ],
  instanceType: "ScheduledDecisionInstance",
};

const masking: UsdmV4Masking = {
  id: "Masking_1",
  text: "The investigator does not know the assigned arm.",
  isMasked: true,
  instanceType: "Masking",
};

const role: UsdmV4StudyRole = {
  id: "StudyRole_1",
  name: "INVESTIGATOR",
  code: code("Code_6", "C25936", "Investigator"),
  masking,
  instanceType: "StudyRole",
};

const design: UsdmV4InterventionalStudyDesign = {
  id: "InterventionalStudyDesign_1",
  name: "MAIN",
  arms: [],
  studyCells: [],
  rationale: "A minimal design.",
  epochs: [],
  population: {
    id: "StudyDesignPopulation_1",
    name: "POPULATION",
    includesHealthySubjects: false,
    instanceType: "StudyDesignPopulation",
  },
  eligibilityCriteria: [],
  model: code("Code_7", "C82639", "Parallel Study"),
  estimands: [estimand],
  analysisPopulations: [analysisPopulation],
  instanceType: "InterventionalStudyDesign",
};

function minimalDocument(): UsdmV4Document {
  return {
    usdmVersion: "4.0.0",
    study: {
      name: "MINIMAL",
      documentedBy: [protocol],
      versions: [
        {
          id: "StudyVersion_1",
          versionIdentifier: "1",
          rationale: "A minimal version.",
          studyIdentifiers: [],
          titles: [],
          studyDesigns: [design],
          roles: [role],
          conditions: [condition],
          dictionaries: [dictionary],
          abbreviations: [abbreviation],
          narrativeContentItems: [contentItem],
          dateValues: [approval],
          instanceType: "StudyVersion",
        },
      ],
      instanceType: "Study",
    },
  };
}

/**
 * The document with a decision instance on a schedule timeline. The schema
 * puts decision instances in `ScheduleTimeline.instances`, which
 * `UsdmV4ScheduleTimeline` types as activity instances only, so this
 * document is built as plain JSON around the typed instance.
 */
function documentWithDecision(): unknown {
  const doc = JSON.parse(JSON.stringify(minimalDocument()));
  doc.study.versions[0].studyDesigns[0].scheduleTimelines = [
    {
      id: "ScheduleTimeline_1",
      name: "MAIN",
      mainTimeline: true,
      entryCondition: "Subject consented.",
      entryId: "ScheduledDecisionInstance_1",
      instances: [decision],
      instanceType: "ScheduleTimeline",
    },
  ];
  return doc;
}

describe("USDM v4 classes for Protocol Studio", () => {
  it("validates a minimal document holding one of each class", async () => {
    expect(await validateUsdmV4Document(minimalDocument())).toEqual([]);
    expect(await validateUsdmV4Document(documentWithDecision())).toEqual([]);
  });

  // Each class checked: dropping one of its required properties makes the
  // document invalid, so the schema really reads it.
  it.each([
    ["Condition", ["study", "versions", 0, "conditions", 0], "text"],
    [
      "SyntaxTemplateDictionary",
      ["study", "versions", 0, "dictionaries", 0],
      "parameterMaps",
    ],
    [
      "ParameterMap",
      ["study", "versions", 0, "dictionaries", 0, "parameterMaps", 0],
      "reference",
    ],
    [
      "Abbreviation",
      ["study", "versions", 0, "abbreviations", 0],
      "expandedText",
    ],
    [
      "NarrativeContentItem",
      ["study", "versions", 0, "narrativeContentItems", 0],
      "text",
    ],
    [
      "GovernanceDate",
      ["study", "versions", 0, "dateValues", 0],
      "geographicScopes",
    ],
    ["StudyDefinitionDocument", ["study", "documentedBy", 0], "templateName"],
    [
      "StudyDefinitionDocumentVersion",
      ["study", "documentedBy", 0, "versions", 0],
      "status",
    ],
    [
      "NarrativeContent",
      ["study", "documentedBy", 0, "versions", 0, "contents", 0],
      "displaySectionTitle",
    ],
    [
      "Estimand",
      ["study", "versions", 0, "studyDesigns", 0, "estimands", 0],
      "variableOfInterestId",
    ],
    [
      "IntercurrentEvent",
      [
        "study",
        "versions",
        0,
        "studyDesigns",
        0,
        "estimands",
        0,
        "intercurrentEvents",
        0,
      ],
      "strategy",
    ],
    [
      "AnalysisPopulation",
      ["study", "versions", 0, "studyDesigns", 0, "analysisPopulations", 0],
      "text",
    ],
    ["Masking", ["study", "versions", 0, "roles", 0, "masking"], "isMasked"],
    [
      "ScheduledDecisionInstance",
      [
        "study",
        "versions",
        0,
        "studyDesigns",
        0,
        "scheduleTimelines",
        0,
        "instances",
        0,
      ],
      "conditionAssignments",
    ],
  ] as const)(
    "rejects a %s without one of its required properties",
    async (_, path, property) => {
      const doc = documentWithDecision() as Record<string, unknown>;
      let target: Record<string | number, unknown> = doc;
      for (const step of path)
        target = target[step] as Record<string | number, unknown>;
      delete target[property];
      expect((await validateUsdmV4Document(doc)).length).toBeGreaterThan(0);
    }
  );
});
