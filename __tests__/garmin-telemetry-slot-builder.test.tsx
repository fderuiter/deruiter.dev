import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  TelemetryBuffer,
  exportTelemetryToCsv,
  exportTelemetryToFit,
  type TelemetrySample,
} from "@/lib/garmin-telemetry-buffer";
import {
  loadWidgetLayout,
  saveWidgetLayout,
  DEFAULT_WIDGET_LAYOUT,
  METRIC_DEFINITIONS,
  SLOT_LABELS,
  type WidgetLayoutConfig,
} from "@/lib/garmin-widget-layout";
import { CompanionPanel } from "@/components/garmin-watch/CompanionPanel";
import { createInitialState } from "@/lib/garmin-engine";

describe("TelemetryBuffer and Export Tools", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("buffers samples up to capacity limit and clears samples", () => {
    const buffer = new TelemetryBuffer(5, 0); // 0 interval for testing
    expect(buffer.getSamples()).toHaveLength(0);

    const baseState = {
      ...createInitialState("fenix", 100),
      gameState: "playing" as const,
    };
    for (let i = 0; i < 10; i++) {
      buffer.recordSample(
        {
          ...baseState,
          score: i * 10,
          distanceMeters: i * 5,
        },
        1700000000000 + i * 100,
        true
      );
    }

    const samples = buffer.getSamples();
    expect(samples).toHaveLength(5);
    // Should keep the latest 5 (scores 50, 60, 70, 80, 90)
    expect(samples[0].score).toBe(50);
    expect(samples[4].score).toBe(90);

    buffer.clear();
    expect(buffer.getSamples()).toHaveLength(0);
  });

  it("exports samples to CSV string with headers and rows", () => {
    const sample: TelemetrySample = {
      timestamp: 1700000000000,
      heartRate: 142,
      thermalStress: 0.25,
      allocatedRamKb: 18.5,
      allocatedFlashKb: 8.0,
      battery: 88,
      distanceMeters: 120.5,
      score: 450,
    };

    const csv = exportTelemetryToCsv([sample]);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain(
      "iso_timestamp,timestamp_ms,heart_rate_bpm,thermal_stress_pct,allocated_ram_kb,allocated_flash_kb,battery_pct,distance_m,score_pts"
    );
    expect(lines[1]).toContain("142");
    expect(lines[1]).toContain("18.5");
    expect(lines[1]).toContain("450");
  });

  it("exports samples to binary FIT file format with correct 14-byte header and signature", () => {
    const sample: TelemetrySample = {
      timestamp: 1700000000000,
      heartRate: 135,
      thermalStress: 0.1,
      allocatedRamKb: 12.0,
      allocatedFlashKb: 0,
      battery: 95,
      distanceMeters: 50.0,
      score: 200,
    };

    const fitBuffer = exportTelemetryToFit([sample]);
    expect(fitBuffer).toBeInstanceOf(Uint8Array);
    expect(fitBuffer.length).toBeGreaterThan(14);

    // Check 14-byte Header
    expect(fitBuffer[0]).toBe(14); // Header size
    expect(fitBuffer[1]).toBe(0x20); // Protocol version

    // Check FIT magic string ".FIT" at byte offset 8..11
    const magic = String.fromCharCode(
      fitBuffer[8],
      fitBuffer[9],
      fitBuffer[10],
      fitBuffer[11]
    );
    expect(magic).toBe(".FIT");
  });
});

describe("Widget Layout Persistence and Definitions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads default layout when localStorage is empty", () => {
    const layout = loadWidgetLayout();
    expect(layout).toEqual(DEFAULT_WIDGET_LAYOUT);
  });

  it("persists and restores custom layout in localStorage", () => {
    const customLayout: WidgetLayoutConfig = {
      ...DEFAULT_WIDGET_LAYOUT,
      leftArc: "ram",
      rightArc: "battery",
      topRight: "thermal",
    };

    saveWidgetLayout(customLayout);
    const restored = loadWidgetLayout();
    expect(restored).toEqual(customLayout);
  });

  it("includes definitions for all 10 available telemetry metrics and 7 slots", () => {
    expect(Object.keys(METRIC_DEFINITIONS).length).toBe(10);
    expect(Object.keys(SLOT_LABELS).length).toBe(7);
  });
});

describe("CompanionPanel Widget Slot Builder & Telemetry UI", () => {
  const dummyState = createInitialState("fenix", 0);

  it("renders Telemetry Export section and triggers CSV/FIT export callbacks", () => {
    const onExportCsv = vi.fn();
    const onExportFit = vi.fn();
    const onClearTelemetry = vi.fn();

    render(
      <CompanionPanel
        state={dummyState}
        deviceTarget="fenix"
        bezelTheme="slate"
        highScore={0}
        isFocused={false}
        isFullscreen={false}
        onToggleFullscreen={() => {}}
        onSelectDevice={() => {}}
        onSelectTheme={() => {}}
        onWriteFlash={() => {}}
        onClearFlash={() => {}}
        onDrainBattery={() => {}}
        telemetrySamples={[
          {
            timestamp: Date.now(),
            heartRate: 120,
            thermalStress: 0.1,
            allocatedRamKb: 10,
            allocatedFlashKb: 0,
            battery: 100,
            distanceMeters: 10,
            score: 50,
          },
        ]}
        onExportCsv={onExportCsv}
        onExportFit={onExportFit}
        onClearTelemetry={onClearTelemetry}
      />
    );

    expect(screen.getAllByText("Telemetry Export").length).toBeGreaterThan(0);
    expect(screen.getByText("Export CSV (.csv)")).toBeTruthy();
    expect(screen.getByText("Export FIT (.fit)")).toBeTruthy();

    fireEvent.click(screen.getByText("Export CSV (.csv)"));
    expect(onExportCsv).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Export FIT (.fit)"));
    expect(onExportFit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Clear Telemetry Buffer"));
    expect(onClearTelemetry).toHaveBeenCalledTimes(1);
  });

  it("renders Widget Slot Builder and invokes onUpdateLayoutSlot and onResetLayout", () => {
    const onUpdateLayoutSlot = vi.fn();
    const onResetLayout = vi.fn();

    const { container } = render(
      <CompanionPanel
        state={dummyState}
        deviceTarget="fenix"
        bezelTheme="slate"
        highScore={0}
        isFocused={false}
        isFullscreen={false}
        onToggleFullscreen={() => {}}
        onSelectDevice={() => {}}
        onSelectTheme={() => {}}
        onWriteFlash={() => {}}
        onClearFlash={() => {}}
        onDrainBattery={() => {}}
        widgetLayout={DEFAULT_WIDGET_LAYOUT}
        onUpdateLayoutSlot={onUpdateLayoutSlot}
        onResetLayout={onResetLayout}
      />
    );

    expect(screen.getAllByText("Widget Slot Builder").length).toBeGreaterThan(
      0
    );
    expect(screen.getByText("Reset Defaults")).toBeTruthy();

    const leftArcSelect = container.querySelector(
      "#slot-select-leftArc"
    ) as HTMLSelectElement;
    expect(leftArcSelect).toBeTruthy();
    fireEvent.change(leftArcSelect, { target: { value: "battery" } });
    expect(onUpdateLayoutSlot).toHaveBeenCalledWith("leftArc", "battery");

    fireEvent.click(screen.getByText("Reset Defaults"));
    expect(onResetLayout).toHaveBeenCalledTimes(1);
  });
});
