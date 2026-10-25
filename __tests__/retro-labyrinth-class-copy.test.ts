// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { GAME_MANUALS } from "@/lib/game-manuals";
import {
  CLASS_AOE_RADIUS_MULTIPLIER,
  CYBERDECK_CLASSES,
  DEFAULT_WEAPONS,
  createFaceForgeBoss,
  createNeuralWardenBoss,
  type ActiveSideEffect,
  type CyberdeckClass,
} from "@/lib/dungeon";
import {
  bossVolleyHitLine,
  controlsScrambled,
  sideEffectForClass,
} from "@/components/retro-labyrinth/run-rules";

// #2338: every class card states only what the class really does, and the
// field manual names only things that are in the game.

const classes: readonly CyberdeckClass[] = Object.values(CYBERDECK_CLASSES);
const fewestChips = Math.min(...classes.map((c) => c.startBypassChips));
const slowestRegen = Math.min(...classes.map((c) => c.ramRegen));
const NOW = 1_000_000;
const scramble: ActiveSideEffect = {
  type: "scrambled_keys",
  title: "KEYBIND_DESYNC_WARNING",
  description: "Directional keybindings are inverted!",
  expiresAt: NOW + 8000,
};

/**
 * Checks each claim a card makes against the class data and removes it, so
 * whatever is left over is a claim nothing verified.
 */
function verifyClaims(cls: CyberdeckClass): string {
  let rest = cls.passiveBonus;
  const take = (re: RegExp, check: (n: number) => void) => {
    const match = re.exec(rest);
    if (match) {
      check(Number(match[1]));
      rest = rest.replace(match[0], "");
    }
  };
  take(/(\d+) extra Bypass Chips?/, (n) =>
    expect(n, cls.id).toBe(cls.startBypassChips - fewestChips)
  );
  take(/\+(\d+) GB RAM regen per step/, (n) =>
    expect(n, cls.id).toBe(cls.ramRegen - slowestRegen)
  );
  take(/(\d+) GB (?:max )?RAM/, (n) => expect(n, cls.id).toBe(cls.baseRam));
  take(/(\d+) Max HP/, (n) => expect(n, cls.id).toBe(cls.baseHp));
  take(/\+(\d+)% AoE Exploit Blast Radius/, (n) =>
    expect(1 + n / 100, cls.id).toBe(CLASS_AOE_RADIUS_MULTIPLIER[cls.id] ?? 1)
  );
  // A named tool must be one the class starts with.
  for (const id of cls.starterWeapons) {
    rest = rest.replace(DEFAULT_WEAPONS[id].name, "");
  }
  return rest;
}

describe("Retro Labyrinth class cards (#2338)", () => {
  it.each(classes.map((c) => [c.id, c]))(
    "%s states only numbers the class data backs",
    (_id, cls) => {
      expect(verifyClaims(cls)).not.toMatch(/\d/);
    }
  );

  it("counts the Script Kiddie's one extra bypass chip as one", () => {
    expect(CYBERDECK_CLASSES.script_kiddie.startBypassChips - fewestChips).toBe(
      1
    );
    expect(CYBERDECK_CLASSES.script_kiddie.passiveBonus).toContain(
      "1 extra Bypass Chip"
    );
    expect(CYBERDECK_CLASSES.script_kiddie.passiveBonus).not.toMatch(/2 extra/);
  });

  it("claims no perk the game does not implement", () => {
    for (const cls of classes) {
      expect(cls.passiveBonus, cls.id).not.toMatch(
        /evasion|glitch|lag|crypto harvest|critical strike/i
      );
    }
  });

  it("claims scramble immunity exactly for the classes that have it", () => {
    for (const cls of classes) {
      const claims = /immune to scrambled controls/i.test(cls.passiveBonus);
      expect(controlsScrambled(cls.id, scramble, NOW), cls.id).toBe(!claims);
    }
    expect(CYBERDECK_CLASSES.hardware_hacker.passiveBonus).toMatch(
      /immune to scrambled controls/i
    );
  });

  it("keeps a Hardware Hacker's keys straight under Stack Overflow", () => {
    expect(controlsScrambled("hardware_hacker", scramble, NOW)).toBe(false);
    expect(sideEffectForClass("hardware_hacker", scramble)).toBeUndefined();
    expect(controlsScrambled("script_kiddie", scramble, NOW)).toBe(true);
    expect(sideEffectForClass("script_kiddie", scramble)).toBe(scramble);
    expect(
      controlsScrambled("script_kiddie", scramble, scramble.expiresAt)
    ).toBe(false);
    expect(controlsScrambled("script_kiddie", undefined, NOW)).toBe(false);
  });

  it("routes every movement path through the class-aware check", () => {
    const read = (file: string) =>
      fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
    // Since #2376 keys, the d-pad and swipes all step through the session's
    // one move intent, which applies the scramble.
    const session = read(
      "components/retro-labyrinth/useRetroLabyrinthSession.ts"
    );
    const view = read("components/retro-labyrinth/parts/LabyrinthLayout.tsx");
    for (const source of [session, view]) {
      expect(source).not.toMatch(
        /activeSideEffect\?\.type === "scrambled_keys"/
      );
      expect(source).not.toContain('boss.name.split(" :: ")');
    }
    expect(session.match(/controlsScrambled\(/g)?.length).toBe(1);
    expect(view).not.toContain("controlsScrambled(");
    expect(session).toContain("sideEffectForClass(");
  });
});

describe("Retro Labyrinth field manual (#2338)", () => {
  const manual = JSON.stringify(GAME_MANUALS["retro-labyrinth"]);

  it("names no camera sentinels or hidden traps", () => {
    expect(manual).not.toMatch(/camera sentinel/i);
    expect(manual).not.toMatch(/hidden trap/i);
  });
});

describe("Retro Labyrinth trace line (#2338)", () => {
  it("names the boss by its display name, not its raw id", () => {
    expect(bossVolleyHitLine(createNeuralWardenBoss(0, 0))).toBe(
      "A Neural Warden mesh volley severed your cyberdeck proxy tunnel."
    );
    expect(bossVolleyHitLine(createFaceForgeBoss(0, 0))).toBe(
      "A FaceForge mesh volley severed your cyberdeck proxy tunnel."
    );
  });
});
