import { describe, expect, it } from "vitest";
import {
  DEFAULT_LINEAGE_LIMIT,
  DEMO_301_STUDY,
  buildTlfOutputs,
  createLineageIndex,
  runPipeline,
  type DataLayer,
  type Dataset,
  type LineageRecord,
  type TlfTable,
} from "@/lib/study-data";

const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 40 });
const outputs = buildTlfOutputs(DEMO_301_STUDY, run);
const index = createLineageIndex(DEMO_301_STUDY, run, outputs);
const ALL = { limit: 100_000 };

function dataset(layer: DataLayer, name: string): Dataset {
  const found = run.datasets.find(
    (item) => item.layer === layer && item.name === name
  );
  if (!found) throw new Error(`No ${layer} ${name}`);
  return found;
}

function lineageOf(record: LineageRecord): readonly string[] {
  return dataset(record.layer, record.dataset).lineage?.[record.row] ?? [];
}

function table(number: string): TlfTable {
  const found = outputs.tables.find((item) => item.number === number);
  if (!found) throw new Error(`No table ${number}`);
  return found;
}

/** Week 12 observed value, Mean, first treatment column, of Table 14.2.1. */
function week12MeanCell() {
  const section = table("14.2.1").sections.find((item) =>
    item.label.startsWith("Week 12, observed")
  );
  const cell = section?.rows.find((row) => row.label === "Mean")?.cells[0];
  if (!cell) throw new Error("No Week 12 mean cell");
  return cell;
}

describe("study data lineage: from a displayed result back to the protocol", () => {
  const cell = week12MeanCell();
  const trace = index.trace({ kind: "result", resultIds: cell.resultIds }, ALL);

  it("starts at the result and names the cell it is displayed in", () => {
    expect(trace.originLevel).toBe("result");
    expect(trace.title).toContain("Table 14.2.1");
    expect(trace.title).toContain("Week 12");
    expect(trace.results.total).toBe(cell.resultIds.length);
    for (const result of trace.results.items) {
      expect(result.display?.outputName).toBe("Table 14.2.1");
      expect(result.display?.resultIds).toEqual(cell.resultIds);
    }
  });

  it("lists the analysis rows the result is computed from, and counts its population", () => {
    expect(trace.adam.total).toBeGreaterThan(0);
    expect(trace.adam.items.every((item) => item.dataset === "ADVS")).toBe(
      true
    );
    expect(trace.adam.items.every((item) => item.relation === "primary")).toBe(
      true
    );
    expect(trace.populationRows).toBeGreaterThan(0);
  });

  it("walks back to SDTM by the subset rule: every record is contained in some analysis row's lineage", () => {
    const adamLineages = trace.adam.items.map(
      (item) => new Set(lineageOf(item))
    );
    expect(trace.sdtm.total).toBeGreaterThan(0);
    for (const record of trace.sdtm.items) {
      const ids = lineageOf(record);
      expect(ids.length).toBeGreaterThan(0);
      expect(adamLineages.some((set) => ids.every((id) => set.has(id)))).toBe(
        true
      );
    }
  });

  it("marks the traced domain as direct and reference records as supporting", () => {
    const domains = new Map<string, Set<string>>();
    for (const record of trace.sdtm.items) {
      const set = domains.get(record.dataset) ?? new Set<string>();
      set.add(record.relation);
      domains.set(record.dataset, set);
    }
    expect([...(domains.get("VS") ?? [])]).toEqual(["primary"]);
    for (const [name, relations] of domains) {
      if (name !== "VS") expect([...relations]).toEqual(["linked"]);
    }
  });

  it("reaches the collected values and the Week 12 vital signs activity", () => {
    expect(trace.collected.total).toBeGreaterThan(0);
    const vs = trace.schedule.items.find(
      (entry) => entry.activityId === "act_vs"
    );
    expect(vs?.relation).toBe("primary");
    expect(vs?.basis).toBe("visit");
    expect(vs?.visits.map((visit) => visit.id)).toEqual(["enc_week12"]);
  });

  it("follows every displayed result id in the tables to analysis rows", () => {
    const ids = outputs.tables
      .flatMap((item) => item.sections)
      .flatMap((section) => section.rows)
      .flatMap((row) => row.cells)
      .flatMap((item) => item.resultIds);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids.slice(0, 25)) {
      expect(index.displayOf(id)?.resultIds).toContain(id);
    }
  });
});

