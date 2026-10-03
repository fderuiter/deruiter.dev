/**
 * Deterministic synthetic CRF Studio workloads for capacity measurement (#682).
 *
 * Three study sizes (small, typical, stress) are generated from a fixed seed
 * so every benchmark run, on every machine, measures the same document: the
 * same forms, fields, visits, rules, repeats and saved test scenarios, with
 * fixed timestamps and ids. The content is synthetic and carries no clinical
 * meaning; it only reproduces the structural shape real study specifications
 * have, so the authoring workflows are exercised on representative input.
 */

import type {
  CodelistDefinition,
  CRFField,
  CRFForm,
  CRFSection,
  EditCheckRule,
  StudyProtocol,
  StudyVisit,
  TestScenario,
} from "@/lib/crf";

/** Identifier of one of the three canonical workload sizes. */
export type CrfWorkloadId = "small" | "typical" | "stress";

/** Declarative size and shape of one synthetic workload. */
export interface CrfWorkloadSpec {
  id: CrfWorkloadId;
  label: string;
  /** Number of forms in the study. */
  forms: number;
  /** Total top-level fields across all forms (repeating-table columns are counted separately). */
  fields: number;
  /** Scheduled visits, before the unscheduled and common (log) visits are added. */
  scheduledVisits: number;
  /** Edit-check rules generated on each form. */
  rulesPerForm: number;
  /** Saved test scenarios generated on each form. */
  scenariosPerForm: number;
  /** PRNG seed; changing it changes the generated document. */
  seed: number;
}

/** The three canonical workloads named in issue #682. */
export const CRF_WORKLOAD_SPECS: readonly CrfWorkloadSpec[] = [
  {
    id: "small",
    label: "Small (5 forms / 100 fields)",
    forms: 5,
    fields: 100,
    scheduledVisits: 4,
    rulesPerForm: 3,
    scenariosPerForm: 1,
    seed: 682_005,
  },
  {
    id: "typical",
    label: "Typical (30 forms / 1,000 fields)",
    forms: 30,
    fields: 1_000,
    scheduledVisits: 12,
    rulesPerForm: 4,
    scenariosPerForm: 2,
    seed: 682_030,
  },
  {
    id: "stress",
    label: "Stress (100 forms / 5,000 fields)",
    forms: 100,
    fields: 5_000,
    scheduledVisits: 30,
    rulesPerForm: 6,
    scenariosPerForm: 2,
    seed: 682_100,
  },
];

/** Structural counts of a study, used to verify a generated workload. */
export interface CrfWorkloadSummary {
  forms: number;
  sections: number;
  fields: number;
  repeatingTableFields: number;
  repeatingColumns: number;
  repeatingSections: number;
  logForms: number;
  calculatedFields: number;
  selectFields: number;
  visits: number;
  repeatingVisits: number;
  visitFormAssignments: number;
  formRules: number;
  studyRules: number;
  scenarios: number;
  codelists: number;
}

/** Fixed timestamp so generated documents are byte-identical across runs. */
export const CRF_WORKLOAD_EPOCH = "2026-01-01T00:00:00.000Z";

// Sponsor-defined domain codes (CDISC reserves X*, Y* and Z* for these), so
// the synthetic forms are not reported as standard domains missing their
// CDASH core variables: the workload is clean, as a reviewed study would be.
const DOMAINS = ["XA", "XB", "XC", "XD", "XE", "XF", "XG", "XH", "XI", "XJ"];
const LOG_DOMAINS = ["ZA", "ZB"];
const SECTION_SIZE = 10;

/** Small, fast, seedable PRNG (mulberry32). */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/** Resolves a workload spec by id, throwing on an unknown id. */
export function getCrfWorkloadSpec(id: CrfWorkloadId): CrfWorkloadSpec {
  const spec = CRF_WORKLOAD_SPECS.find((candidate) => candidate.id === id);
  if (!spec) throw new Error(`Unknown CRF workload '${String(id)}'.`);
  return spec;
}

