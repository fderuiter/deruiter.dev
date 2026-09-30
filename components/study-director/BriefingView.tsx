"use client";

import React from "react";
import {
  ATTENTION_PER_DAY,
  AUDIT_ATTENTION,
  DOCUMENTATION_ATTENTION,
  type SiteState,
  type StudySetup,
  type TeamMember,
} from "@/lib/study-director";
import { COORDINATOR_LABELS, ROLE_LABELS } from "./labels";
import { money } from "./format";
import { Portrait } from "./Portrait";

const MATURITY = {
  solid: "Solid",
  questionable: "Questionable",
  shaky: "Shaky",
} as const;

const RISK = { low: "Low", moderate: "Moderate", high: "High" } as const;

/** The five rules, shortest possible, in the order they bite. */
const rules = (setup: StudySetup) => [
  {
    title: `${ATTENTION_PER_DAY} attention a day`,
    body: "Answering, delegating and auditing all spend it. It does not carry over.",
  },
  {
    title: `Documenting costs ${DOCUMENTATION_ATTENTION}`,
    body: "Skipped documentation comes back when the FDA inspects.",
  },
  {
    title: "Backlog eats your day",
    body: "Open queries and unrecorded decisions take attention before you decide anything. Dashed pips show it.",
  },
  {
    title: "The dashboard is hearsay",
    body: `It shows what people report. An audit costs ${AUDIT_ATTENTION} and shows what is true.`,
  },
  {
    title: "Six meters, one of you",
    body: `You cannot keep them all high across ${Math.round(setup.durationDays / 7)} weeks. Choose what to protect.`,
  },
];

const Pips: React.FC<{ value: number; max: number; label: string }> = ({
  value,
  max,
  label,
}) => (
  <span
    className="flex items-center gap-0.5"
    role="img"
    aria-label={`${label}: ${value} of ${max}`}
  >
    {Array.from({ length: max }, (_, i) => (
      <span
        key={i}
        aria-hidden="true"
        className={`h-2 w-3 ${i < value ? "bg-[var(--sd-amber)]" : "bg-zinc-800"}`}
      />
    ))}
  </span>
);

/**
 * The study dossier the player reads before day 1: the protocol's cover
 * sheet, who is on the team, what the sites are like, and the rules.
 */
export const BriefingView: React.FC<{
  setup: StudySetup;
  sites: SiteState[];
  team: TeamMember[];
  actions: React.ReactNode;
  /** Shown under the cover sheet, full width: the personnel file. */
  footer?: React.ReactNode;
}> = ({ setup, sites, team, actions, footer }) => (
  <div
    data-sd-desk=""
    data-testid="study-briefing"
    className="space-y-3 bg-[var(--sd-bg)] p-3 font-mono text-[var(--sd-text)] sm:p-4"
  >
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section
        aria-label="Protocol cover sheet"
        className="sd-enter relative border border-[var(--sd-hairline-strong)] bg-[var(--sd-surface)] p-5"
      >
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase">
          Protocol cover sheet · Confidential
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.035em] break-words text-[var(--sd-text)]">
          Study {setup.id}: {setup.design}
        </h2>
        <p className="mt-1 text-sm text-zinc-300">
          {setup.sponsor.name}
          <span className="text-[var(--sd-muted)]">
            {" "}
            (
            {setup.sponsor.archetype === "firstTimeBiotech"
              ? "first-time biotech"
              : "big pharma"}
            )
          </span>
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-[var(--sd-muted)]">Phase</dt>
            <dd className="font-bold">{setup.clinicalPhase}</dd>
          </div>
          <div>
            <dt className="text-[var(--sd-muted)]">Sites / subjects</dt>
            <dd className="font-bold">
              {sites.length} sites, {setup.subjects} subjects
            </dd>
          </div>
          <div>
            <dt className="text-[var(--sd-muted)]">Timeline / budget</dt>
            <dd className="font-bold">
              {Math.round(setup.durationDays / 7)} weeks, {money(setup.budget)}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--sd-muted)]">Protocol</dt>
            <dd className="font-bold">
              {MATURITY[setup.protocolMaturity]} maturity
            </dd>
          </div>
          <div>
            <dt className="text-[var(--sd-muted)]">Regulatory risk</dt>
            <dd className="font-bold">{RISK[setup.regulatoryRisk]}</dd>
          </div>
          <div>
            <dt className="text-[var(--sd-muted)]">Complexity</dt>
            <dd className="mt-1">
              <Pips value={setup.complexity} max={5} label="Complexity" />
            </dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-3">{actions}</div>
      </section>

      <div className="grid min-w-0 gap-3">
        <section
          aria-label="Your team"
          className="border border-[var(--sd-hairline)] bg-[var(--sd-surface)] p-4"
        >
          <h3 className="text-[11px] font-bold tracking-[0.14em] text-zinc-200 uppercase">
            Your team
          </h3>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {team.map((member) => (
              <li key={member.id} className="flex min-w-0 items-center gap-2">
                <Portrait
                  name={member.name}
                  role={member.role}
                  workload={member.workload}
                  size={30}
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold">
                    {member.name}
                  </span>
                  <span className="block truncate text-[10px] text-[var(--sd-muted)]">
                    {ROLE_LABELS[member.role]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section
          aria-label="Your sites"
          className="border border-[var(--sd-hairline)] bg-[var(--sd-surface)] p-4"
        >
          <h3 className="text-[11px] font-bold tracking-[0.14em] text-zinc-200 uppercase">
            Your sites
          </h3>
          <ul className="mt-2 space-y-1.5">
            {sites.map((site) => (
              <li
                key={site.id}
                className="flex min-w-0 items-baseline justify-between gap-2 text-xs"
              >
                <span className="font-bold">{site.name}</span>
                <span className="min-w-0 truncate text-[var(--sd-muted)]">
                  Coordinator: {COORDINATOR_LABELS[site.coordinator]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>

    <section aria-label="How it works">
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {rules(setup).map((rule, i) => (
          <li
            key={rule.title}
            style={{ animationDelay: `${120 + i * 60}ms` }}
            className="sd-enter min-w-0 border border-[var(--sd-hairline)] bg-[var(--sd-surface)] p-3"
          >
            <p className="text-[10px] font-bold text-[var(--sd-amber)]">
              0{i + 1}
            </p>
            <p className="mt-1 text-xs font-bold break-words text-[var(--sd-text)]">
              {rule.title}
            </p>
            <p className="mt-1 text-[11px] break-words text-[var(--sd-muted)]">
              {rule.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
    {footer}
  </div>
);
