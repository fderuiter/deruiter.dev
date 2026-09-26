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
} from "./types";
import {
  ENEMY_TYPES,
  WEAPONS,
  CAMPAIGN_ACTS,
  POWER_UP_CONFIGS,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  ARCADE_GAME_DURATION_SECS,
  COMBO_TIMEOUT_MS,
  MAX_MULTIPLIER,
  ULTIMATE_CHARGE_PER_KILL,
  LOON_HIT_RADIUS,
  LOON_INVULNERABLE_MS,
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
    timeLeft: mode === "arcade" ? ARCADE_GAME_DURATION_SECS : 999,
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
    specialAttackTimer: 0,
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
        const dmg = target.isBoss ? 2 : 3;
        target.hp -= dmg;
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
    .filter((t) => t.hp > 0 && (t.isBoss || t.x > -60))
    .map((t) => {
      const nextT = { ...t };

      if (nextT.frozenTimer > 0) {
        nextT.frozenTimer = Math.max(0, nextT.frozenTimer - 1 * dt);
        return nextT;
      }

      nextT.pulsePhase += 0.05 * dt;

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
  damagedPoints: Array<{ x: number; y: number; color: string }>;
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
  const damagedPoints: Array<{ x: number; y: number; color: string }> = [];

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
        const nextHp = t.hp - damage;
        damagedPoints.push({ x: nearX, y: nearY, color: t.color });

        if (t.isBoss) {
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
