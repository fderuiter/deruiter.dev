/**
 * CSV Study Specification Parser
 * Converts structured CSV study specification rows into CRF Studio StudyProtocol.
 */

import {
  StudyProtocol,
  CRFForm,
  CRFSection,
  CRFField,
  ClinicalDataType,
  CdashVariableMetadata,
} from "./types";

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

export function importStudyFromCsvSpec(csvContent: string): StudyProtocol {
  if (!csvContent || typeof csvContent !== "string" || !csvContent.trim()) {
    throw new Error("Invalid CSV specification: Empty file content");
  }

  const rows = parseCsvRows(csvContent);
  if (rows.length < 2) {
    throw new Error(
      "Invalid CSV specification: Insufficient rows (header and data required)"
    );
  }

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
  const visits = [
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
