"use client";

import React, { useRef, useState } from "react";
import {
  METER_IDS,
  computeMeters,
  type Difficulty,
  type FinalReport,
} from "@/lib/study-director";
import { copyToClipboard, getActiveHostUrl } from "@/lib/clipboard";
import { verdictFor } from "./closeout";
import { radarPoints } from "./geometry";
import type { CareerNews } from "./career";
import { DIFFICULTY_TEXT } from "./DifficultyPicker";

const W = 1200;
const H = 630;
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const GRADE_FILL = {
  A: "#10b981",
  B: "#10b981",
  C: "#f59e0b",
  D: "#f87171",
  F: "#f87171",
} as const;

/** The link that replays a study from its seed. */
export function seedLink(
  seed: string,
  origin = getActiveHostUrl(),
  difficulty?: Difficulty
): string {
  const hard =
    difficulty && difficulty !== "standard" ? `&difficulty=${difficulty}` : "";
  return `${origin}/arcade/study-director#seed=${encodeURIComponent(seed)}${hard}`;
}

/**
 * A 1200 by 630 closeout card for sharing: the verdict, the grade stamp,
 * the final study-health shape and the seed that replays it. Drawn as SVG
 * so the same markup previews on the page and rasterises for download.
 */
const CardArt = React.forwardRef<SVGSVGElement, { report: FinalReport }>(
  ({ report }, ref) => {
    const verdict = verdictFor(report);
    const { grade } = report.evaluations.regulatory;
    const stars = report.evaluations.sponsor.stars;
    const meters = computeMeters(report.state);
    const shape = radarPoints(
      METER_IDS.map((id) => meters[id]),
      0,
      120
    )
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
    const frame = radarPoints(
      METER_IDS.map(() => 100),
      0,
      120
    )
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={`Share card: ${verdict.headline} Grade ${grade}. ${report.profile.title}.`}
        className="block h-auto w-full"
      >
        <rect width={W} height={H} fill="#0d0e11" />
        <rect
          x={24}
          y={24}
          width={W - 48}
          height={H - 48}
          fill="none"
          stroke="rgba(255,255,255,0.14)"
        />
        <text
          x={64}
          y={88}
          fill="#f59e0b"
          fontFamily={MONO}
          fontSize={22}
          fontWeight={700}
          letterSpacing={4}
        >
          STUDY DIRECTOR · EVERYTHING IS FINE
        </text>
        <text
          x={64}
          y={196}
          fill="#f4f4f6"
          fontFamily={MONO}
          fontSize={50}
          fontWeight={800}
          letterSpacing={-1.5}
        >
          {verdict.headline}
        </text>
        <text x={64} y={246} fill="#a1a1aa" fontFamily={MONO} fontSize={22}>
          {verdict.line}
        </text>
        <text
          x={64}
          y={330}
          fill="#a1a1aa"
          fontFamily={MONO}
          fontSize={20}
          letterSpacing={3}
        >
          PROFILE
        </text>
        <text
          x={64}
          y={372}
          fill="#f59e0b"
          fontFamily={MONO}
          fontSize={36}
          fontWeight={800}
        >
          {report.profile.title}
        </text>
        <text x={64} y={430} fill="#f59e0b" fontFamily={MONO} fontSize={34}>
          {"★".repeat(stars)}
          <tspan fill="#3f3f46">{"★".repeat(5 - stars)}</tspan>
        </text>
        <text x={64} y={466} fill="#a1a1aa" fontFamily={MONO} fontSize={18}>
          Sponsor rating
        </text>

        <g transform="translate(800 400)">
          <polygon
            points={frame}
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={1.5}
          />
          <polygon
            points={shape}
            fill="rgba(245,158,11,0.18)"
            stroke="#f59e0b"
            strokeWidth={3}
            strokeLinejoin="round"
          />
        </g>

        <g transform="translate(1040 190) rotate(-8)">
          <rect
            x={-78}
            y={-78}
            width={156}
            height={156}
            fill="none"
            stroke={GRADE_FILL[grade]}
            strokeWidth={6}
          />
          <text
            x={0}
            y={44}
            textAnchor="middle"
            fill={GRADE_FILL[grade]}
            fontFamily={MONO}
            fontSize={128}
            fontWeight={800}
          >
            {grade}
          </text>
        </g>
        <text
          x={1040}
          y={306}
          textAnchor="middle"
          fill="#a1a1aa"
          fontFamily={MONO}
          fontSize={16}
          letterSpacing={3}
        >
          INSPECTION READINESS
        </text>

        <text x={64} y={572} fill="#71717a" fontFamily={MONO} fontSize={18}>
          Study {report.state.setup.id} ·{" "}
          {DIFFICULTY_TEXT[report.state.difficulty ?? "standard"].label} · seed{" "}
          {report.state.seed} · deruiter.dev/arcade/study-director
        </text>
      </svg>
    );
  }
);
CardArt.displayName = "CardArt";

async function rasterise(svg: SVGSVGElement): Promise<Blob> {
  const markup = new XMLSerializer().serializeToString(svg);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  const image = new Image();
  image.width = W;
  image.height = H;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The card could not be drawn."));
    image.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The card could not be drawn.");
  context.drawImage(image, 0, 0, W, H);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("The card could not be drawn.")),
      "image/png"
    )
  );
}

const NEWS_LABELS: Array<[keyof CareerNews, string]> = [
  ["newTitle", "New title for your personnel file"],
  ["newBestGrade", "Best grade so far"],
  ["newBestStars", "Best sponsor rating so far"],
];

/** The closeout's share panel: career news, the card, and copy or download. */
export const SharePanel: React.FC<{
  report: FinalReport;
  news: CareerNews | null;
}> = ({ report, news }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [message, setMessage] = useState("");

  const copyLink = async () => {
    try {
      await copyToClipboard(
        seedLink(report.state.seed, undefined, report.state.difficulty)
      );
      setMessage("Link copied. It opens this same study.");
    } catch {
      setMessage("Copy failed. The seed is on the card.");
    }
  };

  const download = async () => {
    if (!svgRef.current) return;
    try {
      const blob = await rasterise(svgRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `study-director-${report.state.seed}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Card downloaded.");
    } catch {
      setMessage("The card could not be drawn in this browser.");
    }
  };

  const badges = news ? NEWS_LABELS.filter(([key]) => news[key]) : [];

  return (
    <section
      aria-label="Share this study"
      data-testid="study-share"
      className="border border-[var(--sd-hairline)] bg-[var(--sd-surface)] p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-bold tracking-[0.14em] text-[var(--sd-text)] uppercase">
          Share this study
        </h3>
        {badges.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {badges.map(([key, label]) => (
              <li
                key={key}
                className="sd-chip border border-[var(--sd-amber)]/60 bg-[var(--sd-amber)]/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[var(--sd-amber)] uppercase"
              >
                {label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="mt-3 max-w-xl border border-[var(--sd-hairline)]">
        <CardArt ref={svgRef} report={report} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void copyLink()}
          className="min-h-[36px] border border-zinc-700 px-3 text-xs text-zinc-200 hover:border-[var(--sd-amber)]"
        >
          Copy link
        </button>
        <button
          type="button"
          onClick={() => void download()}
          className="min-h-[36px] border border-zinc-700 px-3 text-xs text-zinc-200 hover:border-[var(--sd-amber)]"
        >
          Download card
        </button>
        <p role="status" className="text-[11px] text-[var(--sd-muted)]">
          {message}
        </p>
      </div>
    </section>
  );
};
