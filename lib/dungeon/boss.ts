/**
 * Cybersecurity Multi-Phase Wireframe Boss Engine & 3D Vector Projection
 */

import { BossState, MeshProjectile, Vec3, WireframeMesh } from "./types";

/**
 * Creates the low-polygon wireframe 3D face mesh.
 */
export function createFaceMesh(): WireframeMesh {
  const vertices: Vec3[] = [
    { x: -0.6, y: -0.9, z: 0.2 },
    { x: 0.0, y: -1.0, z: 0.4 },
    { x: 0.6, y: -0.9, z: 0.2 },
    { x: -0.8, y: -0.4, z: 0.0 },
    { x: -0.3, y: -0.5, z: 0.5 },
    { x: 0.3, y: -0.5, z: 0.5 },
    { x: 0.8, y: -0.4, z: 0.0 },
    { x: -0.4, y: -0.2, z: 0.4 },
    { x: 0.4, y: -0.2, z: 0.4 },
    { x: 0.0, y: -0.2, z: 0.7 },
    { x: 0.0, y: 0.2, z: 0.9 },
    { x: -0.7, y: 0.1, z: 0.1 },
    { x: 0.7, y: 0.1, z: 0.1 },
    { x: -0.4, y: 0.5, z: 0.4 },
    { x: 0.0, y: 0.5, z: 0.5 },
    { x: 0.4, y: 0.5, z: 0.4 },
    { x: -0.5, y: 0.8, z: 0.1 },
    { x: 0.0, y: 0.9, z: 0.4 },
    { x: 0.5, y: 0.8, z: 0.1 },
  ];

  const edges = [
    { p1: 0, p2: 1 },
    { p1: 1, p2: 2 },
    { p1: 0, p2: 3 },
    { p1: 1, p2: 4 },
    { p1: 1, p2: 5 },
    { p1: 2, p2: 6 },
    { p1: 3, p2: 4 },
    { p1: 4, p2: 5 },
    { p1: 5, p2: 6 },
    { p1: 4, p2: 7 },
    { p1: 5, p2: 8 },
    { p1: 4, p2: 9 },
    { p1: 5, p2: 9 },
    { p1: 9, p2: 10 },
    { p1: 3, p2: 11 },
    { p1: 6, p2: 12 },
    { p1: 7, p2: 11 },
    { p1: 8, p2: 12 },
    { p1: 10, p2: 14 },
    { p1: 11, p2: 13 },
    { p1: 12, p2: 15 },
    { p1: 13, p2: 14 },
    { p1: 14, p2: 15 },
    { p1: 13, p2: 16 },
    { p1: 14, p2: 17 },
    { p1: 15, p2: 18 },
    { p1: 16, p2: 17 },
    { p1: 17, p2: 18 },
  ];

  return {
    vertices,
    edges,
    rotation: { x: 0, y: 0, z: 0 },
    rotSpeed: { x: 0.015, y: 0.025, z: 0.008 },
    color: "#ec4899",
    scale: 24,
  };
}

/**
 * Creates an Octahedron 3D mesh for Security Daemons.
 */
export function createOctahedronMesh(
  color: string = "#38bdf8",
  scale: number = 22
): WireframeMesh {
  const vertices: Vec3[] = [
    { x: 0, y: -1.2, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: -1 },
    { x: 0, y: 1.2, z: 0 },
  ];

  const edges = [
    { p1: 0, p2: 1 },
    { p1: 0, p2: 2 },
    { p1: 0, p2: 3 },
    { p1: 0, p2: 4 },
    { p1: 5, p2: 1 },
    { p1: 5, p2: 2 },
    { p1: 5, p2: 3 },
    { p1: 5, p2: 4 },
    { p1: 1, p2: 2 },
    { p1: 2, p2: 3 },
    { p1: 3, p2: 4 },
    { p1: 4, p2: 1 },
  ];

  return {
    vertices,
    edges,
    rotation: { x: 0, y: 0, z: 0 },
    rotSpeed: { x: 0.02, y: 0.03, z: 0.01 },
    color,
    scale,
  };
}

