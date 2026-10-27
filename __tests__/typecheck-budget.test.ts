// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  parseMemoryUsedMb,
  TYPECHECK_MEMORY_BUDGET_MB,
} from "../scripts/typecheck-budget";

describe("typecheck memory budget (ADR 0072)", () => {
  it("reads the TypeScript 7 extended diagnostics line in megabytes", () => {
    const output = [
      "Files:              6302",
      "Memory used:    2452909K",
      "Memory allocs:  18055633",
    ].join("\n");
    expect(parseMemoryUsedMb(output)).toBe(2395);
  });

  it("returns null when the compiler printed no memory figure", () => {
    expect(parseMemoryUsedMb("Found 3 errors.")).toBeNull();
  });

  it("does not read the allocation count as memory", () => {
    expect(parseMemoryUsedMb("Memory allocs:  18055633")).toBeNull();
  });

  it("keeps the budget the TypeScript 6 heap gate used", () => {
    expect(TYPECHECK_MEMORY_BUDGET_MB).toBe(3072);
  });
});
