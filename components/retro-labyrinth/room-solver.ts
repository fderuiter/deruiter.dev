import { ENEMY_STEP_INTERVAL_MS, updateEnemyAI } from "../../lib/dungeon/ai";
import { updateTSPMovingWalls } from "../../lib/dungeon/tsp";
import type { Enemy, TSPMovingWall, TSPNode } from "../../lib/dungeon/types";

/** A d-pad direction, named as its button is ("Move Up" and so on). */
export type Move = "Up" | "Down" | "Left" | "Right";

/** The part of a Room 1 (TSP) state the solver reads. */
export interface TspRoomState {
  grid: string[][];
  tspMovingWalls?: TSPMovingWall[];
  enemies: Enemy[];
  startX: number;
  startY: number;
  exitX: number;
  exitY: number;
  tspNodes?: TSPNode[];
}

/** One player state: where the walker is, what is visited, and the enemies. */
export interface TspSimState {
  px: number;
  py: number;
  visited: number;
  phase: number;
  enemies: Enemy[];
}

const DIRS: ReadonlyArray<{ move: Move; dx: number; dy: number }> = [
  { move: "Up", dx: 0, dy: -1 },
  { move: "Down", dx: 0, dy: 1 },
  { move: "Left", dx: -1, dy: 0 },
  { move: "Right", dx: 1, dy: 0 },
];

/**
 * The maze the walls form at each wall phase. Phase 0 is the room before any
 * move (its walls are not stamped yet). Phases 1 to 4 are the stamped walls
 * after 1 to 4 moves. The walls repeat every four moves, so a later move reuses
 * a phase (the game's updateTSPMovingWalls, applied per move).
 */
export function tspWallPhases(room: TspRoomState): string[][][] {
  const phases: string[][][] = [room.grid.map((row) => [...row])];
  let grid = room.grid.map((row) => [...row]);
  let walls = (room.tspMovingWalls ?? []).map((wall) => ({ ...wall }));
  for (let count = 1; count <= 4; count++) {
    const next = updateTSPMovingWalls(grid, walls, count);
    grid = next.updatedGrid;
    walls = next.updatedWalls;
    phases.push(grid);
  }
  return phases;
}

/** The phase after one more move: phase 0 is followed by 1, and 4 by 1. */
function nextPhase(phase: number): number {
  return phase === 0 ? 1 : (phase % 4) + 1;
}

function walkable(grid: string[][], x: number, y: number): boolean {
  const row = grid[y];
  if (!row || x < 0 || x >= row.length) return false;
  return row[x] !== "#" && row[x] !== "W";
}

/**
 * One move and the enemy tick that follows it, as the game does it. Returns
 * null when the move is not allowed or the enemies touch the walker.
 */
export function tspStep(
  room: TspRoomState,
  phases: string[][][],
  state: TspSimState,
  move: Move
): TspSimState | null {
  const dir = DIRS.find((d) => d.move === move);
  if (!dir) return null;
  const nx = state.px + dir.dx;
  const ny = state.py + dir.dy;
  if (!walkable(phases[state.phase], nx, ny)) return null;
  if (state.enemies.some((e) => e.x === nx && e.y === ny)) return null;

  const allVisited = (1 << (room.tspNodes ?? []).length) - 1;
  const isExit = nx === room.exitX && ny === room.exitY;
  let visited = state.visited;
  const node = (room.tspNodes ?? []).findIndex((n) => n.x === nx && n.y === ny);
  if (node >= 0) visited |= 1 << node;
  // The exit stays shut until every route node is visited (the game's lock).
  if (isExit && visited !== allVisited) return null;

  const phase = nextPhase(state.phase);
  const tick = updateEnemyAI(
    state.enemies,
    phases[phase],
    nx,
    ny,
    ENEMY_STEP_INTERVAL_MS
  );
  if (tick.contactedPlayer) return null;
  return { px: nx, py: ny, visited, phase, enemies: tick.updatedEnemies };
}

/** The state a room starts in, before any move. */
export function tspStartState(room: TspRoomState): TspSimState {
  return {
    px: room.startX,
    py: room.startY,
    visited: 0,
    phase: 0,
    enemies: room.enemies.map((e) => ({ ...e })),
  };
}

