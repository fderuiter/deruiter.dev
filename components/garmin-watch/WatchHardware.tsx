"use client";

import React, { useId } from "react";
import {
  BEZEL_INNER_RADIUS,
  BEZEL_OUTER_RADIUS,
  CASE_RADIUS,
  PUSHER_ANGLES,
  SCREEN_RADIUS,
  WATCH_CENTER,
  WATCH_VIEW_HEIGHT,
  WATCH_VIEW_WIDTH,
  pointOnCase,
  type PusherId,
} from "./watch-geometry";

export type WatchBezelTheme = "slate" | "solar" | "cyan";

interface Finish {
  metal: [string, string, string, string];
  bezel: string;
  engraving: string;
}

/** Case finishes: Tactix graphite, Solar bronze and a cyan-tinted steel. */
const FINISHES: Record<WatchBezelTheme, Finish> = {
  slate: {
    metal: ["#6b717b", "#30343b", "#1a1d22", "#545a64"],
    bezel: "#16181d",
    engraving: "#d4d4d8",
  },
  solar: {
    metal: ["#9a7a4c", "#4d3a22", "#2a2116", "#80613a"],
    bezel: "#1c1712",
    engraving: "#fde68a",
  },
  cyan: {
    metal: ["#6f8790", "#2f3e45", "#182126", "#587079"],
    bezel: "#10191d",
    engraving: "#a5f3fc",
  },
};

const BEZEL_LABELS: Record<PusherId, string> = {
  light: "LIGHT",
  up: "UP · MENU",
  down: "DOWN",
  start: "START · STOP",
  back: "BACK · LAP",
};

const MONO = { fontFamily: "var(--font-geist-mono), ui-monospace, monospace" };

/** Rotation that sets text along the bezel, upright on both halves. */
function labelRotation(angleDeg: number): number {
  return Math.sin((angleDeg * Math.PI) / 180) > 0.01
    ? angleDeg - 90
    : angleDeg + 90;
}

/** True when a tick at `angle` would run into an engraved label. */
function tickHidden(angle: number, labelAngles: number[]): boolean {
  return labelAngles.some((a) => {
    const d = Math.abs(((angle - a + 540) % 360) - 180);
    return d < 14;
  });
}

interface WatchHardwareProps {
  theme: WatchBezelTheme;
  /** The device name engraved at 12 o'clock. */
  model: string;
  focused: boolean;
}

/**
 * The watch body as one static SVG: strap stubs, lugs, a metal case, an
 * engraved bezel with Garmin's five pushers, and the black lens rim the
 * screen canvas sits in. Decorative only; the real controls are DOM buttons
 * laid over the pushers.
 */
