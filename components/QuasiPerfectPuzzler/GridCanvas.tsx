"use client";

import React, { useState } from "react";
import { IconGridDots } from "@tabler/icons-react";

export interface GridTile {
  id: string;
  row: number;
  col: number;
  label?: string;
  value?: string | number;
  type?:
    | "goal"
    | "hypothesis"
    | "rule"
    | "empty"
    | "operator"
    | "variable"
    | "default";
  isSelected?: boolean;
  isDisabled?: boolean;
  status?: "active" | "completed" | "default" | "error";
  metadata?: Record<string, unknown>;
}

interface GridCanvasProps {
  tiles?: GridTile[];
  rows?: number;
  cols?: number;
  selectedTileId?: string | null;
  onTileClick?: (tile: GridTile) => void;
  isInteractive?: boolean;
  className?: string;
  ariaLabel?: string;
}

export const GridCanvas: React.FC<GridCanvasProps> = ({
  tiles,
  rows = 4,
  cols = 4,
  selectedTileId: controlledSelectedTileId,
  onTileClick,
  isInteractive = true,
  className = "",
  ariaLabel = "Quasi-Perfect Puzzler Grid Canvas",
}) => {
  const [internalSelectedTileId, setInternalSelectedTileId] = useState<
    string | null
  >(null);

  const activeSelectedId =
    controlledSelectedTileId !== undefined
      ? controlledSelectedTileId
      : internalSelectedTileId;

  // Generate grid tiles if not provided explicitly
  const effectiveTiles: GridTile[] = React.useMemo(() => {
    if (tiles && tiles.length > 0) {
      return tiles;
    }

    const generated: GridTile[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = `tile-${r}-${c}`;
        generated.push({
          id,
          row: r,
          col: c,
          label: `(${r},${c})`,
          value: r * cols + c + 1,
          type: r === 0 && c === 0 ? "goal" : "default",
          isSelected: activeSelectedId === id,
        });
      }
    }
    return generated;
  }, [tiles, rows, cols, activeSelectedId]);

  const handleTileClick = (tile: GridTile) => {
    if (!isInteractive || tile.isDisabled) return;
    if (controlledSelectedTileId === undefined) {
      setInternalSelectedTileId(tile.id);
    }
    onTileClick?.(tile);
  };

  const getTileStyling = (tile: GridTile) => {
    const isSelected = activeSelectedId === tile.id || tile.isSelected;
    if (tile.isDisabled) {
      return "border-zinc-800 bg-zinc-900/40 text-zinc-600 cursor-not-allowed opacity-50";
    }

    if (isSelected) {
      return "border-[color:var(--qp-accent-line)] bg-[color:var(--qp-accent-soft)] qp-text-accent-strong ring-2 ring-[color:var(--qp-accent)]";
    }

    switch (tile.status) {
      case "active":
        return "border-[color:var(--qp-accent-line)] bg-[color:var(--qp-accent-soft)] qp-text-accent-strong hover:border-[color:var(--qp-accent-line)]";
      case "completed":
        return "border-emerald-500/60 bg-emerald-950/40 text-emerald-300 hover:border-emerald-400";
      case "error":
        return "border-rose-500/60 bg-rose-950/40 text-rose-300 hover:border-rose-400";
      default:
        switch (tile.type) {
          case "goal":
            return "border-[color:var(--qp-accent-line)] bg-[color:var(--qp-accent-soft)] qp-text-accent-strong hover:border-[color:var(--qp-accent-line)]";
          case "hypothesis":
            return "border-slate-500/50 bg-slate-950/30 text-slate-300 hover:border-slate-400";
          case "operator":
            return "border-amber-500/50 bg-amber-950/30 text-amber-300 hover:border-amber-400";
          default:
            return "border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900/80";
        }
    }
  };

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className={`w-full flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/90 p-4 font-mono select-none ${className}`}
    >
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
        <div className="flex items-center gap-2">
          <IconGridDots className="w-4 h-4 qp-text-accent-strong" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Grid Canvas Control
          </span>
        </div>
        <span className="text-[10px] text-zinc-400">
          {rows}×{cols} Grid ({effectiveTiles.length} tiles)
        </span>
      </div>

      <div
        className="grid gap-2 w-full"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        }}
      >
        {effectiveTiles.map((tile) => {
          const isSelected = activeSelectedId === tile.id || tile.isSelected;
          return (
            <button
              type="button"
              key={tile.id}
              data-tile-id={tile.id}
              data-testid="grid-tile"
              data-row={tile.row}
              data-col={tile.col}
              data-selected={isSelected ? "true" : "false"}
              data-disabled={tile.isDisabled ? "true" : "false"}
              disabled={tile.isDisabled}
              onClick={() => handleTileClick(tile)}
              aria-label={`Tile ${tile.label || tile.id} at row ${tile.row + 1}, column ${tile.col + 1}${
                isSelected ? ", selected" : ""
              }`}
              className={`flex min-w-0 flex-col items-center justify-center min-h-[52px] rounded-xl border p-2 text-xs font-mono transition-all cursor-pointer active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[color:var(--qp-accent)] ${getTileStyling(
                tile
              )}`}
            >
              <span className="min-w-0 max-w-full break-words font-bold text-sm">
                {tile.label || tile.id}
              </span>
              {tile.value !== undefined && (
                <span className="min-w-0 max-w-full break-words text-[10px] opacity-70">
                  {tile.value}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

GridCanvas.displayName = "GridCanvas";
