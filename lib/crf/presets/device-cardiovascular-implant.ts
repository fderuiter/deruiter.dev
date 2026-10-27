import { StudyProtocol } from "../types";
import {
  PRESET_ID_STAMP,
  STANDARD_CODELISTS,
  scaffoldCdashDomain,
} from "../internal/cdisc-cdash-library";

export const DEVICE_CARDIOVASCULAR_IMPLANT_PRESET: StudyProtocol = {
  id: "study_dev_valve_001",
  protocolNumber: "DEV-2026-VALVE",
  studyName:
    "Pivotal IDE Clinical Investigation of the Transcatheter Aortic Valve Replacement (TAVR) System in Symptomatic Severe Aortic Stenosis (ISO 14155 / FDA 21 CFR 812)",
  phase: "Phase III",
  sponsor: "Vascular Dynamics MedTech, Inc.",
  therapeuticArea: "Medical Device / Interventional Cardiology",
  version: "2.1",
  lastModified: "2026-08-15",
  branding: {
    organizationName: "Vascular Dynamics MedTech",
    primaryColor: "#06b6d4", // Cyan
    accentColor: "#3b82f6", // Blue
    tableHeaderColor: "#0f172a",
    headerText:
      "ISO 14155 & FDA 21 CFR 812 INVESTIGATIONAL DEVICE EXEMPTION (IDE) PROTOCOL",
    footerText:
      "Investigator & Clinical Research Associate Working Copy • Confidential",
    confidentialityNotice:
      "This document contains proprietary and confidential information of Vascular Dynamics MedTech, Inc. Unauthorized distribution or copying is strictly prohibited.",
    showPageNumbers: true,
    showTableOfContents: true,
  },
  codelists: [...STANDARD_CODELISTS],
  arms: [
    {
      id: "arm_dev_tavr",
      name: "TAVR System",
      type: "Experimental",
      description:
        "Transfemoral implantation of the investigational transcatheter aortic valve",
      epochIds: ["ep_dev_scrn", "ep_dev_proc", "ep_dev_fup"],
    },
  ],
  epochs: [
    {
      id: "ep_dev_scrn",
      name: "Screening Epoch",
      sequenceNumber: 1,
      type: "Screening",
      description: "Heart team evaluation, imaging and eligibility",
    },
    {
      id: "ep_dev_proc",
      name: "Index Procedure Epoch",
      sequenceNumber: 2,
      type: "Treatment",
      description: "Transcatheter implantation of the study valve",
    },
    {
      id: "ep_dev_fup",
      name: "Follow-Up Epoch",
      sequenceNumber: 3,
      type: "Follow-up",
      description: "Discharge, 30-day, 6-month and 1-year assessments",
    },
  ],
  population: {
    description:
      "Adults aged 65 or older with symptomatic severe aortic stenosis whose heart team considers them suitable for transfemoral TAVR.",
    plannedSex: ["Female", "Male"],
    plannedAgeYears: { min: 65, max: 95 },
  },
  eligibilityCriteria: [
    {
      id: "ec_dev_age",
      category: "Inclusion",
      name: "Age",
      text: "Aged 65 to 95 years at consent.",
    },
    {
      id: "ec_dev_stenosis",
      category: "Inclusion",
      name: "Severe aortic stenosis",
      text: "Severe aortic stenosis: aortic valve area of 1.0 cm2 or less, or a mean gradient of 40 mmHg or more, on echocardiography.",
    },
    {
      id: "ec_dev_symptoms",
      category: "Inclusion",
      name: "Symptoms",
      text: "NYHA functional class II or higher.",
    },
    {
      id: "ec_dev_access",
      category: "Inclusion",
      name: "Transfemoral access",
      text: "Iliofemoral anatomy suitable for transfemoral delivery, confirmed by CT angiography.",
    },
    {
      id: "ec_dev_bicuspid",
      category: "Exclusion",
      name: "Bicuspid valve",
      text: "Congenital bicuspid or unicuspid aortic valve.",
    },
    {
      id: "ec_dev_lvef",
      category: "Exclusion",
      name: "Left ventricular function",
      text: "Left ventricular ejection fraction below 20%.",
    },
    {
      id: "ec_dev_stroke",
      category: "Exclusion",
      name: "Recent stroke",
      text: "Stroke or transient ischaemic attack within 6 months before the index procedure.",
    },
  ],
  objectives: [
    {
      id: "obj_dev_safety",
      level: "Primary",
      name: "Primary safety objective",
      text: "To evaluate the early safety of the TAVR System.",
      endpoints: [
        {
          id: "ep_dev_varc",
          level: "Primary",
          name: "VARC-3 early safety composite",
          text: "Composite of all-cause death, stroke, major bleeding, major vascular complication and acute kidney injury stage 3 or 4 at 30 days.",
          purpose: "Safety",
        },
      ],
    },
    {
      id: "obj_dev_performance",
      level: "Secondary",
      name: "Valve performance objective",
      text: "To evaluate the haemodynamic performance of the study valve over one year.",
      endpoints: [
        {
          id: "ep_dev_gradient",
          level: "Secondary",
          name: "Mean gradient and valve area at 1 year",
          text: "Mean transvalvular gradient and effective orifice area on echocardiography at 1 year.",
          purpose: "Efficacy",
        },
      ],
    },
  ],
  interventions: [
    {
      id: "int_dev_tavr",
      name: "Vascular Dynamics TAVR System",
      description:
        "Self-expanding bioprosthetic aortic valve with a transfemoral delivery catheter.",
      role: "Experimental Intervention",
      type: "Device",
      administrationFormIds: ["form_du_dev"],
      procedure: {
        name: "Transcatheter Aortic Valve Implantation",
        code: "C100022",
      },
    },
  ],
  visits: [
    {
      id: "v_dev_screen",
      oid: "SE.SCRN",
      name: "Screening & Baseline Evaluation (Day -30 to -1)",
      visitType: "Scheduled",
      targetDay: -1,
      windowBefore: 29,
      windowAfter: 0,
      epochId: "ep_dev_scrn",
      assignedFormIds: ["form_dm_dev", "form_vs_dev", "form_cm_dev"],
    },
    {
      id: "v_dev_implant",
      oid: "SE.IMPLANT",
      name: "Index Procedure / Implantation (Day 0)",
      visitType: "Scheduled",
      targetDay: 0,
      windowBefore: 0,
      windowAfter: 0,
      epochId: "ep_dev_proc",
      assignedFormIds: ["form_di_dev", "form_du_dev", "form_vs_dev"],
    },
    {
      id: "v_dev_disch",
      oid: "SE.DISCH",
      name: "Pre-Discharge Assessment (Day 1 - 3)",
      visitType: "Scheduled",
      targetDay: 3,
      windowBefore: 2,
      windowAfter: 1,
      epochId: "ep_dev_fup",
      assignedFormIds: ["form_vs_dev", "form_cm_dev"],
    },
    {
      id: "v_dev_30d",
      oid: "SE.30D",
      name: "30-Day Primary Safety Endpoint Visit",
      visitType: "Scheduled",
      targetDay: 30,
      windowBefore: 7,
      windowAfter: 7,
      epochId: "ep_dev_fup",
      assignedFormIds: ["form_vs_dev", "form_cm_dev"],
    },
    {
      id: "v_dev_6m",
      oid: "SE.6M",
      name: "6-Month Hemodynamic Follow-up",
      visitType: "Scheduled",
      targetDay: 180,
      windowBefore: 14,
      windowAfter: 14,
      epochId: "ep_dev_fup",
      assignedFormIds: ["form_vs_dev", "form_cm_dev"],
    },
    {
      id: "v_dev_1y",
      oid: "SE.1Y",
      name: "1-Year Long-Term Follow-up",
      visitType: "Scheduled",
      targetDay: 365,
      windowBefore: 30,
      windowAfter: 30,
      epochId: "ep_dev_fup",
      assignedFormIds: ["form_vs_dev", "form_cm_dev"],
    },
    {
      id: "v_dev_unsched",
      oid: "SE.UNSCHED",
      name: "Unscheduled Event / Repeat Visit",
      visitType: "Unscheduled",
      targetDay: 0,
      windowBefore: 0,
      windowAfter: 0,
      assignedFormIds: ["form_vs_dev", "form_cm_dev"],
    },
  ],
  forms: [
    {
      ...scaffoldCdashDomain("DM", PRESET_ID_STAMP),
      id: "form_dm_dev",
      name: "Subject Demographics & IDE Consent",
    },
    {
      ...scaffoldCdashDomain("DI", PRESET_ID_STAMP),
      id: "form_di_dev",
      name: "Medical Device Identification & UDI Traceability",
    },
    {
      ...scaffoldCdashDomain("DU", PRESET_ID_STAMP),
      id: "form_du_dev",
      name: "Procedural Implantation & Device In-Use",
    },
    {
      ...scaffoldCdashDomain("DE", PRESET_ID_STAMP),
      id: "form_de_dev",
      name: "Device Deficiencies & Adverse Incidents Log",
    },
    {
      ...scaffoldCdashDomain("VS", PRESET_ID_STAMP),
      id: "form_vs_dev",
      name: "Hemodynamics & Vital Signs Assessment",
    },
    {
      ...scaffoldCdashDomain("CM", PRESET_ID_STAMP),
      id: "form_cm_dev",
      name: "Concomitant Antiplatelet / Anticoagulant Therapy",
    },
    {
      ...scaffoldCdashDomain("AE", PRESET_ID_STAMP),
      id: "form_ae_dev",
      name: "Adverse Events & Serious Complications Log",
    },
  ],
};
