/**
 * Validation against the official CDISC USDM v4.0.0 Wrapper schema.
 *
 * The schema is vendored next to this module as
 * `usdm-v4.0.0-wrapper.schema.json`; its source repository, git ref, SHA-256
 * and MIT licence are recorded inside the file (ADR 0057). It is compiled
 * with zod's `fromJSONSchema`, so no extra validator dependency is needed,
 * and it is loaded on first use so pages that never validate a document do
 * not carry it.
 */
import { z } from "zod";

let compiled: Promise<z.ZodType> | undefined;

/** Loads the vendored USDM v4.0.0 Wrapper schema document. */
export async function loadUsdmV4WrapperSchema(): Promise<
  Record<string, unknown>
> {
  const schema = await import("./usdm-v4.0.0-wrapper.schema.json");
  return (schema.default ?? schema) as Record<string, unknown>;
}

/**
 * Validates a document against the USDM v4.0.0 Wrapper schema.
 *
 * @param doc - The parsed document.
 * @returns The schema issues as `path: message` strings, empty when the
 *   document is valid.
 */
export async function validateUsdmV4Document(doc: unknown): Promise<string[]> {
  compiled ??= loadUsdmV4WrapperSchema().then((schema) =>
    z.fromJSONSchema(schema as Parameters<typeof z.fromJSONSchema>[0])
  );
  const result = (await compiled).safeParse(doc);
  if (result.success) return [];
  return result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`
  );
}
