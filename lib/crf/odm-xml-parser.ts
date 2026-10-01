/**
 * CDISC ODM-XML v1.3.2 / v2.0 Deserializer and Parser
 * Converts CDISC ODM XML DOM nodes into CRF Studio StudyProtocol.
 */

import {
  StudyProtocol,
  CRFForm,
  CRFSection,
  CRFField,
  StudyVisit,
  CodelistDefinition,
  CodelistOption,
  AuditTrailEntry,
  ClinicalDataType,
} from "./types";

/**
 * Maps CDISC ODM DataType to CRF Studio ClinicalDataType
 */
export function mapOdmDataTypeToClinical(odmType: string): ClinicalDataType {
  const normalized = (odmType || "").toLowerCase();
  switch (normalized) {
    case "integer":
      return "integer";
    case "float":
    case "double":
    case "decimal":
    case "number":
      return "number";
    case "date":
      return "date";
    case "partialdate":
    case "partial_date":
      return "partial_date";
    case "time":
      return "time";
    case "datetime":
      return "datetime";
    case "boolean":
      return "radio";
    default:
      return "text";
  }
}

/** Helper to query elements by local name regardless of XML namespace prefix */
function getElementsByLocalName(
  parent: Element | Document,
  localName: string
): Element[] {
  const all = parent.getElementsByTagName("*");
  const result: Element[] = [];
  const targetLower = localName.toLowerCase();
  for (let i = 0; i < all.length; i++) {
    const el = all.item(i);
    if (el && el.localName.toLowerCase() === targetLower) {
      result.push(el);
    }
  }
  return result;
}

/** Helper to get text content of first child matching local name */
function getChildTextContent(parent: Element, localName: string): string {
  const children = getElementsByLocalName(parent, localName);
  return children.length > 0 ? (children[0].textContent || "").trim() : "";
}

/**
 * Parses a CDISC ODM XML string (v1.3.2 / v2.0) into a StudyProtocol.
 */
