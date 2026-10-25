// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  LINEAGE_STAGES,
  MEASURES_DATASET,
  METRICS_DATASET,
  METRIC_REGISTRY,
  OPENLINEAGE_PRODUCER,
  REPORTS_DATASET,
  REPORT_PACK,
  buildWarehouse,
  STUDY_DATA_PRODUCT_ID,
  checkLineage,
  contractChangeImpact,
  dataContracts,
  generatePortfolio,
  lineageImpact,
  lineageUpstream,
  operationsReportSpecs,
  platformLineage,
  toOpenLineageEvents,
  type DataContract,
  type LineageGraphEdge,
  type LineageNode,
  type PlatformLineage,
} from "@/lib/clinical-platform";
import { DEMO_301_STUDY, runPipeline } from "@/lib/study-data";
import {
  OPENLINEAGE_SCHEMA_DIR,
  validateOpenLineage,
} from "./helpers/openlineage-schema";

const run = runPipeline(DEMO_301_STUDY, { seed: 7, nSubjects: 24 });
const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const reports = [...REPORT_PACK, ...operationsReportSpecs(warehouse)];
const graph = platformLineage(run, reports);
const DATA_CUT = "2026-09-30T00:00:00Z";
const events = toOpenLineageEvents(graph, DATA_CUT);

function nodeOf(g: PlatformLineage, id: string): LineageNode {
  const found = g.nodes.find((n) => n.id === id);
  if (found === undefined) throw new Error(`no node ${id}`);
  return found;
}

const stageOf = (id: string) => nodeOf(graph, id).stage;
const upstreamStages = (id: string) =>
  new Set(lineageUpstream(graph, id).map((r) => r.stage));

describe("platform lineage graph", () => {
  it("is sound: no duplicates, no dangling edges, no cycles", () => {
    expect(checkLineage(graph)).toEqual([]);
    const ids = new Set(graph.nodes.map((n) => n.id));
    expect(ids.size).toBe(graph.nodes.length);
    for (const e of graph.edges) {
      expect(ids.has(e.from), e.from).toBe(true);
      expect(ids.has(e.to), e.to).toBe(true);
    }
  });

  it("has a node at every stage, sorted by stage then id", () => {
    expect(new Set(graph.nodes.map((n) => n.stage))).toEqual(
      new Set(LINEAGE_STAGES)
    );
    const rank = (n: LineageNode) => LINEAGE_STAGES.indexOf(n.stage);
    for (let i = 1; i < graph.nodes.length; i += 1) {
      const [a, b] = [graph.nodes[i - 1], graph.nodes[i]];
      expect(
        rank(a) < rank(b) || (rank(a) === rank(b) && a.id < b.id),
        `${a.id} before ${b.id}`
      ).toBe(true);
    }
  });

  it("splits every id into its dataset and field", () => {
    for (const n of graph.nodes) {
      expect(n.id).toBe(`${n.dataset}.${n.field}`);
      expect(n.field).not.toContain(".");
    }
  });

  it("only flows forward, from an earlier stage or within one", () => {
    const rank = (id: string) => LINEAGE_STAGES.indexOf(stageOf(id));
    for (const e of graph.edges) {
      expect(rank(e.from), `${e.from} → ${e.to}`).toBeLessThanOrEqual(
        rank(e.to)
      );
    }
  });

  it("holds one metric node and one Power BI measure per registry metric", () => {
    const of = (stage: string) =>
      graph.nodes.filter((n) => n.stage === stage).map((n) => n.field);
    const ids = METRIC_REGISTRY.map((m) => m.id).sort();
    expect(of("metric")).toEqual(ids);
    expect(of("measure")).toEqual(ids);
    for (const id of ids) {
      expect(graph.edges).toContainEqual({
        from: `${METRICS_DATASET}.${id}`,
        to: `${MEASURES_DATASET}.${id}`,
        transformation: "dax",
      });
    }
  });

  it("reaches a bronze source from every certified metric", () => {
    for (const metric of METRIC_REGISTRY) {
      const id = `${METRICS_DATASET}.${metric.id}`;
      expect(upstreamStages(id).has("bronze"), id).toBe(true);
    }
  });

  it("resolves every report to the metrics it shows", () => {
    for (const report of reports) {
      const id = `${REPORTS_DATASET}.${report.id}`;
      const shown = graph.edges
        .filter((e) => e.to === id && e.transformation === "display")
        .map((e) => e.from)
        .sort();
      expect(shown.length, id).toBeGreaterThan(0);
      expect(shown).toEqual(
        [...new Set(report.metrics)]
          .map((m) => `${METRICS_DATASET}.${m}`)
          .sort()
      );
    }
  });

  it("names who is accountable for every warehouse, metric and report node", () => {
    for (const n of graph.nodes) {
      if (n.stage === "bronze") continue;
      expect(n.owners.length, n.id).toBeGreaterThan(0);
    }
  });

  it("carries the study pipeline's own variable metadata", () => {
    expect(nodeOf(graph, "collected.RAND.RANDDTC")).toMatchObject({
      stage: "collected",
      dataset: "collected.RAND",
      field: "RANDDTC",
      label: "Randomization date",
      type: "date",
    });
    expect(graph.edges).toContainEqual({
      from: "sdtm.DM.AGE",
      to: "adam.ADSL.AGE",
      transformation: "identity",
    });
  });
});

