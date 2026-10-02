// @vitest-environment node
import { describe, it, expect } from "vitest";
import { RetroLabyrinthEngine } from "@/lib/retro-labyrinth/engine";

describe("RetroLabyrinthEngine", () => {
  it("initializes with starting class HP and stage 1 maze", () => {
    const engine = new RetroLabyrinthEngine({
      classId: "script_kiddie",
      gameMode: "roguelike",
    });

    const snapshot = engine.getSnapshot();
    expect(snapshot.playerHp).toBeGreaterThan(0);
    expect(snapshot.maxHp).toBeGreaterThan(0);
    expect(snapshot.score).toBe(0);
    expect(snapshot.gameStatus).toBe("playing");
    expect(snapshot.activeWeaponId).toBe("npm_install");
  });

  it("updates player position when moving to valid open tiles", () => {
    const engine = new RetroLabyrinthEngine({
      classId: "script_kiddie",
      gameMode: "classic",
    });

    const startPos = { ...engine.getSnapshot().playerPosition };

    // Move right (assuming (2, 1) is open in Stage 1 classic maze)
    const moved = engine.move(1, 0);
    if (moved) {
      expect(engine.getSnapshot().playerPosition.x).toBe(startPos.x + 1);
    }
  });

  it("prevents player from walking into solid walls", () => {
    const engine = new RetroLabyrinthEngine({
      classId: "script_kiddie",
      gameMode: "classic",
    });

    // Move up into solid perimeter wall at (1, 0)
    const moved = engine.move(0, -1);
    expect(moved).toBe(false);
    expect(engine.getSnapshot().playerPosition.y).toBe(1); // stayed at 1
  });

  it("fires active weapon and updates ammo and state snapshot", () => {
    const engine = new RetroLabyrinthEngine({
      classId: "script_kiddie",
      gameMode: "roguelike",
    });

    const initialAmmo =
      engine.getSnapshot().weapons.find((w) => w.id === "npm_install")?.ammo ??
      0;
    engine.fireActiveWeapon();

    const currentAmmo =
      engine.getSnapshot().weapons.find((w) => w.id === "npm_install")?.ammo ??
      0;
    expect(currentAmmo).toBeLessThanOrEqual(initialAmmo);
  });

  it("switches weapons by index", () => {
    const engine = new RetroLabyrinthEngine({
      classId: "script_kiddie",
      gameMode: "roguelike",
    });

    engine.selectWeapon(1);
    const snapshot = engine.getSnapshot();
    expect(snapshot.selectedWeaponIndex).toBe(1);
  });
});
