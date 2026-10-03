/**
 * Zustand store that drives the simulation engine. The engine runs behind an
 * {@link EngineAdapter} (a Web Worker in browsers); the store sends commands,
 * folds the returned events and view into UI state, and owns the canvas graph
 * the player edits. External mutations (autosave, audio, downloads) run as
 * sequential steps after a state update, never inside a `set` updater.
 */
import { create } from "zustand";
import {
  DEFAULT_SEED,
  deserializeSave,
  isWireCompatible,
  restoreProtocolDriftEngine,
  serializeSave,
  type ClinicalQuery,
  type DatasetExportBundle,
  type ChipKind,
  type LockAuditResult,
  type PDCommand,
  type PDWorkerEvent,
  type PipelinePacket,
  type ProtocolDriftSaveFile,
  type ProtocolDriftView,
  type ScenarioId,
  type Scorecard,
  type SimSpeed,
  type StateSnapshotEvent,
  type WaveSummary,
} from "@/lib/protocol-drift";
import { recordArcadeScore } from "@/lib/arcade-achievements";
import { downloadFile } from "@/lib/download";
import { playProtocolCue } from "./audio";
import { createEngineAdapter, type EngineAdapter } from "./engine-adapter";
import type { EngineResponse } from "./engine-core";
import {
  clampChip,
  nextNodeId,
  toFlowEdges,
  toFlowNodes,
  toPipelineGraph,
  type ChipNode,
  type WireEdge,
} from "./graph-model";
import { writeAutosave } from "./persistence";

/** Longest history of dispatched packets the Pipeline Trace keeps. */
const MAX_PACKETS = 600;
/** Hard cap on simultaneously animated tokens (60fps budget). */
export const MAX_TOKENS = 30;
/** States in which the player may edit the pipeline. */
const EDITABLE = new Set([
  "DRAFT",
  "VALIDATE",
  "DEPLOY_READY",
  "PAUSED",
  "WAVE_REVIEW",
]);

/** A token gliding along one wire. */
interface WireToken {
  key: string;
  source: string;
  target: string;
}

/** The result of the latest "Run Local Test". */
interface ValidationState {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** A spoken/visible notice with a tone for styling. */
export interface Notice {
  id: number;
  tone: "info" | "warn" | "error";
  text: string;
}

/** What the inspector is looking at. */
interface InspectorSelection {
  issueId: string | null;
  submissionId: string | null;
}

/** Everything the workbench reads and the actions it calls. */
interface ProtocolDriftState {
  ready: boolean;
  mode: "worker" | "in-thread" | null;
  scenario: ScenarioId;
  view: ProtocolDriftView | null;
  snapshot: StateSnapshotEvent | null;
  nodes: ChipNode[];
  edges: WireEdge[];
  validation: ValidationState | null;
  packets: PipelinePacket[];
  edgeCounts: Record<string, number>;
  tokens: WireToken[];
  notice: Notice | null;
  waveSummary: WaveSummary | null;
  memoOpen: boolean;
  lockAudit: LockAuditResult | null;
  scorecard: Scorecard | null;
  datasets: DatasetExportBundle | null;
  selection: InspectorSelection;
  inspectorExpanded: boolean;
  revisionCount: number;
  autosavedAt: string | null;

