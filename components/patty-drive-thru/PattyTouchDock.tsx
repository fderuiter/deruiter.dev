"use client";

import React from "react";
import {
  IconCashRegister,
  IconChevronLeft,
  IconChevronRight,
  IconEraser,
  IconPlayerPause,
} from "@tabler/icons-react";
import { TouchButton, TouchControlsGate } from "@/components/arcade/mobile";
import { useBooth } from "./hooks";
import type { BoothStore } from "./store";

/** Which way a turn key swings the head. */
type TurnDirection = "left" | "right";

interface PattyTouchDockProps {
  store: BoothStore;
  /** The 3D booth has turn keys and a register key; the flat view has neither. */
  view: "3d" | "flat";
  /** True while the register sheet is open over the booth. */
  registerOpen: boolean;
  /** A turn key went down (true) or came up (false). */
  onTurn: (direction: TurnDirection, down: boolean) => void;
  onToggleRegister: () => void;
  onPause: () => void;
}

/**
 * The on-screen keys of the Patty's Drive-Thru touch cabinet (#2116): two
 * hold-to-turn keys at the thumbs' edges, the register, the wipe and the
 * pause. They are the same actions as the A and D, Enter, W and P keys. The
 * dock sits inside the game's keyboard boundary, so every key keeps working
 * beside it, and it hides while a keyboard is in use and returns on the next
 * touch (`TouchControlsGate`).
 *
 * The turn keys hold while a finger is down. The others act when the tap
 * completes, and none of them takes focus, so Enter and the shift shortcuts
 * stay with the booth after a tap.
 *
 * @param props - The view, the register state and a handler for each key.
 * @returns The dock.
 */
export function PattyTouchDock({
  store,
  view,
  registerOpen,
  onTurn,
  onToggleRegister,
  onPause,
}: PattyTouchDockProps) {
  const canWipe = useBooth(store, (s) => s.shift.time >= s.shift.wipeReadyAt);
  const act = store.getState().act;
  const booth = view === "3d";

  return (
    <TouchControlsGate>
      <div
        role="group"
        aria-label="Patty's Drive-Thru touch controls"
        data-testid="pdt-touch-dock"
        data-view={view}
        className="pdt-dock"
      >
        {booth ? (
          <TouchButton
            label="Turn left"
            aria-keyshortcuts="A ArrowLeft"
            onPress={() => onTurn("left", true)}
            onRelease={() => onTurn("left", false)}
            className="pdt-key pdt-key-turn"
          >
            <IconChevronLeft className="pdt-key-icon" aria-hidden="true" />
            <span aria-hidden="true" className="pdt-key-label">
              Turn left
            </span>
          </TouchButton>
        ) : null}
        <button
          type="button"
          aria-label="Wipe counter"
          aria-keyshortcuts="W"
          disabled={!canWipe}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => act({ type: "wipe" })}
          className="pdt-key pdt-key-wipe min-h-14"
        >
          <IconEraser className="pdt-key-icon" aria-hidden="true" />
          <span aria-hidden="true" className="pdt-key-label">
            Wipe
          </span>
        </button>
        {booth ? (
          <button
            type="button"
            aria-label={registerOpen ? "Close register" : "Use the register"}
            aria-keyshortcuts="Enter Tab"
            aria-pressed={registerOpen}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onToggleRegister}
            className="pdt-key pdt-key-register min-h-14"
          >
            <IconCashRegister className="pdt-key-icon" aria-hidden="true" />
            <span aria-hidden="true" className="pdt-key-label">
              {registerOpen ? "Back" : "Register"}
            </span>
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Pause shift"
          aria-keyshortcuts="P"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onPause}
          className="pdt-key pdt-key-pause min-h-14"
        >
          <IconPlayerPause className="pdt-key-icon" aria-hidden="true" />
          <span aria-hidden="true" className="pdt-key-label">
            Pause
          </span>
        </button>
        {booth ? (
          <TouchButton
            label="Turn right"
            aria-keyshortcuts="D ArrowRight"
            onPress={() => onTurn("right", true)}
            onRelease={() => onTurn("right", false)}
            className="pdt-key pdt-key-turn"
          >
            <IconChevronRight className="pdt-key-icon" aria-hidden="true" />
            <span aria-hidden="true" className="pdt-key-label">
              Turn right
            </span>
          </TouchButton>
        ) : null}
      </div>
    </TouchControlsGate>
  );
}
