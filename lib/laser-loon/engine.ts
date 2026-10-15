/**
 * Laser Loon: Quest for the State Flag
 * Pure physics engine, raycast geometry, collision detection, and campaign lifecycle.
 */

import { clamp } from "@/lib/game-utils";
import {
  LaserLoonState,
  LaserMode,
  LaserType,
  Target,
  IceBlock,
  Particle,
  Shockwave,
  FloatingText,
  CivicEnemyType,
  PowerUp,
  PowerUpType,
  WeaponCounter,
  BossSignature,
  CounterHitPoint,
} from "./types";
import {
  ENEMY_TYPES,
  WEAPONS,
  CAMPAIGN_ACTS,
  POWER_UP_CONFIGS,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  SURVIVAL_FULL_HEAT_SECONDS,
  SURVIVAL_WAVE_SECONDS,
  COMBO_TIMEOUT_MS,
  MAX_MULTIPLIER,
  ULTIMATE_CHARGE_PER_KILL,
  LOON_HIT_RADIUS,
  LOON_INVULNERABLE_MS,
  BOSS_ATTACK_BASE_FRAMES,
  BOSS_ATTACK_FRAMES_PER_ACT,
  BOSS_ATTACK_MIN_FRAMES,
  BOSS_PHASE_TWO_INTERVAL_SCALE,
  BOSS_TELEGRAPH_FRAMES,
  BOSS_PROJECTILE_RADIUS,
  BOSS_FIRST_VOLLEY_FRAMES,
  STARFLAKE_SHIELD_HALF_ARC,
  SWARM_MAX_MINIONS,
  GAVEL_WALL_GAP,
  MINION_FIRE_FIRST_ACT,
  MINION_FIRE_BASE_FRAMES,
  MINION_FIRE_FRAMES_PER_ACT,
  MINION_FIRE_MAX_SHOTS,
  MINION_SHOT_SPEED,
  MINION_SHOT_RADIUS,
  MINION_FIRE_MIN_LEAD,
  KEYBOARD_AIM_CONE_RADIANS,
  WEAKNESS_DAMAGE_MULTIPLIER,
  RESISTED_DAMAGE_MULTIPLIER,
} from "./constants";

export function createInitialState(
  mode: LaserMode = "campaign"
): LaserLoonState {
  return {
    mode,
    laserType: "ruby-laser",
    gameState: "idle",
    currentAct: 1,
    actKills: 0,
    score: 0,
    highScore: 0,
    combo: 0,
    multiplier: 1,
    timeLeft: 999,
    gravity: 0.15,
    ultimateMeter: 0,
    activePowerUp: null,
    targets: [],
    iceBlocks: [],
    powerUps: [],
    particles: [],
    shockwaves: [],
    floatingTexts: [],
    loonPos: { x: 120, y: 180, targetX: 120, targetY: 180 },
    aimPos: { x: 420, y: 180 },
    lastFireTime: 0,
    lastComboTime: 0,
    nextTargetId: 1,
    nextIceId: 1,
    nextPowerUpId: 1,
    nextShockwaveId: 1,
    nextTextId: 1,
    shakeIntensity: 0,
  };
}

export function getActAvailableEnemies(actNumber: number): CivicEnemyType[] {
  switch (actNumber) {
    case 1:
      return ["mosquito", "hailstorm", "jetski"];
    case 2:
      return ["butter-bomb", "pronto-pup-rogue", "livestock-decoy", "mosquito"];
    case 3:
      return ["red-tape", "veto-stamp", "tricolor-rival", "clipboard"];
    case 4:
      return [
        "legislative-amendment",
        "seal-guardian",
        "polar-vortex",
        "red-tape",
      ];
    default:
      return [
        "mosquito",
        "hailstorm",
        "butter-bomb",
        "red-tape",
        "veto-stamp",
        "tricolor-rival",
      ];
  }
}

/**
 * The enemies an act introduces: its pool less any type an earlier act
 * already fielded. The act intro card names the optic each one wants.
 *
 * @param actNumber - Campaign act, 1 to 4.
 */
export function getActNewEnemies(actNumber: number): CivicEnemyType[] {
  const seen = new Set<CivicEnemyType>();
  for (let act = 1; act < actNumber; act++) {
    getActAvailableEnemies(act).forEach((type) => seen.add(type));
  }
  return getActAvailableEnemies(actNumber).filter((type) => !seen.has(type));
}

/**
 * The optic an enemy type is weak to, or undefined for bosses and unknown
 * types, which take every weapon at face value.
 *
 * @param type - Enemy type.
 */
export function getEnemyWeakness(type: CivicEnemyType): LaserType | undefined {
  return ENEMY_TYPES.find((e) => e.type === type)?.weakTo;
}

/**
 * How a weapon's hit lands on an enemy type: "weak" for its weakness,
 * "resisted" for an optic it shrugs off, otherwise "neutral".
 *
 * @param type - Enemy type hit.
 * @param laserType - Weapon that landed the hit.
 */
export function getWeaponCounter(
  type: CivicEnemyType,
  laserType: LaserType
): WeaponCounter {
  const template = ENEMY_TYPES.find((e) => e.type === type);
  if (!template || template.isBoss) return "neutral";
  if (template.weakTo === laserType) return "weak";
  if (template.resists?.includes(laserType)) return "resisted";
  return "neutral";
}

/**
 * Damage multiplier for a weapon against an enemy type: doubled on a
 * weakness, halved when resisted, otherwise 1. Never zero, so no enemy is
 * immune to any optic.
 *
 * @param type - Enemy type hit.
 * @param laserType - Weapon that landed the hit.
 */
export function getWeaponDamageMultiplier(
  type: CivicEnemyType,
  laserType: LaserType
): number {
  return counterMultiplier(getWeaponCounter(type, laserType));
}

/** A target's counter against a weapon; boss volley shots stay neutral. */
function targetCounter(target: Target, laserType: LaserType): WeaponCounter {
  return target.isProjectile
    ? "neutral"
    : getWeaponCounter(target.type, laserType);
}

/** Damage multiplier for a counter, as getWeaponDamageMultiplier applies it. */
function counterMultiplier(counter: WeaponCounter): number {
  if (counter === "weak") return WEAKNESS_DAMAGE_MULTIPLIER;
  if (counter === "resisted") return RESISTED_DAMAGE_MULTIPLIER;
  if (counter === "blocked") return 0;
  return 1;
}

