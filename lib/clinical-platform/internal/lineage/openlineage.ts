/**
 * The lineage graph as OpenLineage 2-0-2 run events (#2637): one completed
 * run per platform step, that is per dataset the graph computes, with its
 * inputs and an output carrying the schema, ownership and column-lineage
 * facets. A marquez or DataHub instance can ingest the events as they are.
 */
import type {
  LineageGraphEdge,
  LineageNode,
  LineageStage,
  OpenLineageInputField,
  OpenLineageRunEvent,
  PlatformLineage,
} from "../../types";
import { LINEAGE_STAGES } from "./graph";

/** Where the events come from: this code, as OpenLineage asks. */
export const OPENLINEAGE_PRODUCER =
  "https://github.com/fderuiter/deruiter.dev/tree/main/lib/clinical-platform";

const SPEC = "https://openlineage.io/spec";
const RUN_EVENT_SCHEMA = `${SPEC}/2-0-2/OpenLineage.json#/$defs/RunEvent`;
const FACET_SCHEMAS = {
  schema: `${SPEC}/facets/1-2-0/SchemaDatasetFacet.json#/$defs/SchemaDatasetFacet`,
  ownership: `${SPEC}/facets/1-0-1/OwnershipDatasetFacet.json#/$defs/OwnershipDatasetFacet`,
  columnLineage: `${SPEC}/facets/1-2-0/ColumnLineageDatasetFacet.json#/$defs/ColumnLineageDatasetFacet`,
  jobType: `${SPEC}/facets/2-0-4/JobTypeJobFacet.json#/$defs/JobTypeJobFacet`,
} as const;

const STUDY_STAGES: ReadonlySet<LineageStage> = new Set([
  "collected",
  "sdtm",
  "adam",
]);

/** Namespace of a node's dataset: the pipeline's, or the platform's. */
const namespaceOf = (stage: LineageStage) =>
  STUDY_STAGES.has(stage) ? "study-data-pipeline" : "clinical-platform";

/** OpenLineage's transformation type and subtype for each edge kind. */
function transformationOf(
  edge: LineageGraphEdge
): OpenLineageInputField["transformations"][number] {
  const t = edge.transformation;
  const of = (type: "DIRECT" | "INDIRECT", subtype: string) => ({
    type,
    subtype,
    description: t,
  });
  if (t === "identity" || t === "display") return of("DIRECT", "IDENTITY");
  if (["aggregate", "count", "month-spread", "measure"].includes(t)) {
    return of("DIRECT", "AGGREGATION");
  }
  if (t === "filter") return of("INDIRECT", "FILTER");
  if (t === "group-by" || t === "time-key") return of("INDIRECT", "GROUP_BY");
  if (t.endsWith("lookup")) return of("INDIRECT", "JOIN");
  return of("DIRECT", "TRANSFORMATION");
}

/**
 * A deterministic UUID (version 8, RFC 9562) from a text, so the same
 * graph and event time give the same run ids on every build.
 */
function uuidOf(text: string): string {
  const words = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b].map((seed) => {
    let h = seed >>> 0;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  });
  const hex = words.join("").split("");
  hex[12] = "8";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The lineage graph as OpenLineage run events, one per dataset the graph
 * computes, in stage order and then by dataset.
 *
 * @param graph - A graph from `platformLineage`.
 * @param eventTime - ISO 8601 date and time the runs completed, usually
 *   the data cut, so the events are the same on every build.
 * @returns The events, each a valid OpenLineage 2-0-2 `RunEvent`.
 * @throws RangeError when `eventTime` is not an ISO 8601 date and time.
 */
export function toOpenLineageEvents(
  graph: PlatformLineage,
  eventTime: string
): OpenLineageRunEvent[] {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(
      eventTime
    )
  ) {
    throw new RangeError(`${eventTime} is not an ISO 8601 date and time`);
  }
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const datasets = new Map<string, LineageNode[]>();
  for (const n of graph.nodes) {
    const list = datasets.get(n.dataset);
    if (list === undefined) datasets.set(n.dataset, [n]);
    else list.push(n);
  }
  const into = new Map<string, LineageGraphEdge[]>();
  for (const edge of graph.edges) {
    const dataset = nodes.get(edge.to)?.dataset;
    if (dataset === undefined) throw new Error(`no lineage node ${edge.to}`);
    const list = into.get(dataset);
    if (list === undefined) into.set(dataset, [edge]);
    else list.push(edge);
  }
  const order = new Map(LINEAGE_STAGES.map((stage, i) => [stage, i]));
  const facet = (schema: keyof typeof FACET_SCHEMAS) => ({
    _producer: OPENLINEAGE_PRODUCER,
    _schemaURL: FACET_SCHEMAS[schema],
  });

  return [...into.keys()]
    .map((dataset) => ({ dataset, fields: datasets.get(dataset) ?? [] }))
    .sort(
      (a, b) =>
        (order.get(a.fields[0].stage) ?? 0) -
          (order.get(b.fields[0].stage) ?? 0) || byText(a.dataset, b.dataset)
    )
    .map(({ dataset, fields }): OpenLineageRunEvent => {
      const stage = fields[0].stage;
      const namespace = namespaceOf(stage);
      const edges = into.get(dataset) ?? [];
      const source = (id: string) => nodes.get(id) as LineageNode;
      const inputs = [
        ...new Map(
          edges.map((e) => {
            const n = source(e.from);
            return [
              `${namespaceOf(n.stage)}|${n.dataset}`,
              { namespace: namespaceOf(n.stage), name: n.dataset },
            ];
          })
        ).values(),
      ].sort(
        (a, b) => byText(a.namespace, b.namespace) || byText(a.name, b.name)
      );
      const lineage: Record<string, { inputFields: OpenLineageInputField[] }> =
        {};
      for (const e of edges) {
        const n = source(e.from);
        const field = source(e.to).field;
        lineage[field] ??= { inputFields: [] };
        lineage[field].inputFields.push({
          namespace: namespaceOf(n.stage),
          name: n.dataset,
          field: n.field,
          transformations: [transformationOf(e)],
        });
      }
      const owners = [...new Set(fields.flatMap((f) => f.owners))].sort(byText);
      return {
        eventType: "COMPLETE",
        eventTime,
        producer: OPENLINEAGE_PRODUCER,
        schemaURL: RUN_EVENT_SCHEMA,
        run: { runId: uuidOf(`${namespace}|${dataset}|${eventTime}`) },
        job: {
          namespace,
          name: dataset,
          facets: {
            jobType: {
              ...facet("jobType"),
              processingType: "BATCH",
              integration:
                namespace === "clinical-platform"
                  ? "CLINICAL_PLATFORM"
                  : "STUDY_DATA_PIPELINE",
              jobType: "TASK",
            },
          },
        },
        inputs,
        outputs: [
          {
            namespace,
            name: dataset,
            facets: {
              schema: {
                ...facet("schema"),
                fields: fields.map((f) =>
                  f.type === null
                    ? { name: f.field, description: f.label }
                    : { name: f.field, type: f.type, description: f.label }
                ),
              },
              ...(owners.length === 0
                ? {}
                : {
                    ownership: {
                      ...facet("ownership"),
                      owners: owners.map((name) => ({
                        name: `role:${name}`,
                        type: "ACCOUNTABLE",
                      })),
                    },
                  }),
              columnLineage: { ...facet("columnLineage"), fields: lineage },
            },
          },
        ],
      };
    });
}
