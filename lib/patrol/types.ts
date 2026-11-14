/**
 * Public type definitions for the Patrol Shift simulation domain.
 *
 * Provides core interfaces for scenario modeling, shift FSM states,
 * events, actions, OET engine state, and debrief scoring rules.
 * Adheres to ADR 0026 and Issue #748.
 */

export type CanonicalShiftPhase =
  | "INTRO"
  | "BRIEFING"
  | "PATROL_MAP"
  | "DISPATCH"
  | "RESPONDING"
  | "SCENE"
  | "TRANSPORT_PREP"
  | "OET"
  | "HANDOFF"
  | "DEBRIEF"
  | "SHIFT_COMPLETE";

export type LegacyShiftPhase =
  "briefing" | "patrol" | "incident" | "debrief" | "completed";

export type ShiftPhase = CanonicalShiftPhase | LegacyShiftPhase;

export interface VitalsData {
  heartRate?: number;
  respiration?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  spo2?: number;
  temperature?: number;
  gcs?: number;
  avpu?: "A" | "V" | "P" | "U";
  pms?: "intact" | "compromised" | "absent";
  pupils?: string;
  skin?: string;
}

export type IncidentSeverity = "info" | "warning" | "critical";

export interface PatrolEvent {
  timestamp: number | string;
  scenarioId?: string;
  action?: string;
  context?: Record<string, unknown>;

  // Legacy / optional metadata fields
  id?: string;
  type?: string;
  title?: string;
  description?: string;
  severity?: IncidentSeverity;
  payload?: Record<string, unknown>;
}

export type ActionCategory =
  "assessment" | "treatment" | "communication" | "transport" | "decision";

export interface ScenarioAction {
  id: string;
  label: string;
  description?: string;
  category?: ActionCategory;
  costMinutes?: number;
  requiredEquipment?: string[];
  /** IDs of actions that must be executed prior to this action becoming available. */
  preconditions?: string[];
  /** Alias for preconditions to ensure backwards compatibility. */
  prerequisites?: string[];
  /** Data progressively revealed when this action is completed. */
  reveals?: {
    patient?: Partial<PatientState>;
    environment?: Partial<EnvironmentState>;
    actors?: PatrolActor[];
    findings?: string[];
  };
  /** Vitals measured or checked when this action is executed. */
  vitalsCheck?: VitalsData;
  /** Whether this action establishes or secures scene safety (such as uphill crossed skis). */
  securesSceneSafety?: boolean;
  /** Whether this action triggers a scene safety re-assessment. */
  reassessesSceneSafety?: boolean;
  /** Whether executing this action without secured scene safety causes condition deterioration. */
  requiresSceneSafety?: boolean;
}

export interface DebriefRule {
  id: string;
  title: string;
  category: string;
  passed: boolean;
  score: number;
  feedback: string;
}

export interface PatientState {
  complaint?: string;
  mechanism?: string;
  vitals?: VitalsData;
  findings?: string[];
  interventions?: string[];
  levelOfConsciousness?: string;
  allergies?: string[];
  medications?: string[];
  pastMedicalHistory?: string[];
  lastIntake?: string;
  eventsLeading?: string;
}

export interface EnvironmentState {
  weather?: string;
  snowConditions?: string;
  temperatureFahrenheit?: number;
  visibility?: string;
  hazards?: string[];
  sceneSafetyNotes?: string;
}

export interface PatrolActor {
  id: string;
  name: string;
  role: string;
  notes?: string;
  statement?: string;
}

/**
 * Communication/delegation style exhibited by a dialogue option.
 *
 * These are descriptive, not evaluative: no style is inherently the "correct"
 * choice. Debrief feedback should describe the resulting clarity and
 * teamwork trade-offs rather than label a style as wrong.
 */
export type DialogueStyle =
  "directive" | "collaborative" | "deferential" | "candid" | "reassuring";

/**
 * A single selectable line of dialogue within a `DialogueMoment`.
 */
