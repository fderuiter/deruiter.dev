"use client";

import React from "react";
import { DockFrame, HoldDpad, TouchButton } from "@/components/arcade/mobile";
import {
  useDuckTouchBridge,
  useDuckTouchSnapshot,
  type DuckCommand,
} from "@/components/working-with-duck/touch-bridge";

/** Every key is at least 48px tall, so a fingertip lands on it. */
const KEY =
  "h-12 min-w-12 rounded-xl border border-zinc-700 bg-zinc-800/90 px-2 font-mono text-xs font-bold text-zinc-100 active:scale-[0.98] active:bg-amber-500/30 disabled:opacity-40 focus-visible:ring-cyan-400";

/**
 * The touch cabinet's control dock for Working With Duck. Each button runs the
 * same command its key runs, so a tap and a key cannot disagree. Only the
 * controls that do something in the current scene are drawn: the office has
 * toys, tricks and the work sprint; the park has the steer pad and jump; the
 * bathtub has the treat. Pause is always there. While the sprint is paused
 * every other control is disabled, as the keys are.
 *
 * It is passed to PlayCabinet only on a touch device, so a desktop cabinet
 * keeps its markup.
 *
 * @returns The dock, or null outside a cabinet bridge.
 */
export function DuckControlDock() {
  const bridge = useDuckTouchBridge();
  const { scene, aiming, paused } = useDuckTouchSnapshot(bridge);
  if (!bridge) return null;

  const run = (command: DuckCommand) => bridge.run(command);

  const keyButton = (label: string, command: DuckCommand) => (
    <TouchButton
      key={command}
      label={label}
      disabled={paused}
      onPress={() => run(command)}
      className={KEY}
    >
      {label}
    </TouchButton>
  );

  const pause = (
    <TouchButton
      key="pause"
      label={paused ? "Resume" : "Pause"}
      onPress={() => run("pause")}
      className={KEY}
    >
      {paused ? "Resume" : "Pause"}
    </TouchButton>
  );

  if (scene === "park") {
    const jump = aiming ? "Throw" : "Jump";
    return (
      <div
        data-testid="duck-control-dock"
        data-scene="park"
        className="w-full font-mono"
      >
        <DockFrame>
          <HoldDpad
            directions={["up", "down"]}
            paused={paused}
            large
            onMove={(direction) => {
              if (direction === "up") run("steer-up");
              else if (direction === "down") run("steer-down");
            }}
          />
          <div className="flex flex-col justify-center gap-2">
            <TouchButton
              label={jump}
              disabled={paused}
              onPress={() => run("space")}
              className={KEY}
            >
              {jump}
            </TouchButton>
            {keyButton("Treat", "treat")}
            {pause}
          </div>
        </DockFrame>
      </div>
    );
  }

  if (scene === "bath") {
    return (
      <div
        data-testid="duck-control-dock"
        data-scene="bath"
        className="grid w-full grid-cols-2 gap-2 font-mono"
      >
        {keyButton("Treat", "treat")}
        {pause}
      </div>
    );
  }

  return (
    <div
      data-testid="duck-control-dock"
      data-scene="office"
      className="flex w-full flex-col gap-2 font-mono"
    >
      <div className="grid grid-cols-4 gap-2">
        {keyButton("Tennis ball", "toy-1")}
        {keyButton("Kong", "toy-2")}
        {keyButton("Squeaky toy", "toy-3")}
        {keyButton("Treat", "treat")}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {keyButton("Sit", "trick-sit")}
        {keyButton("High Five", "trick-high-five")}
        {keyButton("Drop It", "trick-drop-it")}
        {keyButton("Spin", "trick-spin")}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {keyButton("Work Sprint", "space")}
        {pause}
      </div>
    </div>
  );
}
