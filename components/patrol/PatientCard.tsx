"use client";

import React from "react";
import type {
  PatrolScenario,
  PatientState,
  EnvironmentState,
  VitalsData,
} from "@/lib/patrol";
import {
  IconClipboardHeart,
  IconStethoscope,
  IconAlertTriangle,
  IconCheck,
  IconShieldCheck,
  IconActivity,
  IconBandage,
  IconFlame,
} from "@tabler/icons-react";

/**
 * Props for the PatientCard component.
 */
interface PatientCardProps {
  /** Active patrol scenario. */
  scenario: PatrolScenario | null;
  /** Current progressively revealed patient state. */
  revealedPatient?: Partial<PatientState>;
  /** Current progressively revealed environment state. */
  revealedEnvironment?: Partial<EnvironmentState>;
  /** Latest vital signs reading. */
  currentVitals?: VitalsData;
  /** History of all vitals recorded during the incident. */
  vitalsHistory?: VitalsData[];
  /** Dynamic patient condition. */
  patientCondition?: "stable" | "deteriorating" | "worsened" | "critical";
  /** Scene safety status. */
  sceneSafetyStatus?: "unassessed" | "safe" | "compromised";
  /** Optional callback when player triggers a vitals check. */
  onCheckVitals?: () => void;
  /** Optional CSS class overrides. */
  className?: string;
}

/**
 * Evolving medical clipboard progressively revealing vitals, chief complaint,
 * mechanism of injury, physical exam findings, and clinical interventions.
 *
 * Notice: Educational simulation prototype.
 * // PLACEHOLDER — needs OEC/NSP content review, see #744
 */
