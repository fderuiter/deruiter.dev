/* eslint-disable no-console */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLINICAL_STANDARDS_PROFILE,
  controlledTerminologyCitation,
} from "../lib/clinical-standards";

/**
 * The CDISC Controlled Terminology subset the repository is checked
 * against (#2992, step 3d).
 *
 * Every NCI code written in `lib/`, `components/` or `app/` must resolve in
 * the pinned NCI EVS release of the CDISC CT packages. `write` downloads
 * those packages (or reads them from `--from <dir>`), checks their SHA-256,
 * and writes the derived subset to {@link SUBSET_FILE}: for each codelist
 * the code cites, its submission value, name, extensibility and every term;
 * for each other code, the names it goes by and the codelists it belongs
 * to. It keeps no definitions, so nothing from the CDISC documents is
 * copied. `check` regenerates the subset and fails when it differs, and
 * `__tests__/cdisc-ct-release.test.ts` checks every codelist, term and coded
 * value in the code against it.
 */

/** One CDISC CT package of the pinned release. */
export interface CtSource {
  readonly id: "SDTM" | "ADaM" | "DDF";
  readonly url: string;
  readonly sha256: string;
}

const RELEASE = CLINICAL_STANDARDS_PROFILE.CT.packageDate;

const archive = (id: CtSource["id"]) =>
  `https://evs.nci.nih.gov/ftp1/CDISC/${id}/Archive/${encodeURIComponent(
    `${id} Terminology ${RELEASE}.txt`
  )}`;

/**
 * The tab-separated exports of the pinned release, with the SHA-256 they
 * had when fetched. A new release changes the date in `CLINICAL_STANDARDS_PROFILE`
 * and every hash here.
 */
export const CT_SOURCES: readonly CtSource[] = [
  {
    id: "SDTM",
    url: archive("SDTM"),
    sha256: "9e8117a90e28e5aade3ac2d52fe1b60adfcccc92a8894891f04ad05c7cf1f88d",
  },
  {
    id: "ADaM",
    url: archive("ADaM"),
    sha256: "b33af40aecdce15fc943c1faad371497daa4ee144173b4b863d89794f2c7a45d",
  },
  {
    id: "DDF",
    url: archive("DDF"),
    sha256: "3493ae2d5fdace071994eb6956413840e9ba643d737f6d700fa85e79da911af5",
  },
];

/**
 * NCI Thesaurus concepts the code cites that no CDISC CT package
 * publishes. They are coded under the NCIt system, never the CDISC one.
 */
export const NCIT_ONLY_CODES: Readonly<Record<string, string>> = {
  C128534: "Medication Administration",
};

/**
 * Codelists CDISC has retired that the code still names, in comments that
 * explain why it does not use them. The subset records that they are no
 * longer in the release.
 */
export const RETIRED_CODES: Readonly<Record<string, string>> = {
  C74457: "RACE, last in SDTM CT 2025-09-26",
  C66790: "ETHNIC, last in SDTM CT 2025-09-26",
};

/** The committed subset, relative to the repository root. */
export const SUBSET_FILE = "__tests__/fixtures/cdisc-ct/ct-subset.json";

/** Folders whose source files are swept for NCI codes. */
export const SWEPT_DIRS = ["lib", "components", "app"] as const;

/** Files that cite codes as data about other systems, not as CT. */
const SWEEP_EXCLUDES = new Set([
  "lib/study-data/internal/core/recorded-findings.json",
  "lib/fallback-blog-posts.ts",
]);

const CODE = /\bC\d{3,7}\b/g;

/** A codelist of the subset. */
export interface SubsetCodelist {
  readonly publishingSet: CtSource["id"];
  readonly submissionValue: string;
  readonly name: string;
  readonly extensible: boolean;
  /** Submission value to NCI code, in submission value order. */
  readonly terms: Readonly<Record<string, string>>;
}

/** A code the repository cites that is not one of its codelists. */
export interface SubsetConcept {
  /** Submission values, preferred term and synonyms, lower-cased. */
  readonly names: readonly string[];
  /** Codelists it is a term of, with its submission value in each. */
  readonly memberOf: Readonly<Record<string, string>>;
}

