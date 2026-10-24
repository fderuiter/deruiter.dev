/**
 * Operations dashboard worker. It imports the session, which imports the
 * engine through the public lib entry; it never imports the client that
 * constructs it (chunk cycle guard, #853). The worker scope is typed locally
 * so the webworker lib does not leak into the DOM program.
 */
import { createOperationsSession } from "./operations-session";
import type { OperationsRequest, OperationsResponse } from "./protocol";

interface WorkerScope {
  onmessage: ((message: MessageEvent<OperationsRequest>) => void) | null;
  postMessage(response: OperationsResponse): void;
}

const session = createOperationsSession();
const scope = self as unknown as WorkerScope;

scope.onmessage = (message) => {
  const request = message.data;
  session.handle(request).then(
    (result) => scope.postMessage({ id: request.id, ok: true, result }),
    (error: unknown) =>
      scope.postMessage({
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
  );
};
