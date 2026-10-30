"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  canConnect,
  computeMagneticSnap,
  getCompatibleTargets,
  type AlignmentGuide,
  type Edge,
  type ProofNode,
  type TheoremDefinition,
} from "@/lib/proof";

/** Canvas node box, matching the size ProofCanvas draws. */
const NODE_WIDTH = 160;
const NODE_HEIGHT = 70;
/** Snapped drags tick at most this often, so a fast drag doesn't chatter. */
const SNAP_SOUND_INTERVAL_MS = 350;

type Offset = { x: number; y: number };

interface DragConnection {
  sourceId: string;
  sourceX: number;
  sourceY: number;
  currentX: number;
  currentY: number;
  hoveredTargetId: string | null;
  isValid: boolean;
  ruleBadge?: string;
}

interface ProofCanvasDragOptions {
  theorem: TheoremDefinition;
  edges: Edge[];
  isSnappingEnabled: boolean;
  playHover: () => void;
  announce: (text: string) => void;
  /** A cord was dropped on a target `canConnect` allows. */
  onConnect: (sourceId: string, targetId: string, ruleBadge?: string) => void;
  /** A cord was dropped on a target that cannot follow from the source. */
  onReject: (sourceId: string, targetId: string) => void;
}

const ZERO: Offset = { x: 0, y: 0 };

/**
 * Node dragging (with magnetic snapping and alignment guides) and connection
 * cords on the proof canvas. Pointer moves are coalesced to one update per
 * animation frame, and a release flushes the last pending move first.
 */
