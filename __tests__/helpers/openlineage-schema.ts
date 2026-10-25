import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020";
import type { ValidateFunction } from "ajv";

/**
 * Validators for OpenLineage 2-0-2 run events and the facets the platform
 * emits, from the schemas vendored at
 * `__tests__/fixtures/schemas/openlineage-1.54.0/` with their Apache 2.0
 * licence and a `SOURCE.md` recording the tag, commit and SHA-256 of each
 * file. The schemas declare JSON Schema draft 2020-12, so they are compiled
 * with Ajv's 2020 build.
 */
export const OPENLINEAGE_SCHEMA_DIR = path.resolve(
  __dirname,
  "..",
  "fixtures",
  "schemas",
  "openlineage-1.54.0"
);

/** The vendored files, by name. */
export const OPENLINEAGE_SCHEMA_FILES = [
  "OpenLineage.json",
  "ColumnLineageDatasetFacet.json",
  "SchemaDatasetFacet.json",
  "OwnershipDatasetFacet.json",
  "JobTypeJobFacet.json",
] as const;

const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pointers to the definitions the platform's events use. */
const DEFINITIONS = {
  runEvent:
    "https://openlineage.io/spec/2-0-2/OpenLineage.json#/$defs/RunEvent",
  schema:
    "https://openlineage.io/spec/facets/1-2-0/SchemaDatasetFacet.json#/$defs/SchemaDatasetFacet",
  ownership:
    "https://openlineage.io/spec/facets/1-0-1/OwnershipDatasetFacet.json#/$defs/OwnershipDatasetFacet",
  columnLineage:
    "https://openlineage.io/spec/facets/1-2-0/ColumnLineageDatasetFacet.json#/$defs/ColumnLineageDatasetFacet",
  jobType:
    "https://openlineage.io/spec/facets/2-0-4/JobTypeJobFacet.json#/$defs/JobTypeJobFacet",
} as const;

export type OpenLineageDefinition = keyof typeof DEFINITIONS;

const cached = new Map<OpenLineageDefinition, ValidateFunction>();
let ajv: Ajv2020 | undefined;

/**
 * Validates a value against one OpenLineage definition and returns the
 * errors as `path: message` strings (empty when valid).
 */
export function validateOpenLineage(
  definition: OpenLineageDefinition,
  value: unknown
): string[] {
  if (ajv === undefined) {
    // Strict mode stays on. The schemas annotate properties with `example`,
    // which is not a JSON Schema keyword, so it is declared as one; Ajv
    // ships no format validators, so the three formats used get small
    // checks: a date and time with a zone, a URL, and a UUID.
    ajv = new Ajv2020({ allErrors: true });
    ajv.addKeyword("example");
    ajv.addFormat("date-time", ISO_DATE_TIME);
    ajv.addFormat("uri", (text: string) => URL.canParse(text));
    ajv.addFormat("uuid", UUID);
    for (const file of OPENLINEAGE_SCHEMA_FILES) {
      ajv.addSchema(
        JSON.parse(
          readFileSync(path.join(OPENLINEAGE_SCHEMA_DIR, file), "utf8")
        )
      );
    }
  }
  let validate = cached.get(definition);
  if (validate === undefined) {
    validate = ajv.getSchema(DEFINITIONS[definition]);
    if (validate === undefined) {
      throw new Error(`no OpenLineage schema at ${DEFINITIONS[definition]}`);
    }
    cached.set(definition, validate);
  }
  if (validate(value)) return [];
  return (validate.errors ?? []).map(
    (error) => `${error.instancePath || "/"}: ${error.message ?? "invalid"}`
  );
}
