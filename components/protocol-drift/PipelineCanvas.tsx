"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  CHIP_SPECS,
  LANE_GEOMETRY,
  isWireCompatible,
  type ChipKind,
} from "@/lib/protocol-drift";
import { ChipNodeView } from "./ChipNodeView";
import { PacketEdgeView } from "./PacketEdgeView";
import {
  CHIP_WIDTH,
  clampChip,
  chipHeight,
  type ChipNode,
  type WireEdge,
} from "./graph-model";
import { useProtocolDriftStore } from "./store";

/** Drag payload key shared with the toolbox. */
export const CHIP_DRAG_TYPE = "application/x-protocol-drift-chip";

const nodeTypes = { chip: ChipNodeView };
const edgeTypes = { packet: PacketEdgeView };
const WORLD_WIDTH = 1340;
const WORLD_TOP = 100;
const WORLD_HEIGHT = 636;
const FIT_MARGIN = 8;

function LaneOverlay() {
  const { tabulationTop, conservationWallY, analysisBottom } = LANE_GEOMETRY;
  return (
    <ViewportPortal>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute font-mono"
        style={{ left: -400, top: 0, width: WORLD_WIDTH + 800, height: 0 }}
      >
        <div
          className="absolute left-0 right-0 border-y border-zinc-800 bg-white/[0.02]"
          style={{
            top: tabulationTop,
            height: conservationWallY - tabulationTop,
          }}
        />
        <div
          className="absolute left-0 right-0 bg-white/[0.01]"
          style={{
            top: conservationWallY,
            height: analysisBottom - conservationWallY,
          }}
        />
        <span
          className="absolute text-[13px] tracking-wide text-slate-300"
          style={{ left: 408, top: tabulationTop + 4 }}
        >
          TABULATION LANE (SDTM) · y{tabulationTop}–{conservationWallY}
        </span>
        <span
          className="absolute text-[13px] tracking-wide text-emerald-400"
          style={{ left: 408, top: conservationWallY + 24 }}
        >
          ANALYSIS LANE (ADaM) · y{conservationWallY}–{analysisBottom}
        </span>
        <div
          data-testid="conservation-wall"
          className="absolute left-0 right-0 border-t-2 border-dashed border-amber-500"
          style={{ top: conservationWallY }}
        />
        <span
          className="absolute bg-[#0d0e11] px-1 text-[13px] font-semibold tracking-wide text-amber-400"
          style={{ left: 408, top: conservationWallY - 8 }}
        >
          CONSERVATION WALL — CDISC REGULATORY BOUNDARY
        </span>
      </div>
    </ViewportPortal>
  );
}

/** Where a clicked or keyboard-added chip lands. */
function suggestPosition(
  kind: ChipKind,
  nodes: ChipNode[]
): { x: number; y: number } {
  const lane = CHIP_SPECS[kind].lane;
  const n = nodes.filter(
    (node) => CHIP_SPECS[node.data.kind].lane === lane
  ).length;
  const x = 40 + ((n * 190) % 1100);
  if (lane === "ANALYSIS")
    return { x, y: LANE_GEOMETRY.conservationWallY + 90 };
  if (lane === "WALL")
    return { x, y: LANE_GEOMETRY.conservationWallY - chipHeight(kind) - 4 };
  return { x, y: LANE_GEOMETRY.tabulationTop + 30 + (n % 3) * 40 };
}

/** Adds a chip at its suggested position (toolbox buttons and keyboard). */
export function placeChip(kind: ChipKind): void {
  const state = useProtocolDriftStore.getState();
  void state.addChip(kind, suggestPosition(kind, state.nodes));
}