export function useProofCanvasDrag({
  theorem,
  edges,
  isSnappingEnabled,
  playHover,
  announce,
  onConnect,
  onReject,
}: ProofCanvasDragOptions) {
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, Offset>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [activeGuides, setActiveGuides] = useState<AlignmentGuide[]>([]);
  const [dragConnection, setDragConnection] = useState<DragConnection | null>(
    null
  );

  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initOffsetX: number;
    initOffsetY: number;
  } | null>(null);
  // The first snap should tick even if it happens just after page load.
  const lastSnapAudioTimeRef = useRef(Number.NEGATIVE_INFINITY);
  const nodeDragRafIdRef = useRef<number | null>(null);
  const pendingNodeDragRef = useRef<{
    clientX: number;
    clientY: number;
    nodeId: string;
  } | null>(null);
  const connDragRafIdRef = useRef<number | null>(null);
  const pendingConnDragRef = useRef<{
    clientX: number;
    clientY: number;
  } | null>(null);

  const theoremRef = useRef(theorem);
  const nodeOffsetsRef = useRef(nodeOffsets);
  const isSnappingEnabledRef = useRef(isSnappingEnabled);
  const dragConnectionRef = useRef(dragConnection);

  useEffect(() => {
    theoremRef.current = theorem;
  }, [theorem]);

  useEffect(() => {
    nodeOffsetsRef.current = nodeOffsets;
  }, [nodeOffsets]);

  useEffect(() => {
    isSnappingEnabledRef.current = isSnappingEnabled;
  }, [isSnappingEnabled]);

  useEffect(() => {
    dragConnectionRef.current = dragConnection;
  }, [dragConnection]);

  // Clean cancellation of frame callbacks on component unmount
  useEffect(() => {
    return () => {
      if (nodeDragRafIdRef.current !== null) {
        cancelAnimationFrame(nodeDragRafIdRef.current);
        nodeDragRafIdRef.current = null;
      }
      if (connDragRafIdRef.current !== null) {
        cancelAnimationFrame(connDragRafIdRef.current);
        connDragRafIdRef.current = null;
      }
    };
  }, []);

  /** Drops node positions, guides and any half-drawn cord. */
  const resetLayout = useCallback(() => {
    setNodeOffsets({});
    setActiveGuides([]);
    setDragConnection(null);
  }, []);

  const handleNodePointerDown = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      e.stopPropagation();
      setDraggingNodeId(nodeId);
      const currentOffset = nodeOffsets[nodeId] || ZERO;
      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initOffsetX: currentOffset.x,
        initOffsetY: currentOffset.y,
      };
      try {
        (e.target as Element).setPointerCapture(e.pointerId);
      } catch {}
    },
    [nodeOffsets]
  );

  const processNodePointerMove = useCallback(
    (clientX: number, clientY: number, nodeId: string) => {
      const start = dragStartRef.current;
      if (!start) return;
      const currentTheorem = theoremRef.current;
      const sNode = currentTheorem.nodes.find((n) => n.id === nodeId);
      if (!sNode) return;

      const dx = clientX - start.startX;
      const dy = clientY - start.startY;

      if (!isSnappingEnabledRef.current) {
        setActiveGuides([]);
        setNodeOffsets((prev) => ({
          ...prev,
          [nodeId]: { x: start.initOffsetX + dx, y: start.initOffsetY + dy },
        }));
        return;
      }

      const currentOffsets = nodeOffsetsRef.current;
      const peerNodes = currentTheorem.nodes
        .filter((n) => n.id !== nodeId)
        .map((n) => {
          const off = currentOffsets[n.id] || ZERO;
          return {
            id: n.id,
            x: n.x + off.x,
            y: n.y + off.y,
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
          };
        });

      const snap = computeMagneticSnap(
        sNode.x + start.initOffsetX + dx,
        sNode.y + start.initOffsetY + dy,
        NODE_WIDTH,
        NODE_HEIGHT,
        peerNodes,
        {
          gridSize: 20,
          threshold: 12,
          enableGrid: true,
          enableAlignment: true,
        }
      );

      setActiveGuides(snap.guides);

      if (snap.snappedX || snap.snappedY) {
        const now = typeof performance !== "undefined" ? performance.now() : 0;
        if (now - lastSnapAudioTimeRef.current > SNAP_SOUND_INTERVAL_MS) {
          lastSnapAudioTimeRef.current = now;
          try {
            playHover();
          } catch {}
        }
      }

      setNodeOffsets((prev) => ({
        ...prev,
        [nodeId]: { x: snap.x - sNode.x, y: snap.y - sNode.y },
      }));
    },
    [playHover]
  );

  const handleNodePointerMove = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      if (draggingNodeId !== nodeId || !dragStartRef.current) return;
      pendingNodeDragRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        nodeId,
      };

      if (nodeDragRafIdRef.current === null) {
        nodeDragRafIdRef.current = requestAnimationFrame(() => {
          nodeDragRafIdRef.current = null;
          const pending = pendingNodeDragRef.current;
          if (pending) {
            pendingNodeDragRef.current = null;
            processNodePointerMove(
              pending.clientX,
              pending.clientY,
              pending.nodeId
            );
          }
        });
      }
    },
    [draggingNodeId, processNodePointerMove]
  );

  const handleNodePointerUp = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      if (draggingNodeId !== nodeId) return;
      if (nodeDragRafIdRef.current !== null) {
        cancelAnimationFrame(nodeDragRafIdRef.current);
        nodeDragRafIdRef.current = null;
      }
      const pending = pendingNodeDragRef.current;
      if (pending) {
        pendingNodeDragRef.current = null;
        processNodePointerMove(
          pending.clientX,
          pending.clientY,
          pending.nodeId
        );
      }
      setDraggingNodeId(null);
      dragStartRef.current = null;
      setActiveGuides([]);
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {}
    },
    [draggingNodeId, processNodePointerMove]
  );

  const handleHandlePointerDown = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    const sNode = theorem.nodes.find((n) => n.id === nodeId);
    if (!sNode) return;
    const offset = nodeOffsets[nodeId] || ZERO;
    const sourceX = sNode.x + offset.x + NODE_WIDTH;
    const sourceY = sNode.y + offset.y + NODE_HEIGHT / 2;

    setDragConnection({
      sourceId: nodeId,
      sourceX,
      sourceY,
      currentX: sourceX,
      currentY: sourceY,
      hoveredTargetId: null,
      isValid: false,
    });

    try {
      (e.target as Element).setPointerCapture(e.pointerId);
      playHover();
    } catch {}

    announce(
      `Started connection drag from Node ${nodeId}. Drag to a compatible target node.`
    );
  };

  const processCanvasPointerMove = useCallback(
    (clientX: number, clientY: number) => {
      const connection = dragConnectionRef.current;
      if (!connection) return;
      const rect = canvasWrapperRef.current?.getBoundingClientRect();
      if (!rect) return;

      const currentX = clientX - rect.left;
      const currentY = clientY - rect.top;
      const currentOffsets = nodeOffsetsRef.current;

      // A node's drop zone is its box plus a 10px margin (15px below).
      const hoveredTarget: ProofNode | undefined =
        theoremRef.current.nodes.find((node) => {
          if (node.id === connection.sourceId) return false;
          const off = currentOffsets[node.id] || ZERO;
          const nX = node.x + off.x;
          const nY = node.y + off.y;
          return (
            currentX >= nX - 10 &&
            currentX <= nX + NODE_WIDTH + 10 &&
            currentY >= nY - 10 &&
            currentY <= nY + 85
          );
        });

      const hoveredTargetId = hoveredTarget ? hoveredTarget.id : null;
      let isValid = false;
      let ruleBadge = "";

      if (hoveredTargetId) {
        isValid = canConnect(
          connection.sourceId,
          hoveredTargetId,
          edges,
          theorem
        ).allowed;
        if (isValid) {
          const found = getCompatibleTargets(
            connection.sourceId,
            theorem,
            edges
          ).find((c) => c.targetId === hoveredTargetId);
          ruleBadge = found?.badgeLabel || "Valid Inferred Target";
        }
      }

      setDragConnection((prev) =>
        prev
          ? { ...prev, currentX, currentY, hoveredTargetId, isValid, ruleBadge }
          : null
      );
    },
    [edges, theorem]
  );

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragConnection) return;
      pendingConnDragRef.current = { clientX: e.clientX, clientY: e.clientY };

      if (connDragRafIdRef.current === null) {
        connDragRafIdRef.current = requestAnimationFrame(() => {
          connDragRafIdRef.current = null;
          const pending = pendingConnDragRef.current;
          if (pending) {
            pendingConnDragRef.current = null;
            processCanvasPointerMove(pending.clientX, pending.clientY);
          }
        });
      }
    },
    [dragConnection, processCanvasPointerMove]
  );

  const handleCanvasPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (connDragRafIdRef.current !== null) {
        cancelAnimationFrame(connDragRafIdRef.current);
        connDragRafIdRef.current = null;
      }
      const pending = pendingConnDragRef.current;
      if (pending) {
        pendingConnDragRef.current = null;
        processCanvasPointerMove(pending.clientX, pending.clientY);
      }
      if (!dragConnection) return;
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {}

      const { sourceId, hoveredTargetId, isValid, ruleBadge } = dragConnection;
      if (hoveredTargetId && isValid) {
        onConnect(sourceId, hoveredTargetId, ruleBadge);
      } else if (hoveredTargetId) {
        onReject(sourceId, hoveredTargetId);
      }

      setDragConnection(null);
    },
    [dragConnection, processCanvasPointerMove, onConnect, onReject]
  );

  return {
    nodeOffsets,
    activeGuides,
    dragConnection,
    canvasWrapperRef,
    resetLayout,
    handleNodePointerDown,
    handleNodePointerMove,
    handleNodePointerUp,
    handleHandlePointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
  };
}
