import type { CanonicalCrfDocument } from "../../types";
import { exportStudyToUsdm, importStudyFromUsdm } from "../usdm-adapter";
import {
  fromCanonicalCrfDocument,
  toCanonicalCrfDocument,
} from "./canonical-document";
import { CodecDetectInput, CodecValidationError, FormatCodec } from "./types";
import {
  inspectJsonRecord,
  isUsdmV3Record,
  isUsdmV4Record,
  isXmlCandidate,
} from "./universal-codecs";

/**
 * Symmetric codec for CDISC USDM v4.0 JSON graphs.
 */
export const UsdmV4Codec: FormatCodec<string> = {
  id: "json_usdm_v4",
  ingestionFormat: "json_usdm",
  formatLabel: "CDISC USDM JSON Graph",
  extensions: [".usdm.json", ".json"],

  canDecode(input: CodecDetectInput): boolean {
    if (isXmlCandidate(input)) return false;
    const record = inspectJsonRecord(input.raw);
    if (!record) return false;
    return isUsdmV4Record(record);
  },

  decode(raw: string): CanonicalCrfDocument {
    try {
      const study = importStudyFromUsdm(raw);
      return toCanonicalCrfDocument(study, { mode: "strict" });
    } catch (err: unknown) {
      if (err instanceof CodecValidationError) throw err;
      throw new CodecValidationError(
        "json_usdm_v4",
        err instanceof Error ? err.message : String(err)
      );
    }
  },

  encode(doc: CanonicalCrfDocument): string {
    const study = fromCanonicalCrfDocument(doc);
    toCanonicalCrfDocument(study, { mode: "strict" });
    return exportStudyToUsdm(study);
  },
};

/**
 * Codec for legacy CDISC USDM v3.x JSON graphs. Isolates USDM v3 graph inputs
 * from native Universal CRF JSON so failed native imports never fall back.
 */
export const UsdmV3Codec: FormatCodec<string> = {
  id: "json_usdm_v3",
  ingestionFormat: "json_usdm",
  formatLabel: "CDISC USDM JSON Graph",
  extensions: [".usdm.json", ".json"],

  canDecode(input: CodecDetectInput): boolean {
    if (isXmlCandidate(input)) return false;
    const record = inspectJsonRecord(input.raw);
    if (!record) return false;
    return isUsdmV3Record(record);
  },

  decode(raw: string): CanonicalCrfDocument {
    try {
      const study = importStudyFromUsdm(raw);
      return toCanonicalCrfDocument(study, { mode: "strict" });
    } catch (err: unknown) {
      if (err instanceof CodecValidationError) throw err;
      throw new CodecValidationError(
        "json_usdm_v3",
        err instanceof Error ? err.message : String(err)
      );
    }
  },

  encode(doc: CanonicalCrfDocument): string {
    const study = fromCanonicalCrfDocument(doc);
    toCanonicalCrfDocument(study, { mode: "strict" });
    return exportStudyToUsdm(study);
  },
};