function buildCodelists(formCount: number): CodelistDefinition[] {
  const codelists: CodelistDefinition[] = [
    {
      id: "wl_cl_ny",
      name: "No Yes Response",
      nciCodelistCode: "C66742",
      isStandard: true,
      options: [
        { code: "N", label: "No", order: 1 },
        { code: "Y", label: "Yes", order: 2 },
      ],
    },
    {
      id: "wl_cl_sev",
      name: "Severity",
      nciCodelistCode: "C66769",
      isStandard: true,
      options: [
        { code: "MILD", label: "Mild", order: 1 },
        { code: "MODERATE", label: "Moderate", order: 2 },
        { code: "SEVERE", label: "Severe", order: 3 },
      ],
    },
  ];
  // One sponsor-defined list per ten forms, like a growing study library.
  for (let index = 0; index < Math.ceil(formCount / 10); index++) {
    codelists.push({
      id: `wl_cl_custom_${pad(index + 1, 2)}`,
      name: `Sponsor list ${index + 1}`,
      options: Array.from({ length: 6 }, (_, option) => ({
        code: `C${option + 1}`,
        label: `Category ${option + 1}`,
        order: option + 1,
      })),
    });
  }
  return codelists;
}

/** Splits `total` into `parts` integers that differ by at most one. */
function distribute(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const remainder = total % parts;
  return Array.from({ length: parts }, (_, index) =>
    index < remainder ? base + 1 : base
  );
}

interface FormBuildContext {
  formIndex: number;
  formCount: number;
  fieldCount: number;
  rulesPerForm: number;
  codelists: CodelistDefinition[];
  random: () => number;
}

function variableName(formIndex: number, fieldIndex: number): string {
  // "V" + 3-digit form + 2-digit field: unique study-wide, CDASH-valid, <= 8 chars.
  return `V${pad(formIndex + 1, 3)}${pad(fieldIndex + 1, 2)}`;
}

function buildField(
  formIndex: number,
  fieldIndex: number,
  context: FormBuildContext
): CRFField {
  const formKey = `f${pad(formIndex + 1, 3)}`;
  const id = `${formKey}_q${pad(fieldIndex + 1, 2)}`;
  const base: CRFField = {
    id,
    variableName: variableName(formIndex, fieldIndex),
    label: `Synthetic question ${formIndex + 1}.${fieldIndex + 1}`,
    dataType: "text",
    columnSpan: 6,
    required: fieldIndex % 3 === 0,
  };
  // Fixed positions give every form the fields its rules, calculation and
  // repeat need; the remainder are a seeded mix of capture types.
  if (fieldIndex === 0) {
    return {
      ...base,
      dataType: "radio",
      codelistId: "wl_cl_ny",
      required: true,
    };
  }
  if (fieldIndex === 1 || fieldIndex === 2) {
    return {
      ...base,
      dataType: "number",
      unit: fieldIndex === 1 ? "kg" : "cm",
      minValue: fieldIndex === 1 ? 20 : 100,
      maxValue: fieldIndex === 1 ? 250 : 230,
    };
  }
  if (fieldIndex === 3) {
    return {
      ...base,
      dataType: "calculated",
      readOnly: true,
      calculationFormula: `${variableName(formIndex, 1)} / ((${variableName(formIndex, 2)}/100) * (${variableName(formIndex, 2)}/100))`,
    };
  }
  if (fieldIndex === 4) {
    return {
      ...base,
      dataType: "repeating_table",
      columnSpan: 12,
      required: false,
      repeatingColumns: [
        {
          id: `${id}_c1`,
          variableName: `${base.variableName}A`,
          label: "Term",
          dataType: "text",
          columnSpan: 4,
          required: true,
        },
        {
          id: `${id}_c2`,
          variableName: `${base.variableName}B`,
          label: "Start date",
          dataType: "date",
          columnSpan: 3,
          required: false,
        },
        {
          id: `${id}_c3`,
          variableName: `${base.variableName}C`,
          label: "Severity",
          dataType: "single_select",
          codelistId: "wl_cl_sev",
          columnSpan: 3,
          required: false,
        },
        {
          id: `${id}_c4`,
          variableName: `${base.variableName}D`,
          label: "Ongoing",
          dataType: "checkbox",
          columnSpan: 2,
          required: false,
        },
      ],
    };
  }
  const roll = context.random();
  if (roll < 0.25)
    return { ...base, dataType: "integer", minValue: 0, maxValue: 999 };
  if (roll < 0.4) return { ...base, dataType: "date", preventFutureDate: true };
  if (roll < 0.55) {
    const custom =
      context.codelists[
        2 + (formIndex % Math.max(1, context.codelists.length - 2))
      ];
    return {
      ...base,
      dataType: "single_select",
      codelistId: (custom || context.codelists[1]).id,
    };
  }
  if (roll < 0.65)
    return { ...base, dataType: "radio", codelistId: "wl_cl_ny" };
  if (roll < 0.72) return { ...base, dataType: "textarea", columnSpan: 12 };
  if (roll < 0.8)
    return { ...base, dataType: "checkbox", codelistId: "wl_cl_ny" };
  return { ...base, dataType: "text" };
}

