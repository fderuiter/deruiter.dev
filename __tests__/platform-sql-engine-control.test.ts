// @vitest-environment node
/**
 * How the SQL workbench drives its engine (#2633): the load order, the
 * read-only check, one query at a time, the timeout, the visitor's stop,
 * and shutting the engine down when a stop does not land. DuckDB's
 * asynchronous browser API is replaced by a fake that streams real Arrow
 * record batches, so each of those paths can be made to happen on demand;
 * `platform-sql-engine.test.ts` runs the real engine.
 */
import { tableFromArrays } from "apache-arrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WORKBENCH_ENGINE_SETTINGS,
  type WorkbenchLoad,
} from "@/lib/clinical-platform";

type Batches = AsyncIterable<unknown>;

const duck = vi.hoisted(() => ({
  wasmExceptions: true,
  calls: [] as string[],
  failQuery: null as string | null,
  send: null as unknown as (sql: string) => Promise<AsyncIterable<unknown>>,
  cancelSent: null as unknown as () => Promise<boolean>,
  terminate: [] as string[],
  hangInstantiate: false,
  progressTicks: 0,
}));

vi.mock("@duckdb/duckdb-wasm", () => {
  const connection = {
    query: async (sql: string) => {
      duck.calls.push(`query ${sql}`);
      if (duck.failQuery && sql.startsWith(duck.failQuery)) {
        throw new Error(
          JSON.stringify({
            exception_type: "Parser",
            exception_message: 'syntax error at or near "x"',
          })
        );
      }
    },
    send: (sql: string) => duck.send(sql),
    cancelSent: () => duck.cancelSent(),
  };
  return {
    VoidLogger: class {},
    getPlatformFeatures: async () => ({ wasmExceptions: duck.wasmExceptions }),
    AsyncDuckDB: class {
      async instantiate(
        url: string,
        _pthread: string | null,
        progress: () => void
      ) {
        duck.calls.push(`instantiate ${url.endsWith("duckdb-eh.wasm")}`);
        if (duck.hangInstantiate) await new Promise(() => {});
        // A slow download: each tick of progress comes just inside the limit.
        for (let tick = 0; tick < duck.progressTicks; tick += 1) {
          await new Promise((resolve) => setTimeout(resolve, 59_999));
          progress();
        }
      }
      async connect() {
        return connection;
      }
      async registerFileText(name: string) {
        duck.calls.push(`register ${name}`);
      }
      async dropFile(name: string) {
        duck.calls.push(`drop ${name}`);
      }
      async getVersion() {
        return "v1.4.3";
      }
      async terminate() {
        duck.terminate.push("db");
      }
    },
  };
});

const {
  START_STALL_MS,
  SQL_MAX_ROWS,
  SQL_TIMEOUT_MS,
  SqlRunError,
  engineMessage,
  startSqlEngine,
} = await import("@/components/platform/sql/sql-engine");

const LOAD: WorkbenchLoad = {
  ddl: "CREATE SCHEMA gold;",
  files: [
    { table: "gold.a", fileName: "gold-a.csv", text: "n\n1\n", copy: "COPY a" },
    { table: "gold.b", fileName: "gold-b.csv", text: "n\n2\n", copy: "COPY b" },
  ],
  settings: WORKBENCH_ENGINE_SETTINGS,
};

async function* batches(...lists: number[][]): Batches {
  for (const n of lists)
    yield* tableFromArrays({ n: Int32Array.from(n) }).batches;
}

/** A stream that waits until `release` is called, then fails as a cancelled query does. */
function held() {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  async function* stream(): Batches {
    await gate;
    throw new Error("query was interrupted");
  }
  return { stream, release };
}

class FakeWorker extends EventTarget {
  static last: FakeWorker | null = null;
  constructor() {
    super();
    FakeWorker.last = this;
  }
  terminate() {
    duck.terminate.push("worker");
  }
  /** An uncaught error inside the worker, as the browser reports it. */
  fail(message: string) {
    this.dispatchEvent(
      Object.assign(new Event("error", { cancelable: true }), { message })
    );
  }
}

