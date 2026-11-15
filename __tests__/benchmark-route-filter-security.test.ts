import { describe, expect, it } from "vitest";
import {
  MAX_ROUTE_FILTER_LENGTH,
  compileRouteFilter,
} from "@/lib/dx/route-filter";
import { CANONICAL_ROUTES } from "@/lib/dx/page-bench";

describe("compileRouteFilter (CodeQL alerts 31 and 32, #3821 #3822)", () => {
  it("matches path or name text anywhere, ignoring case", () => {
    const filter = compileRouteFilter("STUDY");
    expect(filter.test("/study-data")).toBe(true);
    expect(filter.test("Study Data Pipeline")).toBe(true);
    expect(filter.test("/crf")).toBe(false);
  });

  it("keeps alternatives, anchors and the any-character dot", () => {
    const filter = compileRouteFilter("^/crf$|proof|^/plat.orm");
    expect(filter.test("/crf")).toBe(true);
    expect(filter.test("/m/crf")).toBe(false);
    expect(filter.test("/crf/extra")).toBe(false);
    expect(filter.test("/m/proof")).toBe(true);
    expect(filter.test("/platform/operations")).toBe(true);
    expect(filter.test("/m/platform")).toBe(false);
  });

  it("treats escaped punctuation as literal text", () => {
    const filter = compileRouteFilter("a\\.b|x\\|y|\\$");
    expect(filter.test("a.b")).toBe(true);
    expect(filter.test("axb")).toBe(false);
    expect(filter.test("x|y")).toBe(true);
    expect(filter.test("cost $5")).toBe(true);
  });

  it("selects the same canonical routes a plain regex did for plain text", () => {
    for (const text of ["arcade", "^/m/", "/case-studies/", "crf|proof"]) {
      const filter = compileRouteFilter(text);
      const expression = new RegExp(text, "i");
      const pick = (test: (value: string) => boolean) =>
        CANONICAL_ROUTES.filter(
          (route) => test(route.path) || test(route.name)
        ).map((route) => route.path);
      expect(pick((value) => filter.test(value))).toEqual(
        pick((value) => expression.test(value))
      );
    }
  });

  it.each([
    ["(a+)+$", "("],
    ["a*", "*"],
    ["a+", "+"],
    ["a?", "?"],
    ["a{2}", "{"],
    ["[a-z]", "["],
    ["\\d", "backslash"],
    ["a^b", "edge"],
    ["a|", "empty alternative"],
    ["trailing\\", "end with a backslash"],
  ])("refuses %j with a clear error", (source, fragment) => {
    expect(() => compileRouteFilter(source)).toThrow(fragment);
  });

  it("refuses an empty or oversize filter", () => {
    expect(() => compileRouteFilter("")).toThrow("requires a pattern");
    expect(() =>
      compileRouteFilter("a".repeat(MAX_ROUTE_FILTER_LENGTH + 1))
    ).toThrow(`limited to ${MAX_ROUTE_FILTER_LENGTH} characters`);
  });

  it("matches a hostile-looking but allowed filter in linear time", () => {
    const filter = compileRouteFilter(`${".".repeat(99)}b|${"a".repeat(99)}`);
    const started = performance.now();
    expect(filter.test("a".repeat(10_000))).toBe(true);
    expect(filter.test("c".repeat(10_000))).toBe(false);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
