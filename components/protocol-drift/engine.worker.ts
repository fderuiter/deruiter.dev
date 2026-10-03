/**
 * Protocol Drift simulation worker. It imports the engine through the
 * public lib entry and the shared message core only; it never imports the
 * adapter that constructs it (chunk cycle guard, #853). The worker scope is
 * typed locally so the webworker lib does not leak into the DOM program.
 */
import {
  answerRequest,
  createEngineHost,
  type EngineRequest,
  type EngineResponse,
} from "./engine-core";

interface WorkerScope {
  onmessage: ((message: MessageEvent<EngineRequest>) => void) | null;
  postMessage(response: EngineResponse): void;
}

const engine = createEngineHost();
const scope = self as unknown as WorkerScope;

scope.onmessage = (message) => {
  scope.postMessage(answerRequest(engine, message.data));
};
