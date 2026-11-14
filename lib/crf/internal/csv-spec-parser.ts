/**
 * CSV Study Specification & REDCap Data Dictionary Parser
 * Converts structured CSV study specification rows or Vanderbilt REDCap
 * data dictionaries into CRF Studio StudyProtocol.
 */

import {
  StudyProtocol,
  CRFForm,
  CRFSection,
  CRFField,
  ClinicalDataType,
  CdashVariableMetadata,
  CodelistDefinition,
  CodelistOption,
  EditCheckRule,
  AstCondition,
  StudyVisit,
} from "../types";

function stripBom(text: string): string {
  if (text && text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

function stripHtmlAndEntities(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsvRows(text: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      lines.push(currentRow);
    }
  }

  return lines;
}

function normalizeDataType(rawType: string): ClinicalDataType {
  const t = (rawType || "").toLowerCase();
  if (t.includes("integer") || t === "int") return "integer";
  if (
    t.includes("number") ||
    t.includes("float") ||
    t.includes("decimal") ||
    t === "num"
  )
    return "number";
  if (t.includes("partial") && t.includes("date")) return "partial_date";
  if (t.includes("date")) return "date";
  if (t.includes("time") && !t.includes("date")) return "time";
  if (t.includes("datetime")) return "datetime";
  if (t.includes("radio")) return "radio";
  if (t.includes("check")) return "checkbox";
  if (t.includes("select") || t.includes("dropdown") || t.includes("code"))
    return "single_select";
  if (t.includes("calc")) return "calculated";
  return "text";
}

/**
 * Checks whether CSV header columns match the standard Vanderbilt REDCap Data Dictionary signature.
 */
export function isRedcapHeader(header: string[]): boolean {
  const normalized = header.map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, "")
  );

  const hasVarField = normalized.some(
    (h) =>
      h === "variablefieldname" ||
      h === "variablefield" ||
      (h.includes("variable") && h.includes("field"))
  );
  const hasFormName = normalized.some(
    (h) => h === "formname" || (h.includes("form") && h.includes("name"))
  );

  if (hasVarField && hasFormName) {
    return true;
  }

  let redcapScore = 0;
  if (hasVarField || hasFormName) redcapScore++;
  if (normalized.some((h) => h.includes("sectionheader"))) redcapScore++;
  if (normalized.some((h) => h.includes("fieldtype"))) redcapScore++;
  if (normalized.some((h) => h.includes("fieldlabel"))) redcapScore++;
  if (
    normalized.some((h) => h.includes("choices") || h.includes("sliderlabels"))
  )
    redcapScore++;
  if (normalized.some((h) => h.includes("branching"))) redcapScore++;
  if (normalized.some((h) => h.includes("validationtype"))) redcapScore++;

  return redcapScore >= 3;
}

/**
 * Inspects a raw CSV string to determine whether it matches REDCap dialect.
 */
export function isRedcapCsv(csvContent: string): boolean {
  if (!csvContent || typeof csvContent !== "string" || !csvContent.trim()) {
    return false;
  }
  const clean = stripBom(csvContent.trim());
  const rows = parseCsvRows(clean);
  if (rows.length === 0) return false;
  return isRedcapHeader(rows[0]);
}

/**
 * Returns dialect name: 'redcap' or 'cdisc_spec'
 */
export function detectCsvDialect(csvContent: string): "redcap" | "cdisc_spec" {
  return isRedcapCsv(csvContent) ? "redcap" : "cdisc_spec";
}