export function spawnTarget(
  targets: Target[],
  nextId: number,
  canvasWidth = DEFAULT_CANVAS_WIDTH,
  canvasHeight = DEFAULT_CANVAS_HEIGHT,
  forcedType?: CivicEnemyType,
  actNumber = 1
): { newTarget: Target; updatedTargets: Target[]; nextId: number } {
  let targetType = forcedType;
  if (!targetType) {
    const pool = getActAvailableEnemies(actNumber);
    targetType = pool[Math.floor(Math.random() * pool.length)];
  }

  const template =
    ENEMY_TYPES.find((b) => b.type === targetType) || ENEMY_TYPES[0];

  const edge = Math.floor(Math.random() * 3);
  let x = canvasWidth + 30;
  let y = Math.random() * (canvasHeight - 100) + 50;
  let vx = -(Math.random() * 1.5 + 1.0);
  let vy = (Math.random() - 0.5) * 1.2;

  if (edge === 0) {
    x = Math.random() * (canvasWidth * 0.4) + canvasWidth * 0.6;
    y = -30;
    vy = Math.random() * 1.2 + 0.6;
  } else if (edge === 1) {
    x = Math.random() * (canvasWidth * 0.4) + canvasWidth * 0.6;
    y = canvasHeight + 30;
    vy = -(Math.random() * 1.2 + 0.6);
  }

  if (template.isBoss) {
    x = canvasWidth - 100;
    y = canvasHeight * 0.5;
    vx = 0;
    vy = 1.0;
  }

  const newTarget: Target = {
    id: nextId,
    x,
    y,
    vx,
    vy,
    radius: template.radius,
    type: template.type,
    label: template.label,
    color: template.color,
    hp: template.hp,
    maxHp: template.hp,
    points: template.points,
    pulsePhase: Math.random() * Math.PI * 2,
    frozenTimer: 0,
    isBoss: template.isBoss || false,
    bossPhase: 1,
    shieldAngle: 0,
    specialAttackTimer: 0,
  };

  return {
    newTarget,
    updatedTargets: [...targets, newTarget],
    nextId: nextId + 1,
  };
}

export function spawnBossForAct(
  actNumber: number,
  nextId: number,
  canvasWidth = DEFAULT_CANVAS_WIDTH,
  canvasHeight = DEFAULT_CANVAS_HEIGHT
): { boss: Target; nextId: number } {
  const act =
    CAMPAIGN_ACTS.find((a) => a.actNumber === actNumber) || CAMPAIGN_ACTS[0];
  const template =
    ENEMY_TYPES.find((e) => e.type === act.bossType) ||
    ENEMY_TYPES[ENEMY_TYPES.length - 1];

  const boss: Target = {
    id: nextId,
    x: canvasWidth - 120,
    y: canvasHeight * 0.5,
    vx: 0,
    vy: 1.2,
    radius: template.radius,
    type: template.type,
    label: template.label,
    color: template.color,
    hp: act.bossHp,
    maxHp: act.bossHp,
    points: template.points,
    pulsePhase: 0,
    frozenTimer: 0,
    isBoss: true,
    bossPhase: 1,
    shieldAngle: 0,
    // The first volley comes about a second and a half after the boss
    // arrives, so even a quick fight has one.
    specialAttackTimer: Math.max(
      0,
      getBossAttackInterval(actNumber) - BOSS_FIRST_VOLLEY_FRAMES
    ),
  };

  return { boss, nextId: nextId + 1 };
}

export function spawnPowerUp(
  powerUps: PowerUp[],
  nextId: number,
  canvasWidth = DEFAULT_CANVAS_WIDTH,
  canvasHeight = DEFAULT_CANVAS_HEIGHT,
  forcedType?: PowerUpType
): { newPowerUp: PowerUp; updatedPowerUps: PowerUp[]; nextId: number } {
  const types: PowerUpType[] = ["hotdish", "pronto-pup", "north-star"];
  const type = forcedType || types[Math.floor(Math.random() * types.length)];
  const config = POWER_UP_CONFIGS[type];

  const newPowerUp: PowerUp = {
    id: nextId,
    x: canvasWidth + 20,
    y: Math.random() * (canvasHeight - 120) + 60,
    vx: -(Math.random() * 1.2 + 0.8),
    vy: Math.sin(Math.random() * Math.PI) * 0.5,
    type,
    label: config.label,
    color: config.color,
    pulsePhase: 0,
    durationMs: config.durationMs,
  };

  return {
    newPowerUp,
    updatedPowerUps: [...powerUps, newPowerUp],
    nextId: nextId + 1,
  };
}

export function updatePowerUps(
  powerUps: PowerUp[],
  dt: number,
  loonX: number,
  loonY: number,
  loonRadius = 32
): { remainingPowerUps: PowerUp[]; collectedPowerUp: PowerUp | null } {
  const remaining: PowerUp[] = [];
  let collected: PowerUp | null = null;

  for (const p of powerUps) {
    const nextP = { ...p };
    nextP.x += nextP.vx * dt;
    nextP.y += nextP.vy * dt;
    nextP.pulsePhase += 0.08 * dt;

    const distToLoon = Math.hypot(nextP.x - loonX, nextP.y - loonY);
    if (distToLoon < loonRadius + 20 && !collected) {
      collected = nextP;
    } else if (nextP.x > -40) {
      remaining.push(nextP);
    }
  }

  return { remainingPowerUps: remaining, collectedPowerUp: collected };
}

export function createIceBlock(
  fromX: number,
  fromY: number,
  targetX: number,
  targetY: number,
  nextId: number,
  speed = 8.5
): { iceBlock: IceBlock; nextId: number } {
  const dx = targetX - fromX;
  const dy = targetY - fromY;
  const dist = Math.hypot(dx, dy) || 1;

  const iceBlock: IceBlock = {
    id: nextId,
    x: fromX,
    y: fromY,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    size: 28,
    rotation: Math.random() * Math.PI * 2,
    vRot: (Math.random() - 0.5) * 0.2,
    hp: 1,
  };

  return {
    iceBlock,
    nextId: nextId + 1,
  };
}

export interface LoonCollisionInput {
  targets: Target[];
  loonX: number;
  loonY: number;
  hitsLeft: number;
  invulnerableUntil: number;
  now: number;
  shielded: boolean;
}

export interface LoonCollisionResult {
  /** Targets after contact: a regular enemy that touches the loon is knocked out. */
  targets: Target[];
  hitsLeft: number;
  invulnerableUntil: number;
  /** "hit" costs a hit, "blocked" was absorbed by the Pronto Pup shield. */
  outcome: "none" | "hit" | "blocked";
  /** Where the contact happened, for effects. */
  contact: { x: number; y: number } | null;
}

/**
 * Resolves contact between the loon and live, unfrozen enemies.
 *
 * Frozen enemies are harmless ice. A regular enemy that touches the loon is
 * knocked out without scoring; a boss stays. The Pronto Pup shield absorbs
 * contact, and after a hit enemies pass through the loon until the
 * invulnerability window ends.
 */
