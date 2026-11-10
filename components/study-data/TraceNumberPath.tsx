"use client";

/**
 * A guided, three-step path from one reported number to the data behind it
 * (#3158). It adds no data source: it reads the same run the rest of
 * /study-data reads.
 *
 * How a TLF number links to its lineage, as the workbench already wires it:
 *
 * - Each `TlfTable` cell (`TlfCell`) carries `resultIds`, the ids of the ARS
 *   analysis results its text is made from. `TlfPanel` writes them to the
 *   cell's `data-ars-results` attribute and passes them to `onTrace`.
 * - `StudyDataWorkbench.traceFrom({ kind: "result", resultIds })` sends a
 *   `trace` request to the pipeline worker, which answers with a
 *   `LineageTrace`: the results (`results`, with each analysis and its
 *   operation), the ADaM rows they were computed from (`adam`), the SDTM
 *   records those rows name in SRCDOM and SRCSEQ (`sdtm`), the collected
 *   records behind them (`collected`) and the population count
 *   (`populationRows`).
 * - `LineageExplorer` shows every level of that trace at once. This path
 *   shows the same trace one question at a time: which number, which rows,
 *   which rule.
 *
 * Step 1 picks a number, step 2 lists its ADaM and SDTM rows, step 3 names
 * the analysis and operation that produced it. "Show me the rows" opens the
 * first source row in the Datasets tab.
 */
import { useId, useState } from "react";
import type { LineageRecord, LineageTrace, TlfTable } from "@/lib/study-data";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, EYEBROW, FOCUS, PANEL } from "./ui";

interface TraceNumberPathProps {
  readonly tables: readonly TlfTable[];
  /** The latest trace of the run, whatever started it. */
  readonly trace: LineageTrace | null;
  readonly busy: boolean;
  readonly error: string | null;
  /** Traces the results one displayed cell shows. */
  readonly onTrace: (resultIds: readonly string[]) => void;
  /** Opens one record in the Datasets tab. */
  readonly onViewRecord: (record: LineageRecord) => void;
}

/** A number the visitor can pick, with where it sits in its table. */
interface PickableNumber {
  readonly key: string;
  readonly text: string;
  /** Section, row and column, for example `Age (years) · Mean · Placebo`. */
  readonly location: string;
  readonly resultIds: readonly string[];
}

/** Numbers listed for one table; the full table stays on the Tables tab. */
const NUMBERS_SHOWN = 12;

type Step = 1 | 2 | 3;

const STEP_NAMES: Readonly<Record<Step, string>> = {
  1: "Pick a number",
  2: "See the rows it came from",
  3: "See the rule applied",
};

