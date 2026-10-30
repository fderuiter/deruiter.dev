import type { ArcadeTrophy } from "./types";

/** Clinical Trial Chaos trophies. */
export const CLINICAL_CHAOS_TROPHIES: ArcadeTrophy[] = [
  {
    id: "clinical_auditor_pass",
    gameId: "clinical-chaos",
    title: "Clean FDA Audit",
    subtitle: "Clinical Trial Chaos",
    description: "Sort SDTM domain tables and pass audit inspection.",
    icon: "ClipboardCheck",
    category: "gameplay",
    targetScore: 500,
    conditionDescription: "Reach 500+ points in Clinical Trial Chaos",
  },
  {
    id: "clinical_cdisc_pro",
    gameId: "clinical-chaos",
    title: "CDISC Champion",
    subtitle: "Clinical Trial Chaos",
    description:
      "Maintain maximum throughput under extreme regulatory pressure.",
    icon: "Trophy",
    category: "mastery",
    targetScore: 2000,
    conditionDescription: "Reach 2,000+ points in Clinical Trial Chaos",
  },
  {
    id: "clinical_nai_campaign",
    gameId: "clinical-chaos",
    title: "No Action Indicated",
    subtitle: "Clinical Trial Chaos",
    description: "Finish the Phase 3 campaign with an NAI inspection verdict.",
    icon: "ShieldCheck",
    category: "mastery",
    milestone: "nai_campaign",
    conditionDescription:
      "Earn an NAI verdict on Phase 3 in Clinical Trial Chaos",
  },
  {
    id: "clinical_clean_inspection",
    gameId: "clinical-chaos",
    title: "Nothing to Hide",
    subtitle: "Clinical Trial Chaos",
    description:
      "Answer every question in the campaign-finale FDA inspection from your own audit trail, and disclose every sponsor shortcut.",
    icon: "ClipboardCheck",
    category: "mastery",
    milestone: "clean_inspection",
    conditionDescription:
      "Pass the Phase 3 FDA inspection interview without a wrong answer in Clinical Trial Chaos",
  },
];
