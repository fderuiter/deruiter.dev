// @vitest-environment node
import { describe, it, expect } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  DEFAULT_SETUP,
  IDLE_FRAME,
  createLevel,
  stepGame,
  type GameState,
  type Setup,
} from "@/lib/for-better-or-bulk";
import { drawVenue } from "@/components/for-better-or-bulk/venue-canvas";

/** One recorded canvas call, with the font and fill in force when it ran. */
interface Drawn {
  readonly name: string;
  readonly font: string;
  readonly args: readonly unknown[];
}

/** A stand-in 2D context that records every drawing call in order. */
function recorder(): { ctx: CanvasRenderingContext2D; drawn: Drawn[] } {
  const drawn: Drawn[] = [];
  const values: Record<string, unknown> = {};
  const ctx = new Proxy(
    {},
    {
      get(_target, key) {
        if (typeof key !== "string") return undefined;
        if (key in values) return values[key];
        if (key === "measureText") {
          return (text: string) => ({ width: text.length * 6 });
        }
        return (...args: unknown[]) => {
          drawn.push({ name: key, font: String(values.font), args });
          return undefined;
        };
      },
      set(_target, key, value: unknown) {
        values[key as string] = value;
        return true;
      },
    }
  );
  return { ctx: fromAny<CanvasRenderingContext2D, typeof ctx>(ctx), drawn };
}

const SEED_12345: Setup = { ...DEFAULT_SETUP, seed: 12345 };

function texts(drawn: readonly Drawn[], word: string): Drawn[] {
  return drawn.filter((d) => d.name === "fillText" && d.args[0] === word);
}

describe("the venue's canvas labels", () => {
  it("draws each two-tile station word once, not once per tile", () => {
    const { ctx, drawn } = recorder();
    drawVenue(ctx, createLevel(DEFAULT_SETUP), null);
    expect(texts(drawn, "ARRANGE")).toHaveLength(1);
    expect(texts(drawn, "PETALS")).toHaveLength(1);
    expect(texts(drawn, "GRILL")).toHaveLength(1);
  });

  it("centres a shared label over its whole run and keeps it inside the run", () => {
    const { ctx, drawn } = recorder();
    drawVenue(ctx, createLevel(DEFAULT_SETUP), null);
    const [arrange] = texts(drawn, "ARRANGE");
    // The two ARRANGE tiles are columns 8 and 9: the run spans x 320 to 400.
    expect(arrange.args[1]).toBe(360);
    expect(arrange.args[3]).toBeLessThanOrEqual(78);
  });

  it("keeps every label at 10px or larger", () => {
    const { ctx, drawn } = recorder();
    drawVenue(ctx, createLevel(SEED_12345), null);
    const labels = drawn.filter((d) => d.name === "fillText");
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      const size = Number(/(\d+)px/.exec(label.font)?.[1] ?? 0);
      expect(size).toBeGreaterThanOrEqual(10);
    }
  });

  it("draws the Yes-roses car with its outline redrawn over the roses", () => {
    const base = createLevel({
      ...DEFAULT_SETUP,
      cart: { ...DEFAULT_SETUP.cart, roses: "yes" },
    });
    const state: GameState = {
      ...base,
      time: 40,
      burntBatches: 0,
      seeded: [],
    };
    const { ctx, drawn } = recorder();
    drawVenue(ctx, state, null, [
      { kind: "roses", x: 0, y: 0, startedAt: 39.9 },
    ]);
    const names = drawn.map((d) => d.name);
    const lastRoundRect = names.lastIndexOf("roundRect");
    const roseDraws = drawn
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => d.name === "arc" || d.name === "fill");
    expect(roseDraws.length).toBeGreaterThan(0);
    expect(lastRoundRect).toBeGreaterThan(-1);
    expect(names.slice(lastRoundRect)).toContain("stroke");
  });
});

describe("the shower's rain", () => {
  it("draws the streaks in steel at 60 percent alpha during the shower", () => {
    const base = createLevel(SEED_12345);
    const shower = base.seeded.find((e) => e.id === "shower");
    const during = { ...base, time: (shower?.at ?? 0) + 0.5 };
    const strokes: string[] = [];
    const ctx = new Proxy(recorder().ctx as object, {
      set(target, key, value: unknown) {
        if (key === "strokeStyle") strokes.push(String(value));
        (target as Record<string, unknown>)[key as string] = value;
        return true;
      },
    }) as CanvasRenderingContext2D;
    drawVenue(ctx, during, null);
    expect(strokes).toContain("rgba(148, 163, 184, 0.6)");
  });
});

describe("the seeded day's start toast", () => {
  it("is announced at the step the shower starts", () => {
    let state = createLevel(SEED_12345);
    const shower = state.seeded.find((e) => e.id === "shower");
    let fired = false;
    let guard = 0;
    while (state.phase === "playing" && guard++ < 20000 && !fired) {
      const result = stepGame(state, IDLE_FRAME);
      state = result.state;
      fired = result.events.some(
        (e) => e.type === "seeded-start" && e.id === "shower"
      );
    }
    expect(fired).toBe(true);
    expect(state.time).toBeCloseTo(shower?.at ?? 0, 0);
  });
});
