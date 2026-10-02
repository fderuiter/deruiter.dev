/**
 * Enemy AI State Machine, CVE Recognition & Collision Handling
 */

import { hasLineOfSight } from "./fov";
import { Enemy } from "./types";

export interface AIUpdateResult {
  updatedEnemies: Enemy[];
  /** HP the player loses this step, 25 for each enemy that touched them. */
  damageToPlayer: number;
  /**
   * True when an enemy touched the player this step. Contact costs HP only;
   * the run ends when HP reaches 0, not on contact itself (#1665).
   */
  contactedPlayer: boolean;
}

/** HP an enemy takes from the player when it steps into them. */
export const ENEMY_CONTACT_DAMAGE = 25;

/**
 * How long an enemy that touched the player holds still before it moves
 * again, so one enemy cannot drain the player's HP on every step.
 */
export const ENEMY_CONTACT_RECOIL_MS = 1000;

/**
 * Real time between two enemy steps. Callers accumulate elapsed time and run
 * one AI step each time this much has passed, so enemies move at the same
 * speed on a 60 Hz and a 144 Hz display (#1665).
 */
export const ENEMY_STEP_INTERVAL_MS = 333;

type PatrolDir = Enemy["patrolDir"];

const PATROL_STEP: Record<PatrolDir, { dx: number; dy: number }> = {
  right: { dx: 1, dy: 0 },
  left: { dx: -1, dy: 0 },
  down: { dx: 0, dy: 1 },
  up: { dx: 0, dy: -1 },
};

const OPPOSITE_DIR: Record<PatrolDir, PatrolDir> = {
  right: "left",
  left: "right",
  down: "up",
  up: "down",
};

/**
 * Whether an enemy may stand on a tile: inside the grid and not a wall ("#")
 * or an airgap wall ("W").
 */
export function isEnemyWalkable(
  grid: string[][],
  x: number,
  y: number
): boolean {
  const row = grid[y];
  if (!row || x < 0 || x >= row.length) return false;
  const cell = row[x];
  return cell !== "#" && cell !== "W";
}

/**
 * One patrol step: move along the patrol direction, turn back at the patrol
 * bounds, a wall or the grid edge, and stay put when both ways are blocked.
 */
function stepPatrol(
  enemy: Enemy,
  grid: string[][]
): { x: number; y: number; dir: PatrolDir } {
  const atLimit = (dir: PatrolDir): boolean =>
    (dir === "right" && enemy.maxX !== undefined && enemy.x >= enemy.maxX) ||
    (dir === "left" && enemy.minX !== undefined && enemy.x <= enemy.minX) ||
    (dir === "down" && enemy.maxY !== undefined && enemy.y >= enemy.maxY) ||
    (dir === "up" && enemy.minY !== undefined && enemy.y <= enemy.minY);
  const canStep = (dir: PatrolDir): boolean =>
    !atLimit(dir) &&
    isEnemyWalkable(
      grid,
      enemy.x + PATROL_STEP[dir].dx,
      enemy.y + PATROL_STEP[dir].dy
    );

  let dir = enemy.patrolDir;
  if (!canStep(dir)) dir = OPPOSITE_DIR[dir];
  if (!canStep(dir)) return { x: enemy.x, y: enemy.y, dir };
  return {
    x: enemy.x + PATROL_STEP[dir].dx,
    y: enemy.y + PATROL_STEP[dir].dy,
    dir,
  };
}

/**
 * Updates AI states (patrol, chase, stunned, confused, frozen) and positions for all active enemies.
 *
 * An enemy never moves onto the player. One that would instead touches them:
 * the player loses `ENEMY_CONTACT_DAMAGE` HP, and the enemy stays where it is
 * and holds still for `ENEMY_CONTACT_RECOIL_MS`.
 *
 * @param deltaMs - Real time since the previous call, which counts down the
 * stun, freeze and confusion timers.
 */
