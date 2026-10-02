// @vitest-environment node
import { describe, it, expect } from "vitest";
import { updateEnemyAI } from "../lib/dungeon/ai";
import {
  createFaceMesh,
  createOctahedronMesh,
  createCubeMesh,
  createTetrahedronMesh,
  rotate3D,
  project3DTo2D,
  createFaceForgeBoss,
  createNeuralWardenBoss,
  updateFaceForgeBoss,
} from "../lib/dungeon/boss";
import {
  generateHexMatrixPuzzle,
  isSequenceMatched,
  selectHexCell,
  consumeBypassChip,
} from "../lib/dungeon/hacking";
import { DEFAULT_WEAPONS, fireWeapon } from "../lib/dungeon/weapons";
import { Enemy } from "../lib/dungeon/types";

describe("Dungeon Extended: AI State Machine, 3D Bosses, and Combat Suite", () => {
  describe("Enemy AI State Machine & Status Effects", () => {
    const grid = [
      [".", ".", ".", "."],
      [".", ".", ".", "."],
      [".", ".", ".", "."],
      [".", ".", ".", "."],
    ];

    it("handles frozen state countdown and resumes patrol when expired", () => {
      const enemy: Enemy = {
        id: "e1",
        x: 1,
        y: 1,
        type: "drone",
        name: "CVE Bot",
        hp: 50,
        maxHp: 50,
        state: "frozen",
        frozenMs: 500,
        patrolDir: "left",
        symbol: "D",
        color: "#06b6d4",
      };

      // Step by 200ms -> still frozen
      const step1 = updateEnemyAI([enemy], grid, 3, 3, 200);
      expect(step1.updatedEnemies[0].frozenMs).toBe(300);

      // Step by 400ms -> unfreezes to patrol
      const step2 = updateEnemyAI(step1.updatedEnemies, grid, 3, 3, 400);
      expect(step2.updatedEnemies[0].state).toBe("patrol");
      expect(step2.updatedEnemies[0].frozenMs).toBe(0);
    });

    it("handles stunned state and deals damage on player contact", () => {
      const enemy: Enemy = {
        id: "e2",
        x: 2,
        y: 2,
        type: "sentinel_daemon",
        name: "Ransomware Daemon",
        hp: 80,
        maxHp: 80,
        state: "stunned",
        stunTimerMs: 300,
        patrolDir: "right",
        symbol: "S",
        color: "#ef4444",
      };

      const step1 = updateEnemyAI([enemy], grid, 2, 2, 400);
      expect(step1.updatedEnemies[0].state).toBe("patrol");
    });
  });

  describe("Wireframe 3D Meshes & Boss Phase Transitions", () => {
    it("generates polyhedral 3D wireframe geometry meshes", () => {
      const face = createFaceMesh();
      expect(face.vertices.length).toBeGreaterThan(10);
      expect(face.edges.length).toBeGreaterThan(10);

      const octa = createOctahedronMesh();
      expect(octa.vertices.length).toBe(6);

      const cube = createCubeMesh();
      expect(cube.vertices.length).toBe(8);

      const tetra = createTetrahedronMesh();
      expect(tetra.vertices.length).toBe(4);
    });

    it("performs 3D coordinate rotation and 2D perspective projections", () => {
      const v = { x: 1, y: 0, z: 0 };
      const rotated = rotate3D(v, { x: 0, y: Math.PI / 2, z: 0 });
      expect(rotated.z).toBeCloseTo(-1, 1);

      const projected = project3DTo2D(rotated, 400, 300, 20);
      expect(projected.x).toBeDefined();
      expect(projected.y).toBeDefined();
    });

    it("initializes and updates FaceForge and NeuralWarden boss states", () => {
      const faceForge = createFaceForgeBoss(5, 5);
      expect(faceForge.name.toLowerCase()).toContain("faceforge");
      expect(faceForge.phase).toBe(1);
      expect(faceForge.hp).toBe(faceForge.maxHp);

      const neuralWarden = createNeuralWardenBoss(5, 5);
      expect(neuralWarden.name.toLowerCase()).toContain("neural_warden");
      expect(neuralWarden.phase).toBe(1);

      const updated = updateFaceForgeBoss(faceForge, 2, 2, 100, 20, 20);
      expect(updated.updatedBoss.mesh.rotation.y).toBeGreaterThan(0);
    });
  });

  describe("Hex Matrix Buffer Bypass Hacking Minigame", () => {
    it("generates solvable hex buffer puzzle with alternating row/column constraints", () => {
      const puzzle = generateHexMatrixPuzzle(1);
      expect(puzzle.grid.length).toBe(4);
      expect(puzzle.targetSequence.length).toBeGreaterThanOrEqual(2);
      expect(puzzle.timeRemainingSeconds).toBeGreaterThan(10);
      expect(puzzle.activeAxis).toBe("row");
    });

    it("evaluates sequence matching and input selection", () => {
      expect(isSequenceMatched(["1C", "E9"], ["1C", "E9"])).toBe(true);
      expect(isSequenceMatched(["1C", "E9"], ["1C", "BD"])).toBe(false);
      expect(isSequenceMatched(["FF", "1C", "E9"], ["1C", "E9"])).toBe(true);

      const puzzle = generateHexMatrixPuzzle(1);
      const res = selectHexCell(puzzle, puzzle.activeIndex, 0);
      expect(res.puzzle.currentInput.length).toBe(1);
      expect(res.puzzle.activeAxis).toBe("col");
    });

    it("consumes bypass chip to auto-solve next required byte", () => {
      const puzzle = generateHexMatrixPuzzle(1);
      const solved = consumeBypassChip(puzzle);
      expect(solved.solved).toBe(true);
      expect(solved.currentInput).toEqual(puzzle.targetSequence);
    });
  });

  describe("Weapons Engine & Vulnerability Synergy", () => {
    it("fires port_scan and exposes CVE vulnerability on active enemies", () => {
      const weapons = { ...DEFAULT_WEAPONS };
      const enemy: Enemy = {
        id: "e1",
        x: 5,
        y: 5,
        type: "drone",
        name: "CVE Bot",
        hp: 100,
        maxHp: 100,
        state: "patrol",
        patrolDir: "down",
        symbol: "D",
        color: "#06b6d4",
      };

      const res = fireWeapon(
        "port_scan",
        weapons,
        2,
        2,
        100,
        100,
        [enemy],
        undefined,
        1000,
        32
      );

      expect(res.success).toBe(true);
      expect(res.updatedEnemies[0].cveExposed).toBe(true);
      expect(res.particles.length).toBeGreaterThan(0);
    });

    it("handles insufficient RAM or ammo gracefully", () => {
      const weapons = {
        ...DEFAULT_WEAPONS,
        git_force_push: { ...DEFAULT_WEAPONS.git_force_push, ammo: 0 },
      };

      const resNoAmmo = fireWeapon(
        "git_force_push",
        weapons,
        2,
        2,
        100,
        100,
        [],
        undefined,
        1000,
        32
      );
      expect(resNoAmmo.success).toBe(false);
      expect(resNoAmmo.message).toContain("Out of ammo");

      const resLowRam = fireWeapon(
        "npm_install",
        DEFAULT_WEAPONS,
        2,
        2,
        100,
        100,
        [],
        undefined,
        1000,
        2 // Requires 4 GB
      );
      expect(resLowRam.success).toBe(false);
      expect(resLowRam.message).toContain("Insufficient Cyberdeck RAM");
    });
  });
});