describe("collected values to portfolio KPIs", () => {
  const pipelineFeeds = graph.edges.filter(
    (e) => stageOf(e.from) === "collected" && stageOf(e.to) === "bronze"
  );

  it("reads collected variables into the bronze feeds", () => {
    expect(pipelineFeeds.length).toBeGreaterThan(0);
    expect(pipelineFeeds).toContainEqual({
      from: "collected.RAND.RANDDTC",
      to: "bronze.edc.subjects.enrolledOn",
      transformation: "date-shift",
    });
  });

  it("feeds only bronze columns the warehouse reads", () => {
    for (const e of pipelineFeeds) {
      const silver = graph.edges.filter(
        (out) => out.from === e.to && stageOf(out.to) === "silver"
      );
      expect(silver.length, e.to).toBeGreaterThan(0);
    }
  });

  it("traces enrolment from the randomisation date to the reports", () => {
    const impact = lineageImpact(graph, "collected.RAND.RANDDTC");
    const reached = new Map(impact.downstream.map((r) => [r.id, r.distance]));
    expect(reached.get("bronze.edc.subjects.enrolledOn")).toBe(1);
    expect(reached.get("silver.edc_subject.enrolled_on")).toBe(2);
    expect(reached.get(`${METRICS_DATASET}.subjects_enrolled`)).toBe(4);
    expect(reached.get(`${MEASURES_DATASET}.subjects_enrolled`)).toBe(5);
    expect(reached.get(`${REPORTS_DATASET}.study-status`)).toBe(5);
  });

  it("reaches collected variables from the population metrics", () => {
    for (const id of ["subjects_screened", "subjects_enrolled"]) {
      expect(
        upstreamStages(`${METRICS_DATASET}.${id}`).has("collected"),
        id
      ).toBe(true);
    }
  });
});