/* jscpd:ignore-start */
export const PatientCard: React.FC<PatientCardProps> = ({
  scenario,
  revealedPatient,
  revealedEnvironment,
  currentVitals,
  vitalsHistory = [],
  patientCondition = "stable",
  sceneSafetyStatus = "unassessed",
  onCheckVitals,
  className = "",
}) => {
  const effectiveVitals =
    currentVitals ??
    revealedPatient?.vitals ??
    (vitalsHistory.length > 0
      ? vitalsHistory[vitalsHistory.length - 1]
      : undefined);

  const hasComplaint = Boolean(revealedPatient?.complaint);
  const hasMechanism = Boolean(revealedPatient?.mechanism);
  const hasVitals = Boolean(effectiveVitals?.heartRate);
  const findings = revealedPatient?.findings ?? [];
  const interventions = revealedPatient?.interventions ?? [];

  return (
    <article
      role="region"
      aria-label="OEC Patient Care Clipboard"
      data-testid="patient-card"
      className={`rounded-2xl bg-zinc-950/90 border border-zinc-800/90 p-4 sm:p-5 flex flex-col gap-4 shadow-xl font-mono ${className}`}
    >
      {/* Clipboard Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan shrink-0">
            <IconClipboardHeart className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight uppercase truncate">
                OEC Field Care Record
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 shrink-0">
                PCR #{scenario?.id ?? "incident-01"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-sans truncate">
              Incident Location: {scenario?.location ?? "Upper Mountain"}
            </p>
          </div>
        </div>

        {/* Dynamic Condition & Scene Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Patient Condition */}
          <span
            data-testid="patient-condition-badge"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wider ${
              patientCondition === "stable"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : patientCondition === "worsened" ||
                    patientCondition === "deteriorating"
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-300 animate-pulse"
                  : "bg-rose-500/15 border-rose-500/40 text-rose-400"
            }`}
          >
            <IconActivity className="w-3.5 h-3.5" />
            <span>Condition: {patientCondition}</span>
          </span>

          {/* Scene Safety Status */}
          <span
            data-testid="scene-safety-badge"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wider ${
              sceneSafetyStatus === "safe"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : sceneSafetyStatus === "compromised"
                  ? "bg-rose-500/15 border-rose-500/40 text-rose-400"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400"
            }`}
          >
            {sceneSafetyStatus === "safe" ? (
              <IconShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <IconAlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>Scene: {sceneSafetyStatus}</span>
          </span>
        </div>
      </div>

      {/* Assessment Overview (Complaint & Mechanism) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Chief Complaint */}
        <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-1.5 min-w-0">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <IconStethoscope className="w-3.5 h-3.5 text-brand-cyan" />
              Chief Complaint
            </span>
            {hasComplaint ? (
              <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                <IconCheck className="w-3 h-3" /> Assessed
              </span>
            ) : (
              <span className="text-zinc-400 text-[10px]">Unassessed</span>
            )}
          </div>
          {hasComplaint ? (
            <p className="text-xs font-sans text-amber-200 font-semibold leading-snug">
              {revealedPatient?.complaint}
            </p>
          ) : (
            <p className="text-xs font-sans text-zinc-400 italic">
              Pending primary assessment: interview patient and examine
              airway/circulation.
            </p>
          )}
        </div>

        {/* Mechanism of Injury (MOI) */}
        <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-1.5 min-w-0">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <IconFlame className="w-3.5 h-3.5 text-amber-400" />
              Mechanism of Injury
            </span>
            {hasMechanism ? (
              <span className="text-emerald-400 text-[10px] flex items-center gap-1">
                <IconCheck className="w-3 h-3" /> Revealed
              </span>
            ) : (
              <span className="text-zinc-400 text-[10px]">Pending MOI</span>
            )}
          </div>
          {hasMechanism ? (
            <p className="text-xs font-sans text-zinc-200 leading-snug">
              {revealedPatient?.mechanism}
            </p>
          ) : (
            <p className="text-xs font-sans text-zinc-400 italic">
              Pending witness interview or fall analysis.
            </p>
          )}
        </div>
      </div>

      {/* Vital Signs Grid */}
      <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconActivity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Baseline Vital Signs
            </h3>
            {vitalsHistory.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400">
                {vitalsHistory.length} check
                {vitalsHistory.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {onCheckVitals && (
            <button
              type="button"
              onClick={onCheckVitals}
              className="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] border border-zinc-700 text-zinc-200 text-xs font-mono transition-all cursor-pointer inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
            >
              <IconStethoscope className="w-3.5 h-3.5 text-brand-cyan" />
              <span>Check Vitals</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {/* Heart Rate */}
          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 flex flex-col">
            <span className="text-[10px] text-zinc-400 uppercase">
              Heart Rate
            </span>
            <span
              data-testid="vitals-hr"
              className={`text-sm font-bold ${
                hasVitals ? "text-white" : "text-zinc-400"
              }`}
            >
              {effectiveVitals?.heartRate
                ? `${effectiveVitals.heartRate} bpm`
                : "--"}
            </span>
          </div>

          {/* Respiration */}
          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 flex flex-col">
            <span className="text-[10px] text-zinc-400 uppercase">
              Respiration
            </span>
            <span
              data-testid="vitals-rr"
              className={`text-sm font-bold ${
                hasVitals ? "text-white" : "text-zinc-400"
              }`}
            >
              {effectiveVitals?.respiration
                ? `${effectiveVitals.respiration} /min`
                : "--"}
            </span>
          </div>

          {/* Blood Pressure */}
          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 flex flex-col">
            <span className="text-[10px] text-zinc-400 uppercase">
              BP (Sys/Dia)
            </span>
            <span
              data-testid="vitals-bp"
              className={`text-sm font-bold ${
                hasVitals && effectiveVitals?.bpSystolic
                  ? "text-white"
                  : "text-zinc-400"
              }`}
            >
              {effectiveVitals?.bpSystolic
                ? `${effectiveVitals.bpSystolic}/${effectiveVitals.bpDiastolic ?? "--"}`
                : "--"}
            </span>
          </div>

          {/* SpO2 */}
          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 flex flex-col">
            <span className="text-[10px] text-zinc-400 uppercase">SpO2</span>
            <span
              data-testid="vitals-spo2"
              className={`text-sm font-bold ${
                hasVitals && effectiveVitals?.spo2
                  ? "text-white"
                  : "text-zinc-400"
              }`}
            >
              {effectiveVitals?.spo2 ? `${effectiveVitals.spo2}%` : "--"}
            </span>
          </div>

          {/* Temp */}
          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 flex flex-col">
            <span className="text-[10px] text-zinc-400 uppercase">
              Core Temp
            </span>
            <span
              data-testid="vitals-temp"
              className={`text-sm font-bold ${
                hasVitals && effectiveVitals?.temperature
                  ? "text-white"
                  : "text-zinc-400"
              }`}
            >
              {effectiveVitals?.temperature
                ? `${effectiveVitals.temperature} °F`
                : "--"}
            </span>
          </div>

          {/* Distal PMS / GCS */}
          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 flex flex-col">
            <span className="text-[10px] text-zinc-400 uppercase">
              LOC / GCS
            </span>
            <span
              data-testid="vitals-loc"
              className={`text-sm font-bold ${
                effectiveVitals?.gcs ||
                effectiveVitals?.avpu ||
                revealedPatient?.levelOfConsciousness
                  ? "text-emerald-400"
                  : "text-zinc-400"
              }`}
            >
              {effectiveVitals?.gcs
                ? `GCS ${effectiveVitals.gcs}`
                : effectiveVitals?.avpu
                  ? `AVPU (${effectiveVitals.avpu})`
                  : revealedPatient?.levelOfConsciousness
                    ? "A&O x4"
                    : "--"}
            </span>
          </div>
        </div>
      </div>

      {/* Findings & Interventions Progressive Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Physical Exam Findings */}
        <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <IconStethoscope className="w-3.5 h-3.5 text-brand-cyan" />
              Physical Exam Findings ({findings.length})
            </span>
          </div>
          {findings.length > 0 ? (
            <ul className="space-y-1 text-xs font-sans text-zinc-300">
              {findings.map((f, i) => (
                <li key={`finding-${i}`} className="flex items-start gap-1.5">
                  <span className="text-brand-cyan font-bold">•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs font-sans text-zinc-400 italic">
              Physical exam not yet completed. Perform secondary survey to
              palpate extremity.
            </p>
          )}
        </div>

        {/* Clinical Interventions Applied */}
        <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <IconBandage className="w-3.5 h-3.5 text-emerald-400" />
              Applied Interventions ({interventions.length})
            </span>
          </div>
          {interventions.length > 0 ? (
            <ul className="space-y-1 text-xs font-sans text-emerald-300">
              {interventions.map((inv, i) => (
                <li key={`inv-${i}`} className="flex items-start gap-1.5">
                  <IconCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{inv}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs font-sans text-zinc-400 italic">
              No splints, insulation, or interventions applied yet.
            </p>
          )}
        </div>
      </div>

      {/* Environmental Hazards Discovered */}
      {revealedEnvironment?.hazards &&
        revealedEnvironment.hazards.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-xs">
            <IconAlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-amber-300 uppercase tracking-wider text-[11px]">
                Active Scene Environmental Factors:
              </span>
              <p className="text-amber-200/90 font-sans">
                {revealedEnvironment.hazards.join(" • ")}
              </p>
            </div>
          </div>
        )}
    </article>
  );
/* jscpd:ignore-end */
};
