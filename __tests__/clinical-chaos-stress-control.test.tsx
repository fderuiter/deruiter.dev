import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ClinicalTrialChaos } from "@/components/ClinicalTrialChaos";
import {
  getSpawnIntervalSeconds,
  tickAuditor,
  generateBIMOReport,
  createInitialScoreState,
  createInitialAuditorState,
} from "@/lib/clinical-trial-chaos/engine";
import {
  DEFAULT_STRESS_PARAMS,
  STRESS_PRESETS,
} from "@/lib/clinical-trial-chaos/scenarios";
import { ClinicalTrialChaosEngine } from "@/lib/clinical-trial-chaos/arcade-engine";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playSuccess: vi.fn(),
    playError: vi.fn(),
    muted: true,
  }),
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({
    announce: vi.fn(),
  }),
}));

describe("Clinical Trial Chaos - Stress Control & Live BIMO Stream", () => {
  afterEach(() => {
    cleanup();
  });
  describe("Engine & Pure Rule Functions", () => {
    it("scales subject spawn interval with arrivalRateMultiplier", () => {
      const baseInterval = getSpawnIntervalSeconds(1, 2, (s) => s, 1.0);
      const fastInterval = getSpawnIntervalSeconds(1, 2, (s) => s, 2.0);
      expect(fastInterval).toBeCloseTo(baseInterval / 2, 3);

      const surgeInterval = getSpawnIntervalSeconds(1, 2, (s) => s, 3.0);
      expect(surgeInterval).toBeCloseTo(baseInterval / 3, 3);
    });

    it("adjusts auditor movement speed and inspection pacing in real time", () => {
      const initialAuditor = createInitialAuditorState();
      const tickNormal = tickAuditor(initialAuditor, 1.0, 0, 1.0);
      const tickFast = tickAuditor(initialAuditor, 1.0, 0, 2.0);

      // Fast auditor moves twice as far across the floor in 1 second
      expect(Math.abs(tickFast.x - initialAuditor.x)).toBeCloseTo(
        Math.abs(tickNormal.x - initialAuditor.x) * 2,
        3
      );
      expect(tickFast.inspectTimer).toBeCloseTo(tickNormal.inspectTimer * 2, 3);
    });

    it("provides pre-configured stress presets with valid parameters", () => {
      expect(STRESS_PRESETS.baseline.params).toEqual(DEFAULT_STRESS_PARAMS);
      expect(STRESS_PRESETS.audit_rush.params.auditorPacingMultiplier).toBe(
        2.2
      );
      expect(STRESS_PRESETS.influx_surge.params.arrivalRateMultiplier).toBe(
        2.5
      );
      expect(STRESS_PRESETS.extreme_chaos.params.errorChance).toBe(0.9);
    });

    it("evaluates live BIMO report with accurate citations and actionable guidance", () => {
      const score = createInitialScoreState();
      score.subjectsSubmitted = 5;
      score.auditViolations = 3;
      score.expiredSubjects = 2;

      const auditor = createInitialAuditorState();
      auditor.suspicion = 80;

      const report = generateBIMOReport(score, auditor);
      expect(report.overallScore).toBeLessThan(100);
      expect(report.findings.length).toBeGreaterThan(0);

      const citations = report.findings.map((f) => f.regulation);
      expect(
        citations.some((c) => c.includes("21 CFR") || c.includes("ICH GCP"))
      ).toBe(true);
    });

    it("supports stress parameter updates on ClinicalTrialChaosEngine", () => {
      const engine = new ClinicalTrialChaosEngine();
      expect(engine.getState().stressParams).toEqual(DEFAULT_STRESS_PARAMS);

      engine.applyStressPreset("audit_rush");
      expect(engine.getState().stressParams.auditorPacingMultiplier).toBe(2.2);

      engine.setStressParameters({ arrivalRateMultiplier: 2.8 });
      expect(engine.getState().stressParams.arrivalRateMultiplier).toBe(2.8);
      expect(engine.getState().stressParams.auditorPacingMultiplier).toBe(2.2);
    });
  });

  describe("UI Component Integration", () => {
    it("renders the Stress & BIMO Stream HUD toggle button", () => {
      render(<ClinicalTrialChaos />);
      const toggleBtn = screen.getByRole("button", {
        name: /Toggle Interactive Stress Control Panel and Live BIMO Stream/i,
      });
      expect(toggleBtn).toBeDefined();
    });

    it("opens and closes the Stress Control Drawer when toggled", () => {
      render(<ClinicalTrialChaos />);
      const toggleBtn = screen.getByRole("button", {
        name: /Toggle Interactive Stress Control Panel and Live BIMO Stream/i,
      });

      // Drawer closed initially
      expect(
        screen.queryByRole("complementary", {
          name: /Interactive Stress Control Panel/i,
        })
      ).toBeNull();

      // Open drawer
      fireEvent.click(toggleBtn);
      expect(
        screen.getByRole("complementary", {
          name: /Interactive Stress Control Panel/i,
        })
      ).toBeDefined();

      // Verify sliders exist
      expect(
        screen.getByLabelText(/Subject Arrival Rate Slider/i)
      ).toBeDefined();
      expect(
        screen.getByLabelText(/Observation Error Chance Slider/i)
      ).toBeDefined();
      expect(
        screen.getByLabelText(/Auditor Inspection Pacing Slider/i)
      ).toBeDefined();

      // Close drawer via close button
      const closeBtn = screen.getByRole("button", {
        name: /Close Stress Control Drawer/i,
      });
      fireEvent.click(closeBtn);
      expect(
        screen.queryByRole("complementary", {
          name: /Interactive Stress Control Panel/i,
        })
      ).toBeNull();
    });

    it("applies presets and updates parameter sliders in real time", () => {
      render(<ClinicalTrialChaos />);
      const toggleBtn = screen.getByRole("button", {
        name: /Toggle Interactive Stress Control Panel and Live BIMO Stream/i,
      });
      fireEvent.click(toggleBtn);

      const auditRushBtn = screen.getByRole("button", {
        name: /21 CFR Audit Rush/i,
      });
      fireEvent.click(auditRushBtn);

      const arrivalSlider = screen.getByLabelText(
        /Subject Arrival Rate Slider/i
      ) as HTMLInputElement;
      const errorSlider = screen.getByLabelText(
        /Observation Error Chance Slider/i
      ) as HTMLInputElement;
      const auditorSlider = screen.getByLabelText(
        /Auditor Inspection Pacing Slider/i
      ) as HTMLInputElement;

      expect(parseFloat(arrivalSlider.value)).toBe(1.5);
      expect(parseFloat(errorSlider.value)).toBe(0.6);
      expect(parseFloat(auditorSlider.value)).toBe(2.2);

      // Select Influx Surge
      const influxBtn = screen.getByRole("button", {
        name: /Multi-Site Influx Surge/i,
      });
      fireEvent.click(influxBtn);

      expect(parseFloat(arrivalSlider.value)).toBe(2.5);
      expect(parseFloat(errorSlider.value)).toBe(0.75);
      expect(parseFloat(auditorSlider.value)).toBe(1.2);
    });

    it("displays live BIMO score, trend indicator, and findings feed", () => {
      render(<ClinicalTrialChaos />);
      const toggleBtn = screen.getByRole("button", {
        name: /Toggle Interactive Stress Control Panel and Live BIMO Stream/i,
      });
      fireEvent.click(toggleBtn);

      expect(screen.getByText(/Live BIMO Stream/i)).toBeDefined();
      expect(screen.getByText(/Score & Trend/i)).toBeDefined();
      expect(screen.getByText(/Verdict Status/i)).toBeDefined();
    });
  });
});
