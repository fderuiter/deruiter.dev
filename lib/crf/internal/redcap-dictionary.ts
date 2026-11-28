/**
 * Vanderbilt REDCap CSV Data Dictionary Parser for CRF Studio
 * Converts exported REDCap data dictionaries into standard CRF Studio StudyProtocol.
 */

import DOMPurify from "isomorphic-dompurify";
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
  StudyReviewThread,
} from "../types";

/**
 * Strips UTF-8 Byte Order Mark (\uFEFF) if present at the start of a string.
 */
export function stripBom(text: string): string {
  if (text && text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/**
 * Sanitizes HTML tags using a real DOM parser (DOMPurify) and decodes HTML entities.
 * Non-ampersand entities are decoded first, and &amp; is decoded strictly last to prevent
 * double-unescaping vulnerabilities (e.g., &amp;lt; turning into <).
 */
export function stripHtmlAndEntities(html: string): string {
  if (!html || typeof html !== "string") return "";

  // Normalize line break and closing block tags to spaces so adjacent text blocks don't concatenate
  const spaced = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(?:p|div|h[1-6]|li|tr|td|th)>/gi, " ");

  // Strip all HTML tags using DOMPurify parser (no regex-based tag stripping)
  const clean = DOMPurify.sanitize(spaced, { ALLOWED_TAGS: [] });

  // Decode HTML entities with &amp; strictly last
  const decoded = clean
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;|&#x27;/gi, "'")
    // Support numeric entities other than 38 (ampersand)
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (match, num) => {
      const code =
        num[0].toLowerCase() === "x"
          ? parseInt(num.slice(1), 16)
          : parseInt(num, 10);
      if (code === 38) return match; // Defer ampersand to last step
      return Number.isFinite(code) && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    })
    // Decode &amp; LAST to prevent double-unescaping
    .replace(/&amp;/gi, "&")
    .replace(/&#0*38;|&#x0*26;/gi, "&");

  return decoded.replace(/\s+/g, " ").trim();
}

/**
 * Parses raw CSV content into 2D string rows, respecting quotes and embedded commas/newlines.
 */
export function parseCsvRows(text: string): string[][] {
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

/**
 * Exact signature headers required for Vanderbilt REDCap CSV data dictionaries:
 * - Variable / Field Name
 * - Form Name
 * - Field Type
 * - Field Label
 */
export const REQUIRED_REDCAP_HEADERS = [
  "variablefieldname",
  "formname",
  "fieldtype",
  "fieldlabel",
] as const;

/**
 * Checks whether CSV header columns match the exact Vanderbilt REDCap Data Dictionary signature.
 * Requires all 4 exact headers ("Variable / Field Name", "Form Name", "Field Type", "Field Label")
 * to eliminate false positives on CDISC study specification sheets.
 */
export function isRedcapHeader(header: string[]): boolean {
  if (!header || !Array.isArray(header) || header.length < 4) {
    return false;
  }
  const normalized = header.map((h) =>
    (h || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
  );

  return REQUIRED_REDCAP_HEADERS.every((req) => normalized.includes(req));
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

export function mapRedcapFieldType(
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

export function parseChoices(
  fieldType: string,
  rawChoices: string
): CodelistOption[] {
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

export function formatFormTitle(raw: string): string {
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

export function parseBranchingLogic(
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
  needsReview: boolean;
  sections: {
    title: string;
    fields: CRFField[];
  }[];
  rules: EditCheckRule[];
}

function deterministicCsvHash(rows: string[][]): string {
  let h = 0x811c9dc5;
  for (const row of rows) {
    for (const cell of row) {
      for (let i = 0; i < cell.length; i++) {
        h ^= cell.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      h ^= 0x2c;
      h = Math.imul(h, 0x01000193);
    }
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(6, "0").slice(-6);
}

export function parseRedcapCsvRows(rows: string[][]): StudyProtocol {
  const header = rows[0];
  if (!isRedcapHeader(header)) {
    throw new Error(
      'Invalid REDCap CSV Data Dictionary: Missing required headers ("Variable / Field Name", "Form Name", "Field Type", "Field Label")'
    );
  }

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
      // Do not guess SDTM domains from form names; leave domain unassigned ("") and flag for review
      formBuilders.set(formKey, {
        rawName: rawForm,
        name: formTitle,
        domain: "",
        needsReview: true,
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

    const cdashMetadata: CdashVariableMetadata = {
      domain: "",
      sdtmVariable: variableName.toUpperCase(),
      cdashLabel: label,
      core: isRequired ? "R" : "O",
      acrfAnnotation: variableName.toUpperCase(),
      codelistId,
    };

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
      cdashMetadata,
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
        domain: "",
        needsReview: true,
        description: `Imported from REDCap Data Dictionary for ${fb.name}. Flagged for review: SDTM domain unassigned.`,
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

  // Flag each form for review with an open review thread for the data manager to assign an SDTM domain
  const reviewThreads: StudyReviewThread[] = forms.flatMap((f) => {
    const firstField = f.sections[0]?.fields[0];
    if (!firstField) return [];
    return [
      {
        id: `review_thread_${f.id}`,
        target: {
          fieldId: firstField.id,
          formId: f.id,
          formName: f.name,
          variableName: firstField.variableName,
          label: firstField.label,
        },
        events: [
          {
            id: `review_event_${f.id}_1`,
            type: "comment",
            body: `Form "${f.name}" was imported from a REDCap Data Dictionary with an unassigned SDTM domain. Please review this form and assign the appropriate CDISC SDTM domain.`,
            author: {
              name: "REDCap Ingestion",
              role: "Data Manager",
            },
            at: "1970-01-01T00:00:00.000Z",
          },
        ],
      },
    ];
  });

  const protoNum = `REDCAP-${deterministicCsvHash(rows)}`;

  return {
    id: `study_${protoNum.toLowerCase()}`,
    protocolNumber: protoNum,
    studyName: `REDCap Study Protocol (${forms.length} forms)`,
    phase: "Phase III",
    sponsor: "REDCap Ingestion",
    therapeuticArea: "General",
    version: "1.0",
    lastModified: "1970-01-01T00:00:00.000Z",
    forms,
    visits,
    codelists: Array.from(codelistsMap.values()),
    reviewThreads,
    provenance: {
      sourceFormat: "REDCap CSV Data Dictionary",
      sourceVersion: "1.0",
      importedBy: "REDCap Ingestion",
    },
  };
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