  init: (scenario?: ScenarioId) => Promise<void>;
  dispose: () => void;
  command: (command: PDCommand) => Promise<EngineResponse | null>;
  acceptBrief: (scenario: ScenarioId) => Promise<void>;
  togglePause: () => Promise<void>;
  setSpeed: (speed: SimSpeed) => Promise<void>;
  step: () => Promise<void>;
  tick: (realMs: number) => Promise<void>;
  validate: () => Promise<void>;
  publish: () => Promise<void>;
  loadTemplate: (graph: {
    nodes: ChipNode[];
    edges: WireEdge[];
  }) => Promise<void>;
  addChip: (
    kind: ChipKind,
    position: { x: number; y: number }
  ) => Promise<void>;
  commitCanvasEdit: () => Promise<void>;
  setNodes: (nodes: ChipNode[]) => void;
  setEdges: (edges: WireEdge[]) => void;
  connect: (connection: {
    source: string;
    target: string;
    sourceHandle: string | null;
    targetHandle: string | null;
  }) => Promise<boolean>;
  removeSelection: (nodeIds: string[], edgeIds: string[]) => Promise<void>;
  select: (selection: Partial<InspectorSelection>) => void;
  setInspectorExpanded: (expanded: boolean) => void;
  dismissWave: () => void;
  dismissMemo: () => void;
  sendQuery: (
    issueId: string,
    evidenceLinked: boolean,
    message: string
  ) => Promise<ClinicalQuery | null>;
  requestLock: () => Promise<void>;
  returnToWorkbench: () => Promise<void>;
  confirmLock: () => Promise<void>;
  exportSave: () => Promise<void>;
  importSave: (text: string) => Promise<boolean>;
  exportDatasets: () => Promise<void>;
  restoreSave: (save: ProtocolDriftSaveFile) => Promise<boolean>;
}

let adapter: EngineAdapter | null = null;
let noticeId = 0;
let busy = false;
/** True while a save is replaying: no cues, no autosaves. */
let replaying = false;

function edgeKey(source: string, target: string): string {
  return `${source}>${target}`;
}

function describeRejection(command: PDCommand["type"], reason: string): string {
  return `${command.replaceAll("_", " ").toLowerCase()}: ${reason}`;
}

function initialState() {
  return {
    ready: false,
    mode: null as ProtocolDriftState["mode"],
    scenario: "full" as ScenarioId,
    view: null as ProtocolDriftView | null,
    snapshot: null as StateSnapshotEvent | null,
    nodes: [] as ChipNode[],
    edges: [] as WireEdge[],
    validation: null as ValidationState | null,
    packets: [] as PipelinePacket[],
    edgeCounts: {} as Record<string, number>,
    tokens: [] as WireToken[],
    notice: null as Notice | null,
    waveSummary: null as WaveSummary | null,
    memoOpen: false,
    lockAudit: null as LockAuditResult | null,
    scorecard: null as Scorecard | null,
    datasets: null as DatasetExportBundle | null,
    selection: { issueId: null, submissionId: null } as InspectorSelection,
    inspectorExpanded: false,
    revisionCount: 0,
    autosavedAt: null as string | null,
  };
}

/** The store hook. One game instance owns it at a time. */
export const useProtocolDriftStore = create<ProtocolDriftState>()((
  set,
  get
) => {
  const say = (tone: Notice["tone"], text: string) =>
    set({ notice: { id: ++noticeId, tone, text } });

  const autosave = async () => {
    if (!adapter) return;
    const res = await adapter.request({ type: "EXPORT_SAVE" });
    const saved = res.events.find((e) => e.type === "SAVE_EXPORTED");
    if (saved && saved.type === "SAVE_EXPORTED") {
      await writeAutosave(saved.save);
      set({ autosavedAt: saved.save.savedAt });
    }
  };

  /** Folds one response into state; returns the events for the caller. */
  const absorb = (res: EngineResponse): PDWorkerEvent[] => {
    const patch: Partial<ProtocolDriftState> = { view: res.view };
    const fresh: PipelinePacket[] = [];
    let needsAutosave = false;
    let cue: Parameters<typeof playProtocolCue>[0] | null = null;
    const prior = get();
    for (const event of res.events) {
      switch (event.type) {
        case "STATE_SNAPSHOT":
          patch.snapshot = event;
          break;
        case "VALIDATION_RESULT":
          patch.validation = {
            valid: event.valid,
            errors: event.errors,
            warnings: event.warnings,
          };
          if (!event.valid) cue = "rejectCollision";
          break;
        case "REVISION_PUBLISHED":
          patch.revisionCount = prior.revisionCount + 1;
          needsAutosave = true;
          break;
        case "PACKET_DISPATCHED":
          fresh.push(event.packet);
          break;
        case "QUERY_UPDATED":
          if (event.query.communicationState === "Answered") {
            cue = "queryAlert";
            patch.notice = {
              id: ++noticeId,
              tone: "info",
              text: `Site responded to ${event.query.queryId}: ${event.query.responseReceived ?? ""}`,
            };
          }
          break;
        case "RECORD_SUPERSEDED":
          cue = "sourceCorrect";
          break;
        case "WAVE_COMPLETED":
          patch.waveSummary = event.summary;
          needsAutosave = true;
          break;
        case "AUTO_PAUSED":
          if (event.reason === "AMENDMENT_01") {
            patch.memoOpen = true;
          } else {
            patch.notice = {
              id: ++noticeId,
              tone: "warn",
              text: `Clock paused: ${event.reason.replace("NEW_ISSUE_CATEGORY:", "new issue category ")}`,
            };
          }
          break;
        case "LOCK_AUDIT":
          patch.lockAudit = event.result;
          break;
        case "LOCKED":
          patch.scorecard = event.scorecard;
          cue = "gatePass";
          recordArcadeScore(
            "protocol-drift",
            100 +
              event.scorecard.badges.filter((b) => b.earned).length * 100 +
              Math.round(event.scorecard.meanGoodwill)
          );
          break;
        case "DATASETS_EXPORTED":
          patch.datasets = event.bundle;
          break;
        case "COMMAND_REJECTED":
          cue = "rejectCollision";
          patch.notice = {
            id: ++noticeId,
            tone: "error",
            text: describeRejection(event.command, event.reason),
          };
          break;
        default:
          break;
      }
    }
    if (fresh.length > 0) {
      patch.packets = [...prior.packets, ...fresh].slice(-MAX_PACKETS);
      const counts = { ...prior.edgeCounts };
      const tokens: WireToken[] = [];
      for (const packet of fresh) {
        for (let i = 1; i < packet.trace.length; i += 1) {
          const key = edgeKey(packet.trace[i - 1], packet.trace[i]);
          counts[key] = (counts[key] ?? 0) + 1;
          tokens.push({
            key: `${packet.id}:${i}`,
            source: packet.trace[i - 1],
            target: packet.trace[i],
          });
        }
      }
      patch.edgeCounts = counts;
      patch.tokens = tokens.slice(-MAX_TOKENS);
    }
    set(patch);
    if (cue && !replaying) playProtocolCue(cue);
    if (needsAutosave && !replaying) void autosave();
    return res.events;
  };

  const send = async (command: PDCommand): Promise<EngineResponse | null> => {
    if (!adapter) return null;
    const res = await adapter.request(command);
    absorb(res);
    return res;
  };

  /** True when the pipeline may be edited; says why not otherwise. */
  const canEdit = (): boolean => {
    const fsm = get().snapshot?.fsmState;
    if (!fsm || !EDITABLE.has(fsm)) {
      say("warn", "Pause the clock to edit the pipeline.");
      return false;
    }
    return true;
  };

  return {
    ...initialState(),

    init: async (scenario = "full") => {
      adapter?.dispose();
      adapter = createEngineAdapter();
      set({ ...initialState(), mode: adapter.mode, scenario });
      await send({ type: "INIT", seed: DEFAULT_SEED, scenario });
      set({ ready: true });
    },

    dispose: () => {
      adapter?.dispose();
      adapter = null;
      set({ ...initialState() });
    },

    command: (command) => send(command),

    acceptBrief: async (scenario) => {
      if (get().snapshot?.fsmState !== "BRIEF") return;
      if (scenario !== get().scenario) {
        await send({ type: "INIT", seed: DEFAULT_SEED, scenario });
        set({ scenario });
      }
      await send({ type: "ACCEPT_BRIEF" });
    },

    togglePause: async () => {
      const fsm = get().snapshot?.fsmState;
      if (fsm === "RUNNING") {
        await send({ type: "SET_PAUSED", isPaused: true });
      } else if (fsm === "PAUSED" || fsm === "WAVE_REVIEW") {
        set({ waveSummary: null });
        await send({ type: "SET_PAUSED", isPaused: false });
      } else if (fsm === "DRAFT" || fsm === "DEPLOY_READY") {
        say("warn", "Run Local Test and Publish Revision before unpausing.");
        playProtocolCue("rejectCollision");
      }
    },

    setSpeed: async (speed) => {
      await send({ type: "SET_SPEED", speed });
    },

    step: async () => {
      const res = await send({ type: "STEP_TICK" });
      if (res && !res.events.some((e) => e.type === "COMMAND_REJECTED")) {
        playProtocolCue("eventStep");
      }
    },

    tick: async (realMs) => {
      if (busy || get().snapshot?.fsmState !== "RUNNING") return;
      busy = true;
      try {
        await send({ type: "TICK", realMs });
      } finally {
        busy = false;
      }
    },

    validate: async () => {
      const { nodes, edges } = get();
      const res = await send({
        type: "VALIDATE_GRAPH",
        ...toPipelineGraph(nodes, edges),
      });
      const clamped = res?.view.draftGraph;
      if (clamped) {
        set({ nodes: toFlowNodes(clamped.nodes) });
      }
    },

    publish: async () => {
      const { nodes, edges, revisionCount } = get();
      await send({
        type: "PUBLISH_REVISION",
        revisionId: `p${revisionCount + 1}`,
        ...toPipelineGraph(nodes, edges),
      });
    },

    loadTemplate: async ({ nodes, edges }) => {
      set({ nodes, edges, validation: null });
      const fsm = get().snapshot?.fsmState;
      if (fsm && EDITABLE.has(fsm)) {
        await send({
          type: "LOAD_GRAPH",
          ...toPipelineGraph(nodes, edges),
        });
      }
    },

    addChip: async (kind, position) => {
      if (!canEdit()) return;
      const { nodes } = get();
      const node: ChipNode = {
        id: nextNodeId(kind, nodes),
        type: "chip",
        position: clampChip(kind, position),
        data: { kind },
      };
      set({ nodes: [...nodes, node], validation: null });
      await get().commitCanvasEdit();
    },

    commitCanvasEdit: async () => {
      const { nodes, edges } = get();
      await send({ type: "LOAD_GRAPH", ...toPipelineGraph(nodes, edges) });
    },

    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),

    connect: async (connection) => {
      const { nodes, edges } = get();
      const source = nodes.find((n) => n.id === connection.source);
      const target = nodes.find((n) => n.id === connection.target);
      if (
        !source ||
        !target ||
        !connection.sourceHandle ||
        !connection.targetHandle
      ) {
        return false;
      }
      const ok = isWireCompatible(
        source.data.kind,
        connection.sourceHandle,
        target.data.kind,
        connection.targetHandle
      );
      if (!ok) {
        playProtocolCue("rejectCollision");
        say(
          "error",
          `Wire rejected: ${source.data.kind}.${connection.sourceHandle} cannot feed ${target.data.kind}.${connection.targetHandle}`
        );
        return false;
      }
      const id = `${connection.source}.${connection.sourceHandle}->${connection.target}.${connection.targetHandle}`;
      if (edges.some((e) => e.id === id)) return false;
      if (!canEdit()) return false;
      set({
        edges: [
          ...get().edges,
          {
            id,
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle,
            targetHandle: connection.targetHandle,
            type: "packet",
          },
        ],
        validation: null,
      });
      playProtocolCue("wireSnap");
      await get().commitCanvasEdit();
      return true;
    },

    removeSelection: async (nodeIds, edgeIds) => {
      if (nodeIds.length === 0 && edgeIds.length === 0) return;
      if (!canEdit()) return;
      const dead = new Set(nodeIds);
      const deadEdges = new Set(edgeIds);
      set((state) => ({
        nodes: state.nodes.filter((n) => !dead.has(n.id)),
        edges: state.edges.filter(
          (e) =>
            !deadEdges.has(e.id) && !dead.has(e.source) && !dead.has(e.target)
        ),
        validation: null,
      }));
      await get().commitCanvasEdit();
    },

    select: (selection) =>
      set((state) => ({ selection: { ...state.selection, ...selection } })),

    setInspectorExpanded: (expanded) => set({ inspectorExpanded: expanded }),
    dismissWave: () => set({ waveSummary: null }),
    dismissMemo: () => set({ memoOpen: false }),

    sendQuery: async (issueId, evidenceLinked, message) => {
      const draft = await send({
        type: "DRAFT_QUERY",
        issueId,
        evidenceLinked,
        ...(message.trim() ? { message: message.trim() } : {}),
      });
      const drafted = draft?.events.find(
        (e) =>
          e.type === "QUERY_UPDATED" && e.query.communicationState === "Draft"
      );
      if (!drafted || drafted.type !== "QUERY_UPDATED") return null;
      const sent = await send({
        type: "SEND_QUERY",
        queryId: drafted.query.queryId,
      });
      const final = sent?.events.find(
        (e) =>
          e.type === "QUERY_UPDATED" &&
          e.query.queryId === drafted.query.queryId
      );
      return final && final.type === "QUERY_UPDATED"
        ? final.query
        : drafted.query;
    },

    requestLock: async () => {
      await send({ type: "REQUEST_LOCK" });
    },
    returnToWorkbench: async () => {
      set({ lockAudit: null });
      await send({ type: "RETURN_TO_WORKBENCH" });
    },
    confirmLock: async () => {
      const res = await send({ type: "CONFIRM_LOCK" });
      if (res?.events.some((e) => e.type === "LOCKED")) {
        await send({ type: "EXPORT_DATASETS" });
      }
    },

    exportSave: async () => {
      const res = await send({ type: "EXPORT_SAVE" });
      const saved = res?.events.find((e) => e.type === "SAVE_EXPORTED");
      if (saved && saved.type === "SAVE_EXPORTED") {
        downloadFile(serializeSave(saved.save), "pd-101-save-v1.json", {
          mimeType: "application/json",
        });
        say("info", "Save exported as pd-101-save-v1.json");
      }
    },

    importSave: async (text) => {
      try {
        const save = deserializeSave(text);
        // Replaying on the main thread proves the save before the worker
        // adopts it; a tampered file throws here and changes nothing.
        restoreProtocolDriftEngine(save);
        return await get().restoreSave(save);
      } catch (error) {
        say("error", error instanceof Error ? error.message : "Import failed");
        playProtocolCue("rejectCollision");
        return false;
      }
    },

    restoreSave: async (save) => {
      if (!adapter) return false;
      try {
        restoreProtocolDriftEngine(save);
      } catch (error) {
        say(
          "error",
          error instanceof Error ? error.message : "Save is invalid"
        );
        return false;
      }
      set({
        ...initialState(),
        mode: adapter.mode,
        scenario: save.scenario,
        ready: true,
      });
      replaying = true;
      let last: EngineResponse | null = null;
      try {
        await send({ type: "INIT", seed: save.seed, scenario: save.scenario });
        for (const command of save.commands) {
          if (command.type === "INIT") continue;
          last = await send(command);
        }
      } finally {
        replaying = false;
      }
      const view = last?.view ?? get().view;
      if (view) {
        const graph = view.draftGraph;
        const published = view.publishedGraph;
        const source = graph.nodes.length > 0 ? graph : (published ?? graph);
        const revisions = view.auditTrail.filter(
          (e) => e.type === "REVISION_PUBLISHED"
        ).length;
        // Modals follow the final state, not the replayed events.
        set({
          nodes: toFlowNodes(source.nodes),
          edges: toFlowEdges(source.edges),
          revisionCount: revisions,
          memoOpen: false,
          notice: null,
          waveSummary:
            view.fsmState === "WAVE_REVIEW" ? get().waveSummary : null,
          lockAudit:
            view.fsmState === "LOCK_REVIEW" ? view.lastLockAudit : null,
        });
        if (view.fsmState === "LOCKED") {
          await send({ type: "EXPORT_DATASETS" });
        }
      }
      say("info", "Save restored");
      return true;
    },

    exportDatasets: async () => {
      const res = await send({ type: "EXPORT_DATASETS" });
      const done = res?.events.find((e) => e.type === "DATASETS_EXPORTED");
      if (!done)
        say("warn", "Datasets are available once the study is locked.");
    },
  };
});