describe("impact analysis", () => {
  it("lists what a bronze column change reaches, nearest first, and who to tell", () => {
    const impact = lineageImpact(graph, "bronze.edc.subjects.enrolledOn");
    expect(impact.origin).toBe("bronze.edc.subjects.enrolledOn");
    expect(impact.downstream[0]).toEqual({
      id: "silver.edc_subject.enrolled_on",
      stage: "silver",
      distance: 1,
    });
    const distances = impact.downstream.map((r) => r.distance);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));

    const owners = new Map(impact.notify.map((n) => [n.owner, n.nodeIds]));
    expect([...owners.keys()]).toEqual([...owners.keys()].sort());
    expect(owners.get("Clinical Finance Lead")).toEqual([
      `${MEASURES_DATASET}.cost_per_enrolled_subject`,
      `${METRICS_DATASET}.cost_per_enrolled_subject`,
    ]);
    expect(owners.get("Portfolio Management Lead")).toEqual([
      `${REPORTS_DATASET}.monthly-portfolio-review`,
    ]);
    // Every node named for a role is downstream, and every downstream node
    // with an owner is named for each of its owners.
    const downstream = new Set(impact.downstream.map((r) => r.id));
    for (const reach of impact.downstream) {
      for (const owner of nodeOf(graph, reach.id).owners) {
        expect(owners.get(owner), owner).toContain(reach.id);
      }
    }
    for (const ids of owners.values()) {
      for (const id of ids) expect(downstream.has(id), id).toBe(true);
    }
  });

  it("follows a fixture change through a small graph exactly", () => {
    const n = (id: string, stage: LineageNode["stage"], owners: string[]) => ({
      id,
      stage,
      dataset: id.slice(0, id.lastIndexOf(".")),
      field: id.slice(id.lastIndexOf(".") + 1),
      label: id,
      type: null,
      method: null,
      owners,
    });
    const fixture: PlatformLineage = {
      nodes: [
        n("bronze.edc.visits.visitDate", "bronze", []),
        n("silver.edc_visit.visit_date", "silver", ["EDC Steward"]),
        n("gold.fct_visit.visit_date_key", "gold", ["Ops Lead"]),
        n("gold.fct_visit.status", "gold", ["Ops Lead"]),
        n("semantic.metrics.lag", "metric", ["DM Lead", "Ops Lead"]),
        n("reporting.reports.dm", "report", ["DM Lead"]),
      ],
      edges: [
        ["bronze.edc.visits.visitDate", "silver.edc_visit.visit_date"],
        ["silver.edc_visit.visit_date", "gold.fct_visit.visit_date_key"],
        ["gold.fct_visit.visit_date_key", "semantic.metrics.lag"],
        ["gold.fct_visit.status", "semantic.metrics.lag"],
        ["semantic.metrics.lag", "reporting.reports.dm"],
      ].map(([from, to]) => ({ from, to, transformation: "identity" })),
    };
    expect(checkLineage(fixture)).toEqual([]);
    expect(lineageImpact(fixture, "silver.edc_visit.visit_date")).toEqual({
      origin: "silver.edc_visit.visit_date",
      downstream: [
        { id: "gold.fct_visit.visit_date_key", stage: "gold", distance: 1 },
        { id: "semantic.metrics.lag", stage: "metric", distance: 2 },
        { id: "reporting.reports.dm", stage: "report", distance: 3 },
      ],
      notify: [
        {
          owner: "DM Lead",
          nodeIds: ["reporting.reports.dm", "semantic.metrics.lag"],
        },
        {
          owner: "Ops Lead",
          nodeIds: ["gold.fct_visit.visit_date_key", "semantic.metrics.lag"],
        },
      ],
    });
    expect(lineageUpstream(fixture, "semantic.metrics.lag")).toEqual([
      { id: "gold.fct_visit.status", stage: "gold", distance: 1 },
      { id: "gold.fct_visit.visit_date_key", stage: "gold", distance: 1 },
      { id: "silver.edc_visit.visit_date", stage: "silver", distance: 2 },
      { id: "bronze.edc.visits.visitDate", stage: "bronze", distance: 3 },
    ]);
  });

  it("returns nothing downstream of a report", () => {
    const impact = lineageImpact(graph, `${REPORTS_DATASET}.study-status`);
    expect(impact.downstream).toEqual([]);
    expect(impact.notify).toEqual([]);
  });

  it("rejects a node the graph does not have", () => {
    expect(() => lineageImpact(graph, "silver.nowhere.column")).toThrow(
      /no lineage node/
    );
    expect(() => lineageUpstream(graph, "silver.nowhere.column")).toThrow(
      /no lineage node/
    );
  });
});

