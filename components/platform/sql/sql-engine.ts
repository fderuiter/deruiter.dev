/**
 * The SQL workbench's engine: DuckDB compiled to WebAssembly, running in
 * its own Web Worker, holding the visitor's own in-memory copy of the gold
 * tables. The page imports this module only when the visitor starts the
 * engine, so neither the engine's code nor its 34 MB WebAssembly binary is
 * part of the route's first load. Both are served from this site; nothing
 * is fetched from a CDN.
 *
 * The engine is read-only twice over: `checkWorkbenchSql` refuses anything
 * but one query before it reaches DuckDB, and the load's settings, applied
 * last, refuse file, network and extension access and lock the
 * configuration (ADR 0066).
 */
import {
  AsyncDuckDB,
  VoidLogger,
  getPlatformFeatures,
  type AsyncDuckDBConnection,
} from "@duckdb/duckdb-wasm";
import {
  checkWorkbenchSql,
  type WorkbenchLoad,
  type WorkbenchResult,
} from "@/lib/clinical-platform";
import { ResultCollector } from "./arrow-result";

/** Rows a result keeps for the grid and the CSV; the rest are counted. */
export const SQL_MAX_ROWS = 10_000;

/** How long a query may run before the workbench stops it. */
export const SQL_TIMEOUT_MS = 30_000;

/** How long a stop may take before the engine is shut down instead. */
const STOP_GRACE_MS = 5_000;

/**
 * How long the engine may go without reporting download progress, or
 * finishing its compile, before the start is given up. A browser that
 * refuses to compile the binary fails inside DuckDB's worker without ever
 * answering, so only silence shows it.
 */
export const START_STALL_MS = 60_000;

/** Why a query did not return rows. */
export type SqlRunFailure =
  /** DuckDB refused or failed the query; `message` is its own words. */
  | "error"
  /** The workbench's read-only check refused the query before it ran. */
  | "refused"
  /** The query ran past `SQL_TIMEOUT_MS` and was stopped. */
  | "timeout"
  /** The visitor stopped it. */
  | "cancelled"
  /** The engine did not stop the query and was shut down. */
  | "stopped";

/** A query that did not return rows, with a sentence saying why. */
export class SqlRunError extends Error {
  constructor(
    readonly failure: SqlRunFailure,
    message: string
  ) {
    super(message);
    this.name = "SqlRunError";
  }
}

/** A started engine. */
export interface SqlEngine {
  /** DuckDB's version, for example `v1.4.3`. */
  readonly version: string;
  /** Runs one read-only query. Rejects with a `SqlRunError`. */
  run(sql: string): Promise<WorkbenchResult>;
  /** Stops the running query, if any. */
  cancel(): void;
  /** Shuts the engine down. */
  dispose(): void;
}

/** A step of starting the engine, for the page's progress line. */
export type SqlEngineStep = "download" | "load" | "lock";

const ENGINE_FILES = {
  module: new URL("@duckdb/duckdb-wasm/dist/duckdb-eh.wasm", import.meta.url),
  worker: new URL(
    "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js",
    import.meta.url
  ),
};

/**
 * DuckDB's errors arrive either as text or, for a parser error, as JSON
 * with the text inside; either way the visitor reads DuckDB's own words.
 */
export function engineMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (!text.startsWith("{")) return text;
  try {
    const parsed = JSON.parse(text) as {
      exception_type?: string;
      exception_message?: string;
    };
    if (typeof parsed.exception_message !== "string") return text;
    return parsed.exception_type
      ? `${parsed.exception_type} Error: ${parsed.exception_message}`
      : parsed.exception_message;
  } catch {
    return text;
  }
}

/** The query in flight: why it is being stopped, and how to end it at once. */
interface RunningQuery {
  cancel: SqlRunFailure | null;
  /** Why the engine was shut down, when it was not the visitor's stop. */
  shutDownBecause?: string;
  abort(): void;
}

const delay = (ms: number) =>
  new Promise<"late">((resolve) => setTimeout(() => resolve("late"), ms));

/**
 * Starts the engine and loads the warehouse into it.
 *
 * @param load - The gold tables and statements, from the data worker.
 * @param onStep - Called as each step begins.
 * @returns The engine, once every table is loaded and the settings locked.
 * @throws Error when the browser cannot run the engine, a step fails or the
 *   engine's worker throws.
 */
