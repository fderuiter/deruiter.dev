// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  createEvent,
  generateWeatherEvent,
  generateAmbientEvent,
  filterEventsBySeverity,
  filterEventsByType,
  sortEventsByTimestamp,
  formatEventLog,
  EventQueue,
} from "@/lib/patrol/events";
import type { PatrolEvent } from "@/lib/patrol/types";

describe("Patrol Shift: Ambient Events and Weather/Avalanche Generators", () => {
  describe("createEvent", () => {
    it("creates a basic event with default info severity", () => {
      const event = createEvent(
        "TEST_ACTION",
        "Test Event",
        "A test event description"
      );
      expect(event.id).toMatch(/^event-/);
      expect(typeof event.timestamp).toBe("number");
      expect(event.action).toBe("TEST_ACTION");
      expect(event.type).toBe("TEST_ACTION");
      expect(event.title).toBe("Test Event");
      expect(event.description).toBe("A test event description");
      expect(event.severity).toBe("info");
    });

    it("creates an event with explicit severity", () => {
      const event = createEvent(
        "CRITICAL_ALERT",
        "Critical Event",
        "High urgency",
        "critical"
      );
      expect(event.severity).toBe("critical");
    });
  });

  describe("generateWeatherEvent", () => {
    it("assigns critical severity for high winds, zero visibility, or extreme cold", () => {
      const highWind = generateWeatherEvent({
        weatherType: "high_winds",
        windSpeedMph: 50,
      });
      expect(highWind.severity).toBe("critical");
      expect(highWind.context?.hazardFlags).toMatchObject({
        liftHoldRequired: true,
      });

      const zeroVis = generateWeatherEvent({
        weatherType: "whiteout",
        visibility: "zero",
      });
      expect(zeroVis.severity).toBe("critical");

      const extremeCold = generateWeatherEvent({
        weatherType: "temperature_drop",
        temperatureFahrenheit: -20,
      });
      expect(extremeCold.severity).toBe("critical");
      expect(extremeCold.context?.hazardFlags).toMatchObject({
        frostbiteRisk: true,
      });

      const blizzardHighWind = generateWeatherEvent({
        weatherType: "blizzard",
        windSpeedMph: 35,
      });
      expect(blizzardHighWind.severity).toBe("critical");
    });

    it("assigns warning severity for moderate wind, poor visibility, or ice storm", () => {
      const modWind = generateWeatherEvent({
        weatherType: "high_winds",
        windSpeedMph: 30,
      });
      expect(modWind.severity).toBe("warning");

      const iceStorm = generateWeatherEvent({ weatherType: "ice_storm" });
      expect(iceStorm.severity).toBe("warning");
      expect(iceStorm.context?.hazardFlags).toMatchObject({
        icingHazard: true,
      });

      const freezeThaw = generateWeatherEvent({ weatherType: "freeze_thaw" });
      expect(freezeThaw.severity).toBe("warning");

      const poorVis = generateWeatherEvent({
        weatherType: "heavy_snow",
        visibility: "poor",
      });
      expect(poorVis.severity).toBe("warning");
    });

    it("assigns info severity for mild weather conditions", () => {
      const mild = generateWeatherEvent({
        weatherType: "heavy_snow",
        windSpeedMph: 10,
        temperatureFahrenheit: 25,
      });
      expect(mild.severity).toBe("info");
      expect(mild.title).toBe("Heavy Snowfall Accumulation");
    });
  });

  describe("generateAmbientEvent", () => {
    it("generates ambient operational events across categories", () => {
      const event = generateAmbientEvent({
        category: "guest_assist",
        title: "Lost Skier at West Slopes",
        description: "Assisting family searching for lost minor.",
        severity: "warning",
      });

      expect(event.action).toBe("AMBIENT_GUEST_ASSIST");
      expect(event.type).toBe("AMBIENT_GUEST_ASSIST");
      expect(event.title).toBe("Lost Skier at West Slopes");
      expect(event.severity).toBe("warning");
      expect(event.context?.category).toBe("guest_assist");
    });
  });

  describe("event filtering, sorting, and formatting helpers", () => {
    const events: PatrolEvent[] = [
      {
        id: "1",
        timestamp: 1000,
        title: "Ev1",
        severity: "info",
        action: "ACT_A",
      },
      {
        id: "2",
        timestamp: 3000,
        title: "Ev2",
        severity: "critical",
        action: "ACT_B",
      },
      {
        id: "3",
        timestamp: 2000,
        title: "Ev3",
        severity: "warning",
        action: "ACT_A",
      },
      {
        id: "4",
        timestamp: "2026-09-24T10:00:00Z",
        title: "Ev4",
        severity: "critical",
        action: "ACT_C",
      },
    ];

    it("filters events by severity", () => {
      const criticals = filterEventsBySeverity(events, "critical");
      expect(criticals).toHaveLength(2);
      expect(criticals.map((e) => e.id)).toEqual(["2", "4"]);
    });

    it("filters events by type / action", () => {
      const actA = filterEventsByType(events, "ACT_A");
      expect(actA).toHaveLength(2);
    });

    it("sorts events by timestamp in ascending and descending order", () => {
      const asc = sortEventsByTimestamp(events, "asc");
      expect(asc[0].id).toBe("1");
      expect(asc[1].id).toBe("3");
      expect(asc[2].id).toBe("2");

      const desc = sortEventsByTimestamp(events, "desc");
      expect(desc[0].id).toBe("4");
    });

    it("formats an event into a clear log line string", () => {
      const log = formatEventLog({
        timestamp: 1700000000000,
        severity: "critical",
        title: "Avy Trigger",
        description: "Slab avalanche reported",
      });
      expect(log).toContain("[CRITICAL] Avy Trigger: Slab avalanche reported");
    });
  });

  describe("EventQueue", () => {
    it("manages event lifecycle correctly", () => {
      const queue = new EventQueue();
      expect(queue.size()).toBe(0);
      expect(queue.peek()).toBeUndefined();
      expect(queue.dequeue()).toBeUndefined();

      const e1 = createEvent("ACT1", "T1", "D1", "info");
      const e2 = createEvent("ACT2", "T2", "D2", "critical");

      queue.enqueue(e1);
      queue.enqueue(e2);

      expect(queue.size()).toBe(2);
      expect(queue.peek()).toBe(e1);
      expect(queue.getBySeverity("critical")).toEqual([e2]);

      expect(queue.dequeue()).toBe(e1);
      expect(queue.size()).toBe(1);

      queue.clear();
      expect(queue.size()).toBe(0);
    });
  });
});
