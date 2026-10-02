// @vitest-environment node
// #1311: renderASTString never added parentheses, so Level 4's goal
// (a + b) + c = a + (b + c) printed as "a + b + c = a + b + c" and the rfl
// error message showed two identical strings.
import { describe, it, expect } from "vitest";
import {
  puzzleLevels,
  renderASTString,
  tacticDefs,
  type ASTNode,
} from "@/lib/quasi-perfect";

let nextId = 0;
const v = (name: string): ASTNode => ({
  id: `v${nextId++}`,
  type: "Variable",
  value: name,
});
const bin = (
  type: ASTNode["type"],
  value: string,
  left: ASTNode,
  right: ASTNode
): ASTNode => ({ id: `n${nextId++}`, type, value, children: [left, right] });
const op = (value: string, left: ASTNode, right: ASTNode) =>
  bin("Operator", value, left, right);

describe("renderASTString grouping (#1311)", () => {
  it("tells (a + b) + c apart from a + (b + c)", () => {
    const leftNested = op("+", op("+", v("a"), v("b")), v("c"));
    const rightNested = op("+", v("a"), op("+", v("b"), v("c")));
    expect(renderASTString(leftNested)).toBe("a + b + c");
    expect(renderASTString(rightNested)).toBe("a + (b + c)");
  });

  it("shows Level 4's two sides differently", () => {
    const level4 = puzzleLevels.find((l) => l.id === 4)!;
    expect(renderASTString(level4.goal)).toBe("a + b + c = a + (b + c)");
  });

  it("keeps the rfl error message readable", () => {
    const level4 = puzzleLevels.find((l) => l.id === 4)!;
    const result = tacticDefs.rfl.execute(
      level4.goal,
      level4.goal,
      level4.hypotheses
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("got 'a + b + c = a + (b + c)'");
  });

  it("follows arithmetic precedence", () => {
    expect(renderASTString(op("+", op("*", v("x"), v("y")), v("z")))).toBe(
      "x * y + z"
    );
    expect(renderASTString(op("*", op("+", v("x"), v("y")), v("z")))).toBe(
      "(x + y) * z"
    );
    expect(renderASTString(op("-", v("a"), op("-", v("b"), v("c"))))).toBe(
      "a - (b - c)"
    );
    expect(renderASTString(op("^", v("a"), op("^", v("b"), v("c"))))).toBe(
      "a ^ b ^ c"
    );
    expect(renderASTString(op("^", op("^", v("a"), v("b")), v("c")))).toBe(
      "(a ^ b) ^ c"
    );
  });

  it("groups logical connectives", () => {
    const P = v("P");
    const Q = v("Q");
    const R = v("R");
    expect(
      renderASTString(bin("Implication", "→", bin("Implication", "→", P, Q), R))
    ).toBe("(P → Q) → R");
    expect(
      renderASTString(bin("Implication", "→", P, bin("Implication", "→", Q, R)))
    ).toBe("P → Q → R");
    expect(
      renderASTString(bin("Conjunction", "∧", bin("Disjunction", "∨", P, Q), R))
    ).toBe("(P ∨ Q) ∧ R");
    expect(
      renderASTString(bin("Implication", "→", bin("Conjunction", "∧", P, Q), R))
    ).toBe("P ∧ Q → R");
  });
});
