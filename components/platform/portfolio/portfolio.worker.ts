/**
 * Portfolio dashboard worker. It imports the session, which imports the
 * engine through the public lib entry; it never imports the client that
 * constructs it (chunk cycle guard, #853). The worker scope is typed locally
 * so the webworker lib does not leak into the DOM program.
 */
import { createPortfolioSession } from "./portfolio-session";
import type { PortfolioRequest, PortfolioResponse } from "./protocol";

interface WorkerScope {
  onmessage: ((message: MessageEvent<PortfolioRequest>) => void) | null;
  postMessage(response: PortfolioResponse): void;
}

const session = createPortfolioSession();
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
