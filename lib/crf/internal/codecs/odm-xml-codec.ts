import { CLINICAL_STANDARDS_PROFILE } from "@/lib/clinical-standards";
import type { CanonicalCrfDocument } from "../../types";
import { importStudyFromCdiscOdmXml } from "../odm-xml-parser";
import { exportStudyToCdiscOdmXml } from "../odm-xml-serializer";
import {
  fromCanonicalCrfDocument,
  toCanonicalCrfDocument,
} from "./canonical-document";
import { CodecDetectInput, CodecValidationError, FormatCodec } from "./types";
import { isXmlCandidate } from "./universal-codecs";

/**
 * Symmetric codec for CDISC ODM-XML v1.3.2 executed identically in Node.js and
 * browsers via the pure XML parser.
 */
export const OdmXml132Codec: FormatCodec<string> = {
  id: "xml_odm_1_3_2",
  ingestionFormat: "xml_odm",
  formatLabel: `CDISC ODM-XML v${CLINICAL_STANDARDS_PROFILE.ODM}/v2.0`,
  extensions: [".odm.xml", ".xml"],

  canDecode(input: CodecDetectInput): boolean {
    return isXmlCandidate(input);
  },

  decode(raw: string): CanonicalCrfDocument {
    try {
      const study = importStudyFromCdiscOdmXml(raw);
      return toCanonicalCrfDocument(study, { mode: "strict" });
    } catch (err: unknown) {
      if (err instanceof CodecValidationError) throw err;
      throw new CodecValidationError(
        "xml_odm_1_3_2",
        err instanceof Error ? err.message : String(err)
      );
    }
  },

  encode(doc: CanonicalCrfDocument): string {
    const study = fromCanonicalCrfDocument(doc);
    toCanonicalCrfDocument(study, { mode: "strict" });
    return exportStudyToCdiscOdmXml(study);
  },
};
