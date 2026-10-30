import { describe, expect, expectTypeOf, it } from "vitest";
import * as gameManualsModule from "@/lib/game-manuals";
import { GAME_MANUALS } from "@/lib/game-manuals";
import type {
  FieldManualData,
  ManualControl,
  ManualRule,
  EngineeringLore,
} from "@/types/game-manual";

describe("lib/game-manuals export contract snapshot (#3487)", () => {
  const EXPECTED_GAME_IDS = [
    "clinical-chaos",
    "crf",
    "for-better-or-bulk",
    "garmin-watch",
    "laser-loon",
    "meme-vault",
    "patrol",
    "patty-drive-thru",
    "proof",
    "protocol-drift",
    "quasi-puzzler",
    "retro-labyrinth",
    "simulator",
    "study-director",
    "trial-and-error",
    "working-with-duck",
  ];

  it("exports the exact legacy runtime symbols", () => {
    // In legacy lib/game-manuals.ts, GAME_MANUALS is the only export.
    // When re-exported through lib/arcade, individual manuals are also exposed.
    expect(gameManualsModule.GAME_MANUALS).toBeDefined();
    expect(typeof gameManualsModule.GAME_MANUALS).toBe("object");
  });

  it("registers exactly the 16 canonical field manuals", () => {
    const keys = Object.keys(GAME_MANUALS).sort();
    expect(keys).toEqual(EXPECTED_GAME_IDS);
    expect(keys.length).toBe(16);
  });

  it("re-exports public TypeScript types matching FieldManualData contract", () => {
    expectTypeOf<FieldManualData>().toHaveProperty("id");
    expectTypeOf<FieldManualData>().toHaveProperty("title");
    expectTypeOf<FieldManualData>().toHaveProperty("subtitle");
    expectTypeOf<FieldManualData>().toHaveProperty("genre");
    expectTypeOf<FieldManualData>().toHaveProperty("badge");
    expectTypeOf<FieldManualData>().toHaveProperty("route");
    expectTypeOf<FieldManualData>().toHaveProperty("objective");
    expectTypeOf<FieldManualData>().toHaveProperty("quickSummary");
    expectTypeOf<FieldManualData>().toHaveProperty("controls");
    expectTypeOf<FieldManualData>().toHaveProperty("rules");
    expectTypeOf<FieldManualData>().toHaveProperty("proTips");
    expectTypeOf<FieldManualData>().toHaveProperty("lore");
  });

  it("validates that each manual has complete required fields and structure", () => {
    for (const [id, manual] of Object.entries(GAME_MANUALS)) {
      expect(manual.id).toBe(id);
      expect(manual.title).toBeTruthy();
      expect(manual.subtitle).toBeTruthy();
      expect(manual.genre).toBeTruthy();
      expect(manual.badge).toBeTruthy();
      expect(manual.route).toBeTruthy();
      expect(manual.objective).toBeTruthy();
      expect(manual.quickSummary).toBeTruthy();
      expect(Array.isArray(manual.controls)).toBe(true);
      expect(manual.controls.length).toBeGreaterThan(0);
      expect(Array.isArray(manual.rules)).toBe(true);
      expect(manual.rules.length).toBeGreaterThan(0);
      expect(Array.isArray(manual.proTips)).toBe(true);
      expect(manual.proTips.length).toBeGreaterThan(0);
      expect(manual.lore).toBeDefined();
      expect(manual.lore.title).toBeTruthy();
      expect(manual.lore.story).toBeTruthy();
      expect(Array.isArray(manual.lore.realWorldTech)).toBe(true);
      expect(manual.lore.realWorldTech.length).toBeGreaterThan(0);

      // Verify controls schema
      for (const ctrl of manual.controls) {
        expectTypeOf(ctrl).toMatchTypeOf<ManualControl>();
        expect(ctrl.action).toBeTruthy();
        expect(ctrl.description).toBeTruthy();
        expect(ctrl.key).toBeTruthy();
      }

      // Verify rules schema
      for (const rule of manual.rules) {
        expectTypeOf(rule).toMatchTypeOf<ManualRule>();
        expect(rule.title).toBeTruthy();
        expect(rule.detail).toBeTruthy();
        expect(rule.badge).toBeTruthy();
      }

      // Verify lore schema
      expectTypeOf(manual.lore).toMatchTypeOf<EngineeringLore>();
    }
  });

  it("matches the exact content snapshot of all 16 field manuals", () => {
    expect(GAME_MANUALS).toMatchSnapshot();
  });
});
