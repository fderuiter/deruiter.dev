import { CodelistDefinition } from "./types";

/**
 * The CDISC Controlled Terminology package that the codelist and term codes
 * below were checked against: the NCI EVS SDTM Terminology release of
 * 2026-09-25.
 */
export const CDISC_CT_PACKAGE_VERSION = "SDTM CT 2026-09-25";

/**
 * Standard codelists offered by CRF Studio.
 *
 * A codelist that CDISC publishes carries its NCI codelist code, and each
 * term carries the CDISC submission value and NCI code from
 * {@link CDISC_CT_PACKAGE_VERSION}. A codelist that CDISC does not publish
 * (AEREL, MHCAT, the device tracking lists) is sponsor-defined: it has no
 * NCI codelist code and its terms have no NCI codes, because a code borrowed
 * from another concept would be published in every ODM, Define-XML and SAS
 * export.
 */
export const STANDARD_CODELISTS: CodelistDefinition[] = [
  {
    id: "CL_NY",
    name: "No Yes Response (NY)",
    nciCodelistCode: "C66742",
    isStandard: true,
    options: [
      { code: "N", label: "No", nciCode: "C49487", order: 1 },
      { code: "Y", label: "Yes", nciCode: "C49488", order: 2 },
    ],
  },
  {
    id: "CL_SEX",
    name: "Sex (SEX)",
    nciCodelistCode: "C66731",
    isStandard: true,
    options: [
      { code: "M", label: "Male", nciCode: "C20197", order: 1 },
      { code: "F", label: "Female", nciCode: "C16576", order: 2 },
      { code: "INTERSEX", label: "Intersex", nciCode: "C45908", order: 3 },
      { code: "U", label: "Unknown", nciCode: "C17998", order: 4 },
    ],
  },
  {
    // The SDTM RACE (C74457) and ETHNIC (C66790) codelists are no longer in
    // the CT package; collection uses the "as collected" codelists.
    id: "CL_RACE",
    name: "Race As Collected (RACEC)",
    nciCodelistCode: "C128689",
    isStandard: true,
    options: [
      {
        code: "AMERICAN INDIAN OR ALASKA NATIVE",
        label: "American Indian or Alaska Native",
        nciCode: "C41259",
        order: 1,
      },
      { code: "ASIAN", label: "Asian", nciCode: "C41260", order: 2 },
      {
        code: "BLACK OR AFRICAN AMERICAN",
        label: "Black or African American",
        nciCode: "C16352",
        order: 3,
      },
      {
        code: "NATIVE HAWAIIAN OR PACIFIC ISLANDER",
        label: "Native Hawaiian or Pacific Islander",
        nciCode: "C41219",
        order: 4,
      },
      { code: "WHITE", label: "White", nciCode: "C41261", order: 5 },
      { code: "OTHER", label: "Other", nciCode: "C17649", order: 6 },
    ],
  },
  {
    id: "CL_ETHNIC",
    name: "Ethnicity As Collected (ETHNICC)",
    nciCodelistCode: "C128690",
    isStandard: true,
    options: [
      {
        code: "HISPANIC OR LATINO",
        label: "Hispanic or Latino",
        nciCode: "C17459",
        order: 1,
      },
      {
        code: "NOT HISPANIC OR LATINO",
        label: "Not Hispanic or Latino",
        nciCode: "C41222",
        order: 2,
      },
      {
        code: "NOT REPORTED",
        label: "Not Reported",
        nciCode: "C43234",
        order: 3,
      },
      { code: "UNKNOWN", label: "Unknown", nciCode: "C17998", order: 4 },
    ],
  },
  {
    id: "CL_AESEV",
    name: "Severity/Intensity Scale for Adverse Events (AESEV)",
    nciCodelistCode: "C66769",
    isStandard: true,
    options: [
      { code: "MILD", label: "Mild", nciCode: "C41338", order: 1 },
      { code: "MODERATE", label: "Moderate", nciCode: "C41339", order: 2 },
      { code: "SEVERE", label: "Severe", nciCode: "C41340", order: 3 },
    ],
  },
  {
    // CTCAE grades are collected in AETOXGR. CDISC publishes no codelist for
    // them; the grade scale belongs to the CTCAE version the protocol names.
    id: "CL_AETOXGR",
    name: "CTCAE Toxicity Grade (AETOXGR, sponsor-defined)",
    isStandard: true,
    options: [
      { code: "1", label: "Grade 1 (Mild)", order: 1 },
      { code: "2", label: "Grade 2 (Moderate)", order: 2 },
      {
        code: "3",
        label: "Grade 3 (Severe or medically significant)",
        order: 3,
      },
      { code: "4", label: "Grade 4 (Life-threatening)", order: 4 },
      { code: "5", label: "Grade 5 (Death related to AE)", order: 5 },
    ],
  },
  {
    id: "CL_AEREL",
    name: "Causality / Relationship to Study Drug (AEREL, sponsor-defined)",
    isStandard: true,
    options: [
      { code: "NOT RELATED", label: "Not Related", order: 1 },
      { code: "UNLIKELY RELATED", label: "Unlikely Related", order: 2 },
      { code: "POSSIBLY RELATED", label: "Possibly Related", order: 3 },
      { code: "PROBABLY RELATED", label: "Probably Related", order: 4 },
      { code: "DEFINITELY RELATED", label: "Definitely Related", order: 5 },
    ],
  },
  {
    id: "CL_AEOUT",
    name: "Outcome of Event (OUT)",
    nciCodelistCode: "C66768",
    isStandard: true,
    options: [
      {
        code: "RECOVERED/RESOLVED",
        label: "Recovered / Resolved",
        nciCode: "C49498",
        order: 1,
      },
      {
        code: "RECOVERING/RESOLVING",
        label: "Recovering / Resolving",
        nciCode: "C49496",
        order: 2,
      },
      {
        code: "NOT RECOVERED/NOT RESOLVED",
        label: "Not Recovered / Not Resolved",
        nciCode: "C49494",
        order: 3,
      },
      {
        code: "RECOVERED/RESOLVED WITH SEQUELAE",
        label: "Recovered / Resolved with Sequelae",
        nciCode: "C49495",
        order: 4,
      },
      { code: "FATAL", label: "Fatal", nciCode: "C48275", order: 5 },
      { code: "UNKNOWN", label: "Unknown", nciCode: "C17998", order: 6 },
    ],
  },
  {
    id: "CL_RECIST_RESP",
    name: "Oncology Response Assessment Result (ONCRSR)",
    nciCodelistCode: "C96785",
    isStandard: true,
    options: [
      {
        code: "CR",
        label: "Complete Response (CR)",
        nciCode: "C4870",
        order: 1,
      },
      {
        code: "PR",
        label: "Partial Response (PR)",
        nciCode: "C18058",
        order: 2,
      },
      { code: "SD", label: "Stable Disease (SD)", nciCode: "C18213", order: 3 },
      {
        code: "PD",
        label: "Progressive Disease (PD)",
        nciCode: "C35571",
        order: 4,
      },
      { code: "NE", label: "Not Evaluable (NE)", nciCode: "C62222", order: 5 },
    ],
  },
  {
    id: "CL_ROUTE",
    name: "Route of Administration (ROUTE)",
    nciCodelistCode: "C66729",
    isStandard: true,
    options: [
      { code: "ORAL", label: "Oral (PO)", nciCode: "C38288", order: 1 },
      {
        code: "INTRAVENOUS",
        label: "Intravenous (IV)",
        nciCode: "C38276",
        order: 2,
      },
      {
        code: "SUBCUTANEOUS",
        label: "Subcutaneous (SC)",
        nciCode: "C38299",
        order: 3,
      },
      {
        code: "INTRAMUSCULAR",
        label: "Intramuscular (IM)",
        nciCode: "C28161",
        order: 4,
      },
      { code: "TOPICAL", label: "Topical", nciCode: "C38304", order: 5 },
      {
        code: "RESPIRATORY (INHALATION)",
        label: "Inhalation",
        nciCode: "C38216",
        order: 6,
      },
    ],
  },
  {
    id: "CL_DEDEF",
    name: "Device Deficiency / Incident Type (DEDEFIC, sponsor-defined)",
    isStandard: true,
    options: [
      { code: "MALFUNCTION", label: "Device Malfunction / Failure", order: 1 },
      { code: "USE ERROR", label: "User / Operator Error", order: 2 },
      {
        code: "INADEQUATE LABELING",
        label: "Inadequate IFU / Labeling",
        order: 3,
      },
      {
        code: "EARLY DETERIORATION",
        label: "Premature Wear / Deterioration",
        order: 4,
      },
      { code: "OTHER DEFICIENCY", label: "Other Device Deficiency", order: 5 },
    ],
  },
  {
    id: "CL_DEREL",
    name: "Device Relationship / Causality (DEREL, sponsor-defined)",
    isStandard: true,
    options: [
      {
        code: "DEFINITELY RELATED",
        label: "Definitely Related to Device",
        order: 1,
      },
      {
        code: "PROBABLY RELATED",
        label: "Probably Related to Device",
        order: 2,
      },
      {
        code: "POSSIBLY RELATED",
        label: "Possibly Related to Device",
        order: 3,
      },
      { code: "NOT RELATED", label: "Not Related to Device", order: 4 },
      {
        code: "PROCEDURE RELATED",
        label: "Related to Implantation Procedure Only",
        order: 5,
      },
    ],
  },
  {
    // DEACNDEV is extensible: REMOVAL and REPROGRAMMING are CDISC terms, the
    // others are sponsor extensions and carry no NCI code.
    id: "CL_DEACT",
    name: "Device Events Action Taken with Device (DEACNDEV)",
    nciCodelistCode: "C111110",
    isStandard: true,
    options: [
      {
        code: "REMOVAL",
        label: "Explanted / Removed from Subject",
        nciCode: "C61575",
        order: 1,
      },
      { code: "REPLACED", label: "Replaced with New Device", order: 2 },
      {
        code: "REPROGRAMMING",
        label: "Reprogrammed / Settings Adjusted",
        nciCode: "C111306",
        order: 3,
      },
      { code: "REPAIRED", label: "Repaired In-Situ", order: 4 },
      {
        code: "NO ACTION TAKEN",
        label: "No Action Taken / Kept In-Situ",
        order: 5,
      },
    ],
  },
  {
    id: "CL_DISTAT",
    name: "Device Implantation / Tracking Status (DISTAT, sponsor-defined)",
    isStandard: true,
    options: [
      {
        code: "IMPLANTED ACTIVE",
        label: "Implanted & Active In-Situ",
        order: 1,
      },
      { code: "EXPLANTED", label: "Explanted", order: 2 },
      {
        code: "DEPLOYMENT FAILED",
        label: "Deployment Failed / Never Implanted",
        order: 3,
      },
      { code: "STORED", label: "In Site Inventory / Stored", order: 4 },
    ],
  },
  {
    id: "CL_DUPROC",
    name: "Procedural Deployment Success (DUPROC, sponsor-defined)",
    isStandard: true,
    options: [
      {
        code: "COMPLETE SUCCESS",
        label: "Complete Procedural Success",
        order: 1,
      },
      {
        code: "PARTIAL SUCCESS",
        label: "Partial Success (Sub-optimal deployment)",
        order: 2,
      },
      {
        code: "PROCEDURE ABORTED",
        label: "Procedure Aborted / Cancelled",
        order: 3,
      },
      {
        code: "CONVERTED SURGERY",
        label: "Converted to Emergent Open Surgery",
        order: 4,
      },
    ],
  },
  {
    id: "CL_DSCONT",
    name: "Completion/Reason for Non-Completion (NCOMPLT)",
    nciCodelistCode: "C66727",
    isStandard: true,
    options: [
      {
        code: "COMPLETED",
        label: "Completed Protocol Defined Period",
        nciCode: "C25250",
        order: 1,
      },
      {
        code: "ADVERSE EVENT",
        label: "Adverse Event / Safety Concern",
        nciCode: "C41331",
        order: 2,
      },
      {
        code: "LACK OF EFFICACY",
        label: "Lack of Efficacy",
        nciCode: "C48226",
        order: 3,
      },
      {
        code: "WITHDRAWAL BY SUBJECT",
        label: "Withdrawal by Subject",
        nciCode: "C49634",
        order: 4,
      },
      {
        code: "LOST TO FOLLOW-UP",
        label: "Lost to Follow-Up",
        nciCode: "C48227",
        order: 5,
      },
      {
        code: "PHYSICIAN DECISION",
        label: "Investigator / Physician Decision",
        nciCode: "C48250",
        order: 6,
      },
      {
        code: "PROTOCOL VIOLATION",
        label: "Protocol Violation",
        nciCode: "C142185",
        order: 7,
      },
      { code: "DEATH", label: "Death", nciCode: "C28554", order: 8 },
    ],
  },
  {
    id: "CL_DARECON",
    name: "Drug Accountability Reconciliation (DARECON, sponsor-defined)",
    isStandard: true,
    options: [
      {
        code: "RECONCILED",
        label: "Fully Reconciled (100% Accounted)",
        order: 1,
      },
      { code: "DISCREPANCY", label: "Discrepancy Documented", order: 2 },
      {
        code: "LOST/DESTROYED",
        label: "Lost / Accidental Destruction",
        order: 3,
      },
    ],
  },
  {
    // Dose units are a subset of the UNIT codelist, whose submission values
    // are case-sensitive.
    id: "CL_DOSU",
    name: "Dose Units (UNIT)",
    nciCodelistCode: "C71620",
    isStandard: true,
    options: [
      { code: "mg", label: "Milligram (mg)", nciCode: "C28253", order: 1 },
      { code: "g", label: "Gram (g)", nciCode: "C48155", order: 2 },
      { code: "ug", label: "Microgram (ug)", nciCode: "C48152", order: 3 },
      { code: "mL", label: "Milliliter (mL)", nciCode: "C28254", order: 4 },
      {
        code: "mg/kg",
        label: "Milligrams per Kilogram (mg/kg)",
        nciCode: "C67401",
        order: 5,
      },
      {
        code: "mg/m2",
        label: "Milligrams per m² (mg/m²)",
        nciCode: "C67402",
        order: 6,
      },
      {
        code: "IU",
        label: "International Units (IU)",
        nciCode: "C48579",
        order: 7,
      },
      { code: "TABLET", label: "Tablet", nciCode: "C48542", order: 8 },
    ],
  },
  {
    id: "CL_MHCAT",
    name: "Medical History Body System (MHCAT, sponsor-defined)",
    isStandard: true,
    options: [
      { code: "CARDIOVASCULAR", label: "Cardiovascular / Vascular", order: 1 },
      { code: "RESPIRATORY", label: "Respiratory / Pulmonary", order: 2 },
      {
        code: "GASTROINTESTINAL",
        label: "Gastrointestinal / Hepatic",
        order: 3,
      },
      { code: "NEUROLOGICAL", label: "Neurological / Psychiatric", order: 4 },
      {
        code: "ENDOCRINE",
        label: "Endocrine / Metabolic (e.g. Diabetes)",
        order: 5,
      },
      { code: "ONCOLOGY", label: "Oncology / Prior Malignancy", order: 6 },
      {
        code: "MUSCULOSKELETAL",
        label: "Musculoskeletal / Rheumatology",
        order: 7,
      },
      { code: "OTHER", label: "Other Medical History", order: 8 },
    ],
  },
];

