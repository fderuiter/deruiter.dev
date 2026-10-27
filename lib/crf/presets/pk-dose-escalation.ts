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
  visits: [
    {
      id: "v_pk_scrn",
      oid: "SE.SCRN",
      name: "Screening Period",
      visitType: "Scheduled",
      targetDay: -7,
      windowBefore: 7,
      windowAfter: 0,
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
