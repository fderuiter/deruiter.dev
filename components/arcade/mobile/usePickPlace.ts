"use client";

import { useCallback, useMemo, useState, type KeyboardEvent } from "react";

/** Words a pick-and-place control speaks through its live region. */
interface PickPlaceMessages {
  picked: (item: string, hint: string) => string;
  moved: (slot: string) => string;
  placed: (item: string, slot: string) => string;
  refused: (item: string, slot: string) => string;
  cancelled: (item: string) => string;
  /** Second sentence of `picked`: how to place, for the current input. */
  hint: (hasSlots: boolean) => string;
}

/** Options for `usePickPlace`. */
interface UsePickPlaceOptions<Item, Slot> {
  /** Names an item for announcements, e.g. "SourceIngest chip". */
  itemLabel: (item: Item) => string;
  /** Names a slot for announcements. Default `String(slot)`. */
  slotLabel?: (slot: Slot) => string;
  /**
   * Slots in arrow-key order. Without them the keyboard can pick and cancel,
   * and a slot is placed only by a tap or click on it.
   */
  slots?: readonly Slot[];
  /** Whether two values are the same item. Default `Object.is`. */
  sameItem?: (a: Item, b: Item) => boolean;
  /** Whether two values are the same slot. Default `Object.is`. */
  sameSlot?: (a: Slot, b: Slot) => boolean;
  /** Refuses a slot; the item stays picked and the refusal is announced. */
  canPlace?: (item: Item, slot: Slot) => boolean;
  /** Commits a placement. */
  onPlace: (item: Item, slot: Slot) => void;
  /** Overrides for the announced words. */
  messages?: Partial<PickPlaceMessages>;
}

/** Props for a pickable item: a button the player taps, clicks or presses Enter on. */
interface PickItemProps {
  "aria-pressed": boolean;
  "data-picked": "true" | undefined;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
}

/** Props for a slot an item can be placed on. */
interface PickSlotProps {
  "data-pick-target": "true" | undefined;
  "data-active-slot": "true" | undefined;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
}

/** Props for the polite live region the announcements go into. */
interface PickLiveRegionProps {
  role: "status";
  "aria-live": "polite";
  "aria-atomic": true;
  className: string;
}

/** What `usePickPlace` returns. */
export interface PickPlace<Item, Slot> {
  /** The item in hand, or null. */
  picked: Item | null;
  /** The slot the arrow keys point at while an item is picked. */
  activeSlot: Slot | null;
  /** The latest announcement, for the live region. */
  announcement: string;
  pick: (item: Item) => void;
  /** Places the picked item. Returns true when it was placed. */
  place: (slot: Slot) => boolean;
  cancel: () => void;
  /** Picks an item, or puts it back when it is already picked. */
  toggle: (item: Item) => void;
  /** Handles Enter, arrows and Escape for whichever element has focus. */
  onKeyDown: (event: KeyboardEvent) => void;
  getItemProps: (item: Item) => PickItemProps;
  getSlotProps: (slot: Slot) => PickSlotProps;
  liveRegionProps: PickLiveRegionProps;
}

const DEFAULT_MESSAGES: PickPlaceMessages = {
  picked: (item, hint) => `Picked ${item}. ${hint}`,
  moved: (slot) => slot,
  placed: (item, slot) => `Placed ${item} on ${slot}.`,
  refused: (item, slot) => `${item} cannot go on ${slot}.`,
  cancelled: (item) => `Put ${item} back.`,
  hint: (hasSlots) =>
    hasSlots
      ? "Tap a slot, or use the arrow keys and Enter, to place it. Escape cancels."
      : "Tap where it goes. Tap it again or press Escape to cancel.",
};

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

const LIVE_REGION: PickLiveRegionProps = {
  role: "status",
  "aria-live": "polite",
  "aria-atomic": true,
  className: "sr-only",
};

/**
 * Tap-to-pick, tap-to-place: the touch replacement for drag-and-drop
 * (ADR 0062). A tap on an item picks it up and announces it; a tap on a slot
 * places it. Tapping the item again, or Escape, puts it back.
 *
 * The keyboard does the same: Enter picks the focused item, the arrow keys
 * move between `slots`, and Enter places. A polite live region announces each
 * step. Focus never moves, so the hook can sit beside HTML5 drag on desktop:
 * the drag handlers stay on the item and only taps and keys go through here.
 *
 * @param options - Labels, slot order, the placement callback and copy.
 * @returns The pick state, actions and prop getters for items, slots and the
 * live region.
 */
