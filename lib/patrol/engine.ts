import type {
  ShiftState,
  ShiftPhase,
  ScenarioAction,
  PatrolEvent,
  ShiftEngineEvent,
  PatrolScenario,
  PatrolShiftEngineOptions,
  PatrolShiftEngine,
  VitalsData,
  PatientState,
  EnvironmentState,
  PatrolActor,
  ShiftOperationalState,
} from "./types";
import { selectAmbientEvent, AMBIENT_EVENTS_CATALOG } from "./ambient-events";
import { logger } from "@/lib/logger";

/**
 * Creates the initial shift state.
 */
export function createInitialShiftState(
  scenarioId: string | null = null,
  initialPhase?: ShiftPhase
): ShiftState {
  const phase: ShiftPhase = initialPhase ?? (scenarioId ? "briefing" : "INTRO");
  return {
    currentScenarioId: scenarioId,
    phase,
    timeElapsedMinutes: 0,
    score: 100,
    incidentsCompleted: 0,
    activeEvents: [],
    actionHistory: [],
    vitalsHistory: [],
    isCompleted: false,
    revealedPatient: {},
    revealedEnvironment: {},
    revealedActors: [],
    sceneSafetySecured: false,
    sceneSafetyStatus: "unassessed",
    patientCondition: "stable",
    activeAmbientEvent: null,
    resolvedAmbientEvents: [],
    operationalState: {
      closedTrails: [],
      equipmentLocation: "Summit Shack",
    },
  };
}

/**
 * Legacy transition helper maintained for backward compatibility.
 */
export function transitionShiftPhase(
  currentState: ShiftState,
  nextPhase: ShiftPhase
): ShiftState {
  return {
    ...currentState,
    phase: nextPhase,
    isCompleted: nextPhase === "completed" || nextPhase === "SHIFT_COMPLETE",
  };
}

/**
 * Legacy record action helper maintained for backward compatibility.
 */
export function recordAction(
  currentState: ShiftState,
  action: ScenarioAction
): ShiftState {
  const timeIncrement = action.costMinutes ?? 1;
  return {
    ...currentState,
    timeElapsedMinutes: currentState.timeElapsedMinutes + timeIncrement,
    actionHistory: [...currentState.actionHistory, action],
  };
}

/**
 * Legacy event push helper.
 */
export function pushEvent(
  currentState: ShiftState,
  event: PatrolEvent
): ShiftState {
  return {
    ...currentState,
    activeEvents: [event, ...currentState.activeEvents],
  };
}

/**
 * Verifies whether all prerequisites/preconditions for a scenario action are satisfied.
 */
export function checkActionPreconditions(
  action: ScenarioAction,
  actionHistory: ScenarioAction[]
): boolean {
  const reqs = action.preconditions ?? action.prerequisites ?? [];
  if (reqs.length === 0) return true;
  const executedIds = new Set(actionHistory.map((a) => a.id));
  return reqs.every((reqId) => executedIds.has(reqId));
}

/**
 * Computes list of currently executable actions based on preconditions and past executions.
 */
export function getAvailableActions(
  allActions: ScenarioAction[],
  actionHistory: ScenarioAction[]
): ScenarioAction[] {
  const executedIds = new Set(actionHistory.map((a) => a.id));
  return allActions.filter(
    (action) =>
      !executedIds.has(action.id) &&
      checkActionPreconditions(action, actionHistory)
  );
}

/**
 * Determines whether scene safety is currently verified and secured.
 */
export function isSceneSafetySecured(state: ShiftState): boolean {
  return state.sceneSafetySecured === true;
}

/**
 * Derives progressive patient assessment state from cumulative action and vitals history.
 */
