/**
 * CDISC ODM-XML Deserializer and Parser (ODM v2.0 namespaces are not handled)
 * Converts CDISC ODM XML syntax into CRF Studio StudyProtocol via a pure
 * zero-DOM XML tree scanner (`./xml-tree`).
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
  EDCQuery,
  EdcSimulationState,
  ElectronicSignature,
} from "../types";
import {
  parseXmlDocument,
  type XmlDocumentNode,
  type XmlElementNode,
} from "./xml-tree";

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
  parent: XmlElementNode | XmlDocumentNode,
  localName: string
): XmlElementNode[] {
  const result: XmlElementNode[] = [];
  const targetLower = localName.toLowerCase();
  const visitChildren = (children: readonly XmlElementNode[]) => {
    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      if (el.localName.toLowerCase() === targetLower) {
        result.push(el);
      }
      if (el.children.length > 0) {
        visitChildren(el.children);
      }
    }
  };
  visitChildren(parent.children);
  return result;
}

/**
 * The NCI C-code on a CodeList or CodeListItem: the Define-XML Alias
 * (`Context="nci:ExtCodeID"`), or the `def:NCICode` attribute earlier CRF
 * Studio exports wrote. Only the element's own Alias children count, so a
 * CodeList does not pick up one of its items' codes.
 */
function nciCodeOf(el: XmlElementNode): string | undefined {
  const alias = el.children.find(
    (child) =>
      child.localName === "Alias" &&
      child.getAttribute("Context") === "nci:ExtCodeID"
  );
  return (
    alias?.getAttribute("Name") ||
    el.getAttribute("def:NCICode") ||
    el.getAttribute("NCICode") ||
    undefined
  );
}

function aliasNameOf(el: XmlElementNode, context: string): string | undefined {
  const alias = el.children.find(
    (child) =>
      child.localName === "Alias" && child.getAttribute("Context") === context
  );
  return alias?.getAttribute("Name") || undefined;
}

function getDirectChildrenByLocalName(
  parent: XmlElementNode,
  localName: string
): XmlElementNode[] {
  const target = localName.toLowerCase();
  return parent.children.filter(
    (child) => child.localName.toLowerCase() === target
  );
}

function coerceClinicalItemValue(
  raw: string,
  isNull: boolean,
  field?: CRFField
): string | number | boolean | null {
  if (isNull) return null;
  if (!field) return raw;
  if (
    field.dataType === "integer" ||
    field.dataType === "number" ||
    field.dataType === "calculated" ||
    field.dataType === "vas_scale" ||
    field.dataType === "nrs_scale"
  ) {
    if (raw !== "") {
      const num = Number(raw);
      if (Number.isFinite(num)) return num;
    }
  }
  if (field.dataType === "checkbox" && (raw === "true" || raw === "false")) {
    return raw === "true";
  }
  return raw;
}

function normalizeSignatureMeaning(
  raw: string | undefined
): ElectronicSignature["meaning"] {
  if (
    raw === "Author" ||
    raw === "Investigator Approval" ||
    raw === "Data Lock" ||
    raw === "Monitor Verification"
  ) {
    return raw;
  }
  return "Investigator Approval";
}

function getChildTextContent(
  parent: XmlElementNode,
  localName: string
): string {
  const children = getElementsByLocalName(parent, localName);
  return children.length > 0 ? (children[0].textContent || "").trim() : "";
}

/**
 * Parses a CDISC ODM XML string into a StudyProtocol.
 */