export function importStudyFromCdiscOdmXml(xmlContent: string): StudyProtocol {
  if (!xmlContent || typeof xmlContent !== "string" || !xmlContent.trim()) {
    throw new Error("Invalid CDISC ODM XML: Empty XML payload");
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

  // Check for XML parsing errors
  const parseError = xmlDoc.getElementsByTagName("parsererror");
  if (parseError.length > 0) {
    const errMsg = parseError[0].textContent || "Malformed XML markup";
    throw new Error(`Invalid CDISC ODM XML structure: ${errMsg}`);
  }

  const odmElements = getElementsByLocalName(xmlDoc, "ODM");
  if (odmElements.length === 0) {
    throw new Error("Invalid CDISC ODM XML: Missing root <ODM> element");
  }

  const odmEl = odmElements[0];
  const creationDateTime =
    odmEl.getAttribute("CreationDateTime") || new Date().toISOString();

  // Find <Study>
  const studyEls = getElementsByLocalName(xmlDoc, "Study");
  if (studyEls.length === 0) {
    throw new Error("Invalid CDISC ODM XML: Missing <Study> definition");
  }
  const studyEl = studyEls[0];
  const studyOid = studyEl.getAttribute("OID") || "STUDY01";

  // GlobalVariables
  const globalVars = getElementsByLocalName(studyEl, "GlobalVariables");
  let studyName = "";
  let protocolNumber = "";
  let studyDescription = "";

  if (globalVars.length > 0) {
    studyName = getChildTextContent(globalVars[0], "StudyName");
    protocolNumber = getChildTextContent(globalVars[0], "ProtocolName");
    studyDescription = getChildTextContent(globalVars[0], "StudyDescription");
  }

  if (!protocolNumber) {
    protocolNumber = studyOid.replace(/^STUDY\./, "") || "STUDY01";
  }
  if (!studyName) {
    studyName = protocolNumber;
  }

  // MetaDataVersion
  const metaVerEls = getElementsByLocalName(studyEl, "MetaDataVersion");
  const metaVerEl = metaVerEls.length > 0 ? metaVerEls[0] : studyEl;
  const version =
    metaVerEl.getAttribute("Name")?.replace(/.*Version\s*/i, "") ||
    metaVerEl.getAttribute("OID")?.replace(/^MDV\./, "") ||
    "1.0";

  // Infer phase from studyDescription
  let phase: StudyProtocol["phase"] = "Phase III";
  if (/\bphase\s*i\/ii\b/i.test(studyDescription)) phase = "Phase I/II";
  else if (/\bphase\s*iii\b/i.test(studyDescription)) phase = "Phase III";
  else if (/\bphase\s*ii\b/i.test(studyDescription)) phase = "Phase II";
  else if (/\bphase\s*iv\b/i.test(studyDescription)) phase = "Phase IV";
  else if (/\bphase\s*i\b/i.test(studyDescription)) phase = "Phase I";
  else if (/registry/i.test(studyDescription)) phase = "Registry";

  // 1. CodeLists
  const codelists: CodelistDefinition[] = [];
  const codelistMap = new Map<string, CodelistDefinition>();
  const codeListEls = getElementsByLocalName(metaVerEl, "CodeList");

  codeListEls.forEach((clEl) => {
    const clOid = clEl.getAttribute("OID");
    if (!clOid) return;
    const clName = clEl.getAttribute("Name") || clOid;
    const nciCode =
      clEl.getAttribute("def:NCICode") ||
      clEl.getAttribute("NCICode") ||
      undefined;

    const itemEls = getElementsByLocalName(clEl, "CodeListItem");
    const options: CodelistOption[] = itemEls.map((itemEl, idx) => {
      const code = itemEl.getAttribute("CodedValue") || String(idx + 1);
      const decodes = getElementsByLocalName(itemEl, "TranslatedText");
      const label =
        decodes.length > 0 ? (decodes[0].textContent || "").trim() : code;
      const optNci =
        itemEl.getAttribute("def:NCICode") ||
        itemEl.getAttribute("NCICode") ||
        undefined;
      return {
        code,
        label: label || code,
        nciCode: optNci,
        order: idx + 1,
      };
    });

    const codelistDef: CodelistDefinition = {
      id: clOid,
      name: clName,
      nciCodelistCode: nciCode,
      options,
      isStandard: Boolean(nciCode),
    };
    codelists.push(codelistDef);
    codelistMap.set(clOid, codelistDef);
  });

  // 2. ItemDefs (Fields)
  const itemDefMap = new Map<
    string,
    { field: CRFField; codelistId?: string }
  >();
  const itemDefEls = getElementsByLocalName(metaVerEl, "ItemDef");

  itemDefEls.forEach((itemEl) => {
    const itemOid = itemEl.getAttribute("OID");
    if (!itemOid) return;
    const name = itemEl.getAttribute("Name") || itemOid.replace(/^IT\./, "");
    const odmDataType = itemEl.getAttribute("DataType") || "text";
    const codelistOid = itemEl.getAttribute("CodeListOID") || undefined;

    const descTexts = getElementsByLocalName(itemEl, "TranslatedText");
    const label =
      descTexts.length > 0 ? (descTexts[0].textContent || "").trim() : name;

    const dataType = mapOdmDataTypeToClinical(odmDataType);

    const cleanVarName = name || itemOid.replace(/^IT\./, "");
    const field: CRFField = {
      id: itemOid.replace(/^IT\./, "fld_"),
      variableName: cleanVarName,
      label: label || cleanVarName,
      dataType,
      columnSpan: 6,
      required: false,
      codelistId: codelistOid,
    };

    itemDefMap.set(itemOid, { field, codelistId: codelistOid });
  });

  // 3. ItemGroupDefs (Sections)
  const sectionMap = new Map<string, CRFSection>();
  const itemGroupDefEls = getElementsByLocalName(metaVerEl, "ItemGroupDef");

  itemGroupDefEls.forEach((igEl) => {
    const igOid = igEl.getAttribute("OID");
    if (!igOid) return;
    const title = igEl.getAttribute("Name") || igOid;
    const isRepeating = igEl.getAttribute("Repeating") === "Yes";

    const itemRefs = getElementsByLocalName(igEl, "ItemRef");
    const fields: CRFField[] = [];

    itemRefs.forEach((itemRef) => {
      const itemOid = itemRef.getAttribute("ItemOID");
      if (!itemOid) return;
      const mandatory = itemRef.getAttribute("Mandatory") === "Yes";
      const itemDef = itemDefMap.get(itemOid);

      if (itemDef) {
        const fieldCopy: CRFField = {
          ...itemDef.field,
          required: mandatory,
        };
        fields.push(fieldCopy);
      } else {
        const cleanVar = itemOid.replace(/^IT\./, "");
        fields.push({
          id: `fld_${cleanVar.toLowerCase()}`,
          variableName: cleanVar,
          label: cleanVar,
          dataType: "text",
          columnSpan: 6,
          required: mandatory,
        });
      }
    });

    const cleanSecId = igOid
      .replace(/^IG\.[^.]+\./, "sec_")
      .replace(/^IG\./, "sec_");
    sectionMap.set(igOid, {
      id: cleanSecId,
      title,
      isRepeating,
      fields,
    });
  });

  // 4. FormDefs (Forms)
  const formMap = new Map<string, CRFForm>();
  const formDefEls = getElementsByLocalName(metaVerEl, "FormDef");

  formDefEls.forEach((formEl) => {
    const formOid = formEl.getAttribute("OID");
    if (!formOid) return;
    const formName = formEl.getAttribute("Name") || formOid;
    const isLogForm = formEl.getAttribute("Repeating") === "Yes";

    const igRefs = getElementsByLocalName(formEl, "ItemGroupRef");
    const sections: CRFSection[] = [];
    let domain = "GENERAL";

    igRefs.forEach((igRef) => {
      const igOid = igRef.getAttribute("ItemGroupOID");
      if (!igOid) return;
      const sec = sectionMap.get(igOid);

      const parts = igOid.split(".");
      if (parts.length >= 3 && parts[0] === "IG") {
        domain = parts[1];
      }

      if (sec) {
        sections.push(sec);
      }
    });

    const cleanFormId = formOid.replace(/^FORM\./, "");
    formMap.set(formOid, {
      id: cleanFormId,
      name: formName,
      domain,
      description: `${formName} eCRF Form`,
      version: "1.0",
      sections,
      rules: [],
      isLogForm,
    });
  });

  const forms = Array.from(formMap.values());

  // 5. StudyEventDefs (Visits)
  const visitMap = new Map<string, StudyVisit>();
  const studyEventDefEls = getElementsByLocalName(metaVerEl, "StudyEventDef");

  studyEventDefEls.forEach((seEl, idx) => {
    const seOid = seEl.getAttribute("OID");
    if (!seOid) return;
    const vName = seEl.getAttribute("Name") || seOid;
    const vType =
      (seEl.getAttribute("Type") as StudyVisit["visitType"]) || "Scheduled";
    const isRepeating = seEl.getAttribute("Repeating") === "Yes";

    const formRefs = getElementsByLocalName(seEl, "FormRef");
    const assignedFormIds: string[] = [];

    formRefs.forEach((fRef) => {
      const fOid = fRef.getAttribute("FormOID");
      if (!fOid) return;
      const cleanFId = fOid.replace(/^FORM\./, "");
      if (!assignedFormIds.includes(cleanFId)) {
        assignedFormIds.push(cleanFId);
      }
    });

    const cleanVisitId = seOid.replace(/^SE\./, "").toLowerCase();
    visitMap.set(seOid, {
      id: cleanVisitId || `vis_${idx + 1}`,
      oid: seOid,
      name: vName,
      visitType: vType,
      targetDay: idx * 7,
      windowBefore: 0,
      windowAfter: 0,
      assignedFormIds,
      isRepeating,
    });
  });

  let visits = Array.from(visitMap.values());

  if (visits.length === 0) {
    const allFormIds = forms.map((f) => f.id);
    visits = [
      {
        id: "vis_screening",
        oid: "SE.SCREENING",
        name: "Screening Visit",
        visitType: "Scheduled",
        targetDay: 0,
        windowBefore: 0,
        windowAfter: 0,
        assignedFormIds: allFormIds,
      },
    ];
  }

  // 6. Audit Trail
  const auditTrail: AuditTrailEntry[] = [];
  const auditRecordEls = getElementsByLocalName(metaVerEl, "AuditRecord");

  auditRecordEls.forEach((recEl, idx) => {
    const recId = recEl.getAttribute("ID") || `audit_${idx + 1}`;
    const userRef = getElementsByLocalName(recEl, "UserRef");
    const changedBy =
      userRef.length > 0
        ? userRef[0].getAttribute("UserOID") || "System"
        : "System";
    const userRole = getChildTextContent(recEl, "UserRole") || undefined;
    const timestamp =
      getChildTextContent(recEl, "DateTimeStamp") || creationDateTime;
    const actionType = getChildTextContent(recEl, "ActionType") || undefined;
    const targetId = getChildTextContent(recEl, "TargetID") || undefined;
    const formId = getChildTextContent(recEl, "FormOID") || undefined;
    const fieldId = getChildTextContent(recEl, "ItemOID") || undefined;
    const prevVal = getChildTextContent(recEl, "PreviousValue") || undefined;
    const newVal = getChildTextContent(recEl, "NewValue") || undefined;
    const reasonForChange =
      getChildTextContent(recEl, "ReasonForChange") || undefined;
    const diagnosticId =
      getChildTextContent(recEl, "DiagnosticID") || undefined;
    const details = getChildTextContent(recEl, "Details") || undefined;

    auditTrail.push({
      id: recId,
      timestamp,
      changedBy,
      userRole,
      actionType,
      targetId,
      formId,
      fieldId,
      previousValue: prevVal,
      newValue: newVal,
      reasonForChange,
      diagnosticId,
      details,
    });
  });

  return {
    id: `study_${protocolNumber.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
    protocolNumber,
    studyName,
    phase,
    sponsor: "Sponsor",
    therapeuticArea: "General",
    version,
    lastModified: creationDateTime,
    forms,
    visits,
    codelists,
    auditTrail,
    provenance: {
      sourceFormat: "CDISC ODM XML",
      sourceVersion: version,
      importedAt: new Date().toISOString(),
      importedBy: "Unverified Session",
    },
  };
}
