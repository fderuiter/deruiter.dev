"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Controls,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type FinalConnectionState,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  CHIP_SPECS,
  LANE_GEOMETRY,
  isWireCompatible,
  type ChipKind,
} from "@/lib/protocol-drift";
import { wireRefusal } from "./wire-refusal";
import { ChipNodeView } from "./ChipNodeView";
import { PacketEdgeView } from "./PacketEdgeView";
import {
  CHIP_WIDTH,
  chipName,
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
import {
  WORLD_WIDTH,
  frameAfterAdd,
  frameChips,
  frameLane,
  sizeOf,
} from "./touch-frame";

/** Drag payload key shared with the toolbox. */
export const CHIP_DRAG_TYPE = "application/x-protocol-drift-chip";

const nodeTypes = { chip: ChipNodeView };
const edgeTypes = { packet: PacketEdgeView };
/**
 * On the touch cabinet the zoom never drops below the size at which a chip
 * and its title stay legible (#2045), computed from the chip geometry.
 */
const TOUCH_MIN_ZOOM = touchZoomFloor();
/** Desktop zoom-out reaches the whole lane world, for an overview (#2167). */
const DESKTOP_MIN_ZOOM = 0.2;

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
          TABULATION LANE (SDTM)
        </span>
        <span
          className="absolute text-[13px] tracking-wide text-emerald-400"
          style={{ left: 408, top: conservationWallY + 24 }}
        >
          ANALYSIS LANE (ADaM)
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
const PROTOCOL_DRIFT_CHIP_ADDED_EVENT = "protocol-drift:chip-added";

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
 * (#2045). Desktop uses desktopChipSpot.
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

/** Vertical step of the desktop spot search, in canvas pixels. */
const DESKTOP_SCAN_STEP_Y = 8;
/** Columns tried past the lane world before giving up on a clear spot. */
const DESKTOP_EXTRA_COLUMNS = 24;

/**
 * Desktop: the first spot for a new chip that clears every existing chip's
 * box (#2324). It scans the chip's lane top to bottom, one column of chips at
 * a time across the lane world, so the chips fill the lane in rows. When the
 * lane is full it continues to the right of the world, never on top of a
 * chip; a player can still drag any chip anywhere.
 */
function desktopChipSpot(
  kind: ChipKind,
  nodes: ChipNode[]
): { x: number; y: number } {
  const base = clampChip(kind, suggestPosition(kind, []));
  const lowest = clampChip(kind, {
    x: base.x,
    y: LANE_GEOMETRY.analysisBottom,
  }).y;
  const stepX = CHIP_WIDTH + CHIP_GAP;
  const columns = Math.floor((WORLD_WIDTH - base.x - CHIP_WIDTH) / stepX) + 1;
  for (let y = base.y; y <= lowest; y += DESKTOP_SCAN_STEP_Y) {
    for (let col = 0; col < columns; col++) {
      const spot = clampChip(kind, { x: base.x + col * stepX, y });
      if (!clashes(kind, spot, nodes)) return spot;
    }
  }
  for (let col = columns; col < columns + DESKTOP_EXTRA_COLUMNS; col++) {
    const spot = clampChip(kind, { x: base.x + col * stepX, y: base.y });
    if (!clashes(kind, spot, nodes)) return spot;
  }
  return clampChip(kind, suggestPosition(kind, nodes));
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
  const before = new Set(state.nodes.map((node) => node.id));
  await state.addChip(
    kind,
    options.touch
      ? touchChipSpot(kind, state.nodes)
      : desktopChipSpot(kind, state.nodes)
  );
  const latest = useProtocolDriftStore.getState();
  const added = latest.nodes.find((node) => !before.has(node.id));
  if (!added) return;
  window.dispatchEvent(
    new CustomEvent(PROTOCOL_DRIFT_CHIP_ADDED_EVENT, {
      detail: { kind, x: added.position.x, y: added.position.y },
    })
  );
  if (options.touch) latest.notify("info", `Added ${kind}.`);
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
  // A drag on the empty canvas pans it and a pinch (or the zoom buttons)
  // zooms it, both inside the canvas: the page never scrolls under them.
  // The view frames the chips at a legible zoom rather than the whole lane
  // world, on touch (#2045) and on desktop (#2167).
  const touch = useCabinetTouch();
  const editable = canRewire(fsm);

  // After a toolbox add the view frames the chips, or pans just enough to
  // show the new chip at the current zoom (#2045).
  useEffect(() => {
    const onAdded = (event: Event) => {
      const added = (
        event as CustomEvent<{ kind: ChipKind; x: number; y: number }>
      ).detail;
      frameAfterAdd(
        flow,
        sizeOf(wrapper.current),
        useProtocolDriftStore.getState().nodes,
        added,
        touch
      );
    };
    window.addEventListener(PROTOCOL_DRIFT_CHIP_ADDED_EVENT, onAdded);
    return () =>
      window.removeEventListener(PROTOCOL_DRIFT_CHIP_ADDED_EVENT, onAdded);
  }, [flow, touch]);

  // Frame the chips (the lane when there are none) on mount and resize, so a
  // resize keeps the pipeline in view.
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const fit = () => {
      const nodes = useProtocolDriftStore.getState().nodes;
      if (nodes.length > 0) frameChips(flow, nodes, touch);
      else frameLane(flow, sizeOf(el), touch);
    };
    fit();
    const observer = new ResizeObserver(() => fit());
    observer.observe(el);
    return () => observer.disconnect();
  }, [flow, touch]);

  // A whole pipeline arriving or leaving at once (a reference load, a new
  // study, a restored save) is framed afresh; single adds are handled above.
  const chipCount = nodes.length;
  const lastCount = useRef(chipCount);
  useEffect(() => {
    const before = lastCount.current;
    lastCount.current = chipCount;
    if (Math.abs(chipCount - before) <= 1 && before > 0) return;
    const nodesNow = useProtocolDriftStore.getState().nodes;
    if (nodesNow.length > 0) frameChips(flow, nodesNow, touch);
    else frameLane(flow, sizeOf(wrapper.current), touch);
  }, [chipCount, flow, touch]);

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

  // A wire dropped on a pin that cannot take it says why, instead of
  // snapping back without a word (#2167).
  const onConnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      if (state.isValid !== false || !state.fromHandle || !state.toHandle)
        return;
      const store = useProtocolDriftStore.getState();
      const from = store.nodes.find((n) => n.id === state.fromHandle?.nodeId);
      const to = store.nodes.find((n) => n.id === state.toHandle?.nodeId);
      if (!from || !to) return;
      const outbound = state.fromHandle.type === "source";
      const [source, sourcePin, target, targetPin] = outbound
        ? [from, state.fromHandle.id, to, state.toHandle.id]
        : [to, state.toHandle.id, from, state.fromHandle.id];
      if (!sourcePin || !targetPin) return;
      store.notify(
        "warn",
        wireRefusal(source.data.kind, sourcePin, target.data.kind, targetPin)
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
  // Wires announce readable chip names, never internal ids (#2276).
  const flowEdges = useMemo(() => {
    const names = new Map(nodes.map((n) => [n.id, chipName(n)]));
    const nameOf = (id: string) => names.get(id) ?? id;
    return edges.map((e) => ({
      ...e,
      ariaLabel: `Wire from ${nameOf(e.source)}.${e.sourceHandle ?? ""} to ${nameOf(e.target)}.${e.targetHandle ?? ""}`,
    }));
  }, [nodes, edges]);
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
      className={`absolute inset-0 min-w-0${touch ? " overflow-hidden" : ""}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow<ChipNode, WireEdge>
        nodes={flowNodes}
        onNodeClick={touch ? onNodeClick : undefined}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValidConnection}
        onNodeDragStop={() => void commitCanvasEdit()}
        onBeforeDelete={async () => editable}
        onDelete={onDelete}
        nodesDraggable={editable}
        nodesConnectable={editable}
        elementsSelectable
        // A finger that moves a few pixels on a chip is still a tap (#2045).
        nodeDragThreshold={touch ? 8 : undefined}
        panOnDrag
        zoomOnScroll={false}
        zoomOnPinch
        minZoom={touch ? TOUCH_MIN_ZOOM : DESKTOP_MIN_ZOOM}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        connectionRadius={36}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        aria-label="Pipeline canvas"
        className="!bg-[#0d0e11]"
      >
        <LaneOverlay />
        {touch ? null : (
          <Controls
            showInteractive={false}
            position="bottom-right"
            fitViewOptions={{ padding: 0.06, maxZoom: 1 }}
          />
        )}
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
