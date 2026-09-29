"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { clamp } from "@/lib/game-utils";
import {
  LONG_PRESS_MS,
  SEAL_DRAG_TYPE,
  handActivationIntent,
  handDisplayOrder,
  handKeyIntent,
  pressTravelled,
  reorderTarget,
  type HandIntent,
  type RunAction,
  type TableView,
} from "@/lib/trial-and-error";

/** Where focus lands once the dispatched action has rendered. */
export type PendingFocus =
  { kind: "card"; cardId: string } | { kind: "hand"; index: number } | null;

/** The Card Table's side of the Hand: what each intent does there. */
interface HandInteractionOptions {
  view: Pick<TableView, "hand" | "handIds" | "consumables">;
  /** Score playback is running, so Hand actions are locked. */
  playing: boolean;
  send: (action: RunAction, focus?: PendingFocus) => void;
  announce: (message: string) => void;
  cardRefs: React.RefObject<Map<string, HTMLButtonElement>>;
  /** Open a card's detail view. */
  onRead: (cardId: string) => void;
  onInspect: (cardId: string) => void;
  onRecompile: (cardId: string) => void;
  onStructural: (cardId: string) => void;
  /** Move focus to the allocation control for a blank shell. */
  onFocusAllocate: () => void;
}

/** Everything one HandCard needs to take input; it adds only motion. */
export interface HandCardInteraction {
  tabIndex: number;
  /** A seal is picked up, so this card is a place to affix it. */
  sealTarget: boolean;
  onClick: () => void;
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  /** Pointer up, cancel or leave: the press is over. */
  onPointerEnd: () => void;
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDrop: (event: React.DragEvent<HTMLButtonElement>) => void;
  /** A reorder drag was released. */
  onDragEnd: () => void;
}

/**
 * The Hand's interaction seam (#997). It owns the roving focus, the picked-up
 * footnote seal, the reorder drag in progress and the long-press gesture, and
 * turns every key, tap and drop on a card into one policy decision from
 * `handKeyIntent` or `handActivationIntent`.
 */
