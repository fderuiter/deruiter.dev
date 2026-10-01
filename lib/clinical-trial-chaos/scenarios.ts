import {
  CDISCDomain,
  ClinicalObservation,
  ClinicalSubject,
  GameMode,
  GamePhase,
  ProtocolAmendment,
  StationConfig,
  StressParameters,
  StressPreset,
  StressPresetId,
  ValidationErrorType,
} from "./types";
import { CRFField, EditCheckRule, StudyProtocol } from "../crf/types";

export interface MockObservationTemplate {
  field: string;
  destination: CDISCDomain;
  validValues: string[];
  testCode: string;
  corruptions: {
    rawValue: string;
    correctedValue: string;
    errorType: ValidationErrorType;
    hint: string;
    explanation: string;
    ctCode?: string;
    options: string[]; // Multi-choice options (must include correctedValue)
  }[];
}

export const MOCK_OBSERVATION_TEMPLATES: MockObservationTemplate[] = [
  // ==================== DM (Demographics) ====================
  {
    field: "Height",
    destination: "DM",
    testCode: "HEIGHT",
    validValues: ["175 cm", "168 cm", "182 cm", "159 cm", "190 cm"],
    corruptions: [
      {
        rawValue: "180 m",
        correctedValue: "180 cm",
        errorType: "unit-error",
        hint: "Meters unit anomaly (expected cm)",
        explanation:
          "CDISC SDTM DM domain specifies metric height standard (cm). 180 m would represent a skyscraper.",
        ctCode: "C25473",
        options: ["180 cm", "1.80 m", "1800 mm", "70.8 in"],
      },
      {
        rawValue: "1750 cm",
        correctedValue: "175 cm",
        errorType: "range-outlier",
        hint: "Extra zero outlier (>300cm)",
        explanation:
          "1750 cm exceeds physiological human limits. Stripping the typographical trailing zero normalizes to 175 cm.",
        ctCode: "C25473",
        options: ["175 cm", "17.5 cm", "1750 mm", "175 in"],
      },
      {
        rawValue: "-168 cm",
        correctedValue: "168 cm",
        errorType: "negative-value",
        hint: "Negative height recorded",
        explanation:
          "Height measurements must be positive real numbers. Remove erroneous negative polarity sign.",
        ctCode: "C25473",
        options: ["168 cm", "0 cm", "N/A", "168 mm"],
      },
      {
        rawValue: "5 ft 11 in",
        correctedValue: "180 cm",
        errorType: "unit-error",
        hint: "Imperial feet/inches format",
        explanation:
          "Convert US customary imperial measurements (5'11\") to CDISC SDTM standard unit (180 cm).",
        ctCode: "C25473",
        options: ["180 cm", "175 cm", "5.11 cm", "71 cm"],
      },
    ],
  },
  {
    field: "Weight",
    destination: "DM",
    testCode: "WEIGHT",
    validValues: ["72.5 kg", "68.0 kg", "84.2 kg", "55.9 kg"],
    corruptions: [
      {
        rawValue: "-75 kg",
        correctedValue: "75 kg",
        errorType: "negative-value",
        hint: "Negative weight recorded",
        explanation:
          "Subject mass cannot be negative. Remove leading hyphen artifact.",
        ctCode: "C25208",
        options: ["75 kg", "0 kg", "7.5 kg", "75 lbs"],
      },
      {
        rawValue: "700 kg",
        correctedValue: "70 kg",
        errorType: "range-outlier",
        hint: "Typo in weight decimal",
        explanation:
          "700 kg is outside standard study inclusion criteria [40-150 kg]. Correct missing decimal to 70 kg.",
        ctCode: "C25208",
        options: ["70 kg", "7000 g", "7.0 kg", "154 lbs"],
      },
      {
        rawValue: "150 lbs",
        correctedValue: "68 kg",
        errorType: "unit-error",
        hint: "Imperial pounds instead of metric kg",
        explanation:
          "150 lbs must be converted using 1 lb = 0.453592 kg -> rounded to 68 kg in SDTM STRESN.",
        ctCode: "C25208",
        options: ["68 kg", "150 kg", "330 kg", "75 kg"],
      },
    ],
  },
  {
    field: "Date of Birth",
    destination: "DM",
    testCode: "BRTHDTC",
    validValues: ["1985-04-12", "1992-11-03", "1978-08-25", "2001-02-17"],
    corruptions: [
      {
        rawValue: "12/25/1990",
        correctedValue: "1990-12-25",
        errorType: "invalid-date",
        hint: "US MM/DD/YYYY entry (ISO 8601 YYYY-MM-DD required)",
        explanation:
          "12/25/1990 is month 12, day 25 in US MM/DD/YYYY order. Reorder to ISO 8601 YYYY-MM-DD: 1990-12-25.",
        ctCode: "ISO8601",
        options: ["1990-12-25", "1990-25-12", "25-12-1990", "12/25/1990"],
      },
      {
        rawValue: "1995-02-30",
        correctedValue: "1995-02-28",
        errorType: "invalid-date",
        hint: "Feb 30 is an invalid calendar date",
        explanation:
          "February has at most 29 days in leap years. 1995 is non-leap, standardizing to end of month: 1995-02-28.",
        ctCode: "ISO8601",
        options: ["1995-02-28", "1995-03-01", "1995-02-29", "1995-02-03"],
      },
    ],
  },
  {
    field: "Sex at Birth",
    destination: "DM",
    testCode: "SEX",
    validValues: ["M", "F"],
    corruptions: [
      {
        rawValue: "male",
        correctedValue: "M",
        errorType: "casing-mismatch",
        hint: "CDISC Controlled Terminology requires single-letter 'M' or 'F'",
        explanation:
          "CDISC SDTM SEX variable codelist (C66731) specifies 1-character codes 'M', 'F', 'U', or 'UNDIFFERENTIATED'.",
        ctCode: "C66731",
        options: ["M", "Male", "MALE", "1"],
      },
      {
        rawValue: "female",
        correctedValue: "F",
        errorType: "casing-mismatch",
        hint: "CDISC Controlled Terminology requires 'M' or 'F'",
        explanation:
          "CDISC SDTM codelist C66731 standardizes full-text 'female' to single uppercase character 'F'.",
        ctCode: "C66731",
        options: ["F", "Female", "FEMALE", "2"],
      },
    ],
  },

  // ==================== VS (Vital Signs) ====================
  {
    field: "Systolic BP",
    destination: "VS",
    testCode: "SYSBP",
    validValues: ["118 mmHg", "122 mmHg", "130 mmHg", "110 mmHg"],
    corruptions: [
      {
        rawValue: "12",
        correctedValue: "120 mmHg",
        errorType: "missing-digit",
        hint: "Missing digit (12 mmHg is fatal)",
        explanation:
          "Missing trailing zero in systolic arterial pressure. Normal resting adult systolic is ~120 mmHg.",
        ctCode: "C25298",
        options: ["120 mmHg", "12 mmHg", "1200 mmHg", "112 mmHg"],
      },
      {
        rawValue: "1200 mmHg",
        correctedValue: "120 mmHg",
        errorType: "range-outlier",
        hint: "Explosive pressure typo (>300 mmHg)",
        explanation:
          "1200 mmHg is an impossible physiological reading. Correct extra zero keystroke to 120 mmHg.",
        ctCode: "C25298",
        options: ["120 mmHg", "1200 mmHg", "102 mmHg", "140 mmHg"],
      },
      {
        rawValue: "125 psi",
        correctedValue: "125 mmHg",
        errorType: "unit-error",
        hint: "Tire pressure unit (expected mmHg)",
        explanation:
          "Vital signs blood pressure requires millimeters of mercury (mmHg) unit code in CDISC VSORRESU.",
        ctCode: "C25298",
        options: ["125 mmHg", "125 psi", "125 kPa", "125 bar"],
      },
    ],
  },
  {
    field: "Diastolic BP",
    destination: "VS",
    testCode: "DIABP",
    validValues: ["78 mmHg", "82 mmHg", "70 mmHg", "85 mmHg"],
    corruptions: [
      {
        rawValue: "8",
        correctedValue: "80 mmHg",
        errorType: "missing-digit",
        hint: "Missing trailing zero",
        explanation:
          "Diastolic pressure missing digit keystroke. Normalize to standard 80 mmHg reading.",
        ctCode: "C25299",
        options: ["80 mmHg", "8 mmHg", "88 mmHg", "78 mmHg"],
      },
      {
        rawValue: "-80 mmHg",
        correctedValue: "80 mmHg",
        errorType: "negative-value",
        hint: "Negative diastolic reading",
        explanation:
          "Arterial pressure cannot be negative. Strip minus sign to 80 mmHg.",
        ctCode: "C25299",
        options: ["80 mmHg", "-80 mmHg", "0 mmHg", "85 mmHg"],
      },
    ],
  },
  {
    field: "Heart Rate",
    destination: "VS",
    testCode: "HR",
    validValues: ["68 bpm", "72 bpm", "80 bpm", "62 bpm"],
    corruptions: [
      {
        rawValue: "720 bpm",
        correctedValue: "72 bpm",
        errorType: "range-outlier",
        hint: "Supra-physiological tachy-typo (>300 bpm)",
        explanation:
          "720 bpm is fatal ventricular fibrillation artifact. Correct decimal entry to 72 bpm.",
        ctCode: "C49673",
        options: ["72 bpm", "720 bpm", "70 bpm", "120 bpm"],
      },
      {
        rawValue: "7 bpm",
        correctedValue: "70 bpm",
        errorType: "missing-digit",
        hint: "Missing digit for heart rate",
        explanation:
          "7 bpm is extreme bradycardia incompatible with conscious office visit. Correct to 70 bpm.",
        ctCode: "C49673",
        options: ["70 bpm", "7 bpm", "77 bpm", "60 bpm"],
      },
    ],
  },
  {
    field: "Body Temp",
    destination: "VS",
    testCode: "TEMP",
    validValues: ["36.8 °C", "37.1 °C", "36.6 °C", "37.0 °C"],
    corruptions: [
      {
        rawValue: "98.6 °F",
        correctedValue: "37.0 °C",
        errorType: "unit-error",
        hint: "Fahrenheit recorded in Celsius trial form",
        explanation:
          "Convert 98.6 °F using (98.6 - 32) * 5/9 = 37.0 °C standard.",
        ctCode: "C25206",
        options: ["37.0 °C", "98.6 °C", "36.5 °C", "38.2 °C"],
      },
      {
        rawValue: "370 °C",
        correctedValue: "37.0 °C",
        errorType: "range-outlier",
        hint: "Missing decimal point",
        explanation:
          "370 °C is boiling furnace temperature. Correct missing decimal point to 37.0 °C.",
        ctCode: "C25206",
        options: ["37.0 °C", "370 °C", "36.0 °C", "39.0 °C"],
      },
    ],
  },

  // ==================== AE (Adverse Events) ====================
  {
    field: "Adverse Event Term",
    destination: "AE",
    testCode: "AETERM",
    validValues: [
      "Headache (Grade 1)",
      "Nausea (Grade 1)",
      "Fatigue (Grade 1)",
      "No AE reported",
    ],
    corruptions: [
      {
        rawValue: "headache bad",
        correctedValue: "Headache (Grade 2)",
        errorType: "casing-mismatch",
        hint: "Map free-text verbatim to MedDRA PT: Headache",
        explanation:
          "ICH GCP requires mapping verbatim text 'headache bad' to MedDRA Preferred Term 'Headache' with severity Grade 2.",
        ctCode: "MedDRA:10019211",
        options: [
          "Headache (Grade 2)",
          "Headache Bad (Grade 1)",
          "Cephalea Severe",
          "Migraine (Grade 3)",
        ],
      },
      {
        rawValue: "PATIENT DIZZY",
        correctedValue: "Dizziness (Grade 1)",
        errorType: "casing-mismatch",
        hint: "Standardize MedDRA Preferred Term capitalization",
        explanation:
          "Map ALL-CAPS verbatim entry 'PATIENT DIZZY' to MedDRA PT 'Dizziness' Grade 1.",
        ctCode: "MedDRA:10013573",
        options: [
          "Dizziness (Grade 1)",
          "PATIENT DIZZY",
          "Vertigo (Grade 2)",
          "Lightheadedness",
        ],
      },
    ],
  },
  {
    field: "AE Severity Grade",
    destination: "AE",
    testCode: "AESEV",
    validValues: ["Grade 1 (Mild)", "Grade 2 (Moderate)", "Grade 3 (Severe)"],
    corruptions: [
      {
        rawValue: "Grade 9",
        correctedValue: "Grade 3 (Severe)",
        errorType: "range-outlier",
        hint: "NCI-CTCAE max severity scale is 1 to 5",
        explanation:
          "NCI Common Terminology Criteria for Adverse Events (CTCAE v5.0) ranges from 1 to 5. Cap invalid grade 9 to Grade 3.",
        ctCode: "CTCAE:v5",
        options: [
          "Grade 3 (Severe)",
          "Grade 9",
          "Grade 5 (Death)",
          "Grade 1 (Mild)",
        ],
      },
    ],
  },
  {
    field: "AE Serious Criteria",
    destination: "AE",
    testCode: "AESER",
    validValues: [
      "No",
      "Yes (Hospitalization Required)",
      "Yes (Life Threatening)",
    ],
    corruptions: [
      {
        rawValue: "maybe",
        correctedValue: "No",
        errorType: "casing-mismatch",
        hint: "Binary regulatory criteria (Yes/No required per 21 CFR § 312.32)",
        explanation:
          "FDA 21 CFR § 312.32 regulatory safety reporting requires strict binary classification ('Y' / 'N').",
        ctCode: "C66742",
        options: ["No", "Yes", "Pending", "Unknown"],
      },
    ],
  },

  // ==================== LB (Laboratory) ====================
  {
    field: "Serum Creatinine",
    destination: "LB",
    testCode: "CREAT",
    validValues: ["0.9 mg/dL", "1.1 mg/dL", "0.8 mg/dL", "1.2 mg/dL"],
    corruptions: [
      {
        rawValue: "90 mg/dL",
        correctedValue: "0.9 mg/dL",
        errorType: "range-outlier",
        hint: "Missing leading zero decimal",
        explanation:
          "90 mg/dL represents severe acute renal failure artifact. Correct to normal biological reference range (0.9 mg/dL).",
        ctCode: "C25347",
        options: ["0.9 mg/dL", "90 mg/dL", "9.0 mg/dL", "0.09 mg/dL"],
      },
      {
        rawValue: "-1.0 mg/dL",
        correctedValue: "1.0 mg/dL",
        errorType: "negative-value",
        hint: "Negative biochemistry concentration",
        explanation:
          "Serum analyte concentrations cannot be negative. Normalize to 1.0 mg/dL.",
        ctCode: "C25347",
        options: ["1.0 mg/dL", "-1.0 mg/dL", "0.1 mg/dL", "0.0 mg/dL"],
      },
    ],
  },
  {
    field: "ALT (Alanine Aminotransferase)",
    destination: "LB",
    testCode: "ALT",
    validValues: ["24 U/L", "31 U/L", "19 U/L", "40 U/L"],
    corruptions: [
      {
        rawValue: "2400 U/L",
        correctedValue: "24 U/L",
        errorType: "range-outlier",
        hint: "Check sample dilution / decimal error",
        explanation:
          "2400 U/L suggests fulminant hepatic necrosis artifact. Correct 100x decimal scale factor to 24 U/L.",
        ctCode: "C64433",
        options: ["24 U/L", "2400 U/L", "240 U/L", "2.4 U/L"],
      },
    ],
  },
  {
    field: "White Blood Cells",
    destination: "LB",
    testCode: "WBC",
    validValues: ["6.2 x10^9/L", "7.5 x10^9/L", "5.1 x10^9/L", "8.9 x10^9/L"],
    corruptions: [
      {
        rawValue: "6200000000000 /L",
        correctedValue: "6.2 x10^9/L",
        errorType: "unit-error",
        hint: "Scientific notation normalization required",
        explanation:
          "Normalize raw SI particle count to standard CDISC laboratory notation (6.2 x10^9/L).",
        ctCode: "C51948",
        options: [
          "6.2 x10^9/L",
          "62 x10^9/L",
          "6200000000000 /L",
          "0.62 x10^9/L",
        ],
      },
    ],
  },

  // ==================== CM (Concomitant Medications) ====================
  {
    field: "ConMed Medication",
    destination: "CM",
    testCode: "CMTRT",
    validValues: [
      "Acetaminophen 500mg",
      "Lisinopril 10mg",
      "Metformin 850mg",
      "Atorvastatin 20mg",
    ],
    corruptions: [
      {
        rawValue: "tylenol extra",
        correctedValue: "Acetaminophen 500mg",
        errorType: "casing-mismatch",
        hint: "Map brand name to WHO-Drug standardized generic name & strength",
        explanation:
          "ICH E6 GCP requires reconciling trade name 'Tylenol Extra' to WHO Drug Dictionary Preferred Name 'Acetaminophen 500mg'.",
        ctCode: "WHODrug:000182",
        options: [
          "Acetaminophen 500mg",
          "Tylenol Extra",
          "Paracetamol 1000mg",
          "Ibuprofen 400mg",
        ],
      },
      {
        rawValue: "ST. JOHN'S WORT",
        correctedValue: "Prohibited Herbal Supplement (Flagged)",
        errorType: "unapproved-conmed",
        hint: "Potent CYP3A4 inducer prohibited by study protocol",
        explanation:
          "St. John's Wort is a prohibited concomitant medication due to severe CYP3A4 drug-drug interaction risk.",
        ctCode: "PROHIBITED-01",
        options: [
          "Prohibited Herbal Supplement (Flagged)",
          "Approved ConMed",
          "Placebo",
          "Vitamin C",
        ],
      },
    ],
  },
  {
    field: "ConMed Frequency",
    destination: "CM",
    testCode: "CMDOSFRQ",
    validValues: [
      "BID (Twice Daily)",
      "QD (Once Daily)",
      "PRN (As Needed)",
      "TID (Three Times Daily)",
    ],
    corruptions: [
      {
        rawValue: "2x per day whenever",
        correctedValue: "BID (Twice Daily)",
        errorType: "casing-mismatch",
        hint: "Map colloquial free-text to CDISC Frequency codelist (C71113)",
        explanation:
          "CDISC Controlled Terminology codelist C71113 maps 'twice daily' to standard abbreviation 'BID'.",
        ctCode: "C71113",
        options: [
          "BID (Twice Daily)",
          "QD (Once Daily)",
          "PRN (As Needed)",
          "QID (Four Times Daily)",
        ],
      },
    ],
  },

  // ==================== EX (Exposure / Drug Dosing) ====================
  {
    field: "Investigational Dose",
    destination: "EX",
    testCode: "EXDOSE",
    validValues: ["50 mg", "100 mg", "150 mg", "200 mg"],
    corruptions: [
      {
        rawValue: "5000 mg",
        correctedValue: "50 mg",
        errorType: "dose-calculation-error",
        hint: "100x Overdose Risk! Reconcile Investigational Product kit",
        explanation:
          "5000 mg represents a catastrophic 100x overdose beyond protocol max ceiling (200 mg). Correct to Phase II cohort dose 50 mg.",
        ctCode: "C25488",
        options: ["50 mg", "5000 mg", "500 mg", "5 mg"],
      },
      {
        rawValue: "-100 mg",
        correctedValue: "100 mg",
        errorType: "negative-value",
        hint: "Negative drug exposure recorded",
        explanation:
          "Drug administration quantity cannot be negative. Normalize to 100 mg.",
        ctCode: "C25488",
        options: ["100 mg", "-100 mg", "0 mg", "10 mg"],
      },
    ],
  },
  {
    field: "Dose Route",
    destination: "EX",
    testCode: "EXROUTE",
    validValues: ["ORAL", "INTRAVENOUS", "SUBCUTANEOUS"],
    corruptions: [
      {
        rawValue: "mouth by pill",
        correctedValue: "ORAL",
        errorType: "casing-mismatch",
        hint: "CDISC Route of Administration codelist (C38114)",
        explanation:
          "CDISC SDTM codelist C38114 standardizes 'by mouth' to FDA NCIt term 'ORAL'.",
        ctCode: "C38114",
        options: ["ORAL", "INTRAVENOUS", "SUBCUTANEOUS", "INHALATION"],
      },
    ],
  },

  // ==================== DS (Disposition) ====================
  {
    field: "Protocol Disposition",
    destination: "DS",
    testCode: "DSDECOD",
    validValues: [
      "COMPLETED",
      "ADVERSE EVENT",
      "WITHDRAWAL BY SUBJECT",
      "LOST TO FOLLOW-UP",
    ],
    corruptions: [
      {
        rawValue: "patient dropped out cause sick",
        correctedValue: "ADVERSE EVENT",
        errorType: "casing-mismatch",
        hint: "CDISC Standard Disposition codelist (C66727)",
        explanation:
          "Subject discontinuation due to sickness must be coded as primary reason 'ADVERSE EVENT' in SDTM DS domain.",
        ctCode: "C66727",
        options: [
          "ADVERSE EVENT",
          "COMPLETED",
          "WITHDRAWAL BY SUBJECT",
          "LOST TO FOLLOW-UP",
        ],
      },
    ],
  },

  // ==================== MH (Medical History) ====================
  {
    field: "Historical Condition",
    destination: "MH",
    testCode: "MHTERM",
    validValues: [
      "Hypertension (Resolved)",
      "Type 2 Diabetes",
      "Asthma (Mild)",
      "No Prior History",
    ],
    corruptions: [
      {
        rawValue: "high blood pressure since 2012",
        correctedValue: "Hypertension (Ongoing)",
        errorType: "casing-mismatch",
        hint: "Standardize to MedDRA High Level Group Term / Preferred Term",
        explanation:
          "Verbatim 'high blood pressure' maps to MedDRA PT 'Hypertension' with status 'Ongoing'.",
        ctCode: "MedDRA:10020772",
        options: [
          "Hypertension (Ongoing)",
          "High Blood Pressure 2012",
          "Hypotension",
          "Cardiomegaly",
        ],
      },
    ],
  },
];

