"use client";

import { standardCitation } from "@/lib/clinical-standards";
import React from "react";
import { CRFField, CRFForm, CdashVariableMetadata } from "@/lib/crf/types";
import { CDASH_STANDARD_VARIABLES } from "@/lib/crf";
import { IconDatabase, IconSparkles } from "@tabler/icons-react";

interface CdiscMetadataTabProps {
  field: CRFField;
  form: CRFForm;
  onUpdateField: (updates: Partial<CRFField>) => void;
}

export const CdiscMetadataTab: React.FC<CdiscMetadataTabProps> = ({
  field,
  form,
  onUpdateField,
}) => {
  const cdashMeta = field.cdashMetadata || {
    domain: form.domain || "CRF",
    sdtmVariable: field.variableName,
    cdashLabel: field.label,
    core: "HR",
    acrfAnnotation: `${form.domain || "CRF"}.${field.variableName}`,
  };

  const domainStandards = CDASH_STANDARD_VARIABLES[form.domain] || [];

  const handleUpdateCdash = (updates: Partial<CdashVariableMetadata>) => {
    onUpdateField({
      cdashMetadata: {
        ...cdashMeta,
        ...updates,
      },
    });
  };

  const handleAutoMapStandard = (std: CdashVariableMetadata) => {
    onUpdateField({
      variableName: std.sdtmVariable,
      label: std.cdashLabel,
      cdashMetadata: std,
    });
  };

  return (
    <div className="space-y-4 p-4 text-xs font-sans">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase text-zinc-400 font-semibold flex items-center gap-1.5">
          <IconDatabase className="w-3.5 h-3.5 text-brand-cyan" />
          {standardCitation("CDASHIG")} / SDTM Mapping
        </span>
        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-brand-cyan">
          Domain: {form.domain}
        </span>
      </div>

      {/* Suggested CDASH Standards for this domain */}
      {domainStandards.length > 0 && (
        <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
          <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
            <IconSparkles className="w-3.5 h-3.5 text-brand-cyan" />
            <span>Match CDASH Standard Variable:</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {domainStandards.map((std) => (
              <button
                key={std.sdtmVariable}
                onClick={() => handleAutoMapStandard(std)}
                className="px-2 py-1 rounded bg-zinc-900 hover:bg-brand-cyan/20 border border-zinc-800 text-[10px] font-mono text-zinc-300 hover:text-brand-cyan transition-colors"
                title={`${std.cdashLabel} (${std.core})`}
              >
                {std.sdtmVariable}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SDTM Domain & Variable */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-mono text-zinc-400 mb-1">
            SDTM Target Domain
          </label>
          <input
            type="text"
            value={cdashMeta.domain}
            onChange={(e) =>
              handleUpdateCdash({ domain: e.target.value.toUpperCase() })
            }
            className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono uppercase focus:border-brand-cyan focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono text-zinc-400 mb-1">
            SDTM Variable
          </label>
          <input
            type="text"
            value={cdashMeta.sdtmVariable}
            onChange={(e) =>
              handleUpdateCdash({ sdtmVariable: e.target.value.toUpperCase() })
            }
            className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono uppercase focus:border-brand-cyan focus:outline-none"
          />
        </div>
      </div>

      {/* CDASH Core Level & NCI Concept */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-mono text-zinc-400 mb-1">
            CDASH Core Requirement
          </label>
          <select
            value={cdashMeta.core}
            onChange={(e) =>
              handleUpdateCdash({
                core: e.target.value as CdashVariableMetadata["core"],
              })
            }
            className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono focus:border-brand-cyan focus:outline-none"
          >
            <option value="R">R - Required</option>
            <option value="HR">HR - Highly Recommended</option>
            <option value="O">O - Optional</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono text-zinc-400 mb-1">
            NCI Concept ID
          </label>
          <input
            type="text"
            value={cdashMeta.nciConceptId || ""}
            onChange={(e) =>
              handleUpdateCdash({ nciConceptId: e.target.value })
            }
            className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white font-mono focus:border-brand-cyan focus:outline-none"
            placeholder="e.g. C49487"
          />
        </div>
      </div>

      {/* Annotated CRF (aCRF) Submission Label */}
      <div>
        <label className="block text-[11px] font-mono text-zinc-400 mb-1">
          Annotated CRF (aCRF) Text Overlay{" "}
          <span className="text-brand-cyan">*</span>
        </label>
        <input
          type="text"
          value={cdashMeta.acrfAnnotation}
          onChange={(e) =>
            handleUpdateCdash({ acrfAnnotation: e.target.value })
          }
          className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-brand-cyan font-mono text-xs focus:border-brand-cyan focus:outline-none"
          placeholder="e.g. AE.AESTDTC or VS.VSSTRESN [VSTESTCD=HEIGHT]"
        />
        <p className="text-[10px] text-zinc-500 mt-1 font-sans">
          This string renders directly on the visual Annotated CRF overlay for
          regulatory submission (FDA/PMDA).
        </p>
      </div>
    </div>
  );
};
