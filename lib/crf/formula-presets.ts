import { CRFField } from "./types";

export interface ClinicalFormulaPreset {
  id: string;
  name: string;
  category: "anthropometric" | "renal" | "cardiac" | "oncology" | "general";
  description: string;
  formula: string;
  standardVariables: {
    key: string;
    label: string;
    suggestedCdashNames: string[];
    suggestedUnits?: string;
  }[];
}

export const CLINICAL_FORMULA_PRESETS: ClinicalFormulaPreset[] = [
  {
    id: "bsa_mosteller",
    name: "Mosteller BSA (m²)",
    category: "anthropometric",
    description:
      "Standard Body Surface Area calculation for oncology dosing: sqrt((Height × Weight) / 3600)",
    formula: "round(sqrt((HEIGHT * WEIGHT) / 3600), 2)",
    standardVariables: [
      {
        key: "HEIGHT",
        label: "Height",
        suggestedCdashNames: ["HEIGHT", "HT", "VS_HT", "f_height"],
        suggestedUnits: "cm",
      },
      {
        key: "WEIGHT",
        label: "Weight",
        suggestedCdashNames: ["WEIGHT", "WT", "VS_WT", "f_weight"],
        suggestedUnits: "kg",
      },
    ],
  },
  {
    id: "bsa_dubois",
    name: "DuBois & DuBois BSA (m²)",
    category: "anthropometric",
    description:
      "Classic power-law Body Surface Area: 0.007184 × Height^0.725 × Weight^0.425",
    formula: "round(0.007184 * (HEIGHT ^ 0.725) * (WEIGHT ^ 0.425), 2)",
    standardVariables: [
      {
        key: "HEIGHT",
        label: "Height",
        suggestedCdashNames: ["HEIGHT", "HT", "VS_HT", "f_height"],
        suggestedUnits: "cm",
      },
      {
        key: "WEIGHT",
        label: "Weight",
        suggestedCdashNames: ["WEIGHT", "WT", "VS_WT", "f_weight"],
        suggestedUnits: "kg",
      },
    ],
  },
  {
    id: "bmi_quetelet",
    name: "Quetelet BMI (kg/m²)",
    category: "anthropometric",
    description:
      "Body Mass Index from height in cm and weight in kg: Weight / ((Height/100)²)",
    formula: "round(WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100)), 1)",
    standardVariables: [
      {
        key: "HEIGHT",
        label: "Height",
        suggestedCdashNames: ["HEIGHT", "HT", "VS_HT", "f_height"],
        suggestedUnits: "cm",
      },
      {
        key: "WEIGHT",
        label: "Weight",
        suggestedCdashNames: ["WEIGHT", "WT", "VS_WT", "f_weight"],
        suggestedUnits: "kg",
      },
    ],
  },
  {
    id: "cockcroft_gault",
    name: "Cockcroft-Gault CrCl (mL/min)",
    category: "renal",
    description:
      "Estimated Creatinine Clearance for renal dose adjustments: ((140 - Age) × Weight) / (72 × Creatinine)",
    formula: "round(((140 - AGE) * WEIGHT) / (72 * CREAT), 1)",
    standardVariables: [
      {
        key: "AGE",
        label: "Age",
        suggestedCdashNames: ["AGE", "DM_AGE", "f_age"],
        suggestedUnits: "years",
      },
      {
        key: "WEIGHT",
        label: "Weight",
        suggestedCdashNames: ["WEIGHT", "WT", "VS_WT", "f_weight"],
        suggestedUnits: "kg",
      },
      {
        key: "CREAT",
        label: "Serum Creatinine",
        suggestedCdashNames: ["CREAT", "LB_CREAT", "SCREAT", "f_creat"],
        suggestedUnits: "mg/dL",
      },
    ],
  },
  {
    id: "recist_sld_change",
    name: "RECIST 1.1 % SLD Change",
    category: "oncology",
    description:
      "Sum of Longest Target Lesion Diameters percentage change from baseline",
    formula: "round(((TRL1 + TRL2 - TRSLDBAS) / TRSLDBAS) * 100, 1)",
    standardVariables: [
      {
        key: "TRL1",
        label: "Target Lesion 1",
        suggestedCdashNames: ["TRL1", "TR_L1", "LESION1", "f_trl1"],
        suggestedUnits: "mm",
      },
      {
        key: "TRL2",
        label: "Target Lesion 2",
        suggestedCdashNames: ["TRL2", "TR_L2", "LESION2", "f_trl2"],
        suggestedUnits: "mm",
      },
      {
        key: "TRSLDBAS",
        label: "Baseline SLD",
        suggestedCdashNames: ["TRSLDBAS", "SLDBASE", "BASE_SLD", "f_trsldbas"],
        suggestedUnits: "mm",
      },
    ],
  },
  {
    id: "bazett_qtc",
    name: "Bazett QTcB (ms)",
    category: "cardiac",
    description:
      "Heart-rate corrected QT interval via Bazett formula: QT / sqrt(RR in seconds)",
    formula: "round(EGQT / sqrt(EGRR / 1000), 0)",
    standardVariables: [
      {
        key: "EGQT",
        label: "Raw QT Interval",
        suggestedCdashNames: ["EGQT", "QT", "EG_QT", "f_egqt"],
        suggestedUnits: "ms",
      },
      {
        key: "EGRR",
        label: "RR Interval",
        suggestedCdashNames: ["EGRR", "RR", "EG_RR", "f_egrr"],
        suggestedUnits: "ms",
      },
    ],
  },
  {
    id: "fridericia_qtc",
    name: "Fridericia QTcF (ms)",
    category: "cardiac",
    description:
      "Heart-rate corrected QT interval via Fridericia cubic formula: QT / (RR in seconds)^(1/3)",
    formula: "round(EGQT / ((EGRR / 1000) ^ (1 / 3)), 0)",
    standardVariables: [
      {
        key: "EGQT",
        label: "Raw QT Interval",
        suggestedCdashNames: ["EGQT", "QT", "EG_QT", "f_egqt"],
        suggestedUnits: "ms",
      },
      {
        key: "EGRR",
        label: "RR Interval",
        suggestedCdashNames: ["EGRR", "RR", "EG_RR", "f_egrr"],
        suggestedUnits: "ms",
      },
    ],
  },
  {
    id: "map",
    name: "Mean Arterial Pressure (MAP)",
    category: "cardiac",
    description:
      "Average blood pressure during a single cardiac cycle: ((2 × DBP) + SBP) / 3",
    formula: "round(((2 * DIABP) + SYSBP) / 3, 1)",
    standardVariables: [
      {
        key: "DIABP",
        label: "Diastolic Blood Pressure",
        suggestedCdashNames: ["DIABP", "DBP", "VS_DIABP", "f_diabp"],
        suggestedUnits: "mmHg",
      },
      {
        key: "SYSBP",
        label: "Systolic Blood Pressure",
        suggestedCdashNames: ["SYSBP", "SBP", "VS_SYSBP", "f_sysbp"],
        suggestedUnits: "mmHg",
      },
    ],
  },
];

