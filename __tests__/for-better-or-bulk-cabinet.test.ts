import { describe, it, expect, vi } from "vitest";
import {
  DEFAULT_SETUP,
  createLevel,
  frontTile,
  getPrompt,
  type GameEvent,
} from "@/lib/for-better-or-bulk";
import { buildFrame, GAME_CODES } from "@/components/for-better-or-bulk/input";
import { describeEvent } from "@/components/for-better-or-bulk/messages";
import {
  TILE,
  drawItem,
  drawVenue,
  VENUE_HEIGHT,
  VENUE_WIDTH,
} from "@/components/for-better-or-bulk/venue-canvas";

/** The crate fill the stock counts are drawn on. */
const CRATE_FILL = "#7a5a3a";

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
      work: false,
    });
    expect(frame.inputs.abbi).toEqual({
      moveX: 0,
      moveY: -1,
      interact: false,
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
      work: true,
    });
    expect(frame.inputs.abbi).toEqual({
      moveX: 0,
      moveY: 0,
      interact: false,
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
    expect(labels).toContain("…");
  });

  it("outlines the tile each active person faces, solid when interact is ready (#1914)", () => {
    const ctx = document
      .createElement("canvas")
      .getContext("2d") as CanvasRenderingContext2D;
    const state = createLevel(DEFAULT_SETUP);
    drawVenue(ctx, state, "abbi");
    const tile = frontTile(state.players.abbi);
    expect(vi.mocked(ctx.strokeRect)).toHaveBeenCalledWith(
      tile.x * TILE + 2,
      tile.y * TILE + 2,
      TILE - 4,
      TILE - 4
    );
    const ready = getPrompt(state, "abbi").interact !== null;
    expect(vi.mocked(ctx.setLineDash)).toHaveBeenLastCalledWith(
      ready ? [] : [3, 3]
    );
  });

  it("outlines both facing tiles in co-op", () => {
    const ctx = document
      .createElement("canvas")
      .getContext("2d") as CanvasRenderingContext2D;
    const state = createLevel(DEFAULT_SETUP);
    drawVenue(ctx, state, null);
    const outlined = vi
      .mocked(ctx.strokeRect)
      .mock.calls.map(([x, y]) => `${x},${y}`);
    for (const id of ["fred", "abbi"] as const) {
      const tile = frontTile(state.players[id]);
      expect(outlined).toContain(`${tile.x * TILE + 2},${tile.y * TILE + 2}`);
    }
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