export interface DialogueOption {
  id: string;
  /** The line the player-patroller speaks or transmits. */
  text: string;
  /** Communication/delegation style this option exemplifies. */
  style: DialogueStyle;
  /** How unambiguous the instruction or statement is to the listener. */
  clarity: "high" | "moderate" | "low";
  /** Whether the option explicitly requests confirmation/read-back (closed-loop communication). */
  closesLoop?: boolean;
  /** The other party's in-fiction reply to this choice. */
  response: string;
  /** Neutral, descriptive note surfaced in debrief — describes the style and its effect, not a verdict. */
  debriefNote: string;
}

/**
 * A single interpersonal/delegation dialogue beat: a prompt from another
 * character (patient, bystander, fellow patroller, or dispatch) paired with
 * several non-binary response options.
 */
export interface DialogueMoment {
  id: string;
  /** Who initiates this dialogue beat, e.g. "Casey (Second-Year Patroller)". */
  speaker: string;
  /** The line or situation prompting a response. */
  prompt: string;
  /** Optional stage-direction / scene-setting context. */
  context?: string;
  /** ID of the scenario action that must be completed before this moment becomes available. */
  afterActionId?: string;
  options: DialogueOption[];
}

export interface PatrolScenario {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  category?: string;
  estimatedMinutes?: number;
  location?: string;
  /** Authentic Welch Village geospatial coordinates for dispatch and beacon anchoring (Issue #835). */
  coordinates?: { x: number; y: number; zone?: "main" | "back-bowl" };
  dispatchPrompt?: string;
  environment?: EnvironmentState;
  patient?: PatientState;
  actors?: PatrolActor[];
  initialVitals?: VitalsData;
  actions: ScenarioAction[];
  /** Interpersonal/delegation dialogue beats woven into this scenario (Issue #752). */
  dialogueMoments?: DialogueMoment[];
  debriefRules: DebriefRule[];
}

/**
 * A selectable response option within an ambient operational mini-event.
 */
export interface AmbientEventOption {
  id: string;
  label: string;
  description?: string;
  consequenceText: string;
  category?: ActionCategory;
  timeIncrementMinutes?: number;
  closedTrailsDelta?: {
    add?: string[];
    remove?: string[];
  };
  equipmentLocation?: string;
  /** Emitted event context or payload appended to activeEvents */
  emittedEvent?: Partial<PatrolEvent>;
}

/**
 * An ambient operational mini-event encountered on the mountain map hub.
 */
export interface AmbientEvent {
  id: string;
  title: string;
  location: string;
  sector: string;
  coordinates: { x: number; y: number; zone?: "main" | "back-bowl" };
  prompt: string;
  context?: string;
  options: AmbientEventOption[];
}

/**
 * Persistent operational state across the patrol shift.
 */
export interface ShiftOperationalState {
  closedTrails: string[];
  equipmentLocation?: string;
  activeHazardPins?: Array<{
    id: string;
    location: string;
    x: number;
    y: number;
    label: string;
  }>;
}

export interface ShiftState {
  currentScenarioId: string | null;
  phase: ShiftPhase;
  timeElapsedMinutes: number;
  score: number;
  incidentsCompleted: number;
  activeEvents: PatrolEvent[];
  actionHistory: ScenarioAction[];
  vitalsHistory: VitalsData[];
  isCompleted: boolean;

  // Milestone M5 progressive information reveal and dynamic clinical state
  revealedPatient?: Partial<PatientState>;
  revealedEnvironment?: Partial<EnvironmentState>;
  revealedActors?: PatrolActor[];
  sceneSafetySecured?: boolean;
  sceneSafetyStatus?: "unassessed" | "safe" | "compromised";
  patientCondition?: "stable" | "deteriorating" | "worsened" | "critical";
  currentVitals?: VitalsData;

  // Milestone M8 ambient patrol operations and persistent operational state
  activeAmbientEvent?: AmbientEvent | null;
  resolvedAmbientEvents?: string[];
  operationalState?: ShiftOperationalState;
}

