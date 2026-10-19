import { describe, it, expect } from "vitest";
import {
  createDefaultCustomRoom,
  validateDungeonRoom,
  exportRoomToJson,
  importRoomFromJson,
} from "@/lib/retro-labyrinth/level-schema";
import type { DungeonRoom } from "@/lib/dungeon/types";

describe("Retro Labyrinth Custom Level Schema & Validation", () => {
  it("validates a default custom room configuration successfully", () => {
    const room = createDefaultCustomRoom();
    const result = validateDungeonRoom(room);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects level configuration with invalid or missing dimensions", () => {
    const room: Partial<DungeonRoom> = {
      width: 2, // Width less than 3
      height: 2,
      grid: [["#"]],
    };
    const result = validateDungeonRoom(room);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Level width must be an integer of at least 3.",
        "Level height must be an integer of at least 3.",
      ])
    );
  });

  it("rejects custom levels with broken perimeter walls", () => {
    const room = createDefaultCustomRoom();
    // Break perimeter at (0, 1)
    room.grid[0][1] = " ";
    const result = validateDungeonRoom(room);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Perimeter boundary broken");
  });

  it("rejects player start positions inside walls", () => {
    const room = createDefaultCustomRoom();
    room.startX = 0;
    room.startY = 0; // Outer perimeter wall
    const result = validateDungeonRoom(room);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("cannot be placed inside a wall");
  });

  it("rejects missing exit tiles", () => {
    const room = createDefaultCustomRoom();
    room.grid[room.exitY][room.exitX] = " ";
    const result = validateDungeonRoom(room);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Level must contain at least one exit portal tile (E).",
      ])
    );
  });

  it("rejects enemies or items placed inside walls", () => {
    const room = createDefaultCustomRoom();
    room.enemies.push({
      id: "enemy-wall",
      type: "zombie",
      name: "Wall Zombie",
      x: 0,
      y: 0, // Wall
      hp: 10,
      maxHp: 10,
      patrolDir: "left",
      color: "#ff0000",
      symbol: "Z",
      state: "patrol",
    });

    const result = validateDungeonRoom(room);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("cannot be inside a wall (#)");
  });

  it("exports room definition to clean JSON string", () => {
    const room = createDefaultCustomRoom();
    const jsonStr = exportRoomToJson(room);
    expect(jsonStr).toContain('"title": "Custom Scenario Alpha"');
    expect(jsonStr).toContain('"width": 15');
  });

  it("imports and validates room definition from valid JSON string", () => {
    const room = createDefaultCustomRoom();
    const jsonStr = exportRoomToJson(room);
    const imported = importRoomFromJson(jsonStr);
    expect(imported.errors).toHaveLength(0);
    expect(imported.room).toBeDefined();
    expect(imported.room?.title).toBe("Custom Scenario Alpha");
    expect(imported.room?.startX).toBe(1);
    expect(imported.room?.exitX).toBe(13);
  });

  it("returns validation error when importing malformed JSON string", () => {
    const imported = importRoomFromJson("{ invalid json }");
    expect(imported.errors[0]).toContain("Invalid JSON formatting");
  });
});
