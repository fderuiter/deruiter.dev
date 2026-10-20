import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MedicalDisclaimerBanner } from "@/components/patrol/MedicalDisclaimerBanner";
import { SceneInteraction } from "@/components/patrol/SceneInteraction";
import { HandoffPanel } from "@/components/patrol/HandoffPanel";
import { HandoffScreen } from "@/components/patrol/HandoffScreen";
import { PatrolShiftContainer } from "@/components/patrol/PatrolShiftContainer";
import { createPatrolShiftEngine, type PatrolScenario } from "@/lib/patrol";

// PLACEHOLDER — needs OEC/NSP content review, see #744
const dummyScenario: PatrolScenario = {
  id: "test-disclaimer-scenario",
  title: "Test Scene Incident",
  difficulty: "beginner",
  location: "Mid-Mountain Chair 3",
  actions: [
    {
      id: "assess-scene",
      label: "Assess Scene Safety",
      costMinutes: 2,
    },
  ],
  debriefRules: [],
};

describe("Patrol Shift — M5 Accessible Medical Disclaimer Banner (#751)", () => {
  beforeEach(() => {
    // Clear session storage before each test
    try {
      window.sessionStorage.clear();
    } catch {
      // Ignore if unavailable
    }
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("1. Accessible Disclaimer Rendering Across Scenes & Handoff", () => {
    it("renders accessible disclaimer banner in SceneInteraction component", () => {
      render(
        <SceneInteraction
          scenario={dummyScenario}
          actionHistory={[]}
          onExecuteAction={() => {}}
          onPrepareTransport={() => {}}
        />
      );

      const banner = screen.getByTestId("medical-disclaimer-banner");
      expect(banner).toBeDefined();
      expect(banner.getAttribute("role")).toBe("note");
      expect(banner.getAttribute("aria-label")).toBe(
        "Medical & Clinical Disclaimer"
      );
      expect(
        screen.getByText(/Simulation Notice & Medical Disclaimer/i)
      ).toBeDefined();
      expect(screen.getByText(/Educational Prototype/i)).toBeDefined();
    });

    it("renders accessible disclaimer banner in HandoffPanel and HandoffScreen", () => {
      render(
        <HandoffPanel
          scenario={dummyScenario}
          actionHistory={[]}
          timeElapsedMinutes={12}
          onCompleteHandoff={() => {}}
        />
      );

      expect(screen.getByTestId("medical-disclaimer-banner")).toBeDefined();
      expect(
        screen.getByText(/Simulation Notice & Medical Disclaimer/i)
      ).toBeDefined();

      cleanup();

      // Also verify backward compatibility wrapper HandoffScreen renders it
      render(
        <HandoffScreen
          scenario={dummyScenario}
          actionHistory={[]}
          timeElapsedMinutes={12}
          onCompleteHandoff={() => {}}
        />
      );

      expect(screen.getByTestId("medical-disclaimer-banner")).toBeDefined();
    });

    it("renders accessible disclaimer across studio container phases", () => {
      const engine = createPatrolShiftEngine([dummyScenario], {
        initialPhase: "INTRO",
      });

      const { rerender } = render(<PatrolShiftContainer engine={engine} />);

      // Intro phase renders disclaimer
      expect(screen.getByTestId("medical-disclaimer-banner")).toBeDefined();

      // Advance to SCENE phase
      engine.dispatch({ type: "START_SHIFT" });
      engine.dispatch({ type: "COMPLETE_BRIEFING" });
      engine.dispatch({
        type: "RECEIVE_DISPATCH",
        scenarioId: dummyScenario.id,
      });
      engine.dispatch({ type: "ACCEPT_DISPATCH" });
      engine.dispatch({ type: "ARRIVE_ON_SCENE" });

      rerender(<PatrolShiftContainer engine={engine} />);
      expect(screen.getByTestId("medical-disclaimer-banner")).toBeDefined();

      // Advance to HANDOFF phase
      engine.dispatch({ type: "COMPLETE_SCENE" });
      engine.dispatch({ type: "BEGIN_TRANSPORT" });
      engine.dispatch({ type: "ARRIVE_AT_BASE" });

      rerender(<PatrolShiftContainer engine={engine} />);
      expect(screen.getByTestId("medical-disclaimer-banner")).toBeDefined();
    });
  });

  describe("2. WCAG AA Conformance & Non-Reliance on Color Alone", () => {
    it("conveys meaning via semantic roles, icons, and text labels rather than color alone", () => {
      render(<MedicalDisclaimerBanner forceShow />);

      const banner = screen.getByTestId("medical-disclaimer-banner");
      expect(banner.getAttribute("role")).toBe("note");
      expect(banner.getAttribute("aria-label")).toBe(
        "Medical & Clinical Disclaimer"
      );

      // Verifies presence of explicit warning text (not relying on amber color alone)
      expect(
        screen.getByText(/Simulation Notice & Medical Disclaimer/i)
      ).toBeDefined();
      expect(screen.getByText(/Educational Prototype/i)).toBeDefined();
      expect(
        screen.getByText(/Non-clinical simulation artifact/i)
      ).toBeDefined();
      expect(banner.textContent).toContain("certified clinical guidance");
      expect(banner.textContent).toContain("certified medical diagnosis");

      // Verifies dismissal touch target compliance (minimum 44x44px target)
      const dismissBtn = screen.getByTestId("medical-disclaimer-dismiss");
      expect(dismissBtn.className).toContain("min-h-[44px]");
      expect(dismissBtn.className).toContain("min-w-[44px]");
      expect(dismissBtn.getAttribute("aria-label")).toBe(
        "Dismiss for Session: the medical disclaimer"
      );
    });
  });

  describe("3. Dismissibility & Per-Session Persistence", () => {
    it("dismisses the banner when user clicks dismiss and displays accessible reopen trigger", () => {
      render(<MedicalDisclaimerBanner forceShow={false} />);

      expect(screen.getByTestId("medical-disclaimer-banner")).toBeDefined();

      const dismissBtn = screen.getByTestId("medical-disclaimer-dismiss");
      fireEvent.click(dismissBtn);

      // Main banner is dismissed
      expect(screen.queryByTestId("medical-disclaimer-banner")).toBeNull();

      // Minimized bar with reopen button is displayed
      const reopenBtn = screen.getByTestId("medical-disclaimer-reopen");
      expect(reopenBtn).toBeDefined();
      expect(reopenBtn.className).toContain("min-h-[44px]");
      expect(reopenBtn.className).toContain("min-w-[44px]");
      expect(reopenBtn.getAttribute("aria-label")).toBe(
        "Show medical and clinical simulation disclaimer"
      );

      // Session storage records dismissal
      expect(sessionStorage.getItem("patrol_shift_disclaimer_dismissed")).toBe(
        "true"
      );

      // Clicking reopen restores the banner
      fireEvent.click(reopenBtn);
      expect(screen.getByTestId("medical-disclaimer-banner")).toBeDefined();
      expect(sessionStorage.getItem("patrol_shift_disclaimer_dismissed")).toBe(
        "false"
      );
    });

    it("remains non-blocking allowing interaction with underlying scene actions", () => {
      const executeSpy = vi.fn();
      render(
        <SceneInteraction
          scenario={dummyScenario}
          actionHistory={[]}
          onExecuteAction={executeSpy}
          onPrepareTransport={() => {}}
        />
      );

      // Disclaimer banner is visible
      expect(screen.getByTestId("medical-disclaimer-banner")).toBeDefined();

      // Player can freely click scene action without being blocked by modal overlay
      const actionBtn = screen.getByTestId("action-card-assess-scene");
      fireEvent.click(actionBtn);

      expect(executeSpy).toHaveBeenCalledWith(dummyScenario.actions[0]);
    });

    it("defensively handles environments where sessionStorage is unavailable or throws", () => {
      // Mock sessionStorage.getItem to throw
      vi.spyOn(window.sessionStorage, "getItem").mockImplementation(() => {
        throw new Error("Storage restricted in sandbox");
      });

      expect(() => {
        render(<MedicalDisclaimerBanner />);
      }).not.toThrow();

      expect(screen.getByTestId("medical-disclaimer-banner")).toBeDefined();
    });
  });
});
