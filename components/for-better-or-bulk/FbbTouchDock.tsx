"use client";

import React, { useEffect, useRef } from "react";
import { IconArrowsExchange, IconPlayerPause } from "@tabler/icons-react";
import { TouchButton, TouchControlsGate } from "@/components/arcade/mobile";
import {
  TOUCH_INTERACT_NAME,
  TOUCH_SWAP_NAME,
  TOUCH_WORK_NAME,
  type PlayerId,
} from "@/lib/for-better-or-bulk";
import type { ControlMode } from "./input";
import { stickCodes, TOUCH_KEYS, type TouchKeySet } from "./touch-input";

const NAMES: Readonly<Record<PlayerId, string>> = {
  fred: "Fred",
  abbi: "Abbi",
};

interface FbbTouchDockProps {
  mode: ControlMode;
  /** The person being played in solo; the dock's keys move them. */
  active: PlayerId;
  /** True while the clock is stopped; a stick in use lets go at once. */
  paused: boolean;
  /** False while the partner is out with his brothers, so there is no one to swap to. */
  canSwap: boolean;
  /** A dock key went down (true) or came up (false), as its keyboard code. */
  onKey: (code: string, down: boolean) => void;
  onSwap: () => void;
  onPause: () => void;
}

interface StickProps {
  keys: TouchKeySet;
  label: string;
  paused: boolean;
  onKey: (code: string, down: boolean) => void;
}

/**
 * A drag pad for walking. A finger anywhere on it walks toward where it rests
 * from the pad's centre, in eight directions, and keeps walking while it
 * stays down; lifting it stops. The direction is fed in as the same held keys
 * the keyboard gives, so the engine sees no difference. Each pad follows only
 * the finger that started on it, so two people can each use their own.
 */
