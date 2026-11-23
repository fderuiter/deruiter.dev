import { useId } from "react";
import type {
  StudyDesignGrid,
  StudyDesignGridCell,
} from "@/lib/study-workspace";

/** Drawing units: the figure scales to its container through its viewBox. */
const WIDTH = 960;
const LABEL_WIDTH = 176;
const HEADER_HEIGHT = 56;
const GAP = 8;
const LINE_HEIGHT = 16;
const PADDING = 12;
const CHAR_WIDTH = 7;

/** Splits text into lines that fit a width, breaking at spaces. */
function wrap(text: string, width: number): string[] {
  const max = Math.max(4, Math.floor((width - 2 * PADDING) / CHAR_WIDTH));
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= max) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word.length > max ? `${word.slice(0, max - 1)}…` : word;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

const elementKey = (cell: StudyDesignGridCell) =>
  cell.elements.map((element) => element.id).join("|");

/**
 * An epoch's cells are drawn as one box across every arm when every arm has
 * a cell there holding the same elements, by id: the arms share that part
 * of the study. Nothing is inferred beyond that.
 */
function sharedEpochs(grid: StudyDesignGrid): boolean[] {
  return grid.epochs.map((_, index) => {
    const cells = grid.rows.map((row) => row.cells[index]);
    return (
      cells.length > 1 &&
      cells.every((cell) => cell.cellId !== null && cell.elements.length > 0) &&
      cells.every((cell) => elementKey(cell) === elementKey(cells[0]))
    );
  });
}

function cellText(cell: StudyDesignGridCell): string {
  if (cell.cellId === null) return "No cell";
  if (cell.elements.length === 0) return "No elements";
  return cell.elements.map((element) => element.name).join("; ");
}

/**
 * The trial schema (ICH M11 section 1.2) drawn as SVG from the design grid:
 * epochs left to right, one lane per arm, and the elements in each cell.
 * Where every arm shares an epoch's elements, that epoch is one box across
 * the arms. A text description below lists the same arms, epochs and
 * elements, so the figure has a full text alternative.
 */
export function TrialSchemaFigure({
  grid,
}: {
  readonly grid: StudyDesignGrid;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const { arms, epochs, rows } = grid;
  if (arms.length === 0 || epochs.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        The trial schema appears once the design has at least one arm and one
        epoch.
      </p>
    );
  }

  const columnWidth =
    (WIDTH - LABEL_WIDTH - GAP * epochs.length) / epochs.length;
  const shared = sharedEpochs(grid);
  const rowHeights = rows.map((row) => {
    const lines = Math.max(
      wrap(row.arm.name, LABEL_WIDTH).length,
      ...row.cells.map((cell) => wrap(cellText(cell), columnWidth).length)
    );
    return lines * LINE_HEIGHT + 2 * PADDING;
  });
  const rowTops = rowHeights.map(
    (_, index) =>
      HEADER_HEIGHT +
      rowHeights.slice(0, index).reduce((sum, h) => sum + h + GAP, 0)
  );
  const height =
    HEADER_HEIGHT + rowHeights.reduce((sum, h) => sum + h + GAP, 0);
  const columnX = (index: number) =>
    LABEL_WIDTH + GAP + index * (columnWidth + GAP);

  const textLines = (
    lines: string[],
    x: number,
    top: number,
    boxHeight: number,
    className: string
  ) => {
    const first = top + boxHeight / 2 - ((lines.length - 1) * LINE_HEIGHT) / 2;
    return lines.map((line, index) => (
      <text
        key={index}
        x={x}
        y={first + index * LINE_HEIGHT}
        dominantBaseline="middle"
        className={className}
      >
        {line}
      </text>
    ));
  };

  return (
    <figure className="min-w-0 space-y-4">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="h-auto w-full"
      >
        <title id={titleId}>
          {`Trial schema: ${arms.length} arms across ${epochs.length} epochs`}
        </title>
        {epochs.map((epoch, index) => (
          <g key={epoch.id}>
            {textLines(
              wrap(epoch.name, columnWidth),
              columnX(index) + columnWidth / 2,
              0,
              HEADER_HEIGHT - GAP,
              "fill-[#f4f4f6] text-[13px] font-semibold [text-anchor:middle]"
            )}
          </g>
        ))}
        {rows.map((row, rowIndex) => (
          <g key={row.arm.id}>
            {textLines(
              wrap(row.arm.name, LABEL_WIDTH),
              0,
              rowTops[rowIndex],
              rowHeights[rowIndex],
              "fill-[#f4f4f6] text-[13px] font-semibold"
            )}
            {row.cells.map((cell, index) => {
              if (shared[index]) return null;
              const x = columnX(index);
              const missing = cell.cellId === null;
              return (
                <g key={cell.epochId}>
                  <rect
                    x={x}
                    y={rowTops[rowIndex]}
                    width={columnWidth}
                    height={rowHeights[rowIndex]}
                    rx={6}
                    fill={missing ? "none" : "#13151a"}
                    stroke={missing ? "#f59e0b" : "#94a3b8"}
                    strokeDasharray={missing ? "6 4" : undefined}
                    strokeWidth={1}
                  />
                  {textLines(
                    wrap(cellText(cell), columnWidth),
                    x + columnWidth / 2,
                    rowTops[rowIndex],
                    rowHeights[rowIndex],
                    `text-[12px] [text-anchor:middle] ${
                      missing ? "fill-[#f59e0b]" : "fill-[#f4f4f6]"
                    }`
                  )}
                </g>
              );
            })}
          </g>
        ))}
        {epochs.map((epoch, index) => {
          if (!shared[index]) return null;
          const x = columnX(index);
          const top = rowTops[0];
          const spanHeight = height - GAP - top;
          return (
            <g key={`shared-${epoch.id}`}>
              <rect
                x={x}
                y={top}
                width={columnWidth}
                height={spanHeight}
                rx={6}
                fill="#13151a"
                stroke="#94a3b8"
                strokeWidth={1}
              />
              {textLines(
                wrap(cellText(rows[0].cells[index]), columnWidth),
                x + columnWidth / 2,
                top,
                spanHeight,
                "fill-[#f4f4f6] text-[12px] [text-anchor:middle]"
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-sm text-slate-300">
        Trial schema drawn from the design grid. Epochs run left to right and
        each arm is a lane. A box that spans every arm is an epoch all arms
        share.
      </figcaption>
      <div id={descriptionId} className="text-sm text-slate-300">
        <p className="font-semibold">Text description</p>
        <p className="mt-1">
          Epochs in order: {epochs.map((epoch) => epoch.name).join(", ")}.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {rows.map((row) => (
            <li key={row.arm.id}>
              {row.arm.name}:{" "}
              {row.cells
                .map(
                  (cell, index) =>
                    `${epochs[index].name}, ${cellText(cell)}${
                      shared[index] ? " (shared by all arms)" : ""
                    }`
                )
                .join("; ")}
              .
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
