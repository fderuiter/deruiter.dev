// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePickPlace } from "@/components/arcade/mobile/usePickPlace";

const ITEMS = ["Red", "Blue"] as const;
const SLOTS = ["Left", "Middle", "Right"] as const;
type Item = (typeof ITEMS)[number];
type Slot = (typeof SLOTS)[number];

/** A board: two cards, three slots, a live region and an HTML5 drag path. */
function Board({
  onPlace,
  canPlace,
  withSlots = true,
  onDragStart,
}: {
  onPlace: (item: Item, slot: Slot) => void;
  canPlace?: (item: Item, slot: Slot) => boolean;
  withSlots?: boolean;
  onDragStart?: () => void;
}) {
  const pp = usePickPlace<Item, Slot>({
    itemLabel: (item) => `${item} card`,
    slotLabel: (slot) => `${slot} slot`,
    slots: withSlots ? SLOTS : undefined,
    canPlace,
    onPlace,
  });
  return (
    <div>
      {ITEMS.map((item) => (
        <button
          key={item}
          type="button"
          draggable
          onDragStart={onDragStart}
          {...pp.getItemProps(item)}
        >
          {item}
        </button>
      ))}
      {SLOTS.map((slot) => (
        <button key={slot} type="button" {...pp.getSlotProps(slot)}>
          {slot}
        </button>
      ))}
      <p {...pp.liveRegionProps}>{pp.announcement}</p>
    </div>
  );
}

const status = () => screen.getByRole("status");
const button = (name: string) => screen.getByRole("button", { name });

function key(el: HTMLElement, k: string) {
  act(() => {
    fireEvent.keyDown(el, { key: k });
  });
}

