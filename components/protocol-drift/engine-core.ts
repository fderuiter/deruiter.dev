/**
 * Message protocol shared by the engine Web Worker and the in-thread
 * fallback adapter. This module has no DOM, React or Worker dependency, and
 * it must never import the adapter that constructs the worker: the worker's
 * import graph would then reach its own constructor and the production build
 * would fail the chunk cycle guard (lib/dx/chunk-cycle-guard.ts, #853).
 */
import {
  createProtocolDriftEngine,
  type PDCommand,
  type PDWorkerEvent,
  type ProtocolDriftEngine,
  type ProtocolDriftView,
} from "@/lib/protocol-drift";

/** A request from the main thread. */
export interface EngineRequest {
  id: number;
  command: PDCommand;
}

/** The engine's answer to one request. */
export interface EngineResponse {
  id: number;
  events: PDWorkerEvent[];
  view: ProtocolDriftView;
}

/** Creates a fresh engine for a worker or an in-thread adapter. */
export function createEngineHost(): ProtocolDriftEngine {
  return createProtocolDriftEngine({});
}

/** Applies one request and packages the events with a fresh view. */
export function answerRequest(
  engine: ProtocolDriftEngine,
  request: EngineRequest
): EngineResponse {
  const events = engine.dispatch(request.command);
  return { id: request.id, events, view: engine.view() };
}
