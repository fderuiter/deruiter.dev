import {
  extractClientIp,
  extractHeaderValue,
  generateClientConnectionHash,
} from "@/lib/privacy";
import { createFailure, createSuccess } from "../../service-result";
import {
  HashConnectionInputSchema,
  type HashConnectionInput,
  type HashConnectionResult,
  type HashConnectionSpec,
} from "./spec";

export interface HashConnectionDeps {
  hashFn?: (value: string) => Promise<string>;
}

export class HashConnectionHandler implements HashConnectionSpec {
  private readonly hashFn: (value: string) => Promise<string>;

  constructor(deps?: HashConnectionDeps) {
    this.hashFn = deps?.hashFn ?? generateClientConnectionHash;
  }

  async execute(input: HashConnectionInput): Promise<HashConnectionResult> {
    const parsed = HashConnectionInputSchema.safeParse(input);
    if (!parsed.success) {
      return createFailure("INVALID_INPUT", "Invalid connection hash input", {
        recoverable: false,
        details: parsed.error,
      });
    }

    try {
      const { request, ip, includeUserAgent = true } = parsed.data;
      if (typeof ip === "string") {
        const hash = await this.hashFn(ip);
        return createSuccess({ hash });
      }

      const resolvedIp = extractClientIp(request);
      if (!includeUserAgent) {
        const hash = await this.hashFn(resolvedIp);
        return createSuccess({ hash });
      }

      const userAgent = extractHeaderValue(request, "user-agent") || "";
      const hash = await this.hashFn(`${resolvedIp}:${userAgent}`);
      return createSuccess({ hash });
    } catch (error) {
      return createFailure(
        "HASHING_FAILED",
        "Failed to compute anonymous connection hash",
        { recoverable: true, details: error }
      );
    }
  }
}