export function resolveLoonCollision(
  input: LoonCollisionInput
): LoonCollisionResult {
  const { targets, loonX, loonY, hitsLeft, invulnerableUntil, now, shielded } =
    input;
  const unchanged: LoonCollisionResult = {
    targets,
    hitsLeft,
    invulnerableUntil,
    outcome: "none",
    contact: null,
  };

  if (hitsLeft <= 0) return unchanged;

  const index = targets.findIndex(
    (t) =>
      t.hp > 0 &&
      t.frozenTimer <= 0 &&
      Math.hypot(t.x - loonX, t.y - loonY) < t.radius + LOON_HIT_RADIUS
  );
  if (index === -1) return unchanged;

  const target = targets[index];

  if (shielded) {
    // The shield pops a regular enemy and simply holds off a boss.
    if (target.isBoss) return unchanged;
    return {
      ...unchanged,
      targets: targets.filter((_, i) => i !== index),
      outcome: "blocked",
      contact: { x: target.x, y: target.y },
    };
  }

  // While blinking after a hit, enemies pass through the loon.
  if (now < invulnerableUntil) return unchanged;

  const nextTargets = target.isBoss
    ? targets
    : targets.filter((_, i) => i !== index);
  const contact = { x: target.x, y: target.y };

  return {
    targets: nextTargets,
    hitsLeft: hitsLeft - 1,
    invulnerableUntil: now + LOON_INVULNERABLE_MS,
    outcome: "hit",
    contact,
  };
}

export interface IceCollisionResult {
  updatedIceBlocks: IceBlock[];
  updatedTargets: Target[];
  shatteredBlocks: Array<{ x: number; y: number }>;
  killedTargets: Target[];
  frozenTargets: Target[];
  /** Each block that struck a target, with the Cryo-Mortar's counter on it. */
  hitPoints: CounterHitPoint[];
  pointsEarned: number;
}

export function updateIceBlocksAndCollisions(
  iceBlocks: IceBlock[],
  targets: Target[],
  dt: number,
  mode: LaserMode,
  gravity: number,
  width = DEFAULT_CANVAS_WIDTH,
  height = DEFAULT_CANVAS_HEIGHT
): IceCollisionResult {
  const shatteredBlocks: Array<{ x: number; y: number }> = [];
  const killedTargets: Target[] = [];
  const frozenTargets: Target[] = [];
  const hitPoints: CounterHitPoint[] = [];
  let pointsEarned = 0;

  const updatedTargets = targets.map((t) => ({ ...t }));
  const remainingIceBlocks: IceBlock[] = [];

  for (const block of iceBlocks) {
    const nextBlock = { ...block };
    nextBlock.x += nextBlock.vx * dt;
    nextBlock.y += nextBlock.vy * dt;
    nextBlock.rotation += nextBlock.vRot * dt;

    if (mode === "sandbox") {
      nextBlock.vy += gravity * dt;
    }

    // Bounce off top and bottom walls
    if (nextBlock.y < 20) {
      nextBlock.y = 20;
      nextBlock.vy = Math.abs(nextBlock.vy) * 0.85;
      shatteredBlocks.push({ x: nextBlock.x, y: nextBlock.y });
    } else if (nextBlock.y > height - 20) {
      nextBlock.y = height - 20;
      nextBlock.vy = -Math.abs(nextBlock.vy) * 0.85;
      shatteredBlocks.push({ x: nextBlock.x, y: nextBlock.y });
    }

    let blockShattered = false;

    for (const target of updatedTargets) {
      if (target.hp <= 0) continue;
      const dist = Math.hypot(target.x - nextBlock.x, target.y - nextBlock.y);
      if (dist < target.radius + nextBlock.size * 0.5) {
        blockShattered = true;
        const counter = targetCounter(target, "ice-cannon");
        const dmg = (target.isBoss ? 2 : 3) * counterMultiplier(counter);
        target.hp -= dmg;
        hitPoints.push({
          x: target.x,
          y: target.y,
          color: target.color,
          counter,
        });
        target.frozenTimer = target.isBoss ? 45 : 120; // Freeze in place
        frozenTargets.push(target);
        shatteredBlocks.push({ x: nextBlock.x, y: nextBlock.y });

        if (target.hp <= 0) {
          killedTargets.push(target);
          pointsEarned += target.points * 2; // Shatter bonus
        }
        break;
      }
    }

    if (!blockShattered && nextBlock.x < width + 60 && nextBlock.x > -60) {
      remainingIceBlocks.push(nextBlock);
    }
  }

  return {
    updatedIceBlocks: remainingIceBlocks,
    updatedTargets: updatedTargets.filter((t) => t.hp > 0),
    shatteredBlocks,
    killedTargets,
    frozenTargets,
    hitPoints,
    pointsEarned,
  };
}

export function updateTargetsPosition(
  targets: Target[],
  dt: number,
  mode: LaserMode,
  gravity: number,
  height = DEFAULT_CANVAS_HEIGHT,
  width = DEFAULT_CANVAS_WIDTH
): Target[] {
  return targets
    .filter(
      (t) =>
        t.hp > 0 &&
        (t.isBoss || t.x > -60) &&
        (!t.isProjectile ||
          (t.x < width + 60 && t.y > -60 && t.y < height + 60))
    )
    .map((t) => {
      const nextT = { ...t };

      if (nextT.frozenTimer > 0) {
        nextT.frozenTimer = Math.max(0, nextT.frozenTimer - 1 * dt);
        return nextT;
      }

      nextT.pulsePhase += 0.05 * dt;

      if (nextT.isProjectile) {
        if (nextT.ay) nextT.vy += nextT.ay * dt;
        nextT.x += nextT.vx * dt;
        nextT.y += nextT.vy * dt;
        return nextT;
      }

      if (nextT.isBoss) {
        // Boss flight pattern
        nextT.shieldAngle =
          ((nextT.shieldAngle || 0) + 0.04 * dt) % (Math.PI * 2);
        nextT.y += nextT.vy * dt;
        if (nextT.y < 80) {
          nextT.y = 80;
          nextT.vy = Math.abs(nextT.vy);
        } else if (nextT.y > height - 80) {
          nextT.y = height - 80;
          nextT.vy = -Math.abs(nextT.vy);
        }

        // Slight horizontal bobbing
        nextT.x = width - 130 + Math.sin(nextT.pulsePhase * 0.8) * 40;
        return nextT;
      }

      const template = ENEMY_TYPES.find((e) => e.type === nextT.type);
      const behavior = template?.behavior || "linear";

      if (behavior === "sine") {
        nextT.x += nextT.vx * dt;
        nextT.y += Math.sin(nextT.pulsePhase) * 2.0 * dt;
      } else if (behavior === "bouncing") {
        nextT.x += nextT.vx * dt;
        nextT.y += nextT.vy * dt;
        if (nextT.y - nextT.radius < 15) {
          nextT.y = 15 + nextT.radius;
          nextT.vy = Math.abs(nextT.vy);
        } else if (nextT.y + nextT.radius > height - 15) {
          nextT.y = height - 15 - nextT.radius;
          nextT.vy = -Math.abs(nextT.vy);
        }
      } else {
        nextT.x += nextT.vx * dt;
        nextT.y += nextT.vy * dt;
      }

      if (mode === "sandbox") {
        nextT.vy += gravity * dt;
      }

      if (nextT.y - nextT.radius < 10) {
        nextT.y = 10 + nextT.radius;
        nextT.vy = Math.abs(nextT.vy) * 0.8;
      } else if (nextT.y + nextT.radius > height - 10) {
        nextT.y = height - 10 - nextT.radius;
        nextT.vy = -Math.abs(nextT.vy) * 0.8;
      }

      return nextT;
    });
}

