import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLINICAL_STANDARDS_PROFILE } from "../lib/clinical-standards";

/**
 * ADaM metadata from the CDISC Library (#2992 step 7).
 *
 * `sync` reads the ADaMIG and ADaM OCCDS versions the profile pins from the
 * CDISC Library API, in at most {@link MAX_LIBRARY_CALLS} calls, and writes
 * `lib/study-data/internal/conformance/adam-library-metadata.json`: for each
 * data structure, every variable's name, core designation (Req, Cond, Perm),
 * simple data type and the NCI codes of its codelists. It copies no labels,
 * descriptions or other IG text.
 *
 * It needs `CDISC_LIBRARY_API_KEY`, which exists only as a GitHub Actions
 * secret. Only `.github/workflows/cdisc-library-sync.yml` runs it, on a
 * schedule or by hand, never on a pull request; the site and its tests read
 * the committed file and never the key.
 */

export const LIBRARY_API = "https://api.library.cdisc.org/api";
const OUTPUT = "lib/study-data/internal/conformance/adam-library-metadata.json";

/** One variable of an ADaM data structure, as committed. */
export interface AdamLibraryVariable {
  readonly name: string;
  /** `Req`, `Cond` or `Perm`. */
  readonly core: string;
  readonly dataType?: string;
  /** NCI codes of the codelists the variable draws on. */
  readonly codelists: readonly string[];
}

/** The committed file. */
export interface AdamLibraryMetadata {
  readonly $comment: string;
  /** Each product read, as its CDISC Library path. */
  readonly products: Readonly<Record<string, string>>;
  readonly structures: Readonly<Record<string, readonly AdamLibraryVariable[]>>;
}

type Json = unknown;

const isObject = (v: Json): v is Record<string, Json> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Every `href` under any `_links` in a response. */
export function linkHrefs(json: Json): string[] {
  const out: string[] = [];
  const walk = (v: Json): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!isObject(v)) return;
    if (typeof v.href === "string") out.push(v.href);
    for (const value of Object.values(v)) walk(value);
  };
  walk(json);
  return out;
}

/** A version as the Library writes it in a path: `1.3` becomes `1-3`. */
const slug = (version: string) => version.replace(/\./g, "-");

/**
 * Most CDISC Library calls one sync makes. A free Library key allows five
 * calls a day, so a run must leave room for anything else that day.
 */
export const MAX_LIBRARY_CALLS = 4;

/**
 * The Library paths of the pinned ADaMIG and ADaM OCCDS. They are built from
 * the pinned versions rather than read from `/mdr/products`, which would
 * spend a call.
 *
 * @param versions - The pinned versions.
 * @returns Each product's path.
 */
export function adamProductPaths(versions: {
  readonly adamig: string;
  readonly occds: string;
}): { adamig: string; occds: string } {
  return {
    adamig: `/mdr/adam/adamig-${slug(versions.adamig)}`,
    occds: `/mdr/adam/adam-occds-${slug(versions.occds)}`,
  };
}

const structureFromHref = (href: unknown) =>
  typeof href === "string"
    ? href.match(/\/datastructures\/([^/]+)/)?.[1]
    : undefined;

/**
 * Every variable in a Library response, by data structure. A variable is an
 * object with a `name` and a `core`; its structure is the nearest enclosing
 * object that carries `analysisVariableSets`, or the `datastructures` segment
 * of its own links.
 *
 * @param json - A Library response.
 * @returns Variables by structure name, in document order.
 */
export function collectVariables(
  json: Json
): Map<string, AdamLibraryVariable[]> {
  const out = new Map<string, AdamLibraryVariable[]>();
  const walk = (v: Json, structure: string | undefined): void => {
    if (Array.isArray(v)) return v.forEach((x) => walk(x, structure));
    if (!isObject(v)) return;
    let here = structure;
    if (typeof v.name === "string" && "analysisVariableSets" in v) {
      here = v.name;
    }
    if (typeof v.name === "string" && typeof v.core === "string") {
      const links = isObject(v._links) ? v._links : {};
      const owner =
        here ??
        linkHrefs(links)
          .map(structureFromHref)
          .find((s): s is string => Boolean(s));
      if (owner) {
        const codelists = linkHrefs(
          isObject(links) ? (links.codelist ?? []) : []
        )
          .map((h) => h.match(/\/(C\d+)$/)?.[1])
          .filter((c): c is string => Boolean(c));
        const list = out.get(owner) ?? [];
        list.push({
          name: v.name,
          core: v.core,
          ...(typeof v.simpleDatatype === "string"
            ? { dataType: v.simpleDatatype }
            : {}),
          codelists: [...new Set(codelists)].sort(),
        });
        out.set(owner, list);
      }
      return;
    }
    for (const [key, value] of Object.entries(v)) {
      if (key !== "_links") walk(value, here);
    }
  };
  walk(json, undefined);
  return out;
}

