import { CLINICAL_STANDARDS_PROFILE } from "@/lib/clinical-standards";
import { StudyProtocol } from "../types";
import { escapeXml } from "../../utils";
import { consultationUrl } from "./export-annotations";

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
 * Namespace of CRF Studio's ODM vendor extension. ODM 1.3.2 has no place for
 * a design-change audit trail, so it is written under this namespace in the
 * `MetaDataVersionElementExtension` slot, the way Define-XML extends ODM.
 * Without an audit trail the file is plain ODM 1.3.2.
 */
export const CRF_STUDIO_ODM_NAMESPACE = "https://deruiter.dev/ns/crf-studio/v1";

/** The Alias context Define-XML 2.1 uses for an NCI EVS C-code. */
export const NCI_ALIAS_CONTEXT = "nci:ExtCodeID";

/**
 * Serializes a StudyProtocol into CDISC ODM-XML v1.3.2. The output validates
 * against the ODM 1.3.2 schema; with an audit trail, against that schema
 * extended by the CRF Studio namespace.
 */
export function exportStudyToCdiscOdmXml(study: StudyProtocol): string {
  const safeStudy =
    study && typeof study === "object" ? study : ({} as StudyProtocol);
  const timestamp = new Date().toISOString();
  const protoNum = safeStudy.protocolNumber || "STUDY01";
  const studyOid = `STUDY.${String(protoNum).replace(/[^A-Za-z0-9_]/g, "_")}`;
  const metaOid = `MDV.${safeStudy.version || "1.0"}`;
  const studyTitle = safeStudy.studyName || protoNum;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Schedule Consultation: ${consultationUrl()} -->
<ODM xmlns="http://www.cdisc.org/ns/odm/v1.3"
     xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xmlns:crfs="${CRF_STUDIO_ODM_NAMESPACE}"
     FileType="Snapshot"
     FileOID="ODM.${escapeXml(protoNum)}.${Date.now()}"
     CreationDateTime="${timestamp}"
     ODMVersion="${CLINICAL_STANDARDS_PROFILE.ODM}">
  <Study OID="${escapeXml(studyOid)}">
    <GlobalVariables>
      <StudyName>${escapeXml(studyTitle)}</StudyName>
      <StudyDescription>Protocol ${escapeXml(protoNum)} - ${escapeXml(safeStudy.phase || "")} • Schedule Consultation: ${consultationUrl()}</StudyDescription>
      <ProtocolName>${escapeXml(protoNum)}</ProtocolName>
    </GlobalVariables>
    <MetaDataVersion OID="${escapeXml(metaOid)}" Name="Protocol Definition Version ${escapeXml(safeStudy.version || "1.0")}">
      <Protocol>
`;

  const visits = Array.isArray(safeStudy.visits) ? safeStudy.visits : [];
  const forms = Array.isArray(safeStudy.forms) ? safeStudy.forms : [];
  const studyCodelists = Array.isArray(safeStudy.codelists)
    ? safeStudy.codelists
    : [];
  const auditTrail = Array.isArray(safeStudy.auditTrail)
    ? safeStudy.auditTrail
    : [];

  // StudyEventRefs
  visits.forEach((v, idx) => {
    if (!v || typeof v !== "object") return;
    const vOid = v.oid || v.id || `VIS_${idx + 1}`;
    xml += `        <StudyEventRef StudyEventOID="${escapeXml(vOid)}" OrderNumber="${idx + 1}" Mandatory="Yes"/>\n`;
  });

  xml += `      </Protocol>\n\n`;

  // StudyEventDefs (Visits)
  visits.forEach((v, idx) => {
    if (!v || typeof v !== "object") return;
    const vOid = v.oid || v.id || `VIS_${idx + 1}`;
    const formIds = Array.isArray(v.assignedFormIds) ? v.assignedFormIds : [];
    xml += `      <StudyEventDef OID="${escapeXml(vOid)}" Name="${escapeXml(v.name)}" Repeating="${v.isRepeating ? "Yes" : "No"}" Type="${escapeXml(v.visitType || "Scheduled")}">\n`;
    formIds.forEach((fId: string, fIdx: number) => {
      xml += `        <FormRef FormOID="${escapeXml(`FORM.${fId}`)}" OrderNumber="${fIdx + 1}" Mandatory="Yes"/>\n`;
    });
    xml += `      </StudyEventDef>\n`;
  });

  xml += `\n`;

  // FormDefs
  forms.forEach((form) => {
    if (!form || typeof form !== "object") return;
    const formOid = `FORM.${form.id}`;
    xml += `      <FormDef OID="${escapeXml(formOid)}" Name="${escapeXml(form.name)}" Repeating="${form.isLogForm ? "Yes" : "No"}">\n`;
    const sections = Array.isArray(form.sections) ? form.sections : [];
    sections.forEach((sec, sIdx) => {
      if (!sec || typeof sec !== "object") return;
      const igOid = `IG.${form.domain || "CRF"}.${sec.id}`;
      xml += `        <ItemGroupRef ItemGroupOID="${escapeXml(igOid)}" OrderNumber="${sIdx + 1}" Mandatory="Yes"/>\n`;
    });
    xml += `      </FormDef>\n`;
  });

  xml += `\n`;

  // ItemGroupDefs (Sections)
  forms.forEach((form) => {
    if (!form || typeof form !== "object") return;
    const sections = Array.isArray(form.sections) ? form.sections : [];
    sections.forEach((sec) => {
      if (!sec || typeof sec !== "object") return;
      const igOid = `IG.${form.domain || "CRF"}.${sec.id}`;
      xml += `      <ItemGroupDef OID="${escapeXml(igOid)}" Name="${escapeXml(sec.title)}" Repeating="${sec.isRepeating ? "Yes" : "No"}">\n`;
      const fields = Array.isArray(sec.fields) ? sec.fields : [];
      fields.forEach((field, fIdx) => {
        if (!field || typeof field !== "object") return;
        const itemOid = `IT.${field.variableName || field.id}`;
        xml += `        <ItemRef ItemOID="${escapeXml(itemOid)}" OrderNumber="${fIdx + 1}" Mandatory="${field.required ? "Yes" : "No"}"/>\n`;
      });
      xml += `      </ItemGroupDef>\n`;
    });
  });

  xml += `\n`;

  // ItemDefs (Fields)
  const processedItems = new Set<string>();
  const customFieldCodelists: Map<
    string,
    import("../types").CodelistDefinition
  > = new Map();

  forms.forEach((form) => {
    if (!form || typeof form !== "object") return;
    const sections = Array.isArray(form.sections) ? form.sections : [];
    sections.forEach((sec) => {
      if (!sec || typeof sec !== "object") return;
      const fields = Array.isArray(sec.fields) ? sec.fields : [];
      fields.forEach((field) => {
        if (!field || typeof field !== "object") return;
        const itemOid = `IT.${field.variableName || field.id}`;
        if (processedItems.has(itemOid)) return;
        processedItems.add(itemOid);

        let effectiveCodelistId = field.codelistId;
        if (
          !effectiveCodelistId &&
          Array.isArray(field.customOptions) &&
          field.customOptions.length > 0
        ) {
          effectiveCodelistId = `CL_${field.variableName || field.id}`;
          if (!customFieldCodelists.has(effectiveCodelistId)) {
            customFieldCodelists.set(effectiveCodelistId, {
              id: effectiveCodelistId,
              name: `${field.label || field.variableName} (Field Codelist)`,
              options: field.customOptions,
              isStandard: false,
            });
          }
        }

        const odmType = mapDataTypeToOdm(field.dataType);
        // ODM 1.3.2 ItemDef content order: Description, Question,
        // CodeListRef, Alias.
        xml += `      <ItemDef OID="${escapeXml(itemOid)}" Name="${escapeXml(field.variableName)}" DataType="${escapeXml(odmType)}">\n`;
        xml += `        <Description><TranslatedText xml:lang="en">${escapeXml(field.label)}</TranslatedText></Description>\n`;
        xml += `        <Question><TranslatedText xml:lang="en">${escapeXml(field.label)}</TranslatedText></Question>\n`;
        if (effectiveCodelistId) {
          xml += `        <CodeListRef CodeListOID="${escapeXml(effectiveCodelistId)}"/>\n`;
        }
        if (field.cdashMetadata?.acrfAnnotation) {
          xml += `        <Alias Context="SDTM" Name="${escapeXml(field.cdashMetadata.acrfAnnotation)}"/>\n`;
        }
        xml += `      </ItemDef>\n`;
      });
    });
  });

  xml += `\n`;

  // CodeLists (Study Codelists + Inline Custom Codelists)
  const allCodelists: import("../types").CodelistDefinition[] = [
    ...studyCodelists,
    ...Array.from(customFieldCodelists.values()).filter(
      (ccl) => !studyCodelists.some((cl) => cl && cl.id === ccl.id)
    ),
  ];

  allCodelists.forEach((cl) => {
    if (!cl || typeof cl !== "object") return;
    const nciAlias = (code: string | undefined, indent: string) =>
      code
        ? `${indent}<Alias Context="${NCI_ALIAS_CONTEXT}" Name="${escapeXml(code)}"/>\n`
        : "";
    xml += `      <CodeList OID="${escapeXml(cl.id)}" Name="${escapeXml(cl.name)}" DataType="text">\n`;
    const options = Array.isArray(cl.options) ? cl.options : [];
    options.forEach((opt) => {
      if (!opt || typeof opt !== "object") return;
      xml += `        <CodeListItem CodedValue="${escapeXml(opt.code)}">\n`;
      xml += `          <Decode><TranslatedText xml:lang="en">${escapeXml(opt.label)}</TranslatedText></Decode>\n`;
      xml += nciAlias(opt.nciCode, "          ");
      xml += `        </CodeListItem>\n`;
    });
    xml += nciAlias(cl.nciCodelistCode, "        ");
    xml += `      </CodeList>\n`;
  });

  if (auditTrail.length > 0) {
    xml += `\n      <crfs:AuditTrail>\n`;
    auditTrail.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
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
  </Study>
</ODM>`;

  return xml;
}

export const serializeStudyToOdmXml = exportStudyToCdiscOdmXml;
