import { describe, expect, it } from "vitest";
import {
  CONFORMANCE_RULES,
  DEMO_301_STUDY,
  runConformance,
  runPipeline,
  type CellValue,
  type Dataset,
  type PipelineRun,
} from "@/lib/study-data";

/**
 * SDTM SE and CO (#2711): the elements each subject passed through, from TA
 * and the dates that move a subject between epochs, and the comments a site
 * recorded against a subject's records.
 */

type Row = Record<string, CellValue>;

function dataset(run: PipelineRun, layer: string, name: string): Dataset {
  return run.datasets.find((d) => d.layer === layer && d.name === name)!;
}

function records(data: Dataset): Row[] {
  return Array.from({ length: data.rowCount }, (_, index) =>
    Object.fromEntries(
      data.variables.map(({ name }) => [name, data.columns[name][index]])
    )
  );
}

function bySubject(rows: readonly Row[]): Map<CellValue, Row[]> {
  const grouped = new Map<CellValue, Row[]>();
  for (const row of rows)
    grouped.set(row.USUBJID, [...(grouped.get(row.USUBJID) ?? []), row]);
  return grouped;
}

const SEEDS = [301, 7, 42, 999];
const runs = new Map(
  SEEDS.map((seed) => [
    seed,
    runPipeline(DEMO_301_STUDY, { seed, nSubjects: 90 }),
  ])
);
const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("SDTM SE", () => {
  it.each(SEEDS)(
    "gives every subject the elements of their arm, without gaps (seed %i)",
    (seed) => {
      const run = runs.get(seed)!;
      const se = bySubject(records(dataset(run, "sdtm", "SE")));
      const ta = records(dataset(run, "sdtm", "TA"));
      for (const dm of records(dataset(run, "sdtm", "DM"))) {
        const elements = se.get(dm.USUBJID) ?? [];
        const subject = String(dm.USUBJID);
        expect(elements.length, subject).toBeGreaterThan(0);
        expect(elements.map((row) => row.SESEQ)).toEqual(
          elements.map((_, index) => index + 1)
        );
        // From informed consent to the end of participation, each element
        // ending when the next starts.
        expect(elements[0].SESTDTC, subject).toBe(dm.RFICDTC);
        expect(elements.at(-1)!.SEENDTC, subject).toBe(dm.RFPENDTC);
        elements.slice(1).forEach((row, index) => {
          expect(elements[index].SEENDTC, subject).toBe(row.SESTDTC);
        });
        const planned = ta.filter(
          (row) => row.ARMCD === (dm.ACTARMCD ?? ta[0].ARMCD)
        );
        expect(
          elements.map(({ ETCD, ELEMENT, TAETORD, EPOCH }) => ({
            ETCD,
            ELEMENT,
            TAETORD,
            EPOCH,
          })),
          subject
        ).toEqual(
          planned
            .slice(0, elements.length)
            .map(({ ETCD, ELEMENT, TAETORD, EPOCH }) => ({
              ETCD,
              ELEMENT,
              TAETORD,
              EPOCH,
            }))
        );
        if (dm.ACTARMCD === null) {
          // A screen failure only ever screened.
          expect(elements.map((row) => row.ETCD)).toEqual(["SCRN"]);
          continue;
        }
        expect(elements[1].SESTDTC, subject).toBe(dm.RFXSTDTC);
        // Follow-up only once a record is dated after last exposure.
        expect(elements.length, subject).toBe(
          String(dm.RFPENDTC) > String(dm.RFXENDTC) ? 3 : 2
        );
      }
    }
  );

  it.each(SEEDS)(
    "puts every dated record's EPOCH inside one of the subject's elements (seed %i)",
    (seed) => {
      const run = runs.get(seed)!;
      const se = bySubject(records(dataset(run, "sdtm", "SE")));
      const dates: Readonly<Record<string, string>> = {
        EX: "EXSTDTC",
        AE: "AESTDTC",
        VS: "VSDTC",
        LB: "LBDTC",
        EG: "EGDTC",
        DS: "DSSTDTC",
        IE: "IEDTC",
      };
      let checked = 0;
      for (const [domain, variable] of Object.entries(dates))
        for (const row of records(dataset(run, "sdtm", domain))) {
          const date = row[variable];
          if (typeof date !== "string" || !FULL_DATE.test(date)) continue;
          if (row.EPOCH === null) continue;
          checked += 1;
          const inside = (se.get(row.USUBJID) ?? []).some(
            (element) =>
              element.EPOCH === row.EPOCH &&
              String(element.SESTDTC) <= date &&
              date <= String(element.SEENDTC)
          );
          expect(inside, `${domain} ${row.USUBJID} ${date}`).toBe(true);
        }
      expect(checked).toBeGreaterThan(1000);
    }
  );

  it("writes SDTMIG 3.4 SE variables in order, with their origins", () => {
    const se = dataset(runs.get(301)!, "sdtm", "SE");
    expect(se.class).toBe("Special Purpose");
    expect(se.variables.map((variable) => variable.name)).toEqual([
      "STUDYID",
      "DOMAIN",
      "USUBJID",
      "SESEQ",
      "ETCD",
      "ELEMENT",
      "TAETORD",
      "EPOCH",
      "SESTDTC",
      "SEENDTC",
      "SESTDY",
      "SEENDY",
      "SEUPDES",
    ]);
    const meta = new Map(
      se.variables.map((variable) => [variable.name, variable])
    );
    expect(meta.get("ETCD")).toMatchObject({
      origin: "Derived",
      method: "SUBJECT_ELEMENT",
      required: true,
    });
    expect(meta.get("SESTDTC")).toMatchObject({
      method: "ELEMENT_START",
      required: true,
    });
    expect(meta.get("SEENDTC")).toMatchObject({ method: "ELEMENT_END" });
    expect(meta.get("EPOCH")).toMatchObject({ codelist: "EPOCH" });
  });

  it("traces each element to the collected records its dates come from", () => {
    const run = runs.get(301)!;
    const se = dataset(run, "sdtm", "SE");
    const collected = new Set(
      run.datasets
        .filter((d) => d.layer === "collected")
        .flatMap((d) => d.columns.SRCID ?? [])
    );
    expect(se.lineage).toHaveLength(se.rowCount);
    for (const sources of se.lineage!) {
      expect(sources.length).toBeGreaterThan(0);
      for (const source of sources) expect(collected.has(source)).toBe(true);
    }
  });
});

