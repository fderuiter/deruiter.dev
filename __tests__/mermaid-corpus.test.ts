// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  extractAllMermaidBlocks,
  validateCorpus,
} from "../scripts/validate-mermaid-corpus";

describe("48-source Mermaid corpus validation", () => {
  it("extracts all 48 static Mermaid diagrams across repository source files", () => {
    expect(extractAllMermaidBlocks()).toHaveLength(48);
  });

  it("renders every static Mermaid block through the strict browser engine", async () => {
    const { results, total } = await validateCorpus();

    expect(total).toBe(48);
    expect(results.filter((result) => !result.valid)).toEqual([]);
  }, 30_000);
});