export const ALL_STATIONS: StationConfig[] = [
  {
    id: "DM",
    name: "Demographics",
    label: "DM Station",
    description:
      "Demographics, age, sex, race, metric height/weight standardization",
    color: "#3b82f6",
    accentColor: "rgba(59, 130, 246, 0.2)",
    positionIndex: 0,
    vendor: "iMednet",
    pendingSubjects: [],
    processedCount: 0,
  },
  {
    id: "VS",
    name: "Vital Signs",
    label: "VS Station",
    description: "Blood pressure, heart rate, temperature, respiratory metrics",
    color: "#10b981",
    accentColor: "rgba(16, 185, 129, 0.2)",
    positionIndex: 1,
    vendor: "Veeva Vault",
    pendingSubjects: [],
    processedCount: 0,
  },
  {
    id: "AE",
    name: "Adverse Events",
    label: "AE Station",
    description: "MedDRA coding, CTCAE grading, SAE 24-hr FDA expedited triage",
    color: "#f59e0b",
    accentColor: "rgba(245, 158, 11, 0.2)",
    positionIndex: 2,
    vendor: "iMednet",
    pendingSubjects: [],
    processedCount: 0,
  },
  {
    id: "LB",
    name: "Laboratory",
    label: "LB Station",
    description:
      "Serum chemistry, hematology, urinalysis, biological reference ranges",
    color: "#8b5cf6",
    accentColor: "rgba(139, 92, 246, 0.2)",
    positionIndex: 3,
    vendor: "OpenClinica",
    pendingSubjects: [],
    processedCount: 0,
  },
  {
    id: "CM",
    name: "Concomitant Meds",
    label: "CM Station",
    description: "WHO Drug Dictionary coding, CYP3A4 interaction screening",
    color: "#ec4899",
    accentColor: "rgba(236, 72, 153, 0.2)",
    positionIndex: 4,
    vendor: "Medidata Rave",
    pendingSubjects: [],
    processedCount: 0,
  },
  {
    id: "EX",
    name: "Drug Exposure",
    label: "EX Station",
    description:
      "Investigational product dose reconciliation, route, and schedule audit",
    color: "#06b6d4",
    accentColor: "rgba(6, 182, 212, 0.2)",
    positionIndex: 5,
    vendor: "Oracle InForm",
    pendingSubjects: [],
    processedCount: 0,
  },
  {
    id: "DS",
    name: "Disposition",
    label: "DS Station",
    description:
      "Study completion, early withdrawal, protocol milestone tracking",
    color: "#14b8a6",
    accentColor: "rgba(20, 184, 166, 0.2)",
    positionIndex: 6,
    vendor: "Veeva Vault",
    pendingSubjects: [],
    processedCount: 0,
  },
  {
    id: "MH",
    name: "Medical History",
    label: "MH Station",
    description: "Baseline disease conditions, prior surgeries, comorbidities",
    color: "#6366f1",
    accentColor: "rgba(99, 102, 241, 0.2)",
    positionIndex: 7,
    vendor: "iMednet",
    pendingSubjects: [],
    processedCount: 0,
  },
];

