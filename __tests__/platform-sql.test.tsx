/**
 * @vitest-environment jsdom
 */

import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import {
  DEFAULT_PORTFOLIO_SEED,
  buildWarehouse,
  dataContracts,
  dataProducts,
  generatePortfolio,
  workbenchQueries,
  workbenchSchema,
  type WorkbenchLoad,
  type WorkbenchResult,
} from "@/lib/clinical-platform";
import { DEMO_301_STUDY, runPipeline } from "@/lib/study-data";
import { createSqlDataClient } from "@/components/platform/sql/sql-data-client";
import type {
  SqlDataRequest,
  SqlDataResponse,
} from "@/components/platform/sql/protocol";

/**
 * The /platform/sql workbench (#2633). The engine is DuckDB compiled to
 * WebAssembly, which jsdom cannot run, so `sql-engine` is replaced by a fake
 * that records what the page asks of it; `platform-sql-engine.test.ts` runs
 * the real engine. The warehouse load is the real one, built on the main
 * thread because jsdom has no Worker.
 */

type Run = (sql: string) => Promise<WorkbenchResult>;

const engine = vi.hoisted(() => ({
  run: vi.fn<Run>(),
  cancel: vi.fn(),
  dispose: vi.fn(),
  start: vi.fn(),
  loads: [] as unknown[],
}));

vi.mock("@/components/platform/sql/sql-engine", () => {
  class SqlRunError extends Error {
    constructor(
      readonly failure: string,
      message: string
    ) {
      super(message);
    }
  }
  return {
    SqlRunError,
    startSqlEngine: async (load: unknown, onStep: (step: string) => void) => {
      engine.loads.push(load);
      await engine.start(onStep);
      return {
        version: "v1.4.3",
        run: engine.run,
        cancel: engine.cancel,
        dispose: engine.dispose,
      };
    },
  };
});

const { SqlWorkbench } = await import("@/components/platform/sql/SqlWorkbench");
const { SqlRunError } = await import("@/components/platform/sql/sql-engine");

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const pipeline = runPipeline(DEMO_301_STUDY, { seed: 7, nSubjects: 24 });
const tables = workbenchSchema(
  dataProducts(pipeline),
  dataContracts(pipeline),
  warehouse
);
const queries = workbenchQueries(warehouse.asOf);
const firstMetric = queries.find((q) => q.kind === "metric")!;

const RESULT: WorkbenchResult = {
  columns: [
    { name: "study_id", type: "Text", numeric: false },
    { name: "subjects", type: "Int64", numeric: true },
    { name: "note", type: "Text", numeric: false },
  ],
  rows: [
    ["DEMO-301", "24", null],
    ["DEMO-302", "3", "=cmd"],
  ],
  rowCount: 2,
  truncated: false,
  elapsedMs: 12.4,
};

async function violations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    // jsdom computes no colours; the end-to-end test checks contrast in a
    // real browser.
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map((violation) => violation.id);
}

function renderWorkbench() {
  return render(<SqlWorkbench tables={tables} queries={queries} />);
}

const editor = () =>
  screen.getByRole("textbox", { name: "SQL (DuckDB)" }) as HTMLTextAreaElement;

async function startEngine() {
  fireEvent.click(screen.getByRole("button", { name: "Start SQL engine" }));
  await screen.findByText(
    `DuckDB v1.4.3 is running with ${tables.length} gold tables, read-only.`,
    undefined,
    { timeout: 10_000 }
  );
}

