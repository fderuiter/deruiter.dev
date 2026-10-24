"use client";

import { standardCitation } from "@/lib/study-data/standards";
import React, { useState } from "react";
import { IconDatabase, IconPlus, IconX, IconCheck } from "@tabler/icons-react";
import { scaffoldCdashDomain } from "@/lib/crf/cdisc-cdash-library";
import { CRFForm } from "@/lib/crf/types";
import { ModalContainer } from "@/components/ui/ModalContainer";

interface CdashScaffolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInjectForm: (form: CRFForm) => void;
}

type DomainCategory = "all" | "device" | "drug" | "core";

interface DomainItem {
  code:
    | "DM"
    | "VS"
    | "AE"
    | "CM"
    | "LB"
    | "RECIST"
    | "DI"
    | "DU"
    | "DE"
    | "DA"
    | "EX"
    | "MH"
    | "DS";
  name: string;
  category: "device" | "drug" | "core";
  categoryLabel: string;
  description: string;
  badge: string;
}

const AVAILABLE_DOMAINS: DomainItem[] = [
  // Medical Device Domains
  {
    code: "DI",
    name: "Medical Device Identifiers & UDI (DI)",
    category: "device",
    categoryLabel: "Medical Device / ISO 14155",
    description:
      "UDI barcode, model, catalog number, serial/lot number, firmware version, and device lifecycle tracking.",
    badge: "ISO 14155 / 21 CFR 812",
  },
  {
    code: "DU",
    name: "Device Implantation & In-Use (DU)",
    category: "device",
    categoryLabel: "Medical Device / ISO 14155",
    description:
      "Anatomical access site, surgical intervention, fluoroscopy duration, and acute deployment outcome.",
    badge: "Procedural In-Use",
  },
  {
    code: "DE",
    name: "Device Deficiencies & Incidents (DE)",
    category: "device",
    categoryLabel: "Medical Device / Safety",
    description:
      "Continuous log for device malfunctions, user errors, inadequate labeling, and serious health deterioration.",
    badge: "Deficiency Log",
  },

  // Drug & Biologics Domains
  {
    code: "DA",
    name: "Drug Accountability & Dispensation (DA)",
    category: "drug",
    categoryLabel: "Drug / Clinical Pharmacy",
    description:
      "Kit numbering, units dispensed vs returned, and automated % subject compliance derivations.",
    badge: "Pharmacy Reconciliation",
  },
  {
    code: "EX",
    name: "Study Treatment Exposure & Infusion (EX)",
    category: "drug",
    categoryLabel: "Drug / Interventions",
    description:
      "Investigational Product (IP) dosage, formulation, route, administration timing, and dose interruptions.",
    badge: "IP Exposure",
  },
  {
    code: "MH",
    name: "General Medical History (MH)",
    category: "drug",
    categoryLabel: "Subject Baseline",
    description:
      "Baseline disease conditions, prior surgical history, and comorbidities organized by body system.",
    badge: `${standardCitation("CDASHIG")} Core`,
  },
  {
    code: "DS",
    name: "Subject Disposition & Milestones (DS)",
    category: "drug",
    categoryLabel: "Protocol Milestones",
    description:
      "Study completion, primary discontinuation reasons, and protocol milestone tracking.",
    badge: "Milestones",
  },

  // Safety & Core Domains
  {
    code: "DM",
    name: "Demographics & Consent (DM)",
    category: "core",
    categoryLabel: "Special Purpose / Subject Baseline",
    description:
      "Informed consent date tracking, year of birth, age, sex, race, ethnicity with standard NCI codelists.",
    badge: `${standardCitation("CDASHIG")} Core`,
  },
  {
    code: "VS",
    name: "Vital Signs & Physical Metrics (VS)",
    category: "core",
    categoryLabel: "Findings / Safety",
    description:
      "Blood pressure, pulse, temperature, height, weight, and automated AST Body Mass Index (BMI) derivation.",
    badge: "Auto-Calculated",
  },
  {
    code: "AE",
    name: "Adverse Events Log (AE)",
    category: "core",
    categoryLabel: "Events / Safety",
    description:
      "Continuous log for CTCAE v5.0 severity grading, seriousness (SAE), causality, action taken, and outcome.",
    badge: "Part 11 Log",
  },
  {
    code: "CM",
    name: "Prior & Concomitant Medications (CM)",
    category: "core",
    categoryLabel: "Interventions",
    description:
      "Medication name, indication, dose, units, route of administration, and start/stop/ongoing dates.",
    badge: standardCitation("CDASHIG"),
  },
  {
    code: "LB",
    name: "Laboratory Chemistry & Hematology (LB)",
    category: "core",
    categoryLabel: "Findings",
    description:
      "Comprehensive serum panel (ALT, AST, Bilirubin, Creatinine, Platelets, ANC) with fasting status.",
    badge: "Clinical Safety",
  },
  {
    code: "RECIST",
    name: "Oncology RECIST 1.1 Tumor Response (TR)",
    category: "core",
    categoryLabel: "Specialized / Oncology",
    description:
      "Target & non-target lesion tracking with automated sum of longest diameters (SLD) and percent change from baseline.",
    badge: "Oncology Gold Standard",
  },
];

