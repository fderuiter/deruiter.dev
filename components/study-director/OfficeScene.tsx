"use client";

import React from "react";
import { METER_IDS } from "@/lib/study-director";
import { describeScene, type SceneState } from "./scene";

const INK = "#d4d4d8";
const INK_SOFT = "#71717a";
const PAPER = "#e7e5e4";
const AMBER = "#f59e0b";
const RED = "#f87171";
const EMERALD = "#10b981";
const GRAPHITE = "#13151a";

const ink = {
  stroke: INK,
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const line = { ...ink, fill: "none" } as const;

/** Where each sticky note sits on the corkboard, with its tilt. */
const NOTE_SLOTS = [
  [314, 30, -6],
  [346, 34, 4],
  [380, 28, -2],
  [322, 62, 5],
  [356, 66, -5],
  [390, 60, 3],
] as const;

const STACK_HEIGHTS = [22, 34, 16, 28];

const Window: React.FC<{ night: boolean }> = ({ night }) => (
  <g>
    <rect
      x={40}
      y={20}
      width={150}
      height={92}
      fill={night ? "#07080b" : "#172030"}
      className="transition-[fill] duration-500"
    />
    {night ? (
      <g>
        <path d="M150 38a12 12 0 1 0 10 18a10 10 0 1 1 -10 -18z" fill={PAPER} />
        <circle cx={70} cy={40} r={1.2} fill={PAPER} />
        <circle cx={96} cy={70} r={1} fill={PAPER} />
        <circle cx={120} cy={34} r={1.2} fill={PAPER} />
        <circle cx={62} cy={88} r={1} fill={PAPER} />
      </g>
    ) : (
      <g {...line} stroke={INK_SOFT}>
        <path d="M58 92q10 -14 24 -6q8 -12 22 -4q14 -2 14 10z" />
        <path d="M120 52q8 -10 20 -4q10 -6 18 4q8 2 6 8h-44z" />
      </g>
    )}
    {/* Skyline, so it reads as an office tower. */}
    <path
      d="M40 112v-18h14v-10h10v14h12v-22h16v26h14v-12h18v22h20v-16h14v6h8v10"
      {...line}
      stroke={INK_SOFT}
    />
    <rect x={40} y={20} width={150} height={92} {...line} />
    <path d="M115 20v92M40 66h150" {...line} />
    <path d="M34 114h162" {...line} strokeWidth={3} />
  </g>
);

const Calendar: React.FC<{ day: number; redMarks: number }> = ({
  day,
  redMarks,
}) => {
  const cells = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      cells.push(
        <rect
          key={`${row}-${col}`}
          x={220 + col * 12}
          y={52 + row * 10}
          width={10}
          height={8}
          fill="none"
          stroke={INK_SOFT}
          strokeWidth={0.8}
        />
      );
    }
  }
  return (
    <g>
      <path d="M252 20v6" {...line} />
      <rect x={214} y={26} width={72} height={70} fill={PAPER} opacity={0.06} />
      <rect x={214} y={26} width={72} height={70} {...line} />
      <rect x={214} y={26} width={72} height={16} fill={AMBER} opacity={0.85} />
      <text
        x={250}
        y={38}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={GRAPHITE}
        fontFamily="var(--font-geist-mono), monospace"
      >
        DAY {day}
      </text>
      {cells}
      {Array.from({ length: redMarks }, (_, i) => {
        const x = 268 - i * 12;
        const y = 82;
        return (
          <path
            key={i}
            d={`M${x - 1} ${y - 1}l12 10M${x + 11} ${y - 1}l-12 10`}
            stroke={RED}
            strokeWidth={1.8}
            strokeLinecap="round"
            className="sd-enter"
          />
        );
      })}
      {redMarks >= 3 ? (
        <circle
          cx={250}
          cy={72}
          r={30}
          fill="none"
          stroke={RED}
          strokeWidth={1.4}
          strokeDasharray="3 3"
        />
      ) : null}
    </g>
  );
};

