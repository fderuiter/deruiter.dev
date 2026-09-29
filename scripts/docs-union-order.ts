import fs from "node:fs";
import path from "node:path";

/**
 * TypeDoc prints a union inferred by the type checker in the checker's
 * internal type-id order. String and number literal types are created on
 * demand, so their order depends on which files are in the program and the
 * order they load: an unrelated change can reorder `"a" | "b"` in a page
 * nobody touched (#951). Declared unions keep their source order, which is
 * meaningful, so the generated pages are left as TypeDoc prints them and
 * only the comparison ignores the order of a run of literals.
 */

/** A backticked string or number literal as typedoc-plugin-markdown prints it. */
const LITERAL = String.raw`\x60(?:"[^\x60\n]*"|-?\d+(?:\.\d+)?)\x60`;
/** Union members are joined by an escaped pipe. */
const SEPARATOR = " \\| ";
const LITERAL_RUN = new RegExp(
  String.raw`${LITERAL}(?: \\\| ${LITERAL})+`,
  "gu"
);

/**
 * Sorts every run of two or more adjacent literal union members, so two
 * renderings that differ only in literal order normalize to the same text.
 * Membership is untouched: adding, removing or renaming a literal still
 * changes the result.
 */
export function normalizeUnionOrder(markdown: string): string {
  return markdown.replace(LITERAL_RUN, (run) =>
    run.split(SEPARATOR).sort().join(SEPARATOR)
  );
}

/** Whether two generated pages differ at most in the order of literal unions. */
/* jscpd:ignore-start */
export function sameExceptUnionOrder(a: string, b: string): boolean {
  return a === b || normalizeUnionOrder(a) === normalizeUnionOrder(b);
}

function listFiles(directory: string, relativeDirectory = ""): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    return entry.isDirectory()
      ? listFiles(path.join(directory, entry.name), relativePath)
/* jscpd:ignore-end */
      : [relativePath];
  });
}

/**
 * Copies freshly generated pages into the checked-in reference, skipping any
 * page whose only change is literal-union order, so regenerating the docs
 * never rewrites pages the change did not touch. Returns the pages written.
 */
export function syncGeneratedDocumentation(
  generatedDirectory: string,
  documentationDirectory: string
): string[] {
  const written: string[] = [];
  for (const relativePath of listFiles(generatedDirectory)) {
    const source = path.join(generatedDirectory, relativePath);
    const target = path.join(documentationDirectory, relativePath);
    const next = fs.readFileSync(source, "utf8");
    if (
      fs.existsSync(target) &&
      sameExceptUnionOrder(fs.readFileSync(target, "utf8"), next)
    ) {
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, next, "utf8");
    written.push(relativePath);
  }
  return written;
}