describe("contract change impact", () => {
  const contracts = dataContracts(run);
  const contract = (productId: string): DataContract => {
    const found = contracts.find((c) => c.productId === productId);
    if (found === undefined) throw new Error(`no contract ${productId}`);
    return found;
  };
  const subject = contract("silver.edc_subject");
  const retype = (c: DataContract, column: string): DataContract => ({
    ...c,
    version: "2.0.0",
    objects: c.objects.map((o) => ({
      ...o,
      columns: o.columns.map((col) =>
        col.name === column ? { ...col, type: "timestamp" } : col
      ),
    })),
  });

  it("reaches what reads a retyped column, and names its owners", () => {
    const impact = contractChangeImpact(
      graph,
      subject,
      retype(subject, "enrolled_on")
    );
    expect(impact).toMatchObject({
      productId: "silver.edc_subject",
      from: subject.version,
      to: "2.0.0",
      changed: ["silver.edc_subject.enrolled_on"],
    });
    // A change to the column reaches what a change to the column reaches.
    const single = lineageImpact(graph, "silver.edc_subject.enrolled_on");
    expect(impact.downstream).toEqual(single.downstream);
    expect(impact.notify).toEqual(single.notify);
    expect(impact.downstream).toContainEqual({
      id: `${METRICS_DATASET}.subjects_enrolled`,
      stage: "metric",
      distance: 2,
    });
  });

  it("reaches nothing when only the version or an added column changes", () => {
    const added: DataContract = {
      ...subject,
      version: "1.1.0",
      objects: subject.objects.map((o) => ({
        ...o,
        columns: [
          ...o.columns,
          { ...o.columns[o.columns.length - 1], name: "new_column" },
        ],
      })),
    };
    for (const next of [{ ...subject, version: "1.0.1" }, added]) {
      expect(contractChangeImpact(graph, subject, next)).toMatchObject({
        changed: [],
        downstream: [],
        notify: [],
      });
    }
  });

  it("treats a removed dataset as a change to each of its variables", () => {
    const study = contract(STUDY_DATA_PRODUCT_ID);
    const dm = study.objects.find((o) => o.name === "DM");
    const impact = contractChangeImpact(graph, study, {
      ...study,
      version: "2.0.0",
      objects: study.objects.filter((o) => o.name !== "DM"),
    });
    expect(impact.changed).toEqual(
      (dm?.columns ?? []).map((c) => `sdtm.DM.${c.name}`).sort()
    );
    expect(impact.downstream).toContainEqual({
      id: "adam.ADSL.AGE",
      stage: "adam",
      distance: 1,
    });
    // Bronze reads the collected layer, so SDTM changes stay in the package.
    expect(
      impact.downstream.every((r) => ["sdtm", "adam"].includes(r.stage))
    ).toBe(true);
  });

  it("treats a weaker service level as a change to every column", () => {
    const enrolment = contract("gold.fct_enrollment");
    const impact = contractChangeImpact(graph, enrolment, {
      ...enrolment,
      version: "2.0.0",
      sla: {
        ...enrolment.sla,
        freshnessHours: enrolment.sla.freshnessHours * 2,
      },
    });
    expect(impact.changed).toEqual(
      enrolment.objects[0].columns
        .map((c) => `gold.fct_enrollment.${c.name}`)
        .sort()
    );
    expect(impact.downstream).toContainEqual({
      id: `${REPORTS_DATASET}.study-status`,
      stage: "report",
      distance: 2,
    });
  });

  it("rejects releases of two different products", () => {
    expect(() =>
      contractChangeImpact(graph, subject, contract("silver.edc_visit"))
    ).toThrow(/compares silver.edc_visit with a release of silver.edc_subject/);
  });
});