const Corkboard: React.FC<{ notes: number; pinned?: string }> = ({
  notes,
  pinned,
}) => (
  <g>
    <rect x={302} y={20} width={120} height={82} fill="#1c1917" />
    <rect x={302} y={20} width={120} height={82} {...line} />
    {NOTE_SLOTS.slice(0, notes).map(([x, y, tilt], i) => (
      <g key={i} className="sd-chip">
        <g transform={`rotate(${tilt} ${x + 12} ${y + 12})`}>
          <rect
            x={x}
            y={y}
            width={24}
            height={24}
            fill="#fde047"
            opacity={0.9}
          />
          <path
            d={`M${x + 4} ${y + 8}h14M${x + 4} ${y + 13}h10M${x + 4} ${y + 18}h12`}
            stroke={GRAPHITE}
            strokeWidth={1}
          />
        </g>
      </g>
    ))}
    {pinned ? (
      <g className="sd-stamp">
        <rect x={330} y={36} width={64} height={48} fill={PAPER} />
        <circle cx={362} cy={39} r={2.5} fill={RED} />
        <text
          x={362}
          y={70}
          textAnchor="middle"
          fontSize={24}
          fontWeight={800}
          fill={GRAPHITE}
          fontFamily="var(--font-geist-mono), monospace"
        >
          {pinned}
        </text>
      </g>
    ) : null}
  </g>
);

const Monitor: React.FC<{ scene: SceneState }> = ({ scene }) => (
  <g>
    <rect x={606} y={62} width={92} height={56} fill="#0b0c0f" />
    <rect x={606} y={62} width={92} height={56} {...line} />
    {METER_IDS.map((id, i) => {
      const value = scene.meters[id];
      const h = Math.max(2, (value / 100) * 38);
      const fill = value >= 60 ? EMERALD : value >= 35 ? AMBER : RED;
      return (
        <rect
          key={id}
          x={616 + i * 13}
          y={110 - h}
          width={8}
          height={h}
          fill={fill}
          opacity={0.85}
          className="transition-[height,y] duration-500"
        />
      );
    })}
    <path d="M644 118l-4 10h24l-4 -10" {...line} />
  </g>
);

const Director: React.FC = () => (
  <g>
    {/* Chair back */}
    <path d="M478 74q0 -8 8 -8h64q8 0 8 8v52" {...line} stroke={INK_SOFT} />
    {/* Body */}
    <path
      d="M492 128v-24q0 -18 18 -22h20q18 4 18 22v24"
      fill={GRAPHITE}
      {...{ stroke: INK, strokeWidth: 1.5, strokeLinejoin: "round" }}
    />
    {/* Collar and lanyard */}
    <path d="M512 82l8 10l8 -10M520 92v18" {...line} stroke={INK_SOFT} />
    <rect x={515} y={108} width={10} height={8} fill={AMBER} opacity={0.9} />
    {/* Head */}
    <circle cx={520} cy={62} r={16} fill={GRAPHITE} {...ink} />
    <path d="M504 58q4 -16 18 -14q12 0 14 12" {...line} />
    {/* The face never changes. That is the joke. */}
    <circle cx={514} cy={63} r={1.4} fill={INK} />
    <circle cx={526} cy={63} r={1.4} fill={INK} />
    <path d="M514 70q6 3 12 0" {...line} />
    {/* Arm raising the mug */}
    <path d="M546 104q10 -2 12 -14" {...line} />
    <rect x={552} y={80} width={20} height={20} fill={PAPER} />
    <path d="M572 84q7 0 7 6t-7 6" {...line} stroke={PAPER} />
    <text
      x={562}
      y={93}
      textAnchor="middle"
      fontSize={5.5}
      fontWeight={800}
      fill={GRAPHITE}
      fontFamily="var(--font-geist-mono), monospace"
    >
      FINE
    </text>
    {/* Speech bubble */}
    <path
      d="M544 12h124q6 0 6 6v20q0 6 -6 6h-94l-14 12l2 -12h-18q-6 0 -6 -6v-20q0 -6 6 -6z"
      fill={GRAPHITE}
      {...{ stroke: INK, strokeWidth: 1.5, strokeLinejoin: "round" }}
    />
    <text
      x={606}
      y={32}
      textAnchor="middle"
      fontSize={11}
      fill={INK}
      fontFamily="var(--font-geist-mono), monospace"
    >
      Everything is fine.
    </text>
  </g>
);

const Clock: React.FC<{ hour: number }> = ({ hour }) => {
  const minute = (hour % 1) * 60;
  const hourAngle = (((hour % 12) + minute / 60) / 12) * 2 * Math.PI;
  const minuteAngle = (minute / 60) * 2 * Math.PI;
  const hand = (angle: number, length: number) =>
    `M462 44l${(Math.sin(angle) * length).toFixed(2)} ${(-Math.cos(angle) * length).toFixed(2)}`;
  return (
    <g>
      <circle cx={462} cy={44} r={15} fill={GRAPHITE} {...ink} />
      {/* Quarter-hour ticks */}
      <path
        d="M462 32v-3M474 44h3M462 56v3M450 44h-3"
        stroke={INK_SOFT}
        strokeWidth={1}
      />
      <path d={hand(hourAngle, 8)} {...line} />
      <path
        d={hand(minuteAngle, 12)}
        {...line}
        stroke={AMBER}
        strokeWidth={1.2}
      />
    </g>
  );
};

