"use client";

import React from "react";
import type { TeamRole } from "@/lib/study-director";
import { clamp } from "@/lib/game-utils";

/** One restrained accent per role, so a face is recognisable across panels. */
export const ROLE_ACCENT: Record<TeamRole, string> = {
  biostatistician: "#7dd3fc",
  dataManager: "#5eead4",
  regulatory: "#fde047",
  monitor: "#fda4af",
  medicalWriter: "#bef264",
  programmer: "#94a3b8",
};

const RING = 15;
const CIRC = 2 * Math.PI * RING;

/** Workload at which a member is stretched, then overloaded. */
export const STRETCHED = 70;
export const OVERLOADED = 85;

export function strain(workload: number): "ok" | "stretched" | "overloaded" {
  if (workload > OVERLOADED) return "overloaded";
  if (workload > STRETCHED) return "stretched";
  return "ok";
}

const STRAIN_STROKE = {
  ok: "#94a3b8",
  stretched: "#f59e0b",
  overloaded: "#f87171",
} as const;

/**
 * A monogram portrait: initials on the role's colour, ringed by how much
 * of the person's capacity is in use. Decorative; the row carries the text.
 */
export const Portrait: React.FC<{
  name: string;
  role: TeamRole;
  workload: number;
  size?: number;
}> = ({ name, role, workload, size = 36 }) => {
  const level = strain(workload);
  const filled = (clamp(workload, 0, 100) / 100) * CIRC;
  const initials = name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <svg
      viewBox="0 0 36 36"
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0"
      data-strain={level}
    >
      <circle
        cx={18}
        cy={18}
        r={RING}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={2.5}
      />
      <circle
        cx={18}
        cy={18}
        r={RING}
        fill="none"
        stroke={STRAIN_STROKE[level]}
        strokeWidth={2.5}
        strokeDasharray={`${filled} ${CIRC}`}
        strokeLinecap="round"
        transform="rotate(-90 18 18)"
      />
      <circle
        cx={18}
        cy={18}
        r={11.5}
        fill={ROLE_ACCENT[role]}
        fillOpacity={0.14}
        stroke={ROLE_ACCENT[role]}
        strokeOpacity={0.55}
        strokeWidth={1}
      />
      <text
        x={18}
        y={18.5}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10}
        fontWeight={700}
        fontFamily="var(--font-geist-mono), monospace"
        fill={ROLE_ACCENT[role]}
      >
        {initials}
      </text>
    </svg>
  );
};