/**
 * Creates 3D cube mesh for projectiles.
 */
export function createCubeMesh(
  color: string = "#f43f5e",
  scale: number = 8
): WireframeMesh {
  const vertices: Vec3[] = [
    { x: -1, y: -1, z: -1 },
    { x: 1, y: -1, z: -1 },
    { x: 1, y: 1, z: -1 },
    { x: -1, y: 1, z: -1 },
    { x: -1, y: -1, z: 1 },
    { x: 1, y: -1, z: 1 },
    { x: 1, y: 1, z: 1 },
    { x: -1, y: 1, z: 1 },
  ];

  const edges = [
    { p1: 0, p2: 1 },
    { p1: 1, p2: 2 },
    { p1: 2, p2: 3 },
    { p1: 3, p2: 0 },
    { p1: 4, p2: 5 },
    { p1: 5, p2: 6 },
    { p1: 6, p2: 7 },
    { p1: 7, p2: 4 },
    { p1: 0, p2: 4 },
    { p1: 1, p2: 5 },
    { p1: 2, p2: 6 },
    { p1: 3, p2: 7 },
  ];

  return {
    vertices,
    edges,
    rotation: { x: 0, y: 0, z: 0 },
    rotSpeed: { x: 0.05, y: 0.08, z: 0.03 },
    color,
    scale,
  };
}

/**
 * Creates 3D tetrahedron/pyramid mesh for high-velocity projectiles.
 */
export function createTetrahedronMesh(
  color: string = "#a855f7",
  scale: number = 7
): WireframeMesh {
  const vertices: Vec3[] = [
    { x: 0, y: -1, z: 0 },
    { x: -1, y: 1, z: -1 },
    { x: 1, y: 1, z: -1 },
    { x: 0, y: 1, z: 1 },
  ];

  const edges = [
    { p1: 0, p2: 1 },
    { p1: 0, p2: 2 },
    { p1: 0, p2: 3 },
    { p1: 1, p2: 2 },
    { p1: 2, p2: 3 },
    { p1: 3, p2: 1 },
  ];

  return {
    vertices,
    edges,
    rotation: { x: 0, y: 0, z: 0 },
    rotSpeed: { x: 0.08, y: 0.12, z: 0.06 },
    color,
    scale,
  };
}

/**
 * Rotates a 3D vertex around X, Y, and Z axes.
 */
export function rotate3D(v: Vec3, rot: Vec3): Vec3 {
  const radX = rot.x;
  const y1 = v.y * Math.cos(radX) - v.z * Math.sin(radX);
  const z1 = v.y * Math.sin(radX) + v.z * Math.cos(radX);

  const radY = rot.y;
  const x2 = v.x * Math.cos(radY) + z1 * Math.sin(radY);
  const z2 = -v.x * Math.sin(radY) + z1 * Math.cos(radY);

  const radZ = rot.z;
  const x3 = x2 * Math.cos(radZ) - y1 * Math.sin(radZ);
  const y3 = x2 * Math.sin(radZ) + y1 * Math.cos(radZ);

  return { x: x3, y: y3, z: z2 };
}

/**
 * Projects a 3D rotated vertex onto a 2D screen coordinate.
 */
export function project3DTo2D(
  v: Vec3,
  screenCenterX: number,
  screenCenterY: number,
  scale: number,
  cameraDistance: number = 3.5
): { x: number; y: number; z: number } {
  const z = v.z + cameraDistance;
  const factor = z > 0 ? (cameraDistance / z) * scale : scale;
  return {
    x: screenCenterX + v.x * factor,
    y: screenCenterY + v.y * factor,
    z,
  };
}

/**
 * Renders a wireframe 3D mesh onto a 2D canvas context.
 */
