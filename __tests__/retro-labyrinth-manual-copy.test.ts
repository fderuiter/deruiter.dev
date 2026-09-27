import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { GAME_MANUALS } from "@/lib/game-manuals";
import { CYBERDECK_CLASSES, DEFAULT_WEAPONS } from "@/lib/dungeon";

// #1179: the cabinet card and field manual describe the loadout the game
// actually gives you.
describe("Retro Labyrinth manual copy (#1179)", () => {
  const cabinet = fs.readFileSync(
    path.resolve(process.cwd(), "components/arcade/RetroLabyrinthClient.tsx"),
    "utf8"
  );
  const starter = CYBERDECK_CLASSES.script_kiddie.starterWeapons;

  it("names the default class's starter tools on the cabinet card", () => {
    expect(cabinet).toContain("npm install");
    expect(cabinet).toContain("Nmap Port Recon");
    expect(cabinet).toContain("EMP");
    expect(starter.map((id) => DEFAULT_WEAPONS[id].name)).toEqual([
      expect.stringContaining("npm install"),
      expect.stringContaining("Nmap Port Recon"),
      expect.stringContaining("EMP"),
    ]);
  });

  it("stops advertising tools no class starts with", () => {
    expect(cabinet).not.toContain("git push --force");
    expect(cabinet).not.toContain("Wield Weapon");
  });

  it("binds only as many number keys as a class has starter tools", () => {
    const deploy = GAME_MANUALS["retro-labyrinth"].controls.find((c) =>
      c.action.includes("Exploits")
    );
    for (const cls of Object.values(CYBERDECK_CLASSES)) {
      expect(cls.starterWeapons).toHaveLength(3);
    }
    expect(deploy?.key).toBe("1, 2, 3 Keys");
  });
});
