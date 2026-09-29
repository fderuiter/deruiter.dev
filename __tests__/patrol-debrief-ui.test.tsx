import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import { DebriefScreen } from "@/components/patrol/DebriefScreen";
import { ShiftSummary } from "@/components/patrol/ShiftSummary";
import { liveAnnouncer } from "@/hooks/useAnnouncer";
import {
  evaluateIncidentDebrief,
  createInitialShiftState,
  DEBRIEF_DIMENSION_ORDER,
  type PatrolEvent,
  type PatrolScenario,
  type ShiftState,
} from "@/lib/patrol";

/**
 * React Testing Library integration suite for the M7 Contextual Debrief UI
 * (Issue #753): `<DebriefScreen />` and the upgraded `<ShiftSummary />`.
 */

const scenarioFixture: PatrolScenario = {
  id: "wrist-injury-lower-park",
  title: "Lower Park FOOSH Wrist Injury",
  actions: [],
  debriefRules: [],
};

const exemplaryEvents: PatrolEvent[] = [
  {
    timestamp: 1,
    scenarioId: "wrist-injury-lower-park",
    action: "assess-scene-safety",
    context: { label: "Assess & Secure Scene Safety", category: "assessment" },
  },
  {
    timestamp: 2,
    scenarioId: "wrist-injury-lower-park",
    action: "secondary-assessment",
    context: {
      label: "Focused Wrist Exam & PMS Check",
      category: "assessment",
    },
  },
  {
    timestamp: 3,
    scenarioId: "wrist-injury-lower-park",
    action: "splint-wrist",
    context: {
      label: "Splint the Wrist & Re-verify PMS",
      category: "treatment",
    },
  },
  {
    timestamp: 4,
    scenarioId: "wrist-injury-lower-park",
    action: "DIALOGUE_CHOICE",
    context: {
      speaker: "Casey (Second-Year Patroller)",
      style: "directive",
      clarity: "high",
      closesLoop: true,
    },
  },
];