/** The committed subset. */
export interface CtSubset {
  readonly _source: string;
  readonly package: string;
  readonly sources: readonly CtSource[];
  readonly codelists: Readonly<Record<string, SubsetCodelist>>;
  readonly concepts: Readonly<Record<string, SubsetConcept>>;
  readonly ncitOnly: Readonly<Record<string, string>>;
  readonly retired: Readonly<Record<string, string>>;
}

/** One row of an EVS tab-separated export. */
interface EvsRow {
  readonly source: CtSource["id"];
  readonly code: string;
  readonly codelistCode: string;
  readonly extensible: string;
  readonly codelistName: string;
  readonly submissionValue: string;
  readonly synonyms: readonly string[];
  readonly preferredTerm: string;
}

/** Parses an EVS export, refusing anything that is not one. */
export function parseEvsExport(source: CtSource["id"], text: string): EvsRow[] {
  const [header, ...lines] = text.split(/\r?\n/);
  const columns = header.split("\t");
  const at = (name: string) => {
    const index = columns.indexOf(name);
    if (index < 0) {
      throw new Error(`${source}: the export has no "${name}" column.`);
    }
    return index;
  };
  const code = at("Code");
  const codelistCode = at("Codelist Code");
  const extensible = at("Codelist Extensible (Yes/No)");
  const codelistName = at("Codelist Name");
  const submissionValue = at("CDISC Submission Value");
  const synonyms = at("CDISC Synonym(s)");
  const preferredTerm = at("NCI Preferred Term");
  return lines
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const cells = line.split("\t");
      return {
        source,
        code: cells[code],
        codelistCode: cells[codelistCode],
        extensible: cells[extensible],
        codelistName: cells[codelistName],
        submissionValue: cells[submissionValue],
        synonyms: cells[synonyms]
          .split(";")
          .map((value) => value.trim())
          .filter(Boolean),
        preferredTerm: cells[preferredTerm],
      };
    });
}

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "generated" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(full);
    else if (/\.(ts|tsx|json)$/.test(entry.name)) yield full;
  }
}

/**
 * Every NCI code written in the swept folders, with the files that cite it.
 * Comments count: a code in a comment is still a claim about CDISC CT.
 */
export function citedCodes(root: string): Map<string, string[]> {
  const cited = new Map<string, string[]>();
  for (const dir of SWEPT_DIRS) {
    for (const file of sourceFiles(path.join(root, dir))) {
      const relative = path.relative(root, file).split(path.sep).join("/");
      if (SWEEP_EXCLUDES.has(relative)) continue;
      for (const match of fs.readFileSync(file, "utf8").matchAll(CODE)) {
        const files = cited.get(match[0]) ?? [];
        if (!files.includes(relative)) files.push(relative);
        cited.set(match[0], files);
      }
    }
  }
  return new Map([...cited].sort(([a], [b]) => a.localeCompare(b)));
}

