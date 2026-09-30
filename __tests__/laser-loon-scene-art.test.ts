// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  ENEMY_SILHOUETTE_TYPES,
  drawActBackdrop,
  drawEnemySilhouette,
  drawLoon,
} from "@/components/laser-loon/scene-art";
import { ENEMY_TYPES, CAMPAIGN_ACTS } from "@/lib/laser-loon";
import type { Target } from "@/lib/laser-loon";

const ctx = () =>
  document.createElement("canvas").getContext("2d") as CanvasRenderingContext2D;

describe("Laser Loon scene art (#1597)", () => {
  it("has a silhouette for every enemy template", () => {
    for (const t of ENEMY_TYPES) {
      expect(ENEMY_SILHOUETTE_TYPES).toContain(t.type);
    }
  });

  it("draws every enemy type, frozen or not, without throwing", () => {
    const c = ctx();
    for (const type of ENEMY_SILHOUETTE_TYPES) {
      for (const frozenTimer of [0, 30]) {
        const target = {
          x: 100,
          y: 100,
          radius: 18,
          type,
          color: "#f59e0b",
          pulsePhase: 1,
          frozenTimer,
        } as Target;
        expect(() => drawEnemySilhouette(c, target)).not.toThrow();
      }
    }
  });

  it("paints a backdrop for every campaign act, moving or still", () => {
    const c = ctx();
    for (const act of CAMPAIGN_ACTS) {
      for (const animate of [true, false]) {
        expect(() =>
          drawActBackdrop(c, act.backgroundTheme, 768, 420, 5000, {
            scale: 2,
            animate,
          })
        ).not.toThrow();
      }
    }
  });

  it("draws the loon", () => {
    expect(() => drawLoon(ctx(), "#ef4444")).not.toThrow();
  });
});