function mapRedcapFieldType(
  rawFieldType: string,
  rawValidation: string
): ClinicalDataType {
  const ft = (rawFieldType || "").trim().toLowerCase();
  const val = (rawValidation || "").trim().toLowerCase();

  switch (ft) {
    case "text": {
      if (val.includes("datetime")) return "datetime";
      if (val.includes("date")) return "date";
      if (val.includes("time")) return "time";
      if (val.includes("integer") || val === "int") return "integer";
      if (
        val.includes("number") ||
        val.includes("float") ||
        val.includes("decimal")
      )
        return "number";
      return "text";
    }
    case "notes":
      return "textarea";
    case "dropdown":
    case "sql":
      return "single_select";
    case "radio":
    case "yesno":
    case "truefalse":
      return "radio";
    case "checkbox":
      return "checkbox";
    case "calc":
      return "calculated";
    case "slider":
      return "vas_scale";
    case "file":
      if (val.includes("signature")) return "signature";
      return "text";
    case "descriptive":
      return "text";
    default: {
      if (ft === "integer" || ft === "int") return "integer";
      if (ft === "number" || ft === "float" || ft === "decimal")
        return "number";
      if (ft === "date") return "date";
      if (ft === "datetime") return "datetime";
      if (ft === "time") return "time";
      if (ft === "textarea") return "textarea";
      if (ft === "single_select" || ft === "select") return "single_select";
      if (ft === "multi_select") return "multi_select";
      return "text";
    }
  }
}

function parseChoices(fieldType: string, rawChoices: string): CodelistOption[] {
  const ft = (fieldType || "").trim().toLowerCase();
  if (ft === "yesno" && !rawChoices.trim()) {
    return [
      { code: "1", label: "Yes", order: 1 },
      { code: "0", label: "No", order: 2 },
    ];
  }
  if (ft === "truefalse" && !rawChoices.trim()) {
    return [
      { code: "1", label: "True", order: 1 },
      { code: "0", label: "False", order: 2 },
    ];
  }
  if (!rawChoices || !rawChoices.trim()) {
    return [];
  }

  const parts = rawChoices.split("|");
  const options: CodelistOption[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    const commaIdx = part.indexOf(",");
    if (commaIdx !== -1) {
      const code = part.slice(0, commaIdx).trim();
      const label = stripHtmlAndEntities(part.slice(commaIdx + 1).trim());
      options.push({
        code,
        label: label || code,
        order: options.length + 1,
      });
    } else {
      const trimmed = stripHtmlAndEntities(part);
      options.push({
        code: trimmed,
        label: trimmed,
        order: options.length + 1,
      });
    }
  }

  return options;
}

