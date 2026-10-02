// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * The seed must never destroy content that exists only in the database.
 *
 * `prisma/seed.ts` previously ran `deleteMany({})` on both content tables before
 * recreating from its payloads, commented "enforce idempotence". That does give
 * idempotence, but destructively: the seed becomes authoritative over the whole
 * table, so any row whose slug is absent from the payloads is deleted.
 *
 * Two published case studies, `equipose` and `qrcraftly`, existed in production
 * and in no source file. A seed run would have deleted both and taken two live
 * indexed URLs with them. Neon's free plan retains six hours of history and has
 * no snapshot schedule, so that loss would have been permanent in practice.
 *
 * These are source-level assertions rather than behavioural ones because
 * `prisma/seed.ts` calls `main()` at import time, so importing it from a test
 * would attempt to connect to, and write to, whatever database the developer's
 * environment points at.
 */
describe("prisma seed is non-destructive", () => {
  const source = readFileSync(join(process.cwd(), "prisma/seed.ts"), "utf-8");

  it("never calls deleteMany on the content tables", () => {
    for (const model of ["caseStudy", "blogPost"]) {
      expect(
        source.includes(`prisma.${model}.deleteMany`),
        `prisma.${model}.deleteMany would destroy rows that exist only in the database`
      ).toBe(false);
    }
  });

  it("upserts both content tables so database-only rows survive", () => {
    for (const model of ["caseStudy", "blogPost"]) {
      expect(
        source.includes(`prisma.${model}.upsert`),
        `prisma.${model} must be written with upsert, keyed on its unique slug`
      ).toBe(true);
    }
  });

  it("reports rows present in the database but absent from the seed", () => {
    // Silence here is how the orphaned rows went unnoticed for months.
    expect(source).toMatch(/Preserved \$\{?/);
  });
});

/**
 * Extracts the SEED_PAYLOADS array literal and evaluates it in isolation.
 *
 * Importing the module is not an option (see above), so the array is located by
 * bracket matching and evaluated with the imported command/playback constants
 * stubbed out. Those stubs are only referenced by `commands_json` /
 * `playback_json`, neither of which this suite asserts on.
 */
function loadSeedPayloads(source: string): Array<Record<string, string>> {
  const start = source.indexOf("const SEED_PAYLOADS");
  expect(start, "SEED_PAYLOADS should be declared").toBeGreaterThan(-1);

  const open = source.indexOf("[", start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "[") depth++;
    else if (source[i] === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  expect(end, "SEED_PAYLOADS array should be bracket-balanced").toBeGreaterThan(
    open
  );

  const stubNames = [
    "IMEDNET_COMMANDS_OBJ",
    "IMEDNET_PLAYBACK_OBJ",
    "DUCKDEPLOY_COMMANDS_OBJ",
    "DUCKDEPLOY_PLAYBACK_OBJ",
    "CARDIAC_RISK_COMMANDS_OBJ",
    "CARDIAC_RISK_PLAYBACK_OBJ",
    "FOUR_GLORY_COMMANDS_OBJ",
    "FOUR_GLORY_PLAYBACK_OBJ",
    "CRF_XL_COMMANDS_OBJ",
    "CRF_XL_PLAYBACK_OBJ",
    "PROMPTOPS_COMMANDS_OBJ",
    "PROMPTOPS_PLAYBACK_OBJ",
  ];

  const factory = new Function(
    ...stubNames,
    `return ${source.slice(open, end + 1)}`
  );
  return factory(...stubNames.map(() => ({})));
}

describe("recovered case studies remain version-controlled", () => {
  const source = readFileSync(join(process.cwd(), "prisma/seed.ts"), "utf-8");
  const payloads = loadSeedPayloads(source);

  /**
   * Character counts observed in the production database on 2026-09-19, before
   * these rows were copied into source control. They pin the content exactly: a
   * truncating edit changes a length and fails here rather than silently
   * shipping a shortened case study.
   */
  const RECOVERED_FROM_PRODUCTION = {
    equipose: { editorial_content: 249, architectural_narrative: 2615 },
    qrcraftly: { editorial_content: 235, architectural_narrative: 2316 },
  } as const;

  for (const [slug, fields] of Object.entries(RECOVERED_FROM_PRODUCTION)) {
    it(`retains "${slug}" with its production content intact`, () => {
      const payload = payloads.find((p) => p.slug === slug);
      expect(
        payload,
        `"${slug}" existed only in the production database; removing it from SEED_PAYLOADS loses the content`
      ).toBeDefined();

      for (const [field, expectedLength] of Object.entries(fields)) {
        expect(
          payload![field].length,
          `${slug}.${field} no longer matches the content recovered from production`
        ).toBe(expectedLength);
      }
    });
  }

  it("declares no duplicate slugs", () => {
    const slugs = payloads.map((p) => p.slug);
    const duplicates = slugs.filter((s, i) => slugs.indexOf(s) !== i);
    expect(duplicates, `duplicate slugs would upsert over each other`).toEqual(
      []
    );
  });

  it("gives every payload the fields the upsert writes", () => {
    for (const payload of payloads) {
      for (const field of [
        "slug",
        "title",
        "primary_language",
        "tags",
        "editorial_content",
        "architectural_narrative",
      ]) {
        expect(
          typeof payload[field],
          `${payload.slug ?? "(unnamed)"} is missing ${field}`
        ).toBe("string");
      }
    }
  });
});