beforeEach(() => {
  engine.run.mockReset().mockResolvedValue(RESULT);
  engine.cancel.mockReset();
  engine.dispose.mockReset();
  engine.start.mockReset().mockResolvedValue(undefined);
  engine.loads.length = 0;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("before the engine starts", () => {
  it("shows the schema, the saved queries and the first query's SQL", async () => {
    const { container } = renderWorkbench();
    const schema = screen.getByRole("region", { name: "Schema" });
    for (const table of tables) {
      expect(within(schema).getByText(table.name)).toBeTruthy();
    }
    const saved = screen.getByRole("combobox", { name: "Saved query" });
    const groups = within(saved).getAllByRole("group");
    expect(groups.map((g) => g.getAttribute("label"))).toEqual([
      "Worked examples",
      "Governed metrics: the SQL behind each number",
    ]);
    expect(within(saved).getAllByRole("option")).toHaveLength(
      queries.length + 1
    );
    expect(editor().value).toBe(queries[0].sql);
    expect(
      (screen.getByRole("button", { name: "Run" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      screen.getByText(
        "Start the engine to run queries. You can read and edit the SQL now."
      )
    ).toBeTruthy();
    expect(await violations(container)).toEqual([]);
  });

  it("shows a metric query's three dialects", () => {
    renderWorkbench();
    fireEvent.change(screen.getByRole("combobox", { name: "Saved query" }), {
      target: { value: firstMetric.id },
    });
    expect(editor().value).toBe(firstMetric.sql);
    expect(screen.getByText(firstMetric.description)).toBeTruthy();
    const dialects = screen
      .getByText("Compare the same metric in DuckDB, PostgreSQL and T-SQL")
      .closest("details")!;
    const blocks = Array.from(dialects.querySelectorAll("pre")).map(
      (pre) => pre.textContent
    );
    expect(blocks).toEqual([
      firstMetric.dialects!.duckdb,
      firstMetric.dialects!.postgres,
      firstMetric.dialects!.tsql,
    ]);
  });

  it("starts a query of a table from the schema browser", () => {
    renderWorkbench();
    const [table] = tables;
    fireEvent.click(
      screen.getByRole("button", { name: `Query ${table.name}` })
    );
    expect(editor().value).toBe(`SELECT *\nFROM ${table.name}\nLIMIT 100;`);
    expect(document.activeElement).toBe(editor());
    expect(
      (
        screen.getByRole("combobox", {
          name: "Saved query",
        }) as HTMLSelectElement
      ).value
    ).toBe("");
  });
});

describe("starting the engine", () => {
  it("loads the real gold tables and reports each step", async () => {
    let step: (s: string) => void = () => {};
    let finish: () => void = () => {};
    engine.start.mockImplementation((onStep: (s: string) => void) => {
      step = onStep;
      return new Promise<void>((resolve) => (finish = resolve));
    });
    renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: "Start SQL engine" }));
    expect(screen.getByText("Building the synthetic warehouse…")).toBeTruthy();
    await waitFor(() => expect(engine.loads).toHaveLength(1), {
      timeout: 10_000,
    });
    const load = engine.loads[0] as WorkbenchLoad;
    expect(load.files.map((f) => f.table)).toEqual(tables.map((t) => t.name));
    act(() => step("download"));
    expect(screen.getByText("Downloading the engine…")).toBeTruthy();
    act(() => step("lock"));
    expect(screen.getByText("Locking the database read-only…")).toBeTruthy();
    await act(async () => finish());
    expect(
      screen.getByText(
        `DuckDB v1.4.3 is running with ${tables.length} gold tables, read-only.`
      )
    ).toBeTruthy();
  });

  it("says why it did not start and offers to try again", async () => {
    engine.start.mockRejectedValueOnce(
      new Error("The engine did not start: out of memory")
    );
    renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: "Start SQL engine" }));
    expect(
      (await screen.findByRole("alert", undefined, { timeout: 10_000 }))
        .textContent
    ).toBe("The engine did not start: out of memory");
    fireEvent.click(
      screen.getByRole("button", { name: "Try starting the engine again" })
    );
    await screen.findByText(
      `DuckDB v1.4.3 is running with ${tables.length} gold tables, read-only.`,
      undefined,
      { timeout: 10_000 }
    );
  });

  it("shuts the engine down when the page closes", async () => {
    const { unmount } = renderWorkbench();
    await startEngine();
    unmount();
    expect(engine.dispose).toHaveBeenCalledTimes(1);
  });
});

