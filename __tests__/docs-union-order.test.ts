// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  normalizeUnionOrder,
  sameExceptUnionOrder,
  syncGeneratedDocumentation,
} from "../scripts/docs-union-order";
import { checkDocumentationDrift } from "../scripts/documentation-drift";

// #951: TypeDoc prints checker-inferred literal unions in type-id order, which
// shifts when an unrelated file joins the program.
const DECLARED =
  '> **userRole**: `"Site Coordinator"` \\| `"Principal Investigator"` \\| `"CRA Monitor"` \\| `"Data Manager"`\n';
const REORDERED =
  '> **userRole**: `"Data Manager"` \\| `"Site Coordinator"` \\| `"Principal Investigator"` \\| `"CRA Monitor"`\n';

const temporaryDirectories: string[] = [];
const tempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-union-order-"));
  temporaryDirectories.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("literal-union order normalization", () => {
  it("treats a reordered literal union as the same page", () => {
    expect(sameExceptUnionOrder(DECLARED, REORDERED)).toBe(true);
    expect(normalizeUnionOrder(DECLARED)).toBe(normalizeUnionOrder(REORDERED));
  });

  it("still sees a literal added, removed or renamed", () => {
    const added = DECLARED.replace(
      '`"Data Manager"`',
      '`"Data Manager"` \\| `"Auditor"`'
    );
    const renamed = DECLARED.replace("Data Manager", "Data Steward");
    const removed = DECLARED.replace(' \\| `"Data Manager"`', "");
    for (const changed of [added, renamed, removed]) {
      expect(sameExceptUnionOrder(DECLARED, changed)).toBe(false);
    }
  });

  it("sorts number literals and leaves other members in place", () => {
    expect(normalizeUnionOrder("`3` \\| `-1` \\| `2`")).toBe(
      "`-1` \\| `2` \\| `3`"
    );
    const mixed = '`string` \\| `"b"` \\| `"a"` \\| `null`';
    expect(normalizeUnionOrder(mixed)).toBe(
      '`string` \\| `"a"` \\| `"b"` \\| `null`'
    );
    // A lone literal, prose and table pipes are untouched.
    const other = '`"only"` and a | table | row, and `x` \\| `y`';
    expect(normalizeUnionOrder(other)).toBe(other);
  });
});

describe("documentation drift ignores literal-union order", () => {
  function driftAgainst(generated: string) {
    const root = tempDir();
    fs.mkdirSync(path.join(root, "docs"));
    fs.writeFileSync(path.join(root, "docs", "Audit.md"), DECLARED);
    return checkDocumentationDrift({
      workspaceRoot: root,
      compile: (out) => fs.writeFileSync(path.join(out, "Audit.md"), generated),
      getGitStatus: () => ({ modified: [], untracked: [] }),
    });
  }

  it("passes when only the literal order changed", () => {
    expect(driftAgainst(REORDERED)).toEqual({ status: "pass", details: [] });
  });

  it("fails when the union's members changed", () => {
    expect(
      driftAgainst(REORDERED.replace("CRA Monitor", "Monitor")).status
    ).toBe("fail");
  });
});

describe("regenerating the reference", () => {
  it("skips order-only changes and writes real and new pages", () => {
    const generated = tempDir();
    const docs = tempDir();
    fs.writeFileSync(path.join(docs, "Audit.md"), DECLARED);
    fs.writeFileSync(path.join(docs, "Changed.md"), "# Old\n");
    fs.writeFileSync(path.join(generated, "Audit.md"), REORDERED);
    fs.writeFileSync(path.join(generated, "Changed.md"), "# New\n");
    fs.mkdirSync(path.join(generated, "nested"));
    fs.writeFileSync(path.join(generated, "nested", "Added.md"), "# Added\n");

    const written = syncGeneratedDocumentation(generated, docs);

    expect(written.sort()).toEqual(
      ["Changed.md", path.join("nested", "Added.md")].sort()
    );
    expect(fs.readFileSync(path.join(docs, "Audit.md"), "utf8")).toBe(DECLARED);
    expect(fs.readFileSync(path.join(docs, "Changed.md"), "utf8")).toBe(
      "# New\n"
    );
    expect(fs.readFileSync(path.join(docs, "nested", "Added.md"), "utf8")).toBe(
      "# Added\n"
    );
  });

  it("returns nothing when the generated directory does not exist", () => {
    expect(
      syncGeneratedDocumentation(path.join(tempDir(), "missing"), tempDir())
    ).toEqual([]);
  });
});