/**
 * Reads a product's variables: from the product response when it embeds
 * them, otherwise by following its links, at most `limit` requests.
 * Following links costs a call per page, so with the daily call budget a
 * product that does not embed its variables fails the sync.
 *
 * @param get - Fetches a Library path and parses the JSON.
 * @param root - The product's path.
 * @param limit - The most requests to make.
 * @returns Variables by structure.
 */
export async function crawlProduct(
  get: (href: string) => Promise<Json>,
  root: string,
  limit = 2
): Promise<Map<string, AdamLibraryVariable[]>> {
  const merged = new Map<string, AdamLibraryVariable[]>();
  const seen = new Set<string>([root]);
  const queue = [root];
  let requests = 0;
  while (queue.length > 0) {
    if (requests >= limit) {
      throw new Error(`Stopped after ${limit} requests reading ${root}.`);
    }
    const href = queue.shift() as string;
    requests += 1;
    const json = await get(href);
    const found = collectVariables(json);
    for (const [structure, variables] of found) {
      const list = merged.get(structure) ?? [];
      for (const variable of variables) {
        if (!list.some((x) => x.name === variable.name)) list.push(variable);
      }
      merged.set(structure, list);
    }
    if (href === root && found.size > 0) break;
    for (const next of linkHrefs(json)) {
      if (next.startsWith(`${root}/`) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return merged;
}

/**
 * The committed file's text: structures and products sorted, variables in
 * the Library's order, so an unchanged Library leaves it byte-identical.
 *
 * @param products - Each product's path.
 * @param structures - Variables by structure.
 * @returns The JSON with a trailing newline.
 */
export function serializeMetadata(
  products: Record<string, string>,
  structures: Map<string, AdamLibraryVariable[]>
): string {
  const metadata: AdamLibraryMetadata = {
    $comment:
      "Derived from the CDISC Library by scripts/cdisc-library-adam.ts sync (names, core designations, data types and codelist codes only; no IG text). Do not edit by hand.",
    products: Object.fromEntries(
      Object.entries(products).sort(([a], [b]) => a.localeCompare(b))
    ),
    structures: Object.fromEntries(
      [...structures.entries()].sort(([a], [b]) => a.localeCompare(b))
    ),
  };
  return `${JSON.stringify(metadata, null, 2)}\n`;
}

async function main(argv: readonly string[]): Promise<number> {
  if (argv[0] !== "sync") {
    console.error("Usage: tsx scripts/cdisc-library-adam.ts sync");
    return 2;
  }
  const key = process.env.CDISC_LIBRARY_API_KEY;
  if (!key) {
    console.error("CDISC_LIBRARY_API_KEY is not set.");
    return 1;
  }
  let calls = 0;
  const get = async (href: string): Promise<Json> => {
    calls += 1;
    if (calls > MAX_LIBRARY_CALLS) {
      throw new Error(
        `Stopped before CDISC Library call ${calls}: a sync makes at most ${MAX_LIBRARY_CALLS}.`
      );
    }
    const response = await fetch(`${LIBRARY_API}${href}`, {
      headers: { "api-key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(60_000),
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `CDISC Library ${href} returned ${response.status}: it did not accept the key. Check that the CDISC_LIBRARY_API_KEY secret holds a current key from the CDISC Library API portal.`
      );
    }
    if (response.status === 429) {
      throw new Error(
        `CDISC Library ${href} returned 429: the key's daily call quota is used up. Run the sync again tomorrow.`
      );
    }
    if (response.status === 404) {
      throw new Error(
        `The CDISC Library has nothing at ${href}. Check that it publishes the pinned version.`
      );
    }
    if (!response.ok) {
      throw new Error(`CDISC Library ${href} returned ${response.status}.`);
    }
    return response.json();
  };
  const products = adamProductPaths({
    adamig: CLINICAL_STANDARDS_PROFILE.ADaMIG,
    occds: CLINICAL_STANDARDS_PROFILE.OCCDS,
  });
  const structures = new Map<string, AdamLibraryVariable[]>();
  for (const href of Object.values(products)) {
    const limit = MAX_LIBRARY_CALLS / Object.keys(products).length;
    for (const [name, variables] of await crawlProduct(get, href, limit)) {
      structures.set(name, variables);
    }
  }
  if (structures.size === 0) {
    console.error("The CDISC Library returned no ADaM variables.");
    return 1;
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  fs.writeFileSync(
    path.join(root, OUTPUT),
    serializeMetadata(products, structures)
  );
  for (const [name, variables] of structures) {
    const req = variables.filter((v) => v.core === "Req").length;
    console.log(`${name}: ${variables.length} variables, ${req} required`);
  }
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
