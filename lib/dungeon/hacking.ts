/**
 * Cybersecurity Hex Matrix Buffer & Sequence Bypass Minigame Engine
 */

import { clamp } from "../game-utils";
import { HexCell, HexMatrixPuzzle } from "./types";

const HEX_BYTE_POOL = [
  "1C",
  "E9",
  "7A",
  "BD",
  "55",
  "FF",
  "A3",
  "4D",
  "3B",
  "C2",
];

/**
 * Generates a procedurally solvable Hex Matrix Buffer bypass puzzle.
 * Uses alternating row/column constraint rules inspired by cybernetic hacking matrices.
 */
export function generateHexMatrixPuzzle(
  difficulty: number = 1
): HexMatrixPuzzle {
  const size = difficulty > 2 ? 5 : 4;
  const grid: HexCell[][] = [];

  for (let r = 0; r < size; r++) {
    const row: HexCell[] = [];
    for (let c = 0; c < size; c++) {
      const randomByte =
        HEX_BYTE_POOL[Math.floor(Math.random() * HEX_BYTE_POOL.length)];
      row.push({
        row: r,
        col: c,
        byte: randomByte,
        selected: false,
      });
    }
    grid.push(row);
  }

  // Construct a guaranteed solvable target sequence
  const sequenceLength = clamp(difficulty + 1, 2, 4);
  const targetSequence: string[] = [];

  // Walk the same row/column alternation the player must follow, never
  // revisiting a cell: selectHexCell rejects a reused cell, so a target that
  // needed one twice could not be entered (#1943).
  const used = new Set<string>();
  let curRow = 0;
  let curCol = 0;
  let isRowMove = true;

  const pickUnused = (
    candidates: Array<[number, number]>
  ): [number, number] => {
    const open = candidates.filter(([r, c]) => !used.has(`${r},${c}`));
    return open[Math.floor(Math.random() * open.length)];
  };

  for (let i = 0; i < sequenceLength; i++) {
    const line: Array<[number, number]> = Array.from(
      { length: size },
      (_, k) => (isRowMove ? [curRow, k] : [k, curCol])
    );
    [curRow, curCol] = pickUnused(line);
    used.add(`${curRow},${curCol}`);
    targetSequence.push(grid[curRow][curCol].byte);
    isRowMove = !isRowMove;
  }

  const maxBufferSize = sequenceLength + 2;
  const timeLimit = Math.max(12, 25 - difficulty * 3);

  return {
    grid,
    targetSequence,
    currentInput: [],
    maxBufferSize,
    timeRemainingSeconds: timeLimit,
    activeAxis: "row",
    activeIndex: 0,
    solved: false,
    failed: false,
    rewardCrypto: 150 * difficulty + 100,
    rewardBypassChips: difficulty >= 3 ? 1 : 0,
  };
}

/**
 * Checks if target sequence exists as a continuous subsequence in the current buffer.
 */
export function isSequenceMatched(buffer: string[], target: string[]): boolean {
  if (target.length === 0) return true;
  if (buffer.length < target.length) return false;

  for (let i = 0; i <= buffer.length - target.length; i++) {
    let match = true;
    for (let j = 0; j < target.length; j++) {
      if (buffer[i + j] !== target[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

/**
 * Selects a hex matrix cell and processes the next step in the bypass sequence.
 */
export function selectHexCell(
  puzzle: HexMatrixPuzzle,
  row: number,
  col: number
): {
  puzzle: HexMatrixPuzzle;
  message: string;
  soundType: "click" | "match" | "fail";
} {
  if (puzzle.solved || puzzle.failed) {
    return { puzzle, message: "Puzzle already finished", soundType: "click" };
  }

  // Validate active row/col constraint
  if (puzzle.activeAxis === "row" && row !== puzzle.activeIndex) {
    return {
      puzzle,
      message: `Must select from Row ${puzzle.activeIndex + 1}`,
      soundType: "fail",
    };
  }
  if (puzzle.activeAxis === "col" && col !== puzzle.activeIndex) {
    return {
      puzzle,
      message: `Must select from Column ${puzzle.activeIndex + 1}`,
      soundType: "fail",
    };
  }

  const cell = puzzle.grid[row]?.[col];
  if (!cell || cell.selected) {
    return { puzzle, message: "Cell already utilized", soundType: "fail" };
  }

  // Clone grid and mark cell selected
  const newGrid = puzzle.grid.map((r, rIdx) =>
    r.map((c, cIdx) =>
      rIdx === row && cIdx === col ? { ...c, selected: true } : { ...c }
    )
  );

  const newInput = [...puzzle.currentInput, cell.byte];
  const matched = isSequenceMatched(newInput, puzzle.targetSequence);

  if (matched) {
    return {
      puzzle: {
        ...puzzle,
        grid: newGrid,
        currentInput: newInput,
        solved: true,
        failed: false,
      },
      message: `BYPASS VERIFIED! Decrypted +${puzzle.rewardCrypto} Crypto!`,
      soundType: "match",
    };
  }

  if (newInput.length >= puzzle.maxBufferSize) {
    return {
      puzzle: {
        ...puzzle,
        grid: newGrid,
        currentInput: newInput,
        failed: true,
      },
      message: "BUFFER OVERFLOW! Encryption lock triggered.",
      soundType: "fail",
    };
  }

  // Alternate axis for next selection
  const nextAxis = puzzle.activeAxis === "row" ? "col" : "row";
  const nextIndex = puzzle.activeAxis === "row" ? col : row;

  return {
    puzzle: {
      ...puzzle,
      grid: newGrid,
      currentInput: newInput,
      activeAxis: nextAxis,
      activeIndex: nextIndex,
    },
    message: `Injected byte [${cell.byte}]. Buffer: ${newInput.join(" ")}`,
    soundType: "click",
  };
}

/**
 * Instantly solves the puzzle using a hardware bypass chip.
 */
export function consumeBypassChip(puzzle: HexMatrixPuzzle): HexMatrixPuzzle {
  return {
    ...puzzle,
    solved: true,
    failed: false,
    currentInput: [...puzzle.targetSequence],
  };
}
