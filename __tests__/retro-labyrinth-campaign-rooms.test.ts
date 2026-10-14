// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  DEFAULT_CYBERDECK_PROFILE,
  ENEMY_STEP_INTERVAL_MS,
  updateEnemyAI,
  generateHexMatrixPuzzle,
  generateRoguelikeCampaign,
  getExitLockState,
  recordCyberdeckRoomResult,
  selectHexCell,
  type DungeonRoom,
  type HexMatrixPuzzle,
} from "@/lib/dungeon";
import {
  replayTspMoves,
  solveTspRoom,
  tspIsWon,
} from "@/components/retro-labyrinth/room-solver";

// #2048: the campaign is seven rooms, opening on the DMZ Gateway and ending on
// the Neural Warden, and every room has to work with the systems around it.

const campaign = generateRoguelikeCampaign();

/** The room with its terminals and chests walled off: they are optional. */
function withoutStops(room: DungeonRoom): DungeonRoom {
  return {
    ...room,
    grid: room.grid.map((row) =>
      row.map((cell) => (cell === "H" || cell === "T" ? "#" : cell))
    ),
  };
}

function isOpen(room: DungeonRoom, x: number, y: number): boolean {
  const cell = room.grid[y]?.[x];
  return cell !== undefined && cell !== "#" && cell !== "W";
}

/**
 * Whether a hex puzzle can be solved by row/column picks alone, searched
 * exhaustively within its buffer.
 */
function hexSolvable(puzzle: HexMatrixPuzzle): boolean {
  if (puzzle.solved) return true;
  if (puzzle.failed) return false;
  const size = puzzle.grid.length;
  for (let k = 0; k < size; k++) {
    const row = puzzle.activeAxis === "row" ? puzzle.activeIndex : k;
    const col = puzzle.activeAxis === "row" ? k : puzzle.activeIndex;
    if (puzzle.grid[row][col].selected) continue;
    if (hexSolvable(selectHexCell(puzzle, row, col).puzzle)) return true;
  }
  return false;
}