function buildRules(
  formIndex: number,
  fields: CRFField[],
  count: number
): EditCheckRule[] {
  const formKey = `f${pad(formIndex + 1, 3)}`;
  const gate = fields[0];
  const weight = fields[1];
  const height = fields[2];
  const optional = fields.slice(5);
  const rules: EditCheckRule[] = [];
  for (let index = 0; index < count; index++) {
    const id = `${formKey}_r${pad(index + 1, 2)}`;
    const target = optional[index % Math.max(1, optional.length)] || weight;
    const kind = index % 4;
    if (kind === 0) {
      rules.push({
        id,
        name: `Show follow-up ${index + 1}`,
        description: "Show a follow-up question when the gate answer is Yes.",
        triggerFieldIds: [gate.id],
        actionType: "show_field",
        targetFieldId: target.id,
        conditions: [{ fieldId: gate.id, operator: "eq", value: "Y" }],
        logicalOperator: "AND",
      });
    } else if (kind === 1) {
      rules.push({
        id,
        name: `Weight range ${index + 1}`,
        description: "Query an implausible weight.",
        triggerFieldIds: [weight.id],
        actionType: "raise_query",
        targetFieldId: weight.id,
        conditions: [
          { fieldId: weight.id, operator: "lt", value: 30 },
          { fieldId: weight.id, operator: "gt", value: 200 },
        ],
        logicalOperator: "OR",
        querySeverity: "warning",
        queryMessage: "Weight outside the plausible range; please confirm.",
      });
    } else if (kind === 2) {
      rules.push({
        id,
        name: `Require detail ${index + 1}`,
        description:
          "Require detail when the gate answer is Yes and height is captured.",
        triggerFieldIds: [gate.id, height.id],
        actionType: "require_field",
        targetFieldId: target.id,
        // Flat mirror of the groups, as the editor persists it for older readers.
        conditions: [
          { fieldId: gate.id, operator: "eq", value: "Y" },
          { fieldId: height.id, operator: "is_not_empty", value: "" },
        ],
        logicalOperator: "AND",
        conditionGroups: [
          {
            id: `${id}_g1`,
            logicalOperator: "AND",
            conditions: [{ fieldId: gate.id, operator: "eq", value: "Y" }],
          },
          {
            id: `${id}_g2`,
            logicalOperator: "OR",
            conditions: [
              { fieldId: height.id, operator: "is_not_empty", value: "" },
            ],
          },
        ],
        groupLogicalOperator: "AND",
      });
    } else {
      rules.push({
        id,
        name: `Hide when No ${index + 1}`,
        description: "Hide a question when the gate answer is No.",
        triggerFieldIds: [gate.id],
        actionType: "hide_field",
        targetFieldId: target.id,
        conditions: [{ fieldId: gate.id, operator: "eq", value: "N" }],
        logicalOperator: "AND",
      });
    }
  }
  return rules;
}

function buildForm(context: FormBuildContext): CRFForm {
  const { formIndex, fieldCount } = context;
  // Every tenth form is a log form (AE/CM); a study smaller than ten forms
  // still gets one, as its last form.
  const isLog =
    formIndex % 10 === 9 ||
    (context.formCount < 10 && formIndex === context.formCount - 1);
  const domain = isLog
    ? LOG_DOMAINS[Math.floor(formIndex / 10) % LOG_DOMAINS.length]
    : DOMAINS[formIndex % DOMAINS.length];
  const formKey = `f${pad(formIndex + 1, 3)}`;
  const fields = Array.from({ length: fieldCount }, (_, fieldIndex) =>
    buildField(formIndex, fieldIndex, context)
  );
  const sections: CRFSection[] = [];
  for (let start = 0; start < fields.length; start += SECTION_SIZE) {
    const sectionIndex = start / SECTION_SIZE;
    sections.push({
      id: `${formKey}_s${pad(sectionIndex + 1, 2)}`,
      title: `Section ${sectionIndex + 1}`,
      // A repeating section every third form, beyond the first section.
      isRepeating: sectionIndex === 1 && formIndex % 3 === 0,
      fields: fields.slice(start, start + SECTION_SIZE),
    });
  }
  return {
    id: formKey,
    name: `${domain} synthetic form ${formIndex + 1}`,
    domain,
    description: `Synthetic ${domain} form for workload measurement.`,
    version: "1.0",
    isLogForm: isLog,
    sections,
    rules: buildRules(formIndex, fields, context.rulesPerForm),
  };
}

