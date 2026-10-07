import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  POS_MENU,
  applyAction,
  createShift,
  exportShiftTelemetryCsv,
  exportShiftTelemetryJson,
  generateShiftTelemetry,
  getPosScreen,
  replayShift,
  stepShift,
  validatePosTree,
  type PosNode,
  type ShiftEvent,
  type ShiftScenarioConfig,
} from "@/lib/patty-drive-thru";
import {
  DiaryIntroPage,
  ShiftEndPage,
} from "@/components/patty-drive-thru/DiaryPages";

describe("ShiftScenarioConfig & Engine Overrides", () => {
  it("stores and respects custom scenario parameters in state.config", () => {
    const config: ShiftScenarioConfig = {
      seed: "stress-test",
      durationSec: 120,
      arrivalGapMinSec: 2,
      arrivalGapMaxSec: 4,
      firstArrivalSec: 1,
      idleGraceSec: 2,
      idleRatePerSec: 20,
      dispenserFailChance: 1.0, // Always drop drinks
    };

    const state = createShift(config);
    expect(state.config.seed).toBe("stress-test");
    expect(state.config.arrivalGapMinSec).toBe(2);
    expect(state.config.dispenserFailChance).toBe(1.0);

    // First arrival occurs at 1 second; MAX_STEP_SEC is 0.5s per call
    let step1 = stepShift(state, 0.5);
    step1 = stepShift(step1.state, 0.5);
    expect(step1.state.orders.length).toBe(1);
    expect(step1.events.some((e) => e.type === "order-arrived")).toBe(true);
  });

  it("triggers manager yell faster with strict idle parameters", () => {
    const strictConfig: ShiftScenarioConfig = {
      seed: "strict-manager",
      durationSec: 180,
      idleGraceSec: 1,
      idleRatePerSec: 50, // Reaches 100 in 2 seconds after grace
    };

    let state = createShift(strictConfig);
    // Step forward 3.5s in 0.5s increments without taking action
    const eventsLog: ShiftEvent[] = [];
    for (let t = 0; t < 7; t++) {
      const res = stepShift(state, 0.5);
      state = res.state;
      eventsLog.push(...res.events);
    }
    expect(eventsLog.some((e) => e.type === "manager-yell")).toBe(true);
    expect(state.tallies.yells).toBeGreaterThanOrEqual(1);
  });

  it("traverses custom POS menu tree in getPosScreen and applyPosTap", () => {
    const flatPosMenu: PosNode = {
      id: "home",
      label: "Flat Home",
      children: [
        {
          id: "express",
          label: "Express",
          children: [
            { id: "burger", label: "Burger", itemId: "burger" },
            {
              id: "cheeseburger",
              label: "Cheeseburger",
              itemId: "cheeseburger",
            },
            { id: "fries", label: "Fries", itemId: "fries" },
            { id: "nuggets", label: "Nuggets", itemId: "nuggets" },
            { id: "soda", label: "Soda", itemId: "soda" },
            { id: "shake", label: "Shake", itemId: "shake" },
            { id: "coffee", label: "Coffee", itemId: "coffee" },
            { id: "no-pickles", label: "No Pickles", modifierId: "no-pickles" },
          ],
        },
      ],
    };

    const config: ShiftScenarioConfig = {
      seed: "pos-test",
      durationSec: 180,
      posMenu: flatPosMenu,
    };

    const state = createShift(config);
    const posScreen = getPosScreen(state);
    expect(posScreen.id).toBe("home");
    expect(posScreen.children?.some((c) => c.id === "express")).toBe(true);

    // Tap express sub-screen
    const tapped = applyAction(state, { type: "posTap", nodeId: "express" });
    expect(tapped.state.pos.path).toEqual(["express"]);
    const expressScreen = getPosScreen(tapped.state);
    expect(expressScreen.id).toBe("express");
  });
});

describe("validatePosTree", () => {
  it("validates standard POS menu successfully", () => {
    const res = validatePosTree(POS_MENU);
    expect(res.valid).toBe(true);
    expect(res.missingItems).toHaveLength(0);
    expect(res.missingModifiers).toHaveLength(0);
    expect(res.errors).toHaveLength(0);
  });

  it("detects missing mandatory menu items or modifiers", () => {
    const incompleteMenu: PosNode = {
      id: "home",
      label: "Home",
      children: [
        { id: "burger", label: "Burger", itemId: "burger" },
        { id: "fries", label: "Fries", itemId: "fries" },
      ],
    };

    const res = validatePosTree(incompleteMenu);
    expect(res.valid).toBe(false);
    expect(res.missingItems).toContain("coffee");
    expect(res.missingItems).toContain("soda");
    expect(res.missingModifiers).toContain("no-pickles");
    expect(res.errors.length).toBeGreaterThan(0);
  });
});