function pickableNumbers(table: TlfTable): PickableNumber[] {
  const numbers: PickableNumber[] = [];
  for (const section of table.sections) {
    const rows = [
      ...(section.cells ? [{ id: "", label: "", cells: section.cells }] : []),
      ...section.rows,
    ];
    for (const row of rows) {
      row.cells.forEach((cell, index) => {
        if (cell.resultIds.length === 0) return;
        const column = table.columns[index]?.label ?? `Column ${index + 1}`;
        numbers.push({
          key: `${section.id}:${row.id}:${index}`,
          text: cell.text,
          location: [section.label, row.label, column]
            .filter((part) => part !== "")
            .join(" · "),
          resultIds: cell.resultIds,
        });
      });
    }
  }
  return numbers;
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function RecordList({
  title,
  records,
  total,
}: {
  readonly title: string;
  readonly records: readonly LineageRecord[];
  readonly total: number;
}) {
  return (
    <div className="min-w-0">
      <h4 className="font-mono text-xs uppercase tracking-[0.14em] text-slate-400">
        {title} ({total.toLocaleString("en-US")})
      </h4>
      {records.length === 0 ? (
        <p className="mt-2 text-sm text-slate-300">No rows at this level.</p>
      ) : (
        <ul className="mt-2 space-y-2" data-testid={`trace-path-${title}`}>
          {records.slice(0, 5).map((record) => (
            <li
              key={`${record.layer}:${record.dataset}:${record.row}`}
              className="min-w-0 border border-white/[0.08] bg-[#0d0e11] px-3 py-2"
            >
              <span className="block break-words font-mono text-xs text-amber-200">
                {record.dataset} · row {record.row + 1} · {record.key}
              </span>
              <span className="mt-1 block break-words font-mono text-xs text-slate-300">
                {record.summary}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The "Trace a number" tab of /study-data. */
export function TraceNumberPath({
  tables,
  trace,
  busy,
  error,
  onTrace,
  onViewRecord,
}: TraceNumberPathProps) {
  const id = useId();
  const [step, setStep] = useState<Step>(1);
  const [tableId, setTableId] = useState(tables[0]?.outputId ?? "");
  const [picked, setPicked] = useState<PickableNumber | null>(null);

  const table =
    tables.find((item) => item.outputId === tableId) ?? tables[0] ?? null;
  const numbers = table ? pickableNumbers(table).slice(0, NUMBERS_SHOWN) : [];
  const ready =
    picked !== null &&
    trace !== null &&
    trace.origin.kind === "result" &&
    sameIds(trace.origin.resultIds, picked.resultIds)
      ? trace
      : null;
  const firstRow = ready?.adam.items[0] ?? ready?.sdtm.items[0] ?? null;

  const pick = (number: PickableNumber) => {
    setPicked(number);
    setStep(2);
    onTrace(number.resultIds);
  };

  const headingId = `${id}-heading`;
  const showRows = (
    <button
      type="button"
      className={BUTTON_SECONDARY}
      disabled={!firstRow}
      onClick={() => {
        if (firstRow) onViewRecord(firstRow);
      }}
    >
      Show me the rows
    </button>
  );
  const back = (to: Step) => (
    <button
      type="button"
      className={BUTTON_SECONDARY}
      onClick={() => setStep(to)}
    >
      Back
    </button>
  );

  return (
    <section
      aria-labelledby={headingId}
      className={`${PANEL} p-4 sm:p-6`}
      data-testid="trace-number-path"
    >
      <p className={EYEBROW}>Step {step} of 3</p>
      <h3
        id={headingId}
        className="mt-2 text-xl font-semibold tracking-[-0.035em]"
      >
        {STEP_NAMES[step]}
      </h3>
      <ol className="mt-3 flex min-w-0 flex-wrap gap-2" aria-label="Steps">
        {([1, 2, 3] as const).map((item) => (
          <li
            key={item}
            aria-current={item === step ? "step" : undefined}
            className={`border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em] ${item === step ? "border-amber-500/60 text-amber-200" : "border-white/[0.08] text-slate-400"}`}
          >
            {item}. {STEP_NAMES[item]}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="mt-5 min-w-0 space-y-4">
          <p className="max-w-3xl text-sm leading-relaxed text-slate-300">
            Every number in a study report is computed from analysis rows, and
            every analysis row comes from a collected record. Choose a table,
            then a number in it.
          </p>
          <div className="flex min-w-0 flex-col gap-2 sm:max-w-md">
            <label
              htmlFor={`${id}-table`}
              className="font-mono text-xs uppercase tracking-[0.14em] text-slate-400"
            >
              Table
            </label>
            <select
              id={`${id}-table`}
              value={table?.outputId ?? ""}
              onChange={(event) => setTableId(event.target.value)}
              className={`min-h-12 min-w-0 border border-zinc-700 bg-[#0d0e11] px-3 text-sm text-white ${FOCUS}`}
            >
              {tables.map((item) => (
                <option key={item.outputId} value={item.outputId}>
                  Table {item.number}: {item.title}
                </option>
              ))}
            </select>
          </div>
          <ul
            aria-label="Numbers in this table"
            className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3"
          >
            {numbers.map((number) => (
              <li key={number.key} className="min-w-0">
                <button
                  type="button"
                  onClick={() => pick(number)}
                  className={`${BUTTON_SECONDARY} h-full w-full flex-col items-start justify-start py-2 text-left`}
                >
                  <span className="font-mono text-base tabular-nums text-white">
                    {number.text}
                  </span>
                  <span className="break-words text-xs text-slate-400">
                    {number.location}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {step !== 1 && picked ? (
        <p className="mt-5 min-w-0 break-words border-l-2 border-amber-500 pl-3 text-sm text-slate-200">
          <span className="font-mono tabular-nums text-white">
            {picked.text}
          </span>{" "}
          in Table {table?.number}: {picked.location}
        </p>
      ) : null}

      {step !== 1 && error ? (
        <p role="alert" className="mt-4 text-sm text-amber-200">
          The trace failed: {error}
        </p>
      ) : null}

      {step !== 1 && !ready && !error ? (
        <p className="mt-4 text-sm text-slate-300" aria-live="polite">
          {busy ? "Tracing the number…" : "Waiting for the trace…"}
        </p>
      ) : null}

      {step === 2 && ready ? (
        <div className="mt-5 min-w-0 space-y-4">
          <p className="max-w-3xl text-sm leading-relaxed text-slate-300">
            The number was computed from these ADaM analysis rows. Each ADaM row
            names the SDTM record it was derived from.
          </p>
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <RecordList
              title="ADaM"
              records={ready.adam.items}
              total={ready.adam.total}
            />
            <RecordList
              title="SDTM"
              records={ready.sdtm.items}
              total={ready.sdtm.total}
            />
          </div>
        </div>
      ) : null}

      {step === 3 && ready ? (
        <div className="mt-5 min-w-0 space-y-3">
          <p className="max-w-3xl text-sm leading-relaxed text-slate-300">
            The analysis below turned those rows into the number.
          </p>
          <ul className="space-y-2" data-testid="trace-path-rules">
            {ready.results.items.slice(0, 5).map((result) => (
              <li
                key={result.resultId}
                className="min-w-0 border border-white/[0.08] bg-[#0d0e11] px-3 py-2 text-sm"
              >
                <span className="block break-words text-white">
                  {result.analysisName}
                </span>
                <span className="mt-1 block break-words font-mono text-xs text-slate-300">
                  {result.operation} = {result.formattedValue} ·{" "}
                  {result.analysisId}
                </span>
              </li>
            ))}
          </ul>
          {ready.populationRows !== undefined ? (
            <p className="text-sm text-slate-300">
              Population: {ready.populationRows.toLocaleString("en-US")}{" "}
              subjects in ADSL.
            </p>
          ) : null}
          <p className="text-sm text-slate-300">
            {ready.adam.total.toLocaleString("en-US")} ADaM rows feed it, from{" "}
            {ready.sdtm.total.toLocaleString("en-US")} SDTM records and{" "}
            {ready.collected.total.toLocaleString("en-US")} collected records.
          </p>
        </div>
      ) : null}

      {step !== 1 ? (
        <div className="mt-6 flex min-w-0 flex-wrap gap-2">
          {back(step === 3 ? 2 : 1)}
          {showRows}
          {step === 2 ? (
            <button
              type="button"
              className={BUTTON_PRIMARY}
              disabled={!ready}
              onClick={() => setStep(3)}
            >
              See the rule
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
