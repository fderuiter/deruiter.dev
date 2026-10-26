/**
 * SQL workbench data worker. It imports the session, which imports the
 * platform through the public lib entry; it never imports the client that
 * constructs it (chunk cycle guard, #853). The worker scope is typed
 * locally so the webworker lib does not leak into the DOM program.
 */
import { createSqlDataSession } from "./sql-data-session";
import type { SqlDataRequest, SqlDataResponse } from "./protocol";

interface WorkerScope {
  onmessage: ((message: MessageEvent<SqlDataRequest>) => void) | null;
  postMessage(response: SqlDataResponse): void;
}

const session = createSqlDataSession();
const scope = self as unknown as WorkerScope;

scope.onmessage = (message) => {
  const request = message.data;
  session.load().then(
    (load) => scope.postMessage({ id: request.id, ok: true, load }),
    (error: unknown) =>
      scope.postMessage({
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
  );
};