export const INITIAL_STATIONS: StationConfig[] = ALL_STATIONS.slice(0, 4);

export function getStationsForPhase(
  phase: GamePhase,
  mode: GameMode = "campaign"
): StationConfig[] {
  if (mode === "endless") {
    return ALL_STATIONS.slice(0, 6);
  }
  if (phase === 1) {
    return ALL_STATIONS.slice(0, 4);
  } else if (phase === 2) {
    return ALL_STATIONS.slice(0, 6);
  }
  // Phase 3 opens the last two domains, DS and MH, as the clear screen
  // promises (#1326).
  return ALL_STATIONS.slice(0, 8);
}

export const AMENDMENT_PRESETS: ProtocolAmendment[] = [
  {
    id: "amd-001",
    version: "Protocol v2.1",
    title: "Station Conveyor Scramble",
    description:
      "IRB approved site workflow restructuring: station conveyor docks swapped!",
    type: "station-scramble",
    durationSeconds: 18,
    timeRemaining: 18,
    active: false,
  },
  {
    id: "amd-002",
    version: "Safety Alert v4.0",
    title: "SAE Emergency Expedited Priority",
    description:
      "Serious Adverse Event reported! Urgent 24-hr FDA Form 3500A expedited triage required.",
    type: "sae-priority-rush",
    durationSeconds: 16,
    timeRemaining: 16,
    active: false,
  },
  {
    id: "amd-003",
    version: "Protocol v3.0",
    title: "Metric Normalization Mandate",
    description:
      "Global harmonization: All imperial units must be converted to metric immediately.",
    type: "unit-shift-lbs-to-kg",
    durationSeconds: 20,
    timeRemaining: 20,
    active: false,
  },
  {
    id: "amd-004",
    version: "GCP Compliance Notice v5.2",
    title: "ConMed CYP3A4 Screening Surge",
    description:
      "FDA alert on drug-drug interactions: Concomitant Medication reconciliation required on all active cohorts.",
    type: "conmed-reconciliation-rush",
    durationSeconds: 22,
    timeRemaining: 22,
    active: false,
  },
];