export function deriveRevealedPatientState(
  scenario: PatrolScenario | null,
  actionHistory: ScenarioAction[],
  vitalsHistory: VitalsData[] = []
): Partial<PatientState> {
  const revealed: Partial<PatientState> = {};
  const findings: string[] = [];
  const interventions: string[] = [];

  for (const action of actionHistory) {
    if (action.reveals?.patient) {
      if (action.reveals.patient.complaint) {
        revealed.complaint = action.reveals.patient.complaint;
      }
      if (action.reveals.patient.mechanism) {
        revealed.mechanism = action.reveals.patient.mechanism;
      }
      if (action.reveals.patient.levelOfConsciousness) {
        revealed.levelOfConsciousness =
          action.reveals.patient.levelOfConsciousness;
      }
      if (action.reveals.patient.findings) {
        findings.push(...action.reveals.patient.findings);
      }
      if (action.reveals.patient.interventions) {
        interventions.push(...action.reveals.patient.interventions);
      }
      if (action.reveals.patient.vitals) {
        revealed.vitals = action.reveals.patient.vitals;
      }
    }
    if (action.vitalsCheck) {
      revealed.vitals = action.vitalsCheck;
    }
  }

  if (vitalsHistory.length > 0) {
    revealed.vitals = vitalsHistory[vitalsHistory.length - 1];
  }

  if (findings.length > 0) {
    revealed.findings = Array.from(new Set(findings));
  }
  if (interventions.length > 0) {
    revealed.interventions = Array.from(new Set(interventions));
  }

  return revealed;
}

/**
 * Derives progressive environmental hazard and weather data from scene exploration.
 */
export function deriveRevealedEnvironmentState(
  scenario: PatrolScenario | null,
  actionHistory: ScenarioAction[]
): Partial<EnvironmentState> {
  const revealed: Partial<EnvironmentState> = {
    weather: scenario?.environment?.weather,
    snowConditions: scenario?.environment?.snowConditions,
    temperatureFahrenheit: scenario?.environment?.temperatureFahrenheit,
    visibility: scenario?.environment?.visibility,
  };
  const hazards: string[] = [];

  for (const action of actionHistory) {
    if (action.reveals?.environment) {
      if (action.reveals.environment.sceneSafetyNotes) {
        revealed.sceneSafetyNotes = action.reveals.environment.sceneSafetyNotes;
      }
      if (action.reveals.environment.hazards) {
        hazards.push(...action.reveals.environment.hazards);
      }
    }
  }

  if (hazards.length > 0) {
    revealed.hazards = Array.from(new Set(hazards));
  }

  return revealed;
}

/**
 * Derives list of revealed scene actors and interviewed witnesses.
 */
export function deriveRevealedActors(
  scenario: PatrolScenario | null,
  actionHistory: ScenarioAction[]
): PatrolActor[] {
  const actorsMap = new Map<string, PatrolActor>();

  for (const action of actionHistory) {
    if (action.reveals?.actors) {
      for (const actor of action.reveals.actors) {
        actorsMap.set(actor.id, actor);
      }
    }
  }

  return Array.from(actorsMap.values());
}

/**
 * Merges, filters, and deduplicates events from an event history and active events list,
 * scoped to a single scenarioId in chronological order.
 */
