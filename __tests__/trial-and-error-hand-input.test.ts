import { describe, it, expect } from "vitest";
import {
  LONG_PRESS_SLOP_PX,
  handActivationIntent,
  handDisplayOrder,
  handKeyIntent,
  pressTravelled,
  reorderTarget,
  type HandInputContext,
  type HandKeyInput,
} from "@/lib/trial-and-error";

const context = (over: Partial<HandInputContext> = {}): HandInputContext => ({
  index: 2,
  count: 5,
  sealArmed: false,
  locked: false,
  blank: false,
  faceDown: false,
  ...over,
});

const key = (k: string, over: Partial<HandKeyInput> = {}): HandKeyInput => ({
  key: k,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  onCard: true,
  ...over,
});

describe("Hand keyboard policy (#997)", () => {
  it("roves focus with arrows, Home and End, clamped to the Hand", () => {
    expect(handKeyIntent(key("ArrowLeft"), context())).toEqual({
      kind: "FOCUS",
      index: 1,
    });
    expect(handKeyIntent(key("ArrowRight"), context())).toEqual({
      kind: "FOCUS",
      index: 3,
    });
    expect(handKeyIntent(key("Home"), context())).toEqual({
      kind: "FOCUS",
      index: 0,
    });
    expect(handKeyIntent(key("End"), context())).toEqual({
      kind: "FOCUS",
      index: 4,
    });
    expect(handKeyIntent(key("ArrowLeft"), context({ index: 0 }))).toEqual({
      kind: "FOCUS",
      index: 0,
    });
    expect(handKeyIntent(key("ArrowRight"), context({ index: 4 }))).toEqual({
      kind: "FOCUS",
      index: 4,
    });
  });

  it("reorders with Alt and an arrow, focus following the card", () => {
    expect(
      handKeyIntent(key("ArrowRight", { altKey: true }), context())
    ).toEqual({ kind: "MOVE", toIndex: 3, focusIndex: 3 });
    // Off the end, the domain refuses the move; focus stays in the Hand.
    expect(
      handKeyIntent(key("ArrowLeft", { altKey: true }), context({ index: 0 }))
    ).toEqual({ kind: "MOVE", toIndex: -1, focusIndex: 0 });
  });

  it("maps each action key on the card itself", () => {
    const cases: [string, string][] = [
      [" ", "TOGGLE_SELECT"],
      ["Enter", "PLAY"],
      ["d", "DISCARD"],
      ["D", "DISCARD"],
      ["i", "INSPECT"],
      ["r", "RECOMPILE"],
      ["?", "READ"],
    ];
    for (const [k, kind] of cases) {
      expect(handKeyIntent(key(k), context())?.kind).toBe(kind);
    }
    // Shift+R is Run Info's, not Recompile's.
    expect(handKeyIntent(key("R", { shiftKey: true }), context())).toBeNull();
    expect(handKeyIntent(key("x"), context())).toBeNull();
  });

  it("offers allocation only on a blank shell and structural QC only face down", () => {
    expect(handKeyIntent(key("a"), context())).toBeNull();
    expect(handKeyIntent(key("a"), context({ blank: true }))).toEqual({
      kind: "FOCUS_ALLOCATE",
    });
    expect(handKeyIntent(key("s"), context())).toBeNull();
    expect(handKeyIntent(key("s"), context({ faceDown: true }))).toEqual({
      kind: "STRUCTURAL_QC",
    });
  });

  it("ignores action keys from a nested element or with a modifier", () => {
    expect(handKeyIntent(key("d", { onCard: false }), context())).toBeNull();
    expect(handKeyIntent(key("d", { metaKey: true }), context())).toBeNull();
    expect(handKeyIntent(key("d", { ctrlKey: true }), context())).toBeNull();
    expect(handKeyIntent(key("d", { altKey: true }), context())).toBeNull();
    // Roving focus still works from a nested element.
    expect(handKeyIntent(key("Home", { onCard: false }), context())?.kind).toBe(
      "FOCUS"
    );
  });

  it("gives Enter, Space and Escape to a picked-up seal", () => {
    const armed = context({ sealArmed: true });
    expect(handKeyIntent(key("Enter"), armed)).toEqual({ kind: "APPLY_SEAL" });
    expect(handKeyIntent(key(" "), armed)).toEqual({ kind: "APPLY_SEAL" });
    expect(handKeyIntent(key("Escape"), armed)).toEqual({
      kind: "PUT_SEAL_BACK",
    });
    expect(handKeyIntent(key("Escape"), context())).toBeNull();
    // Other keys keep their meaning while a seal waits.
    expect(handKeyIntent(key("d"), armed)?.kind).toBe("DISCARD");
  });

  it("locks every Hand action during score playback, focus aside", () => {
    const locked = context({ locked: true, sealArmed: true });
    for (const k of [" ", "Enter", "d", "i", "r", "?", "Escape"]) {
      expect(handKeyIntent(key(k), locked)).toBeNull();
    }
    // A reorder is swallowed rather than scrolling the strip.
    expect(handKeyIntent(key("ArrowRight", { altKey: true }), locked)).toEqual({
      kind: "BLOCKED",
    });
    expect(handKeyIntent(key("ArrowRight"), locked)?.kind).toBe("FOCUS");
  });
});

