/**
 * CDISC USDM (Unified Study Data Model) Bidirectional Graph Adapter & Diff Engine
 * Facilitates loss-free conversion between CRF Studio protocols and CDISC USDM graph JSON specifications.
 */

import {
  CLINICAL_STANDARDS_PROFILE,
  STANDARD_CODELISTS,
  USDM_SDTM_DOMAIN_EXTENSION_URL,
  USDM_SDTM_STRESU_EXTENSION_URL,
  USDM_SDTM_TESTCD_EXTENSION_URL,
  USDM_V4_VERSION,
  getUsdmV4ExtensionString,
  type UsdmV4Activity,
  type UsdmV4AliasCode,
  type UsdmV4BiomedicalConcept,
  type UsdmV4Code,
  type UsdmV4Document,
  type UsdmV4EligibilityCriterion,
  type UsdmV4EligibilityCriterionItem,
  type UsdmV4Encounter,
  type UsdmV4ExtensionAttribute,
  type UsdmV4InterventionalStudyDesign,
  type UsdmV4Objective,
  type UsdmV4Procedure,
  type UsdmV4ScheduleTimeline,
  type UsdmV4StudyArm,
  type UsdmV4StudyCell,
  type UsdmV4StudyCohort,
  type UsdmV4StudyDesignPopulation,
  type UsdmV4StudyElement,
  type UsdmV4StudyEpoch,
  type UsdmV4StudyIntervention,
  type UsdmV4Timing,
  USDM_TIMING_AFTER,
  USDM_TIMING_BEFORE,
  USDM_TIMING_FIXED_REFERENCE,
  formatIsoDurationDays,
  getUsdmV4EncounterSchedule,
  resolveUsdmStudyDesign,
  studyDayDistance,
  type UsdmStudySelection,
} from "@/lib/clinical-standards";
import {
  StudyProtocol,
  CRFForm,
  CRFField,
  CRFSection,
  ClinicalDataType,
  StudyVisit,
  StudyArm,
  StudyEpoch,
  StudyCohort,
  StudyPopulationPlan,
  StudyPlannedSex,
  StudyEligibilityCriterion,
  StudyObjective,
  StudyObjectiveLevel,
  StudyInterventionPlan,
  StudyInterventionRole,
  StudyInterventionType,
  BiomedicalConcept,
  CodelistDefinition,
  CodelistOption,
  EditCheckRule,
  AstCondition,
  ConditionGroup,
} from "../types";
import {
  getUniversalCrfSchemaUrl,
  validateUniversalCrf,
  EdcSimulationStateSchema,
  StudyProvenanceSchema,
} from "./universal-schema";
import { cloneDeep } from "../../utils";

export interface UsdmBiomedicalConceptProperty {
  id: string;
  name: string;
  code?: string;
  datatype?: string;
}

export interface UsdmBiomedicalConcept {
  id: string;
  name: string;
  conceptId?: string;
  code?: string;
  domain?: string;
  synonyms?: string[];
  properties?: UsdmBiomedicalConceptProperty[] | Record<string, unknown>;
  variableName?: string;
  dataType?: string;
  label?: string;
  unit?: string;
}

export interface UsdmArm {
  id: string;
  name: string;
  type: string;
  description?: string;
  epochIds?: string[];
}

export interface UsdmEpoch {
  id: string;
  name: string;
  sequenceNumber: number;
  type?: string;
  description?: string;
}

export interface UsdmCohort {
  id: string;
  name: string;
  description?: string;
  armIds?: string[];
  targetSize?: number;
}

export interface UsdmEncounter {
  id: string;
  oid?: string;
  name: string;
  type: "Scheduled" | "Unscheduled" | "Common";
  targetDay: number;
  timepointDays?: number;
  windowBefore: number;
  windowAfter: number;
  epochId?: string;
  armIds?: string[];
  assignedFormIds?: string[];
  armFormAssignments?: Record<string, string[]>;
  isRepeating?: boolean;
  repeatMax?: number;
}

export interface UsdmActivity {
  id: string;
  name: string;
  domain: string;
  description?: string;
  version?: string;
  sections?: CRFForm["sections"];
  rules?: CRFForm["rules"];
  isLogForm?: boolean;
}

export interface UsdmStudyDesign {
  id: string;
  name: string;
  arms: UsdmArm[];
  epochs: UsdmEpoch[];
  cohorts: UsdmCohort[];
  population?: StudyPopulationPlan;
  eligibilityCriteria?: StudyEligibilityCriterion[];
  objectives?: StudyObjective[];
  interventions?: StudyInterventionPlan[];
  encounters: UsdmEncounter[];
  activities: UsdmActivity[];
  biomedicalConcepts: UsdmBiomedicalConcept[];
  codeLists?: Record<string, unknown>[] | CodelistDefinition[];
  valueSets?: Record<string, unknown>[];
  rules?: EditCheckRule[];
  scheduleRules?: Record<string, unknown>[];
}

export interface UsdmStudy {
  id: string;
  name?: string;
  title?: string;
  protocolNumber?: string;
  protocolId?: string;
  phase?: string;
  sponsor?: string;
  therapeuticArea?: string;
  version?: string;
  lastModified?: string;
  studyDesigns?: UsdmStudyDesign[];
  arms?: UsdmArm[];
  epochs?: UsdmEpoch[];
  cohorts?: UsdmCohort[];
  encounters?: UsdmEncounter[];
  activities?: UsdmActivity[];
  biomedicalConcepts?: UsdmBiomedicalConcept[];
  codeLists?: Record<string, unknown>[] | CodelistDefinition[];
  valueSets?: Record<string, unknown>[];
  codelists?: CodelistDefinition[];
  rules?: EditCheckRule[];
  simulationState?: StudyProtocol["simulationState"];
  provenance?: StudyProtocol["provenance"];
}

export interface UsdmDocument {
  $schema?: string;
  schemaVersion?: string;
  study: UsdmStudy;
  valueSets?: Record<string, unknown>[];
  codeLists?: Record<string, unknown>[] | CodelistDefinition[];
  codelists?: CodelistDefinition[];
  rules?: EditCheckRule[];
}

function toSafeString(val: unknown, fallback: string = ""): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") return val;
  if (
    typeof val === "number" ||
    typeof val === "boolean" ||
    typeof val === "bigint" ||
    typeof val === "symbol"
  ) {
    return String(val);
  }
  try {
    if (typeof val === "object") {
      const str = String(val);
      if (str !== "[object Object]") return str;
    }
  } catch {
    // Ignore conversion error when obj.toString() throws
  }
  return fallback;
}

/**
 * Normalizes USDM graph ValueSet or CodeList objects/references into a CRF Studio CodelistDefinition.
 */
export function extractCodelistFromUsdmObject(
  raw: unknown
): CodelistDefinition | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const rawTarget =
    (obj.codeList && typeof obj.codeList === "object" ? obj.codeList : null) ??
    (obj.valueSet && typeof obj.valueSet === "object" ? obj.valueSet : null) ??
    (obj.codelist && typeof obj.codelist === "object" ? obj.codelist : null) ??
    obj;

  if (!rawTarget || typeof rawTarget !== "object") return null;
  const target = rawTarget as Record<string, unknown>;

  const rawId =
    target.id ??
    target.codeListId ??
    target.valueSetId ??
    target.nciCodelistCode ??
    target.code ??
    (target.name
      ? `cl_${toSafeString(target.name)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_")}`
      : null);

  const id = toSafeString(rawId);

  if (!id) return null;

  const name = toSafeString(
    target.name ?? target.label ?? target.title ?? id,
    id
  );
  const nciCodeRaw = target.nciCodelistCode ?? target.nciCode ?? target.cCode;
  const nciCodelistCode = toSafeString(nciCodeRaw, "") || undefined;

  const rawOpts =
    target.options ||
    target.terms ||
    target.items ||
    target.codeListItems ||
    target.valueSetItems ||
    target.concepts ||
    target.values ||
    target.codes ||
    target.permittedValues;

  const options: CodelistOption[] = Array.isArray(rawOpts)
    ? rawOpts.map((opt: unknown, idx: number) => {
        if (typeof opt === "string" || typeof opt === "number") {
          const val = toSafeString(opt, String(idx + 1));
          return {
            code: val,
            label: val,
            order: idx + 1,
          };
        }
        if (!opt || typeof opt !== "object") {
          const val = toSafeString(opt, String(idx + 1));
          return {
            code: val,
            label: val,
            order: idx + 1,
          };
        }
        const o = opt as Record<string, unknown>;
        const rawCode =
          o.code ?? o.value ?? o.id ?? o.name ?? o.term ?? idx + 1;
        const code = toSafeString(rawCode, String(idx + 1));
        const rawLabel =
          o.label ?? o.decode ?? o.name ?? o.text ?? o.description ?? code;
        const label = toSafeString(rawLabel, code);
        const rawNci = o.nciCode ?? o.cCode ?? o.conceptId;
        const nciCode = toSafeString(rawNci, "") || undefined;
        const order =
          typeof o.order === "number"
            ? o.order
            : typeof o.sequenceNumber === "number"
              ? o.sequenceNumber
              : idx + 1;
        return {
          code,
          label,
          nciCode,
          order,
        };
      })
    : [];

  return {
    id,
    name,
    nciCodelistCode,
    isStandard: Boolean(target.isStandard),
    options,
  };
}

export interface UsdmDiffSummary {
  protocolNumber: string;
  hasChanges: boolean;
  addedArms: string[];
  removedArms: string[];
  addedEpochs: string[];
  removedEpochs: string[];
  addedCohorts: string[];
  removedCohorts: string[];
  addedConcepts: string[];
  removedConcepts: string[];
  modifiedConcepts: string[];
  addedEncounters: string[];
  removedEncounters: string[];
  modifiedEncounters: string[];
  addedActivities: string[];
  removedActivities: string[];
}

/**
 * Builds the flat, pre-v4 USDM graph that CRF Studio exported up to
 * USDM 3.0.0. It is still the intermediate shape both directions pass
 * through: export lifts it into USDM v4.0 (`liftLegacyToUsdmV4`), and
 * import lowers a v4 document back into it (`lowerUsdmV4ToLegacy`), so the
 * v3 reader keeps working unchanged for files exported before the upgrade.
 */
