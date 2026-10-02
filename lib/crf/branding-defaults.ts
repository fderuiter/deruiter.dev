import { StudyBranding, StudyProtocol } from "./types";

export interface BrandingPalettePreset {
  id: string;
  name: string;
  description: string;
  branding: StudyBranding;
}

export const DEFAULT_STUDY_BRANDING: StudyBranding = {
  organizationName: "Aura Oncology Therapeutics",
  primaryColor: "#0284c7", // Sky blue clinical standard
  accentColor: "#0ea5e9",
  tableHeaderColor: "#0f172a",
  headerText: "CONFIDENTIAL • CLINICAL TRIAL PROTOCOL SPECIFICATION",
  footerText: "Investigator & Data Management Working Copy",
  confidentialityNotice:
    "This document contains confidential information belonging to the Sponsor. No part may be reproduced, transmitted, or disclosed without prior written authorization.",
  watermarkText: "",
  showPageNumbers: true,
  showTableOfContents: true,
};

export const BRANDING_PRESETS: BrandingPalettePreset[] = [
  {
    id: "biotech_cyan",
    name: "Biotech Cyan",
    description:
      "Modern, high-contrast cyan & slate theme ideal for digital-first platforms and oncology trials.",
    branding: {
      organizationName: "Aura Oncology Therapeutics",
      primaryColor: "#06b6d4",
      accentColor: "#0284c7",
      tableHeaderColor: "#0f172a",
      headerText: "CONFIDENTIAL • CLINICAL TRIAL PROTOCOL SPECIFICATION",
      footerText: "Investigator & Data Management Working Copy",
      confidentialityNotice:
        "Strictly confidential clinical research documentation.",
      showPageNumbers: true,
      showTableOfContents: true,
    },
  },
  {
    id: "clinical_navy",
    name: "Clinical Navy",
    description:
      "Traditional pharmaceutical deep navy and cobalt theme suitable for regulatory FDA/EMA submissions.",
    branding: {
      organizationName: "Global Pharma Research",
      primaryColor: "#1e3a8a",
      accentColor: "#2563eb",
      tableHeaderColor: "#172554",
      headerText: "REGULATORY COMPLIANT CASE REPORT FORM BOOK",
      footerText: "Sponsor Approved Clinical Documentation",
      confidentialityNotice:
        "Proprietary and Confidential. For authorized clinical investigator and regulatory authority use only.",
      showPageNumbers: true,
      showTableOfContents: true,
    },
  },
  {
    id: "pharma_crimson",
    name: "Pharma Crimson",
    description:
      "Bold crimson and burgundy design for emergency, oncology, and accelerated safety monitoring protocols.",
    branding: {
      organizationName: "Vanguard Therapeutics Corp",
      primaryColor: "#be123c",
      accentColor: "#e11d48",
      tableHeaderColor: "#881337",
      headerText: "CONFIDENTIAL • CLINICAL INVESTIGATION PLAN",
      footerText: "Institutional Review Board (IRB) Copy",
      confidentialityNotice:
        "Contains proprietary clinical investigation data. Unauthorized sharing is prohibited.",
      showPageNumbers: true,
      showTableOfContents: true,
    },
  },
  {
    id: "emerald_health",
    name: "Emerald Health",
    description:
      "Clean medical emerald & forest green styling for public health, vaccines, and wellness registries.",
    branding: {
      organizationName: "BioNexus Research Institute",
      primaryColor: "#047857",
      accentColor: "#059669",
      tableHeaderColor: "#064e3b",
      headerText: "CLINICAL STUDY SPECIFICATION & DATA DICTIONARY",
      footerText:
        "Clinical Data Interchange Standards Consortium (CDISC) Compliant",
      confidentialityNotice:
        "Confidential clinical data acquisition instrument.",
      showPageNumbers: true,
      showTableOfContents: true,
    },
  },
  {
    id: "minimal_slate",
    name: "Minimal Slate",
    description:
      "Monochrome, high-legibility minimalist layout optimized for high-volume laser printing at clinical trial sites.",
    branding: {
      organizationName: "Academic Medical Center",
      primaryColor: "#334155",
      accentColor: "#475569",
      tableHeaderColor: "#0f172a",
      headerText: "SOURCE DATA RECORD & CASE REPORT FORM",
      footerText: "Site Investigator Master File Copy",
      confidentialityNotice:
        "For Clinical Site Use Only. Retain in Site Master File.",
      showPageNumbers: true,
      showTableOfContents: true,
    },
  },
];

/**
 * Resolves active branding for a given study, falling back to embedded study sponsor or default preset.
 */
export function getStudyBranding(
  study?: Partial<StudyProtocol> | null
): StudyBranding {
  if (study?.branding) {
    return {
      ...DEFAULT_STUDY_BRANDING,
      ...study.branding,
      organizationName:
        study.branding.organizationName ||
        study.sponsor ||
        DEFAULT_STUDY_BRANDING.organizationName,
    };
  }

  return {
    ...DEFAULT_STUDY_BRANDING,
    organizationName: study?.sponsor || DEFAULT_STUDY_BRANDING.organizationName,
  };
}
