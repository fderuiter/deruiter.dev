import { StudyProtocol } from "../types";
import {
  PRESET_ID_STAMP,
  STANDARD_CODELISTS,
  scaffoldCdashDomain,
} from "../internal/cdisc-cdash-library";

export const EMPTY_STUDY_PRESET: StudyProtocol = {
  id: "study_custom_blank",
  protocolNumber: "CUSTOM-2026-001",
  studyName: "Custom Protocol Canvas",
  phase: "Phase II",
  sponsor: "Clinical Innovators Inc.",
  therapeuticArea: "General Clinical Medicine",
  version: "1.0",
  lastModified: "2026-08-15",
  codelists: [...STANDARD_CODELISTS],
  visits: [
    {
      id: "v_blank_scrn",
      oid: "SE.SCRN",
      name: "Screening",
      visitType: "Scheduled",
      targetDay: -7,
      windowBefore: 7,
      windowAfter: 0,
      assignedFormIds: ["form_dm_blank"],
    },
    {
      id: "v_blank_bl",
      oid: "SE.BL",
      name: "Day 1 Baseline",
      visitType: "Scheduled",
      targetDay: 1,
      windowBefore: 0,
      windowAfter: 1,
      assignedFormIds: ["form_dm_blank"],
    },
  ],
  forms: [
    {
      ...scaffoldCdashDomain("DM", PRESET_ID_STAMP),
      id: "form_dm_blank",
      name: "Demographics Baseline",
    },
  ],
};
