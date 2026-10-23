// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  extractAllMermaidBlocks,
  validateCorpus,
} from "../scripts/validate-mermaid-corpus";

describe("50-source Mermaid corpus validation", () => {
  it("extracts all 50 static Mermaid diagrams across repository source files", () => {
    expect(extractAllMermaidBlocks()).toHaveLength(50);
  });

  it("renders every static Mermaid block through the strict browser engine", async () => {
    const { results, total } = await validateCorpus();

    expect(total).toBe(50);
    expect(results.filter((result) => !result.valid)).toEqual([]);
  }, 30_000);
});
