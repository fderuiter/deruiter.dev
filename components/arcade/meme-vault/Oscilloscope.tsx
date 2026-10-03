"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { useResizeObserver } from "@/hooks/useResizeObserver";
import { clamp } from "@/lib/game-utils";
import { graticuleLines, scopeGain, scopeTrace } from "./vault-geometry";

const SCOPE_HEIGHT = 112;
const TRACE = "#10b981";
const GRID = "rgba(255, 255, 255, 0.06)";
const AXIS = "rgba(255, 255, 255, 0.14)";

interface OscilloscopeProps {
  /** The soundboard's analyser, or null until a pad has played with sound. */
  analyser: AnalyserNode | null;
  /** True while a pad's sound is playing; the trace only animates then. */
  isPlaying: boolean;
  /** Label of the pad that last fired, shown in the readout. */
  soundLabel: string;
  /** Why the trace is flat when sound is off, or null when sound is on. */
  silentReason: React.ReactNode;
}

/**
 * A single-channel oscilloscope wired to the sound engine's AnalyserNode.
 * The canvas is redrawn on animation frames only while a pad is playing; at
 * rest it shows a static graticule and a flat trace, and no loop runs.
 */
export function Oscilloscope({
  analyser,
  isPlaying,
  soundLabel,
  silentReason,
}: OscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const widthRef = useRef(0);
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const live = isPlaying && analyser !== null && !silentReason;

  const draw = useCallback((samples: Float32Array | null) => {
    const canvas = canvasRef.current;
    const width = widthRef.current;
    if (!canvas || width <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = clamp(
      (typeof window !== "undefined" && window.devicePixelRatio) || 1,
      1,
      2
    );
    const pxW = Math.round(width * dpr);
    const pxH = Math.round(SCOPE_HEIGHT * dpr);
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, SCOPE_HEIGHT);

    const { xs, ys } = graticuleLines(width, SCOPE_HEIGHT);
    ctx.lineWidth = 1;
    ctx.strokeStyle = GRID;
    ctx.beginPath();
    for (const x of xs) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, SCOPE_HEIGHT);
    }
    for (const y of ys) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.strokeStyle = AXIS;
    ctx.beginPath();
    const mid = Math.round(SCOPE_HEIGHT / 2) + 0.5;
    ctx.moveTo(0, mid);
    ctx.lineTo(width, mid);
    ctx.stroke();

    ctx.strokeStyle = TRACE;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    const points = samples
      ? scopeTrace(samples, width, SCOPE_HEIGHT, 8, scopeGain(samples))
      : [];
    if (points.length > 1) {
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
    } else {
      ctx.globalAlpha = 0.55;
      ctx.moveTo(0, SCOPE_HEIGHT / 2);
      ctx.lineTo(width, SCOPE_HEIGHT / 2);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, []);

  const wrapperRef = useResizeObserver<HTMLDivElement>((entry) => {
    widthRef.current = Math.floor(entry.contentRect.width);
    draw(null);
  });

  // Draw the resting trace once on mount, and again whenever playback
  // stops, so the last frame of a sound never freezes on screen.
  useEffect(() => {
    if (live) return;
    const el = wrapperRef.current;
    if (el && widthRef.current === 0) {
      widthRef.current = Math.floor(el.getBoundingClientRect().width);
    }
    draw(null);
  }, [live, draw, wrapperRef]);

  useAnimationFrame(
    () => {
      if (!analyser) return;
      let buffer = bufferRef.current;
      if (!buffer || buffer.length !== analyser.fftSize) {
        buffer = new Float32Array(analyser.fftSize);
        bufferRef.current = buffer;
      }
      analyser.getFloatTimeDomainData(buffer);
      draw(buffer);
    },
    { isActive: live }
  );

  const rate = analyser
    ? `${(analyser.context.sampleRate / 1000).toFixed(1)} kHz`
    : "-- kHz";

  return (
    <div
      className="meme-scope rounded-xl border border-white/[0.08] bg-[#0d0e11] p-3 sm:p-4"
      data-testid="meme-oscilloscope"
      data-live={live ? "true" : "false"}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums">
        <span className="flex min-w-0 items-center gap-2 text-zinc-300">
          <span
            aria-hidden="true"
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              live ? "bg-emerald-400" : "bg-zinc-600"
            }`}
          />
          <span className="min-w-0 truncate uppercase tracking-wider">
            {live
              ? `Scope · ${soundLabel}`
              : "Web Audio Synthesis Engine · idle"}
          </span>
        </span>
        <span className="text-zinc-500">1 ch mono bus · {rate}</span>
      </div>
      <div ref={wrapperRef} className="relative w-full">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={
            live
              ? `Oscilloscope trace of ${soundLabel}`
              : "Oscilloscope, no signal"
          }
          className="block w-full"
          style={{ height: SCOPE_HEIGHT }}
        />
        {silentReason && (
          <div className="absolute inset-0 flex items-center justify-center p-2">
            <div className="max-w-full rounded-md border border-white/[0.08] bg-[#13151a] px-3 py-1.5 text-center font-sans text-xs text-zinc-300">
              {silentReason}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
