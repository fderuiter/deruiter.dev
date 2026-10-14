// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { GAME_MANUALS } from "@/lib/game-manuals";
import {
  CYBERDECK_CLASSES,
  DEFAULT_WEAPONS,
  RUN_LOADOUT_SLOTS,
  generateRoguelikeCampaign,
  routeRunLength,
} from "@/lib/dungeon";

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

  // #2084: route rewards add up to two weapons after the class's three.
  it("binds as many number keys as a loadout has slots", () => {
    const deploy = GAME_MANUALS["retro-labyrinth"].controls.find((c) =>
      c.action.includes("Exploits")
    );
    for (const cls of Object.values(CYBERDECK_CLASSES)) {
      expect(cls.starterWeapons).toHaveLength(3);
    }
    expect(RUN_LOADOUT_SLOTS).toBe(5);
    expect(deploy?.key).toBe("1 to 5 Keys");
  });

  // #1667: Nmap Port Recon is key 2 for the default class, not key 1.
  it("names the right key for Nmap in the pro tips", () => {
    const manual = GAME_MANUALS["retro-labyrinth"];
    const slot = starter.indexOf("port_scan") + 1;
    expect(slot).toBe(2);
    const tip = manual.proTips.find((t) => t.includes("Nmap"));
    expect(tip).toBeDefined();
    expect(tip).not.toContain("[1]");
    expect(tip).toContain(`key ${slot}`);
  });
});

// #2048: the manual claimed procedural subnets and cellular automata
// generation. The rooms are hand-built and always play in the same order.
describe("Retro Labyrinth manual describes the real campaign (#2048)", () => {
  const manual = GAME_MANUALS["retro-labyrinth"];
  const copy = JSON.stringify(manual);

  it("makes no procedural or cellular-automata generation claim", () => {
    expect(copy).not.toMatch(/procedural/i);
    expect(copy).not.toMatch(/cellular/i);
  });

  // #2084: the rooms are a library a seeded route runs through.
  it("names the seven rooms and the six-room route through them", () => {
    const rule = manual.rules.find((r) => r.badge === "Campaign");
    expect(rule).toBeDefined();
    const names = [
      "DMZ Gateway",
      "Active Directory",
      "BlinkBrowse",
      "TSP",
      "Darknet Vault",
      "FaceForge",
      "NEURAL_WARDEN",
    ];
    const positions = names.map((name) => rule!.detail.indexOf(name));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(rule!.detail).toContain("seven rooms");
    expect(rule!.detail).toContain("A run is six of them");
    expect(rule!.detail).toContain("seed");
    expect(generateRoguelikeCampaign()).toHaveLength(names.length);
    expect(routeRunLength(generateRoguelikeCampaign())).toBe(6);
  });

  it("describes the reward pick", () => {
    const rule = manual.rules.find((r) => r.badge === "Rewards");
    expect(rule?.detail).toMatch(/weapon/i);
    expect(rule?.detail).toContain("Patch Kit");
    expect(rule?.detail).toContain("passive");
    expect(copy).not.toMatch(/fixed order/i);
  });
});
