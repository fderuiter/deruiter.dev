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
  touchZoomFloor,
  type ChipNode,
  type WireEdge,
} from "./graph-model";
import { useProtocolDriftStore } from "./store";
import { useCabinetTouch } from "@/components/arcade/mobile/CabinetTouchContext";
import { TouchWireControls } from "./TouchWireControls";
import { canRewire, resolveTouchWire } from "./touch-wire";

/** Drag payload key shared with the toolbox. */
export const CHIP_DRAG_TYPE = "application/x-protocol-drift-chip";

const nodeTypes = { chip: ChipNodeView };
const edgeTypes = { packet: PacketEdgeView };
const WORLD_WIDTH = 1340;
const WORLD_TOP = 100;
const WORLD_HEIGHT = 636;
const FIT_MARGIN = 8;
/**
 * On the touch cabinet the zoom never drops below the size at which a chip
 * and its title stay legible (#2045), computed from the chip geometry.
 */
const TOUCH_MIN_ZOOM = touchZoomFloor();

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

/** Window event sent after a touch add, so the canvas can pan to the chip. */
export const PROTOCOL_DRIFT_CHIP_ADDED_EVENT = "protocol-drift:chip-added";

/** Empty space kept between chips when a new one is placed on touch. */
const CHIP_GAP = 16;

/** True when a chip of this kind at this spot would touch a chip already there. */
function clashes(
  kind: ChipKind,
  spot: { x: number; y: number },
  nodes: ChipNode[]
): boolean {
  const h = chipHeight(kind);
  return nodes.some((node) => {
    const other = node.data.kind;
    const otherH = chipHeight(other);
    return (
      spot.x < node.position.x + CHIP_WIDTH + CHIP_GAP &&
      node.position.x < spot.x + CHIP_WIDTH + CHIP_GAP &&
      spot.y < node.position.y + otherH + CHIP_GAP &&
      node.position.y < spot.y + h + CHIP_GAP
    );
  });
}

/**
 * Touch: the first spot for a new chip that clears every existing chip's box.
 * It steps along the lane's row, then down to the next row, until it is clear
 * (#2045). Desktop keeps suggestPosition.
 */
export function touchChipSpot(
  kind: ChipKind,
  nodes: ChipNode[]
): { x: number; y: number } {
  const base = suggestPosition(kind, nodes);
  const stepX = CHIP_WIDTH + CHIP_GAP;
  const stepY = chipHeight(kind) + CHIP_GAP;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      const spot = clampChip(kind, {
        x: base.x + col * stepX,
        y: base.y + row * stepY,
      });
      if (!clashes(kind, spot, nodes)) return spot;
    }
  }
  return clampChip(kind, base);
}

/**
 * Adds a chip (toolbox buttons and keyboard). On touch the chip takes a clear
 * spot, the canvas pans to it at the current zoom, and the add is announced.
 */
export async function placeChip(
  kind: ChipKind,
  options: { touch?: boolean } = {}
): Promise<void> {
  const state = useProtocolDriftStore.getState();
  if (!options.touch) {
    await state.addChip(kind, suggestPosition(kind, state.nodes));
    return;
  }
  const before = new Set(state.nodes.map((node) => node.id));
  await state.addChip(kind, touchChipSpot(kind, state.nodes));
  const latest = useProtocolDriftStore.getState();
  const added = latest.nodes.find((node) => !before.has(node.id));
  if (!added) return;
  window.dispatchEvent(
    new CustomEvent(PROTOCOL_DRIFT_CHIP_ADDED_EVENT, {
      detail: { kind, x: added.position.x, y: added.position.y },
    })
  );
  latest.notify("info", `Added ${kind}.`);
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
  // Touch: a finger pans the empty canvas and a pinch zooms it, both inside
  // the canvas (the page never scrolls under them). Desktop keeps the fitted,
  // fixed view it always had.
  const touch = useCabinetTouch();
  const editable = canRewire(fsm);

  // Touch: a chip added from the toolbox is brought into view at the current
  // zoom, so the canvas pans rather than zooms (#2045).
  useEffect(() => {
    if (!touch) return;
    const onAdded = (event: Event) => {
      const { kind, x, y } = (
        event as CustomEvent<{ kind: ChipKind; x: number; y: number }>
      ).detail;
      void flow.setCenter(x + CHIP_WIDTH / 2, y + chipHeight(kind) / 2, {
        zoom: flow.getZoom(),
        duration: 0,
      });
    };
    window.addEventListener(PROTOCOL_DRIFT_CHIP_ADDED_EVENT, onAdded);
    return () =>
      window.removeEventListener(PROTOCOL_DRIFT_CHIP_ADDED_EVENT, onAdded);
  }, [flow, touch]);

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
      // On touch the whole world may not fit at a legible zoom: then the
      // fit frames the chips at the floor and the player pans.
      if (touch && zoom < TOUCH_MIN_ZOOM) {
        void flow.fitView({
          padding: 0.06,
          duration: 0,
          minZoom: TOUCH_MIN_ZOOM,
          maxZoom: TOUCH_MIN_ZOOM,
        });
        return;
      }
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
  }, [flow, touch]);

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

  // Touch only: a tap on a chip while a wire is started finishes that wire
  // (#2045). The chip the wire starts from gets a ring.
  const wireFrom = useProtocolDriftStore((s) => s.wireFrom);
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: ChipNode) => {
      const pending = useProtocolDriftStore.getState().wireFrom;
      if (!pending || node.id === pending) return;
      void resolveTouchWire(pending, node.id);
    },
    []
  );
  const flowNodes = useMemo(
    () =>
      touch && wireFrom
        ? nodes.map((node) =>
            node.id === wireFrom
              ? { ...node, className: "pd-wire-source" }
              : node
          )
        : nodes,
    [nodes, touch, wireFrom]
  );

  return (
    <div
      ref={wrapper}
      className="absolute inset-0 min-w-0"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow<ChipNode, WireEdge>
        nodes={flowNodes}
        onNodeClick={touch ? onNodeClick : undefined}
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
        panOnDrag={touch}
        zoomOnScroll={false}
        zoomOnPinch={touch}
        minZoom={touch ? TOUCH_MIN_ZOOM : undefined}
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
      {touch ? <TouchWireControls /> : null}
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
