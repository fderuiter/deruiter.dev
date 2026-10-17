import {
  SCRAMBLE_IMMUNE_CLASSES,
  routeTierOf,
  type ActiveSideEffect,
  type BossState,
  type CyberdeckClassId,
  type DungeonRoom,
  type ParticleEffect,
  type RunReward,
} from "@/lib/dungeon";

// Small rules the Retro Labyrinth cabinet applies to its run (#2291). They
// are pure, so the component stays a renderer and the tests need no canvas.

/** Why the Market cannot open outside the rest stop. */
export const MARKET_CLOSED_REASON = "Market opens at the rest stop";

/**
 * Whether the Darknet Market is open. In a roguelike run it trades only at
 * the rest stop, the room the route map labels "Rest stop · Market"; the
 * classic stages have no route and keep it open.
 *
 * @param gameMode - The cabinet's game mode.
 * @param room - The room being played, if any.
 * @returns True when the Market may open.
 */
export function isMarketOpen(
  gameMode: "roguelike" | "classic",
  room: Pick<DungeonRoom, "id" | "boss"> | undefined
): boolean {
  if (gameMode !== "roguelike") return true;
  return !!room && routeTierOf(room) === "rest";
}

/**
 * What pressing a tool key says when the slot cannot fire.
 *
 * @param slotIdx - The zero-based hotbar slot.
 * @param weaponName - The tool in the slot, if any.
 * @returns The feedback line.
 */
export function slotUnavailableMessage(
  slotIdx: number,
  weaponName: string | undefined
): string {
  const key = slotIdx + 1;
  return weaponName
    ? `Slot ${key}: ${weaponName} is out of ammo`
    : `Slot ${key} is empty. Rewards fill slots 4 and 5`;
}

/**
 * Why each reward on the room-cleared card cannot be taken, by offer index.
 * A Patch Kit at full HP would be wasted, so it says "HP full".
 *
 * @param offer - The rewards on offer.
 * @param hp - The player's HP now.
 * @param maxHp - The player's maximum HP.
 * @returns A reason, or null for a reward that can be taken.
 */
export function rewardUnavailableReasons(
  offer: readonly RunReward[],
  hp: number,
  maxHp: number
): (string | null)[] {
  return offer.map((reward) =>
    reward.kind === "heal" && hp >= maxHp ? "HP full" : null
  );
}

/**
 * A burst of particles that does not fly, for reduced motion. Each particle
 * is placed a short way along its path and keeps still while it fades, so
 * the burst still shows where the tool hit.
 *
 * @param particles - The particles a tool threw.
 * @returns Still copies of them.
 */
export function stillParticles(
  particles: readonly ParticleEffect[]
): ParticleEffect[] {
  return particles.map((p) => ({
    ...p,
    x: p.x + p.vx * 0.4,
    y: p.y + p.vy * 0.4,
    vx: 0,
    vy: 0,
  }));
}

/**
 * The boss after a frame, with its mesh held at its old angle for reduced
 * motion. Phase colour, attacks and projectiles still update.
 *
 * @param before - The boss before the frame.
 * @param after - The boss the frame produced.
 * @returns The boss with the mesh rotation of `before`.
 */
export function holdBossSpin(before: BossState, after: BossState): BossState {
  return {
    ...after,
    mesh: { ...after.mesh, rotation: before.mesh.rotation },
  };
}

/**
 * A run time as minutes and seconds, such as "2:05".
 *
 * @param ms - The run time in milliseconds.
 * @returns The formatted time.
 */
export function formatRunTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Whether the movement keys are inverted now. A Stack Overflow snippet
 * scrambles them for a while, except for a class immune to it (#2338).
 *
 * @param classId - The Cyberdeck class in play.
 * @param effect - The active side effect, if any.
 * @param now - The time now, in epoch milliseconds.
 * @returns True when up, down, left and right are reversed.
 */
export function controlsScrambled(
  classId: CyberdeckClassId,
  effect: ActiveSideEffect | null | undefined,
  now: number
): boolean {
  return (
    effect?.type === "scrambled_keys" &&
    effect.expiresAt > now &&
    !SCRAMBLE_IMMUNE_CLASSES.has(classId)
  );
}

/**
 * The side effect a tool leaves on this class. An immune class shrugs off
 * scrambled keys, so no inverted-keys warning shows (#2338).
 *
 * @param classId - The Cyberdeck class in play.
 * @param effect - The side effect the tool produced, if any.
 * @returns The effect to apply, or undefined for none.
 */
export function sideEffectForClass(
  classId: CyberdeckClassId,
  effect: ActiveSideEffect | undefined
): ActiveSideEffect | undefined {
  if (effect?.type === "scrambled_keys" && SCRAMBLE_IMMUNE_CLASSES.has(classId))
    return undefined;
  return effect;
}

/** The names the trace card gives each boss, rather than its raw id. */
const BOSS_DISPLAY_NAMES: Readonly<
  Record<NonNullable<BossState["kind"]>, string>
> = {
  faceforge: "FaceForge",
  neural_warden: "Neural Warden",
};

/**
 * The trace card's line for a boss volley hit, naming the boss as the game
 * does elsewhere (#2338).
 *
 * @param boss - The boss whose volley hit.
 * @returns The line, such as "A Neural Warden mesh volley severed…".
 */
export function bossVolleyHitLine(boss: Pick<BossState, "kind">): string {
  const name = BOSS_DISPLAY_NAMES[boss.kind ?? "faceforge"];
  return `A ${name} mesh volley severed your cyberdeck proxy tunnel.`;
}
