"use client";

import React, { useState } from "react";
import {
  CRFForm,
  CRFField,
  CodelistDefinition,
  EditCheckRule,
  StudyReviewActor,
  StudyReviewThread,
  StudyProtocolEngine,
} from "@/lib/crf";
import { computeFormHealthMetrics } from "@/lib/crf/form-health";
import { FieldPropertiesTab } from "./FieldPropertiesTab";
import { LogicRulesTab } from "./LogicRulesTab";
import { CdiscMetadataTab } from "./CdiscMetadataTab";
import { ReviewThreadsTab } from "./ReviewThreadsTab";
import {
  IconAdjustments,
  IconX,
  IconFileSpreadsheet,
  IconTerminal2,
  IconCheck,
  IconCopy,
} from "@tabler/icons-react";
import {
  generateCliCommandForField,
  generateCliCommandForForm,
} from "@/lib/crf/universal-schema";

interface InspectorPanelProps {
  form: CRFForm;
  selectedField: CRFField | null;
  codelists: CodelistDefinition[];
  onClose: () => void;
  onUpdateField: (fieldId: string, updates: Partial<CRFField>) => void;
  onUpdateFormMeta: (updates: Partial<CRFForm>) => void;
  onUpdateRules: (rules: EditCheckRule[]) => void;
  onSaveCodelist?: (codelist: CodelistDefinition) => void;
  onDuplicateField?: (fieldId: string) => void;
  onDuplicateForm?: (formId: string) => void;
  onRenameEverywhere?: (newVar: string) => void;
  reviewThreads?: StudyReviewThread[];
  reviewAuthor: StudyReviewActor;
  onReviewAuthorChange: (author: StudyReviewActor) => void;
  onAddReviewComment: (
    fieldId: string,
    body: string,
    author: StudyReviewActor
  ) => void;
  onSetReviewThreadStatus: (
    threadId: string,
    status: "resolved" | "open",
    author: StudyReviewActor
  ) => void;
  onCommitReviewTargetChange: (fieldId: string) => void;
}

