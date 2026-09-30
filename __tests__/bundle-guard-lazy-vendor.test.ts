import { describe, it, expect } from "vitest";
import {
  DEFAULT_BUDGETS,
  LAZY_VENDOR_CHUNK_BUDGETS,
  chunkGzipBudget,
} from "../lib/dx/bundle-guard";

describe("chunkGzipBudget lazy vendor ceilings (#1490)", () => {
  const elk = LAZY_VENDOR_CHUNK_BUDGETS.find((v) => v.name === "elkjs")!;
  const elkSource = `self.x=function(){"${elk.marker}.compaction"}`;

  it("gives a lazy ELK chunk its own ceiling above the default", () => {
    expect(chunkGzipBudget(elkSource, false)).toBe(elk.maxGzip);
    expect(elk.maxGzip).toBeGreaterThan(DEFAULT_BUDGETS.maxSingleChunkGzip);
  });

  it("keeps the default budget when the ELK chunk is part of the initial bundle", () => {
    expect(chunkGzipBudget(elkSource, true)).toBe(
      DEFAULT_BUDGETS.maxSingleChunkGzip
    );
  });

  it("keeps the default budget for any other lazy chunk", () => {
    expect(chunkGzipBudget("self.y=function(){}", false)).toBe(
      DEFAULT_BUDGETS.maxSingleChunkGzip
    );
  });
});
