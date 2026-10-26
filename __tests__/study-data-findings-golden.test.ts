// @vitest-environment node
/**
 * Recorded conformance findings (#2994). The default run's findings and each
 * "Inject an issue" scenario's change to them are committed, so any change to
 * a rule, the generator or a scenario shows up as a reviewable diff, and no
 * scenario can stop being caught without a test failing.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEED,
  DEFAULT_SUBJECT_COUNT,
  DEMO_301_STUDY,
  MESSY_DATA_SCENARIOS,
  runPipeline,
  type Finding,
  type PipelineRun,
  type ScenarioId,
} from "@/lib/study-data";

/**
 * One finding as a line: rule, layer, dataset, the record and the variable.
 * The record is named by subject and sequence number (or, without a --SEQ,
 * its position among the subject's records), not by row index, so a
 * scenario that adds a row does not renumber every finding after it.
 */
function line(run: PipelineRun, finding: Finding): string {
  const data = run.datasets.find(
    (item) => item.layer === finding.layer && item.name === finding.dataset
  );
  let record = "-";
  if (data && finding.row !== undefined) {
    const subjects = data.columns.USUBJID ?? [];
    const subject = subjects[finding.row] ?? "-";
    const sequence = data.columns[`${data.name}SEQ`]?.[finding.row];
    const position = subjects
      .slice(0, finding.row + 1)
      .filter((item) => item === subject).length;
    record = `${subject}#${sequence ?? position}`;
  }
  return [
    finding.ruleId,
    finding.layer,
    finding.dataset ?? "-",
    record,
    finding.variable ?? "-",
  ].join(" ");
}

function findings(scenarios: readonly ScenarioId[] = []): string[] {
  const run = runPipeline(DEMO_301_STUDY, {
    seed: DEFAULT_SEED,
    nSubjects: DEFAULT_SUBJECT_COUNT,
    scenarios,
  });
  return run.findings.map((finding) => line(run, finding));
}

/** Lines in `next` but not `base`, and in `base` but not `next`, by count. */
function difference(base: readonly string[], next: readonly string[]) {
  const count = (lines: readonly string[]) => {
    const counts = new Map<string, number>();
    for (const item of lines) counts.set(item, (counts.get(item) ?? 0) + 1);
    return counts;
  };
  const before = count(base);
  const after = count(next);
  const extra = (a: Map<string, number>, b: Map<string, number>) =>
    [...a].flatMap(([item, n]) =>
      Array<string>(Math.max(0, n - (b.get(item) ?? 0))).fill(item)
    );
  return { added: extra(after, before), removed: extra(before, after) };
}

const golden = JSON.parse(
  readFileSync(
    resolve(
      process.cwd(),
      "__tests__/fixtures/study-data/findings/seed-301.json"
    ),
    "utf8"
  )
) as {
  readonly default: readonly string[];
  readonly scenarios: Readonly<
    Record<string, { readonly added: string[]; readonly removed: string[] }>
  >;
};
const base = findings();

describe("recorded conformance findings", () => {
  it("match the default run's golden findings", () => {
    expect(base).toEqual(golden.default);
  });

  it.each(MESSY_DATA_SCENARIOS.map((scenario) => scenario.id))(
    "match the golden change for the %s scenario",
    (id) => {
      const change = difference(base, findings([id]));
      expect(change).toEqual(golden.scenarios[id]);
      const scenario = MESSY_DATA_SCENARIOS.find((item) => item.id === id)!;
      const raised = new Set(change.added.map((item) => item.split(" ")[0]));
      for (const ruleId of scenario.expected.findings)
        expect(raised.has(ruleId), `${id} raises ${ruleId}`).toBe(true);
    },
    120_000
  );

  it("records every scenario and no other", () => {
    expect(Object.keys(golden.scenarios).sort()).toEqual(
      MESSY_DATA_SCENARIOS.map((scenario) => scenario.id).sort()
    );
  });
});