function formatFormTitle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "General Form";
  if (trimmed.includes("_")) {
    return trimmed
      .split("_")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  if (trimmed === trimmed.toLowerCase()) {
    return trimmed
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return trimmed;
}

function deriveDomainFromFormName(formName: string): string {
  const norm = formName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (norm.includes("demographic") || norm === "dm") return "DM";
  if (norm.includes("vital") || norm === "vs") return "VS";
  if (norm.includes("adverse") || norm === "ae") return "AE";
  if (
    norm.includes("medication") ||
    norm.includes("conmed") ||
    norm.includes("prior_med") ||
    norm === "cm"
  )
    return "CM";
  if (
    norm.includes("medicalhistory") ||
    norm.includes("medhistory") ||
    norm === "mh"
  )
    return "MH";
  if (norm.includes("lab") || norm === "lb") return "LB";
  if (
    norm.includes("eligib") ||
    norm.includes("inclusion") ||
    norm.includes("exclusion") ||
    norm === "ie"
  )
    return "IE";
  if (norm.includes("physical") || norm.includes("exam") || norm === "pe")
    return "PE";
  if (norm.includes("ecg") || norm.includes("electrocardio") || norm === "eg")
    return "EG";
  if (
    norm.includes("disposition") ||
    norm.includes("completion") ||
    norm === "ds"
  )
    return "DS";
  if (
    norm.includes("oncology") ||
    norm.includes("recist") ||
    norm.includes("tumor")
  )
    return "RECIST";

  const clean = formName.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (clean.length >= 2) {
    return clean.slice(0, 4);
  }
  return "FORM";
}

function parseBranchingLogic(
  rawLogic: string,
  targetFieldId: string,
  targetLabel: string,
  fieldVarToIdMap: Map<string, string>
): EditCheckRule | null {
  const trimmed = (rawLogic || "").trim();
  if (!trimmed) return null;

  const varMatches = trimmed.match(/\[([a-zA-Z0-9_]+)(?:\([0-9]+\))?\]/g) || [];
  const triggerFieldIds = Array.from(
    new Set(
      varMatches.map((m) => {
        const rawVar = m
          .replace(/[\[\]]/g, "")
          .split("(")[0]
          .toLowerCase();
        return fieldVarToIdMap.get(rawVar) || `fld_${rawVar}`;
      })
    )
  );

  const fallbackRule: EditCheckRule = {
    id: `rule_branch_${targetFieldId}`,
    name: `Show ${targetLabel}`,
    description: `Branching logic: ${trimmed}`,
    triggerFieldIds,
    actionType: "show_field",
    targetFieldId,
    conditions: [],
    logicalOperator: "AND",
    unsupportedExpression: {
      raw: trimmed,
      reason:
        "REDCap branching logic expression could not be mapped to standard conditions",
    },
  };

  // Check for unsupported functions or complex expressions
  if (
    /\b(datediff|sum|mean|min|max|stdev|round|floor|ceil)\b/i.test(trimmed) ||
    trimmed.includes("(") ||
    trimmed.includes(")")
  ) {
    return fallbackRule;
  }

  const hasAnd = /\band\b|\b&&\b/i.test(trimmed);
  const hasOr = /\bor\b|\b\|\|\b/i.test(trimmed);
  if (hasAnd && hasOr) {
    return fallbackRule;
  }

  const logicalOperator: "AND" | "OR" = hasOr ? "OR" : "AND";
  const delimiter = hasOr ? /\s+(?:or|\|\|)\s+/i : /\s+(?:and|&&)\s+/i;
  const parts = trimmed.split(delimiter);

  const conditions: AstCondition[] = [];
  for (const part of parts) {
    const cleanedPart = part.trim();
    if (!cleanedPart) continue;

    const match = cleanedPart.match(
      /^\s*\[([a-zA-Z0-9_]+)\]\s*(=|!=|<>|>=|<=|>|<)\s*(?:'([^']*)'|"([^"]*)"|(-?[0-9]+(?:\.[0-9]+)?)|([a-zA-Z0-9_]+))\s*$/
    );
    if (!match) {
      return fallbackRule;
    }

    const varName = match[1].toLowerCase();
    const rawOp = match[2];
    const singleQuoted = match[3];
    const doubleQuoted = match[4];
    const numStr = match[5];
    const unquotedIdent = match[6];

    let astOp: AstCondition["operator"];
    switch (rawOp) {
      case "=":
        astOp = "eq";
        break;
      case "!=":
      case "<>":
        astOp = "neq";
        break;
      case ">":
        astOp = "gt";
        break;
      case ">=":
        astOp = "gte";
        break;
      case "<":
        astOp = "lt";
        break;
      case "<=":
        astOp = "lte";
        break;
      default:
        return fallbackRule;
    }

    let value: string | number;
    if (singleQuoted !== undefined) {
      value = singleQuoted;
    } else if (doubleQuoted !== undefined) {
      value = doubleQuoted;
    } else if (numStr !== undefined) {
      value = Number(numStr);
    } else if (unquotedIdent !== undefined) {
      value = unquotedIdent;
    } else {
      value = "";
    }

    const fieldId = fieldVarToIdMap.get(varName) || `fld_${varName}`;
    conditions.push({
      fieldId,
      operator: astOp,
      value,
    });
  }

  if (conditions.length === 0) {
    return fallbackRule;
  }

  return {
    id: `rule_branch_${targetFieldId}`,
    name: `Show ${targetLabel}`,
    description: `Branching logic: ${trimmed}`,
    triggerFieldIds,
    actionType: "show_field",
    targetFieldId,
    conditions,
    logicalOperator,
  };
}

interface RedcapFormBuilder {
  rawName: string;
  name: string;
  domain: string;
  sections: {
    title: string;
    fields: CRFField[];
  }[];
  rules: EditCheckRule[];
}

