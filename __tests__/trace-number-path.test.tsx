import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  buildTlfOutputs,
  createLineageIndex,
  DEMO_301_STUDY,
  runPipeline,
  type LineageIndex,
  type LineageRecord,
  type LineageTrace,
  type TlfOutputs,
} from "@/lib/study-data";
import { TraceNumberPath } from "@/components/study-data/TraceNumberPath";

let outputs: TlfOutputs;
let lineage: LineageIndex;

beforeAll(() => {
  const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 12 });
  outputs = buildTlfOutputs(DEMO_301_STUDY, run);
  lineage = createLineageIndex(DEMO_301_STUDY, run, outputs);
});

afterEach(cleanup);

/** Wires the path to a real lineage index, the way the worker answers it. */
function Harness({
  onViewRecord,
}: {
  readonly onViewRecord: (record: LineageRecord) => void;
}) {
  const [trace, setTrace] = useState<LineageTrace | null>(null);
  return (
    <TraceNumberPath
      tables={outputs.tables}
      trace={trace}
      busy={false}
      error={null}
      onTrace={(resultIds) =>
        setTrace(lineage.trace({ kind: "result", resultIds }, { limit: 40 }))
      }
      onViewRecord={onViewRecord}
    />
  );
}

describe("TraceNumberPath (#3158)", () => {
  it("lists at least one number in step 1, under a heading", () => {
    render(<Harness onViewRecord={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Pick a number" })).toBeTruthy();
    const list = screen.getByRole("list", { name: "Numbers in this table" });
    expect(list.querySelectorAll("button").length).toBeGreaterThan(0);
  });

  it("shows at least one source row after a number is picked", () => {
    render(<Harness onViewRecord={vi.fn()} />);
    const list = screen.getByRole("list", { name: "Numbers in this table" });
    fireEvent.click(list.querySelector("button")!);
    expect(
      screen.getByRole("heading", { name: "See the rows it came from" })
    ).toBeTruthy();
    const adam = screen.getByTestId("trace-path-ADaM");
    expect(adam.querySelectorAll("li").length).toBeGreaterThan(0);
  });

  it("opens the first source row with Show me the rows", () => {
    const onViewRecord = vi.fn();
    render(<Harness onViewRecord={onViewRecord} />);
    const list = screen.getByRole("list", { name: "Numbers in this table" });
    fireEvent.click(list.querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: "Show me the rows" }));
    expect(onViewRecord).toHaveBeenCalledTimes(1);
    expect(onViewRecord.mock.calls[0][0].layer).toBe("adam");
  });

  it("names the analysis in step 3 and steps back to step 1", () => {
    render(<Harness onViewRecord={vi.fn()} />);
    const list = screen.getByRole("list", { name: "Numbers in this table" });
    fireEvent.click(list.querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: "See the rule" }));
    expect(
      screen.getByRole("heading", { name: "See the rule applied" })
    ).toBeTruthy();
    expect(
      screen.getByTestId("trace-path-rules").querySelectorAll("li").length
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.getByRole("heading", { name: "See the rows it came from" })
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Pick a number" })).toBeTruthy();
  });

  it("lists the numbers of another table when the table changes", () => {
    render(<Harness onViewRecord={vi.fn()} />);
    const select = screen.getByLabelText("Table") as HTMLSelectElement;
    const second = outputs.tables[1];
    fireEvent.change(select, { target: { value: second.outputId } });
    expect(select.value).toBe(second.outputId);
    const list = screen.getByRole("list", { name: "Numbers in this table" });
    expect(list.querySelectorAll("button").length).toBeGreaterThan(0);
  });
});
