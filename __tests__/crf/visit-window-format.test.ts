import { describe, expect, it } from "vitest";
import { formatVisitWindow } from "@/lib/crf";

describe("CRF visit-window labels", () => {
  it("uses compact notation only for symmetric windows", () => {
    expect(formatVisitWindow({ windowBefore: 3, windowAfter: 3 })).toBe("±3d");
    expect(formatVisitWindow({ windowBefore: 0, windowAfter: 0 })).toBe("±0d");
  });

  it("states both sides of asymmetric and one-sided windows", () => {
    expect(formatVisitWindow({ windowBefore: 27, windowAfter: 0 })).toBe(
      "-27d/+0d"
    );
    expect(formatVisitWindow({ windowBefore: 0, windowAfter: 2 })).toBe(
      "-0d/+2d"
    );
    expect(formatVisitWindow({ windowBefore: -7, windowAfter: 1 })).toBe(
      "-7d/+1d"
    );
  });
});
