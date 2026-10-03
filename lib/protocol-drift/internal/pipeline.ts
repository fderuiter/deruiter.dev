/**
 * Runs one source revision through a published graph. Nodes execute in
 * topological order and each receives every token addressed to it at once,
 * so collectors such as PivotToObservation see a whole visit. The analysis
 * lane is ledger-level and runs separately (see analysis.ts).
 */
import { SITE_PROFILES } from "../presets";
import type {
  CanvasNode,
  FieldValue,
  IssueCode,
  IssueOrigin,
  MhCategory,
  MhDraft,
  ObservationDraft,
  PipelinePacket,
  PortType,
  RoutingRecord,
  SourceRevision,
} from "../types";
import {
  PIVOT_HANDLE_MAP,
  normalizeDate,
  regexSplit,
  routeAmendment,
  standardUnit,
  standardizeUnit,
} from "./chips";
import { isoToMinute } from "./clock";
import { resolvePartialDate, worstStatus } from "./debt";
import { CHIP_SPECS, edgesFrom, type CompiledGraph } from "./graph";

/** An issue the pipeline wants raised. */
export interface IssueDraft {
  code: IssueCode;
  origin: IssueOrigin;
  targetField: string;
  message: string;
  evidence?: string;
}

/** A token that must be parked in the hold tray. */
export interface HeldDraft {
  nodeId: string;
  handle: string;
  reason: string;
  value?: string;
  issue?: IssueDraft;
  loss: boolean;
}

/** Everything one pipeline run produced. */
export interface PipelineRunResult {
  observations: ObservationDraft[];
  mh: MhDraft[];
  held: HeldDraft[];
  unmatched: Array<{ nodeId: string; text: string; issue: IssueDraft }>;
  issues: IssueDraft[];
  routing: RoutingRecord | null;
  dispatched: PipelinePacket[];
  regexSplitUsed: boolean;
}

/** Inputs the runner needs from the engine. */
export interface PipelineRunContext {
  revision: SourceRevision;
  graph: CompiledGraph;
  activationMinute: number;
}

const MEASUREMENT_HANDLES = new Set([
  "sbp",
  "dbp",
  "pulse",
  "sbp_stand",
  "dbp_stand",
  "raw_bp",
]);

const EXTRACT_KEYS: Record<string, string> = {
  sbp: "sbp",
  sbp_sit: "sbp",
  dbp: "dbp",
  dbp_sit: "dbp",
  pulse: "pulse",
  sbp_stand: "sbp_stand",
  dbp_stand: "dbp_stand",
};

type Buffers = Map<string, Map<string, PipelinePacket[]>>;
type Outputs = Map<string, PipelinePacket[]>;

