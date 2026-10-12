import { describe, it, expect, vi } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  DEFAULT_SETUP,
  bankText,
  createLevel,
  frontTile,
  getCoachTile,
  getPrompt,
  interactTile,
  type GameEvent,
  type GameState,
  type TargetKind,
} from "@/lib/for-better-or-bulk";
import { buildFrame, GAME_CODES } from "@/components/for-better-or-bulk/input";
import {
  completedCategories,
  describeEvent,
  playStepSounds,
  soundFor,
  type FeedbackEvent,
} from "@/components/for-better-or-bulk/messages";
import {
  BURST_SECONDS,
  burstLifetime,
  canvasBurstsFor,
  TILE,
  drawItem,
  drawVenue,
  VENUE_HEIGHT,
  VENUE_WIDTH,
  type CanvasBurst,
} from "@/components/for-better-or-bulk/venue-canvas";

/** The crate fill the stock counts are drawn on. */
const CRATE_FILL = "#7a5a3a";

/** The label plate fill, as venue-canvas draws it. */
const BADGE_FILL = "rgba(13, 14, 17, 0.88)";

/** The colour a hex ground shows once the plate is laid over it. */
function overPlate(ground: string): string {
  const plate = [13, 14, 17];
  const mixed = [1, 3, 5].map((i, channel) => {
    const bg = parseInt(ground.slice(i, i + 2), 16);
    return Math.round(0.88 * plate[channel] + 0.12 * bg);
  });
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

describe("For Better or Bulk keyboard mapping (#1906)", () => {
  it("gives Fred WASD and Abbi the arrows in co-op", () => {
    const frame = buildFrame(
      new Set(["KeyD", "ArrowUp", "ShiftRight"]),
      new Set(),
      new Set(["KeyE"]),
      "coop",
      "abbi"
    );
    expect(frame.inputs.fred).toEqual({
      moveX: 1,
      moveY: 0,
      interact: true,
      interactHeld: false,
      work: false,
    });
    expect(frame.inputs.abbi).toEqual({
      moveX: 0,
      moveY: -1,
      interact: false,
      interactHeld: false,
      work: true,
    });
  });

  it("sends either key set to whoever is active in solo play", () => {
    const frame = buildFrame(
      new Set(["ArrowLeft", "KeyF"]),
      new Set(),
      new Set(["Enter"]),
      "solo",
      "fred"
    );
    expect(frame.inputs.fred).toEqual({
      moveX: -1,
      moveY: 0,
      interact: true,
      interactHeld: false,
      work: true,
    });
    expect(frame.inputs.abbi).toEqual({
      moveX: 0,
      moveY: 0,
      interact: false,
      interactHeld: false,
      work: false,
    });
  });

  it("flags interact as held on every tick the key stays down (ADR 0060 amendment)", () => {
    const frame = buildFrame(
      new Set(["KeyE"]),
      new Set(),
      new Set(),
      "coop",
      "fred"
    );
    expect(frame.inputs.fred).toEqual({
      moveX: 0,
      moveY: 0,
      interact: false,
      interactHeld: true,
      work: false,
    });
  });

  it("sets interactHeld for Abbi's Enter in co-op as for Fred's E", () => {
    const frame = buildFrame(
      new Set(["Enter"]),
      new Set(),
      new Set(["Enter"]),
      "coop",
      "abbi"
    );
    expect(frame.inputs.abbi).toEqual({
      moveX: 0,
      moveY: 0,
      interact: true,
      interactHeld: true,
      work: false,
    });
  });

  it("fires interact only on the press, not while it is held", () => {
    const frame = buildFrame(
      new Set(["KeyE"]),
      new Set(),
      new Set(),
      "coop",
      "fred"
    );
    expect(frame.inputs.fred.interact).toBe(false);
  });

  it("counts a tap shorter than one tick as held for that step (#1914)", () => {
    // KeyF and KeyD went down and up again before the step ran.
    const tapped = new Set(["KeyF", "KeyD"]);
    const frame = buildFrame(new Set(), tapped, tapped, "coop", "fred");
    expect(frame.inputs.fred).toEqual({
      moveX: 1,
      moveY: 0,
      interact: false,
      interactHeld: false,
      work: true,
    });
  });

  it("forgets a tap once the step that saw it has run (#1914)", () => {
    const frame = buildFrame(new Set(), new Set(), new Set(), "coop", "fred");
    expect(frame.inputs.fred.work).toBe(false);
    expect(frame.inputs.fred.moveX).toBe(0);
  });

  it("cancels opposite directions and carries a decision", () => {
    const decision = { choice: "stay", commitment: null } as const;
    const frame = buildFrame(
      new Set(["KeyA", "KeyD"]),
      new Set(),
      new Set(),
      "solo",
      "abbi",
      decision
    );
    expect(frame.inputs.abbi.moveX).toBe(0);
    expect(frame.decision).toEqual(decision);
  });

  it("lists every handled key so the page does not scroll", () => {
    for (const code of ["KeyW", "ArrowDown", "Space", "Enter", "ShiftLeft"]) {
      expect(GAME_CODES.has(code)).toBe(true);
    }
    expect(GAME_CODES.has("Tab")).toBe(false);
  });
});

describe("For Better or Bulk event lines (#1906)", () => {
  it("thanks the website when it blocks a call", () => {
    expect(
      describeEvent({
        type: "interruption",
        id: "garden-formal",
        player: "fred",
        blockedBy: "faq",
      })
    ).toBe("Someone read the FAQ.");
  });

  it("quotes the call when nothing blocks it", () => {
    expect(
      describeEvent({
        type: "interruption",
        id: "garden-formal",
        player: "fred",
        blockedBy: null,
      })
    ).toBe(`Fred's phone: "Is garden formal like... formal?"`);
  });

  it("stays quiet for routine carrying", () => {
    const quiet: GameEvent[] = [
      { type: "picked-up", player: "abbi", item: "chairs" },
      { type: "put-down", player: "abbi", item: "chairs" },
      { type: "crafted", player: "abbi", item: "arrangement" },
    ];
    for (const event of quiet) expect(describeEvent(event)).toBeNull();
  });

  it("names grill results, empty crates and the ending", () => {
    expect(
      describeEvent({ type: "cooked", station: "G4-3", item: "wings" })
    ).toBe("The wings are done.");
    expect(describeEvent({ type: "burnt", station: "G4-3" })).toContain(
      "charcoal"
    );
    expect(describeEvent({ type: "supply-empty", supply: "lantern" })).toBe(
      "That was the last of the lanterns."
    );
    expect(describeEvent({ type: "level-finished", early: false })).toContain(
      "4:00"
    );
    expect(
      describeEvent({
        type: "simplified",
        target: "T7-7",
        category: "centerpieces",
      })
    ).toContain("Restraint");
  });

  it("says when a crate got stock back, and names the chair stacks as chairs", () => {
    expect(
      describeEvent({ type: "restocked", player: "fred", supply: "wings-raw" })
    ).toBe("The crate had one more batch of wings.");
    expect(
      describeEvent({ type: "restocked", player: "abbi", supply: "chairs" })
    ).toBe("The chairs went back in the crate.");
    expect(describeEvent({ type: "supply-empty", supply: "chairs" })).toBe(
      "That was the last of the chairs."
    );
  });
});

describe("For Better or Bulk venue canvas (#1906)", () => {
  it("is twenty tiles by twelve", () => {
    expect(VENUE_WIDTH / VENUE_HEIGHT).toBeCloseTo(20 / 12, 5);
  });

  it("draws the crates, people and planned spots without throwing", () => {
    const ctx = document
      .createElement("canvas")
      .getContext("2d") as CanvasRenderingContext2D;
    const state = createLevel(DEFAULT_SETUP);
    drawVenue(ctx, state, "abbi");
    const labels = vi.mocked(ctx.fillText).mock.calls.map((call) => call[0]);
    expect(labels).toEqual(
      expect.arrayContaining(["ROSE", "GRILL", "F", "A", "6"])
    );
  });

  it("draws every kind of item", () => {
    const ctx = document
      .createElement("canvas")
      .getContext("2d") as CanvasRenderingContext2D;
    for (const kind of [
      "roses",
      "arrangement",
      "petals",
      "hotdogs-raw",
      "hotdogs",
      "wings-raw",
      "wings",
      "mac",
      "quinoa",
      "burnt",
      "lantern",
      "chairs",
    ] as const) {
      expect(() => drawItem(ctx, kind, 20, 20, 16)).not.toThrow();
    }
  });

  it("draws away people as gone and busy people with a bubble", () => {
    const ctx = document
      .createElement("canvas")
      .getContext("2d") as CanvasRenderingContext2D;
    const level = createLevel(DEFAULT_SETUP);
    const state = {
      ...level,
      players: {
        fred: { ...level.players.fred, presence: "away" as const },
        abbi: { ...level.players.abbi, busyFor: 2, busyReason: "On the phone" },
      },
    };
    drawVenue(ctx, state, null);
    const labels = vi.mocked(ctx.fillText).mock.calls.map((call) => call[0]);
    expect(labels).not.toContain("F");
    expect(labels).toContain("On the phone");
  });

  /** The dash each outlined tile was drawn with, keyed by its stroke origin. */
  function outlineDashes(
    state: GameState,
    active: "fred" | "abbi" | null
  ): Map<string, number[]> {
    const ctx = document
      .createElement("canvas")
      .getContext("2d") as CanvasRenderingContext2D;
    const dashes = new Map<string, number[]>();
    let dash: number[] = [];
    vi.mocked(ctx.setLineDash).mockImplementation(
      (segments: Iterable<number>) => {
        dash = [...segments];
      }
    );
    vi.mocked(ctx.strokeRect).mockImplementation((x: number, y: number) => {
      dashes.set(`${x},${y}`, [...dash]);
    });
    drawVenue(ctx, state, active);
    return dashes;
  }

  /** The stroke origin of an outline drawn on a venue tile. */
  function outlineKey(tile: { x: number; y: number }): string {
    return `${tile.x * TILE + 2},${tile.y * TILE + 2}`;
  }

  it("outlines nothing on a faced floor tile that no press would use", () => {
    const state = createLevel(DEFAULT_SETUP);
    const front = frontTile(state.players.abbi);
    expect(getPrompt(state, "abbi").interact).toBeNull();
    expect(outlineDashes(state, "abbi").has(outlineKey(front))).toBe(false);
  });

  it("outlines the tile a press acts on, solid while the press can act (#1914)", () => {
    const level = createLevel(DEFAULT_SETUP);
    // Fred faces the free ARRANGE table from its side and holds roses.
    const state = {
      ...level,
      players: {
        ...level.players,
        fred: {
          ...level.players.fred,
          x: 7.5,
          y: 3.5,
          facingX: 1,
          facingY: 0,
          holding: { kind: "roses" as const, madeBy: null },
        },
      },
    };
    expect(interactTile(state, "fred")).toEqual({ x: 8, y: 3 });
    const dashes = outlineDashes(state, "fred");
    expect(dashes.get(outlineKey({ x: 8, y: 3 }))).toEqual([]);
    expect(dashes.has(outlineKey({ x: 8, y: 2 }))).toBe(false);
  });

  it("outlines the station a person beside them will use, not the floor they face", () => {
    const level = createLevel(DEFAULT_SETUP);
    // Fred stands beside the arrange table, faces the floor and holds roses.
    const state = {
      ...level,
      players: {
        ...level.players,
        fred: {
          ...level.players.fred,
          x: 7.5,
          y: 3.5,
          facingX: 0,
          facingY: -1,
          holding: { kind: "roses" as const, madeBy: null },
        },
      },
    };
    const outlined = [...outlineDashes(state, "fred").keys()];
    expect(outlined).toContain(outlineKey({ x: 8, y: 3 }));
    expect(outlined).not.toContain(outlineKey({ x: 7, y: 2 }));
  });

  it("outlines each person's press tile in co-op, one outline apiece", () => {
    const level = createLevel(DEFAULT_SETUP);
    const state = {
      ...level,
      players: {
        fred: {
          ...level.players.fred,
          x: 7.5,
          y: 3.5,
          facingX: 1,
          facingY: 0,
          holding: { kind: "roses" as const, madeBy: null },
        },
        // Abbi stands below the first chair spot, holding a stack of two.
        abbi: {
          ...level.players.abbi,
          x: 16.5,
          y: 6.5,
          facingX: 0,
          facingY: -1,
          holding: { kind: "chairs" as const, madeBy: null, count: 2 },
        },
      },
    };
    expect(interactTile(state, "abbi")).toEqual({ x: 16, y: 5 });
    const dashes = outlineDashes(state, null);
    expect(dashes.get(outlineKey({ x: 8, y: 3 }))).toEqual([]);
    expect(dashes.get(outlineKey({ x: 16, y: 5 }))).toEqual([]);
  });

  it("dashes the faced station a person waits on, while it is busy", () => {
    const level = createLevel(DEFAULT_SETUP);
    // Both ARRANGE tables hold roses, so Fred holding roses must wait at the first.
    const state = {
      ...level,
      stations: level.stations.map((s) =>
        s.kind === "arrange"
          ? { ...s, item: { kind: "roses" as const, madeBy: null } }
          : s
      ),
      players: {
        ...level.players,
        fred: {
          ...level.players.fred,
          x: 7.5,
          y: 3.5,
          facingX: 1,
          facingY: 0,
          holding: { kind: "roses" as const, madeBy: null },
        },
      },
    };
    expect(getCoachTile(state, "fred")).toEqual({ x: 8, y: 3 });
    expect(interactTile(state, "fred")).toBeNull();
    expect(
      outlineDashes(state, "fred").get(outlineKey({ x: 8, y: 3 }))
    ).toEqual([3, 3]);
  });

  it("draws a target's n/2 count after the outlines, so no outline covers its plate", () => {
    const ctx = document
      .createElement("canvas")
      .getContext("2d") as CanvasRenderingContext2D;
    const level = createLevel(DEFAULT_SETUP);
    // Fred faces the two-item bouquet basket and holds the arrangement.
    const state = {
      ...level,
      players: {
        ...level.players,
        fred: {
          ...level.players.fred,
          x: 16.5,
          y: 10.5,
          facingX: 1,
          facingY: 0,
          holding: { kind: "arrangement" as const, madeBy: "fred" as const },
        },
      },
    };
    drawVenue(ctx, state, "fred");
    const basket = state.targets.find((t) => t.kind === "basket");
    expect(basket?.capacity).toBe(2);
    const outline = `${(basket?.x ?? 0) * TILE + 2},${(basket?.y ?? 0) * TILE + 2}`;
    const strokeIndex = vi
      .mocked(ctx.strokeRect)
      .mock.calls.findIndex(([x, y]) => `${x},${y}` === outline);
    const countIndex = vi
      .mocked(ctx.fillText)
      .mock.calls.findIndex(([text]) => text === "0/2");
    expect(strokeIndex).toBeGreaterThanOrEqual(0);
    expect(countIndex).toBeGreaterThanOrEqual(0);
    expect(
      vi.mocked(ctx.fillText).mock.invocationCallOrder[countIndex] ?? 0
    ).toBeGreaterThan(
      vi.mocked(ctx.strokeRect).mock.invocationCallOrder[strokeIndex] ?? 0
    );
  });

  it("draws the empty-crate count with at least 4.5:1 contrast on the crate (#1914)", () => {
    const ctx = document
      .createElement("canvas")
      .getContext("2d") as CanvasRenderingContext2D;
    const level = createLevel(DEFAULT_SETUP);
    const state = {
      ...level,
      stock: { ...level.stock, roses: 0 },
    };
    const seen: { text: string; fill: string }[] = [];
    vi.mocked(ctx.fillText).mockImplementation((text: string) => {
      seen.push({ text, fill: String(ctx.fillStyle) });
    });
    drawVenue(ctx, state, null);
    vi.mocked(ctx.fillText).mockReset();
    const count = seen.find((entry) => entry.text === "0");
    expect(count).toBeTruthy();
    expect(contrast(count?.fill ?? "", CRATE_FILL)).toBeGreaterThanOrEqual(4.5);
  });
});

/** WCAG contrast ratio between two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe("For Better or Bulk floor and bin lines", () => {
  it("says there is no room when the floor is full", () => {
    expect(describeEvent({ type: "floor-full", player: "fred" })).toBe(
      "No room on the floor. Find a counter or a target."
    );
  });

  it("stays quiet when something is thrown out", () => {
    expect(
      describeEvent({ type: "thrown-out", player: "abbi", item: "burnt" })
    ).toBeNull();
  });
});

describe("For Better or Bulk sound map (F4)", () => {
  it.each([
    [
      {
        type: "target-filled",
        player: "abbi",
        target: "T1-1",
        category: "bouquets",
      },
      "place",
    ],
    [{ type: "category-complete", category: "chairs" }, "category"],
    [{ type: "cooked", station: "G4-3", item: "wings" }, "cooked"],
    [{ type: "burnt", station: "G4-3" }, "burnt"],
    [{ type: "brothers-text" }, "brothers"],
    [{ type: "fred-returned" }, "fred"],
    [{ type: "level-finished", early: true }, "finish"],
    [{ type: "floor-full", player: "fred" }, "refused"],
    [
      {
        type: "interruption",
        id: "garden-formal",
        player: "abbi",
        blockedBy: "faq",
      },
      "refused",
    ],
  ] as const)("maps %j to %s", (event, key) => {
    expect(soundFor(event)).toBe(key);
  });

  it("plays nothing for routine pick-ups or a phone call that is not blocked", () => {
    expect(
      soundFor({ type: "picked-up", player: "fred", item: "roses" })
    ).toBeNull();
    expect(soundFor({ type: "supply-empty", supply: "roses" })).toBeNull();
    expect(
      soundFor({
        type: "interruption",
        id: "garden-formal",
        player: "abbi",
        blockedBy: null,
      })
    ).toBeNull();
  });

  it("finds the categories that became complete between two steps", () => {
    const before = createLevel(DEFAULT_SETUP);
    const category = before.targets.find(
      (t) => t.status !== "unplanned"
    )?.category;
    expect(category).toBeDefined();
    const after = {
      ...before,
      targets: before.targets.map((t) =>
        t.category === category && t.status !== "unplanned"
          ? {
              ...t,
              status: "filled" as const,
              filled: Array.from({ length: t.capacity }, () => ({
                kind: t.wants,
                madeBy: null,
              })),
            }
          : t
      ),
    };
    expect(completedCategories(before, after)).toEqual([category]);
    expect(completedCategories(after, after)).toEqual([]);
  });

  it("plays each sound key at most once in a step", () => {
    const events: FeedbackEvent[] = [
      { type: "brothers-text" },
      { type: "brothers-text" },
      { type: "burnt", station: "G4-3" },
      { type: "burnt", station: "G4-1" },
      { type: "level-finished", early: false },
      { type: "level-finished", early: true },
    ];
    const play = vi.fn();
    playStepSounds(events, play);
    expect(play.mock.calls).toEqual([["brothers"], ["burnt"], ["finish"]]);
  });

  it("drops the place tick when a category completes in the same step", () => {
    const events: FeedbackEvent[] = [
      {
        type: "target-filled",
        player: "abbi",
        target: "T1-1",
        category: "chairs",
      },
      { type: "category-complete", category: "chairs" },
    ];
    const play = vi.fn();
    playStepSounds(events, play);
    expect(play.mock.calls).toEqual([["category"]]);
  });

  it("keeps the place tick when no category completes", () => {
    const events: FeedbackEvent[] = [
      {
        type: "target-filled",
        player: "abbi",
        target: "T1-1",
        category: "chairs",
      },
      {
        type: "target-filled",
        player: "fred",
        target: "T1-2",
        category: "chairs",
      },
    ];
    const play = vi.fn();
    playStepSounds(events, play);
    expect(play.mock.calls).toEqual([["place"]]);
  });
});

describe("For Better or Bulk loud canvas (F4)", () => {
  const makeCtx = () =>
    document
      .createElement("canvas")
      .getContext("2d") as CanvasRenderingContext2D;

  it("passes canvas bursts through only when the cabinet is loud", () => {
    const burst: CanvasBurst = { kind: "ring", x: 1, y: 1, startedAt: 0 };
    expect(canvasBurstsFor(true, [burst])).toEqual([burst]);
    expect(canvasBurstsFor(false, [burst])).toEqual([]);
  });

  it("draws a ring on a target for a short game-time window only", () => {
    const state = createLevel(DEFAULT_SETUP);
    const target = state.targets.find((t) => t.status === "open");
    if (!target) throw new Error("the plan has an open target");
    const cx = target.x * TILE + TILE / 2;
    const cy = target.y * TILE + TILE / 2;
    const ringAt = (startedAt: number) => {
      const ctx = makeCtx();
      vi.mocked(ctx.arc).mockClear();
      drawVenue(ctx, state, null, [
        { kind: "ring", x: target.x, y: target.y, startedAt },
      ]);
      return vi
        .mocked(ctx.arc)
        .mock.calls.some(
          ([x, y, r]) => x === cx && y === cy && r === TILE * 0.35
        );
    };
    expect(ringAt(state.time)).toBe(true);
    expect(ringAt(state.time - BURST_SECONDS)).toBe(false);
    expect(ringAt(state.time + 1)).toBe(false);
  });

  it("keeps every label at 10px and squeezes a long one to the tile width", () => {
    const draws = (width: number) => {
      const ctx = makeCtx();
      const fonts: string[] = [];
      const maxWidths: (number | undefined)[] = [];
      vi.mocked(ctx.measureText).mockImplementation(() =>
        fromPartial<TextMetrics>({ width })
      );
      vi.mocked(ctx.fillText).mockImplementation(
        (text: string, _x: number, _y: number, maxWidth?: number) => {
          if (text === "GRILL") {
            fonts.push(String(ctx.font));
            maxWidths.push(maxWidth);
          }
        }
      );
      drawVenue(ctx, createLevel(DEFAULT_SETUP), null);
      vi.mocked(ctx.fillText).mockReset();
      vi.mocked(ctx.measureText).mockReset();
      return { fonts, maxWidths };
    };
    const fits = draws(20);
    expect(fits.fonts.length).toBeGreaterThan(0);
    expect(fits.fonts.every((f) => f.includes("10px"))).toBe(true);
    const tooWide = draws(60);
    expect(tooWide.fonts.every((f) => f.includes("10px"))).toBe(true);
    // The two grill tiles share one label, centred over both, so it may
    // span the pair: one drawn label, clamped to two tiles less 2px.
    expect(tooWide.maxWidths).toHaveLength(1);
    expect(tooWide.maxWidths.every((w) => w === 2 * TILE - 2)).toBe(true);
  });

  it.each<TargetKind>([
    "basket",
    "table",
    "aisle",
    "chair-spot",
    "hook",
    "buffet",
  ])("keeps the bare-spot label at 4.5:1 or better on a %s", (kind) => {
    const state = createLevel(DEFAULT_SETUP);
    const index = state.targets.findIndex((t) => t.kind === kind);
    expect(index, `the plan has a ${kind} target`).toBeGreaterThanOrEqual(0);
    const target = state.targets[index];
    const targets = state.targets.map((t, i) =>
      i === index ? { ...t, status: "simplified" as const } : t
    );
    const px = target.x * TILE;
    const py = target.y * TILE;
    const ctx = makeCtx();
    let ground = "";
    let plate = "";
    let label = "";
    vi.mocked(ctx.fillRect).mockImplementation(
      (x: number, y: number, w: number, h: number) => {
        if (x === px && y === py && w === TILE && h === TILE)
          ground = String(ctx.fillStyle);
      }
    );
    let lastPlate = "";
    vi.mocked(ctx.roundRect).mockImplementation(() => {
      lastPlate = String(ctx.fillStyle);
    });
    vi.mocked(ctx.fillText).mockImplementation((text: string) => {
      if (text !== "BARE") return;
      plate = lastPlate;
      label = String(ctx.fillStyle);
    });
    drawVenue(ctx, { ...state, targets }, null);
    vi.mocked(ctx.fillRect).mockReset();
    vi.mocked(ctx.roundRect).mockReset();
    vi.mocked(ctx.fillText).mockReset();
    expect(ground).toMatch(/^#[0-9a-f]{6}$/);
    expect(plate).toBe(BADGE_FILL);
    expect(label).toBe("#f4f4f6");
    expect(contrast(label, overPlate(ground))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("For Better or Bulk jokes on the canvas", () => {
  const makeCtx = () =>
    document
      .createElement("canvas")
      .getContext("2d") as CanvasRenderingContext2D;

  /** Records every fill colour the venue sets, in order. */
  const fillsOf = (
    draw: (ctx: CanvasRenderingContext2D) => void
  ): unknown[] => {
    const ctx = makeCtx();
    const fills: unknown[] = [];
    Object.defineProperty(ctx, "fillStyle", {
      configurable: true,
      get: () => "",
      set: (value: unknown) => {
        fills.push(value);
      },
    });
    draw(ctx);
    return fills;
  };

  it("keeps a crumple on screen long enough to read, and smoke in steel", () => {
    expect(burstLifetime("crumple")).toBeCloseTo(1.2);
    expect(burstLifetime("crumple")).toBeGreaterThan(BURST_SECONDS);
    const state = createLevel(DEFAULT_SETUP);
    const smoke = fillsOf((ctx) =>
      drawVenue(ctx, state, null, [
        { kind: "charcoal", x: 3, y: 3, startedAt: state.time },
      ])
    );
    expect(smoke).toContain("#94a3b8");
    expect(smoke).not.toContain("#1b1b1b");
  });

  it("draws the car only when the cart is Yes", () => {
    const yes = createLevel({
      ...DEFAULT_SETUP,
      cart: { ...DEFAULT_SETUP.cart, roses: "yes" },
    });
    expect(fillsOf((ctx) => drawVenue(ctx, yes, null))).toContain("#13151a");
    const full = createLevel(DEFAULT_SETUP);
    expect(fillsOf((ctx) => drawVenue(ctx, full, null))).not.toContain(
      "#13151a"
    );
  });

  it("shows the suit tip only to someone standing beside the coat hanger", () => {
    const state = createLevel(DEFAULT_SETUP);
    const tipAt = (x: number, y: number) => {
      const near = {
        ...state,
        players: {
          ...state.players,
          abbi: { ...state.players.abbi, x, y },
        },
      };
      const ctx = makeCtx();
      const texts: string[] = [];
      vi.mocked(ctx.fillText).mockImplementation((text: string) => {
        texts.push(text);
      });
      drawVenue(ctx, near, null);
      vi.mocked(ctx.fillText).mockReset();
      return texts.includes(bankText("joke-suit-tip"));
    };
    expect(tipAt(18.5, 1.5)).toBe(true);
    expect(tipAt(4.5, 6.5)).toBe(false);
  });
});
