import type {
  CanonicalCrfDocument,
  FormatCodecId,
  IngestedStudyFormat,
} from "../../types";

export type { FormatCodecId, IngestedStudyFormat };

/**
 * Raw payload and optional file metadata supplied to `FormatCodec.canDecode`.
 */
export interface CodecDetectInput {
  readonly raw: string;
  readonly fileName?: string;
}

/**
 * Structured validation error raised when a codec rejects a malformed input or
 * an invalid `CanonicalCrfDocument` on decode or encode.
 */
export class CodecValidationError extends Error {
  public readonly codecId: FormatCodecId | "canonical_ir" | "registry";
  public readonly issues: readonly string[];

  constructor(
    codecId: FormatCodecId | "canonical_ir" | "registry",
    message: string,
    issues: readonly string[] = []
  ) {
    super(message);
    this.name = "CodecValidationError";
    this.codecId = codecId;
    this.issues = issues;
  }
}

/**
 * Symmetric clinical specification codec contract.
 * Every codec checks a disjoint input grammar in `canDecode` and validates
 * `CanonicalCrfDocument` invariants on both `decode` and `encode`.
 */
export interface FormatCodec<
  TEncoded = string,
  TDecodeOptions = Record<string, unknown>,
  TEncodeOptions = Record<string, unknown>,
> {
  readonly id: FormatCodecId;
  readonly ingestionFormat: IngestedStudyFormat;
  readonly formatLabel: string;
  readonly extensions: readonly string[];
  canDecode(input: CodecDetectInput): boolean;
  decode(raw: string, options?: TDecodeOptions): CanonicalCrfDocument;
  encode(doc: CanonicalCrfDocument, options?: TEncodeOptions): TEncoded;
}
