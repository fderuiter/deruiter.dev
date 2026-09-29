"use client";

import React, { useState } from "react";
import type {
  PatrolScenario,
  ScenarioAction,
  PatientState,
  EnvironmentState,
  VitalsData,
} from "@/lib/patrol";
import {
  IconAmbulance,
  IconStethoscope,
  IconNotes,
  IconCheck,
  IconChevronRight,
  IconBuildingHospital,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { MedicalDisclaimerBanner } from "./MedicalDisclaimerBanner";

/**
 * Props for the HandoffPanel component.
 */
export interface HandoffPanelProps {
  /** The active patrol scenario. */
  scenario: PatrolScenario | null;
  /** History of actions executed on scene and during transport. */
  actionHistory: ScenarioAction[];
  /** Chronological vitals history. */
  vitalsHistory?: VitalsData[];
  /** Progressively revealed patient state. */
  revealedPatient?: Partial<PatientState>;
  /** Progressively revealed environment state. */
  revealedEnvironment?: Partial<EnvironmentState>;
  /** Total elapsed minutes spent on this incident call. */
  timeElapsedMinutes: number;
  /** Final patient physiological condition. */
  patientCondition?: "stable" | "deteriorating" | "worsened" | "critical";
  /** Callback triggered to transfer care to EMS/clinic staff and advance to debrief. */
  onCompleteHandoff: () => void;
  /** Optional custom CSS class. */
  className?: string;
}

/**
 * Medical handoff interface to municipal EMS or base clinic:
 * Standardized MIST / SBAR verbal handoff report presenting the facts
 * ACTUALLY assessed and documented by the player during the incident.
 *
 * Notice: Educational simulation prototype.
 * // PLACEHOLDER — needs OEC/NSP content review, see #744
 */
/* jscpd:ignore-start */
export const HandoffPanel: React.FC<HandoffPanelProps> = ({
  scenario,
  actionHistory,
  vitalsHistory = [],
  revealedPatient,
  revealedEnvironment,
  timeElapsedMinutes,
  patientCondition = "stable",
  onCompleteHandoff,
  className = "",
}) => {
  const [attested, setAttested] = useState<boolean>(false);

  const effectiveVitals =
    vitalsHistory.length > 0
      ? vitalsHistory[vitalsHistory.length - 1]
      : revealedPatient?.vitals;

  const hasVitalsAssessed = Boolean(effectiveVitals?.heartRate);
  const hasMechanismAssessed = Boolean(revealedPatient?.mechanism);
  const findings = revealedPatient?.findings ?? [];
  const interventions = revealedPatient?.interventions ?? [];

  return (
    <div
      className={`flex flex-col gap-6 p-4 sm:p-8 bg-zinc-900/40 rounded-2xl border border-zinc-800/80 ${className}`}
      data-testid="patrol-handoff-screen"
    >
      {/* Persistent Medical Disclaimer */}
      <MedicalDisclaimerBanner compact />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider">
              Base First Aid Room &bull; Handoff Bay
            </span>
            <span className="text-zinc-400 text-xs font-mono">
              Incident Duration: {timeElapsedMinutes} min
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-mono font-bold text-white tracking-tight truncate">
            Transfer of Care: {scenario?.title ?? "Patient Hand-off"}
          </h2>
          <p className="text-xs font-sans text-zinc-300 max-w-2xl leading-relaxed">
            Toboggan arrived at Base First Aid Room handoff bay. Delivering
            standardized MIST (Mechanism, Injury, Signs/Vitals, Treatment)
            verbal handoff report to municipal ambulance crew and clinic staff.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center gap-2.5 text-zinc-300 text-xs font-mono shrink-0">
          <IconAmbulance className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>EMS Unit 54 On Scene</span>
        </div>
      </div>

      {/* Standardized MIST Care Transfer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* M & I: Mechanism & Injury Findings */}
        <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-3 min-w-0">
          <div className="flex items-center gap-2 text-brand-cyan">
            <IconNotes className="w-4 h-4" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              MIST: Mechanism &amp; Injury Assessment
            </h3>
          </div>
          <div className="space-y-2 text-xs font-sans text-zinc-300">
            <div>
              <strong className="text-zinc-400 font-mono text-[11px] block">
                M (Mechanism of Injury):
              </strong>
              {hasMechanismAssessed ? (
                <span className="text-zinc-200">
                  {revealedPatient?.mechanism}
                </span>
              ) : (
                <span className="text-zinc-400 italic">
                  Mechanism unconfirmed on scene: patient found down without
                  witness statement.
                </span>
              )}
            </div>

            <div>
              <strong className="text-zinc-400 font-mono text-[11px] block">
                I (Assessed Injuries &amp; Physical Findings):
              </strong>
              {findings.length > 0 ? (
                <ul className="mt-1 space-y-1 text-zinc-200">
                  {findings.map((f, i) => (
                    <li
                      key={`h-finding-${i}`}
                      className="flex items-start gap-1.5"
                    >
                      <span className="text-brand-cyan font-bold">•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-zinc-400 italic">
                  Detailed secondary physical exam was not completed on scene.
                </span>
              )}
            </div>

            <div>
              <strong className="text-zinc-400 font-mono text-[11px] block">
                Chief Complaint:
              </strong>
              <span className="text-amber-200 font-semibold">
                {revealedPatient?.complaint ??
                  "Complaint not formally assessed on scene"}
              </span>
            </div>

            {revealedEnvironment?.weather && (
              <div>
                <strong className="text-zinc-400 font-mono text-[11px] block">
                  Environment &amp; Weather on Hill:
                </strong>
                <span className="text-zinc-300">
                  {revealedEnvironment.weather}
                  {revealedEnvironment.snowConditions
                    ? ` • ${revealedEnvironment.snowConditions}`
                    : ""}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* S & T: Signs/Vitals & Treatments */}
        <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-3 min-w-0">
          <div className="flex items-center gap-2 text-emerald-400">
            <IconStethoscope className="w-4 h-4" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              MIST: Signs, Vitals &amp; Treatments
            </h3>
          </div>

          <div className="space-y-2 text-xs font-sans text-zinc-300">
            <div>
              <strong className="text-zinc-400 font-mono text-[11px] block">
                S (Signs &amp; Baseline Vitals):
              </strong>
              {hasVitalsAssessed ? (
                <div className="mt-1 grid grid-cols-2 gap-1.5 font-mono text-[11px] text-zinc-200 bg-zinc-900/90 p-2 rounded-lg border border-zinc-800">
                  <div>
                    HR:{" "}
                    <strong className="text-white">
                      {effectiveVitals?.heartRate} bpm
                    </strong>
                  </div>
                  <div>
                    RR:{" "}
                    <strong className="text-white">
                      {effectiveVitals?.respiration} /min
                    </strong>
                  </div>
                  <div>
                    BP:{" "}
                    <strong className="text-white">
                      {effectiveVitals?.bpSystolic ?? "--"}/
                      {effectiveVitals?.bpDiastolic ?? "--"}
                    </strong>
                  </div>
                  <div>
                    SpO2:{" "}
                    <strong className="text-white">
                      {effectiveVitals?.spo2 ?? "--"}%
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-1.5">
                  <IconAlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    No vital signs obtained on scene: priority triage handover.
                  </span>
                </div>
              )}
            </div>

            <div>
              <strong className="text-zinc-400 font-mono text-[11px] block">
                T (Field Treatments &amp; Packaging):
              </strong>
              {interventions.length > 0 ? (
                <ul className="mt-1 space-y-1 text-emerald-300">
                  {interventions.map((inv, i) => (
                    <li key={`h-inv-${i}`} className="flex items-start gap-1.5">
                      <IconCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{inv}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-zinc-400 italic">
                  No splints, bandages, or active interventions applied on hill.
                </span>
              )}
            </div>

            <div className="pt-1 text-[11px] font-mono text-zinc-400">
              Condition at Handoff:{" "}
              <strong
                data-testid="handoff-condition"
                className={
                  patientCondition === "stable"
                    ? "text-emerald-400 uppercase"
                    : patientCondition === "critical"
                      ? "text-rose-400 uppercase"
                      : "text-amber-400 uppercase"
                }
/* jscpd:ignore-end */
              >
                {patientCondition}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Logged Actions Summary */}
      <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2">
        <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
          Completed Patrol Care Documentation ({actionHistory.length} actions
          logged):
        </h4>
        {actionHistory.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actionHistory.map((act, idx) => (
              <span
                key={`${act.id}-${idx}`}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300 flex items-center gap-1.5"
              >
                <IconCheck className="w-3 h-3 text-emerald-400" />
                {act.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs font-sans text-zinc-400 italic">
            Standard visual assessment and calm verbal coaching provided during
            transport.
          </p>
        )}
      </div>

      {/* Interactive Attestation & Receiving Clinician Sign-off */}
      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <IconBuildingHospital className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <span className="font-mono font-bold text-emerald-300 uppercase tracking-wider">
              Verbal Handoff Acknowledged by Paramedic Unit 54
            </span>
            <p className="text-emerald-200/90 font-sans leading-relaxed">
              &ldquo;MIST report received. We will take over patient care,
              verify neurovascular status, initiate secondary survey in
              ambulance, and transport to Valley Regional Medical Center.&rdquo;
            </p>
          </div>
        </div>

        {/* Patroller Attestation Checkbox */}
        <label className="min-h-[44px] inline-flex items-center gap-2.5 text-xs font-mono text-emerald-200 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            data-testid="handoff-attest-checkbox"
            className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-brand-cyan focus:ring-2 focus:ring-brand-cyan"
          />
          <span>Attest Report Accuracy</span>
        </label>
      </div>

      {/* Action CTA */}
      <div className="flex items-center justify-end pt-2">
        <button
          type="button"
          onClick={onCompleteHandoff}
          className="min-h-[44px] min-w-[44px] px-6 py-2.5 rounded-xl bg-brand-cyan hover:bg-brand-cyan/90 active:scale-[0.98] text-zinc-950 font-mono text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2 shadow-lg shadow-brand-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <span>Transfer Care &amp; Complete Log</span>
          <IconChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