export type ShiftEngineEventType =
  | "START_SHIFT"
  | "COMPLETE_BRIEFING"
  | "RECEIVE_DISPATCH"
  | "ACCEPT_DISPATCH"
  | "ARRIVE_ON_SCENE"
  | "COMPLETE_SCENE"
  | "BEGIN_TRANSPORT"
  | "ARRIVE_AT_BASE"
  | "COMPLETE_HANDOFF"
  | "FINISH_DEBRIEF"
  | "REPLAY_INCIDENT"
  | "COMPLETE_SHIFT"
  | "RECORD_ACTION"
  | "CHECK_VITALS"
  | "ASSESS_SCENE_SAFETY"
  | "REASSESS_PATIENT"
  | "PUSH_EVENT"
  | "RESET"
  | "TRIGGER_AMBIENT_EVENT"
  | "RESOLVE_AMBIENT_EVENT"
  | "DISMISS_AMBIENT_EVENT";

export interface ShiftEngineEvent {
  type: ShiftEngineEventType;
  scenarioId?: string;
  action?: ScenarioAction;
  event?: PatrolEvent;
  vitals?: VitalsData;
  payload?: Record<string, unknown>;
  timestamp?: number;
  ambientEventId?: string;
  selectedOptionId?: string;
  ambientEvent?: AmbientEvent;
  seed?: number;
}

export interface OETEngineState {
  evaluatedCount: number;
  rulesPassed: number;
  rulesFailed: number;
}

/**
 * One of the five judgment dimensions scored by the M7 contextual debrief engine.
 */
export type DebriefDimension =
  | "sceneManagement"
  | "patientCare"
  | "communication"
  | "transportation"
  | "operationalJudgment";

/**
 * Scored evaluation of a single debrief dimension, on a 0-10 scale.
 */
export interface DimensionScore {
  score: number;
  label: string;
  rating: "exemplary" | "proficient" | "developing" | "needs-attention";
  feedback: string;
}

/**
 * A single natural-language debrief feedback card tied to a specific dimension
 * and, where applicable, the `PatrolEvent.action` that triggered it.
 */
export interface QualitativeObservation {
  id: string;
  dimension: DebriefDimension;
  sentiment: "positive" | "caution" | "constructive";
  headline: string;
  detail: string;
  relatedEventAction?: string;
}

/**
 * Non-clinical, operational activity counters surfaced in the end-of-shift summary.
 * Derived entirely from `PatrolEvent[]` counts (Epic #744: never patient outcomes).
 */
export interface ShiftPlayfulStats {
  callsHandled: number;
  radioTransmissions: number;
  patientsAssisted: number;
  sledTransports: number;
  trailsChecked: number;
  hazardsMarked: number;
  pmsChecksPerformed: number;
  reassessmentsLogged: number;
  closedLoopDelegations: number;
  communicationRating: string;
  guestsAssisted?: number;
}

/**
 * Rule-based debrief result for a single incident, produced by
 * `evaluateIncidentDebrief` from that incident's `PatrolEvent[]` slice alone.
 */
export interface IncidentDebriefResult {
  scenarioId: string;
  dimensions: Record<DebriefDimension, DimensionScore>;
  overallRating: string;
  observations: QualitativeObservation[];
  oetSummary?: {
    judgmentScore: number;
    controlledStops: number;
    excessiveSpeedSeconds: number;
    rideComfort: "smooth" | "moderate" | "rough";
  };
}

/**
 * End-of-shift operational record aggregating every incident's debrief result.
 */
export interface ShiftDebriefSummary {
  totalIncidents: number;
  elapsedShiftMinutes: number;
  incidentResults: IncidentDebriefResult[];
  compositeDimensions: Record<DebriefDimension, DimensionScore>;
  playfulStats: ShiftPlayfulStats;
  chronologicalHighlights: string[];
}

/**
 * Condition modifiers originating from the operational briefing or scenario environment.
 */
export interface BriefingState {
  /** Snow surface condition governing friction, drag, and braking response. */
  snowCondition?: "hardpack" | "fresh" | "powder" | "ice" | string;
  /** Whether the trail width is narrowed (e.g. glade or catwalk corridor). */
  narrowTrails?: boolean;
  /** Whether tree hazards and off-piste glade obstacles are active. */
  treeHazards?: boolean;
  /** Ambient temperature in Fahrenheit. */
  temperatureFahrenheit?: number;
  /** Atmospheric visibility description. */
  visibility?: string;
}