export function renderWireframeMesh(
  ctx: CanvasRenderingContext2D,
  mesh: WireframeMesh,
  centerX: number,
  centerY: number,
  glow: boolean = true
): void {
  const rotated = mesh.vertices.map((v) => rotate3D(v, mesh.rotation));
  const projected = rotated.map((v) =>
    project3DTo2D(v, centerX, centerY, mesh.scale)
  );

  ctx.save();
  ctx.strokeStyle = mesh.color;
  ctx.lineWidth = 1.2;

  if (glow) {
    ctx.shadowColor = mesh.color;
    ctx.shadowBlur = 6;
  }

  mesh.edges.forEach((edge) => {
    const p1 = projected[edge.p1];
    const p2 = projected[edge.p2];
    if (!p1 || !p2) return;

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  });

  ctx.fillStyle = mesh.color;
  projected.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

/**
 * Initializes the FaceForge 3D / Legacy Boss State.
 */
export function createFaceForgeBoss(gridX: number, gridY: number): BossState {
  return {
    name: "faceforge_3d :: Untranslated Vertex Daemon",
    hp: 300,
    maxHp: 300,
    phase: 1,
    x: gridX,
    y: gridY,
    mesh: createFaceMesh(),
    projectiles: [],
    lastSalvoTime: 0,
    attackIntervalMs: 1600,
    defeated: false,
    phaseTitle: "PHASE 1: WIREFRAME PROBE",
    kind: "faceforge",
  };
}

/**
 * Initializes the NEURAL_WARDEN_v9 Sovereign Boss State.
 */
export function createNeuralWardenBoss(
  gridX: number,
  gridY: number
): BossState {
  return {
    name: "NEURAL_WARDEN_v9 :: Sovereign Kernel Core",
    hp: 450,
    maxHp: 450,
    phase: 1,
    x: gridX,
    y: gridY,
    mesh: createOctahedronMesh("#a855f7", 26),
    projectiles: [],
    lastSalvoTime: 0,
    attackIntervalMs: NEURAL_WARDEN_PHASES[1].attackIntervalMs,
    defeated: false,
    phaseTitle: NEURAL_WARDEN_PHASES[1].title,
    kind: "neural_warden",
  };
}

/**
 * How long a boss holds fire after its room loads, so the player can see the
 * arena and move before the first volley.
 */
export const BOSS_OPENING_GRACE_MS = 2000;

/**
 * Readies a boss for a room that has just loaded: no salvo until
 * `BOSS_OPENING_GRACE_MS` after `nowMs`.
 *
 * @param boss - The boss as generated for the room.
 * @param nowMs - The current animation-frame clock (`performance.now()`).
 * @returns The boss with its opening hold set.
 */
export function armBossForRoomEntry(boss: BossState, nowMs: number): BossState {
  return {
    ...boss,
    holdFireUntilMs: nowMs + BOSS_OPENING_GRACE_MS,
    projectiles: [],
    salvoCount: 0,
  };
}

/**
 * Most tiles a boss shot leads a moving player by.
 */
export const BOSS_MAX_LEAD_TILES = 3;

/**
 * Picks the point a boss salvo aims at. With no heading it is the player's
 * tile; with one it is ahead of the player along that heading, by half the
 * distance to the boss (a shot takes longer to reach a far player), capped at
 * `BOSS_MAX_LEAD_TILES`.
 *
 * @param boss - The boss firing the salvo.
 * @param playerX - The player's column.
 * @param playerY - The player's row.
 * @param playerHeading - The player's last step, if they are moving.
 * @returns The grid point to aim at.
 */
export function getBossAimPoint(
  boss: Pick<BossState, "x" | "y">,
  playerX: number,
  playerY: number,
  playerHeading?: { dx: number; dy: number }
): { x: number; y: number } {
  if (!playerHeading || (playerHeading.dx === 0 && playerHeading.dy === 0)) {
    return { x: playerX, y: playerY };
  }
  const distance = Math.hypot(playerX - boss.x, playerY - boss.y);
  const lead = Math.min(BOSS_MAX_LEAD_TILES, distance * 0.5);
  return {
    x: playerX + Math.sign(playerHeading.dx) * lead,
    y: playerY + Math.sign(playerHeading.dy) * lead,
  };
}

/**
 * The frame length boss projectile speeds and mesh spin rates are tuned for:
 * a projectile's `vx` and `vy` are tiles per 60 Hz frame.
 */
export const BOSS_REFERENCE_FRAME_MS = 1000 / 60;

/**
 * Updates boss animations, attack patterns, and projectile trajectories.
 *
 * @param frameDeltaMs - Real time since the previous update. Projectiles and
 * mesh spin advance in proportion to it, so volleys travel at the same speed
 * on a 60 Hz and a 144 Hz display (#1665). Defaults to one 60 Hz frame.
 * @param blocksShot - Whether the tile at a column and row stops a
 * projectile. Walls give the player cover; without it shots cross the room.
 */
export function updateFaceForgeBoss(
  boss: BossState,
  playerX: number,
  playerY: number,
  nowMs: number,
  gridWidth: number,
  gridHeight: number,
  playerHeading?: { dx: number; dy: number },
  frameDeltaMs: number = BOSS_REFERENCE_FRAME_MS,
  blocksShot?: (col: number, row: number) => boolean
): {
  updatedBoss: BossState;
  spawnedDamage: number;
} {
  if (boss.defeated) return { updatedBoss: boss, spawnedDamage: 0 };

  // #1321: aim where the player is heading, not where they stand, so a
  // player walking past the boss is not missed by every shot.
  const aim = getBossAimPoint(boss, playerX, playerY, playerHeading);
  const frames = Math.max(0, frameDeltaMs) / BOSS_REFERENCE_FRAME_MS;

  const nextMesh: WireframeMesh = {
    ...boss.mesh,
    rotation: {
      x: boss.mesh.rotation.x + boss.mesh.rotSpeed.x * frames,
      y: boss.mesh.rotation.y + boss.mesh.rotSpeed.y * frames,
      z: boss.mesh.rotation.z + boss.mesh.rotSpeed.z * frames,
    },
  };

  const hpRatio = boss.hp / boss.maxHp;
  let phase: 1 | 2 | 3 = 1;
  let attackIntervalMs = 1800;
  let phaseTitle = "PHASE 1: SCANNING";

  if (hpRatio <= 0.34) {
    phase = 3;
    attackIntervalMs = 900;
    nextMesh.color = "#ef4444";
    phaseTitle = "PHASE 3: KERNEL MELTDOWN";
  } else if (hpRatio <= 0.67) {
    phase = 2;
    attackIntervalMs = 1300;
    nextMesh.color = "#f59e0b";
    phaseTitle = "PHASE 2: FIREWALL OVERCHARGE";
  } else {
    phase = 1;
    attackIntervalMs = 1700;
    nextMesh.color = "#ec4899";
    phaseTitle = "PHASE 1: PROBE VOLLEY";
  }

  const newProjectiles = [...boss.projectiles];
  const holding =
    boss.holdFireUntilMs !== undefined && nowMs < boss.holdFireUntilMs;
  if (holding) phaseTitle = "BOOTING :: FIND COVER";
  const fires = !holding && nowMs - boss.lastSalvoTime >= attackIntervalMs;
  const salvoCount = boss.salvoCount ?? 0;

  if (fires) {
    if (phase === 1 && salvoCount % 3 === 2) {
      // Every third phase-1 salvo is a slow ring, so no single row or
      // column of the arena is safe to stand in.
      const speed = 0.06;
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4 + Math.PI / 8;
        newProjectiles.push({
          id: `mesh-ring-${nowMs}-${i}`,
          x: boss.x,
          y: boss.y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          mesh: createCubeMesh("#f43f5e", 6),
          damage: 15,
          alive: true,
        });
      }
    } else if (phase === 1) {
      // A narrow fan of three covers a step to either side of the aim point.
      const baseAngle = Math.atan2(aim.y - boss.y, aim.x - boss.x);
      const speed = 0.08;
      [baseAngle - 0.2, baseAngle, baseAngle + 0.2].forEach((angle, idx) => {
        newProjectiles.push({
          id: `mesh-cube-${nowMs}-${idx + 1}`,
          x: boss.x,
          y: boss.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          mesh: createCubeMesh("#f43f5e", 7),
          damage: 15,
          alive: true,
        });
      });
    } else if (phase === 2) {
      const baseAngle = Math.atan2(aim.y - boss.y, aim.x - boss.x);
      const spreadAngles = [
        baseAngle - 0.4,
        baseAngle - 0.2,
        baseAngle,
        baseAngle + 0.2,
        baseAngle + 0.4,
      ];
      const speed = 0.11;

      spreadAngles.forEach((ang, idx) => {
        newProjectiles.push({
          id: `mesh-shard-${nowMs}-${idx}`,
          x: boss.x,
          y: boss.y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          mesh: createCubeMesh("#f59e0b", 6),
          damage: 18,
          alive: true,
        });
      });
    } else {
      const numRays = 6;
      const speed = 0.12;
      for (let i = 0; i < numRays; i++) {
        const ang = (i * 2 * Math.PI) / numRays + ((nowMs / 500) % Math.PI);
        newProjectiles.push({
          id: `mesh-tetra-${nowMs}-${i}`,
          x: boss.x,
          y: boss.y,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          mesh: createTetrahedronMesh("#a855f7", 8),
          damage: 22,
          alive: true,
        });
      }
    }
  }

  const { live: liveProjectiles, damage: damageDealtToPlayer } =
    advanceBossProjectiles(
      newProjectiles,
      frames,
      playerX,
      playerY,
      gridWidth,
      gridHeight,
      blocksShot
    );

  const updatedBoss: BossState = {
    ...boss,
    phase,
    mesh: nextMesh,
    attackIntervalMs,
    projectiles: liveProjectiles,
    lastSalvoTime: fires ? nowMs : boss.lastSalvoTime,
    salvoCount: fires ? salvoCount + 1 : salvoCount,
    phaseTitle,
  };

  return { updatedBoss, spawnedDamage: damageDealtToPlayer };
}

