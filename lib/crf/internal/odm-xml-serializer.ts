import { CLINICAL_STANDARDS_PROFILE } from "@/lib/clinical-standards";
import {
  AstCondition,
  AuditTrailEntry,
  CodelistDefinition,
  CRFField,
  EditCheckRule,
  ElectronicSignature,
  StudyProtocol,
  StudyVisit,
} from "../types";
import { escapeXml } from "../../utils";
import { consultationUrl } from "./export-annotations";
import {
  discoverSimulationSubjects,
  parseSimulationFormValues,
} from "./simulation-records";

const VALID_ODM_VISIT_TYPES = new Set<StudyVisit["visitType"]>([
  "Scheduled",
  "Unscheduled",
  "Common",
]);

/**
 * Maps ClinicalDataType to CDISC ODM DataType
 */
function mapDataTypeToOdm(type: string): string {
  switch (type) {
    case "integer":
      return "integer";
    case "number":
    case "calculated":
    case "vas_scale":
    case "nrs_scale":
      return "float";
    case "date":
      return "date";
    case "partial_date":
    case "precision_date":
      return "partialDate";
    case "time":
      return "time";
    case "datetime":
      return "datetime";
    case "single_select":
    case "radio":
    case "checkbox":
    case "multi_select":
      return "text";
    default:
      return "text";
  }
}

/**
 * Normalizes a timestamp into a deterministic `xs:dateTime` value without
 * consulting the system wall clock.
 */
function normalizeOdmDateTime(
  value: string | undefined,
  fallback = "1970-01-01T00:00:00Z"
): string {
  const trimmed = (value || "").trim();
  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      trimmed
    )
  ) {
    return trimmed;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)) {
    return `${trimmed}Z`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(trimmed)) {
    return trimmed.replace(
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(Z|[+-]\d{2}:\d{2})$/,
      "$1:00$2"
    );
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00Z`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00Z`;
  }
  return fallback;
}