const STUDY_SITES = [
  "Site 014 (Boston General)",
  "Site 022 (Charité Berlin)",
  "Site 008 (Mount Sinai NYC)",
  "Site 041 (Mayo Clinic Rochester)",
  "Site 019 (Karolinska Solna)",
  "Site 033 (Oxford Clinical Hub)",
];

// Seeded scenarios use SUBJ-1001..1003, so generated subjects start after them.
let globalSubjSeq = 1004;

/**
 * Generates a random or seeded ClinicalSubject with 2-4 observations.
 */
export function generateClinicalSubject(
  errorProbability = 0.5,
  forceSAE = false,
  customSeq?: number,
  activeDomains: CDISCDomain[] = ["DM", "VS", "AE", "LB"]
): ClinicalSubject {
  const seq = customSeq ?? globalSubjSeq++;
  const subjectLabel = `SUBJ-${seq}`;
  const siteIndex = seq % STUDY_SITES.length;
  const studySite = STUDY_SITES[siteIndex];

  // Filter templates by currently active stations/domains
  const eligibleTemplates = MOCK_OBSERVATION_TEMPLATES.filter((t) =>
    activeDomains.includes(t.destination)
  );

  const pool =
    eligibleTemplates.length >= 2
      ? eligibleTemplates
      : MOCK_OBSERVATION_TEMPLATES;

  // Pick 2 to 3 observations across different CDISC domains
  const pickedTemplates = [...pool]
    .sort(() => 0.5 - Math.random())
    .slice(0, forceSAE ? 3 : Math.floor(Math.random() * 2) + 2);

  // If forceSAE, guarantee at least one AE observation
  if (forceSAE && !pickedTemplates.some((t) => t.destination === "AE")) {
    const aeTemplate = MOCK_OBSERVATION_TEMPLATES.find(
      (t) => t.destination === "AE"
    );
    if (aeTemplate) pickedTemplates[0] = aeTemplate;
  }

  const observations: ClinicalObservation[] = pickedTemplates.map(
    (template, idx) => {
      const hasError = Math.random() < errorProbability;
      if (hasError && template.corruptions.length > 0) {
        const corruption =
          template.corruptions[
            Math.floor(Math.random() * template.corruptions.length)
          ];
        const astRule: EditCheckRule = {
          id: `ast_rule_${seq}_${idx}`,
          name: `CDISC Standard ${template.field} Rule`,
          description: corruption.explanation,
          triggerFieldIds: [template.field],
          actionType: "raise_query",
          targetFieldId: template.field,
          conditions: [
            {
              fieldId: template.field,
              operator: "eq",
              value: corruption.correctedValue,
            },
          ],
          logicalOperator: "AND",
          queryMessage: corruption.explanation,
        };
        return {
          id: `obs-${seq}-${idx}`,
          field: template.field,
          rawValue: corruption.rawValue,
          correctedValue: corruption.correctedValue,
          currentValue: corruption.rawValue,
          destination: template.destination,
          errorType: corruption.errorType,
          hint: corruption.hint,
          explanation: corruption.explanation,
          ctCode: corruption.ctCode,
          options: corruption.options,
          isResolved: false,
          astRule,
        };
      } else {
        const validVal =
          template.validValues[
            Math.floor(Math.random() * template.validValues.length)
          ];
        const astRule: EditCheckRule = {
          id: `ast_rule_valid_${seq}_${idx}`,
          name: `CDISC Standard ${template.field} Rule`,
          description: `Value must equal ${validVal}`,
          triggerFieldIds: [template.field],
          actionType: "raise_query",
          targetFieldId: template.field,
          conditions: [
            {
              fieldId: template.field,
              operator: "eq",
              value: validVal,
            },
          ],
          logicalOperator: "AND",
        };
        return {
          id: `obs-${seq}-${idx}`,
          field: template.field,
          rawValue: validVal,
          currentValue: validVal,
          destination: template.destination,
          ctCode: template.testCode,
          isResolved: true,
          astRule,
        };
      }
    }
  );

  const maxTime = forceSAE ? 22 : 36;

  return {
    id: `subject-${seq}-${Date.now()}`,
    subjectLabel,
    studySite,
    observations,
    status: "queued",
    isSAE: forceSAE,
    timeRemaining: maxTime,
    maxTime,
    createdAt: Date.now(),
  };
}

