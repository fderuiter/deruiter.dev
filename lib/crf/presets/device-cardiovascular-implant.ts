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
  visits: [
    {
      id: "v_dev_screen",
      oid: "SE.SCRN",
      name: "Screening & Baseline Evaluation (Day -30 to -1)",
      visitType: "Scheduled",
      targetDay: -1,
      windowBefore: 29,
      windowAfter: 0,
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
