/**
 * Room objectives that gate the exit (#1321).
 *
 * A room with a boss keeps its exit locked until the boss is defeated, and a
 * room with airgap route nodes keeps it locked until every node is visited.
 * Rooms with neither leave the exit open.
 */

import { BossState, TSPNode } from "./types";

/**
 * Whether a room's exit is open, and what the player still has to do.
 */
export interface ExitLockState {
  /** True while the room's objective is unfinished. */
  locked: boolean;
  /** Short objective line shown over the room, such as "DEFEAT THE BOSS". */
  objective: string;
  /** Message shown when the player walks into a locked exit. */
  lockedMessage: string;
}

/**
 * Works out whether the exit is locked from the room's boss and route nodes.
 *
 * @param boss - The room's boss, if it has one.
 * @param tspNodes - The room's airgap route nodes, if it has any.
 * @returns The lock state, objective line and locked-exit message.
 */
export function getExitLockState(
  boss: BossState | undefined,
  tspNodes: readonly TSPNode[] | undefined
): ExitLockState {
  if (boss && !boss.defeated) {
    return {
      locked: true,
      objective: "DEFEAT THE BOSS",
      lockedMessage: "EXIT LOCKED: DEFEAT THE BOSS",
    };
  }

  const nodes = tspNodes ?? [];
  const remaining = nodes.filter((node) => !node.visited).length;
  if (remaining > 0) {
    const visited = nodes.length - remaining;
    return {
      locked: true,
      objective: `VISIT THE ROUTE NODES (${visited}/${nodes.length})`,
      lockedMessage: `EXIT LOCKED: ${remaining} ROUTE NODE${
        remaining === 1 ? "" : "S"
      } LEFT`,
    };
  }

  return {
    locked: false,
    objective: "REACH THE EXIT",
    lockedMessage: "",
  };
}
