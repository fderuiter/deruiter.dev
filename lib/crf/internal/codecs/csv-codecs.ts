import type { CanonicalCrfDocument, StudyProtocol } from "../../types";
import {
  importStudyFromCsvSpec,
  isCdiscSpecCsv,
  isRedcapCsv,
} from "../csv-spec-parser";
import { importStudyFromRedcapCsv } from "../redcap-dictionary";
import {
  fromCanonicalCrfDocument,
  toCanonicalCrfDocument,
} from "./canonical-document";
import { CodecDetectInput, CodecValidationError, FormatCodec } from "./types";
import { isXmlCandidate } from "./universal-codecs";

function escapeCsvCell(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function serializeCdiscSpecCsv(study: StudyProtocol): string {
  const header = [
    "Domain",
    "Form",
    "Section",
    "Variable",
    "Label",
    "Data Type",
    "Core",
    "Codelist",
    "aCRF Overlay Tag",
  ].join(",");

  const rows: string[] = [header];
  for (const form of study.forms) {
    for (const sec of form.sections) {
      for (const field of sec.fields) {
        const core = field.cdashMetadata?.core || (field.required ? "R" : "O");
        const acrf =
          field.cdashMetadata?.acrfAnnotation ||
          `${form.domain}.${field.variableName}`;
        rows.push(
          [
            form.domain,
            form.name,
            sec.title,
            field.variableName,
            field.label,
            field.dataType,
            core,
            field.codelistId || "",
            acrf,
          ]
            .map((cell) => escapeCsvCell(String(cell ?? "")))
            .join(",")
        );
      }
    }
  }
  return rows.join("\n") + "\n";
}

function serializeRedcapCsv(study: StudyProtocol): string {
  const header = [
    "Variable / Field Name",
    "Form Name",
    "Section Header",
    "Field Type",
    "Field Label",
    "Choices, Calculations, OR Slider Labels",
    "Field Note",
    "Text Validation Type OR Show Slider Number",
    "Text Validation Min",
    "Text Validation Max",
    "Identifier?",
    "Branching Logic (Show field only if...)",
    "Required?",
    "Custom Alignment",
    "Question Number (surveys only)",
    "Matrix Group Name",
    "Matrix Ranking?",
    "Field Annotation",
  ].join(",");

  const rows: string[] = [header];
  for (const form of study.forms) {
    const formSlug =
      form.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || form.id.toLowerCase();
    for (const sec of form.sections) {
      sec.fields.forEach((field, fIdx) => {
        const sectionHeader = fIdx === 0 ? sec.title : "";
        let fieldType = "text";
        let validation = "";
        let choicesOrCalc = "";

        if (field.dataType === "textarea") fieldType = "notes";
        else if (field.dataType === "radio") fieldType = "radio";
        else if (field.dataType === "single_select") fieldType = "dropdown";
        else if (
          field.dataType === "checkbox" ||
          field.dataType === "multi_select"
        ) {
          fieldType = "checkbox";
        } else if (field.dataType === "calculated") {
          fieldType = "calc";
          choicesOrCalc = field.calculationFormula || "";
        } else if (
          field.dataType === "vas_scale" ||
          field.dataType === "nrs_scale"
        ) {
          fieldType = "slider";
        } else if (field.dataType === "integer") {
          validation = "integer";
        } else if (field.dataType === "number") {
          validation = "number";
        } else if (
          field.dataType === "date" ||
          field.dataType === "partial_date" ||
          field.dataType === "precision_date"
        ) {
          validation = "date_ymd";
        } else if (field.dataType === "datetime") {
          validation = "datetime_seconds_ymd";
        } else if (field.dataType === "time") {
          validation = "time";
        }

        if (!choicesOrCalc) {
          const codelist = field.codelistId
            ? study.codelists.find((cl) => cl.id === field.codelistId)
            : undefined;
          const opts = field.customOptions || codelist?.options || [];
          if (opts.length > 0) {
            choicesOrCalc = opts
              .map((o) => `${o.code}, ${o.label}`)
              .join(" | ");
          }
        }

        rows.push(
          [
            field.variableName.toLowerCase(),
            formSlug,
            sectionHeader,
            fieldType,
            field.label,
            choicesOrCalc,
            field.description || field.unit || "",
            validation,
            field.minValue !== undefined ? String(field.minValue) : "",
            field.maxValue !== undefined ? String(field.maxValue) : "",
            "",
            "",
            field.required ? "y" : "",
            "",
            "",
            "",
            "",
            field.cdashMetadata?.acrfAnnotation || "",
          ]
            .map((cell) => escapeCsvCell(String(cell ?? "")))
            .join(",")
        );
      });
    }
  }

  return rows.join("\n") + "\n";
}

function isNonStructuredTextCandidate(input: CodecDetectInput): boolean {
  if (isXmlCandidate(input)) return false;
  const trimmed = (input.raw || "").trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return false;
  const lowerName = (input.fileName || "").toLowerCase();
  if (lowerName.endsWith(".yaml") || lowerName.endsWith(".yml")) return false;
  return true;
}

/**
 * Codec for REDCap CSV Data Dictionaries requiring explicit REDCap header columns.
 */
export const RedcapCsvCodec: FormatCodec<string> = {
  id: "csv_redcap",
  ingestionFormat: "csv_redcap",
  formatLabel: "REDCap CSV Data Dictionary",
  extensions: [".redcap.csv", ".csv"],

  canDecode(input: CodecDetectInput): boolean {
    if (!isNonStructuredTextCandidate(input)) return false;
    return isRedcapCsv(input.raw);
  },

  decode(raw: string): CanonicalCrfDocument {
    try {
      const study = importStudyFromRedcapCsv(raw);
      return toCanonicalCrfDocument(study, { mode: "strict" });
    } catch (err: unknown) {
      if (err instanceof CodecValidationError) throw err;
      throw new CodecValidationError(
        "csv_redcap",
        err instanceof Error ? err.message : String(err)
      );
    }
  },

  encode(doc: CanonicalCrfDocument): string {
    const study = fromCanonicalCrfDocument(doc);
    toCanonicalCrfDocument(study, { mode: "strict" });
    return serializeRedcapCsv(study);
  },
};

/**
 * Codec for CDISC CSV Study Specifications requiring explicit CDISC header columns
 * without positional column fallbacks.
 */
export const CdiscCsvSpecCodec: FormatCodec<string> = {
  id: "csv_cdisc_spec",
  ingestionFormat: "csv_spec",
  formatLabel: "CSV Study Specification",
  extensions: [".csv"],

  canDecode(input: CodecDetectInput): boolean {
    if (!isNonStructuredTextCandidate(input)) return false;
    if (isRedcapCsv(input.raw)) return false;
    return isCdiscSpecCsv(input.raw);
  },

  decode(raw: string): CanonicalCrfDocument {
    try {
      if (isRedcapCsv(raw)) {
        throw new Error(
          "REDCap CSV Data Dictionary detected; use RedcapCsvCodec instead of CdiscCsvSpecCodec"
        );
      }
      const study = importStudyFromCsvSpec(raw);
      return toCanonicalCrfDocument(study, { mode: "strict" });
    } catch (err: unknown) {
      if (err instanceof CodecValidationError) throw err;
      throw new CodecValidationError(
        "csv_cdisc_spec",
        err instanceof Error ? err.message : String(err)
      );
    }
  },

  encode(doc: CanonicalCrfDocument): string {
    const study = fromCanonicalCrfDocument(doc);
    toCanonicalCrfDocument(study, { mode: "strict" });
    return serializeCdiscSpecCsv(study);
  },
};
