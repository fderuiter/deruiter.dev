"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { copyToClipboard, getActiveHostUrl } from "@/lib/clipboard";
import {
  MAX_WORKBENCH_STORAGE_BYTES,
  checkWorkbenchSql,
  decodeWorkbenchPermalink,
  encodeWorkbenchPermalink,
  mergeWorkbenchHydratedDatasets,
  parseWorkbenchBundle,
  parseWorkbenchDataset,
  serializeWorkbenchBundle,
  workbenchDatasetLoad,
  workbenchDatasetTable,
  workbenchResultCsv,
  workbenchResultJson,
  workbenchResultParquet,
  type SqlDialect,
  type WorkbenchExecutionLogEntry,
  type WorkbenchExportFormat,
  type WorkbenchNamedQuery,
  type WorkbenchNotebookTab,
  type WorkbenchQuery,
  type WorkbenchResult,
  type WorkbenchTable,
  type WorkbenchUploadedDataset,
} from "@/lib/clinical-platform";
import { downloadFile, sanitizeFilename } from "@/lib/download";
import {
  createNotebookStorage,
  type NotebookStorageBackend,
  type NotebookStorageOptions,
} from "./notebook-storage";
import { createSqlDataClient } from "./sql-data-client";
import type { SqlEngine, SqlEngineStep, SqlRunFailure } from "./sql-engine";

/** Rows the grid draws; exported files carry every row the result kept. */
const GRID_ROWS = 500;

/** Maximum execution log entries kept in browser storage. */
const MAX_EXECUTION_LOG = 200;

const control =
  "min-h-12 w-full min-w-0 border border-white/[0.12] bg-[#13151a] px-3 text-sm text-slate-100 focus-visible:outline-2 focus-visible:outline-amber-400";

const button =
  "inline-flex items-center justify-center border border-white/[0.12] bg-[#13151a] px-3 text-sm text-slate-100 hover:border-amber-400/60 focus-visible:outline-2 focus-visible:outline-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

const section =
  "@container min-w-0 border border-white/[0.08] bg-[#0d0e11] p-4 sm:p-6";

const DIALECT_LABELS: Record<SqlDialect, string> = {
  duckdb: "DuckDB",
  postgres: "PostgreSQL",
  tsql: "T-SQL (SQL Server)",
};

const STEP_TEXT: Record<SqlEngineStep, string> = {
  download: "Downloading the engine…",
  load: "Loading the gold tables…",
  lock: "Locking the database read-only…",
};

const number = new Intl.NumberFormat("en-US");

type EngineState =
  | { readonly status: "idle" }
  | { readonly status: "starting"; readonly step: SqlEngineStep | "data" }
  | { readonly status: "ready"; readonly version: string }
  | { readonly status: "failed"; readonly message: string };

type Outcome =
  | { readonly kind: "rows"; readonly result: WorkbenchResult }
  | { readonly kind: "plan"; readonly plan: string }
  | {
      readonly kind: "failed";
      readonly failure: SqlRunFailure;
      readonly message: string;
    };

const hashListeners = new Set<() => void>();

function subscribeHash(listener: () => void): () => void {
  hashListeners.add(listener);
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  return () => {
    hashListeners.delete(listener);
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("popstate", listener);
  };
}

const clientHash = () => window.location.hash;
const serverHash = () => "";