describe("usePickPlace (#2360)", () => {
  afterEach(() => cleanup());

  describe("tap to pick, tap to place", () => {
    it("a tap picks and announces the item, a tap on a slot places it", () => {
      const onPlace = vi.fn();
      render(<Board onPlace={onPlace} />);
      fireEvent.click(button("Red"));
      expect(button("Red").getAttribute("aria-pressed")).toBe("true");
      expect(button("Red").dataset.picked).toBe("true");
      expect(status().textContent).toMatch(/^Picked Red card\./);
      expect(button("Right").dataset.pickTarget).toBe("true");

      fireEvent.click(button("Right"));
      expect(onPlace).toHaveBeenCalledWith("Red", "Right");
      expect(status().textContent).toBe("Placed Red card on Right slot.");
      expect(button("Red").getAttribute("aria-pressed")).toBe("false");
      expect(button("Right").dataset.pickTarget).toBeUndefined();
    });

    it("tapping the picked item again puts it back", () => {
      const onPlace = vi.fn();
      render(<Board onPlace={onPlace} />);
      fireEvent.click(button("Red"));
      fireEvent.click(button("Red"));
      expect(status().textContent).toBe("Put Red card back.");
      fireEvent.click(button("Left"));
      expect(onPlace).not.toHaveBeenCalled();
    });

    it("tapping another item picks that one instead", () => {
      const onPlace = vi.fn();
      render(<Board onPlace={onPlace} />);
      fireEvent.click(button("Red"));
      fireEvent.click(button("Blue"));
      expect(button("Red").getAttribute("aria-pressed")).toBe("false");
      expect(button("Blue").getAttribute("aria-pressed")).toBe("true");
      fireEvent.click(button("Middle"));
      expect(onPlace).toHaveBeenCalledWith("Blue", "Middle");
    });

    it("a slot tapped with nothing picked does nothing", () => {
      const onPlace = vi.fn();
      render(<Board onPlace={onPlace} />);
      fireEvent.click(button("Left"));
      expect(onPlace).not.toHaveBeenCalled();
      expect(status().textContent).toBe("");
    });

    it("a refused slot keeps the item picked and says why", () => {
      const onPlace = vi.fn();
      render(
        <Board onPlace={onPlace} canPlace={(_item, slot) => slot !== "Left"} />
      );
      fireEvent.click(button("Red"));
      fireEvent.click(button("Left"));
      expect(onPlace).not.toHaveBeenCalled();
      expect(status().textContent).toBe("Red card cannot go on Left slot.");
      expect(button("Red").getAttribute("aria-pressed")).toBe("true");
      fireEvent.click(button("Middle"));
      expect(onPlace).toHaveBeenCalledWith("Red", "Middle");
    });

    it("keeps HTML5 drag on the item for desktop", () => {
      const onDragStart = vi.fn();
      render(<Board onPlace={vi.fn()} onDragStart={onDragStart} />);
      expect(button("Red").getAttribute("draggable")).toBe("true");
      fireEvent.dragStart(button("Red"));
      expect(onDragStart).toHaveBeenCalledTimes(1);
    });
  });

  describe("keyboard", () => {
    it("Enter picks, the arrows move between slots, Enter places", () => {
      const onPlace = vi.fn();
      render(<Board onPlace={onPlace} />);
      const red = button("Red");
      red.focus();
      key(red, "Enter");
      expect(red.getAttribute("aria-pressed")).toBe("true");
      expect(button("Left").dataset.activeSlot).toBe("true");
      expect(status().textContent).toBe(
        "Picked Red card. Tap a slot, or use the arrow keys and Enter, to place it. Escape cancels."
      );

      key(red, "ArrowRight");
      expect(status().textContent).toBe("Middle slot");
      expect(button("Middle").dataset.activeSlot).toBe("true");
      key(red, "ArrowDown");
      expect(status().textContent).toBe("Right slot");
      key(red, "ArrowRight");
      expect(status().textContent).toBe("Left slot");
      key(red, "ArrowLeft");
      expect(status().textContent).toBe("Right slot");
      key(red, "ArrowUp");
      expect(status().textContent).toBe("Middle slot");

      key(red, "Enter");
      expect(onPlace).toHaveBeenCalledWith("Red", "Middle");
      expect(status().textContent).toBe("Placed Red card on Middle slot.");
      // Focus never moves.
      expect(document.activeElement).toBe(red);
    });

    it("Enter on the item does not also click it", () => {
      render(<Board onPlace={vi.fn()} />);
      const red = button("Red");
      const keyDown = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        red.dispatchEvent(keyDown);
      });
      expect(keyDown.defaultPrevented).toBe(true);
    });

    it("Escape puts the picked item back", () => {
      const onPlace = vi.fn();
      render(<Board onPlace={onPlace} />);
      const blue = button("Blue");
      key(blue, "Enter");
      key(blue, "Escape");
      expect(status().textContent).toBe("Put Blue card back.");
      expect(blue.getAttribute("aria-pressed")).toBe("false");
      key(blue, "Enter");
      expect(blue.getAttribute("aria-pressed")).toBe("true");
    });

    it("Enter on a focused slot places on that slot", () => {
      const onPlace = vi.fn();
      render(<Board onPlace={onPlace} />);
      key(button("Red"), "Enter");
      key(button("Right"), "Enter");
      expect(onPlace).toHaveBeenCalledWith("Red", "Right");
    });

    it("keys do nothing while nothing is picked, so the page keeps them", () => {
      render(<Board onPlace={vi.fn()} />);
      const left = button("Left");
      const arrow = new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        left.dispatchEvent(arrow);
      });
      expect(arrow.defaultPrevented).toBe(false);
      expect(status().textContent).toBe("");
    });

    it("without slots it still picks and cancels, and gives the tap hint", () => {
      render(<Board onPlace={vi.fn()} withSlots={false} />);
      const red = button("Red");
      key(red, "Enter");
      expect(status().textContent).toBe(
        "Picked Red card. Tap where it goes. Tap it again or press Escape to cancel."
      );
      key(red, "ArrowRight");
      expect(status().textContent).toMatch(/^Picked Red card/);
      key(red, "Escape");
      expect(status().textContent).toBe("Put Red card back.");
    });
  });

  describe("screen reader", () => {
    it("announces through one polite, atomic, visually hidden status region", () => {
      render(<Board onPlace={vi.fn()} />);
      const region = status();
      expect(region.getAttribute("aria-live")).toBe("polite");
      expect(region.getAttribute("aria-atomic")).toBe("true");
      expect(region.className).toBe("sr-only");
    });
  });
});
