/**
 * CDISC USDM (Unified Study Data Model) Bidirectional Graph Adapter & Diff Engine
 * Facilitates loss-free conversion between CRF Studio protocols and CDISC USDM graph JSON specifications.
 */

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
} from "./universal-schema";
import { cloneDeep } from "../utils";
import { STANDARD_CODELISTS } from "./cdisc-controlled-terminology";

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

/**
 * Normalizes USDM graph ValueSet or CodeList objects/references into a CRF Studio CodelistDefinition.
 */
export function extractCodelistFromUsdmObject(
  raw: unknown
): CodelistDefinition | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const target = (obj.codeList ||
    obj.valueSet ||
    obj.codelist ||
    obj) as Record<string, unknown>;

  const id =
    target.id ||
    target.codeListId ||
    target.valueSetId ||
    target.nciCodelistCode ||
    target.code ||
    (target.name
      ? `cl_${String(target.name)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_")}`
      : null);

  if (!id) return null;

  const name = target.name || target.label || target.title || id;
  const nciCodelistCode =
    target.nciCodelistCode || target.nciCode || target.cCode;

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
          return {
            code: String(opt),
            label: String(opt),
            order: idx + 1,
          };
        }
        const o = (opt || {}) as Record<string, unknown>;
        const code = String(
          o.code ?? o.value ?? o.id ?? o.name ?? o.term ?? idx + 1
        );
        const label = String(
          o.label ?? o.decode ?? o.name ?? o.text ?? o.description ?? code
        );
        const nciCode = (o.nciCode ||
          o.cCode ||
          o.conceptId ||
          (code.match(/^C\d+$/) ? code : undefined)) as string | undefined;
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
    id: String(id),
    name: String(name),
    nciCodelistCode: nciCodelistCode ? String(nciCodelistCode) : undefined,
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
 * Transforms a CRF Studio StudyProtocol into a CDISC USDM Graph representation.
 * Decouples field-level presentation properties into independent BiomedicalConcept nodes.
 * Maps linear visit target days to epoch-based encounter schedules.
 */
export function exportStudyToUsdmObject(study: StudyProtocol): UsdmDocument {
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
            conceptId: field.cdashMetadata?.nciConceptId || conceptId,
            code: field.cdashMetadata?.nciConceptId,
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
          if (form.domain && field.variableName) {
            domainVarMap.set(
              `${form.domain.toUpperCase()}_${field.variableName.toUpperCase()}`,
              newConcept
            );
          }
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
  usdmInput: string | UsdmDocument | Record<string, unknown>
): StudyProtocol {
  const doc = (
    typeof usdmInput === "string" ? JSON.parse(usdmInput) : usdmInput
  ) as Record<string, unknown> & UsdmDocument;

  // Support direct StudyProtocol JSON fallback if user pasted a Universal CRF JSON
  if (doc.forms && doc.visits && doc.protocolNumber) {
    const val = validateUniversalCrf(doc as unknown as StudyProtocol);
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

  const protocol: StudyProtocol = {
    $schema: getUniversalCrfSchemaUrl(),
    schemaVersion: "1.0.0",
    id: studyObj.id || "imported_usdm_study",
    protocolNumber: studyObj.protocolNumber || studyObj.name || "USDM-STUDY",
    studyName: studyObj.title || studyObj.name || "Imported USDM Protocol",
    phase: (studyObj.phase as StudyProtocol["phase"]) || "Phase III",
    sponsor: studyObj.sponsor || "Clinical Sponsor",
    therapeuticArea: studyObj.therapeuticArea || "General Medicine",
    version: studyObj.version || "1.0",
    lastModified: studyObj.lastModified || new Date().toISOString(),
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
    simulationState:
      studyObj.simulationState as StudyProtocol["simulationState"],
    provenance: studyObj.provenance
      ? {
          ...(studyObj.provenance as StudyProtocol["provenance"]),
          sourceFormat:
            (studyObj.provenance as StudyProtocol["provenance"])
              ?.sourceFormat || "CDISC USDM JSON",
        }
      : undefined,
  };

  return protocol;
}

/**
 * Performs semantic version diffing between two USDM protocol revisions.
 * Identifies added, modified, or removed arms, epochs, cohorts, biomedical concepts, encounters, and activities.
 */
export function diffUsdmProtocols(
  usdmAInput: string | UsdmDocument | Record<string, unknown>,
  usdmBInput: string | UsdmDocument | Record<string, unknown>
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
