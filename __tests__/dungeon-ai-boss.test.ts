import { describe, it, expect } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import { updateEnemyAI } from "@/lib/dungeon/ai";

import {
  createFaceMesh,
  createOctahedronMesh,
  createCubeMesh,
  createFaceForgeBoss,
  createNeuralWardenBoss,
  updateFaceForgeBoss,
  renderWireframeMesh,
} from "@/lib/dungeon/boss";
import { Enemy } from "@/lib/dungeon/types";

describe("Dungeon Master AI & Wireframe Boss Engine", () => {
  const openGrid: string[][] = [
    [".", ".", ".", ".", ".", ".", ".", ".", ".", "."],
    [".", ".", ".", ".", ".", ".", ".", ".", ".", "."],
    [".", ".", ".", ".", ".", ".", ".", ".", ".", "."],
    [".", ".", ".", ".", ".", ".", ".", ".", ".", "."],
    [".", ".", ".", ".", ".", ".", ".", ".", ".", "."],
    [".", ".", ".", ".", ".", ".", ".", ".", ".", "."],
    [".", ".", ".", ".", ".", ".", ".", ".", ".", "."],
    [".", ".", ".", ".", ".", ".", ".", ".", ".", "."],
    [".", ".", ".", ".", ".", ".", ".", ".", ".", "."],
    [".", ".", ".", ".", ".", ".", ".", ".", ".", "."],
  ];

  describe("Enemy AI State Machine (updateEnemyAI)", () => {
    it("handles frozen state (Ransomware Lock) countdown and unfreezes to patrol", () => {
      const frozenEnemy: Enemy = {
        id: "1",
        x: 2,
        y: 2,
        type: "zombie",
        name: "Zombie Process",
        symbol: "Z",
        color: "#ef4444",
        hp: 30,
        maxHp: 30,
        cve: "ZERO_DAY",
        state: "frozen",
        frozenMs: 500,
        patrolDir: "right",
      };

      // Tick 200ms -> Still frozen
      const res1 = updateEnemyAI([frozenEnemy], openGrid, 8, 8, 200);
      expect(res1.updatedEnemies[0].frozenMs).toBe(300);
      expect(res1.updatedEnemies[0].state).toBe("frozen");
      expect(res1.updatedEnemies[0].x).toBe(2);

      // Tick 400ms -> Unfreezes to patrol
      const res2 = updateEnemyAI(res1.updatedEnemies, openGrid, 8, 8, 400);
      expect(res2.updatedEnemies[0].frozenMs).toBe(0);
      expect(res2.updatedEnemies[0].state).toBe("patrol");
    });

    it("handles stunned state countdown and unfreezes to patrol", () => {
      const stunnedEnemy: Enemy = {
        id: "2",
        x: 3,
        y: 3,
        type: "slime",
        name: "Buffer Overflow Slime",
        symbol: "S",
        color: "#22c55e",
        hp: 20,
        maxHp: 20,
        cve: "BUFFER_OVERFLOW",
        state: "stunned",
        stunTimerMs: 300,
        patrolDir: "left",
      };

      const res1 = updateEnemyAI([stunnedEnemy], openGrid, 8, 8, 150);
      expect(res1.updatedEnemies[0].stunTimerMs).toBe(150);

      const res2 = updateEnemyAI(res1.updatedEnemies, openGrid, 8, 8, 200);
      expect(res2.updatedEnemies[0].stunTimerMs).toBe(0);
      expect(res2.updatedEnemies[0].state).toBe("patrol");
    });

    it("handles confused state (MitM Packet Spoof) with random walk and recovers", () => {
      const confusedEnemy: Enemy = {
        id: "3",
        x: 5,
        y: 5,
        type: "sentinel_daemon",
        name: "Sentinel Daemon",
        symbol: "D",
        color: "#a855f7",
        hp: 40,
        maxHp: 40,
        cve: "BUFFER_OVERFLOW",
        state: "confused",
        confusedMs: 400,
        patrolDir: "up",
      };

      const res = updateEnemyAI([confusedEnemy], openGrid, 5, 5, 200);
      expect(res.damageToPlayer).toBe(0); // Confused enemies deal no direct collision damage
      expect(res.updatedEnemies[0].confusedMs).toBe(200);
    });

    it("transitions from patrol to chase when player is within LOS range (<= 5)", () => {
      const enemy: Enemy = {
        id: "4",
        x: 3,
        y: 3,
        type: "zombie",
        name: "Zombie Process",
        symbol: "Z",
        color: "#ef4444",
        hp: 30,
        maxHp: 30,
        cve: "ZERO_DAY",
        state: "patrol",
        patrolDir: "right",
      };

      // Player at (5, 3) - distance = 2, LOS clear
      const res = updateEnemyAI([enemy], openGrid, 5, 3, 100);
      expect(res.updatedEnemies[0].state).toBe("chase");
      expect(res.updatedEnemies[0].x).toBe(4); // Stepped towards player
    });

    it("transitions from chase back to patrol when player is far (> 6)", () => {
      const chasingEnemy: Enemy = {
        id: "5",
        x: 1,
        y: 1,
        type: "slime",
        name: "Buffer Overflow Slime",
        symbol: "S",
        color: "#22c55e",
        hp: 20,
        maxHp: 20,
        cve: "BUFFER_OVERFLOW",
        state: "chase",
        patrolDir: "right",
      };

      // Player at (9, 9) - distance > 6
      const res = updateEnemyAI([chasingEnemy], openGrid, 9, 9, 100);
      expect(res.updatedEnemies[0].state).toBe("patrol");
    });

    it("executes multi-axis patrol bouncing on min/max boundaries", () => {
      const rightPatrol: Enemy = {
        id: "6",
        x: 5,
        y: 2,
        type: "zombie",
        name: "Zombie",
        symbol: "Z",
        color: "#ef4444",
        hp: 10,
        maxHp: 10,
        cve: "WEAK_SSH",
        state: "patrol",
        patrolDir: "right",
        maxX: 5,
      };

      const resRight = updateEnemyAI([rightPatrol], openGrid, 9, 9, 100);
      expect(resRight.updatedEnemies[0].patrolDir).toBe("left");
      expect(resRight.updatedEnemies[0].x).toBe(4);

      const downPatrol: Enemy = {
        id: "7",
        x: 2,
        y: 5,
        type: "zombie",
        name: "Zombie",
        symbol: "Z",
        color: "#ef4444",
        hp: 10,
        maxHp: 10,
        cve: "WEAK_SSH",
        state: "patrol",
        patrolDir: "down",
        maxY: 5,
      };

      const resDown = updateEnemyAI([downPatrol], openGrid, 9, 9, 100);
      expect(resDown.updatedEnemies[0].patrolDir).toBe("up");
      expect(resDown.updatedEnemies[0].y).toBe(4);

      const upPatrol: Enemy = {
        id: "8",
        x: 2,
        y: 1,
        type: "zombie",
        name: "Zombie",
        symbol: "Z",
        color: "#ef4444",
        hp: 10,
        maxHp: 10,
        cve: "WEAK_SSH",
        state: "patrol",
        patrolDir: "up",
        minY: 1,
      };

      const resUp = updateEnemyAI([upPatrol], openGrid, 9, 9, 100);
      expect(resUp.updatedEnemies[0].patrolDir).toBe("down");
      expect(resUp.updatedEnemies[0].y).toBe(2);
    });

    it("deals 25 collision damage when enemy reaches player coordinates", () => {
      const enemy: Enemy = {
        id: "9",
        x: 4,
        y: 4,
        type: "zombie",
        name: "Zombie",
        symbol: "Z",
        color: "#ef4444",
        hp: 10,
        maxHp: 10,
        cve: "WEAK_SSH",
        state: "chase",
        patrolDir: "right",
      };

      // Player at (5, 4) - enemy will step to (5, 4)
      const res = updateEnemyAI([enemy], openGrid, 5, 4, 100);
      expect(res.contactedPlayer).toBe(true);
      expect(res.damageToPlayer).toBe(25);
    });
  });

  describe("Wireframe 3D Boss & Projectiles (updateFaceForgeBoss)", () => {
    it("initializes FaceForge and Neural Warden bosses correctly", () => {
      const faceBoss = createFaceForgeBoss(10, 10);
      expect(faceBoss.hp).toBe(300);
      expect(faceBoss.maxHp).toBe(300);
      expect(faceBoss.phase).toBe(1);
      expect(faceBoss.defeated).toBe(false);

      const neuralBoss = createNeuralWardenBoss(12, 12);
      expect(neuralBoss.hp).toBe(450);
      expect(neuralBoss.phase).toBe(1);
    });

    it("returns immediately without damage if boss is defeated", () => {
      const boss = createFaceForgeBoss(5, 5);
      boss.defeated = true;

      const res = updateFaceForgeBoss(boss, 5, 5, 1000, 20, 20);
      expect(res.spawnedDamage).toBe(0);
      expect(res.updatedBoss.defeated).toBe(true);
    });

    it("fires single targeted projectile in Phase 1 (HP > 67%)", () => {
      const boss = createFaceForgeBoss(10, 10);
      const res = updateFaceForgeBoss(boss, 2, 2, 2000, 20, 20);

      expect(res.updatedBoss.phase).toBe(1);
      expect(res.updatedBoss.projectiles.length).toBeGreaterThan(0);
      expect(res.updatedBoss.phaseTitle).toContain("PHASE 1");
    });

    it("fires spread salvo in Phase 2 (34% < HP <= 67%)", () => {
      const boss = createFaceForgeBoss(10, 10);
      boss.hp = 150; // 50% HP -> Phase 2

      const res = updateFaceForgeBoss(boss, 2, 2, 2000, 20, 20);
      expect(res.updatedBoss.phase).toBe(2);
      expect(res.updatedBoss.phaseTitle).toContain("PHASE 2");
      expect(res.updatedBoss.projectiles.length).toBeGreaterThanOrEqual(3);
    });

    it("fires radial spiral salvo in Phase 3 (HP <= 34%)", () => {
      const boss = createFaceForgeBoss(10, 10);
      boss.hp = 80; // 26% HP -> Phase 3

      const res = updateFaceForgeBoss(boss, 2, 2, 2000, 20, 20);
      expect(res.updatedBoss.phase).toBe(3);
      expect(res.updatedBoss.phaseTitle).toContain("PHASE 3");
      expect(res.updatedBoss.projectiles.length).toBeGreaterThanOrEqual(6);
    });

    it("damages player and consumes projectile when projectile collides with player (< 0.75 dist)", () => {
      const boss = createFaceForgeBoss(10, 10);
      // Inject a projectile near player (5, 5)
      boss.projectiles = [
        {
          id: "proj-1",
          x: 5.1,
          y: 5.1,
          vx: 0,
          vy: 0,
          mesh: createCubeMesh(),
          damage: 20,
          alive: true,
        },
      ];

      const res = updateFaceForgeBoss(boss, 5.0, 5.0, 100, 20, 20);
      expect(res.spawnedDamage).toBe(20);
      expect(res.updatedBoss.projectiles).toHaveLength(0); // Consumed
    });

    it("culls projectiles that fly outside grid boundaries", () => {
      const boss = createFaceForgeBoss(10, 10);
      boss.projectiles = [
        {
          id: "out-of-bounds",
          x: 19.5,
          y: 19.5,
          vx: 1.0,
          vy: 1.0,
          mesh: createCubeMesh(),
          damage: 10,
          alive: true,
        },
      ];

      const res = updateFaceForgeBoss(boss, 1, 1, 100, 20, 20);
      expect(res.updatedBoss.projectiles).toHaveLength(0);
    });

    it("renders wireframe meshes to 2D canvas context without throwing", () => {
      const mockCtx = fromPartial<CanvasRenderingContext2D>({
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        arc: () => {},
        fill: () => {},
        strokeStyle: "",
        fillStyle: "",
        lineWidth: 1,
        shadowColor: "",
        shadowBlur: 0,
      });

      const faceMesh = createFaceMesh();
      expect(() =>
        renderWireframeMesh(mockCtx, faceMesh, 100, 100, true)
      ).not.toThrow();

      const octaMesh = createOctahedronMesh();
      expect(() =>
        renderWireframeMesh(mockCtx, octaMesh, 100, 100, false)
      ).not.toThrow();
    });
  });
});
