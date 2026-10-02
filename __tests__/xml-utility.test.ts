// @vitest-environment node
import { describe, it, expect } from "vitest";
import { escapeXml } from "../lib/utils";

describe("Global Utility Registry - escapeXml", () => {
  it("substitutes all five standard XML entities correctly", () => {
    expect(escapeXml("&")).toBe("&amp;");
    expect(escapeXml("<")).toBe("&lt;");
    expect(escapeXml(">")).toBe("&gt;");
    expect(escapeXml('"')).toBe("&quot;");
    expect(escapeXml("'")).toBe("&apos;");

    // Multiple occurrences and combination
    expect(escapeXml("A & B < C > D \" E ' F")).toBe(
      "A &amp; B &lt; C &gt; D &quot; E &apos; F"
    );
  });

  it("handles null, undefined, and empty string inputs securely", () => {
    expect(escapeXml(null)).toBe("");
    expect(escapeXml(undefined)).toBe("");
    expect(escapeXml("")).toBe("");
  });

  it("passes standard strings unchanged", () => {
    expect(escapeXml("Hello World 123!")).toBe("Hello World 123!");
  });
});