/**
 * Regex format for NCI Thesaurus Concept Codes (e.g., C66742, C49487)
 */
export const NCI_CODE_REGEX = /^C\d+$/i;

/**
 * Finds a codelist definition by its unique identifier (e.g. "CL_SEX", "CL_NY").
 */
export function findCodelistById(
  id: string,
  codelists: CodelistDefinition[] = STANDARD_CODELISTS
): CodelistDefinition | undefined {
  if (!id) return undefined;
  return codelists.find((cl) => cl.id === id);
}

/**
 * Finds a codelist definition by its NCI Codelist Concept Code (e.g. "C66731" for Sex).
 */
export function findCodelistByNciCode(
  nciCode: string,
  codelists: CodelistDefinition[] = STANDARD_CODELISTS
): CodelistDefinition | undefined {
  if (!nciCode) return undefined;
  const normalized = nciCode.trim().toUpperCase();
  return codelists.find(
    (cl) =>
      cl.nciCodelistCode && cl.nciCodelistCode.toUpperCase() === normalized
  );
}

/**
 * Resolves a codelist argument (either string ID / NCI code or CodelistDefinition object).
 */
function resolveCodelist(
  codelistInput: CodelistDefinition | string,
  codelists: CodelistDefinition[] = STANDARD_CODELISTS
): CodelistDefinition | undefined {
  if (typeof codelistInput !== "string") {
    return codelistInput;
  }
  return (
    findCodelistById(codelistInput, codelists) ||
    findCodelistByNciCode(codelistInput, codelists)
  );
}

