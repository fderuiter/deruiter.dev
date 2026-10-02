// @vitest-environment node
import { describe, it, expect } from "vitest";
import path from "path";
import { checkLayoutTextClippingInvariants } from "@/lib/dx/doctor";

describe("AGENTS.md Invariant #13: Layout Integrity & Defensive CSS", () => {
  const root = path.resolve(process.cwd());

  it("passes DX doctor diagnostic check for layout integrity and defensive CSS", () => {
    const result = checkLayoutTextClippingInvariants(root);
    if (result.status !== "pass") {
      console.error("Invariant #13 Violations:", result.details);
    }
    expect(result.status).toBe("pass");
    expect(result.details).toBeUndefined();
  });
});