/** Whether a state is the room's win: every node visited, standing on the exit. */
export function tspIsWon(room: TspRoomState, state: TspSimState): boolean {
  const allVisited = (1 << (room.tspNodes ?? []).length) - 1;
  return (
    state.visited === allVisited &&
    state.px === room.exitX &&
    state.py === room.exitY
  );
}

/**
 * Replays a list of moves from the start. Returns the final state, or null when
 * a move is refused (a wall, a shut exit, or a touch from an enemy).
 */
export function replayTspMoves(
  room: TspRoomState,
  moves: ReadonlyArray<Move>
): TspSimState | null {
  const phases = tspWallPhases(room);
  let state: TspSimState | null = tspStartState(room);
  for (const move of moves) {
    state = tspStep(room, phases, state, move);
    if (!state) return null;
  }
  return state;
}

/**
 * Finds a shortest move sequence that visits every route node and reaches the
 * exit without a refused move or an enemy touch. Each move is one enemy tick,
 * so the answer is exact for a player who acts once per tick. Null when none
 * exists.
 */
export function solveTspRoom(room: TspRoomState): Move[] | null {
  const phases = tspWallPhases(room);
  const start = tspStartState(room);
  const keyOf = (s: TspSimState) =>
    `${s.px},${s.py},${s.visited},${s.phase},` +
    s.enemies.map((e) => `${e.x}.${e.y}.${e.patrolDir}.${e.state}`).join("|");

  const parents = new Map<string, { from: string; move: Move }>();
  const states = new Map<string, TspSimState>();
  const startKey = keyOf(start);
  states.set(startKey, start);
  const queue: string[] = [startKey];
  for (let head = 0; head < queue.length; head++) {
    const currentKey = queue[head];
    const current = states.get(currentKey)!;
    if (tspIsWon(room, current)) {
      const moves: Move[] = [];
      let key = currentKey;
      while (parents.has(key)) {
        const link = parents.get(key)!;
        moves.push(link.move);
        key = link.from;
      }
      return moves.reverse();
    }
    for (const dir of DIRS) {
      const next = tspStep(room, phases, current, dir.move);
      if (!next) continue;
      const key = keyOf(next);
      if (states.has(key)) continue;
      states.set(key, next);
      parents.set(key, { from: currentKey, move: dir.move });
      queue.push(key);
    }
  }
  return null;
}

/**
 * The room as its patrols stand when a live walk begins. The patrols have been
 * ticking in real time since the room was generated, by a count the test cannot
 * see. So this finds the idle tick count whose patrol cells match a run of
 * consecutive observations (one per tick, from the live game). A single cell
 * snapshot can match two patrol states, so the run must match one state only.
 * Returns the room at the last observed tick, or null when no count matches or
 * the matches disagree about the patrols.
 */
export function tspSyncRoomToPatrols(
  room: TspRoomState,
  observed: ReadonlyArray<ReadonlyArray<string>>,
  maxTicks = 5000
): TspRoomState | null {
  const cellsOf = (list: Enemy[]) => list.map((e) => `${e.x},${e.y}`).join(";");
  const idle = (list: Enemy[]) =>
    updateEnemyAI(
      list,
      room.grid,
      room.startX,
      room.startY,
      ENEMY_STEP_INTERVAL_MS
    ).updatedEnemies;
  let enemies: Enemy[] = room.enemies.map((e) => ({ ...e }));
  let found: Enemy[] | null = null;
  let foundKey = "";
  for (let tick = 0; tick <= maxTicks; tick++) {
    let probe = enemies;
    let matched = true;
    for (let i = 0; i < observed.length && matched; i++) {
      if (cellsOf(probe) !== observed[i].join(";")) matched = false;
      else if (i < observed.length - 1) probe = idle(probe);
    }
    if (matched) {
      const key = JSON.stringify(probe);
      if (found === null) {
        found = probe;
        foundKey = key;
      } else if (key !== foundKey) {
        return null;
      }
    }
    enemies = idle(enemies);
  }
  return found ? { ...room, enemies: found } : null;
}