/**
 * Moves a boss's projectiles one update along, dropping those that leave the
 * arena, hit a wall or hit the player, and totals the damage they dealt.
 */
function advanceBossProjectiles(
  projectiles: readonly MeshProjectile[],
  frames: number,
  playerX: number,
  playerY: number,
  gridWidth: number,
  gridHeight: number,
  blocksShot?: (col: number, row: number) => boolean
): { live: MeshProjectile[]; damage: number } {
  let damage = 0;
  const live: MeshProjectile[] = [];
  projectiles.forEach((p) => {
    if (!p.alive) return;

    const nextX = p.x + p.vx * frames;
    const nextY = p.y + p.vy * frames;

    if (nextX < 0 || nextX >= gridWidth || nextY < 0 || nextY >= gridHeight) {
      return;
    }
    if (blocksShot?.(Math.round(nextX), Math.round(nextY))) return;

    if (Math.hypot(nextX - playerX, nextY - playerY) < (p.hitRadius ?? 0.75)) {
      damage += p.damage;
      return;
    }

    live.push({
      ...p,
      x: nextX,
      y: nextY,
      mesh: {
        ...p.mesh,
        rotation: {
          x: p.mesh.rotation.x + p.mesh.rotSpeed.x * frames,
          y: p.mesh.rotation.y + p.mesh.rotSpeed.y * frames,
          z: p.mesh.rotation.z + p.mesh.rotSpeed.z * frames,
        },
      },
    });
  });
  return { live, damage };
}