function buildVisits(spec: CrfWorkloadSpec, forms: CRFForm[]): StudyVisit[] {
  const visitForms = forms.filter((form) => !form.isLogForm);
  const logForms = forms.filter((form) => form.isLogForm);
  const visits: StudyVisit[] = [];
  for (let index = 0; index < spec.scheduledVisits; index++) {
    const isScreening = index === 0;
    // Screening collects every visit form; later visits collect a rotating half.
    const assigned = visitForms
      .filter((_, formIndex) => isScreening || (formIndex + index) % 2 === 0)
      .map((form) => form.id);
    visits.push({
      id: `v${pad(index + 1, 2)}`,
      oid: isScreening ? "SE.SCREENING" : `SE.VISIT${index}`,
      name: isScreening ? "Screening" : `Cycle ${index} Day 1`,
      visitType: "Scheduled",
      targetDay: isScreening ? -14 : index * 21,
      windowBefore: isScreening ? 14 : 3,
      windowAfter: isScreening ? 0 : 3,
      assignedFormIds: assigned,
    });
  }
  visits.push({
    id: "v_unsched",
    oid: "SE.UNSCHED",
    name: "Unscheduled",
    visitType: "Unscheduled",
    targetDay: 0,
    windowBefore: 0,
    windowAfter: 0,
    isRepeating: true,
    repeatMax: 20,
    assignedFormIds: visitForms
      .slice(0, Math.min(3, visitForms.length))
      .map((form) => form.id),
  });
  visits.push({
    id: "v_common",
    oid: "SE.COMMON",
    name: "Common (log forms)",
    visitType: "Common",
    targetDay: 0,
    windowBefore: 0,
    windowAfter: 0,
    assignedFormIds: logForms.map((form) => form.id),
  });
  return visits;
}

function buildScenarios(
  spec: CrfWorkloadSpec,
  forms: CRFForm[]
): TestScenario[] {
  const scenarios: TestScenario[] = [];
  for (const form of forms) {
    const fields = form.sections.flatMap((section) => section.fields);
    const [gate, weight, height, bmi] = fields;
    const showRule = form.rules.find(
      (rule) => rule.actionType === "show_field"
    );
    const hideRule = form.rules.find(
      (rule) => rule.actionType === "hide_field"
    );
    for (let index = 0; index < spec.scenariosPerForm; index++) {
      const yes = index % 2 === 0;
      // "Yes" exercises the show rule; "No" exercises the hide rule. Every
      // scenario passes against the pristine study, as a saved suite would.
      const rule = yes ? showRule : hideRule;
      scenarios.push({
        id: `${form.id}_sc${pad(index + 1, 2)}`,
        name: yes ? "Gate yes, normal vitals" : "Gate no, implausible weight",
        formId: form.id,
        scope: { subjectId: "SUBJ-001", visitId: "v01" },
        inputs: {
          [gate.id]: yes ? "Y" : "N",
          [weight.id]: yes ? 70 : 260,
          [height.id]: 175,
        },
        expectations: [
          { kind: "calculation", fieldId: bmi.id, expectedStatus: "success" },
          ...(rule
            ? [
                {
                  kind: "field_visible" as const,
                  fieldId: rule.targetFieldId,
                  expected: yes,
                },
                {
                  kind: "rule_result" as const,
                  ruleId: rule.id,
                  expected: "true" as const,
                },
              ]
            : []),
        ],
        createdAt: CRF_WORKLOAD_EPOCH,
        updatedAt: CRF_WORKLOAD_EPOCH,
      });
    }
  }
  return scenarios;
}

/**
 * Generates the synthetic study for one workload. The same id always yields a
 * structurally and textually identical document.
 */
