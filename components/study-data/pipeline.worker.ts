/**
 * Study data pipeline worker. It imports the session, which imports the
 * engine through the public lib entry; it never imports the client that
 * constructs it (chunk cycle guard, #853). The worker scope is typed locally
 * so the webworker lib does not leak into the DOM program.
 */
import { createStudyDataSession } from "./pipeline-session";
import type { StudyDataRequest, StudyDataResponse } from "./protocol";

interface WorkerScope {
  onmessage: ((message: MessageEvent<StudyDataRequest>) => void) | null;
  postMessage(response: StudyDataResponse, transfer?: Transferable[]): void;
}

const session = createStudyDataSession();
const scope = self as unknown as WorkerScope;

scope.onmessage = (message) => {
  const request = message.data;
  session.handle(request).then(
    (result) => {
      const transfer =
        request.type === "package" &&
        result !== null &&
        typeof result === "object" &&
        "bytes" in result &&
        result.bytes instanceof Uint8Array
          ? [result.bytes.buffer]
          : [];
      scope.postMessage({ id: request.id, ok: true, result }, transfer);
    },
    (error: unknown) => {
      scope.postMessage({
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  );
};