export function WatchHardware({ theme, model, focused }: WatchHardwareProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `garmin-${uid}-${name}`;
  const finish = FINISHES[theme];
  const { x: cx, y: cy } = WATCH_CENTER;
  const labelAngles = [
    ...Object.values(PUSHER_ANGLES),
    270,
    270 - 18,
    270 + 18,
    90,
    90 - 20,
    90 + 20,
  ];
  const ticks = Array.from({ length: 60 }, (_, i) => i * 6).filter(
    (a) => !tickHidden(a, labelAngles)
  );
  const lug = "M138 142 L151 72 Q154 58 168 58 L184 58 L186 118 Z";
  const mirrorX = `translate(${WATCH_VIEW_WIDTH} 0) scale(-1 1)`;
  const mirrorY = `translate(0 ${WATCH_VIEW_HEIGHT}) scale(1 -1)`;

  return (
    <svg
      viewBox={`0 0 ${WATCH_VIEW_WIDTH} ${WATCH_VIEW_HEIGHT}`}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id("strap")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14171c" stopOpacity="0" />
          <stop offset="0.45" stopColor="#14171c" stopOpacity="1" />
          <stop offset="1" stopColor="#1d2128" stopOpacity="1" />
        </linearGradient>
        <linearGradient id={id("metal")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={finish.metal[0]} />
          <stop offset="0.35" stopColor={finish.metal[1]} />
          <stop offset="0.7" stopColor={finish.metal[2]} />
          <stop offset="1" stopColor={finish.metal[3]} />
        </linearGradient>
        <linearGradient id={id("pusher")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={finish.metal[0]} />
          <stop offset="0.5" stopColor={finish.metal[2]} />
          <stop offset="1" stopColor={finish.metal[3]} />
        </linearGradient>
      </defs>

      {/* Strap stubs, fading out at the ends. */}
      <g fill={`url(#${id("strap")})`}>
        <rect x="160" y="0" width="200" height="120" rx="10" />
        <rect
          x="160"
          y="0"
          width="200"
          height="120"
          rx="10"
          transform={mirrorY}
        />
      </g>
      <g stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1.5">
        {[44, 66, 88].map((y) => (
          <React.Fragment key={y}>
            <line x1="172" y1={y} x2="348" y2={y} />
            <line
              x1="172"
              y1={WATCH_VIEW_HEIGHT - y}
              x2="348"
              y2={WATCH_VIEW_HEIGHT - y}
            />
          </React.Fragment>
        ))}
      </g>
      <g fill="#0d0e11" fillOpacity="0.8">
        <rect
          x="252"
          y={WATCH_VIEW_HEIGHT - 52}
          width="16"
          height="7"
          rx="3.5"
        />
        <rect
          x="252"
          y={WATCH_VIEW_HEIGHT - 30}
          width="16"
          height="7"
          rx="3.5"
        />
      </g>

      {/* Lugs. */}
      <g fill={`url(#${id("metal")})`} stroke="#ffffff" strokeOpacity="0.08">
        <path d={lug} />
        <path d={lug} transform={mirrorX} />
        <path d={lug} transform={mirrorY} />
        <path
          d={lug}
          transform={`translate(${WATCH_VIEW_WIDTH} ${WATCH_VIEW_HEIGHT}) scale(-1 -1)`}
        />
      </g>

      {/* Pushers, under the case edge. */}
      {(Object.keys(PUSHER_ANGLES) as PusherId[]).map((pusher) => (
        <g
          key={pusher}
          transform={`rotate(${PUSHER_ANGLES[pusher]} ${cx} ${cy})`}
        >
          <rect
            x={cx + CASE_RADIUS - 10}
            y={cy - 12}
            width="24"
            height="24"
            rx="4"
            fill={`url(#${id("pusher")})`}
            stroke="#000000"
            strokeOpacity="0.5"
          />
          {[4, 8, 12].map((d) => (
            <line
              key={d}
              x1={cx + CASE_RADIUS + d}
              y1={cy - 9}
              x2={cx + CASE_RADIUS + d}
              y2={cy + 9}
              stroke="#000000"
              strokeOpacity="0.35"
            />
          ))}
        </g>
      ))}

      {/* Case and brushed bezel. */}
      <circle
        cx={cx}
        cy={cy}
        r={CASE_RADIUS}
        fill={`url(#${id("metal")})`}
        stroke="#ffffff"
        strokeOpacity="0.12"
      />
      <circle
        cx={cx}
        cy={cy}
        r={(BEZEL_OUTER_RADIUS + BEZEL_INNER_RADIUS) / 2}
        fill="none"
        stroke={finish.bezel}
        strokeWidth={BEZEL_OUTER_RADIUS - BEZEL_INNER_RADIUS}
      />
      <g fill="none" stroke="#ffffff">
        {Array.from(
          { length: 13 },
          (_, i) => BEZEL_INNER_RADIUS + 1 + i * 2
        ).map((r, i) => (
          <circle
            key={r}
            cx={cx}
            cy={cy}
            r={r}
            strokeOpacity={i % 2 ? 0.025 : 0.05}
            strokeWidth="1"
          />
        ))}
      </g>
      <g stroke={finish.engraving} strokeLinecap="round">
        {ticks.map((a) => {
          const major = a % 30 === 0;
          const from = pointOnCase(a, major ? 216 : 220);
          const to = pointOnCase(a, 225);
          return (
            <line
              key={a}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              strokeOpacity={major ? 0.55 : 0.22}
              strokeWidth={major ? 2 : 1}
            />
          );
        })}
      </g>
      <g
        fill={finish.engraving}
        fillOpacity="0.62"
        fontSize="10"
        fontWeight="700"
        letterSpacing="1.5"
        textAnchor="middle"
        style={MONO}
      >
        {(Object.keys(PUSHER_ANGLES) as PusherId[]).map((pusher) => {
          const a = PUSHER_ANGLES[pusher];
          const p = pointOnCase(a, 211);
          return (
            <text
              key={pusher}
              x={p.x}
              y={p.y}
              dominantBaseline="central"
              transform={`rotate(${labelRotation(a)} ${p.x} ${p.y})`}
            >
              {BEZEL_LABELS[pusher]}
            </text>
          );
        })}
        <text x={cx} y={cy - 211} dominantBaseline="central">
          {model.toUpperCase()}
        </text>
        <text x={cx} y={cy + 211} dominantBaseline="central" fillOpacity="0.45">
          MONKEY C · CONNECT IQ
        </text>
      </g>

      {/* Lens rim around the screen. */}
      <circle cx={cx} cy={cy} r={BEZEL_INNER_RADIUS} fill="#050607" />
      <circle
        cx={cx}
        cy={cy}
        r={SCREEN_RADIUS + 3}
        fill="#000000"
        stroke="#ffffff"
        strokeOpacity="0.06"
      />

      {focused && (
        <circle
          cx={cx}
          cy={cy}
          r={CASE_RADIUS + 8}
          fill="none"
          stroke="#22d3ee"
          strokeOpacity="0.6"
          strokeWidth="2"
          data-testid="garmin-focus-ring"
        />
      )}
    </svg>
  );
}

/**
 * The sapphire glass over the screen: a soft reflection across the upper
 * left and a shadow at the rim. Static, and it never takes pointer events,
 * so drags reach the canvas underneath.
 */
export function WatchGlass() {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { x: cx, y: cy } = WATCH_CENTER;
  return (
    <svg
      viewBox={`0 0 ${WATCH_VIEW_WIDTH} ${WATCH_VIEW_HEIGHT}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={`garmin-${uid}-lens`}>
          <circle cx={cx} cy={cy} r={SCREEN_RADIUS} />
        </clipPath>
        <linearGradient id={`garmin-${uid}-glare`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.07" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#garmin-${uid}-lens)`}>
        <ellipse
          cx={cx - 70}
          cy={cy - 96}
          rx="190"
          ry="120"
          transform={`rotate(-28 ${cx - 70} ${cy - 96})`}
          fill={`url(#garmin-${uid}-glare)`}
        />
      </g>
      <circle
        cx={cx}
        cy={cy}
        r={SCREEN_RADIUS - 1}
        fill="none"
        stroke="#000000"
        strokeOpacity="0.55"
        strokeWidth="5"
      />
    </svg>
  );
}
