import { StudyProtocol, CRFForm } from "../types";
import {
  PRESET_ID_STAMP,
  STANDARD_CODELISTS,
  scaffoldCdashDomain,
} from "../internal/cdisc-cdash-library";

const PK_SAMPLING_FORM: CRFForm = {
  id: "form_pk_esc",
  name: "Pharmacokinetic (PK) Blood Sampling Log",
  domain: "PC",
  description:
    "Serial plasma sampling timepoints for non-compartmental PK analysis (Cmax, Tmax, AUC0-inf)",
  version: "1.0",
  rules: [],
  sections: [
    {
      id: "sec_pk_dosing",
      title: "Investigational Product Administration",
      fields: [
        {
          id: "f_pk_dose_mg",
          variableName: "EXDOSE",
          label: "Administered Cohort Dose Level",
          dataType: "number",
          columnSpan: 4,
          required: true,
          unit: "mg",
          placeholder: "e.g. 50.0",
        },
        {
          id: "f_pk_dose_time",
          variableName: "EXSTDTC",
          label: "Exact Time of Dose Infusion Start",
          dataType: "datetime",
          columnSpan: 4,
          required: true,
        },
        {
          id: "f_pk_fed_fast",
          variableName: "EXFAST",
          label: "Fasting State",
          dataType: "radio",
          columnSpan: 4,
          required: true,
          customOptions: [
            { code: "FASTED", label: "Fasted (>= 10 hrs)", order: 1 },
            { code: "FED", label: "Fed (High-fat breakfast)", order: 2 },
          ],
        },
      ],
    },
    {
      id: "sec_pk_timepoints",
      title: "Serial Blood Draws (Nominal vs Actual Time)",
      fields: [
        {
          id: "f_pk_pre",
          variableName: "PCTIME00",
          label: "Pre-Dose (0h) Draw Time",
          dataType: "time",
          columnSpan: 4,
          required: true,
        },
        {
          id: "f_pk_05h",
          variableName: "PCTIME05",
          label: "30 Min (0.5h) Post-Dose Draw Time",
          dataType: "time",
          columnSpan: 4,
          required: true,
        },
        {
          id: "f_pk_1h",
          variableName: "PCTIME_1",
          label: "1.0 Hour Post-Dose Draw Time",
          dataType: "time",
          columnSpan: 4,
          required: true,
        },
        {
          id: "f_pk_2h",
          variableName: "PCTIME_2",
          label: "2.0 Hours Post-Dose Draw Time",
          dataType: "time",
          columnSpan: 4,
          required: true,
        },
        {
          id: "f_pk_4h",
          variableName: "PCTIME_4",
          label: "4.0 Hours Post-Dose Draw Time",
          dataType: "time",
          columnSpan: 4,
          required: true,
        },
        {
          id: "f_pk_8h",
          variableName: "PCTIME_8",
          label: "8.0 Hours Post-Dose Draw Time",
          dataType: "time",
          columnSpan: 4,
          required: true,
        },
        {
          id: "f_pk_24h",
          variableName: "PCTIME24",
          label: "24.0 Hours (Day 2) Post-Dose Draw Time",
          dataType: "time",
          columnSpan: 6,
          required: true,
        },
        {
          id: "f_pk_dlt",
          variableName: "DLTYN",
          label:
            "Did patient experience any Dose-Limiting Toxicity (DLT) in Cycle 1?",
          dataType: "radio",
          columnSpan: 6,
          required: true,
          codelistId: "CL_NY",
        },
      ],
    },
  ],
};