export function updateEnemyAI(
  enemies: Enemy[],
  grid: string[][],
  playerX: number,
  playerY: number,
  deltaMs: number
): AIUpdateResult {
  let damageToPlayer = 0;
  let contactedPlayer = false;

  const updatedEnemies = enemies.map((enemy) => {
    // 1. Handle Frozen State (Ransomware Lock)
    if (enemy.state === "frozen" || (enemy.frozenMs && enemy.frozenMs > 0)) {
      const remFrozen = (enemy.frozenMs || 0) - deltaMs;
      if (remFrozen <= 0) {
        return {
          ...enemy,
          state: "patrol" as const,
          frozenMs: 0,
        };
      }
      return {
        ...enemy,
        frozenMs: remFrozen,
      };
    }

    // 2. Handle Stun State
    if (
      enemy.state === "stunned" ||
      (enemy.stunTimerMs && enemy.stunTimerMs > 0)
    ) {
      const remainingStun = (enemy.stunTimerMs || 0) - deltaMs;
      if (remainingStun <= 0) {
        return {
          ...enemy,
          state: "patrol" as const,
          stunTimerMs: 0,
        };
      }
      return {
        ...enemy,
        stunTimerMs: remainingStun,
      };
    }

    // 3. Handle Confused State (MitM Packet Spoof)
    let isConfused = false;
    let remainingConfused = enemy.confusedMs || 0;
    if (enemy.state === "confused" || remainingConfused > 0) {
      remainingConfused -= deltaMs;
      if (remainingConfused <= 0) {
        remainingConfused = 0;
      } else {
        isConfused = true;
      }
    }

    const distToPlayer = Math.hypot(enemy.x - playerX, enemy.y - playerY);
    const los = hasLineOfSight(grid, enemy.x, enemy.y, playerX, playerY);

    // 4. State Transitions
    let state = isConfused ? "confused" : enemy.state;
    if (!isConfused) {
      if (
        enemy.type === "zombie" ||
        enemy.type === "slime" ||
        enemy.type === "sentinel_daemon"
      ) {
        if (distToPlayer <= 5 && los) {
          state = "chase";
        } else if (distToPlayer > 6) {
          state = "patrol";
        }
      }
    }

    let nextX = enemy.x;
    let nextY = enemy.y;
    let nextDir = enemy.patrolDir;

    if (state === "confused") {
      // Confused movement: erratic jitter
      const dirs = ["left", "right", "up", "down"] as const;
      nextDir = dirs[Math.floor(Math.random() * dirs.length)];
      const stepX = nextDir === "right" ? 1 : nextDir === "left" ? -1 : 0;
      const stepY = nextDir === "down" ? 1 : nextDir === "up" ? -1 : 0;
      const candX = enemy.x + stepX;
      const candY = enemy.y + stepY;
      if (isEnemyWalkable(grid, candX, candY)) {
        nextX = candX;
        nextY = candY;
      }
    } else if (state === "chase") {
      // Chase movement: step closer to player along primary axis
      const dx = playerX - enemy.x;
      const dy = playerY - enemy.y;

      let stepX = 0;
      let stepY = 0;

      if (Math.abs(dx) >= Math.abs(dy)) {
        stepX = dx > 0 ? 1 : -1;
      } else {
        stepY = dy > 0 ? 1 : -1;
      }

      const candidateX = enemy.x + stepX;
      const candidateY = enemy.y + stepY;

      if (isEnemyWalkable(grid, candidateX, candidateY)) {
        nextX = candidateX;
        nextY = candidateY;
      }
    } else {
      // Patrol movement along axis, turning back at bounds and walls.
      const patrol = stepPatrol(enemy, grid);
      nextX = patrol.x;
      nextY = patrol.y;
      nextDir = patrol.dir;
    }

    // Touching the player costs them HP; the enemy holds its tile and
    // recoils rather than moving onto the player (unless confused).
    if (!isConfused && nextX === playerX && nextY === playerY) {
      contactedPlayer = true;
      damageToPlayer += ENEMY_CONTACT_DAMAGE;
      return {
        ...enemy,
        state,
        stunTimerMs: ENEMY_CONTACT_RECOIL_MS,
        patrolDir: state === "chase" ? enemy.patrolDir : OPPOSITE_DIR[nextDir],
        confusedMs: remainingConfused,
      };
    }

    return {
      ...enemy,
      x: nextX,
      y: nextY,
      state,
      patrolDir: nextDir,
      confusedMs: remainingConfused,
    };
  });

  return {
    updatedEnemies,
    damageToPlayer,
    contactedPlayer,
  };
}
