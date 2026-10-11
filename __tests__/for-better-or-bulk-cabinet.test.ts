import { describe, it, expect, vi } from "vitest";
import {
  DEFAULT_SETUP,
  createLevel,
  type GameEvent,
} from "@/lib/for-better-or-bulk";
import { buildFrame, GAME_CODES } from "@/components/for-better-or-bulk/input";
import { describeEvent } from "@/components/for-better-or-bulk/messages";
import {
  drawItem,
  drawVenue,
  VENUE_HEIGHT,
  VENUE_WIDTH,
} from "@/components/for-better-or-bulk/venue-canvas";

describe("For Better or Bulk keyboard mapping (#1906)", () => {
  it("gives Fred WASD and Abbi the arrows in co-op", () => {
    const frame = buildFrame(
      new Set(["KeyD", "ArrowUp", "ShiftRight"]),
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
    const frame = buildFrame(new Set(["KeyE"]), new Set(), "coop", "fred");
    expect(frame.inputs.fred.interact).toBe(false);
  });

  it("cancels opposite directions and carries a decision", () => {
    const decision = { choice: "stay", commitment: null } as const;
    const frame = buildFrame(
      new Set(["KeyA", "KeyD"]),
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
});
