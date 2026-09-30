"use client";

import React from "react";
import type { TeamMember } from "@/lib/study-director";
import { Portrait } from "./Portrait";
import { senderOf, type SenderKind } from "./messages";

const KIND_COLOR: Record<Exclude<SenderKind, "team">, string> = {
  sponsor: "#f59e0b",
  site: "#10b981",
  company: "#94a3b8",
};

const KIND_MARK: Record<Exclude<SenderKind, "team">, string> = {
  sponsor: "SP",
  site: "ST",
  company: "HQ",
};

/**
 * Who wrote a message: a team member's portrait, or a square mark for the
 * sponsor, a site or the company. Decorative; the text names the sender.
 */
export const SenderAvatar: React.FC<{
  from: string;
  team: TeamMember[];
  size?: number;
}> = ({ from, team, size = 32 }) => {
  const sender = senderOf(from, team);
  if (sender.member) {
    return (
      <Portrait
        name={sender.member.name}
        role={sender.member.role}
        workload={sender.member.workload}
        size={size}
      />
    );
  }
  const kind = sender.kind as Exclude<SenderKind, "team">;
  const mark =
    kind === "site"
      ? sender.name.replace(/\D/g, "").slice(0, 2) || KIND_MARK.site
      : KIND_MARK[kind];
  return (
    <svg
      viewBox="0 0 36 36"
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0"
      data-sender-kind={kind}
    >
      <rect
        x={4}
        y={4}
        width={28}
        height={28}
        rx={4}
        fill={KIND_COLOR[kind]}
        fillOpacity={0.12}
        stroke={KIND_COLOR[kind]}
        strokeOpacity={0.6}
      />
      <text
        x={18}
        y={18.5}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10}
        fontWeight={700}
        fontFamily="var(--font-geist-mono), monospace"
        fill={KIND_COLOR[kind]}
      >
        {mark}
      </text>
    </svg>
  );
};