export interface LaserHitResult {
  updatedTargets: Target[];
  hitAny: boolean;
  killedTargets: Target[];
  /** Each target the ray struck, with the weapon's counter on it. */
  damagedPoints: CounterHitPoint[];
  ultimateGained: number;
}

export function checkLaserRayHit(
  eyeX: number,
  eyeY: number,
  aimX: number,
  aimY: number,
  laserType: LaserType,
  targets: Target[],
  hasHotdishOvercharge = false
): LaserHitResult {
  const dx = aimX - eyeX;
  const dy = aimY - eyeY;
  const dist = Math.hypot(dx, dy) || 1;
  const dirX = dx / dist;
  const dirY = dy / dist;

  const weapon = WEAPONS[laserType] || WEAPONS["ruby-laser"];
  const hitExtra = weapon.rayHitRadiusExtra + (hasHotdishOvercharge ? 10 : 0);
  const damage = weapon.damage * (hasHotdishOvercharge ? 1.6 : 1.0);

  let hitAny = false;
  let ultimateGained = 0;
  const killedTargets: Target[] = [];
  const damagedPoints: CounterHitPoint[] = [];

  const updatedTargets = targets.map((t) => {
    if (t.hp <= 0) return t;

    const toTx = t.x - eyeX;
    const toTy = t.y - eyeY;
    const proj = toTx * dirX + toTy * dirY;

    if (proj > 0) {
      const nearX = eyeX + dirX * proj;
      const nearY = eyeY + dirY * proj;
      const distToRay = Math.hypot(t.x - nearX, t.y - nearY);

      if (distToRay < t.radius + hitExtra) {
        hitAny = true;
        // Damage step: the weapon's counter against this enemy scales it,
        // and the Starflake's shield turns away a beam it faces (#2144).
        const counter = isShieldFacing(t, eyeX, eyeY)
          ? "blocked"
          : targetCounter(t, laserType);
        const nextHp = t.hp - damage * counterMultiplier(counter);
        damagedPoints.push({ x: nearX, y: nearY, color: t.color, counter });

        if (t.isBoss && counter !== "blocked") {
          ultimateGained += 4;
        }

        if (nextHp <= 0) {
          const killed = { ...t, hp: 0 };
          killedTargets.push(killed);
          ultimateGained += ULTIMATE_CHARGE_PER_KILL;
          return killed;
        }
        return { ...t, hp: nextHp };
      }
    }
    return t;
  });

  return {
    updatedTargets: updatedTargets.filter((t) => t.hp > 0),
    hitAny,
    killedTargets,
    damagedPoints,
    ultimateGained,
  };
}

export function triggerUltimateTremolo(
  targets: Target[],
  fromX: number,
  fromY: number,
  canvasWidth = DEFAULT_CANVAS_WIDTH,
  canvasHeight = DEFAULT_CANVAS_HEIGHT,
  nextShockwaveId = 1
): {
  updatedTargets: Target[];
  killedTargets: Target[];
  newShockwave: Shockwave;
  pointsEarned: number;
  nextShockwaveId: number;
} {
  const killedTargets: Target[] = [];
  let pointsEarned = 0;

  const updatedTargets = targets.map((t) => {
    const nextT = { ...t };
    const tremoloDamage = nextT.isBoss ? 15 : 999; // Instant kill regular targets, heavy boss damage
    nextT.hp -= tremoloDamage;
    nextT.frozenTimer = 180;

    if (nextT.hp <= 0) {
      killedTargets.push(nextT);
      pointsEarned += nextT.points * 3; // Ultimate bonus
    }
    return nextT;
  });

  const newShockwave: Shockwave = {
    id: nextShockwaveId,
    x: fromX,
    y: fromY,
    radius: 10,
    maxRadius: Math.max(canvasWidth, canvasHeight) * 1.2,
    speed: 18,
    color: "#22d3ee",
    alpha: 1.0,
  };

  return {
    updatedTargets: updatedTargets.filter((t) => t.hp > 0),
    killedTargets,
    newShockwave,
    pointsEarned,
    nextShockwaveId: nextShockwaveId + 1,
  };
}

export function calculateNextComboAndMultiplier(
  currentCombo: number,
  lastComboTime: number,
  currentTime: number
): { nextCombo: number; nextMultiplier: number } {
  const timeSinceLast = currentTime - lastComboTime;
  const nextCombo = timeSinceLast < COMBO_TIMEOUT_MS ? currentCombo + 1 : 1;
  const nextMultiplier = Math.min(
    MAX_MULTIPLIER,
    Math.floor(nextCombo / 3) + 1
  );
  return { nextCombo, nextMultiplier };
}

export function createExplosionParticles(
  x: number,
  y: number,
  color: string,
  count = 20,
  isIce = false,
  isStar = false
): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * (isIce ? 5.5 : 4.5) + 1.5;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: isIce
        ? Math.random() * 5 + 2
        : isStar
          ? Math.random() * 4 + 2
          : Math.random() * 3.5 + 1.5,
      color: isIce ? (Math.random() > 0.4 ? "#38bdf8" : "#ffffff") : color,
      alpha: 1,
      decay: Math.random() * 0.03 + (isIce ? 0.015 : 0.02),
      shape: isIce ? "crystal" : isStar ? "star" : "circle",
      rotation: Math.random() * Math.PI * 2,
    });
  }
  return particles;
}

export function updateParticles(particles: Particle[], dt: number): Particle[] {
  return particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      alpha: p.alpha - p.decay * dt,
    }))
    .filter((p) => p.alpha > 0);
}

export function updateShockwaves(
  shockwaves: Shockwave[],
  dt: number
): Shockwave[] {
  return shockwaves
    .map((s) => ({
      ...s,
      radius: s.radius + s.speed * dt,
      alpha: Math.max(0, 1 - s.radius / s.maxRadius),
    }))
    .filter((s) => s.alpha > 0.02 && s.radius < s.maxRadius);
}

export function updateFloatingTexts(
  texts: FloatingText[],
  dt: number
): FloatingText[] {
  return texts
    .map((f) => ({
      ...f,
      y: f.y + f.vy * dt,
      alpha: f.alpha - 0.02 * dt,
    }))
    .filter((f) => f.alpha > 0);
}

import { ArcadeEngine, ObjectPool } from "@/lib/arcade";