/**
 * Game stations that stand in for CDASH domains the conveyor has no dock for,
 * so every protocol form still routes somewhere the player can reach.
 */
const PROTOCOL_DOMAIN_ALIASES: Record<string, CDISCDomain> = {
  IC: "DS",
  EG: "VS",
  QS: "MH",
  PC: "LB",
  TR: "LB",
  DA: "EX",
  DI: "EX",
  DU: "EX",
  DE: "AE",
};

function resolveProtocolDestination(
  formDomain: string | undefined,
  activeDomains: CDISCDomain[]
): CDISCDomain {
  const domain = (formDomain || "").toUpperCase();
  if (activeDomains.includes(domain as CDISCDomain)) {
    return domain as CDISCDomain;
  }
  const alias = PROTOCOL_DOMAIN_ALIASES[domain];
  if (alias && activeDomains.includes(alias)) return alias;
  return activeDomains[0] ?? "DM";
}

/**
 * Picks a compliant and a non-compliant entry for a protocol field from its
 * own metadata (codelist, unit, date type or default), never from an authored
 * edit check: those can describe the query condition, reference other fields,
 * or compare against a threshold, so their literal is not a valid answer.
 */
function getProtocolFieldValues(field: CRFField): {
  validVal: string;
  invalidVal: string;
} {
  if (field.customOptions && field.customOptions.length > 0) {
    const validVal =
      field.customOptions[0].label || field.customOptions[0].code;
    const second = field.customOptions[1];
    const invalidVal =
      second && (second.label || second.code) !== validVal
        ? second.label || second.code
        : "Invalid Code";
    return { validVal, invalidVal };
  }
  if (field.dataType === "date" || field.dataType === "partial_date") {
    return { validVal: "2024-03-15", invalidVal: "15/03/2024" };
  }
  if (field.unit) {
    return { validVal: `100 ${field.unit}`, invalidVal: `10000 ${field.unit}` };
  }
  if (
    field.defaultValue !== undefined &&
    field.defaultValue !== null &&
    String(field.defaultValue).trim() !== ""
  ) {
    return {
      validVal: String(field.defaultValue),
      invalidVal: "Non-Compliant",
    };
  }
  return { validVal: "Compliant", invalidVal: "Non-Compliant" };
}

