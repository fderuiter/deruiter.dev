import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { CANONICAL_ROUTES } from "@/lib/dx/page-bench";
import { PUBLIC_ROUTE_REGISTRY } from "@/lib/public-routes";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import {
  PATROL_SCENARIOS,
  createInitialShiftState,
  transitionShiftPhase,
  recordAction,
  generateDebriefReport,
} from "@/lib/patrol";
import { PatrolShiftContainer } from "@/components/patrol/PatrolShiftContainer";

describe("Patrol Shift — M1 Foundation Scaffold & Discovery Verification", () => {
  it("registers /patrol across CANONICAL_ROUTES and PUBLIC_ROUTE_REGISTRY", () => {
    const canonicalEntry = CANONICAL_ROUTES.find((r) => r.path === "/patrol");
    expect(canonicalEntry).toBeDefined();
    expect(canonicalEntry?.category).toBe("tool");

    const publicEntry = PUBLIC_ROUTE_REGISTRY.find((r) => r.path === "/patrol");
    expect(publicEntry).toBeDefined();
    expect(publicEntry?.category).toBe("tool");
  });

  it("configures SEO metadata for /patrol in ROUTE_METADATA_CONFIGS without unverified clinical claims", () => {
    const meta = ROUTE_METADATA_CONFIGS.patrol;
    expect(meta).toBeDefined();
    expect(meta.path).toBe("/patrol");
    expect(meta.title).toContain("Patrol Shift");
    expect(meta.description).not.toMatch(/triage/i);
    expect(meta.description).not.toMatch(/Outdoor Emergency Transportation/i);
    expect(meta.keywords).not.toContain("Clinical Judgment Engine");
    expect(meta.keywords).not.toContain("OET Triage Engine");
  });

  it("renders foundation scaffold UI with prominent medical disclaimer and no invented clinical claims", () => {
    render(<PatrolShiftContainer />);

    expect(screen.getByTestId("patrol-shift-container")).toBeDefined();
    expect(
      screen.getByText(/Outdoor Emergency Care.*Toboggan Handling/i)
    ).toBeDefined();

    const disclaimer = screen.getByRole("note", {
      name: /Medical & Clinical Disclaimer/i,
    });
    expect(disclaimer).toBeDefined();
    expect(disclaimer.textContent).toMatch(
      /architectural simulation prototype under active development/i
    );
    expect(disclaimer.textContent).toMatch(
      /does not provide certified clinical guidance/i
    );
  });

  it("registers the three M6 MVP scenario content packages with well-formed actions", () => {
    // Superseded by M6 (#752): PATROL_SCENARIOS now returns the three real
    // MVP scenarios rather than the non-clinical M1 scaffold routines: see
    // __tests__/patrol-scenarios.test.ts for the full content-invariant suite.
    expect(PATROL_SCENARIOS.length).toBe(3);
    for (const scenario of PATROL_SCENARIOS) {
      expect(scenario.actions.length).toBeGreaterThan(0);
      for (const action of scenario.actions) {
        expect([
          "communication",
          "assessment",
          "decision",
          "transport",
          "treatment",
        ]).toContain(action.category);
      }
    }
  });

  it("executes deterministic shift FSM transitions and debrief reports", () => {
    const scenario = PATROL_SCENARIOS[0];
    const initial = createInitialShiftState(scenario.id);
    expect(initial.phase).toBe("briefing");
    expect(initial.timeElapsedMinutes).toBe(0);

    const patrolState = transitionShiftPhase(initial, "patrol");
    expect(patrolState.phase).toBe("patrol");

    const withAction = recordAction(patrolState, scenario.actions[0]);
    expect(withAction.actionHistory).toHaveLength(1);
    expect(withAction.timeElapsedMinutes).toBeGreaterThan(0);

    const debriefState = transitionShiftPhase(withAction, "debrief");
    expect(debriefState.phase).toBe("debrief");

    const report = generateDebriefReport(scenario, debriefState);
    expect(report.scenarioId).toBe(scenario.id);
    expect(report.score).toBeGreaterThanOrEqual(0);
  });
});