function allocateXmlNcNameId(
  prefix: string,
  rawId: string | undefined,
  usedIds: Set<string>
): string {
  const cleaned = (rawId || "")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/^[^A-Za-z_]+/, "");
  const base = cleaned
    ? cleaned.toUpperCase().startsWith(`${prefix}_`)
      ? cleaned
      : `${prefix}_${cleaned}`
    : `${prefix}_1`;
  let candidate = base;
  let seq = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}_${seq++}`;
  }
  usedIds.add(candidate);
  return candidate;
}

function mapRoleToOdmUserType(
  role?: string
): "Sponsor" | "Investigator" | "Lab" | "Other" {
  switch (role) {
    case "Principal Investigator":
    case "Site Coordinator":
      return "Investigator";
    case "CRA Monitor":
    case "Data Manager":
    case "Biostatistician":
    case "Medical Monitor":
    case "Clinical Reviewer":
      return "Sponsor";
    default:
      return "Other";
  }
}

function formatAstCondition(cond: AstCondition): string {
  const lhs = cond.crossVisitId
    ? `${cond.crossVisitId}.${cond.fieldId}`
    : cond.fieldId;
  if (cond.operator === "is_empty" || cond.operator === "is_not_empty") {
    return `${lhs} ${cond.operator}`;
  }
  const rhs = cond.compareFieldId
    ? cond.compareFieldId
    : JSON.stringify(cond.value ?? null);
  return `${lhs} ${cond.operator} ${rhs}`;
}

function formatRuleFormalExpression(rule: EditCheckRule): string {
  if (rule.unsupportedExpression) {
    return typeof rule.unsupportedExpression === "string"
      ? rule.unsupportedExpression
      : typeof rule.unsupportedExpression.raw === "string"
        ? rule.unsupportedExpression.raw
        : JSON.stringify(rule.unsupportedExpression.raw ?? "");
  }
  if (rule.actionType === "set_value" && rule.formulaExpression) {
    return `${rule.targetFieldId} = ${rule.formulaExpression}`;
  }
  const op = rule.logicalOperator || "AND";
  const parts: string[] = [];
  for (const cond of rule.conditions || []) {
    parts.push(formatAstCondition(cond));
  }
  for (const grp of rule.conditionGroups || []) {
    const grpParts = (grp.conditions || []).map(formatAstCondition);
    if (grpParts.length > 0) {
      parts.push(`(${grpParts.join(` ${grp.logicalOperator || "AND"} `)})`);
    }
  }
  return parts.length > 0
    ? parts.join(` ${op} `)
    : `${rule.actionType}(${rule.targetFieldId || rule.id})`;
}

function sanitizeUnitSlug(unit: string): string {
  const cleaned = unit
    .replace(/[^A-Za-z0-9_.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "UNIT";
}

/**
 * Namespace of CRF Studio's ODM vendor extension. ODM 1.3.2 has no place for
 * a design-change audit trail, so it is written under this namespace in the
 * `MetaDataVersionElementExtension` slot, the way Define-XML extends ODM.
 * Without an audit trail the file is plain ODM 1.3.2.
 */
export const CRF_STUDIO_ODM_NAMESPACE = "https://deruiter.dev/ns/crf-studio/v1";

/** The Alias context Define-XML 2.1 uses for an NCI EVS C-code. */
export const NCI_ALIAS_CONTEXT = "nci:ExtCodeID";

/**
 * Serializes a StudyProtocol into CDISC ODM-XML v1.3.2, emitting `AdminData`
 * and `ClinicalData` with form-scoped `ItemData ItemOID` values (`IT.<formId>.<NAME>`)
 * when `study.simulationState` holds simulated records.
 * The output validates against the plain ODM 1.3.2 schema; with a design-change
 * `study.auditTrail`, against that schema extended by the CRF Studio namespace.
 */
export function exportStudyToCdiscOdmXml(study: StudyProtocol): string {
  const safeStudy =
    study && typeof study === "object" ? study : ({} as StudyProtocol);
  const creationDateTime = normalizeOdmDateTime(safeStudy.lastModified);
  const protoNum =
    safeStudy.protocolNumber || safeStudy.protocolId || "STUDY01";
  const versionStr = safeStudy.version || "1.0";
  const studyOid = `STUDY.${String(protoNum).replace(/[^A-Za-z0-9_]/g, "_")}`;
  const metaOid = `MDV.${versionStr}`;
  const studyTitle = safeStudy.studyName || protoNum;

  const visits = Array.isArray(safeStudy.visits) ? safeStudy.visits : [];
  const forms = Array.isArray(safeStudy.forms) ? safeStudy.forms : [];
  const studyCodelists = Array.isArray(safeStudy.codelists)
    ? safeStudy.codelists
    : [];
  const auditTrail = Array.isArray(safeStudy.auditTrail)
    ? safeStudy.auditTrail
    : [];

  // Validate all visit types upfront before emitting XML
  for (let idx = 0; idx < visits.length; idx++) {
    const v = visits[idx];
    if (!v || typeof v !== "object") continue;
    if (v.visitType !== undefined && !VALID_ODM_VISIT_TYPES.has(v.visitType)) {
      throw new Error(
        `Invalid CDISC ODM StudyEventDef Type "${String(v.visitType)}" on visit "${v.name || v.id}". Expected "Scheduled", "Unscheduled", or "Common".`
      );
    }
  }

  // Inspect simulationState upfront so we know whether <AdminData>/<ClinicalData> will be emitted
  const sim = safeStudy.simulationState;
  const simSubjects =
    sim && typeof sim === "object"
      ? discoverSimulationSubjects(safeStudy, sim)
      : [];
  const parsedCells =
    sim && typeof sim === "object"
      ? parseSimulationFormValues(safeStudy, sim)
      : [];
  const simAudits: AuditTrailEntry[] =
    sim && typeof sim === "object" && Array.isArray(sim.auditLog)
      ? sim.auditLog
      : [];
  const simSignatures: ElectronicSignature[] =
    sim && typeof sim === "object" && Array.isArray(sim.signatures)
      ? sim.signatures
      : [];
  const simQueries =
    sim && typeof sim === "object" && Array.isArray(sim.queries)
      ? sim.queries
      : [];
  const simLockedForms =
    sim &&
    typeof sim === "object" &&
    sim.lockedForms &&
    typeof sim.lockedForms === "object"
      ? sim.lockedForms
      : {};
  const simSdvMap =
    sim &&
    typeof sim === "object" &&
    sim.sdvMap &&
    typeof sim.sdvMap === "object"
      ? sim.sdvMap
      : {};
  const hasClinicalPayload =
    simSubjects.length > 0 ||
    parsedCells.length > 0 ||
    simAudits.length > 0 ||
    simSignatures.length > 0 ||
    simQueries.length > 0 ||
    Object.keys(simLockedForms).length > 0 ||
    Object.keys(simSdvMap).length > 0;

  // Collect MeasurementUnits across all fields for <BasicDefinitions>
  const unitToOid = new Map<string, string>();
  const usedUnitOids = new Set<string>();
  const registerUnit = (rawUnit: string | undefined): string | undefined => {
    const trimmed = (rawUnit || "").trim();
    if (!trimmed) return undefined;
    const existing = unitToOid.get(trimmed);
    if (existing) return existing;
    const baseOid = `MU.${sanitizeUnitSlug(trimmed)}`;
    let candidate = baseOid;
    let suffix = 2;
    while (usedUnitOids.has(candidate)) {
      candidate = `${baseOid}_${suffix++}`;
    }
    usedUnitOids.add(candidate);
    unitToOid.set(trimmed, candidate);
    return candidate;
  };

  forms.forEach((form) => {
    if (!form || typeof form !== "object") return;
    const sections = Array.isArray(form.sections) ? form.sections : [];
    sections.forEach((sec) => {
      if (!sec || typeof sec !== "object") return;
      const fields = Array.isArray(sec.fields) ? sec.fields : [];
      fields.forEach((field) => {
        if (!field || typeof field !== "object") return;
        registerUnit(field.unit);
        if (Array.isArray(field.unitOptions)) {
          field.unitOptions.forEach((u) => registerUnit(u));
        }
      });
    });
  });

  // Track unique OIDs across MetaDataVersion children (UC-MDV-OID-unique)
  const usedMdvOids = new Set<string>();
  const claimMdvOid = (preferred: string, disambiguator?: string): string => {
    if (!usedMdvOids.has(preferred)) {
      usedMdvOids.add(preferred);
      return preferred;
    }
    if (disambiguator) {
      const withDisambig = `${preferred}.${disambiguator}`;
      if (!usedMdvOids.has(withDisambig)) {
        usedMdvOids.add(withDisambig);
        return withDisambig;
      }
    }
    let idx = 2;
    while (usedMdvOids.has(`${preferred}_${idx}`)) {
      idx++;
    }
    const next = `${preferred}_${idx}`;
    usedMdvOids.add(next);
    return next;
  };

  // Pre-assign StudyEventDef, FormDef, ItemGroupDef, ItemDef, ConditionDef, and MethodDef OIDs
  const visitEntries = visits
    .filter((v): v is StudyVisit => Boolean(v && typeof v === "object"))
    .map((v, idx) => {
      const oid = claimMdvOid(v.oid || v.id || `VIS_${idx + 1}`, v.id);
      return { visit: v, oid };
    });

  interface PreparedFieldEntry {
    field: CRFField;
    itemOid: string;
    methodOid?: string;
    conditionOid?: string;
    effectiveCodelistId?: string;
  }

  interface PreparedSectionEntry {
    section: StudyProtocol["forms"][number]["sections"][number];
    igOid: string;
    fields: PreparedFieldEntry[];
  }

  interface PreparedConditionEntry {
    oid: string;
    name: string;
    description: string;
    expression: string;
    formId: string;
    rule: EditCheckRule;
  }

  interface PreparedMethodEntry {
    oid: string;
    name: string;
    description: string;
    formula: string;
    targetItemOid: string;
  }

  const customFieldCodelists = new Map<string, CodelistDefinition>();
  const conditionEntries: PreparedConditionEntry[] = [];
  const methodEntries: PreparedMethodEntry[] = [];

  const formEntries = forms
    .filter((f): f is StudyProtocol["forms"][number] =>
      Boolean(f && typeof f === "object")
    )
    .map((form) => {
      const formOid = claimMdvOid(`FORM.${form.id}`);
      const formRules = Array.isArray(form.rules) ? form.rules : [];

      // Pre-build ConditionDefs for this form's EditCheckRules
      const fieldConditionOid = new Map<string, string>();
      formRules.forEach((rule, rIdx) => {
        if (!rule || typeof rule !== "object") return;
        const ruleId = rule.id || `rule_${rIdx + 1}`;
        const condOid = claimMdvOid(`COND.${form.id}.${ruleId}`);
        const expr = formatRuleFormalExpression(rule);
        conditionEntries.push({
          oid: condOid,
          name: rule.name || ruleId,
          description:
            rule.description || rule.queryMessage || rule.name || ruleId,
          expression: expr,
          formId: form.id,
          rule,
        });
        if (
          rule.targetFieldId &&
          (rule.actionType === "show_field" ||
            rule.actionType === "hide_field" ||
            rule.actionType === "require_field") &&
          !fieldConditionOid.has(rule.targetFieldId)
        ) {
          fieldConditionOid.set(rule.targetFieldId, condOid);
        }
      });

      const sections = Array.isArray(form.sections) ? form.sections : [];
      const preparedSections: PreparedSectionEntry[] = sections
        .filter((s): s is StudyProtocol["forms"][number]["sections"][number] =>
          Boolean(s && typeof s === "object")
        )
        .map((sec) => {
          const preferredIgOid = `IG.${form.domain || "CRF"}.${sec.id}`;
          const igOid = usedMdvOids.has(preferredIgOid)
            ? claimMdvOid(`IG.${form.domain || "CRF"}.${form.id}.${sec.id}`)
            : claimMdvOid(preferredIgOid);

          const rawFields = Array.isArray(sec.fields) ? sec.fields : [];
          const preparedFields: PreparedFieldEntry[] = rawFields
            .filter((fld): fld is CRFField =>
              Boolean(fld && typeof fld === "object")
            )
            .map((field) => {
              // Form-scoped ItemDef OID prevents cross-form metadata overwrite
              const baseItemOid = `IT.${form.id}.${field.variableName || field.id}`;
              const itemOid = claimMdvOid(baseItemOid, field.id);

              let effectiveCodelistId = field.codelistId;
              if (
                !effectiveCodelistId &&
                Array.isArray(field.customOptions) &&
                field.customOptions.length > 0
              ) {
                effectiveCodelistId = `CL_${form.id}_${field.variableName || field.id}`;
                if (!customFieldCodelists.has(effectiveCodelistId)) {
                  customFieldCodelists.set(effectiveCodelistId, {
                    id: effectiveCodelistId,
                    name: `${field.label || field.variableName} (Field Codelist)`,
                    options: field.customOptions,
                    isStandard: false,
                  });
                }
              }

              let methodOid: string | undefined;
              const calcFormula = (field.calculationFormula || "").trim();
              if (calcFormula) {
                methodOid = claimMdvOid(`METH.${form.id}.${field.id}`);
                methodEntries.push({
                  oid: methodOid,
                  name: `Calc_${field.variableName || field.id}`,
                  description: `Derived calculation for ${field.label || field.variableName || field.id}`,
                  formula: calcFormula,
                  targetItemOid: itemOid,
                });
              }

              return {
                field,
                itemOid,
                methodOid,
                conditionOid: fieldConditionOid.get(field.id),
                effectiveCodelistId,
              };
            });

          return { section: sec, igOid, fields: preparedFields };
        });

      // Also emit MethodDef entries for set_value rules with formulaExpression
      formRules.forEach((rule, rIdx) => {
        if (
          rule &&
          rule.actionType === "set_value" &&
          rule.formulaExpression &&
          rule.formulaExpression.trim()
        ) {
          const ruleId = rule.id || `rule_${rIdx + 1}`;
          const targetEntry = preparedSections
            .flatMap((s) => s.fields)
            .find((fe) => fe.field.id === rule.targetFieldId);
          const targetItemOid =
            targetEntry?.itemOid ||
            `IT.${form.id}.${rule.targetFieldId || ruleId}`;
          const mOid = claimMdvOid(`METH.RULE.${form.id}.${ruleId}`);
          methodEntries.push({
            oid: mOid,
            name: rule.name || `RuleMethod_${ruleId}`,
            description:
              rule.description ||
              `Set-value formula for ${rule.name || ruleId}`,
            formula: rule.formulaExpression.trim(),
            targetItemOid,
          });
          if (targetEntry && !targetEntry.methodOid) {
            targetEntry.methodOid = mOid;
          }
        }
      });

      return { form, formOid, sections: preparedSections };
    });

  const scheduleUrl = consultationUrl();
  const baseStudyDescription = safeStudy.phase
    ? `Protocol ${protoNum} - ${safeStudy.phase}`
    : `Protocol ${protoNum}`;
  const studyDescriptionText = `${baseStudyDescription} • Schedule Consultation: ${scheduleUrl}`;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Schedule Consultation: ${scheduleUrl} -->
<ODM xmlns="http://www.cdisc.org/ns/odm/v1.3"
     xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xmlns:crfs="${CRF_STUDIO_ODM_NAMESPACE}"
     FileType="Snapshot"
     FileOID="ODM.${escapeXml(String(protoNum))}.${escapeXml(versionStr)}"
     CreationDateTime="${escapeXml(creationDateTime)}"
     ODMVersion="${CLINICAL_STANDARDS_PROFILE.ODM}">
  <Study OID="${escapeXml(studyOid)}">
    <GlobalVariables>
      <StudyName>${escapeXml(studyTitle)}</StudyName>
      <StudyDescription>${escapeXml(studyDescriptionText)}</StudyDescription>
      <ProtocolName>${escapeXml(String(protoNum))}</ProtocolName>
    </GlobalVariables>
`;

  if (unitToOid.size > 0) {
    xml += `    <BasicDefinitions>\n`;
    unitToOid.forEach((muOid, unitText) => {
      xml += `      <MeasurementUnit OID="${escapeXml(muOid)}" Name="${escapeXml(unitText)}">\n`;
      xml += `        <Symbol><TranslatedText xml:lang="en">${escapeXml(unitText)}</TranslatedText></Symbol>\n`;
      xml += `      </MeasurementUnit>\n`;
    });
    xml += `    </BasicDefinitions>\n`;
  }

  xml += `    <MetaDataVersion OID="${escapeXml(metaOid)}" Name="Protocol Definition Version ${escapeXml(versionStr)}">
      <Protocol>
`;

  // StudyEventRefs (deduplicated per UC-P-1)
  const seenProtocolEventRefs = new Set<string>();
  visitEntries.forEach(({ oid }, idx) => {
    if (seenProtocolEventRefs.has(oid)) return;
    seenProtocolEventRefs.add(oid);
    xml += `        <StudyEventRef StudyEventOID="${escapeXml(oid)}" OrderNumber="${idx + 1}" Mandatory="Yes"/>\n`;
  });

  const studyMetaPayload: Record<string, unknown> = {};
  if (safeStudy.id) studyMetaPayload.id = safeStudy.id;
  if (safeStudy.protocolId) studyMetaPayload.protocolId = safeStudy.protocolId;
  if (safeStudy.sponsor) studyMetaPayload.sponsor = safeStudy.sponsor;
  if (safeStudy.therapeuticArea) {
    studyMetaPayload.therapeuticArea = safeStudy.therapeuticArea;
  }
  if (safeStudy.phase) studyMetaPayload.phase = safeStudy.phase;
  if (safeStudy.lastModified) {
    studyMetaPayload.lastModified = safeStudy.lastModified;
  }
  if (safeStudy.arms) studyMetaPayload.arms = safeStudy.arms;
  if (safeStudy.epochs) studyMetaPayload.epochs = safeStudy.epochs;
  if (safeStudy.cohorts) studyMetaPayload.cohorts = safeStudy.cohorts;
  if (safeStudy.biomedicalConcepts) {
    studyMetaPayload.biomedicalConcepts = safeStudy.biomedicalConcepts;
  }
  if (safeStudy.branding) studyMetaPayload.branding = safeStudy.branding;
  if (safeStudy.reviewThreads) {
    studyMetaPayload.reviewThreads = safeStudy.reviewThreads;
  }
  if (safeStudy.testScenarios) {
    studyMetaPayload.testScenarios = safeStudy.testScenarios;
  }
  if (safeStudy.simulationState && !hasClinicalPayload) {
    studyMetaPayload.simulationState = safeStudy.simulationState;
  }
  if (Object.keys(studyMetaPayload).length > 0) {
    xml += `        <Alias Context="crfs:studyMeta" Name="${escapeXml(JSON.stringify(studyMetaPayload))}"/>\n`;
  }

  xml += `      </Protocol>\n\n`;

  // StudyEventDefs (Visits)
  visitEntries.forEach(({ visit: v, oid: vOid }) => {
    const visitType = v.visitType || "Scheduled";
    const formIds = Array.isArray(v.assignedFormIds) ? v.assignedFormIds : [];
    const seenFormRefs = new Set<string>();
    xml += `      <StudyEventDef OID="${escapeXml(vOid)}" Name="${escapeXml(v.name || vOid)}" Repeating="${v.isRepeating ? "Yes" : "No"}" Type="${escapeXml(visitType)}">\n`;
    formIds.forEach((fId: string, fIdx: number) => {
      const fOid = `FORM.${fId}`;
      if (seenFormRefs.has(fOid)) return;
      seenFormRefs.add(fOid);
      xml += `        <FormRef FormOID="${escapeXml(fOid)}" OrderNumber="${fIdx + 1}" Mandatory="Yes"/>\n`;
    });
    if (v.id) {
      xml += `        <Alias Context="crfs:visitId" Name="${escapeXml(v.id)}"/>\n`;
    }
    xml += `        <Alias Context="crfs:targetDay" Name="${escapeXml(String(v.targetDay ?? 0))}"/>\n`;
    xml += `        <Alias Context="crfs:windowBefore" Name="${escapeXml(String(v.windowBefore ?? 0))}"/>\n`;
    xml += `        <Alias Context="crfs:windowAfter" Name="${escapeXml(String(v.windowAfter ?? 0))}"/>\n`;
    if (v.repeatMax !== undefined) {
      xml += `        <Alias Context="crfs:repeatMax" Name="${escapeXml(String(v.repeatMax))}"/>\n`;
    }
    const visitExtra: Record<string, unknown> = {};
    if (v.epochId) visitExtra.epochId = v.epochId;
    if (v.armFormAssignments) {
      visitExtra.armFormAssignments = v.armFormAssignments;
    }
    if (Object.keys(visitExtra).length > 0) {
      xml += `        <Alias Context="crfs:visitMeta" Name="${escapeXml(JSON.stringify(visitExtra))}"/>\n`;
    }
    xml += `      </StudyEventDef>\n`;
  });

  xml += `\n`;

  // FormDefs
  formEntries.forEach(({ form, formOid, sections }) => {
    xml += `      <FormDef OID="${escapeXml(formOid)}" Name="${escapeXml(form.name || form.id)}" Repeating="${form.isLogForm ? "Yes" : "No"}">\n`;
    if (form.description) {
      xml += `        <Description><TranslatedText xml:lang="en">${escapeXml(form.description)}</TranslatedText></Description>\n`;
    }
    const seenIgRefs = new Set<string>();
    sections.forEach(({ igOid }, sIdx) => {
      if (seenIgRefs.has(igOid)) return;
      seenIgRefs.add(igOid);
      xml += `        <ItemGroupRef ItemGroupOID="${escapeXml(igOid)}" OrderNumber="${sIdx + 1}" Mandatory="Yes"/>\n`;
    });
    xml += `        <Alias Context="crfs:domain" Name="${escapeXml(form.domain || "GENERAL")}"/>\n`;
    xml += `        <Alias Context="crfs:version" Name="${escapeXml(form.version || "1.0")}"/>\n`;
    xml += `      </FormDef>\n`;
  });

  xml += `\n`;

  // ItemGroupDefs (Sections)
  formEntries.forEach(({ sections }) => {
    sections.forEach(({ section: sec, igOid, fields }) => {
      xml += `      <ItemGroupDef OID="${escapeXml(igOid)}" Name="${escapeXml(sec.title || sec.id)}" Repeating="${sec.isRepeating ? "Yes" : "No"}">\n`;
      if (sec.description) {
        xml += `        <Description><TranslatedText xml:lang="en">${escapeXml(sec.description)}</TranslatedText></Description>\n`;
      }
      const seenItemRefs = new Set<string>();
      fields.forEach((fe, fIdx) => {
        if (seenItemRefs.has(fe.itemOid)) return;
        seenItemRefs.add(fe.itemOid);
        let attrs = `ItemOID="${escapeXml(fe.itemOid)}" OrderNumber="${fIdx + 1}" Mandatory="${fe.field.required ? "Yes" : "No"}"`;
        if (fe.methodOid) {
          attrs += ` MethodOID="${escapeXml(fe.methodOid)}"`;
        }
        if (fe.conditionOid) {
          attrs += ` CollectionExceptionConditionOID="${escapeXml(fe.conditionOid)}"`;
        }
        xml += `        <ItemRef ${attrs}/>\n`;
      });
      xml += `        <Alias Context="crfs:sectionId" Name="${escapeXml(sec.id)}"/>\n`;
      xml += `      </ItemGroupDef>\n`;
    });
  });

  xml += `\n`;

  // ItemDefs (Form-scoped Fields)
  formEntries.forEach(({ form, sections }) => {
    sections.forEach(({ fields }) => {
      fields.forEach(({ field, itemOid, effectiveCodelistId }) => {
        const odmType = mapDataTypeToOdm(field.dataType);
        const itemName = field.variableName || field.id;
        const itemLabel = field.label || itemName;
        const questionLabel = itemLabel;

        xml += `      <ItemDef OID="${escapeXml(itemOid)}" Name="${escapeXml(itemName)}" DataType="${escapeXml(odmType)}">\n`;
        xml += `        <Description><TranslatedText xml:lang="en">${escapeXml(itemLabel)}</TranslatedText></Description>\n`;
        xml += `        <Question><TranslatedText xml:lang="en">${escapeXml(questionLabel)}</TranslatedText></Question>\n`;

        // MeasurementUnitRefs
        const unitOidsForField: string[] = [];
        const addFieldUnitOid = (u: string | undefined) => {
          const trimmed = (u || "").trim();
          if (!trimmed) return;
          const muOid = unitToOid.get(trimmed);
          if (muOid && !unitOidsForField.includes(muOid)) {
            unitOidsForField.push(muOid);
          }
        };
        addFieldUnitOid(field.unit);
        if (Array.isArray(field.unitOptions)) {
          field.unitOptions.forEach((u) => addFieldUnitOid(u));
        }
        unitOidsForField.forEach((muOid) => {
          xml += `        <MeasurementUnitRef MeasurementUnitOID="${escapeXml(muOid)}"/>\n`;
        });

        const primaryUnitOid = field.unit
          ? unitToOid.get(field.unit.trim())
          : undefined;

        // RangeChecks for numeric bounds
        if (
          typeof field.minValue === "number" &&
          Number.isFinite(field.minValue)
        ) {
          xml += `        <RangeCheck Comparator="GE" SoftHard="Hard">\n`;
          xml += `          <CheckValue>${escapeXml(String(field.minValue))}</CheckValue>\n`;
          if (primaryUnitOid) {
            xml += `          <MeasurementUnitRef MeasurementUnitOID="${escapeXml(primaryUnitOid)}"/>\n`;
          }
          xml += `          <ErrorMessage><TranslatedText xml:lang="en">${escapeXml(`${itemLabel} must be greater than or equal to ${field.minValue}`)}</TranslatedText></ErrorMessage>\n`;
          xml += `        </RangeCheck>\n`;
        }
        if (
          typeof field.maxValue === "number" &&
          Number.isFinite(field.maxValue)
        ) {
          xml += `        <RangeCheck Comparator="LE" SoftHard="Hard">\n`;
          xml += `          <CheckValue>${escapeXml(String(field.maxValue))}</CheckValue>\n`;
          if (primaryUnitOid) {
            xml += `          <MeasurementUnitRef MeasurementUnitOID="${escapeXml(primaryUnitOid)}"/>\n`;
          }
          xml += `          <ErrorMessage><TranslatedText xml:lang="en">${escapeXml(`${itemLabel} must be less than or equal to ${field.maxValue}`)}</TranslatedText></ErrorMessage>\n`;
          xml += `        </RangeCheck>\n`;
        }

        if (effectiveCodelistId) {
          xml += `        <CodeListRef CodeListOID="${escapeXml(effectiveCodelistId)}"/>\n`;
        }

        if (field.cdashMetadata?.acrfAnnotation) {
          xml += `        <Alias Context="SDTM" Name="${escapeXml(field.cdashMetadata.acrfAnnotation)}"/>\n`;
        }
        xml += `        <Alias Context="crfs:formId" Name="${escapeXml(form.id)}"/>\n`;
        xml += `        <Alias Context="crfs:fieldId" Name="${escapeXml(field.id)}"/>\n`;
        xml += `        <Alias Context="crfs:dataType" Name="${escapeXml(field.dataType)}"/>\n`;

        const fieldMeta: Record<string, unknown> = {
          columnSpan: field.columnSpan,
        };
        if (field.placeholder !== undefined) {
          fieldMeta.placeholder = field.placeholder;
        }
        if (field.description !== undefined) {
          fieldMeta.description = field.description;
        }
        if (field.defaultValue !== undefined) {
          fieldMeta.defaultValue = field.defaultValue;
        }
        if (field.unit !== undefined) fieldMeta.unit = field.unit;
        if (field.unitOptions !== undefined) {
          fieldMeta.unitOptions = field.unitOptions;
        }
        if (field.cdashMetadata !== undefined) {
          fieldMeta.cdashMetadata = field.cdashMetadata;
        }
        if (field.sdvVerified !== undefined) {
          fieldMeta.sdvVerified = field.sdvVerified;
        }
        if (field.repeatingColumns !== undefined) {
          fieldMeta.repeatingColumns = field.repeatingColumns;
        }
        if (!field.codelistId && Array.isArray(field.customOptions)) {
          fieldMeta.hasInlineCustomOptions = true;
        }
        xml += `        <Alias Context="crfs:fieldMeta" Name="${escapeXml(JSON.stringify(fieldMeta))}"/>\n`;
        xml += `      </ItemDef>\n`;
      });
    });
  });

  xml += `\n`;

  // CodeLists (Study Codelists + Inline Custom Codelists)
  const allCodelists: CodelistDefinition[] = [
    ...studyCodelists,
    ...Array.from(customFieldCodelists.values()).filter(
      (ccl) => !studyCodelists.some((cl) => cl && cl.id === ccl.id)
    ),
  ];

  allCodelists.forEach((cl) => {
    if (!cl || typeof cl !== "object") return;
    const rawOptions = Array.isArray(cl.options) ? cl.options : [];
    const seenCodedValues = new Set<string>();
    const validOptions = rawOptions.filter((opt) => {
      if (!opt || typeof opt !== "object" || opt.code === undefined) {
        return false;
      }
      const codeStr = String(opt.code);
      if (seenCodedValues.has(codeStr)) return false;
      seenCodedValues.add(codeStr);
      return true;
    });
    // ODM 1.3.2 requires at least one CodeListItem per CodeList
    if (validOptions.length === 0) return;

    const clOid = claimMdvOid(cl.id);
    const nciAlias = (code: string | undefined, indent: string) =>
      code
        ? `${indent}<Alias Context="${NCI_ALIAS_CONTEXT}" Name="${escapeXml(code)}"/>\n`
        : "";
    xml += `      <CodeList OID="${escapeXml(clOid)}" Name="${escapeXml(cl.name || clOid)}" DataType="text">\n`;
    validOptions.forEach((opt) => {
      xml += `        <CodeListItem CodedValue="${escapeXml(opt.code)}">\n`;
      xml += `          <Decode><TranslatedText xml:lang="en">${escapeXml(opt.label || opt.code)}</TranslatedText></Decode>\n`;
      xml += nciAlias(opt.nciCode, "          ");
      xml += `        </CodeListItem>\n`;
    });
    xml += nciAlias(cl.nciCodelistCode, "        ");
    xml += `      </CodeList>\n`;
  });

  // ConditionDefs (EditCheckRules)
  if (conditionEntries.length > 0) {
    xml += `\n`;
    conditionEntries.forEach((cond) => {
      xml += `      <ConditionDef OID="${escapeXml(cond.oid)}" Name="${escapeXml(cond.name)}">\n`;
      xml += `        <Description><TranslatedText xml:lang="en">${escapeXml(cond.description)}</TranslatedText></Description>\n`;
      xml += `        <FormalExpression Context="crfs:editCheck">${escapeXml(cond.expression)}</FormalExpression>\n`;
      xml += `        <Alias Context="crfs:formId" Name="${escapeXml(cond.formId)}"/>\n`;
      xml += `        <Alias Context="crfs:ruleAst" Name="${escapeXml(JSON.stringify(cond.rule))}"/>\n`;
      xml += `      </ConditionDef>\n`;
    });
  }

  // MethodDefs (Calculated Fields & Formula Rules)
  if (methodEntries.length > 0) {
    xml += `\n`;
    methodEntries.forEach((meth) => {
      xml += `      <MethodDef OID="${escapeXml(meth.oid)}" Name="${escapeXml(meth.name)}" Type="Computation">\n`;
      xml += `        <Description><TranslatedText xml:lang="en">${escapeXml(meth.description)}</TranslatedText></Description>\n`;
      xml += `        <FormalExpression Context="crfs:formula">${escapeXml(meth.formula)}</FormalExpression>\n`;
      xml += `        <Alias Context="crfs:targetItem" Name="${escapeXml(meth.targetItemOid)}"/>\n`;
      xml += `      </MethodDef>\n`;
    });
  }

  const usedXmlIds = new Set<string>();
  if (auditTrail.length > 0) {
    xml += `\n      <crfs:AuditTrail>\n`;
    auditTrail.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      if (entry.id) usedXmlIds.add(entry.id);
      xml += `        <crfs:AuditRecord ID="${escapeXml(entry.id)}">\n`;
      xml += `          <crfs:UserRef UserOID="${escapeXml(entry.changedBy)}"/>\n`;
      if (entry.userRole) {
        xml += `          <crfs:UserRole>${escapeXml(entry.userRole)}</crfs:UserRole>\n`;
      }
      xml += `          <crfs:DateTimeStamp>${escapeXml(entry.timestamp)}</crfs:DateTimeStamp>\n`;
      if (entry.actionType) {
        xml += `          <crfs:ActionType>${escapeXml(entry.actionType)}</crfs:ActionType>\n`;
      }
      if (entry.targetId) {
        xml += `          <crfs:TargetID>${escapeXml(entry.targetId)}</crfs:TargetID>\n`;
      }
      if (entry.formId) {
        xml += `          <crfs:FormOID>${escapeXml(entry.formId)}</crfs:FormOID>\n`;
      }
      if (entry.fieldId) {
        xml += `          <crfs:ItemOID>${escapeXml(entry.fieldId)}</crfs:ItemOID>\n`;
      }
      if (entry.previousValue !== undefined && entry.previousValue !== null) {
        let prevStr: string;
        try {
          prevStr =
            typeof entry.previousValue === "object"
              ? JSON.stringify(entry.previousValue)
              : String(entry.previousValue);
        } catch {
          prevStr = String(entry.previousValue);
        }
        xml += `          <crfs:PreviousValue>${escapeXml(prevStr)}</crfs:PreviousValue>\n`;
      }
      if (entry.newValue !== undefined && entry.newValue !== null) {
        let newStr: string;
        try {
          newStr =
            typeof entry.newValue === "object"
              ? JSON.stringify(entry.newValue)
              : String(entry.newValue);
        } catch {
          newStr = String(entry.newValue);
        }
        xml += `          <crfs:NewValue>${escapeXml(newStr)}</crfs:NewValue>\n`;
      }
      if (entry.reasonForChange) {
        xml += `          <crfs:ReasonForChange>${escapeXml(entry.reasonForChange)}</crfs:ReasonForChange>\n`;
      }
      if (entry.diagnosticId) {
        xml += `          <crfs:DiagnosticID>${escapeXml(entry.diagnosticId)}</crfs:DiagnosticID>\n`;
      }
      if (entry.details !== undefined && entry.details !== null) {
        let detailsStr: string;
        try {
          detailsStr =
            typeof entry.details === "object"
              ? JSON.stringify(entry.details)
              : String(entry.details);
        } catch {
          detailsStr = String(entry.details);
        }
        xml += `          <crfs:Details>${escapeXml(detailsStr)}</crfs:Details>\n`;
      }
      xml += `        </crfs:AuditRecord>\n`;
    });
    xml += `      </crfs:AuditTrail>\n`;
  }

  xml += `    </MetaDataVersion>
  </Study>\n`;

  // Plain ODM 1.3.2 AdminData & ClinicalData from study.simulationState
  if (hasClinicalPayload) {
    const adminUsers = new Map<
      string,
      {
        oid: string;
        displayName: string;
        role: string;
        userType: "Sponsor" | "Investigator" | "Lab" | "Other";
      }
    >();
    const ensureAdminUser = (name: string, role?: string): string => {
      const displayName = (name || "Clinical User").trim() || "Clinical User";
      const cleanRole = (role || "System").trim() || "System";
      const key = `${displayName}|||${cleanRole}`;
      const existing = adminUsers.get(key);
      if (existing) return existing.oid;
      const oid = `USR.${adminUsers.size + 1}`;
      adminUsers.set(key, {
        oid,
        displayName,
        role: cleanRole,
        userType: mapRoleToOdmUserType(cleanRole),
      });
      return oid;
    };

    const sigDefs = new Map<string, string>();
    const ensureSigDef = (meaning: string): string => {
      const cleanMeaning =
        (meaning || "Investigator Approval").trim() || "Investigator Approval";
      const existing = sigDefs.get(cleanMeaning);
      if (existing) return existing;
      const oid = `SIGDEF.${sigDefs.size + 1}`;
      sigDefs.set(cleanMeaning, oid);
      return oid;
    };

    simAudits.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      ensureAdminUser(entry.changedBy || "System", entry.userRole);
    });
    simSignatures.forEach((sig) => {
      if (!sig || typeof sig !== "object") return;
      ensureAdminUser(sig.signedBy || "Investigator", sig.userRole);
      ensureSigDef(sig.meaning);
    });
    simQueries.forEach((q) => {
      if (!q || typeof q !== "object") return;
      if (q.raisedBy) ensureAdminUser(q.raisedBy, "System");
      if (q.respondedBy) ensureAdminUser(q.respondedBy, "Site Coordinator");
      if (q.resolvedBy) ensureAdminUser(q.resolvedBy, "CRA Monitor");
    });

    const locationOid = "LOC.SITE_001";
    const effectiveDate = creationDateTime.slice(0, 10);

    // 1. <AdminData> (sequence: User*, Location*, SignatureDef*)
    xml += `  <AdminData StudyOID="${escapeXml(studyOid)}">\n`;
    adminUsers.forEach((u) => {
      xml += `    <User OID="${escapeXml(u.oid)}" UserType="${u.userType}">\n`;
      xml += `      <DisplayName>${escapeXml(u.displayName)}</DisplayName>\n`;
      xml += `      <FullName>${escapeXml(u.displayName)}</FullName>\n`;
      xml += `      <Organization>${escapeXml(u.role)}</Organization>\n`;
      xml += `    </User>\n`;
    });
    xml += `    <Location OID="${locationOid}" Name="Simulated Clinical Site 001" LocationType="Site">\n`;
    xml += `      <MetaDataVersionRef StudyOID="${escapeXml(studyOid)}" MetaDataVersionOID="${escapeXml(metaOid)}" EffectiveDate="${escapeXml(effectiveDate)}"/>\n`;
    xml += `    </Location>\n`;
    sigDefs.forEach((oid, meaning) => {
      xml += `    <SignatureDef OID="${escapeXml(oid)}" Methodology="Electronic">\n`;
      xml += `      <Meaning>${escapeXml(meaning)}</Meaning>\n`;
      xml += `      <LegalReason>Simulated electronic signature reference in CRF Studio (not a validated system)</LegalReason>\n`;
      xml += `    </SignatureDef>\n`;
    });
    xml += `  </AdminData>\n`;

    // Index captured values by `${subjectId}:::${visitId}:::${fieldId}`
    const cellValueMap = new Map<string, string | number | boolean | null>();
    parsedCells.forEach((c) => {
      cellValueMap.set(`${c.subjectId}:::${c.visitId}:::${c.fieldId}`, c.value);
    });

    // Count how many forms declare each field.id so shared field IDs prefer forms scheduled at the visit
    const fieldIdFormCount = new Map<string, number>();
    formEntries.forEach(({ sections }) => {
      sections.forEach(({ fields }) => {
        fields.forEach(({ field }) => {
          fieldIdFormCount.set(
            field.id,
            (fieldIdFormCount.get(field.id) ?? 0) + 1
          );
        });
      });
    });

    // 2. <ClinicalData> (sequence: SubjectData*, AuditRecords*, Signatures*, Annotations*)
    xml += `  <ClinicalData StudyOID="${escapeXml(studyOid)}" MetaDataVersionOID="${escapeXml(metaOid)}">\n`;

    simSubjects.forEach((subjectId) => {
      xml += `    <SubjectData SubjectKey="${escapeXml(subjectId)}">\n`;
      xml += `      <SiteRef LocationOID="${locationOid}"/>\n`;

      visitEntries.forEach(({ visit, oid: visitOid }) => {
        let studyEventXml = "";
        const scheduledFormIds = new Set<string>(
          Array.isArray(visit.assignedFormIds) ? visit.assignedFormIds : []
        );
        if (
          visit.armFormAssignments &&
          typeof visit.armFormAssignments === "object"
        ) {
          Object.values(visit.armFormAssignments).forEach((armForms) => {
            if (Array.isArray(armForms)) {
              armForms.forEach((fId) => scheduledFormIds.add(fId));
            }
          });
        }

        formEntries.forEach(({ form, formOid, sections }) => {
          let formDataXml = "";

          sections.forEach(({ igOid, fields }) => {
            let itemGroupXml = "";

            fields.forEach(({ field, itemOid }) => {
              if (
                (fieldIdFormCount.get(field.id) ?? 0) > 1 &&
                scheduledFormIds.size > 0 &&
                !scheduledFormIds.has(form.id)
              ) {
                return;
              }
              const mapKey = `${subjectId}:::${visit.id}:::${field.id}`;
              if (!cellValueMap.has(mapKey)) return;
              const val = cellValueMap.get(mapKey);

              if (val === null || val === "") {
                itemGroupXml += `            <ItemData ItemOID="${escapeXml(itemOid)}" IsNull="Yes"/>\n`;
              } else {
                const strVal =
                  typeof val === "object" ? JSON.stringify(val) : String(val);
                itemGroupXml += `            <ItemData ItemOID="${escapeXml(itemOid)}" Value="${escapeXml(strVal)}"/>\n`;
              }
            });

            if (itemGroupXml) {
              formDataXml += `          <ItemGroupData ItemGroupOID="${escapeXml(igOid)}">\n${itemGroupXml}          </ItemGroupData>\n`;
            }
          });

          if (formDataXml) {
            studyEventXml += `        <FormData FormOID="${escapeXml(formOid)}">\n${formDataXml}        </FormData>\n`;
          }
        });

        if (studyEventXml) {
          xml += `      <StudyEventData StudyEventOID="${escapeXml(visitOid)}">\n${studyEventXml}      </StudyEventData>\n`;
        }
      });

      xml += `    </SubjectData>\n`;
    });

    if (simAudits.length > 0) {
      xml += `    <AuditRecords>\n`;
      simAudits.forEach((entry) => {
        if (!entry || typeof entry !== "object") return;
        const audXmlId = allocateXmlNcNameId("AUD", entry.id, usedXmlIds);
        const userOid = ensureAdminUser(
          entry.changedBy || "System",
          entry.userRole
        );
        const isoTs = normalizeOdmDateTime(entry.timestamp, creationDateTime);
        const sourcePayload = `urn:crf-studio:audit:${JSON.stringify({
          id: entry.id,
          subjectId: entry.subjectId,
          formId: entry.formId,
          fieldId: entry.fieldId,
          fieldName: entry.fieldName,
          previousValue:
            entry.previousValue === undefined ? null : entry.previousValue,
          newValue: entry.newValue === undefined ? null : entry.newValue,
          actionType: entry.actionType,
          targetId: entry.targetId,
          targetType: entry.targetType,
        })}`;
        xml += `      <AuditRecord ID="${escapeXml(audXmlId)}" EditPoint="DataManagement">\n`;
        xml += `        <UserRef UserOID="${escapeXml(userOid)}"/>\n`;
        xml += `        <LocationRef LocationOID="${locationOid}"/>\n`;
        xml += `        <DateTimeStamp>${escapeXml(isoTs)}</DateTimeStamp>\n`;
        xml += `        <ReasonForChange>${escapeXml(entry.reasonForChange || "Recorded in EDC simulation")}</ReasonForChange>\n`;
        xml += `        <SourceID>${escapeXml(sourcePayload)}</SourceID>\n`;
        xml += `      </AuditRecord>\n`;
      });
      xml += `    </AuditRecords>\n`;
    }

    if (simSignatures.length > 0) {
      xml += `    <Signatures>\n`;
      simSignatures.forEach((sig) => {
        if (!sig || typeof sig !== "object") return;
        const sigXmlId = allocateXmlNcNameId("SIG", sig.id, usedXmlIds);
        const userOid = ensureAdminUser(
          sig.signedBy || "Investigator",
          sig.userRole
        );
        const sigDefOid = ensureSigDef(sig.meaning);
        const isoTs = normalizeOdmDateTime(sig.timestamp, creationDateTime);
        const manifestPayload = `urn:crf-studio:simulated-signature:${JSON.stringify(
          {
            id: sig.id,
            subjectId: sig.subjectId,
            visitId: sig.visitId,
            formId: sig.formId,
            digest: sig.digest,
            note: "Simulated signature reference token (not a validated system)",
          }
        )}`;
        xml += `      <Signature ID="${escapeXml(sigXmlId)}">\n`;
        xml += `        <UserRef UserOID="${escapeXml(userOid)}"/>\n`;
        xml += `        <LocationRef LocationOID="${locationOid}"/>\n`;
        xml += `        <SignatureRef SignatureOID="${escapeXml(sigDefOid)}"/>\n`;
        xml += `        <DateTimeStamp>${escapeXml(isoTs)}</DateTimeStamp>\n`;
        xml += `        <CryptoBindingManifest>${escapeXml(manifestPayload)}</CryptoBindingManifest>\n`;
        xml += `      </Signature>\n`;
      });
      xml += `    </Signatures>\n`;
    }

    const hasExtraState =
      simQueries.length > 0 ||
      Object.keys(simLockedForms).length > 0 ||
      Object.keys(simSdvMap).length > 0;
    if (hasExtraState) {
      xml += `    <Annotations>\n`;
      let seqNum = 1;
      simQueries.forEach((q) => {
        if (!q || typeof q !== "object") return;
        const annId = allocateXmlNcNameId("ANN", q.id, usedXmlIds);
        const commentPayload = `urn:crf-studio:query:${JSON.stringify(q)}`;
        xml += `      <Annotation SeqNum="${seqNum++}" ID="${escapeXml(annId)}">\n`;
        xml += `        <Comment SponsorOrSite="Sponsor">${escapeXml(commentPayload)}</Comment>\n`;
        xml += `      </Annotation>\n`;
      });
      if (
        Object.keys(simLockedForms).length > 0 ||
        Object.keys(simSdvMap).length > 0
      ) {
        const stateAnnId = allocateXmlNcNameId("ANN", "STATE_1", usedXmlIds);
        const statePayload = `urn:crf-studio:state:${JSON.stringify({
          lockedForms: simLockedForms,
          sdvMap: simSdvMap,
        })}`;
        xml += `      <Annotation SeqNum="${seqNum++}" ID="${escapeXml(stateAnnId)}">\n`;
        xml += `        <Comment SponsorOrSite="Site">${escapeXml(statePayload)}</Comment>\n`;
        xml += `      </Annotation>\n`;
      }
      xml += `    </Annotations>\n`;
    }

    xml += `  </ClinicalData>\n`;
  }

  xml += `</ODM>`;

  return xml;
}

export const serializeStudyToOdmXml = exportStudyToCdiscOdmXml;