/**
 * Generates a ClinicalSubject populated directly from an active StudyProtocol definition.
 * Observations route only to `activeDomains`, and each carries a single-field
 * answer rule that exactly one of its options satisfies.
 */
export function generateClinicalSubjectFromProtocol(
  protocol: StudyProtocol,
  errorProbability = 0.5,
  forceSAE = false,
  customSeq?: number,
  activeDomains: CDISCDomain[] = ["DM", "VS", "AE", "LB"]
): ClinicalSubject {
  const seq = customSeq ?? globalSubjSeq++;
  const subjectLabel = `SUBJ-${seq}`;
  const siteIndex = seq % STUDY_SITES.length;
  const studySite = STUDY_SITES[siteIndex];

  const observations: ClinicalObservation[] = [];

  const formsToUse =
    protocol.forms && protocol.forms.length > 0 ? protocol.forms : [];

  formsToUse.forEach((form, fIdx) => {
    const fields = form.sections.flatMap((s) => s.fields);
    if (fields.length === 0) return;

    const field = fields[fIdx % fields.length];
    const destination = resolveProtocolDestination(form.domain, activeDomains);

    const authoredRule = [
      ...(form.rules || []),
      ...(protocol.rules || []),
    ].find(
      (r) =>
        r.targetFieldId === field.id ||
        r.targetFieldId === field.variableName ||
        r.triggerFieldIds.includes(field.id) ||
        r.triggerFieldIds.includes(field.variableName)
    );
    const ruleName =
      authoredRule?.name ?? `Protocol Rule for ${field.variableName}`;

    // An authored single-field equality check names the compliant value
    // directly; anything else only lends its name to the hint.
    const authoredCondition =
      authoredRule &&
      !authoredRule.unsupportedExpression &&
      !(
        authoredRule.conditionGroups && authoredRule.conditionGroups.length > 0
      ) &&
      authoredRule.conditions.length === 1 &&
      authoredRule.conditions[0].operator === "eq" &&
      !authoredRule.conditions[0].crossVisitId &&
      [field.id, field.variableName].includes(
        authoredRule.conditions[0].fieldId
      )
        ? authoredRule.conditions[0]
        : undefined;
    const fieldValues = getProtocolFieldValues(field);
    const validVal =
      authoredCondition && String(authoredCondition.value ?? "").trim() !== ""
        ? String(authoredCondition.value)
        : fieldValues.validVal;
    const invalidVal =
      fieldValues.invalidVal.toLowerCase() !== validVal.toLowerCase()
        ? fieldValues.invalidVal
        : "Invalid Code";
    const explanation =
      authoredRule?.description ||
      `${field.label || field.variableName} must be recorded as '${validVal}' per protocol ${protocol.protocolNumber}.`;

    const answerRule: EditCheckRule = {
      id: `rule_${field.id}_${seq}`,
      name: ruleName,
      description: explanation,
      triggerFieldIds: [field.id],
      actionType: "raise_query",
      targetFieldId: field.id,
      conditions: [{ fieldId: field.id, operator: "eq", value: validVal }],
      logicalOperator: "AND",
      queryMessage: `Query on ${field.label || field.variableName}: the selected entry does not satisfy ${ruleName}.`,
    };

    const hasError = Math.random() < errorProbability;
    const rawValue = hasError ? invalidVal : validVal;

    observations.push({
      id: `obs-proto-${seq}-${fIdx}`,
      field: field.label || field.variableName,
      fieldId: field.id,
      rawValue,
      correctedValue: validVal,
      currentValue: rawValue,
      destination,
      errorType: hasError ? "casing-mismatch" : undefined,
      hint: `Protocol rule: ${ruleName}`,
      explanation,
      ctCode: field.variableName,
      // Choices compare case-insensitively, so dedupe the same way to keep
      // exactly one accepted option.
      options: [validVal, invalidVal, "Unverified Code", "Unknown"].filter(
        (option, i, all) =>
          all.findIndex((o) => o.toLowerCase() === option.toLowerCase()) === i
      ),
      isResolved: !hasError,
      astRule: answerRule,
    });
  });

  if (observations.length === 0) {
    return generateClinicalSubject(
      errorProbability,
      forceSAE,
      customSeq,
      activeDomains
    );
  }

  const maxTime = forceSAE ? 22 : 36;

  return {
    id: `subject-${seq}-${Date.now()}`,
    subjectLabel,
    studySite,
    observations,
    status: "queued",
    isSAE: forceSAE,
    timeRemaining: maxTime,
    maxTime,
    createdAt: Date.now(),
  };
}

