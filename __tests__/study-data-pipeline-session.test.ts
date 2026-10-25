import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { createStudyDataSession } from "@/components/study-data/pipeline-session";
import { CNS_NEURO_PRESET, exportStudyToUsdmObject } from "@/lib/crf";
import type {
  PackageFileResult,
  PreparedStudy,
  RowWindow,
  RunSummary,
  StudyDataRequest,
} from "@/components/study-data/protocol";
import type { LineageTrace, ScenarioId } from "@/lib/study-data";

type Session = ReturnType<typeof createStudyDataSession>;
type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;

let nextId = 1;
function ask(session: Session, request: WithoutId<StudyDataRequest>) {
  return session.handle({ ...request, id: nextId++ });
}

async function startRun(session: Session, seed = 7, nSubjects = 24) {
  return (await ask(session, { type: "run", seed, nSubjects })) as RunSummary;
}

describe("study data pipeline session", () => {
  it("summarises a run without posting dataset values or the ARS model", async () => {
    const session = createStudyDataSession();
    const summary = await startRun(session);
    expect(summary).toMatchObject({ runId: 1, seed: 7, nSubjects: 24 });
    expect(summary.counts.collected.subjects).toBe(24);
    expect(summary.counts.sdtm.records).toBeGreaterThan(0);
    expect(summary.counts.adam.records).toBeGreaterThan(0);
    expect(summary.counts.tlf.tables).toBe(summary.tables.length);
    expect(summary.counts.tlf.figures).toBe(summary.figures.length);
    expect(summary.counts.conformance.checks).toBe(
      summary.conformance.ruleResults.length
    );
    expect(summary.findings.items.length).toBeLessThanOrEqual(200);
    const layers = new Set(summary.datasets.map((dataset) => dataset.layer));
    expect([...layers].sort()).toEqual(["adam", "collected", "sdtm"]);
    for (const dataset of summary.datasets) {
      expect(dataset).not.toHaveProperty("columns");
      expect(dataset).not.toHaveProperty("lineage");
      expect(dataset.key).toBe(`${dataset.layer}:${dataset.name}`);
    }
    expect(summary).not.toHaveProperty("reportingEvent");
    expect(JSON.stringify(summary)).not.toContain('"rowSets"');
  });

  it("gives the same counts for the same seed and subject count", async () => {
    const first = await startRun(createStudyDataSession(), 11, 20);
    const second = await startRun(createStudyDataSession(), 11, 20);
    expect(second.counts).toEqual(first.counts);
  });

  it("serves bounded windows of rows in variable order", async () => {
    const session = createStudyDataSession();
    const summary = await startRun(session);
    const dm = summary.datasets.find((dataset) => dataset.key === "sdtm:DM");
    expect(dm).toBeDefined();
    const window = (await ask(session, {
      type: "rows",
      runId: summary.runId,
      key: "sdtm:DM",
      offset: 5,
      limit: 10,
    })) as RowWindow;
    expect(window.offset).toBe(5);
    expect(window.rows).toHaveLength(10);
    expect(window.rows[0]).toHaveLength(dm?.variables.length ?? -1);
    const usubjid = dm?.variables.findIndex((v) => v.name === "USUBJID") ?? -1;
    expect(String(window.rows[0][usubjid])).toMatch(/^DEMO-301-/);

    const past = (await ask(session, {
      type: "rows",
      runId: summary.runId,
      key: "sdtm:DM",
      offset: (dm?.rowCount ?? 0) - 2,
      limit: 50,
    })) as RowWindow;
    expect(past.rows).toHaveLength(2);

    const capped = (await ask(session, {
      type: "rows",
      runId: summary.runId,
      key: "adam:ADVS",
      offset: 0,
      limit: 1_000_000,
    })) as RowWindow;
    expect(capped.rows.length).toBeLessThanOrEqual(1000);

    await expect(
      ask(session, {
        type: "rows",
        runId: summary.runId,
        key: "sdtm:ZZ",
        offset: 0,
        limit: 1,
      })
    ).rejects.toThrow(/no dataset/);
  });

  it("refuses requests for a run that a newer run replaced", async () => {
    const session = createStudyDataSession();
    const first = await startRun(session);
    const second = await startRun(session, 8, 20);
    expect(second.runId).toBe(first.runId + 1);
    await expect(
      ask(session, {
        type: "rows",
        runId: first.runId,
        key: "sdtm:DM",
        offset: 0,
        limit: 1,
      })
    ).rejects.toThrow(/replaced/);
  });

  it("answers a trace from a displayed cell's result ids", async () => {
    const session = createStudyDataSession();
    const summary = await startRun(session);
    const cell = summary.tables[0].sections[0].rows[0].cells[0];
    const trace = (await ask(session, {
      type: "trace",
      runId: summary.runId,
      origin: { kind: "result", resultIds: cell.resultIds },
      limit: 5,
    })) as LineageTrace;
    expect(trace.originLevel).toBe("result");
    expect(trace.adam.total).toBeGreaterThan(0);
    expect(trace.adam.items.length).toBeLessThanOrEqual(5);
  });

  it("builds the tables-and-figures download reproducibly, with a hashed manifest", async () => {
    const session = createStudyDataSession();
    const summary = await startRun(session);
    const request = {
      type: "package",
      runId: summary.runId,
      kind: "outputs",
    } as const;
    const first = (await ask(session, request)) as PackageFileResult;
    const second = (await ask(session, request)) as PackageFileResult;
    expect(first.fileName).toBe("demo-301-seed-7-n-24-tables-figures.zip");
    expect(Buffer.from(second.bytes).equals(Buffer.from(first.bytes))).toBe(
      true
    );
    const zip = await JSZip.loadAsync(first.bytes);
    const names = Object.keys(zip.files);
    expect(names).toHaveLength(first.fileCount);
    expect(names).toContain("README.txt");
    const manifest = JSON.parse(
      (await zip.file("MANIFEST.json")?.async("string")) ?? "{}"
    ) as { notice: string; files: { path: string; sha256: string }[] };
    expect(manifest.notice).toMatch(/synthetic/i);
    expect(manifest.files.length).toBe(first.fileCount - 2);
    expect(names.some((name) => name.endsWith(".svg"))).toBe(true);
  });

  it("builds the datasets download", async () => {
    const session = createStudyDataSession();
    const summary = await startRun(session);
    const result = (await ask(session, {
      type: "package",
      runId: summary.runId,
      kind: "submission",
    })) as PackageFileResult;
    expect(result.fileName).toBe("demo-301-seed-7-n-24-datasets.zip");
    expect(result.fileCount).toBeGreaterThan(0);
    const zip = await JSZip.loadAsync(result.bytes);
    expect(Object.keys(zip.files).length).toBeGreaterThan(0);
  });
});