function parseRedcapCsvRows(rows: string[][]): StudyProtocol {
  const header = rows[0];

  const colMap = {
    variable: header.findIndex((h) => {
      const c = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      return (
        c === "variablefieldname" ||
        c === "variablefield" ||
        (c.includes("variable") && c.includes("field")) ||
        c === "variablename" ||
        c === "variable"
      );
    }),
    form: header.findIndex((h) => {
      const c = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      return (
        c === "formname" ||
        (c.includes("form") && c.includes("name")) ||
        c === "form"
      );
    }),
    sectionHeader: header.findIndex((h) => {
      const c = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      return c.includes("section");
    }),
    fieldType: header.findIndex((h) => {
      const c = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      return (
        c === "fieldtype" ||
        (c.includes("field") && c.includes("type")) ||
        c === "type"
      );
    }),
    fieldLabel: header.findIndex((h) => {
      const c = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      return (
        c === "fieldlabel" ||
        (c.includes("field") && c.includes("label")) ||
        c === "label"
      );
    }),
    choices: header.findIndex((h) => {
      const c = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      return (
        c.includes("choice") ||
        c.includes("calculation") ||
        c.includes("sliderlabel")
      );
    }),
    fieldNote: header.findIndex((h) => {
      const c = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      return c.includes("note");
    }),
    textValidation: header.findIndex((h) => {
      const c = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      return (
        c.includes("validationtype") ||
        c.includes("textvalidation") ||
        c.includes("validation")
      );
    }),
    validationMin: header.findIndex((h) => {
      const c = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      return (
        c.includes("validationmin") || (c.includes("min") && !c.includes("max"))
      );
    }),
    validationMax: header.findIndex((h) => {
      const c = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      return (
        c.includes("validationmax") || (c.includes("max") && !c.includes("min"))
      );
    }),
    branchingLogic: header.findIndex((h) => {
      const c = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      return c.includes("branching");
    }),
    required: header.findIndex((h) => {
      const c = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      return c.includes("required");
    }),
  };

  const varCol = colMap.variable !== -1 ? colMap.variable : 0;
  const formCol = colMap.form !== -1 ? colMap.form : 1;
  const typeCol = colMap.fieldType !== -1 ? colMap.fieldType : 3;
  const labelCol = colMap.fieldLabel !== -1 ? colMap.fieldLabel : 4;

  const formBuilders = new Map<string, RedcapFormBuilder>();
  const codelistsMap = new Map<string, CodelistDefinition>();
  const fieldVarToIdMap = new Map<string, string>();

  // Pre-populate field variable to ID map
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0) continue;
    const vName = (row[varCol] || `var_${r}`).trim();
    if (vName) {
      fieldVarToIdMap.set(
        vName.toLowerCase(),
        `fld_${vName.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`
      );
    }
  }

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0 || row.every((c) => !c.trim())) continue;

    const rawForm = (row[formCol] || "general").trim();
    const formKey =
      rawForm.toLowerCase().replace(/[^a-z0-9_]/g, "_") || "general";

    if (!formBuilders.has(formKey)) {
      const formTitle = formatFormTitle(rawForm);
      const domain = deriveDomainFromFormName(rawForm);
      formBuilders.set(formKey, {
        rawName: rawForm,
        name: formTitle,
        domain,
        sections: [
          {
            title: `${formTitle} Details`,
            fields: [],
          },
        ],
        rules: [],
      });
    }

    const formEntry = formBuilders.get(formKey)!;
    const currentSections = formEntry.sections;
    let activeSection = currentSections[currentSections.length - 1];

    const rawSectionHeader =
      colMap.sectionHeader !== -1 ? row[colMap.sectionHeader] : "";
    const cleanSectionHeader = stripHtmlAndEntities(rawSectionHeader);

    if (cleanSectionHeader) {
      if (activeSection.fields.length === 0) {
        activeSection.title = cleanSectionHeader;
      } else {
        const newSection = {
          title: cleanSectionHeader,
          fields: [],
        };
        currentSections.push(newSection);
        activeSection = newSection;
      }
    }

    const variableName = (row[varCol] || `VAR_${r}`).trim();
    const fieldId =
      fieldVarToIdMap.get(variableName.toLowerCase()) ||
      `fld_${variableName.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;

    const rawType = (row[typeCol] || "text").trim();
    const rawVal =
      colMap.textValidation !== -1 ? row[colMap.textValidation] : "";
    const dataType = mapRedcapFieldType(rawType, rawVal);

    const rawLabel = (row[labelCol] || variableName).trim();
    const label = stripHtmlAndEntities(rawLabel) || variableName;

    const rawNote = colMap.fieldNote !== -1 ? row[colMap.fieldNote] : "";
    const description = stripHtmlAndEntities(rawNote) || undefined;

    const rawReq = colMap.required !== -1 ? row[colMap.required] : "";
    const isRequired = /^(y|yes|1|true)$/i.test((rawReq || "").trim());

    const minStr =
      colMap.validationMin !== -1 ? row[colMap.validationMin]?.trim() : "";
    const maxStr =
      colMap.validationMax !== -1 ? row[colMap.validationMax]?.trim() : "";
    const minValue =
      minStr && !isNaN(Number(minStr)) ? Number(minStr) : undefined;
    const maxValue =
      maxStr && !isNaN(Number(maxStr)) ? Number(maxStr) : undefined;

    const rawChoices = colMap.choices !== -1 ? row[colMap.choices] : "";

    let calculationFormula: string | undefined = undefined;
    if (dataType === "calculated" && rawChoices) {
      calculationFormula = rawChoices.trim();
    }

    let scaleMinLabel: string | undefined = undefined;
    let scaleMaxLabel: string | undefined = undefined;
    if (dataType === "vas_scale" && rawChoices) {
      const sliderParts = rawChoices
        .split("|")
        .map((s) => stripHtmlAndEntities(s.trim()))
        .filter(Boolean);
      if (sliderParts.length >= 2) {
        scaleMinLabel = sliderParts[0];
        scaleMaxLabel = sliderParts[sliderParts.length - 1];
      }
    }

    const readOnly = rawType.toLowerCase() === "descriptive" ? true : undefined;

    const options = parseChoices(rawType, rawChoices);
    let codelistId: string | undefined = undefined;
    let customOptions: CodelistOption[] | undefined = undefined;

    if (options.length > 0) {
      const fingerprint = options
        .map((o) => `${o.code}:::${o.label}`)
        .join("|||");
      if (codelistsMap.has(fingerprint)) {
        const existing = codelistsMap.get(fingerprint)!;
        codelistId = existing.id;
        customOptions = existing.options;
      } else {
        let baseId = `CL_${variableName.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`;
        if (!baseId || baseId === "CL_") baseId = "CL_OPTIONS";
        let finalId = baseId;
        let counter = 1;
        const existingIds = new Set(
          Array.from(codelistsMap.values()).map((c) => c.id)
        );
        while (existingIds.has(finalId)) {
          finalId = `${baseId}_${counter++}`;
        }

        const codelist: CodelistDefinition = {
          id: finalId,
          name: `${label || variableName} Codelist`,
          options,
          isStandard: false,
        };
        codelistsMap.set(fingerprint, codelist);
        codelistId = finalId;
        customOptions = options;
      }
    }

    const field: CRFField = {
      id: fieldId,
      variableName,
      label,
      description,
      dataType,
      columnSpan: 6,
      required: isRequired,
      minValue,
      maxValue,
      codelistId,
      customOptions,
      calculationFormula,
      scaleMinLabel,
      scaleMaxLabel,
      readOnly,
      cdashMetadata: {
        domain: formEntry.domain,
        sdtmVariable: variableName.toUpperCase(),
        cdashLabel: label,
        core: isRequired ? "R" : "O",
        acrfAnnotation: `${formEntry.domain}.${variableName.toUpperCase()}`,
        codelistId,
      },
    };

    activeSection.fields.push(field);

    const rawBranching =
      colMap.branchingLogic !== -1 ? row[colMap.branchingLogic] : "";
    if (rawBranching && rawBranching.trim()) {
      const rule = parseBranchingLogic(
        rawBranching,
        fieldId,
        label,
        fieldVarToIdMap
      );
      if (rule) {
        formEntry.rules.push(rule);
      }
    }
  }

  const forms: CRFForm[] = Array.from(formBuilders.entries()).map(
    ([key, fb], formIdx) => {
      const sections: CRFSection[] = fb.sections.map((sec, secIdx) => ({
        id: `sec_${key}_${secIdx + 1}`,
        title: sec.title,
        fields: sec.fields,
      }));

      return {
        id: `f_${key}_${formIdx + 1}`,
        name: fb.name,
        domain: fb.domain,
        description: `Imported from REDCap Data Dictionary for ${fb.name}`,
        version: "1.0",
        sections,
        rules: fb.rules,
      };
    }
  );

  const allFormIds = forms.map((f) => f.id);
  const visits: StudyVisit[] = [
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
    {
      id: "vis_baseline",
      oid: "SE.BASELINE",
      name: "Day 1 Baseline",
      visitType: "Scheduled",
      targetDay: 1,
      windowBefore: 0,
      windowAfter: 0,
      assignedFormIds: allFormIds,
    },
  ];

  const protoNum = `REDCAP-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  return {
    id: `study_${protoNum.toLowerCase()}`,
    protocolNumber: protoNum,
    studyName: `REDCap Study Protocol (${forms.length} forms)`,
    phase: "Phase III",
    sponsor: "REDCap Ingestion",
    therapeuticArea: "General",
    version: "1.0",
    lastModified: new Date().toISOString(),
    forms,
    visits,
    codelists: Array.from(codelistsMap.values()),
    provenance: {
      sourceFormat: "REDCap CSV Data Dictionary",
      sourceVersion: "1.0",
      importedAt: new Date().toISOString(),
      importedBy: "REDCap Ingestion",
    },
  };
}