/** The safety-culture sign every office has, telling on this one. */
const Sign: React.FC<{ days: number; logged: boolean }> = ({
  days,
  logged,
}) => (
  <g>
    <rect x={884} y={24} width={64} height={62} fill={PAPER} opacity={0.06} />
    <rect x={884} y={24} width={64} height={62} {...line} />
    <text
      x={916}
      y={37}
      textAnchor="middle"
      fontSize={6.5}
      fontWeight={700}
      fill={INK}
      fontFamily="var(--font-geist-mono), monospace"
    >
      <tspan x={916}>DAYS SINCE</tspan>
      <tspan x={916} dy={7}>
        LAST DEVIATION
      </tspan>
    </text>
    <text
      x={916}
      y={76}
      textAnchor="middle"
      fontSize={22}
      fontWeight={800}
      fill={logged && days < 3 ? RED : EMERALD}
      fontFamily="var(--font-geist-mono), monospace"
    >
      {days}
    </text>
  </g>
);

const Desk: React.FC<{ scene: SceneState }> = ({ scene }) => (
  <g>
    <Director />
    <rect x={430} y={126} width={330} height={8} fill={GRAPHITE} {...ink} />
    <path d="M444 134v26M746 134v26M680 134v26h66" {...line} />
    <path d="M680 146h66" {...line} stroke={INK_SOFT} />
    <Monitor scene={scene} />
    {/* Keyboard */}
    <path d="M590 126l6 -6h54l6 6" {...line} stroke={INK_SOFT} />
    {/* Phone */}
    <path d="M712 126v-12h34v12" {...line} />
    <path d="M708 112q21 -10 42 0" {...line} />
    <circle
      cx={740}
      cy={119}
      r={2.6}
      fill={scene.phoneBlink ? RED : INK_SOFT}
      className={scene.phoneBlink ? "sd-blink" : undefined}
    />
    {/* Coffee cups, one more for every hour of attention spent */}
    {Array.from({ length: scene.cups - 1 }, (_, i) => (
      <g key={i} className="sd-chip">
        <path
          d={`M${452 + i * 16} 126l2 -12h10l2 12z`}
          fill={PAPER}
          opacity={0.9}
        />
        <path d={`M${454 + i * 16} 117h10`} stroke={GRAPHITE} strokeWidth={1} />
      </g>
    ))}
  </g>
);

const PaperStacks: React.FC<{ count: number }> = ({ count }) => (
  <g>
    {Array.from({ length: count }, (_, i) => {
      const x = 262 + i * 40;
      const h = STACK_HEIGHTS[i];
      const sheets = [];
      for (let y = 160 - 4; y > 160 - h; y -= 4) {
        sheets.push(
          <path
            key={y}
            d={`M${x + (y % 8 === 0 ? 1 : -1)} ${y}h30`}
            stroke={INK_SOFT}
            strokeWidth={0.8}
          />
        );
      }
      return (
        <g key={i} className="sd-chip">
          <rect
            x={x}
            y={160 - h}
            width={30}
            height={h}
            fill={PAPER}
            opacity={0.12}
          />
          <rect x={x} y={160 - h} width={30} height={h} {...line} />
          {sheets}
        </g>
      );
    })}
  </g>
);

const LEAVES = {
  thriving:
    "M830 56q-14 -18 -4 -34M830 56q2 -22 14 -30M830 56q12 -10 22 -8M830 56q-12 -6 -22 -2",
  droopy:
    "M830 56q-16 -12 -18 -2M830 56q0 -20 12 -18q6 2 4 10M830 56q14 -8 20 2M830 56q-8 -14 -2 -24",
  wilted:
    "M830 56q-10 -4 -14 10M830 56q-2 -10 6 -8q4 4 -2 16M830 56q8 -2 12 12M830 56q-4 -8 -12 -4",
} as const;

