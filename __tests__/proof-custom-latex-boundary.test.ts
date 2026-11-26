// @vitest-environment node
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { createCustomTheorem, parseCustomFormula } from "@/lib/proof-custom";

/**
 * CodeQL alert 7 (#3826): `latexCode` is built from an AST, never from raw
 * visitor text. The parser admits only ASCII identifiers and fixed logic
 * operators, so a TeX control sequence cannot reach the serializer.
 */
describe("Custom Proof LaTeX encoding boundary", () => {
  it.each([
    "\\input{x}",
    "A \\land B",
    "A_{1}",
    "$A$",
    "A # B",
    "A % comment",
    "A ^ B",
    "A -> B C",
    "(A -> B",
    "A -> B)",
  ])("rejects %j before an AST exists", (input) => {
    expect(() => parseCustomFormula(input)).toThrow();
  });

  it("serializes every supported operator to a fixed TeX command", () => {
    const theorem = createCustomTheorem(["P_1", "P_1 -> Q_2", "Q_2 -> R"], "R");
    expect(theorem.latexCode).toContain("P\\_1");
    expect(theorem.latexCode).toContain("P\\_1 \\to Q\\_2");

    const mixed = createCustomTheorem(
      ["A & B", "A & B -> ~C | D", "~C | D -> E"],
      "E"
    );
    expect(mixed.latexCode).toContain("\\land");
    expect(mixed.latexCode).toContain("\\neg");
    expect(mixed.latexCode).toContain("\\lor");
  });

  it("emits only known commands for any accepted identifiers", () => {
    const allowed = new Set([
      "\\begin",
      "\\end",
      "\\AxiomC",
      "\\RightLabel",
      "\\BinaryInfC",
      "\\to",
      "\\leftrightarrow",
      "\\land",
      "\\lor",
      "\\neg",
      "\\bot",
      "\\_",
    ]);
    const ident = fc.stringMatching(/^[A-Za-z][A-Za-z0-9_]{0,8}$/);
    fc.assert(
      fc.property(ident, ident, ident, (a, b, c) => {
        fc.pre(new Set([a, b, c]).size === 3 && ![a, b, c].includes("false"));
        const theorem = createCustomTheorem(
          [a, `${a} -> ${b}`, `${b} -> ${c}`],
          c
        );
        const commands = theorem.latexCode.match(/\\(?:[A-Za-z]+|_)/g) ?? [];
        for (const command of commands) {
          expect(allowed.has(command)).toBe(true);
        }
      }),
      { numRuns: 200 }
    );
  });
});