describe("Hand pointer and touch policy (#997)", () => {
  const tap = (over: Partial<Parameters<typeof handActivationIntent>[0]>) =>
    handActivationIntent({
      pointerType: "mouse",
      selected: false,
      sealArmed: false,
      locked: false,
      ...over,
    });

  it("toggles selection on a click, including a second click", () => {
    expect(tap({})).toEqual({ kind: "TOGGLE_SELECT" });
    expect(tap({ selected: true })).toEqual({ kind: "TOGGLE_SELECT" });
    expect(tap({ pointerType: "touch" })).toEqual({ kind: "TOGGLE_SELECT" });
  });

  it("reads a selected card on a second tap by touch", () => {
    expect(tap({ pointerType: "touch", selected: true })).toEqual({
      kind: "READ",
    });
  });

  it("affixes a picked-up seal whatever the pointer", () => {
    expect(tap({ sealArmed: true })).toEqual({ kind: "APPLY_SEAL" });
    expect(
      tap({ sealArmed: true, pointerType: "touch", selected: true })
    ).toEqual({ kind: "APPLY_SEAL" });
  });

  it("does nothing during score playback", () => {
    expect(tap({ locked: true })).toBeNull();
    expect(tap({ locked: true, sealArmed: true })).toBeNull();
  });

  it("cancels a long press once it travels past the slop", () => {
    const from = { x: 10, y: 10 };
    expect(pressTravelled(from, { x: 10 + LONG_PRESS_SLOP_PX, y: 10 })).toBe(
      false
    );
    expect(pressTravelled(from, { x: 16, y: 17 })).toBe(true);
  });
});

describe("Hand reordering (#997)", () => {
  const hand = ["a", "b", "c", "d"];

  it("draws a drag in progress only while it holds the same cards", () => {
    expect(handDisplayOrder(hand, null)).toBe(hand);
    const dragging = ["b", "a", "c", "d"];
    expect(handDisplayOrder(hand, dragging)).toBe(dragging);
    // A card played or discarded mid-drag falls back to the Hand.
    expect(handDisplayOrder(hand, ["b", "a", "c"])).toBe(hand);
    expect(handDisplayOrder(hand, ["b", "a", "c", "z"])).toBe(hand);
  });

  it("commits once, to where the card was released, or not at all", () => {
    expect(reorderTarget(hand, ["b", "c", "a", "d"], "a")).toBe(2);
    expect(reorderTarget(hand, hand, "a")).toBeNull();
    expect(reorderTarget(hand, ["b", "a", "c", "d"], "c")).toBeNull();
    expect(reorderTarget(hand, hand, "z")).toBeNull();
  });
});