/**
 * The Neural Warden's three phases (#2178): each has its own title, colour,
 * pace and attack, so the finale reads and plays differently from FaceForge.
 */
export const NEURAL_WARDEN_PHASES: Readonly<
  Record<1 | 2 | 3, { title: string; color: string; attackIntervalMs: number }>
> = {
  1: {
    title: "PHASE 1: ZERO-TRUST PROBE",
    color: "#a855f7",
    attackIntervalMs: 1500,
  },
  2: {
    title: "PHASE 2: SEGMENTATION SWEEP",
    color: "#22d3ee",
    attackIntervalMs: 650,
  },
  3: {
    title: "PHASE 3: SOVEREIGN OVERRIDE",
    color: "#ef4444",
    attackIntervalMs: 1100,
  },
};

/**
 * How long before a lattice volley its lanes are shown, so a player can step
 * off them.
 */
export const NEURAL_WARDEN_TELEGRAPH_MS = 650;

/** The eight lane headings of a lattice volley, as unit grid steps. */
const LATTICE_LANES: Record<
  NonNullable<BossState["telegraph"]>,
  ReadonlyArray<readonly [number, number]>
> = {
  cross: [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ],
  diagonal: [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
};

/**
 * The lattice a volley fires: phase 1 alternates the + and the X, phase 3
 * picks the lanes the player stands nearest, so standing still never works.
 */
function wardenLattice(
  boss: BossState,
  phase: 1 | 2 | 3,
  salvoCount: number,
  playerX: number,
  playerY: number
): NonNullable<BossState["telegraph"]> {
  if (phase === 3) {
    const dx = Math.abs(playerX - boss.x);
    const dy = Math.abs(playerY - boss.y);
    const offCross = Math.min(dx, dy);
    const offDiagonal = Math.abs(dx - dy) / Math.SQRT2;
    return offDiagonal < offCross ? "diagonal" : "cross";
  }
  return salvoCount % 2 === 0 ? "cross" : "diagonal";
}

/**
 * Updates the Neural Warden (#2178). It shares FaceForge's arena, projectile
 * rules and opening hold, but fights differently:
 *
 * - Phase 1 fires lattice volleys down four lanes at once, alternating the +
 *   and the X; the lanes light up `NEURAL_WARDEN_TELEGRAPH_MS` before each
 *   volley, so stepping off them is a read, not luck.
 * - Phase 2 sweeps: a two-ended beam that turns 30 degrees every shot, so the
 *   safe spot keeps moving round the boss.
 * - Phase 3 aims its lattice at the lanes nearest the player, and follows
 *   every lattice with a fast shot at where the player is heading.
 *
 * Same parameters and result as `updateFaceForgeBoss`.
 */
export function updateNeuralWardenBoss(
  boss: BossState,
  playerX: number,
  playerY: number,
  nowMs: number,
  gridWidth: number,
  gridHeight: number,
  playerHeading?: { dx: number; dy: number },
  frameDeltaMs: number = BOSS_REFERENCE_FRAME_MS,
  blocksShot?: (col: number, row: number) => boolean
): {
  updatedBoss: BossState;
  spawnedDamage: number;
} {
  if (boss.defeated) return { updatedBoss: boss, spawnedDamage: 0 };

  const frames = Math.max(0, frameDeltaMs) / BOSS_REFERENCE_FRAME_MS;
  const hpRatio = boss.hp / boss.maxHp;
  const phase: 1 | 2 | 3 = hpRatio <= 0.34 ? 3 : hpRatio <= 0.67 ? 2 : 1;
  const spec = NEURAL_WARDEN_PHASES[phase];
  const spin = phase === 2 ? 1.8 : 1;

  const mesh: WireframeMesh = {
    ...boss.mesh,
    color: spec.color,
    rotation: {
      x: boss.mesh.rotation.x + boss.mesh.rotSpeed.x * frames * spin,
      y: boss.mesh.rotation.y + boss.mesh.rotSpeed.y * frames * spin,
      z: boss.mesh.rotation.z + boss.mesh.rotSpeed.z * frames * spin,
    },
  };

  const salvoCount = boss.salvoCount ?? 0;
  const holding =
    boss.holdFireUntilMs !== undefined && nowMs < boss.holdFireUntilMs;
  const sinceSalvo = nowMs - boss.lastSalvoTime;
  const fires = !holding && sinceSalvo >= spec.attackIntervalMs;
  const firesLattice = phase !== 2;
  const lattice = firesLattice
    ? wardenLattice(boss, phase, salvoCount, playerX, playerY)
    : undefined;

  let phaseTitle = holding ? "BOOTING :: FIND COVER" : spec.title;
  let telegraph: BossState["telegraph"];
  if (
    !holding &&
    lattice &&
    !fires &&
    sinceSalvo >= spec.attackIntervalMs - NEURAL_WARDEN_TELEGRAPH_MS
  ) {
    telegraph = lattice;
    phaseTitle = `${spec.title} :: LANES LOCKING`;
  }

  const projectiles = [...boss.projectiles];
  if (fires && lattice) {
    const speed = phase === 3 ? 0.13 : 0.1;
    LATTICE_LANES[lattice].forEach(([lx, ly], lane) => {
      const norm = Math.hypot(lx, ly);
      // Two shots per lane, one behind the other: a beam, not a bullet.
      for (let k = 0; k < 2; k++) {
        projectiles.push({
          id: `warden-lane-${nowMs}-${lane}-${k}`,
          x: boss.x - (lx / norm) * k * 0.6,
          y: boss.y - (ly / norm) * k * 0.6,
          vx: (lx / norm) * speed,
          vy: (ly / norm) * speed,
          mesh: createOctahedronMesh(spec.color, 6),
          damage: phase === 3 ? 20 : 16,
          alive: true,
          // A lane is exactly as wide as its telegraph: the tile beside a
          // diagonal lane is safe (#2178).
          hitRadius: 0.5,
        });
      }
    });
    if (phase === 3) {
      const aim = getBossAimPoint(boss, playerX, playerY, playerHeading);
      const angle = Math.atan2(aim.y - boss.y, aim.x - boss.x);
      projectiles.push({
        id: `warden-seeker-${nowMs}`,
        x: boss.x,
        y: boss.y,
        vx: Math.cos(angle) * 0.16,
        vy: Math.sin(angle) * 0.16,
        mesh: createTetrahedronMesh("#f43f5e", 7),
        damage: 18,
        alive: true,
      });
    }
  } else if (fires) {
    // Phase 2: a two-ended beam that turns 30 degrees a shot.
    const angle = (salvoCount * Math.PI) / 6;
    [angle, angle + Math.PI].forEach((a, end) => {
      projectiles.push({
        id: `warden-sweep-${nowMs}-${end}`,
        x: boss.x,
        y: boss.y,
        vx: Math.cos(a) * 0.12,
        vy: Math.sin(a) * 0.12,
        mesh: createCubeMesh(spec.color, 6),
        damage: 15,
        alive: true,
      });
    });
  }

  const { live, damage } = advanceBossProjectiles(
    projectiles,
    frames,
    playerX,
    playerY,
    gridWidth,
    gridHeight,
    blocksShot
  );

  return {
    updatedBoss: {
      ...boss,
      phase,
      mesh,
      attackIntervalMs: spec.attackIntervalMs,
      projectiles: live,
      lastSalvoTime: fires ? nowMs : boss.lastSalvoTime,
      salvoCount: fires ? salvoCount + 1 : salvoCount,
      phaseTitle,
      telegraph,
    },
    spawnedDamage: damage,
  };
}

/**
 * Updates whichever boss a room holds: the Neural Warden by its own rules,
 * every other boss by FaceForge's (#2178).
 *
 * Same parameters and result as `updateFaceForgeBoss`.
 */
export function updateBoss(
  ...args: Parameters<typeof updateFaceForgeBoss>
): ReturnType<typeof updateFaceForgeBoss> {
  return args[0].kind === "neural_warden"
    ? updateNeuralWardenBoss(...args)
    : updateFaceForgeBoss(...args);
}
