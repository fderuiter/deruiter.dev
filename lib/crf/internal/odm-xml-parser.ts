/**
 * CDISC ODM-XML v1.3.2 Deserializer and Parser (ODM v2.0 namespaces are out of scope)
 * Pure, runtime-agnostic XML parser converting CDISC ODM-XML v1.3.2 documents into
 * CRF Studio StudyProtocol models identically in Node.js and browser environments.
 */

import {
  CLINICAL_STANDARDS_PROFILE,
  standardCitation,
} from "@/lib/clinical-standards";
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
  EditCheckRule,
} from "../types";
import {
  XmlElementNode,
  parseXmlDocument,
  getXmlAttribute,
  getXmlTextContent,
  getDirectChildElements,
  queryElementsByLocalName,
  getFirstChildText,
} from "./codecs/xml-parser";

const VALID_ODM_VISIT_TYPES = new Set<StudyVisit["visitType"]>([
  "Scheduled",
  "Unscheduled",
  "Common",
]);

const VALID_CLINICAL_DATA_TYPES = new Set<ClinicalDataType>([
  "text",
  "textarea",
  "number",
  "integer",
  "date",
  "partial_date",
  "precision_date",
  "time",
  "datetime",
  "radio",
  "checkbox",
  "single_select",
  "multi_select",
  "calculated",
  "vas_scale",
  "nrs_scale",
  "repeating_table",
]);

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

/**
 * Reads direct `<Alias>` children of an element into a context-keyed map.
 */
function readDirectAliases(el: XmlElementNode): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const child of getDirectChildElements(el, "Alias")) {
    const ctx = getXmlAttribute(child, "Context");
    const name = getXmlAttribute(child, "Name");
    if (ctx && name !== undefined) {
      aliases.set(ctx, name);
    }
  }
  return aliases;
}

/**
 * The NCI C-code on a `<CodeList>` or `<CodeListItem>`: the Define-XML 2.1
 * `<Alias>` (`Context="nci:ExtCodeID"`), or the `def:NCICode` attribute earlier
 * CRF Studio exports wrote. Only the element's own `<Alias>` children count.
 */
function nciCodeOf(el: XmlElementNode): string | undefined {
  const aliases = readDirectAliases(el);
  return (
    aliases.get("nci:ExtCodeID") ||
    getXmlAttribute(el, "def:NCICode") ||
    getXmlAttribute(el, "NCICode") ||
    undefined
  );
}

function safeJsonParseRecord(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore invalid JSON alias payloads
  }
  return {};
}

function extractLocalFieldIdFromItemOid(
  itemOid: string,
  formId?: string
): string {
  if (formId && itemOid.startsWith(`IT.${formId}.`)) {
    const suffix = itemOid.slice(`IT.${formId}.`.length);
    return `fld_${suffix}`;
  }
  return itemOid.replace(/^IT\./, "fld_");
}

/**
 * Parses a CDISC ODM-XML v1.3.2 string into a StudyProtocol using a pure
 * XML parser without browser `DOMParser` or wall-clock dependencies.
 */