function MoveStick({ keys, label, paused, onKey }: StickProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const pointer = useRef<number | null>(null);
  const down = useRef<readonly string[]>([]);
  const onKeyRef = useRef(onKey);
  useEffect(() => {
    onKeyRef.current = onKey;
  }, [onKey]);

  const setCodes = (next: readonly string[]) => {
    for (const code of down.current) {
      if (!next.includes(code)) onKeyRef.current(code, false);
    }
    for (const code of next) {
      if (!down.current.includes(code)) onKeyRef.current(code, true);
    }
    down.current = next;
  };

  const moveKnob = (x: number, y: number) => {
    const knob = knobRef.current;
    if (knob) knob.style.transform = `translate(${x}px, ${y}px)`;
  };

  const release = () => {
    pointer.current = null;
    setCodes([]);
    moveKnob(0, 0);
    padRef.current?.removeAttribute("data-active");
  };

  const follow = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const box = pad.getBoundingClientRect();
    const radius = Math.min(box.width, box.height) / 2;
    const dx = clientX - (box.left + box.width / 2);
    const dy = clientY - (box.top + box.height / 2);
    setCodes(stickCodes(dx / radius, dy / radius, keys));
    // The knob follows the finger, held inside the pad's rim.
    const length = Math.hypot(dx, dy);
    const reach = radius * 0.55;
    const scale = length > reach ? reach / length : 1;
    moveKnob(dx * scale, dy * scale);
  };

  // A pause or the brothers' text stops the clock: the walk ends there, and
  // a finger still resting on the pad starts again only when it moves.
  useEffect(() => {
    if (paused && pointer.current !== null) release();
  });

  // A pad that leaves the screen mid-walk must not leave its keys held.
  useEffect(() => () => setCodes([]), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={padRef}
      role="group"
      aria-label={label}
      aria-roledescription="drag pad"
      data-testid={`fbb-stick-${keys.player}`}
      className="fbb-stick"
      onPointerDown={(event) => {
        if (pointer.current !== null) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        pointer.current = event.pointerId;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Synthetic events have no capture; the drag still follows the pad.
        }
        event.currentTarget.setAttribute("data-active", "");
        follow(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (event.pointerId !== pointer.current) return;
        follow(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        if (event.pointerId === pointer.current) release();
      }}
      onPointerCancel={(event) => {
        if (event.pointerId === pointer.current) release();
      }}
      onLostPointerCapture={(event) => {
        if (event.pointerId === pointer.current) release();
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span aria-hidden="true" className="fbb-stick-ring" />
      <span ref={knobRef} aria-hidden="true" className="fbb-stick-knob" />
      <span aria-hidden="true" className="fbb-stick-label">
        {NAMES[keys.player]}
      </span>
    </div>
  );
}

interface ActionKeysProps {
  keys: TouchKeySet;
  /** In co-op the names carry the person, so each side reads as theirs. */
  named: boolean;
  onKey: (code: string, down: boolean) => void;
}

/** The dock's Pause key; the pause sheet's Resume carries on. */
function PauseKey({ onPause }: { onPause: () => void }) {
  return (
    <button
      type="button"
      aria-label="Pause"
      aria-keyshortcuts="Escape"
      data-testid="fbb-pause"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPause}
      className="fbb-key fbb-key-small min-h-14"
    >
      <IconPlayerPause className="fbb-key-icon" aria-hidden="true" />
      <span aria-hidden="true">Pause</span>
    </button>
  );
}

/** The Use and Work keys for one person: Use taps or holds, Work holds. */
function ActionKeys({ keys, named, onKey }: ActionKeysProps) {
  const who = named ? `${NAMES[keys.player]} ` : "";
  return (
    <div className="fbb-actions">
      <TouchButton
        label={`${who}${TOUCH_INTERACT_NAME}: pick up or put down, hold to drop on the floor`}
        aria-keyshortcuts={keys.interactShortcut}
        data-testid={`fbb-use-${keys.player}`}
        onPress={() => onKey(keys.interact, true)}
        onRelease={() => onKey(keys.interact, false)}
        className="fbb-key fbb-key-use"
      >
        <span aria-hidden="true">{TOUCH_INTERACT_NAME}</span>
      </TouchButton>
      <TouchButton
        label={`${who}${TOUCH_WORK_NAME}: hold to arrange, pluck or simplify`}
        aria-keyshortcuts={keys.workShortcut}
        data-testid={`fbb-work-${keys.player}`}
        onPress={() => onKey(keys.work, true)}
        onRelease={() => onKey(keys.work, false)}
        className="fbb-key fbb-key-work"
      >
        <span aria-hidden="true">{TOUCH_WORK_NAME}</span>
        <span aria-hidden="true" className="fbb-key-note">
          hold
        </span>
      </TouchButton>
    </div>
  );
}

/**
 * The on-screen keys of the For Better or Bulk touch cabinet (#2123). They
 * feed the same held keys as the keyboard (`buildFrame` reads both), so the
 * engine and a shared run code never know which was used.
 *
 * Solo has one drag pad at the left thumb, Use and Work at the right, and
 * Swap between them. Co-op gives each person their own pad, Use and Work at
 * their own edge: Fred on the left and Abbi on the right, mirrored. The dock
 * hides while a keyboard is in use and returns on the next touch
 * (`TouchControlsGate`).
 *
 * @param props - The mode, who is played, and a handler for each key.
 * @returns The dock.
 */
export function FbbTouchDock({
  mode,
  active,
  paused,
  canSwap,
  onKey,
  onSwap,
  onPause,
}: FbbTouchDockProps) {
  if (mode === "coop") {
    return (
      <TouchControlsGate>
        <div
          role="group"
          aria-label="For Better or Bulk touch controls"
          data-testid="fbb-touch-dock"
          data-mode="coop"
          className="fbb-dock"
        >
          <div
            role="group"
            aria-label="Fred's controls"
            className="fbb-side fbb-side-fred"
          >
            <MoveStick
              keys={TOUCH_KEYS.fred}
              label="Move Fred"
              paused={paused}
              onKey={onKey}
            />
            <ActionKeys keys={TOUCH_KEYS.fred} named onKey={onKey} />
          </div>
          <PauseKey onPause={onPause} />
          <div
            role="group"
            aria-label="Abbi's controls"
            className="fbb-side fbb-side-abbi"
          >
            <ActionKeys keys={TOUCH_KEYS.abbi} named onKey={onKey} />
            <MoveStick
              keys={TOUCH_KEYS.abbi}
              label="Move Abbi"
              paused={paused}
              onKey={onKey}
            />
          </div>
        </div>
      </TouchControlsGate>
    );
  }
  // Solo plays whoever is active with Fred's codes: buildFrame reads either
  // set for the person at the keys.
  const keys = { ...TOUCH_KEYS.fred, player: active };
  const partner = NAMES[active === "fred" ? "abbi" : "fred"];
  return (
    <TouchControlsGate>
      <div
        role="group"
        aria-label="For Better or Bulk touch controls"
        data-testid="fbb-touch-dock"
        data-mode="solo"
        className="fbb-dock"
      >
        <MoveStick
          keys={keys}
          label={`Move ${NAMES[active]}`}
          paused={paused}
          onKey={onKey}
        />
        <div className="fbb-middle">
          <button
            type="button"
            aria-label={
              canSwap
                ? `${TOUCH_SWAP_NAME} to ${partner}`
                : `${TOUCH_SWAP_NAME}: ${partner} is out with his brothers`
            }
            aria-keyshortcuts="Tab"
            aria-disabled={canSwap ? undefined : true}
            data-testid="fbb-swap"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onSwap}
            className="fbb-key fbb-key-small min-h-14"
          >
            <IconArrowsExchange className="fbb-key-icon" aria-hidden="true" />
            <span aria-hidden="true">{TOUCH_SWAP_NAME}</span>
          </button>
          <PauseKey onPause={onPause} />
        </div>
        <ActionKeys keys={keys} named={false} onKey={onKey} />
      </div>
    </TouchControlsGate>
  );
}