describe("Retro Labyrinth seven-room campaign (#2048)", () => {
  it("plays the rooms in ramp order, numbered by position", () => {
    expect(campaign.map((room) => room.id)).toEqual([
      "dmz_gateway",
      "active_directory",
      "blinkbrowse",
      "tsp",
      "billable_hours",
      "faceforge",
      "neural_warden",
    ]);
    expect(campaign.map((room) => room.index)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(campaign.map((room) => room.id)).size).toBe(7);
  });

  it("keeps the TSP room out of slot 1 and opens on an unlocked exit", () => {
    expect(campaign[0].id).not.toBe("tsp");
    const first = getExitLockState(campaign[0].boss, campaign[0].tspNodes);
    expect(first.locked).toBe(false);
    expect(campaign[0].boss).toBeUndefined();
    expect(campaign[0].tspMovingWalls ?? []).toHaveLength(0);
  });

  it("ends on the Neural Warden after the FaceForge boss", () => {
    const last = campaign[campaign.length - 1];
    expect(last.id).toBe("neural_warden");
    expect(last.boss?.name).toContain("NEURAL_WARDEN");
    expect(getExitLockState(last.boss, last.tspNodes).objective).toBe(
      "DEFEAT THE BOSS"
    );
    const bosses = campaign.filter((room) => room.boss).map((room) => room.id);
    expect(bosses).toEqual(["faceforge", "neural_warden"]);
  });

  it("restocks at the Darknet market before the first boss", () => {
    const vendors = campaign
      .map((room, i) => ({ room, i }))
      .filter(({ room }) => room.darknetVendor);
    expect(vendors.map(({ room }) => room.id)).toEqual(["billable_hours"]);
    const firstBoss = campaign.findIndex((room) => room.boss);
    expect(vendors[0].i).toBeLessThan(firstBoss);
  });

  // The solver walks every room move by move with the game's own patrol AI and
  // moving walls, refusing any move a patrol touches. Terminals and chests are
  // walled off, so the exit is reachable without them. Boss rooms are walked
  // as they stand once the boss is down, which is when their exit opens.
  it.each(campaign.map((room, i) => [i + 1, room.id, room] as const))(
    "room %i (%s) has a clearing route",
    (_position, _id, room) => {
      const walk = withoutStops(room);
      const moves = solveTspRoom(walk);
      expect(moves, room.id).not.toBeNull();
      const end = replayTspMoves(walk, moves!);
      expect(end).not.toBeNull();
      expect(tspIsWon(walk, end!)).toBe(true);
    }
  );

  it("starts every room on open floor, with enemies and pickups on open tiles", () => {
    for (const room of campaign) {
      expect(isOpen(room, room.startX, room.startY), room.id).toBe(true);
      expect(room.grid[room.exitY][room.exitX], room.id).toBe("E");
      for (const enemy of room.enemies) {
        expect(isOpen(room, enemy.x, enemy.y), `${room.id} ${enemy.id}`).toBe(
          true
        );
        expect(
          enemy.x === room.startX && enemy.y === room.startY,
          `${room.id} ${enemy.id} on the spawn`
        ).toBe(false);
      }
      for (const item of room.items) {
        expect(isOpen(room, item.x, item.y), `${room.id} ${item.id}`).toBe(
          true
        );
      }
    }
  });

  // A player reading the room on the spawn tile shouldn't be chased down
  // before their first move. The DMZ's Script Kiddie Bot used to do that.
  it("leaves the spawn tile untouched while the player stands still", () => {
    for (const room of campaign) {
      let enemies = room.enemies.map((e) => ({ ...e }));
      for (let tick = 0; tick < 120; tick++) {
        const result = updateEnemyAI(
          enemies,
          room.grid,
          room.startX,
          room.startY,
          ENEMY_STEP_INTERVAL_MS
        );
        expect(result.contactedPlayer, `${room.id} tick ${tick}`).toBe(false);
        enemies = result.updatedEnemies;
      }
    }
  });

  it("gives a room a hacking terminal exactly when it says it has one", () => {
    for (const room of campaign) {
      const hasTile = room.grid.some((row) => row.includes("H"));
      expect(hasTile, room.id).toBe(!!room.hasTerminal);
    }
    expect(
      campaign.filter((room) => room.hasTerminal).map((room) => room.id)
    ).toEqual(["active_directory", "tsp", "billable_hours"]);
  });

  it("generates a solvable hex puzzle at every terminal room's tier", () => {
    for (const room of campaign.filter((r) => r.hasTerminal)) {
      expect(room.securityTier, room.id).toBeDefined();
      for (let run = 0; run < 40; run++) {
        const puzzle = generateHexMatrixPuzzle(room.securityTier);
        expect(hexSolvable(puzzle), `${room.id} run ${run}`).toBe(true);
      }
    }
  });
});

describe("runsCompleted counts runs, not rooms (#2048)", () => {
  it("banks crypto and score on a room exit without counting a run", () => {
    const next = recordCyberdeckRoomResult(DEFAULT_CYBERDECK_PROFILE, {
      crypto: 120,
      score: 900,
      endsRun: false,
    });
    expect(next.runsCompleted).toBe(0);
    expect(next.totalCrypto).toBe(120);
    expect(next.highScore).toBe(900);
  });

  it("counts a run when the result ends it, and keeps the best score", () => {
    const profile = { ...DEFAULT_CYBERDECK_PROFILE, highScore: 5000 };
    const next = recordCyberdeckRoomResult(profile, {
      crypto: 0,
      score: 1200,
      endsRun: true,
    });
    expect(next.runsCompleted).toBe(1);
    expect(next.highScore).toBe(5000);
    expect(profile.runsCompleted).toBe(0);
  });

  it("counts a seven-room run once", () => {
    let profile = DEFAULT_CYBERDECK_PROFILE;
    campaign.forEach((_room, i) => {
      profile = recordCyberdeckRoomResult(profile, {
        crypto: 10,
        score: 100 * (i + 1),
        endsRun: i === campaign.length - 1,
      });
    });
    expect(profile.runsCompleted).toBe(1);
    expect(profile.totalCrypto).toBe(70);
  });
});