export function importStudyFromCdiscOdmXml(xmlContent: string): StudyProtocol {
  if (!xmlContent || typeof xmlContent !== "string" || !xmlContent.trim()) {
    throw new Error("Invalid CDISC ODM XML: Empty XML payload");
  }

  const xmlDoc = parseXmlDocument(xmlContent);

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
    const nciCode = nciCodeOf(clEl);

    const itemEls = getElementsByLocalName(clEl, "CodeListItem");
    const options: CodelistOption[] = itemEls.map((itemEl, idx) => {
      const code = itemEl.getAttribute("CodedValue") || String(idx + 1);
      const decodes = getElementsByLocalName(itemEl, "TranslatedText");
      const label =
        decodes.length > 0 ? (decodes[0].textContent || "").trim() : code;
      const optNci = nciCodeOf(itemEl);
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
    // ODM 1.3.2 names the codelist in a CodeListRef child; earlier CRF
    // Studio exports put a CodeListOID attribute on the ItemDef.
    const codelistOid =
      getElementsByLocalName(itemEl, "CodeListRef")[0]?.getAttribute(
        "CodeListOID"
      ) ||
      itemEl.getAttribute("CodeListOID") ||
      undefined;

    const descTexts = getElementsByLocalName(itemEl, "TranslatedText");
    const label =
      descTexts.length > 0 ? (descTexts[0].textContent || "").trim() : name;

    const dataType = mapOdmDataTypeToClinical(odmDataType);

    const cleanVarName = name || itemOid.replace(/^IT\./, "");
    const aliasedFieldId = aliasNameOf(itemEl, "crf-studio:fieldId");
    const sdtmAnnotation = aliasNameOf(itemEl, "SDTM");
    const field: CRFField = {
      id: aliasedFieldId || itemOid.replace(/^IT\./, "fld_"),
      variableName: cleanVarName,
      label: label || cleanVarName,
      dataType,
      columnSpan: 6,
      required: false,
      codelistId: codelistOid,
      ...(sdtmAnnotation
        ? {
            cdashMetadata: {
              domain: sdtmAnnotation.split(".")[0] || "CRF",
              sdtmVariable: sdtmAnnotation.split(".")[1] || cleanVarName,
              cdashLabel: label || cleanVarName,
              core: "O" as const,
              acrfAnnotation: sdtmAnnotation,
            },
          }
        : {}),
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

    const aliasedSecId = aliasNameOf(igEl, "crf-studio:sectionId");
    const cleanSecId =
      aliasedSecId ||
      igOid.replace(/^IG\.[^.]+\./, "sec_").replace(/^IG\./, "sec_");
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

    const aliasedVisitId = aliasNameOf(seEl, "crf-studio:visitId");
    const cleanVisitId =
      aliasedVisitId || seOid.replace(/^SE\./, "").toLowerCase();
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

  // 6. Design-Change Audit Trail (inside MetaDataVersion)
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

  // 7. AdminData (Users & SignatureDefs)
  const adminUsers = new Map<
    string,
    { displayName: string; userRole?: string }
  >();
  const adminSigDefs = new Map<string, string>();
  const adminDataEls = getDirectChildrenByLocalName(odmEl, "AdminData");

  adminDataEls.forEach((adminEl) => {
    getDirectChildrenByLocalName(adminEl, "User").forEach((userEl) => {
      const uOid = userEl.getAttribute("OID");
      if (!uOid) return;
      const displayName =
        getChildTextContent(userEl, "DisplayName") ||
        getChildTextContent(userEl, "FullName") ||
        getChildTextContent(userEl, "LoginName") ||
        uOid;
      const org = getChildTextContent(userEl, "Organization") || undefined;
      adminUsers.set(uOid, { displayName, userRole: org });
    });

    getDirectChildrenByLocalName(adminEl, "SignatureDef").forEach((sdEl) => {
      const sdOid = sdEl.getAttribute("OID");
      if (!sdOid) return;
      const meaning =
        getChildTextContent(sdEl, "Meaning") || "Investigator Approval";
      adminSigDefs.set(sdOid, meaning);
    });
  });

  // 8. ClinicalData -> study.simulationState
  let simulationState: EdcSimulationState | undefined;
  const clinicalDataEls = getDirectChildrenByLocalName(odmEl, "ClinicalData");

  if (clinicalDataEls.length > 0) {
    const availableSubjects: string[] = [];
    const seenSubjects = new Set<string>();
    const formValues: Record<string, string | number | boolean | null> = {};
    const auditLog: AuditTrailEntry[] = [];
    const signatures: ElectronicSignature[] = [];
    const queries: EDCQuery[] = [];
    let lockedForms: NonNullable<EdcSimulationState["lockedForms"]> = {};
    let sdvMap: NonNullable<EdcSimulationState["sdvMap"]> = {};

    const addSubject = (subj?: string) => {
      const trimmed = subj?.trim();
      if (trimmed && !seenSubjects.has(trimmed)) {
        seenSubjects.add(trimmed);
        availableSubjects.push(trimmed);
      }
    };

    const parseSignatureEl = (
      sigEl: XmlElementNode,
      idx: number,
      fallbackCtx?: { subjectId?: string; visitId?: string; formId?: string }
    ) => {
      const rawId = sigEl.getAttribute("ID") || `sig_${idx + 1}`;
      const userOid =
        getElementsByLocalName(sigEl, "UserRef")[0]?.getAttribute("UserOID") ||
        "";
      const sigDefOid =
        getElementsByLocalName(sigEl, "SignatureRef")[0]?.getAttribute(
          "SignatureOID"
        ) || "";
      const userInfo = adminUsers.get(userOid);
      const meaning = normalizeSignatureMeaning(
        adminSigDefs.get(sigDefOid) || sigDefOid || undefined
      );
      const ts =
        getChildTextContent(sigEl, "DateTimeStamp") || creationDateTime;
      const manifest = getChildTextContent(sigEl, "CryptoBindingManifest");

      const prefix = "urn:crf-studio:simulated-signature:";
      if (manifest.startsWith(prefix)) {
        try {
          const parsed = JSON.parse(
            manifest.slice(prefix.length)
          ) as Partial<ElectronicSignature>;
          const subj = parsed.subjectId || fallbackCtx?.subjectId || "001-101";
          addSubject(subj);
          signatures.push({
            id: parsed.id || rawId,
            subjectId: subj,
            visitId:
              parsed.visitId ||
              fallbackCtx?.visitId ||
              visits[0]?.id ||
              "vis_1",
            formId:
              parsed.formId || fallbackCtx?.formId || forms[0]?.id || "form_1",
            signedBy: userInfo?.displayName || userOid || "Investigator",
            userRole: userInfo?.userRole || "Principal Investigator",
            timestamp: ts,
            meaning,
            digest: parsed.digest || `sim_${idx + 1}`,
          });
          return;
        } catch {
          // Fall through to plain ODM signature handling
        }
      }

      const subj = fallbackCtx?.subjectId || availableSubjects[0] || "001-101";
      addSubject(subj);
      signatures.push({
        id: rawId,
        subjectId: subj,
        visitId: fallbackCtx?.visitId || visits[0]?.id || "vis_1",
        formId: fallbackCtx?.formId || forms[0]?.id || "form_1",
        signedBy: userInfo?.displayName || userOid || "Investigator",
        userRole: userInfo?.userRole || "Principal Investigator",
        timestamp: ts,
        meaning,
        digest: manifest || `sim_${idx + 1}`,
      });
    };

    const parseAuditEl = (
      recEl: XmlElementNode,
      idx: number,
      fallbackCtx?: {
        subjectId?: string;
        formId?: string;
        fieldId?: string;
        fieldName?: string;
      }
    ) => {
      const rawId = recEl.getAttribute("ID") || `aud_${idx + 1}`;
      const userOid =
        getElementsByLocalName(recEl, "UserRef")[0]?.getAttribute("UserOID") ||
        "";
      const userInfo = adminUsers.get(userOid);
      const ts =
        getChildTextContent(recEl, "DateTimeStamp") || creationDateTime;
      const reason = getChildTextContent(recEl, "ReasonForChange") || undefined;
      const sourceId = getChildTextContent(recEl, "SourceID");

      const prefix = "urn:crf-studio:audit:";
      if (sourceId.startsWith(prefix)) {
        try {
          const parsed = JSON.parse(
            sourceId.slice(prefix.length)
          ) as Partial<AuditTrailEntry>;
          if (parsed.subjectId) addSubject(parsed.subjectId);
          auditLog.push({
            id: parsed.id || rawId,
            timestamp: ts,
            changedBy: userInfo?.displayName || userOid || "System",
            userRole: userInfo?.userRole,
            subjectId: parsed.subjectId || fallbackCtx?.subjectId,
            formId: parsed.formId || fallbackCtx?.formId,
            fieldId: parsed.fieldId || fallbackCtx?.fieldId,
            fieldName: parsed.fieldName || fallbackCtx?.fieldName,
            previousValue:
              parsed.previousValue === undefined ? null : parsed.previousValue,
            newValue: parsed.newValue === undefined ? null : parsed.newValue,
            actionType: parsed.actionType,
            targetId: parsed.targetId,
            targetType: parsed.targetType,
            reasonForChange: reason,
          });
          return;
        } catch {
          // Fall through to plain ODM AuditRecord handling
        }
      }

      if (fallbackCtx?.subjectId) addSubject(fallbackCtx.subjectId);
      auditLog.push({
        id: rawId,
        timestamp: ts,
        changedBy: userInfo?.displayName || userOid || "System",
        userRole: userInfo?.userRole,
        subjectId: fallbackCtx?.subjectId,
        formId: fallbackCtx?.formId,
        fieldId: fallbackCtx?.fieldId,
        fieldName: fallbackCtx?.fieldName,
        previousValue: null,
        newValue: sourceId || null,
        reasonForChange: reason,
      });
    };

    clinicalDataEls.forEach((cdEl) => {
      // SubjectData
      getDirectChildrenByLocalName(cdEl, "SubjectData").forEach((subjEl) => {
        const subjectKey = subjEl.getAttribute("SubjectKey");
        if (!subjectKey) return;
        addSubject(subjectKey);

        getDirectChildrenByLocalName(subjEl, "StudyEventData").forEach(
          (seDataEl) => {
            const seOid = seDataEl.getAttribute("StudyEventOID") || "";
            const visit =
              visitMap.get(seOid) ||
              visits.find((v) => v.oid === seOid || v.id === seOid);
            const visitId =
              visit?.id ||
              seOid.replace(/^SE\./, "").toLowerCase() ||
              visits[0]?.id ||
              "vis_1";

            getDirectChildrenByLocalName(seDataEl, "FormData").forEach(
              (fDataEl) => {
                const fOid = fDataEl.getAttribute("FormOID") || "";
                const form =
                  formMap.get(fOid) ||
                  forms.find((f) => `FORM.${f.id}` === fOid || f.id === fOid);
                const formId = form?.id || fOid.replace(/^FORM\./, "");

                // Support inline FormData <Signature> in external ODM files
                getDirectChildrenByLocalName(fDataEl, "Signature").forEach(
                  (inlineSigEl, sIdx) => {
                    parseSignatureEl(inlineSigEl, signatures.length + sIdx, {
                      subjectId: subjectKey,
                      visitId,
                      formId,
                    });
                  }
                );

                getDirectChildrenByLocalName(fDataEl, "ItemGroupData").forEach(
                  (igDataEl) => {
                    const igOid = igDataEl.getAttribute("ItemGroupOID") || "";
                    const secFromMap = sectionMap.get(igOid);

                    Array.from(igDataEl.children).forEach((itemDataEl) => {
                      const localLower = itemDataEl.localName.toLowerCase();
                      if (!localLower.startsWith("itemdata")) return;
                      const itemOid = itemDataEl.getAttribute("ItemOID");
                      if (!itemOid) return;

                      const defEntry = itemDefMap.get(itemOid);
                      const varCandidate = itemOid.replace(/^IT\./, "");
                      const fieldInSection = secFromMap?.fields.find(
                        (f) =>
                          f.id === defEntry?.field.id ||
                          f.variableName === varCandidate
                      );
                      const fieldInForm = form?.sections
                        .flatMap((s) => s.fields)
                        .find(
                          (f) =>
                            f.id === defEntry?.field.id ||
                            f.variableName === varCandidate
                        );
                      const matchedField =
                        fieldInSection || fieldInForm || defEntry?.field;
                      const fieldId =
                        matchedField?.id || itemOid.replace(/^IT\./, "fld_");

                      const isNull =
                        itemDataEl.getAttribute("IsNull") === "Yes";
                      const rawVal = itemDataEl.hasAttribute("Value")
                        ? itemDataEl.getAttribute("Value") || ""
                        : (itemDataEl.textContent || "").trim();

                      formValues[`${subjectKey}_${visitId}_${fieldId}`] =
                        coerceClinicalItemValue(rawVal, isNull, matchedField);

                      // Support inline ItemData <AuditRecord> in external ODM files
                      getDirectChildrenByLocalName(
                        itemDataEl,
                        "AuditRecord"
                      ).forEach((inlineAud, aIdx) => {
                        parseAuditEl(inlineAud, auditLog.length + aIdx, {
                          subjectId: subjectKey,
                          formId,
                          fieldId,
                          fieldName: matchedField?.variableName || fieldId,
                        });
                      });
                    });
                  }
                );
              }
            );
          }
        );
      });

      // AuditRecords container
      getDirectChildrenByLocalName(cdEl, "AuditRecords").forEach((arGroup) => {
        getDirectChildrenByLocalName(arGroup, "AuditRecord").forEach(
          (recEl, idx) => {
            parseAuditEl(recEl, idx);
          }
        );
      });

      // Signatures container
      getDirectChildrenByLocalName(cdEl, "Signatures").forEach((sigGroup) => {
        getDirectChildrenByLocalName(sigGroup, "Signature").forEach(
          (sigEl, idx) => {
            parseSignatureEl(sigEl, idx);
          }
        );
      });

      // Annotations container (Queries + Locked/SDV state)
      getDirectChildrenByLocalName(cdEl, "Annotations").forEach((annGroup) => {
        getDirectChildrenByLocalName(annGroup, "Annotation").forEach(
          (annEl) => {
            const comment = getChildTextContent(annEl, "Comment");
            const queryPrefix = "urn:crf-studio:query:";
            const statePrefix = "urn:crf-studio:state:";
            if (comment.startsWith(queryPrefix)) {
              try {
                const parsedQuery = JSON.parse(
                  comment.slice(queryPrefix.length)
                ) as EDCQuery;
                if (parsedQuery && parsedQuery.id) {
                  addSubject(parsedQuery.subjectId);
                  queries.push(parsedQuery);
                }
              } catch {
                // Ignore non-JSON comments
              }
            } else if (comment.startsWith(statePrefix)) {
              try {
                const parsedState = JSON.parse(
                  comment.slice(statePrefix.length)
                ) as Pick<EdcSimulationState, "lockedForms" | "sdvMap">;
                if (
                  parsedState.lockedForms &&
                  typeof parsedState.lockedForms === "object"
                ) {
                  lockedForms = { ...lockedForms, ...parsedState.lockedForms };
                }
                if (
                  parsedState.sdvMap &&
                  typeof parsedState.sdvMap === "object"
                ) {
                  sdvMap = { ...sdvMap, ...parsedState.sdvMap };
                }
              } catch {
                // Ignore non-JSON state comments
              }
            }
          }
        );
      });
    });

    simulationState = {
      availableSubjects,
      formValues,
      auditLog,
      signatures,
      queries,
      lockedForms,
      sdvMap,
    };
  }

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
    ...(simulationState ? { simulationState } : {}),
    provenance: {
      sourceFormat: "CDISC ODM XML",
      sourceVersion: version,
      importedAt: new Date().toISOString(),
      importedBy: "Unverified Session",
    },
  };
}