export interface LaserLoonSnapshot {
  mode: LaserMode;
  laserType: LaserType | string;
  gameState: LaserLoonState["gameState"];
  currentAct: number;
  actKills: number;
  score: number;
  highScore: number;
  combo: number;
  multiplier: number;
  timeLeft: number;
  ultimateMeter: number;
  loonPos: { x: number; y: number };
  aimPos: { x: number; y: number };
  targets: Target[];
  iceBlocks: IceBlock[];
  powerUps: PowerUp[];
  activeParticleCount: number;
  activeShockwaveCount: number;
}

export interface LaserLoonEngineConfig {
  mode?: LaserMode;
  laserType?: LaserType;
}

export class LaserLoonEngine extends ArcadeEngine<
  LaserLoonState,
  LaserLoonSnapshot
> {
  private readonly particlePool: ObjectPool<Particle>;
  private activeParticles: Particle[] = [];

  constructor(config: LaserLoonEngineConfig = {}) {
    const mode = config.mode ?? "campaign";
    const initialState = createInitialState(mode);
    if (config.laserType) {
      initialState.laserType = config.laserType;
    }
    super(initialState);

    this.particlePool = new ObjectPool<Particle>({
      initialCapacity: 100,
      maxCapacity: 300,
      overflowPolicy: "fifo",
      factory: () => ({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 3,
        color: "#ffffff",
        alpha: 1,
        decay: 0.02,
        shape: "circle",
        rotation: 0,
      }),
      reset: (p) => {
        p.x = 0;
        p.y = 0;
        p.vx = 0;
        p.vy = 0;
        p.alpha = 1;
        p.decay = 0.02;
        p.rotation = 0;
      },
    });
  }

  public override init(): void {
    // init
  }

  public startGame(): void {
    this.state.gameState = "playing";
    this.state.score = 0;
    this.state.combo = 0;
    this.state.multiplier = 1;
    this.state.targets = [];
    this.state.iceBlocks = [];
    this.state.powerUps = [];
    this.activeParticles = [];

    // Initial target spawn
    const { newTarget, nextId } = spawnTarget(
      [],
      1,
      DEFAULT_CANVAS_WIDTH,
      DEFAULT_CANVAS_HEIGHT,
      undefined,
      this.state.currentAct
    );
    this.state.targets.push(newTarget);
    this.state.nextTargetId = nextId;

    this.notifySubscribers();
  }

  public setAim(x: number, y: number): void {
    this.state.aimPos.x = x;
    this.state.aimPos.y = y;
  }

  public setLoonTargetY(y: number): void {
    this.state.loonPos.targetY = clamp(y, 40, DEFAULT_CANVAS_HEIGHT - 40);
  }

  public setLaserType(type: LaserType): void {
    this.state.laserType = type;
    this.notifySubscribers();
  }

  public spawnExplosion(
    x: number,
    y: number,
    color: string,
    count = 20,
    isIce = false,
    isStar = false
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.particlePool.acquire();
      if (p) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * (isIce ? 5.5 : 4.5) + 1.5;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.radius = isIce
          ? Math.random() * 5 + 2
          : isStar
            ? Math.random() * 4 + 2
            : Math.random() * 3.5 + 1.5;
        p.color = isIce ? (Math.random() > 0.4 ? "#38bdf8" : "#ffffff") : color;
        p.alpha = 1;
        p.decay = Math.random() * 0.03 + (isIce ? 0.015 : 0.02);
        p.shape = isIce ? "crystal" : isStar ? "star" : "circle";
        p.rotation = Math.random() * Math.PI * 2;
        this.activeParticles.push(p);
      }
    }
    this.notifySubscribers();
  }

  public launchIceBlock(x: number, y: number): void {
    const newIce: IceBlock = {
      id: this.state.nextIceId++,
      x,
      y,
      vx: 6.5,
      vy: (Math.random() - 0.5) * 2,
      size: 26,
      rotation: 0,
      vRot: (Math.random() - 0.5) * 0.1,
      hp: 1,
    };
    this.state.iceBlocks.push(newIce);
    this.notifySubscribers();
  }

  public override update(dt: number): void {
    if (this.state.gameState !== "playing") return;

    // Smooth Loon Y interpolation
    this.state.loonPos.y +=
      (this.state.loonPos.targetY - this.state.loonPos.y) *
      Math.min(1, 0.2 * dt * 60);

    // Update targets
    this.state.targets = this.state.targets
      .map((t) => ({
        ...t,
        x: t.x + t.vx * dt * 60,
        y: t.y + t.vy * dt * 60,
        pulsePhase: t.pulsePhase + 0.08 * dt * 60,
      }))
      .filter((t) => t.x > -100 && t.hp > 0);

    // Update ice blocks
    this.state.iceBlocks = this.state.iceBlocks
      .map((b) => ({
        ...b,
        x: b.x + b.vx * dt * 60,
        y: b.y + b.vy * dt * 60,
        rotation: b.rotation + b.vRot * dt * 60,
      }))
      .filter((b) => b.x < DEFAULT_CANVAS_WIDTH + 100);

    // Update particles via pool
    const survivingParticles: Particle[] = [];
    for (const p of this.activeParticles) {
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.alpha -= p.decay * dt * 60;
      if (p.alpha > 0) {
        survivingParticles.push(p);
      } else {
        this.particlePool.release(p);
      }
    }
    this.activeParticles = survivingParticles;
    this.invalidateSnapshot();
  }

  public override render(ctx: CanvasRenderingContext2D, _alpha: number): void {
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT);

    // Render Targets
    for (const t of this.state.targets) {
      ctx.fillStyle = t.color || "#ef4444";
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render Ice blocks
    for (const b of this.state.iceBlocks) {
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
    }

    // Render Particles
    for (const p of this.activeParticles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  public override createSnapshot(): LaserLoonSnapshot {
    return {
      mode: this.state.mode,
      laserType: this.state.laserType,
      gameState: this.state.gameState,
      currentAct: this.state.currentAct,
      actKills: this.state.actKills,
      score: this.state.score,
      highScore: this.state.highScore,
      combo: this.state.combo,
      multiplier: this.state.multiplier,
      timeLeft: this.state.timeLeft,
      ultimateMeter: this.state.ultimateMeter,
      loonPos: { x: this.state.loonPos.x, y: this.state.loonPos.y },
      aimPos: { x: this.state.aimPos.x, y: this.state.aimPos.y },
      targets: [...this.state.targets],
      iceBlocks: [...this.state.iceBlocks],
      powerUps: [...this.state.powerUps],
      activeParticleCount: this.activeParticles.length,
      activeShockwaveCount: this.state.shockwaves.length,
    };
  }
}

/** What a kill means for campaign progress. */
export type CampaignKillOutcome =
  "act-kill" | "act-victory" | "campaign-victory" | "no-credit";

/**
 * Classifies a campaign kill. Every weapon (lasers, the Cryo-Mortar and the
 * Tremolo ultimate) routes its kills through this, so a boss kill ends the
 * act whichever weapon landed it.
 *
 * @param target - The target that was just destroyed.
 * @param actNumber - The act being played.
 * @returns `act-kill` for a regular enemy, `act-victory` for a boss before
 *   the final act, `campaign-victory` for the final act's boss, and
 *   `no-credit` for a boss volley shot, which doesn't count toward the act.
 */
export function classifyCampaignKill(
  target: Pick<Target, "isBoss" | "isProjectile">,
  actNumber: number
): CampaignKillOutcome {
  if (target.isProjectile) return "no-credit";
  if (!target.isBoss) return "act-kill";
  const finalAct = CAMPAIGN_ACTS[CAMPAIGN_ACTS.length - 1]?.actNumber ?? 4;
  return actNumber >= finalAct ? "campaign-victory" : "act-victory";
}

/**
 * Frames between a boss's volleys: shorter in later acts, and shorter again
 * once the boss drops below half HP.
 *
 * @param actNumber - The act being played.
 * @param bossPhase - 1 above half HP, 2 at or below it.
 */
export function getBossAttackInterval(
  actNumber: number,
  bossPhase = 1
): number {
  const base =
    BOSS_ATTACK_BASE_FRAMES -
    BOSS_ATTACK_FRAMES_PER_ACT * (Math.max(1, actNumber) - 1);
  const scaled = bossPhase >= 2 ? base * BOSS_PHASE_TWO_INTERVAL_SCALE : base;
  return Math.max(BOSS_ATTACK_MIN_FRAMES, Math.round(scaled));
}

/**
 * True while a boss is winding up its next volley, so the game can warn the
 * player before the shots leave.
 *
 * @param boss - The boss target.
 * @param actNumber - The act being played.
 */
export function isBossTelegraphing(
  boss: Pick<Target, "isBoss" | "bossPhase" | "specialAttackTimer">,
  actNumber: number
): boolean {
  if (!boss.isBoss) return false;
  const interval = getBossAttackInterval(actNumber, boss.bossPhase ?? 1);
  return (boss.specialAttackTimer ?? 0) >= interval - BOSS_TELEGRAPH_FRAMES;
}

/**
 * A boss's signature attack, from its type. Anything that is not one of the
 * four campaign bosses fires the plain aimed volley the swarm builds on.
 *
 * @param type - The boss's enemy type.
 */
export function getBossSignature(type: CivicEnemyType): BossSignature {
  switch (type) {
    case "butter-colossus":
      return "lob";
    case "starflake-boss":
      return "burst";
    case "gavel-sovereign":
      return "wall";
    default:
      return "swarm";
  }
}

/** One line per signature for the act intro, so the player knows the plan. */
export const BOSS_SIGNATURE_HINTS: Record<BossSignature, string> = {
  swarm: "Calls in mosquito swarms. Clear them fast or get boxed in.",
  lob: "Lobs butter pats in high arcs. Watch where they come down.",
  burst:
    "Fires star bursts in every direction behind a turning shield. Shoot through the open side, or use the Tremolo.",
  wall: "Slams walls of amendments across the room. Fly through the gap.",
};

/**
 * True when the Starflake's shield arc faces a beam's origin, which turns
 * the beam away. The shield turns with the boss's `shieldAngle`, so it opens
 * and closes as it spins.
 *
 * @param target - Any target; only the Starflake has a shield.
 * @param fromX - The beam's origin x.
 * @param fromY - The beam's origin y.
 */
export function isShieldFacing(
  target: Pick<Target, "type" | "isBoss" | "x" | "y" | "shieldAngle">,
  fromX: number,
  fromY: number
): boolean {
  if (!target.isBoss || getBossSignature(target.type) !== "burst") return false;
  const toward = Math.atan2(fromY - target.y, fromX - target.x);
  const diff = Math.atan2(
    Math.sin(toward - (target.shieldAngle ?? 0)),
    Math.cos(toward - (target.shieldAngle ?? 0))
  );
  return Math.abs(diff) < STARFLAKE_SHIELD_HALF_ARC;
}

/** The result of advancing a boss's attack pattern by one frame. */
export interface BossAttackResult {
  /** The targets with the boss updated and any volley shots appended. */
  targets: Target[];
  /** The next free target id. */
  nextId: number;
  /** True on the frame a volley leaves the boss. */
  fired: boolean;
  /** True on the frame the boss enters phase 2. */
  enteredPhaseTwo: boolean;
}

/**
 * Advances the live boss's attack timer and fires a volley aimed at the loon
 * when it runs out. Later acts and phase 2 (at or below half HP) fire more
 * often and add shots; phase 2 also speeds up the boss's flight. A frozen
 * boss neither winds up nor fires.
 *
 * @param targets - All live targets, including the boss.
 * @param dt - Frame delta, in 60 fps frames.
 * @param loonX - The loon's x position.
 * @param loonY - The loon's y position.
 * @param actNumber - The act being played.
 * @param nextId - The next free target id.
 * @param rng - Random source for swarm drift and wall gaps, injectable for tests.
 */
export function updateBossAttack(
  targets: Target[],
  dt: number,
  loonX: number,
  loonY: number,
  actNumber: number,
  nextId: number,
  rng: () => number = Math.random
): BossAttackResult {
  const index = targets.findIndex((t) => t.isBoss && t.hp > 0);
  const idle: BossAttackResult = {
    targets,
    nextId,
    fired: false,
    enteredPhaseTwo: false,
  };
  if (index === -1) return idle;

  const boss = { ...targets[index] };
  let enteredPhaseTwo = false;
  if ((boss.bossPhase ?? 1) < 2 && boss.hp <= boss.maxHp / 2) {
    boss.bossPhase = 2;
    boss.vy *= 1.5;
    enteredPhaseTwo = true;
  }

  const nextTargets = [...targets];
  nextTargets[index] = boss;
  if (boss.frozenTimer > 0) {
    return { ...idle, targets: nextTargets, enteredPhaseTwo };
  }

  boss.specialAttackTimer = (boss.specialAttackTimer ?? 0) + dt;
  const interval = getBossAttackInterval(actNumber, boss.bossPhase ?? 1);
  if (boss.specialAttackTimer < interval) {
    return { ...idle, targets: nextTargets, enteredPhaseTwo };
  }
  boss.specialAttackTimer = 0;

  const phaseTwo = (boss.bossPhase ?? 1) >= 2;
  const volley = boss.volleyCount ?? 0;
  boss.volleyCount = volley + 1;
  let id = nextId;
  const shot = (
    x: number,
    y: number,
    vx: number,
    vy: number,
    extra: Partial<Target> = {}
  ): Target => ({
    id: id++,
    x,
    y,
    vx,
    vy,
    radius: BOSS_PROJECTILE_RADIUS,
    type: boss.type,
    label: "",
    color: boss.color,
    hp: 1,
    maxHp: 1,
    points: 5,
    pulsePhase: 0,
    frozenTimer: 0,
    isProjectile: true,
    ...extra,
  });
  const mouthX = boss.x - boss.radius;
  const aimedVolley = (count: number) => {
    const speed = 3.5 + 0.5 * Math.max(1, actNumber);
    const aim = Math.atan2(loonY - boss.y, loonX - boss.x);
    for (let i = 0; i < count; i++) {
      const angle = aim + (i - (count - 1) / 2) * 0.22;
      nextTargets.push(
        shot(mouthX, boss.y, Math.cos(angle) * speed, Math.sin(angle) * speed)
      );
    }
  };

  switch (getBossSignature(boss.type)) {
    case "swarm": {
      // The Queen fires as before and calls mosquitoes to box the loon in.
      aimedVolley(phaseTwo ? 2 : 1);
      const template = ENEMY_TYPES.find((e) => e.type === "mosquito");
      const alive = nextTargets.filter(
        (t) => !t.isBoss && !t.isProjectile && t.type === "mosquito"
      ).length;
      const calls = Math.min(phaseTwo ? 3 : 2, SWARM_MAX_MINIONS - alive);
      for (let i = 0; template && i < calls; i++) {
        nextTargets.push({
          id: id++,
          x: boss.x - boss.radius,
          y: boss.y + (i - (calls - 1) / 2) * 46,
          vx: -(2 + rng() * 0.8),
          vy: (rng() - 0.5) * 1.6,
          radius: template.radius,
          type: template.type,
          label: template.label,
          color: template.color,
          hp: template.hp,
          maxHp: template.hp,
          points: template.points,
          pulsePhase: rng() * Math.PI * 2,
          frozenTimer: 0,
        });
      }
      break;
    }
    case "lob": {
      // Butter pats arc up and come down where the loon is, or just past it.
      const pats = phaseTwo ? 3 : 2;
      const ay = 0.12;
      for (let i = 0; i < pats; i++) {
        const frames = 64 + i * 16;
        const vx = (loonX - mouthX) / frames;
        const vy = (loonY - boss.y - 0.5 * ay * frames * frames) / frames;
        nextTargets.push(
          shot(mouthX, boss.y, vx, vy, { ay, radius: BOSS_PROJECTILE_RADIUS + 3 })
        );
      }
      break;
    }
    case "burst": {
      // Star bursts in every direction, turned a little each volley.
      const count = phaseTwo ? 12 : 8;
      const offset = volley * 0.35;
      for (let i = 0; i < count; i++) {
        const angle = offset + (i * Math.PI * 2) / count;
        nextTargets.push(
          shot(boss.x, boss.y, Math.cos(angle) * 2.8, Math.sin(angle) * 2.8)
        );
      }
      break;
    }
    case "wall": {
      // Phase 2 alternates a wall with an aimed volley.
      if (phaseTwo && volley % 2 === 1) {
        aimedVolley(3);
        break;
      }
      const top = 50 + GAVEL_WALL_GAP / 2;
      const bottom = DEFAULT_CANVAS_HEIGHT - 50 - GAVEL_WALL_GAP / 2;
      const gapCenter = top + rng() * (bottom - top);
      for (let y = 18; y < DEFAULT_CANVAS_HEIGHT; y += 30) {
        if (Math.abs(y - gapCenter) < GAVEL_WALL_GAP / 2) continue;
        nextTargets.push(shot(mouthX, y, -2.4, 0));
      }
      break;
    }
  }

  return { targets: nextTargets, nextId: id, fired: true, enteredPhaseTwo };
}

/** What the campaign HUD shows beside the act number. */
export interface ActProgressReadout {
  label: "Kills" | "Boss";
  value: string;
}

/**
 * The act's progress for the HUD: kills against the quota, clamped so a
 * minion shot during the boss fight never reads 12/8, then the boss's HP
 * once it is up.
 *
 * @param actKills - Minion kills this act.
 * @param requiredKills - The act's minion quota.
 * @param boss - Whether the boss is up, and its HP.
 */
export function getActProgressReadout(
  actKills: number,
  requiredKills: number,
  boss: { active: boolean; hp: number; maxHp: number }
): ActProgressReadout {
  if (boss.active) {
    return {
      label: "Boss",
      value: `${Math.max(0, Math.ceil(boss.hp))}/${boss.maxHp} HP`,
    };
  }
  const shown = clamp(actKills, 0, requiredKills);
  return { label: "Kills", value: `${shown}/${requiredKills}` };
}

/**
 * Where a keyboard shot aims: a soft lock on the nearest live enemy within
 * a narrow cone ahead of the loon, preferring real enemies over incoming
 * shots, or straight ahead when nothing is in the cone. Keyboard players
 * have no pointer, so they aim by flying into line.
 *
 * @param targets - All live targets.
 * @param eyeX - The laser's origin x.
 * @param eyeY - The laser's origin y.
 * @param width - The canvas width.
 */
export function pickKeyboardAim(
  targets: readonly Target[],
  eyeX: number,
  eyeY: number,
  width = DEFAULT_CANVAS_WIDTH
): { x: number; y: number } {
  let best: Target | null = null;
  let bestScore = Infinity;
  for (const t of targets) {
    if (t.hp <= 0 || t.x <= eyeX || t.x > width + t.radius) continue;
    const reach = Math.atan2(Math.abs(t.y - eyeY) - t.radius, t.x - eyeX);
    if (reach > KEYBOARD_AIM_CONE_RADIANS) continue;
    const distance = Math.hypot(t.x - eyeX, t.y - eyeY);
    const score = t.isProjectile ? distance + 10_000 : distance;
    if (score < bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best ? { x: best.x, y: best.y } : { x: width - 20, y: eyeY };
}

/** Result of one frame of minion fire. */
export interface MinionFireResult {
  targets: Target[];
  nextId: number;
  fired: number;
}

/**
 * From Act 3 on, minions ahead of the loon shoot back: each on its own
 * timer, staggered by a random start, with a cap on shots in the air. Frozen
 * minions and the boss (which has its own volleys) do not fire here.
 *
 * @param targets - All live targets.
 * @param dt - Frame delta, in 60 fps frames.
 * @param loonX - The loon's x position.
 * @param loonY - The loon's y position.
 * @param actNumber - The act being played.
 * @param nextId - The next free target id.
 * @param rng - Random source, injectable for tests.
 */
export function updateMinionFire(
  targets: Target[],
  dt: number,
  loonX: number,
  loonY: number,
  actNumber: number,
  nextId: number,
  rng: () => number = Math.random
): MinionFireResult {
  if (actNumber < MINION_FIRE_FIRST_ACT) {
    return { targets, nextId, fired: 0 };
  }
  const interval = Math.max(
    60,
    MINION_FIRE_BASE_FRAMES -
      MINION_FIRE_FRAMES_PER_ACT * (actNumber - MINION_FIRE_FIRST_ACT)
  );
  let inAir = targets.filter((t) => t.isProjectile && !t.isBoss).length;
  let id = nextId;
  let fired = 0;
  const shots: Target[] = [];
  const next = targets.map((t) => {
    if (t.isBoss || t.isProjectile || t.hp <= 0 || t.frozenTimer > 0) {
      return t;
    }
    const m = { ...t };
    m.fireTimer = (m.fireTimer ?? -rng() * interval) + dt;
    if (m.fireTimer < interval) return m;
    m.fireTimer = 0;
    if (inAir >= MINION_FIRE_MAX_SHOTS || m.x < loonX + MINION_FIRE_MIN_LEAD) {
      return m;
    }
    const aim = Math.atan2(loonY - m.y, loonX - m.x);
    shots.push({
      id: id++,
      x: m.x - m.radius,
      y: m.y,
      vx: Math.cos(aim) * MINION_SHOT_SPEED,
      vy: Math.sin(aim) * MINION_SHOT_SPEED,
      radius: MINION_SHOT_RADIUS,
      type: m.type,
      label: "",
      color: m.color,
      hp: 1,
      maxHp: 1,
      points: 5,
      pulsePhase: 0,
      frozenTimer: 0,
      isProjectile: true,
    });
    inAir += 1;
    fired += 1;
    return m;
  });
  return { targets: [...next, ...shots], nextId: id, fired };
}

/**
 * Stars for a cleared act: one for clearing it, one for beating its par
 * time, and one for losing no hits.
 *
 * @param clearSeconds - Seconds of unpaused play the act took.
 * @param parSeconds - The act's par time.
 * @param hitsLost - Hits the loon took during the act.
 */
export function getActStars(
  clearSeconds: number,
  parSeconds: number,
  hitsLost: number
): 1 | 2 | 3 {
  let stars = 1;
  if (clearSeconds <= parSeconds) stars += 1;
  if (hitsLost <= 0) stars += 1;
  return stars as 1 | 2 | 3;
}

/** Storage key for each act's best stars and clear time. */
export const LASER_LOON_STARS_KEY = "laser_loon_act_stars_v1";

/** One act's best result across runs. */
export interface ActBest {
  /** Most stars earned on the act, 1 to 3. */
  stars: 1 | 2 | 3;
  /** Fastest clear, in whole seconds. */
  bestSeconds: number;
}

/** Best results keyed by act number. */
export type ActBestRecord = Partial<Record<number, ActBest>>;

/** What a cleared act changed in the saved record. */
export interface ActBestMerge {
  record: ActBestRecord;
  /** True when the act earned more stars than ever before. */
  newStars: boolean;
  /** True when the act was cleared faster than ever before. */
  newTime: boolean;
}

/**
 * Reads the saved act bests, dropping anything malformed so a damaged entry
 * never breaks the cabinet.
 *
 * @param raw - The stored JSON, or null when nothing is saved.
 */
export function parseActBestRecord(raw: string | null): ActBestRecord {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const record: ActBestRecord = {};
  for (const act of CAMPAIGN_ACTS) {
    const entry = (data as Record<string, unknown>)[String(act.actNumber)];
    if (!entry || typeof entry !== "object") continue;
    const { stars, bestSeconds } = entry as Record<string, unknown>;
    if (
      (stars === 1 || stars === 2 || stars === 3) &&
      typeof bestSeconds === "number" &&
      Number.isFinite(bestSeconds) &&
      bestSeconds >= 0
    ) {
      record[act.actNumber] = { stars, bestSeconds: Math.round(bestSeconds) };
    }
  }
  return record;
}

/**
 * Folds a cleared act into the saved bests, keeping the most stars and the
 * fastest time independently.
 *
 * @param record - The saved bests.
 * @param actNumber - The act just cleared.
 * @param stars - Stars earned this clear.
 * @param seconds - Seconds this clear took.
 */
export function mergeActBest(
  record: ActBestRecord,
  actNumber: number,
  stars: 1 | 2 | 3,
  seconds: number
): ActBestMerge {
  const previous = record[actNumber];
  const clearSeconds = Math.max(0, Math.round(seconds));
  const newStars = !previous || stars > previous.stars;
  const newTime = !previous || clearSeconds < previous.bestSeconds;
  return {
    record: {
      ...record,
      [actNumber]: {
        stars: previous ? (Math.max(previous.stars, stars) as 1 | 2 | 3) : stars,
        bestSeconds: previous
          ? Math.min(previous.bestSeconds, clearSeconds)
          : clearSeconds,
      },
    },
    newStars,
    newTime,
  };
}

/** The shape of an Arcade Survival run at a moment in time. */
export interface SurvivalWave {
  /** Zero-based wave index. */
  wave: number;
  /** The campaign act whose enemy roster this wave fields, 1 to 4. */
  rosterAct: number;
  /** The wave's short name for the HUD. */
  label: "Lake" | "Fair" | "Hearing" | "Capitol";
  /** Chance per 60 fps frame of spawning an enemy. */
  spawnChance: number;
  /** Most enemies on screen at once. */
  maxTargets: number;
  /**
   * The act number fed to minion fire, or 0 while minions hold fire. Higher
   * levels fire more often (see `updateMinionFire`).
   */
  fireLevel: number;
}

const SURVIVAL_WAVE_LABELS = ["Lake", "Fair", "Hearing", "Capitol"] as const;

/**
 * Arcade Survival's ramp: every wave fields the next act's roster (Lake, Fair,
 * Hearing, Capitol, then round again), spawns come faster and in larger
 * crowds until full heat, and from the second wave on the minions shoot back,
 * more often each wave.
 *
 * @param elapsedSeconds - Seconds of unpaused survival so far.
 */
export function getSurvivalWave(elapsedSeconds: number): SurvivalWave {
  const seconds = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0);
  const wave = Math.floor(seconds / SURVIVAL_WAVE_SECONDS);
  const rosterIndex = wave % SURVIVAL_WAVE_LABELS.length;
  const heat = Math.min(1, seconds / SURVIVAL_FULL_HEAT_SECONDS);
  return {
    wave,
    rosterAct: rosterIndex + 1,
    label: SURVIVAL_WAVE_LABELS[rosterIndex],
    spawnChance: 0.03 + 0.035 * heat,
    maxTargets: 5 + Math.round(4 * heat),
    fireLevel:
      wave === 0
        ? 0
        : Math.min(MINION_FIRE_FIRST_ACT + 3, MINION_FIRE_FIRST_ACT + wave - 1),
  };
}

/**
 * Total stars in a record, out of three per campaign act.
 *
 * @param record - Saved bests, or one run's stars in the same shape.
 */
export function countActStars(record: ActBestRecord): number {
  return CAMPAIGN_ACTS.reduce(
    (sum, act) => sum + (record[act.actNumber]?.stars ?? 0),
    0
  );
}

/**
 * Seconds as a run clock, such as 1:05.
 *
 * @param totalSeconds - Whole or fractional seconds; negatives read as 0.
 */
export function formatRunClock(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
