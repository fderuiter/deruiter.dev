/**
 * @vitest-environment jsdom
 */

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import axe from "axe-core";
import { fromPartial } from "@total-typescript/shoehorn";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  MAX_WORKBENCH_STORAGE_BYTES,
  WORKBENCH_BUNDLE_FORMAT,
  WORKBENCH_BUNDLE_VERSION,
  buildWarehouse,
  dataContracts,
  dataProducts,
  encodeWorkbenchPermalink,
  generatePortfolio,
  parseWorkbenchBundle,
  parseWorkbenchDataset,
  workbenchQueries,
  workbenchResultParquet,
  workbenchSchema,
  type WorkbenchDatasetLoad,
  type WorkbenchResult,
} from "@/lib/clinical-platform";
import * as downloadModule from "@/lib/download";
import { DEMO_301_STUDY, runPipeline } from "@/lib/study-data";
import {
  WORKBENCH_NOTEBOOK_DB_NAME,
  createNotebookStorage,
  type LoadedNotebookWorkspace,
  type NotebookStorageClient,
  type NotebookStorageOptions,
  type NotebookWriteResult,
  type PersistedNotebookMeta,
} from "@/components/platform/sql/notebook-storage";

type Run = (sql: string) => Promise<WorkbenchResult>;

const engine = vi.hoisted(() => ({
  run: vi.fn<Run>(),
  reloadDatasets:
    vi.fn<(datasets: readonly WorkbenchDatasetLoad[]) => Promise<void>>(),
  cancel: vi.fn(),
  dispose: vi.fn(),
  start: vi.fn(),
  initialDatasets: [] as (readonly WorkbenchDatasetLoad[])[],
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
    startSqlEngine: async (
      _load: unknown,
      onStep: (step: string) => void,
      datasets: readonly WorkbenchDatasetLoad[] = []
    ) => {
      engine.initialDatasets.push(datasets);
      await engine.start(onStep);
      return {
        version: "v1.4.3",
        run: engine.run,
        reloadDatasets: engine.reloadDatasets,
        cancel: engine.cancel,
        dispose: engine.dispose,
      };
    },
  };
});

const { SqlWorkbench } = await import("@/components/platform/sql/SqlWorkbench");

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

const ROWS_RESULT: WorkbenchResult = {
  columns: [
    { name: "study_id", type: "Text", numeric: false },
    { name: "enrolled", type: "Int32", numeric: true },
  ],
  rows: [
    ["DEMO-301", "24"],
    ["DEMO-302", "12"],
  ],
  rowCount: 2,
  truncated: false,
  elapsedMs: 9.2,
};

const PLAN_RESULT: WorkbenchResult = {
  columns: [
    { name: "explain_key", type: "Text", numeric: false },
    { name: "explain_value", type: "Text", numeric: false },
  ],
  rows: [["physical_plan", "SEQ_SCAN dim_study"]],
  rowCount: 1,
  truncated: false,
  elapsedMs: 2.1,
};

async function violations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map((v) => v.id);
}

const editor = () =>
  screen.getByRole("textbox", { name: "SQL (DuckDB)" }) as HTMLTextAreaElement;

beforeEach(() => {
  window.history.replaceState(null, "", "/platform/sql");
  engine.run.mockReset().mockImplementation(async (sql: string) => {
    if (sql.startsWith("EXPLAIN ")) return PLAN_RESULT;
    return ROWS_RESULT;
  });
  engine.reloadDatasets.mockReset().mockResolvedValue(undefined);
  engine.cancel.mockReset();
  engine.dispose.mockReset();
  engine.start.mockReset().mockResolvedValue(undefined);
  engine.initialDatasets.length = 0;
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/platform/sql");
  vi.restoreAllMocks();
});

