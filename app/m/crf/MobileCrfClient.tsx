"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  StudyProtocol,
  getOncologyPresetSync,
  loadStudyDraft,
} from "@/lib/crf";
import { useStudioHashParams } from "@/hooks/useStudioHashParams";
import { NextPrevNav } from "@/components/ui/NextPrevNav";
import { IconFileSpreadsheet } from "@tabler/icons-react";

export function MobileCrfClient() {
  const { params, setParam, setParams } = useStudioHashParams();

  const [study] = useState<StudyProtocol>(() => {
    if (typeof window !== "undefined") {
      const draft = loadStudyDraft();
      if (draft.status === "recovered") {
        return draft.study;
      }
    }
    return getOncologyPresetSync();
  });

  const [activeFormId, setActiveFormId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const rawForm = new URLSearchParams(window.location.hash.slice(1)).get(
        "form"
      );
      if (rawForm && study.forms.some((f) => f.id === rawForm)) {
        return rawForm;
      }
    }
    return study.forms[0]?.id || "";
  });

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"forms" | "fields" | "rules">(
    "forms"
  );

  useEffect(() => {
    const rawForm = params.form as string | undefined;
    if (rawForm && study.forms.some((f) => f.id === rawForm)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveFormId(rawForm);
    }
    const rawField = params.field as string | undefined;
    if (rawField) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedFieldId(rawField);
    }
  }, [params, study]);

  const activeForm = useMemo(
    () => study.forms.find((f) => f.id === activeFormId) || study.forms[0],
    [study, activeFormId]
  );

  const selectedField = useMemo(() => {
    if (!selectedFieldId || !activeForm) return null;
    for (const section of activeForm.sections) {
      const field = section.fields.find((f) => f.id === selectedFieldId);
      if (field) return field;
    }
    return null;
  }, [selectedFieldId, activeForm]);

  const handleFormChange = (formId: string) => {
    setActiveFormId(formId);
    setSelectedFieldId(null);
    setParams({ form: formId, field: null }, { replace: true });
  };

  const handleFieldSelect = (fieldId: string) => {
    setSelectedFieldId(fieldId);
    setParam("field", fieldId, { replace: true });
  };

  return (
    <div className="w-full min-h-screen bg-zinc-950 text-white pb-12 flex flex-col gap-4">
      {/* Mobile CRF Header */}
      <div className="bg-zinc-900/90 border-b border-zinc-800 p-4 sticky top-16 z-20 backdrop-blur-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <IconFileSpreadsheet className="w-5 h-5 text-brand-cyan" />
            <span className="font-mono text-sm font-bold tracking-wider text-neutral-100">
              CRF STUDIO (MOBILE)
            </span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20">
            {study.protocolNumber || study.studyName || "CDASH eCRF"}
          </span>
        </div>

        {/* Forms Selector */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {study.forms.map((form) => {
            const isActive = form.id === activeFormId;
            return (
              <button
                key={form.id}
                type="button"
                onClick={() => handleFormChange(form.id)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono font-bold whitespace-nowrap transition-all border ${
                  isActive
                    ? "bg-brand-cyan/20 text-brand-cyan border-brand-cyan/50 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                }`}
              >
                {form.name} ({form.domain})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 flex flex-col gap-4">
        {/* Active Form Overview Card */}
        {activeForm && (
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <span>ACTIVE FORM</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-brand-cyan font-bold">
                Domain: {activeForm.domain}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white font-mono">
              {activeForm.name}
            </h2>
            <p className="text-xs font-sans text-zinc-300">
              {activeForm.description}
            </p>
          </div>
        )}

        {/* Tabs: Form Sections / Fields / Edit Checks */}
        <div className="flex border-b border-zinc-800 font-mono text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("forms")}
            className={`min-h-[44px] flex-1 py-2.5 font-bold text-center border-b-2 ${
              activeTab === "forms"
                ? "border-brand-cyan text-brand-cyan"
                : "border-transparent text-zinc-400"
            }`}
          >
            Sections &amp; Fields
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rules")}
            className={`min-h-[44px] flex-1 py-2.5 font-bold text-center border-b-2 ${
              activeTab === "rules"
                ? "border-brand-cyan text-brand-cyan"
                : "border-transparent text-zinc-400"
            }`}
          >
            Edit Checks ({study.rules?.length || 0})
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "forms" && activeForm && (
          <div className="flex flex-col gap-4">
            {activeForm.sections.map((section) => (
              <div
                key={section.id}
                className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2">
                  <h3 className="font-mono text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    {section.title}
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {section.fields.length} Fields
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {section.fields.map((field) => {
                    const isSelected = selectedFieldId === field.id;
                    return (
                      <div
                        key={field.id}
                        onClick={() => handleFieldSelect(field.id)}
                        className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-zinc-900 border-brand-cyan/60 shadow-md"
                            : "bg-zinc-950/60 border-zinc-800/60 hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="font-bold text-brand-cyan">
                            {field.variableName}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">
                            {field.dataType}
                          </span>
                        </div>
                        <span className="text-xs font-sans text-white font-medium">
                          {field.label}
                        </span>
                        {field.cdashMetadata?.sdtmVariable && (
                          <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                            <span>CDASH:</span>
                            <span className="text-zinc-400">
                              {field.cdashMetadata.sdtmVariable}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "rules" && (
          <div className="flex flex-col gap-2.5">
            {!study.rules || study.rules.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 font-mono text-xs">
                No edit check rules configured for this study protocol.
              </div>
            ) : (
              (study.rules || []).map((rule) => (
                <div
                  key={rule.id}
                  className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-amber-400">
                      {rule.name}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">
                      Severity: {rule.querySeverity || "warning"}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-brand-cyan bg-zinc-950 p-2 rounded border border-zinc-800/60">
                    {rule.formulaExpression || rule.description}
                  </div>
                  <p className="text-xs font-sans text-zinc-300">
                    {rule.queryMessage || rule.description}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Selected Field Inspector Modal / Card */}
        {selectedField && (
          <div className="p-4 rounded-2xl bg-zinc-900 border border-brand-cyan/40 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-mono text-xs font-bold text-brand-cyan uppercase">
                FIELD INSPECTOR
              </span>
              <button
                type="button"
                onClick={() => setSelectedFieldId(null)}
                className="text-xs font-mono text-zinc-400 hover:text-white"
              >
                Close ✕
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase">
                Variable Name
              </label>
              <span className="font-mono text-sm font-bold text-white">
                {selectedField.variableName}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase">
                Label
              </label>
              <span className="font-sans text-xs text-zinc-200">
                {selectedField.label}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">
                  DATA TYPE
                </span>
                <span className="text-brand-cyan font-bold">
                  {selectedField.dataType}
                </span>
              </div>
              <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">
                  REQUIRED
                </span>
                <span className="text-white font-bold">
                  {selectedField.required ? "YES" : "NO"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="px-4 mt-6">
        <NextPrevNav
          prev={{
            title: "Ski Patrol Shift Studio",
            href: "/m/patrol",
            label: "Patrol Operations",
            tag: "Mobile Judgment Engine",
          }}
          next={{
            title: "Logical Proof Workspace",
            href: "/m/proof",
            label: "Formal Logic Engine",
            tag: "Mobile Proof Canvas",
          }}
          backToHub={{
            title: "Return to Portfolio",
            href: "/",
          }}
        />
      </div>
    </div>
  );
}
