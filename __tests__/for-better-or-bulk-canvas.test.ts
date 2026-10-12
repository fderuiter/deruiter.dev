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
import { TILE, drawVenue } from "@/components/for-better-or-bulk/venue-canvas";

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

  it("fits every label inside its tile run at the measured width (#1927)", () => {
    const yesRoses: Setup = {
      ...DEFAULT_SETUP,
      cart: { ...DEFAULT_SETUP.cart, roses: "yes" },
    };
    for (const setup of [DEFAULT_SETUP, SEED_12345, yesRoses]) {
      const { ctx, drawn } = recorder();
      drawVenue(ctx, createLevel(setup), null);
      // Only labels given a span are fitted; the player letters are not.
      const labels = drawn.filter(
        (d) => d.name === "fillText" && typeof d.args[3] === "number"
      );
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) {
        const text = String(label.args[0]);
        const span = Number(label.args[3]);
        // The stub measures six pixels a character; the canvas squeezes any
        // text wider than its span, so it must never need squeezing.
        expect(text.length * 6, text).toBeLessThanOrEqual(span);
      }
    }
  });

  it("draws each station word after every prop on that station's tile (#1931)", () => {
    const base = createLevel(DEFAULT_SETUP);
    const roses = { kind: "roses" as const, madeBy: null };
    const state: GameState = {
      ...base,
      stations: base.stations.map((s) => {
        if (s.kind === "arrange" || s.kind === "petals")
          return { ...s, item: roses };
        if (s.kind === "grill")
          return { ...s, item: { kind: "hotdogs" as const, madeBy: null } };
        return s;
      }),
    };
    const { ctx, drawn } = recorder();
    drawVenue(ctx, state, null);
    const word: Record<string, string> = {
      arrange: "ARRANGE",
      petals: "PETALS",
      grill: "GRILL",
      bin: "BIN",
    };
    for (const station of state.stations) {
      const [label] = texts(drawn, word[station.kind]);
      expect(label, station.kind).toBeDefined();
      const labelAt = drawn.indexOf(label);
      const left = station.x * TILE;
      const top = station.y * TILE;
      // Every call that places a shape by its first two numbers, on this tile.
      const onTile = drawn.filter(
        (d) =>
          d.name !== "fillText" &&
          typeof d.args[0] === "number" &&
          typeof d.args[1] === "number" &&
          d.args[0] >= left &&
          d.args[0] <= left + TILE &&
          d.args[1] >= top &&
          d.args[1] <= top + TILE
      );
      expect(onTile.length, station.kind).toBeGreaterThan(0);
      for (const call of onTile) {
        expect(
          drawn.indexOf(call),
          `${station.kind} ${call.name}`
        ).toBeLessThan(labelAt);
      }
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

describe("the venue's shared crates and part-filled targets (#1933)", () => {
  it("writes a shared crate's stock once, on its first crate, and says the rest share it", () => {
    const base = createLevel(DEFAULT_SETUP);
    const level: GameState = { ...base, stock: { ...base.stock, roses: 37 } };
    const { ctx, drawn } = recorder();
    drawVenue(ctx, level, null);
    expect(texts(drawn, "37")).toHaveLength(1);
    const kinds = [...new Set(level.supplies.map((s) => s.kind))];
    const sharing = kinds.reduce(
      (n, kind) => n + level.supplies.filter((s) => s.kind === kind).length - 1,
      0
    );
    expect(texts(drawn, "shared")).toHaveLength(sharing);
  });

  it("marks the lantern crates off when the plan has no lanterns (round 18, N-2)", () => {
    const off = createLevel({
      ...DEFAULT_SETUP,
      cart: { ...DEFAULT_SETUP.cart, lanterns: false },
    });
    const lamps = off.supplies.filter((s) => s.kind === "lantern").length;
    expect(lamps).toBeGreaterThan(0);
    const { ctx, drawn } = recorder();
    drawVenue(ctx, off, null);
    expect(texts(drawn, "off")).toHaveLength(lamps);

    const on = recorder();
    drawVenue(on.ctx, createLevel(DEFAULT_SETUP), null);
    expect(texts(on.drawn, "off")).toHaveLength(0);
  });

  it("marks a basket with the items placed out of its two, starting from zero", () => {
    const base = createLevel(DEFAULT_SETUP);
    const empty = recorder();
    drawVenue(empty.ctx, base, null);
    expect(texts(empty.drawn, "0/2")).toHaveLength(1);

    const basket = base.targets.find((t) => t.kind === "basket");
    if (!basket) throw new Error("the venue has a basket");
    const half: GameState = {
      ...base,
      targets: base.targets.map((t) =>
        t === basket
          ? {
              ...t,
              filled: [{ kind: "arrangement", madeBy: "fred" }],
              filledBy: ["fred"],
              filledByHelper: [false],
            }
          : t
      ),
    };
    const part = recorder();
    drawVenue(part.ctx, half, null);
    expect(texts(part.drawn, "1/2")).toHaveLength(1);
    expect(texts(part.drawn, "0/2")).toHaveLength(0);
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

describe("the venue's floor-drop and next-spot outlines (#1963)", () => {
  function dashes(drawn: readonly Drawn[]): string[] {
    return drawn
      .filter((d) => d.name === "setLineDash")
      .map((d) => JSON.stringify(d.args[0]));
  }

  it("draws a floor drop in the heavy warning dash, not the station's solid outline", () => {
    const base = createLevel(DEFAULT_SETUP);
    const fred = {
      ...base.players.fred,
      x: 10.5,
      y: 4.5,
      facingX: 0,
      facingY: -1,
      holding: { kind: "roses" as const, madeBy: null },
    };
    const level: GameState = { ...base, players: { ...base.players, fred } };
    const { ctx, drawn } = recorder();
    drawVenue(ctx, level, "fred");
    expect(dashes(drawn)).toContain("[6,4]");
  });

  it("fills the floor drop from its bottom in proportion to the hold", () => {
    const base = createLevel(DEFAULT_SETUP);
    const fred = {
      ...base.players.fred,
      x: 10.5,
      y: 4.5,
      facingX: 0,
      facingY: -1,
      holding: { kind: "roses" as const, madeBy: null },
      floorHold: { cellX: 10, cellY: 4, facingX: 0, facingY: -1, ticks: 6 },
    };
    const level: GameState = { ...base, players: { ...base.players, fred } };
    const { ctx, drawn } = recorder();
    drawVenue(ctx, level, "fred");
    // Tile (10, 3) is x 400, y 120. Half of FLOOR_HOLD_TICKS is half the tile.
    const fills = drawn
      .filter((d) => d.name === "fillRect")
      .map((d) => JSON.stringify(d.args));
    expect(fills).toContain("[400,140,40,20]");
  });

  it("marks the nearest open chair spot while carrying chairs", () => {
    const base = createLevel(DEFAULT_SETUP);
    const spot = base.targets.find(
      (t) => t.kind === "chair-spot" && t.status === "open"
    );
    if (!spot) throw new Error("the venue has an open chair spot");
    const fred = {
      ...base.players.fred,
      x: spot.x + 0.5,
      y: spot.y + 0.5,
      holding: { kind: "chairs" as const, madeBy: null, count: 2 },
    };
    const level: GameState = { ...base, players: { ...base.players, fred } };
    const { ctx, drawn } = recorder();
    drawVenue(ctx, level, "fred");
    expect(dashes(drawn)).toContain("[2,4]");
  });
});
