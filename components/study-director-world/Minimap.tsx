"use client";

import React, { useEffect, useRef } from "react";
import {
  roomAt,
  tileAt,
  type PersonPlacement,
  type PlayerState,
  type WorldMap,
} from "@/lib/study-director-world";
import type { View } from "./camera";
import { PALETTE, ROOM_FLOORS } from "./world-art";

/** Canvas pixels per tile on the minimap. */
const CELL = 3;

/**
 * A small map of the whole floor in the corner of the stage: rooms, doors,
 * where the people are, where you are and which part the camera shows. It is
 * a picture for sighted players; the directory and the canvas description
 * carry the same facts as text.
 */
export const Minimap: React.FC<{
  map: WorldMap;
  player: PlayerState;
  people: readonly PersonPlacement[];
  view: View;
}> = ({ map, player, people, view }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0d0e11";
    ctx.fillRect(0, 0, map.width * CELL, map.height * CELL);
    for (let y = 0; y < map.height; y++)
      for (let x = 0; x < map.width; x++) {
        const kind = tileAt(map, x, y);
        if (kind === "wall") continue;
        const room = roomAt(map, x, y);
        ctx.fillStyle =
          kind === "door"
            ? PALETTE.amberDim
            : room
              ? (ROOM_FLOORS[room.id]?.alt ?? "#2b2f3a")
              : "#2b2f3a";
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    ctx.fillStyle = PALETTE.paper;
    for (const p of people) ctx.fillRect(p.x * CELL, p.y * CELL, CELL, CELL);
    ctx.fillStyle = PALETTE.amber;
    ctx.fillRect(player.x * CELL - 1, player.y * CELL - 1, CELL + 2, CELL + 2);
    ctx.strokeStyle = "rgba(244, 244, 246, 0.7)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      view.x * CELL + 0.5,
      view.y * CELL + 0.5,
      view.w * CELL - 1,
      view.h * CELL - 1
    );
  }, [map, player, people, view]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      data-testid="world-minimap"
      width={map.width * CELL}
      height={map.height * CELL}
      className="absolute top-2 right-2 border border-[var(--sd-hairline-strong)] bg-[var(--sd-bg)]"
      style={{
        width: "26%",
        maxWidth: map.width * CELL * 2,
        height: "auto",
        imageRendering: "pixelated",
      }}
    />
  );
};
