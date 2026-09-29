import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { generateRoguelikeCampaign, type DungeonRoom } from "@/lib/dungeon";

// #1309: the TSP room's moving walls and route nodes were gated on the wrong
// room index, and no hacking terminal could be reached in the campaign.

function reachable(room: DungeonRoom, glyph: string): boolean {
  const seen = new Set<string>();
  const queue: Array<[number, number]> = [[room.startX, room.startY]];
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cell = room.grid[y]?.[x];
    if (cell === undefined || cell === "#" || cell === "W") continue;
    if (cell === glyph) return true;
    // Terminals and chests stop movement, so don't path through them.
    if (
      (cell === "H" || cell === "T") &&
      !(x === room.startX && y === room.startY)
    )
      continue;
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return false;
}

describe("Retro Labyrinth room mechanics (#1309)", () => {
  const campaign = generateRoguelikeCampaign();

  it("gives every room that has a terminal a reachable hacking terminal", () => {
    const withTerminal = campaign.filter((room) => room.hasTerminal);
    expect(withTerminal.length).toBeGreaterThan(0);
    for (const room of withTerminal) {
      expect(reachable(room, "H"), room.id).toBe(true);
    }
  });

  it("keeps the Darknet vault's timesheet chest reachable", () => {
    const vault = campaign.find((room) => room.id === "billable_hours");
    expect(vault).toBeDefined();
    expect(reachable(vault!, "T")).toBe(true);
  });

  it("gates the TSP mechanics on the room id, not a campaign position", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "components/RetroLabyrinth.tsx"),
      "utf-8"
    );
    expect(source).not.toMatch(/roomIndex === 2/);
    expect(source).not.toMatch(/roomIndex === 3/);
    expect(source).toContain('campaignRooms[roomIndex]?.id === "tsp"');
    // The TSP room is where the component's TSP logic expects it.
    expect(
      campaign.some((room) => room.id === "tsp" && room.tspNodes?.length)
    ).toBe(true);
  });
});