/**
 * Helper function to look up an option in a codelist by matching a normalized property value.
 */
function findOptionByProperty(
  codelistInput: CodelistDefinition | string,
  searchValue: string,
  propKey: "code" | "nciCode",
  codelists: CodelistDefinition[] = STANDARD_CODELISTS
): import("./types").CodelistOption | undefined {
  if (!searchValue) return undefined;
  const cl = resolveCodelist(codelistInput, codelists);
  if (!cl || !Array.isArray(cl.options)) return undefined;

  const normalized = searchValue.trim().toUpperCase();
  return cl.options.find((opt) => {
    const val = opt[propKey];
    return val !== undefined && val.trim().toUpperCase() === normalized;
  });
}

/**
 * Finds an option within a codelist by its submission code (e.g. "Y", "M", "MILD").
 */
export function findOptionByCode(
  codelist: CodelistDefinition | string,
  code: string,
  codelists: CodelistDefinition[] = STANDARD_CODELISTS
): import("./types").CodelistOption | undefined {
  return findOptionByProperty(codelist, code, "code", codelists);
}

/**
 * Finds an option within a codelist by its NCI Concept Code (e.g. "C49488", "C20197").
 */
export function findOptionByNciCode(
  codelist: CodelistDefinition | string,
  nciCode: string,
  codelists: CodelistDefinition[] = STANDARD_CODELISTS
): import("./types").CodelistOption | undefined {
  return findOptionByProperty(codelist, nciCode, "nciCode", codelists);
}

