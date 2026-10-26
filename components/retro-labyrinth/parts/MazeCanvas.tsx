"use client";

import React, {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { clamp } from "@/lib/game-utils";
import type { StageFit } from "@/lib/arcade";
import { useStageFit } from "@/components/arcade/stage";
import { useContextLossPause } from "@/components/arcade/pause";
import {
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
} from "@/components/retro-labyrinth/labyrinth-art";
import type { LabyrinthPainter } from "@/components/retro-labyrinth/useRetroLabyrinthSession";
import { createFogCache, paintMaze } from "./paint-maze";

/** The maze's logical size, which the stage fit keeps the shape of. */
const MAZE_ASPECT = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT } as const;
/**
 * By default the maze follows the device's pixel ratio with no cap. Its pixel
 * art is stamped nearest-neighbour, so at an integer scale a backing store
 * capped below a 3x screen would be stretched by 1.5 and draw uneven pixels.
 */
const MAZE_MAX_DPR = Number.POSITIVE_INFINITY;

/** Props for {@link MazeCanvas}. */
interface MazeCanvasProps {
  /** The session's painter hook. */
  readonly onFrame: (paint: LabyrinthPainter) => () => void;
  /**
   * `integer` keeps a whole number of device pixels per art pixel, so the
   * desktop stays crisp at any devicePixelRatio (#1522); `fractional` fills
   * the touch cabinet's slot with the largest 5:3 box (#2358).
   */
  readonly scale: "integer" | "fractional";
  /**
   * The highest device pixel ratio the backing store follows. The phone caps
   * it at 2 (#2918): its fractional scale is uneven at any ratio, and a 3x
   * store costs more than twice the fill for no sharper art.
   */
  readonly maxDpr?: number;
  /** The room's size in cells, for mapping the pointer to a cell. */
  readonly grid: { readonly cols: number; readonly rows: number };
  /** The cell under the pointer, or null when it leaves the maze. */
  readonly onPointAt: (cell: { x: number; y: number } | null) => void;
  readonly onPointerDown?: (
    event: React.PointerEvent<HTMLCanvasElement>
  ) => void;
  readonly onPointerUp?: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  readonly onPointerCancel?: () => void;
  /** The frame's layout classes, which the view decides. */
  readonly frameClassName: string;
  readonly frameStyle?: CSSProperties;
  /** Classes for the canvas before the frame has a size. */
  readonly unfittedClassName: string;
  /** Classes for the canvas in every state. */
  readonly canvasClassName: string;
  readonly ariaLabel: string;
  /** What sits over the maze, given the board's fitted box. */
  readonly children?: (fit: StageFit | null) => ReactNode;
}

/**
 * The maze canvas (#2376): the stage fit, the canvas, and a painter on the
 * session's frame. The view places it and decides its frame's layout; what
 * sits over the board (cards, strips, toasts) is passed as children. A lost
 * canvas context pauses the cabinet, and the room waits for Resume (#2357).
 */
export function MazeCanvas({
  onFrame,
  scale,
  maxDpr = MAZE_MAX_DPR,
  grid,
  onPointAt,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  frameClassName,
  frameStyle,
  unfittedClassName,
  canvasClassName,
  ariaLabel,
  children,
}: MazeCanvasProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const { fit, toGame } = useStageFit(frameRef, {
    aspect: MAZE_ASPECT,
    scale,
    maxDpr,
  });
  useContextLossPause(canvas);

  useEffect(() => {
    if (!canvas) return;
    const fog = createFogCache();
    return onFrame((frame) => paintMaze(canvas, frame, fog));
  }, [canvas, onFrame]);

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const point = toGame(
      event.clientX,
      event.clientY,
      event.currentTarget.getBoundingClientRect()
    );
    if (!point) return;
    const x = clamp(
      Math.floor(point.x / (LOGICAL_WIDTH / grid.cols)),
      0,
      grid.cols - 1
    );
    const y = clamp(
      Math.floor(point.y / (LOGICAL_HEIGHT / grid.rows)),
      0,
      grid.rows - 1
    );
    onPointAt({ x, y });
  };

  return (
    <div ref={frameRef} className={frameClassName} style={frameStyle}>
      <canvas
        ref={setCanvas}
        width={fit?.backingWidth ?? LOGICAL_WIDTH}
        height={fit?.backingHeight ?? LOGICAL_HEIGHT}
        style={
          fit
            ? {
                width: `${fit.cssWidth}px`,
                height: `${fit.cssHeight}px`,
              }
            : undefined
        }
        data-pixel-scale={fit?.scale ?? 1}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => onPointAt(null)}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        role="application"
        aria-label={ariaLabel}
        tabIndex={0}
        className={`block ${fit ? "shrink-0" : unfittedClassName} ${canvasClassName}`}
      />
      {children?.(fit)}
    </div>
  );
}
