// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SCENARIOS } from "@/lib/neuro";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

describe("NeuroRecon narrow-screen and symbol regressions (#1224)", () => {
  it("QA cards are single-column below 480px", () => {
    const src = read("components/neuro/NeuroMetricsPanel.tsx");
    expect(src).toMatch(/grid-cols-1 min-\[480px\]:grid-cols-2/);
    expect(src).not.toMatch(/"grid grid-cols-2 /);
  });

  it("card headers wrap and cards allow shrinking", () => {
    const src = read("components/neuro/NeuroMetricsPanel.tsx");
    expect(src).toContain("flex-wrap");
    expect(src).toContain("min-w-0");
  });

  it("does not ship raw TeX delimiters in visitor-facing copy", () => {
    const texPattern =
      /\$[^$\n]*[\\^_][^$\n]*\$|\\\(|\\\)|\\leftrightarrow|\\chi/;
    for (const rel of [
      "components/neuro/NeuroFieldManual.tsx",
      "components/neuro/NeuroMetricsPanel.tsx",
    ]) {
      expect(read(rel), rel).not.toMatch(texPattern);
    }
    for (const sc of Object.values(SCENARIOS)) {
      const text = [sc.defectDescription, ...Object.values(sc.lore)].join(" ");
      expect(text, sc.id).not.toMatch(texPattern);
    }
  });
});