function parseCdiscCsvRows(rows: string[][]): StudyProtocol {
  const header = rows[0].map((h) => h.toLowerCase());

  let domainIdx = header.findIndex((h) => h.includes("domain"));
  let formIdx = header.findIndex(
    (h) => h.includes("form") || h.includes("activity")
  );
  let varIdx = header.findIndex(
    (h) => h.includes("variable") || h.includes("field") || h.includes("item")
  );
  let labelIdx = header.findIndex(
    (h) =>
      h.includes("label") || h.includes("question") || h.includes("description")
  );
  let typeIdx = header.findIndex(
    (h) => h.includes("type") || h.includes("datatype")
  );
  const coreIdx = header.findIndex(
    (h) => h.includes("core") || h.includes("req") || h.includes("mandatory")
  );
  const acrfIdx = header.findIndex(
    (h) =>
      h.includes("acrf") || h.includes("overlay") || h.includes("annotation")
  );

  // Fallback defaults if header matching failed
  if (domainIdx === -1) domainIdx = 0;
  if (formIdx === -1) formIdx = 1;
  if (varIdx === -1) varIdx = 2;
  if (labelIdx === -1) labelIdx = 3;
  if (typeIdx === -1) typeIdx = 4;

  const formsMap = new Map<
    string,
    { domain: string; name: string; fields: CRFField[] }
  >();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0) continue;

    const domain = (row[domainIdx] || "GENERAL").toUpperCase();
    const formName = row[formIdx] || `${domain} Form`;
    const variableName = row[varIdx] || `VAR_${r}`;
    const label = row[labelIdx] || variableName;
    const rawType = row[typeIdx] || "text";
    const coreVal = coreIdx !== -1 ? row[coreIdx] : "O";
    const acrfTag = acrfIdx !== -1 ? row[acrfIdx] : `${domain}.${variableName}`;

    const formKey = `${domain}_${formName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    if (!formsMap.has(formKey)) {
      formsMap.set(formKey, {
        domain,
        name: formName,
        fields: [],
      });
    }

    const formEntry = formsMap.get(formKey)!;
    const isRequired = /^(r|hr|required|yes|true|1)$/i.test(coreVal);

    const cdashMetadata: CdashVariableMetadata = {
      domain,
      sdtmVariable: variableName,
      cdashLabel: label,
      core: coreVal.toUpperCase() === "HR" ? "HR" : isRequired ? "R" : "O",
      acrfAnnotation: acrfTag || `${domain}.${variableName}`,
    };

    formEntry.fields.push({
      id: `fld_${variableName.toLowerCase()}_${r}`,
      variableName,
      label,
      dataType: normalizeDataType(rawType),
      columnSpan: 6,
      required: isRequired,
      cdashMetadata,
    });
  }

  const forms: CRFForm[] = Array.from(formsMap.entries()).map(
    ([key, entry], idx) => {
      const section: CRFSection = {
        id: `sec_${key}`,
        title: `${entry.name} Specifications`,
        fields: entry.fields,
      };

      return {
        id: `f_${entry.domain.toLowerCase()}_${idx + 1}`,
        name: entry.name,
        domain: entry.domain,
        description: `Imported from CSV Study Specification sheet for ${entry.name}`,
        version: "1.0",
        sections: [section],
        rules: [],
      };
    }
  );

  const allFormIds = forms.map((f) => f.id);
  const visits: StudyVisit[] = [
    {
      id: "vis_screening",
      oid: "SE.SCREENING",
      name: "Screening Visit",
      visitType: "Scheduled" as const,
      targetDay: 0,
      windowBefore: 0,
      windowAfter: 0,
      assignedFormIds: allFormIds,
    },
    {
      id: "vis_baseline",
      oid: "SE.BASELINE",
      name: "Day 1 Baseline",
      visitType: "Scheduled" as const,
      targetDay: 1,
      windowBefore: 0,
      windowAfter: 0,
      assignedFormIds: allFormIds,
    },
  ];

  const protoNum = `CSV-SPEC-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  return {
    id: `study_${protoNum.toLowerCase()}`,
    protocolNumber: protoNum,
    studyName: `CSV Study Specification (${forms.length} domains)`,
    phase: "Phase III",
    sponsor: "Sponsor",
    therapeuticArea: "General",
    version: "1.0",
    lastModified: new Date().toISOString(),
    forms,
    visits,
    codelists: [],
    provenance: {
      sourceFormat: "CSV Study Specification",
      sourceVersion: "1.0",
      importedAt: new Date().toISOString(),
      importedBy: "Unverified Session",
    },
  };
}