export function usePickPlace<Item, Slot>(
  options: UsePickPlaceOptions<Item, Slot>
): PickPlace<Item, Slot> {
  const {
    itemLabel,
    slotLabel = String,
    slots,
    sameItem = Object.is,
    sameSlot = Object.is,
    canPlace,
    onPlace,
    messages: overrides,
  } = options;
  const [picked, setPicked] = useState<{ item: Item } | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [announcement, setAnnouncement] = useState("");

  const messages = useMemo<PickPlaceMessages>(
    () => ({ ...DEFAULT_MESSAGES, ...overrides }),
    [overrides]
  );
  const slotCount = slots?.length ?? 0;
  const activeSlot =
    picked && slots && activeIndex >= 0 && activeIndex < slotCount
      ? slots[activeIndex]
      : null;

  const pick = useCallback(
    (item: Item) => {
      setPicked({ item });
      setActiveIndex(slotCount > 0 ? 0 : -1);
      setAnnouncement(
        messages.picked(itemLabel(item), messages.hint(slotCount > 0))
      );
    },
    [itemLabel, messages, slotCount]
  );

  const cancel = useCallback(() => {
    if (!picked) return;
    setPicked(null);
    setActiveIndex(-1);
    setAnnouncement(messages.cancelled(itemLabel(picked.item)));
  }, [itemLabel, messages, picked]);

  const place = useCallback(
    (slot: Slot) => {
      if (!picked) return false;
      const item = picked.item;
      if (canPlace && !canPlace(item, slot)) {
        setAnnouncement(messages.refused(itemLabel(item), slotLabel(slot)));
        return false;
      }
      setPicked(null);
      setActiveIndex(-1);
      setAnnouncement(messages.placed(itemLabel(item), slotLabel(slot)));
      onPlace(item, slot);
      return true;
    },
    [canPlace, itemLabel, messages, onPlace, picked, slotLabel]
  );

  const toggle = useCallback(
    (item: Item) => {
      if (picked && sameItem(picked.item, item)) cancel();
      else pick(item);
    },
    [cancel, pick, picked, sameItem]
  );

  const move = useCallback(
    (step: 1 | -1) => {
      if (!slots || slotCount === 0) return;
      const next = (Math.max(0, activeIndex) + step + slotCount) % slotCount;
      setActiveIndex(next);
      setAnnouncement(messages.moved(slotLabel(slots[next])));
    },
    [activeIndex, messages, slotCount, slotLabel, slots]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!picked) return;
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      } else if (NEXT_KEYS.has(event.key) && slotCount > 0) {
        event.preventDefault();
        move(1);
      } else if (PREV_KEYS.has(event.key) && slotCount > 0) {
        event.preventDefault();
        move(-1);
      } else if (event.key === "Enter" && activeSlot !== null) {
        event.preventDefault();
        place(activeSlot);
      }
    },
    [activeSlot, cancel, move, picked, place, slotCount]
  );

  const getItemProps = useCallback(
    (item: Item): PickItemProps => {
      const isPicked = picked !== null && sameItem(picked.item, item);
      return {
        "aria-pressed": isPicked,
        "data-picked": isPicked ? "true" : undefined,
        onClick: () => toggle(item),
        onKeyDown: (event) => {
          // Enter acts on keydown so the button's own click does not follow.
          if (event.key === "Enter" && !picked) {
            event.preventDefault();
            pick(item);
            return;
          }
          onKeyDown(event);
        },
      };
    },
    [onKeyDown, pick, picked, sameItem, toggle]
  );

  const getSlotProps = useCallback(
    (slot: Slot): PickSlotProps => {
      const isActive = activeSlot !== null && sameSlot(activeSlot, slot);
      return {
        "data-pick-target": picked ? "true" : undefined,
        "data-active-slot": isActive ? "true" : undefined,
        onClick: () => {
          place(slot);
        },
        onKeyDown: (event) => {
          if (event.key === "Enter" && picked) {
            event.preventDefault();
            place(slot);
            return;
          }
          onKeyDown(event);
        },
      };
    },
    [activeSlot, onKeyDown, picked, place, sameSlot]
  );

  return {
    picked: picked?.item ?? null,
    activeSlot,
    announcement,
    pick,
    place,
    cancel,
    toggle,
    onKeyDown,
    getItemProps,
    getSlotProps,
    liveRegionProps: LIVE_REGION,
  };
}