/**
 * Matches an option within a codelist by its human-readable term label.
 */
export function matchTermByLabel(
  codelist: CodelistDefinition | string,
  label: string,
  options: { caseSensitive?: boolean; codelists?: CodelistDefinition[] } = {}
): import("./types").CodelistOption | undefined {
  if (!label) return undefined;
  const { caseSensitive = false, codelists = STANDARD_CODELISTS } = options;
  const cl = resolveCodelist(codelist, codelists);
  if (!cl || !Array.isArray(cl.options)) return undefined;

  const searchLabel = caseSensitive ? label.trim() : label.trim().toLowerCase();

  return cl.options.find((opt) => {
    if (!opt.label) return false;
    const optLabel = caseSensitive
      ? opt.label.trim()
      : opt.label.trim().toLowerCase();
    return optLabel === searchLabel;
  });
}

/**
 * Validates a list of codelists for integrity:
 * - Checks for duplicate codelist IDs.
 * - Checks for duplicate NCI codelist concept codes.
 * - Validates NCI C-code regex formatting.
 * - Checks option uniqueness and option NCI code formats within each codelist.
 * - Rejects NCI term codes on a sponsor-defined codelist (one without an NCI
 *   codelist code), since such a code would be borrowed from another concept.
 *
 * Terms without an NCI code are allowed in a CDISC codelist: they are sponsor
 * extensions of an extensible codelist.
 */
