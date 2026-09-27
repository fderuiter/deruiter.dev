import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { GAME_MANUALS } from "../lib/game-manuals";

describe("Game Manuals Registry", () => {
  const expectedModules = [
    "proof",
    "working-with-duck",
    "laser-loon",
    "quasi-puzzler",
    "garmin-watch",
    "clinical-chaos",
    "retro-labyrinth",
    "simulator",
    "crf",
  ];

  it("registers every required interactive game and module", () => {
    expectedModules.forEach((modId) => {
      expect(GAME_MANUALS[modId]).toBeDefined();
      expect(GAME_MANUALS[modId].id).toBe(modId);
    });
  });

  it("contains rich structure with objectives, controls, rules, and engineering lore for each manual", () => {
    Object.values(GAME_MANUALS).forEach((manual) => {
      expect(manual.title).toBeTruthy();
      expect(manual.objective).toBeTruthy();
      expect(manual.quickSummary).toBeTruthy();
      expect(manual.controls.length).toBeGreaterThan(0);
      expect(manual.rules.length).toBeGreaterThan(0);
      expect(manual.lore.title).toBeTruthy();
      expect(manual.lore.story).toBeTruthy();
      expect(manual.lore.realWorldTech.length).toBeGreaterThan(0);
    });
  });
});

describe("Trial & Error Field Manual controls (#1080)", () => {
  /** Where the Card Table and its desks handle keys. */
  const SOURCES = [
    "components/trial-and-error/CardTable.tsx",
    "components/trial-and-error/QcDesk.tsx",
    "components/trial-and-error/FigureDesk.tsx",
  ];
  /** How the manual writes a key that the code spells out. */
  const LABELS: Record<string, string> = {
    ArrowLeft: "←",
    ArrowRight: "→",
    ArrowUp: "↑",
    ArrowDown: "↓",
    " ": "Space",
    Escape: "Esc",
  };

  /** Every key literal a handler compares against, as the manual writes it. */
  function handledKeys(): Set<string> {
    const keys = new Set<string>();
    for (const file of SOURCES) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      const compared = /\bkey(?:\.toLowerCase\(\))?\s*[!=]==\s*"([^"]+)"/g;
      for (const [, key] of source.matchAll(compared)) keys.add(key);
      // Keys matched through a lookup table, such as `moves[event.key]`.
      const tabled = /^\s*(Arrow(?:Left|Right|Up|Down)|Home|End):/gm;
      for (const [, key] of source.matchAll(tabled)) keys.add(key);
    }
    return new Set(
      [...keys].map(
        (key) => LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : key)
      )
    );
  }

  it("documents every key the Card Table and its desks handle", () => {
    const documented = new Set(
      GAME_MANUALS["trial-and-error"].controls.flatMap((control) =>
        (control.key ?? "").split(/\s*[/+]\s*|\s+/).filter(Boolean)
      )
    );
    const keys = handledKeys();
    // Guards the scan itself: a refactor that hides every key must fail.
    expect(keys.size).toBeGreaterThanOrEqual(15);
    const missing = [...keys].filter((key) => !documented.has(key));
    expect(missing).toEqual([]);
  });
});
