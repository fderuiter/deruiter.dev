import path from "node:path";
import { describe, it, expect } from "vitest";
import { ESLint } from "eslint";
import { evaluateFormula } from "@/lib/crf";
import { ArcadeViewport } from "@/lib/arcade";
import { generateHermiteSplinePath } from "@/lib/graphics-math";

/**
 * Issue #1119: nested Math.min/Math.max calls were replaced with clamp(), and
 * the no-restricted-syntax rule that bans them is no longer shadowed by the
 * later process.env block (#1123). These tests pin both halves.
 */

const repoRoot = path.resolve(__dirname, "..");
const nested = "export const f = (v: number) => Math.min(1, Math.max(0, v));\n";
const envRead = "export const g = process.env.SOME_FLAG;\n";

async function restrictedMessages(code: string, relativePath: string) {
  const eslint = new ESLint({ cwd: repoRoot });
  const [result] = await eslint.lintText(code, {
    filePath: path.join(repoRoot, relativePath),
  });
  return result.messages
    .filter((m) => m.ruleId === "no-restricted-syntax")
    .map((m) => m.message);
}

describe("no-restricted-syntax configuration (#1119, #1123)", () => {
  it("enforces both the nested Math.min/max and process.env restrictions in application modules", async () => {
    for (const file of [
      "lib/clamp-probe.ts",
      "components/ClampProbe.tsx",
      "hooks/useClampProbe.ts",
      "app/clamp-probe/helpers.ts",
    ]) {
      const messages = await restrictedMessages(nested + envRead, file);
      expect(messages.some((m) => m.includes("nested Math.min"))).toBe(true);
      expect(messages.some((m) => m.includes("process.env"))).toBe(true);
    }
  }, 60_000);

  it("enforces the nested Math.min/max restriction outside application modules", async () => {
    const messages = await restrictedMessages(nested, "scripts/clamp-probe.ts");
    expect(messages.some((m) => m.includes("nested Math.min"))).toBe(true);
  }, 60_000);

  it("lets the clamp implementation nest Math calls but still bans process.env there", async () => {
    for (const file of ["lib/arcade/utils.ts", "lib/game-utils.ts"]) {
      const messages = await restrictedMessages(nested + envRead, file);
      expect(messages.some((m) => m.includes("nested Math.min"))).toBe(false);
      expect(messages.some((m) => m.includes("process.env"))).toBe(true);
    }
  }, 60_000);
});

describe("clamp migration preserves edge-case behavior", () => {
  it("keeps the CRF formula clamp() semantics for inverted bounds and in-range values", () => {
    expect(evaluateFormula("clamp(50, 0, 100)", {}, [])).toBe(50);
    expect(evaluateFormula("clamp(120, 0, 100)", {}, [])).toBe(100);
    // Math.min(Math.max(x, lo), hi) returns hi whenever lo > hi.
    expect(evaluateFormula("clamp(5, 10, 0)", {}, [])).toBe(0);
    expect(evaluateFormula("clamp(-5, 10, 0)", {}, [])).toBe(0);
  });

  it("keeps the 1x DPR floor when an arcade viewport caps DPR below 1", () => {
    const viewport = new ArcadeViewport({
      mode: "safe-zone",
      baseWidth: 320,
      baseHeight: 240,
      maxDpr: 0.5,
    });
    expect(viewport.calculateMetrics(640, 480, 3).dpr).toBe(1);
    expect(viewport.calculateMetrics(640, 480, 0).dpr).toBe(1);
  });

  it("pins Hermite control points to 0 when the explicit frame height is negative", () => {
    const { pathD } = generateHermiteSplinePath(
      [
        { x: 0, y: 5 },
        { x: 10, y: 15 },
      ],
      -10
    );
    const controlYs = [...pathD.matchAll(/(-?[\d.]+) (-?[\d.]+),/g)].map(
      (match) => Number(match[2])
    );
    expect(controlYs).toEqual([0, 0]);
  });
});
