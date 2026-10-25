/**
 * Walking the lineage graph (#2637): what a change to a column, variable,
 * metric or data contract reaches downstream and who to tell, what a node is
 * computed from, and the rules a well-formed graph keeps.
 */
import { STUDY_DATA_PRODUCT_ID } from "../../presets";
import type {
  ContractChangeImpact,
  DataContract,
  LineageFinding,
  LineageImpact,
  LineageNode,
  LineageReach,
  PlatformLineage,
} from "../../types";

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function neighbours(
  graph: PlatformLineage,
  direction: "down" | "up"
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const [from, to] =
      direction === "down" ? [edge.from, edge.to] : [edge.to, edge.from];
    const list = out.get(from);
    if (list === undefined) out.set(from, [to]);
    else list.push(to);
  }
  return out;
}

/** Breadth first from every origin at once, so a node's distance is to the nearest. */
function walk(
  graph: PlatformLineage,
  origins: readonly string[],
  direction: "down" | "up"
): LineageReach[] {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const origin of origins) {
    if (!nodes.has(origin)) throw new Error(`no lineage node ${origin}`);
  }
  const next = neighbours(graph, direction);
  const distance = new Map<string, number>(origins.map((o) => [o, 0]));
  let frontier = [...origins];
  for (let step = 1; frontier.length > 0; step += 1) {
    const reached: string[] = [];
    for (const id of frontier) {
      for (const n of next.get(id) ?? []) {
        if (distance.has(n)) continue;
        distance.set(n, step);
        reached.push(n);
      }
    }
    frontier = reached;
  }
  return [...distance]
    .filter(([, d]) => d > 0)
    .map(([id, d]) => ({
      id,
      stage: (nodes.get(id) as LineageNode).stage,
      distance: d,
    }))
    .sort((a, b) => a.distance - b.distance || byText(a.id, b.id));
}

/**
 * Everything a change to one node reaches, and the roles accountable for
 * it, so a contract or metric change names who to notify.
 *
 * @throws Error when the graph has no node with the id.
 */
export function lineageImpact(
  graph: PlatformLineage,
  origin: string
): LineageImpact {
  const downstream = walk(graph, [origin], "down");
  return { origin, downstream, notify: notifyOf(graph, downstream) };
}

/** The roles accountable for the nodes reached, each with its nodes. */
function notifyOf(
  graph: PlatformLineage,
  reached: readonly LineageReach[]
): LineageImpact["notify"] {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const notify = new Map<string, string[]>();
  for (const reach of reached) {
    for (const owner of nodes.get(reach.id)?.owners ?? []) {
      const list = notify.get(owner);
      if (list === undefined) notify.set(owner, [reach.id]);
      else list.push(reach.id);
    }
  }
  return [...notify]
    .sort(([a], [b]) => byText(a, b))
    .map(([owner, nodeIds]) => ({ owner, nodeIds: [...nodeIds].sort(byText) }));
}

/**
 * The lineage node of a contract column: `<product>.<column>` for a
 * warehouse table, `<layer>.<dataset>.<variable>` for the study data, whose
 * datasets are named once across SDTM and ADaM.
 */
function contractNode(
  ids: ReadonlySet<string>,
  productId: string,
  object: string,
  column: string
): string | undefined {
  const candidates =
    productId === STUDY_DATA_PRODUCT_ID
      ? [`sdtm.${object}.${column}`, `adam.${object}.${column}`]
      : [`${productId}.${column}`];
  return candidates.find((id) => ids.has(id));
}

/**
 * What a contract change reaches: every column it changes or removes, the
 * nodes downstream of them, and the roles to notify before the release. A
 * change to the product's service levels or retention reaches every column,
 * since every consumer relies on them; a column only added reaches nothing
 * yet, because nothing reads it.
 *
 * @param graph - A graph from `platformLineage`.
 * @param previous - The release in force.
 * @param next - The proposed release.
 * @returns The impact; empty when nothing a consumer reads changed.
 * @throws Error when the two releases are of different products, or a
 *   changed column has no node in the graph.
 */