export const CdashScaffolderModal: React.FC<CdashScaffolderModalProps> = ({
  isOpen,
  onClose,
  onInjectForm,
}) => {
  const [selectedCategory, setSelectedCategory] =
    useState<DomainCategory>("all");

  if (!isOpen) return null;

  const filteredDomains =
    selectedCategory === "all"
      ? AVAILABLE_DOMAINS
      : AVAILABLE_DOMAINS.filter((d) => d.category === selectedCategory);

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-3xl"
      className="bg-zinc-900 border-zinc-700/80 animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Modal Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan">
            <IconDatabase className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-mono">
              1-Click CDASH Domain Scaffolder
            </h3>
            <p className="text-xs text-zinc-400 font-sans">
              Instantly inject pre-configured standard forms modelled on CDISC
              {standardCitation("CDASHIG")} for Medical Device, Pharma &amp;
              Oncology
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <IconX className="w-5 h-5" />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex border-b border-zinc-800 bg-zinc-950/40 px-6 pt-2 gap-2">
        {[
          { key: "all", label: `All Domains (${AVAILABLE_DOMAINS.length})` },
          { key: "device", label: "Medical Device (ISO 14155)" },
          { key: "drug", label: "Drug & Biologics" },
          { key: "core", label: "Safety & Core CDASH" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedCategory(tab.key as DomainCategory)}
            className={`px-3 py-2 text-xs font-mono transition-colors border-b-2 rounded-t-md ${
              selectedCategory === tab.key
                ? "border-brand-cyan text-brand-cyan font-bold bg-zinc-900/80"
                : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Modal Body */}
      <div className="p-6 overflow-y-auto space-y-3 flex-1">
        {filteredDomains.map((domain) => (
          <div
            key={domain.code}
            className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-brand-cyan/50 hover:bg-zinc-900/60 transition-all flex items-start justify-between gap-4 group"
          >
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-bold text-white font-mono">
                  {domain.name}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20">
                  {domain.badge}
                </span>
              </div>
              <div className="text-xs text-zinc-400 font-sans leading-relaxed">
                {domain.description}
              </div>
              <div className="text-[11px] text-zinc-500 font-mono">
                Category: {domain.categoryLabel}
              </div>
            </div>

            <button
              onClick={() => {
                const newForm = scaffoldCdashDomain(domain.code);
                onInjectForm(newForm);
                onClose();
              }}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-cyan/20 hover:bg-brand-cyan text-brand-cyan hover:text-black font-mono text-xs font-bold rounded-lg border border-brand-cyan/40 transition-all mt-1"
            >
              <IconPlus className="w-4 h-4" />
              <span>Inject Form</span>
            </button>
          </div>
        ))}
      </div>

      {/* Modal Footer */}
      <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between text-xs font-mono text-zinc-400">
        <span className="flex items-center gap-1.5 text-emerald-400">
          <IconCheck className="w-4 h-4" /> All schemas include NCI C-Codes,
          SDTM metadata &amp; Part 11-style signature fields (simulation)
        </span>
        <button
          onClick={onClose}
          className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    </ModalContainer>
  );
};