/** Pre-seeded scenario list for tests and deterministic introductory rounds. */
export const SEEDED_SCENARIOS: readonly ClinicalSubject[] = [
  {
    id: "seeded-001",
    subjectLabel: "SUBJ-1001",
    studySite: "Site 014 (Boston General)",
    status: "queued",
    timeRemaining: 40,
    maxTime: 40,
    createdAt: 1000,
    observations: [
      {
        id: "obs-1001-1",
        field: "Height",
        rawValue: "180 m",
        correctedValue: "180 cm",
        currentValue: "180 m",
        destination: "DM",
        errorType: "unit-error",
        hint: "Meters unit anomaly (expected cm)",
        explanation:
          "CDISC SDTM DM domain specifies metric height standard (cm).",
        ctCode: "C25473",
        options: ["180 cm", "1.80 m", "1800 mm", "70.8 in"],
        isResolved: false,
      },
      {
        id: "obs-1001-2",
        field: "Systolic BP",
        rawValue: "120 mmHg",
        currentValue: "120 mmHg",
        destination: "VS",
        isResolved: true,
      },
    ],
  },
  {
    id: "seeded-002",
    subjectLabel: "SUBJ-1002",
    studySite: "Site 022 (Charité Berlin)",
    status: "queued",
    timeRemaining: 40,
    maxTime: 40,
    createdAt: 1001,
    observations: [
      {
        id: "obs-1002-1",
        field: "Date of Birth",
        rawValue: "12/25/1990",
        correctedValue: "1990-12-25",
        currentValue: "12/25/1990",
        destination: "DM",
        errorType: "invalid-date",
        hint: "US MM/DD/YYYY entry (ISO 8601 YYYY-MM-DD required)",
        explanation:
          "12/25/1990 is month 12, day 25 in US MM/DD/YYYY order. Reorder to ISO 8601 YYYY-MM-DD: 1990-12-25.",
        ctCode: "ISO8601",
        options: ["1990-12-25", "1990-25-12", "25-12-1990", "12/25/1990"],
        isResolved: false,
      },
      {
        id: "obs-1002-2",
        field: "Weight",
        rawValue: "-75 kg",
        correctedValue: "75 kg",
        currentValue: "-75 kg",
        destination: "DM",
        errorType: "negative-value",
        hint: "Negative weight recorded",
        explanation: "Remove leading negative polarity sign.",
        ctCode: "C25208",
        options: ["75 kg", "0 kg", "7.5 kg", "75 lbs"],
        isResolved: false,
      },
    ],
  },
  {
    id: "seeded-003",
    subjectLabel: "SUBJ-1003",
    studySite: "Site 008 (Mount Sinai NYC)",
    status: "queued",
    isSAE: true,
    timeRemaining: 28,
    maxTime: 28,
    createdAt: 1002,
    observations: [
      {
        id: "obs-1003-1",
        field: "Adverse Event Term",
        rawValue: "headache bad",
        correctedValue: "Headache (Grade 2)",
        currentValue: "headache bad",
        destination: "AE",
        errorType: "casing-mismatch",
        hint: "Map free-text to MedDRA PT: Headache",
        explanation:
          "Map verbatim text 'headache bad' to MedDRA Preferred Term 'Headache' Grade 2.",
        ctCode: "MedDRA:10019211",
        options: [
          "Headache (Grade 2)",
          "Headache Bad (Grade 1)",
          "Cephalea Severe",
          "Migraine (Grade 3)",
        ],
        isResolved: false,
      },
      {
        id: "obs-1003-2",
        field: "Serum Creatinine",
        rawValue: "0.9 mg/dL",
        currentValue: "0.9 mg/dL",
        destination: "LB",
        isResolved: true,
      },
    ],
  },
];

