"use client";

import React, { useMemo } from "react";
import type {
  PatrolScenario,
  ScenarioAction,
  PatientState,
  EnvironmentState,
  PatrolActor,
  VitalsData,
  PatrolEvent,
} from "@/lib/patrol";
import { getUnlockedDialogueMoments } from "@/lib/patrol";
import { usePatrolTriageHotkeys } from "@/hooks/usePatrolTriageHotkeys";
import {
  IconMapPin,
  IconClock,
  IconCheck,
  IconLock,
  IconChevronRight,
  IconAlertTriangle,
  IconShieldCheck,
  IconUser,
  IconSparkles,
  IconMessageCircle2,
} from "@tabler/icons-react";
import { PatientCard } from "./PatientCard";
import { MedicalDisclaimerBanner } from "./MedicalDisclaimerBanner";
import { DialogueChoice } from "./DialogueChoice";

/**
 * Props for the SceneInteraction component.
 */
export interface SceneInteractionProps {
  /** The active patrol scenario. */
  scenario: PatrolScenario | null;
  /** Chronological history of actions executed during this shift. */
  actionHistory: ScenarioAction[];
  /** Chronological vitals history. */
  vitalsHistory?: VitalsData[];
  /** Current measured vitals. */
  currentVitals?: VitalsData;
  /** Current progressively revealed patient state. */
  revealedPatient?: Partial<PatientState>;
  /** Current progressively revealed environment state. */
  revealedEnvironment?: Partial<EnvironmentState>;
  /** Current revealed actors. */
  revealedActors?: PatrolActor[];
  /** Scene safety status. */
  sceneSafetyStatus?: "unassessed" | "safe" | "compromised";
  /** Dynamic physiological condition of the patient. */
  patientCondition?: "stable" | "deteriorating" | "worsened" | "critical";
  /** Chronological log of shift events, used to look up already-resolved dialogue choices. */
  activeEvents?: PatrolEvent[];
  /** Callback triggered when a clinical/operational action is executed on scene. */
  onExecuteAction: (action: ScenarioAction) => void;
  /** Callback triggered to finish scene stabilization and transition to toboggan transport. */
  onPrepareTransport: () => void;
  /** Optional callback when vitals check is triggered. */
  onCheckVitals?: () => void;
  /** Optional callback when scene safety is assessed or re-assessed. */
  onAssessSceneSafety?: () => void;
  /** Optional callback when a dialogue moment is resolved, receiving the rich PatrolEvent to log. */
  onDialogueChoice?: (event: PatrolEvent) => void;
  /** Focused action index override from parent container. */
  focusedIndex?: number;
  /** Whether keyboard hotkeys are active. */
  isHotkeyActive?: boolean;
}

/**
 * Interactive OEC Scene Element Grid:
 * Replaces SceneInteractionPlaceholder with dynamic action preconditions,
 * progressive clinical and environmental disclosure, non-linear ordering,
 * scene safety monitoring, and integrated medical disclaimer.
 *
 * Notice: Educational simulation prototype.
 * // PLACEHOLDER — needs OEC/NSP content review, see #744
 */
