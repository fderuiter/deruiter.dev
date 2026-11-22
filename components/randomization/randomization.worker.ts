/**
 * Randomization worker (#4004). It imports the host, which imports the
 * engine through the public lib entry; it never imports the client that
 * constructs it (chunk cycle guard, #853). The worker scope is typed locally
 * so the webworker lib does not leak into the DOM program.
 */
import { createRandomizationHost } from "./randomization-session";
import type { RandomizationResponse } from "./protocol";

interface WorkerScope {
  onmessage: ((message: MessageEvent<unknown>) => void) | null;
  postMessage(response: RandomizationResponse): void;
}

const scope = self as unknown as WorkerScope;
const host = createRandomizationHost((response) => scope.postMessage(response));

scope.onmessage = (message) => host.receive(message.data);
