import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

/**
 * Validator for the official CDISC USDM v4.0.0 Wrapper schema, vendored at
 * `lib/crf/usdm-v4.0.0-wrapper.schema.json` (source, hash and
 * MIT licence are recorded inside the file). The JSON Schema is compiled with
 * zod's `fromJSONSchema`, so no extra validator dependency is needed.
 */
const SCHEMA_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "lib",
  "crf",
  "usdm-v4.0.0-wrapper.schema.json"
);

let cached: z.ZodType | undefined;

/** The parsed vendored schema document. */
export function loadUsdmV4Schema(): Record<string, unknown> {
  return JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as Record<
    string,
    unknown
  >;
}

/**
 * Validates a document against the USDM v4.0.0 Wrapper schema and returns
 * the issues as `path: message` strings (empty when valid).
 */
export function validateUsdmV4(doc: unknown): string[] {
  cached ??= z.fromJSONSchema(
    loadUsdmV4Schema() as Parameters<typeof z.fromJSONSchema>[0]
  );
  const result = cached.safeParse(doc);
  if (result.success) return [];
  return result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`
  );
}
