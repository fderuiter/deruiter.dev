import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("small metadata text contrast (WCAG 1.4.3)", () => {
  const css = readFileSync(path.join(root, "app/globals.css"), "utf8");
  const muted = /--muted:\s*(#[0-9a-fA-F]{6})/.exec(css)?.[1] ?? "";

  it("--muted token meets 4.5:1 on the darkest and lightest dark surfaces", () => {
    for (const bg of ["#09090b", "#0f0f11", "#13151a", "#18181b"]) {
      expect(contrast(muted, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("text-zinc-500 (4.0:1) is not used for small text in audited files", () => {
    const files = [
      "app/contact/page.tsx",
      "components/stack/AudioSynthLab.tsx",
      "components/stack/InvariantsMatrix.tsx",
      "components/stack/PretextBenchmarkLab.tsx",
      "components/stack/StackLayerCards.tsx",
      "components/stack/StackOverviewView.tsx",
      "components/crf/CenterCanvas/FieldRenderer.tsx",
      "components/arcade/MemeVaultClient.tsx",
      "components/laser-loon/VectorComparisonViewer.tsx",
      "components/SchemaFlowWorkspace.tsx",
      "components/CaseStudyHeroActions.tsx",
    ];
    for (const f of files) {
      const src = readFileSync(path.join(root, f), "utf8");
      expect(src, f).not.toMatch(/(?<![:\w-])text-zinc-500\b/);
    }
  });
});
