// @vitest-environment node
// The middle rooms carry a real-time threat, so the run has a timing beat
// between the turn-based opening and the bosses (#2273).
import { describe, it, expect } from "vitest";
import {
  generateRoguelikeCampaign,
  routeTierOf,
  stepSecurityDrone,
  type SecurityDrone,
} from "@/lib/dungeon";

const campaign = generateRoguelikeCampaign();

describe("sweeping security drones in the roguelike (#2273)", () => {
  it("puts a drone in every middle room and none in the opening rooms", () => {
    for (const room of campaign) {
      const tier = routeTierOf(room);
      if (tier === "middle") {
        expect(room.drones?.length, room.id).toBeGreaterThan(0);
      }
      if (tier === "opening") {
        expect(room.drones ?? [], room.id).toHaveLength(0);
      }
    }
  });

  it("sweeps open floor only, clear of the spawn and exit tiles", () => {
    for (const room of campaign) {
      for (const drone of room.drones ?? []) {
        expect(drone.minX).toBeLessThan(drone.maxX);
        for (let x = drone.minX; x <= drone.maxX; x++) {
          expect(room.grid[drone.y][x], `${room.id} (${x},${drone.y})`).toBe(
            " "
          );
          expect([x, drone.y]).not.toEqual([room.startX, room.startY]);
          expect([x, drone.y]).not.toEqual([room.exitX, room.exitY]);
        }
        expect(drone.x).toBeGreaterThanOrEqual(drone.minX);
        expect(drone.x).toBeLessThanOrEqual(drone.maxX);
      }
    }
  });

  it("steps one tile at a time and turns back at either end", () => {
    let drone: SecurityDrone = { x: 1, y: 5, dir: "right", minX: 1, maxX: 3 };
    const xs: number[] = [];
    for (let i = 0; i < 6; i++) {
      drone = stepSecurityDrone(drone);
      xs.push(drone.x);
    }
    expect(xs).toEqual([2, 3, 2, 1, 2, 3]);
    expect(drone.y).toBe(5);
  });
});
