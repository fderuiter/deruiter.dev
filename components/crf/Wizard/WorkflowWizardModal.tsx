"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  IconX,
  IconChevronRight,
  IconChevronLeft,
  IconSparkles,
  IconLayoutGrid,
  IconCalendarEvent,
  IconMathFunction,
  IconDeviceLaptop,
  IconFileExport,
  IconShieldCheck,
  IconCertificate,
  IconPlayerPlay,
  IconCheck,
  IconPlus,
  IconTrash,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { StudyProtocol, StudioMode, StudyVisit } from "@/lib/crf/types";
import { formatVisitWindow } from "@/lib/crf/visit-window";
import {
  StudyProtocolEngine,
  CDASH_DOMAIN_CATALOG,
} from "@/lib/crf/study-engine";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { cloneDeep } from "@/lib/utils";

interface WorkflowWizardModalProps {
  isOpen: boolean;
  study?: StudyProtocol;
  onClose: () => void;
  onSwitchMode: (mode: StudioMode) => void;
  onLoadPreset?: (presetId: string) => void;
  onApplyStudy?: (updated: StudyProtocol) => void;
  onStartSpotlightTour: () => void;
}

const PRESET_ARCHETYPES = [
  {
    id: "oncology_recist",
    name: "Phase III Immuno-Oncology (RECIST 1.1)",
    therapeuticArea: "Oncology",
    phase: "Phase III",
    description:
      "Solid tumor protocol with RECIST 1.1 tumor assessment, CTCAE v5.0 AEs, and cycle-based visit scheduling.",
    badge: "Most Popular",
  },
  {
    id: "device_cardiovascular_implant",
    name: "Class III Cardiovascular Implant (IDE)",
    therapeuticArea: "Medical Device / Cardiology",
    phase: "Pivotal IDE",
    description:
      "Implantable cardiovascular device tracking with UDI (DI), procedural deployment (DU), and incident tracking (DE).",
    badge: "FDA IDE",
  },
  {
    id: "cns_neuro",
    name: "CNS / Neuro Psychiatric Evaluation",
    therapeuticArea: "Neurology / Psychiatry",
    phase: "Phase IIb",
    description:
      "Standardized psychiatric instruments (HAM-D, PANSS, MoCA) with longitudinal visit score deltas.",
    badge: "Scales",
  },
  {
    id: "pk_dose_escalation",
    name: "Phase I PK / Dose Escalation",
    therapeuticArea: "Clinical Pharmacology",
    phase: "Phase I",
    description:
      "Intensive serial PK sampling, dose accountability, and rapid safety stopping rules.",
    badge: "Pharmacology",
  },
];

/* jscpd:ignore-start */
export const WorkflowWizardModal: React.FC<WorkflowWizardModalProps> = ({
  isOpen,
  study: currentStudy,
  onClose,
  onSwitchMode,
  onLoadPreset,
  onApplyStudy,
  onStartSpotlightTour,
}) => {
  const [currentStageIdx, setCurrentStageIdx] = useState<number>(0);

  // Local draft state for the wizard authoring session
  const [draftStudy, setDraftStudy] = useState<StudyProtocol>(() => {
    if (currentStudy) return cloneDeep(currentStudy);
    return StudyProtocolEngine.loadPreset("oncology_recist").study;
  });

  // Re-sync draft when modal opens
  useEffect(() => {
    if (isOpen && currentStudy) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftStudy(cloneDeep(currentStudy));
    }
  }, [isOpen, currentStudy]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent | KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        const target = (e.target ||
          document.activeElement) as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT")
        ) {
          return;
        }
        e.preventDefault();
        setCurrentStageIdx((prev) => Math.min(prev + 1, 4));
      } else if (e.key === "ArrowLeft") {
        const target = (e.target ||
          document.activeElement) as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT")
        ) {
          return;
        }
        e.preventDefault();
        setCurrentStageIdx((prev) => Math.max(prev - 1, 0));
      }