export function validateCodelists(
  codelists: CodelistDefinition[] = STANDARD_CODELISTS
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenNciCodes = new Map<string, string>();

  codelists.forEach((cl, index) => {
    // Check ID existence & uniqueness
    if (!cl.id) {
      errors.push(`Codelist at index ${index} is missing an 'id'.`);
    } else if (seenIds.has(cl.id)) {
      errors.push(`Duplicate codelist ID detected: "${cl.id}".`);
    } else {
      seenIds.add(cl.id);
    }

    // Check NCI codelist code format & uniqueness
    if (cl.nciCodelistCode) {
      if (!NCI_CODE_REGEX.test(cl.nciCodelistCode)) {
        errors.push(
          `Codelist "${cl.id || index}" has invalid nciCodelistCode format: "${cl.nciCodelistCode}". Must match NCI C-code format (e.g. C12345).`
        );
      }
      const upperNci = cl.nciCodelistCode.toUpperCase();
      if (seenNciCodes.has(upperNci)) {
        errors.push(
          `Duplicate NCI Codelist Code detected: "${cl.nciCodelistCode}" in codelist "${cl.id}" (previously seen in "${seenNciCodes.get(upperNci)}").`
        );
      } else {
        seenNciCodes.set(upperNci, cl.id);
      }
    }

    // Check options
    if (!Array.isArray(cl.options) || cl.options.length === 0) {
      errors.push(`Codelist "${cl.id || index}" has no options defined.`);
    } else {
      const seenOptionCodes = new Set<string>();
      cl.options.forEach((opt, optIdx) => {
        if (!opt.code) {
          errors.push(
            `Codelist "${cl.id}" option at index ${optIdx} is missing 'code'.`
          );
        } else {
          const upperOptCode = opt.code.toUpperCase();
          if (seenOptionCodes.has(upperOptCode)) {
            errors.push(
              `Codelist "${cl.id}" contains duplicate option submission code: "${opt.code}".`
            );
          } else {
            seenOptionCodes.add(upperOptCode);
          }
        }

        if (!opt.label) {
          errors.push(
            `Codelist "${cl.id}" option "${opt.code || optIdx}" is missing 'label'.`
          );
        }

        if (opt.nciCode) {
          if (!cl.nciCodelistCode) {
            errors.push(
              `Codelist "${cl.id}" is sponsor-defined but option "${opt.code}" carries NCI code "${opt.nciCode}".`
            );
          } else if (!NCI_CODE_REGEX.test(opt.nciCode)) {
            errors.push(
              `Codelist "${cl.id}" option "${opt.code}" has invalid option nciCode: "${opt.nciCode}". Must match NCI C-code format.`
            );
          }
        }
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
