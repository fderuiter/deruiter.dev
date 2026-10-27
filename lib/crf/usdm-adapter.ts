/**
 * CDISC USDM (Unified Study Data Model) Bidirectional Graph Adapter & Diff Engine
 * Facilitates loss-free conversion between CRF Studio protocols and CDISC USDM graph JSON specifications.
 */

import { CLINICAL_STANDARDS_PROFILE } from "@/lib/clinical-standards";
import {
  StudyProtocol,
  CRFForm,
  CRFField,
  CRFSection,
  StudyVisit,
  StudyArm,
  StudyEpoch,
  StudyCohort,
  BiomedicalConcept,
  CodelistDefinition,
  CodelistOption,
  EditCheckRule,
  AstCondition,
  ConditionGroup,
} from "./types";
import {
  getUniversalCrfSchemaUrl,
  validateUniversalCrf,
  EdcSimulationStateSchema,
  StudyProvenanceSchema,
} from "./universal-schema";
import { cloneDeep } from "../utils";
import { STANDARD_CODELISTS } from "@/lib/clinical-standards";
import {
  USDM_SDTM_DOMAIN_EXTENSION_URL,
  USDM_V4_VERSION,
  getUsdmV4ExtensionString,
  type UsdmV4Activity,
  type UsdmV4AliasCode,
  type UsdmV4BiomedicalConcept,
  type UsdmV4Code,
  type UsdmV4Document,
  type UsdmV4Encounter,
  type UsdmV4ExtensionAttribute,
  type UsdmV4InterventionalStudyDesign,
  type UsdmV4ScheduleTimeline,
  type UsdmV4StudyArm,
  type UsdmV4StudyCell,
  type UsdmV4StudyCohort,
  type UsdmV4StudyElement,
  type UsdmV4StudyEpoch,
  type UsdmV4Timing,
} from "@/lib/clinical-standards";
import {
  USDM_TIMING_AFTER,
  USDM_TIMING_BEFORE,
  USDM_TIMING_FIXED_REFERENCE,
  formatIsoDurationDays,
  getUsdmV4EncounterSchedule,
  studyDayDistance,
} from "@/lib/clinical-standards";

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
          const newConcept: UsdmBiomedicalConcept = {
            id: conceptId,
            name: field.label,
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
 * Reassembles linear encounter schedules into visit sequences, extracts valueSets and codeList references into study codelists,
 * maps windowBefore and windowAfter visit tolerances to constrain study schedule rules, and resolves decoupled BiomedicalConcept definitions.
 */
export function importStudyFromUsdm(
  usdmInput: string | UsdmDocument | UsdmV4Document | Record<string, unknown>
): StudyProtocol {
  const parsed: unknown =
    typeof usdmInput === "string" ? JSON.parse(usdmInput) : usdmInput;
  const doc = (
    getUsdmDocumentVersion(parsed) === "4"
      ? lowerUsdmV4ToLegacy(parsed as Record<string, unknown>)
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
  const primaryDesign = ((studyObj.studyDesigns && studyObj.studyDesigns[0]) ||
    {}) as UsdmStudyDesign & Record<string, unknown>;

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
    (studyObj.forms as unknown as UsdmActivity[]) ||
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
    const bcObj = bc as unknown as Record<string, unknown>;
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
        const fldObj = fld as unknown as Record<string, unknown>;
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
    const bcObj = bc as unknown as Record<string, unknown>;
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
        const fldObj = fld as unknown as Record<string, unknown>;
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
  const primaryDesignObj = primaryDesign as unknown as Record<string, unknown>;
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
    synonyms: (bc.synonyms || []).filter(
      (s): s is string => typeof s === "string"
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
        // An NCI code is decoded by the concept's name; the label is how a
        // form asks for it, such as "Age at Informed Consent" for Age.
        nci ? bc.name || codeValue : bc.label || bc.name || codeValue,
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
      windowLower: formatIsoDurationDays(windowBefore),
      windowUpper: formatIsoDurationDays(windowAfter),
      windowLabel: `-${windowBefore}/+${windowAfter} days`,
      instanceType: "Timing",
    };
  };
  const timings: UsdmV4Timing[] = anchor
    ? planned.map((enc) => timingFor(enc, anchor))
    : [];
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
      instances: encounters.map((enc, idx) => ({
        id: instanceId(enc),
        name: enc.name || enc.id,
        label: null,
        description: null,
        epochId: enc.epochId && epochIds.has(enc.epochId) ? enc.epochId : null,
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
      const epochName =
        design.epochs.find((e) => e.id === epochId)?.name || epochId;
      elements.push({
        id: elementId,
        name: `${arm.name || arm.id} - ${epochName}`,
        label: null,
        description: null,
        studyInterventionIds: [],
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
        definedProcedures: [],
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
    studyInterventionIds: [],
    objectives: [],
    population: {
      id: `${design.id}__population`,
      name: "Study population",
      label: null,
      description: null,
      includesHealthySubjects: false,
      cohorts,
      instanceType: "StudyDesignPopulation",
    },
    scheduleTimelines: buildMainTimeline(design, epochIds),
    eligibilityCriteria: [],
    analysisPopulations: [],
    model: v4Code(`${design.id}__model`, "C82639", "Parallel Study"),
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

/**
 * Lowers a USDM v4 document into the legacy graph the v3 reader consumes.
 * CRF Studio extension payloads restore their objects exactly; documents
 * from other tools are read from native USDM v4 properties, with visit days
 * and windows resolved from the main schedule timeline.
 */
function lowerUsdmV4ToLegacy(doc: Record<string, unknown>): UsdmDocument {
  const study = asRecord(doc.study) ?? {};
  const crfStudyExt = readCrfExtension(study, "study");
  const fromCrf = crfStudyExt !== undefined;
  const studyExt = crfStudyExt ?? {};
  const version = asRecord(asArray(study.versions)[0]) ?? {};
  const design = asRecord(asArray(version.studyDesigns)[0]) ?? {};
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

  const encounters: UsdmEncounter[] = asArray(design.encounters)
    .map(asRecord)
    .filter((e): e is Record<string, unknown> => Boolean(e))
    .map((enc, idx) => {
      const id = asString(enc.id) ?? `encounter_${idx + 1}`;
      const ext = readCrfExtension(enc, "encounter");
      const name = nativeName(enc, id);
      if (ext) {
        return { id, ...ext, name } as unknown as UsdmEncounter;
      }
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

  const activities: UsdmActivity[] = asArray(design.activities)
    .map(asRecord)
    .filter((a): a is Record<string, unknown> => Boolean(a))
    .map((act, idx) => {
      const id = asString(act.id) ?? `activity_${idx + 1}`;
      const ext = readCrfExtension(act, "activity");
      if (ext) {
        return {
          id,
          name: nativeName(act, id),
          ...ext,
        } as unknown as UsdmActivity;
      }
      return withoutUndefined({
        id,
        name: nativeName(act, id),
        domain: getUsdmV4ActivityDomain(act) ?? "GENERAL",
        description: nativeDescription(act),
      });
    });

  const biomedicalConcepts: UsdmBiomedicalConcept[] = asArray(
    version.biomedicalConcepts
  )
    .map(asRecord)
    .filter((b): b is Record<string, unknown> => Boolean(b))
    .map((bc, idx) => {
      const ext = readCrfExtension(bc, "biomedical-concept");
      if (ext) return ext as unknown as UsdmBiomedicalConcept;
      const id = asString(bc.id) ?? `bc_${idx + 1}`;
      const std = asRecord(asRecord(bc.code)?.standardCode);
      return withoutUndefined({
        id,
        name: nativeName(bc, id),
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
    });

  const legacyDesign: UsdmStudyDesign = withoutUndefined({
    id: designId,
    name: nativeName(design, "Main Study Design"),
    arms,
    epochs,
    cohorts,
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