export function generateCrfWorkload(id: CrfWorkloadId): StudyProtocol {
  const spec = getCrfWorkloadSpec(id);
  const random = createRandom(spec.seed);
  const codelists = buildCodelists(spec.forms);
  const fieldCounts = distribute(spec.fields, spec.forms);
  const forms = fieldCounts.map((fieldCount, formIndex) =>
    buildForm({
      formIndex,
      formCount: spec.forms,
      fieldCount,
      rulesPerForm: spec.rulesPerForm,
      codelists,
      random,
    })
  );
  const visits = buildVisits(spec, forms);
  // A cross-form study-level rule per ten forms, like protocol-wide checks.
  const studyRules: EditCheckRule[] = forms
    .filter((_, index) => index % 10 === 0)
    .map((form, index) => {
      const gate = form.sections[0].fields[0];
      return {
        id: `wl_study_r${pad(index + 1, 2)}`,
        name: `Protocol-wide check ${index + 1}`,
        description: "Raise a query when the gate answer is missing.",
        triggerFieldIds: [gate.id],
        actionType: "raise_query" as const,
        targetFieldId: gate.id,
        conditions: [
          { fieldId: gate.id, operator: "is_empty" as const, value: "" },
        ],
        logicalOperator: "AND" as const,
        querySeverity: "info" as const,
        queryMessage: "Gate answer is missing.",
      };
    });
  return {
    id: `wl_${spec.id}`,
    protocolNumber: `WL-682-${spec.id.toUpperCase()}`,
    studyName: `Synthetic ${spec.label} workload`,
    phase: "Phase III",
    sponsor: "Synthetic Workload Sponsor",
    therapeuticArea: "Synthetic",
    version: "1.0",
    lastModified: CRF_WORKLOAD_EPOCH,
    forms,
    visits,
    codelists,
    rules: studyRules,
    arms: [
      { id: "wl_arm_a", name: "Arm A", type: "Experimental" },
      { id: "wl_arm_b", name: "Arm B", type: "Placebo Comparator" },
    ],
    testScenarios: buildScenarios(spec, forms),
  };
}

/** Counts the structural features of a study for verification and reporting. */
export function summarizeCrfWorkload(study: StudyProtocol): CrfWorkloadSummary {
  const sections = study.forms.flatMap((form) => form.sections);
  const fields = sections.flatMap((section) => section.fields);
  const repeating = fields.filter(
    (field) => field.dataType === "repeating_table"
  );
  return {
    forms: study.forms.length,
    sections: sections.length,
    fields: fields.length,
    repeatingTableFields: repeating.length,
    repeatingColumns: repeating.reduce(
      (total, field) => total + (field.repeatingColumns?.length || 0),
      0
    ),
    repeatingSections: sections.filter((section) => section.isRepeating).length,
    logForms: study.forms.filter((form) => form.isLogForm).length,
    calculatedFields: fields.filter((field) => field.dataType === "calculated")
      .length,
    selectFields: fields.filter((field) => Boolean(field.codelistId)).length,
    visits: study.visits.length,
    repeatingVisits: study.visits.filter((visit) => visit.isRepeating).length,
    visitFormAssignments: study.visits.reduce(
      (total, visit) => total + visit.assignedFormIds.length,
      0
    ),
    formRules: study.forms.reduce(
      (total, form) => total + form.rules.length,
      0
    ),
    studyRules: study.rules?.length || 0,
    scenarios: study.testScenarios?.length || 0,
    codelists: study.codelists.length,
  };
}

/** One deliberate amendment applied by {@link amendCrfWorkload}. */
export interface CrfWorkloadAmendment {
  formId: string;
  fieldId: string;
  newLabel: string;
}

/**
 * Applies a deterministic protocol amendment, relabelling one field in each
 * of the first `count` forms, so a baseline comparison has a known number of
 * expected changes to find. Returns a new study; the input is not mutated.
 */
export function amendCrfWorkload(
  study: StudyProtocol,
  count: number
): { study: StudyProtocol; amendments: CrfWorkloadAmendment[] } {
  const amendments: CrfWorkloadAmendment[] = [];
  const forms = study.forms.map((form, formIndex) => {
    if (formIndex >= count) return form;
    const target = form.sections[0].fields[form.sections[0].fields.length - 1];
    const newLabel = `${target.label} (amended)`;
    amendments.push({ formId: form.id, fieldId: target.id, newLabel });
    return {
      ...form,
      sections: form.sections.map((section, sectionIndex) =>
        sectionIndex === 0
          ? {
              ...section,
              fields: section.fields.map((field) =>
                field.id === target.id ? { ...field, label: newLabel } : field
              ),
            }
          : section
      ),
    };
  });
  return { study: { ...study, version: "1.1", forms }, amendments };
}
