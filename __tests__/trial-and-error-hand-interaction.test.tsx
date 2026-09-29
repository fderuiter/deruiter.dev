// @vitest-environment jsdom
import type React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  GUIDED_BLIND_SCENARIO as GUIDED,
  LONG_PRESS_MS,
  SEAL_DRAG_TYPE,
  createTableState,
  deriveTableView,
  type Consumable,
  type FootnoteSeal,
  type TableView,
} from "@/lib/trial-and-error";
import { useHandInteraction } from "@/components/trial-and-error/useHandInteraction";

const SEAL: Consumable = {
  id: "seal-1",
  kind: "SEAL",
  seal: { name: "Adjudicated Endpoint" } as FootnoteSeal,
};

const baseView = deriveTableView(GUIDED, createTableState(GUIDED));

type Options = Parameters<typeof useHandInteraction>[0];

function setup(over: Partial<Options> = {}, view: TableView = baseView) {
  const buttons = new Map<string, HTMLButtonElement>();
  for (const id of view.handIds) {
    const button = document.createElement("button");
    document.body.appendChild(button);
    buttons.set(id, button);
  }
  const options: Options = {
    view: { ...view, consumables: [SEAL] },
    playing: false,
    send: vi.fn(),
    announce: vi.fn(),
    cardRefs: { current: buttons },
    onRead: vi.fn(),
    onInspect: vi.fn(),
    onRecompile: vi.fn(),
    onStructural: vi.fn(),
    onFocusAllocate: vi.fn(),
    ...over,
  };
  const hook = renderHook((props: Options) => useHandInteraction(props), {
    initialProps: options,
  });
  return { ...hook, options, buttons };
}