describe("Patrol Shift — M7 Debrief UI Integration (Issue #753)", () => {
  afterEach(cleanup);

  describe("<DebriefScreen />", () => {
    const result = evaluateIncidentDebrief(
      "wrist-injury-lower-park",
      exemplaryEvents,
      {
        excessiveSpeedTime: 0,
        abruptDirectionChanges: 0,
        boundaryViolations: 0,
        collisions: 0,
        controlledStops: 2,
        routeEfficiency: 95,
        judgmentScore: 95,
      }
    );

    it("renders all five dimension meters with accessible progressbar semantics", () => {
      render(
        <DebriefScreen
          scenario={scenarioFixture}
          result={result}
          onReturnToHub={vi.fn()}
        />
      );

      expect(screen.getByTestId("patrol-debrief-screen")).toBeDefined();

      for (const dimension of DEBRIEF_DIMENSION_ORDER) {
        const meter = screen.getByTestId(`dimension-meter-${dimension}`);
        const dimensionScore = result.dimensions[dimension];
        const progressbar = within(meter).getByRole("progressbar");

        expect(progressbar.getAttribute("aria-valuenow")).toBe(
          String(dimensionScore.score)
        );
        expect(progressbar.getAttribute("aria-valuemin")).toBe("0");
        expect(progressbar.getAttribute("aria-valuemax")).toBe("10");
        // Status is never conveyed by color alone: the numeric score and a
        // text rating are always present alongside the bar (AGENTS.md #10).
        expect(meter.textContent).toContain(`${dimensionScore.score}/10`);
        expect(meter.textContent?.toLowerCase()).toContain(
          dimensionScore.rating.replace("-", " ")
        );
      }
    });

    it("announces the overall rating through the root announcer (#1125)", () => {
      const announceSpy = vi.spyOn(liveAnnouncer, "announce");
      render(
        <DebriefScreen
          scenario={scenarioFixture}
          result={result}
          onReturnToHub={vi.fn()}
        />
      );

      expect(announceSpy).toHaveBeenCalledTimes(1);
      expect(announceSpy).toHaveBeenCalledWith(
        `Incident debrief complete. Overall rating: ${result.overallRating}.`,
        "polite"
      );
      expect(screen.queryByRole("status")).toBeNull();
      announceSpy.mockRestore();
      liveAnnouncer.clear();
    });

    it("renders qualitative observation cards with icon badges, capped at three", () => {
      render(
        <DebriefScreen
          scenario={scenarioFixture}
          result={result}
          onReturnToHub={vi.fn()}
        />
      );

      const observationsContainer = screen.getByTestId("debrief-observations");
      const cards = within(observationsContainer).getAllByTestId(
        /^observation-/
      );
      expect(cards.length).toBeGreaterThan(0);
      expect(cards.length).toBeLessThanOrEqual(3);

      for (const card of cards) {
        expect(card.querySelector("svg")).not.toBeNull();
      }
    });

    it("renders the OET descent telemetry pill with controlled stops and ride comfort", () => {
      render(
        <DebriefScreen
          scenario={scenarioFixture}
          result={result}
          onReturnToHub={vi.fn()}
        />
      );

      const pill = screen.getByTestId("oet-telemetry-pill");
      expect(pill.textContent).toContain("2 controlled stops");
      expect(pill.textContent).toMatch(/smooth/i);
    });

    it("omits the OET telemetry pill when no descent metrics are available", () => {
      const noTransportResult = evaluateIncidentDebrief(
        "wrist-injury-lower-park",
        exemplaryEvents
      );
      render(
        <DebriefScreen
          scenario={scenarioFixture}
          result={noTransportResult}
          onReturnToHub={vi.fn()}
        />
      );
      expect(screen.queryByTestId("oet-telemetry-pill")).toBeNull();
    });

    it("invokes onReturnToHub and onReplayIncident from their respective buttons", () => {
      const onReturnToHub = vi.fn();
      const onReplayIncident = vi.fn();

      render(
        <DebriefScreen
          scenario={scenarioFixture}
          result={result}
          onReturnToHub={onReturnToHub}
          onReplayIncident={onReplayIncident}
        />
      );

      fireEvent.click(screen.getByTestId("replay-incident-btn"));
      expect(onReplayIncident).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId("return-to-hub-btn"));
      expect(onReturnToHub).toHaveBeenCalledTimes(1);
    });

    it("hides the Replay Incident action when no handler is supplied", () => {
      render(
        <DebriefScreen
          scenario={scenarioFixture}
          result={result}
          onReturnToHub={vi.fn()}
        />
      );
      expect(screen.queryByTestId("replay-incident-btn")).toBeNull();
    });

    it("gives every interactive control a minimum 44px touch target with tactile feedback", () => {
      render(
        <DebriefScreen
          scenario={scenarioFixture}
          result={result}
          onReturnToHub={vi.fn()}
          onReplayIncident={vi.fn()}
        />
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
      for (const button of buttons) {
        expect(button.className).toMatch(/min-h-\[44px\]/);
        expect(button.className).toMatch(/active:scale-\[0\.98\]/);
      }
    });
  });

  describe("<ShiftSummary />", () => {
    const eventHistory: PatrolEvent[] = [
      {
        timestamp: 1,
        scenarioId: "wrist-injury-lower-park",
        action: "PHASE_TRANSITION:PATROL_MAP->DISPATCH",
        context: { from: "PATROL_MAP", to: "DISPATCH" },
      },
      {
        timestamp: 2,
        scenarioId: "wrist-injury-lower-park",
        action: "assess-scene-safety",
        context: {
          label: "Assess & Secure Scene Safety",
          category: "assessment",
        },
      },
      {
        timestamp: 3,
        scenarioId: "wrist-injury-lower-park",
        action: "radio-request-assist",
        context: {
          label: "Radio Base for Additional Traffic Control",
          category: "communication",
        },
      },
      {
        timestamp: 4,
        scenarioId: "wrist-injury-lower-park",
        action: "splint-wrist",
        context: {
          label: "Splint the Wrist & Re-verify PMS",
          category: "treatment",
        },
      },
      {
        timestamp: 5,
        scenarioId: "wrist-injury-lower-park",
        action: "DIALOGUE_CHOICE",
        context: { closesLoop: true, style: "directive", speaker: "Casey" },
      },
      {
        timestamp: 6,
        scenarioId: "wrist-injury-lower-park",
        action: "OET_TRANSPORT_COMPLETED",
        payload: {
          judgmentScore: 90,
          metrics: { judgmentScore: 90, controlledStops: 1 },
        },
      },
      {
        timestamp: 7,
        scenarioId: "cat-track-collision",
        action: "PHASE_TRANSITION:PATROL_MAP->DISPATCH",
        context: { from: "PATROL_MAP", to: "DISPATCH" },
      },
      {
        timestamp: 8,
        scenarioId: "cat-track-collision",
        action: "assess-scene-safety",
        context: {
          label: "Assess & Secure Scene Safety",
          category: "assessment",
        },
      },
      {
        timestamp: 9,
        scenarioId: "cat-track-collision",
        action: "reassess-patient-status",
        context: {
          label: "Reassess After a Few Minutes",
          category: "assessment",
        },
      },
    ];

    function buildShiftState(): ShiftState {
      return {
        ...createInitialShiftState(null, "SHIFT_COMPLETE"),
        timeElapsedMinutes: 42,
        incidentsCompleted: 2,
        isCompleted: true,
      };
    }

    it("renders the playful operational stats grid computed from PatrolEvent[] counts", () => {
      render(
        <ShiftSummary
          shiftState={buildShiftState()}
          eventHistory={eventHistory}
          onResetShift={vi.fn()}
        />
      );

      expect(screen.getByTestId("playful-stats-grid")).toBeDefined();
      expect(
        screen.getByTestId("playful-stat-callsHandled").textContent
      ).toContain("2");
      expect(
        screen.getByTestId("playful-stat-radioTransmissions").textContent
      ).toContain("1");
      expect(
        screen.getByTestId("playful-stat-patientsAssisted").textContent
      ).toContain("2");
      expect(
        screen.getByTestId("playful-stat-sledTransports").textContent
      ).toContain("1");
      expect(
        screen.getByTestId("playful-stat-trailsChecked").textContent
      ).toContain("2");
      expect(
        screen.getByTestId("playful-stat-communicationRating").textContent
      ).toMatch(/Clear & Confirmed/i);
    });

    it("renders the composite five-dimension performance meters", () => {
      render(
        <ShiftSummary
          shiftState={buildShiftState()}
          eventHistory={eventHistory}
          onResetShift={vi.fn()}
        />
      );

      const grid = screen.getByTestId("composite-dimension-grid");
      for (const dimension of DEBRIEF_DIMENSION_ORDER) {
        expect(
          within(grid).getByTestId(`dimension-meter-${dimension}`)
        ).toBeDefined();
      }
    });

    it("renders a collapsible, filterable chronological event audit trail", () => {
      render(
        <ShiftSummary
          shiftState={buildShiftState()}
          eventHistory={eventHistory}
          onResetShift={vi.fn()}
        />
      );

      expect(screen.getByTestId("shift-log-list")).toBeDefined();
      expect(
        screen.getByText(
          `${eventHistory.length} of ${eventHistory.length} events`
        )
      ).toBeDefined();

      // Filter to a single category.
      fireEvent.change(screen.getByTestId("shift-log-filter"), {
        target: { value: "communication" },
      });
      expect(screen.getByText("1 of 9 events")).toBeDefined();

      // Collapse the log entirely.
      const toggle = screen.getByTestId("shift-log-toggle");
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      fireEvent.click(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByTestId("shift-log-list")).toBeNull();
    });

    it("invokes onResetShift from both the Clock Out and Start New Shift controls", () => {
      const onResetShift = vi.fn();
      render(
        <ShiftSummary
          shiftState={buildShiftState()}
          eventHistory={eventHistory}
          onResetShift={onResetShift}
        />
      );

      fireEvent.click(screen.getByTestId("clock-out-btn"));
      fireEvent.click(screen.getByTestId("start-new-shift-btn"));
      expect(onResetShift).toHaveBeenCalledTimes(2);
    });

    it("renders a safe, non-crashing summary for a shift with zero events", () => {
      render(
        <ShiftSummary
          shiftState={buildShiftState()}
          eventHistory={[]}
          onResetShift={vi.fn()}
        />
      );

      expect(screen.getByTestId("patrol-shift-summary")).toBeDefined();
      expect(
        screen.getByTestId("playful-stat-callsHandled").textContent
      ).toContain("0");
      expect(
        screen.getByText(/No individual event telemetry logged/i)
      ).toBeDefined();
    });

    it("gives shift control buttons and log controls a minimum 44px touch target with tactile feedback", () => {
      render(
        <ShiftSummary
          shiftState={buildShiftState()}
          eventHistory={eventHistory}
          onResetShift={vi.fn()}
        />
      );

      for (const testId of [
        "clock-out-btn",
        "start-new-shift-btn",
        "shift-log-toggle",
      ]) {
        const button = screen.getByTestId(testId);
        expect(button.className).toMatch(/min-h-\[44px\]/);
        expect(button.className).toMatch(/active:scale-\[0\.98\]/);
      }

      const select = screen.getByTestId("shift-log-filter");
      expect(select.className).toMatch(/min-h-\[44px\]/);
    });
  });
});