/**
 * Imports a StudyProtocol from raw CSV content.
 * Automatically detects whether the CSV matches Vanderbilt REDCap data dictionary
 * format or CDISC CSV study specification format.
 */
export function importStudyFromCsvSpec(csvContent: string): StudyProtocol {
  if (!csvContent || typeof csvContent !== "string" || !csvContent.trim()) {
    throw new Error("Invalid CSV specification: Empty file content");
  }

  const clean = stripBom(csvContent.trim());
  const rows = parseCsvRows(clean);
  if (rows.length < 2) {
    throw new Error(
      "Invalid CSV specification: Insufficient rows (header and data required)"
    );
  }

  if (isRedcapHeader(rows[0])) {
    return parseRedcapCsvRows(rows);
  }

  return parseCdiscCsvRows(rows);
}

/**
 * Parses a Vanderbilt REDCap CSV data dictionary directly into a StudyProtocol.
 */
export function importStudyFromRedcapCsv(csvContent: string): StudyProtocol {
  if (!csvContent || typeof csvContent !== "string" || !csvContent.trim()) {
    throw new Error("Invalid CSV specification: Empty file content");
  }

  const clean = stripBom(csvContent.trim());
  const rows = parseCsvRows(clean);
  if (rows.length < 2) {
    throw new Error(
      "Invalid CSV specification: Insufficient rows (header and data required)"
    );
  }

  return parseRedcapCsvRows(rows);
}
