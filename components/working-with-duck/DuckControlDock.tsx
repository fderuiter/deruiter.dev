"use client";

import React from "react";
import { DockFrame, HoldDpad, TouchButton } from "@/components/arcade/mobile";
import {
  useDuckTouchBridge,
  useDuckTouchSnapshot,
  type DuckCommand,
} from "@/components/working-with-duck/touch-bridge";
import { DUCK_ACTIONS } from "@/lib/working-with-duck-actions";

const KEY_BASE =
  "min-w-12 rounded-xl border border-zinc-700 bg-zinc-800/90 px-2 font-mono text-xs font-bold text-zinc-100 active:scale-[0.98] active:bg-amber-500/30 disabled:opacity-40 focus-visible:ring-amber-400";

/**
 * Every key is at least 48px tall, so a fingertip lands on it. In portrait,
 * with the height to spare, the keys grow to 64px, and the action row to 52px.
 */
const KEY = `h-12 portrait:min-[700px]:h-16 ${KEY_BASE}`;
const ACTION_KEY = `h-12 portrait:min-[700px]:h-[52px] ${KEY_BASE}`;

/** Keeps the keys off the bottom edge and clear of the home indicator. */
const DOCK_PADDING = {
  paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
};

/** The label a dock button reads: the action's own, from the action map. */
function labelOf(command: Exclude<DuckCommand, "auto-pause">): string {
  return DUCK_ACTIONS.actions[command].label;
}

/**
 * The touch cabinet's control dock for Working With Duck. Each button is bound
 * to an action of `DUCK_ACTIONS` and sends it, through the bridge, to the same
 * runner its key reaches, so a tap and a key cannot disagree (#2356). Only the
 * controls that do something in the current scene are drawn: the office has
 * toys, tricks and the work sprint; the park has the steer pad and jump; the
 * bathtub has the treat. Pause is always there. While the sprint is paused
 * every other control is disabled, as the keys are. Pause reads Resume only
 * when the player paused it. A pause for a scrapbook, wardrobe, manual or
 * hidden tab offers neither Resume nor a pause, since the game cannot resume
 * those from here.
 *
 * It is passed to PlayCabinet only on a touch device, so a desktop cabinet
 * keeps its markup.
 *
 * @returns The dock, or null outside a cabinet bridge.
 */
export function DuckControlDock() {
  const bridge = useDuckTouchBridge();
  const { scene, aiming, paused, manualPause } = useDuckTouchSnapshot(bridge);
  if (!bridge) return null;

  const keyButton = (
    command: Exclude<DuckCommand, "auto-pause" | "pause">,
    className: string = KEY
  ) => (
    <TouchButton
      key={command}
      label={labelOf(command)}
      disabled={paused}
      action={command}
      className={className}
    >
      {labelOf(command)}
    </TouchButton>
  );

  // Resume only when the player paused it; any other pause has no control here.
  const pauseDisabled = paused && !manualPause;
  const pauseLabel = manualPause ? "Resume" : labelOf("pause");
  const pauseButton = (className: string) => (
    <TouchButton
      key="pause"
      label={pauseLabel}
      disabled={pauseDisabled}
      action="pause"
      className={className}
    >
      {pauseLabel}
    </TouchButton>
  );
  const pause = pauseButton(KEY);

  const root = (
    sceneName: string,
    className: string,
    children: React.ReactNode
  ) => (
    <div
      role="group"
      aria-label="Duck controls"
      data-testid="duck-control-dock"
      data-scene={sceneName}
      style={DOCK_PADDING}
      className={`w-full font-mono ${className}`}
    >
      {children}
    </div>
  );

  if (scene === "park") {
    const jump = aiming ? "Throw" : "Jump";
    return root(
      "park",
      "",
      <DockFrame>
        {/* The dim is an inline style, so it holds whatever the stylesheet does. */}
        <div
          data-testid="duck-park-pad"
          className={paused ? "pointer-events-none" : undefined}
          style={paused ? { opacity: 0.4 } : undefined}
        >
          <HoldDpad
            directions={["up", "down"]}
            paused={paused}
            actions={{ up: "steer-up", down: "steer-down" }}
          />
        </div>
        <div className="flex flex-col justify-center gap-2">
          <TouchButton
            label={jump}
            disabled={paused}
            action="space"
            className={KEY}
          >
            {jump}
          </TouchButton>
          {keyButton("treat")}
          {pause}
        </div>
      </DockFrame>
    );
  }

  if (scene === "bath") {
    return root(
      "bath",
      "grid grid-cols-2 gap-2",
      <>
        {keyButton("treat")}
        {pause}
      </>
    );
  }

  return root(
    "office",
    "flex flex-col gap-2",
    <>
      <div className="grid grid-cols-4 gap-2">
        {keyButton("toy-1")}
        {keyButton("toy-2")}
        {keyButton("toy-3")}
        {keyButton("treat")}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {keyButton("trick-sit")}
        {keyButton("trick-high-five")}
        {keyButton("trick-drop-it")}
        {keyButton("trick-spin")}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {keyButton("space", ACTION_KEY)}
        {pauseButton(ACTION_KEY)}
      </div>
    </>
  );
}