describe("IndexedDB notebook storage client", () => {
  it("persists workspace metadata and datasets in IndexedDB under the 50 MB cap", async () => {
    expect(WORKBENCH_NOTEBOOK_DB_NAME).toBe("portfolio_sql_notebook");
    const idb = new IDBFactory();
    const opts: NotebookStorageOptions = {
      indexedDB: idb,
      maxBytes: 4_096,
    };
    const client: NotebookStorageClient = createNotebookStorage(opts);

    const parsed = parseWorkbenchDataset({
      fileName: "sites.csv",
      bytes: new TextEncoder().encode("site_id,active\nSITE-01,true\n"),
      id: "ds-1",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const putOk: NotebookWriteResult = await client.putDataset(parsed.dataset);
    expect(putOk.ok).toBe(true);
    if (putOk.ok) expect(putOk.backend).toBe("indexeddb");

    const meta: PersistedNotebookMeta = {
      activeTabId: "tab-1",
      tabs: [
        {
          id: "tab-1",
          title: "Site check",
          sql: "SELECT * FROM uploads.sites",
          selectedQueryId: "",
          edited: true,
          updatedAt: "2026-10-01T00:00:00.000Z",
        },
      ],
      namedQueries: [
        {
          id: "saved-1",
          title: "Saved sites",
          sql: "SELECT * FROM uploads.sites",
          savedAt: "2026-10-01T00:00:00.000Z",
        },
      ],
      executionLog: [],
      updatedAt: "2026-10-01T00:00:00.000Z",
    };
    const metaWrite = await client.saveMeta(meta);
    expect(metaWrite.ok).toBe(true);

    // A fresh client reading the same IDBFactory restores everything.
    const reloadedClient = createNotebookStorage(opts);
    const snapshot: LoadedNotebookWorkspace = await reloadedClient.load();
    expect(snapshot.backend).toBe("indexeddb");
    expect(snapshot.maxBytes).toBe(4_096);
    expect(snapshot.meta?.tabs[0].sql).toBe("SELECT * FROM uploads.sites");
    expect(snapshot.datasets).toHaveLength(1);
    expect(snapshot.datasets[0].qualifiedName).toBe("uploads.sites");

    // Exceeding the cap fails closed without corrupting existing data.
    const bigCsv = `k,v\n${"a,1234567890\n".repeat(400)}`;
    const bigParsed = parseWorkbenchDataset({
      fileName: "too_large.csv",
      bytes: new TextEncoder().encode(bigCsv),
      id: "ds-big",
    });
    expect(bigParsed.ok).toBe(true);
    if (!bigParsed.ok) return;

    const rejected = await reloadedClient.putDataset(bigParsed.dataset);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.code).toBe("QUOTA_EXCEEDED");
    }

    // Evicting the dataset frees the bytes.
    const afterRemove = await reloadedClient.removeDataset("ds-1");
    expect(afterRemove.backend).toBe("indexeddb");
    const afterReload = await createNotebookStorage(opts).load();
    expect(afterReload.datasets).toHaveLength(0);
  });

  it("falls back automatically to in-memory storage when IndexedDB is missing or blocked", async () => {
    const missing = createNotebookStorage({ indexedDB: null });
    const loadedMissing = await missing.load();
    expect(loadedMissing.backend).toBe("memory");
    expect(loadedMissing.maxBytes).toBe(MAX_WORKBENCH_STORAGE_BYTES);

    const blockedFactory = fromPartial<IDBFactory>({
      open: () => {
        const req = fromPartial<IDBOpenDBRequest>({});
        queueMicrotask(() => {
          req.onblocked?.(fromPartial<IDBVersionChangeEvent>({}));
        });
        return req;
      },
    });

    const blocked = createNotebookStorage({ indexedDB: blockedFactory });
    const write = await blocked.saveMeta({
      activeTabId: "tab-1",
      tabs: [
        {
          id: "tab-1",
          title: "Fallback",
          sql: "SELECT 1",
          selectedQueryId: "",
          edited: false,
          updatedAt: "2026-10-01T00:00:00.000Z",
        },
      ],
      namedQueries: [],
      executionLog: [],
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    expect(write.ok).toBe(true);
    if (write.ok) expect(write.backend).toBe("memory");
    const fallbackLoaded = await blocked.load();
    expect(fallbackLoaded.backend).toBe("memory");
    expect(fallbackLoaded.meta?.tabs[0].title).toBe("Fallback");
  });
});

describe("multi-tab SQL notebook UI and IndexedDB persistence", () => {
  it("creates, renames, switches and closes tabs, saves named queries, logs runs, and persists across reloads", async () => {
    const idb = new IDBFactory();
    const firstRender = render(
      <SqlWorkbench
        tables={tables}
        queries={queries}
        storageOptions={{ indexedDB: idb }}
      />
    );

    await screen.findByText(/Saved locally in IndexedDB/);

    // Edit Tab 1 and rename it.
    fireEvent.change(screen.getByLabelText("Active tab name"), {
      target: { value: "Study audit" },
    });
    fireEvent.change(editor(), {
      target: { value: "SELECT study_id FROM gold.dim_study;" },
    });

    // Save as a named query in this browser.
    fireEvent.click(screen.getByRole("button", { name: "Save query" }));
    await screen.findByText(
      'Saved "Study audit" to this browser\'s query library.'
    );
    expect(screen.getByText("Saved query library (1)")).toBeTruthy();

    // Add a second tab, rename it, and switch between tabs without losing SQL.
    fireEvent.click(screen.getByRole("button", { name: "+ New tab" }));
    expect(screen.getByLabelText("Active tab name")).toHaveProperty(
      "value",
      "Tab 2"
    );
    fireEvent.change(editor(), {
      target: { value: "SELECT count(*) AS sites FROM gold.dim_site;" },
    });

    const tabBar = screen.getByRole("group", { name: "Notebook tabs" });
    fireEvent.click(
      within(tabBar).getByRole("button", { name: /Study audit/ })
    );
    expect(editor().value).toBe("SELECT study_id FROM gold.dim_study;");

    // Start the engine and run both a query and EXPLAIN so both log entries persist.
    fireEvent.click(screen.getByRole("button", { name: "Start SQL engine" }));
    await screen.findByText(
      `DuckDB v1.4.3 is running with ${tables.length} gold tables, read-only.`,
      undefined,
      { timeout: 10_000 }
    );
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await screen.findByRole(
      "region",
      { name: "Query result" },
      { timeout: 10_000 }
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Show the plan (EXPLAIN)" })
    );
    await screen.findByRole(
      "region",
      { name: "Query plan" },
      { timeout: 10_000 }
    );
    expect(screen.getByText("Run history (2 entries)")).toBeTruthy();

    // Accessibility check with multiple tabs, saved query library and execution log open.
    expect(await violations(firstRender.container)).toEqual([]);

    // Wait for debounced/effect IndexedDB writes to settle, then unmount and remount.
    await waitFor(
      async () => {
        const snap = await createNotebookStorage({ indexedDB: idb }).load();
        expect(snap.meta?.tabs).toHaveLength(2);
        expect(snap.meta?.namedQueries).toHaveLength(1);
        expect(snap.meta?.executionLog).toHaveLength(2);
      },
      { timeout: 10_000 }
    );
    firstRender.unmount();

    // Remount against the same IndexedDB: tabs, SQL, saved queries and execution log restore.
    render(
      <SqlWorkbench
        tables={tables}
        queries={queries}
        storageOptions={{ indexedDB: idb }}
      />
    );
    await screen.findByText("Saved query library (1)", undefined, {
      timeout: 10_000,
    });
    expect(screen.getByText("Run history (2 entries)")).toBeTruthy();
    expect(editor().value).toBe("SELECT study_id FROM gold.dim_study;");

    // Switch to Tab 2 and close it.
    const remountedBar = screen.getByRole("group", { name: "Notebook tabs" });
    fireEvent.click(
      within(remountedBar).getByRole("button", { name: /Tab 2/ })
    );
    expect(editor().value).toBe("SELECT count(*) AS sites FROM gold.dim_site;");
    fireEvent.click(screen.getByRole("button", { name: "Close tab" }));
    expect(editor().value).toBe("SELECT study_id FROM gold.dim_study;");
  });

  it("opens presets and schema table queries in a new tab without overwriting unsaved edits", async () => {
    const idb = new IDBFactory();
    render(
      <SqlWorkbench
        tables={tables}
        queries={queries}
        storageOptions={{ indexedDB: idb }}
      />
    );
    await screen.findByText(/Saved locally in IndexedDB/);

    const customSql =
      "SELECT study_id, study_title FROM gold.dim_study -- draft";
    fireEvent.change(editor(), { target: { value: customSql } });

    // Selecting a preset query opens a second tab rather than clobbering the draft.
    fireEvent.change(screen.getByRole("combobox", { name: "Saved query" }), {
      target: { value: queries[1].id },
    });
    expect(editor().value).toBe(queries[1].sql);

    // Edit the second tab too, then click `Query gold.dim_study` -> opens a third tab.
    fireEvent.change(editor(), {
      target: { value: `${queries[1].sql}\n-- edited` },
    });
    fireEvent.click(
      screen.getByRole("button", { name: `Query ${tables[0].name}` })
    );
    expect(editor().value).toBe(`SELECT *\nFROM ${tables[0].name}\nLIMIT 100;`);

    // Switching back to the first tab finds the unsaved draft intact.
    const tabBar = screen.getByRole("group", { name: "Notebook tabs" });
    const tabButtons = within(tabBar).getAllByRole("button");
    fireEvent.click(tabButtons[0]);
    expect(editor().value).toBe(customSql);
  });

  it("uploads CSV, JSON and Parquet datasets into uploads.*, enforces quota and evicts datasets", async () => {
    const idb = new IDBFactory();
    const { container } = render(
      <SqlWorkbench
        tables={tables}
        queries={queries}
        storageOptions={{ indexedDB: idb, maxBytes: 8_192 }}
      />
    );
    await screen.findByText(/Saved locally in IndexedDB/);

    // Start the engine first so uploads also exercise live reloadDatasets.
    fireEvent.click(screen.getByRole("button", { name: "Start SQL engine" }));
    await screen.findByText(
      `DuckDB v1.4.3 is running with ${tables.length} gold tables, read-only.`,
      undefined,
      { timeout: 10_000 }
    );

    const input = screen.getByTestId(
      "upload-dataset-input"
    ) as HTMLInputElement;

    // 1. Upload CSV
    const csvFile = new File(
      ["study_id,monitor\nDEMO-301,Alice\n"],
      "monitors.csv",
      { type: "text/csv" }
    );
    fireEvent.change(input, { target: { files: [csvFile] } });
    await screen.findByText("uploads.monitors", undefined, { timeout: 10_000 });
    expect(engine.reloadDatasets).toHaveBeenCalledTimes(1);

    // 2. Upload JSON
    const jsonFile = new File(
      [JSON.stringify([{ study_id: "DEMO-301", budget_tier: 2 }])],
      "tiers.json",
      { type: "application/json" }
    );
    fireEvent.change(input, { target: { files: [jsonFile] } });
    await screen.findByText("uploads.tiers", undefined, { timeout: 10_000 });

    // 3. Upload Parquet
    const parquetBytes = workbenchResultParquet(ROWS_RESULT);
    const parquetFile = new File(
      [new Uint8Array(parquetBytes)],
      "snapshot.parquet",
      { type: "application/vnd.apache.parquet" }
    );
    fireEvent.change(input, { target: { files: [parquetFile] } });
    await screen.findByText("uploads.snapshot", undefined, { timeout: 10_000 });

    expect(
      screen.getByText(
        `DuckDB v1.4.3 is running with ${tables.length} gold tables, read-only. 3 uploaded in uploads.*.`
      )
    ).toBeTruthy();

    // Clicking Query uploads.monitors opens a query tab for the uploaded table.
    fireEvent.click(
      screen.getByRole("button", { name: "Query uploads.monitors" })
    );
    expect(editor().value).toBe("SELECT *\nFROM uploads.monitors\nLIMIT 100;");

    // Uploading a file that pushes workspace storage past the 8 KB test cap fails with alert.
    const oversizeFile = new File(
      [`k,v\n${"row,12345678901234567890\n".repeat(400)}`],
      "overflow.csv",
      { type: "text/csv" }
    );
    fireEvent.change(input, { target: { files: [oversizeFile] } });
    const quotaAlert = await screen.findByRole("alert", undefined, {
      timeout: 10_000,
    });
    expect(quotaAlert.textContent).toMatch(/Remove an uploaded dataset/);

    // Evicting uploads.snapshot removes it from UI and reloads engine datasets.
    fireEvent.click(
      screen.getByRole("button", { name: "Remove uploads.snapshot" })
    );
    await waitFor(
      () => expect(screen.queryByText("uploads.snapshot")).toBeNull(),
      { timeout: 10_000 }
    );
    expect(await violations(container)).toEqual([]);
  });

  it("exports and imports .sql.json bundles, shares #sql=... links without auto-running, and exports CSV/JSON/Parquet results", async () => {
    const downloads: { data: unknown; filename: string; mime?: string }[] = [];
    vi.spyOn(downloadModule, "downloadFile").mockImplementation(
      (data, filename, opts) => {
        downloads.push({ data, filename, mime: opts?.mimeType });
        return true;
      }
    );

    // Load with a valid #sql=... permalink in the URL: opens the shared tab, never auto-runs.
    const hash = encodeWorkbenchPermalink({
      sql: "SELECT study_id FROM gold.dim_study WHERE study_id = 'DEMO-301'",
      title: "Shared study filter",
    });
    window.history.replaceState(null, "", `/platform/sql#${hash}`);

    const idb = new IDBFactory();
    const view = render(
      <SqlWorkbench
        tables={tables}
        queries={queries}
        storageOptions={{ indexedDB: idb }}
      />
    );

    expect(editor().value).toBe(
      "SELECT study_id FROM gold.dim_study WHERE study_id = 'DEMO-301'"
    );
    expect(engine.run).not.toHaveBeenCalled();

    // Start engine, run query, and export CSV, JSON and Parquet results.
    fireEvent.click(screen.getByRole("button", { name: "Start SQL engine" }));
    await screen.findByText(
      `DuckDB v1.4.3 is running with ${tables.length} gold tables, read-only.`,
      undefined,
      { timeout: 10_000 }
    );
    expect(engine.run).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await screen.findByRole(
      "region",
      { name: "Query result" },
      { timeout: 10_000 }
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Download the rows as CSV" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Download the rows as JSON" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Download the rows as Parquet" })
    );
    expect(downloads.map((d) => d.filename)).toEqual([
      "Shared_study_filter.csv",
      "Shared_study_filter.json",
      "Shared_study_filter.parquet",
    ]);
    expect(downloads[2].data).toBeInstanceOf(Uint8Array);

    // Export .sql.json notebook bundle.
    fireEvent.click(
      screen.getByRole("button", { name: "Export notebook (.sql.json)" })
    );
    const bundleDownload = downloads.at(-1)!;
    expect(bundleDownload.filename).toBe("Shared_study_filter.sql.json");
    const parsedBundle = parseWorkbenchBundle(String(bundleDownload.data));
    expect(parsedBundle.ok).toBe(true);

    // Refuse a malicious .sql.json bundle containing DROP TABLE.
    const bundleInput = screen.getByTestId(
      "import-bundle-input"
    ) as HTMLInputElement;
    const badBundle = new File(
      [
        JSON.stringify({
          format: WORKBENCH_BUNDLE_FORMAT,
          version: WORKBENCH_BUNDLE_VERSION,
          exportedAt: "2026-10-01T00:00:00.000Z",
          activeTabId: "evil",
          tabs: [
            {
              id: "evil",
              title: "Drop",
              sql: "DROP TABLE gold.dim_study",
            },
          ],
        }),
      ],
      "bad.sql.json",
      { type: "application/json" }
    );
    fireEvent.change(bundleInput, { target: { files: [badBundle] } });
    const bundleAlert = await screen.findByRole("alert", undefined, {
      timeout: 10_000,
    });
    expect(bundleAlert.textContent).toMatch(/DROP changes data/);

    // Import a valid .sql.json bundle: restores tabs without auto-running.
    engine.run.mockClear();
    const goodBundle = new File(
      [
        JSON.stringify({
          format: WORKBENCH_BUNDLE_FORMAT,
          version: WORKBENCH_BUNDLE_VERSION,
          exportedAt: "2026-10-01T00:00:00.000Z",
          activeTabId: "imported-1",
          tabs: [
            {
              id: "imported-1",
              title: "Imported sites",
              sql: "SELECT site_id FROM gold.dim_site",
            },
          ],
          namedQueries: [
            {
              id: "imported-named",
              title: "Named site query",
              sql: "SELECT site_id FROM gold.dim_site",
              savedAt: "2026-10-01T00:00:00.000Z",
            },
          ],
        }),
      ],
      "team.sql.json",
      { type: "application/json" }
    );
    fireEvent.change(bundleInput, { target: { files: [goodBundle] } });
    await screen.findByText(/Imported 1 tab from team\.sql\.json/, undefined, {
      timeout: 10_000,
    });
    expect(editor().value).toBe("SELECT site_id FROM gold.dim_site");
    expect(engine.run).not.toHaveBeenCalled();

    view.unmount();

    // Navigating with a forbidden #sql=... hash renders an alert and keeps default starter SQL.
    window.history.replaceState(
      null,
      "",
      "/platform/sql#sql=DROP+TABLE+gold.dim_study"
    );
    render(
      <SqlWorkbench
        tables={tables}
        queries={queries}
        storageOptions={{ indexedDB: null }}
      />
    );
    expect(screen.getByRole("alert").textContent).toMatch(
      /The #sql link was refused/
    );
    expect(editor().value).toBe(queries[0].sql);
    expect(await screen.findByText(/In-memory session fallback/)).toBeTruthy();
  });
});