export function collectIncidentEvents(
  eventHistory: PatrolEvent[],
  activeEvents: PatrolEvent[],
  scenarioId: string | null | undefined
): PatrolEvent[] {
  if (!scenarioId) return [];
  const seen = new Set<string>();
  const merged: PatrolEvent[] = [];

  for (const event of [...eventHistory, ...activeEvents]) {
    if (event.scenarioId !== scenarioId) continue;
    const key = `${String(event.timestamp)}|${event.action ?? event.type ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(event);
  }

  return merged;
}

/**
 * Pure, deterministic FSM transition reducer for Patrol Shift.
 *
 * Implements the lifecycle:
 * INTRO -> BRIEFING -> PATROL_MAP -> DISPATCH -> RESPONDING -> SCENE ->
 * TRANSPORT_PREP -> OET -> HANDOFF -> DEBRIEF -> PATROL_MAP -> SHIFT_COMPLETE
 *
 * Boundary Defense (AGENTS.md Section 11):
 * Invalid transitions leave the current state reference unchanged without throwing.
 */
export function reduceShiftState(
  state: ShiftState,
  event: ShiftEngineEvent
): ShiftState {
  switch (event.type) {
    case "START_SHIFT": {
      if (state.phase === "INTRO" || state.phase === "briefing") {
        return {
          ...state,
          phase: "BRIEFING",
        };
      }
      return state;
    }

    case "COMPLETE_BRIEFING": {
      if (state.phase === "BRIEFING" || state.phase === "briefing") {
        return {
          ...state,
          phase: "PATROL_MAP",
          activeAmbientEvent: selectAmbientEvent(state, event.seed),
        };
      }
      return state;
    }

    case "RECEIVE_DISPATCH": {
      if (state.phase === "PATROL_MAP" || state.phase === "patrol") {
        return {
          ...state,
          phase: "DISPATCH",
          currentScenarioId: event.scenarioId ?? state.currentScenarioId,
          activeAmbientEvent: null,
        };
      }
      return state;
    }

    case "ACCEPT_DISPATCH": {
      if (state.phase === "DISPATCH") {
        return {
          ...state,
          phase: "RESPONDING",
        };
      }
      return state;
    }

    case "ARRIVE_ON_SCENE": {
      if (state.phase === "RESPONDING" || state.phase === "patrol") {
        return {
          ...state,
          phase: "SCENE",
          revealedPatient: state.revealedPatient ?? {},
          revealedEnvironment: state.revealedEnvironment ?? {},
          revealedActors: state.revealedActors ?? [],
          sceneSafetySecured: state.sceneSafetySecured ?? false,
          sceneSafetyStatus: state.sceneSafetyStatus ?? "unassessed",
          patientCondition: state.patientCondition ?? "stable",
        };
      }
      return state;
    }

    case "COMPLETE_SCENE": {
      if (state.phase === "SCENE" || state.phase === "incident") {
        return {
          ...state,
          phase: "TRANSPORT_PREP",
        };
      }
      return state;
    }

    case "BEGIN_TRANSPORT": {
      if (state.phase === "TRANSPORT_PREP") {
        return {
          ...state,
          phase: "OET",
        };
      }
      return state;
    }

    case "ARRIVE_AT_BASE": {
      if (state.phase === "OET") {
        return {
          ...state,
          phase: "HANDOFF",
        };
      }
      return state;
    }

    case "COMPLETE_HANDOFF": {
      if (state.phase === "HANDOFF") {
        return {
          ...state,
          phase: "DEBRIEF",
        };
      }
      return state;
    }

    case "FINISH_DEBRIEF": {
      if (state.phase === "DEBRIEF" || state.phase === "debrief") {
        const nextIncidents = state.incidentsCompleted + 1;
        const currentReportScore =
          typeof event.payload?.score === "number"
            ? event.payload.score
            : state.score;
        const compositeScore =
          state.incidentsCompleted === 0
            ? currentReportScore
            : Math.round(
                (state.score * state.incidentsCompleted + currentReportScore) /
                  nextIncidents
              );

        const hubState: ShiftState = {
          ...state,
          phase: "PATROL_MAP",
          score: compositeScore,
          incidentsCompleted: nextIncidents,
          currentScenarioId: null,
        };

        return {
          ...hubState,
          activeAmbientEvent: selectAmbientEvent(hubState, event.seed),
        };
      }
      return state;
    }

    case "REPLAY_INCIDENT": {
      // Re-runs the same incident from scene arrival: clears incident-local
      // clinical/scene state, but never touches incidentsCompleted, score, or
      // the shift clock — replaying is not "undoing" shift time already spent.
      if (state.phase === "DEBRIEF" || state.phase === "debrief") {
        return {
          ...state,
          phase: "SCENE",
          actionHistory: [],
          vitalsHistory: [],
          activeEvents: [],
          currentVitals: undefined,
          revealedPatient: {},
          revealedEnvironment: {},
          revealedActors: [],
          sceneSafetySecured: false,
          sceneSafetyStatus: "unassessed",
          patientCondition: "stable",
        };
      }
      return state;
    }

    case "COMPLETE_SHIFT": {
      if (state.phase === "PATROL_MAP" || state.phase === "patrol") {
        return {
          ...state,
          phase: "SHIFT_COMPLETE",
          isCompleted: true,
          activeAmbientEvent: null,
        };
      }
      return state;
    }

    case "RECORD_ACTION": {
      if (!event.action) return state;
      // Guard against duplicate action recordings
      if (
        event.action.id &&
        state.actionHistory.some((a) => a.id === event.action?.id)
      ) {
        return state;
      }

      // Check preconditions: all required actions must have been completed
      const preconditions =
        event.action.preconditions ?? event.action.prerequisites ?? [];
      if (preconditions.length > 0) {
        const executedIds = new Set(state.actionHistory.map((a) => a.id));
        const allMet = preconditions.every((pid) => executedIds.has(pid));
        if (!allMet) {
          // Preconditions not met: refuse transition
          return state;
        }
      }

      const timeIncrement = event.action.costMinutes ?? 1;
      const nextTime = state.timeElapsedMinutes + timeIncrement;
      const nextActionHistory = [...state.actionHistory, event.action];

      // Progressive disclosure updates
      let nextRevealedPatient: Partial<PatientState> = {
        ...(state.revealedPatient ?? {}),
      };
      let nextRevealedEnvironment: Partial<EnvironmentState> = {
        ...(state.revealedEnvironment ?? {}),
      };
      const nextRevealedActors: PatrolActor[] = [
        ...(state.revealedActors ?? []),
      ];

      if (event.action.reveals?.patient) {
        const p = event.action.reveals.patient;
        nextRevealedPatient = {
          ...nextRevealedPatient,
          ...p,
          findings: Array.from(
            new Set([
              ...(nextRevealedPatient.findings ?? []),
              ...(p.findings ?? []),
            ])
          ),
          interventions: Array.from(
            new Set([
              ...(nextRevealedPatient.interventions ?? []),
              ...(p.interventions ?? []),
            ])
          ),
        };
      }

      if (event.action.reveals?.environment) {
        const env = event.action.reveals.environment;
        nextRevealedEnvironment = {
          ...nextRevealedEnvironment,
          ...env,
          hazards: Array.from(
            new Set([
              ...(nextRevealedEnvironment.hazards ?? []),
              ...(env.hazards ?? []),
            ])
          ),
        };
      }

      if (event.action.reveals?.actors) {
        const existingActorIds = new Set(nextRevealedActors.map((a) => a.id));
        for (const actor of event.action.reveals.actors) {
          if (!existingActorIds.has(actor.id)) {
            nextRevealedActors.push(actor);
            existingActorIds.add(actor.id);
          }
        }
      }

      // Scene safety state transitions
      let nextSceneSafetySecured = state.sceneSafetySecured ?? false;
      let nextSceneSafetyStatus = state.sceneSafetyStatus ?? "unassessed";
      let nextPatientCondition = state.patientCondition ?? "stable";

      if (
        event.action.securesSceneSafety ||
        event.action.id === "assess-scene-safety" ||
        event.action.id === "scene-safety" ||
        event.action.id === "mark-hazard"
      ) {
        nextSceneSafetySecured = true;
        nextSceneSafetyStatus = "safe";
      }

      if (event.action.reassessesSceneSafety) {
        nextSceneSafetyStatus = nextSceneSafetySecured ? "safe" : "compromised";
      }

      // Dynamic state transition: condition worsening if scene safety is neglected
      const isNeglectingSafety =
        !nextSceneSafetySecured &&
        (event.action.requiresSceneSafety ||
          event.action.category === "treatment" ||
          event.action.id.includes("splint") ||
          event.action.id.includes("package") ||
          event.action.id.includes("move"));

      const generatedEvents: PatrolEvent[] = [];

      if (isNeglectingSafety) {
        nextSceneSafetyStatus = "compromised";
        nextPatientCondition = "worsened";
        generatedEvents.push({
          timestamp: event.timestamp ?? Date.now(),
          scenarioId: state.currentScenarioId ?? "unknown",
          action: "HAZARD_ALERT",
          type: "HAZARD_ALERT",
          title: "Scene Safety Compromised",
          description:
            "Patient intervention attempted before securing scene safety. Uphill skier traffic created near-miss hazard; patient distress elevated.",
          severity: "warning",
          context: {
            neglectedAction: event.action.id,
            patientCondition: "worsened",
          },
        });
      }

      // Vitals check handling
      const nextVitalsHistory = [...state.vitalsHistory];
      let nextCurrentVitals = state.currentVitals;

      const checkedVitals =
        event.action.vitalsCheck ??
        (event.payload?.vitals as VitalsData | undefined);

      if (checkedVitals) {
        const isCompromised =
          nextPatientCondition === "worsened" ||
          nextPatientCondition === "deteriorating" ||
          nextPatientCondition === "critical";
        const adjustedVitals: VitalsData = isCompromised
          ? {
              ...checkedVitals,
              heartRate: (checkedVitals.heartRate ?? 76) + 20,
              respiration: (checkedVitals.respiration ?? 16) + 6,
            }
          : checkedVitals;

        nextVitalsHistory.push(adjustedVitals);
        nextCurrentVitals = adjustedVitals;
        nextRevealedPatient.vitals = adjustedVitals;

        generatedEvents.push({
          timestamp: event.timestamp ?? Date.now(),
          scenarioId: state.currentScenarioId ?? "unknown",
          action: "VITALS_CHECK",
          type: "VITALS_CHECK",
          title: "Vital Signs Checked",
          description: `HR: ${adjustedVitals.heartRate ?? "--"} bpm, RR: ${adjustedVitals.respiration ?? "--"} rpm`,
          severity: "info",
          context: { vitals: adjustedVitals },
        });
      }

      return {
        ...state,
        timeElapsedMinutes: nextTime,
        actionHistory: nextActionHistory,
        vitalsHistory: nextVitalsHistory,
        currentVitals: nextCurrentVitals,
        revealedPatient: nextRevealedPatient,
        revealedEnvironment: nextRevealedEnvironment,
        revealedActors: nextRevealedActors,
        sceneSafetySecured: nextSceneSafetySecured,
        sceneSafetyStatus: nextSceneSafetyStatus,
        patientCondition: nextPatientCondition,
        activeEvents: [...generatedEvents, ...state.activeEvents],
      };
    }

    case "CHECK_VITALS": {
      const rawVitals = event.vitals ??
        (event.payload?.vitals as VitalsData) ?? {
          heartRate: 76,
          respiration: 16,
          bpSystolic: 124,
          bpDiastolic: 82,
          spo2: 98,
          temperature: 98.4,
          gcs: 15,
          avpu: "A",
          pms: "intact",
        };
      const nextCondition = state.patientCondition ?? "stable";
      const isCompromised =
        nextCondition === "worsened" ||
        nextCondition === "deteriorating" ||
        nextCondition === "critical";
      const adjustedVitals: VitalsData = isCompromised
        ? {
            ...rawVitals,
            heartRate: (rawVitals.heartRate ?? 76) + 20,
            respiration: (rawVitals.respiration ?? 16) + 6,
          }
        : rawVitals;

      const vitalsEvt: PatrolEvent = {
        timestamp: event.timestamp ?? Date.now(),
        scenarioId: state.currentScenarioId ?? "unknown",
        action: "VITALS_CHECK",
        type: "VITALS_CHECK",
        title: "Vital Signs Checked",
        description: `HR: ${adjustedVitals.heartRate ?? "--"} bpm, RR: ${adjustedVitals.respiration ?? "--"} rpm`,
        severity: "info",
        context: { vitals: adjustedVitals },
      };

      return {
        ...state,
        vitalsHistory: [...state.vitalsHistory, adjustedVitals],
        currentVitals: adjustedVitals,
        revealedPatient: {
          ...(state.revealedPatient ?? {}),
          vitals: adjustedVitals,
        },
        activeEvents: [vitalsEvt, ...state.activeEvents],
      };
    }

    case "ASSESS_SCENE_SAFETY": {
      const isSecured = state.sceneSafetySecured ?? false;
      const safetyEvt: PatrolEvent = {
        timestamp: event.timestamp ?? Date.now(),
        scenarioId: state.currentScenarioId ?? "unknown",
        action: "SCENE_SAFETY_ASSESSMENT",
        type: "SCENE_SAFETY_ASSESSMENT",
        title: "Scene Safety Assessment",
        description: isSecured
          ? "Scene verified safe: crossed skis uphill and hazards marked."
          : "Scene safety warning: uphill skier traffic unmanaged.",
        severity: isSecured ? "info" : "warning",
        context: { isSecured },
      };

      return {
        ...state,
        sceneSafetyStatus: isSecured ? "safe" : "compromised",
        activeEvents: [safetyEvt, ...state.activeEvents],
      };
    }

    case "REASSESS_PATIENT": {
      const updatedCondition =
        (event.payload?.condition as ShiftState["patientCondition"]) ??
        state.patientCondition ??
        "stable";
      const reassessEvt: PatrolEvent = {
        timestamp: event.timestamp ?? Date.now(),
        scenarioId: state.currentScenarioId ?? "unknown",
        action: "REASSESS_PATIENT",
        type: "REASSESS_PATIENT",
        title: "Patient Condition Re-assessed",
        description: `Patient reassessment: physiological condition is ${updatedCondition}.`,
        severity: "info",
        context: { condition: updatedCondition },
      };

      return {
        ...state,
        patientCondition: updatedCondition,
        activeEvents: [reassessEvt, ...state.activeEvents],
      };
    }

    case "PUSH_EVENT": {
      if (!event.event) return state;
      return {
        ...state,
        activeEvents: [event.event, ...state.activeEvents],
      };
    }

    case "TRIGGER_AMBIENT_EVENT": {
      if (state.phase !== "PATROL_MAP" && state.phase !== "patrol") {
        return state;
      }
      // If an ambient event is already actively awaiting response, do not clobber it
      // unless an explicit event or event ID is provided.
      if (
        state.activeAmbientEvent &&
        !event.ambientEvent &&
        !event.ambientEventId
      ) {
        return state;
      }
      const eventToTrigger =
        event.ambientEvent ??
        (event.ambientEventId
          ? (AMBIENT_EVENTS_CATALOG.find(
              (e) => e.id === event.ambientEventId
            ) ?? null)
          : selectAmbientEvent(state, event.seed));

      if (!eventToTrigger) return state;

      return {
        ...state,
        activeAmbientEvent: eventToTrigger,
      };
    }

    case "RESOLVE_AMBIENT_EVENT": {
      if (!state.activeAmbientEvent) {
        return state;
      }
      const currentEvent = state.activeAmbientEvent;
      const option =
        currentEvent.options.find((o) => o.id === event.selectedOptionId) ??
        currentEvent.options[0];

      const timeIncrement = option?.timeIncrementMinutes ?? 1;
      const nextTime = state.timeElapsedMinutes + timeIncrement;

      // Update closed trails
      let nextClosedTrails = [...(state.operationalState?.closedTrails ?? [])];
      if (option?.closedTrailsDelta?.add) {
        for (const trail of option.closedTrailsDelta.add) {
          if (!nextClosedTrails.includes(trail)) {
            nextClosedTrails.push(trail);
          }
        }
      }
      if (option?.closedTrailsDelta?.remove) {
        nextClosedTrails = nextClosedTrails.filter(
          (trail) => !option.closedTrailsDelta?.remove?.includes(trail)
        );
      }

      // Update equipment location
      const nextEquipmentLocation =
        option?.equipmentLocation ??
        state.operationalState?.equipmentLocation ??
        "Summit Shack";

      const nextOperationalState: ShiftOperationalState = {
        ...(state.operationalState ?? { closedTrails: [] }),
        closedTrails: nextClosedTrails,
        equipmentLocation: nextEquipmentLocation,
      };

      const emittedEvent: PatrolEvent = {
        timestamp: event.timestamp ?? Date.now(),
        scenarioId: "ambient-ops",
        action:
          option?.emittedEvent?.action ?? `ambient_${currentEvent.id}_resolved`,
        title: currentEvent.title,
        description:
          option?.consequenceText ??
          "Ambient patrol operations event resolved.",
        context: {
          category: option?.category ?? "decision",
          trail: currentEvent.location,
          location: currentEvent.location,
          sector: currentEvent.sector,
          ...(option?.emittedEvent?.context ?? {}),
        },
      };

      const nextResolved = [
        ...(state.resolvedAmbientEvents ?? []),
        currentEvent.id,
      ];

      return {
        ...state,
        timeElapsedMinutes: nextTime,
        activeEvents: [emittedEvent, ...state.activeEvents],
        operationalState: nextOperationalState,
        resolvedAmbientEvents: nextResolved,
        activeAmbientEvent: null,
      };
    }

    case "DISMISS_AMBIENT_EVENT": {
      if (!state.activeAmbientEvent) {
        return state;
      }
      const currentEvent = state.activeAmbientEvent;
      const dismissEvent: PatrolEvent = {
        timestamp: event.timestamp ?? Date.now(),
        scenarioId: "ambient-ops",
        action: `ambient_${currentEvent.id}_dismissed`,
        title: currentEvent.title,
        description: "Patroller maintained hill standby without intervening.",
        context: {
          category: "decision",
          trail: currentEvent.location,
          location: currentEvent.location,
          sector: currentEvent.sector,
          dismissed: true,
        },
      };

      const nextResolved = [
        ...(state.resolvedAmbientEvents ?? []),
        currentEvent.id,
      ];

      return {
        ...state,
        activeEvents: [dismissEvent, ...state.activeEvents],
        resolvedAmbientEvents: nextResolved,
        activeAmbientEvent: null,
      };
    }

    case "RESET": {
      return createInitialShiftState(null, "INTRO");
    }

    default:
      return state;
  }
}

/**
 * Headless Patrol Shift Engine instance.
 * Decouples presentation from FSM state machine and scenario state.
 */
class PatrolShiftEngineImpl implements PatrolShiftEngine {
  private state: ShiftState;
  private loadedScenario: PatrolScenario | null = null;
  private readonly scenarios: Map<string, PatrolScenario> = new Map();
  private readonly eventHistory: PatrolEvent[] = [];
  private readonly listeners: Set<() => void> = new Set();

  constructor(
    scenarios: PatrolScenario[] = [],
    options: PatrolShiftEngineOptions = {}
  ) {
    for (const s of scenarios) {
      this.scenarios.set(s.id, s);
    }

    const firstScenario = scenarios[0] ?? null;
    this.loadedScenario = firstScenario;

    this.state = createInitialShiftState(
      firstScenario?.id ?? null,
      options.initialPhase ?? "INTRO"
    );

    this.getState = this.getState.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.dispatch = this.dispatch.bind(this);
    this.getLoadedScenario = this.getLoadedScenario.bind(this);
    this.loadScenario = this.loadScenario.bind(this);
    this.getEventHistory = this.getEventHistory.bind(this);
    this.getScenarios = this.getScenarios.bind(this);
  }

  getState(): ShiftState {
    return this.state;
  }

  getLoadedScenario(): PatrolScenario | null {
    return this.loadedScenario;
  }

  getScenarios(): PatrolScenario[] {
    return Array.from(this.scenarios.values());
  }

  loadScenario(scenario: PatrolScenario): void {
    this.loadedScenario = scenario;
    this.scenarios.set(scenario.id, scenario);
    if (this.state.currentScenarioId !== scenario.id) {
      this.state = {
        ...this.state,
        currentScenarioId: scenario.id,
      };
      this.notify();
    }
  }

  getEventHistory(): PatrolEvent[] {
    return [...this.eventHistory];
  }

  getIncidentEvents(scenarioId: string | null | undefined): PatrolEvent[] {
    return collectIncidentEvents(
      this.eventHistory,
      this.state.activeEvents,
      scenarioId
    );
  }

  dispatch(event: ShiftEngineEvent): void {
    if (event.type === "RESET") {
      this.eventHistory.length = 0;
      const firstScenario = Array.from(this.scenarios.values())[0] ?? null;
      this.loadedScenario = firstScenario;
      this.state = reduceShiftState(this.state, event);
      this.notify();
      return;
    }

    if (event.type === "REPLAY_INCIDENT") {
      const currentScenarioId = this.state.currentScenarioId;
      if (currentScenarioId) {
        const filtered = this.eventHistory.filter(
          (e) => e.scenarioId !== currentScenarioId
        );
        this.eventHistory.length = 0;
        this.eventHistory.push(...filtered);
      }
    }

    const prevPhase = this.state.phase;
    const nextState = reduceShiftState(this.state, event);

    if (event.scenarioId && event.scenarioId !== this.state.currentScenarioId) {
      const targetScenario = this.scenarios.get(event.scenarioId);
      if (targetScenario) {
        this.loadedScenario = targetScenario;
      }
    }

    if (nextState.phase !== prevPhase) {
      this.recordEvent({
        timestamp: event.timestamp ?? Date.now(),
        scenarioId: nextState.currentScenarioId ?? "hub",
        action: `PHASE_TRANSITION:${prevPhase}->${nextState.phase}`,
        context: { from: prevPhase, to: nextState.phase, ...event.payload },
      });
    }

    if (event.type === "RECORD_ACTION" && event.action) {
      this.recordEvent({
        timestamp: event.timestamp ?? Date.now(),
        scenarioId: nextState.currentScenarioId ?? "unknown",
        action: event.action.id,
        context: {
          label: event.action.label,
          category: event.action.category,
          costMinutes: event.action.costMinutes,
          ...event.payload,
        },
      });

      if (event.action.vitalsCheck) {
        this.recordEvent({
          timestamp: event.timestamp ?? Date.now(),
          scenarioId: nextState.currentScenarioId ?? "unknown",
          action: "VITALS_CHECK",
          context: {
            vitals: nextState.currentVitals ?? event.action.vitalsCheck,
          },
        });
      }

      // Record any generated events (such as HAZARD_ALERT from neglected scene safety)
      const newlyGeneratedEvents = nextState.activeEvents.slice(
        0,
        nextState.activeEvents.length - this.state.activeEvents.length
      );
      for (const genEvt of newlyGeneratedEvents) {
        if (
          genEvt.action === "HAZARD_ALERT" ||
          genEvt.type === "HAZARD_ALERT"
        ) {
          this.recordEvent(genEvt);
        }
      }
    }

    if (event.type === "CHECK_VITALS") {
      this.recordEvent({
        timestamp: event.timestamp ?? Date.now(),
        scenarioId: nextState.currentScenarioId ?? "unknown",
        action: "VITALS_CHECK",
        context: { vitals: nextState.currentVitals },
      });
    }

    if (event.type === "ASSESS_SCENE_SAFETY") {
      this.recordEvent({
        timestamp: event.timestamp ?? Date.now(),
        scenarioId: nextState.currentScenarioId ?? "unknown",
        action: "SCENE_SAFETY_ASSESSMENT",
        context: { status: nextState.sceneSafetyStatus },
      });
    }

    if (event.type === "REASSESS_PATIENT") {
      this.recordEvent({
        timestamp: event.timestamp ?? Date.now(),
        scenarioId: nextState.currentScenarioId ?? "unknown",
        action: "REASSESS_PATIENT",
        context: { condition: nextState.patientCondition },
      });
    }

    if (event.type === "PUSH_EVENT" && event.event) {
      this.recordEvent(event.event);
    }

    if (
      (event.type === "RESOLVE_AMBIENT_EVENT" ||
        event.type === "DISMISS_AMBIENT_EVENT") &&
      nextState.activeEvents.length > this.state.activeEvents.length
    ) {
      this.recordEvent(nextState.activeEvents[0]);
    }

    if (nextState !== this.state) {
      this.state = nextState;
      this.notify();
    }
  }

  private recordEvent(event: PatrolEvent): void {
    this.eventHistory.push(event);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        logger.error("Error in PatrolShiftEngine listener:", err);
      }
    }
  }
}

/**
 * Factory creating a headless Patrol Shift simulation engine instance.
 */
export function createPatrolShiftEngine(
  scenarios: PatrolScenario[] = [],
  options: PatrolShiftEngineOptions = {}
): PatrolShiftEngine {
  return new PatrolShiftEngineImpl(scenarios, options);
}