function buildLegacyUsdmDocument(study: StudyProtocol): UsdmDocument {
  const biomedicalConcepts: UsdmBiomedicalConcept[] = (
    study.biomedicalConcepts || []
  ).map((bc) => ({
    id: bc.id,
    name: bc.name,
    conceptId: bc.conceptId || bc.code || bc.id,
    code: bc.code,
    domain: bc.domain,
    synonyms:
      bc.synonyms ||
      [bc.variableName || bc.id, bc.label || bc.name].filter((s): s is string =>
        Boolean(s)
      ),
    properties: bc.properties || {},
    variableName: bc.variableName,
    dataType: bc.dataType,
    label: bc.label,
    unit: bc.unit,
  }));
  const conceptIdSet = new Set(biomedicalConcepts.map((bc) => bc.id));
  const conceptNames = new Set(biomedicalConcepts.map((bc) => bc.name));
  const conceptMap = new Map<string, UsdmBiomedicalConcept>();
  biomedicalConcepts.forEach((bc) => conceptMap.set(bc.id, bc));

  const domainVarMap = new Map<string, UsdmBiomedicalConcept>();
  biomedicalConcepts.forEach((bc) => {
    if (bc.domain && bc.variableName) {
      domainVarMap.set(
        `${bc.domain.toUpperCase()}_${bc.variableName.toUpperCase()}`,
        bc
      );
    }
  });

  // Clone forms so we don't mutate original
  const forms: CRFForm[] = cloneDeep(study.forms || []);

  forms.forEach((form) => {
    form.sections?.forEach((section) => {
      section.fields?.forEach((field) => {
        let conceptId = field.conceptId;

        if (!conceptId) {
          const key = `${form.domain.toUpperCase()}_${field.variableName.toUpperCase()}`;
          const existing = domainVarMap.get(key);
          if (existing) {
            conceptId = existing.id;
          } else {
            conceptId = `bc_${form.domain.toLowerCase()}_${field.variableName.toLowerCase()}`;
          }
          field.conceptId = conceptId;
        }

        if (!conceptIdSet.has(conceptId)) {
          conceptIdSet.add(conceptId);
          // Two forms can ask the same question, such as the route on CM
          // and EX: the domain tells their concepts apart (CORE-001013).
          const name = conceptNames.has(field.label)
            ? `${field.label} (${form.domain})`
            : field.label;
          conceptNames.add(name);
          const newConcept: UsdmBiomedicalConcept = {
            id: conceptId,
            name,
            // A field's cdashMetadata.nciConceptId is the NCI code of its
            // codelist, not of a biomedical concept, so a derived concept
            // carries no NCI code: it is a CRF Studio concept.
            conceptId,
            domain: form.domain,
            synonyms: [field.variableName, field.label],
            properties: {
              dataType: field.dataType,
              required: field.required,
              cdashMetadata: field.cdashMetadata,
              codelistId: field.codelistId,
              unit: field.unit,
              minValue: field.minValue,
              maxValue: field.maxValue,
              calculationFormula: field.calculationFormula,
            },
            variableName: field.variableName,
            dataType: field.dataType,
            label: field.label,
            unit: field.unit,
          };
          biomedicalConcepts.push(newConcept);
          conceptMap.set(conceptId, newConcept);
          if (form.domain && field.variableName) {
            domainVarMap.set(
              `${form.domain.toUpperCase()}_${field.variableName.toUpperCase()}`,
              newConcept
            );
          }
        }

        const matchingConcept = conceptMap.get(conceptId);
        if (matchingConcept) {
          field.variableName =
            field.variableName || matchingConcept.variableName || field.id;
          field.label =
            field.label ||
            matchingConcept.label ||
            matchingConcept.name ||
            field.variableName ||
            field.id;
          field.dataType = field.dataType || matchingConcept.dataType || "text";
          field.unit = field.unit || matchingConcept.unit;
        }
      });
    });
  });

  const encounters: UsdmEncounter[] = (study.visits || []).map((v) => ({
    id: v.id,
    oid: v.oid,
    name: v.name,
    type: v.visitType,
    targetDay: v.targetDay,
    timepointDays: v.timepointDays,
    windowBefore: v.windowBefore,
    windowAfter: v.windowAfter,
    epochId: v.epochId,
    armIds: v.armIds,
    assignedFormIds: v.assignedFormIds || [],
    armFormAssignments: v.armFormAssignments,
    isRepeating: v.isRepeating,
    repeatMax: v.repeatMax,
  }));

  const activities: UsdmActivity[] = forms.map((f) => ({
    id: f.id,
    name: f.name,
    domain: f.domain,
    description: f.description,
    version: f.version,
    sections: f.sections,
    rules: f.rules,
    isLogForm: f.isLogForm,
  }));

  const codeLists = (study.codelists || []).map((cl) => ({
    id: cl.id,
    name: cl.name,
    nciCodelistCode: cl.nciCodelistCode,
    isStandard: cl.isStandard,
    options: cl.options,
  }));

  const valueSets = (study.codelists || []).map((cl) => ({
    id: `vs_${cl.id}`,
    name: `${cl.name} Value Set`,
    codeListId: cl.id,
    codeList: cl,
  }));

  const explicitRules = study.rules || [];
  const scheduleRules: EditCheckRule[] = (study.visits || []).map((v) => {
    const windowBefore = Math.abs(v.windowBefore || 0);
    const windowAfter = Math.abs(v.windowAfter || 0);
    const minDay = v.targetDay - windowBefore;
    const maxDay = v.targetDay + windowAfter;

    return {
      id: `rule_sched_${v.id}`,
      name: `Schedule Rule: ${v.name}`,
      description: `Schedule window rule for ${v.name}: Target Day ${v.targetDay} (-${windowBefore}/+${windowAfter} days; allowed window Day ${minDay} to Day ${maxDay})`,
      triggerFieldIds: [`${v.id}_day`],
      actionType: "raise_query",
      targetFieldId: v.id,
      conditions: [
        { fieldId: `${v.id}_day`, operator: "gte", value: minDay },
        { fieldId: `${v.id}_day`, operator: "lte", value: maxDay },
      ],
      logicalOperator: "AND",
      querySeverity: "warning",
      queryMessage: `Visit ${v.name} is outside allowed schedule window [Day ${minDay}, Day ${maxDay}]`,
      formulaExpression: `visit_day >= ${minDay} && visit_day <= ${maxDay}`,
    };
  });

  const ruleMap = new Map<string, EditCheckRule>();
  [...explicitRules, ...scheduleRules].forEach((rule) => {
    if (rule && (rule.id || rule.name)) {
      const key = rule.id || rule.name;
      if (!ruleMap.has(key)) {
        ruleMap.set(key, rule);
      }
    }
  });

  const exportRules = Array.from(ruleMap.values());

  const primaryDesign: UsdmStudyDesign = {
    id: "design_main",
    name: study.studyName || "Main Study Design",
    arms: (study.arms || []).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      description: a.description,
      epochIds: a.epochIds,
    })),
    epochs: (study.epochs || []).map((e) => ({
      id: e.id,
      name: e.name,
      sequenceNumber: e.sequenceNumber,
      type: e.type,
      description: e.description,
    })),
    cohorts: (study.cohorts || []).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      armIds: c.armIds,
      targetSize: c.targetSize,
    })),
    ...withoutUndefined({
      population: study.population,
      eligibilityCriteria: study.eligibilityCriteria,
      objectives: study.objectives,
      interventions: study.interventions,
    }),
    encounters,
    activities,
    biomedicalConcepts,
    codeLists,
    valueSets,
    rules: exportRules,
  };

  return {
    $schema: "https://www.cdisc.org/schemas/usdm/v3/usdm.schema.json",
    schemaVersion: "3.0.0",
    study: {
      id: study.id,
      name: study.protocolNumber || study.id,
      title: study.studyName,
      protocolNumber: study.protocolNumber,
      protocolId: study.protocolId || study.protocolNumber,
      phase: study.phase,
      sponsor: study.sponsor,
      therapeuticArea: study.therapeuticArea,
      version: study.version,
      lastModified: study.lastModified,
      studyDesigns: [primaryDesign],
      codeLists,
      valueSets,
      rules: exportRules,
      simulationState: study.simulationState,
      provenance: study.provenance,
    },
  };
}

/**
 * Transforms a CRF Studio StudyProtocol into a CDISC USDM v4.0 document.
 * Decouples field-level presentation properties into independent BiomedicalConcept nodes,
 * places arms, epochs, study cells, encounters and activities on an interventional study design,
 * and expresses visit target days and windows as schedule timeline timings.
 * CRF Studio data with no USDM home (form layouts, edit checks, codelists) travels in
 * USDM extension attributes, so the export stays valid against the USDM v4 schema and re-imports losslessly.
 */
export function exportStudyToUsdmObject(study: StudyProtocol): UsdmV4Document {
  return liftLegacyToUsdmV4(buildLegacyUsdmDocument(study));
}

/**
 * Serializes a StudyProtocol into standard CDISC USDM JSON string.
 */
export function exportStudyToUsdm(study: StudyProtocol, pretty = true): string {
  const usdmObj = exportStudyToUsdmObject(study);
  return pretty ? JSON.stringify(usdmObj, null, 2) : JSON.stringify(usdmObj);
}

function isPlainConditionShape(value: unknown): value is AstCondition {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.fieldId === "string" && typeof v.operator === "string";
}

function isPlainConditionGroupShape(value: unknown): value is ConditionGroup {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.logicalOperator === "AND" || v.logicalOperator === "OR") &&
    Array.isArray(v.conditions) &&
    v.conditions.every(isPlainConditionShape)
  );
}

/**
 * A USDM document is untrusted JSON at runtime regardless of what the
 * `EditCheckRule` cast at each call site below claims: an imported rule's
 * `conditions`/`conditionGroups` may not match the shape this evaluator
 * actually understands (a hand-edited file, a different tool's export, a
 * future/foreign expression form). Rather than passing such a rule
 * through untouched - which looks like a normal rule but, with an empty
 * or malformed conditions array, defaults to always-true (#540) - preserve
 * the original payload verbatim via `unsupportedExpression` so it is
 * surfaced for review instead of silently mis-firing or mis-simplifying.
 */
function normalizeImportedRule(raw: unknown): EditCheckRule {
  const candidate = (
    raw && typeof raw === "object" ? raw : {}
  ) as Partial<EditCheckRule> & Record<string, unknown>;

  const conditionsValid =
    Array.isArray(candidate.conditions) &&
    candidate.conditions.every(isPlainConditionShape);
  const groupsValid =
    Array.isArray(candidate.conditionGroups) &&
    candidate.conditionGroups.every(isPlainConditionGroupShape);
  const groupsFieldAbsent = candidate.conditionGroups === undefined;
  const conditionsFieldAbsent = candidate.conditions === undefined;

  // A rule is understood only when at least one of conditions/
  // conditionGroups is actually present as a valid array - a rule missing
  // BOTH fields entirely is exactly as unsupported as one with a
  // malformed conditions array; it just happens to reach here via a
  // different foreign shape (no rule-expression content this evaluator
  // recognizes at all) rather than a broken one.
  const understood =
    (conditionsValid && (groupsFieldAbsent || groupsValid)) ||
    (groupsValid && (conditionsFieldAbsent || conditionsValid));

  const base: EditCheckRule = {
    id:
      typeof candidate.id === "string"
        ? candidate.id
        : `rule_imported_${Math.random().toString(36).slice(2)}`,
    name: typeof candidate.name === "string" ? candidate.name : "Imported Rule",
    description:
      typeof candidate.description === "string" ? candidate.description : "",
    triggerFieldIds: Array.isArray(candidate.triggerFieldIds)
      ? (candidate.triggerFieldIds as string[])
      : [],
    actionType:
      (candidate.actionType as EditCheckRule["actionType"]) || "raise_query",
    targetFieldId:
      typeof candidate.targetFieldId === "string"
        ? candidate.targetFieldId
        : "",
    conditions: conditionsValid ? (candidate.conditions as AstCondition[]) : [],
    logicalOperator: candidate.logicalOperator === "OR" ? "OR" : "AND",
    conditionGroups: groupsValid
      ? (candidate.conditionGroups as ConditionGroup[])
      : undefined,
    groupLogicalOperator:
      candidate.groupLogicalOperator === "OR" ||
      candidate.groupLogicalOperator === "AND"
        ? candidate.groupLogicalOperator
        : undefined,
    querySeverity: candidate.querySeverity as EditCheckRule["querySeverity"],
    queryMessage:
      typeof candidate.queryMessage === "string"
        ? candidate.queryMessage
        : undefined,
    formulaExpression:
      typeof candidate.formulaExpression === "string"
        ? candidate.formulaExpression
        : undefined,
  };

  if (!understood) {
    return {
      ...base,
      unsupportedExpression: {
        raw,
        reason:
          !conditionsValid && !groupsValid
            ? "neither conditions nor conditionGroups matched a recognized rule expression shape"
            : conditionsValid
              ? "conditionGroups did not match the expected {logicalOperator, conditions[]} shape"
              : "conditions did not match the expected {fieldId, operator, value|compareFieldId} shape",
      },
    };
  }

  return base;
}

function normalizeImportedRules(raw: unknown): EditCheckRule[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeImportedRule);
}

/**
 * Imports a CDISC USDM JSON document or object into an internal CRF Studio StudyProtocol.
 * A USDM v4 document with more than one study version or design needs `options.selection`;
 * without it the import throws and names the choices rather than reading the first.
 * Reassembles linear encounter schedules into visit sequences, extracts valueSets and codeList references into study codelists,
 * maps windowBefore and windowAfter visit tolerances to constrain study schedule rules, and resolves decoupled BiomedicalConcept definitions.
 */
