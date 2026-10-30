import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useRovingGrid } from "@/components/study-data/useRovingGrid";

/**
 * Roving focus for the study-data grids (#3483). Arrow keys stop at the
 * edges, as the ARIA grid pattern asks, rather than wrapping; Home and End
 * go to the ends of the row, and with Ctrl to the ends of the grid.
 */

afterEach(cleanup);

/**
 * Three full rows of three cells, then a spanning row with one cell, then
 * eleven more rows so PageDown has room.
 */
function Grid({ onActivate }: { onActivate?: (label: string) => void }) {
  const { onKeyDown, cellProps } = useRovingGrid();
  const rows: string[][] = [
    ["a1", "a2", "a3"],
    ["b1", "b2", "b3"],
    ["c1", "c2", "c3"],
    ["span"],
    ...Array.from({ length: 11 }, (_, i) => [`r${i}`, `s${i}`, `t${i}`]),
  ];
  return (
    <table role="grid" onKeyDown={onKeyDown}>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((label, c) => (
              <td
                key={label}
                {...cellProps(r, c)}
                onClick={() => onActivate?.(label)}
              >
                {label}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function cell(label: string): HTMLElement {
  return screen.getByText(label);
}

function press(label: string, key: string, init: object = {}) {
  fireEvent.keyDown(cell(label), { key, ...init });
}

describe("useRovingGrid", () => {
  it("puts only the first cell in the tab order", () => {
    render(<Grid />);
    expect(cell("a1").getAttribute("tabindex")).toBe("0");
    expect(cell("a2").getAttribute("tabindex")).toBe("-1");
  });

  it("moves with the arrow keys and moves the tab stop with focus", () => {
    render(<Grid />);
    press("a1", "ArrowRight");
    expect(document.activeElement).toBe(cell("a2"));
    expect(cell("a2").getAttribute("tabindex")).toBe("0");
    expect(cell("a1").getAttribute("tabindex")).toBe("-1");
    press("a2", "ArrowDown");
    expect(document.activeElement).toBe(cell("b2"));
    press("b2", "ArrowLeft");
    expect(document.activeElement).toBe(cell("b1"));
    press("b1", "ArrowUp");
    expect(document.activeElement).toBe(cell("a1"));
  });

  it("stops at the last column and the first row instead of wrapping", () => {
    render(<Grid />);
    press("a3", "ArrowRight");
    expect(document.activeElement).toBe(cell("a3"));
    press("a1", "ArrowLeft");
    expect(document.activeElement).toBe(cell("a1"));
    press("a2", "ArrowUp");
    expect(document.activeElement).toBe(cell("a2"));
  });

  it("jumps to the first and last cell of the row with Home and End", () => {
    render(<Grid />);
    press("b2", "End");
    expect(document.activeElement).toBe(cell("b3"));
    press("b3", "Home");
    expect(document.activeElement).toBe(cell("b1"));
  });

  it("jumps to the first and last cell of the grid with Ctrl+Home and Ctrl+End", () => {
    render(<Grid />);
    press("b2", "End", { ctrlKey: true });
    expect(document.activeElement).toBe(cell("t10"));
    press("t10", "Home", { ctrlKey: true });
    expect(document.activeElement).toBe(cell("a1"));
  });

  it("lands on the nearest cell to the left in a row with fewer cells", () => {
    render(<Grid />);
    press("c3", "ArrowDown");
    expect(document.activeElement).toBe(cell("span"));
  });

  it("moves ten rows with PageDown and PageUp, stopping at the edges", () => {
    render(<Grid />);
    press("a1", "PageDown");
    expect(document.activeElement).toBe(cell("r6"));
    press("r6", "PageDown");
    expect(document.activeElement).toBe(cell("r10"));
    press("r10", "PageUp");
    expect(document.activeElement).toBe(cell("r0"));
    press("b1", "PageUp");
    expect(document.activeElement).toBe(cell("a1"));
  });

  it("activates a cell with Enter or Space", () => {
    const onActivate = vi.fn();
    render(<Grid onActivate={onActivate} />);
    press("b2", "Enter");
    press("c3", " ");
    expect(onActivate.mock.calls).toEqual([["b2"], ["c3"]]);
  });

  it("ignores other keys and keys from outside a cell", () => {
    render(<Grid />);
    press("a1", "x");
    expect(document.activeElement).not.toBe(cell("a1"));
    fireEvent.keyDown(screen.getByRole("grid"), { key: "ArrowRight" });
    expect(document.activeElement).not.toBe(cell("a2"));
  });
});