describe("Determinism & Replay Integrity", () => {
  it("holds seed determinism across custom scenario configurations", () => {
    const customConfig: ShiftScenarioConfig = {
      seed: "deterministic-scenario-123",
      durationSec: 120,
      arrivalGapMinSec: 4,
      arrivalGapMaxSec: 8,
      dispenserFailChance: 0.5,
    };

    let state1 = createShift(customConfig);
    state1 = stepShift(state1, 10).state;
    if (state1.orders.length > 0) {
      state1 = applyAction(state1, {
        type: "selectOrder",
        orderId: state1.orders[0].id,
      }).state;
    }

    let state2 = createShift(customConfig);
    state2 = stepShift(state2, 10).state;
    if (state2.orders.length > 0) {
      state2 = applyAction(state2, {
        type: "selectOrder",
        orderId: state2.orders[0].id,
      }).state;
    }

    expect(state1.orders).toEqual(state2.orders);
    expect(state1.meters).toEqual(state2.meters);
    expect(state1.draws).toEqual(state2.draws);

    if (state1.history && state1.history.length > 0) {
      const replayed = replayShift(customConfig, state1.history);
      expect(replayed.config).toEqual(state1.config);
    }
  });
});

describe("Shift Telemetry Export", () => {
  it("generates structured JSON and CSV telemetry logs with metadata and time-series events", () => {
    const config: ShiftScenarioConfig = {
      seed: "telemetry-run",
      durationSec: 60,
    };

    let state = createShift(config);
    for (let i = 0; i < 6; i++) {
      state = stepShift(state, 0.5).state;
    }
    if (state.orders.length > 0) {
      state = applyAction(state, {
        type: "selectOrder",
        orderId: state.orders[0].id,
      }).state;
    }

    const telemetryData = generateShiftTelemetry(state);
    expect(telemetryData.metadata.seed).toBe("telemetry-run");
    expect(telemetryData.metadata.durationSec).toBe(60);
    expect(telemetryData.events.length).toBeGreaterThan(0);

    const jsonStr = exportShiftTelemetryJson(state);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.metadata.seed).toBe("telemetry-run");
    expect(Array.isArray(parsed.events)).toBe(true);

    const csvStr = exportShiftTelemetryCsv(state);
    expect(csvStr).toContain("# Patty's Drive-Thru Shift Telemetry Export");
    expect(csvStr).toContain("time,type,orderId,itemId,band,outcome,details");
    expect(csvStr).toContain("order-arrived");
  });
});

describe("UI Components & Modals", () => {
  it("opens ScenarioCustomizerModal from DiaryIntroPage and allows clocking in", () => {
    const onClockInMock = vi.fn();
    render(<DiaryIntroPage onClockIn={onClockInMock} />);

    const customizeButton = screen.getByTestId("pdt-open-customizer");
    expect(customizeButton).not.toBeNull();

    fireEvent.click(customizeButton);

    const modal = screen.getByTestId("pdt-scenario-customizer-modal");
    expect(modal).not.toBeNull();

    // Verify preset buttons exist
    const lunchRushButton = screen.getByText("lunch Rush");
    expect(lunchRushButton).not.toBeNull();

    // Click clock in inside modal
    const clockInCustomButton = screen.getByTestId("pdt-clock-in-custom");
    fireEvent.click(clockInCustomButton);

    expect(onClockInMock).toHaveBeenCalledTimes(1);
  });

  it("renders telemetry export section in ShiftEndPage", () => {
    const shift = createShift({ seed: "end-test", durationSec: 10 });
    const endState = stepShift(shift, 10).state;

    render(<ShiftEndPage shift={endState} onClockIn={vi.fn()} />);

    expect(screen.getByTestId("pdt-telemetry-export-section")).not.toBeNull();
    expect(screen.getByTestId("pdt-export-json")).not.toBeNull();
    expect(screen.getByTestId("pdt-export-csv")).not.toBeNull();
  });
});