export function contractChangeImpact(
  graph: PlatformLineage,
  previous: DataContract,
  next: DataContract
): ContractChangeImpact {
  if (previous.productId !== next.productId) {
    throw new Error(
      `compares ${next.productId} with a release of ${previous.productId}`
    );
  }
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
  const whole =
    !same(previous.sla, next.sla) || !same(previous.retention, next.retention);
  const later = new Map(next.objects.map((o) => [o.name, o]));
  const ids = new Set(graph.nodes.map((n) => n.id));
  const changed = new Set<string>();
  for (const object of previous.objects) {
    const columns = new Map(
      (later.get(object.name)?.columns ?? []).map((c) => [c.name, c])
    );
    const keyChanged = !same(
      object.primaryKey,
      later.get(object.name)?.primaryKey
    );
    for (const column of object.columns) {
      const after = columns.get(column.name);
      const touched =
        whole ||
        after === undefined ||
        !same(column, after) ||
        (keyChanged && object.primaryKey.includes(column.name));
      if (!touched) continue;
      const id = contractNode(
        ids,
        previous.productId,
        object.name,
        column.name
      );
      if (id === undefined) {
        throw new Error(
          `${previous.productId} ${object.name}.${column.name} has no lineage node`
        );
      }
      changed.add(id);
    }
  }
  const origins = [...changed].sort(byText);
  const downstream = walk(graph, origins, "down");
  return {
    productId: next.productId,
    from: previous.version,
    to: next.version,
    changed: origins,
    downstream,
    notify: notifyOf(graph, downstream),
  };
}

/**
 * Everything a node is computed from, nearest first.
 *
 * @throws Error when the graph has no node with the id.
 */
export function lineageUpstream(
  graph: PlatformLineage,
  id: string
): LineageReach[] {
  return walk(graph, [id], "up");
}

/** The cycles' first edges, found by depth-first search. */
function cycles(graph: PlatformLineage): string[] {
  const next = neighbours(graph, "down");
  const state = new Map<string, "open" | "done">();
  const found: string[] = [];
  const visit = (id: string) => {
    state.set(id, "open");
    for (const n of next.get(id) ?? []) {
      const s = state.get(n);
      if (s === "open") found.push(`${id} → ${n}`);
      else if (s === undefined) visit(n);
    }
    state.set(id, "done");
  };
  for (const n of graph.nodes) if (!state.has(n.id)) visit(n.id);
  return found;
}

/**
 * Checks the rules a lineage graph keeps: no duplicate nodes, no edge to or
 * from a missing node, no cycle, every metric reaching a source
 * system (a bronze feed or a collected study variable), and every report
 * showing at least one metric.
 *
 * @returns The broken rules; empty when the graph is sound.
 */
export function checkLineage(graph: PlatformLineage): LineageFinding[] {
  const findings: LineageFinding[] = [];
  const ids = new Set<string>();
  for (const n of graph.nodes) {
    if (ids.has(n.id)) {
      findings.push({
        rule: "duplicate-node",
        message: `${n.id} appears twice`,
      });
    }
    ids.add(n.id);
  }
  for (const e of graph.edges) {
    for (const end of [e.from, e.to]) {
      if (!ids.has(end)) {
        findings.push({
          rule: "dangling-edge",
          message: `${e.from} → ${e.to} names ${end}, which is not a node`,
        });
      }
    }
  }
  for (const edge of cycles(graph)) {
    findings.push({ rule: "cycle", message: `${edge} closes a cycle` });
  }
  if (findings.length > 0) return findings;
  for (const n of graph.nodes) {
    if (n.stage === "metric") {
      const sources = lineageUpstream(graph, n.id).filter(
        (r) => r.stage === "bronze" || r.stage === "collected"
      );
      if (sources.length === 0) {
        findings.push({
          rule: "metric-without-source",
          message: `${n.id} reaches no bronze feed or collected variable`,
        });
      }
    }
    if (n.stage === "report") {
      const shown = graph.edges.filter(
        (e) => e.to === n.id && e.from.startsWith("semantic.metrics.")
      );
      if (shown.length === 0) {
        findings.push({
          rule: "report-without-metric",
          message: `${n.id} shows no metric`,
        });
      }
    }
  }
  return findings;
}