export function importStudyFromUsdm(
  usdmInput: string | UsdmDocument | UsdmV4Document | Record<string, unknown>,
  options: { selection?: UsdmStudySelection } = {}
): StudyProtocol {
  const parsed: unknown =
    typeof usdmInput === "string" ? JSON.parse(usdmInput) : usdmInput;
  const doc = (
    getUsdmDocumentVersion(parsed) === "4"
      ? lowerUsdmV4ToLegacy(
          parsed as Record<string, unknown>,
          options.selection
        )
      : parsed
  ) as Record<string, unknown> & UsdmDocument;

  // Support direct StudyProtocol JSON fallback if user pasted a Universal CRF JSON
  if (doc.forms && doc.visits && doc.protocolNumber) {
    const val = validateUniversalCrf(doc);
    if (val.success) {
      const uStudy = val.study!;
      return {
        ...uStudy,
        provenance: {
          ...(uStudy.provenance || {}),
          sourceFormat: uStudy.provenance?.sourceFormat || "Universal CRF JSON",
        },
      };
    }
  }

  const studyObj = (doc.study || doc) as UsdmStudy & Record<string, unknown>;
  // A lowered v4 document carries only the selected design; a legacy v3
  // document with several designs needs one named, as v4 does.
  const legacyDesigns = studyObj.studyDesigns || [];
  const wantedDesignId = options.selection?.studyDesignId;
  if (legacyDesigns.length > 1 && !wantedDesignId) {
    throw new Error(
      `USDM import: study has ${legacyDesigns.length} designs; choose one of ${legacyDesigns.map((d) => d.id).join(", ")}`
    );
  }
  const chosenDesign =
    legacyDesigns.length > 1
      ? legacyDesigns.find((d) => d.id === wantedDesignId)
      : legacyDesigns[0];
  if (legacyDesigns.length > 1 && !chosenDesign) {
    throw new Error(`USDM import: no study design ${wantedDesignId}`);
  }
  const primaryDesign = (chosenDesign || {}) as UsdmStudyDesign &
    Record<string, unknown>;

  const arms: StudyArm[] = primaryDesign.arms || studyObj.arms || [];
  const epochs: StudyEpoch[] = primaryDesign.epochs || studyObj.epochs || [];
  const cohorts: StudyCohort[] =
    primaryDesign.cohorts || studyObj.cohorts || [];

  const rawConcepts: UsdmBiomedicalConcept[] =
    primaryDesign.biomedicalConcepts || studyObj.biomedicalConcepts || [];

  const conceptMap = new Map<string, UsdmBiomedicalConcept>();
  rawConcepts.forEach((bc) => conceptMap.set(bc.id, bc));

  const biomedicalConcepts: BiomedicalConcept[] = rawConcepts.map((bc) => ({
    id: bc.id,
    name: bc.name,
    conceptId: bc.conceptId || bc.code || bc.id,
    code: bc.code,
    domain: bc.domain,
    synonyms: bc.synonyms,
    properties: bc.properties,
    variableName: bc.variableName,
    dataType: bc.dataType,
    label: bc.label,
    unit: bc.unit,
  }));

  const rawEncounters: UsdmEncounter[] =
    primaryDesign.encounters || studyObj.encounters || [];
  const visits: StudyVisit[] = rawEncounters.map((enc) => ({
    id: enc.id,
    oid: enc.oid || `SE.${enc.id.toUpperCase()}`,
    name: enc.name,
    visitType: enc.type || "Scheduled",
    targetDay: typeof enc.targetDay === "number" ? enc.targetDay : 0,
    timepointDays: enc.timepointDays,
    windowBefore: typeof enc.windowBefore === "number" ? enc.windowBefore : 0,
    windowAfter: typeof enc.windowAfter === "number" ? enc.windowAfter : 0,
    assignedFormIds: enc.assignedFormIds || [],
    armFormAssignments: enc.armFormAssignments,
    epochId: enc.epochId,
    armIds: enc.armIds,
    isRepeating: enc.isRepeating,
    repeatMax: enc.repeatMax,
  }));

  const rawActivities: UsdmActivity[] =
    primaryDesign.activities ||
    studyObj.activities ||
    legacyFormActivities(studyObj.forms) ||
    [];
  const forms: CRFForm[] = rawActivities.map((act) => {
    const sections: CRFSection[] = (act.sections || []).map((sec) => ({
      ...sec,
      fields: (sec.fields || []).map((fld: CRFField) => {
        const matchingConcept = fld.conceptId
          ? conceptMap.get(fld.conceptId)
          : undefined;
        return {
          ...fld,
          variableName:
            fld.variableName || matchingConcept?.variableName || fld.id,
          label:
            fld.label ||
            matchingConcept?.label ||
            matchingConcept?.name ||
            fld.variableName ||
            fld.id,
          dataType: fld.dataType || matchingConcept?.dataType || "text",
          unit: fld.unit || matchingConcept?.unit,
        };
      }),
    }));

    return {
      id: act.id,
      name: act.name,
      domain: act.domain || "GENERAL",
      description: act.description || "",
      version: act.version || "1.0",
      sections,
      rules: normalizeImportedRules(act.rules),
      isLogForm: act.isLogForm,
    };
  });

  // Extract valueSets and codeList references into study codelists
  const codelistMap = new Map<string, CodelistDefinition>();

  function registerCodelistCandidate(candidate: unknown) {
    if (!candidate) return;
    if (Array.isArray(candidate)) {
      candidate.forEach(registerCodelistCandidate);
      return;
    }
    if (typeof candidate !== "object") return;
    const cl = extractCodelistFromUsdmObject(candidate);
    if (cl && cl.id) {
      const existing = codelistMap.get(cl.id);
      if (
        !existing ||
        (existing.options.length === 0 && cl.options.length > 0)
      ) {
        codelistMap.set(cl.id, cl);
      }
    }
  }

  [
    doc.valueSets,
    doc.codeLists,
    doc.codelists,
    doc.valueSet,
    doc.codeList,
    studyObj.valueSets,
    studyObj.codeLists,
    studyObj.codelists,
    studyObj.valueSet,
    studyObj.codeList,
    primaryDesign.valueSets,
    primaryDesign.codeLists,
    primaryDesign.codelists,
    primaryDesign.valueSet,
    primaryDesign.codeList,
  ].forEach(registerCodelistCandidate);

  rawConcepts.forEach((bc) => {
    const bcObj = asRecord(bc) ?? {};
    registerCodelistCandidate(
      bcObj.codeList || bcObj.valueSet || bcObj.codelist
    );
    if (bc.properties && typeof bc.properties === "object") {
      const props = bc.properties as Record<string, unknown>;
      registerCodelistCandidate(
        props.codeList || props.valueSet || props.codelist
      );
      const clId = (props.codelistId ||
        props.codeListId ||
        props.valueSetId ||
        bcObj.codelistId ||
        bcObj.codeListId ||
        bcObj.valueSetId) as string | undefined;
      if (clId && (props.customOptions || props.options || props.terms)) {
        registerCodelistCandidate({
          id: clId,
          name: (bc.label || bc.name || clId) as string,
          options: props.customOptions || props.options || props.terms,
        });
      }
    }
  });

  rawActivities.forEach((act) => {
    (act.sections || []).forEach((sec) => {
      (sec.fields || []).forEach((fld) => {
        const fldObj = asRecord(fld) ?? {};
        registerCodelistCandidate(
          fldObj.codeList || fldObj.valueSet || fldObj.codelist
        );
        const clId =
          fld.codelistId ||
          (fldObj.codeListId as string | undefined) ||
          (fldObj.valueSetId as string | undefined);
        if (clId && (fld.customOptions || fldObj.options)) {
          registerCodelistCandidate({
            id: clId,
            name: fld.label || fld.variableName || clId,
            options: fld.customOptions || fldObj.options,
          });
        }
      });
    });
  });

  const allReferencedCodelistIds = new Set<string>();

  rawConcepts.forEach((bc) => {
    const props = (bc.properties || {}) as Record<string, unknown>;
    const bcObj = asRecord(bc) ?? {};
    const id =
      props.codelistId ||
      props.codeListId ||
      props.valueSetId ||
      bcObj.codelistId ||
      bcObj.codeListId ||
      bcObj.valueSetId;
    if (id) allReferencedCodelistIds.add(String(id));
  });

  rawActivities.forEach((act) => {
    (act.sections || []).forEach((sec) => {
      (sec.fields || []).forEach((fld) => {
        const fldObj = asRecord(fld) ?? {};
        const id = fld.codelistId || fldObj.codeListId || fldObj.valueSetId;
        if (id) allReferencedCodelistIds.add(String(id));
      });
    });
  });

  allReferencedCodelistIds.forEach((id) => {
    if (!codelistMap.has(id)) {
      const std = STANDARD_CODELISTS.find(
        (sc) => sc.id === id || sc.nciCodelistCode === id
      );
      if (std) {
        codelistMap.set(id, std);
      }
    }
  });

  const extractedCodelists: CodelistDefinition[] = Array.from(
    codelistMap.values()
  );

  // Map windowBefore and windowAfter visit tolerances to constrain study schedule rules
  const primaryDesignObj = asRecord(primaryDesign) ?? {};
  const explicitRules: EditCheckRule[] = [
    ...normalizeImportedRules(doc.rules),
    ...normalizeImportedRules(studyObj.rules),
    ...normalizeImportedRules(primaryDesign.rules),
    ...normalizeImportedRules(primaryDesignObj.scheduleRules),
  ];

  const scheduleRules: EditCheckRule[] = visits.map((v) => {
    const windowBefore = Math.abs(v.windowBefore || 0);
    const windowAfter = Math.abs(v.windowAfter || 0);
    const minDay = v.targetDay - windowBefore;
    const maxDay = v.targetDay + windowAfter;

    return {
      id: `rule_sched_${v.id}`,
      name: `Schedule Rule: ${v.name}`,
      description: `Schedule window rule for ${v.name}: Target Day ${v.targetDay} (-${windowBefore}/+${windowAfter} days; allowed window Day ${minDay} to Day ${maxDay})`,
      triggerFieldIds: [`${v.id}_day`],
      actionType: "raise_query",
      targetFieldId: v.id,
      conditions: [
        { fieldId: `${v.id}_day`, operator: "gte", value: minDay },
        { fieldId: `${v.id}_day`, operator: "lte", value: maxDay },
      ],
      logicalOperator: "AND",
      querySeverity: "warning",
      queryMessage: `Visit ${v.name} is outside allowed schedule window [Day ${minDay}, Day ${maxDay}]`,
      formulaExpression: `visit_day >= ${minDay} && visit_day <= ${maxDay}`,
    };
  });

  const ruleMap = new Map<string, EditCheckRule>();
  [...explicitRules, ...scheduleRules].forEach((rule) => {
    if (rule && (rule.id || rule.name)) {
      const key = rule.id || rule.name;
      if (!ruleMap.has(key)) {
        ruleMap.set(key, rule);
      }
    }
  });

  const rules: EditCheckRule[] = Array.from(ruleMap.values());

  let validatedSimulationState: StudyProtocol["simulationState"] = undefined;
  if (studyObj.simulationState !== undefined) {
    if (
      typeof studyObj.simulationState !== "object" ||
      studyObj.simulationState === null
    ) {
      throw new Error(
        "Invalid supplied simulationState extension: payload must be an object."
      );
    }
    const simResult = EdcSimulationStateSchema.safeParse(
      studyObj.simulationState
    );
    if (!simResult.success) {
      const details = simResult.error.issues
        .slice(0, 5)
        .map((i) => `[${i.path.join(".")}]: ${i.message}`)
        .join(", ");
      throw new Error(
        `Invalid supplied simulationState extension: payload failed EDC simulation schema validation (${details}).`
      );
    }
    validatedSimulationState = simResult.data;
  }

  let validatedProvenance: StudyProtocol["provenance"] = undefined;
  if (studyObj.provenance !== undefined) {
    if (
      typeof studyObj.provenance !== "object" ||
      studyObj.provenance === null
    ) {
      throw new Error(
        "Invalid supplied provenance extension: payload must be an object."
      );
    }
    const provResult = StudyProvenanceSchema.safeParse(studyObj.provenance);
    if (!provResult.success) {
      const details = provResult.error.issues
        .slice(0, 5)
        .map((i) => `[${i.path.join(".")}]: ${i.message}`)
        .join(", ");
      throw new Error(
        `Invalid supplied provenance extension: payload failed provenance schema validation (${details}).`
      );
    }
    validatedProvenance = {
      ...(provResult.data as StudyProtocol["provenance"]),
      sourceFormat: provResult.data.sourceFormat || "CDISC USDM JSON",
    };
  }

  const protocol: StudyProtocol = {
    $schema: getUniversalCrfSchemaUrl(),
    schemaVersion: "1.0.0",
    id: studyObj.id ?? "imported_usdm_study",
    protocolNumber: studyObj.protocolNumber ?? studyObj.name ?? "USDM-STUDY",
    studyName: studyObj.title ?? studyObj.name ?? "Imported USDM Protocol",
    phase: studyObj.phase ?? "Phase III",
    sponsor: studyObj.sponsor ?? "Clinical Sponsor",
    therapeuticArea: studyObj.therapeuticArea ?? "General Medicine",
    version: studyObj.version ?? "1.0",
    lastModified: studyObj.lastModified ?? new Date().toISOString(),
    forms,
    visits,
    codelists:
      extractedCodelists.length > 0
        ? extractedCodelists
        : (studyObj.codelists as StudyProtocol["codelists"]) || [],
    rules,
    branding: studyObj.branding as StudyProtocol["branding"],
    arms,
    epochs,
    cohorts,
    ...withoutUndefined({
      population: primaryDesign.population,
      eligibilityCriteria: primaryDesign.eligibilityCriteria,
      objectives: primaryDesign.objectives,
      interventions: primaryDesign.interventions,
    }),
    biomedicalConcepts,
    simulationState: validatedSimulationState,
    provenance: validatedProvenance,
  };

  return protocol;
}