const Cabinet: React.FC<{ scene: SceneState }> = ({ scene }) => {
  const drawerOpen = scene.paperStacks >= 3;
  return (
    <g>
      <rect x={800} y={70} width={60} height={90} fill={GRAPHITE} {...ink} />
      <path d="M800 100h60M800 130h60" {...line} />
      <path d="M822 85h16M822 145h16" {...line} stroke={INK_SOFT} />
      {drawerOpen ? (
        <g className="sd-chip">
          <rect
            x={796}
            y={104}
            width={68}
            height={22}
            fill={GRAPHITE}
            {...ink}
          />
          <path
            d="M804 104l4 -10h4l-2 10M816 104l6 -12h4l-4 12M834 104l2 -8h6l-2 8"
            fill={PAPER}
            opacity={0.8}
          />
        </g>
      ) : (
        <path d="M822 115h16" {...line} stroke={INK_SOFT} />
      )}
      {/* Pot and plant */}
      <path
        d="M818 70l3 -14h18l3 14z"
        fill="#78350f"
        opacity={0.7}
        {...{ stroke: INK, strokeWidth: 1.2 }}
      />
      <path
        d={LEAVES[scene.plant]}
        fill="none"
        stroke={
          scene.plant === "wilted"
            ? "#a16207"
            : scene.plant === "droopy"
              ? "#84cc16"
              : EMERALD
        }
        strokeWidth={2}
        strokeLinecap="round"
        className="transition-[stroke] duration-500"
      />
    </g>
  );
};

const Bin: React.FC<{ smoke: boolean; fire: boolean }> = ({ smoke, fire }) => (
  <g>
    {fire ? (
      <g className="sd-flicker" style={{ transformOrigin: "897px 130px" }}>
        <path
          d="M884 130q-4 -16 6 -24q-2 8 4 10q2 -14 12 -20q-4 12 4 18q4 -6 2 -12q10 10 4 28z"
          fill={AMBER}
          opacity={0.9}
        />
        <path
          d="M890 130q-2 -8 4 -12q0 6 4 6q2 -8 6 -10q0 8 2 16z"
          fill={RED}
          opacity={0.9}
        />
      </g>
    ) : null}
    {smoke || fire ? (
      <path
        d="M892 112q-6 -10 2 -18t0 -18M904 110q6 -10 -2 -18t2 -16"
        fill="none"
        stroke={INK_SOFT}
        strokeWidth={1.4}
        strokeLinecap="round"
        opacity={0.8}
        className="sd-enter"
      />
    ) : null}
    <path d="M880 128h34l-4 32h-26z" fill={GRAPHITE} {...ink} />
    <path d="M890 134l2 22M904 134l-2 22" {...line} stroke={INK_SOFT} />
  </g>
);

/**
 * The Study Director's office, drawn in ink. It falls apart as the study
 * does; the Study Director does not notice. Static SVG: state changes swap
 * layers, and the only motion is transform or opacity.
 */
export const OfficeScene: React.FC<{
  scene: SceneState;
  /** Today's front page, shown under the scene. */
  headline?: string;
  className?: string;
}> = ({ scene, headline, className }) => (
  <figure
    className={`overflow-hidden border border-[var(--sd-hairline)] transition-colors duration-500 ${scene.night ? "bg-[#0a0b0d]" : "bg-[#101216]"} ${className ?? ""}`}
    data-testid="study-office"
    data-fire={scene.fire ? "true" : "false"}
  >
    <svg
      viewBox="0 0 960 172"
      role="img"
      aria-label={describeScene(scene)}
      className="mx-auto block h-auto max-h-[160px] w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={0} y={160} width={960} height={12} fill="#0b0c0f" />
      <path d="M0 160h960" {...line} stroke={INK_SOFT} />
      <Window night={scene.night} />
      <Calendar day={scene.day} redMarks={scene.redMarks} />
      <Corkboard notes={scene.stickyNotes} pinned={scene.pinned} />
      <PaperStacks count={scene.paperStacks} />
      <Desk scene={scene} />
      <Cabinet scene={scene} />
      <Bin smoke={scene.smoke} fire={scene.fire} />
      <Clock hour={scene.hour} />
      <Sign days={scene.daysSinceDeviation} logged={scene.deviationLogged} />
      {/* Desk lamp pool, only after hours */}
      {scene.night ? (
        <path d="M430 126l40 -60h120l40 60z" fill={AMBER} opacity={0.06} />
      ) : null}
    </svg>
    {headline ? (
      <figcaption className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t border-[var(--sd-hairline)] px-3 py-1.5">
        <span className="shrink-0 text-[10px] font-bold tracking-[0.18em] text-[var(--sd-amber)] uppercase">
          The Daily Deviation
        </span>
        <span
          className="min-w-0 text-xs break-words text-zinc-200"
          data-testid="study-headline"
        >
          {headline}
        </span>
      </figcaption>
    ) : null}
  </figure>
);