beforeEach(() => {
  duck.wasmExceptions = true;
  duck.calls = [];
  duck.failQuery = null;
  duck.terminate = [];
  duck.hangInstantiate = false;
  duck.progressTicks = 0;
  FakeWorker.last = null;
  duck.send = async () => batches([1, 2], [3]);
  duck.cancelSent = async () => true;
  vi.stubGlobal("Worker", FakeWorker);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("starting the engine", () => {
  it("loads the tables in order and locks the settings last", async () => {
    const steps: string[] = [];
    const engine = await startSqlEngine(LOAD, (step) => steps.push(step));
    expect(steps).toEqual(["download", "load", "lock"]);
    expect(engine.version).toBe("v1.4.3");
    expect(duck.calls).toEqual([
      "instantiate true",
      "query CREATE SCHEMA gold;",
      "register gold-a.csv",
      "query COPY a",
      "drop gold-a.csv",
      "register gold-b.csv",
      "query COPY b",
      "drop gold-b.csv",
      ...WORKBENCH_ENGINE_SETTINGS.map((s) => `query ${s}`),
    ]);
  });

  it("refuses a browser without WebAssembly exception handling", async () => {
    duck.wasmExceptions = false;
    await expect(startSqlEngine(LOAD)).rejects.toThrow(
      /lacks WebAssembly exception handling/
    );
    expect(duck.calls).toEqual([]);
  });

  it("says which step failed in DuckDB's words and stops the worker", async () => {
    duck.failQuery = "COPY b";
    await expect(startSqlEngine(LOAD)).rejects.toThrow(
      'The engine did not start: Parser Error: syntax error at or near "x"'
    );
    expect(duck.terminate).toEqual(["worker"]);
  });

  it("gives up a start that stops making progress", async () => {
    vi.useFakeTimers();
    duck.hangInstantiate = true;
    const starting = startSqlEngine(LOAD).catch((e) => e);
    await vi.advanceTimersByTimeAsync(START_STALL_MS - 1);
    expect(duck.terminate).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    const error = await starting;
    expect(error.message).toBe(
      "The engine did not start: it stopped responding while it compiled. This browser may be refusing to run WebAssembly on this page."
    );
    expect(duck.terminate).toEqual(["worker"]);
  });

  it("waits for as long as the download keeps making progress", async () => {
    vi.useFakeTimers();
    duck.progressTicks = 3;
    const starting = startSqlEngine(LOAD);
    await vi.advanceTimersByTimeAsync(3 * (START_STALL_MS - 1));
    await expect(starting).resolves.toMatchObject({ version: "v1.4.3" });
  });

  it("fails the start when the worker throws, instead of waiting forever", async () => {
    duck.hangInstantiate = true;
    const starting = startSqlEngine(LOAD).catch((e) => e);
    await vi.waitFor(() => expect(FakeWorker.last).not.toBeNull());
    FakeWorker.last!.fail(
      "Uncaught CompileError: WebAssembly.instantiateStreaming(): Compiling or instantiating WebAssembly module violates the following Content Security policy directive"
    );
    const error = await starting;
    expect(error.message).toMatch(
      /^The engine did not start: Uncaught CompileError: .*Content Security policy/
    );
    expect(duck.terminate).toEqual(["worker"]);
  });
});

describe("running a query", () => {
  it("collects every batch into one result", async () => {
    const engine = await startSqlEngine(LOAD);
    const result = await engine.run("SELECT n FROM gold.a");
    expect(result.columns).toEqual([
      { name: "n", type: "Int32", numeric: true },
    ]);
    expect(result.rows).toEqual([["1"], ["2"], ["3"]]);
    expect(result.rowCount).toBe(3);
    expect(result.truncated).toBe(false);
    expect(SQL_MAX_ROWS).toBe(10_000);
  });

  it("refuses anything but one read-only query before DuckDB sees it", async () => {
    const send = vi.fn(duck.send);
    duck.send = send;
    const engine = await startSqlEngine(LOAD);
    const error = await engine.run("DROP TABLE gold.a").catch((e) => e);
    expect(error).toBeInstanceOf(SqlRunError);
    expect(error.failure).toBe("refused");
    expect(send).not.toHaveBeenCalled();
  });

  it("runs one query at a time", async () => {
    const { stream, release } = held();
    duck.send = async () => stream();
    const engine = await startSqlEngine(LOAD);
    const first = engine.run("SELECT 1").catch((e) => e);
    await Promise.resolve();
    const second = await engine.run("SELECT 2").catch((e) => e);
    expect(second.failure).toBe("refused");
    expect(second.message).toBe(
      "A query is already running. Wait for it or stop it."
    );
    release();
    expect((await first).failure).toBe("error");
  });

  it("passes on DuckDB's own words when a query fails", async () => {
    duck.send = async () => {
      throw new Error(
        JSON.stringify({
          exception_type: "Binder",
          exception_message: 'Referenced column "nope" not found',
        })
      );
    };
    const engine = await startSqlEngine(LOAD);
    const error = await engine.run("SELECT nope").catch((e) => e);
    expect(error.failure).toBe("error");
    expect(error.message).toBe(
      'Binder Error: Referenced column "nope" not found'
    );
    // The engine is still usable.
    duck.send = async () => batches([7]);
    expect((await engine.run("SELECT 7")).rows).toEqual([["7"]]);
  });
});

describe("stopping a query", () => {
  it("stops it when the visitor asks", async () => {
    const { stream, release } = held();
    duck.send = async () => stream();
    duck.cancelSent = async () => {
      release();
      return true;
    };
    const engine = await startSqlEngine(LOAD);
    const running = engine.run("SELECT 1").catch((e) => e);
    await Promise.resolve();
    engine.cancel();
    const error = await running;
    expect(error.failure).toBe("cancelled");
    expect(error.message).toBe("You stopped the query.");
    expect(duck.terminate).toEqual([]);
  });

  it("stops it after the time limit", async () => {
    vi.useFakeTimers();
    const { stream, release } = held();
    duck.send = async () => stream();
    duck.cancelSent = async () => {
      release();
      return true;
    };
    const engine = await startSqlEngine(LOAD);
    const running = engine.run("SELECT 1").catch((e) => e);
    await vi.advanceTimersByTimeAsync(SQL_TIMEOUT_MS);
    const error = await running;
    expect(error.failure).toBe("timeout");
    expect(error.message).toBe(
      "The query ran for more than 30 seconds, so the workbench stopped it."
    );
  });

  it("shuts the engine down when a stop does not land", async () => {
    vi.useFakeTimers();
    const { stream } = held();
    duck.send = async () => stream();
    duck.cancelSent = () => new Promise<boolean>(() => {});
    const engine = await startSqlEngine(LOAD);
    const running = engine.run("SELECT 1").catch((e) => e);
    await vi.advanceTimersByTimeAsync(SQL_TIMEOUT_MS + 5_000);
    const error = await running;
    expect(error.failure).toBe("stopped");
    expect(duck.terminate).toEqual(["worker"]);
    const after = await engine.run("SELECT 1").catch((e) => e);
    expect(after.failure).toBe("stopped");
    expect(after.message).toBe(
      "The engine was shut down. Start it again to run queries."
    );
  });

  it("shuts the engine down when its worker fails during a query", async () => {
    const { stream } = held();
    duck.send = async () => stream();
    const engine = await startSqlEngine(LOAD);
    const running = engine.run("SELECT 1").catch((e) => e);
    await Promise.resolve();
    FakeWorker.last!.fail("Uncaught RuntimeError: memory access out of bounds");
    const error = await running;
    expect(error.failure).toBe("stopped");
    expect(error.message).toBe(
      "The engine failed while running the query, so the workbench shut it down. Start it again to keep going."
    );
    expect(duck.terminate).toEqual(["worker"]);
    expect((await engine.run("SELECT 1").catch((e) => e)).failure).toBe(
      "stopped"
    );
  });

  it("does nothing when no query is running", async () => {
    const cancelSent = vi.fn(duck.cancelSent);
    duck.cancelSent = cancelSent;
    const engine = await startSqlEngine(LOAD);
    engine.cancel();
    expect(cancelSent).not.toHaveBeenCalled();
  });

  it("shuts down on dispose", async () => {
    const engine = await startSqlEngine(LOAD);
    engine.dispose();
    await Promise.resolve();
    expect(duck.terminate).toEqual(["worker", "db"]);
  });
});

describe("engineMessage", () => {
  it("reads DuckDB's text and JSON error forms", () => {
    expect(engineMessage(new Error("Catalog Error: no table"))).toBe(
      "Catalog Error: no table"
    );
    expect(engineMessage("plain")).toBe("plain");
    expect(
      engineMessage(new Error('{"exception_message":"only the words"}'))
    ).toBe("only the words");
    expect(engineMessage(new Error("{not json"))).toBe("{not json");
    expect(engineMessage(new Error('{"other":1}'))).toBe('{"other":1}');
  });
});
