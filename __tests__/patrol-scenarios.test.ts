// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  PATROL_SCENARIOS,
  INITIAL_PATROL_SCENARIOS,
  OEC_SAMPLE_SCENARIO,
  ALL_PATROL_SCENARIOS,
  checkActionPreconditions,
  getAvailableActions,
  type ScenarioAction,
} from "@/lib/patrol";

/**
 * Schema/lint invariants for the three M6 MVP scenario content packages
 * (Issue #752). Validates the `PatrolScenario` shape, that every action is
 * reachable through some valid ordering, that no preconditions/dialogue
 * triggers point at nonexistent action ids, and that every scenario carries
 * at least one non-binary interpersonal dialogue moment plus a
 * debrief-relevant event source.
 */

/** Iteratively expands the set of action ids reachable given precondition chains. */
function computeReachableActionIds(actions: ScenarioAction[]): Set<string> {
  const reachable = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const action of actions) {
      if (reachable.has(action.id)) continue;
      const reqs = action.preconditions ?? action.prerequisites ?? [];
      if (reqs.every((reqId) => reachable.has(reqId))) {
        reachable.add(action.id);
        changed = true;
      }
    }
  }
  return reachable;
}

describe("Patrol Shift — M6 Scenario Content Package Invariants (Issue #752)", () => {
  it("registers exactly the three MVP scenarios with unique ids", () => {
    expect(PATROL_SCENARIOS).toHaveLength(3);
    const ids = PATROL_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const scenario of PATROL_SCENARIOS) {
    describe(`Scenario: ${scenario.title} (${scenario.id})`, () => {
      it("conforms to the PatrolScenario schema with core fields present", () => {
        expect(scenario.id).toBeTruthy();
        expect(scenario.title).toBeTruthy();
        expect(scenario.actions.length).toBeGreaterThan(0);
        expect(scenario.debriefRules.length).toBeGreaterThan(0);
      });

      it("has unique action ids with no orphaned precondition references", () => {
        const actionIds = new Set(scenario.actions.map((a) => a.id));
        expect(actionIds.size).toBe(scenario.actions.length);

        for (const action of scenario.actions) {
          const reqs = action.preconditions ?? action.prerequisites ?? [];
          for (const reqId of reqs) {
            expect(actionIds.has(reqId)).toBe(true);
          }
        }
      });

      it("has every action reachable through some valid ordering (no orphaned transitions)", () => {
        const reachable = computeReachableActionIds(scenario.actions);
        for (const action of scenario.actions) {
          expect(reachable.has(action.id)).toBe(true);
        }
      });

      it("supports multiple valid action orderings: more than one action is available at scene arrival", () => {
        const available = getAvailableActions(scenario.actions, []);
        expect(available.length).toBeGreaterThan(1);
        for (const action of available) {
          expect(checkActionPreconditions(action, [])).toBe(true);
        }
      });

      it("has at least one debrief-relevant event source (scene safety + vitals check actions)", () => {
        expect(
          scenario.actions.some((a) => a.securesSceneSafety === true)
        ).toBe(true);
        expect(scenario.actions.some((a) => Boolean(a.vitalsCheck))).toBe(true);
      });

      it("has at least one interpersonal dialogue moment framed as a non-binary style choice", () => {
        expect(scenario.dialogueMoments?.length ?? 0).toBeGreaterThan(0);

        for (const moment of scenario.dialogueMoments ?? []) {
          expect(moment.speaker).toBeTruthy();
          expect(moment.prompt).toBeTruthy();
          expect(moment.options.length).toBeGreaterThanOrEqual(2);

          const optionIds = new Set(moment.options.map((o) => o.id));
          expect(optionIds.size).toBe(moment.options.length);

          // Non-binary: options differ in communication style, not correctness.
          const styles = new Set(moment.options.map((o) => o.style));
          expect(styles.size).toBeGreaterThan(1);

          for (const option of moment.options) {
            expect(option.text.length).toBeGreaterThan(0);
            expect(option.response.length).toBeGreaterThan(0);
            expect(option.debriefNote.length).toBeGreaterThan(0);
            expect(["high", "moderate", "low"]).toContain(option.clarity);
          }

          if (moment.afterActionId) {
            expect(
              scenario.actions.some((a) => a.id === moment.afterActionId)
            ).toBe(true);
          }
        }
      });
    });
  }

  it("wires the specific dialogue themes called out in #752: delegation (busy-scene) and escalating uncertainty (ambiguous-patient)", () => {
    const wristInjury = PATROL_SCENARIOS.find(
      (s) => s.id === "wrist-injury-lower-park"
    );
    const ambiguousPatient = PATROL_SCENARIOS.find(
      (s) => s.id === "ambiguous-glade-fall"
    );
    const busyScene = PATROL_SCENARIOS.find(
      (s) => s.id === "cat-track-collision"
    );

    expect(wristInjury).toBeDefined();
    expect(ambiguousPatient).toBeDefined();
    expect(busyScene).toBeDefined();

    // Scenario A also exercises basic teamwork/delegation.
    expect(
      wristInjury?.dialogueMoments?.some((m) =>
        m.options.some((o) => o.style === "directive")
      )
    ).toBe(true);

    // Scenario B: admitting uncertainty and escalating to dispatch.
    expect(
      ambiguousPatient?.dialogueMoments?.some((m) =>
        m.options.some((o) => o.style === "candid")
      )
    ).toBe(true);

    // Scenario C: delegation to a second responding patroller amid a busy scene.
    expect(
      busyScene?.dialogueMoments?.some((m) => /Morgan/i.test(m.speaker))
    ).toBe(true);
  });

  it("flags every clinically-specific detail in the three scenario files for OEC/NSP review (#744 content discipline)", () => {
    // Reads source text directly (not a module import) because the
    // PLACEHOLDER-CONTENT-REVIEW marker is a comment, which is stripped
    // before it ever reaches the compiled PatrolScenario objects imported
    // through the public lib/patrol entry point above. This does not cross
    // the lib/patrol/scenarios/ module boundary that depcruise enforces.
    const scenarioFiles = [
      "wrist-injury.ts",
      "ambiguous-patient.ts",
      "busy-scene.ts",
    ];

    for (const fileName of scenarioFiles) {
      const filePath = path.resolve(
        process.cwd(),
        "lib/patrol/scenarios",
        fileName
      );
      const source = fs.readFileSync(filePath, "utf-8");
      expect(source).toContain("PLACEHOLDER-CONTENT-REVIEW");
      expect(source).toContain("see #744");
    }
  });

  it("orders wrist-injury first with an immediately-actionable first action (no preconditions)", () => {
    // Depended on by __tests__/patrol-shift-loop.test.tsx, which clicks
    // PATROL_SCENARIOS[0].actions[0] directly while on scene.
    const first = PATROL_SCENARIOS[0];
    const firstAction = first.actions[0];
    expect(
      firstAction.preconditions ?? firstAction.prerequisites ?? []
    ).toEqual([]);
  });

  it("scenario B (ambiguous patient) explicitly reinforces reassessment over time", () => {
    const ambiguousPatient = PATROL_SCENARIOS.find(
      (s) => s.id === "ambiguous-glade-fall"
    );
    const reassessAction = ambiguousPatient?.actions.find((a) =>
      a.id.includes("reassess")
    );
    expect(reassessAction).toBeDefined();
    expect(reassessAction?.category).toBe("assessment");
  });

  it("scenario C (busy scene) includes explicit crowd-management and radio-communication actions", () => {
    const busyScene = PATROL_SCENARIOS.find(
      (s) => s.id === "cat-track-collision"
    );
    expect(busyScene?.actions.some((a) => a.id === "manage-crowd")).toBe(true);
    expect(busyScene?.actions.some((a) => a.category === "communication")).toBe(
      true
    );
  });

  describe("Scenario Catalog Integrity & Structural Validity (lib/patrol/scenarios/catalog.ts)", () => {
    const catalogScenarios = [...INITIAL_PATROL_SCENARIOS, OEC_SAMPLE_SCENARIO];

    it("exports valid initial scenarios and OEC sample scenario with non-empty IDs", () => {
      expect(INITIAL_PATROL_SCENARIOS.length).toBeGreaterThan(0);
      expect(OEC_SAMPLE_SCENARIO).toBeDefined();

      for (const scenario of catalogScenarios) {
        expect(typeof scenario.id).toBe("string");
        expect(scenario.id.trim().length).toBeGreaterThan(0);
      }
    });

    it("ensures all scenarios across the catalog have unique, non-empty IDs", () => {
      const allIds = ALL_PATROL_SCENARIOS.map((s) => s.id);
      expect(allIds.length).toBeGreaterThan(0);

      for (const id of allIds) {
        expect(typeof id).toBe("string");
        expect(id.trim().length).toBeGreaterThan(0);
      }

      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });

    for (const scenario of catalogScenarios) {
      describe(`Catalog Scenario: ${scenario.title} (${scenario.id})`, () => {
        it("asserts structural validity for scenario metadata", () => {
          expect(scenario.id.trim().length).toBeGreaterThan(0);
          expect(scenario.title.trim().length).toBeGreaterThan(0);
          expect(scenario.description).toBeDefined();
          expect(typeof scenario.description).toBe("string");
          expect(scenario.description!.trim().length).toBeGreaterThan(0);

          if (scenario.estimatedMinutes !== undefined) {
            expect(scenario.estimatedMinutes).toBeGreaterThan(0);
          }

          if (scenario.coordinates) {
            expect(typeof scenario.coordinates.x).toBe("number");
            expect(typeof scenario.coordinates.y).toBe("number");
          }
        });

        it("asserts structural validity for scenario actions", () => {
          expect(scenario.actions.length).toBeGreaterThan(0);
          const actionIds = new Set<string>();

          for (const action of scenario.actions) {
            expect(typeof action.id).toBe("string");
            expect(action.id.trim().length).toBeGreaterThan(0);
            expect(typeof action.label).toBe("string");
            expect(action.label.trim().length).toBeGreaterThan(0);

            if (action.description) {
              expect(typeof action.description).toBe("string");
            }

            if (action.costMinutes !== undefined) {
              expect(action.costMinutes).toBeGreaterThanOrEqual(0);
            }

            expect(actionIds.has(action.id)).toBe(false);
            actionIds.add(action.id);
          }
        });

        it("asserts structural validity for debrief rules", () => {
          expect(scenario.debriefRules.length).toBeGreaterThan(0);
          const ruleIds = new Set<string>();

          for (const rule of scenario.debriefRules) {
            expect(typeof rule.id).toBe("string");
            expect(rule.id.trim().length).toBeGreaterThan(0);
            expect(typeof rule.title).toBe("string");
            expect(rule.title.trim().length).toBeGreaterThan(0);
            expect(typeof rule.category).toBe("string");
            expect(rule.category.trim().length).toBeGreaterThan(0);
            expect(typeof rule.score).toBe("number");
            expect(rule.score).toBeGreaterThanOrEqual(0);
            expect(typeof rule.feedback).toBe("string");
            expect(rule.feedback.trim().length).toBeGreaterThan(0);

            expect(ruleIds.has(rule.id)).toBe(false);
            ruleIds.add(rule.id);
          }
        });
      });
    }
  });
});
