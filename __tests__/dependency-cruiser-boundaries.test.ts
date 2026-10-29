// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { cruise, type IViolation } from "dependency-cruiser";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import type { IConfiguration } from "dependency-cruiser";

/**
 * The deep-module boundary rules in `.dependency-cruiser.cjs`, run against an
 * isolated fixture tree rather than the repository (#3613). Each fixture file
 * makes one import, so each expected violation names exactly one edge.
 */

const require = createRequire(import.meta.url);
const config: IConfiguration = require(
  path.resolve(process.cwd(), ".dependency-cruiser.cjs")
);

const FIXTURE: Record<string, string> = {
  // Two packages, each with a public entry point and a private internal.
  "lib/pkg/index.ts": 'export { impl } from "./internal/impl";\n',
  "lib/pkg/internal/impl.ts": "export const impl = 1;\n",
  "lib/pkg/internal/sibling.ts":
    'import { impl } from "./impl";\nexport const sibling = impl;\n',
  "lib/pkg/feature.ts":
    'import { impl } from "./internal/impl";\nexport const feature = impl;\n',
  "lib/other/index.ts": 'export { other } from "./internal/other";\n',
  "lib/other/internal/other.ts": "export const other = 2;\n",
  "lib/other/internal/reach.ts":
    'import { impl } from "../../pkg/internal/impl";\nexport const reach = impl;\n',
  "lib/other/through-entry.ts":
    'import { impl } from "../pkg/index";\nexport const through = impl;\n',
  // A root lib/ file belongs to no package.
  "lib/root-private.ts":
    'import { impl } from "./pkg/internal/impl";\nexport const rootPrivate = impl;\n',
  "lib/root-public.ts":
    'import { impl } from "./pkg/index";\nexport const rootPublic = impl;\n',
  "app/page-private.ts":
    'import { impl } from "../lib/pkg/internal/impl";\nexport const page = impl;\n',
  "app/page-public.ts":
    'import { impl } from "../lib/pkg/index";\nexport const page = impl;\n',
  "__tests__/private.test.ts":
    'import { impl } from "../lib/pkg/internal/impl";\nexport const t = impl;\n',
  "__tests__/public.test.ts":
    'import { impl } from "../lib/pkg/index";\nexport const t = impl;\n',
};

let fixtureDir = "";
let violations: IViolation[] = [];

function violationsFrom(file: string) {
  return violations
    .filter((v) => v.from === file)
    .map((v) => ({ rule: v.rule.name, to: v.to }));
}

beforeAll(async () => {
  fixtureDir = mkdtempSync(path.join(tmpdir(), "depcruise-boundaries-"));
  for (const [file, source] of Object.entries(FIXTURE)) {
    const target = path.join(fixtureDir, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, source);
  }
  const result = await cruise(["lib", "app", "__tests__"], {
    baseDir: fixtureDir,
    validate: true,
    ruleSet: { forbidden: config.forbidden },
  });
  if (typeof result.output === "string") {
    throw new Error("dependency-cruiser returned a report, not a result");
  }
  violations = result.output.summary.violations;
});

afterAll(() => {
  if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
});

describe("deep-module boundary rules", () => {
  it("rejects a root lib/ file importing a package internal (#3613)", () => {
    expect(violationsFrom("lib/root-private.ts")).toEqual([
      {
        rule: "entrypoint-boundary-from-app",
        to: "lib/pkg/internal/impl.ts",
      },
    ]);
  });

  it("rejects app code importing a package internal", () => {
    expect(violationsFrom("app/page-private.ts")).toEqual([
      {
        rule: "entrypoint-boundary-from-app",
        to: "lib/pkg/internal/impl.ts",
      },
    ]);
  });

  it("rejects a test importing a package internal", () => {
    expect(
      violationsFrom("__tests__/private.test.ts").map((v) => v.rule)
    ).toContain("tests-through-entrypoints");
  });

  it("rejects one package reaching into another package's internals", () => {
    expect(violationsFrom("lib/other/internal/reach.ts")).toEqual([
      {
        rule: "entrypoint-boundary-across-packages",
        to: "lib/pkg/internal/impl.ts",
      },
    ]);
  });

  it("allows a package to import its own internals, from its root or a subfolder", () => {
    expect(violationsFrom("lib/pkg/index.ts")).toEqual([]);
    expect(violationsFrom("lib/pkg/feature.ts")).toEqual([]);
    expect(violationsFrom("lib/pkg/internal/sibling.ts")).toEqual([]);
  });

  it("allows every caller to import a package entry point", () => {
    for (const file of [
      "lib/root-public.ts",
      "lib/other/through-entry.ts",
      "app/page-public.ts",
      "__tests__/public.test.ts",
    ]) {
      expect(violationsFrom(file)).toEqual([]);
    }
  });
});
