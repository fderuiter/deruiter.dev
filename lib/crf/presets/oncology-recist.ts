import { StudyProtocol } from "../types";
import {
  CDASH_STANDARD_VARIABLES,
  STANDARD_CODELISTS,
  PRESET_ID_STAMP,
  scaffoldCdashDomain,
} from "../internal/cdisc-cdash-library";

/**
 * The CDASH metadata of a vital sign, so a preset concept that stands in for
 * the scaffolded field keeps its aCRF annotation and SDTM test code (#2757).
 */
function vitalSignMetadata(variable: "SYSBP" | "DIABP") {
  return {
    cdashMetadata: CDASH_STANDARD_VARIABLES.VS?.find(
      (meta) => meta.sdtmVariable === variable
    ),
  };
}

export const ONCOLOGY_RECIST_PRESET: StudyProtocol = {
  id: "study_onc_003",
  protocolNumber: "ONC-2026-003",
  studyName:
    "A Randomized, Double-Blind Phase III Study of Dual Immune Checkpoint Inhibition in Advanced Solid Tumors",
  phase: "Phase III",
  sponsor: "Aura Oncology Therapeutics",
  therapeuticArea: "Oncology",
  version: "3.2",
  lastModified: "2026-08-15",
  branding: {
    organizationName: "Aura Oncology Therapeutics",
    primaryColor: "#0284c7",
    accentColor: "#0ea5e9",
    tableHeaderColor: "#0f172a",
    headerText: "CONFIDENTIAL • CLINICAL TRIAL PROTOCOL SPECIFICATION",
    footerText: "Investigator & Data Management Working Copy",
    confidentialityNotice:
      "This document contains confidential information belonging to Aura Oncology Therapeutics. No part may be reproduced or disclosed without prior written authorization.",
    showPageNumbers: true,
    showTableOfContents: true,
  },
  codelists: [...STANDARD_CODELISTS],
  arms: [
    {
      id: "arm_exp",
      name: "Arm A: Pembrolizumab 200mg IV Q3W + Investigational Agent",
      type: "Experimental",
      description: "Active treatment combination arm",
      epochIds: ["ep_scrn", "e_trt", "e_fup"],
    },
    {
      id: "arm_ctrl",
      name: "Arm B: Standard of Care Chemotherapy",
      type: "Active Comparator",
      description: "Investigator's choice standard chemotherapy",
      epochIds: ["ep_scrn", "e_trt", "e_fup"],
    },
  ],
  epochs: [
    {
      id: "ep_scrn",
      name: "Screening Epoch",
      sequenceNumber: 1,
      type: "Screening",
      description: "Informed consent and eligibility evaluation",
    },
    {
      id: "e_trt",
      name: "Treatment Epoch",
      sequenceNumber: 2,
      type: "Treatment",
      description: "Dosing cycles and restaging tumor response assessments",
    },
    {
      id: "e_fup",
      name: "Follow-Up Epoch",
      sequenceNumber: 3,
      type: "Follow-up",
      description: "Safety and survival monitoring",
    },
  ],
  cohorts: [
    {
      id: "cohort_1",
      name: "Intent-to-Treat Cohort",
      description: "All randomized subjects",
      armIds: ["arm_exp", "arm_ctrl"],
      targetSize: 450,
    },
  ],
  population: {
    description:
      "Adults with an advanced or metastatic solid tumour that progressed after at least one prior line of systemic therapy.",
    plannedSex: ["Female", "Male"],
    plannedAgeYears: { min: 18, max: 85 },
  },
  eligibilityCriteria: [
    {
      id: "ec_onc_age",
      category: "Inclusion",
      name: "Age",
      text: "Aged 18 to 85 years at informed consent.",
    },
    {
      id: "ec_onc_tumour",
      category: "Inclusion",
      name: "Advanced solid tumour",
      text: "Histologically confirmed advanced or metastatic solid tumour that progressed on or after at least one prior line of systemic therapy.",
    },
    {
      id: "ec_onc_measurable",
      category: "Inclusion",
      name: "Measurable disease",
      text: "At least one measurable lesion per RECIST 1.1 on imaging within 28 days before randomization.",
    },
    {
      id: "ec_onc_ecog",
      category: "Inclusion",
      name: "Performance status",
      text: "ECOG performance status of 0 or 1.",
    },
    {
      id: "ec_onc_autoimmune",
      category: "Exclusion",
      name: "Autoimmune disease",
      text: "Active autoimmune disease that needed systemic treatment in the past 2 years.",
    },
    {
      id: "ec_onc_cns",
      category: "Exclusion",
      name: "CNS metastases",
      text: "Untreated or symptomatic central nervous system metastases.",
    },
    {
      id: "ec_onc_prior_io",
      category: "Exclusion",
      name: "Prior checkpoint inhibitor",
      text: "Prior treatment with an anti-PD-1, anti-PD-L1 or anti-CTLA-4 antibody.",
    },
  ],
  objectives: [
    {
      id: "obj_onc_primary",
      level: "Primary",
      name: "Primary objective",
      text: "To compare progression-free survival between the checkpoint combination and standard of care chemotherapy.",
      endpoints: [
        {
          id: "ep_onc_pfs",
          level: "Primary",
          name: "Progression-free survival",
          text: "Time from randomization to disease progression per RECIST 1.1 or death from any cause, whichever comes first.",
          purpose: "Efficacy",
        },
      ],
    },
    {
      id: "obj_onc_secondary",
      level: "Secondary",
      name: "Secondary objectives",
      text: "To compare overall survival and objective response, and to describe the safety of each arm.",
      endpoints: [
        {
          id: "ep_onc_os",
          level: "Secondary",
          name: "Overall survival",
          text: "Time from randomization to death from any cause.",
          purpose: "Efficacy",
        },
        {
          id: "ep_onc_orr",
          level: "Secondary",
          name: "Objective response rate",
          text: "Proportion of subjects with a confirmed complete or partial response per RECIST 1.1.",
          purpose: "Efficacy",
        },
        {
          id: "ep_onc_teae",
          level: "Secondary",
          name: "Adverse events",
          text: "Incidence of treatment-emergent adverse events by CTCAE grade.",
          purpose: "Safety",
        },
      ],
    },
  ],
  interventions: [
    {
      id: "int_onc_pembrolizumab",
      name: "Pembrolizumab",
      description: "200 mg intravenous infusion every 3 weeks.",
      role: "Experimental Intervention",
      type: "Biologic",
      armIds: ["arm_exp"],
      administrationFormIds: ["form_ex_onc"],
    },
    {
      id: "int_onc_aur117",
      name: "AUR-117",
      description:
        "Investigational anti-CTLA-4 antibody, 1 mg/kg intravenous infusion every 6 weeks.",
      role: "Experimental Intervention",
      type: "Biologic",
      armIds: ["arm_exp"],
      administrationFormIds: ["form_ex_onc"],
    },
    {
      id: "int_onc_chemo",
      name: "Investigator's choice chemotherapy",
      description:
        "Docetaxel, paclitaxel or pemetrexed at the labelled dose and schedule.",
      role: "Active Comparator",
      type: "Drug",
      armIds: ["arm_ctrl"],
      administrationFormIds: ["form_ex_onc"],
    },
  ],
  biomedicalConcepts: [
    {
      id: "bc_age",
      name: "Age",
      conceptId: "C25150",
      code: "C25150",
      domain: "DM",
      variableName: "AGE",
      dataType: "integer",
      label: "Age at Informed Consent",
      unit: "years",
    },
    {
      id: "bc_sysbp",
      name: "Systolic Blood Pressure",
      conceptId: "C25298",
      code: "C25298",
      domain: "VS",
      variableName: "SYSBP",
      dataType: "integer",
      properties: vitalSignMetadata("SYSBP"),
      label: "Systolic Blood Pressure",
      unit: "mmHg",
    },
    {
      id: "bc_diabp",
      name: "Diastolic Blood Pressure",
      conceptId: "C25299",
      code: "C25299",
      domain: "VS",
      variableName: "DIABP",
      dataType: "integer",
      properties: vitalSignMetadata("DIABP"),
      label: "Diastolic Blood Pressure",
      unit: "mmHg",
    },
  ],
  visits: [
    {
      id: "v_screen",
      oid: "SE.SCRN",
      name: "Screening (Day -28 to -1)",
      visitType: "Scheduled",
      targetDay: -1,
      windowBefore: 27,
      windowAfter: 0,
      epochId: "ep_scrn",
      armIds: ["arm_exp", "arm_ctrl"],
      assignedFormIds: ["form_dm_onc", "form_vs_onc", "form_lb_onc"],
      armFormAssignments: {
        arm_exp: ["form_dm_onc", "form_vs_onc", "form_lb_onc"],
        arm_ctrl: ["form_dm_onc", "form_vs_onc", "form_lb_onc"],
      },
    },
    {
      id: "v_c1d1",
      oid: "SE.C1D1",
      name: "Cycle 1 Day 1 (Baseline)",
      visitType: "Scheduled",
      targetDay: 1,
      windowBefore: 0,
      windowAfter: 2,
      epochId: "e_trt",
      armIds: ["arm_exp", "arm_ctrl"],
      assignedFormIds: [
        "form_vs_onc",
        "form_recist_onc",
        "form_lb_onc",
        "form_ex_onc",
      ],
      armFormAssignments: {
        arm_exp: [
          "form_vs_onc",
          "form_recist_onc",
          "form_lb_onc",
          "form_ex_onc",
        ],
        arm_ctrl: ["form_vs_onc", "form_lb_onc", "form_ex_onc"],
      },
    },
    {
      id: "v_c2d1",
      oid: "SE.C2D1",
      name: "Cycle 2 Day 1",
      visitType: "Scheduled",
      targetDay: 22,
      windowBefore: 3,
      windowAfter: 3,
      epochId: "e_trt",
      armIds: ["arm_exp", "arm_ctrl"],
      assignedFormIds: ["form_vs_onc", "form_lb_onc", "form_ex_onc"],
    },
    {
      id: "v_c3d1",
      oid: "SE.C3D1",
      name: "Cycle 3 Day 1 (Restaging CT/MRI)",
      visitType: "Scheduled",
      targetDay: 43,
      windowBefore: 3,
      windowAfter: 3,
      epochId: "e_trt",
      armIds: ["arm_exp", "arm_ctrl"],
      assignedFormIds: [
        "form_vs_onc",
        "form_recist_onc",
        "form_lb_onc",
        "form_ex_onc",
      ],
      armFormAssignments: {
        arm_exp: [
          "form_vs_onc",
          "form_recist_onc",
          "form_lb_onc",
          "form_ex_onc",
        ],
        arm_ctrl: ["form_vs_onc", "form_lb_onc", "form_ex_onc"],
      },
    },
    {
      id: "v_eos",
      oid: "SE.EOS",
      name: "End of Study / Safety Follow-up",
      visitType: "Scheduled",
      targetDay: 120,
      windowBefore: 7,
      windowAfter: 7,
      epochId: "e_fup",
      armIds: ["arm_exp", "arm_ctrl"],
      assignedFormIds: ["form_vs_onc", "form_lb_onc"],
    },
    {
      id: "v_unsched",
      oid: "SE.UNSCHED",
      name: "Unscheduled Visit",
      visitType: "Unscheduled",
      targetDay: 0,
      windowBefore: 0,
      windowAfter: 0,
      assignedFormIds: ["form_vs_onc", "form_lb_onc"],
    },
  ],
  forms: [
    {
      ...scaffoldCdashDomain("DM", PRESET_ID_STAMP),
      id: "form_dm_onc",
    },
    {
      ...scaffoldCdashDomain("VS", PRESET_ID_STAMP),
      id: "form_vs_onc",
    },
    {
      ...scaffoldCdashDomain("RECIST", PRESET_ID_STAMP),
      id: "form_recist_onc",
    },
    {
      ...scaffoldCdashDomain("AE", PRESET_ID_STAMP),
      id: "form_ae_onc",
    },
    {
      ...scaffoldCdashDomain("CM", PRESET_ID_STAMP),
      id: "form_cm_onc",
    },
    {
      ...scaffoldCdashDomain("LB", PRESET_ID_STAMP),
      id: "form_lb_onc",
    },
    {
      ...scaffoldCdashDomain("EX", PRESET_ID_STAMP),
      id: "form_ex_onc",
    },
  ],
};
