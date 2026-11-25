import { createFailure, createSuccess } from "@/lib/services/service-result";
import { computeSha256Hash } from "../shared";
import {
  GenerateConnectionHashInputSchema,
  type GenerateConnectionHashInput,
  type GenerateConnectionHashResult,
  type GenerateConnectionHashSpec,
} from "./spec";

export interface GenerateConnectionHashDeps {
  subtle?: SubtleCrypto | null;
  hashFn?: (input: string, subtle?: SubtleCrypto | null) => Promise<string>;
}

/**
 * Handler for computing a privacy-preserving SHA-256 client connection hash.
 */
export class GenerateConnectionHashHandler implements GenerateConnectionHashSpec {
  private readonly subtle: SubtleCrypto | null | undefined;
  private readonly hashFn: (
    input: string,
    subtle?: SubtleCrypto | null
  ) => Promise<string>;

  constructor(deps: GenerateConnectionHashDeps = {}) {
    this.subtle = deps.subtle;
    this.hashFn = deps.hashFn ?? computeSha256Hash;
  }

  async execute(
    input: GenerateConnectionHashInput
  ): Promise<GenerateConnectionHashResult> {
    const parsed = GenerateConnectionHashInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid connection hash input",
        {
          recoverable: true,
          details: parsed.error,
        }
      );
    }

    try {
      const hash = await this.hashFn(parsed.data.ip, this.subtle);
      return createSuccess({ hash });
    } catch (error) {
      return createFailure(
        "HASH_FAILED",
        "Failed to compute SHA-256 connection hash",
        {
          recoverable: true,
          details: error,
        }
      );
    }
  }
}
