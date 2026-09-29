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
    attackIntervalMs: 1400,
    defeated: false,
    phaseTitle: "PHASE 1: ZERO-TRUST PROBE",
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
 * Updates boss animations, attack patterns, and projectile trajectories.
 */
export function updateFaceForgeBoss(
  boss: BossState,
  playerX: number,
  playerY: number,
  nowMs: number,
  gridWidth: number,
  gridHeight: number,
  playerHeading?: { dx: number; dy: number }
): {
  updatedBoss: BossState;
  spawnedDamage: number;
} {
  if (boss.defeated) return { updatedBoss: boss, spawnedDamage: 0 };

  // #1321: aim where the player is heading, not where they stand, so a
  // player walking past the boss is not missed by every shot.
  const aim = getBossAimPoint(boss, playerX, playerY, playerHeading);

  const nextMesh: WireframeMesh = {
    ...boss.mesh,
    rotation: {
      x: boss.mesh.rotation.x + boss.mesh.rotSpeed.x,
      y: boss.mesh.rotation.y + boss.mesh.rotSpeed.y,
      z: boss.mesh.rotation.z + boss.mesh.rotSpeed.z,
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

  if (nowMs - boss.lastSalvoTime >= attackIntervalMs) {
    if (phase === 1) {
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

  let damageDealtToPlayer = 0;
  const liveProjectiles: MeshProjectile[] = [];

  newProjectiles.forEach((p) => {
    if (!p.alive) return;

    const nextX = p.x + p.vx;
    const nextY = p.y + p.vy;

    if (nextX < 0 || nextX >= gridWidth || nextY < 0 || nextY >= gridHeight) {
      return;
    }

    const distToPlayer = Math.hypot(nextX - playerX, nextY - playerY);
    if (distToPlayer < 0.75) {
      damageDealtToPlayer += p.damage;
      return;
    }

    const pRotMesh: WireframeMesh = {
      ...p.mesh,
      rotation: {
        x: p.mesh.rotation.x + p.mesh.rotSpeed.x,
        y: p.mesh.rotation.y + p.mesh.rotSpeed.y,
        z: p.mesh.rotation.z + p.mesh.rotSpeed.z,
      },
    };

    liveProjectiles.push({
      ...p,
      x: nextX,
      y: nextY,
      mesh: pRotMesh,
    });
  });

  const updatedBoss: BossState = {
    ...boss,
    phase,
    mesh: nextMesh,
    attackIntervalMs,
    projectiles: liveProjectiles,
    lastSalvoTime:
      nowMs - boss.lastSalvoTime >= attackIntervalMs
        ? nowMs
        : boss.lastSalvoTime,
    phaseTitle,
  };

  return { updatedBoss, spawnedDamage: damageDealtToPlayer };
}