/**
 * Performs semantic version diffing between two USDM protocol revisions.
 * Identifies added, modified, or removed arms, epochs, cohorts, biomedical concepts, encounters, and activities.
 */
export function diffUsdmProtocols(
  usdmAInput: string | UsdmDocument | UsdmV4Document | Record<string, unknown>,
  usdmBInput: string | UsdmDocument | UsdmV4Document | Record<string, unknown>
): UsdmDiffSummary {
  const studyA = importStudyFromUsdm(usdmAInput);
  const studyB = importStudyFromUsdm(usdmBInput);

  const docB = (
    typeof usdmBInput === "string" ? JSON.parse(usdmBInput) : usdmBInput
  ) as Record<string, unknown> & UsdmDocument;
  const protocolNumber =
    studyB.protocolNumber ||
    (docB?.study?.protocolNumber as string) ||
    "USDM-STUDY";

  const armsA = new Set((studyA.arms || []).map((a) => a.id));
  const armsB = new Set((studyB.arms || []).map((a) => a.id));
  const addedArms = [...armsB].filter((a) => !armsA.has(a));
  const removedArms = [...armsA].filter((a) => !armsB.has(a));

  const epochsA = new Set((studyA.epochs || []).map((e) => e.id));
  const epochsB = new Set((studyB.epochs || []).map((e) => e.id));
  const addedEpochs = [...epochsB].filter((e) => !epochsA.has(e));
  const removedEpochs = [...epochsA].filter((e) => !epochsB.has(e));

  const cohortsA = new Set((studyA.cohorts || []).map((c) => c.id));
  const cohortsB = new Set((studyB.cohorts || []).map((c) => c.id));
  const addedCohorts = [...cohortsB].filter((c) => !cohortsA.has(c));
  const removedCohorts = [...cohortsA].filter((c) => !cohortsB.has(c));

  const conceptMapA = new Map(
    (studyA.biomedicalConcepts || []).map((c) => [c.id, c])
  );
  const conceptMapB = new Map(
    (studyB.biomedicalConcepts || []).map((c) => [c.id, c])
  );
  const addedConcepts: string[] = [];
  const removedConcepts: string[] = [];
  const modifiedConcepts: string[] = [];

  for (const [id, cB] of conceptMapB.entries()) {
    if (!conceptMapA.has(id)) {
      addedConcepts.push(id);
    } else {
      const cA = conceptMapA.get(id)!;
      if (
        cA.name !== cB.name ||
        cA.conceptId !== cB.conceptId ||
        cA.variableName !== cB.variableName ||
        cA.dataType !== cB.dataType ||
        cA.unit !== cB.unit
      ) {
        modifiedConcepts.push(id);
      }
    }
  }
  for (const id of conceptMapA.keys()) {
    if (!conceptMapB.has(id)) {
      removedConcepts.push(id);
    }
  }

  const visitMapA = new Map((studyA.visits || []).map((v) => [v.id, v]));
  const visitMapB = new Map((studyB.visits || []).map((v) => [v.id, v]));
  const addedEncounters: string[] = [];
  const removedEncounters: string[] = [];
  const modifiedEncounters: string[] = [];

  for (const [id, vB] of visitMapB.entries()) {
    if (!visitMapA.has(id)) {
      addedEncounters.push(id);
    } else {
      const vA = visitMapA.get(id)!;
      if (
        vA.name !== vB.name ||
        vA.targetDay !== vB.targetDay ||
        vA.windowBefore !== vB.windowBefore ||
        vA.windowAfter !== vB.windowAfter ||
        vA.epochId !== vB.epochId ||
        JSON.stringify(vA.assignedFormIds) !==
          JSON.stringify(vB.assignedFormIds) ||
        JSON.stringify(vA.armFormAssignments) !==
          JSON.stringify(vB.armFormAssignments)
      ) {
        modifiedEncounters.push(id);
      }
    }
  }
  for (const id of visitMapA.keys()) {
    if (!visitMapB.has(id)) {
      removedEncounters.push(id);
    }
  }

  const formMapA = new Map((studyA.forms || []).map((f) => [f.id, f]));
  const formMapB = new Map((studyB.forms || []).map((f) => [f.id, f]));
  const addedActivities = [...formMapB.keys()].filter(
    (id) => !formMapA.has(id)
  );
  const removedActivities = [...formMapA.keys()].filter(
    (id) => !formMapB.has(id)
  );

  const hasChanges =
    addedArms.length > 0 ||
    removedArms.length > 0 ||
    addedEpochs.length > 0 ||
    removedEpochs.length > 0 ||
    addedCohorts.length > 0 ||
    removedCohorts.length > 0 ||
    addedConcepts.length > 0 ||
    removedConcepts.length > 0 ||
    modifiedConcepts.length > 0 ||
    addedEncounters.length > 0 ||
    removedEncounters.length > 0 ||
    modifiedEncounters.length > 0 ||
    addedActivities.length > 0 ||
    removedActivities.length > 0;

  return {
    protocolNumber,
    hasChanges,
    addedArms,
    removedArms,
    addedEpochs,
    removedEpochs,
    addedCohorts,
    removedCohorts,
    addedConcepts,
    removedConcepts,
    modifiedConcepts,
    addedEncounters,
    removedEncounters,
    modifiedEncounters,
    addedActivities,
    removedActivities,
  };
}

// ---------------------------------------------------------------------------
// USDM v4.0
// ---------------------------------------------------------------------------

/** Base URL of the extension attributes CRF Studio writes into a USDM v4 export. */
export const CRF_STUDIO_USDM_EXTENSION_BASE =
  "https://deruiter.dev/usdm/extensions/crf-studio/";

const CDISC_CT_SYSTEM = "http://www.cdisc.org";
const CDISC_CT_VERSION = CLINICAL_STANDARDS_PROFILE.CT.packageDate;
const CRF_STUDIO_CODE_SYSTEM = "https://deruiter.dev/crf-studio";

function v4Code(
  id: string,
  code: string,
  decode: string,
  codeSystem = CDISC_CT_SYSTEM
): UsdmV4Code {
  return {
    id,
    code,
    codeSystem,
    codeSystemVersion:
      codeSystem === CDISC_CT_SYSTEM ? CDISC_CT_VERSION : "1.0",
    decode,
    instanceType: "Code",
  };
}

function v4AliasCode(id: string, standardCode: UsdmV4Code): UsdmV4AliasCode {
  return {
    id,
    standardCode,
    standardCodeAliases: [],
    instanceType: "AliasCode",
  };
}

