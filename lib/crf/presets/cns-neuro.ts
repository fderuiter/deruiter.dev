import { StudyProtocol, CRFForm } from "../types";
import {
  STANDARD_CODELISTS,
  scaffoldCdashDomain,
} from "../cdisc-cdash-library";

const MMSE_FORM: CRFForm = {
  id: "form_mmse_cns",
  name: "Mini-Mental State Examination (MMSE)",
  domain: "QS",
  description:
    "30-point standardized cognitive assessment questionnaire for cognitive impairment screening",
  version: "1.0",
  rules: [
    {
      id: "rule_mmse_total",
      name: "MMSE Total Score Calculation",
      description:
        "Sum of Orientation, Registration, Attention, Recall, and Language sub-scores",
      triggerFieldIds: [
        "f_mmse_orient",
        "f_mmse_reg",
        "f_mmse_att",
        "f_mmse_rec",
        "f_mmse_lang",
      ],
      actionType: "set_value",
      targetFieldId: "f_mmse_total",
      conditions: [{ fieldId: "f_mmse_orient", operator: "gte", value: 0 }],
      logicalOperator: "AND",
      formulaExpression:
        "f_mmse_orient + f_mmse_reg + f_mmse_att + f_mmse_rec + f_mmse_lang",
    },
    {
      id: "rule_mmse_impairment",
      name: "Severe Cognitive Impairment Alert",
      description: "Alert investigator if MMSE Total Score < 18",
      triggerFieldIds: ["f_mmse_total"],
      actionType: "raise_query",
      targetFieldId: "f_mmse_total",
      conditions: [{ fieldId: "f_mmse_total", operator: "lt", value: 18 }],
      logicalOperator: "AND",
      querySeverity: "warning",
      queryMessage:
        "MMSE Total Score < 18 indicates moderate-to-severe impairment. Expedited neurologist review recommended.",
    },
  ],
  sections: [
    {
      id: "sec_mmse_scores",
      title: "Cognitive Domain Subscores",
      fields: [
        {
          id: "f_mmse_orient",
          variableName: "QS_ORNT",
          label: "Orientation to Time & Place (0 - 10 points)",
          dataType: "integer",
          columnSpan: 6,
          required: true,
          minValue: 0,
          maxValue: 10,
        },
        {
          id: "f_mmse_reg",
          variableName: "QS_REG",
          label: "Immediate Registration (0 - 3 points)",
          dataType: "integer",
          columnSpan: 6,
          required: true,
          minValue: 0,
          maxValue: 3,
        },
        {
          id: "f_mmse_att",
          variableName: "QS_ATTN",
          label: "Attention & Calculation - Serial 7s (0 - 5 points)",
          dataType: "integer",
          columnSpan: 6,
          required: true,
          minValue: 0,
          maxValue: 5,
        },
        {
          id: "f_mmse_rec",
          variableName: "QS_REC",
          label: "Delayed Recall of 3 Objects (0 - 3 points)",
          dataType: "integer",
          columnSpan: 6,
          required: true,
          minValue: 0,
          maxValue: 3,
        },
        {
          id: "f_mmse_lang",
          variableName: "QS_LANG",
          label: "Language & Visual Construction (0 - 9 points)",
          dataType: "integer",
          columnSpan: 6,
          required: true,
          minValue: 0,
          maxValue: 9,
        },
        {
          id: "f_mmse_total",
          variableName: "QS_TOTAL",
          label: "Total MMSE Score (Max 30)",
          dataType: "calculated",
          columnSpan: 6,
          required: false,
          readOnly: true,
          unit: "Points",
          calculationFormula:
            "f_mmse_orient + f_mmse_reg + f_mmse_att + f_mmse_rec + f_mmse_lang",
        },
      ],
    },
  ],
};

export const CNS_NEURO_PRESET: StudyProtocol = {
  id: "study_cns_002",
  protocolNumber: "NEURO-2026-401",
  studyName:
    "Phase II Placebo-Controlled Study of Anti-Amyloid Monoclonal Antibody in Early Alzheimer's Disease",
  phase: "Phase II",
  sponsor: "Cortex Biosystems",
  therapeuticArea: "Neurology",
  version: "2.1",
  lastModified: "2026-08-15",
  branding: {
    organizationName: "Cortex Biosystems",
    primaryColor: "#1e3a8a",
    accentColor: "#2563eb",
    tableHeaderColor: "#172554",
    headerText: "CONFIDENTIAL • ALZHEIMER'S CLINICAL TRIAL PROTOCOL",
    footerText: "Cortex Biosystems Clinical Research & Development",
    confidentialityNotice:
      "Proprietary Clinical Research Material. Unauthorized duplication or distribution is strictly prohibited.",
    showPageNumbers: true,
    showTableOfContents: true,
  },
  codelists: [...STANDARD_CODELISTS],
  visits: [
    {
      id: "v_cns_scrn",
      oid: "SE.SCRN",
      name: "Screening Visit",
      visitType: "Scheduled",
      targetDay: -14,
      windowBefore: 14,
      windowAfter: 0,
      assignedFormIds: ["form_dm_cns", "form_vs_cns", "form_mmse_cns"],
    },
    {
      id: "v_cns_bl",
      oid: "SE.BASELINE",
      name: "Baseline Day 1",
      visitType: "Scheduled",
      targetDay: 1,
      windowBefore: 0,
      windowAfter: 2,
      assignedFormIds: ["form_vs_cns", "form_mmse_cns"],
    },
    {
      id: "v_cns_m3",
      oid: "SE.MONTH3",
      name: "Month 3 Evaluation",
      visitType: "Scheduled",
      targetDay: 90,
      windowBefore: 7,
      windowAfter: 7,
      assignedFormIds: ["form_vs_cns", "form_mmse_cns"],
    },
    {
      id: "v_cns_m6",
      oid: "SE.MONTH6",
      name: "Month 6 Primary Endpoint",
      visitType: "Scheduled",
      targetDay: 180,
      windowBefore: 7,
      windowAfter: 7,
      assignedFormIds: ["form_vs_cns", "form_mmse_cns"],
    },
  ],
  forms: [
    {
      ...scaffoldCdashDomain("DM"),
      id: "form_dm_cns",
    },
    {
      ...scaffoldCdashDomain("VS"),
      id: "form_vs_cns",
    },
    MMSE_FORM,
    {
      ...scaffoldCdashDomain("AE"),
      id: "form_ae_cns",
    },
    {
      ...scaffoldCdashDomain("CM"),
      id: "form_cm_cns",
    },
  ],
};