function keyEvent(key: string, init: Partial<KeyboardEventInit> = {}) {
  const target = document.createElement("button");
  return {
    key,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    ...init,
    target,
    currentTarget: target,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLButtonElement>;
}

function pointer(pointerType: string, x = 0, y = 0) {
  return {
    pointerType,
    clientX: x,
    clientY: y,
  } as unknown as React.PointerEvent<HTMLButtonElement>;
}

const ids = baseView.handIds;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("useHandInteraction keyboard (#997)", () => {
  it("keeps one roving tab stop and moves focus with the arrows", () => {
    const { result, buttons } = setup();
    expect(ids.map((id) => result.current.bindCard(id).tabIndex)).toEqual(
      ids.map((_, i) => (i === 0 ? 0 : -1))
    );
    const event = keyEvent("ArrowRight");
    act(() => result.current.bindCard(ids[0]).onKeyDown(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.activeIndex).toBe(1);
    expect(document.activeElement).toBe(buttons.get(ids[1]));
    expect(result.current.bindCard(ids[1]).tabIndex).toBe(0);
  });

  it("dispatches selection, play and discard, landing focus back in the Hand", () => {
    const { result, options } = setup();
    act(() => result.current.bindCard(ids[2]).onKeyDown(keyEvent(" ")));
    expect(options.send).toHaveBeenLastCalledWith({
      type: "TOGGLE_SELECT",
      cardId: ids[2],
    });
    act(() => result.current.bindCard(ids[2]).onKeyDown(keyEvent("Enter")));
    expect(options.send).toHaveBeenLastCalledWith(
      { type: "PLAY_HAND" },
      { kind: "hand", index: 2 }
    );
    act(() => result.current.bindCard(ids[2]).onKeyDown(keyEvent("d")));
    expect(options.send).toHaveBeenLastCalledWith(
      { type: "DISCARD" },
      { kind: "hand", index: 2 }
    );
  });

  it("hands inspect, recompile and reading to the table", () => {
    const { result, options } = setup();
    act(() => result.current.bindCard(ids[1]).onKeyDown(keyEvent("i")));
    expect(options.onInspect).toHaveBeenCalledWith(ids[1]);
    act(() => result.current.bindCard(ids[1]).onKeyDown(keyEvent("r")));
    expect(options.onRecompile).toHaveBeenCalledWith(ids[1]);
    const read = keyEvent("?");
    act(() => result.current.bindCard(ids[1]).onKeyDown(read));
    expect(options.onRead).toHaveBeenCalledWith(ids[1]);
    // The Field Manual's window listener must not also open.
    expect(read.stopPropagation).toHaveBeenCalled();
  });

  it("reorders with Alt+arrows without spending anything but a move", () => {
    const { result, options } = setup();
    act(() =>
      result.current
        .bindCard(ids[0])
        .onKeyDown(keyEvent("ArrowRight", { altKey: true }))
    );
    expect(options.send).toHaveBeenCalledTimes(1);
    expect(options.send).toHaveBeenLastCalledWith(
      { type: "MOVE_CARD", cardId: ids[0], toIndex: 1 },
      { kind: "card", cardId: ids[0] }
    );
    expect(result.current.activeIndex).toBe(1);
  });

  it("leaves keys it does not own to the browser", () => {
    const { result, options } = setup();
    const tab = keyEvent("Tab");
    act(() => result.current.bindCard(ids[0]).onKeyDown(tab));
    expect(tab.preventDefault).not.toHaveBeenCalled();
    expect(options.send).not.toHaveBeenCalled();
  });
});

describe("useHandInteraction seals (#997)", () => {
  it("picks a seal up, affixes it with Enter, and announces both", () => {
    const { result, options } = setup();
    act(() => result.current.toggleArmed(SEAL.id));
    expect(result.current.armed?.id).toBe(SEAL.id);
    expect(result.current.bindCard(ids[3]).sealTarget).toBe(true);
    expect(options.announce).toHaveBeenLastCalledWith(
      "Adjudicated Endpoint picked up. Focus a card and press Enter to affix it. Escape puts it back."
    );
    act(() => result.current.bindCard(ids[3]).onKeyDown(keyEvent("Enter")));
    expect(options.send).toHaveBeenLastCalledWith(
      { type: "APPLY_SEAL", consumableId: SEAL.id, cardId: ids[3] },
      { kind: "card", cardId: ids[3] }
    );
    expect(result.current.armed).toBeNull();
  });

  it("puts a picked-up seal back with Escape", () => {
    const { result, options } = setup();
    act(() => result.current.toggleArmed(SEAL.id));
    act(() => result.current.bindCard(ids[0]).onKeyDown(keyEvent("Escape")));
    expect(result.current.armed).toBeNull();
    expect(options.announce).toHaveBeenLastCalledWith(
      "Adjudicated Endpoint put back."
    );
    expect(options.send).not.toHaveBeenCalled();
  });

  it("affixes a picked-up seal on a tap, and a seal dropped on a card", () => {
    const { result, options } = setup();
    act(() => result.current.toggleArmed(SEAL.id));
    act(() => result.current.bindCard(ids[4]).onPointerDown(pointer("touch")));
    act(() => result.current.bindCard(ids[4]).onClick());
    expect(options.send).toHaveBeenLastCalledWith(
      { type: "APPLY_SEAL", consumableId: SEAL.id, cardId: ids[4] },
      { kind: "card", cardId: ids[4] }
    );
    expect(result.current.activeIndex).toBe(4);

    const preventDefault = vi.fn();
    const dataTransfer = {
      types: [SEAL_DRAG_TYPE],
      dropEffect: "none",
      getData: (type: string) => (type === SEAL_DRAG_TYPE ? SEAL.id : ""),
    };
    const drag = {
      dataTransfer,
      preventDefault,
    } as unknown as React.DragEvent<HTMLButtonElement>;
    act(() => result.current.bindCard(ids[1]).onDragOver(drag));
    expect(preventDefault).toHaveBeenCalled();
    expect(dataTransfer.dropEffect).toBe("copy");
    act(() => result.current.bindCard(ids[1]).onDrop(drag));
    expect(options.send).toHaveBeenLastCalledWith(
      { type: "APPLY_SEAL", consumableId: SEAL.id, cardId: ids[1] },
      { kind: "card", cardId: ids[1] }
    );
  });

  it("forgets a seal that is sold while picked up", () => {
    const { result } = setup();
    act(() => result.current.toggleArmed(SEAL.id));
    act(() => result.current.releaseSeal("another"));
    expect(result.current.armed?.id).toBe(SEAL.id);
    act(() => result.current.releaseSeal(SEAL.id));
    expect(result.current.armed).toBeNull();
  });
});

describe("useHandInteraction pointer and touch (#997)", () => {
  it("toggles selection on a click", () => {
    const { result, options } = setup();
    act(() => result.current.bindCard(ids[2]).onPointerDown(pointer("mouse")));
    act(() => result.current.bindCard(ids[2]).onPointerEnd());
    act(() => result.current.bindCard(ids[2]).onClick());
    expect(options.send).toHaveBeenLastCalledWith({
      type: "TOGGLE_SELECT",
      cardId: ids[2],
    });
    expect(result.current.activeIndex).toBe(2);
  });

  it("reads a selected card on a second tap by touch", () => {
    const selected: TableView = {
      ...baseView,
      hand: baseView.hand.map((h, i) =>
        i === 0 ? { ...h, selected: true } : h
      ),
    };
    const { result, options } = setup({}, selected);
    act(() => result.current.bindCard(ids[0]).onPointerDown(pointer("touch")));
    act(() => result.current.bindCard(ids[0]).onPointerEnd());
    act(() => result.current.bindCard(ids[0]).onClick());
    expect(options.onRead).toHaveBeenCalledWith(ids[0]);
    expect(options.send).not.toHaveBeenCalled();
  });

  it("reads a card on a long press, and the click that ends it does nothing", () => {
    const { result, options } = setup();
    act(() => result.current.bindCard(ids[1]).onPointerDown(pointer("touch")));
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(options.onRead).toHaveBeenCalledWith(ids[1]);
    act(() => result.current.bindCard(ids[1]).onClick());
    expect(options.send).not.toHaveBeenCalled();
    // The next tap is an ordinary one again.
    act(() => result.current.bindCard(ids[1]).onClick());
    expect(options.send).toHaveBeenCalledTimes(1);
  });

  it("cancels a long press when the pointer moves or lifts early", () => {
    const { result, options } = setup();
    act(() =>
      result.current.bindCard(ids[1]).onPointerDown(pointer("touch", 0, 0))
    );
    act(() =>
      result.current.bindCard(ids[1]).onPointerMove(pointer("touch", 20, 0))
    );
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(options.onRead).not.toHaveBeenCalled();

    act(() => result.current.bindCard(ids[1]).onPointerDown(pointer("mouse")));
    act(() => result.current.bindCard(ids[1]).onPointerEnd());
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(options.onRead).not.toHaveBeenCalled();
  });

  it("keeps the browser menu off a long press by touch only", () => {
    const { result } = setup();
    const menu = () =>
      ({
        preventDefault: vi.fn(),
      }) as unknown as React.MouseEvent<HTMLButtonElement>;
    act(() => result.current.bindCard(ids[0]).onPointerDown(pointer("touch")));
    const touch = menu();
    result.current.bindCard(ids[0]).onContextMenu(touch);
    expect(touch.preventDefault).toHaveBeenCalled();
    act(() => result.current.bindCard(ids[0]).onPointerDown(pointer("mouse")));
    const mouse = menu();
    result.current.bindCard(ids[0]).onContextMenu(mouse);
    expect(mouse.preventDefault).not.toHaveBeenCalled();
  });
});

describe("useHandInteraction reordering (#997)", () => {
  it("shows the drag in progress and commits one move on release", () => {
    const { result, options } = setup();
    const dragged = [ids[1], ids[2], ids[0], ...ids.slice(3)];
    act(() => result.current.setDragOrder(dragged));
    expect(result.current.handOrder).toEqual(dragged);
    act(() => result.current.bindCard(ids[0]).onDragEnd());
    expect(options.send).toHaveBeenCalledTimes(1);
    expect(options.send).toHaveBeenLastCalledWith(
      { type: "MOVE_CARD", cardId: ids[0], toIndex: 2 },
      { kind: "card", cardId: ids[0] }
    );
    expect(result.current.handOrder).toEqual(ids);
    expect(result.current.activeIndex).toBe(2);
  });

  it("commits nothing when a drag ends where it began", () => {
    const { result, options } = setup();
    act(() => result.current.setDragOrder([...ids]));
    act(() => result.current.bindCard(ids[0]).onDragEnd());
    expect(options.send).not.toHaveBeenCalled();
  });
});

describe("useHandInteraction during score playback (#997)", () => {
  it("locks every conflicting Hand action while the score plays", () => {
    const { result, options } = setup({ playing: true });
    for (const key of [" ", "Enter", "d", "i", "r", "?"]) {
      act(() => result.current.bindCard(ids[0]).onKeyDown(keyEvent(key)));
    }
    const reorder = keyEvent("ArrowRight", { altKey: true });
    act(() => result.current.bindCard(ids[0]).onKeyDown(reorder));
    // Swallowed, so the strip does not scroll, but nothing moves.
    expect(reorder.preventDefault).toHaveBeenCalled();
    act(() => result.current.bindCard(ids[0]).onClick());
    expect(options.send).not.toHaveBeenCalled();
    expect(options.onInspect).not.toHaveBeenCalled();
    expect(options.onRecompile).not.toHaveBeenCalled();
    expect(options.onRead).not.toHaveBeenCalled();
  });

  it("unlocks the Hand once playback ends", () => {
    const { result, options, rerender } = setup({ playing: true });
    act(() => result.current.bindCard(ids[0]).onKeyDown(keyEvent(" ")));
    expect(options.send).not.toHaveBeenCalled();
    rerender({ ...options, playing: false });
    act(() => result.current.bindCard(ids[0]).onKeyDown(keyEvent(" ")));
    expect(options.send).toHaveBeenCalledWith({
      type: "TOGGLE_SELECT",
      cardId: ids[0],
    });
  });
});