type InspectorTab = "properties" | "logic" | "cdash" | "review";

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  form,
  selectedField,
  codelists,
  onClose,
  onUpdateField,
  onUpdateFormMeta,
  onUpdateRules,
  onSaveCodelist,
  onDuplicateField,
  onDuplicateForm,
  onRenameEverywhere,
  reviewThreads = [],
  reviewAuthor,
  onReviewAuthorChange,
  onAddReviewComment,
  onSetReviewThreadStatus,
  onCommitReviewTargetChange,
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>("properties");
  const [hasCopiedCli, setHasCopiedCli] = useState(false);
  const allFields = form.sections.flatMap((s) => s.fields);
  const healthMetrics = computeFormHealthMetrics(form);
  const openReviewThreadCount = reviewThreads.filter(
    (thread) => StudyProtocolEngine.getReviewThreadStatus(thread) === "open"
  ).length;

  const handleCopyCli = async () => {
    const cmd = selectedField
      ? generateCliCommandForField(form.domain, selectedField)
      : generateCliCommandForForm(form);

    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(cmd);
      setHasCopiedCli(true);
      setTimeout(() => setHasCopiedCli(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/90 border-l border-zinc-800/80">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="p-1 rounded bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan">
            {selectedField ? (
              <IconAdjustments className="w-4 h-4" />
            ) : (
              <IconFileSpreadsheet className="w-4 h-4" />
            )}
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-white font-mono truncate">
              {selectedField ? selectedField.variableName : form.name}
            </h3>
            <p className="text-[10px] text-zinc-400 font-mono">
              {selectedField
                ? "Field Property Inspector"
                : "Form-Level Settings"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedField && onDuplicateField && (
            <button
              onClick={() => onDuplicateField(selectedField.id)}
              className="p-1.5 rounded text-xs font-mono transition-all flex items-center gap-1 border bg-zinc-900 text-zinc-400 hover:text-white border-zinc-800 hover:bg-zinc-800"
              title="Duplicate Field"
              aria-label="Duplicate Field"
            >
              <IconCopy className="w-3.5 h-3.5 text-brand-cyan" />
              <span className="text-[10px] hidden sm:inline">Duplicate</span>
            </button>
          )}

          {!selectedField && onDuplicateForm && (
            <button
              onClick={() => onDuplicateForm(form.id)}
              className="p-1.5 rounded text-xs font-mono transition-all flex items-center gap-1 border bg-zinc-900 text-zinc-400 hover:text-white border-zinc-800 hover:bg-zinc-800"
              title="Duplicate Form"
              aria-label="Duplicate Form"
            >
              <IconCopy className="w-3.5 h-3.5 text-brand-cyan" />
              <span className="text-[10px] hidden sm:inline">Duplicate</span>
            </button>
          )}

          <button
            onClick={handleCopyCli}
            className={`p-1.5 rounded text-xs font-mono transition-all flex items-center gap-1 border ${
              hasCopiedCli
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-zinc-900 text-zinc-400 hover:text-white border-zinc-800 hover:bg-zinc-800"
            }`}
            title="Copy exact CLI command for this element"
          >
            {hasCopiedCli ? (
              <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <IconTerminal2 className="w-3.5 h-3.5 text-brand-cyan" />
            )}
            <span className="text-[10px] hidden sm:inline">
              {hasCopiedCli ? "Copied" : "CLI"}
            </span>
          </button>

          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-white rounded hover:bg-zinc-800 transition-colors"
            title="Deselect"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-zinc-800 bg-zinc-950/60">
        <button
          onClick={() => setActiveTab("properties")}
          className={`flex-1 min-w-0 px-1 py-2 text-center text-xs font-mono whitespace-nowrap transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === "properties"
              ? "border-brand-cyan text-brand-cyan font-bold bg-zinc-900/40"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>Properties</span>
        </button>

        <button
          onClick={() => setActiveTab("logic")}
          className={`flex-1 min-w-0 px-1 py-2 text-center text-xs font-mono whitespace-nowrap transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === "logic"
              ? "border-brand-cyan text-brand-cyan font-bold bg-zinc-900/40"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>Edit Checks</span>
        </button>

        <button
          onClick={() => setActiveTab("cdash")}
          className={`flex-1 min-w-0 px-1 py-2 text-center text-xs font-mono whitespace-nowrap transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === "cdash"
              ? "border-brand-cyan text-brand-cyan font-bold bg-zinc-900/40"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>CDASH / aCRF</span>
        </button>
        <button
          onClick={() => setActiveTab("review")}
          aria-label={`Review threads (${openReviewThreadCount} open in study)`}
          className={`flex-1 min-w-0 px-1 py-2 text-center text-xs font-mono whitespace-nowrap transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === "review"
              ? "border-amber-400 text-amber-300 font-bold bg-zinc-900/40"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>Review</span>
          <span className="rounded bg-zinc-800 px-1 text-[9px]">
            {openReviewThreadCount}
          </span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "review" ? (
          <ReviewThreadsTab
            threads={reviewThreads}
            selectedField={selectedField}
            author={reviewAuthor}
            onAuthorChange={onReviewAuthorChange}
            onAddComment={onAddReviewComment}
            onSetStatus={onSetReviewThreadStatus}
            isTargetDeleted={StudyProtocolEngine.isReviewTargetDeleted}
            getStatus={(thread) =>
              StudyProtocolEngine.getReviewThreadStatus(thread)
            }
          />
        ) : selectedField ? (
          <>
            {activeTab === "properties" && (
              <FieldPropertiesTab
                field={selectedField}
                allFieldsInForm={allFields}
                codelists={codelists}
                onUpdateField={(updates) =>
                  onUpdateField(selectedField.id, updates)
                }
                onSaveToStudyCodelist={onSaveCodelist}
                onRenameEverywhere={onRenameEverywhere}
                onCommitReviewTargetChange={() =>
                  onCommitReviewTargetChange(selectedField.id)
                }
              />
            )}

            {activeTab === "logic" && (
              <LogicRulesTab
                form={form}
                selectedField={selectedField}
                onUpdateRules={onUpdateRules}
              />
            )}

            {activeTab === "cdash" && (
              <CdiscMetadataTab
                field={selectedField}
                form={form}
                onUpdateField={(updates) =>
                  onUpdateField(selectedField.id, updates)
                }
              />
            )}
          </>
        ) : (
          <div className="p-4 space-y-4">
            {/* Executive Form Health Dashboard */}
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                    Form Conformance &amp; Telemetry
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 font-bold">
                  CDASH {healthMetrics.cdashConformancePercentage}%
                </span>
              </div>

              {/* 4-Metric Grid */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-850">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase">
                    Total Fields
                  </div>
                  <div className="text-sm font-mono font-extrabold text-white mt-0.5">
                    {healthMetrics.totalFields}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-850">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase">
                    Mandatory
                  </div>
                  <div className="text-sm font-mono font-extrabold text-amber-400 mt-0.5">
                    {healthMetrics.mandatoryFields}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-850">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase">
                    Codelists
                  </div>
                  <div className="text-sm font-mono font-extrabold text-purple-400 mt-0.5">
                    {healthMetrics.codelistsAttached}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-850">
                  <div className="text-[10px] font-mono text-zinc-400 uppercase">
                    SDV Verified
                  </div>
                  <div className="text-sm font-mono font-extrabold text-emerald-400 mt-0.5">
                    {healthMetrics.sdvVerifiedCount} /{" "}
                    {healthMetrics.totalFields} (
                    {healthMetrics.sdvReadinessPercentage}%)
                  </div>
                </div>
              </div>

              {/* Form Metadata Settings */}
              <div className="space-y-2.5 pt-2 border-t border-zinc-850">
                <div>
                  <label
                    htmlFor="crf-inspector-form-name"
                    className="block text-[10px] font-mono text-zinc-400 mb-1"
                  >
                    Form Name
                  </label>
                  <input
                    id="crf-inspector-form-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => onUpdateFormMeta({ name: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:border-brand-cyan focus:outline-none font-sans"
                  />
                </div>
                <div>
                  <label
                    htmlFor="crf-inspector-form-domain"
                    className="block text-[10px] font-mono text-zinc-400 mb-1"
                  >
                    CDASH Domain
                  </label>
                  <input
                    id="crf-inspector-form-domain"
                    type="text"
                    value={form.domain}
                    onChange={(e) =>
                      onUpdateFormMeta({ domain: e.target.value.toUpperCase() })
                    }
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-brand-cyan font-mono uppercase focus:border-brand-cyan focus:outline-none"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                    <input
                      type="checkbox"
                      checked={form.isLogForm || false}
                      onChange={(e) =>
                        onUpdateFormMeta({ isLogForm: e.target.checked })
                      }
                      className="rounded border-zinc-700 bg-zinc-900 text-brand-cyan focus:ring-0"
                    />
                    <span className="text-xs text-zinc-300">
                      Continuous Log Form (e.g. AE / ConMeds)
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <LogicRulesTab
              form={form}
              selectedField={null}
              onUpdateRules={onUpdateRules}
            />
          </div>
        )}
      </div>
    </div>
  );
};
