// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * TypeDoc copies JSDoc prose into the API reference as Markdown, and
 * `npm run lint:docs` lints that output (#3791). Two comment shapes render
 * as invalid Markdown: a wrapped line that starts with `#` and a digit
 * (an issue reference read as a heading, MD018), and an inline code span
 * with a space at either edge (MD038). This scans the authored comments so
 * the pattern fails here, before a local docs build does.
 */

const root = path.resolve(__dirname, "..");
const SCANNED = ["lib", "hooks", "types"];

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")
      ? [full]
      : [];
  });
}

function commentMarkdownProblems(source: string): string[] {
  const problems: string[] = [];
  for (const block of source.matchAll(/\/\*\*[\s\S]*?\*\//g)) {
    for (const raw of block[0].split("\n")) {
      const text = raw.replace(/^\s*\/?\*+\s?/, "");
      if (/^#\d/.test(text)) problems.push(`heading: ${text}`);
      const ticks = (text.match(/`/g) ?? []).length;
      if (ticks % 2 !== 0 || text.includes("```")) continue;
      for (const span of text.matchAll(/`([^`]+)`/g)) {
        const body = span[1]!;
        if (body.trim() && /^\s|\s$/.test(body)) {
          problems.push(`code span: ${text}`);
        }
      }
    }
  }
  return problems;
}

describe("JSDoc prose renders as valid Markdown (#3791)", () => {
  it("flags the two shapes that broke lint:docs", () => {
    expect(
      commentMarkdownProblems("/**\n * Serious Event,\n * #2826). Only HR\n */")
    ).toHaveLength(1);
    expect(
      commentMarkdownProblems(
        "/** @returns The result, with ` (AGENTS.md section N)` added. */"
      )
    ).toHaveLength(1);
    expect(
      commentMarkdownProblems("/** Fixed in #2826, with `code` spans. */")
    ).toEqual([]);
  });

  it("finds neither shape in lib, hooks or types", () => {
    const found = SCANNED.flatMap((dir) =>
      sourceFiles(path.join(root, dir)).flatMap((file) =>
        commentMarkdownProblems(fs.readFileSync(file, "utf-8")).map(
          (problem) => `${path.relative(root, file)}: ${problem}`
        )
      )
    );
    expect(found).toEqual([]);
  });
});
