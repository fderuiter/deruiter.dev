"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  checkWorkbenchSql,
  workbenchResultCsv,
  type SqlDialect,
  type WorkbenchQuery,
  type WorkbenchResult,
  type WorkbenchTable,
} from "@/lib/clinical-platform";
import { downloadFile } from "@/lib/download";
import { createSqlDataClient } from "./sql-data-client";
import type { SqlEngine, SqlEngineStep, SqlRunFailure } from "./sql-engine";

/** Rows the grid draws; the CSV carries every row the result kept. */
const GRID_ROWS = 500;

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
  onQuery,
}: {
  tables: readonly WorkbenchTable[];
  onQuery: (table: WorkbenchTable) => void;
}) {
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
            <pre className="mt-1 max-h-80 overflow-auto border border-white/[0.06] bg-[#0d0e11] p-2 font-mono text-[11px] leading-relaxed text-slate-200">
              {dialects[dialect]}
            </pre>
          </figure>
        ))}
      </div>
    </details>
  );
}

/**
 * The /platform/sql workbench: a schema browser, a library of saved
 * queries and an editor that runs read-only DuckDB SQL over the visitor's
 * own in-browser copy of the gold tables. The engine loads only when the
 * visitor starts it.
 */
export function SqlWorkbench({
  tables,
  queries,
}: {
  tables: readonly WorkbenchTable[];
  queries: readonly WorkbenchQuery[];
}) {
  const ids = useId();
  const [selectedId, setSelectedId] = useState(queries[0]?.id ?? "");
  const [sql, setSql] = useState(queries[0]?.sql ?? "");
  const [engineState, setEngineState] = useState<EngineState>({
    status: "idle",
  });
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const engine = useRef<SqlEngine | null>(null);
  const [data] = useState(createSqlDataClient);
  const editor = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(true);

  const selected = queries.find((query) => query.id === selectedId) ?? null;
  const examples = queries.filter((query) => query.kind === "example");
  const metrics = queries.filter((query) => query.kind === "metric");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      engine.current?.dispose();
      engine.current = null;
      data.dispose();
    };
  }, [data]);

  const start = async () => {
    setEngineState({ status: "starting", step: "data" });
    setOutcome(null);
    try {
      const [load, module] = await Promise.all([
        data.load(),
        import("./sql-engine"),
      ]);
      const started = await module.startSqlEngine(load, (step) => {
        if (mounted.current) setEngineState({ status: "starting", step });
      });
      if (!mounted.current) {
        started.dispose();
        return;
      }
      engine.current = started;
      setEngineState({ status: "ready", version: started.version });
    } catch (error) {
      if (mounted.current) {
        setEngineState({
          status: "failed",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };

  const execute = async (mode: "run" | "explain") => {
    const current = engine.current;
    if (!current || running) return;
    const text = sql.trim().replace(/;\s*$/, "");
    setRunning(true);
    try {
      if (mode === "explain") {
        // Checked as typed, so a refusal names the visitor's SQL rather
        // than the EXPLAIN around it.
        const findings = checkWorkbenchSql(text);
        if (findings.length > 0) {
          setOutcome({
            kind: "failed",
            failure: "refused",
            message: findings.map((finding) => finding.message).join(" "),
          });
          return;
        }
        const result = await current.run(`EXPLAIN ${text}`);
        if (mounted.current)
          setOutcome({ kind: "plan", plan: planText(result) });
      } else {
        const result = await current.run(text);
        if (mounted.current) setOutcome({ kind: "rows", result });
      }
    } catch (error) {
      if (!mounted.current) return;
      const failed = failureOf(error);
      setOutcome(failed);
      if (failed.kind === "failed" && failed.failure === "stopped") {
        engine.current = null;
        setEngineState({ status: "idle" });
      }
    } finally {
      if (mounted.current) setRunning(false);
    }
  };

  const choose = (id: string) => {
    const query = queries.find((q) => q.id === id);
    if (!query) return;
    setSelectedId(id);
    setSql(query.sql);
    setOutcome(null);
  };

  const queryTable = (table: WorkbenchTable) => {
    setSelectedId("");
    setSql(`SELECT *\nFROM ${table.name}\nLIMIT 100;`);
    setOutcome(null);
    editor.current?.focus();
  };

  const ready = engineState.status === "ready";

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="min-w-0 space-y-6">
        <section aria-labelledby="sql-engine" className={section}>
          <h2
            id="sql-engine"
            className="text-xl font-semibold tracking-[-0.02em]"
          >
            Engine
          </h2>
          {engineState.status === "ready" ? (
            <p role="status" className="mt-2 text-sm text-emerald-300">
              {`DuckDB ${engineState.version} is running with ${tables.length} gold tables, read-only.`}
            </p>
          ) : (
            <>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
                The engine is DuckDB compiled to WebAssembly. It downloads once
                (about 7 MB compressed), runs in its own worker in this tab, and
                holds your own copy of the gold tables. Nothing you type leaves
                the browser, and the database refuses files, the network and
                every change.
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
          <h2
            id="sql-query"
            className="text-xl font-semibold tracking-[-0.02em]"
          >
            Query
          </h2>
          <label
            htmlFor={`${ids}-saved`}
            className="mt-4 block text-sm text-slate-200"
          >
            Saved query
          </label>
          <select
            id={`${ids}-saved`}
            className={`${control} mt-1`}
            value={selectedId}
            onChange={(event) => choose(event.target.value)}
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
          </select>
          {selected && (
            <div className="mt-3 text-sm">
              <p className="leading-relaxed text-slate-300">
                {selected.description}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {`Shows: ${selected.techniques.join(", ")}. Reads: ${selected.tables.join(", ")}.`}
              </p>
              <Dialects query={selected} />
            </div>
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
            value={sql}
            onChange={(event) => {
              setSql(event.target.value);
              setSelectedId("");
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
            {outcome?.kind === "rows" && outcome.result.columns.length > 0 && (
              <button
                type="button"
                className={`${button} min-h-12`}
                onClick={() =>
                  downloadFile(
                    workbenchResultCsv(outcome.result),
                    `${selectedId || "query"}.csv`,
                    { mimeType: "text/csv;charset=utf-8" }
                  )
                }
              >
                Download the rows as CSV
              </button>
            )}
          </div>
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
              : outcome?.kind === "rows"
                ? resultSummary(outcome.result)
                : outcome?.kind === "plan"
                  ? "The plan DuckDB would run, without running it."
                  : ""}
          </p>
          {outcome?.kind === "failed" && (
            <p
              role="alert"
              className="mt-2 whitespace-pre-wrap break-words border-l-2 border-red-500 pl-3 font-mono text-xs text-red-200"
            >
              {outcome.message}
            </p>
          )}
          {outcome?.kind === "rows" && (
            <div className="mt-3 space-y-2">
              <ResultGrid result={outcome.result} />
              {outcome.result.rows.length > GRID_ROWS && (
                <p className="text-xs text-slate-400">
                  {`The grid shows the first ${number.format(GRID_ROWS)} rows; the CSV has all ${number.format(outcome.result.rows.length)}.`}
                </p>
              )}
            </div>
          )}
          {outcome?.kind === "plan" && (
            <pre
              role="region"
              aria-label="Query plan"
              tabIndex={0}
              className="mt-3 max-h-[32rem] overflow-auto border border-white/[0.08] bg-[#13151a] p-3 font-mono text-[11px] leading-snug text-slate-200 focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              {outcome.plan}
            </pre>
          )}
          {!outcome && !running && (
            <p className="mt-2 text-sm text-slate-400">
              {ready
                ? "Run a query to see its rows here."
                : "Rows appear here once the engine is running."}
            </p>
          )}
        </section>
      </div>

      <SchemaBrowser tables={tables} onQuery={queryTable} />
    </div>
  );
}
