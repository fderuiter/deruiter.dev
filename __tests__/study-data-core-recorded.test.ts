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
import {
  CORE_EXAMPLES_SHOWN,
  DEFAULT_SEED,
  DEFAULT_SUBJECT_COUNT,
  MESSY_DATA_SCENARIOS,
  STANDARD_VERSIONS,
  coreViewReport,
  recordedCoreView,
  type RecordedFindings,
  type RecordedLines,
  type RecordedScenarioView,
} from "@/lib/study-data";
import {
  CORE_VIEWS,
  CRF_PRESET_IDS,
  RECORDED_EXAMPLES_PER_RULE,
  RECORDED_FINDINGS_FILE,
  buildView,
  crfInputSha256,
  readAnnotationSources,
  recordedAnnotations,
  viewInputSha256,
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
    for (const preset of CRF_PRESET_IDS) {
      const { usdm: lines, status } = recorded.crf[preset];
      check(usdm, lines, `${preset} usdm`);
      for (const id of Object.keys(status))
        expect(usdm[id], `${preset} ${id}`).toBeDefined();
    }
  });

  it("record every CRF Studio preset's USDM export, and nothing else (#3051)", () => {
    expect(Object.keys(recorded.crf).sort()).toEqual(
      [...CRF_PRESET_IDS].sort()
    );
    expect(workflow).toContain("export-crf");
  });

  it("were recorded from every CRF Studio preset's current USDM export (#3051)", async () => {
    const stale: string[] = [];
    for (const preset of CRF_PRESET_IDS) {
      if ((await crfInputSha256(preset)) !== recorded.crf[preset].inputSha256)
        stale.push(preset);
    }
    expect(
      stale,
      "Refresh lib/study-data/internal/core/recorded-findings.json: see docs/how-to/refresh-cdisc-core-findings.md"
    ).toEqual([]);
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

describe("what the Study Data page shows from the recorded findings (#2992)", () => {
  it("carries the current allowlist reasons and rule twins", () => {
    // After editing the allowlist or the crosswalk, run
    // `npx tsx scripts/study-data-core.ts annotate`.
    const { explained, twins } = recordedAnnotations(readAnnotationSources());
    expect(recorded.explained).toEqual(explained);
    expect(recorded.twins).toEqual(twins);
  });

  it("explains every default-view finding", () => {
    const report = coreViewReport(recorded, "default");
    expect(report.findings.length).toBeGreaterThan(0);
    for (const finding of report.findings) {
      expect(
        finding.explanation,
        `${finding.target} ${finding.coreId} ${finding.dataset}`
      ).toBeDefined();
      expect(finding.addedByScenario).toBe(0);
      expect(finding.examples.length).toBeLessThanOrEqual(CORE_EXAMPLES_SHOWN);
    }
    expect(Object.values(report.outcomes).reduce((sum, n) => sum + n, 0)).toBe(
      report.ruleCount
    );
  });

  it.each(CORE_VIEWS.filter((view) => view !== "default"))(
    "rebuilds the %s view from the default view and its change",
    (view) => {
      const change = scenarioView(view);
      const report = coreViewReport(recorded, view);
      const base = recorded.views.default.sdtm.counts;
      const added = Object.values(change?.added.counts ?? {}).reduce(
        (sum, n) => sum + n,
        0
      );
      const removed = Object.values(change?.removed.counts ?? {}).reduce(
        (sum, n) => sum + n,
        0
      );
      const total = (findings: typeof report.findings) =>
        findings
          .filter((finding) => finding.target === "sdtm")
          .reduce((sum, finding) => sum + finding.count, 0);
      const baseTotal = Object.values(base).reduce((sum, n) => sum + n, 0);
      expect(total(report.findings)).toBe(baseTotal + added - removed);
      expect(report.findings.every((f) => f.target === "sdtm")).toBe(true);
    }
  );

  it("matches only the default study, seed and subject count", () => {
    const defaults = { seed: DEFAULT_SEED, nSubjects: DEFAULT_SUBJECT_COUNT };
    const run = { defaultStudy: true, ...defaults, defaults };
    expect(recordedCoreView(run)).toBe("default");
    expect(recordedCoreView({ ...run, scenario: "impossible-date" })).toBe(
      "impossible-date"
    );
    expect(recordedCoreView({ ...run, seed: DEFAULT_SEED + 1 })).toBeNull();
    expect(
      recordedCoreView({ ...run, nSubjects: DEFAULT_SUBJECT_COUNT + 1 })
    ).toBeNull();
    expect(recordedCoreView({ ...run, defaultStudy: false })).toBeNull();
  });
});