describe("SDTM CO", () => {
  it.each(SEEDS)(
    "names the record each collected comment is about (seed %i)",
    (seed) => {
      const run = runs.get(seed)!;
      const co = dataset(run, "sdtm", "CO");
      const comments = records(co);
      const collected = records(dataset(run, "collected", "CO"));
      expect(comments).toHaveLength(collected.length);
      expect(comments.length).toBeGreaterThan(0);
      comments.forEach((comment, index) => {
        const source = collected[index];
        expect(comment.COVAL).toBe(source.COVAL);
        expect(co.lineage![index]).toEqual([source.SRCID, source.RSRCID]);
        const target = dataset(run, "sdtm", String(comment.RDOMAIN));
        const row = target.lineage!.findIndex(
          (sources) => sources[0] === source.RSRCID
        );
        expect(row, String(source.RSRCID)).toBeGreaterThanOrEqual(0);
        expect(target.columns.USUBJID[row]).toBe(comment.USUBJID);
        expect(String(target.columns[String(comment.IDVAR)][row])).toBe(
          comment.IDVARVAL
        );
        if (comment.RDOMAIN === "SV") {
          // The reason a visit was missed.
          expect(comment.IDVAR).toBe("VISITNUM");
          expect(target.columns.SVOCCUR[row]).toBe("N");
        } else {
          // Why study treatment stopped early.
          expect(comment).toMatchObject({ RDOMAIN: "DS", IDVAR: "DSSEQ" });
          expect(target.columns.DSDECOD[row]).toBe("ADVERSE EVENT");
        }
      });
    }
  );

  it("writes SDTMIG 3.4 CO variables in order, with no comment date", () => {
    const co = dataset(runs.get(301)!, "sdtm", "CO");
    expect(co.class).toBe("Special Purpose");
    // A comment that names a record takes that record's date.
    expect(co.variables.map((variable) => variable.name)).toEqual([
      "STUDYID",
      "DOMAIN",
      "RDOMAIN",
      "USUBJID",
      "COSEQ",
      "IDVAR",
      "IDVARVAL",
      "COVAL",
    ]);
    const meta = new Map(
      co.variables.map((variable) => [variable.name, variable])
    );
    expect(meta.get("COVAL")).toMatchObject({
      origin: "Collected",
      required: true,
    });
    expect(meta.get("IDVAR")).toMatchObject({ method: "COMMENT_TARGET" });
    expect(meta.get("RDOMAIN")).toMatchObject({ codelist: "DOMAIN" });
  });
});

describe("SE and CO conformance", () => {
  it("passes SD-079 to SD-088 on the default run", () => {
    const ids = CONFORMANCE_RULES.map((rule) => rule.id).filter(
      (id) => id >= "SD-079" && id <= "SD-088"
    );
    expect(ids).toHaveLength(10);
    const result = runConformance(runs.get(301)!.datasets);
    expect(
      result.findings.filter((finding) => ids.includes(finding.ruleId))
    ).toEqual([]);
  });
});