describe("checkLineage", () => {
  const edge = (from: string, to: string): LineageGraphEdge => ({
    from,
    to,
    transformation: "identity",
  });
  const rules = (g: PlatformLineage) => checkLineage(g).map((f) => f.rule);

  it("finds a duplicate node", () => {
    expect(
      rules({ nodes: [...graph.nodes, graph.nodes[0]], edges: graph.edges })
    ).toContain("duplicate-node");
  });

  it("finds an edge to a missing node", () => {
    const findings = checkLineage({
      nodes: graph.nodes,
      edges: [
        ...graph.edges,
        edge("silver.gone.column", "gold.fct_enrollment.event_type"),
      ],
    });
    expect(findings).toEqual([
      {
        rule: "dangling-edge",
        message:
          "silver.gone.column → gold.fct_enrollment.event_type names silver.gone.column, which is not a node",
      },
    ]);
  });

  it("finds a cycle", () => {
    const back = edge(
      `${METRICS_DATASET}.subjects_enrolled`,
      "silver.edc_subject.enrolled_on"
    );
    expect(
      rules({ nodes: graph.nodes, edges: [...graph.edges, back] })
    ).toContain("cycle");
  });

  it("finds a metric with no source and a report with no metric", () => {
    const orphan = `${METRICS_DATASET}.subjects_enrolled`;
    const report = `${REPORTS_DATASET}.study-status`;
    const findings = checkLineage({
      nodes: graph.nodes,
      edges: graph.edges.filter((e) => e.to !== orphan && e.to !== report),
    });
    expect(findings).toEqual([
      {
        rule: "metric-without-source",
        message: `${orphan} reaches no bronze feed or collected variable`,
      },
      { rule: "report-without-metric", message: `${report} shows no metric` },
    ]);
  });
});

describe("determinism", () => {
  it("builds the same graph and events from another pipeline run", () => {
    const other = runPipeline(DEMO_301_STUDY, { seed: 11, nSubjects: 40 });
    const again = platformLineage(other, reports);
    expect(again).toEqual(graph);
    expect(toOpenLineageEvents(again, DATA_CUT)).toEqual(events);
  });

  it("uses the full metric registry unless told otherwise", () => {
    const one = METRIC_REGISTRY.filter((m) => m.id === "subjects_enrolled");
    const small = platformLineage(run, [], one);
    expect(
      small.nodes.filter((n) => n.stage === "metric").map((n) => n.id)
    ).toEqual([`${METRICS_DATASET}.subjects_enrolled`]);
    expect(checkLineage(small)).toEqual([]);
  });
});

