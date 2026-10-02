// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  ACT_I,
  DMC_MILESTONE_SCENARIO,
  DOSE_ESCALATION_SCENARIO,
  FDA_IR_SCENARIO,
  SCENARIOS,
  advanceTable,
  createTableState,
  deriveTableView,
} from "@/lib/trial-and-error";

const introOf = (scenario = DOSE_ESCALATION_SCENARIO) =>
  deriveTableView(scenario, createTableState(scenario)).bossIntro;

describe("boss intro view (#1083)", () => {
  it("gives every Boss Blind an intro with its own debuff line, and no other Blind one", () => {
    const scenarios = Object.values(SCENARIOS);
    expect(scenarios.some((s) => s.blind.tier === "BOSS_BLIND")).toBe(true);
    for (const scenario of scenarios) {
      const intro = introOf(scenario);
      if (scenario.blind.tier !== "BOSS_BLIND") {
        expect(intro, scenario.id).toBeNull();
        continue;
      }
      expect(intro, scenario.id).not.toBeNull();
      expect(intro!.debuff.trim().length, scenario.id).toBeGreaterThan(0);
      expect(intro).toMatchObject({
        title: scenario.title,
        bossName: scenario.boss!.name,
        debuff: scenario.boss!.description,
        quota: scenario.blind.quota,
        startingCpu: scenario.table.startingCpu,
      });
    }
  });

  it("names the Act I Boss's Safety Set Only debuff, quota and CPU, with no stages", () => {
    const boss = ACT_I.bossPool!.find(
      (s) => s.id === DOSE_ESCALATION_SCENARIO.id
    )!;
    expect(introOf(boss)).toEqual({
      title: "Dose Escalation Committee",
      bossName: "Safety Set Only",
      debuff: DOSE_ESCALATION_SCENARIO.boss!.description,
      quota: 8500,
      startingCpu: 10,
      stages: [],
      dueHours: null,
      questions: [],
      csrSlots: [],
    });
  });

  it("lists the DMC milestone's two stages in order", () => {
    expect(introOf(DMC_MILESTONE_SCENARIO)!.stages).toEqual(
      DMC_MILESTONE_SCENARIO.encounter!.stages.map(
        ({ name, session, quota }) => ({ name, session, quota })
      )
    );
  });

  it("gives the FDA Information Request its deadline and questions (#921)", () => {
    expect(introOf(FDA_IR_SCENARIO)).toMatchObject({
      bossName: "Two-Hand Response",
      dueHours: 48,
      questions: FDA_IR_SCENARIO.encounter.questions.map((q) => q.question),
      stages: [],
    });
  });

  it("describes the Blind, not the table's progress", () => {
    const scenario = DOSE_ESCALATION_SCENARIO;
    const fresh = createTableState(scenario);
    const later = advanceTable(
      scenario,
      advanceTable(scenario, fresh, {
        type: "TOGGLE_SELECT",
        cardId: fresh.hand[0],
      }),
      { type: "DISCARD" }
    );
    expect(later.cpu.spent).toBeGreaterThan(0);
    expect(deriveTableView(scenario, later).bossIntro).toEqual(
      introOf(scenario)
    );
  });
});