export function importStudyFromCdiscOdmXml(xmlContent: string): StudyProtocol {
  if (!xmlContent || typeof xmlContent !== "string" || !xmlContent.trim()) {
    throw new Error("Invalid CDISC ODM XML: Empty XML payload");
  }

  let xmlDoc: ReturnType<typeof parseXmlDocument>;
  try {
    xmlDoc = parseXmlDocument(xmlContent);
  } catch (err: unknown) {
    throw new Error(
      `Invalid CDISC ODM XML structure: ${(err as Error).message}`
    );
  }

  const odmEl =
    xmlDoc.root.localName.toLowerCase() === "odm"
      ? xmlDoc.root
      : queryElementsByLocalName(xmlDoc, "ODM")[0];
  if (!odmEl) {
    throw new Error("Invalid CDISC ODM XML: Missing root <ODM> element");
  }

  const odmNamespace = getXmlAttribute(odmEl, "xmlns") || "";
  const odmVersion =
    getXmlAttribute(odmEl, "ODMVersion") || CLINICAL_STANDARDS_PROFILE.ODM;
  if (odmVersion.startsWith("2.") || odmNamespace.includes("/odm/v2")) {
    throw new Error(
      `Unsupported CDISC ODM version "${odmVersion}": only ${standardCitation("ODM")} is supported`
    );
  }

  const creationDateTime =
    getXmlAttribute(odmEl, "CreationDateTime") || "1970-01-01T00:00:00.000Z";

  const studyEls = queryElementsByLocalName(odmEl, "Study");
  if (studyEls.length === 0) {
    throw new Error("Invalid CDISC ODM XML: Missing <Study> definition");
  }
  const studyEl = studyEls[0];
  const studyOid = getXmlAttribute(studyEl, "OID") || "STUDY01";

  // GlobalVariables
  const globalVars = getDirectChildElements(studyEl, "GlobalVariables");
  let studyName = "";
  let protocolNumber = "";
  let studyDescription = "";

  if (globalVars.length > 0) {
    studyName = getFirstChildText(globalVars[0], "StudyName");
    protocolNumber = getFirstChildText(globalVars[0], "ProtocolName");
    studyDescription = getFirstChildText(globalVars[0], "StudyDescription");
  }

  if (!protocolNumber) {
    protocolNumber = studyOid.replace(/^STUDY\./, "") || "STUDY01";
  }
  if (!studyName) {
    studyName = protocolNumber;
  }

  // BasicDefinitions -> MeasurementUnit
  const measurementUnitMap = new Map<string, string>();
  for (const basicDef of getDirectChildElements(studyEl, "BasicDefinitions")) {
    for (const muEl of getDirectChildElements(basicDef, "MeasurementUnit")) {
      const muOid = getXmlAttribute(muEl, "OID");
      if (!muOid) continue;
      const symbolTexts = queryElementsByLocalName(muEl, "TranslatedText");
      const symbol =
        (symbolTexts.length > 0
          ? getXmlTextContent(symbolTexts[0]).trim()
          : "") ||
        getXmlAttribute(muEl, "Name") ||
        muOid.replace(/^MU\./, "");
      measurementUnitMap.set(muOid, symbol);
    }
  }

  // MetaDataVersion
  const metaVerEls = getDirectChildElements(studyEl, "MetaDataVersion");
  const metaVerEl = metaVerEls.length > 0 ? metaVerEls[0] : studyEl;
  const version =
    getXmlAttribute(metaVerEl, "Name")?.replace(/.*Version\s*/i, "") ||
    getXmlAttribute(metaVerEl, "OID")?.replace(/^MDV\./, "") ||
    "1.0";

  // Protocol-level crfs:studyMeta Alias
  const protocolEls = getDirectChildElements(metaVerEl, "Protocol");
  const protocolAliases =
    protocolEls.length > 0
      ? readDirectAliases(protocolEls[0])
      : new Map<string, string>();
  const studyMeta = safeJsonParseRecord(protocolAliases.get("crfs:studyMeta"));

  // Infer phase from studyMeta or studyDescription
  let phase: StudyProtocol["phase"] = "Phase III";
  if (
    typeof studyMeta.phase === "string" &&
    [
      "Phase I",
      "Phase I/II",
      "Phase II",
      "Phase III",
      "Phase IV",
      "Registry",
    ].includes(studyMeta.phase)
  ) {
    phase = studyMeta.phase as StudyProtocol["phase"];
  } else if (/\bphase\s*i\/ii\b/i.test(studyDescription)) phase = "Phase I/II";
  else if (/\bphase\s*iii\b/i.test(studyDescription)) phase = "Phase III";
  else if (/\bphase\s*ii\b/i.test(studyDescription)) phase = "Phase II";
  else if (/\bphase\s*iv\b/i.test(studyDescription)) phase = "Phase IV";
  else if (/\bphase\s*i\b/i.test(studyDescription)) phase = "Phase I";
  else if (/registry/i.test(studyDescription)) phase = "Registry";

  // CodeLists
  const codelists: CodelistDefinition[] = [];
  const codelistMap = new Map<string, CodelistDefinition>();
  const inlineFieldCodelistIds = new Set<string>();
  const codeListEls = getDirectChildElements(metaVerEl, "CodeList");

  codeListEls.forEach((clEl) => {
    const clOid = getXmlAttribute(clEl, "OID");
    if (!clOid) return;
    const clName = getXmlAttribute(clEl, "Name") || clOid;
    const nciCode = nciCodeOf(clEl);

    const itemEls = getDirectChildElements(clEl, "CodeListItem");
    const options: CodelistOption[] = itemEls.map((itemEl, idx) => {
      const code = getXmlAttribute(itemEl, "CodedValue") || String(idx + 1);
      const decodes = queryElementsByLocalName(itemEl, "TranslatedText");
      const label =
        decodes.length > 0 ? getXmlTextContent(decodes[0]).trim() : code;
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

  // MethodDefs
  const methodDefMap = new Map<
    string,
    { formula: string; targetItemOid?: string; name: string }
  >();
  for (const methEl of getDirectChildElements(metaVerEl, "MethodDef")) {
    const mOid = getXmlAttribute(methEl, "OID");
    if (!mOid) continue;
    const mName = getXmlAttribute(methEl, "Name") || mOid;
    const formalEls = getDirectChildElements(methEl, "FormalExpression");
    const formula =
      formalEls.length > 0 ? getXmlTextContent(formalEls[0]).trim() : "";
    const aliases = readDirectAliases(methEl);
    if (formula) {
      methodDefMap.set(mOid, {
        formula,
        targetItemOid: aliases.get("crfs:targetItem"),
        name: mName,
      });
    }
  }

  // ConditionDefs
  interface ParsedConditionDef {
    oid: string;
    name: string;
    description: string;
    expression: string;
    formId?: string;
    ruleAst?: EditCheckRule;
  }
  const conditionDefMap = new Map<string, ParsedConditionDef>();
  for (const condEl of getDirectChildElements(metaVerEl, "ConditionDef")) {
    const cOid = getXmlAttribute(condEl, "OID");
    if (!cOid) continue;
    const cName = getXmlAttribute(condEl, "Name") || cOid;
    const descEls = getDirectChildElements(condEl, "Description");
    const descTexts =
      descEls.length > 0
        ? queryElementsByLocalName(descEls[0], "TranslatedText")
        : [];
    const description =
      descTexts.length > 0 ? getXmlTextContent(descTexts[0]).trim() : cName;
    const formalEls = getDirectChildElements(condEl, "FormalExpression");
    const expression =
      formalEls.length > 0 ? getXmlTextContent(formalEls[0]).trim() : "";
    const aliases = readDirectAliases(condEl);
    let ruleAst: EditCheckRule | undefined;
    const rawRuleAst = aliases.get("crfs:ruleAst");
    if (rawRuleAst) {
      try {
        const parsed = JSON.parse(rawRuleAst) as EditCheckRule;
        if (
          parsed &&
          typeof parsed === "object" &&
          typeof parsed.id === "string"
        ) {
          ruleAst = parsed;
        }
      } catch {
        // Ignore malformed ruleAst JSON
      }
    }
    conditionDefMap.set(cOid, {
      oid: cOid,
      name: cName,
      description,
      expression,
      formId: aliases.get("crfs:formId"),
      ruleAst,
    });
  }

  // ItemDefs (Fields)
  interface ParsedItemDef {
    field: CRFField;
    formId?: string;
    codelistId?: string;
    hasInlineCustomOptions?: boolean;
  }
  const itemDefMap = new Map<string, ParsedItemDef>();
  const itemDefEls = getDirectChildElements(metaVerEl, "ItemDef");

  itemDefEls.forEach((itemEl) => {
    const itemOid = getXmlAttribute(itemEl, "OID");
    if (!itemOid) return;
    const aliases = readDirectAliases(itemEl);
    const formIdHint = aliases.get("crfs:formId");
    const fieldMeta = safeJsonParseRecord(aliases.get("crfs:fieldMeta"));

    const name =
      getXmlAttribute(itemEl, "Name") ||
      (formIdHint && itemOid.startsWith(`IT.${formIdHint}.`)
        ? itemOid.slice(`IT.${formIdHint}.`.length)
        : itemOid.replace(/^IT\./, ""));
    const odmDataType = getXmlAttribute(itemEl, "DataType") || "text";

    const codeListRefEl = getDirectChildElements(itemEl, "CodeListRef")[0];
    const codelistOid =
      (codeListRefEl
        ? getXmlAttribute(codeListRefEl, "CodeListOID")
        : undefined) ||
      getXmlAttribute(itemEl, "CodeListOID") ||
      undefined;

    const descEls = getDirectChildElements(itemEl, "Description");
    const descTexts =
      descEls.length > 0
        ? queryElementsByLocalName(descEls[0], "TranslatedText")
        : queryElementsByLocalName(itemEl, "TranslatedText");
    const label =
      descTexts.length > 0 ? getXmlTextContent(descTexts[0]).trim() : name;

    const questionEls = getDirectChildElements(itemEl, "Question");
    const questionTexts =
      questionEls.length > 0
        ? queryElementsByLocalName(questionEls[0], "TranslatedText")
        : [];
    const questionText =
      questionTexts.length > 0
        ? getXmlTextContent(questionTexts[0]).trim()
        : undefined;

    const aliasDataType = aliases.get("crfs:dataType") as
      ClinicalDataType | undefined;
    let dataType: ClinicalDataType =
      aliasDataType && VALID_CLINICAL_DATA_TYPES.has(aliasDataType)
        ? aliasDataType
        : mapOdmDataTypeToClinical(odmDataType);
    if (!aliasDataType && codelistOid && dataType === "text") {
      dataType = "single_select";
    }

    // MeasurementUnitRefs on ItemDef
    const muRefEls = getDirectChildElements(itemEl, "MeasurementUnitRef");
    const resolvedUnits: string[] = [];
    for (const muRef of muRefEls) {
      const muOid = getXmlAttribute(muRef, "MeasurementUnitOID");
      if (!muOid) continue;
      const u = measurementUnitMap.get(muOid) || muOid.replace(/^MU\./, "");
      if (u && !resolvedUnits.includes(u)) {
        resolvedUnits.push(u);
      }
    }

    // RangeChecks on ItemDef
    let minValue: number | undefined;
    let maxValue: number | undefined;
    for (const rcEl of getDirectChildElements(itemEl, "RangeCheck")) {
      const comparator = (
        getXmlAttribute(rcEl, "Comparator") || ""
      ).toUpperCase();
      const checkValText = getFirstChildText(rcEl, "CheckValue");
      const parsedBound = Number(checkValText);
      if (!checkValText || !Number.isFinite(parsedBound)) continue;
      if (comparator === "GE" || comparator === "GT") {
        minValue = parsedBound;
      } else if (comparator === "LE" || comparator === "LT") {
        maxValue = parsedBound;
      }
    }

    const cleanVarName = name || itemOid.replace(/^IT\./, "");
    const fieldId =
      aliases.get("crfs:fieldId") ||
      extractLocalFieldIdFromItemOid(itemOid, formIdHint);

    const hasInlineCustomOptions = Boolean(fieldMeta.hasInlineCustomOptions);
    let effectiveCodelistId = codelistOid;
    let customOptions: CodelistOption[] | undefined;
    if (hasInlineCustomOptions && codelistOid && codelistMap.has(codelistOid)) {
      customOptions = codelistMap.get(codelistOid)!.options;
      inlineFieldCodelistIds.add(codelistOid);
      effectiveCodelistId = undefined;
    }

    const sdtmAnnotation = aliases.get("SDTM");
    const cdashMetadata =
      (fieldMeta.cdashMetadata as CRFField["cdashMetadata"]) ||
      (sdtmAnnotation
        ? {
            domain: "",
            cdashVariable: cleanVarName,
            sdtmVariable: cleanVarName,
            cdashLabel: label || cleanVarName,
            questionText: questionText || label || cleanVarName,
            core: "O" as const,
            dataCategory: "Findings" as const,
            acrfAnnotation: sdtmAnnotation,
          }
        : undefined);

    const unit =
      (typeof fieldMeta.unit === "string" ? fieldMeta.unit : undefined) ??
      resolvedUnits[0];
    const unitOptions =
      (Array.isArray(fieldMeta.unitOptions)
        ? (fieldMeta.unitOptions as string[])
        : undefined) ?? (resolvedUnits.length > 1 ? resolvedUnits : undefined);

    const field: CRFField = {
      id: fieldId,
      variableName: cleanVarName,
      label: label || cleanVarName,
      ...(questionText && questionText !== (label || cleanVarName)
        ? { questionText }
        : {}),
      dataType,
      columnSpan:
        typeof fieldMeta.columnSpan === "number"
          ? (fieldMeta.columnSpan as CRFField["columnSpan"])
          : 6,
      required: false,
      ...(effectiveCodelistId ? { codelistId: effectiveCodelistId } : {}),
      ...(customOptions ? { customOptions } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(unitOptions !== undefined ? { unitOptions } : {}),
      ...(minValue !== undefined ? { minValue } : {}),
      ...(maxValue !== undefined ? { maxValue } : {}),
      ...(typeof fieldMeta.precision === "number"
        ? { precision: fieldMeta.precision }
        : {}),
      ...(typeof fieldMeta.placeholder === "string"
        ? { placeholder: fieldMeta.placeholder }
        : {}),
      ...(typeof fieldMeta.helpText === "string"
        ? { helpText: fieldMeta.helpText }
        : {}),
      ...(fieldMeta.defaultValue !== undefined
        ? {
            defaultValue: fieldMeta.defaultValue as string | number | boolean,
          }
        : {}),
      ...(cdashMetadata ? { cdashMetadata } : {}),
      ...(typeof fieldMeta.sdvVerified === "boolean"
        ? { sdvVerified: fieldMeta.sdvVerified }
        : {}),
      ...(Array.isArray(fieldMeta.repeatingColumns)
        ? {
            repeatingColumns:
              fieldMeta.repeatingColumns as CRFField["repeatingColumns"],
          }
        : {}),
    };

    itemDefMap.set(itemOid, {
      field,
      formId: formIdHint,
      codelistId: effectiveCodelistId,
      hasInlineCustomOptions,
    });
  });

  // Remove synthesized inline field codelists from study-level codelists
  const finalCodelists = codelists.filter(
    (cl) => !inlineFieldCodelistIds.has(cl.id)
  );

  // ItemGroupDefs (Sections)
  interface ParsedSectionEntry {
    section: CRFSection;
    synthesizedRules: EditCheckRule[];
  }
  const sectionMap = new Map<string, ParsedSectionEntry>();
  const itemGroupDefEls = getDirectChildElements(metaVerEl, "ItemGroupDef");

  itemGroupDefEls.forEach((igEl) => {
    const igOid = getXmlAttribute(igEl, "OID");
    if (!igOid) return;
    const title = getXmlAttribute(igEl, "Name") || igOid;
    const isRepeating = getXmlAttribute(igEl, "Repeating") === "Yes";
    const igAliases = readDirectAliases(igEl);

    const descEls = getDirectChildElements(igEl, "Description");
    const descTexts =
      descEls.length > 0
        ? queryElementsByLocalName(descEls[0], "TranslatedText")
        : [];
    const description =
      descTexts.length > 0 ? getXmlTextContent(descTexts[0]).trim() : undefined;

    const itemRefs = getDirectChildElements(igEl, "ItemRef");
    const fields: CRFField[] = [];
    const synthesizedRules: EditCheckRule[] = [];

    itemRefs.forEach((itemRef) => {
      const itemOid = getXmlAttribute(itemRef, "ItemOID");
      if (!itemOid) return;
      const mandatory = getXmlAttribute(itemRef, "Mandatory") === "Yes";
      const methodOid = getXmlAttribute(itemRef, "MethodOID");
      const condOid = getXmlAttribute(
        itemRef,
        "CollectionExceptionConditionOID"
      );
      const itemDef = itemDefMap.get(itemOid);

      let fieldCopy: CRFField;
      if (itemDef) {
        fieldCopy = {
          ...itemDef.field,
          required: mandatory,
        };
      } else {
        const cleanVar = itemOid.replace(/^IT\./, "");
        fieldCopy = {
          id: `fld_${cleanVar.toLowerCase()}`,
          variableName: cleanVar,
          label: cleanVar,
          dataType: "text",
          columnSpan: 6,
          required: mandatory,
        };
      }

      if (methodOid && methodDefMap.has(methodOid)) {
        const meth = methodDefMap.get(methodOid)!;
        if (!methodOid.startsWith("METH.RULE.")) {
          fieldCopy.calculationFormula = meth.formula;
          if (fieldCopy.dataType === "number") {
            fieldCopy.dataType = "calculated";
          }
        }
      }

      if (condOid && conditionDefMap.has(condOid)) {
        const cond = conditionDefMap.get(condOid)!;
        if (!cond.ruleAst) {
          synthesizedRules.push({
            id: cond.oid.replace(/[^A-Za-z0-9_-]/g, "_"),
            name: cond.name,
            description: cond.description,
            triggerFieldIds: [],
            actionType: "show_field",
            targetFieldId: fieldCopy.id,
            conditions: [],
            logicalOperator: "AND",
            ...(cond.expression
              ? {
                  unsupportedExpression: {
                    raw: cond.expression,
                    reason: "Unparsed ODM ConditionDef FormalExpression",
                  },
                }
              : {}),
          });
        }
      }

      fields.push(fieldCopy);
    });

    const cleanSecId =
      igAliases.get("crfs:sectionId") ||
      igOid.replace(/^IG\.[^.]+\./, "sec_").replace(/^IG\./, "sec_");
    const repeatMaxStr = igAliases.get("crfs:repeatMax");
    const repeatMax =
      repeatMaxStr !== undefined && Number.isFinite(Number(repeatMaxStr))
        ? Number(repeatMaxStr)
        : undefined;

    sectionMap.set(igOid, {
      section: {
        id: cleanSecId,
        title,
        ...(description ? { description } : {}),
        isRepeating,
        ...(repeatMax !== undefined ? { repeatMax } : {}),
        fields,
      },
      synthesizedRules,
    });
  });

  // Group ConditionDefs carrying crfs:ruleAst by formId
  const rulesByFormId = new Map<string, EditCheckRule[]>();
  conditionDefMap.forEach((cond) => {
    if (cond.ruleAst && cond.formId) {
      const list = rulesByFormId.get(cond.formId) || [];
      list.push(cond.ruleAst);
      rulesByFormId.set(cond.formId, list);
    }
  });

  // FormDefs (Forms)
  const formMap = new Map<string, CRFForm>();
  const formDefEls = getDirectChildElements(metaVerEl, "FormDef");

  formDefEls.forEach((formEl) => {
    const formOid = getXmlAttribute(formEl, "OID");
    if (!formOid) return;
    const formName = getXmlAttribute(formEl, "Name") || formOid;
    const isLogForm = getXmlAttribute(formEl, "Repeating") === "Yes";
    const formAliases = readDirectAliases(formEl);

    const descEls = getDirectChildElements(formEl, "Description");
    const descTexts =
      descEls.length > 0
        ? queryElementsByLocalName(descEls[0], "TranslatedText")
        : [];
    const parsedDesc =
      descTexts.length > 0 ? getXmlTextContent(descTexts[0]).trim() : "";

    const igRefs = getDirectChildElements(formEl, "ItemGroupRef");
    const sections: CRFSection[] = [];
    const extraRules: EditCheckRule[] = [];
    let domain = formAliases.get("crfs:domain") || "GENERAL";

    igRefs.forEach((igRef) => {
      const igOid = getXmlAttribute(igRef, "ItemGroupOID");
      if (!igOid) return;
      const entry = sectionMap.get(igOid);

      if (!formAliases.has("crfs:domain")) {
        const parts = igOid.split(".");
        if (parts.length >= 3 && parts[0] === "IG") {
          domain = parts[1];
        }
      }

      if (entry) {
        // Clone fields when a shared ItemGroupDef is referenced across multiple forms
        sections.push({
          ...entry.section,
          fields: entry.section.fields.map((f) => ({ ...f })),
        });
        extraRules.push(...entry.synthesizedRules);
      }
    });

    const cleanFormId = formOid.replace(/^FORM\./, "");
    const formRules = [
      ...(rulesByFormId.get(cleanFormId) || []),
      ...extraRules,
    ];

    formMap.set(formOid, {
      id: cleanFormId,
      name: formName,
      domain,
      description: parsedDesc || `${formName} eCRF Form`,
      version: formAliases.get("crfs:version") || "1.0",
      sections,
      rules: formRules,
      isLogForm,
    });
  });

  let forms = Array.from(formMap.values());

  // Fallback for standalone ODM snippets that declare <ItemDef> without <FormDef>
  if (forms.length === 0 && itemDefMap.size > 0) {
    forms = [
      {
        id: "form_odm_default",
        name: `${studyName} Form`,
        domain: "GENERAL",
        description: `${studyName} eCRF Form`,
        version,
        isLogForm: false,
        rules: [],
        sections: [
          {
            id: "sec_default",
            title: "General",
            fields: Array.from(itemDefMap.values()).map((entry) => ({
              ...entry.field,
            })),
          },
        ],
      },
    ];
  }

  // StudyEventDefs (Visits)
  const visitMap = new Map<string, StudyVisit>();
  const studyEventDefEls = getDirectChildElements(metaVerEl, "StudyEventDef");

  studyEventDefEls.forEach((seEl, idx) => {
    const seOid = getXmlAttribute(seEl, "OID");
    if (!seOid) return;
    const vName = getXmlAttribute(seEl, "Name") || seOid;
    const rawType = getXmlAttribute(seEl, "Type");
    if (
      rawType !== undefined &&
      !VALID_ODM_VISIT_TYPES.has(rawType as StudyVisit["visitType"])
    ) {
      throw new Error(
        `Invalid CDISC ODM StudyEventDef Type "${rawType}" on "${seOid}". Expected "Scheduled", "Unscheduled", or "Common".`
      );
    }
    const vType: StudyVisit["visitType"] =
      (rawType as StudyVisit["visitType"]) || "Scheduled";
    const isRepeating = getXmlAttribute(seEl, "Repeating") === "Yes";
    const seAliases = readDirectAliases(seEl);
    const visitMeta = safeJsonParseRecord(seAliases.get("crfs:visitMeta"));

    const formRefs = getDirectChildElements(seEl, "FormRef");
    const assignedFormIds: string[] = [];

    formRefs.forEach((fRef) => {
      const fOid = getXmlAttribute(fRef, "FormOID");
      if (!fOid) return;
      const cleanFId = fOid.replace(/^FORM\./, "");
      if (!assignedFormIds.includes(cleanFId)) {
        assignedFormIds.push(cleanFId);
      }
    });

    const cleanVisitId =
      seAliases.get("crfs:visitId") ||
      seOid.replace(/^SE\./, "").toLowerCase() ||
      `vis_${idx + 1}`;

    const parseAliasInt = (key: string, fallback: number): number => {
      const raw = seAliases.get(key);
      if (raw === undefined) return fallback;
      const n = Number(raw);
      return Number.isFinite(n) ? n : fallback;
    };

    const repeatMaxRaw = seAliases.get("crfs:repeatMax");
    const repeatMax =
      repeatMaxRaw !== undefined && Number.isFinite(Number(repeatMaxRaw))
        ? Number(repeatMaxRaw)
        : undefined;

    visitMap.set(seOid, {
      id: cleanVisitId,
      oid: seOid,
      name: vName,
      visitType: vType,
      targetDay: parseAliasInt("crfs:targetDay", idx * 7),
      windowBefore: parseAliasInt("crfs:windowBefore", 0),
      windowAfter: parseAliasInt("crfs:windowAfter", 0),
      assignedFormIds,
      isRepeating,
      ...(repeatMax !== undefined ? { repeatMax } : {}),
      ...(typeof visitMeta.epochId === "string"
        ? { epochId: visitMeta.epochId }
        : {}),
      ...(visitMeta.armFormAssignments
        ? {
            armFormAssignments:
              visitMeta.armFormAssignments as StudyVisit["armFormAssignments"],
          }
        : {}),
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

  // Audit Trail
  const auditTrail: AuditTrailEntry[] = [];
  const auditRecordEls = queryElementsByLocalName(metaVerEl, "AuditRecord");

  auditRecordEls.forEach((recEl, idx) => {
    const recId = getXmlAttribute(recEl, "ID") || `audit_${idx + 1}`;
    const userRef = getDirectChildElements(recEl, "UserRef");
    const changedBy =
      userRef.length > 0
        ? getXmlAttribute(userRef[0], "UserOID") || "System"
        : "System";
    const userRole = getFirstChildText(recEl, "UserRole") || undefined;
    const timestamp =
      getFirstChildText(recEl, "DateTimeStamp") || creationDateTime;
    const actionType = getFirstChildText(recEl, "ActionType") || undefined;
    const targetId = getFirstChildText(recEl, "TargetID") || undefined;
    const formId = getFirstChildText(recEl, "FormOID") || undefined;
    const fieldId = getFirstChildText(recEl, "ItemOID") || undefined;
    const prevVal = getFirstChildText(recEl, "PreviousValue") || undefined;
    const newVal = getFirstChildText(recEl, "NewValue") || undefined;
    const reasonForChange =
      getFirstChildText(recEl, "ReasonForChange") || undefined;
    const diagnosticId = getFirstChildText(recEl, "DiagnosticID") || undefined;
    const details = getFirstChildText(recEl, "Details") || undefined;

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
    id:
      typeof studyMeta.id === "string" && studyMeta.id
        ? studyMeta.id
        : `study_${protocolNumber.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
    protocolNumber,
    ...(typeof studyMeta.protocolId === "string"
      ? { protocolId: studyMeta.protocolId }
      : {}),
    studyName,
    phase,
    sponsor:
      typeof studyMeta.sponsor === "string" && studyMeta.sponsor
        ? studyMeta.sponsor
        : "Sponsor",
    therapeuticArea:
      typeof studyMeta.therapeuticArea === "string" && studyMeta.therapeuticArea
        ? studyMeta.therapeuticArea
        : "General",
    version,
    lastModified:
      typeof studyMeta.lastModified === "string" && studyMeta.lastModified
        ? studyMeta.lastModified
        : creationDateTime,
    forms,
    visits,
    codelists: finalCodelists,
    auditTrail,
    ...(Array.isArray(studyMeta.arms)
      ? { arms: studyMeta.arms as StudyProtocol["arms"] }
      : {}),
    ...(Array.isArray(studyMeta.epochs)
      ? { epochs: studyMeta.epochs as StudyProtocol["epochs"] }
      : {}),
    ...(Array.isArray(studyMeta.cohorts)
      ? { cohorts: studyMeta.cohorts as StudyProtocol["cohorts"] }
      : {}),
    ...(Array.isArray(studyMeta.biomedicalConcepts)
      ? {
          biomedicalConcepts:
            studyMeta.biomedicalConcepts as StudyProtocol["biomedicalConcepts"],
        }
      : {}),
    ...(studyMeta.branding
      ? { branding: studyMeta.branding as StudyProtocol["branding"] }
      : {}),
    ...(Array.isArray(studyMeta.reviewThreads)
      ? {
          reviewThreads:
            studyMeta.reviewThreads as StudyProtocol["reviewThreads"],
        }
      : {}),
    ...(Array.isArray(studyMeta.testScenarios)
      ? {
          testScenarios:
            studyMeta.testScenarios as StudyProtocol["testScenarios"],
        }
      : {}),
    ...(studyMeta.simulationState
      ? {
          simulationState:
            studyMeta.simulationState as StudyProtocol["simulationState"],
        }
      : {}),
    provenance: {
      sourceFormat: "CDISC ODM XML",
      sourceVersion: version,
      importedBy: "Unverified Session",
    },
  };
}