export function useHandInteraction({
  view,
  playing,
  send,
  announce,
  cardRefs,
  onRead,
  onInspect,
  onRecompile,
  onStructural,
  onFocusAllocate,
}: HandInteractionOptions) {
  const [focusIndex, setFocusIndex] = useState(0);
  // Local order while a card is being dragged; committed as MOVE_CARD on drop.
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  // A tray seal picked up with the keyboard or a click, waiting for a card.
  const [armedId, setArmedId] = useState<string | null>(null);
  const pointerType = useRef("mouse");
  const press = useRef<{
    timer: ReturnType<typeof setTimeout>;
    x: number;
    y: number;
  } | null>(null);
  const longPressed = useRef(false);

  useEffect(
    () => () => {
      if (press.current) clearTimeout(press.current.timer);
    },
    []
  );

  const armedItem = view.consumables.find((c) => c.id === armedId);
  const armed = armedItem?.kind === "SEAL" ? armedItem : null;
  const activeIndex = clamp(focusIndex, 0, Math.max(0, view.hand.length - 1));
  const handOrder = handDisplayOrder(view.handIds, dragOrder);

  const applySeal = (consumableId: string, cardId: string) => {
    setArmedId(null);
    send(
      { type: "APPLY_SEAL", consumableId, cardId },
      { kind: "card", cardId }
    );
  };

  /** Pick a tray seal up, or put it back if it is already picked up. */
  const toggleArmed = (id: string) => {
    const next = armedId === id ? null : id;
    setArmedId(next);
    const item = view.consumables.find((c) => c.id === id);
    if (item?.kind === "SEAL") {
      announce(
        next
          ? `${item.seal.name} picked up. Focus a card and press Enter to affix it. Escape puts it back.`
          : `${item.seal.name} put back.`
      );
    }
  };

  /** Forget the picked-up seal if it is `id`, e.g. because it was sold. */
  const releaseSeal = (id: string) => {
    if (armedId === id) setArmedId(null);
  };

  const play = () =>
    send({ type: "PLAY_HAND" }, { kind: "hand", index: activeIndex });
  const discard = () =>
    send({ type: "DISCARD" }, { kind: "hand", index: activeIndex });

  const focusCard = (index: number) => {
    setFocusIndex(index);
    const id = view.hand[index]?.card.id;
    if (id) cardRefs.current.get(id)?.focus();
  };

  /** Carry out one policy decision for the card `cardId`. */
  const perform = (intent: HandIntent, cardId: string, index: number) => {
    switch (intent.kind) {
      case "BLOCKED":
        return;
      case "FOCUS":
        focusCard(intent.index);
        return;
      case "MOVE":
        setFocusIndex(intent.focusIndex);
        send(
          { type: "MOVE_CARD", cardId, toIndex: intent.toIndex },
          { kind: "card", cardId }
        );
        return;
      case "TOGGLE_SELECT":
        setFocusIndex(index);
        send({ type: "TOGGLE_SELECT", cardId });
        return;
      case "PLAY":
        play();
        return;
      case "DISCARD":
        discard();
        return;
      case "INSPECT":
        onInspect(cardId);
        return;
      case "RECOMPILE":
        onRecompile(cardId);
        return;
      case "STRUCTURAL_QC":
        onStructural(cardId);
        return;
      case "FOCUS_ALLOCATE":
        onFocusAllocate();
        return;
      case "READ":
        onRead(cardId);
        return;
      case "APPLY_SEAL":
        if (!armed) return;
        setFocusIndex(index);
        applySeal(armed.id, cardId);
        return;
      case "PUT_SEAL_BACK":
        if (armed) toggleArmed(armed.id);
        return;
    }
  };

  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };

  const commitDrag = (cardId: string) => {
    const to = reorderTarget(view.handIds, handOrder, cardId);
    setDragOrder(null);
    if (to === null) return;
    setFocusIndex(to);
    send({ type: "MOVE_CARD", cardId, toIndex: to }, { kind: "card", cardId });
  };

  /** The input handlers for the card `cardId`. */
  const bindCard = (cardId: string): HandCardInteraction => {
    const index = view.handIds.indexOf(cardId);
    const card = view.hand[index];
    return {
      tabIndex: index === activeIndex ? 0 : -1,
      sealTarget: armed !== null,
      onClick: () => {
        if (longPressed.current) {
          longPressed.current = false;
          return;
        }
        const intent = handActivationIntent({
          pointerType: pointerType.current,
          selected: card?.selected ?? false,
          sealArmed: armed !== null,
          locked: playing,
        });
        if (intent) perform(intent, cardId, index);
      },
      onFocus: () => setFocusIndex(index),
      onKeyDown: (event) => {
        const intent = handKeyIntent(
          {
            key: event.key,
            altKey: event.altKey,
            shiftKey: event.shiftKey,
            metaKey: event.metaKey,
            ctrlKey: event.ctrlKey,
            onCard: event.target === event.currentTarget,
          },
          {
            index,
            count: view.hand.length,
            sealArmed: armed !== null,
            locked: playing,
            blank: card?.blank ?? false,
            faceDown: card?.faceDown ?? false,
          }
        );
        if (!intent) return;
        event.preventDefault();
        // ? on a card reads it; the Field Manual listener must not see it.
        if (intent.kind === "READ") event.stopPropagation();
        perform(intent, cardId, index);
      },
      onPointerDown: (event) => {
        pointerType.current = event.pointerType;
        longPressed.current = false;
        cancelPress();
        const timer = setTimeout(() => {
          longPressed.current = true;
          press.current = null;
          onRead(cardId);
        }, LONG_PRESS_MS);
        press.current = { timer, x: event.clientX, y: event.clientY };
      },
      onPointerMove: (event) => {
        if (
          press.current &&
          pressTravelled(press.current, { x: event.clientX, y: event.clientY })
        ) {
          cancelPress();
        }
      },
      onPointerEnd: cancelPress,
      onContextMenu: (event) => {
        // A long press on touch reads the card, not the browser menu.
        if (pointerType.current === "touch") event.preventDefault();
      },
      onDragOver: (event) => {
        if (event.dataTransfer.types.includes(SEAL_DRAG_TYPE)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      },
      onDrop: (event) => {
        const id = event.dataTransfer.getData(SEAL_DRAG_TYPE);
        if (id) {
          event.preventDefault();
          applySeal(id, cardId);
        }
      },
      onDragEnd: () => commitDrag(cardId),
    };
  };

  return {
    /** The card holding the roving tab stop. */
    activeIndex,
    setFocusIndex,
    /** The order the Hand is drawn in, including a drag in progress. */
    handOrder,
    setDragOrder,
    /** The footnote seal picked up from the tray, if any. */
    armed,
    toggleArmed,
    releaseSeal,
    play,
    discard,
    bindCard,
  };
}
