// @vitest-environment node
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  createCustomTheorem,
  createSandboxTheorem,
  parseCustomFormula,
} from "@/lib/proof-custom";
import type { ProofNode } from "@/lib/proof";

/**
 * CodeQL alerts 7 (#3826) & 43: `latexCode` is serialized directly from a
 * `PropAst`, never from raw visitor text, and escapes backslashes alongside
 * every TeX metacharacter even when an AST node is constructed programmatically.
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

  it("escapes backslashes and TeX metacharacters on programmatic sandbox AST nodes", () => {
    const hostileNode: ProofNode = {
      id: "P1",
      label: "P1",
      ast: { type: "var", name: "x\\input{secret}_1$&#^~%" },
      type: "premise",
      description: "Hostile premise",
      meaning: "Hostile premise",
      x: 100,
      y: 100,
    };
    const goalNode: ProofNode = {
      id: "G1",
      label: "Q",
      ast: {
        type: "iff",
        left: { type: "not", operand: { type: "bottom" } },
        right: {
          type: "implies",
          left: { type: "var", name: "a\\_b" },
          right: { type: "var", name: "Q" },
        },
      },
      type: "conclusion",
      description: "Goal",
      meaning: "Goal",
      x: 400,
      y: 100,
    };
    const theorem = createSandboxTheorem([hostileNode, goalNode], []);
    expect(theorem.latexCode).not.toContain("\\input{secret}");
    expect(theorem.latexCode).toContain(
      "x\\textbackslash{}input\\{secret\\}\\_1\\$\\&\\#\\textasciicircum{}\\textasciitilde{}\\%"
    );
    expect(theorem.latexCode).toContain("a\\textbackslash{}\\_b");
    expect(theorem.latexCode).toContain("\\neg \\bot");
    expect(theorem.latexCode).toContain("\\leftrightarrow");
  });

  it("emits only known commands for any accepted identifiers", () => {
    const allowed = new Set([
      "\\begin",
      "\\end",
      "\\AxiomC",
      "\\UnaryInfC",
      "\\RightLabel",
      "\\BinaryInfC",
      "\\top",
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

        const sandbox = createSandboxTheorem([
          {
            id: "P1",
            label: `~${a} <-> (${b} & ${c})`,
            type: "premise",
            description: "Premise",
            meaning: "Premise",
            x: 100,
            y: 100,
          },
          {
            id: "G1",
            label: `${b} | false`,
            type: "conclusion",
            description: "Goal",
            meaning: "Goal",
            x: 300,
            y: 100,
          },
        ]);
        const sandboxCommands =
          sandbox.latexCode.match(/\\(?:[A-Za-z]+|_)/g) ?? [];
        for (const command of sandboxCommands) {
          expect(allowed.has(command)).toBe(true);
        }
      }),
      { numRuns: 200 }
    );
  });
});