function isPermalinkHash(hash: string): boolean {
  return hash.replace(/^#/, "").includes("=");
}

function writeUrlHash(encoded: string): void {
  const url = encoded
    ? `${window.location.pathname}${window.location.search}#${encoded}`
    : `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", url);
  for (const listener of hashListeners) listener();
}

function makeId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readBlobBytes(file: Blob): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer().then((buf) => new Uint8Array(buf));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () =>
      reject(new Error("Could not read the selected file."));
    reader.readAsArrayBuffer(file);
  });
}

function readBlobText(file: Blob): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }
  return readBlobBytes(file).then((bytes) => new TextDecoder().decode(bytes));
}

/** The plan text from an EXPLAIN result's `explain_value` column. */
function planText(result: WorkbenchResult): string {
  const at = result.columns.findIndex((c) => c.name === "explain_value");
  if (at === -1) return result.rows.map((row) => row.join(" ")).join("\n");
  return result.rows.map((row) => row[at] ?? "").join("\n");
}

function failureOf(error: unknown): Outcome {
  const failure =
    error instanceof Error &&
    "failure" in error &&
    typeof error.failure === "string"
      ? (error.failure as SqlRunFailure)
      : "error";
  return {
    kind: "failed",
    failure,
    message: error instanceof Error ? error.message : String(error),
  };
}

function resultSummary(result: WorkbenchResult): string {
  const ms = `${number.format(Math.round(result.elapsedMs))} ms`;
  if (result.rowCount === 0) return `The query returned no rows (${ms}).`;
  const rows = `${number.format(result.rowCount)} ${result.rowCount === 1 ? "row" : "rows"}`;
  if (result.truncated) {
    return `${rows} in ${ms}. The workbench kept the first ${number.format(result.rows.length)}.`;
  }
  return `${rows} in ${ms}.`;
}

function defaultStarterTab(
  queries: readonly WorkbenchQuery[]
): WorkbenchNotebookTab {
  const first = queries[0];
  return {
    id: "tab-1",
    title: first?.title ?? "Query 1",
    sql: first?.sql ?? "",
    selectedQueryId: first?.id ?? "",
    edited: false,
    updatedAt: new Date().toISOString(),
  };
}

function mergePermalinkIntoTabs(
  existingTabs: readonly WorkbenchNotebookTab[],
  permalink: { readonly sql: string; readonly title: string | null },
  presets: readonly WorkbenchQuery[]
): { tabs: WorkbenchNotebookTab[]; activeTabId: string } {
  const matchedExisting = existingTabs.find(
    (tab) => tab.sql.trim() === permalink.sql.trim()
  );
  if (matchedExisting) {
    return { tabs: [...existingTabs], activeTabId: matchedExisting.id };
  }
  const matchedPreset = presets.find(
    (q) => q.sql.trim() === permalink.sql.trim()
  );
  const created: WorkbenchNotebookTab = {
    id: makeId("tab"),
    title: permalink.title ?? matchedPreset?.title ?? "Shared query",
    sql: permalink.sql,
    selectedQueryId: matchedPreset?.id ?? "",
    edited: false,
    updatedAt: new Date().toISOString(),
  };
  return {
    tabs: [...existingTabs, created],
    activeTabId: created.id,
  };
}

function ResultGrid({ result }: { result: WorkbenchResult }) {
  const shown = result.rows.slice(0, GRID_ROWS);
  if (result.columns.length === 0) return null;
  return (
    <div
      role="region"
      aria-label="Query result"
      tabIndex={0}
      className="max-h-[32rem] min-w-0 overflow-auto border border-white/[0.08] focus-visible:outline-2 focus-visible:outline-amber-400"
    >
      <table className="min-w-full border-collapse text-left text-xs">
        <caption className="sr-only">
          {`Query result: ${shown.length} of ${result.rowCount} rows shown`}
        </caption>
        <thead className="sticky top-0 bg-[#13151a]">
          <tr>
            {result.columns.map((column, at) => (
              <th
                key={`${column.name}-${at}`}
                scope="col"
                className={`border-b border-white/[0.08] px-3 py-2 align-bottom font-medium text-slate-200 ${column.numeric ? "text-right" : ""}`}
              >
                <span className="block whitespace-nowrap font-mono">
                  {column.name}
                </span>
                <span className="block whitespace-nowrap font-mono text-[11px] font-normal text-slate-400">
                  {column.type}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, index) => (
            <tr key={index} className="odd:bg-white/[0.02]">
              {row.map((value, at) => (
                <td
                  key={at}
                  className={`whitespace-nowrap border-b border-white/[0.04] px-3 py-1.5 font-mono ${result.columns[at]?.numeric ? "text-right tabular-nums" : ""} ${value === null ? "text-slate-500" : "text-slate-100"}`}
                >
                  {value ?? "NULL"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchemaBrowser({
  tables,
  uploadedDatasets,
  onQuery,
}: {
  tables: readonly WorkbenchTable[];
  uploadedDatasets: readonly WorkbenchUploadedDataset[];
  onQuery: (table: WorkbenchTable) => void;
}) {
  const hydratedUploads = uploadedDatasets
    .filter((dataset) => dataset.rowCount !== null)
    .map((dataset) => ({
      fileName: dataset.fileName,
      table: workbenchDatasetTable(dataset),
    }));

  return (
    <section aria-labelledby="sql-schema" className={section}>
      <h2 id="sql-schema" className="text-xl font-semibold tracking-[-0.02em]">
        Schema
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">
        The gold layer the engine loads: every table and column with the
        description, owner and classification its data contract records.
      </p>
      <ul className="mt-4 space-y-2">
        {tables.map((table) => (
          <li key={table.name}>
            <details className="group border border-white/[0.08] bg-[#13151a]">
              <summary className="flex min-h-12 min-w-0 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-amber-400">
                <span className="min-w-0 break-all font-mono text-slate-100">
                  {table.name}
                </span>
                <span className="font-mono text-xs text-slate-400">
                  {`${table.kind} · ${number.format(table.rowCount)} rows`}
                </span>
              </summary>
              <div className="space-y-3 border-t border-white/[0.06] px-3 py-3 text-sm">
                <p className="leading-relaxed text-slate-300">
                  {table.description}
                </p>
                <dl className="grid gap-x-4 gap-y-1 text-xs @sm:grid-cols-[auto_1fr]">
                  <dt className="text-slate-400">Grain</dt>
                  <dd className="min-w-0 break-words text-slate-200">
                    {table.grain}
                  </dd>
                  <dt className="text-slate-400">Primary key</dt>
                  <dd className="min-w-0 break-words font-mono text-slate-200">
                    {table.primaryKey.join(", ")}
                  </dd>
                  <dt className="text-slate-400">Owner, steward</dt>
                  <dd className="min-w-0 break-words text-slate-200">
                    {`${table.owner}; ${table.steward}`}
                  </dd>
                  <dt className="text-slate-400">Classification</dt>
                  <dd className="min-w-0 break-words text-slate-200">
                    {`${table.classification}${table.personalHealthData ? ", describes study subjects (synthetic)" : ""}`}
                  </dd>
                  <dt className="text-slate-400">Contract</dt>
                  <dd className="font-mono text-slate-200">
                    {`v${table.contractVersion}`}
                  </dd>
                </dl>
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">{`Columns of ${table.name}`}</caption>
                  <thead>
                    <tr className="text-slate-400">
                      <th scope="col" className="py-1 pr-3 font-normal">
                        Column
                      </th>
                      <th scope="col" className="py-1 font-normal">
                        Type and meaning
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.columns.map((column) => (
                      <tr
                        key={column.name}
                        className="border-t border-white/[0.04] align-top"
                      >
                        <th
                          scope="row"
                          className="break-all py-1.5 pr-3 font-mono font-normal text-slate-100"
                        >
                          {column.name}
                        </th>
                        <td className="min-w-0 py-1.5 text-slate-300">
                          <span className="font-mono text-slate-400">
                            {`${column.type}${column.nullable ? "" : ", not null"} · ${column.classification}`}
                          </span>
                          <span className="block break-words leading-relaxed">
                            {column.description}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  type="button"
                  className={`${button} min-h-12`}
                  onClick={() => onQuery(table)}
                >
                  {`Query ${table.name}`}
                </button>
              </div>
            </details>
          </li>
        ))}
      </ul>
      {hydratedUploads.length > 0 && (
        <div className="mt-5 border-t border-white/[0.08] pt-4">
          <h3 className="text-xs font-medium tracking-wide text-slate-300 uppercase">
            Uploaded in this browser (uploads.*)
          </h3>
          <ul className="mt-2 space-y-2">
            {hydratedUploads.map(({ fileName, table }) => (
              <li key={table.name}>
                <details className="group border border-white/[0.08] bg-[#13151a]">
                  <summary className="flex min-h-12 min-w-0 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-amber-400">
                    <span className="min-w-0 break-all font-mono text-slate-100">
                      {`${table.name} (${fileName})`}
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      {`upload · ${number.format(table.rowCount)} ${table.rowCount === 1 ? "row" : "rows"}`}
                    </span>
                  </summary>
                  <div className="space-y-3 border-t border-white/[0.06] px-3 py-3 text-sm">
                    <p className="leading-relaxed text-slate-300">
                      {table.description}
                    </p>
                    <table className="w-full text-left text-xs">
                      <caption className="sr-only">{`Columns of ${table.name}`}</caption>
                      <thead>
                        <tr className="text-slate-400">
                          <th scope="col" className="py-1 pr-3 font-normal">
                            Column
                          </th>
                          <th scope="col" className="py-1 font-normal">
                            Type and meaning
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.columns.map((column) => (
                          <tr
                            key={column.name}
                            className="border-t border-white/[0.04] align-top"
                          >
                            <th
                              scope="row"
                              className="break-all py-1.5 pr-3 font-mono font-normal text-slate-100"
                            >
                              {column.name}
                            </th>
                            <td className="min-w-0 py-1.5 text-slate-300">
                              <span className="font-mono text-slate-400">
                                {`${column.type}${column.nullable ? "" : ", not null"} · ${column.classification}`}
                              </span>
                              <span className="block break-words leading-relaxed">
                                {column.description}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Dialects({ query }: { query: WorkbenchQuery }) {
  if (!query.dialects) return null;
  const dialects = query.dialects;
  return (
    <details className="mt-4 border border-white/[0.08] bg-[#13151a]">
      <summary className="flex min-h-12 cursor-pointer items-center px-3 text-sm text-slate-200 focus-visible:outline-2 focus-visible:outline-amber-400">
        Compare the same metric in DuckDB, PostgreSQL and T-SQL
      </summary>
      <div className="grid gap-3 border-t border-white/[0.06] p-3 @3xl:grid-cols-3">
        {(Object.keys(DIALECT_LABELS) as SqlDialect[]).map((dialect) => (
          <figure key={dialect} className="min-w-0">
            <figcaption className="text-xs font-medium text-slate-300">
              {DIALECT_LABELS[dialect]}
              {dialect === "duckdb" && (
                <span className="font-normal text-slate-400">
                  {" "}
                  (the one the workbench runs)
                </span>
              )}
            </figcaption>
            <pre
              tabIndex={0}
              aria-label={`${DIALECT_LABELS[dialect]} SQL`}
              className="mt-1 max-h-80 overflow-auto border border-white/[0.06] bg-[#0d0e11] p-2 font-mono text-[11px] leading-relaxed text-slate-200 focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              {dialects[dialect]}
            </pre>
          </figure>
        ))}
      </div>
    </details>
  );
}

/**
 * The `/platform/sql` multi-tab notebook workspace: a persistent tab bar, saved
 * query library, timestamped execution log, local dataset manager (`uploads.*`),
 * `.sql.json` bundle import/export, `#sql=...` permalinks, and read-only
 * DuckDB-WASM execution over `gold.*` and `uploads.*` tables.
 */
export function SqlWorkbench({
  tables,
  queries,
  storageOptions,
}: {
  tables: readonly WorkbenchTable[];
  queries: readonly WorkbenchQuery[];
  storageOptions?: NotebookStorageOptions;
}) {
  const ids = useId();
  const [storage] = useState(() => createNotebookStorage(storageOptions));
  const [data] = useState(createSqlDataClient);

  const hash = useSyncExternalStore(subscribeHash, clientHash, serverHash);
  const decodedHash = useMemo(() => {
    if (!isPermalinkHash(hash)) return null;
    return decodeWorkbenchPermalink(hash);
  }, [hash]);

  const [initialNotebook] = useState(() => {
    const starter = defaultStarterTab(queries);
    if (
      typeof window !== "undefined" &&
      isPermalinkHash(window.location.hash)
    ) {
      const initial = decodeWorkbenchPermalink(window.location.hash);
      if (initial.ok) {
        return mergePermalinkIntoTabs([starter], initial.permalink, queries);
      }
    }
    return { tabs: [starter], activeTabId: starter.id };
  });

  const [tabs, setTabs] = useState<WorkbenchNotebookTab[]>(
    initialNotebook.tabs
  );
  const [activeTabId, setActiveTabId] = useState<string>(
    initialNotebook.activeTabId
  );

  const [namedQueries, setNamedQueries] = useState<WorkbenchNamedQuery[]>([]);
  const [executionLog, setExecutionLog] = useState<
    WorkbenchExecutionLogEntry[]
  >([]);
  const [datasets, setDatasets] = useState<WorkbenchUploadedDataset[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [hydrated, setHydrated] = useState(false);

  const [storageInfo, setStorageInfo] = useState<{
    backend: NotebookStorageBackend;
    bytesUsed: number;
    maxBytes: number;
  }>({
    backend: "indexeddb",
    bytesUsed: 0,
    maxBytes: storageOptions?.maxBytes ?? MAX_WORKBENCH_STORAGE_BYTES,
  });

  const [engineState, setEngineState] = useState<EngineState>({
    status: "idle",
  });
  const [running, setRunning] = useState(false);
  const [workspaceNotice, setWorkspaceNotice] = useState<{
    kind: "info" | "error";
    text: string;
  } | null>(null);
  const [datasetError, setDatasetError] = useState<string | null>(null);

  const engine = useRef<SqlEngine | null>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const bundleInput = useRef<HTMLInputElement>(null);
  const datasetInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const touchedBeforeHydration = useRef(false);
  const datasetsTouchedBeforeHydration = useRef(false);
  const datasetsRef = useRef<readonly WorkbenchUploadedDataset[]>([]);

  useEffect(() => {
    datasetsRef.current = datasets;
  }, [datasets]);

  const activeTab =
    tabs.find((tab) => tab.id === activeTabId) ??
    tabs[0] ??
    defaultStarterTab(queries);
  const activeOutcome = outcomes[activeTab.id] ?? null;

  const selectedPreset =
    queries.find((query) => query.id === activeTab.selectedQueryId) ?? null;
  const examples = queries.filter((query) => query.kind === "example");
  const metrics = queries.filter((query) => query.kind === "metric");

  const openOrFocusQueryTab = useCallback(
    (spec: {
      title: string;
      sql: string;
      selectedQueryId: string;
      focusEditor?: boolean;
    }) => {
      touchedBeforeHydration.current = true;
      setTabs((prevTabs) => {
        const current =
          prevTabs.find((t) => t.id === activeTabId) ?? prevTabs[0];
        if (spec.selectedQueryId !== "") {
          const existingClean = prevTabs.find(
            (t) => t.selectedQueryId === spec.selectedQueryId && !t.edited
          );
          if (existingClean) {
            setActiveTabId(existingClean.id);
            return prevTabs;
          }
        }
        if (current && !current.edited && current.sql.trim() === "") {
          const updated: WorkbenchNotebookTab = {
            ...current,
            title: spec.title,
            sql: spec.sql,
            selectedQueryId: spec.selectedQueryId,
            edited: false,
            updatedAt: new Date().toISOString(),
          };
          setActiveTabId(updated.id);
          return prevTabs.map((t) => (t.id === updated.id ? updated : t));
        }
        const nextTab: WorkbenchNotebookTab = {
          id: makeId("tab"),
          title: spec.title,
          sql: spec.sql,
          selectedQueryId: spec.selectedQueryId,
          edited: false,
          updatedAt: new Date().toISOString(),
        };
        setActiveTabId(nextTab.id);
        return [...prevTabs, nextTab];
      });
      if (spec.focusEditor) {
        editor.current?.focus();
      }
    },
    [activeTabId]
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      engine.current?.dispose();
      engine.current = null;
      data.dispose();
    };
  }, [data]);

  useEffect(() => {
    let live = true;
    void storage.load().then((loaded) => {
      if (!live) return;
      const loadedDatasets = loaded.datasets ? [...loaded.datasets] : [];
      if (!datasetsTouchedBeforeHydration.current) {
        datasetsRef.current = loadedDatasets;
        setDatasets(loadedDatasets);
        setStorageInfo({
          backend: loaded.backend,
          bytesUsed: loaded.bytesUsed,
          maxBytes: loaded.maxBytes,
        });
      }
      if (loaded.meta && !touchedBeforeHydration.current) {
        let nextTabs = [...loaded.meta.tabs];
        let nextActiveId = loaded.meta.activeTabId;
        if (
          typeof window !== "undefined" &&
          isPermalinkHash(window.location.hash)
        ) {
          const link = decodeWorkbenchPermalink(window.location.hash);
          if (link.ok) {
            const merged = mergePermalinkIntoTabs(
              nextTabs,
              link.permalink,
              queries
            );
            nextTabs = merged.tabs;
            nextActiveId = merged.activeTabId;
          }
        }
        setTabs(nextTabs);
        setActiveTabId(nextActiveId);
        setNamedQueries([...loaded.meta.namedQueries]);
        setExecutionLog([...loaded.meta.executionLog]);
      }
      setHydrated(true);
    });
    return () => {
      live = false;
    };
  }, [queries, storage]);

  useEffect(() => {
    const onHashNavigate = () => {
      if (!isPermalinkHash(window.location.hash)) return;
      const decoded = decodeWorkbenchPermalink(window.location.hash);
      if (!decoded.ok) return;
      touchedBeforeHydration.current = true;
      setTabs((prevTabs) => {
        const merged = mergePermalinkIntoTabs(
          prevTabs,
          decoded.permalink,
          queries
        );
        setActiveTabId(merged.activeTabId);
        return merged.tabs;
      });
    };
    window.addEventListener("hashchange", onHashNavigate);
    window.addEventListener("popstate", onHashNavigate);
    return () => {
      window.removeEventListener("hashchange", onHashNavigate);
      window.removeEventListener("popstate", onHashNavigate);
    };
  }, [queries]);

  useEffect(() => {
    if (!hydrated) return;
    let live = true;
    void storage
      .saveMeta({
        activeTabId: activeTab.id,
        tabs,
        namedQueries,
        executionLog,
        updatedAt: new Date().toISOString(),
      })
      .then((res) => {
        if (!live) return;
        if (res.ok) {
          setStorageInfo({
            backend: res.backend,
            bytesUsed: res.bytesUsed,
            maxBytes: res.maxBytes,
          });
        } else {
          setWorkspaceNotice({ kind: "error", text: res.message });
        }
      });
    return () => {
      live = false;
    };
  }, [activeTab.id, executionLog, hydrated, namedQueries, storage, tabs]);

  const start = async () => {
    setEngineState({ status: "starting", step: "data" });
    try {
      const [load, module] = await Promise.all([
        data.load(),
        import("./sql-engine"),
      ]);
      const currentDatasets = datasetsRef.current;
      const datasetLoads = currentDatasets.map(workbenchDatasetLoad);
      const started = await module.startSqlEngine(
        load,
        (step) => {
          if (mounted.current) setEngineState({ status: "starting", step });
        },
        datasetLoads
      );
      if (!mounted.current) {
        started.dispose();
        return;
      }
      engine.current = started;
      if (Array.isArray(started.datasets) && started.datasets.length > 0) {
        const merged = mergeWorkbenchHydratedDatasets(
          currentDatasets,
          started.datasets
        );
        datasetsRef.current = merged;
        setDatasets(merged);
        for (const ds of merged) {
          const saved = await storage.putDataset(ds);
          if (mounted.current && saved.ok) {
            setStorageInfo({
              backend: saved.backend,
              bytesUsed: saved.bytesUsed,
              maxBytes: saved.maxBytes,
            });
          }
        }
      }
      if (mounted.current) {
        setEngineState({ status: "ready", version: started.version });
      }
    } catch (error) {
      if (mounted.current) {
        setEngineState({
          status: "failed",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };

  const appendLog = (
    entry: Omit<WorkbenchExecutionLogEntry, "id" | "ranAt">
  ) => {
    const full: WorkbenchExecutionLogEntry = {
      ...entry,
      id: makeId("run"),
      ranAt: new Date().toISOString(),
    };
    setExecutionLog((prev) => [full, ...prev].slice(0, MAX_EXECUTION_LOG));
  };

  const execute = async (mode: "run" | "explain") => {
    const current = engine.current;
    if (!current || running) return;
    const tabSnapshot = activeTab;
    const text = tabSnapshot.sql.trim().replace(/;\s*$/, "");
    const startedAt = performance.now();
    setRunning(true);
    try {
      if (mode === "explain") {
        // Checked as typed, so a refusal names the visitor's SQL rather
        // than the EXPLAIN around it.
        const findings = checkWorkbenchSql(text);
        if (findings.length > 0) {
          const message = findings.map((finding) => finding.message).join(" ");
          setOutcomes((prev) => ({
            ...prev,
            [tabSnapshot.id]: {
              kind: "failed",
              failure: "refused",
              message,
            },
          }));
          appendLog({
            tabId: tabSnapshot.id,
            tabTitle: tabSnapshot.title,
            mode,
            sql: tabSnapshot.sql,
            status: "refused",
            rowCount: null,
            elapsedMs: Math.round(performance.now() - startedAt),
            message,
          });
          return;
        }
        const result = await current.run(`EXPLAIN ${text}`);
        if (mounted.current) {
          setOutcomes((prev) => ({
            ...prev,
            [tabSnapshot.id]: { kind: "plan", plan: planText(result) },
          }));
          appendLog({
            tabId: tabSnapshot.id,
            tabTitle: tabSnapshot.title,
            mode,
            sql: tabSnapshot.sql,
            status: "ok",
            rowCount: result.rowCount,
            elapsedMs: Math.round(result.elapsedMs),
            message: null,
          });
        }
      } else {
        const result = await current.run(text);
        if (mounted.current) {
          setOutcomes((prev) => ({
            ...prev,
            [tabSnapshot.id]: { kind: "rows", result },
          }));
          appendLog({
            tabId: tabSnapshot.id,
            tabTitle: tabSnapshot.title,
            mode,
            sql: tabSnapshot.sql,
            status: "ok",
            rowCount: result.rowCount,
            elapsedMs: Math.round(result.elapsedMs),
            message: null,
          });
        }
      }
    } catch (error) {
      if (!mounted.current) return;
      const failed = failureOf(error);
      setOutcomes((prev) => ({
        ...prev,
        [tabSnapshot.id]: failed,
      }));
      if (failed.kind === "failed") {
        appendLog({
          tabId: tabSnapshot.id,
          tabTitle: tabSnapshot.title,
          mode,
          sql: tabSnapshot.sql,
          status: failed.failure,
          rowCount: null,
          elapsedMs: Math.round(performance.now() - startedAt),
          message: failed.message,
        });
        if (failed.failure === "stopped") {
          engine.current = null;
          setEngineState({ status: "idle" });
        }
      }
    } finally {
      if (mounted.current) setRunning(false);
    }
  };

  const chooseSavedOrPreset = (id: string) => {
    const preset = queries.find((q) => q.id === id);
    if (preset) {
      openOrFocusQueryTab({
        title: preset.title,
        sql: preset.sql,
        selectedQueryId: preset.id,
      });
      return;
    }
    const custom = namedQueries.find((q) => q.id === id);
    if (custom) {
      openOrFocusQueryTab({
        title: custom.title,
        sql: custom.sql,
        selectedQueryId: custom.id,
      });
    }
  };

  const queryTableByName = (tableName: string) => {
    openOrFocusQueryTab({
      title: tableName,
      sql: `SELECT *\nFROM ${tableName}\nLIMIT 100;`,
      selectedQueryId: "",
      focusEditor: true,
    });
  };

  const addBlankTab = () => {
    touchedBeforeHydration.current = true;
    const nextIndex = tabs.length + 1;
    const created: WorkbenchNotebookTab = {
      id: makeId("tab"),
      title: `Tab ${nextIndex}`,
      sql: "SELECT *\nFROM gold.dim_study\nLIMIT 25;",
      selectedQueryId: "",
      edited: false,
      updatedAt: new Date().toISOString(),
    };
    setTabs((prev) => [...prev, created]);
    setActiveTabId(created.id);
    editor.current?.focus();
  };

  const renameActiveTab = (nextTitle: string) => {
    touchedBeforeHydration.current = true;
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTab.id
          ? { ...tab, title: nextTitle, updatedAt: new Date().toISOString() }
          : tab
      )
    );
  };

  const closeTab = (tabId: string) => {
    if (tabs.length <= 1) return;
    touchedBeforeHydration.current = true;
    const index = tabs.findIndex((t) => t.id === tabId);
    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);
    setOutcomes((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    if (activeTab.id === tabId) {
      const fallback = remaining[index > 0 ? index - 1 : 0] ?? remaining[0];
      if (fallback) setActiveTabId(fallback.id);
    }
  };

  const saveActiveAsNamedQuery = () => {
    setWorkspaceNotice(null);
    const findings = checkWorkbenchSql(activeTab.sql);
    if (findings.length > 0) {
      setWorkspaceNotice({
        kind: "error",
        text: `Cannot save query: ${findings.map((f) => f.message).join(" ")}`,
      });
      return;
    }
    const cleanTitle = activeTab.title.trim() || "Saved query";
    touchedBeforeHydration.current = true;
    const existing = namedQueries.find(
      (q) =>
        q.id === activeTab.selectedQueryId ||
        q.title.toLowerCase() === cleanTitle.toLowerCase()
    );
    const savedId = existing?.id ?? makeId("saved");
    const entry: WorkbenchNamedQuery = {
      id: savedId,
      title: cleanTitle,
      sql: activeTab.sql,
      savedAt: new Date().toISOString(),
    };
    setNamedQueries((prev) =>
      existing
        ? prev.map((q) => (q.id === savedId ? entry : q))
        : [...prev, entry]
    );
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTab.id
          ? {
              ...tab,
              title: cleanTitle,
              selectedQueryId: savedId,
              edited: false,
              updatedAt: new Date().toISOString(),
            }
          : tab
      )
    );
    setWorkspaceNotice({
      kind: "info",
      text: `Saved "${cleanTitle}" to this browser's query library.`,
    });
  };

  const deleteNamedQuery = (id: string) => {
    touchedBeforeHydration.current = true;
    setNamedQueries((prev) => prev.filter((q) => q.id !== id));
    setTabs((prev) =>
      prev.map((tab) =>
        tab.selectedQueryId === id ? { ...tab, selectedQueryId: "" } : tab
      )
    );
  };

  const shareActivePermalink = () => {
    setWorkspaceNotice(null);
    try {
      const encoded = encodeWorkbenchPermalink({
        sql: activeTab.sql,
        title: activeTab.title,
      });
      writeUrlHash(encoded);
      copyToClipboard(`${getActiveHostUrl()}/platform/sql#${encoded}`).then(
        () =>
          setWorkspaceNotice({
            kind: "info",
            text: "Copied the #sql link to this tab.",
          }),
        () =>
          setWorkspaceNotice({
            kind: "info",
            text: "Updated the address bar with #sql; copy it from there.",
          })
      );
    } catch (error) {
      setWorkspaceNotice({
        kind: "error",
        text: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const exportNotebookBundle = () => {
    setWorkspaceNotice(null);
    const serialized = serializeWorkbenchBundle({
      activeTabId: activeTab.id,
      tabs: tabs.map((t) => ({
        id: t.id,
        title: t.title.trim() || "Untitled tab",
        sql: t.sql,
        selectedQueryId: t.selectedQueryId,
        updatedAt: t.updatedAt,
      })),
      namedQueries,
    });
    if (!serialized.ok) {
      setWorkspaceNotice({ kind: "error", text: serialized.error });
      return;
    }
    const stem = sanitizeFilename(activeTab.title, "clinical-notebook");
    downloadFile(serialized.json, `${stem}.sql.json`, {
      mimeType: "application/json;charset=utf-8",
    });
    setWorkspaceNotice({
      kind: "info",
      text: `Exported ${serialized.bundle.tabs.length} ${serialized.bundle.tabs.length === 1 ? "tab" : "tabs"} as ${stem}.sql.json.`,
    });
  };

  const importNotebookBundle = async (file: File) => {
    setWorkspaceNotice(null);
    try {
      const rawText = await readBlobText(file);
      const parsed = parseWorkbenchBundle(rawText);
      if (!parsed.ok) {
        setWorkspaceNotice({ kind: "error", text: parsed.error });
        return;
      }
      touchedBeforeHydration.current = true;
      const restoredTabs: WorkbenchNotebookTab[] = parsed.bundle.tabs.map(
        (tab) => ({
          id: tab.id,
          title: tab.title,
          sql: tab.sql,
          selectedQueryId: tab.selectedQueryId,
          edited: false,
          updatedAt: tab.updatedAt,
        })
      );
      setTabs(restoredTabs);
      setActiveTabId(parsed.bundle.activeTabId);
      setOutcomes({});
      setNamedQueries((prev) => {
        const byId = new Map(prev.map((q) => [q.id, q]));
        for (const incoming of parsed.bundle.namedQueries) {
          byId.set(incoming.id, incoming);
        }
        return [...byId.values()];
      });
      setWorkspaceNotice({
        kind: "info",
        text: `Imported ${restoredTabs.length} ${restoredTabs.length === 1 ? "tab" : "tabs"} from ${file.name}. Review the SQL and press Run when ready.`,
      });
    } catch (error) {
      setWorkspaceNotice({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "The .sql.json bundle could not be read.",
      });
    }
  };

  const exportResult = (
    format: WorkbenchExportFormat,
    result: WorkbenchResult
  ) => {
    const stem =
      activeTab.selectedQueryId || sanitizeFilename(activeTab.title, "query");
    switch (format) {
      case "csv":
        downloadFile(workbenchResultCsv(result), `${stem}.csv`, {
          mimeType: "text/csv;charset=utf-8",
        });
        break;
      case "json":
        downloadFile(workbenchResultJson(result), `${stem}.json`, {
          mimeType: "application/json;charset=utf-8",
        });
        break;
      case "parquet": {
        const parquetBytes = workbenchResultParquet(result);
        downloadFile(new Uint8Array(parquetBytes), `${stem}.parquet`, {
          mimeType: "application/vnd.apache.parquet",
        });
        break;
      }
    }
  };

  const handleDatasetUpload = async (file: File) => {
    setDatasetError(null);
    datasetsTouchedBeforeHydration.current = true;
    try {
      const bytes = await readBlobBytes(file);
      const parsed = parseWorkbenchDataset({
        fileName: file.name,
        bytes,
        id: makeId("ds"),
      });
      if (!parsed.ok) {
        setDatasetError(parsed.error);
        return;
      }
      const previousDatasets = datasetsRef.current;
      const previousSameTable = previousDatasets.find(
        (d) => d.tableName === parsed.dataset.tableName
      );
      const saved = await storage.putDataset(parsed.dataset);
      if (!saved.ok) {
        setDatasetError(saved.message);
        return;
      }
      const candidateDatasets = [
        ...previousDatasets.filter(
          (d) => d.tableName !== parsed.dataset.tableName
        ),
        parsed.dataset,
      ];
      let finalDatasets = candidateDatasets;
      let finalBackend = saved.backend;
      let finalBytesUsed = saved.bytesUsed;
      let finalMaxBytes = saved.maxBytes;

      if (
        engine.current &&
        typeof engine.current.reloadDatasets === "function"
      ) {
        try {
          const hydratedList = await engine.current.reloadDatasets(
            candidateDatasets.map(workbenchDatasetLoad)
          );
          if (Array.isArray(hydratedList) && hydratedList.length > 0) {
            finalDatasets = mergeWorkbenchHydratedDatasets(
              candidateDatasets,
              hydratedList
            );
            const updatedCurrent = finalDatasets.find(
              (d) => d.id === parsed.dataset.id
            );
            if (updatedCurrent) {
              const persisted = await storage.putDataset(updatedCurrent);
              if (persisted.ok) {
                finalBackend = persisted.backend;
                finalBytesUsed = persisted.bytesUsed;
                finalMaxBytes = persisted.maxBytes;
              }
            }
          }
        } catch (error) {
          const afterRemove = await storage.removeDataset(parsed.dataset.id);
          let rollbackBackend = afterRemove.backend;
          let rollbackBytes = afterRemove.bytesUsed;
          let rollbackMax = afterRemove.maxBytes;
          if (previousSameTable) {
            const restored = await storage.putDataset(previousSameTable);
            if (restored.ok) {
              rollbackBackend = restored.backend;
              rollbackBytes = restored.bytesUsed;
              rollbackMax = restored.maxBytes;
            }
          }
          setStorageInfo({
            backend: rollbackBackend,
            bytesUsed: rollbackBytes,
            maxBytes: rollbackMax,
          });
          if (
            error instanceof Error &&
            "failure" in error &&
            error.failure === "stopped"
          ) {
            engine.current = null;
            setEngineState({ status: "idle" });
          }
          setDatasetError(
            error instanceof Error
              ? error.message
              : "The dataset could not be loaded."
          );
          return;
        }
      }

      datasetsRef.current = finalDatasets;
      setDatasets(finalDatasets);
      setStorageInfo({
        backend: finalBackend,
        bytesUsed: finalBytesUsed,
        maxBytes: finalMaxBytes,
      });
    } catch (error) {
      setDatasetError(
        error instanceof Error
          ? error.message
          : "The dataset could not be loaded."
      );
    }
  };

  const handleRemoveDataset = async (dataset: WorkbenchUploadedDataset) => {
    setDatasetError(null);
    datasetsTouchedBeforeHydration.current = true;
    const nextDatasets = datasetsRef.current.filter((d) => d.id !== dataset.id);
    datasetsRef.current = nextDatasets;
    setDatasets(nextDatasets);
    const removed = await storage.removeDataset(dataset.id);
    setStorageInfo({
      backend: removed.backend,
      bytesUsed: removed.bytesUsed,
      maxBytes: removed.maxBytes,
    });
    if (engine.current && typeof engine.current.reloadDatasets === "function") {
      try {
        await engine.current.reloadDatasets(
          nextDatasets.map(workbenchDatasetLoad)
        );
      } catch (error) {
        setDatasetError(
          error instanceof Error
            ? error.message
            : "Could not refresh engine tables."
        );
      }
    }
  };

  const ready = engineState.status === "ready";
  const hashLinkError =
    decodedHash !== null && !decodedHash.ok ? decodedHash.error : null;

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="min-w-0 space-y-6">
        {hashLinkError && (
          <p
            role="alert"
            className="border-l-2 border-red-500 pl-3 text-sm text-red-200"
          >
            {hashLinkError}
          </p>
        )}

        <section aria-labelledby="sql-engine" className={section}>
          <h2
            id="sql-engine"
            className="text-xl font-semibold tracking-[-0.02em]"
          >
            Engine
          </h2>
          {engineState.status === "ready" ? (
            <p role="status" className="mt-2 text-sm text-emerald-300">
              {datasets.length === 0
                ? `DuckDB ${engineState.version} is running with ${tables.length} gold tables, read-only.`
                : `DuckDB ${engineState.version} is running with ${tables.length} gold tables, read-only. ${datasets.length} uploaded in uploads.*.`}
            </p>
          ) : (
            <>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
                The engine is DuckDB compiled to WebAssembly. It downloads once
                (about 7 MB compressed), runs in its own worker in this tab, and
                holds your own copy of the gold tables and any local datasets
                saved in this browser. Nothing you type leaves the browser, and
                the database refuses files, the network and every change.
              </p>
              <div className="mt-4 flex min-w-0 flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={`${button} min-h-12 border-amber-400/60 text-amber-200`}
                  onClick={() => void start()}
                  disabled={engineState.status === "starting"}
                >
                  {engineState.status === "failed"
                    ? "Try starting the engine again"
                    : "Start SQL engine"}
                </button>
                <p role="status" className="text-sm text-slate-300">
                  {engineState.status === "starting"
                    ? engineState.step === "data"
                      ? "Building the synthetic warehouse…"
                      : STEP_TEXT[engineState.step]
                    : ""}
                </p>
              </div>
              {engineState.status === "failed" && (
                <p
                  role="alert"
                  className="mt-3 border-l-2 border-red-500 pl-3 text-sm text-red-200"
                >
                  {engineState.message}
                </p>
              )}
            </>
          )}
        </section>

        <section aria-labelledby="sql-query" className={section}>
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
            <h2
              id="sql-query"
              className="text-xl font-semibold tracking-[-0.02em]"
            >
              Query
            </h2>
            <p className="font-mono text-xs text-slate-400">
              {storageInfo.backend === "indexeddb"
                ? `Saved locally in IndexedDB · ${formatBytes(storageInfo.bytesUsed)} / ${formatBytes(storageInfo.maxBytes)}`
                : `In-memory session fallback · ${formatBytes(storageInfo.bytesUsed)} / ${formatBytes(storageInfo.maxBytes)}`}
            </p>
          </div>

          <div
            role="group"
            aria-label="Notebook tabs"
            className="mt-4 flex min-w-0 flex-wrap items-center gap-2 border-b border-white/[0.08] pb-3"
          >
            {tabs.map((tab) => {
              const active = tab.id === activeTab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`${button} min-h-12 max-w-full min-w-0 ${
                    active
                      ? "border-amber-400 bg-amber-400/10 text-amber-200"
                      : "text-slate-300"
                  }`}
                >
                  <span className="truncate font-mono text-xs">
                    {tab.title || "Untitled"}
                    {tab.edited ? " *" : ""}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              className={`${button} min-h-12 text-xs text-amber-200`}
              onClick={addBlankTab}
            >
              + New tab
            </button>
          </div>

          <div className="mt-3 grid min-w-0 gap-3 @xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <label
                htmlFor={`${ids}-tab-title`}
                className="block text-xs text-slate-300"
              >
                Active tab name
              </label>
              <input
                id={`${ids}-tab-title`}
                type="text"
                value={activeTab.title}
                onChange={(event) => renameActiveTab(event.target.value)}
                className={`${control} mt-1 font-mono text-xs`}
              />
            </div>
            <div className="flex min-w-0 flex-wrap items-end gap-2">
              <button
                type="button"
                className={`${button} min-h-12 text-xs`}
                onClick={saveActiveAsNamedQuery}
              >
                Save query
              </button>
              {tabs.length > 1 && (
                <button
                  type="button"
                  className={`${button} min-h-12 text-xs text-slate-300`}
                  onClick={() => closeTab(activeTab.id)}
                >
                  Close tab
                </button>
              )}
            </div>
          </div>

          <label
            htmlFor={`${ids}-saved`}
            className="mt-4 block text-sm text-slate-200"
          >
            Saved query
          </label>
          <select
            id={`${ids}-saved`}
            className={`${control} mt-1`}
            value={activeTab.selectedQueryId}
            onChange={(event) => chooseSavedOrPreset(event.target.value)}
          >
            <option value="" disabled>
              Your own query
            </option>
            <optgroup label="Worked examples">
              {examples.map((query) => (
                <option key={query.id} value={query.id}>
                  {query.title}
                </option>
              ))}
            </optgroup>
            <optgroup label="Governed metrics: the SQL behind each number">
              {metrics.map((query) => (
                <option key={query.id} value={query.id}>
                  {query.title}
                </option>
              ))}
            </optgroup>
            {namedQueries.length > 0 && (
              <optgroup label="Saved in this browser">
                {namedQueries.map((query) => (
                  <option key={query.id} value={query.id}>
                    {query.title}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {selectedPreset && (
            <div className="mt-3 text-sm">
              <p className="leading-relaxed text-slate-300">
                {selectedPreset.description}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {`Shows: ${selectedPreset.techniques.join(", ")}. Reads: ${selectedPreset.tables.join(", ")}.`}
              </p>
              <Dialects query={selectedPreset} />
            </div>
          )}

          {namedQueries.length > 0 && (
            <details className="mt-4 border border-white/[0.08] bg-[#13151a]">
              <summary className="flex min-h-12 cursor-pointer items-center px-3 text-sm text-slate-200 focus-visible:outline-2 focus-visible:outline-amber-400">
                {`Saved query library (${namedQueries.length})`}
              </summary>
              <ul className="divide-y divide-white/[0.06] border-t border-white/[0.06] px-3 py-2 text-xs">
                {namedQueries.map((saved) => (
                  <li
                    key={saved.id}
                    className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span className="min-w-0 break-words font-mono text-slate-100">
                      {saved.title}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`${button} min-h-12 text-xs`}
                        onClick={() => chooseSavedOrPreset(saved.id)}
                      >
                        {`Open ${saved.title}`}
                      </button>
                      <button
                        type="button"
                        className={`${button} min-h-12 text-xs text-red-200`}
                        onClick={() => deleteNamedQuery(saved.id)}
                      >
                        {`Delete ${saved.title}`}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <label
            htmlFor={`${ids}-sql`}
            className="mt-5 block text-sm text-slate-200"
          >
            SQL (DuckDB)
          </label>
          <textarea
            id={`${ids}-sql`}
            ref={editor}
            aria-describedby={`${ids}-sql-hint`}
            value={activeTab.sql}
            onChange={(event) => {
              const nextSql = event.target.value;
              touchedBeforeHydration.current = true;
              setTabs((prev) =>
                prev.map((tab) =>
                  tab.id === activeTab.id
                    ? {
                        ...tab,
                        sql: nextSql,
                        selectedQueryId: "",
                        edited: true,
                        updatedAt: new Date().toISOString(),
                      }
                    : tab
                )
              );
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void execute("run");
              }
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            rows={14}
            className="mt-1 block w-full min-w-0 resize-y border border-white/[0.12] bg-[#13151a] p-3 font-mono text-xs leading-relaxed text-slate-100 focus-visible:outline-2 focus-visible:outline-amber-400"
          />
          <p id={`${ids}-sql-hint`} className="mt-1 text-xs text-slate-400">
            {ready
              ? "One read-only query at a time. Ctrl+Enter (⌘+Enter on a Mac) runs it. A query stops after 30 seconds."
              : "Start the engine to run queries. You can read and edit the SQL now."}
          </p>

          <div className="mt-4 flex min-w-0 flex-wrap gap-3">
            <button
              type="button"
              className={`${button} min-h-12`}
              disabled={!ready || running}
              onClick={() => void execute("run")}
            >
              Run
            </button>
            <button
              type="button"
              className={`${button} min-h-12`}
              disabled={!ready || running}
              onClick={() => void execute("explain")}
            >
              Show the plan (EXPLAIN)
            </button>
            {running && (
              <button
                type="button"
                className={`${button} min-h-12 border-red-400/60 text-red-200`}
                onClick={() => engine.current?.cancel()}
              >
                Stop the query
              </button>
            )}
            {activeOutcome?.kind === "rows" &&
              activeOutcome.result.columns.length > 0 && (
                <>
                  <button
                    type="button"
                    className={`${button} min-h-12`}
                    onClick={() => exportResult("csv", activeOutcome.result)}
                  >
                    Download the rows as CSV
                  </button>
                  <button
                    type="button"
                    className={`${button} min-h-12`}
                    onClick={() => exportResult("json", activeOutcome.result)}
                  >
                    Download the rows as JSON
                  </button>
                  <button
                    type="button"
                    className={`${button} min-h-12`}
                    onClick={() =>
                      exportResult("parquet", activeOutcome.result)
                    }
                  >
                    Download the rows as Parquet
                  </button>
                </>
              )}
          </div>

          <div className="mt-4 flex min-w-0 flex-wrap items-center gap-3 border-t border-white/[0.08] pt-4">
            <button
              type="button"
              className={`${button} min-h-12 text-xs`}
              onClick={shareActivePermalink}
            >
              Copy a link to this tab
            </button>
            <button
              type="button"
              className={`${button} min-h-12 text-xs`}
              onClick={exportNotebookBundle}
            >
              Export notebook (.sql.json)
            </button>
            <button
              type="button"
              className={`${button} min-h-12 text-xs`}
              onClick={() => bundleInput.current?.click()}
            >
              Import notebook (.sql.json)
            </button>
            <input
              ref={bundleInput}
              data-testid="import-bundle-input"
              type="file"
              accept=".json,.sql.json,application/json"
              tabIndex={-1}
              aria-hidden="true"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void importNotebookBundle(file);
              }}
            />
          </div>

          {workspaceNotice && (
            <p
              role={workspaceNotice.kind === "error" ? "alert" : "status"}
              className={`mt-3 border-l-2 pl-3 text-xs ${
                workspaceNotice.kind === "error"
                  ? "border-red-500 text-red-200"
                  : "border-emerald-500 text-emerald-200"
              }`}
            >
              {workspaceNotice.text}
            </p>
          )}
        </section>

        <section
          aria-labelledby="sql-result"
          aria-busy={running}
          className={section}
        >
          <h2
            id="sql-result"
            className="text-xl font-semibold tracking-[-0.02em]"
          >
            Result
          </h2>
          <p role="status" className="mt-2 text-sm text-slate-300">
            {running
              ? "Running…"
              : activeOutcome?.kind === "rows"
                ? resultSummary(activeOutcome.result)
                : activeOutcome?.kind === "plan"
                  ? "The plan DuckDB would run, without running it."
                  : ""}
          </p>
          {activeOutcome?.kind === "failed" && (
            <p
              role="alert"
              className="mt-2 whitespace-pre-wrap break-words border-l-2 border-red-500 pl-3 font-mono text-xs text-red-200"
            >
              {activeOutcome.message}
            </p>
          )}
          {activeOutcome?.kind === "rows" && (
            <div className="mt-3 space-y-2">
              <ResultGrid result={activeOutcome.result} />
              {activeOutcome.result.rows.length > GRID_ROWS && (
                <p className="text-xs text-slate-400">
                  {`The grid shows the first ${number.format(GRID_ROWS)} rows; exported files hold all ${number.format(activeOutcome.result.rows.length)}.`}
                </p>
              )}
            </div>
          )}
          {activeOutcome?.kind === "plan" && (
            <pre
              role="region"
              aria-label="Query plan"
              tabIndex={0}
              className="mt-3 max-h-[32rem] overflow-auto border border-white/[0.08] bg-[#13151a] p-3 font-mono text-[11px] leading-snug text-slate-200 focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              {activeOutcome.plan}
            </pre>
          )}
          {!activeOutcome && !running && (
            <p className="mt-2 text-sm text-slate-400">
              {ready
                ? "Run a query to see its rows here."
                : "Rows appear here once the engine is running."}
            </p>
          )}
        </section>

        <section aria-labelledby="sql-history" className={section}>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h2
              id="sql-history"
              className="text-xl font-semibold tracking-[-0.02em]"
            >
              Execution log
            </h2>
            {executionLog.length > 0 && (
              <button
                type="button"
                className={`${button} min-h-12 text-xs text-slate-300`}
                onClick={() => {
                  touchedBeforeHydration.current = true;
                  setExecutionLog([]);
                }}
              >
                Clear execution log
              </button>
            )}
          </div>
          <details
            open={executionLog.length > 0}
            className="mt-3 border border-white/[0.08] bg-[#13151a]"
          >
            <summary className="flex min-h-12 cursor-pointer items-center px-3 text-sm text-slate-200 focus-visible:outline-2 focus-visible:outline-amber-400">
              {executionLog.length === 0
                ? "Run history (no runs recorded in this browser yet)"
                : `Run history (${number.format(executionLog.length)} ${executionLog.length === 1 ? "entry" : "entries"})`}
            </summary>
            <div className="border-t border-white/[0.06] p-3">
              {executionLog.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Every query or EXPLAIN plan you run is timestamped and saved
                  locally in this browser.
                </p>
              ) : (
                <ul className="max-h-80 space-y-2 overflow-y-auto">
                  {executionLog.map((entry) => (
                    <li
                      key={entry.id}
                      className="border border-white/[0.06] bg-[#0d0e11] p-3 text-xs"
                    >
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 break-words font-mono text-slate-200">
                          {`${entry.tabTitle} · ${entry.mode === "explain" ? "EXPLAIN" : "RUN"}`}
                        </span>
                        <span
                          className={`font-mono ${
                            entry.status === "ok"
                              ? "text-emerald-300"
                              : "text-amber-300"
                          }`}
                        >
                          {entry.status === "ok"
                            ? `${entry.rowCount !== null ? `${number.format(entry.rowCount)} rows · ` : ""}${number.format(entry.elapsedMs)} ms`
                            : `${entry.status} · ${number.format(entry.elapsedMs)} ms`}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-slate-400">
                        {entry.ranAt.replace("T", " ").slice(0, 19)} UTC
                      </p>
                      <pre
                        tabIndex={0}
                        aria-label={`Logged SQL for ${entry.tabTitle}`}
                        className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words border border-white/[0.06] bg-[#13151a] p-2 font-mono text-[11px] text-slate-300 focus-visible:outline-2 focus-visible:outline-amber-400"
                      >
                        {entry.sql}
                      </pre>
                      {entry.message && (
                        <p className="mt-1 break-words font-mono text-[11px] text-red-200">
                          {entry.message}
                        </p>
                      )}
                      <button
                        type="button"
                        className={`${button} mt-2 min-h-12 text-xs`}
                        onClick={() =>
                          openOrFocusQueryTab({
                            title: entry.tabTitle,
                            sql: entry.sql,
                            selectedQueryId: "",
                            focusEditor: true,
                          })
                        }
                      >
                        Open in tab
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        </section>
      </div>

      <div className="min-w-0 space-y-6">
        <section aria-labelledby="sql-datasets" className={section}>
          <h2
            id="sql-datasets"
            className="text-xl font-semibold tracking-[-0.02em]"
          >
            Local datasets
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Upload CSV, JSON or Parquet files into read-only{" "}
            <span className="font-mono text-slate-200">uploads.*</span> tables.
            Files stay in browser storage (50 MB cap) and reload into the engine
            with external access locked.
          </p>
          <p className="mt-2 font-mono text-xs text-slate-400">
            {`Quota: ${formatBytes(storageInfo.bytesUsed)} of ${formatBytes(storageInfo.maxBytes)} (${storageInfo.backend === "indexeddb" ? "IndexedDB" : "in-memory fallback"})`}
          </p>
          <div className="mt-3">
            <button
              type="button"
              className={`${button} min-h-12 w-full border-amber-400/60 text-amber-200`}
              disabled={running}
              onClick={() => datasetInput.current?.click()}
            >
              Upload dataset (CSV, JSON, Parquet)
            </button>
            <input
              ref={datasetInput}
              data-testid="upload-dataset-input"
              type="file"
              accept=".csv,.json,.jsonl,.ndjson,.parquet,text/csv,application/json,application/octet-stream"
              tabIndex={-1}
              aria-hidden="true"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleDatasetUpload(file);
              }}
            />
          </div>
          {datasetError && (
            <p
              role="alert"
              className="mt-3 break-words border-l-2 border-red-500 pl-3 text-xs text-red-200"
            >
              {datasetError}
            </p>
          )}
          {datasets.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">
              No local datasets uploaded yet. Uploaded tables appear as{" "}
              <span className="font-mono text-slate-300">
                uploads.&lt;name&gt;
              </span>{" "}
              and join directly with{" "}
              <span className="font-mono text-slate-300">gold.*</span>.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {datasets.map((dataset) => (
                <li
                  key={dataset.id}
                  className="border border-white/[0.08] bg-[#13151a] p-3 text-xs"
                >
                  <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                    <span className="min-w-0 break-all font-mono text-sm text-slate-100">
                      {dataset.qualifiedName}
                    </span>
                    <span className="font-mono text-slate-400">
                      {dataset.rowCount === null
                        ? `${dataset.format.toUpperCase()} · ${formatBytes(dataset.byteLength)}`
                        : `${dataset.format.toUpperCase()} · ${number.format(dataset.rowCount)} ${dataset.rowCount === 1 ? "row" : "rows"} · ${formatBytes(dataset.byteLength)}`}
                    </span>
                  </div>
                  {dataset.columns.length > 0 ? (
                    <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-slate-300">
                      {dataset.columns.map((col) => (
                        <li key={col.name} className="break-all">
                          {`${col.name} (${col.type})`}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-400">
                      Columns and row count load from DuckDB when the engine
                      starts.
                    </p>
                  )}
                  <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                    <button
                      type="button"
                      className={`${button} min-h-12 text-xs`}
                      onClick={() => queryTableByName(dataset.qualifiedName)}
                    >
                      {`Query ${dataset.qualifiedName}`}
                    </button>
                    <button
                      type="button"
                      className={`${button} min-h-12 text-xs text-red-200`}
                      disabled={running}
                      onClick={() => void handleRemoveDataset(dataset)}
                    >
                      {`Remove ${dataset.qualifiedName}`}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <SchemaBrowser
          tables={tables}
          uploadedDatasets={datasets}
          onQuery={(table) => queryTableByName(table.name)}
        />
      </div>
    </div>
  );
}