/** Executes a source revision through the compiled graph. */
export function runPipeline(ctx: PipelineRunContext): PipelineRunResult {
  const { revision, graph } = ctx;
  const profile = SITE_PROFILES[revision.siteId];
  const result: PipelineRunResult = {
    observations: [],
    mh: [],
    held: [],
    unmatched: [],
    issues: [],
    routing: null,
    dispatched: [],
    regexSplitUsed: false,
  };
  let counter = 0;

  const make = (
    nodeId: string,
    portType: PortType,
    base: PipelinePacket | null,
    extra: Partial<PipelinePacket>
  ): PipelinePacket => {
    counter += 1;
    return {
      id: `${revision.sourceRevisionId}:${nodeId}:${counter}`,
      sourceNodeId: nodeId,
      submissionId: revision.submissionId,
      sourceRevisionId: revision.sourceRevisionId,
      siteId: revision.siteId,
      subjectId: revision.subjectId,
      visitDay: revision.visitDay,
      assessedAt: revision.assessedAt,
      submittedAt: revision.submittedAt,
      formVersion: revision.formVersion,
      portType,
      payload: base ? base.payload : { ...revision.payload },
      epistemicBadges: base ? [...base.epistemicBadges] : ["CONFIRMED"],
      fabricatedBits: base ? base.fabricatedBits : 0,
      trace: base ? [...base.trace, nodeId] : [nodeId],
      ...extra,
    };
  };

  const bpUnit = String(
    revision.payload.bp_unit ?? profile.defaultPressureUnit
  );
  const fieldPacket = (
    nodeId: string,
    base: PipelinePacket,
    name: string,
    value: unknown,
    badges?: PipelinePacket["epistemicBadges"]
  ): PipelinePacket =>
    make(nodeId, "field", base, {
      field: {
        name,
        orres: String(value),
        orresu: name === "pulse" ? "beats/min" : bpUnit,
        standardized: false,
      },
      ...(badges ? { epistemicBadges: badges } : {}),
    });

  const execute = (
    node: CanvasNode,
    inputs: Map<string, PipelinePacket[]>
  ): Outputs => {
    const out: Outputs = new Map();
    const emit = (handle: string, packet: PipelinePacket) => {
      out.set(handle, [...(out.get(handle) ?? []), packet]);
    };
    const all = (handle: string) => inputs.get(handle) ?? [];

    switch (node.type) {
      case "SourceIngest": {
        if (revision.kind === "MH") {
          const pl = revision.payload;
          const mh: MhDraft = {
            MHTERM: String(pl.MHTERM ?? ""),
            MHDECOD: String(pl.MHDECOD ?? ""),
            MHCAT: (pl.MHCAT as MhCategory) ?? "BASELINE ABNORMALITY",
            MHSTDTC: String(pl.MHSTDTC ?? ""),
            MHENRTPT: "ONGOING",
            status: "CONFIRMED",
            fabricatedBits: 0,
          };
          emit("mh_entry", make(node.id, "mh", null, { mh }));
        } else {
          emit("raw_entry", make(node.id, "submission", null, {}));
        }
        break;
      }
      case "AmendmentRouter": {
        const routeBy =
          node.data?.routeBy === "submittedAt" ? "submittedAt" : "assessedAt";
        for (const packet of all("in")) {
          const decision = routeAmendment(
            {
              assessedAtMinute: isoToMinute(revision.assessedAt),
              submittedAtMinute: isoToMinute(revision.submittedAt),
              formVersion: revision.formVersion ?? null,
            },
            ctx.activationMinute,
            routeBy
          );
          result.routing = {
            submissionId: revision.submissionId,
            sourceRevisionId: revision.sourceRevisionId,
            handle: decision.handle,
            requiredVersion: decision.requiredVersion,
            formVersion: revision.formVersion ?? null,
            routedBy: routeBy,
          };
          if (decision.handle === "review") {
            result.issues.push({
              code: "APPLICABILITY_DISCREPANCY",
              origin: routeBy === "submittedAt" ? "pipeline" : "source",
              targetField: "formVersion",
              message: decision.reason,
            });
          }
          emit(decision.handle, make(node.id, "submission", packet, {}));
        }
        break;
      }
      case "ExtractField": {
        for (const packet of all("in")) {
          const pass: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(packet.payload)) {
            const handle = EXTRACT_KEYS[k];
            if (handle) {
              emit(handle, fieldPacket(node.id, packet, handle, v));
            } else if (k === "raw_bp") {
              emit(
                "raw_bp",
                make(node.id, "text", packet, {
                  field: {
                    name: "raw_bp",
                    orres: String(v),
                    orresu: "",
                    standardized: false,
                  },
                })
              );
            } else if (k === "visit_date") {
              emit(
                "visit_date",
                make(node.id, "date", packet, {
                  field: {
                    name: "visit_date",
                    orres: String(v),
                    orresu: "",
                    standardized: false,
                  },
                })
              );
            } else {
              pass[k] = v;
            }
          }
          if (Object.keys(pass).length > 0) {
            emit(
              "pass",
              make(node.id, "submission", packet, { payload: pass })
            );
          }
        }
        break;
      }
      case "RegexSplit": {
        result.regexSplitUsed = true;
        for (const packet of all("text_in")) {
          const text = packet.field?.orres ?? "";
          const split = regexSplit(text);
          if (split.sbp !== null && split.dbp !== null) {
            emit("sbp", fieldPacket(node.id, packet, "sbp", split.sbp));
            emit("dbp", fieldPacket(node.id, packet, "dbp", split.dbp));
          }
          if (split.unmatched !== "") {
            const issue: IssueDraft = {
              code: "NARRATIVE_REPEAT",
              origin: "source",
              targetField: "raw_bp",
              message:
                split.readings.length > 1
                  ? `Narrative holds ${split.readings.length} readings; primary ${split.sbp}/${split.dbp} taken, remainder needs disposition: "${split.unmatched}"`
                  : `Unparsed narrative text needs disposition: "${split.unmatched}"`,
              evidence: text,
            };
            result.unmatched.push({
              nodeId: node.id,
              text: split.unmatched,
              issue,
            });
            emit(
              "unmatched",
              make(node.id, "text", packet, {
                field: {
                  name: "unmatched",
                  orres: split.unmatched,
                  orresu: "",
                  standardized: false,
                },
                epistemicBadges: ["LOSS"],
              })
            );
          }
        }
        break;
      }
      case "DateLocaleNormalizer": {
        const policy =
          node.data?.partialDates === "impute-day" ? "impute-day" : "preserve";
        for (const packet of all("date_in")) {
          const raw = packet.field?.orres ?? "";
          const norm = normalizeDate(raw, profile.dateFormat);
          if (norm.ok) {
            emit(
              "iso_date",
              make(node.id, "date", packet, {
                field: { ...(packet.field as FieldValue), iso: norm.iso },
              })
            );
          } else {
            result.issues.push({
              code: "DATE_UNPARSEABLE",
              origin: "source",
              targetField: "visit_date",
              message: norm.reason,
            });
            emit("error", make(node.id, "date", packet, {}));
          }
        }
        for (const packet of all("mh_in")) {
          const mh = packet.mh as MhDraft;
          const norm = normalizeDate(mh.MHSTDTC, profile.dateFormat);
          if (!norm.ok) {
            result.issues.push({
              code: "DATE_UNPARSEABLE",
              origin: "source",
              targetField: "MHSTDTC",
              message: norm.reason,
            });
            emit("error", make(node.id, "mh", packet, {}));
            continue;
          }
          const resolved = resolvePartialDate(norm.iso, policy);
          emit(
            "mh_out",
            make(node.id, "mh", packet, {
              mh: {
                ...mh,
                MHSTDTC: resolved.value,
                status: worstStatus([mh.status, resolved.status]),
                fabricatedBits: mh.fabricatedBits + resolved.fabricatedBits,
              },
              fabricatedBits: packet.fabricatedBits + resolved.fabricatedBits,
              epistemicBadges: [...packet.epistemicBadges, resolved.status],
            })
          );
        }
        break;
      }
      case "UnitStandardizer": {
        for (const packet of all("val_in")) {
          const f = packet.field as FieldValue;
          const std = standardizeUnit(f.orres, f.orresu);
          if (!std) {
            const issue: IssueDraft = {
              code: "UNKNOWN_UNIT",
              origin: "source",
              targetField: f.name,
              message: `Unknown unit "${f.orresu}" for ${f.name}; quarantined, never guessed`,
            };
            result.held.push({
              nodeId: node.id,
              handle: "val_in",
              reason: issue.message,
              value: f.orres,
              issue,
              loss: false,
            });
            continue;
          }
          emit(
            "std_val",
            make(node.id, "field", packet, {
              field: { ...f, ...std, standardized: true },
            })
          );
          emit(
            "orig_unit",
            make(node.id, "unit", packet, {
              field: {
                name: `${f.name}_unit`,
                orres: f.orresu,
                orresu: "",
                standardized: false,
              },
            })
          );
        }
        break;
      }
      case "PivotToObservation": {
        let vsdtc = revision.assessedAt.slice(0, 10);
        const dates = all("date");
        if (dates.length > 0) {
          const f = dates[0].field as FieldValue;
          const parsed = f.iso
            ? ({ ok: true, iso: f.iso } as const)
            : normalizeDate(f.orres, "MM/DD/YYYY");
          if (!parsed.ok) {
            const issue: IssueDraft = {
              code: "DATE_UNPARSEABLE",
              origin: "pipeline",
              targetField: "VSDTC",
              message: `${parsed.reason} (no locale normalization)`,
            };
            result.held.push({
              nodeId: node.id,
              handle: "date",
              reason: issue.message,
              value: f.orres,
              issue,
              loss: false,
            });
            break;
          }
          vsdtc = parsed.iso;
        }
        for (const [handle, map] of Object.entries(PIVOT_HANDLE_MAP)) {
          for (const packet of all(handle)) {
            const f = packet.field as FieldValue;
            const std = standardUnit(map.testcd);
            let draft: ObservationDraft;
            if (f.standardized && f.stresn !== undefined) {
              draft = {
                VSTESTCD: map.testcd,
                VSPOS: map.pos,
                VSORRES: f.orres,
                VSORRESU: f.orresu,
                VSSTRESN: f.stresn,
                VSSTRESU: f.stresu ?? std,
                precision: f.precision ?? 0,
                VSDTC: vsdtc,
                status: worstStatus(packet.epistemicBadges),
              };
            } else {
              const passthrough = standardizeUnit(f.orres, std);
              const lost = f.orresu !== std;
              draft = {
                VSTESTCD: map.testcd,
                VSPOS: map.pos,
                VSORRES: f.orres,
                VSORRESU: std,
                VSSTRESN: passthrough ? passthrough.stresn : Number.NaN,
                VSSTRESU: std,
                precision: passthrough ? passthrough.precision : 0,
                VSDTC: vsdtc,
                status: worstStatus([
                  ...packet.epistemicBadges,
                  ...(lost ? (["LOSS"] as const) : []),
                ]),
                ...(lost
                  ? {
                      lossNote: `Original unit ${f.orresu} discarded without standardization`,
                    }
                  : {}),
              };
            }
            emit(
              "obs_stream",
              make(node.id, "observation", packet, { observation: draft })
            );
          }
        }
        break;
      }
      case "CDISCSink": {
        for (const packet of all("obs_in")) {
          if (packet.observation) result.observations.push(packet.observation);
        }
        for (const packet of all("mh_in")) {
          if (packet.mh) result.mh.push(packet.mh);
        }
        break;
      }
      default:
        // SnapshotHandoff and PairAndDerive run at ledger level.
        break;
    }
    return out;
  };

  const buffers: Buffers = new Map();
  for (const nodeId of graph.order) {
    const node = graph.nodes.get(nodeId) as CanvasNode;
    const inputs = buffers.get(nodeId) ?? new Map<string, PipelinePacket[]>();
    if (node.type !== "SourceIngest" && inputs.size === 0) continue;
    const outputs = execute(node, inputs);
    for (const [handle, packets] of outputs) {
      const edges = edgesFrom(graph, nodeId, handle);
      if (edges.length === 0) {
        handleUnconnected(node, handle, packets, result);
        continue;
      }
      for (const e of edges) {
        const target =
          buffers.get(e.target) ?? new Map<string, PipelinePacket[]>();
        const th = e.targetHandle ?? "";
        for (const packet of packets) {
          const delivered: PipelinePacket = {
            ...packet,
            targetNodeId: e.target,
          };
          target.set(th, [...(target.get(th) ?? []), delivered]);
          result.dispatched.push(delivered);
        }
        buffers.set(e.target, target);
      }
    }
  }
  return result;
}

