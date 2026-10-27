import { StudyProtocol } from "../types";
import { STANDARD_CODELISTS } from "../internal/cdisc-cdash-library";

/**
 * Pre-Validated Clinical Instruments Study Preset
 * Includes PRO-CTCAE, PHQ-9 Depression, EQ-5D-5L, Cardiology ECG/NYHA with QTc, and Oncology SAE.
 */
export const CLINICAL_INSTRUMENTS_PRESET: StudyProtocol = {
  id: "study_inst_2026",
  protocolNumber: "INST-VAL-007",
  studyName:
    "Multicenter Validation of Digital Patient-Reported Outcomes & Cardiac Safety",
  phase: "Phase II",
  sponsor: "BioMetrics Research Consortium",
  therapeuticArea: "Cross-Therapeutic / Digital Health",
  version: "2.1",
  lastModified: "2026-08-15",
  codelists: [
    ...STANDARD_CODELISTS,
    {
      id: "CL_PHQ9",
      // The standardized results of PHQ-9 items 1 to 9; the labels are the
      // original responses (PHQ0101T09OR, C213939).
      name: "PHQ-9 Items 1 to 9 Standardized Result (PHQ0101T09STR)",
      nciCodelistCode: "C213941",
      isStandard: true,
      options: [
        { code: "0", label: "Not at all (0)", nciCode: "C214831", order: 1 },
        { code: "1", label: "Several days (1)", nciCode: "C214832", order: 2 },
        {
          code: "2",
          label: "More than half the days (2)",
          nciCode: "C214833",
          order: 3,
        },
        {
          code: "3",
          label: "Nearly every day (3)",
          nciCode: "C214834",
          order: 4,
        },
      ],
    },
    {
      id: "CL_EQ5D_MOB",
      name: "EQ-5D-5L Mobility Level",
      isStandard: true,
      options: [
        { code: "1", label: "I have no problems walking about", order: 1 },
        { code: "2", label: "I have slight problems walking about", order: 2 },
        {
          code: "3",
          label: "I have moderate problems walking about",
          order: 3,
        },
        { code: "4", label: "I have severe problems walking about", order: 4 },
        { code: "5", label: "I am unable to walk about", order: 5 },
      ],
    },
    {
      id: "CL_NYHA",
      name: "New York Heart Association Classification (NYHAC)",
      nciCodelistCode: "C101839",
      isStandard: true,
      options: [
        {
          code: "NYHA CLASS I",
          label: "Class I (No limitation of physical activity)",
          nciCode: "C66904",
          order: 1,
        },
        {
          code: "NYHA CLASS II",
          label: "Class II (Slight limitation of physical activity)",
          nciCode: "C66905",
          order: 2,
        },
        {
          code: "NYHA CLASS III",
          label: "Class III (Marked limitation of physical activity)",
          nciCode: "C66907",
          order: 3,
        },
        {
          code: "NYHA CLASS IV",
          label: "Class IV (Unable to carry on any physical activity)",
          nciCode: "C66908",
          order: 4,
        },
      ],
    },
  ],
  forms: [
    // Form 1: Patient Health Questionnaire-9 (PHQ-9)
    {
      id: "form_phq9",
      name: "PHQ-9 Depression Inventory",
      domain: "QS",
      description: "Validated 9-item depression severity screening instrument",
      version: "1.0",
      sections: [
        {
          id: "sec_phq9_items",
          title: "Over the last 2 weeks, how often have you been bothered by:",
          fields: [
            {
              id: "f_phq9_1",
              variableName: "QSEVAL1",
              label: "1. Little interest or pleasure in doing things",
              dataType: "radio",
              columnSpan: 12,
              required: true,
              codelistId: "CL_PHQ9",
            },
            {
              id: "f_phq9_2",
              variableName: "QSEVAL2",
              label: "2. Feeling down, depressed, or hopeless",
              dataType: "radio",
              columnSpan: 12,
              required: true,
              codelistId: "CL_PHQ9",
            },
            {
              id: "f_phq9_3",
              variableName: "QSEVAL3",
              label:
                "3. Trouble falling or staying asleep, or sleeping too much",
              dataType: "radio",
              columnSpan: 12,
              required: true,
              codelistId: "CL_PHQ9",
            },
            {
              id: "f_phq9_4",
              variableName: "QSEVAL4",
              label: "4. Feeling tired or having little energy",
              dataType: "radio",
              columnSpan: 12,
              required: true,
              codelistId: "CL_PHQ9",
            },
            {
              id: "f_phq9_score",
              variableName: "QSSTRESN",
              label: "PHQ-9 Total Score",
              description: "Sum of items 1-4 (0-12 range in subset)",
              dataType: "calculated",
              calculationFormula: "QSEVAL1 + QSEVAL2 + QSEVAL3 + QSEVAL4",
              columnSpan: 6,
              required: false,
              readOnly: true,
            },
          ],
        },
      ],
      rules: [
        {
          id: "rule_phq9_high",
          name: "PHQ-9 Elevated Depression Score Query",
          description: "Raise clinical discrepancy alert when score is >= 8",
          triggerFieldIds: ["f_phq9_score"],
          targetFieldId: "f_phq9_score",
          actionType: "raise_query",
          querySeverity: "warning",
          queryMessage:
            "PHQ-9 Score is elevated (>= 8). Ensure clinician review and safety plan protocol.",
          conditions: [{ fieldId: "f_phq9_score", operator: "gte", value: 8 }],
          logicalOperator: "AND",
        },
      ],
    },

    // Form 2: Cardiology 12-Lead ECG & QTc Derivation
    {
      id: "form_ecg_cardio",
      name: "12-Lead Electrocardiogram & QTc",
      domain: "EG",
      description:
        "Cardiac electrophysiology and rate-corrected QT interval analysis",
      version: "1.0",
      sections: [
        {
          id: "sec_ecg_intervals",
          title: "Interval Measurements & Rate Correction",
          fields: [
            {
              id: "f_eg_dat",
              variableName: "EGDTC",
              label: "ECG Assessment Date & Time",
              dataType: "datetime",
              columnSpan: 6,
              required: true,
            },
            {
              id: "f_eg_hr",
              variableName: "EGHR",
              label: "Ventricular Heart Rate",
              unit: "bpm",
              dataType: "integer",
              columnSpan: 6,
              required: true,
              minValue: 30,
              maxValue: 220,
            },
            {
              id: "f_eg_qt",
              variableName: "EGQT",
              label: "Raw QT Interval",
              unit: "ms",
              dataType: "integer",
              columnSpan: 6,
              required: true,
              minValue: 200,
              maxValue: 800,
            },
            {
              id: "f_eg_rr",
              variableName: "EGRR",
              label: "RR Interval",
              unit: "sec",
              dataType: "number",
              columnSpan: 6,
              required: true,
              minValue: 0.3,
              maxValue: 2.0,
            },
            {
              id: "f_eg_qtcb",
              variableName: "EGQTCB",
              label: "Bazett Corrected QTc (QTcB = QT / sqrt(RR))",
              unit: "ms",
              dataType: "calculated",
              calculationFormula: "round(EGQT / sqrt(EGRR), 0)",
              columnSpan: 6,
              required: false,
              readOnly: true,
            },
            {
              id: "f_eg_nyha",
              variableName: "NYHACLAS",
              label: "NYHA Functional Class",
              dataType: "single_select",
              codelistId: "CL_NYHA",
              columnSpan: 6,
              required: true,
            },
          ],
        },
      ],
      rules: [
        {
          id: "rule_qtc_prolongation",
          name: "QTc Prolongation Critical Alert",
          description:
            "Fire error alert if Bazett QTc exceeds 480ms (ICH E14 safety boundary)",
          triggerFieldIds: ["f_eg_qtcb"],
          targetFieldId: "f_eg_qtcb",
          actionType: "raise_query",
          querySeverity: "error",
          queryMessage:
            "QTcB interval > 480ms (potential torsadogenic risk per ICH E14). Immediate PI notification required.",
          conditions: [{ fieldId: "f_eg_qtcb", operator: "gt", value: 480 }],
          logicalOperator: "AND",
        },
      ],
    },

    // Form 3: Serious Adverse Event (SAE) Expedited Report
    {
      id: "form_sae_expedited",
      name: "Serious Adverse Event (SAE) Expedited Form",
      domain: "AE",
      description: "FDA 21 CFR 312.32 / EMA SUSAR expedited safety report",
      version: "1.0",
      sections: [
        {
          id: "sec_sae_details",
          title: "SAE Criteria & Severity",
          fields: [
            {
              id: "f_sae_term",
              variableName: "AETERM",
              label: "Reported SAE Diagnosis / Medical Event",
              dataType: "text",
              columnSpan: 12,
              required: true,
            },
            {
              id: "f_sae_stdtc",
              variableName: "AESTDTC",
              label: "SAE Onset Date",
              dataType: "date",
              columnSpan: 6,
              required: true,
            },
            {
              id: "f_sae_sev",
              variableName: "AETOXGR",
              label: "CTCAE v5.0 Toxicity Grade",
              dataType: "radio",
              columnSpan: 6,
              required: true,
              codelistId: "CL_AETOXGR",
            },
            {
              id: "f_sae_rel",
              variableName: "AEREL",
              label: "Causality / Relationship to Investigational Product",
              dataType: "radio",
              columnSpan: 6,
              required: true,
              codelistId: "CL_AEREL",
            },
            {
              id: "f_sae_out",
              variableName: "AEOUT",
              label: "Outcome of Event",
              dataType: "single_select",
              columnSpan: 6,
              required: true,
              codelistId: "CL_AEOUT",
            },
          ],
        },
      ],
      rules: [
        {
          id: "rule_sae_grade5",
          name: "Grade 5 Fatal SAE Urgent Notification",
          description: "Alert safety monitor on Grade 5 event",
          triggerFieldIds: ["f_sae_sev"],
          targetFieldId: "f_sae_sev",
          actionType: "raise_query",
          querySeverity: "error",
          queryMessage:
            "Grade 5 (Fatal) event reported. Sponsor 24-hour expedited MedWatch 3500A required.",
          conditions: [{ fieldId: "f_sae_sev", operator: "eq", value: "5" }],
          logicalOperator: "AND",
        },
      ],
    },
  ],
  arms: [
    {
      id: "arm_inst_validation",
      name: "Validation cohort",
      type: "No Intervention",
      description:
        "Every subject completes the electronic instruments and ECGs; no study intervention is given",
      epochIds: ["ep_inst_base", "ep_inst_fup"],
    },
  ],
  epochs: [
    {
      id: "ep_inst_base",
      name: "Screening Epoch",
      sequenceNumber: 1,
      type: "Screening",
      description: "Consent and first completion of each instrument",
    },
    {
      id: "ep_inst_fup",
      name: "Follow-Up Epoch",
      sequenceNumber: 2,
      type: "Follow-up",
      description: "Repeat completion at Week 4",
    },
  ],
  population: {
    description:
      "Adults with depressive symptoms or heart failure who can complete questionnaires on a smartphone or tablet.",
    plannedSex: ["Female", "Male"],
    plannedAgeYears: { min: 18, max: 80 },
  },
  eligibilityCriteria: [
    {
      id: "ec_inst_age",
      category: "Inclusion",
      name: "Age",
      text: "Aged 18 to 80 years at consent.",
    },
    {
      id: "ec_inst_device",
      category: "Inclusion",
      name: "Device use",
      text: "Able to read and complete questionnaires on a smartphone or tablet without help.",
    },
    {
      id: "ec_inst_cognition",
      category: "Exclusion",
      name: "Cognitive impairment",
      text: "Cognitive impairment that prevents completing a questionnaire unaided.",
    },
    {
      id: "ec_inst_pacing",
      category: "Exclusion",
      name: "Ventricular pacing",
      text: "Permanent ventricular pacing, which prevents QT interval measurement.",
    },
  ],
  objectives: [
    {
      id: "obj_inst_reliability",
      level: "Primary",
      name: "Primary objective",
      text: "To assess the test-retest reliability of the electronic PHQ-9.",
      endpoints: [
        {
          id: "ep_inst_icc",
          level: "Primary",
          name: "PHQ-9 test-retest agreement",
          text: "Intraclass correlation of the PHQ-9 total score between screening and Week 4 in subjects whose symptoms are stable.",
          purpose: "Reliability",
        },
      ],
    },
    {
      id: "obj_inst_cardiac",
      level: "Secondary",
      name: "Cardiac safety objective",
      text: "To describe QT interval findings in the validation cohort.",
      endpoints: [
        {
          id: "ep_inst_qtc",
          level: "Secondary",
          name: "QTc above 500 ms",
          text: "Proportion of subjects with a QTcB above 500 ms at any visit.",
          purpose: "Safety",
        },
      ],
    },
  ],
  visits: [
    {
      id: "v_screen_inst",
      oid: "SE.SCREENING",
      name: "Screening & Baseline",
      visitType: "Scheduled",
      targetDay: 0,
      windowBefore: 0,
      windowAfter: 7,
      epochId: "ep_inst_base",
      assignedFormIds: ["form_phq9", "form_ecg_cardio", "form_sae_expedited"],
    },
    {
      id: "v_w4_inst",
      oid: "SE.WEEK4",
      name: "Week 4 Evaluation",
      visitType: "Scheduled",
      targetDay: 28,
      windowBefore: 3,
      windowAfter: 3,
      epochId: "ep_inst_fup",
      assignedFormIds: ["form_phq9", "form_ecg_cardio", "form_sae_expedited"],
    },
  ],
};
