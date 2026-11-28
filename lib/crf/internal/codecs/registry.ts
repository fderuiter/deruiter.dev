import type { CanonicalCrfDocument, StudyProtocol } from "../../types";
import {
  fromCanonicalCrfDocument,
  toCanonicalCrfDocument,
} from "./canonical-document";
import { CdiscCsvSpecCodec, RedcapCsvCodec } from "./csv-codecs";
import { FhirR4QuestionnaireCodec } from "./fhir-codec";
import { OdmXml132Codec } from "./odm-xml-codec";
import {
  CodecDetectInput,
  CodecValidationError,
  FormatCodec,
  FormatCodecId,
} from "./types";
import { UniversalJsonCodec, UniversalYamlCodec } from "./universal-codecs";
import { UsdmV3Codec, UsdmV4Codec } from "./usdm-codecs";

export interface DecodedCanonicalPayload {
  readonly codec: FormatCodec;
  readonly document: CanonicalCrfDocument;
  readonly study: StudyProtocol;
}

/**
 * Deterministic registry of clinical specification codecs with disjoint
 * `canDecode` predicates and `CanonicalCrfDocument` validation on decode/encode.
 */
export class FormatCodecRegistry {
  private readonly codecs: readonly FormatCodec[];
  private readonly byId: ReadonlyMap<FormatCodecId, FormatCodec>;

  constructor(codecs: readonly FormatCodec[]) {
    const map = new Map<FormatCodecId, FormatCodec>();
    for (const codec of codecs) {
      if (map.has(codec.id)) {
        throw new CodecValidationError(
          "registry",
          `Duplicate format codec ID "${codec.id}" registered in FormatCodecRegistry.`
        );
      }
      map.set(codec.id, codec);
    }
    this.codecs = [...codecs];
    this.byId = map;
  }

  /**
   * Lists all registered codecs in deterministic evaluation order.
   */
  public listCodecs(): readonly FormatCodec[] {
    return this.codecs;
  }

  /**
   * Retrieves a registered codec by its `FormatCodecId`.
   */
  public getCodec(id: FormatCodecId): FormatCodec {
    const codec = this.byId.get(id);
    if (!codec) {
      throw new CodecValidationError(
        "registry",
        `Unknown format codec ID "${id}".`
      );
    }
    return codec;
  }

  /**
   * Resolves the unique codec whose `canDecode` predicate accepts `input`.
   * Throws `CodecValidationError` if multiple codecs claim the same input.
   */
  public resolveCodec(input: CodecDetectInput): FormatCodec | null {
    const matches = this.codecs.filter((codec) => codec.canDecode(input));
    if (matches.length > 1) {
      throw new CodecValidationError(
        "registry",
        `Ambiguous clinical specification format: matched multiple codecs (${matches.map((c) => c.id).join(", ")}).`
      );
    }
    return matches[0] ?? null;
  }

  /**
   * Detects the input format via disjoint predicates, decodes into a validated
   * `CanonicalCrfDocument`, and projects a lossless `StudyProtocol`.
   */
  public decodeAuto(input: CodecDetectInput): DecodedCanonicalPayload {
    const codec = this.resolveCodec(input);
    if (!codec) {
      throw new CodecValidationError(
        "registry",
        "Unsupported file format. Supported formats: .json (USDM/Universal/FHIR), .yaml/.yml (Universal), .xml (CDISC ODM), or .csv (Study Specification)."
      );
    }
    const document = codec.decode(input.raw);
    const study = fromCanonicalCrfDocument(document);
    return { codec, document, study };
  }

  /**
   * Decodes a payload with an explicit codec ID without fallback to any other codec.
   */
  public decodeWith(id: FormatCodecId, raw: string): CanonicalCrfDocument {
    return this.getCodec(id).decode(raw);
  }

  /**
   * Encodes a `CanonicalCrfDocument` or `StudyProtocol` using the specified codec,
   * validating canonical invariants before emitting serialized output.
   */
  public encodeWith(
    id: FormatCodecId,
    input: CanonicalCrfDocument | StudyProtocol
  ): string {
    const codec = this.getCodec(id);
    const doc =
      "kind" in input &&
      input.kind === "CanonicalCrfDocument" &&
      "indexes" in input
        ? input
        : toCanonicalCrfDocument(input as StudyProtocol, { mode: "strict" });
    return String(codec.encode(doc));
  }
}

/**
 * Default singleton `FormatCodecRegistry` containing all 8 clinical format codecs.
 */
export const DEFAULT_FORMAT_CODEC_REGISTRY = new FormatCodecRegistry([
  OdmXml132Codec,
  FhirR4QuestionnaireCodec,
  UsdmV4Codec,
  UsdmV3Codec,
  UniversalJsonCodec,
  RedcapCsvCodec,
  CdiscCsvSpecCodec,
  UniversalYamlCodec,
]);
