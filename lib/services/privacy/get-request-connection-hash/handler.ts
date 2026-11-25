import { createFailure, createSuccess } from "@/lib/services/service-result";
import {
  computeSha256Hash,
  extractClientIp,
  extractHeaderValue,
} from "../shared";
import {
  GetRequestConnectionHashInputSchema,
  type GetRequestConnectionHashInput,
  type GetRequestConnectionHashResult,
  type GetRequestConnectionHashSpec,
} from "./spec";

export interface GetRequestConnectionHashDeps {
  extractIp?: typeof extractClientIp;
  extractHeader?: typeof extractHeaderValue;
  hashFn?: (input: string) => Promise<string>;
}

/**
 * Handler for computing the anonymous SHA-256 connection hash from request headers.
 * Ignores client-supplied `x-connection-hash` headers so clients cannot spoof rate-limit buckets.
 */
export class GetRequestConnectionHashHandler implements GetRequestConnectionHashSpec {
  private readonly extractIp: typeof extractClientIp;
  private readonly extractHeader: typeof extractHeaderValue;
  private readonly hashFn: (input: string) => Promise<string>;

  constructor(deps: GetRequestConnectionHashDeps = {}) {
    this.extractIp = deps.extractIp ?? extractClientIp;
    this.extractHeader = deps.extractHeader ?? extractHeaderValue;
    this.hashFn = deps.hashFn ?? ((val) => computeSha256Hash(val));
  }

  async execute(
    input: GetRequestConnectionHashInput
  ): Promise<GetRequestConnectionHashResult> {
    const parsed = GetRequestConnectionHashInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure(
        "INVALID_INPUT",
        parsed.error.issues[0]?.message || "Invalid request header input",
        {
          recoverable: true,
          details: parsed.error,
        }
      );
    }

    try {
      const reqOrHeaders = parsed.data.requestOrHeaders;
      const userAgent = this.extractHeader(reqOrHeaders, "user-agent") || "";
      const ip = this.extractIp(reqOrHeaders);
      const hash = await this.hashFn(`${ip}:${userAgent}`);
      return createSuccess({ hash });
    } catch (error) {
      return createFailure(
        "HASH_FAILED",
        "Failed to compute connection hash from request headers",
        {
          recoverable: true,
          details: error,
        }
      );
    }
  }
}
