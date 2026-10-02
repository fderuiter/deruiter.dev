// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  AMBIENT_EVENTS_CATALOG,
  selectAmbientEvent,
  createInitialShiftState,
  reduceShiftState,
  createPatrolShiftEngine,
  derivePlayfulStats,
  compileShiftSummary,
  type ShiftState,
  type PatrolEvent,
} from "@/lib/patrol";

describe("Patrol Shift — M8 Ambient Operational Events Engine (Issue #754)", () => {
  describe("1. Event Catalog & Deterministic Selection", () => {
    it("contains at least 5 distinct authentic Midwest/Welch operational mini-events", () => {
      expect(AMBIENT_EVENTS_CATALOG.length).toBeGreaterThanOrEqual(5);

      const eventIds = AMBIENT_EVENTS_CATALOG.map((e) => e.id);
      expect(eventIds).toContain("guest-directions");
      expect(eventIds).toContain("rope-ducking");
      expect(eventIds).toContain("trail-debris");
      expect(eventIds).toContain("lift-stoppage");
      expect(eventIds).toContain("radio-status-check");

      // Verify each event has coordinates, sector, prompt, and 2-3 options
      for (const event of AMBIENT_EVENTS_CATALOG) {
        expect(event.title).toBeTruthy();
        expect(event.location).toBeTruthy();
        expect(event.sector).toBeTruthy();
        expect(event.prompt).toBeTruthy();
        expect(typeof event.coordinates.x).toBe("number");
        expect(typeof event.coordinates.y).toBe("number");
        expect(event.options.length).toBeGreaterThanOrEqual(2);
        expect(event.options.length).toBeLessThanOrEqual(3);

        for (const option of event.options) {
          expect(option.id).toBeTruthy();
          expect(option.label).toBeTruthy();
          expect(option.consequenceText).toBeTruthy();
        }
      }
    });

    it("selects events deterministically given a seed", () => {
      const state = createInitialShiftState(null, "PATROL_MAP");

      const eventA = selectAmbientEvent(state, 12345);
      const eventB = selectAmbientEvent(state, 12345);
      expect(eventA).not.toBeNull();
      expect(eventA?.id).toBe(eventB?.id);

      // A different seed yields a deterministic selection
      const eventC = selectAmbientEvent(state, 99999);
      expect(eventC).not.toBeNull();
    });

    it("cycles without immediate back-to-back repeats", () => {
      let state = createInitialShiftState(null, "PATROL_MAP");

      const seenIds = new Set<string>();

      // Resolve all 5 events one by one
      for (let i = 0; i < AMBIENT_EVENTS_CATALOG.length; i++) {
        const selected = selectAmbientEvent(state, 42);
        expect(selected).not.toBeNull();
        expect(seenIds.has(selected!.id)).toBe(false);

        seenIds.add(selected!.id);
        state = {
          ...state,
          resolvedAmbientEvents: [
            ...(state.resolvedAmbientEvents ?? []),
            selected!.id,
          ],
        };
      }

      // All 5 have been seen
      expect(seenIds.size).toBe(AMBIENT_EVENTS_CATALOG.length);

      // Once all 5 are resolved, the next selection must NOT immediately repeat the last resolved
      const lastResolved =
        state.resolvedAmbientEvents![state.resolvedAmbientEvents!.length - 1];
      const nextCycleEvent = selectAmbientEvent(state, 42);
      expect(nextCycleEvent).not.toBeNull();
      expect(nextCycleEvent!.id).not.toBe(lastResolved);
    });

    it("exhausts full catalog across multiple cycles without repeating in the same cycle", () => {
      let state = createInitialShiftState(null, "PATROL_MAP");

      // Cycle 1: 5 events
      const cycle1Seen = new Set<string>();
      for (let i = 0; i < AMBIENT_EVENTS_CATALOG.length; i++) {
        const ev = selectAmbientEvent(state, 100 + i);
        expect(ev).not.toBeNull();
        expect(cycle1Seen.has(ev!.id)).toBe(false);
        cycle1Seen.add(ev!.id);
        state = {
          ...state,
          resolvedAmbientEvents: [
            ...(state.resolvedAmbientEvents ?? []),
            ev!.id,
          ],
        };
      }
      expect(cycle1Seen.size).toBe(5);

      // Cycle 2: next 5 events
      const cycle2Seen = new Set<string>();
      let prevEventId =
        state.resolvedAmbientEvents![state.resolvedAmbientEvents!.length - 1];
      for (let i = 0; i < AMBIENT_EVENTS_CATALOG.length; i++) {
        const ev = selectAmbientEvent(state, 200 + i);
        expect(ev).not.toBeNull();
        if (i === 0) {
          expect(ev!.id).not.toBe(prevEventId);
        }
        expect(cycle2Seen.has(ev!.id)).toBe(false);
        cycle2Seen.add(ev!.id);
        prevEventId = ev!.id;
        state = {
          ...state,
          resolvedAmbientEvents: [
            ...(state.resolvedAmbientEvents ?? []),
            ev!.id,
          ],
        };
      }
      expect(cycle2Seen.size).toBe(5);
    });
  });

  describe("2. FSM Transitions & Operational Modifiers", () => {
    it("TRIGGER_AMBIENT_EVENT attaches event to activeAmbientEvent", () => {
      const initial = createInitialShiftState(null, "PATROL_MAP");
      expect(initial.activeAmbientEvent).toBeNull();

      const eventToTrigger = AMBIENT_EVENTS_CATALOG[0];
      const triggered = reduceShiftState(initial, {
        type: "TRIGGER_AMBIENT_EVENT",
        ambientEvent: eventToTrigger,
      });

      expect(triggered.activeAmbientEvent).toBe(eventToTrigger);

      // Boundary defense: TRIGGER_AMBIENT_EVENT has no effect outside PATROL_MAP
      const inSceneState: ShiftState = { ...initial, phase: "SCENE" };
      const ignored = reduceShiftState(inSceneState, {
        type: "TRIGGER_AMBIENT_EVENT",
        ambientEvent: eventToTrigger,
      });
      expect(ignored.activeAmbientEvent).toBeNull();
    });

    it("RESOLVE_AMBIENT_EVENT updates time, closed trails, equipment, and records emitted event", () => {
      const initial = createInitialShiftState(null, "PATROL_MAP");
      const debrisEvent = AMBIENT_EVENTS_CATALOG.find(
        (e) => e.id === "trail-debris"
      )!;

      const stateWithEvent: ShiftState = {
        ...initial,
        activeAmbientEvent: debrisEvent,
      };

      // Option "temporary-trail-closure" adds "Long Way Home" to closedTrails
      const resolved = reduceShiftState(stateWithEvent, {
        type: "RESOLVE_AMBIENT_EVENT",
        selectedOptionId: "temporary-trail-closure",
      });

      expect(resolved.activeAmbientEvent).toBeNull();
      expect(resolved.resolvedAmbientEvents).toContain("trail-debris");
      expect(resolved.operationalState?.closedTrails).toContain(
        "Long Way Home"
      );
      expect(resolved.timeElapsedMinutes).toBe(6);
      expect(resolved.activeEvents).toHaveLength(1);
      expect(resolved.activeEvents[0].action).toBe(
        "ambient_trail_temporarily_closed"
      );
      expect(resolved.activeEvents[0].context?.trail).toBe("Long Way Home");
    });

    it("RESOLVE_AMBIENT_EVENT updates equipmentLocation when repositioning", () => {
      const initial = createInitialShiftState(null, "PATROL_MAP");
      const radioEvent = AMBIENT_EVENTS_CATALOG.find(
        (e) => e.id === "radio-status-check"
      )!;

      const stateWithEvent: ShiftState = {
        ...initial,
        activeAmbientEvent: radioEvent,
      };

      // Option "relocate-mid-mountain" moves sled to "Mid-Mountain Cache"
      const resolved = reduceShiftState(stateWithEvent, {
        type: "RESOLVE_AMBIENT_EVENT",
        selectedOptionId: "relocate-mid-mountain",
      });

      expect(resolved.operationalState?.equipmentLocation).toBe(
        "Mid-Mountain Cache"
      );
      expect(resolved.timeElapsedMinutes).toBe(6);
      expect(resolved.activeEvents[0].action).toBe(
        "ambient_equipment_relocated_mid_mountain"
      );
    });

    it("DISMISS_AMBIENT_EVENT provides a clean, non-punitive dismiss without score penalty", () => {
      const initial = createInitialShiftState(null, "PATROL_MAP");
      const guestEvent = AMBIENT_EVENTS_CATALOG.find(
        (e) => e.id === "guest-directions"
      )!;

      const stateWithEvent: ShiftState = {
        ...initial,
        score: 100,
        activeAmbientEvent: guestEvent,
      };

      const dismissed = reduceShiftState(stateWithEvent, {
        type: "DISMISS_AMBIENT_EVENT",
      });

      expect(dismissed.activeAmbientEvent).toBeNull();
      expect(dismissed.score).toBe(100);
      expect(dismissed.resolvedAmbientEvents).toContain("guest-directions");
      expect(dismissed.activeEvents).toHaveLength(1);
      expect(dismissed.activeEvents[0].context?.dismissed).toBe(true);
    });

    it("auto-spawns ambient event on COMPLETE_BRIEFING and FINISH_DEBRIEF", () => {
      const briefingState = createInitialShiftState(null, "BRIEFING");

      const mapArrival = reduceShiftState(briefingState, {
        type: "COMPLETE_BRIEFING",
        seed: 42,
      });

      expect(mapArrival.phase).toBe("PATROL_MAP");
      expect(mapArrival.activeAmbientEvent).not.toBeNull();

      // When receiving dispatch, activeAmbientEvent clears so patroller focuses on patient
      const dispatched = reduceShiftState(mapArrival, {
        type: "RECEIVE_DISPATCH",
        scenarioId: "test-scenario",
      });
      expect(dispatched.phase).toBe("DISPATCH");
      expect(dispatched.activeAmbientEvent).toBeNull();

      // When finishing debrief, returning to hub auto-spawns next ambient event
      const debriefState: ShiftState = {
        ...dispatched,
        phase: "DEBRIEF",
        incidentsCompleted: 1,
      };
      const returnToHub = reduceShiftState(debriefState, {
        type: "FINISH_DEBRIEF",
        seed: 88,
      });
      expect(returnToHub.phase).toBe("PATROL_MAP");
      expect(returnToHub.activeAmbientEvent).not.toBeNull();
    });

    it("RESET restores clean initial operational and ambient state", () => {
      const modifiedState: ShiftState = {
        ...createInitialShiftState(null, "PATROL_MAP"),
        timeElapsedMinutes: 45,
        resolvedAmbientEvents: ["guest-directions", "trail-debris"],
        operationalState: {
          closedTrails: ["Long Way Home"],
          equipmentLocation: "Mid-Mountain Cache",
        },
      };

      const resetState = reduceShiftState(modifiedState, { type: "RESET" });
      expect(resetState.phase).toBe("INTRO");
      expect(resetState.activeAmbientEvent).toBeNull();
      expect(resetState.resolvedAmbientEvents).toHaveLength(0);
      expect(resetState.operationalState?.closedTrails).toHaveLength(0);
      expect(resetState.operationalState?.equipmentLocation).toBe(
        "Summit Shack"
      );
    });

    it("supports closing and subsequently reopening a trail via operational modifiers", () => {
      let state = createInitialShiftState(null, "PATROL_MAP");

      // 1. Close Long Way Home via temporary-trail-closure option
      state = reduceShiftState(
        {
          ...state,
          activeAmbientEvent: AMBIENT_EVENTS_CATALOG.find(
            (e) => e.id === "trail-debris"
          )!,
        },
        {
          type: "RESOLVE_AMBIENT_EVENT",
          selectedOptionId: "temporary-trail-closure",
        }
      );
      expect(state.operationalState?.closedTrails).toContain("Long Way Home");

      // 2. Reopen Long Way Home via remove-debris option
      state = reduceShiftState(
        {
          ...state,
          activeAmbientEvent: AMBIENT_EVENTS_CATALOG.find(
            (e) => e.id === "trail-debris"
          )!,
        },
        {
          type: "RESOLVE_AMBIENT_EVENT",
          selectedOptionId: "remove-debris",
        }
      );
      expect(state.operationalState?.closedTrails).not.toContain(
        "Long Way Home"
      );
    });

    it("TRIGGER_AMBIENT_EVENT does not clobber existing activeAmbientEvent", () => {
      const initial = createInitialShiftState(null, "PATROL_MAP");
      const firstEvent = AMBIENT_EVENTS_CATALOG.find(
        (e) => e.id === "guest-directions"
      )!;
      const stateWithEvent: ShiftState = {
        ...initial,
        activeAmbientEvent: firstEvent,
      };

      const unchanged = reduceShiftState(stateWithEvent, {
        type: "TRIGGER_AMBIENT_EVENT",
        seed: 9999,
      });
      expect(unchanged.activeAmbientEvent).toBe(firstEvent);
    });

    it("COMPLETE_SHIFT clears activeAmbientEvent", () => {
      const initial = createInitialShiftState(null, "PATROL_MAP");
      const stateWithEvent: ShiftState = {
        ...initial,
        activeAmbientEvent: AMBIENT_EVENTS_CATALOG[0],
      };

      const completed = reduceShiftState(stateWithEvent, {
        type: "COMPLETE_SHIFT",
      });
      expect(completed.phase).toBe("SHIFT_COMPLETE");
      expect(completed.isCompleted).toBe(true);
      expect(completed.activeAmbientEvent).toBeNull();
    });
  });

  describe("3. Engine Integration & Playful Stats Propagation", () => {
    it("records resolved ambient events into engine event history", () => {
      const engine = createPatrolShiftEngine([], {
        initialPhase: "PATROL_MAP",
      });
      expect(engine.getEventHistory()).toHaveLength(0);

      // Trigger and resolve guest directions
      engine.dispatch({
        type: "TRIGGER_AMBIENT_EVENT",
        ambientEventId: "guest-directions",
      });
      expect(engine.getState().activeAmbientEvent?.id).toBe("guest-directions");

      engine.dispatch({
        type: "RESOLVE_AMBIENT_EVENT",
        selectedOptionId: "direct-long-way-home",
      });

      const history = engine.getEventHistory();
      expect(history).toHaveLength(1);
      expect(history[0].scenarioId).toBe("ambient-ops");
      expect(history[0].action).toBe("ambient_guest_directions_long_way_home");
      expect(history[0].context?.guestAssisted).toBe(true);
      expect(history[0].context?.location).toBe("Long Way Home");
    });

    it("ambient events correctly contribute to derivePlayfulStats counters", () => {
      const events: PatrolEvent[] = [
        // 1. Guest assistance event
        {
          timestamp: 1,
          scenarioId: "ambient-ops",
          action: "ambient_guest_directions_long_way_home",
          context: {
            category: "communication",
            location: "Long Way Home",
            trail: "Long Way Home",
            guestAssisted: true,
          },
        },
        // 2. Hazard marking event
        {
          timestamp: 2,
          scenarioId: "ambient-ops",
          action: "mark-hazard_trail_debris",
          context: {
            category: "assessment",
            location: "Long Way Home",
            trail: "Long Way Home",
          },
        },
        // 3. Lift communication check
        {
          timestamp: 3,
          scenarioId: "ambient-ops",
          action: "ambient_lift_status_radio_check",
          context: {
            category: "communication",
            location: "Belle Creek Quad Tower 4",
            trail: "Belle Creek Quad",
          },
        },
      ];

      const stats = derivePlayfulStats(events);
      expect(stats.guestsAssisted).toBe(1);
      expect(stats.radioTransmissions).toBe(2); // 2 communication category events
      expect(stats.hazardsMarked).toBe(1); // mark-hazard_trail_debris
      expect(stats.trailsChecked).toBe(2); // Long Way Home + Belle Creek Quad Tower 4
    });

    it("does not count ambient assessment events as medical patients assisted", () => {
      const ambientAssessmentEvent: PatrolEvent = {
        timestamp: 100,
        scenarioId: "ambient-ops",
        action: "mark-hazard_trail_debris",
        context: {
          category: "assessment",
          location: "Long Way Home",
          trail: "Long Way Home",
        },
      };

      const stats = derivePlayfulStats([ambientAssessmentEvent]);
      expect(stats.patientsAssisted).toBe(0);
      expect(stats.hazardsMarked).toBe(1);
    });

    it("compileShiftSummary excludes ambient-ops from incident count and dimension scoring", () => {
      const realIncidentEvents: PatrolEvent[] = [
        {
          timestamp: 10,
          scenarioId: "welch-wrist-sprain",
          action: "arrive_on_scene",
          context: { category: "assessment", location: "West Slopes" },
        },
        {
          timestamp: 20,
          scenarioId: "welch-wrist-sprain",
          action: "assess-scene-safety",
          context: {
            category: "assessment",
            label: "Secured scene with crossed skis",
          },
        },
      ];

      const ambientEvent: PatrolEvent = {
        timestamp: 5,
        scenarioId: "ambient-ops",
        action: "ambient_guest_directions_long_way_home",
        context: {
          category: "communication",
          location: "Long Way Home",
          guestAssisted: true,
        },
      };

      const summary = compileShiftSummary(
        [ambientEvent, ...realIncidentEvents],
        30
      );

      // Only the real incident is counted and evaluated
      expect(summary.totalIncidents).toBe(1);
      expect(summary.incidentResults).toHaveLength(1);
      expect(summary.incidentResults[0].scenarioId).toBe("welch-wrist-sprain");
      expect(summary.playfulStats.guestsAssisted).toBe(1);
      expect(summary.chronologicalHighlights.length).toBeGreaterThan(0);
    });
  });
});