function handleUnconnected(
  node: CanvasNode,
  handle: string,
  packets: PipelinePacket[],
  result: PipelineRunResult
): void {
  const spec = CHIP_SPECS[node.type].outputs.find((o) => o.handle === handle);
  if (!spec) return;
  if (node.type === "RegexSplit" && handle === "unmatched") return;
  if (node.type === "AmendmentRouter" && handle === "review") {
    for (const packet of packets) {
      result.held.push({
        nodeId: node.id,
        handle,
        reason: "Held for applicability review",
        value: packet.formVersion,
        loss: false,
      });
    }
    return;
  }
  if (handle === "error") {
    for (const packet of packets) {
      result.held.push({
        nodeId: node.id,
        handle,
        reason: "Unparseable date held for review",
        value: packet.field?.orres ?? packet.mh?.MHSTDTC,
        loss: false,
      });
    }
    return;
  }
  const measurement =
    (spec.type === "field" || spec.type === "text") &&
    MEASUREMENT_HANDLES.has(handle);
  const mhDropped = spec.type === "mh";
  const obsDropped = spec.type === "observation" || spec.type === "submission";
  if (!measurement && !mhDropped && !(obsDropped && handle !== "pass")) return;
  for (const packet of packets) {
    const field = packet.field?.name ?? handle;
    const issue: IssueDraft = {
      code: "UNMAPPED_FIELD",
      origin: "pipeline",
      targetField: field,
      message: `${node.id}.${handle} is not wired: ${field} held, not tabulated`,
    };
    result.held.push({
      nodeId: node.id,
      handle,
      reason: issue.message,
      value: packet.field?.orres,
      issue,
      loss: true,
    });
  }
}
