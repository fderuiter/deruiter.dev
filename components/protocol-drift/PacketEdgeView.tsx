"use client";

import React, { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { useProtocolDriftStore } from "./store";

const QUERY = "(prefers-reduced-motion: reduce)";
const SAMPLES = 14;
const TOKEN_MS = 900;

function subscribe(onChange: () => void): () => void {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return () => {};
  }
  const media = window.matchMedia(QUERY);
  media.addEventListener?.("change", onChange);
  return () => media.removeEventListener?.("change", onChange);
}

function snapshot(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia(QUERY).matches;
}

/** True when the visitor prefers reduced motion. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

/**
 * A wire. Fresh packets glide along the curve as small tokens that animate
 * only `transform` and `opacity`; under reduced motion the tokens are
 * replaced by a stationary packet counter on the wire.
 */
export function PacketEdgeView({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const reduced = useReducedMotion();
  const allTokens = useProtocolDriftStore((s) => s.tokens);
  const count = useProtocolDriftStore(
    (s) => s.edgeCounts[`${source}>${target}`] ?? 0
  );
  const tokens = useMemo(
    () => allTokens.filter((t) => t.source === source && t.target === target),
    [allTokens, source, target]
  );
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const pathRef = useRef<SVGPathElement | null>(null);
  const circles = useRef(new Map<string, SVGCircleElement>());

  useEffect(() => {
    if (reduced || tokens.length === 0) return;
    const route = pathRef.current;
    if (!route || typeof route.getTotalLength !== "function") return;
    const length = route.getTotalLength();
    const frames: Keyframe[] = Array.from({ length: SAMPLES + 1 }, (_, i) => {
      const point = route.getPointAtLength((length * i) / SAMPLES);
      return {
        transform: `translate(${point.x}px, ${point.y}px)`,
        opacity: i === 0 || i === SAMPLES ? 0 : 1,
        offset: i / SAMPLES,
      };
    });
    const running: Animation[] = [];
    for (const token of tokens) {
      const circle = circles.current.get(token.key);
      if (circle && typeof circle.animate === "function") {
        running.push(
          circle.animate(frames, { duration: TOKEN_MS, easing: "linear" })
        );
      }
    }
    return () => running.forEach((a) => a.cancel());
  }, [reduced, tokens]);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: selected ? "#f59e0b" : "#94a3b8",
          strokeWidth: selected ? 2 : 1.25,
        }}
      />
      <path
        ref={pathRef}
        d={path}
        fill="none"
        stroke="none"
        aria-hidden="true"
      />
      {!reduced &&
        tokens.map((token) => (
          <circle
            key={token.key}
            ref={(node) => {
              if (node) circles.current.set(token.key, node);
              else circles.current.delete(token.key);
            }}
            r={4}
            fill="#f59e0b"
            style={{ opacity: 0 }}
            aria-hidden="true"
          />
        ))}
      {reduced && count > 0 ? (
        <EdgeLabelRenderer>
          <span
            data-testid="wire-counter"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            className="pointer-events-none absolute border border-zinc-700 bg-[#0d0e11] px-1 font-mono text-[10px] text-amber-400"
          >
            {count}
          </span>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
