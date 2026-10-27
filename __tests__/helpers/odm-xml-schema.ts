import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { validateXML } from "xmllint-wasm";

/**
 * Validator for CDISC ODM 1.3.2, the schema CRF Studio's ODM export claims
 * (#3022). The ODM and W3C core schemas are the ones vendored with
 * Define-XML 2.1 (`__tests__/fixtures/schemas/define-xml-2.1/`, hashed in
 * its SOURCE.md); CRF Studio's own vendor extension, which only adds the
 * design audit trail, is in `__tests__/fixtures/schemas/crf-studio-odm-1.0/`.
 * libxml2 (through `xmllint-wasm`) validates without reading the network.
 */
const SCHEMAS = path.resolve(__dirname, "..", "fixtures", "schemas");

const FOLDERS: readonly (readonly [string, string])[] = [
  ["define-xml-2.1", "cdisc-odm-1.3.2"],
  ["define-xml-2.1", "core"],
  [".", "crf-studio-odm-1.0"],
];

/** Plain ODM 1.3.2, or ODM 1.3.2 with the CRF Studio extension. */
export type OdmSchema = "odm-1.3.2" | "odm-1.3.2+crf-studio";

const MAIN: Readonly<Record<OdmSchema, string>> = {
  "odm-1.3.2": "cdisc-odm-1.3.2/ODM1-3-2.xsd",
  "odm-1.3.2+crf-studio": "crf-studio-odm-1.0/crf-studio-odm-extension.xsd",
};

const schemaFiles = () =>
  FOLDERS.flatMap(([root, folder]) =>
    readdirSync(path.join(SCHEMAS, root, folder))
      .filter((name) => name.endsWith(".xsd"))
      .map((name) => ({
        fileName: `${folder}/${name}`,
        contents: readFileSync(path.join(SCHEMAS, root, folder, name), "utf8"),
      }))
  );

/**
 * Validates ODM documents in one libxml2 run and returns the schema errors
 * per document name (empty when it validates). The plain schema never sees
 * the extension's files, so it cannot accept an extension element.
 */
export async function validateOdmXml(
  documents: Readonly<Record<string, string>>,
  schema: OdmSchema = "odm-1.3.2"
): Promise<Record<string, string[]>> {
  const main = MAIN[schema];
  const files = schemaFiles().filter(
    (file) =>
      schema === "odm-1.3.2+crf-studio" ||
      !file.fileName.startsWith("crf-studio-odm-1.0/")
  );
  const names = Object.keys(documents);
  const result = await validateXML({
    xml: names.map((name) => ({ fileName: name, contents: documents[name] })),
    schema: files.filter((file) => file.fileName === main),
    preload: files.filter((file) => file.fileName !== main),
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
      for (const name of names) errors[name].push(error.rawMessage);
    }
  }
  if (!result.valid && names.every((name) => errors[name].length === 0)) {
    for (const name of names) errors[name].push(result.rawOutput);
  }
  return errors;
}