/** Maps a free-text label onto a CDISC CT code when it is one we recognise. */
function ctCodeFor(
  id: string,
  table: Record<string, [string, string]>,
  label: string | undefined
): UsdmV4Code {
  const key = (label ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const hit = table[key];
  if (hit) return v4Code(id, hit[0], hit[1]);
  const text = label && label.length > 0 ? label : "Unspecified";
  return v4Code(id, text, text, CRF_STUDIO_CODE_SYSTEM);
}

const ARM_TYPE_CT: Record<string, [string, string]> = {
  experimental: ["C174266", "Experimental Arm"],
  experimentalarm: ["C174266", "Experimental Arm"],
  activecomparator: ["C174267", "Active Comparator Arm"],
  activecomparatorarm: ["C174267", "Active Comparator Arm"],
  placebocomparator: ["C174268", "Placebo Comparator Arm"],
  placebocomparatorarm: ["C174268", "Placebo Comparator Arm"],
  placebo: ["C174268", "Placebo Comparator Arm"],
  shamcomparator: ["C174269", "Sham Comparator Arm"],
  nointervention: ["C174270", "No Intervention Arm"],
};

const EPOCH_TYPE_CT: Record<string, [string, string]> = {
  screening: ["C202487", "Screening"],
  runin: ["C98779", "Run-in"],
  washout: ["C42872", "Washout"],
  treatment: ["C101526", "Treatment"],
  followup: ["C202578", "Follow-Up"],
};

const PHASE_CT: Record<string, [string, string]> = {
  "Phase I": ["C15600", "Phase I Trial"],
  "Phase I/II": ["C15693", "Phase I/II Trial"],
  "Phase II": ["C15601", "Phase II Trial"],
  "Phase III": ["C15602", "Phase III Trial"],
  "Phase IV": ["C15603", "Phase IV Trial"],
};

function crfExtension(
  ownerId: string,
  kind: string,
  payload: Record<string, unknown>
): UsdmV4ExtensionAttribute {
  return {
    id: `${ownerId}__ext_${kind}`,
    url: `${CRF_STUDIO_USDM_EXTENSION_BASE}${kind}`,
    valueString: JSON.stringify(sortKeysDeep(payload)),
    instanceType: "ExtensionAttribute",
  };
}

/**
 * Orders object keys alphabetically at every depth, so an extension payload
 * serialises identically however its source object was assembled.
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortKeysDeep(record[key])])
    );
  }
  return value;
}

function sdtmDomainExtension(
  ownerId: string,
  domain: string
): UsdmV4ExtensionAttribute {
  return {
    id: `${ownerId}__ext_sdtm_domain`,
    url: USDM_SDTM_DOMAIN_EXTENSION_URL,
    valueString: domain,
    instanceType: "ExtensionAttribute",
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/*
 * Type guards for the objects CRF Studio writes into its own USDM extensions
 * and for a legacy study's `forms` (#3676). Each checks the value as it is and
 * keeps it unchanged. An extension that does not match its shape is ignored,
 * and the plain USDM is read instead, as for a document CRF Studio did not
 * write. A legacy form that does not match is skipped.
 *
 * The guards check structure, not conformance. A field whose variable name is
 * too long is still a field: the import's pre-flight conformance gate reports
 * it and offers to fix it, so dropping it here would hide what the gate is
 * for.
 */
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const optionalOf = (
  record: Record<string, unknown>,
  key: string,
  guard: (value: unknown) => boolean
) => record[key] === undefined || guard(record[key]);
const isString = (value: unknown) => typeof value === "string";
const isNumber = (value: unknown) => typeof value === "number";
const isBoolean = (value: unknown) => typeof value === "boolean";
const ENCOUNTER_TYPES = new Set(["Scheduled", "Unscheduled", "Common"]);
/** An array whose every item is an object with a string id. */
const isIdentifiedRecords = (value: unknown) =>
  Array.isArray(value) && value.every((item) => isString(asRecord(item)?.id));
/** CRF sections: identified, with a title and an array of fields. */
const isCrfSectionsShape = (value: unknown) =>
  isIdentifiedRecords(value) &&
  (value as unknown[]).every((item) => {
    const section = asRecord(item)!;
    return (
      optionalOf(section, "title", isString) &&
      optionalOf(section, "fields", isIdentifiedRecords)
    );
  });

function isUsdmEncounter(value: unknown): value is UsdmEncounter {
  const record = asRecord(value);
  return (
    record !== undefined &&
    isString(record.id) &&
    isString(record.name) &&
    ENCOUNTER_TYPES.has(String(record.type)) &&
    isNumber(record.targetDay) &&
    isNumber(record.windowBefore) &&
    isNumber(record.windowAfter) &&
    optionalOf(record, "oid", isString) &&
    optionalOf(record, "timepointDays", isNumber) &&
    optionalOf(record, "epochId", isString) &&
    optionalOf(record, "armIds", isStringArray) &&
    optionalOf(record, "assignedFormIds", isStringArray) &&
    optionalOf(
      record,
      "armFormAssignments",
      (assignments) =>
        asRecord(assignments) !== undefined &&
        Object.values(asRecord(assignments)!).every(isStringArray)
    ) &&
    optionalOf(record, "isRepeating", isBoolean) &&
    optionalOf(record, "repeatMax", isNumber)
  );
}

function isUsdmActivity(value: unknown): value is UsdmActivity {
  const record = asRecord(value);
  return (
    record !== undefined &&
    isString(record.id) &&
    isString(record.name) &&
    isString(record.domain) &&
    optionalOf(record, "description", isString) &&
    optionalOf(record, "version", isString) &&
    optionalOf(record, "sections", isCrfSectionsShape) &&
    optionalOf(record, "rules", isIdentifiedRecords) &&
    optionalOf(record, "isLogForm", isBoolean)
  );
}

function isUsdmBiomedicalConcept(
  value: unknown
): value is UsdmBiomedicalConcept {
  const record = asRecord(value);
  return (
    record !== undefined &&
    isString(record.id) &&
    isString(record.name) &&
    [
      "conceptId",
      "code",
      "domain",
      "variableName",
      "dataType",
      "label",
      "unit",
    ].every((key) => optionalOf(record, key, isString)) &&
    optionalOf(record, "synonyms", isStringArray) &&
    optionalOf(
      record,
      "properties",
      (properties) =>
        Array.isArray(properties) || asRecord(properties) !== undefined
    )
  );
}

/**
 * A legacy study's `forms` read as activities: CRF forms, which carry what an
 * activity does, with a missing domain read as GENERAL as the import does.
 * Undefined when the study has no `forms` array.
 */
function legacyFormActivities(forms: unknown): UsdmActivity[] | undefined {
  if (!Array.isArray(forms)) return undefined;
  return forms.flatMap((form) => {
    const record = asRecord(form);
    if (!record) return [];
    const activity = {
      ...record,
      domain: asString(record.domain) ?? "GENERAL",
    };
    return isUsdmActivity(activity) ? [activity] : [];
  });
}

function findExtension(
  owner: unknown,
  url: string
): Record<string, unknown> | undefined {
  return asArray(asRecord(owner)?.extensionAttributes)
    .map(asRecord)
    .find((ext) => ext?.url === url);
}

/** Reads a CRF Studio extension payload, or `undefined` when absent or unreadable. */
function readCrfExtension(
  owner: unknown,
  kind: string
): Record<string, unknown> | undefined {
  const ext = findExtension(owner, `${CRF_STUDIO_USDM_EXTENSION_BASE}${kind}`);
  const raw = asString(ext?.valueString);
  if (raw === undefined) return undefined;
  try {
    return asRecord(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

/**
 * Reads the SDTM domain code an activity declares through the
 * `USDM_SDTM_DOMAIN_EXTENSION_URL` extension attribute, if any.
 */
export function getUsdmV4ActivityDomain(activity: unknown): string | undefined {
  return getUsdmV4ExtensionString(activity, USDM_SDTM_DOMAIN_EXTENSION_URL);
}

/** Drops `undefined` members the same way `JSON.stringify` does. */
function withoutUndefined<T extends object>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

function linkSequence<T extends { id: string }>(
  items: T[]
): (T & { previousId: string | null; nextId: string | null })[] {
  return items.map((item, idx) => ({
    ...item,
    previousId: idx > 0 ? items[idx - 1].id : null,
    nextId: idx < items.length - 1 ? items[idx + 1].id : null,
  }));
}

function isNciCode(value: string | undefined): value is string {
  return typeof value === "string" && /^C\d+$/.test(value);
}

function epochTypeCode(id: string, label: string | undefined): UsdmV4Code {
  const key = (label ?? "").toLowerCase().replace(/[^a-z]/g, "");
  const match = Object.keys(EPOCH_TYPE_CT).find((k) => key.includes(k));
  return match
    ? v4Code(id, EPOCH_TYPE_CT[match][0], EPOCH_TYPE_CT[match][1])
    : ctCodeFor(id, {}, label);
}

function liftBiomedicalConcept(
  bc: UsdmBiomedicalConcept
): UsdmV4BiomedicalConcept {
  const codeValue = bc.code || bc.conceptId || bc.id;
  const nci = isNciCode(codeValue);
  return {
    id: bc.id,
    name: bc.name,
    label: bc.label ?? null,
    // A synonym that repeats the label adds nothing (CORE-001006), so it is
    // dropped here; the legacy list survives in the extension.
    synonyms: (bc.synonyms || []).filter(
      (s): s is string =>
        typeof s === "string" &&
        s.toLowerCase() !== (bc.label ?? "").toLowerCase()
    ),
    reference: nci
      ? `https://evsexplore.semantics.cancer.gov/evsexplore/concept/ncit/${codeValue}`
      : `${CRF_STUDIO_CODE_SYSTEM}/biomedical-concepts/${bc.id}`,
    properties: [],
    code: v4AliasCode(
      `${bc.id}__code`,
      v4Code(
        `${bc.id}__code_std`,
        codeValue,
        // A code is decoded by the concept's name, which is unique among
        // the study's concepts (CORE-000427); the label is how a form asks
        // for it, such as "Age at Informed Consent" for Age.
        bc.name || bc.label || codeValue,
        nci ? CDISC_CT_SYSTEM : CRF_STUDIO_CODE_SYSTEM
      )
    ),
    extensionAttributes: [
      crfExtension(bc.id, "biomedical-concept", withoutUndefined({ ...bc })),
    ],
    instanceType: "BiomedicalConcept",
  };
}

function buildMainTimeline(
  design: UsdmStudyDesign,
  epochIds: Set<string>
): UsdmV4ScheduleTimeline[] {
  const encounters = design.encounters || [];
  if (encounters.length === 0) return [];
  const dayOf = (enc: UsdmEncounter) =>
    typeof enc.targetDay === "number" && Number.isFinite(enc.targetDay)
      ? enc.targetDay
      : 0;
  // Unscheduled encounters have no planned timing, so they get none.
  const planned = encounters.filter((enc) => enc.type !== "Unscheduled");
  const anchor = planned.reduce<UsdmEncounter | undefined>(
    (best, enc) =>
      !best || Math.abs(dayOf(enc) - 1) < Math.abs(dayOf(best) - 1)
        ? enc
        : best,
    undefined
  );
  const exitId = `${design.id}__timeline_exit`;
  const instanceId = (enc: UsdmEncounter) => `${enc.id}__sai`;
  const timingFor = (
    enc: UsdmEncounter,
    anchor: UsdmEncounter
  ): UsdmV4Timing => {
    const isAnchor = enc === anchor;
    const distance = studyDayDistance(dayOf(anchor), dayOf(enc));
    const typeId = `${enc.id}__timing_type`;
    const type = isAnchor
      ? v4Code(typeId, USDM_TIMING_FIXED_REFERENCE, "Fixed Reference")
      : distance < 0
        ? v4Code(typeId, USDM_TIMING_BEFORE, "Before")
        : v4Code(typeId, USDM_TIMING_AFTER, "After");
    const windowBefore = Math.abs(enc.windowBefore || 0);
    const windowAfter = Math.abs(enc.windowAfter || 0);
    return {
      id: `${enc.id}__timing`,
      name: `Timing for ${enc.name || enc.id}`,
      label: null,
      description: null,
      type,
      value: formatIsoDurationDays(isAnchor ? 0 : distance),
      valueLabel: `Day ${dayOf(enc)}`,
      relativeToFrom: v4Code(
        `${enc.id}__timing_rel`,
        "C201355",
        "Start to Start"
      ),
      relativeFromScheduledInstanceId: instanceId(enc),
      relativeToScheduledInstanceId: isAnchor ? null : instanceId(anchor),
      // The anchor is the fixed reference every other visit is timed from,
      // so it takes no window (CORE-000417).
      windowLower: isAnchor ? null : formatIsoDurationDays(windowBefore),
      windowUpper: isAnchor ? null : formatIsoDurationDays(windowAfter),
      windowLabel: isAnchor ? null : `-${windowBefore}/+${windowAfter} days`,
      instanceType: "Timing",
    };
  };
  const timings: UsdmV4Timing[] = anchor
    ? planned.map((enc) => timingFor(enc, anchor))
    : [];
  // Every instance in the main timeline names an epoch (CORE-000870). An
  // encounter without one, such as an unscheduled visit, falls in the epoch
  // of the visit before it, or of the first visit when it comes first.
  const epochOf = (enc: UsdmEncounter) =>
    enc.epochId && epochIds.has(enc.epochId) ? enc.epochId : null;
  const firstEpoch = encounters.map(epochOf).find((id) => id !== null) ?? null;
  let carried = firstEpoch;
  const instanceEpochs = encounters.map((enc) => {
    carried = epochOf(enc) ?? carried;
    return carried;
  });
  const days = planned.map(dayOf);
  const span = days.length > 0 ? Math.max(...days) - Math.min(...days) : 0;
  return [
    {
      id: `${design.id}__timeline`,
      name: "Main timeline",
      label: null,
      description: "Schedule of activities exported from CRF Studio",
      mainTimeline: true,
      entryCondition: "Subject has given informed consent",
      entryId: instanceId(encounters[0]),
      exits: [{ id: exitId, instanceType: "ScheduleTimelineExit" }],
      timings,
      // The planned span from the first to the last scheduled visit
      // (CORE-001016).
      plannedDuration: {
        id: `${design.id}__timeline_duration`,
        text: `${span} days`,
        quantity: {
          id: `${design.id}__timeline_duration_quantity`,
          value: span,
          unit: v4AliasCode(
            `${design.id}__timeline_duration_unit`,
            v4Code(`${design.id}__timeline_duration_unit_std`, "C25301", "Day")
          ),
          instanceType: "Quantity",
        },
        durationWillVary: false,
        reasonDurationWillVary: null,
        instanceType: "Duration",
      },
      // Each instance leads to the next by its default condition, so the
      // timeline orders the encounters as their next chain does
      // (CORE-000961, CORE-001048).
      instances: encounters.map((enc, idx) => ({
        id: instanceId(enc),
        name: enc.name || enc.id,
        label: null,
        description: null,
        defaultConditionId:
          idx < encounters.length - 1 ? instanceId(encounters[idx + 1]) : null,
        epochId: instanceEpochs[idx],
        timelineId: null,
        timelineExitId: idx === encounters.length - 1 ? exitId : null,
        activityIds: [...(enc.assignedFormIds || [])],
        encounterId: enc.id,
        instanceType: "ScheduledActivityInstance",
      })),
      instanceType: "ScheduleTimeline",
    },
  ];
}

function buildStudyCells(design: UsdmStudyDesign, epochIds: Set<string>) {
  const elements: UsdmV4StudyElement[] = [];
  const studyCells: UsdmV4StudyCell[] = [];
  for (const arm of design.arms) {
    const armEpochs =
      arm.epochIds && arm.epochIds.length > 0
        ? arm.epochIds.filter((id) => epochIds.has(id))
        : design.epochs.map((e) => e.id);
    for (const epochId of armEpochs) {
      const elementId = `${arm.id}__${epochId}__element`;
      const epoch = design.epochs.find((e) => e.id === epochId);
      const epochName = epoch?.name || epochId;
      // An arm's treatment element names the interventions the arm receives.
      const isTreatment = /treat/i.test(epoch?.type ?? epochName);
      elements.push({
        id: elementId,
        name: `${arm.name || arm.id} - ${epochName}`,
        label: null,
        description: null,
        studyInterventionIds: isTreatment
          ? (design.interventions ?? [])
              .filter((i) => !i.armIds || i.armIds.includes(arm.id))
              .map((i) => i.id)
          : [],
        instanceType: "StudyElement",
      });
      studyCells.push({
        id: `${arm.id}__${epochId}__cell`,
        armId: arm.id,
        epochId,
        elementIds: [elementId],
        instanceType: "StudyCell",
      });
    }
  }
  return { elements, studyCells };
}

const PLANNED_SEX_CT: Record<StudyPlannedSex, [string, string]> = {
  Female: ["C16576", "Female"],
  Male: ["C20197", "Male"],
};

const CRITERION_CATEGORY_CT: Record<
  StudyEligibilityCriterion["category"],
  [string, string]
> = {
  Inclusion: ["C25532", "Inclusion Criteria"],
  Exclusion: ["C25370", "Exclusion Criteria"],
};

const OBJECTIVE_LEVEL_CT: Record<StudyObjectiveLevel, [string, string]> = {
  Primary: ["C85826", "Primary Objective"],
  Secondary: ["C85827", "Secondary Objective"],
  Exploratory: ["C163559", "Exploratory Objective"],
};

const ENDPOINT_LEVEL_CT: Record<StudyObjectiveLevel, [string, string]> = {
  Primary: ["C94496", "Primary Endpoint"],
  Secondary: ["C139173", "Secondary Endpoint"],
  Exploratory: ["C170559", "Exploratory Endpoint"],
};

const INTERVENTION_ROLE_CT: Record<StudyInterventionRole, [string, string]> = {
  "Experimental Intervention": ["C41161", "Experimental Intervention"],
  "Active Comparator": ["C68609", "Active Comparator"],
  Placebo: ["C753", "Placebo"],
};

const INTERVENTION_TYPE_CT: Record<StudyInterventionType, [string, string]> = {
  Drug: ["C1909", "Pharmacologic Substance"],
  Biologic: ["C307", "Biological Agent"],
  Device: ["C16830", "Medical Device"],
};

const AGE_UNIT_YEAR: [string, string] = ["C29848", "Year"];

/** The NCI Thesaurus, for procedure concepts. */
const NCIT_SYSTEM = "http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl";
const NCIT_VERSION = "26.09d";

const MEDICATION_ADMINISTRATION = {
  name: "Medication Administration",
  code: "C128534",
};

/** The key of the table entry whose CT code a USDM code carries. */
function ctKey<K extends string>(
  table: Record<K, [string, string]>,
  code: unknown
): K | undefined {
  const value = asString(asRecord(code)?.code);
  return (Object.keys(table) as K[]).find((key) => table[key][0] === value);
}

function liftPopulation(
  design: UsdmStudyDesign,
  cohorts: UsdmV4StudyCohort[]
): UsdmV4StudyDesignPopulation {
  const id = `${design.id}__population`;
  const plan = design.population;
  const age = plan?.plannedAgeYears;
  const criterionIds = (design.eligibilityCriteria ?? []).map((c) => c.id);
  const yearsQuantity = (suffix: string, value: number) => ({
    id: `${id}__age_${suffix}`,
    value,
    unit: v4AliasCode(
      `${id}__age_${suffix}_unit`,
      v4Code(`${id}__age_${suffix}_unit_std`, ...AGE_UNIT_YEAR)
    ),
    instanceType: "Quantity" as const,
  });
  return {
    id,
    name: "Study population",
    label: null,
    description: plan?.description ?? null,
    includesHealthySubjects: plan?.includesHealthySubjects ?? false,
    ...(plan?.plannedSex?.length
      ? {
          plannedSex: plan.plannedSex.map((sex) =>
            v4Code(`${id}__sex_${sex.toLowerCase()}`, ...PLANNED_SEX_CT[sex])
          ),
        }
      : {}),
    ...(age
      ? {
          plannedAge: {
            id: `${id}__age`,
            minValue: yearsQuantity("min", age.min),
            maxValue: yearsQuantity("max", age.max),
            isApproximate: false,
            instanceType: "Range" as const,
          },
        }
      : {}),
    ...(criterionIds.length > 0 ? { criterionIds } : {}),
    cohorts,
    ...(plan
      ? {
          extensionAttributes: [
            crfExtension(id, "population", withoutUndefined({ ...plan })),
          ],
        }
      : {}),
    instanceType: "StudyDesignPopulation",
  };
}

/**
 * The design's eligibility criteria and the study version's criterion
 * items. Each category numbers its criteria from 01, as a protocol does.
 */
function liftEligibility(design: UsdmStudyDesign): {
  criteria: UsdmV4EligibilityCriterion[];
  items: UsdmV4EligibilityCriterionItem[];
} {
  const list = design.eligibilityCriteria ?? [];
  const counts = { Inclusion: 0, Exclusion: 0 };
  const criteria = linkSequence(
    list.map((criterion) => {
      counts[criterion.category] += 1;
      const identifier = String(counts[criterion.category]).padStart(2, "0");
      const prefix = criterion.category === "Inclusion" ? "INC" : "EXC";
      return {
        id: criterion.id,
        name: `${prefix}${identifier}`,
        label: null,
        description: null,
        category: v4Code(
          `${criterion.id}__category`,
          ...CRITERION_CATEGORY_CT[criterion.category]
        ),
        identifier,
        criterionItemId: `${criterion.id}__item`,
        instanceType: "EligibilityCriterion" as const,
      };
    })
  );
  const items = list.map((criterion) => ({
    id: `${criterion.id}__item`,
    name: criterion.name,
    label: null,
    description: null,
    text: criterion.text,
    instanceType: "EligibilityCriterionItem" as const,
  }));
  return { criteria, items };
}

function liftObjectives(design: UsdmStudyDesign): UsdmV4Objective[] {
  return (design.objectives ?? []).map((objective) => ({
    id: objective.id,
    name: objective.name,
    label: null,
    description: null,
    text: objective.text,
    level: v4Code(
      `${objective.id}__level`,
      ...OBJECTIVE_LEVEL_CT[objective.level]
    ),
    endpoints: objective.endpoints.map((endpoint) => ({
      id: endpoint.id,
      name: endpoint.name,
      label: null,
      description: null,
      text: endpoint.text,
      purpose: endpoint.purpose,
      level: v4Code(
        `${endpoint.id}__level`,
        ...ENDPOINT_LEVEL_CT[endpoint.level]
      ),
      instanceType: "Endpoint" as const,
    })),
    instanceType: "Objective",
  }));
}

function liftInterventions(design: UsdmStudyDesign): UsdmV4StudyIntervention[] {
  return (design.interventions ?? []).map((intervention) => ({
    id: intervention.id,
    name: intervention.name,
    label: null,
    description: intervention.description ?? null,
    role: v4Code(
      `${intervention.id}__role`,
      ...INTERVENTION_ROLE_CT[intervention.role]
    ),
    type: v4Code(
      `${intervention.id}__type`,
      ...INTERVENTION_TYPE_CT[intervention.type]
    ),
    codes: [],
    extensionAttributes: [
      crfExtension(
        intervention.id,
        "intervention",
        withoutUndefined({
          armIds: intervention.armIds,
          administrationFormIds: intervention.administrationFormIds,
          procedure: intervention.procedure,
        })
      ),
    ],
    instanceType: "StudyIntervention",
  }));
}

/**
 * One procedure for each intervention a form records the giving of, so the
 * activity names what it gives (CORE-001065).
 */
function administrationProcedures(
  activityId: string,
  interventions: StudyInterventionPlan[]
): UsdmV4Procedure[] {
  return interventions
    .filter((i) => i.administrationFormIds?.includes(activityId))
    .map((intervention) => {
      const procedure = intervention.procedure ?? MEDICATION_ADMINISTRATION;
      const id = `${activityId}__admin_${intervention.id}`;
      return {
        id,
        name: `Administer ${intervention.name}`,
        label: null,
        description: null,
        procedureType: procedure.name,
        code: {
          id: `${id}__code`,
          code: procedure.code,
          codeSystem: NCIT_SYSTEM,
          codeSystemVersion: NCIT_VERSION,
          decode: procedure.name,
          instanceType: "Code",
        },
        studyInterventionId: intervention.id,
        instanceType: "Procedure",
      };
    });
}

function liftDesign(design: UsdmStudyDesign, phaseLabel: string | undefined) {
  const epochIds = new Set(design.epochs.map((e) => e.id));

  const arms: UsdmV4StudyArm[] = design.arms.map((arm) => ({
    id: arm.id,
    name: arm.name,
    label: null,
    description: arm.description ?? null,
    type: ctCodeFor(`${arm.id}__type`, ARM_TYPE_CT, arm.type),
    dataOriginDescription: "Data collected in this study",
    dataOriginType: v4Code(
      `${arm.id}__origin`,
      "C188866",
      "Data Generated Within Study"
    ),
    populationIds: [],
    extensionAttributes: [
      crfExtension(
        arm.id,
        "arm",
        withoutUndefined({ type: arm.type, epochIds: arm.epochIds })
      ),
    ],
    instanceType: "StudyArm",
  }));

  const epochs: UsdmV4StudyEpoch[] = linkSequence(
    design.epochs.map((epoch) => ({
      id: epoch.id,
      name: epoch.name,
      label: null,
      description: epoch.description ?? null,
      type: epochTypeCode(`${epoch.id}__type`, epoch.type ?? epoch.name),
      extensionAttributes: [
        crfExtension(
          epoch.id,
          "epoch",
          withoutUndefined({
            sequenceNumber: epoch.sequenceNumber,
            type: epoch.type,
          })
        ),
      ],
      instanceType: "StudyEpoch" as const,
    }))
  );

  const cohorts: UsdmV4StudyCohort[] = (design.cohorts || []).map((c) => ({
    id: c.id,
    name: c.name,
    label: null,
    description: c.description ?? null,
    includesHealthySubjects: false,
    plannedEnrollmentNumber:
      typeof c.targetSize === "number" && Number.isFinite(c.targetSize)
        ? {
            id: `${c.id}__planned`,
            value: c.targetSize,
            unit: null,
            instanceType: "Quantity",
          }
        : null,
    extensionAttributes: [
      crfExtension(
        c.id,
        "cohort",
        withoutUndefined({ armIds: c.armIds, targetSize: c.targetSize })
      ),
    ],
    instanceType: "StudyCohort",
  }));

  const encounters: UsdmV4Encounter[] = linkSequence(
    design.encounters.map((enc) => ({
      id: enc.id,
      name: enc.name,
      label: null,
      description: null,
      type: v4Code(`${enc.id}__type`, "C25716", "Visit"),
      scheduledAtId: null,
      environmentalSettings: [],
      contactModes: [],
      extensionAttributes: [
        crfExtension(
          enc.id,
          "encounter",
          withoutUndefined({
            oid: enc.oid,
            type: enc.type,
            targetDay: enc.targetDay,
            timepointDays: enc.timepointDays,
            windowBefore: enc.windowBefore,
            windowAfter: enc.windowAfter,
            epochId: enc.epochId,
            armIds: enc.armIds,
            assignedFormIds: enc.assignedFormIds,
            armFormAssignments: enc.armFormAssignments,
            isRepeating: enc.isRepeating,
            repeatMax: enc.repeatMax,
          })
        ),
      ],
      instanceType: "Encounter" as const,
    }))
  );

  const activities: UsdmV4Activity[] = linkSequence(
    design.activities.map((act) => {
      const conceptIds = new Set<string>();
      (act.sections || []).forEach((sec) =>
        (sec.fields || []).forEach((fld) => {
          if (fld.conceptId) conceptIds.add(fld.conceptId);
        })
      );
      return {
        id: act.id,
        name: act.name,
        label: null,
        description: act.description ?? null,
        childIds: [],
        definedProcedures: administrationProcedures(
          act.id,
          design.interventions ?? []
        ),
        biomedicalConceptIds: [...conceptIds],
        bcCategoryIds: [],
        bcSurrogateIds: [],
        timelineId: null,
        extensionAttributes: [
          sdtmDomainExtension(act.id, act.domain),
          crfExtension(
            act.id,
            "activity",
            withoutUndefined({
              domain: act.domain,
              description: act.description,
              version: act.version,
              sections: act.sections,
              rules: act.rules,
              isLogForm: act.isLogForm,
            })
          ),
        ],
        instanceType: "Activity" as const,
      };
    })
  );

  const phase = phaseLabel ? PHASE_CT[phaseLabel] : undefined;
  const { elements, studyCells } = buildStudyCells(design, epochIds);
  const v4Design: UsdmV4InterventionalStudyDesign = {
    id: design.id,
    name: design.name,
    label: null,
    description: null,
    studyType: v4Code(
      `${design.id}__study_type`,
      "C98388",
      "Interventional Study"
    ),
    studyPhase: phase
      ? v4AliasCode(
          `${design.id}__phase`,
          v4Code(`${design.id}__phase_std`, phase[0], phase[1])
        )
      : null,
    therapeuticAreas: [],
    characteristics: [],
    encounters,
    activities,
    arms,
    studyCells,
    rationale: "Study design exported from CRF Studio",
    epochs,
    elements,
    estimands: [],
    studyInterventionIds: (design.interventions ?? []).map((i) => i.id),
    objectives: liftObjectives(design),
    population: liftPopulation(design, cohorts),
    scheduleTimelines: buildMainTimeline(design, epochIds),
    eligibilityCriteria: liftEligibility(design).criteria,
    analysisPopulations: [],
    // One arm is a single group; more are parallel groups (CORE-001077
    // expects a parallel design to reference more than one intervention).
    model:
      design.arms.length > 1
        ? v4Code(`${design.id}__model`, "C82639", "Parallel Study")
        : v4Code(`${design.id}__model`, "C82640", "Single Group Study"),
    instanceType: "InterventionalStudyDesign",
  };
  return v4Design;
}

/**
 * Lifts the legacy (pre-v4) USDM graph into a USDM v4.0 document. Every
 * legacy value that has no USDM v4 property is kept in a CRF Studio
 * extension attribute on the object it belongs to, so `lowerUsdmV4ToLegacy`
 * restores the legacy graph exactly.
 */
function liftLegacyToUsdmV4(legacy: UsdmDocument): UsdmV4Document {
  const study = legacy.study;
  const design: UsdmStudyDesign = (study.studyDesigns || [])[0] || {
    id: "design_main",
    name: "Main Study Design",
    arms: [],
    epochs: [],
    cohorts: [],
    encounters: [],
    activities: [],
    biomedicalConcepts: [],
  };
  const sponsorOrgId = "org_sponsor";
  const protocolNumber =
    study.protocolNumber || study.name || study.id || "CRF-STUDY";

  return {
    usdmVersion: USDM_V4_VERSION,
    systemName: "CRF Studio (deruiter.dev)",
    systemVersion: "1.0.0",
    study: {
      id: null,
      name: study.name || protocolNumber,
      label: study.title ?? null,
      description: null,
      extensionAttributes: [
        crfExtension(
          "study",
          "study",
          withoutUndefined({
            id: study.id,
            name: study.name,
            title: study.title,
            protocolNumber: study.protocolNumber,
            protocolId: study.protocolId,
            phase: study.phase,
            sponsor: study.sponsor,
            therapeuticArea: study.therapeuticArea,
            version: study.version,
            lastModified: study.lastModified,
            codeLists: study.codeLists,
            valueSets: study.valueSets,
            rules: study.rules,
            simulationState: study.simulationState,
            provenance: study.provenance,
            design: {
              codeLists: design.codeLists,
              valueSets: design.valueSets,
              rules: design.rules,
              scheduleRules: design.scheduleRules,
            },
          })
        ),
      ],
      versions: [
        {
          id: "study_version_1",
          versionIdentifier: study.version || "1.0",
          rationale: "Exported from CRF Studio",
          studyIdentifiers: [
            {
              id: "study_identifier_sponsor",
              text: protocolNumber,
              scopeId: sponsorOrgId,
              instanceType: "StudyIdentifier",
            },
          ],
          titles: [
            {
              id: "study_title_official",
              text: study.title || protocolNumber,
              type: v4Code(
                "study_title_official__type",
                "C207616",
                "Official Study Title"
              ),
              instanceType: "StudyTitle",
            },
          ],
          organizations: [
            {
              id: sponsorOrgId,
              name: study.sponsor || "Clinical Sponsor",
              label: null,
              type: v4Code(
                `${sponsorOrgId}__type`,
                "C70793",
                "Clinical Study Sponsor"
              ),
              identifierScheme: "Sponsor",
              identifier: protocolNumber,
              instanceType: "Organization",
            },
          ],
          // The sponsor role names the organization the sponsor identifier
          // is scoped to (CORE-000973, CORE-001054).
          roles: [
            {
              id: "study_role_sponsor",
              name: "Sponsor",
              label: null,
              description: null,
              code: v4Code(
                "study_role_sponsor__code",
                "C70793",
                "Clinical Study Sponsor"
              ),
              appliesToIds: ["study_version_1"],
              organizationIds: [sponsorOrgId],
              masking: null,
              instanceType: "StudyRole",
            },
          ],
          ...(design.interventions?.length
            ? { studyInterventions: liftInterventions(design) }
            : {}),
          ...(design.eligibilityCriteria?.length
            ? { eligibilityCriterionItems: liftEligibility(design).items }
            : {}),
          biomedicalConcepts: (design.biomedicalConcepts || []).map(
            liftBiomedicalConcept
          ),
          studyDesigns: [liftDesign(design, study.phase)],
          instanceType: "StudyVersion",
        },
      ],
      instanceType: "Study",
    },
  };
}

/**
 * Says which USDM generation a parsed document belongs to: `"4"` for a
 * USDM v4 Wrapper (a `usdmVersion` of 4.x, or a study holding `versions`),
 * otherwise `"3"`, which covers CRF Studio's pre-v4 graph and other flat
 * USDM-like JSON.
 */
export function getUsdmDocumentVersion(doc: unknown): "3" | "4" {
  const record = asRecord(doc);
  if (!record) return "3";
  const usdmVersion = asString(record.usdmVersion);
  if (usdmVersion && /^4(\.|$)/.test(usdmVersion)) return "4";
  const study = asRecord(record.study);
  return study &&
    study.instanceType === "Study" &&
    Array.isArray(study.versions)
    ? "4"
    : "3";
}

function nativeName(
  obj: Record<string, unknown> | undefined,
  fallback: string
) {
  return asString(obj?.name) ?? fallback;
}

function nativeDescription(obj: Record<string, unknown> | undefined) {
  return asString(obj?.description) ?? undefined;
}

function codeDecode(code: unknown): string | undefined {
  const rec = asRecord(code);
  return asString(rec?.decode) ?? asString(asRecord(rec?.standardCode)?.decode);
}

function records(value: unknown): Record<string, unknown>[] {
  return asArray(value)
    .map(asRecord)
    .filter((r): r is Record<string, unknown> => Boolean(r));
}

/** A level from its CT code, or from the words of its decode. */
function lowerLevel(
  table: Record<StudyObjectiveLevel, [string, string]>,
  code: unknown
): StudyObjectiveLevel {
  const decode = codeDecode(code) ?? "";
  return (
    ctKey(table, code) ??
    (/secondary/i.test(decode)
      ? "Secondary"
      : /exploratory/i.test(decode)
        ? "Exploratory"
        : "Primary")
  );
}

/**
 * Reads the planned population, eligibility criteria, objectives and study
 * interventions back from native USDM v4 properties. CRF Studio extension
 * payloads restore what USDM does not hold, such as which forms record an
 * intervention being given.
 */
function lowerProtocolContent(
  version: Record<string, unknown>,
  design: Record<string, unknown>
): Pick<
  UsdmStudyDesign,
  "population" | "eligibilityCriteria" | "objectives" | "interventions"
> {
  const populationRecord = asRecord(design.population);
  const populationExt = readCrfExtension(populationRecord, "population");
  let population: StudyPopulationPlan | undefined;
  if (populationExt) {
    population = populationExt as StudyPopulationPlan;
  } else if (populationRecord) {
    const plannedSex = asArray(populationRecord.plannedSex)
      .map((code) => ctKey(PLANNED_SEX_CT, code))
      .filter((sex): sex is StudyPlannedSex => Boolean(sex));
    const age = asRecord(populationRecord.plannedAge);
    const min = asRecord(age?.minValue)?.value;
    const max = asRecord(age?.maxValue)?.value;
    const plan: StudyPopulationPlan = withoutUndefined({
      description: nativeDescription(populationRecord),
      plannedSex: plannedSex.length > 0 ? plannedSex : undefined,
      plannedAgeYears:
        typeof min === "number" && typeof max === "number"
          ? { min, max }
          : undefined,
      includesHealthySubjects:
        populationRecord.includesHealthySubjects === true ? true : undefined,
    });
    population = Object.keys(plan).length > 0 ? plan : undefined;
  }

  const items = new Map(
    records(version.eligibilityCriterionItems).map((item) => [
      asString(item.id),
      item,
    ])
  );
  const eligibilityCriteria: StudyEligibilityCriterion[] = records(
    design.eligibilityCriteria
  ).flatMap((criterion, idx) => {
    const item = items.get(asString(criterion.criterionItemId));
    const text = asString(item?.text);
    if (!text) return [];
    const id = asString(criterion.id) ?? `criterion_${idx + 1}`;
    return [
      {
        id,
        category:
          ctKey(CRITERION_CATEGORY_CT, criterion.category) ??
          (/exclu/i.test(codeDecode(criterion.category) ?? "")
            ? "Exclusion"
            : "Inclusion"),
        name: nativeName(item, nativeName(criterion, id)),
        text,
      },
    ];
  });

  const objectives: StudyObjective[] = records(design.objectives).map(
    (objective, idx) => {
      const id = asString(objective.id) ?? `objective_${idx + 1}`;
      return {
        id,
        level: lowerLevel(OBJECTIVE_LEVEL_CT, objective.level),
        name: nativeName(objective, id),
        text: asString(objective.text) ?? "",
        endpoints: records(objective.endpoints).map((endpoint, eIdx) => {
          const endpointId =
            asString(endpoint.id) ?? `${id}_endpoint_${eIdx + 1}`;
          return {
            id: endpointId,
            level: lowerLevel(ENDPOINT_LEVEL_CT, endpoint.level),
            name: nativeName(endpoint, endpointId),
            text: asString(endpoint.text) ?? "",
            purpose: asString(endpoint.purpose) ?? "",
          };
        }),
      };
    }
  );

  const procedures = records(design.activities).flatMap((activity) =>
    records(activity.definedProcedures).map((procedure) => ({
      activityId: asString(activity.id),
      procedure,
    }))
  );
  const interventions: StudyInterventionPlan[] = records(
    version.studyInterventions
  ).map((intervention, idx) => {
    const id = asString(intervention.id) ?? `intervention_${idx + 1}`;
    const ext = readCrfExtension(intervention, "intervention");
    const given = procedures.filter(
      (p) => asString(p.procedure.studyInterventionId) === id
    );
    const givenCode = asRecord(given[0]?.procedure.code);
    return withoutUndefined({
      id,
      name: nativeName(intervention, id),
      description: nativeDescription(intervention),
      role:
        ctKey(INTERVENTION_ROLE_CT, intervention.role) ??
        "Experimental Intervention",
      type: ctKey(INTERVENTION_TYPE_CT, intervention.type) ?? "Drug",
      ...(ext
        ? (ext as Pick<
            StudyInterventionPlan,
            "armIds" | "administrationFormIds" | "procedure"
          >)
        : {
            administrationFormIds:
              given.length > 0
                ? given
                    .map((p) => p.activityId)
                    .filter((a): a is string => Boolean(a))
                : undefined,
            procedure:
              givenCode &&
              asString(givenCode.code) !== MEDICATION_ADMINISTRATION.code
                ? {
                    name:
                      asString(given[0].procedure.procedureType) ??
                      codeDecode(givenCode) ??
                      "",
                    code: asString(givenCode.code) ?? "",
                  }
                : undefined,
          }),
    });
  });

  return withoutUndefined({
    population,
    eligibilityCriteria:
      eligibilityCriteria.length > 0 ? eligibilityCriteria : undefined,
    objectives: objectives.length > 0 ? objectives : undefined,
    interventions: interventions.length > 0 ? interventions : undefined,
  });
}

/**
 * Lowers a USDM v4 document into the legacy graph the v3 reader consumes.
 * CRF Studio extension payloads restore their objects exactly; documents
 * from other tools are read from native USDM v4 properties, with visit days
 * and windows resolved from the main schedule timeline.
 */
/**
 * What a plain USDM biomedical concept says about the item that collects it:
 * the SDTM test code (or a CDASH-style synonym) as the variable name, the
 * standard unit, and a data type inferred from those, since USDM carries no
 * form layout. A concept with a unit is numeric; a variable ending DAT, DTC
 * or DTM is a date; anything else is text.
 */
function plainConceptItem(bc: Record<string, unknown>, id: string) {
  const testCode = getUsdmV4ExtensionString(bc, USDM_SDTM_TESTCD_EXTENSION_URL);
  const synonym = asArray(bc.synonyms).find(
    (s): s is string => typeof s === "string" && /^[A-Z][A-Z0-9]{0,7}$/.test(s)
  );
  const variableName = testCode ?? synonym;
  const unit = getUsdmV4ExtensionString(bc, USDM_SDTM_STRESU_EXTENSION_URL);
  const dataType: ClinicalDataType = unit
    ? "number"
    : variableName && /(DAT|DTC|DTM)$/.test(variableName)
      ? "date"
      : "text";
  return {
    variableName: variableName ?? id.toUpperCase(),
    unit,
    dataType,
  };
}

/**
 * Builds a form for a plain USDM activity (one written without CRF Studio's
 * extensions) from the biomedical concepts it collects: one section, one
 * item per concept, in the activity's order. An activity that names no
 * concepts, such as one described only by a surrogate, gets no sections.
 */
function plainActivitySections(
  activity: Record<string, unknown>,
  concepts: Map<string, Record<string, unknown>>
): CRFSection[] | undefined {
  const fields: CRFField[] = asArray(activity.biomedicalConceptIds)
    .filter((id): id is string => typeof id === "string")
    .flatMap((conceptId) => {
      const bc = concepts.get(conceptId);
      if (!bc) return [];
      const item = plainConceptItem(bc, conceptId);
      return [
        withoutUndefined({
          id: `${asString(activity.id)}__${conceptId}`,
          conceptId,
          variableName: item.variableName,
          label: asString(bc.label) ?? nativeName(bc, conceptId),
          dataType: item.dataType,
          unit: item.unit,
          columnSpan: 6,
          required: false,
        }),
      ];
    });
  if (fields.length === 0) return undefined;
  return [
    {
      id: `${asString(activity.id)}__section`,
      title: nativeName(activity, "Items"),
      fields,
    },
  ];
}

function lowerUsdmV4ToLegacy(
  doc: Record<string, unknown>,
  selection?: UsdmStudySelection
): UsdmDocument {
  const study = asRecord(doc.study) ?? {};
  const crfStudyExt = readCrfExtension(study, "study");
  const fromCrf = crfStudyExt !== undefined;
  const studyExt = crfStudyExt ?? {};
  const resolved = resolveUsdmStudyDesign(study, selection);
  if (
    !resolved.ok &&
    resolved.code !== "no-study-version" &&
    resolved.code !== "no-study-design"
  ) {
    const choices = resolved.options
      .map(
        (option) =>
          `${option.studyVersionId} (${option.designs.map((d) => d.id).join(", ") || "no designs"})`
      )
      .join("; ");
    throw new Error(
      `USDM import: ${resolved.message}. Study versions: ${choices}`
    );
  }
  const version = (resolved.ok ? asRecord(resolved.version) : undefined) ?? {};
  const design = (resolved.ok ? asRecord(resolved.design) : undefined) ?? {};
  const designExt = asRecord(studyExt.design) ?? {};
  const designId = asString(design.id) ?? "design_main";

  const timelineSchedule = new Map(
    getUsdmV4EncounterSchedule(
      design as Pick<UsdmV4InterventionalStudyDesign, "scheduleTimelines">
    ).map((s) => [s.encounterId, s])
  );

  const cellEpochsByArm = new Map<string, string[]>();
  asArray(design.studyCells).forEach((raw) => {
    const cell = asRecord(raw);
    const armId = asString(cell?.armId);
    const epochId = asString(cell?.epochId);
    if (!armId || !epochId) return;
    const list = cellEpochsByArm.get(armId) ?? [];
    if (!list.includes(epochId)) list.push(epochId);
    cellEpochsByArm.set(armId, list);
  });

  const arms: UsdmArm[] = asArray(design.arms)
    .map(asRecord)
    .filter((a): a is Record<string, unknown> => Boolean(a))
    .map((arm, idx) => {
      const id = asString(arm.id) ?? `arm_${idx + 1}`;
      const ext = readCrfExtension(arm, "arm");
      return withoutUndefined({
        id,
        name: nativeName(arm, id),
        type: ext
          ? (asString(ext.type) as string)
          : (codeDecode(arm.type) ?? "Experimental"),
        description: nativeDescription(arm),
        epochIds: ext
          ? (ext.epochIds as string[] | undefined)
          : cellEpochsByArm.get(id),
      });
    });

  const epochs: UsdmEpoch[] = asArray(design.epochs)
    .map(asRecord)
    .filter((e): e is Record<string, unknown> => Boolean(e))
    .map((epoch, idx) => {
      const id = asString(epoch.id) ?? `epoch_${idx + 1}`;
      const ext = readCrfExtension(epoch, "epoch");
      return withoutUndefined({
        id,
        name: nativeName(epoch, id),
        sequenceNumber: ext ? (ext.sequenceNumber as number) : idx + 1,
        type: ext ? asString(ext.type) : codeDecode(epoch.type),
        description: nativeDescription(epoch),
      });
    });

  const cohorts: UsdmCohort[] = asArray(asRecord(design.population)?.cohorts)
    .map(asRecord)
    .filter((c): c is Record<string, unknown> => Boolean(c))
    .map((cohort, idx) => {
      const id = asString(cohort.id) ?? `cohort_${idx + 1}`;
      const ext = readCrfExtension(cohort, "cohort");
      const planned = asRecord(cohort.plannedEnrollmentNumber);
      return withoutUndefined({
        id,
        name: nativeName(cohort, id),
        description: nativeDescription(cohort),
        armIds: ext ? (ext.armIds as string[] | undefined) : undefined,
        targetSize: ext
          ? (ext.targetSize as number | undefined)
          : typeof planned?.value === "number"
            ? planned.value
            : undefined,
      });
    });

  const protocolContent = lowerProtocolContent(version, design);

  const encounters: UsdmEncounter[] = asArray(design.encounters)
    .map(asRecord)
    .filter((e): e is Record<string, unknown> => Boolean(e))
    .map((enc, idx) => {
      const id = asString(enc.id) ?? `encounter_${idx + 1}`;
      const ext = readCrfExtension(enc, "encounter");
      const name = nativeName(enc, id);
      const extended = ext && { id, ...ext, name };
      if (isUsdmEncounter(extended)) return extended;
      const sched = timelineSchedule.get(id);
      return withoutUndefined({
        id,
        name,
        type:
          sched && sched.targetDay !== null
            ? ("Scheduled" as const)
            : ("Unscheduled" as const),
        targetDay: sched?.targetDay ?? 0,
        windowBefore: sched?.windowBefore ?? 0,
        windowAfter: sched?.windowAfter ?? 0,
        epochId: sched?.epochId ?? undefined,
        assignedFormIds: sched?.activityIds ?? [],
      });
    });

  const conceptList = asArray(version.biomedicalConcepts)
    .map(asRecord)
    .filter((b): b is Record<string, unknown> => Boolean(b));
  const conceptRecords = new Map(
    conceptList.flatMap((bc) => {
      const id = asString(bc.id);
      return id ? [[id, bc] as const] : [];
    })
  );

  const activities: UsdmActivity[] = asArray(design.activities)
    .map(asRecord)
    .filter((a): a is Record<string, unknown> => Boolean(a))
    .map((act, idx) => {
      const id = asString(act.id) ?? `activity_${idx + 1}`;
      const ext = readCrfExtension(act, "activity");
      const extended = ext && { id, name: nativeName(act, id), ...ext };
      if (isUsdmActivity(extended)) return extended;
      return withoutUndefined({
        id,
        name: nativeName(act, id),
        domain: getUsdmV4ActivityDomain(act) ?? "GENERAL",
        description: nativeDescription(act),
        sections: plainActivitySections(act, conceptRecords),
      });
    });

  const biomedicalConcepts: UsdmBiomedicalConcept[] = conceptList.map(
    (bc, idx) => {
      const ext = readCrfExtension(bc, "biomedical-concept");
      if (isUsdmBiomedicalConcept(ext)) return ext;
      const id = asString(bc.id) ?? `bc_${idx + 1}`;
      const std = asRecord(asRecord(bc.code)?.standardCode);
      const item = plainConceptItem(bc, id);
      return withoutUndefined({
        id,
        name: nativeName(bc, id),
        variableName: item.variableName,
        dataType: item.dataType,
        unit: item.unit,
        conceptId: asString(std?.code) ?? id,
        code: asString(std?.code),
        synonyms: asArray(bc.synonyms).filter(
          (s): s is string => typeof s === "string"
        ),
        label: asString(bc.label),
        properties: asArray(bc.properties)
          .map(asRecord)
          .filter((p): p is Record<string, unknown> => Boolean(p))
          .map((p, pIdx) => ({
            id: asString(p.id) ?? `${id}_prop_${pIdx + 1}`,
            name: asString(p.name) ?? "",
            code: asString(asRecord(asRecord(p.code)?.standardCode)?.code),
            datatype: asString(p.datatype),
          })),
      });
    }
  );

  const legacyDesign: UsdmStudyDesign = withoutUndefined({
    id: designId,
    name: nativeName(design, "Main Study Design"),
    arms,
    epochs,
    cohorts,
    ...protocolContent,
    encounters,
    activities,
    biomedicalConcepts,
    codeLists: designExt.codeLists as UsdmStudyDesign["codeLists"],
    valueSets: designExt.valueSets as UsdmStudyDesign["valueSets"],
    rules: designExt.rules as UsdmStudyDesign["rules"],
    scheduleRules: designExt.scheduleRules as UsdmStudyDesign["scheduleRules"],
  });

  const identifiers = asArray(version.studyIdentifiers).map(asRecord);
  const officialTitle = asArray(version.titles)
    .map(asRecord)
    .find((t) => /official/i.test(codeDecode(t?.type) ?? ""));
  const sponsorOrg = asArray(version.organizations)
    .map(asRecord)
    .find((o) => /sponsor/i.test(codeDecode(o?.type) ?? ""));
  const phaseDecode = codeDecode(design.studyPhase);
  const phase = Object.entries(PHASE_CT).find(
    ([, [code]]) =>
      code ===
      asString(asRecord(asRecord(design.studyPhase)?.standardCode)?.code)
  )?.[0];

  const legacyStudy: UsdmStudy = {
    ...(withoutUndefined({
      id:
        asString(studyExt.id) ??
        asString(study.id) ??
        asString(study.name) ??
        "imported_usdm_study",
      name: fromCrf ? asString(studyExt.name) : asString(study.name),
      title: fromCrf
        ? asString(studyExt.title)
        : (asString(officialTitle?.text) ?? asString(study.label)),
      protocolNumber: fromCrf
        ? asString(studyExt.protocolNumber)
        : (asString(identifiers[0]?.text) ?? asString(study.name)),
      protocolId: asString(studyExt.protocolId),
      phase: fromCrf ? asString(studyExt.phase) : (phase ?? phaseDecode),
      sponsor: fromCrf
        ? asString(studyExt.sponsor)
        : asString(sponsorOrg?.name),
      therapeuticArea: asString(studyExt.therapeuticArea),
      version: fromCrf
        ? asString(studyExt.version)
        : asString(version.versionIdentifier),
      lastModified: asString(studyExt.lastModified),
    }) as UsdmStudy),
    studyDesigns: [legacyDesign],
    ...(withoutUndefined({
      codeLists: studyExt.codeLists,
      valueSets: studyExt.valueSets,
      rules: studyExt.rules,
    }) as Partial<UsdmStudy>),
  };
  if (studyExt.simulationState !== undefined) {
    legacyStudy.simulationState =
      studyExt.simulationState as UsdmStudy["simulationState"];
  }
  if (studyExt.provenance !== undefined) {
    legacyStudy.provenance = studyExt.provenance as UsdmStudy["provenance"];
  }

  return { study: legacyStudy };
}