/**
 * Maps standard preset placeholder variables to available fields in the active CRF form.
 */
export function mapPresetToFormVariables(
  presetFormula: string,
  fields: CRFField[]
): string {
  if (!presetFormula || !fields || fields.length === 0) return presetFormula;

  let mapped = presetFormula;
  const fieldLookup = new Map<string, string>();

  fields.forEach((f) => {
    fieldLookup.set(f.variableName.toUpperCase(), f.variableName);
    fieldLookup.set(f.id.toUpperCase(), f.variableName);
    if (f.cdashMetadata?.sdtmVariable) {
      fieldLookup.set(
        f.cdashMetadata.sdtmVariable.toUpperCase(),
        f.variableName
      );
    }
  });

  CLINICAL_FORMULA_PRESETS.forEach((preset) => {
    preset.standardVariables.forEach((stdVar) => {
      let matchedFieldName: string | undefined;

      for (const candidate of stdVar.suggestedCdashNames) {
        if (fieldLookup.has(candidate.toUpperCase())) {
          matchedFieldName = fieldLookup.get(candidate.toUpperCase());
          break;
        }
      }

      if (!matchedFieldName) {
        const match = fields.find((f) => {
          const varUpper = f.variableName.toUpperCase();
          const labelUpper = f.label.toUpperCase();
          return (
            varUpper.includes(stdVar.key.toUpperCase()) ||
            labelUpper.includes(stdVar.label.toUpperCase()) ||
            stdVar.suggestedCdashNames.some((c) =>
              varUpper.includes(c.toUpperCase())
            )
          );
        });
        if (match) {
          matchedFieldName = match.variableName;
        }
      }

      if (matchedFieldName && matchedFieldName !== stdVar.key) {
        const regex = new RegExp(`\\b${stdVar.key}\\b`, "g");
        mapped = mapped.replace(regex, matchedFieldName);
      }
    });
  });

  return mapped;
}