describe("running queries", () => {
  it("runs the SQL and shows the rows, with NULL kept apart", async () => {
    const { container } = renderWorkbench();
    await startEngine();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run" }));
    });
    expect(engine.run).toHaveBeenCalledWith(
      queries[0].sql.trim().replace(/;\s*$/, "")
    );
    expect(screen.getByText("2 rows in 12 ms.")).toBeTruthy();
    const grid = screen.getByRole("region", { name: "Query result" });
    const cells = within(grid)
      .getAllByRole("row")
      .map((row) =>
        within(row)
          .queryAllByRole("cell")
          .map((cell) => cell.textContent)
      );
    expect(cells.slice(1)).toEqual([
      ["DEMO-301", "24", "NULL"],
      ["DEMO-302", "3", "=cmd"],
    ]);
    expect(grid.tabIndex).toBe(0);
    expect(await violations(container)).toEqual([]);
  });

  it("runs on Ctrl+Enter and on ⌘+Enter", async () => {
    renderWorkbench();
    await startEngine();
    await act(async () => {
      fireEvent.keyDown(editor(), { key: "Enter", ctrlKey: true });
    });
    await act(async () => {
      fireEvent.keyDown(editor(), { key: "Enter", metaKey: true });
    });
    await act(async () => {
      fireEvent.keyDown(editor(), { key: "Enter" });
    });
    expect(engine.run).toHaveBeenCalledTimes(2);
  });

  it("downloads the rows as CSV, safe to open in a spreadsheet", async () => {
    const blobs: Blob[] = [];
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: (blob: Blob) => {
          blobs.push(blob);
          return "blob:sql";
        },
        revokeObjectURL: () => {},
      })
    );
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      names.push(this.download);
    });
    renderWorkbench();
    await startEngine();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run" }));
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Download the rows as CSV" })
    );
    expect(names).toEqual([`${queries[0].id}.csv`]);
    expect(await blobs[0].text()).toBe(
      "study_id,subjects,note\r\nDEMO-301,24,\r\nDEMO-302,3,'=cmd\r\n"
    );
  });

  it("says when a result was cut to the row limit", async () => {
    engine.run.mockResolvedValueOnce({
      ...RESULT,
      rowCount: 12_000,
      truncated: true,
    });
    renderWorkbench();
    await startEngine();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run" }));
    });
    expect(
      screen.getByText("12,000 rows in 12 ms. The workbench kept the first 2.")
    ).toBeTruthy();
  });

  it("shows the plan without running the query", async () => {
    engine.run.mockResolvedValueOnce({
      columns: [
        { name: "explain_key", type: "Text", numeric: false },
        { name: "explain_value", type: "Text", numeric: false },
      ],
      rows: [["physical_plan", "┌───┐\n│ SCAN │"]],
      rowCount: 1,
      truncated: false,
      elapsedMs: 1,
    });
    renderWorkbench();
    await startEngine();
    fireEvent.change(editor(), { target: { value: "SELECT 1;" } });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Show the plan (EXPLAIN)" })
      );
    });
    expect(engine.run).toHaveBeenCalledWith("EXPLAIN SELECT 1");
    expect(screen.getByRole("region", { name: "Query plan" }).textContent).toBe(
      "┌───┐\n│ SCAN │"
    );
  });

  it("refuses a statement that is not a query before it reaches the engine", async () => {
    renderWorkbench();
    await startEngine();
    fireEvent.change(editor(), { target: { value: "DROP TABLE gold.x" } });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Show the plan (EXPLAIN)" })
      );
    });
    expect(engine.run).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/queries only/);
  });

  it("shows the engine's own words when a query fails", async () => {
    engine.run.mockRejectedValueOnce(
      new SqlRunError(
        "error",
        'Binder Error: Referenced column "nope" not found'
      )
    );
    renderWorkbench();
    await startEngine();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run" }));
    });
    expect(screen.getByRole("alert").textContent).toBe(
      'Binder Error: Referenced column "nope" not found'
    );
    // The engine keeps running after an ordinary failure.
    expect(
      (screen.getByRole("button", { name: "Run" }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });

  it("stops a running query, and asks for a restart when the engine was shut down", async () => {
    let fail: (error: Error) => void = () => {};
    engine.run.mockImplementationOnce(
      () => new Promise((_, reject) => (fail = reject))
    );
    renderWorkbench();
    await startEngine();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run" }));
    });
    expect(screen.getByText("Running…")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Run" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Stop the query" }));
    expect(engine.cancel).toHaveBeenCalledTimes(1);
    await act(async () =>
      fail(
        new SqlRunError(
          "stopped",
          "The engine did not stop the query, so the workbench shut it down. Start it again to keep going."
        )
      )
    );
    expect(screen.getByRole("alert").textContent).toMatch(/shut it down/);
    expect(
      screen.getByRole("button", { name: "Start SQL engine" })
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Stop the query" })).toBeNull();
  });
});

class FakeWorker {
  static last: FakeWorker | null = null;
  onmessage: ((message: MessageEvent<SqlDataResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: SqlDataRequest[] = [];
  terminated = false;
  constructor(readonly url: URL) {
    FakeWorker.last = this;
  }
  postMessage(message: SqlDataRequest) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
}

describe("createSqlDataClient", () => {
  const LOAD: WorkbenchLoad = { ddl: "", files: [], settings: [] };

  it("asks the worker, never the main thread, where Workers exist", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const client = createSqlDataClient();
    const answer = client.load();
    const worker = FakeWorker.last!;
    expect(String(worker.url)).toMatch(/sql-data\.worker\.ts/);
    expect(worker.posted).toEqual([{ id: 1, type: "load" }]);
    worker.onmessage!({
      data: { id: 1, ok: true, load: LOAD },
    } as MessageEvent<SqlDataResponse>);
    await expect(answer).resolves.toBe(LOAD);
    client.dispose();
    expect(worker.terminated).toBe(true);
  });

  it("rejects what the worker could not answer, and every request when closed", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const client = createSqlDataClient();
    const answer = client.load();
    FakeWorker.last!.onmessage!({
      data: { id: 1, ok: false, error: "no warehouse" },
    } as MessageEvent<SqlDataResponse>);
    await expect(answer).rejects.toThrow("no warehouse");
    const pending = client.load();
    client.dispose();
    await expect(pending).rejects.toThrow("The workbench was closed.");
  });

  it("rejects every request when the worker fails, and starts a new one next time", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const client = createSqlDataClient();
    const answer = client.load();
    const first = FakeWorker.last!;
    first.onerror!({
      message: "",
      preventDefault: () => {},
    } as ErrorEvent);
    await expect(answer).rejects.toThrow("The data worker failed.");
    expect(first.terminated).toBe(true);
    void client.load().catch(() => {});
    expect(FakeWorker.last).not.toBe(first);
    client.dispose();
  });
});