describe("study data pipeline session: injecting an issue", () => {
  async function inject(
    scenario: ScenarioId,
    session = createStudyDataSession()
  ) {
    const summary = (await ask(session, {
      type: "run",
      seed: 7,
      nSubjects: 24,
      scenario,
    })) as RunSummary;
    return { session, summary };
  }

  it("leaves a run without a scenario as it was, with nothing injected", async () => {
    const summary = await startRun(createStudyDataSession());
    expect(summary).not.toHaveProperty("injected");
  });

  it("reports the changed subject and each finding the gate raised on it", async () => {
    const { session, summary } = await inject("impossible-date");
    const injected = summary.injected!;
    expect(injected.scenario.id).toBe("impossible-date");
    expect(injected.subject).toBeTruthy();
    expect(injected.caught.length).toBeGreaterThan(0);
    expect(injected.missed).toEqual([]);
    for (const finding of injected.caught) {
      expect(injected.scenario.expected.findings).toContain(finding.ruleId);
      const key = `${finding.layer}:${finding.dataset}`;
      const dataset = summary.datasets.find((item) => item.key === key)!;
      const usubjid = dataset.variables.findIndex(
        (variable) => variable.name === "USUBJID"
      );
      const window = (await ask(session, {
        type: "rows",
        runId: summary.runId,
        key,
        offset: finding.row!,
        limit: 1,
      })) as RowWindow;
      expect(window.rows[0]![usubjid]).toBe(injected.subject);
    }
  });

  it("reports a derivation scenario with nothing to catch", async () => {
    const { summary } = await inject("missing-baseline");
    const injected = summary.injected!;
    expect(injected.scenario.expected.findings).toEqual([]);
    expect(injected.subject).toBeTruthy();
    expect(injected.caught).toEqual([]);
    expect(injected.missed).toEqual([]);
  });

  it("refuses a scenario it does not know", async () => {
    await expect(inject("not-a-scenario" as ScenarioId)).rejects.toThrow(
      RangeError
    );
  });
});

describe("study data pipeline session with a CRF Studio study", () => {
  const usdm = exportStudyToUsdmObject(CNS_NEURO_PRESET);

  it("checks and narrows a handed-over study before any run", async () => {
    const session = createStudyDataSession();
    const prepared = (await ask(session, {
      type: "prepare",
      study: usdm,
    })) as PreparedStudy;
    if (!prepared.ok) throw new Error(prepared.issues.join("; "));
    expect(prepared.report.studyId).toBe("NEURO-2026-401");
    expect(prepared.report.notTabulatedDomains).toEqual(["CM", "QS"]);
    expect(prepared.design.studyId).toBe("NEURO-2026-401");
    expect(prepared.design.arms.map((arm) => arm.name)).toEqual([
      "Study treatment",
    ]);
    expect(prepared.counts).toEqual({
      arms: 1,
      visits: prepared.design.visits.length,
      activities: prepared.design.activities.length,
      scheduled: prepared.design.schedule.length,
    });
  });

  it("reports schema issues for a document that is not USDM v4", async () => {
    const session = createStudyDataSession();
    const prepared = (await ask(session, {
      type: "prepare",
      study: { usdmVersion: "4.0.0" },
    })) as PreparedStudy;
    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;
    expect(prepared.problem).toBe("schema");
    expect(prepared.issues.length).toBeGreaterThan(0);
    expect(prepared.issues.length).toBeLessThanOrEqual(prepared.total);
  });

  it("runs, traces and packages the handed-over study", async () => {
    const session = createStudyDataSession();
    const summary = (await ask(session, {
      type: "run",
      seed: 2595,
      nSubjects: 12,
      study: usdm,
    })) as RunSummary;
    const dm = summary.datasets.find((dataset) => dataset.key === "sdtm:DM");
    expect(dm?.rowCount).toBe(12);
    const window = (await ask(session, {
      type: "rows",
      runId: summary.runId,
      key: "sdtm:DM",
      offset: 0,
      limit: 1,
    })) as RowWindow;
    expect(String(window.rows[0][0])).toBe("NEURO-2026-401");
    const trace = (await ask(session, {
      type: "trace",
      runId: summary.runId,
      origin: { kind: "record", layer: "sdtm", dataset: "DM", row: 0 },
      limit: 5,
    })) as LineageTrace;
    expect(trace.title).toBeTruthy();
    const file = (await ask(session, {
      type: "package",
      runId: summary.runId,
      kind: "submission",
    })) as PackageFileResult;
    expect(file.fileName).toBe("neuro-2026-401-seed-2595-n-12-datasets.zip");
  });
});
