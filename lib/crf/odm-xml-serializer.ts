import { StudyProtocol } from "./types";
import { escapeXml } from "../utils";
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
 * Serializes a StudyProtocol into standard CDISC ODM-XML v1.3.2 format
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
     xmlns:def="http://www.cdisc.org/ns/def/v2.1"
     FileType="Snapshot"
     FileOID="ODM.${escapeXml(protoNum)}.${Date.now()}"
     CreationDateTime="${timestamp}"
     ODMVersion="1.3.2">
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
    import("./types").CodelistDefinition
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
        const codelistAttr = effectiveCodelistId
          ? ` CodeListOID="${escapeXml(effectiveCodelistId)}"`
          : "";

        xml += `      <ItemDef OID="${escapeXml(itemOid)}" Name="${escapeXml(field.variableName)}" DataType="${escapeXml(odmType)}"${codelistAttr}>\n`;
        xml += `        <Description><TranslatedText xml:lang="en">${escapeXml(field.label)}</TranslatedText></Description>\n`;
        if (field.cdashMetadata) {
          xml += `        <def:AnnotatedCRF>
          <def:DocumentRef leafID="aCRF"/>
          <def:PDFPageRef PageRefs="1" FirstPage="1" LastPage="1" Type="Physical"/>
        </def:AnnotatedCRF>\n`;
        }
        xml += `      </ItemDef>\n`;
      });
    });
  });

  xml += `\n`;

  // CodeLists (Study Codelists + Inline Custom Codelists)
  const allCodelists: import("./types").CodelistDefinition[] = [
    ...studyCodelists,
    ...Array.from(customFieldCodelists.values()).filter(
      (ccl) => !studyCodelists.some((cl) => cl && cl.id === ccl.id)
    ),
  ];

  allCodelists.forEach((cl) => {
    if (!cl || typeof cl !== "object") return;
    const nciAttr = cl.nciCodelistCode
      ? ` def:NCICode="${escapeXml(cl.nciCodelistCode)}"`
      : "";
    xml += `      <CodeList OID="${escapeXml(cl.id)}" Name="${escapeXml(cl.name)}" DataType="text"${nciAttr}>\n`;
    const options = Array.isArray(cl.options) ? cl.options : [];
    options.forEach((opt) => {
      if (!opt || typeof opt !== "object") return;
      const optNci = opt.nciCode
        ? ` def:NCICode="${escapeXml(opt.nciCode)}"`
        : "";
      xml += `        <CodeListItem CodedValue="${escapeXml(opt.code)}"${optNci}>\n`;
      xml += `          <Decode><TranslatedText xml:lang="en">${escapeXml(opt.label)}</TranslatedText></Decode>\n`;
      xml += `        </CodeListItem>\n`;
    });
    xml += `      </CodeList>\n`;
  });

  if (auditTrail.length > 0) {
    xml += `\n      <AuditTrail>\n`;
    auditTrail.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      xml += `        <AuditRecord ID="${escapeXml(entry.id)}">\n`;
      xml += `          <UserRef UserOID="${escapeXml(entry.changedBy)}"/>\n`;
      if (entry.userRole) {
        xml += `          <UserRole>${escapeXml(entry.userRole)}</UserRole>\n`;
      }
      xml += `          <DateTimeStamp>${escapeXml(entry.timestamp)}</DateTimeStamp>\n`;
      if (entry.actionType) {
        xml += `          <ActionType>${escapeXml(entry.actionType)}</ActionType>\n`;
      }
      if (entry.targetId) {
        xml += `          <TargetID>${escapeXml(entry.targetId)}</TargetID>\n`;
      }
      if (entry.formId) {
        xml += `          <FormOID>${escapeXml(entry.formId)}</FormOID>\n`;
      }
      if (entry.fieldId) {
        xml += `          <ItemOID>${escapeXml(entry.fieldId)}</ItemOID>\n`;
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
        xml += `          <PreviousValue>${escapeXml(prevStr)}</PreviousValue>\n`;
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
        xml += `          <NewValue>${escapeXml(newStr)}</NewValue>\n`;
      }
      if (entry.reasonForChange) {
        xml += `          <ReasonForChange>${escapeXml(entry.reasonForChange)}</ReasonForChange>\n`;
      }
      if (entry.diagnosticId) {
        xml += `          <DiagnosticID>${escapeXml(entry.diagnosticId)}</DiagnosticID>\n`;
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
        xml += `          <Details>${escapeXml(detailsStr)}</Details>\n`;
      }
      xml += `        </AuditRecord>\n`;
    });
    xml += `      </AuditTrail>\n`;
  }

  xml += `    </MetaDataVersion>
  </Study>
</ODM>`;

  return xml;
}

export const serializeStudyToOdmXml = exportStudyToCdiscOdmXml;