describe("OpenLineage events", () => {
  it("emits one completed run per computed dataset", () => {
    const computed = new Set(
      graph.edges.map((e) => nodeOf(graph, e.to).dataset)
    );
    expect(events.map((e) => e.job.name).sort()).toEqual([...computed].sort());
    for (const event of events) {
      expect(event.eventType).toBe("COMPLETE");
      expect(event.eventTime).toBe(DATA_CUT);
      expect(event.producer).toBe(OPENLINEAGE_PRODUCER);
      expect(event.outputs).toHaveLength(1);
      expect(event.outputs[0].name).toBe(event.job.name);
    }
  });

  it("validates every event and facet against the vendored 2-0-2 schemas", () => {
    for (const event of events) {
      expect(validateOpenLineage("runEvent", event), event.job.name).toEqual(
        []
      );
      const facets = event.outputs[0].facets as Record<string, unknown>;
      expect(validateOpenLineage("schema", facets.schema)).toEqual([]);
      expect(
        validateOpenLineage("columnLineage", facets.columnLineage)
      ).toEqual([]);
      if (facets.ownership !== undefined) {
        expect(validateOpenLineage("ownership", facets.ownership)).toEqual([]);
      }
      expect(validateOpenLineage("jobType", event.job.facets.jobType)).toEqual(
        []
      );
    }
  });

  it("is rejected by the schemas when broken, so the validation has teeth", () => {
    const [event] = events;
    expect(
      validateOpenLineage("runEvent", { ...event, run: { runId: "run-1" } })
    ).not.toEqual([]);
    expect(
      validateOpenLineage("runEvent", { ...event, eventTime: "yesterday" })
    ).not.toEqual([]);
    const { producer: _producer, ...noProducer } = event;
    expect(validateOpenLineage("runEvent", noProducer)).not.toEqual([]);
    expect(
      validateOpenLineage("columnLineage", { _producer: "x", _schemaURL: "y" })
    ).not.toEqual([]);
  });

  it("carries every edge into a column-lineage input field", () => {
    const fields = events.flatMap((event) => {
      const output = event.outputs[0];
      const facet = (output.facets as Record<string, unknown>)
        .columnLineage as {
        fields: Record<
          string,
          { inputFields: { name: string; field: string }[] }
        >;
      };
      return Object.entries(facet.fields).flatMap(([field, { inputFields }]) =>
        inputFields.map(
          (input) => `${input.name}.${input.field} → ${output.name}.${field}`
        )
      );
    });
    expect(fields.sort()).toEqual(
      graph.edges.map((e) => `${e.from} → ${e.to}`).sort()
    );
  });

  it("puts study variables and platform datasets in their own namespaces", () => {
    const sdtm = events.find((e) => e.job.name === "sdtm.DM");
    const silver = events.find((e) => e.job.name === "silver.edc_subject");
    expect(sdtm?.job.namespace).toBe("study-data-pipeline");
    expect(silver?.job.namespace).toBe("clinical-platform");
    const bronze = events.find((e) => e.job.name === "bronze.edc.subjects");
    expect(bronze?.inputs).toContainEqual({
      namespace: "study-data-pipeline",
      name: "collected.RAND",
    });
  });

  it("gives every run a distinct, stable version 8 UUID", () => {
    const ids = events.map((e) => e.run.runId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    }
    const later = toOpenLineageEvents(graph, "2026-10-31T00:00:00Z");
    expect(later.map((e) => e.run.runId)).not.toEqual(ids);
  });

  it("rejects an event time that is not an ISO 8601 date and time", () => {
    for (const bad of ["2026-09-30", "yesterday", "2026-09-30 00:00:00"]) {
      expect(() => toOpenLineageEvents(graph, bad)).toThrow(RangeError);
    }
  });
});

describe("vendored OpenLineage schemas", () => {
  const HASHES: Record<string, string> = {
    "OpenLineage.json":
      "69f68bee00b9beac88a87059c0102410e7bb05f3f43c46d02a0409831eceb0d2",
    "ColumnLineageDatasetFacet.json":
      "04d96b4985ca32470c7f9d73163da76678fb160bc8d80cbbc5abf312e9537466",
    "SchemaDatasetFacet.json":
      "50236a779aa64baa0bad0055391838bd22fcb36ce667c41d60ada80915e899b6",
    "OwnershipDatasetFacet.json":
      "9a18a508746627eff18fa84ca1694e1a9f2d556ac0052dbdb6970d8a35f75231",
    "JobTypeJobFacet.json":
      "11c12cab95a411ca31066c80d2bb4aefd37bbcadbda5e4d343d2069853b907d5",
    LICENSE: "c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4",
  };

  it.each(Object.entries(HASHES))("keeps %s byte for byte", (file, hash) => {
    const bytes = readFileSync(path.join(OPENLINEAGE_SCHEMA_DIR, file));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
  });

  it("records each hash and the Apache 2.0 licence in SOURCE.md", () => {
    const source = readFileSync(
      path.join(OPENLINEAGE_SCHEMA_DIR, "SOURCE.md"),
      "utf8"
    );
    for (const [file, hash] of Object.entries(HASHES)) {
      expect(source).toContain(`\`${file}\``);
      expect(source).toContain(hash);
    }
    expect(source).toContain("Apache License 2.0");
    const licence = readFileSync(
      path.join(OPENLINEAGE_SCHEMA_DIR, "LICENSE"),
      "utf8"
    );
    expect(licence).toContain("Apache License");
    expect(licence).toContain("Version 2.0, January 2004");
  });
});