export const SceneInteraction: React.FC<SceneInteractionProps> = ({
  scenario,
  actionHistory,
  vitalsHistory = [],
  currentVitals,
  revealedPatient,
  revealedEnvironment,
  revealedActors = [],
  sceneSafetyStatus = "unassessed",
  patientCondition = "stable",
  activeEvents = [],
  onExecuteAction,
  onPrepareTransport,
  onCheckVitals,
  onAssessSceneSafety,
  onDialogueChoice,
  focusedIndex: externalFocusedIndex,
  isHotkeyActive = true,
}) => {
  const executedIds = useMemo(
    () => new Set(actionHistory.map((a) => a.id)),
    [actionHistory]
  );

  const actions = useMemo(() => scenario?.actions ?? [], [scenario?.actions]);

  const { focusedIndex: internalFocusedIndex, getHotkeyBadge } =
    usePatrolTriageHotkeys({
      items: actions,
      isItemSelectable: (action) => {
        if (!action) return false;
        const hasExecuted = executedIds.has(action.id);
        const preconditions =
          action.preconditions ?? action.prerequisites ?? [];
        const arePreconditionsMet = preconditions.every((pid) =>
          executedIds.has(pid)
        );
        return !hasExecuted && arePreconditionsMet;
      },
      onSelectItem: (_idx, action) => {
        if (action) {
          onExecuteAction(action);
        }
      },
      onAdvancePhase: onPrepareTransport,
      phase: scenario?.id,
      enabled: isHotkeyActive,
    });

  const activeFocusedIndex = externalFocusedIndex ?? internalFocusedIndex;

  const unlockedDialogueMoments = useMemo(
    () => getUnlockedDialogueMoments(scenario?.dialogueMoments, actionHistory),
    [scenario?.dialogueMoments, actionHistory]
  );

  const resolvedDialogueOptionIds = useMemo(() => {
    const map = new Map<string, string>();
    for (const evt of activeEvents) {
      const momentId = evt.context?.momentId;
      const optionId = evt.context?.optionId;
      if (typeof momentId === "string" && typeof optionId === "string") {
        if (!map.has(momentId)) {
          map.set(momentId, optionId);
        }
      }
    }
    return map;
  }, [activeEvents]);

  // Map of action id -> label for friendly precondition messages
  const actionLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of actions) {
      map.set(a.id, a.label);
    }
    return map;
  }, [actions]);

  // Derive all revealed actors (combining props and action reveals)
  const allRevealedActors = useMemo(() => {
    const map = new Map<string, PatrolActor>();
    for (const act of revealedActors) {
      map.set(act.id, act);
    }
    for (const completedAction of actionHistory) {
      if (completedAction.reveals?.actors) {
        for (const act of completedAction.reveals.actors) {
          map.set(act.id, act);
        }
      }
    }
    return Array.from(map.values());
  }, [revealedActors, actionHistory]);

  return (
    <div
      className="flex flex-col gap-6 p-4 sm:p-8 bg-zinc-900/40 rounded-2xl border border-zinc-800/80"
      data-testid="patrol-scene-interaction"
    >
      {/* Persistent, Non-Blocking Medical Disclaimer Banner */}
      <MedicalDisclaimerBanner compact />

      {/* Scene Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider">
              On Scene &bull; OEC Clinical Evaluation
            </span>
            <span className="text-zinc-400 text-xs font-mono flex items-center gap-1">
              <IconMapPin className="w-3 h-3" />
              {scenario?.location ?? "Dan's Dive - East Slopes"}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-mono font-bold text-white tracking-tight">
            {scenario?.title ?? "On-Scene Incident Response"}
          </h2>
          <p className="text-xs font-sans text-zinc-300 max-w-2xl leading-relaxed">
            {scenario?.description ??
              "Arrived on scene. Assess scene safety, interview witnesses, conduct primary survey, and stabilize patient prior to toboggan transport."}
          </p>
        </div>

        {/* Action Counter & Safety Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300">
            <IconClock className="w-3.5 h-3.5 text-brand-cyan" />
            <span>
              Actions Taken:{" "}
              <strong className="text-white">{actionHistory.length}</strong>
            </span>
          </div>

          {onAssessSceneSafety && (
            <button
              type="button"
              onClick={onAssessSceneSafety}
              data-testid="reassess-scene-safety-btn"
              className="min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-mono transition-all cursor-pointer inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
            >
              <IconShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Assess Scene</span>
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Scene Safety Warning Banner */}
      {sceneSafetyStatus === "compromised" && (
        <div
          role="alert"
          data-testid="scene-safety-alert"
          className="p-4 rounded-xl bg-rose-500/10 border-2 border-rose-500/60 text-rose-300 flex items-start gap-3 text-xs font-mono animate-pulse"
        >
          <IconAlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider text-rose-200">
              Hazard Warning: Scene Safety Compromised!
            </span>
            <p className="font-sans text-rose-100/90 leading-relaxed">
              Patient intervention was attempted before securing the uphill
              perimeter. Fast downhill skier traffic created a near-miss hazard,
              startling the patient and worsening physiological distress. Mark
              the scene or plant crossed skis uphill.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Left Column Patient Clipboard, Right Column Action Element Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Evolving Patient Care Clipboard */}
        <div className="lg:col-span-6 xl:col-span-5 flex flex-col gap-4">
          <PatientCard
            scenario={scenario}
            revealedPatient={revealedPatient}
            revealedEnvironment={revealedEnvironment}
            currentVitals={currentVitals}
            vitalsHistory={vitalsHistory}
            patientCondition={patientCondition}
            sceneSafetyStatus={sceneSafetyStatus}
            onCheckVitals={onCheckVitals}
          />

          {/* Discovered Witnesses & On-Scene Responders */}
          {allRevealedActors.length > 0 && (
            <div
              data-testid="revealed-actors-panel"
              className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3 font-mono"
            >
              <div className="flex items-center gap-2 text-brand-cyan">
                <IconUser className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Scene Witnesses &amp; Responders ({allRevealedActors.length})
                </h3>
              </div>
              <div className="space-y-2.5">
                {allRevealedActors.map((actor) => (
                  <div
                    key={actor.id}
                    className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold text-zinc-300">
                      <span>{actor.name}</span>
                      <span className="text-[10px] text-zinc-400 uppercase">
                        {actor.role}
                      </span>
                    </div>
                    {actor.statement && (
                      <p className="text-[11px] font-sans text-zinc-300 italic leading-relaxed">
                        &ldquo;{actor.statement}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Scene Elements & Action Hotspots */}
        <div className="lg:col-span-6 xl:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
            <div className="flex items-center gap-2">
              <IconSparkles className="w-4 h-4 text-brand-cyan" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-200">
                Interactive Scene Actions &amp; Protocol Hotspots
              </h3>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">
              Non-linear ordering supported
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {actions.map((action, actionIdx) => {
              const hasExecuted = executedIds.has(action.id);
              const preconditions =
                action.preconditions ?? action.prerequisites ?? [];
              const arePreconditionsMet = preconditions.every((pid) =>
                executedIds.has(pid)
              );
              const isLocked = !hasExecuted && !arePreconditionsMet;
              const isFocused =
                activeFocusedIndex === actionIdx && !hasExecuted && !isLocked;
              const hotkeyBadge = getHotkeyBadge(actionIdx);

              // Unmet precondition labels
              const unmetLabels = preconditions
                .filter((pid) => !executedIds.has(pid))
                .map((pid) => actionLabelMap.get(pid) ?? pid);

              return (
                <button
                  key={action.id}
                  type="button"
                  data-testid={`action-card-${action.id}`}
                  disabled={hasExecuted || isLocked}
                  aria-disabled={hasExecuted || isLocked}
                  onClick={() => {
                    if (!hasExecuted && !isLocked) {
                      onExecuteAction(action);
                    }
                  }}
                  className={`min-h-[44px] min-w-[44px] text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan ${
                    isFocused
                      ? "ring-2 ring-brand-cyan border-brand-cyan bg-brand-cyan/10 shadow-lg shadow-brand-cyan/10 scale-[1.01]"
                      : hasExecuted
                        ? "bg-brand-cyan/10 border-brand-cyan/40 text-white shadow-sm cursor-default"
                        : isLocked
                          ? "bg-zinc-950/40 border-zinc-800/40 text-zinc-400 cursor-not-allowed opacity-60"
                          : "bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-200 hover:text-white cursor-pointer hover:shadow-lg hover:shadow-brand-cyan/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold block">
                          {action.label}
                        </span>
                        {hotkeyBadge && !hasExecuted && !isLocked && (
                          <span
                            data-testid={`action-hotkey-badge-${action.id}`}
                            className="px-1.5 py-0.5 rounded bg-zinc-800 text-brand-cyan text-[10px] font-mono font-bold border border-brand-cyan/30 shrink-0"
                          >
                            {hotkeyBadge}
                          </span>
                        )}
                      </div>
                      {action.category && (
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                          [{action.category}]
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {action.costMinutes && (
                        <span className="text-[10px] font-mono text-brand-cyan">
                          +{action.costMinutes}m
                        </span>
                      )}
                      {hasExecuted ? (
                        <IconCheck className="w-4 h-4 text-brand-cyan" />
                      ) : isLocked ? (
                        <IconLock className="w-4 h-4 text-zinc-400" />
                      ) : null}
                    </div>
                  </div>

                  {action.description && (
                    <p className="text-[11px] font-sans text-zinc-400 line-clamp-2 leading-relaxed">
                      {action.description}
                    </p>
                  )}

                  {/* Precondition Locking Warning */}
                  {isLocked && unmetLabels.length > 0 && (
                    <div className="pt-1 border-t border-zinc-800/50 flex items-center gap-1 text-[10px] font-mono text-amber-400/90">
                      <IconLock className="w-3 h-3 shrink-0" />
                      <span className="line-clamp-1">
                        Requires: {unmetLabels.join(", ")}
                      </span>
                    </div>
                  )}

                  {/* Completed Check Pill */}
                  {hasExecuted && (
                    <div className="pt-1 border-t border-brand-cyan/20 flex items-center gap-1 text-[10px] font-mono text-brand-cyan">
                      <IconCheck className="w-3 h-3" />
                      <span>Completed &amp; Recorded</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Chronological Action History Summary */}
          {actionHistory.length > 0 && (
            <div className="mt-2 pt-3 border-t border-zinc-800/60 space-y-2">
              <span className="text-xs font-mono font-bold text-zinc-400">
                Completed Protocol Actions ({actionHistory.length}):
              </span>
              <div className="flex flex-wrap gap-2">
                {actionHistory.map((act, idx) => (
                  <span
                    key={`${act.id}-${idx}`}
                    className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 flex items-center gap-1.5"
                  >
                    <IconCheck className="w-3 h-3 text-brand-cyan" />
                    {act.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interpersonal Dialogue & Delegation Moments (Issue #752) */}
      {unlockedDialogueMoments.length > 0 && (
        <div
          data-testid="scene-dialogue-moments"
          className="flex flex-col gap-3 pt-4 border-t border-zinc-800/80"
        >
          <div className="flex items-center gap-2 pb-1">
            <IconMessageCircle2 className="w-4 h-4 text-brand-cyan" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-200">
              Interpersonal Moments
            </h3>
          </div>
          {unlockedDialogueMoments.map((moment) => (
            <DialogueChoice
              key={moment.id}
              scenarioId={scenario?.id ?? "unknown"}
              moment={moment}
              resolvedOptionId={resolvedDialogueOptionIds.get(moment.id)}
              onChoose={(event) => onDialogueChoice?.(event)}
            />
          ))}
        </div>
      )}

      {/* Navigation CTA to Advance to Transport */}
      <div className="flex items-center justify-end pt-4 border-t border-zinc-800/80">
        <button
          type="button"
          onClick={onPrepareTransport}
          className="min-h-[44px] min-w-[44px] px-6 py-2.5 rounded-xl bg-brand-cyan hover:bg-brand-cyan/90 active:scale-[0.98] text-zinc-950 font-mono text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-2 shadow-lg shadow-brand-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <span>Stabilize &amp; Prepare Toboggan</span>
          <IconChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
