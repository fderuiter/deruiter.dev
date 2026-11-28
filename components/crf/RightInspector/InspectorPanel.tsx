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
  computeFormHealthMetrics,
  generateCliCommandForField,
  generateCliCommandForForm,
} from "@/lib/crf";
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
import { useClipboard } from "@/hooks/useClipboard";
import { TooltipButton } from "@/components/ui/Tooltip";

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
  const { copy: copyCli, copied: hasCopiedCli } = useClipboard({
    successMessage: "CLI command copied to clipboard",
    errorMessage: "Failed to copy CLI command",
  });
  const allFields = form.sections.flatMap((s) => s.fields);
  const healthMetrics = computeFormHealthMetrics(form);
  const openReviewThreadCount = reviewThreads.filter(
    (thread) => StudyProtocolEngine.getReviewThreadStatus(thread) === "open"
  ).length;

  const handleCopyCli = async () => {
    const cmd = selectedField
      ? generateCliCommandForField(form.domain, selectedField)
      : generateCliCommandForForm(form);

    await copyCli(cmd);
  };

  return (
    <div className="flex flex-col h-full studio-surface-sidebar border-l studio-border-default">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b studio-border-default studio-surface-subtle">
        <div className="flex items-center gap-2 min-w-0">
          <span className="p-1 rounded studio-accent-cyan border">
            {selectedField ? (
              <IconAdjustments className="w-4 h-4" />
            ) : (
              <IconFileSpreadsheet className="w-4 h-4" />
            )}
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-bold studio-fg-primary font-mono truncate">
              {selectedField ? selectedField.variableName : form.name}
            </h3>
            <p className="text-[10px] studio-fg-muted font-mono">
              {selectedField
                ? "Field Property Inspector"
                : "Form-Level Settings"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedField && onDuplicateField && (
            <TooltipButton
              onClick={() => onDuplicateField(selectedField.id)}
              className="p-1.5 rounded text-xs font-mono transition-all flex items-center gap-1 border studio-surface-card studio-fg-muted studio-hover-fg-primary studio-border-default studio-hover-surface"
              tooltip="Duplicate Field"
              aria-label="Duplicate Field"
            >
              <IconCopy className="w-3.5 h-3.5 studio-fg-cyan" />
              <span className="text-[10px] hidden sm:inline">Duplicate</span>
            </TooltipButton>
          )}

          {!selectedField && onDuplicateForm && (
            <TooltipButton
              onClick={() => onDuplicateForm(form.id)}
              className="p-1.5 rounded text-xs font-mono transition-all flex items-center gap-1 border studio-surface-card studio-fg-muted studio-hover-fg-primary studio-border-default studio-hover-surface"
              tooltip="Duplicate Form"
              aria-label="Duplicate Form"
            >
              <IconCopy className="w-3.5 h-3.5 studio-fg-cyan" />
              <span className="text-[10px] hidden sm:inline">Duplicate</span>
            </TooltipButton>
          )}

          <TooltipButton
            onClick={handleCopyCli}
            className={`p-1.5 rounded text-xs font-mono transition-all flex items-center gap-1 border ${
              hasCopiedCli
                ? "studio-accent-emerald-strong"
                : "studio-surface-card studio-fg-muted studio-hover-fg-primary studio-border-default studio-hover-surface"
            }`}
            tooltip="Copy exact CLI command for this element"
            aria-label="Copy exact CLI command for this element"
          >
            {hasCopiedCli ? (
              <IconCheck className="w-3.5 h-3.5 studio-fg-emerald" />
            ) : (
              <IconTerminal2 className="w-3.5 h-3.5 studio-fg-cyan" />
            )}
            <span className="text-[10px] hidden sm:inline">
              {hasCopiedCli ? "Copied" : "CLI"}
            </span>
          </TooltipButton>

          <TooltipButton
            onClick={onClose}
            className="p-1 studio-fg-muted studio-hover-fg-primary rounded studio-hover-surface transition-colors"
            tooltip="Deselect"
            aria-label="Deselect"
          >
            <IconX className="w-4 h-4" />
          </TooltipButton>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b studio-border-default studio-surface-subtle">
        <button
          onClick={() => setActiveTab("properties")}
          className={`flex-1 min-w-0 px-1 py-2 text-center text-xs font-mono whitespace-nowrap transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === "properties"
              ? "studio-border-cyan studio-fg-cyan font-bold studio-surface-subtle"
              : "border-transparent studio-fg-muted studio-hover-fg-primary"
          }`}
        >
          <span>Properties</span>
        </button>

        <button
          onClick={() => setActiveTab("logic")}
          className={`flex-1 min-w-0 px-1 py-2 text-center text-xs font-mono whitespace-nowrap transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === "logic"
              ? "studio-border-cyan studio-fg-cyan font-bold studio-surface-subtle"
              : "border-transparent studio-fg-muted studio-hover-fg-primary"
          }`}
        >
          <span>Edit Checks</span>
        </button>

        <button
          onClick={() => setActiveTab("cdash")}
          className={`flex-1 min-w-0 px-1 py-2 text-center text-xs font-mono whitespace-nowrap transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === "cdash"
              ? "studio-border-cyan studio-fg-cyan font-bold studio-surface-subtle"
              : "border-transparent studio-fg-muted studio-hover-fg-primary"
          }`}
        >
          <span>CDASH / aCRF</span>
        </button>
        <button
          onClick={() => setActiveTab("review")}
          aria-label={`Review, ${openReviewThreadCount} open threads in study`}
          className={`flex-1 min-w-0 px-1 py-2 text-center text-xs font-mono whitespace-nowrap transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === "review"
              ? "studio-border-amber studio-fg-amber font-bold studio-surface-subtle"
              : "border-transparent studio-fg-muted studio-hover-fg-primary"
          }`}
        >
          <span>Review</span>{" "}
          <span className="rounded studio-surface-muted px-1 text-[9px]">
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
                key={selectedField.id}
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
            <div className="p-4 rounded-2xl studio-surface-subtle border studio-border-default space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full studio-dot-emerald" />
                  <span className="text-xs font-bold studio-fg-primary font-mono uppercase tracking-wider">
                    Form Conformance &amp; Telemetry
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded studio-accent-cyan border font-bold">
                  CDASH {healthMetrics.cdashConformancePercentage}%
                </span>
              </div>

              {/* 4-Metric Grid */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-xl studio-surface-subtle border studio-border-default">
                  <div className="text-[10px] font-mono studio-fg-muted uppercase">
                    Total Fields
                  </div>
                  <div className="text-sm font-mono font-extrabold studio-fg-primary mt-0.5">
                    {healthMetrics.totalFields}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl studio-surface-subtle border studio-border-default">
                  <div className="text-[10px] font-mono studio-fg-muted uppercase">
                    Mandatory
                  </div>
                  <div className="text-sm font-mono font-extrabold studio-fg-amber mt-0.5">
                    {healthMetrics.mandatoryFields}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl studio-surface-subtle border studio-border-default">
                  <div className="text-[10px] font-mono studio-fg-muted uppercase">
                    Codelists
                  </div>
                  <div className="text-sm font-mono font-extrabold studio-fg-purple mt-0.5">
                    {healthMetrics.codelistsAttached}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl studio-surface-subtle border studio-border-default">
                  <div className="text-[10px] font-mono studio-fg-muted uppercase">
                    SDV Verified
                  </div>
                  <div className="text-sm font-mono font-extrabold studio-fg-emerald mt-0.5">
                    {healthMetrics.sdvVerifiedCount} /{" "}
                    {healthMetrics.totalFields} (
                    {healthMetrics.sdvReadinessPercentage}%)
                  </div>
                </div>
              </div>

              {/* Form Metadata Settings */}
              <div className="space-y-2.5 pt-2 border-t studio-border-default">
                <div>
                  <label
                    htmlFor="crf-inspector-form-name"
                    className="block text-[10px] font-mono studio-fg-muted mb-1"
                  >
                    Form Name
                  </label>
                  <input
                    id="crf-inspector-form-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => onUpdateFormMeta({ name: e.target.value })}
                    className="w-full px-2.5 py-1.5 studio-surface-subtle border studio-border-default rounded-lg text-xs studio-fg-primary studio-focus-input focus:outline-none font-sans"
                  />
                </div>
                <div>
                  <label
                    htmlFor="crf-inspector-form-domain"
                    className="block text-[10px] font-mono studio-fg-muted mb-1"
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
                    className="w-full px-2.5 py-1.5 studio-surface-subtle border studio-border-default rounded-lg text-xs studio-fg-cyan font-mono uppercase studio-focus-input focus:outline-none"
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
                      className="rounded studio-border-strong studio-surface-card studio-fg-cyan focus:ring-0"
                    />
                    <span className="text-xs studio-fg-secondary">
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
