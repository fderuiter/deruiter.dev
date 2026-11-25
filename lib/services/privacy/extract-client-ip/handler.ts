import { createFailure, createSuccess } from "@/lib/services/service-result";
import { extractClientIp } from "../shared";
import {
  ExtractClientIpInputSchema,
  type ExtractClientIpInput,
  type ExtractClientIpResult,
  type ExtractClientIpSpec,
} from "./spec";

export interface ExtractClientIpDeps {
  extractIp?: typeof extractClientIp;
}

/**
 * Handler for extracting a normalized client IP from proxy headers.
 */
export class ExtractClientIpHandler implements ExtractClientIpSpec {
  private readonly extractIp: typeof extractClientIp;

  constructor(deps: ExtractClientIpDeps = {}) {
    this.extractIp = deps.extractIp ?? extractClientIp;
  }

  execute(input: ExtractClientIpInput): ExtractClientIpResult {
    const parsed = ExtractClientIpInputSchema.safeParse(input);
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
      const ip = this.extractIp(parsed.data.requestOrHeaders);
      return createSuccess({ ip });
    } catch (error) {
      return createFailure(
        "INVALID_INPUT",
        "Failed to extract client IP from headers",
        {
          recoverable: true,
          details: error,
        }
      );
    }
  }
}