function CanvasInner() {
  const nodes = useProtocolDriftStore((s) => s.nodes);
  const edges = useProtocolDriftStore((s) => s.edges);
  const fsm = useProtocolDriftStore((s) => s.snapshot?.fsmState);
  const setNodes = useProtocolDriftStore((s) => s.setNodes);
  const setEdges = useProtocolDriftStore((s) => s.setEdges);
  const connect = useProtocolDriftStore((s) => s.connect);
  const addChip = useProtocolDriftStore((s) => s.addChip);
  const commitCanvasEdit = useProtocolDriftStore((s) => s.commitCanvasEdit);
  const removeSelection = useProtocolDriftStore((s) => s.removeSelection);
  const flow = useReactFlow();
  const wrapper = useRef<HTMLDivElement | null>(null);
  const editable =
    fsm === "DRAFT" ||
    fsm === "VALIDATE" ||
    fsm === "DEPLOY_READY" ||
    fsm === "PAUSED" ||
    fsm === "WAVE_REVIEW";

  // Keep the lane geometry in view: fit the whole world, never pan or zoom.
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const fit = () => {
      const width = Math.floor(el.clientWidth);
      const height = Math.floor(el.clientHeight);
      if (width < 10 || height < 10) return;
      const zoom = Math.min(
        1,
        (width - FIT_MARGIN * 2) / WORLD_WIDTH,
        (height - FIT_MARGIN * 2) / WORLD_HEIGHT
      );
      void flow.setViewport({
        x: FIT_MARGIN,
        y: FIT_MARGIN - WORLD_TOP * zoom,
        zoom,
      });
    };
    fit();
    const observer = new ResizeObserver(() => fit());
    observer.observe(el);
    return () => observer.disconnect();
  }, [flow]);

  const onNodesChange = useCallback(
    (changes: NodeChange<ChipNode>[]) => {
      const next = applyNodeChanges(
        changes,
        useProtocolDriftStore.getState().nodes
      ).map((node) => ({
        ...node,
        position: clampChip(node.data.kind, node.position),
      }));
      setNodes(next);
    },
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<WireEdge>[]) => {
      setEdges(
        applyEdgeChanges(changes, useProtocolDriftStore.getState().edges)
      );
    },
    [setEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      void connect(connection);
    },
    [connect]
  );

  const isValidConnection = useCallback(
    (connection: {
      source: string;
      target: string;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    }) => {
      const all = useProtocolDriftStore.getState().nodes;
      const source = all.find((n) => n.id === connection.source);
      const target = all.find((n) => n.id === connection.target);
      if (
        !source ||
        !target ||
        !connection.sourceHandle ||
        !connection.targetHandle
      ) {
        return false;
      }
      return isWireCompatible(
        source.data.kind,
        connection.sourceHandle,
        target.data.kind,
        connection.targetHandle
      );
    },
    []
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    if (event.dataTransfer.types.includes(CHIP_DRAG_TYPE)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      const kind = event.dataTransfer.getData(CHIP_DRAG_TYPE) as ChipKind;
      if (!kind || !(kind in CHIP_SPECS)) return;
      event.preventDefault();
      const point = flow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      void addChip(kind, { x: point.x - CHIP_WIDTH / 2, y: point.y - 20 });
    },
    [addChip, flow]
  );

  const onDelete = useCallback(
    ({
      nodes: gone,
      edges: lost,
    }: {
      nodes: ChipNode[];
      edges: WireEdge[];
    }) => {
      void removeSelection(
        gone.map((n) => n.id),
        lost.map((e) => e.id)
      );
    },
    [removeSelection]
  );

  const defaultEdgeOptions = useMemo(() => ({ type: "packet" as const }), []);

  return (
    <div
      ref={wrapper}
      className="absolute inset-0 min-w-0"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow<ChipNode, WireEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeDragStop={() => void commitCanvasEdit()}
        onBeforeDelete={async () => editable}
        onDelete={onDelete}
        nodesDraggable={editable}
        nodesConnectable={editable}
        elementsSelectable
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        connectionRadius={36}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        aria-label="Pipeline canvas"
        className="!bg-[#0d0e11]"
      >
        <LaneOverlay />
      </ReactFlow>
    </div>
  );
}

/** The React Flow pipeline canvas with the Tabulation and Analysis lanes. */
export function PipelineCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
