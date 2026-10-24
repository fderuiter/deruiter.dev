import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { validateXML } from "xmllint-wasm";

/**
 * Validator for the Define-XML 2.1.0 schema, vendored at
 * `__tests__/fixtures/schemas/define-xml-2.1/` with its MIT licence, the W3C
 * licence of the core schemas and a `SOURCE.md` recording the commit and the
 * SHA-256 of every file. libxml2 (through `xmllint-wasm`) does the
 * validation. It reads no network: every imported schema is preloaded into
 * its in-memory file system under the same relative path as in the folder.
 */
export const DEFINE_SCHEMA_ROOT = path.resolve(
  __dirname,
  "..",
  "fixtures",
  "schemas",
  "define-xml-2.1"
);

const MAIN_SCHEMA = "cdisc-define-2.1/define2-1-0.xsd";
const SCHEMA_FOLDERS = ["cdisc-define-2.1", "cdisc-odm-1.3.2", "core"];

/** Every vendored file, relative to the schema root, in sorted order. */
export function listDefineSchemaFiles(): string[] {
  const files = ["LICENSE", "SOURCE.md"];
  for (const folder of SCHEMA_FOLDERS) {
    for (const name of readdirSync(path.join(DEFINE_SCHEMA_ROOT, folder))) {
      files.push(`${folder}/${name}`);
    }
  }
  return files.sort();
}

/** The raw bytes of one vendored file. */
export function readDefineSchemaFile(relative: string): Buffer {
  return readFileSync(path.join(DEFINE_SCHEMA_ROOT, relative));
}

const schemaFiles = () =>
  listDefineSchemaFiles()
    .filter((file) => file.endsWith(".xsd"))
    .map((fileName) => ({
      fileName,
      contents: readDefineSchemaFile(fileName).toString("utf8"),
    }));

/**
 * Validates Define-XML documents against the Define-XML 2.1.0 schema in one
 * libxml2 run. Returns the schema validity errors per document name (an
 * empty list when it validates). libxml2's parser warnings about imports it
 * skips because the ODM namespace is already loaded are not errors.
 */
export async function validateDefineXml(
  documents: Readonly<Record<string, string>>
): Promise<Record<string, string[]>> {
  const files = schemaFiles();
  const names = Object.keys(documents);
  const result = await validateXML({
    xml: names.map((name) => ({ fileName: name, contents: documents[name] })),
    schema: files.filter((file) => file.fileName === MAIN_SCHEMA),
    preload: files.filter((file) => file.fileName !== MAIN_SCHEMA),
    maxMemoryPages: 4096,
  });
  const errors: Record<string, string[]> = Object.fromEntries(
    names.map((name) => [name, []])
  );
  for (const error of result.errors) {
    const file =
      error.loc?.fileName ??
      /^(.+) fails to validate$/.exec(error.rawMessage)?.[1];
    if (file && file in errors) errors[file].push(error.rawMessage);
    else if (!/Schemas parser warning/.test(error.rawMessage)) {
      // Anything else, for example a schema that failed to compile, is
      // reported against every document so a test cannot miss it.
      for (const name of names) errors[name].push(error.rawMessage);
    }
  }
  if (!result.valid && names.every((name) => errors[name].length === 0)) {
    for (const name of names) errors[name].push(result.rawOutput);
  }
  return errors;
}
