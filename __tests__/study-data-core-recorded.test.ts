// @vitest-environment node
/**
 * The committed CDISC CORE findings for every view (#2992). CORE itself runs
 * only in `study-data-core.yml`; this suite fails fast, without Python, when
 * the pipeline's output for any view no longer matches the output CORE was
 * run on, and checks the file is pinned to the engine the workflow runs.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MESSY_DATA_SCENARIOS, STANDARD_VERSIONS } from "@/lib/study-data";
import {
  CORE_VIEWS,
  RECORDED_EXAMPLES_PER_RULE,
  RECORDED_FINDINGS_FILE,
  buildView,
  viewInputSha256,
  type RecordedFindings,
  type RecordedLines,
  type RecordedScenarioView,
} from "../scripts/study-data-core";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const recorded = JSON.parse(read(RECORDED_FINDINGS_FILE)) as RecordedFindings;
const workflow = read(".github/workflows/study-data-core.yml");
const scenarioView = (view: string) =>
  recorded.views[view as keyof RecordedFindings["views"]] as
    RecordedScenarioView | undefined;

describe("recorded CDISC CORE findings (#2992)", () => {
  it("are pinned to the engine study-data-core.yml runs", () => {
    expect(workflow).toContain(`CORE_TAG: ${recorded.lock.tag}`);
    expect(workflow).toContain(`CORE_COMMIT: ${recorded.lock.commit}`);
    expect(recorded.lock.ct.declared).toBe(STANDARD_VERSIONS["NCI-EVS-CT"]);
    expect(recorded.lock.ct.validated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("record the default view and every scenario, and nothing else", () => {
    expect(Object.keys(recorded.views).sort()).toEqual([...CORE_VIEWS].sort());
    expect(CORE_VIEWS).toHaveLength(MESSY_DATA_SCENARIOS.length + 1);
  });

  it("name a recorded rule for every finding, and count every line kept", () => {
    const { sdtm, usdm } = recorded.rules;
    const check = (
      rules: Readonly<Record<string, unknown>>,
      { lines, counts }: RecordedLines,
      where: string
    ) => {
      expect(lines, where).toEqual([...lines].sort());
      const kept = new Map<string, number>();
      for (const line of lines) {
        const key = line.split(" ", 2).join(" ");
        kept.set(key, (kept.get(key) ?? 0) + 1);
        expect(rules[key.split(" ")[0]], `${where} ${line}`).toBeDefined();
      }
      for (const [key, count] of kept) {
        expect(count, `${where} ${key}`).toBe(
          Math.min(counts[key], RECORDED_EXAMPLES_PER_RULE)
        );
      }
      expect([...kept.keys()].sort(), where).toEqual(
        Object.keys(counts).sort()
      );
    };
    check(sdtm, recorded.views.default.sdtm, "default sdtm");
    check(usdm, recorded.views.default.usdm, "default usdm");
    for (const view of CORE_VIEWS.filter((item) => item !== "default")) {
      const change = scenarioView(view)!;
      check(sdtm, change.added, `${view} added`);
      check(sdtm, change.removed, `${view} removed`);
      for (const id of Object.keys(change.status))
        expect(sdtm[id], `${view} ${id}`).toBeDefined();
    }
  });

  it("were recorded from the pipeline's current output for every view", async () => {
    const stale: string[] = [];
    for (const view of CORE_VIEWS) {
      const { files } = await buildView(view);
      const expected =
        view === "default"
          ? recorded.views.default.inputSha256
          : scenarioView(view)?.inputSha256;
      if ((await viewInputSha256(files)) !== expected) stale.push(view);
    }
    expect(
      stale,
      "Refresh lib/study-data/internal/core/recorded-findings.json: see docs/how-to/refresh-cdisc-core-findings.md"
    ).toEqual([]);
  }, 300_000);
});