export async function startSqlEngine(
  load: WorkbenchLoad,
  onStep: (step: SqlEngineStep) => void = () => {}
): Promise<SqlEngine> {
  const features = await getPlatformFeatures();
  if (!features.wasmExceptions) {
    throw new Error(
      "This browser cannot run the engine: it lacks WebAssembly exception handling, which current Chrome, Edge, Firefox and Safari all have."
    );
  }
  onStep("download");
  const worker = new Worker(ENGINE_FILES.worker);
  const db = new AsyncDuckDB(new VoidLogger(), worker);
  // An error thrown inside the worker never settles DuckDB's own promises,
  // so it is caught here.
  let onWorkerError: (error: Error) => void = () => {};
  worker.addEventListener("error", (event: ErrorEvent) => {
    event.preventDefault();
    onWorkerError(new Error(event.message || "The engine's worker stopped."));
  });
  const workerFailed = new Promise<never>((_, reject) => {
    onWorkerError = reject;
  });
  const instantiate = () =>
    new Promise<void>((resolve, reject) => {
      const stalled = () =>
        reject(
          new Error(
            "it stopped responding while it compiled. This browser may be refusing to run WebAssembly on this page."
          )
        );
      let timer = setTimeout(stalled, START_STALL_MS);
      db.instantiate(ENGINE_FILES.module.href, null, () => {
        clearTimeout(timer);
        timer = setTimeout(stalled, START_STALL_MS);
      }).then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  const steps = async () => {
    await instantiate();
    onStep("load");
    const connection = await db.connect();
    await connection.query(load.ddl);
    for (const file of load.files) {
      await db.registerFileText(file.fileName, file.text);
      await connection.query(file.copy);
      await db.dropFile(file.fileName);
    }
    onStep("lock");
    for (const setting of load.settings) await connection.query(setting);
    return { connection, version: await db.getVersion() };
  };
  let conn: AsyncDuckDBConnection;
  let version: string;
  try {
    ({ connection: conn, version } = await Promise.race([
      steps(),
      workerFailed,
    ]));
  } catch (error) {
    onWorkerError = () => {};
    worker.terminate();
    throw new Error(`The engine did not start: ${engineMessage(error)}`);
  }

  let running: RunningQuery | null = null;
  let stopped = false;

  const shutDown = () => {
    stopped = true;
    worker.terminate();
    // A terminated worker never answers, so the query in flight is ended here.
    running?.abort();
  };

  // A worker that fails once started cannot be trusted with the next query.
  onWorkerError = () => {
    if (stopped) return;
    if (running) {
      running.cancel = "stopped";
      running.shutDownBecause =
        "The engine failed while running the query, so the workbench shut it down. Start it again to keep going.";
    }
    shutDown();
  };

  const stop = async (reason: "timeout" | "cancelled") => {
    const query = running;
    if (!query || query.cancel) return;
    query.cancel = reason;
    const outcome = await Promise.race([
      conn.cancelSent().then(
        (cancelled) => (cancelled ? "stopped" : "late"),
        () => "late" as const
      ),
      delay(STOP_GRACE_MS),
    ]);
    if (outcome === "late" && running === query) {
      query.cancel = "stopped";
      shutDown();
    }
  };

  const read = async (sql: string, query: RunningQuery) => {
    const collector = new ResultCollector(SQL_MAX_ROWS);
    const started = performance.now();
    const reader = await conn.send(sql, true);
    for await (const batch of reader) {
      if (query.cancel) break;
      collector.add(batch);
    }
    if (query.cancel) throw new Error("stopped while reading");
    return collector.result(performance.now() - started);
  };

  return {
    version,
    async run(sql) {
      if (stopped) {
        throw new SqlRunError(
          "stopped",
          "The engine was shut down. Start it again to run queries."
        );
      }
      if (running) {
        throw new SqlRunError(
          "refused",
          "A query is already running. Wait for it or stop it."
        );
      }
      const findings = checkWorkbenchSql(sql);
      if (findings.length > 0) {
        throw new SqlRunError(
          "refused",
          findings.map((finding) => finding.message).join(" ")
        );
      }
      let abort = () => {};
      const aborted = new Promise<never>((_, reject) => {
        abort = () => reject(new Error("engine shut down"));
      });
      const query: RunningQuery = { cancel: null, abort };
      running = query;
      const timer = setTimeout(() => void stop("timeout"), SQL_TIMEOUT_MS);
      try {
        return await Promise.race([read(sql, query), aborted]);
      } catch (error) {
        throw failure(query, error);
      } finally {
        clearTimeout(timer);
        if (running === query) running = null;
      }
    },
    cancel() {
      void stop("cancelled");
    },
    dispose() {
      shutDown();
      void db.terminate().catch(() => {});
    },
  };
}

/** The `SqlRunError` for a query that ended without rows. */
function failure(query: RunningQuery, error: unknown): SqlRunError {
  switch (query.cancel) {
    case "timeout":
      return new SqlRunError(
        "timeout",
        `The query ran for more than ${SQL_TIMEOUT_MS / 1000} seconds, so the workbench stopped it.`
      );
    case "cancelled":
      return new SqlRunError("cancelled", "You stopped the query.");
    case "stopped":
      return new SqlRunError(
        "stopped",
        query.shutDownBecause ??
          "The engine did not stop the query, so the workbench shut it down. Start it again to keep going."
      );
    default:
      return new SqlRunError("error", engineMessage(error));
  }
}