/* jscpd:ignore-end */
    },
    []
  );

  const containerRef = useFocusTrap<HTMLDivElement>(isOpen, {
    onEscape: onClose,
    onKeyDown: handleKeyDown as (e: KeyboardEvent) => void,
    returnFocus: true,
  });

  if (!isOpen) return null;

  // Validation report for stage 5 and real-time badge
  const validationReport = StudyProtocolEngine.validateProtocol(draftStudy);

  // Stage 1: Load preset into draft
  const handleSelectPreset = (presetId: string) => {
    const { study } = StudyProtocolEngine.loadPreset(presetId);
    setDraftStudy(study);
  };

  // Stage 2: Toggle Domain
  const handleToggleDomain = (domainCode: string) => {
    const exists = draftStudy.forms.some(
      (f) => f.domain.toUpperCase() === domainCode.toUpperCase()
    );
    if (exists) {
      const { study } = StudyProtocolEngine.removeForm(draftStudy, domainCode);
      setDraftStudy(study);
    } else {
      const { study } = StudyProtocolEngine.addForm(draftStudy, domainCode);
      // Auto assign to first visit if available
      if (study.visits.length > 0) {
        const newForm = study.forms.find((f) => f.domain === domainCode);
        if (newForm) {
          const res = StudyProtocolEngine.assignVisitForms(
            study,
            study.visits[0].id,
            [newForm.id]
          );
          setDraftStudy(res.study || study);
          return;
        }
      }
      setDraftStudy(study);
    }
  };

  // Stage 3: Visit management
  const handleAddVisit = () => {
    const nextDay =
      draftStudy.visits.length > 0
        ? draftStudy.visits[draftStudy.visits.length - 1].targetDay + 28
        : 0;
    const { study } = StudyProtocolEngine.addVisit(draftStudy, {
      name: `Cycle ${Math.max(1, draftStudy.visits.length)} Day 1`,
      targetDay: nextDay,
      windowBefore: 3,
      windowAfter: 3,
      assignedFormIds: draftStudy.forms
        .filter((f) => f.domain === "VS" || f.domain === "AE")
        .map((f) => f.id),
    });
    setDraftStudy(study);
  };

  const handleRemoveVisit = (visitId: string) => {
    const { study } = StudyProtocolEngine.removeVisit(draftStudy, visitId);
    setDraftStudy(study);
  };

  const handleToggleVisitForm = (visitId: string, formId: string) => {
    const updatedVisits: StudyVisit[] = draftStudy.visits.map((v) => {
      if (v.id === visitId) {
        const assigned = v.assignedFormIds.includes(formId)
          ? v.assignedFormIds.filter((id) => id !== formId)
          : [...v.assignedFormIds, formId];
        return { ...v, assignedFormIds: assigned };
      }
      return v;
    });
    setDraftStudy({
      ...draftStudy,
      visits: updatedVisits,
      lastModified: new Date().toISOString(),
    });
  };

  // Stage 4: Toggle Calculation Preset
  const handleToggleCalculationRule = (
    ruleType: "BMI" | "MAP" | "COMPLIANCE"
  ) => {
    if (ruleType === "BMI") {
      if (!draftStudy.forms.some((f) => f.domain === "VS")) {
        const res = StudyProtocolEngine.addForm(draftStudy, "VS");
        const withRule = StudyProtocolEngine.addRule(res.study, "VS", {
          name: "Body Mass Index (BMI) Calculation",
          targetFieldIdOrVar: "BMI",
          actionType: "set_value",
          formulaExpression:
            "round(WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100)), 1)",
          triggerFieldIdsOrVars: ["WEIGHT", "HEIGHT"],
        });
        setDraftStudy(withRule.study);
      } else {
        const withRule = StudyProtocolEngine.addRule(draftStudy, "VS", {
          name: "Body Mass Index (BMI) Calculation",
          targetFieldIdOrVar: "BMI",
          actionType: "set_value",
          formulaExpression:
            "round(WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100)), 1)",
          triggerFieldIdsOrVars: ["WEIGHT", "HEIGHT"],
        });
        setDraftStudy(withRule.study);
      }
    } else if (ruleType === "MAP") {
      const withRule = StudyProtocolEngine.addRule(draftStudy, "VS", {
        name: "Mean Arterial Pressure (MAP)",
        targetFieldIdOrVar: "MAP",
        actionType: "set_value",
        formulaExpression: "round((2 * DIABP + SYSBP) / 3, 1)",
        triggerFieldIdsOrVars: ["DIABP", "SYSBP"],
      });
      setDraftStudy(withRule.study);
    } else if (ruleType === "COMPLIANCE") {
      const targetDomain = draftStudy.forms.some((f) => f.domain === "DA")
        ? "DA"
        : draftStudy.forms[0]?.domain || "VS";
      const withRule = StudyProtocolEngine.addRule(draftStudy, targetDomain, {
        name: "Drug Compliance Rate (%)",
        targetFieldIdOrVar: "DACOMPL",
        actionType: "set_value",
        formulaExpression: "round(((DASPNO - DARETNO) / DASPNO) * 100, 1)",
        triggerFieldIdsOrVars: ["DASPNO", "DARETNO"],
      });
      setDraftStudy(withRule.study);
    }
  };

  // Deploy to Studio
  const handleDeploy = () => {
    if (onApplyStudy) {
      onApplyStudy(draftStudy);
    } else if (onLoadPreset) {
      // Fallback
    }
    onSwitchMode("designer");
    onClose();
  };

  const STAGE_HEADERS = [
    {
      number: 1,
      title: "Study Profile",
      subtitle: "Archetype & Metadata",
      icon: <IconLayoutGrid className="w-4 h-4 text-sky-400" />,
    },
    {
      number: 2,
      title: "CDASH Domains",
      subtitle: "Standard Variables",
      icon: <IconDeviceLaptop className="w-4 h-4 text-emerald-400" />,
    },
    {
      number: 3,
      title: "SoA Visit Schedule",
      subtitle: "Protocol Timeline",
      icon: <IconCalendarEvent className="w-4 h-4 text-purple-400" />,
    },
    {
      number: 4,
      title: "AST Rules & Logic",
      subtitle: "Dynamic Calculations",
      icon: <IconMathFunction className="w-4 h-4 text-amber-400" />,
    },
    {
      number: 5,
      title: "Audit & Deploy",
      subtitle: "Conformance & Launch",
      icon: <IconFileExport className="w-4 h-4 text-brand-cyan" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in font-sans">
      <div
        ref={containerRef}
        className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden font-mono"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
        tabIndex={-1}
      >
        {/* Top Header Bar */}
        <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30">
              <IconSparkles className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="wizard-title"
                  className="text-base font-bold text-white tracking-wide"
                >
                  CRF Protocol Authoring Wizard
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Stage {currentStageIdx + 1} of 5{" "}
                  <span className="sr-only">
                    Step {currentStageIdx + 1} of 5
                  </span>
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-sans">
                Interactive clinical study configurator with live CDISC CDASH
                2.2 validation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onStartSpotlightTour();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-medium transition-all"
              title="Launch interactive UI Spotlight Tour"
            >
              <IconPlayerPlay className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Spotlight Tour</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              aria-label="Close authoring wizard"
            >
              <IconX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stage Navigation Step Pills */}
        <div className="px-6 py-3 border-b border-zinc-800/60 bg-zinc-950 grid grid-cols-5 gap-2">
          {STAGE_HEADERS.map((s, idx) => {
            const isActive = idx === currentStageIdx;
            const isCompleted = idx < currentStageIdx;

            return (
              <button
                key={s.number}
                onClick={() => setCurrentStageIdx(idx)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all border ${
                  isActive
                    ? "bg-brand-cyan/15 border-brand-cyan text-white shadow-sm"
                    : isCompleted
                      ? "bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                      : "bg-zinc-950 border-transparent text-zinc-500 hover:text-zinc-400"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isActive
                      ? "bg-brand-cyan text-black"
                      : isCompleted
                        ? "bg-emerald-500 text-black"
                        : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {isCompleted ? "✓" : s.number}
                </div>
                <div className="min-w-0 hidden sm:block">
                  <div className="text-[11px] font-semibold truncate leading-tight">
                    {s.title}
                  </div>
                  <div className="text-[9px] text-zinc-500 truncate">
                    {s.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Stage Content Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* STAGE 1: Protocol Profile & Archetype Selection */}
          {currentStageIdx === 0 && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <IconCertificate className="w-4 h-4 text-brand-cyan" />
                    <span>Choose Starting Archetype or Customize Profile</span>
                  </div>
                  <span className="text-xs text-zinc-500 font-sans">
                    1-Click Presets
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {PRESET_ARCHETYPES.map((arch) => (
                    <button
                      key={arch.id}
                      onClick={() => handleSelectPreset(arch.id)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        draftStudy.protocolNumber.includes(arch.phase) ||
                        draftStudy.studyName.includes(arch.name.split(" ")[0])
                          ? "bg-brand-cyan/10 border-brand-cyan text-white shadow-sm"
                          : "bg-zinc-950 hover:bg-zinc-900/80 border-zinc-800 text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white truncate">
                          {arch.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-800 text-brand-cyan border border-zinc-700">
                          {arch.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 font-sans line-clamp-2 leading-relaxed">
                        {arch.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Editable Protocol Attributes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-900/30 p-4 rounded-2xl border border-zinc-800/60">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">
                    Protocol Number
                  </label>
                  <input
                    type="text"
                    value={draftStudy.protocolNumber}
                    onChange={(e) =>
                      setDraftStudy({
                        ...draftStudy,
                        protocolNumber: e.target.value,
                      })
                    }
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:border-brand-cyan focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">
                    Study Phase
                  </label>
                  <select
                    value={draftStudy.phase}
                    onChange={(e) =>
                      setDraftStudy({
                        ...draftStudy,
                        phase: e.target.value as StudyProtocol["phase"],
                      })
                    }
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:border-brand-cyan focus:outline-none"
                  >
                    <option value="Phase I">Phase I</option>
                    <option value="Phase II">Phase II</option>
                    <option value="Phase III">Phase III</option>
                    <option value="Phase IV">Phase IV</option>
                    <option value="Pivotal IDE">Pivotal IDE (Device)</option>
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">
                    Study Title
                  </label>
                  <input
                    type="text"
                    value={draftStudy.studyName}
                    onChange={(e) =>
                      setDraftStudy({
                        ...draftStudy,
                        studyName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:border-brand-cyan focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">
                    Sponsor Name
                  </label>
                  <input
                    type="text"
                    value={draftStudy.sponsor}
                    onChange={(e) =>
                      setDraftStudy({ ...draftStudy, sponsor: e.target.value })
                    }
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:border-brand-cyan focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400 font-medium">
                    Therapeutic Area
                  </label>
                  <input
                    type="text"
                    value={draftStudy.therapeuticArea}
                    onChange={(e) =>
                      setDraftStudy({
                        ...draftStudy,
                        therapeuticArea: e.target.value,
                      })
                    }
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:border-brand-cyan focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STAGE 2: CDASH 2.2 Domains Selector */}
          {currentStageIdx === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Select CDASH &amp; Medical Device Domains
                  </h3>
                  <p className="text-xs text-zinc-400 font-sans">
                    Toggle standard regulatory domains to inject or remove from
                    the study protocol.
                  </p>
                </div>
                <span className="text-xs text-brand-cyan font-bold">
                  {draftStudy.forms.length} of {CDASH_DOMAIN_CATALOG.length}{" "}
                  Domains Active
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {CDASH_DOMAIN_CATALOG.map((dom) => {
                  const isChecked = draftStudy.forms.some(
                    (f) => f.domain.toUpperCase() === dom.code.toUpperCase()
                  );

                  return (
                    <div
                      key={dom.code}
                      onClick={() => handleToggleDomain(dom.code)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 select-none ${
                        isChecked
                          ? "bg-zinc-900 border-brand-cyan/80 shadow-md shadow-brand-cyan/5"
                          : "bg-zinc-950 hover:bg-zinc-900/50 border-zinc-800/80 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-brand-cyan px-2 py-0.5 rounded bg-brand-cyan/10 border border-brand-cyan/20">
                            {dom.code}
                          </span>
                          <span className="text-xs font-bold text-white truncate">
                            {dom.label.split(" ")[0]}
                          </span>
                        </div>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                            isChecked
                              ? "bg-brand-cyan text-black"
                              : "bg-zinc-800 text-transparent"
                          }`}
                        >
                          ✓
                        </div>
                      </div>

                      <p className="text-[11px] text-zinc-400 font-sans line-clamp-2 leading-relaxed">
                        {dom.description}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-850">
                        <span>{dom.variableCount} Standard Vars</span>
                        <span className="uppercase text-[9px] text-zinc-400">
                          {dom.category}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STAGE 3: Schedule of Activities (SoA) Visit Matrix */}
          {currentStageIdx === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Schedule of Activities (SoA) Matrix
                  </h3>
                  <p className="text-xs text-zinc-400 font-sans">
                    Configure longitudinal visit timeline and assign CRF forms
                    to study events.
                  </p>
                </div>
                <button
                  onClick={handleAddVisit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition-colors"
                >
                  <IconPlus className="w-3.5 h-3.5" />
                  <span>Add Visit</span>
                </button>
              </div>

              <div className="space-y-3">
                {draftStudy.visits.map((visit) => (
                  <div
                    key={visit.id}
                    className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Day {visit.targetDay} ({formatVisitWindow(visit)})
                        </span>
                        <span className="text-xs font-bold text-white">
                          {visit.name}
                        </span>
                      </div>
                      {draftStudy.visits.length > 1 && (
                        <button
                          onClick={() => handleRemoveVisit(visit.id)}
                          className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                          title="Delete visit"
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Form Assignment Chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {draftStudy.forms.map((form) => {
                        const isAssigned = visit.assignedFormIds.includes(
                          form.id
                        );

                        return (
                          <button
                            key={form.id}
                            onClick={() =>
                              handleToggleVisitForm(visit.id, form.id)
                            }
                            className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                              isAssigned
                                ? "bg-brand-cyan/20 border-brand-cyan text-brand-cyan shadow-xs"
                                : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                            }`}
                          >
                            {isAssigned ? "✓ " : "+ "}
                            {form.domain} ({form.name.split(" ")[0]})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STAGE 4: AST Rules & Calculations */}
          {currentStageIdx === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Clinical Calculations &amp; AST Edit Checks
                  </h3>
                  <p className="text-xs text-zinc-400 font-sans">
                    Inject automated mathematical derivations and multi-field
                    validation rules into the protocol.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                  onClick={() => handleToggleCalculationRule("BMI")}
                  className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-brand-cyan/50 cursor-pointer space-y-2 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      Body Mass Index (BMI)
                    </span>
                    <IconMathFunction className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-[11px] text-zinc-400 font-sans leading-normal">
                    Automated formula evaluating weight (kg) over height (m²).
                  </p>
                  <code className="text-[10px] text-brand-cyan block bg-zinc-950 p-1.5 rounded border border-zinc-850">
                    round(WEIGHT / ((HEIGHT/100)^2), 1)
                  </code>
                </div>

                <div
                  onClick={() => handleToggleCalculationRule("MAP")}
                  className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-brand-cyan/50 cursor-pointer space-y-2 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      Mean Arterial Pressure (MAP)
                    </span>
                    <IconMathFunction className="w-4 h-4 text-purple-400" />
                  </div>
                  <p className="text-[11px] text-zinc-400 font-sans leading-normal">
                    Blood pressure hemodynamic calculation from Systolic and
                    Diastolic.
                  </p>
                  <code className="text-[10px] text-purple-400 block bg-zinc-950 p-1.5 rounded border border-zinc-850">
                    round((2 * DIABP + SYSBP) / 3, 1)
                  </code>
                </div>

                <div
                  onClick={() => handleToggleCalculationRule("COMPLIANCE")}
                  className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-brand-cyan/50 cursor-pointer space-y-2 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      Drug Accountability (%)
                    </span>
                    <IconMathFunction className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-[11px] text-zinc-400 font-sans leading-normal">
                    Compliance percentage from dispensed and returned unit
                    pills.
                  </p>
                  <code className="text-[10px] text-amber-400 block bg-zinc-950 p-1.5 rounded border border-zinc-850">
                    round(((DISP - RET) / DISP) * 100, 1)
                  </code>
                </div>
              </div>

              {/* Active Rules List */}
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-2">
                <span className="text-xs font-bold text-zinc-300">
                  Active Rules in Protocol (
                  {draftStudy.forms.reduce((acc, f) => acc + f.rules.length, 0)}
                  ):
                </span>
                {draftStudy.forms
                  .flatMap((f) =>
                    f.rules.map((r) => ({ domain: f.domain, ...r }))
                  )
                  .map((rule, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 border-b border-zinc-850 last:border-0"
                    >
                      <span className="text-brand-cyan font-bold">
                        [{rule.domain}] {rule.name}
                      </span>
                      <span className="text-zinc-400 text-[11px] font-sans">
                        {rule.formulaExpression || rule.queryMessage}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* STAGE 5: Conformance Audit & Instant Deployment */}
          {currentStageIdx === 4 && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">
                      Regulatory &amp; Logic Conformance Audit
                    </h3>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                      validationReport.isCompliant
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-red-500/10 text-red-400 border-red-500/30"
                    }`}
                  >
                    {validationReport.isCompliant
                      ? "✔ 100% Compliant"
                      : `✖ ${validationReport.errors.length} Issues`}
                  </span>
                </div>

                {validationReport.issues.length === 0 ? (
                  <p className="text-xs text-zinc-300 font-sans">
                    All {draftStudy.forms.length} clinical domains,{" "}
                    {draftStudy.visits.length} Schedule of Activities visits,
                    and AST rule graphs comply with CDISC CDASH 2.2 and 21 CFR
                    Part 11 requirements cleanly.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {validationReport.issues.map((iss, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <IconAlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-brand-cyan">[{iss.form}]</span>
                        <span className="text-zinc-300 font-sans">
                          {iss.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Protocol Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800 text-center">
                  <div className="text-lg font-bold text-white">
                    {draftStudy.forms.length}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase">
                    CDASH Domains
                  </div>
                </div>
                <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800 text-center">
                  <div className="text-lg font-bold text-white">
                    {draftStudy.visits.length}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase">
                    Study Visits
                  </div>
                </div>
                <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800 text-center">
                  <div className="text-lg font-bold text-white">
                    {draftStudy.forms.reduce(
                      (a, f) =>
                        a +
                        f.sections.reduce((sa, s) => sa + s.fields.length, 0),
                      0
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase">
                    Clinical Variables
                  </div>
                </div>
                <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800 text-center">
                  <div className="text-lg font-bold text-white">
                    {draftStudy.forms.reduce((a, f) => a + f.rules.length, 0)}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase">
                    AST Rules
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-6 py-4 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                setCurrentStageIdx((prev) => Math.max(0, prev - 1))
              }
              disabled={currentStageIdx === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-800 text-xs font-semibold transition-colors"
            >
              <IconChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="text-xs text-zinc-500 hidden sm:inline">
              Use ← and → arrow keys to navigate
            </span>
          </div>

          <div className="flex items-center gap-2">
            {currentStageIdx < 4 ? (
              <button
                onClick={() =>
                  setCurrentStageIdx((prev) => Math.min(4, prev + 1))
                }
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-brand-cyan text-black hover:bg-white text-xs font-bold transition-all shadow-md"
              >
                <span>Next Stage</span>
                <IconChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleDeploy}
                className="inline-flex items-center gap-1.5 px-6 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
              >
                <IconCheck className="w-4 h-4" />
                <span>Deploy Protocol to Studio Canvas</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