export const PK_ESCALATION_PRESET: StudyProtocol = {
  id: "study_pk_001",
  protocolNumber: "PK-2026-101",
  studyName:
    "Phase I First-in-Human Single Ascending Dose & Multiple Ascending Dose Study with Intensive PK/PD",
  phase: "Phase I",
  sponsor: "Precision BioPharma",
  therapeuticArea: "Early Development",
  version: "1.3",
  lastModified: "2026-08-15",
  codelists: [...STANDARD_CODELISTS],
  arms: [
    {
      id: "arm_pk_escalation",
      name: "PB-101 ascending doses",
      type: "Experimental",
      description:
        "Sequential cohorts of single, then multiple, ascending oral doses of PB-101",
      epochIds: ["ep_pk_scrn", "ep_pk_trt", "ep_pk_fup"],
    },
  ],
  epochs: [
    {
      id: "ep_pk_scrn",
      name: "Screening Epoch",
      sequenceNumber: 1,
      type: "Screening",
      description: "Health screening of volunteers",
    },
    {
      id: "ep_pk_trt",
      name: "Treatment Epoch",
      sequenceNumber: 2,
      type: "Treatment",
      description: "Inpatient dosing with intensive PK sampling",
    },
    {
      id: "ep_pk_fup",
      name: "Follow-Up Epoch",
      sequenceNumber: 3,
      type: "Follow-up",
      description: "Ambulatory safety follow-up",
    },
  ],
  population: {
    description: "Healthy adult volunteers.",
    plannedSex: ["Female", "Male"],
    plannedAgeYears: { min: 18, max: 55 },
    includesHealthySubjects: true,
  },
  eligibilityCriteria: [
    {
      id: "ec_pk_age",
      category: "Inclusion",
      name: "Age",
      text: "Healthy adults aged 18 to 55 years at screening.",
    },
    {
      id: "ec_pk_bmi",
      category: "Inclusion",
      name: "Body mass index",
      text: "Body mass index of 18.0 to 30.0 kg/m2.",
    },
    {
      id: "ec_pk_ecg",
      category: "Exclusion",
      name: "ECG abnormality",
      text: "QTcF above 450 ms, or any clinically significant ECG abnormality, at screening.",
    },
    {
      id: "ec_pk_meds",
      category: "Exclusion",
      name: "Concomitant medication",
      text: "Any prescription or over-the-counter medication within 14 days before the first dose.",
    },
  ],
  objectives: [
    {
      id: "obj_pk_safety",
      level: "Primary",
      name: "Primary objective",
      text: "To evaluate the safety and tolerability of single and multiple ascending oral doses of PB-101.",
      endpoints: [
        {
          id: "ep_pk_dlt",
          level: "Primary",
          name: "Dose-limiting toxicities",
          text: "Incidence of dose-limiting toxicities in each dose cohort.",
          purpose: "Safety",
        },
      ],
    },
    {
      id: "obj_pk_exposure",
      level: "Secondary",
      name: "Pharmacokinetic objective",
      text: "To characterise the pharmacokinetics of PB-101.",
      endpoints: [
        {
          id: "ep_pk_cmax_auc",
          level: "Secondary",
          name: "Cmax and AUC",
          text: "Maximum plasma concentration and area under the concentration-time curve of PB-101 after a single dose.",
          purpose: "Pharmacokinetic",
        },
      ],
    },
  ],
  interventions: [
    {
      id: "int_pk_pb101",
      name: "PB-101",
      description: "Investigational oral small molecule, given fasted.",
      role: "Experimental Intervention",
      type: "Drug",
      administrationFormIds: ["form_pk_esc"],
    },
  ],
  visits: [
    {
      id: "v_pk_scrn",
      oid: "SE.SCRN",
      name: "Screening Period",
      visitType: "Scheduled",
      targetDay: -7,
      windowBefore: 7,
      windowAfter: 0,
      epochId: "ep_pk_scrn",
      assignedFormIds: ["form_dm_pk", "form_vs_pk"],
    },
    {
      id: "v_pk_inpatient",
      oid: "SE.INPATIENT",
      name: "Inpatient PK Day 1-2",
      visitType: "Scheduled",
      targetDay: 1,
      windowBefore: 0,
      windowAfter: 0,
      epochId: "ep_pk_trt",
      assignedFormIds: ["form_vs_pk", "form_pk_esc"],
    },
    {
      id: "v_pk_day8",
      oid: "SE.DAY8",
      name: "Day 8 Ambulatory Follow-up",
      visitType: "Scheduled",
      targetDay: 8,
      windowBefore: 1,
      windowAfter: 1,
      epochId: "ep_pk_fup",
      assignedFormIds: ["form_vs_pk"],
    },
  ],
  forms: [
    {
      ...scaffoldCdashDomain("DM", PRESET_ID_STAMP),
      id: "form_dm_pk",
    },
    {
      ...scaffoldCdashDomain("VS", PRESET_ID_STAMP),
      id: "form_vs_pk",
    },
    PK_SAMPLING_FORM,
    {
      ...scaffoldCdashDomain("AE", PRESET_ID_STAMP),
      id: "form_ae_pk",
    },
  ],
};
