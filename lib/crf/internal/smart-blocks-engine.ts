/**
 * Clinical Smart Blocks Engine
 * Provides standardized CDASH-modelled compound section bundles and atomic field templates
 * for in-canvas slash command palettes (`/vitals`, `/recist`, `/conmeds`, `/ae`, etc.).
 */

import {
  CRFSection,
  CRFField,
  EditCheckRule,
  ClinicalDataType,
  AstCondition,
} from "../types";
import { generateEngineId, generateCdashVariableName } from "./precision-date";
import { cloneDeep } from "../../utils";

export type SlashCommandCategory = "smart_block" | "widget" | "layout";

export interface ClinicalSmartBlockDefinition {
  id: string;
  title: string;
  description: string;
  category: SlashCommandCategory;
  iconName: string;
  cdashDomain: string;
  command: string;
  keywords: string[];
  variableCount: number;
  hasRules: boolean;
  factory: () => { section: CRFSection; rules: EditCheckRule[] };
}

export interface SlashCommandItem {
  id: string;
  title: string;
  description: string;
  category: SlashCommandCategory;
  command: string;
  keywords: string[];
  badge?: string;
  action: "insert_smart_block" | "insert_field" | "insert_section";
  smartBlockId?: string;
  fieldTemplate?: Partial<CRFField>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compound Clinical Smart Blocks
// ─────────────────────────────────────────────────────────────────────────────

export const CLINICAL_SMART_BLOCKS: ClinicalSmartBlockDefinition[] = [
  {
    id: "vitals",
    title: "Vital Signs & Anthropometrics",
    description:
      "Standard 7-field panel (BP, Pulse, Temp, Weight, Height) with automated BMI formula and BP validation.",
    category: "smart_block",
    iconName: "IconHeartRateMonitor",
    cdashDomain: "VS",
    command: "/vitals",
    keywords: [
      "vitals",
      "blood pressure",
      "pulse",
      "temperature",
      "weight",
      "height",
      "bmi",
      "vs",
    ],
    variableCount: 7,
    hasRules: true,
    factory: () => {
      const now = Date.now();
      const secId = `sec_vs_${now}`;
      const fields: CRFField[] = [
        {
          id: `f_sysbp_${now}`,
          variableName: "SYSBP",
          label: "Systolic Blood Pressure",
          dataType: "integer",
          unit: "mmHg",
          required: true,
          minValue: 60,
          maxValue: 250,
          columnSpan: 6,
          cdashMetadata: {
            domain: "VS",
            sdtmVariable: "SYSBP",
            cdashLabel: "Systolic Blood Pressure",
            core: "HR",
            acrfAnnotation: "VS.VSSTRESN [VSTESTCD=SYSBP]",
          },
        },
        {
          id: `f_diabp_${now}`,
          variableName: "DIABP",
          label: "Diastolic Blood Pressure",
          dataType: "integer",
          unit: "mmHg",
          required: true,
          minValue: 30,
          maxValue: 150,
          columnSpan: 6,
          cdashMetadata: {
            domain: "VS",
            sdtmVariable: "DIABP",
            cdashLabel: "Diastolic Blood Pressure",
            core: "HR",
            acrfAnnotation: "VS.VSSTRESN [VSTESTCD=DIABP]",
          },
        },
        {
          id: `f_pulse_${now}`,
          variableName: "PULSE",
          label: "Heart Rate / Pulse",
          dataType: "integer",
          unit: "beats/min",
          required: true,
          minValue: 30,
          maxValue: 220,
          columnSpan: 6,
          cdashMetadata: {
            domain: "VS",
            sdtmVariable: "PULSE",
            cdashLabel: "Heart Rate / Pulse",
            core: "HR",
            acrfAnnotation: "VS.VSSTRESN [VSTESTCD=PULSE]",
          },
        },
        {
          id: `f_temp_${now}`,
          variableName: "TEMP",
          label: "Body Temperature",
          dataType: "number",
          unit: "°C",
          required: true,
          minValue: 34.0,
          maxValue: 43.0,
          columnSpan: 6,
          cdashMetadata: {
            domain: "VS",
            sdtmVariable: "TEMP",
            cdashLabel: "Body Temperature",
            core: "O",
            acrfAnnotation: "VS.VSSTRESN [VSTESTCD=TEMP]",
          },
        },
        {
          id: `f_weight_${now}`,
          variableName: "WEIGHT",
          label: "Body Weight",
          dataType: "number",
          unit: "kg",
          required: true,
          minValue: 2.0,
          maxValue: 350.0,
          columnSpan: 6,
          cdashMetadata: {
            domain: "VS",
            sdtmVariable: "WEIGHT",
            cdashLabel: "Body Weight",
            core: "HR",
            acrfAnnotation: "VS.VSSTRESN [VSTESTCD=WEIGHT]",
          },
        },
        {
          id: `f_height_${now}`,
          variableName: "HEIGHT",
          label: "Standing Height",
          dataType: "number",
          unit: "cm",
          required: true,
          minValue: 30.0,
          maxValue: 250.0,
          columnSpan: 6,
          cdashMetadata: {
            domain: "VS",
            sdtmVariable: "HEIGHT",
            cdashLabel: "Standing Height",
            core: "HR",
            acrfAnnotation: "VS.VSSTRESN [VSTESTCD=HEIGHT]",
          },
        },
        {
          id: `f_bmi_${now}`,
          variableName: "BMI",
          label: "Body Mass Index (Calculated)",
          dataType: "calculated",
          unit: "kg/m²",
          calculationFormula: "WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100))",
          readOnly: true,
          required: false,
          columnSpan: 12,
          cdashMetadata: {
            domain: "VS",
            sdtmVariable: "BMI",
            cdashLabel: "Body Mass Index",
            core: "O",
            acrfAnnotation: "VS.VSSTRESN [VSTESTCD=BMI]",
          },
        },
      ];

      const conditions: AstCondition[] = [
        {
          fieldId: `f_sysbp_${now}`,
          operator: "lte",
          value: "",
          compareFieldId: `f_diabp_${now}`,
        },
      ];

      const rules: EditCheckRule[] = [
        {
          id: `rule_sys_dia_${now}`,
          name: "Systolic Must Exceed Diastolic Blood Pressure",
          description:
            "Flags discrepancy if systolic BP is less than or equal to diastolic BP.",
          querySeverity: "error",
          triggerFieldIds: [`f_sysbp_${now}`, `f_diabp_${now}`],
          targetFieldId: `f_sysbp_${now}`,
          actionType: "raise_query",
          queryMessage:
            "Systolic Blood Pressure must exceed Diastolic Blood Pressure.",
          conditions,
          logicalOperator: "AND",
        },
      ];

      return {
        section: {
          id: secId,
          title: "Vital Signs & Anthropometrics",
          fields,
        },
        rules,
      };
    },
  },
  {
    id: "recist",
    title: "Oncology RECIST 1.1 Tumor Assessment",
    description:
      "Target lesion tracking with anatomical site, modality, longest diameter, and sum of diameters.",
    category: "smart_block",
    iconName: "IconTarget",
    cdashDomain: "TR",
    command: "/recist",
    keywords: [
      "recist",
      "tumor",
      "oncology",
      "lesion",
      "sld",
      "tr",
      "response",
    ],
    variableCount: 6,
    hasRules: true,
    factory: () => {
      const now = Date.now();
      const secId = `sec_recist_${now}`;
      const fields: CRFField[] = [
        {
          id: `f_trlinkid_${now}`,
          variableName: "TRLINKID",
          label: "Target Lesion ID / Code",
          dataType: "text",
          required: true,
          columnSpan: 4,
          cdashMetadata: {
            domain: "TR",
            sdtmVariable: "TRLINKID",
            cdashLabel: "Target Lesion Identifier",
            core: "HR",
            acrfAnnotation: "TR.TRLINKID",
          },
        },
        {
          id: `f_trloc_${now}`,
          variableName: "TRLOC",
          label: "Lesion Anatomical Location",
          dataType: "single_select",
          required: true,
          columnSpan: 4,
          customOptions: [
            { code: "LUNG", label: "Lung", order: 1 },
            { code: "LIVER", label: "Liver", order: 2 },
            { code: "LYMPH_NODE", label: "Lymph Node", order: 3 },
            { code: "BONE", label: "Bone", order: 4 },
            { code: "BRAIN", label: "Brain", order: 5 },
            { code: "SOFT_TISSUE", label: "Soft Tissue", order: 6 },
          ],
          cdashMetadata: {
            domain: "TR",
            sdtmVariable: "TRLOC",
            cdashLabel: "Lesion Anatomical Location",
            core: "HR",
            acrfAnnotation: "TR.TRLOC",
          },
        },
        {
          id: `f_trmeth_${now}`,
          variableName: "TRMETHOD",
          label: "Imaging Modality / Assessment Method",
          dataType: "single_select",
          required: true,
          columnSpan: 4,
          customOptions: [
            { code: "CT_CONTRAST", label: "CT with IV Contrast", order: 1 },
            { code: "MRI", label: "MRI", order: 2 },
            { code: "PET_CT", label: "PET-CT", order: 3 },
            { code: "XRAY", label: "Chest X-Ray", order: 4 },
            { code: "PHYSICAL_EXAM", label: "Physical Examination", order: 5 },
          ],
          cdashMetadata: {
            domain: "TR",
            sdtmVariable: "TRMETHOD",
            cdashLabel: "Method of Measurement",
            core: "HR",
            acrfAnnotation: "TR.TRMETHOD",
          },
        },
        {
          id: `f_trldiam_${now}`,
          variableName: "TRLDIAM",
          label: "Longest Diameter",
          dataType: "number",
          unit: "mm",
          required: true,
          minValue: 0.0,
          maxValue: 300.0,
          columnSpan: 6,
          cdashMetadata: {
            domain: "TR",
            sdtmVariable: "TRORRES",
            cdashLabel: "Longest Diameter",
            core: "HR",
            acrfAnnotation: "TR.TRORRES [TRTESTCD=LDIAM]",
          },
        },
        {
          id: `f_trsld_${now}`,
          variableName: "TRSLD",
          label: "Sum of Longest Diameters (SLD)",
          dataType: "calculated",
          unit: "mm",
          calculationFormula: "TRLDIAM",
          readOnly: true,
          required: false,
          columnSpan: 6,
          cdashMetadata: {
            domain: "TR",
            sdtmVariable: "TRSTRESN",
            cdashLabel: "Sum of Diameters",
            core: "O",
            acrfAnnotation: "TR.TRSTRESN [TRTESTCD=SLD]",
          },
        },
        {
          id: `f_trresp_${now}`,
          variableName: "TRRESP",
          label: "Target Lesion Response Evaluation",
          dataType: "single_select",
          required: true,
          columnSpan: 12,
          customOptions: [
            { code: "CR", label: "Complete Response (CR)", order: 1 },
            { code: "PR", label: "Partial Response (PR)", order: 2 },
            { code: "SD", label: "Stable Disease (SD)", order: 3 },
            { code: "PD", label: "Progressive Disease (PD)", order: 4 },
            { code: "NE", label: "Not Evaluable (NE)", order: 5 },
          ],
          cdashMetadata: {
            domain: "TR",
            sdtmVariable: "TRRESP",
            cdashLabel: "Lesion Response Evaluation",
            core: "HR",
            acrfAnnotation: "TR.TRRESP",
          },
        },
      ];

      const rules: EditCheckRule[] = [
        {
          id: `rule_recist_min_size_${now}`,
          name: "RECIST 1.1 Target Lesion Measurability Check",
          description:
            "Flags notice if target lesion longest diameter is under 10 mm on cross-sectional imaging.",
          querySeverity: "warning",
          triggerFieldIds: [`f_trldiam_${now}`],
          targetFieldId: [`f_trldiam_${now}`][0],
          actionType: "raise_query",
          queryMessage:
            "Target measurable lesions should measure >= 10 mm on CT/MRI per RECIST 1.1 criteria.",
          conditions: [
            { fieldId: `f_trldiam_${now}`, operator: "lt", value: 10 },
          ],
          logicalOperator: "AND",
        },
      ];

      return {
        section: {
          id: secId,
          title: "Oncology RECIST 1.1 Tumor Assessment",
          fields,
        },
        rules,
      };
    },
  },
  {
    id: "conmeds",
    title: "Concomitant Medications Log",
    description:
      "Repeating medication section with reported term, indication, dose/unit, route, start/stop dates, and ongoing status.",
    category: "smart_block",
    iconName: "IconPill",
    cdashDomain: "CM",
    command: "/conmeds",
    keywords: ["conmeds", "medications", "drugs", "cm", "concomitant", "prior"],
    variableCount: 8,
    hasRules: true,
    factory: () => {
      const now = Date.now();
      const secId = `sec_cm_${now}`;
      const fields: CRFField[] = [
        {
          id: `f_cmtrt_${now}`,
          variableName: "CMTRT",
          label: "Reported Medication Name",
          dataType: "text",
          required: true,
          columnSpan: 6,
          cdashMetadata: {
            domain: "CM",
            sdtmVariable: "CMTRT",
            cdashLabel: "Reported Medication Name",
            core: "HR",
            acrfAnnotation: "CM.CMTRT",
          },
        },
        {
          id: `f_cmindc_${now}`,
          variableName: "CMINDC",
          label: "Clinical Indication / Reason for Treatment",
          dataType: "text",
          required: true,
          columnSpan: 6,
          cdashMetadata: {
            domain: "CM",
            sdtmVariable: "CMINDC",
            cdashLabel: "Indication",
            core: "HR",
            acrfAnnotation: "CM.CMINDC",
          },
        },
        {
          id: `f_cmdose_${now}`,
          variableName: "CMDOSE",
          label: "Dose per Administration",
          dataType: "number",
          required: true,
          columnSpan: 4,
          cdashMetadata: {
            domain: "CM",
            sdtmVariable: "CMDOSE",
            cdashLabel: "Dose per Administration",
            core: "HR",
            acrfAnnotation: "CM.CMDOSE",
          },
        },
        {
          id: `f_cmdosu_${now}`,
          variableName: "CMDOSU",
          label: "Dose Unit",
          dataType: "single_select",
          required: true,
          columnSpan: 4,
          customOptions: [
            { code: "mg", label: "mg", order: 1 },
            { code: "mcg", label: "mcg", order: 2 },
            { code: "g", label: "g", order: 3 },
            { code: "mL", label: "mL", order: 4 },
            { code: "IU", label: "IU", order: 5 },
            { code: "drops", label: "drops", order: 6 },
            { code: "puffs", label: "puffs", order: 7 },
          ],
          cdashMetadata: {
            domain: "CM",
            sdtmVariable: "CMDOSU",
            cdashLabel: "Dose Units",
            core: "HR",
            acrfAnnotation: "CM.CMDOSU",
          },
        },
        {
          id: `f_cmroute_${now}`,
          variableName: "CMROUTE",
          label: "Route of Administration",
          dataType: "single_select",
          required: true,
          columnSpan: 4,
          customOptions: [
            { code: "ORAL", label: "Oral (PO)", order: 1 },
            { code: "IV", label: "Intravenous (IV)", order: 2 },
            { code: "SC", label: "Subcutaneous (SC)", order: 3 },
            { code: "IM", label: "Intramuscular (IM)", order: 4 },
            { code: "TOPICAL", label: "Topical", order: 5 },
            { code: "INHALATION", label: "Inhalation", order: 6 },
          ],
          cdashMetadata: {
            domain: "CM",
            sdtmVariable: "CMROUTE",
            cdashLabel: "Route of Administration",
            core: "HR",
            acrfAnnotation: "CM.CMROUTE",
          },
        },
        {
          id: `f_cmstdtc_${now}`,
          variableName: "CMSTDTC",
          label: "Medication Start Date",
          dataType: "date",
          required: true,
          columnSpan: 6,
          cdashMetadata: {
            domain: "CM",
            sdtmVariable: "CMSTDTC",
            cdashLabel: "Start Date/Time",
            core: "HR",
            acrfAnnotation: "CM.CMSTDTC",
          },
        },
        {
          id: `f_cmendtc_${now}`,
          variableName: "CMENDTC",
          label: "Medication Stop Date",
          dataType: "date",
          required: false,
          columnSpan: 6,
          cdashMetadata: {
            domain: "CM",
            sdtmVariable: "CMENDTC",
            cdashLabel: "End Date/Time",
            core: "O",
            acrfAnnotation: "CM.CMENDTC",
          },
        },
        {
          id: `f_cmongo_${now}`,
          variableName: "CMONGO",
          label: "Medication Ongoing at End of Study?",
          dataType: "radio",
          required: true,
          columnSpan: 12,
          customOptions: [
            { code: "Y", label: "Yes", order: 1 },
            { code: "N", label: "No", order: 2 },
          ],
          cdashMetadata: {
            domain: "CM",
            sdtmVariable: "CMONGO",
            cdashLabel: "Ongoing",
            core: "HR",
            acrfAnnotation: "CM.CMONGO",
          },
        },
      ];

      const rules: EditCheckRule[] = [
        {
          id: `rule_cm_stop_req_${now}`,
          name: "Stop Date Mandatory if Medication Not Ongoing",
          description: "Requires CMENDTC when CMONGO is answered 'No'.",
          querySeverity: "error",
          triggerFieldIds: [`f_cmongo_${now}`, `f_cmendtc_${now}`],
          targetFieldId: `f_cmendtc_${now}`,
          actionType: "raise_query",
          queryMessage:
            "Stop Date is required when medication is marked as not ongoing.",
          conditions: [
            { fieldId: `f_cmongo_${now}`, operator: "eq", value: "N" },
            { fieldId: `f_cmendtc_${now}`, operator: "is_empty", value: true },
          ],
          logicalOperator: "AND",
        },
      ];

      return {
        section: {
          id: secId,
          title: "Concomitant & Prior Medications Log",
          fields,
        },
        rules,
      };
    },
  },
  {
    id: "ae",
    title: "Adverse Events & Safety Log",
    description:
      "Safety reporting block with CTCAE severity, SAE seriousness criteria, causality, outcome, and date tracking.",
    category: "smart_block",
    iconName: "IconAlertTriangle",
    cdashDomain: "AE",
    command: "/ae",
    keywords: ["ae", "adverse", "events", "safety", "sae", "ctcae", "toxicity"],
    variableCount: 6,
    hasRules: true,
    factory: () => {
      const now = Date.now();
      const secId = `sec_ae_${now}`;
      const fields: CRFField[] = [
        {
          id: `f_aeterm_${now}`,
          variableName: "AETERM",
          label: "Reported Adverse Event Term",
          dataType: "text",
          required: true,
          columnSpan: 6,
          cdashMetadata: {
            domain: "AE",
            sdtmVariable: "AETERM",
            cdashLabel: "Reported Term for the Adverse Event",
            core: "HR",
            acrfAnnotation: "AE.AETERM",
          },
        },
        {
          id: `f_aesev_${now}`,
          variableName: "AESEV",
          label: "CTCAE v5.0 Severity Grade",
          dataType: "single_select",
          required: true,
          columnSpan: 6,
          customOptions: [
            { code: "1", label: "Grade 1 - Mild", order: 1 },
            { code: "2", label: "Grade 2 - Moderate", order: 2 },
            { code: "3", label: "Grade 3 - Severe", order: 3 },
            { code: "4", label: "Grade 4 - Life-Threatening", order: 4 },
            { code: "5", label: "Grade 5 - Death", order: 5 },
          ],
          cdashMetadata: {
            domain: "AE",
            sdtmVariable: "AESEV",
            cdashLabel: "Severity / Intensity",
            core: "HR",
            acrfAnnotation: "AE.AESEV",
          },
        },
        {
          id: `f_aeser_${now}`,
          variableName: "AESER",
          label: "Serious Adverse Event (SAE)?",
          dataType: "radio",
          required: true,
          columnSpan: 4,
          customOptions: [
            { code: "N", label: "No", order: 1 },
            { code: "Y", label: "Yes", order: 2 },
          ],
          cdashMetadata: {
            domain: "AE",
            sdtmVariable: "AESER",
            cdashLabel: "Serious Event",
            core: "HR",
            acrfAnnotation: "AE.AESER",
          },
        },
        {
          id: `f_aerel_${now}`,
          variableName: "AEREL",
          label: "Causality / Relatedness to Investigational Product",
          dataType: "single_select",
          required: true,
          columnSpan: 4,
          customOptions: [
            { code: "NOT_RELATED", label: "Not Related", order: 1 },
            { code: "UNLIKELY", label: "Unlikely Related", order: 2 },
            { code: "POSSIBLY", label: "Possibly Related", order: 3 },
            { code: "PROBABLY", label: "Probably Related", order: 4 },
            { code: "DEFINITELY", label: "Definitely Related", order: 5 },
          ],
          cdashMetadata: {
            domain: "AE",
            sdtmVariable: "AEREL",
            cdashLabel: "Causality",
            core: "HR",
            acrfAnnotation: "AE.AEREL",
          },
        },
        {
          id: `f_aeout_${now}`,
          variableName: "AEOUT",
          label: "Outcome of Event",
          dataType: "single_select",
          required: true,
          columnSpan: 4,
          customOptions: [
            { code: "RESOLVED", label: "Recovered / Resolved", order: 1 },
            { code: "RESOLVING", label: "Recovering / Resolving", order: 2 },
            {
              code: "NOT_RESOLVED",
              label: "Not Recovered / Not Resolved",
              order: 3,
            },
            { code: "SEQUELAE", label: "Recovered with Sequelae", order: 4 },
            { code: "FATAL", label: "Fatal", order: 5 },
            { code: "UNKNOWN", label: "Unknown", order: 6 },
          ],
          cdashMetadata: {
            domain: "AE",
            sdtmVariable: "AEOUT",
            cdashLabel: "Outcome",
            core: "HR",
            acrfAnnotation: "AE.AEOUT",
          },
        },
        {
          id: `f_aestdtc_${now}`,
          variableName: "AESTDTC",
          label: "Adverse Event Start Date",
          dataType: "date",
          required: true,
          columnSpan: 6,
          cdashMetadata: {
            domain: "AE",
            sdtmVariable: "AESTDTC",
            cdashLabel: "Start Date/Time",
            core: "HR",
            acrfAnnotation: "AE.AESTDTC",
          },
        },
      ];

      const rules: EditCheckRule[] = [
        {
          id: `rule_ae_sae_severity_${now}`,
          name: "Serious AE CTCAE Grade Check",
          description:
            "Notice when Serious AE is graded as Grade 1-2 mild/moderate.",
          querySeverity: "warning",
          triggerFieldIds: [`f_aeser_${now}`, `f_aesev_${now}`],
          targetFieldId: `f_aesev_${now}`,
          actionType: "raise_query",
          queryMessage:
            "Event is marked Serious (SAE) with CTCAE Grade 1-2 severity. Please verify SAE criteria.",
          conditions: [
            { fieldId: `f_aeser_${now}`, operator: "eq", value: "Y" },
            { fieldId: `f_aesev_${now}`, operator: "in", value: ["1", "2"] },
          ],
          logicalOperator: "AND",
        },
      ];

      return {
        section: {
          id: secId,
          title: "Adverse Events & Safety Log",
          fields,
        },
        rules,
      };
    },
  },
  {
    id: "demographics",
    title: "Subject Demographics & Consent",
    description:
      "Informed consent verification, birth year, age, sex assigned at birth, race, and ethnicity.",
    category: "smart_block",
    iconName: "IconUserCheck",
    cdashDomain: "DM",
    command: "/demographics",
    keywords: [
      "demographics",
      "consent",
      "age",
      "sex",
      "race",
      "ethnicity",
      "dm",
      "baseline",
    ],
    variableCount: 7,
    hasRules: true,
    factory: () => {
      const now = Date.now();
      const secId = `sec_dm_${now}`;
      const fields: CRFField[] = [
        {
          id: `f_icdat_${now}`,
          variableName: "ICDAT",
          label: "Date Informed Consent Signed",
          dataType: "date",
          required: true,
          columnSpan: 6,
          cdashMetadata: {
            domain: "DS",
            sdtmVariable: "DSSTDTC",
            cdashLabel: "Consent Date",
            core: "HR",
            acrfAnnotation: "DS.DSSTDTC [DSDECOD=INFORMED CONSENT OBTAINED]",
          },
        },
        {
          id: `f_icyn_${now}`,
          variableName: "ICYN",
          label: "Written Informed Consent Provided Prior to Procedures?",
          dataType: "radio",
          required: true,
          columnSpan: 6,
          customOptions: [
            { code: "Y", label: "Yes", order: 1 },
            { code: "N", label: "No", order: 2 },
          ],
          cdashMetadata: {
            domain: "DS",
            sdtmVariable: "DSDECOD",
            cdashLabel: "Consent Indicator",
            core: "HR",
            acrfAnnotation: "DS.DSDECOD",
          },
        },
        {
          id: `f_brthyr_${now}`,
          variableName: "BRTHYR",
          label: "Year of Birth (YYYY)",
          dataType: "integer",
          required: true,
          minValue: 1900,
          maxValue: 2026,
          columnSpan: 4,
          cdashMetadata: {
            domain: "DM",
            sdtmVariable: "BRTHYR",
            cdashLabel: "Year of Birth",
            core: "HR",
            acrfAnnotation: "DM.BRTHYR",
          },
        },
        {
          id: `f_age_${now}`,
          variableName: "AGE",
          label: "Age at Screening",
          dataType: "integer",
          unit: "Years",
          required: true,
          minValue: 18,
          maxValue: 110,
          columnSpan: 4,
          cdashMetadata: {
            domain: "DM",
            sdtmVariable: "AGE",
            cdashLabel: "Age",
            core: "HR",
            acrfAnnotation: "DM.AGE",
          },
        },
        {
          id: `f_sex_${now}`,
          variableName: "SEX",
          label: "Sex Assigned at Birth",
          dataType: "single_select",
          required: true,
          columnSpan: 4,
          customOptions: [
            { code: "M", label: "Male", order: 1 },
            { code: "F", label: "Female", order: 2 },
            { code: "U", label: "Undifferentiated", order: 3 },
            { code: "UNK", label: "Unknown", order: 4 },
          ],
          cdashMetadata: {
            domain: "DM",
            sdtmVariable: "SEX",
            cdashLabel: "Sex",
            core: "HR",
            acrfAnnotation: "DM.SEX",
          },
        },
        {
          id: `f_race_${now}`,
          variableName: "RACE",
          label: "Primary Race",
          dataType: "single_select",
          required: true,
          columnSpan: 6,
          customOptions: [
            {
              code: "AMERICAN_INDIAN",
              label: "American Indian or Alaska Native",
              order: 1,
            },
            { code: "ASIAN", label: "Asian", order: 2 },
            { code: "BLACK", label: "Black or African American", order: 3 },
            {
              code: "PACIFIC_ISLANDER",
              label: "Native Hawaiian or Other Pacific Islander",
              order: 4,
            },
            { code: "WHITE", label: "White", order: 5 },
            { code: "OTHER", label: "Other / Multiple", order: 6 },
          ],
          cdashMetadata: {
            domain: "DM",
            sdtmVariable: "RACE",
            cdashLabel: "Race",
            core: "HR",
            acrfAnnotation: "DM.RACE",
          },
        },
        {
          id: `f_ethnic_${now}`,
          variableName: "ETHNIC",
          label: "Ethnicity",
          dataType: "single_select",
          required: true,
          columnSpan: 6,
          customOptions: [
            { code: "HISPANIC", label: "Hispanic or Latino", order: 1 },
            { code: "NOT_HISPANIC", label: "Not Hispanic or Latino", order: 2 },
            { code: "NOT_REPORTED", label: "Not Reported", order: 3 },
            { code: "UNKNOWN", label: "Unknown", order: 4 },
          ],
          cdashMetadata: {
            domain: "DM",
            sdtmVariable: "ETHNIC",
            cdashLabel: "Ethnicity",
            core: "HR",
            acrfAnnotation: "DM.ETHNIC",
          },
        },
      ];

      const rules: EditCheckRule[] = [
        {
          id: `rule_consent_mandatory_${now}`,
          name: "Informed Consent Protocol Prerequisite",
          description:
            "Requires ICYN to be 'Yes' before subject protocol procedures can proceed.",
          querySeverity: "error",
          triggerFieldIds: [`f_icyn_${now}`],
          targetFieldId: `f_icyn_${now}`,
          actionType: "raise_query",
          queryMessage:
            "Written informed consent is a mandatory prerequisite for study participation.",
          conditions: [
            { fieldId: `f_icyn_${now}`, operator: "neq", value: "Y" },
          ],
          logicalOperator: "AND",
        },
        {
          id: `rule_age_eligibility_${now}`,
          name: "Adult Age Eligibility Requirement",
          description:
            "Verifies that subject meets the minimum age requirement of 18 years.",
          querySeverity: "error",
          triggerFieldIds: [`f_age_${now}`],
          targetFieldId: `f_age_${now}`,
          actionType: "raise_query",
          queryMessage:
            "Subject must be at least 18 years of age at screening.",
          conditions: [{ fieldId: `f_age_${now}`, operator: "lt", value: 18 }],
          logicalOperator: "AND",
        },
      ];

      return {
        section: {
          id: secId,
          title: "Subject Demographics & Consent",
          fields,
        },
        rules,
      };
    },
  },
  {
    id: "labs",
    title: "Central & Local Laboratory Panel",
    description:
      "Quantitative lab testing section with test name, result value, units, and reference range indicator.",
    category: "smart_block",
    iconName: "IconTestPipe",
    cdashDomain: "LB",
    command: "/labs",
    keywords: [
      "labs",
      "laboratory",
      "blood",
      "chemistry",
      "hematology",
      "lb",
      "biomarker",
    ],
    variableCount: 4,
    hasRules: false,
    factory: () => {
      const now = Date.now();
      const secId = `sec_lb_${now}`;
      const fields: CRFField[] = [
        {
          id: `f_lbtest_${now}`,
          variableName: "LBTEST",
          label: "Laboratory Test Name",
          dataType: "single_select",
          required: true,
          columnSpan: 6,
          customOptions: [
            { code: "HGB", label: "Hemoglobin (HGB)", order: 1 },
            { code: "WBC", label: "White Blood Cell Count (WBC)", order: 2 },
            { code: "PLT", label: "Platelets (PLT)", order: 3 },
            { code: "ALT", label: "Alanine Aminotransferase (ALT)", order: 4 },
            {
              code: "AST",
              label: "Aspartate Aminotransferase (AST)",
              order: 5,
            },
            { code: "TBIL", label: "Total Bilirubin (TBIL)", order: 6 },
            { code: "CREAT", label: "Serum Creatinine (CREAT)", order: 7 },
            { code: "BUN", label: "Blood Urea Nitrogen (BUN)", order: 8 },
          ],
          cdashMetadata: {
            domain: "LB",
            sdtmVariable: "LBTESTCD",
            cdashLabel: "Lab Test Code",
            core: "HR",
            acrfAnnotation: "LB.LBTESTCD",
          },
        },
        {
          id: `f_lborres_${now}`,
          variableName: "LBORRES",
          label: "Numeric Result Value",
          dataType: "number",
          required: true,
          columnSpan: 6,
          cdashMetadata: {
            domain: "LB",
            sdtmVariable: "LBORRES",
            cdashLabel: "Result",
            core: "HR",
            acrfAnnotation: "LB.LBORRES",
          },
        },
        {
          id: `f_lborresu_${now}`,
          variableName: "LBORRESU",
          label: "Original Result Unit",
          dataType: "single_select",
          required: true,
          columnSpan: 6,
          customOptions: [
            { code: "g/dL", label: "g/dL", order: 1 },
            { code: "10^3/uL", label: "10^3/uL", order: 2 },
            { code: "U/L", label: "U/L", order: 3 },
            { code: "mg/dL", label: "mg/dL", order: 4 },
            { code: "mmol/L", label: "mmol/L", order: 5 },
            { code: "umol/L", label: "umol/L", order: 6 },
          ],
          cdashMetadata: {
            domain: "LB",
            sdtmVariable: "LBORRESU",
            cdashLabel: "Units",
            core: "HR",
            acrfAnnotation: "LB.LBORRESU",
          },
        },
        {
          id: `f_lbnrind_${now}`,
          variableName: "LBNRIND",
          label: "Reference Range Indicator",
          dataType: "single_select",
          required: true,
          columnSpan: 6,
          customOptions: [
            { code: "NORMAL", label: "NORMAL", order: 1 },
            { code: "LOW", label: "LOW", order: 2 },
            { code: "HIGH", label: "HIGH", order: 3 },
            { code: "CRIT_LOW", label: "CRITICAL LOW", order: 4 },
            { code: "CRIT_HIGH", label: "CRITICAL HIGH", order: 5 },
          ],
          cdashMetadata: {
            domain: "LB",
            sdtmVariable: "LBNRIND",
            cdashLabel: "Reference Range Indicator",
            core: "HR",
            acrfAnnotation: "LB.LBNRIND",
          },
        },
      ];

      return {
        section: {
          id: secId,
          title: "Central & Local Laboratory Panel",
          fields,
        },
        rules: [],
      };
    },
  },
  {
    id: "pro",
    title: "Patient-Reported Outcomes (PRO / ePRO)",
    description:
      "Standard instrument with 0-10 NRS fatigue scale, 0-100 VAS pain slider, and quality-of-life interference.",
    category: "smart_block",
    iconName: "IconMoodSmile",
    cdashDomain: "QS",
    command: "/pro",
    keywords: [
      "pro",
      "epro",
      "patient",
      "outcomes",
      "vas",
      "nrs",
      "pain",
      "fatigue",
      "qol",
      "qs",
    ],
    variableCount: 3,
    hasRules: false,
    factory: () => {
      const now = Date.now();
      const secId = `sec_pro_${now}`;
      const fields: CRFField[] = [
        {
          id: `f_pro_fatigue_${now}`,
          variableName: "PROFATIG",
          label:
            "Fatigue Severity Rating (0 = None, 10 = As bad as you can imagine)",
          dataType: "nrs_scale",
          scaleMinLabel: "No Fatigue",
          scaleMaxLabel: "Worst Fatigue",
          required: true,
          columnSpan: 6,
          cdashMetadata: {
            domain: "QS",
            sdtmVariable: "QSORRES",
            cdashLabel: "Fatigue Score",
            core: "HR",
            acrfAnnotation: "QS.QSORRES [QSTESTCD=FATIGUE]",
          },
        },
        {
          id: `f_pro_pain_${now}`,
          variableName: "PRO_PAIN",
          label:
            "Pain Intensity Scale (0 = No Pain, 100 = Worst Possible Pain)",
          dataType: "vas_scale",
          scaleMinLabel: "No Pain",
          scaleMaxLabel: "Worst Possible Pain",
          required: true,
          columnSpan: 6,
          cdashMetadata: {
            domain: "QS",
            sdtmVariable: "QSORRES",
            cdashLabel: "Pain Score",
            core: "HR",
            acrfAnnotation: "QS.QSORRES [QSTESTCD=PAIN]",
          },
        },
        {
          id: `f_pro_interf_${now}`,
          variableName: "PROINTRF",
          label: "Interference with Daily Activities Over Past 7 Days",
          dataType: "single_select",
          required: true,
          columnSpan: 12,
          customOptions: [
            { code: "0", label: "Not at all", order: 1 },
            { code: "1", label: "A little bit", order: 2 },
            { code: "2", label: "Somewhat", order: 3 },
            { code: "3", label: "Quite a bit", order: 4 },
            { code: "4", label: "Very much", order: 5 },
          ],
          cdashMetadata: {
            domain: "QS",
            sdtmVariable: "QSORRES",
            cdashLabel: "Daily Interference",
            core: "HR",
            acrfAnnotation: "QS.QSORRES [QSTESTCD=DAILY_INTERF]",
          },
        },
      ];

      return {
        section: {
          id: secId,
          title: "Patient-Reported Outcomes (PRO / ePRO)",
          fields,
        },
        rules: [],
      };
    },
  },
  {
    id: "ecg",
    title: "12-Lead Electrocardiogram (ECG)",
    description:
      "Standard cardiac interval tracking (HR, PR, QRS, QT) with automated Fridericia QTcF derivation.",
    category: "smart_block",
    iconName: "IconActivity",
    cdashDomain: "EG",
    command: "/ecg",
    keywords: ["ecg", "ekg", "cardiac", "qtcf", "interval", "eg", "heart"],
    variableCount: 6,
    hasRules: true,
    factory: () => {
      const now = Date.now();
      const secId = `sec_eg_${now}`;
      const fields: CRFField[] = [
        {
          id: `f_eghr_${now}`,
          variableName: "EGHR",
          label: "Ventricular Heart Rate",
          dataType: "integer",
          unit: "bpm",
          required: true,
          minValue: 30,
          maxValue: 250,
          columnSpan: 4,
          cdashMetadata: {
            domain: "EG",
            sdtmVariable: "EGORRES",
            cdashLabel: "Heart Rate",
            core: "HR",
            acrfAnnotation: "EG.EGORRES [EGTESTCD=HR]",
          },
        },
        {
          id: `f_egpr_${now}`,
          variableName: "EGPR",
          label: "PR Interval",
          dataType: "integer",
          unit: "ms",
          required: true,
          minValue: 50,
          maxValue: 400,
          columnSpan: 4,
          cdashMetadata: {
            domain: "EG",
            sdtmVariable: "EGORRES",
            cdashLabel: "PR Interval",
            core: "HR",
            acrfAnnotation: "EG.EGORRES [EGTESTCD=PR]",
          },
        },
        {
          id: `f_egqrs_${now}`,
          variableName: "EGQRS",
          label: "QRS Duration",
          dataType: "integer",
          unit: "ms",
          required: true,
          minValue: 40,
          maxValue: 250,
          columnSpan: 4,
          cdashMetadata: {
            domain: "EG",
            sdtmVariable: "EGORRES",
            cdashLabel: "QRS Duration",
            core: "HR",
            acrfAnnotation: "EG.EGORRES [EGTESTCD=QRS]",
          },
        },
        {
          id: `f_egqt_${now}`,
          variableName: "EGQT",
          label: "QT Interval",
          dataType: "integer",
          unit: "ms",
          required: true,
          minValue: 200,
          maxValue: 700,
          columnSpan: 4,
          cdashMetadata: {
            domain: "EG",
            sdtmVariable: "EGORRES",
            cdashLabel: "QT Interval",
            core: "HR",
            acrfAnnotation: "EG.EGORRES [EGTESTCD=QT]",
          },
        },
        {
          id: `f_egqtcf_${now}`,
          variableName: "EGQTCF",
          label: "Fridericia Corrected QT (QTcF)",
          dataType: "calculated",
          unit: "ms",
          calculationFormula: "EGQT / Math.cbrt(60 / EGHR)",
          readOnly: true,
          required: false,
          columnSpan: 4,
          cdashMetadata: {
            domain: "EG",
            sdtmVariable: "EGSTRESN",
            cdashLabel: "Fridericia Corrected QT",
            core: "O",
            acrfAnnotation: "EG.EGSTRESN [EGTESTCD=QTCF]",
          },
        },
        {
          id: `f_egclsig_${now}`,
          variableName: "EGCLSIG",
          label: "Overall Clinical Significance",
          dataType: "single_select",
          required: true,
          columnSpan: 4,
          customOptions: [
            { code: "NORMAL", label: "Normal", order: 1 },
            {
              code: "ABNORMAL_NCS",
              label: "Abnormal - Not Clinically Significant",
              order: 2,
            },
            {
              code: "ABNORMAL_CS",
              label: "Abnormal - Clinically Significant",
              order: 3,
            },
          ],
          cdashMetadata: {
            domain: "EG",
            sdtmVariable: "EGCLSIG",
            cdashLabel: "Clinical Significance",
            core: "HR",
            acrfAnnotation: "EG.EGCLSIG",
          },
        },
      ];

      const rules: EditCheckRule[] = [
        {
          id: `rule_qtcf_prolongation_${now}`,
          name: "QTcF Prolongation Safety Alert",
          description:
            "Warns investigator when Fridericia corrected QT exceeds 500 ms.",
          querySeverity: "warning",
          triggerFieldIds: [`f_egqtcf_${now}`],
          targetFieldId: `f_egqtcf_${now}`,
          actionType: "raise_query",
          queryMessage:
            "Fridericia Corrected QT (QTcF) >= 500 ms requires immediate PI assessment for arrhythmia risk.",
          conditions: [
            { fieldId: `f_egqtcf_${now}`, operator: "gte", value: 500 },
          ],
          logicalOperator: "AND",
        },
      ];

      return {
        section: {
          id: secId,
          title: "12-Lead Electrocardiogram (ECG)",
          fields,
        },
        rules,
      };
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Atomic Field Slash Commands
// ─────────────────────────────────────────────────────────────────────────────

export const ATOMIC_SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: "text",
    title: "Single-Line Text",
    description:
      "Standard text input field for short strings, names, or codes.",
    category: "widget",
    command: "/text",
    keywords: ["text", "string", "input", "short", "char"],
    badge: "text",
    action: "insert_field",
    fieldTemplate: {
      dataType: "text",
      label: "Text Variable",
      variableName: "VAR_TXT",
      required: false,
      columnSpan: 6,
    },
  },
  {
    id: "textarea",
    title: "Multi-Line Text / Notes",
    description:
      "Multi-line text area for medical narratives or investigator comments.",
    category: "widget",
    command: "/textarea",
    keywords: ["textarea", "narrative", "notes", "long text", "comments"],
    badge: "textarea",
    action: "insert_field",
    fieldTemplate: {
      dataType: "textarea",
      label: "Clinical Narrative / Notes",
      variableName: "VAR_COMM",
      required: false,
      columnSpan: 12,
    },
  },
  {
    id: "number",
    title: "Integer / Count",
    description:
      "Whole number field for counts, scores, or whole-integer measurements.",
    category: "widget",
    command: "/number",
    keywords: ["number", "integer", "int", "count", "score"],
    badge: "integer",
    action: "insert_field",
    fieldTemplate: {
      dataType: "integer",
      label: "Numeric Count",
      variableName: "VAR_NUM",
      required: false,
      columnSpan: 6,
    },
  },
  {
    id: "decimal",
    title: "Decimal / Continuous",
    description: "Floating-point numeric measurement with unit definition.",
    category: "widget",
    command: "/decimal",
    keywords: ["decimal", "float", "measurement", "continuous", "value"],
    badge: "decimal",
    action: "insert_field",
    fieldTemplate: {
      dataType: "number",
      label: "Measurement Value",
      variableName: "VAR_DEC",
      unit: "unit",
      required: false,
      columnSpan: 6,
    },
  },
  {
    id: "date",
    title: "Calendar Date",
    description: "ISO 8601 clinical date selector (YYYY-MM-DD).",
    category: "widget",
    command: "/date",
    keywords: ["date", "calendar", "day", "iso", "time"],
    badge: "date",
    action: "insert_field",
    fieldTemplate: {
      dataType: "date",
      label: "Assessment Date",
      variableName: "VAR_DTC",
      required: false,
      columnSpan: 6,
    },
  },
  {
    id: "time",
    title: "Clock Time",
    description:
      "Time selector for dose or sample collection timestamps (HH:MM).",
    category: "widget",
    command: "/time",
    keywords: ["time", "clock", "hour", "minute", "timestamp"],
    badge: "time",
    action: "insert_field",
    fieldTemplate: {
      dataType: "time",
      label: "Collection Time",
      variableName: "VAR_TIM",
      required: false,
      columnSpan: 6,
    },
  },
  {
    id: "datetime",
    title: "Date & Time Timestamp",
    description:
      "Combined ISO 8601 datetime selector for exact PK/PD event logging.",
    category: "widget",
    command: "/datetime",
    keywords: ["datetime", "timestamp", "exact", "pk", "time"],
    badge: "datetime",
    action: "insert_field",
    fieldTemplate: {
      dataType: "datetime",
      label: "Event Timestamp",
      variableName: "VAR_DTM",
      required: false,
      columnSpan: 6,
    },
  },
  {
    id: "radio",
    title: "Radio Choice Group",
    description: "Mutually exclusive single choice group (e.g. Yes / No).",
    category: "widget",
    command: "/radio",
    keywords: ["radio", "yesno", "binary", "choice", "options"],
    badge: "radio",
    action: "insert_field",
    fieldTemplate: {
      dataType: "radio",
      label: "Binary Indicator",
      variableName: "VAR_YN",
      required: false,
      columnSpan: 6,
      customOptions: [
        { code: "Y", label: "Yes", order: 1 },
        { code: "N", label: "No", order: 2 },
      ],
    },
  },
  {
    id: "select",
    title: "Dropdown Select",
    description:
      "Single select dropdown linked to NCI controlled terminology or custom choices.",
    category: "widget",
    command: "/select",
    keywords: ["select", "dropdown", "codelist", "choice", "menu"],
    badge: "select",
    action: "insert_field",
    fieldTemplate: {
      dataType: "single_select",
      label: "Codelist Selection",
      variableName: "VAR_COD",
      required: false,
      columnSpan: 6,
      customOptions: [
        { code: "OPT_A", label: "Option A", order: 1 },
        { code: "OPT_B", label: "Option B", order: 2 },
        { code: "OPT_C", label: "Option C", order: 3 },
      ],
    },
  },
  {
    id: "multiselect",
    title: "Multi-Select Checkboxes",
    description:
      "Multiple-choice checkbox group for symptoms or co-morbidities.",
    category: "widget",
    command: "/multiselect",
    keywords: ["multiselect", "multiple", "checkboxes", "tags", "list"],
    badge: "multiselect",
    action: "insert_field",
    fieldTemplate: {
      dataType: "multi_select",
      label: "Multi-Select Factors",
      variableName: "VARMULTI",
      required: false,
      columnSpan: 12,
      customOptions: [
        { code: "F1", label: "Factor 1", order: 1 },
        { code: "F2", label: "Factor 2", order: 2 },
        { code: "F3", label: "Factor 3", order: 3 },
      ],
    },
  },
  {
    id: "calc",
    title: "Derived Calculated Field",
    description:
      "Real-time computed AST mathematical formula (e.g. Creatinine Clearance, BSA).",
    category: "widget",
    command: "/calc",
    keywords: ["calc", "calculation", "derived", "formula", "math", "ast"],
    badge: "derived",
    action: "insert_field",
    fieldTemplate: {
      dataType: "calculated",
      label: "Calculated Metric",
      variableName: "VAR_CALC",
      calculationFormula: "VAR_A + VAR_B",
      readOnly: true,
      columnSpan: 12,
    },
  },
  {
    id: "vas",
    title: "Visual Analog Scale (VAS 0-100)",
    description:
      "Continuous visual slider for patient-reported pain or symptom burden.",
    category: "widget",
    command: "/vas",
    keywords: ["vas", "slider", "analog", "pain", "continuous", "visual"],
    badge: "vas",
    action: "insert_field",
    fieldTemplate: {
      dataType: "vas_scale",
      label: "Visual Analog Scale (0-100)",
      variableName: "VAR_VAS",
      scaleMinLabel: "None",
      scaleMaxLabel: "Severe",
      required: false,
      columnSpan: 6,
    },
  },
  {
    id: "nrs",
    title: "Numeric Rating Scale (NRS 0-10)",
    description:
      "Discrete button scale for fatigue, nausea, or patient-reported metrics.",
    category: "widget",
    command: "/nrs",
    keywords: ["nrs", "rating", "scale", "discrete", "fatigue", "score"],
    badge: "nrs",
    action: "insert_field",
    fieldTemplate: {
      dataType: "nrs_scale",
      label: "Numeric Rating Scale (0-10)",
      variableName: "VAR_NRS",
      scaleMinLabel: "0 - None",
      scaleMaxLabel: "10 - Severe",
      required: false,
      columnSpan: 6,
    },
  },
  {
    id: "signature",
    title: "21 CFR Part 11 Electronic Signature",
    description:
      "Investigator sign-off widget with a simulated attestation and audit trail.",
    category: "widget",
    command: "/signature",
    keywords: ["signature", "sign", "part11", "21cfr", "attestation", "pi"],
    badge: "signature",
    action: "insert_field",
    fieldTemplate: {
      dataType: "signature",
      label: "Principal Investigator Electronic Signature",
      variableName: "PI_SIG",
      required: true,
      columnSpan: 12,
    },
  },
  {
    id: "section",
    title: "New Form Section",
    description:
      "Insert a clean, blank form section container to group related clinical fields.",
    category: "layout",
    command: "/section",
    keywords: ["section", "container", "group", "block", "layout"],
    badge: "section",
    action: "insert_section",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Unified Registry & Search Helpers
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_SLASH_COMMANDS: SlashCommandItem[] = [
  ...CLINICAL_SMART_BLOCKS.map((sb): SlashCommandItem => ({
    id: sb.id,
    title: sb.title,
    description: sb.description,
    category: "smart_block",
    command: sb.command,
    keywords: sb.keywords,
    badge: `${sb.cdashDomain} • ${sb.variableCount} vars`,
    action: "insert_smart_block",
    smartBlockId: sb.id,
  })),
  ...ATOMIC_SLASH_COMMANDS,
];

/**
 * Searches and ranks slash commands by match relevance and optional category
 */
export function searchSlashCommands(
  query: string,
  category?: SlashCommandCategory
): SlashCommandItem[] {
  let items = ALL_SLASH_COMMANDS;
  if (category) {
    items = items.filter((item) => item.category === category);
  }

  const clean = query.trim().toLowerCase().replace(/^\//, "");
  if (!clean) return items;

  return items.filter((item) => {
    if (item.command.toLowerCase().includes(clean)) return true;
    if (item.title.toLowerCase().includes(clean)) return true;
    if (item.description.toLowerCase().includes(clean)) return true;
    return item.keywords.some((k) => k.toLowerCase().includes(clean));
  });
}

export interface InstantiateSmartBlockOptions {
  existingVariableNames?: Iterable<string>;
  existingIds?: Iterable<string>;
}

export interface InstantiatedSmartBlock {
  section: CRFSection;
  rules: EditCheckRule[];
  variableMap: Record<string, string>;
  idMap: Record<string, string>;
}

/**
 * Instantiates a compound Clinical Smart Block by ID with collision-resistant IDs
 * and automatic CDASH non-conflicting variable name remapping.
 */
export function instantiateSmartBlock(
  blockId: string,
  options?: InstantiateSmartBlockOptions
): InstantiatedSmartBlock {
  const definition = CLINICAL_SMART_BLOCKS.find((b) => b.id === blockId);
  if (!definition) {
    throw new Error(`Unknown clinical smart block: "${blockId}"`);
  }
  const raw = definition.factory();

  // Deep clone to prevent mutating template objects
  const section: CRFSection = cloneDeep(raw.section);
  const rules: EditCheckRule[] = cloneDeep(raw.rules);

  const variableMap: Record<string, string> = {};
  const idMap: Record<string, string> = {};

  const existingVars = new Set(
    Array.from(options?.existingVariableNames || []).map((v) => v.toUpperCase())
  );

  // Remap section ID
  const newSecId = generateEngineId("sec");
  idMap[section.id] = newSecId;
  section.id = newSecId;

  // Remap fields: assign unique IDs and generate nonconflicting CDASH variable names
  for (const field of section.fields) {
    const oldFldId = field.id;
    const newFldId = generateEngineId("fld");
    idMap[oldFldId] = newFldId;
    field.id = newFldId;

    const originalVar = field.variableName.toUpperCase();
    if (existingVars.has(originalVar)) {
      const newVar = generateCdashVariableName(originalVar, existingVars);
      variableMap[originalVar] = newVar;
      field.variableName = newVar;
      existingVars.add(newVar);
    } else {
      variableMap[originalVar] = originalVar;
      existingVars.add(originalVar);
    }
  }

  // Remap calculation formulas if variables changed
  for (const field of section.fields) {
    if (field.calculationFormula) {
      let updatedFormula = field.calculationFormula;
      for (const [oldVar, newVar] of Object.entries(variableMap)) {
        if (oldVar !== newVar) {
          updatedFormula = updatedFormula.replace(
            new RegExp(`\\b${oldVar}\\b`, "g"),
            newVar
          );
        }
      }
      field.calculationFormula = updatedFormula;
    }
  }

  // Remap rules: IDs, targetFieldId, triggerFieldIds, conditions, conditionGroups
  for (const rule of rules) {
    const newRuleId = generateEngineId("rule");
    idMap[rule.id] = newRuleId;
    rule.id = newRuleId;

    if (idMap[rule.targetFieldId]) {
      rule.targetFieldId = idMap[rule.targetFieldId];
    }
    rule.triggerFieldIds = (rule.triggerFieldIds || []).map(
      (tid) => idMap[tid] || tid
    );

    for (const cond of rule.conditions || []) {
      if (idMap[cond.fieldId]) {
        cond.fieldId = idMap[cond.fieldId];
      }
      if (cond.compareFieldId && idMap[cond.compareFieldId]) {
        cond.compareFieldId = idMap[cond.compareFieldId];
      }
    }

    for (const group of rule.conditionGroups || []) {
      for (const cond of group.conditions || []) {
        if (idMap[cond.fieldId]) {
          cond.fieldId = idMap[cond.fieldId];
        }
        if (cond.compareFieldId && idMap[cond.compareFieldId]) {
          cond.compareFieldId = idMap[cond.compareFieldId];
        }
      }
    }
  }

  return { section, rules, variableMap, idMap };
}

export interface InstantiateAtomicFieldOptions {
  existingVariableNames?: Iterable<string>;
  indexOffset?: number;
}

/**
 * Instantiates an atomic CRF Field from a slash command with valid CDASH variable naming (<= 8 chars)
 */
export function instantiateAtomicField(
  commandId: string,
  optionsOrOffset: InstantiateAtomicFieldOptions | number = 0
): CRFField {
  const options: InstantiateAtomicFieldOptions =
    typeof optionsOrOffset === "number"
      ? { indexOffset: optionsOrOffset }
      : optionsOrOffset || {};

  const item = ATOMIC_SLASH_COMMANDS.find((c) => c.id === commandId);
  const template = item?.fieldTemplate || {};
  const dataType: ClinicalDataType = template.dataType || "text";

  const existingVars = new Set(
    Array.from(options.existingVariableNames || []).map((v) => v.toUpperCase())
  );

  const rawBase = template.variableName || dataType.toUpperCase();
  const baseVar = rawBase.slice(0, 8);
  const varName = existingVars.has(baseVar)
    ? generateCdashVariableName(baseVar, existingVars)
    : baseVar;

  return {
    id: generateEngineId("fld"),
    variableName: varName,
    label: template.label || "New Field",
    dataType,
    unit: template.unit,
    required: template.required ?? false,
    readOnly: template.readOnly ?? false,
    calculationFormula: template.calculationFormula,
    scaleMinLabel: template.scaleMinLabel,
    scaleMaxLabel: template.scaleMaxLabel,
    customOptions: template.customOptions
      ? template.customOptions.map((o) => ({ ...o }))
      : undefined,
    columnSpan: template.columnSpan || 6,
    cdashMetadata: template.cdashMetadata
      ? { ...template.cdashMetadata }
      : undefined,
  };
}