describe("study data lineage: from a record", () => {
  it("walks an ADaM row back to the SDTM record its SRCDOM and SRCSEQ name", () => {
    const advs = dataset("adam", "ADVS");
    const row = advs.columns.SRCSEQ.findIndex(
      (value) => typeof value === "number"
    );
    expect(row).toBeGreaterThanOrEqual(0);
    const trace = index.trace(
      { kind: "record", layer: "adam", dataset: "ADVS", row },
      ALL
    );
    expect(trace.originLevel).toBe("adam");
    expect(trace.adam.items[0]).toMatchObject({
      dataset: "ADVS",
      row,
      relation: "origin",
    });
    const vs = dataset("sdtm", "VS");
    const named = trace.sdtm.items.filter(
      (item) =>
        item.dataset === advs.columns.SRCDOM[row] &&
        vs.columns.VSSEQ[item.row] === advs.columns.SRCSEQ[row] &&
        vs.columns.USUBJID[item.row] === advs.columns.USUBJID[row]
    );
    expect(named).toHaveLength(1);
    expect(named[0].relation).toBe("primary");
  });

  it("walks a collected value forward to every SDTM and ADaM row that carries it", () => {
    const collected = dataset("collected", "VS");
    const srcid = collected.columns.SRCID[0];
    expect(typeof srcid).toBe("string");
    const trace = index.trace(
      { kind: "record", layer: "collected", dataset: "VS", row: 0 },
      ALL
    );
    expect(trace.originLevel).toBe("collected");
    expect(trace.sdtm.total).toBeGreaterThan(0);
    for (const record of [...trace.sdtm.items, ...trace.adam.items]) {
      expect(lineageOf(record)).toContain(srcid);
    }
  });

  it("explains that trial design records are read from the definition, not collected", () => {
    const tv = dataset("sdtm", "TV");
    const trace = index.trace({
      kind: "record",
      layer: "sdtm",
      dataset: "TV",
      row: tv.rowCount - 1,
    });
    expect(trace.collected.total).toBe(0);
    expect(trace.collected.note).toMatch(/study definition/);
    expect(trace.schedule.items[0]?.domain).toBe("TV");
  });
});

describe("study data lineage: forward from the schedule of activities", () => {
  it("collects every vital sign at one visit and follows it to results", () => {
    const trace = index.trace(
      { kind: "activity", activityId: "act_vs", visitId: "enc_week12" },
      ALL
    );
    expect(trace.originLevel).toBe("schedule");
    expect(trace.title).toContain("WEEK 12");
    expect(trace.collected.total).toBeGreaterThan(0);
    expect(trace.collected.items.every((item) => item.dataset === "VS")).toBe(
      true
    );
    expect(trace.sdtm.total).toBeGreaterThan(0);
    expect(trace.adam.total).toBeGreaterThan(0);
    expect(trace.results.total).toBeGreaterThan(0);
  });

  it("covers every planned visit when no visit is given", () => {
    const one = index.trace({
      kind: "activity",
      activityId: "act_vs",
      visitId: "enc_week12",
    });
    const all = index.trace({ kind: "activity", activityId: "act_vs" });
    expect(all.collected.total).toBeGreaterThan(one.collected.total);
    expect(all.schedule.items[0]?.visits.length).toBeGreaterThan(1);
  });
});

describe("study data lineage: limits and errors", () => {
  it("lists at most the limit per level while the totals count everything", () => {
    const origin = { kind: "activity", activityId: "act_vs" } as const;
    const listed = index.trace(origin);
    expect(DEFAULT_LINEAGE_LIMIT).toBe(40);
    expect(listed.collected.items).toHaveLength(DEFAULT_LINEAGE_LIMIT);
    expect(listed.collected.total).toBeGreaterThan(DEFAULT_LINEAGE_LIMIT);
    const three = index.trace(origin, { limit: 3 });
    expect(three.sdtm.items).toHaveLength(3);
    expect(three.sdtm.total).toBe(listed.sdtm.total);
  });

  it("rejects starts the run does not have", () => {
    expect(() => index.trace({ kind: "result", resultIds: [] })).toThrow(
      RangeError
    );
    expect(() =>
      index.trace({ kind: "result", resultIds: ["NO_SUCH_RESULT"] })
    ).toThrow(/no result/);
    expect(() =>
      index.trace({ kind: "record", layer: "sdtm", dataset: "ZZ", row: 0 })
    ).toThrow(RangeError);
    expect(() =>
      index.trace({ kind: "record", layer: "sdtm", dataset: "VS", row: -1 })
    ).toThrow(RangeError);
    expect(() =>
      index.trace({
        kind: "record",
        layer: "sdtm",
        dataset: "VS",
        row: dataset("sdtm", "VS").rowCount,
      })
    ).toThrow(RangeError);
    expect(() =>
      index.trace({ kind: "activity", activityId: "act_none" })
    ).toThrow(/no activity/);
    expect(() =>
      index.trace({
        kind: "activity",
        activityId: "act_vs",
        visitId: "enc_none",
      })
    ).toThrow(/no visit/);
    expect(() =>
      index.trace({
        kind: "activity",
        activityId: "act_dm",
        visitId: "enc_week12",
      })
    ).toThrow(/not planned/);
  });

  it("refuses a run of another study", () => {
    const other = { ...DEMO_301_STUDY, studyId: "OTHER-1" };
    expect(() => createLineageIndex(other, run, outputs)).toThrow(RangeError);
  });
});
