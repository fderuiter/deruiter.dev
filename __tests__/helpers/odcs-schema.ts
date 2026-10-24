import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv2019 from "ajv/dist/2019";
import type { ValidateFunction } from "ajv";

/**
 * Validator for the Open Data Contract Standard (ODCS) v3.2.0 JSON schema,
 * vendored at `__tests__/fixtures/schemas/odcs-3.2.0/` with its Apache 2.0
 * licence and a `SOURCE.md` recording the tag, commit and SHA-256. The
 * schema declares JSON Schema draft 2019-09, so it is compiled with Ajv's
 * 2019 build.
 */
const SCHEMA_PATH = path.resolve(
  __dirname,
  "..",
  "fixtures",
  "schemas",
  "odcs-3.2.0",
  "odcs-json-schema-v3.2.0.json"
);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

let cached: ValidateFunction | undefined;

/** The raw bytes of the vendored schema file. */
export function readOdcsSchemaBytes(): Buffer {
  return readFileSync(SCHEMA_PATH);
}

/**
 * Validates a document against the ODCS v3.2.0 schema and returns the
 * errors as `path: message` strings (empty when valid).
 */
export function validateOdcs(doc: unknown): string[] {
  if (!cached) {
    // Strict mode stays on. Ajv ships no format validators, so the three
    // formats the schema uses get small checks here: an ISO 8601 date, an
    // ISO 8601 date and time with a zone, and a URL the WHATWG parser reads.
    const ajv = new Ajv2019({ allErrors: true });
    ajv.addFormat("date", ISO_DATE);
    ajv.addFormat("date-time", ISO_DATE_TIME);
    ajv.addFormat("uri", (value: string) => URL.canParse(value));
    cached = ajv.compile(JSON.parse(readOdcsSchemaBytes().toString("utf8")));
  }
  if (cached(doc)) return [];
  return (cached.errors ?? []).map(
    (error) => `${error.instancePath || "/"}: ${error.message ?? "invalid"}`
  );
}
