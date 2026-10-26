/**
 * Self-service explorer worker. It imports the session, which imports the
 * engine through the public lib entry; it never imports the client that
 * constructs it (chunk cycle guard, #853). The worker scope is typed locally
 * so the webworker lib does not leak into the DOM program.
 */
import { createExploreSession } from "./explore-session";
import type { ExploreRequest, ExploreResponse } from "./protocol";

interface WorkerScope {
  onmessage: ((message: MessageEvent<ExploreRequest>) => void) | null;
  postMessage(response: ExploreResponse): void;
}

const session = createExploreSession();
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