const byKey = <T>(entries: Iterable<[string, T]>) =>
  Object.fromEntries(
    [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );

/**
 * Builds the subset for the cited codes from the parsed exports. Throws on
 * a cited code that resolves nowhere and is not listed as NCIt-only or
 * retired, and on a retired code the release still publishes.
 */
export function buildSubset(
  rows: readonly EvsRow[],
  cited: ReadonlySet<string>
): CtSubset {
  const headers = new Map<string, EvsRow>();
  const termsOf = new Map<string, EvsRow[]>();
  const rowsOf = new Map<string, EvsRow[]>();
  for (const row of rows) {
    if (row.codelistCode === "") headers.set(row.code, row);
    else
      termsOf.set(row.codelistCode, [
        ...(termsOf.get(row.codelistCode) ?? []),
        row,
      ]);
    rowsOf.set(row.code, [...(rowsOf.get(row.code) ?? []), row]);
  }
  const unknown = [...cited].filter(
    (code) =>
      !rowsOf.has(code) &&
      !(code in NCIT_ONLY_CODES) &&
      !(code in RETIRED_CODES)
  );
  if (unknown.length > 0) {
    throw new Error(
      `No CDISC CT package of ${RELEASE} publishes ${unknown.join(", ")}. Fix the code, or list an NCIt-only concept in NCIT_ONLY_CODES.`
    );
  }
  const stillPublished = Object.keys(RETIRED_CODES).filter((code) =>
    rowsOf.has(code)
  );
  if (stillPublished.length > 0) {
    throw new Error(
      `${stillPublished.join(", ")} are listed as retired but are published in ${RELEASE}.`
    );
  }
  const codelists = new Map<string, SubsetCodelist>();
  const concepts = new Map<string, SubsetConcept>();
  for (const code of cited) {
    const header = headers.get(code);
    if (header) {
      const terms = [...(termsOf.get(code) ?? [])].sort((a, b) =>
        a.submissionValue < b.submissionValue
          ? -1
          : a.submissionValue > b.submissionValue
            ? 1
            : 0
      );
      codelists.set(code, {
        publishingSet: header.source,
        submissionValue: header.submissionValue,
        name: header.codelistName,
        extensible: header.extensible === "Yes",
        terms: Object.fromEntries(
          terms.map((term) => [term.submissionValue, term.code])
        ),
      });
      continue;
    }
    const found = rowsOf.get(code);
    if (!found) continue;
    const names = new Set<string>();
    const memberOf = new Map<string, string>();
    for (const row of found) {
      for (const name of [
        row.submissionValue,
        row.preferredTerm,
        ...row.synonyms,
      ]) {
        if (name) names.add(name.toLowerCase());
      }
      memberOf.set(row.codelistCode, row.submissionValue);
    }
    concepts.set(code, { names: [...names].sort(), memberOf: byKey(memberOf) });
  }
  return {
    _source: `Derived from the NCI EVS CDISC Controlled Terminology exports of ${RELEASE} (https://evs.nci.nih.gov/ftp1/CDISC/) by scripts/cdisc-ct-subset.ts. Codes, submission values, names and synonyms only; no definitions.`,
    package: controlledTerminologyCitation(),
    sources: CT_SOURCES,
    codelists: byKey(codelists),
    concepts: byKey(concepts),
    ncitOnly: NCIT_ONLY_CODES,
    retired: RETIRED_CODES,
  };
}

/** The subset as committed: two-space JSON with a final newline. */
export function serializeSubset(subset: CtSubset): string {
  return `${JSON.stringify(subset, null, 2)}\n`;
}

async function readSource(source: CtSource, from?: string): Promise<string> {
  let bytes: Buffer;
  if (from) {
    bytes = fs.readFileSync(
      path.join(from, `${source.id} Terminology ${RELEASE}.txt`)
    );
  } else {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`${source.url}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== source.sha256) {
    throw new Error(
      `${source.id} Terminology ${RELEASE} has SHA-256 ${sha256}, not the pinned ${source.sha256}. EVS answers a missing file with an HTML page, so check the release date first.`
    );
  }
  return bytes.toString("utf8");
}

async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv;
  const fromIndex = rest.indexOf("--from");
  const from = fromIndex >= 0 ? rest[fromIndex + 1] : undefined;
  if (command !== "write" && command !== "check") {
    console.error(
      "Usage: tsx scripts/cdisc-ct-subset.ts write|check [--from <dir>]"
    );
    return 2;
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const rows: EvsRow[] = [];
  for (const source of CT_SOURCES) {
    rows.push(...parseEvsExport(source.id, await readSource(source, from)));
  }
  const text = serializeSubset(
    buildSubset(rows, new Set(citedCodes(root).keys()))
  );
  const file = path.join(root, SUBSET_FILE);
  if (command === "write") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    console.log(`Wrote ${SUBSET_FILE}.`);
    return 0;
  }
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text) {
    console.error(
      `${SUBSET_FILE} is stale. Run: npx tsx scripts/cdisc-ct-subset.ts write`
    );
    return 1;
  }
  console.log(`${SUBSET_FILE} is current.`);
  return 0;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  );
}
