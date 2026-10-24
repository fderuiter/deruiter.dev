import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADAM_METHODS,
  ADRG_PATH,
  CSDRG_PATH,
  DEMO_301_STUDY,
  SDTM_METHODS,
  buildReviewerGuides,
  buildStudyDataPackage,
  buildTlfOutputs,
  renderReviewerGuideHtml,
  runPipeline,
  writeReviewerGuideDocument,
  type PipelineRun,
} from "@/lib/study-data";

const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });
const { reportingEvent } = buildTlfOutputs(DEMO_301_STUDY, run);
const guides = buildReviewerGuides(run, reportingEvent);
const GOLDEN = resolve(
  process.cwd(),
  "__tests__/fixtures/study-data/guides/seed-301.json"
);
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("reviewer guides", () => {
  it("matches the seed-301 golden", () => {
    expect(JSON.parse(JSON.stringify(guides))).toEqual(
      JSON.parse(readFileSync(GOLDEN, "utf8"))
    );
  });

  it("regenerates with the run", () => {
    expect(buildReviewerGuides(run, reportingEvent)).toEqual(guides);
    const other = runPipeline(DEMO_301_STUDY, { seed: 302, nSubjects: 40 });
    const regenerated = buildReviewerGuides(other);
    expect(regenerated.csdrg.seed).toBe(302);
    expect(regenerated.csdrg.nSubjects).toBe(40);
    const dm = regenerated.csdrg.datasets.find((d) => d.name === "DM");
    expect(dm?.records).toBe(40);
    const counts = (guide: typeof guides.csdrg) =>
      guide.conformance.issues.map((issue) => issue.count);
    expect(counts(regenerated.csdrg)).not.toEqual(counts(guides.csdrg));
  });

  it("describes each layer's datasets beside their XPT files", () => {
    const names = (layer: "sdtm" | "adam") =>
      run.datasets.filter((d) => d.layer === layer).map((d) => d.name);
    expect(guides.csdrg.datasets.map((d) => d.name)).toEqual(names("sdtm"));
    expect(guides.adrg.datasets.map((d) => d.name)).toEqual(names("adam"));
    expect(guides.csdrg.datasets[0]?.file).toBe(
      `${guides.csdrg.datasets[0]?.name.toLowerCase()}.xpt`
    );
    expect(guides.adrg.datasets.find((d) => d.name === "ADTTE")?.class).toBe(
      "BDS (TIME-TO-EVENT)"
    );
  });

  it("states the standards with the versions the run pinned", () => {
    for (const guide of [guides.csdrg, guides.adrg]) {
      for (const { standard, version } of guide.standards) {
        expect(version).toBe(run.manifest.standards[standard]);
      }
    }
    expect(guides.csdrg.standards.map((s) => s.standard)).toContain("SDTMIG");
    expect(guides.adrg.standards.map((s) => s.standard)).toContain("ARS");
  });

  it("explains every expected finding and counts it from the run", () => {
    const issues = guides.csdrg.conformance.issues;
    expect(issues.map((issue) => issue.ruleId).sort()).toEqual([
      "SD-031",
      "SD-032",
      "SD-033",
      "SD-034",
    ]);
    for (const issue of issues) {
      expect(issue.expected).toBe(true);
      expect(issue.count).toBe(
        run.findings.filter(
          (f) => f.ruleId === issue.ruleId && f.dataset === issue.dataset
        ).length
      );
      expect(issue.explanation).not.toMatch(/defect/);
    }
    expect(guides.adrg.conformance.issues).toEqual([]);
  });

  it("marks a finding the generator does not produce on purpose as unexpected", () => {
    const broken: PipelineRun = {
      ...run,
      findings: [
        ...run.findings,
        {
          ruleId: "SD-001",
          severity: "error",
          layer: "sdtm",
          dataset: "DM",
          variable: "USUBJID",
          row: 0,
          message: "Required variable is missing.",
        },
      ],
      conformance: {
        ...run.conformance,
        status: "failed",
        ruleResults: [
          ...run.conformance.ruleResults,
          {
            ruleId: "SD-001",
            dataset: "DM",
            status: "error",
            findingCount: 1,
            citation: "SDTMIG 3.4",
          },
        ],
      },
    };
    const issue = buildReviewerGuides(broken).csdrg.conformance.issues.find(
      (item) => item.ruleId === "SD-001"
    );
    expect(issue).toMatchObject({
      severity: "error",
      expected: false,
      message: "Required variable is missing.",
    });
    expect(issue?.explanation).toMatch(/defect/);
  });

  it("lists every derivation method a derived variable names", () => {
    for (const [guide, layer, methods] of [
      [guides.csdrg, "sdtm", SDTM_METHODS],
      [guides.adrg, "adam", ADAM_METHODS],
    ] as const) {
      const derived = run.datasets
        .filter((d) => d.layer === layer)
        .flatMap((d) =>
          d.variables.flatMap((v) => (v.method ? [`${d.name}.${v.name}`] : []))
        );
      expect(
        guide.derivations.flatMap((derivation) => derivation.variables).sort()
      ).toEqual(derived.sort());
      for (const derivation of guide.derivations) {
        expect(derivation.text).toBe(
          (methods as Record<string, string>)[derivation.id]
        );
      }
    }
  });

  it("indexes every ARS output and its analyses in the ADRG only", () => {
    expect(guides.csdrg.outputs).toBeUndefined();
    expect(guides.adrg.outputs?.map((output) => output.id)).toEqual(
      reportingEvent.outputs.map((output) => output.id)
    );
    const analyses = guides.adrg.outputs?.flatMap((o) => o.analyses) ?? [];
    expect(analyses.length).toBeGreaterThan(0);
    for (const analysis of analyses) {
      const source = reportingEvent.analyses.find((a) => a.id === analysis.id);
      expect(source?.dataset).toBe(analysis.dataset);
      expect(analysis.population).not.toMatch(/^AnalysisSet_/);
    }
    expect(buildReviewerGuides(run).adrg.outputs).toBeUndefined();
  });

  it("renders a labelled article with every section", () => {
    const csdrg = renderReviewerGuideHtml(guides.csdrg);
    const adrg = renderReviewerGuideHtml(guides.adrg);
    expect(csdrg).toMatch(/^<article aria-labelledby="csdrg-title">/);
    expect(csdrg).toContain("Synthetic data for demonstration.");
    for (const heading of [
      "1. Introduction",
      "2. Standards and versions",
      "3. Data flow",
      "4. Datasets",
      "5. Conformance",
      "6. Derivations",
    ]) {
      expect(csdrg).toContain(heading);
      expect(adrg).toContain(heading);
    }
    expect(csdrg).not.toContain("7. Analysis outputs");
    expect(adrg).toContain("7. Analysis outputs");
    expect(csdrg).toContain("SD-031 on SV");
    expect(csdrg).toContain("(expected)");
    expect(csdrg).toContain("Study definition → Collected data → SDTM");
    expect(adrg).toContain("Reviewer&#39;s Guide");
  });

  it("escapes text from the run", () => {
    const html = renderReviewerGuideHtml({
      ...guides.csdrg,
      title: 'A <b>"bold"</b> & guide',
    });
    expect(html).toContain("A &lt;b&gt;&quot;bold&quot;&lt;/b&gt; &amp; guide");
    expect(html).not.toContain("<b>");
  });

  it("ships both guides in the package beside their datasets", async () => {
    const pkg = await buildStudyDataPackage(run, {
      generatedAt: "2026-10-23T12:00:00.000Z",
      reportingEvent,
    });
    const file = (path: string) => pkg.files.find((f) => f.path === path);
    expect(file(CSDRG_PATH)?.mediaType).toBe("text/html");
    expect(text(file(CSDRG_PATH)!.bytes)).toBe(
      writeReviewerGuideDocument(guides.csdrg)
    );
    expect(text(file(ADRG_PATH)!.bytes)).toBe(
      writeReviewerGuideDocument(guides.adrg)
    );
    expect(text(file(ADRG_PATH)!.bytes)).toMatch(
      /^<!doctype html>\n<html lang="en">/
    );
    expect(pkg.manifest.outputs.map((entry) => entry.path)).toEqual(
      expect.arrayContaining([CSDRG_PATH, ADRG_PATH])
    );
    const readme = text(file("README.txt")!.bytes);
    expect(readme).toContain(CSDRG_PATH);
    expect(readme).toContain(ADRG_PATH);
  });
});
