// Retro Labyrinth playtest fixes (#1943): engine-level findings.
import { describe, it, expect } from "vitest";
import {
  armBossForRoomEntry,
  BOSS_OPENING_GRACE_MS,
  createFaceForgeBoss,
  updateFaceForgeBoss,
  generateHexMatrixPuzzle,
  selectHexCell,
  type HexMatrixPuzzle,
} from "@/lib/dungeon";

// Depth-first search over every legal click sequence, using the real
// selectHexCell so the solver follows exactly the rules the player does.
function isSolvable(puzzle: HexMatrixPuzzle): boolean {
  if (puzzle.solved) return true;
  if (puzzle.failed) return false;
  const size = puzzle.grid.length;
  for (let k = 0; k < size; k++) {
    const row = puzzle.activeAxis === "row" ? puzzle.activeIndex : k;
    const col = puzzle.activeAxis === "row" ? k : puzzle.activeIndex;
    const next = selectHexCell(puzzle, row, col);
    if (next.puzzle === puzzle) continue;
    if (isSolvable(next.puzzle)) return true;
  }
  return false;
}

describe("Retro Labyrinth hex terminal (#1943 S1)", () => {
  it("generates only puzzles that can be solved, at every difficulty", () => {
    for (let difficulty = 1; difficulty <= 5; difficulty++) {
      for (let i = 0; i < 400; i++) {
        const puzzle = generateHexMatrixPuzzle(difficulty);
        expect(isSolvable(puzzle)).toBe(true);
      }
    }
  });
});

describe("Retro Labyrinth FaceForge opening and cover (#1943 S5)", () => {
  it("holds fire for the opening grace period after the room loads", () => {
    const boss = armBossForRoomEntry(createFaceForgeBoss(7, 4), 10_000);
    const early = updateFaceForgeBoss(boss, 1, 1, 10_000 + 100, 15, 9);
    expect(early.updatedBoss.projectiles).toHaveLength(0);
    expect(early.updatedBoss.phaseTitle).toMatch(/BOOTING/);

    const later = updateFaceForgeBoss(
      early.updatedBoss,
      1,
      1,
      10_000 + BOSS_OPENING_GRACE_MS,
      15,
      9
    );
    expect(later.updatedBoss.projectiles.length).toBeGreaterThan(0);
  });

  it("stops projectiles at walls", () => {
    const base = createFaceForgeBoss(7, 4);
    const boss = {
      ...base,
      // A salvo was just fired, so this update only moves the shot.
      lastSalvoTime: 1_000_000,
      projectiles: [
        {
          id: "shot",
          x: 4.05,
          y: 1,
          vx: -0.1,
          vy: 0,
          damage: 15,
          alive: true,
          mesh: base.mesh,
        },
      ],
    };
    const tenFrames = (1000 / 60) * 10;
    // One tile left of the shot is a wall at column 3; the player stands
    // behind it at column 1.
    const wallAt3 = (col: number, row: number) => col === 3 && row === 1;
    const open = updateFaceForgeBoss(
      boss,
      1,
      1,
      1_000_001,
      15,
      9,
      undefined,
      tenFrames
    );
    const covered = updateFaceForgeBoss(
      boss,
      1,
      1,
      1_000_001,
      15,
      9,
      undefined,
      tenFrames,
      wallAt3
    );
    expect(open.updatedBoss.projectiles).toHaveLength(1);
    expect(covered.updatedBoss.projectiles).toHaveLength(0);
    expect(covered.spawnedDamage).toBe(0);
  });

  it("makes every third phase-1 salvo a ring of eight", () => {
    let boss = createFaceForgeBoss(7, 4);
    const volleySizes: number[] = [];
    for (let i = 1; i <= 3; i++) {
      boss = updateFaceForgeBoss(
        { ...boss, projectiles: [] },
        1,
        1,
        i * 5000,
        15,
        9,
        undefined,
        0
      ).updatedBoss;
      volleySizes.push(boss.projectiles.length);
    }
    expect(volleySizes).toEqual([3, 3, 8]);
  });
});
