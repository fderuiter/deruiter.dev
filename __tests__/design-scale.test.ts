import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { designManifest } from "@/lib/design-manifest";

const css = fs.readFileSync(
  path.resolve(process.cwd(), "app/globals.css"),
  "utf8"
);

describe("three corner radii (#2314)", () => {
  it("resolves every Tailwind radius step to 6px or 12px", () => {
    const steps = [...css.matchAll(/--radius-([a-z0-9]+):\s*([^;]+);/g)];
    const tailwind = steps.filter(([, name]) =>
      ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"].includes(name)
    );
    expect(tailwind.map(([, name]) => name).sort()).toEqual(
      ["2xl", "3xl", "4xl", "lg", "md", "sm", "xl", "xs"].sort()
    );
    for (const [, , value] of tailwind) {
      expect(["6px", "12px"]).toContain(value.trim());
    }
  });

  it("names the badge and card radii", () => {
    expect(css).toMatch(/--radius-badge:\s*6px;/);
    expect(css).toMatch(/--radius-card:\s*12px;/);
  });

  it("uses only the named radii or a full pill in globals.css rules", () => {
    const values = [...css.matchAll(/border-radius:\s*([^;]+);/g)].map(
      ([, value]) => value.trim()
    );
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(value).toMatch(/^(var\(--radius-(badge|card)\)|9999px)$/);
    }
  });
});

describe("spacing scale (#2314)", () => {
  it("declares the 4px steps as CSS variables", () => {
    const steps = [...css.matchAll(/--space-(\d+):\s*(\d+)px;/g)].map(
      ([, step, px]) => [Number(step), Number(px)]
    );
    expect(steps).toEqual([
      [1, 4],
      [2, 8],
      [3, 12],
      [4, 16],
      [6, 24],
      [8, 32],
      [12, 48],
      [16, 64],
    ]);
  });

  it("carries the scale into the design manifest", () => {
    expect(Object.values(designManifest.spacing)).toEqual([
      4, 8, 12, 16, 24, 32, 48, 64,
    ]);
    expect(designManifest.layout.gap).toBe(designManifest.spacing["4"]);
  });
});
