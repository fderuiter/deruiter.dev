import type { CanonicalCrfDocument, FhirBundle } from "../../types";
import {
  exportStudyToFhirQuestionnaire,
  importStudyFromFhirQuestionnaire,
} from "../fhir-questionnaire";
import {
  fromCanonicalCrfDocument,
  toCanonicalCrfDocument,
} from "./canonical-document";
import { CodecDetectInput, CodecValidationError, FormatCodec } from "./types";
import {
  inspectJsonRecord,
  isFhirResourceRecord,
  isXmlCandidate,
} from "./universal-codecs";

export interface FhirR4EncodeOptions {
  /** When true, serializes the typed `FhirBundle` to formatted JSON text. */
  readonly asJsonString?: boolean;
}

/**
 * Symmetric codec for HL7 FHIR R4 `Questionnaire` and `Bundle` resources.
 * Produces typed `FhirBundle` structures without marketing URLs or wall-clock dates.
 */
export const FhirR4QuestionnaireCodec: FormatCodec<
  string,
  Record<string, unknown>,
  FhirR4EncodeOptions
> & {
  encodeToBundle(doc: CanonicalCrfDocument): FhirBundle;
} = {
  id: "json_fhir_r4",
  ingestionFormat: "json_fhir",
  formatLabel: "HL7 FHIR R4 Questionnaire",
  extensions: [".fhir.json", ".json"],

  canDecode(input: CodecDetectInput): boolean {
    if (isXmlCandidate(input)) return false;
    const record = inspectJsonRecord(input.raw);
    if (!record) return false;
    return isFhirResourceRecord(record);
  },

  decode(raw: string): CanonicalCrfDocument {
    try {
      const study = importStudyFromFhirQuestionnaire(raw);
      return toCanonicalCrfDocument(study, { mode: "strict" });
    } catch (err: unknown) {
      if (err instanceof CodecValidationError) throw err;
      throw new CodecValidationError(
        "json_fhir_r4",
        err instanceof Error ? err.message : String(err)
      );
    }
  },

  encode(doc: CanonicalCrfDocument): string {
    const bundle = FhirR4QuestionnaireCodec.encodeToBundle(doc);
    return JSON.stringify(bundle, null, 2);
  },

  encodeToBundle(doc: CanonicalCrfDocument): FhirBundle {
    const study = fromCanonicalCrfDocument(doc);
    toCanonicalCrfDocument(study, { mode: "strict" });
    return exportStudyToFhirQuestionnaire(study);
  },
};
