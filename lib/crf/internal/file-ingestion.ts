/**
 * Multi-Format File Ingestion Layer for CRF Studio
 * Delegates format detection and decoding to `DEFAULT_FORMAT_CODEC_REGISTRY`
 * using disjoint grammar predicates and `CanonicalCrfDocument` validation.
 */

import { StudyProtocol } from "../types";
import {
  DEFAULT_FORMAT_CODEC_REGISTRY,
  FormatCodecId,
  fromCanonicalCrfDocument,
  IngestedStudyFormat,
} from "./codecs";

export interface ParsedStudyFileResult {
  study: StudyProtocol;
  format: IngestedStudyFormat;
  formatLabel: string;
  fileSize: number;
  fileName: string;
}

/** Largest study file the ingestion layer will parse, in bytes (50MB). */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

function errorPrefixForCodecId(codecId: FormatCodecId): string {
  switch (codecId) {
    case "xml_odm_1_3_2":
      return "CDISC ODM XML Parsing Error";
    case "json_fhir_r4":
      return "HL7 FHIR R4 Parsing Error";
    case "json_universal":
    case "json_usdm_v3":
    case "json_usdm_v4":
      return "JSON Protocol Parsing Error";
    case "yaml_universal":
      return "YAML Protocol Parsing Error";
    case "csv_redcap":
      return "REDCap CSV Data Dictionary Parsing Error";
    case "csv_cdisc_spec":
      return "CSV Study Specification Parsing Error";
  }
}

/**
 * Inspects file content grammars via `DEFAULT_FORMAT_CODEC_REGISTRY` to decode
 * `.json`, `.yaml`/`.yml`, `.xml`, and `.csv` clinical specifications into a
 * validated `CanonicalCrfDocument` and project `StudyProtocol`.
 */
export function detectAndParseStudyFile(
  fileContent: string,
  fileName: string = "uploaded_study.json",
  fileSize: number = 0
): ParsedStudyFileResult {
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size (${(fileSize / (1024 * 1024)).toFixed(1)}MB) exceeds maximum supported limit of 50MB.`
    );
  }

  const trimmed = (fileContent || "").trim();
  const lowerName = fileName.toLowerCase();

  if (!trimmed) {
    throw new Error("Cannot parse empty file content.");
  }

  // Validate syntactic JSON upfront when payload starts with `{` or `[`
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(fileContent);
    } catch (err: unknown) {
      throw new Error(`JSON Protocol Parsing Error: ${(err as Error).message}`);
    }
  }

  const codec = DEFAULT_FORMAT_CODEC_REGISTRY.resolveCodec({
    raw: fileContent,
    fileName,
  });

  if (!codec) {
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      throw new Error(
        "JSON Protocol Parsing Error: Unrecognized JSON protocol schema. Expected Universal CRF, CDISC USDM, or HL7 FHIR R4 payload."
      );
    }
    if (lowerName.endsWith(".csv")) {
      throw new Error(
        "CSV Study Specification Parsing Error: Missing required REDCap or CDISC study specification header columns."
      );
    }
    throw new Error(
      "Unsupported file format. Supported formats: .json (USDM/Universal/FHIR), .yaml/.yml (Universal), .xml (CDISC ODM), or .csv (Study Specification)."
    );
  }

  try {
    const canonicalDoc = codec.decode(fileContent);
    const study = fromCanonicalCrfDocument(canonicalDoc);
    return {
      study,
      format: codec.ingestionFormat,
      formatLabel: codec.formatLabel,
      fileSize: fileSize || fileContent.length,
      fileName,
    };
  } catch (err: unknown) {
    const prefix = errorPrefixForCodecId(codec.id);
    throw new Error(`${prefix}: ${(err as Error).message}`);
  }
}