/**
 * Real-time and debrief judgment metrics evaluating operator control during toboggan descent.
 */
export interface OetMetrics {
  /** Time spent exceeding safe descent speed threshold in seconds. */
  excessiveSpeedTime: number;
  /** Count of harsh or sudden lateral direction changes. */
  abruptDirectionChanges: number;
  /** Count of times the sled crossed outside the designated trail boundaries. */
  boundaryViolations: number;
  /** Count of physical collisions with trees, rocks, or terrain obstacles. */
  collisions: number;
  /** Count of smooth, controlled complete stops performed on the fall line. */
  controlledStops: number;
  /** Route adherence and gate traversal efficiency rating (0 - 100). */
  routeEfficiency: number;
  /** Overall OET judgment score rewarding control over speed (0 - 100). */
  judgmentScore: number;
}

/**
 * Classification of physical terrain obstacles encountered along the fall line.
 */
export type OetObstacleType = "tree" | "rock" | "ice_patch" | "mogul";

/**
 * Fixed terrain obstacle along the fall line.
 */
export interface OetObstacle {
  id: string;
  x: number;
  y: number;
  radius: number;
  type: OetObstacleType;
  hit?: boolean;
}

/**
 * Fall line guide gate defining safe passage corridor.
 */
export interface OetGate {
  id: string;
  y: number;
  xMin: number;
  xMax: number;
  cleared?: boolean;
  missed?: boolean;
}

/**
 * Particle entity for snow spray visual feedback.
 */
export interface SnowSprayParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

/**
 * Kinematic state of the Cascade 100 rescue toboggan and patroller operators.
 */
export interface OetSledState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speedMph: number;
  steering: number;
  chainBrakeEngaged: boolean;
  tailRopeBraking: boolean;
  isStopped: boolean;
}

/**
 * Simulation lifecycle phase of the OET descent run.
 */
export type OetDescentStatus =
  "ready" | "descending" | "stopped" | "completed" | "crashed";

/**
 * Mutable internal simulation state of the OET descent engine.
 */
export interface OetDescentState {
  sled: OetSledState;
  status: OetDescentStatus;
  conditions: BriefingState;
  trailWidth: number;
  trailLeft: number;
  trailRight: number;
  totalDistance: number;
  distanceTraveled: number;
  obstacles: OetObstacle[];
  gates: OetGate[];
  metrics: OetMetrics;
  elapsedTime: number;
  activeWarnings: string[];
}

/**
 * Immutable state snapshot consumed by React components and debrief analytics.
 */
export interface OetDescentSnapshot {
  sled: Readonly<OetSledState>;
  status: OetDescentStatus;
  conditions: Readonly<BriefingState>;
  trailWidth: number;
  trailLeft: number;
  trailRight: number;
  totalDistance: number;
  distanceTraveled: number;
  metrics: Readonly<OetMetrics>;
  elapsedTime: number;
  activeWarnings: readonly string[];
  activeParticleCount: number;
  isChainBrakeEngaged: boolean;
  isTailRopeBraking: boolean;
  isStopped: boolean;
  currentSpeedMph: number;
  judgmentScore: number;
}

/**
 * Configuration options for initializing the headless OET descent engine.
 */
export interface OetDescentEngineOptions {
  conditions?: BriefingState;
  totalDistance?: number;
  trailWidth?: number;
  seedObstacles?: boolean;
  fixedDt?: number;
}

export interface PatrolShiftEngineOptions {
  initialPhase?: ShiftPhase;
  startTime?: number;
}

export interface PatrolShiftEngine {
  getState(): ShiftState;
  dispatch(event: ShiftEngineEvent): void;
  getEventHistory(): PatrolEvent[];
  getIncidentEvents(scenarioId: string | null | undefined): PatrolEvent[];
  getLoadedScenario(): PatrolScenario | null;
  loadScenario(scenario: PatrolScenario): void;
  subscribe(listener: () => void): () => void;
  /** Returns the list of scenarios registered with this engine instance. */
  getScenarios?(): PatrolScenario[];
}
