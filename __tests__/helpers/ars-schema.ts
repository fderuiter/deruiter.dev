import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv, { type ValidateFunction } from "ajv";

/**
 * Validator for the CDISC ARS 1.0 JSON schema, vendored at
 * `__tests__/fixtures/schemas/ars-1.0/` with its MIT licence and a
 * `SOURCE.md` recording the tag, commit and SHA-256. The schema declares
 * JSON Schema draft-07. Its root allows additional properties, so documents
 * are checked against `#/$defs/ReportingEvent`, whose classes do not.
 */
const SCHEMA_PATH = path.resolve(
  __dirname,
  "..",
  "fixtures",
  "schemas",
  "ars-1.0",
  "ars_ldm.schema.json"
);

let cached: ValidateFunction | undefined;

/** The raw bytes of the vendored schema file. */
export function readArsSchemaBytes(): Buffer {
  return readFileSync(SCHEMA_PATH);
}

/**
 * Validates a document against the ARS 1.0 `ReportingEvent` class and
 * returns the errors as `path: message` strings (empty when valid).
 */
export function validateArsReportingEvent(doc: unknown): string[] {
  if (!cached) {
    const ajv = new Ajv({ allErrors: true });
    // Annotations the upstream schema carries that are not JSON Schema keywords.
    ajv.addVocabulary(["metamodel_version", "version"]);
    const schema = JSON.parse(readArsSchemaBytes().toString("utf8")) as {
      $id: string;
    };
    ajv.addSchema(schema);
    cached = ajv.compile({ $ref: `${schema.$id}#/$defs/ReportingEvent` });
  }
  if (cached(doc)) return [];
  return (cached.errors ?? []).map(
    (error) => `${error.instancePath || "/"}: ${error.message ?? "invalid"}`
  );
}
