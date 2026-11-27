import { extractClientIp } from "@/lib/privacy";
import { createFailure, createSuccess } from "../../service-result";
import {
  ExtractClientIpInputSchema,
  type ExtractClientIpInput,
  type ExtractClientIpResult,
  type ExtractClientIpSpec,
} from "./spec";

export interface ExtractClientIpDeps {
  extractIp?: typeof extractClientIp;
}

export class ExtractClientIpHandler implements ExtractClientIpSpec {
  private readonly extractIpFn: typeof extractClientIp;

  constructor(deps?: ExtractClientIpDeps) {
    this.extractIpFn = deps?.extractIp ?? extractClientIp;
  }

  execute(input: ExtractClientIpInput): ExtractClientIpResult {
    const parsed = ExtractClientIpInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure("INVALID_INPUT", "Invalid client IP input", {
        recoverable: false,
        details: parsed.error,
      });
    }

    const ip = this.extractIpFn(parsed.data.request);
    return createSuccess({ ip });
  }
}
