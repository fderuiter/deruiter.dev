import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv2019 from "ajv/dist/2019";
import type { ValidateFunction } from "ajv";

/**
 * Validator for the CDISC Dataset-JSON 1.1 JSON schema, vendored at
 * `__tests__/fixtures/schemas/dataset-json-1.1/` with its MIT licence and a
 * `SOURCE.md` recording the tag, commit and SHA-256. The schema declares
 * JSON Schema draft 2019-09, so it is compiled with Ajv's 2019 build.
 */
const SCHEMA_PATH = path.resolve(
  __dirname,
  "..",
  "fixtures",
  "schemas",
  "dataset-json-1.1",
  "dataset.schema.json"
);

let cached: ValidateFunction | undefined;

/** The raw bytes of the vendored schema file. */
export function readDatasetJsonSchemaBytes(): Buffer {
  return readFileSync(SCHEMA_PATH);
}

/**
 * Validates a document against the Dataset-JSON 1.1 schema and returns the
 * errors as `path: message` strings (empty when valid).
 */
export function validateDatasetJson(doc: unknown): string[] {
  if (!cached) {
    // Strict mode stays on, except strictTypes: the upstream `Row` definition
    // declares `properties` on an array type, which Ajv would only log.
    const ajv = new Ajv2019({ allErrors: true, strictTypes: false });
    // Annotations the upstream schema carries that are not JSON Schema keywords.
    ajv.addVocabulary(["metamodel_version", "version"]);
    cached = ajv.compile(
      JSON.parse(readDatasetJsonSchemaBytes().toString("utf8"))
    );
  }
  if (cached(doc)) return [];
  return (cached.errors ?? []).map(
    (error) => `${error.instancePath || "/"}: ${error.message ?? "invalid"}`
  );
}
