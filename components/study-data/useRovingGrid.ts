"use client";

import { useCallback, useState, type KeyboardEvent } from "react";

/** A cell position in a grid: row and column, both from 0. */
interface GridPosition {
  readonly r: number;
  readonly c: number;
}

function cellAt(grid: HTMLElement, r: number, c: number): HTMLElement | null {
  for (let column = c; column >= 0; column -= 1) {
    const cell = grid.querySelector<HTMLElement>(
      `[data-r="${r}"][data-c="${column}"]`
    );
    if (cell) return cell;
  }
  return null;
}

function bounds(grid: HTMLElement): { rows: number; cols: number } {
  let rows = 0;
  let cols = 0;
  grid.querySelectorAll<HTMLElement>("[data-r]").forEach((cell) => {
    rows = Math.max(rows, Number(cell.dataset.r) + 1);
    cols = Math.max(cols, Number(cell.dataset.c) + 1);
  });
  return { rows, cols };
}

/**
 * Roving focus for a table rendered in full, following the ARIA grid
 * pattern: one cell is in the tab order, arrow keys move between cells,
 * Home and End go to the ends of the row (with Ctrl, of the grid), and
 * Enter or Space activates the cell by clicking it. Cells carry `data-r`
 * and `data-c`; spanning rows simply have fewer cells.
 */
export function useRovingGrid() {
  const [active, setActive] = useState<GridPosition>({ r: 0, c: 0 });

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.dataset.r === undefined) return;
    const grid = event.currentTarget;
    const r = Number(target.dataset.r);
    const c = Number(target.dataset.c);
    const { rows, cols } = bounds(grid);
    let next: GridPosition | null = null;
    switch (event.key) {
      case "ArrowRight":
        next = { r, c: Math.min(cols - 1, c + 1) };
        break;
      case "ArrowLeft":
        next = { r, c: Math.max(0, c - 1) };
        break;
      case "ArrowDown":
        next = { r: Math.min(rows - 1, r + 1), c };
        break;
      case "ArrowUp":
        next = { r: Math.max(0, r - 1), c };
        break;
      case "Home":
        next = event.ctrlKey ? { r: 0, c: 0 } : { r, c: 0 };
        break;
      case "End":
        next = event.ctrlKey
          ? { r: rows - 1, c: cols - 1 }
          : { r, c: cols - 1 };
        break;
      case "PageDown":
        next = { r: Math.min(rows - 1, r + 10), c };
        break;
      case "PageUp":
        next = { r: Math.max(0, r - 10), c };
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        target.click();
        return;
      default:
        return;
    }
    event.preventDefault();
    const cell = cellAt(grid, next.r, next.c);
    if (!cell) return;
    setActive({ r: Number(cell.dataset.r), c: Number(cell.dataset.c) });
    cell.focus();
  }, []);

  /** Props for one cell: its position, tab stop and focus tracking. */
  const cellProps = useCallback(
    (r: number, c: number) => ({
      "data-r": r,
      "data-c": c,
      tabIndex: active.r === r && active.c === c ? 0 : -1,
      onFocus: () => setActive({ r, c }),
    }),
    [active]
  );

  return { onKeyDown, cellProps };
}
