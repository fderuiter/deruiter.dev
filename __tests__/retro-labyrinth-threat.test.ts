import { describe, it, expect } from "vitest";
import { isPatrolThreat } from "@/components/retro-labyrinth/threat";

describe("isPatrolThreat (phone fairness)", () => {
  const player = { x: 5, y: 5 };

  it("warns when a live patrol is one orthogonal step away", () => {
    for (const cell of [
      { x: 4, y: 5 },
      { x: 6, y: 5 },
      { x: 5, y: 4 },
      { x: 5, y: 6 },
    ]) {
      expect(isPatrolThreat(player, [{ ...cell, state: "patrol" }])).toBe(true);
    }
  });

  it("does not warn for a diagonal, a two-step gap or a distant patrol", () => {
    expect(isPatrolThreat(player, [{ x: 4, y: 4, state: "patrol" }])).toBe(
      false
    );
    expect(isPatrolThreat(player, [{ x: 3, y: 5, state: "patrol" }])).toBe(
      false
    );
    expect(isPatrolThreat(player, [{ x: 12, y: 1, state: "patrol" }])).toBe(
      false
    );
  });

  it("ignores patrols that cannot step", () => {
    expect(isPatrolThreat(player, [{ x: 4, y: 5, state: "stunned" }])).toBe(
      false
    );
    expect(isPatrolThreat(player, [{ x: 4, y: 5, state: "frozen" }])).toBe(
      false
    );
  });

  it("is false with no patrols in the room", () => {
    expect(isPatrolThreat(player, [])).toBe(false);
  });

  it("is true when any one of several patrols is adjacent", () => {
    expect(
      isPatrolThreat(player, [
        { x: 0, y: 0, state: "patrol" },
        { x: 5, y: 6, state: "patrol" },
      ])
    ).toBe(true);
  });
});
