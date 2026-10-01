/**
 * Multi-Format File Ingestion Layer for CRF Studio
 * Inspects file content signatures, validates file sizes, and delegates parsing to USDM, ODM-XML, or CSV spec parsers.
 */

import { StudyProtocol } from "./types";
import { importStudyFromUsdm } from "./usdm-adapter";
import { importStudyFromCdiscOdmXml } from "./odm-xml-parser";
import { importStudyFromCsvSpec } from "./csv-spec-parser";

export interface ParsedStudyFileResult {
  study: StudyProtocol;
  format: "json_usdm" | "json_universal" | "xml_odm" | "csv_spec";
  formatLabel: string;
  fileSize: number;
  fileName: string;
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB limit

/**
 * Inspects file extensions and content signatures to parse .json, .xml, and .csv files.
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

  // 1. Check XML signature or extension
  if (
    lowerName.endsWith(".xml") ||
    trimmed.startsWith("<?xml") ||
    trimmed.includes("<ODM") ||
    trimmed.includes("<odm:ODM")
  ) {
    try {
      const study = importStudyFromCdiscOdmXml(fileContent);
      return {
        study,
        format: "xml_odm",
        formatLabel: "CDISC ODM-XML v1.3.2/v2.0",
        fileSize: fileSize || fileContent.length,
        fileName,
      };
    } catch (err: unknown) {
      throw new Error(`CDISC ODM XML Parsing Error: ${(err as Error).message}`);
    }
  }

  // 2. Check JSON signature or extension
  if (
    lowerName.endsWith(".json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[")
  ) {
    try {
      const parsedJson = JSON.parse(fileContent);
      const study = importStudyFromUsdm(parsedJson);

      const isUsdm = Boolean(
        parsedJson.study || parsedJson.studyDesigns || parsedJson.$schema
      );
      const format = isUsdm ? "json_usdm" : "json_universal";
      const formatLabel = isUsdm
        ? "CDISC USDM JSON Graph"
        : "Universal CRF JSON";

      return {
        study,
        format,
        formatLabel,
        fileSize: fileSize || fileContent.length,
        fileName,
      };
    } catch (err: unknown) {
      throw new Error(`JSON Protocol Parsing Error: ${(err as Error).message}`);
    }
  }

  // 3. Check CSV signature or extension
  if (
    lowerName.endsWith(".csv") ||
    trimmed.includes(",") ||
    trimmed.toLowerCase().includes("domain") ||
    trimmed.toLowerCase().includes("form")
  ) {
    try {
      const study = importStudyFromCsvSpec(fileContent);
      return {
        study,
        format: "csv_spec",
        formatLabel: "CSV Study Specification",
        fileSize: fileSize || fileContent.length,
        fileName,
      };
    } catch (err: unknown) {
      throw new Error(
        `CSV Study Specification Parsing Error: ${(err as Error).message}`
      );
    }
  }

  throw new Error(
    "Unsupported file format. Supported formats: .json (USDM/Universal), .xml (CDISC ODM), or .csv (Study Specification)."
  );
}
