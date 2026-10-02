// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  parseFormula,
  parseFormulaWithError,
  parseHypotheses,
  tokenizeFormula,
  resetNodeCounter,
} from "@/lib/quasi-perfect/compiler";
import { renderASTString } from "@/lib/quasi-perfect/engine";

describe("Pratt Formula Compiler", () => {
  it("tokenizes formula symbols, identifiers, numbers, and operators", () => {
    const tokens = tokenizeFormula("(a + b)^2 = a^2 + 2*a*b + b^2");
    expect(tokens.map((t) => t.value)).toEqual([
      "(",
      "a",
      "+",
      "b",
      ")",
      "^",
      "2",
      "=",
      "a",
      "^",
      "2",
      "+",
      "2",
      "*",
      "a",
      "*",
      "b",
      "+",
      "b",
      "^",
      "2",
      "",
    ]);
  });

  it("parses binomial expansion identity (a + b)^2 = a^2 + 2*a*b + b^2 into valid AST", () => {
    resetNodeCounter();
    const ast = parseFormula("(a + b)^2 = a^2 + 2*a*b + b^2");
    expect(ast.type).toBe("Equality");
    expect(ast.value).toBe("=");
    expect(ast.children).toHaveLength(2);

    // Left side: (a + b)^2
    const left = ast.children![0];
    expect(left.type).toBe("Operator");
    expect(left.value).toBe("^");
    expect(left.children![0].type).toBe("Operator");
    expect(left.children![0].value).toBe("+");
    expect(left.children![1].value).toBe(2);

    // Render back to string
    const rendered = renderASTString(ast);
    expect(rendered).toContain("=");
    expect(rendered).toContain("^");
  });

  it("handles implication right-associativity P -> Q -> P", () => {
    resetNodeCounter();
    const ast = parseFormula("P -> Q -> P");
    expect(ast.type).toBe("Implication");
    expect(ast.value).toBe("→");
    // Right associative: P -> (Q -> P)
    expect(ast.children![0].value).toBe("P");
    expect(ast.children![1].type).toBe("Implication");
    expect(ast.children![1].children![0].value).toBe("Q");
    expect(ast.children![1].children![1].value).toBe("P");
  });

  it("parses negation and conjunction/disjunction operators", () => {
    resetNodeCounter();
    const ast = parseFormula("~P \\/ (Q /\\ ¬R)");
    expect(ast.type).toBe("Disjunction");
    expect(ast.children![0].type).toBe("Negation");
    expect(ast.children![1].type).toBe("Conjunction");
  });

  it("parses arithmetic decidability 3 + 7 = 10", () => {
    resetNodeCounter();
    const ast = parseFormula("3 + 7 = 10");
    expect(ast.type).toBe("Equality");
    expect(ast.children![0].type).toBe("Operator");
    expect(ast.children![0].children![0].value).toBe(3);
    expect(ast.children![0].children![1].value).toBe(7);
    expect(ast.children![1].value).toBe(10);
  });

  it("formats syntax errors with column pointers", () => {
    const res = parseFormulaWithError("(a + b) *");
    expect(res.ast).toBeNull();
    expect(res.error).toBeDefined();
    expect(res.error).toContain("Syntax error at column 10");
    expect(res.error).toContain("^");
  });

  it("parses custom hypotheses with optional names", () => {
    resetNodeCounter();
    const hyps = parseHypotheses("h1: a = b, h2: b = c, x = y");
    expect(hyps).toHaveLength(3);
    expect(hyps[0].metadata?.name).toBe("h1");
    expect(hyps[1].metadata?.name).toBe("h2");
    expect(hyps[2].metadata?.name).toBe("h3");
    expect(hyps[0].type).toBe("Equality");
  });
});