export const DEFAULT_STRESS_PARAMS: StressParameters = {
  arrivalRateMultiplier: 1.0,
  errorChance: 0.5,
  auditorPacingMultiplier: 1.0,
};

export const STRESS_PRESETS: Record<StressPresetId, StressPreset> = {
  baseline: {
    id: "baseline",
    name: "Standard Baseline",
    description:
      "Standard protocol operating parameters under normal site monitoring.",
    params: {
      arrivalRateMultiplier: 1.0,
      errorChance: 0.5,
      auditorPacingMultiplier: 1.0,
    },
  },
  audit_rush: {
    id: "audit_rush",
    name: "21 CFR Audit Rush",
    description:
      "Accelerated FDA auditor inspection pacing with heightened scrutiny and faster suspicion escalation.",
    params: {
      arrivalRateMultiplier: 1.5,
      errorChance: 0.6,
      auditorPacingMultiplier: 2.2,
    },
  },
  influx_surge: {
    id: "influx_surge",
    name: "Multi-Site Influx Surge",
    description:
      "Rapid subject recruitment influx causing high conveyor volume and increased observation error density.",
    params: {
      arrivalRateMultiplier: 2.5,
      errorChance: 0.75,
      auditorPacingMultiplier: 1.2,
    },
  },
  extreme_chaos: {
    id: "extreme_chaos",
    name: "Extreme Protocol Stress",
    description:
      "Maximum trial chaos: intense subject influx, elevated error rate, and relentless auditor inspection.",
    params: {
      arrivalRateMultiplier: 3.0,
      errorChance: 0.9,
      auditorPacingMultiplier: 2.5,
    },
  },
};
