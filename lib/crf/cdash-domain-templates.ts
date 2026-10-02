import { CdashVariableMetadata, CRFForm } from "./types";

/**
 * Standard CDASH 2.2 Domain Variable Catalog
 */
export const CDASH_STANDARD_VARIABLES: Record<string, CdashVariableMetadata[]> =
  {
    DM: [
      {
        domain: "DM",
        sdtmVariable: "BRTHYR",
        cdashLabel: "Year of Birth",
        core: "HR",
        acrfAnnotation: "DM.BRTHYR",
        dataCategory: "Topic",
      },
      {
        domain: "DM",
        sdtmVariable: "AGE",
        cdashLabel: "Age",
        core: "HR",
        acrfAnnotation: "DM.AGE",
        dataCategory: "Qualifier",
      },
      {
        domain: "DM",
        sdtmVariable: "AGEU",
        cdashLabel: "Age Units",
        core: "O",
        acrfAnnotation: "DM.AGEU",
        dataCategory: "Qualifier",
      },
      {
        domain: "DM",
        sdtmVariable: "SEX",
        cdashLabel: "Sex",
        core: "R",
        acrfAnnotation: "DM.SEX",
        dataCategory: "Topic",
        nciConceptId: "C66742",
      },
      {
        domain: "DM",
        sdtmVariable: "RACE",
        cdashLabel: "Race",
        core: "HR",
        acrfAnnotation: "DM.RACE",
        dataCategory: "Topic",
        nciConceptId: "C74457",
      },
      {
        domain: "DM",
        sdtmVariable: "ETHNIC",
        cdashLabel: "Ethnicity",
        core: "HR",
        acrfAnnotation: "DM.ETHNIC",
        dataCategory: "Topic",
        nciConceptId: "C66790",
      },
      {
        domain: "DM",
        sdtmVariable: "ICDAT",
        cdashLabel: "Informed Consent Date",
        core: "R",
        acrfAnnotation: "DS.DSSTDTC [DSDECOD=INFORMED CONSENT OBTAINED]",
        dataCategory: "Timing",
      },
    ],
    VS: [
      {
        domain: "VS",
        sdtmVariable: "VSDAT",
        cdashLabel: "Vital Signs Assessment Date",
        core: "R",
        acrfAnnotation: "VS.VSDTC",
        dataCategory: "Timing",
      },
      {
        domain: "VS",
        sdtmVariable: "HEIGHT",
        cdashLabel: "Height",
        core: "HR",
        acrfAnnotation: "VS.VSSTRESN [VSTESTCD=HEIGHT]",
        dataCategory: "Topic",
      },
      {
        domain: "VS",
        sdtmVariable: "WEIGHT",
        cdashLabel: "Weight",
        core: "HR",
        acrfAnnotation: "VS.VSSTRESN [VSTESTCD=WEIGHT]",
        dataCategory: "Topic",
      },
      {
        domain: "VS",
        sdtmVariable: "BMI",
        cdashLabel: "Body Mass Index",
        core: "HR",
        acrfAnnotation: "VS.VSSTRESN [VSTESTCD=BMI]",
        dataCategory: "Derived",
      },
      {
        domain: "VS",
        sdtmVariable: "SYSBP",
        cdashLabel: "Systolic Blood Pressure",
        core: "HR",
        acrfAnnotation: "VS.VSSTRESN [VSTESTCD=SYSBP]",
        dataCategory: "Topic",
      },
      {
        domain: "VS",
        sdtmVariable: "DIABP",
        cdashLabel: "Diastolic Blood Pressure",
        core: "HR",
        acrfAnnotation: "VS.VSSTRESN [VSTESTCD=DIABP]",
        dataCategory: "Topic",
      },
      {
        domain: "VS",
        sdtmVariable: "PULSE",
        cdashLabel: "Pulse Rate",
        core: "HR",
        acrfAnnotation: "VS.VSSTRESN [VSTESTCD=PULSE]",
        dataCategory: "Topic",
      },
      {
        domain: "VS",
        sdtmVariable: "TEMP",
        cdashLabel: "Temperature",
        core: "HR",
        acrfAnnotation: "VS.VSSTRESN [VSTESTCD=TEMP]",
        dataCategory: "Topic",
      },
      {
        domain: "VS",
        sdtmVariable: "RESP",
        cdashLabel: "Respiratory Rate",
        core: "O",
        acrfAnnotation: "VS.VSSTRESN [VSTESTCD=RESP]",
        dataCategory: "Topic",
      },
    ],
    AE: [
      {
        domain: "AE",
        sdtmVariable: "AETERM",
        cdashLabel: "Reported Term for Adverse Event",
        core: "R",
        acrfAnnotation: "AE.AETERM",
        dataCategory: "Topic",
      },
      {
        domain: "AE",
        sdtmVariable: "AESTDTC",
        cdashLabel: "AE Start Date/Time",
        core: "R",
        acrfAnnotation: "AE.AESTDTC",
        dataCategory: "Timing",
      },
      {
        domain: "AE",
        sdtmVariable: "AEENDTC",
        cdashLabel: "AE End Date/Time",
        core: "HR",
        acrfAnnotation: "AE.AEENDTC",
        dataCategory: "Timing",
      },
      {
        domain: "AE",
        sdtmVariable: "AEONGO",
        cdashLabel: "Ongoing Adverse Event",
        core: "HR",
        acrfAnnotation: "AE.AEENRTPT [AEENRTPT=ONGOING]",
        dataCategory: "Qualifier",
      },
      {
        domain: "AE",
        sdtmVariable: "AESEV",
        cdashLabel: "Severity / Grade",
        core: "R",
        acrfAnnotation: "AE.AESEV",
        dataCategory: "Qualifier",
        nciConceptId: "C66769",
      },
      {
        domain: "AE",
        sdtmVariable: "AESER",
        cdashLabel: "Serious Event",
        core: "R",
        acrfAnnotation: "AE.AESER",
        dataCategory: "Qualifier",
        nciConceptId: "C66741",
      },
      {
        domain: "AE",
        sdtmVariable: "AEREL",
        cdashLabel: "Causality / Relatedness",
        core: "R",
        acrfAnnotation: "AE.AEREL",
        dataCategory: "Qualifier",
        nciConceptId: "C66768",
      },
      {
        domain: "AE",
        sdtmVariable: "AEACN",
        cdashLabel: "Action Taken with Study Treatment",
        core: "R",
        acrfAnnotation: "AE.AEACN",
        dataCategory: "Qualifier",
      },
      {
        domain: "AE",
        sdtmVariable: "AEOUT",
        cdashLabel: "Outcome of Event",
        core: "R",
        acrfAnnotation: "AE.AEOUT",
        dataCategory: "Qualifier",
        nciConceptId: "C66767",
      },
    ],
    CM: [
      {
        domain: "CM",
        sdtmVariable: "CMTRT",
        cdashLabel: "Reported Name of Drug / Therapy",
        core: "R",
        acrfAnnotation: "CM.CMTRT",
        dataCategory: "Topic",
      },
      {
        domain: "CM",
        sdtmVariable: "CMINDC",
        cdashLabel: "Indication",
        core: "HR",
        acrfAnnotation: "CM.CMINDC",
        dataCategory: "Qualifier",
      },
      {
        domain: "CM",
        sdtmVariable: "CMDOSE",
        cdashLabel: "Dose per Administration",
        core: "HR",
        acrfAnnotation: "CM.CMDOSE",
        dataCategory: "Qualifier",
      },
      {
        domain: "CM",
        sdtmVariable: "CMDOSU",
        cdashLabel: "Dose Units",
        core: "HR",
        acrfAnnotation: "CM.CMDOSU",
        dataCategory: "Qualifier",
      },
      {
        domain: "CM",
        sdtmVariable: "CMROUTE",
        cdashLabel: "Route",
        core: "HR",
        acrfAnnotation: "CM.CMROUTE",
        dataCategory: "Qualifier",
        nciConceptId: "C66729",
      },
      {
        domain: "CM",
        sdtmVariable: "CMSTDTC",
        cdashLabel: "Medication Start Date",
        core: "R",
        acrfAnnotation: "CM.CMSTDTC",
        dataCategory: "Timing",
      },
      {
        domain: "CM",
        sdtmVariable: "CMENDTC",
        cdashLabel: "Medication End Date",
        core: "O",
        acrfAnnotation: "CM.CMENDTC",
        dataCategory: "Timing",
      },
      {
        domain: "CM",
        sdtmVariable: "CMONGO",
        cdashLabel: "Ongoing Medication",
        core: "O",
        acrfAnnotation: "CM.CMENRTPT [CMENRTPT=ONGOING]",
        dataCategory: "Qualifier",
      },
    ],
    LB: [
      {
        domain: "LB",
        sdtmVariable: "LBDAT",
        cdashLabel: "Sample Collection Date",
        core: "R",
        acrfAnnotation: "LB.LBDTC",
        dataCategory: "Timing",
      },
      {
        domain: "LB",
        sdtmVariable: "LBTEST",
        cdashLabel: "Lab Test Name",
        core: "O",
        acrfAnnotation: "LB.LBTEST",
        dataCategory: "Topic",
      },
      {
        domain: "LB",
        sdtmVariable: "LBORRES",
        cdashLabel: "Result Value",
        core: "O",
        acrfAnnotation: "LB.LBORRES",
        dataCategory: "Result",
      },
      {
        domain: "LB",
        sdtmVariable: "LBORRESU",
        cdashLabel: "Units",
        core: "O",
        acrfAnnotation: "LB.LBORRESU",
        dataCategory: "Qualifier",
      },
      {
        domain: "LB",
        sdtmVariable: "LBNRIND",
        cdashLabel: "Reference Range Indicator",
        core: "O",
        acrfAnnotation: "LB.LBNRIND",
        dataCategory: "Qualifier",
      },
      {
        domain: "LB",
        sdtmVariable: "LBCLSIG",
        cdashLabel: "Clinically Significant (Y/N)",
        core: "O",
        acrfAnnotation: "LB.SUPPLB.LBCLSIG",
        dataCategory: "Qualifier",
      },
    ],
    DI: [
      {
        domain: "DI",
        sdtmVariable: "DITERM",
        cdashLabel: "Device Reported Name",
        core: "R",
        acrfAnnotation: "DI.DITERM",
        dataCategory: "Topic",
      },
      {
        domain: "DI",
        sdtmVariable: "DIBRN",
        cdashLabel: "Device Brand / Trade Name",
        core: "HR",
        acrfAnnotation: "DI.DIBRN",
        dataCategory: "Qualifier",
      },
      {
        domain: "DI",
        sdtmVariable: "DIMODN",
        cdashLabel: "Device Model Number",
        core: "HR",
        acrfAnnotation: "DI.DIMODN",
        dataCategory: "Qualifier",
      },
      {
        domain: "DI",
        sdtmVariable: "DILOTN",
        cdashLabel: "Lot / Batch Number",
        core: "HR",
        acrfAnnotation: "DI.DILOTN",
        dataCategory: "Qualifier",
      },
      {
        domain: "DI",
        sdtmVariable: "DISERN",
        cdashLabel: "Serial Number",
        core: "HR",
        acrfAnnotation: "DI.DISERN",
        dataCategory: "Qualifier",
      },
      {
        domain: "DI",
        sdtmVariable: "DIUDI",
        cdashLabel: "Unique Device Identifier (UDI)",
        core: "HR",
        acrfAnnotation: "DI.DIUDI",
        dataCategory: "Identifier",
      },
      {
        domain: "DI",
        sdtmVariable: "DISFTV",
        cdashLabel: "Software / Firmware Version",
        core: "O",
        acrfAnnotation: "DI.DISFTV",
        dataCategory: "Qualifier",
      },
      {
        domain: "DI",
        sdtmVariable: "DIEXPDTC",
        cdashLabel: "Device Expiration Date",
        core: "HR",
        acrfAnnotation: "DI.DIEXPDTC",
        dataCategory: "Timing",
      },
      {
        domain: "DI",
        sdtmVariable: "DISTAT",
        cdashLabel: "Device Tracking Status",
        core: "R",
        acrfAnnotation: "DI.DISTAT",
        dataCategory: "Qualifier",
        nciConceptId: "C112033",
      },
    ],
    DU: [
      {
        domain: "DU",
        sdtmVariable: "DUTEST",
        cdashLabel: "Device Activity / Procedure Name",
        core: "R",
        acrfAnnotation: "DU.DUTEST",
        dataCategory: "Topic",
      },
      {
        domain: "DU",
        sdtmVariable: "DUORRES",
        cdashLabel: "Procedural Deployment Outcome",
        core: "R",
        acrfAnnotation: "DU.DUORRES",
        dataCategory: "Result",
        nciConceptId: "C112037",
      },
      {
        domain: "DU",
        sdtmVariable: "DUSTDTC",
        cdashLabel: "Procedure Start Date & Time",
        core: "R",
        acrfAnnotation: "DU.DUSTDTC",
        dataCategory: "Timing",
      },
      {
        domain: "DU",
        sdtmVariable: "DUENDTC",
        cdashLabel: "Procedure End Date & Time",
        core: "HR",
        acrfAnnotation: "DU.DUENDTC",
        dataCategory: "Timing",
      },
      {
        domain: "DU",
        sdtmVariable: "DULOC",
        cdashLabel: "Anatomical Site / Location",
        core: "HR",
        acrfAnnotation: "DU.DULOC",
        dataCategory: "Qualifier",
      },
      {
        domain: "DU",
        sdtmVariable: "DUDUR",
        cdashLabel: "Procedure Duration (Minutes)",
        core: "O",
        acrfAnnotation: "DU.DUDUR",
        dataCategory: "Timing",
      },
    ],
    DE: [
      {
        domain: "DE",
        sdtmVariable: "DETERM",
        cdashLabel: "Device Incident / Deficiency Description",
        core: "R",
        acrfAnnotation: "DE.DETERM",
        dataCategory: "Topic",
      },
      {
        domain: "DE",
        sdtmVariable: "DESTDTC",
        cdashLabel: "Incident Start Date/Time",
        core: "R",
        acrfAnnotation: "DE.DESTDTC",
        dataCategory: "Timing",
      },
      {
        domain: "DE",
        sdtmVariable: "DEDEFIC",
        cdashLabel: "Deficiency Classification",
        core: "R",
        acrfAnnotation: "DE.DEDEFIC",
        dataCategory: "Qualifier",
        nciConceptId: "C112023",
      },
      {
        domain: "DE",
        sdtmVariable: "DESEV",
        cdashLabel: "Incident Severity",
        core: "HR",
        acrfAnnotation: "DE.DESEV",
        dataCategory: "Qualifier",
      },
      {
        domain: "DE",
        sdtmVariable: "DESER",
        cdashLabel: "Serious Health Deterioration (SAE)",
        core: "R",
        acrfAnnotation: "DE.DESER",
        dataCategory: "Qualifier",
        nciConceptId: "C66741",
      },
      {
        domain: "DE",
        sdtmVariable: "DEREL",
        cdashLabel: "Device Relationship",
        core: "R",
        acrfAnnotation: "DE.DEREL",
        dataCategory: "Qualifier",
        nciConceptId: "C112024",
      },
      {
        domain: "DE",
        sdtmVariable: "DEACT",
        cdashLabel: "Action Taken with Medical Device",
        core: "R",
        acrfAnnotation: "DE.DEACT",
        dataCategory: "Qualifier",
        nciConceptId: "C112028",
      },
      {
        domain: "DE",
        sdtmVariable: "DEOUT",
        cdashLabel: "Incident Outcome",
        core: "R",
        acrfAnnotation: "DE.DEOUT",
        dataCategory: "Qualifier",
      },
    ],
    DA: [
      {
        domain: "DA",
        sdtmVariable: "DATEST",
        cdashLabel: "Accountability Assessment / Kit ID",
        core: "R",
        acrfAnnotation: "DA.DATEST",
        dataCategory: "Topic",
      },
      {
        domain: "DA",
        sdtmVariable: "DASTDTC",
        cdashLabel: "Dispensation Date",
        core: "R",
        acrfAnnotation: "DA.DASTDTC",
        dataCategory: "Timing",
      },
      {
        domain: "DA",
        sdtmVariable: "DAENDTC",
        cdashLabel: "Return Date",
        core: "HR",
        acrfAnnotation: "DA.DAENDTC",
        dataCategory: "Timing",
      },
      {
        domain: "DA",
        sdtmVariable: "DASPNO",
        cdashLabel: "Units Dispensed",
        core: "R",
        acrfAnnotation: "DA.DAORRES [DAPARM=DISPENSED]",
        dataCategory: "Result",
      },
      {
        domain: "DA",
        sdtmVariable: "DARETNO",
        cdashLabel: "Units Returned",
        core: "HR",
        acrfAnnotation: "DA.DAORRES [DAPARM=RETURNED]",
        dataCategory: "Result",
      },
      {
        domain: "DA",
        sdtmVariable: "DAUSEDN",
        cdashLabel: "Units Administered",
        core: "HR",
        acrfAnnotation: "DA.DAORRES [DAPARM=USED]",
        dataCategory: "Result",
      },
      {
        domain: "DA",
        sdtmVariable: "DACOMPL",
        cdashLabel: "Compliance Rate (%)",
        core: "HR",
        acrfAnnotation: "DA.DASTRESN [DAPARM=COMPLIANCE]",
        dataCategory: "Derived",
      },
      {
        domain: "DA",
        sdtmVariable: "DARECON",
        cdashLabel: "Reconciliation Status",
        core: "R",
        acrfAnnotation: "DA.DARECON",
        dataCategory: "Qualifier",
        nciConceptId: "C66736",
      },
    ],
    EX: [
      {
        domain: "EX",
        sdtmVariable: "EXTRT",
        cdashLabel: "Investigational Product Name",
        core: "R",
        acrfAnnotation: "EX.EXTRT",
        dataCategory: "Topic",
      },
      {
        domain: "EX",
        sdtmVariable: "EXDOSE",
        cdashLabel: "Dose Administered",
        core: "R",
        acrfAnnotation: "EX.EXDOSE",
        dataCategory: "Qualifier",
      },
      {
        domain: "EX",
        sdtmVariable: "EXDOSU",
        cdashLabel: "Dose Units",
        core: "R",
        acrfAnnotation: "EX.EXDOSU",
        dataCategory: "Qualifier",
        nciConceptId: "C71620",
      },
      {
        domain: "EX",
        sdtmVariable: "EXDOSFRM",
        cdashLabel: "Dose Form",
        core: "HR",
        acrfAnnotation: "EX.EXDOSFRM",
        dataCategory: "Qualifier",
      },
      {
        domain: "EX",
        sdtmVariable: "EXROUTE",
        cdashLabel: "Route of Administration",
        core: "R",
        acrfAnnotation: "EX.EXROUTE",
        dataCategory: "Qualifier",
        nciConceptId: "C66729",
      },
      {
        domain: "EX",
        sdtmVariable: "EXSTDTC",
        cdashLabel: "Administration Start Date/Time",
        core: "R",
        acrfAnnotation: "EX.EXSTDTC",
        dataCategory: "Timing",
      },
      {
        domain: "EX",
        sdtmVariable: "EXENDTC",
        cdashLabel: "Administration End Date/Time",
        core: "HR",
        acrfAnnotation: "EX.EXENDTC",
        dataCategory: "Timing",
      },
      {
        domain: "EX",
        sdtmVariable: "EXADJ",
        cdashLabel: "Dose Modification / Interruption Reason",
        core: "O",
        acrfAnnotation: "EX.EXADJ",
        dataCategory: "Qualifier",
      },
    ],
    MH: [
      {
        domain: "MH",
        sdtmVariable: "MHTERM",
        cdashLabel: "Medical History Condition / Diagnosis",
        core: "R",
        acrfAnnotation: "MH.MHTERM",
        dataCategory: "Topic",
      },
      {
        domain: "MH",
        sdtmVariable: "MHCAT",
        cdashLabel: "Body System / Category",
        core: "HR",
        acrfAnnotation: "MH.MHCAT",
        dataCategory: "Qualifier",
        nciConceptId: "C66737",
      },
      {
        domain: "MH",
        sdtmVariable: "MHSTDTC",
        cdashLabel: "Onset / Diagnosis Date",
        core: "HR",
        acrfAnnotation: "MH.MHSTDTC",
        dataCategory: "Timing",
      },
      {
        domain: "MH",
        sdtmVariable: "MHONGO",
        cdashLabel: "Condition is Ongoing",
        core: "R",
        acrfAnnotation: "MH.MHENRTPT [MHENRTPT=ONGOING]",
        dataCategory: "Qualifier",
      },
      {
        domain: "MH",
        sdtmVariable: "MHENDTC",
        cdashLabel: "Resolution Date",
        core: "O",
        acrfAnnotation: "MH.MHENDTC",
        dataCategory: "Timing",
      },
    ],
    DS: [
      {
        domain: "DS",
        sdtmVariable: "DSTERM",
        cdashLabel: "Disposition Event / Status",
        core: "R",
        acrfAnnotation: "DS.DSTERM",
        dataCategory: "Topic",
      },
      {
        domain: "DS",
        sdtmVariable: "DSDECOD",
        cdashLabel: "Standardized Disposition Reason",
        core: "R",
        acrfAnnotation: "DS.DSDECOD",
        dataCategory: "Qualifier",
        nciConceptId: "C66735",
      },
      {
        domain: "DS",
        sdtmVariable: "DSCAT",
        cdashLabel: "Milestone Category",
        core: "HR",
        acrfAnnotation: "DS.DSCAT",
        dataCategory: "Qualifier",
      },
      {
        domain: "DS",
        sdtmVariable: "DSSTDTC",
        cdashLabel: "Disposition Effective Date",
        core: "R",
        acrfAnnotation: "DS.DSSTDTC",
        dataCategory: "Timing",
      },
    ],
  };

/**
 * 1-Click CDASH Domain Auto-Scaffolder Generator
 */
export function scaffoldCdashDomain(
  domainCode:
    | "DM"
    | "VS"
    | "AE"
    | "CM"
    | "LB"
    | "RECIST"
    | "DI"
    | "DU"
    | "DE"
    | "DA"
    | "EX"
    | "MH"
    | "DS"
): CRFForm {
  const formId = `form_${domainCode.toLowerCase()}_${Date.now()}`;

  switch (domainCode) {
    case "DM":
      return {
        id: formId,
        name: "Demographics & Informed Consent",
        domain: "DM",
        description:
          "Subject baseline characteristics, demographics, and consent tracking",
        version: "1.0",
        rules: [],
        sections: [
          {
            id: `sec_ic_${Date.now()}`,
            title: "Informed Consent",
            fields: [
              {
                id: `f_icdat_${Date.now()}`,
                variableName: "ICDAT",
                label: "Date Informed Consent Signed",
                dataType: "date",
                columnSpan: 6,
                required: true,
                cdashMetadata: CDASH_STANDARD_VARIABLES.DM.find(
                  (v) => v.sdtmVariable === "ICDAT"
                ),
              },
              {
                id: `f_icyn_${Date.now()}`,
                variableName: "ICYN",
                label:
                  "Did subject provide written consent prior to any protocol procedures?",
                dataType: "radio",
                columnSpan: 6,
                required: true,
                codelistId: "CL_NY",
              },
            ],
          },
          {
            id: `sec_dm_${Date.now() + 1}`,
            title: "Baseline Demographics",
            fields: [
              {
                id: `f_brthyr_${Date.now()}`,
                variableName: "BRTHYR",
                label: "Year of Birth (YYYY)",
                dataType: "integer",
                columnSpan: 4,
                required: true,
                minValue: 1900,
                maxValue: 2026,
                placeholder: "e.g. 1985",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DM.find(
                  (v) => v.sdtmVariable === "BRTHYR"
                ),
              },
              {
                id: `f_age_${Date.now() + 1}`,
                variableName: "AGE",
                label: "Age at Screening",
                dataType: "integer",
                columnSpan: 4,
                required: true,
                minValue: 18,
                maxValue: 120,
                unit: "Years",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DM.find(
                  (v) => v.sdtmVariable === "AGE"
                ),
              },
              {
                id: `f_sex_${Date.now() + 2}`,
                variableName: "SEX",
                label: "Sex assigned at birth",
                dataType: "single_select",
                columnSpan: 4,
                required: true,
                codelistId: "CL_SEX",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DM.find(
                  (v) => v.sdtmVariable === "SEX"
                ),
              },
              {
                id: `f_race_${Date.now() + 3}`,
                variableName: "RACE",
                label: "Race (Select primary)",
                dataType: "single_select",
                columnSpan: 6,
                required: true,
                codelistId: "CL_RACE",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DM.find(
                  (v) => v.sdtmVariable === "RACE"
                ),
              },
              {
                id: `f_ethnic_${Date.now() + 4}`,
                variableName: "ETHNIC",
                label: "Ethnicity",
                dataType: "single_select",
                columnSpan: 6,
                required: true,
                codelistId: "CL_ETHNIC",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DM.find(
                  (v) => v.sdtmVariable === "ETHNIC"
                ),
              },
            ],
          },
        ],
      };

    case "VS":
      return {
        id: formId,
        name: "Vital Signs & Physical Metrics",
        domain: "VS",
        description:
          "Sitting blood pressure, pulse, temperature, height, weight, and automated BMI",
        version: "1.0",
        rules: [
          {
            id: `rule_bmi_${Date.now()}`,
            name: "Automated BMI Derivation",
            description:
              "Calculate BMI automatically when height and weight are entered",
            triggerFieldIds: ["f_height", "f_weight"],
            actionType: "set_value",
            targetFieldId: "f_bmi",
            conditions: [
              { fieldId: "f_height", operator: "gt", value: 0 },
              { fieldId: "f_weight", operator: "gt", value: 0 },
            ],
            logicalOperator: "AND",
            formulaExpression:
              "round(weight / ((height / 100) * (height / 100)), 1)",
          },
          {
            id: `rule_sysbp_check_${Date.now() + 1}`,
            name: "Severe Hypertension Range Alert",
            description:
              "Raise query if Systolic BP > 180 mmHg or Diastolic > 110 mmHg",
            triggerFieldIds: ["f_sysbp", "f_diabp"],
            actionType: "raise_query",
            targetFieldId: "f_sysbp",
            conditions: [{ fieldId: "f_sysbp", operator: "gt", value: 180 }],
            logicalOperator: "OR",
            querySeverity: "warning",
            queryMessage:
              "Systolic Blood Pressure > 180 mmHg exceeds protocol threshold. Please confirm repeat measurement.",
          },
        ],
        sections: [
          {
            id: `sec_vs_${Date.now()}`,
            title: "Vital Signs Measurements",
            fields: [
              {
                id: "f_vsdat",
                variableName: "VSDAT",
                label: "Assessment Date & Time",
                dataType: "datetime",
                columnSpan: 6,
                required: true,
                cdashMetadata: CDASH_STANDARD_VARIABLES.VS.find(
                  (v) => v.sdtmVariable === "VSDAT"
                ),
              },
              {
                id: "f_height",
                variableName: "HEIGHT",
                label: "Height",
                dataType: "number",
                columnSpan: 3,
                required: true,
                unit: "cm",
                minValue: 50,
                maxValue: 250,
                cdashMetadata: CDASH_STANDARD_VARIABLES.VS.find(
                  (v) => v.sdtmVariable === "HEIGHT"
                ),
              },
              {
                id: "f_weight",
                variableName: "WEIGHT",
                label: "Weight",
                dataType: "number",
                columnSpan: 3,
                required: true,
                unit: "kg",
                minValue: 20,
                maxValue: 300,
                cdashMetadata: CDASH_STANDARD_VARIABLES.VS.find(
                  (v) => v.sdtmVariable === "WEIGHT"
                ),
              },
              {
                id: "f_bmi",
                variableName: "BMI",
                label: "Calculated Body Mass Index (BMI)",
                dataType: "calculated",
                columnSpan: 4,
                required: false,
                readOnly: true,
                unit: "kg/m²",
                calculationFormula: "weight / ((height/100) * (height/100))",
                cdashMetadata: CDASH_STANDARD_VARIABLES.VS.find(
                  (v) => v.sdtmVariable === "BMI"
                ),
              },
              {
                id: "f_sysbp",
                variableName: "SYSBP",
                label: "Systolic Blood Pressure",
                dataType: "integer",
                columnSpan: 4,
                required: true,
                unit: "mmHg",
                minValue: 60,
                maxValue: 260,
                cdashMetadata: CDASH_STANDARD_VARIABLES.VS.find(
                  (v) => v.sdtmVariable === "SYSBP"
                ),
              },
              {
                id: "f_diabp",
                variableName: "DIABP",
                label: "Diastolic Blood Pressure",
                dataType: "integer",
                columnSpan: 4,
                required: true,
                unit: "mmHg",
                minValue: 30,
                maxValue: 160,
                cdashMetadata: CDASH_STANDARD_VARIABLES.VS.find(
                  (v) => v.sdtmVariable === "DIABP"
                ),
              },
              {
                id: "f_pulse",
                variableName: "PULSE",
                label: "Heart / Pulse Rate",
                dataType: "integer",
                columnSpan: 4,
                required: true,
                unit: "beats/min",
                minValue: 30,
                maxValue: 220,
                cdashMetadata: CDASH_STANDARD_VARIABLES.VS.find(
                  (v) => v.sdtmVariable === "PULSE"
                ),
              },
              {
                id: "f_temp",
                variableName: "TEMP",
                label: "Body Temperature",
                dataType: "number",
                columnSpan: 4,
                required: true,
                unit: "°C",
                minValue: 32.0,
                maxValue: 43.0,
                cdashMetadata: CDASH_STANDARD_VARIABLES.VS.find(
                  (v) => v.sdtmVariable === "TEMP"
                ),
              },
              {
                id: "f_resp",
                variableName: "RESP",
                label: "Respiratory Rate",
                dataType: "integer",
                columnSpan: 4,
                required: false,
                unit: "breaths/min",
                minValue: 8,
                maxValue: 60,
                cdashMetadata: CDASH_STANDARD_VARIABLES.VS.find(
                  (v) => v.sdtmVariable === "RESP"
                ),
              },
            ],
          },
        ],
      };

    case "AE":
      return {
        id: formId,
        name: "Adverse Events Log",
        domain: "AE",
        description:
          "Continuous log form for capturing adverse events, CTCAE grading, seriousness, and attribution",
        version: "1.0",
        isLogForm: true,
        rules: [
          {
            id: `rule_ae_ongo_${Date.now()}`,
            name: "Hide End Date when AE is Ongoing",
            description: "If Ongoing is checked, hide AE End Date requirement",
            triggerFieldIds: ["f_ae_ongo"],
            actionType: "hide_field",
            targetFieldId: "f_ae_endtc",
            conditions: [{ fieldId: "f_ae_ongo", operator: "eq", value: true }],
            logicalOperator: "AND",
          },
        ],
        sections: [
          {
            id: `sec_ae_${Date.now()}`,
            title: "Adverse Event Record",
            fields: [
              {
                id: "f_ae_term",
                variableName: "AETERM",
                label:
                  "Adverse Event Reported Term (Diagnosis or Sign/Symptom)",
                dataType: "text",
                columnSpan: 12,
                required: true,
                placeholder: "e.g. Febrile Neutropenia, Peripheral Neuropathy",
                cdashMetadata: CDASH_STANDARD_VARIABLES.AE.find(
                  (v) => v.sdtmVariable === "AETERM"
                ),
              },
              {
                id: "f_ae_stdtc",
                variableName: "AESTDTC",
                label: "Start Date / Time",
                dataType: "partial_date",
                columnSpan: 4,
                required: true,
                cdashMetadata: CDASH_STANDARD_VARIABLES.AE.find(
                  (v) => v.sdtmVariable === "AESTDTC"
                ),
              },
              {
                id: "f_ae_endtc",
                variableName: "AEENDTC",
                label: "Resolution / End Date",
                dataType: "partial_date",
                columnSpan: 4,
                required: false,
                cdashMetadata: CDASH_STANDARD_VARIABLES.AE.find(
                  (v) => v.sdtmVariable === "AEENDTC"
                ),
              },
              {
                id: "f_ae_ongo",
                variableName: "AEONGO",
                label: "Event is Ongoing at time of report",
                dataType: "checkbox",
                columnSpan: 4,
                required: false,
                codelistId: "CL_NY",
                cdashMetadata: CDASH_STANDARD_VARIABLES.AE.find(
                  (v) => v.sdtmVariable === "AEONGO"
                ),
              },
              {
                id: "f_ae_sev",
                variableName: "AESEV",
                label: "Severity / CTCAE v5.0 Grade",
                dataType: "single_select",
                columnSpan: 6,
                required: true,
                codelistId: "CL_AESEV",
                cdashMetadata: CDASH_STANDARD_VARIABLES.AE.find(
                  (v) => v.sdtmVariable === "AESEV"
                ),
              },
              {
                id: "f_ae_ser",
                variableName: "AESER",
                label: "Is this a Serious Adverse Event (SAE)?",
                dataType: "radio",
                columnSpan: 6,
                required: true,
                codelistId: "CL_NY",
                cdashMetadata: CDASH_STANDARD_VARIABLES.AE.find(
                  (v) => v.sdtmVariable === "AESER"
                ),
              },
              {
                id: "f_ae_rel",
                variableName: "AEREL",
                label: "Relationship to Investigational Product",
                dataType: "single_select",
                columnSpan: 6,
                required: true,
                codelistId: "CL_AEREL",
                cdashMetadata: CDASH_STANDARD_VARIABLES.AE.find(
                  (v) => v.sdtmVariable === "AEREL"
                ),
              },
              {
                id: "f_ae_acn",
                variableName: "AEACN",
                label: "Action Taken with Study Treatment",
                dataType: "single_select",
                columnSpan: 6,
                required: true,
                customOptions: [
                  {
                    code: "DOSE NOT CHANGED",
                    label: "Dose Not Changed",
                    order: 1,
                  },
                  { code: "DOSE REDUCED", label: "Dose Reduced", order: 2 },
                  {
                    code: "DRUG INTERRUPTED",
                    label: "Drug Interrupted",
                    order: 3,
                  },
                  { code: "DRUG WITHDRAWN", label: "Drug Withdrawn", order: 4 },
                  { code: "NOT APPLICABLE", label: "Not Applicable", order: 5 },
                ],
                cdashMetadata: CDASH_STANDARD_VARIABLES.AE.find(
                  (v) => v.sdtmVariable === "AEACN"
                ),
              },
              {
                id: "f_ae_out",
                variableName: "AEOUT",
                label: "Outcome of Adverse Event",
                dataType: "single_select",
                columnSpan: 6,
                required: true,
                codelistId: "CL_AEOUT",
                cdashMetadata: CDASH_STANDARD_VARIABLES.AE.find(
                  (v) => v.sdtmVariable === "AEOUT"
                ),
              },
            ],
          },
        ],
      };

    case "CM":
      return {
        id: formId,
        name: "Prior & Concomitant Medications",
        domain: "CM",
        description:
          "Log of prescription drugs, over-the-counter medications, and supplements",
        version: "1.0",
        isLogForm: true,
        rules: [],
        sections: [
          {
            id: `sec_cm_${Date.now()}`,
            title: "Medication Details",
            fields: [
              {
                id: "f_cm_trt",
                variableName: "CMTRT",
                label: "Medication / Treatment Name (Trade or Generic)",
                dataType: "text",
                columnSpan: 6,
                required: true,
                placeholder: "e.g. Paracetamol, Pembrolizumab",
                cdashMetadata: CDASH_STANDARD_VARIABLES.CM.find(
                  (v) => v.sdtmVariable === "CMTRT"
                ),
              },
              {
                id: "f_cm_indc",
                variableName: "CMINDC",
                label: "Indication / Reason for Treatment",
                dataType: "text",
                columnSpan: 6,
                required: true,
                placeholder: "e.g. Headache, Cancer Pain",
                cdashMetadata: CDASH_STANDARD_VARIABLES.CM.find(
                  (v) => v.sdtmVariable === "CMINDC"
                ),
              },
              {
                id: "f_cm_dose",
                variableName: "CMDOSE",
                label: "Dose per Administration",
                dataType: "number",
                columnSpan: 3,
                required: true,
                minValue: 0.1,
                cdashMetadata: CDASH_STANDARD_VARIABLES.CM.find(
                  (v) => v.sdtmVariable === "CMDOSE"
                ),
              },
              {
                id: "f_cm_dosu",
                variableName: "CMDOSU",
                label: "Dose Unit",
                dataType: "text",
                columnSpan: 3,
                required: true,
                placeholder: "mg, mL, IU",
                cdashMetadata: CDASH_STANDARD_VARIABLES.CM.find(
                  (v) => v.sdtmVariable === "CMDOSU"
                ),
              },
              {
                id: "f_cm_route",
                variableName: "CMROUTE",
                label: "Route of Administration",
                dataType: "single_select",
                columnSpan: 6,
                required: true,
                codelistId: "CL_ROUTE",
                cdashMetadata: CDASH_STANDARD_VARIABLES.CM.find(
                  (v) => v.sdtmVariable === "CMROUTE"
                ),
              },
              {
                id: "f_cm_stdtc",
                variableName: "CMSTDTC",
                label: "Start Date",
                dataType: "partial_date",
                columnSpan: 6,
                required: true,
                cdashMetadata: CDASH_STANDARD_VARIABLES.CM.find(
                  (v) => v.sdtmVariable === "CMSTDTC"
                ),
              },
              {
                id: "f_cm_endtc",
                variableName: "CMENDTC",
                label: "Stop Date",
                dataType: "partial_date",
                columnSpan: 6,
                required: false,
                cdashMetadata: CDASH_STANDARD_VARIABLES.CM.find(
                  (v) => v.sdtmVariable === "CMENDTC"
                ),
              },
            ],
          },
        ],
      };

    case "LB":
      return {
        id: formId,
        name: "Central & Local Laboratory Panel",
        domain: "LB",
        description: "Serum chemistry, hematology, and urinalysis values",
        version: "1.0",
        rules: [],
        sections: [
          {
            id: `sec_lb_${Date.now()}`,
            title: "Blood Chemistry & Hematology",
            fields: [
              {
                id: "f_lb_dat",
                variableName: "LBDAT",
                label: "Collection Date & Time",
                dataType: "datetime",
                columnSpan: 6,
                required: true,
                cdashMetadata: CDASH_STANDARD_VARIABLES.LB.find(
                  (v) => v.sdtmVariable === "LBDAT"
                ),
              },
              {
                id: "f_lb_fast",
                variableName: "LBFAST",
                label: "Was subject fasting >= 8 hours?",
                dataType: "radio",
                columnSpan: 6,
                required: true,
                codelistId: "CL_NY",
              },
              {
                id: "f_lb_alt",
                variableName: "ALT",
                label: "Alanine Aminotransferase (ALT/SGPT)",
                dataType: "number",
                columnSpan: 4,
                required: true,
                unit: "U/L",
                minValue: 1,
                maxValue: 2000,
              },
              {
                id: "f_lb_ast",
                variableName: "AST",
                label: "Aspartate Aminotransferase (AST/SGOT)",
                dataType: "number",
                columnSpan: 4,
                required: true,
                unit: "U/L",
                minValue: 1,
                maxValue: 2000,
              },
              {
                id: "f_lb_bili",
                variableName: "BILI",
                label: "Total Bilirubin",
                dataType: "number",
                columnSpan: 4,
                required: true,
                unit: "mg/dL",
                minValue: 0.1,
                maxValue: 40.0,
              },
              {
                id: "f_lb_creat",
                variableName: "CREAT",
                label: "Serum Creatinine",
                dataType: "number",
                columnSpan: 4,
                required: true,
                unit: "mg/dL",
                minValue: 0.1,
                maxValue: 20.0,
              },
              {
                id: "f_lb_anc",
                variableName: "ANC",
                label: "Absolute Neutrophil Count (ANC)",
                dataType: "number",
                columnSpan: 4,
                required: true,
                unit: "10^9/L",
                minValue: 0.0,
                maxValue: 50.0,
              },
              {
                id: "f_lb_plt",
                variableName: "PLAT",
                label: "Platelet Count",
                dataType: "integer",
                columnSpan: 4,
                required: true,
                unit: "10^9/L",
                minValue: 1,
                maxValue: 1500,
              },
            ],
          },
        ],
      };

    case "RECIST":
      return {
        id: formId,
        name: "Oncology RECIST 1.1 Tumor Assessment",
        domain: "TR",
        description:
          "Target & non-target lesion tracking with automated sum of longest diameters (SLD) and percent change from baseline",
        version: "1.0",
        rules: [
          {
            id: `rule_recist_resp_${Date.now()}`,
            name: "RECIST 1.1 Target Lesion Response Auto-Evaluation",
            description:
              "Derive response (PD >= +20% SLD increase, PR <= -30% SLD decrease, CR = 0mm)",
            triggerFieldIds: ["f_recist_change"],
            actionType: "set_value",
            targetFieldId: "f_recist_resp",
            conditions: [
              {
                fieldId: "f_recist_change",
                operator: "is_not_empty",
                value: "",
              },
            ],
            logicalOperator: "AND",
          },
        ],
        sections: [
          {
            id: `sec_recist_meta_${Date.now()}`,
            title: "Radiological Scan Assessment",
            fields: [
              {
                id: "f_recist_dat",
                variableName: "TRDAT",
                label: "Radiological Imaging Date (CT/MRI)",
                dataType: "date",
                columnSpan: 6,
                required: true,
              },
              {
                id: "f_recist_modality",
                variableName: "TRMETHOD",
                label: "Imaging Modality",
                dataType: "single_select",
                columnSpan: 6,
                required: true,
                customOptions: [
                  { code: "CT", label: "CT Scan with Contrast", order: 1 },
                  { code: "MRI", label: "MRI Scan", order: 2 },
                  { code: "PET_CT", label: "PET/CT Hybrid", order: 3 },
                ],
              },
            ],
          },
          {
            id: `sec_recist_target_${Date.now() + 1}`,
            title: "Target Lesion Measurements (Longest Diameter in mm)",
            fields: [
              {
                id: "f_recist_t1",
                variableName: "TRL1",
                label:
                  "Target Lesion 1: Longest Diameter (mm) & Anatomical Site",
                dataType: "number",
                columnSpan: 6,
                required: true,
                unit: "mm",
                minValue: 0,
                maxValue: 300,
                placeholder: "e.g. 24.5",
              },
              {
                id: "f_recist_t2",
                variableName: "TRL2",
                label:
                  "Target Lesion 2: Longest Diameter (mm) & Anatomical Site",
                dataType: "number",
                columnSpan: 6,
                required: false,
                unit: "mm",
                minValue: 0,
                maxValue: 300,
              },
              {
                id: "f_recist_sld_base",
                variableName: "TRSLDBAS",
                label: "Baseline Sum of Diameters (Reference)",
                dataType: "number",
                columnSpan: 4,
                required: true,
                unit: "mm",
                minValue: 1,
              },
              {
                id: "f_recist_sld_curr",
                variableName: "TRSLDCUR",
                label: "Current Sum of Longest Diameters (SLD)",
                dataType: "calculated",
                columnSpan: 4,
                required: false,
                readOnly: true,
                unit: "mm",
                calculationFormula: "trl1 + trl2",
              },
              {
                id: "f_recist_change",
                variableName: "TRPCTCHG",
                label: "% Change in SLD vs Baseline",
                dataType: "calculated",
                columnSpan: 4,
                required: false,
                readOnly: true,
                unit: "%",
                calculationFormula:
                  "round(((trl1 + trl2 - trsldbas) / trsldbas) * 100, 1)",
              },
              {
                id: "f_recist_resp",
                variableName: "TRRESP",
                label: "Overall Target Lesion Response (RECIST 1.1)",
                dataType: "single_select",
                columnSpan: 12,
                required: true,
                codelistId: "CL_RECIST_RESP",
              },
            ],
          },
        ],
      };

    case "DI":
      return {
        id: formId,
        name: "Medical Device Identification & Traceability",
        domain: "DI",
        description:
          "ISO 14155 / FDA 21 CFR 812 medical device identification, model, lot, and Unique Device Identifier (UDI) tracking",
        version: "1.0",
        rules: [],
        sections: [
          {
            id: `sec_di_${Date.now()}`,
            title: "Medical Device Information & UDI",
            fields: [
              {
                id: "f_di_term",
                variableName: "DITERM",
                label: "Device Generic / Investigational Name",
                dataType: "text",
                columnSpan: 6,
                required: true,
                placeholder: "e.g. Transcatheter Aortic Heart Valve",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DI.find(
                  (v) => v.sdtmVariable === "DITERM"
                ),
              },
              {
                id: "f_di_brn",
                variableName: "DIBRN",
                label: "Device Trade / Brand Name",
                dataType: "text",
                columnSpan: 6,
                required: true,
                placeholder: "e.g. NeoValve-X Implantation System",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DI.find(
                  (v) => v.sdtmVariable === "DIBRN"
                ),
              },
              {
                id: "f_di_modn",
                variableName: "DIMODN",
                label: "Model / Catalog Number",
                dataType: "text",
                columnSpan: 4,
                required: true,
                placeholder: "e.g. NVX-26MM",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DI.find(
                  (v) => v.sdtmVariable === "DIMODN"
                ),
              },
              {
                id: "f_di_lotn",
                variableName: "DILOTN",
                label: "Lot / Batch Number",
                dataType: "text",
                columnSpan: 4,
                required: true,
                placeholder: "e.g. LOT-2026-A4",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DI.find(
                  (v) => v.sdtmVariable === "DILOTN"
                ),
              },
              {
                id: "f_di_sern",
                variableName: "DISERN",
                label: "Serial Number (if serialized)",
                dataType: "text",
                columnSpan: 4,
                required: false,
                placeholder: "e.g. SN-8839210",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DI.find(
                  (v) => v.sdtmVariable === "DISERN"
                ),
              },
              {
                id: "f_di_udi",
                variableName: "DIUDI",
                label: "Unique Device Identifier (UDI / GS1 Barcode)",
                dataType: "text",
                columnSpan: 6,
                required: true,
                placeholder: "(01)00850012345678(17)280815(10)LOT-2026-A4",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DI.find(
                  (v) => v.sdtmVariable === "DIUDI"
                ),
              },
              {
                id: "f_di_sftv",
                variableName: "DISFTV",
                label: "Firmware / Software Version",
                dataType: "text",
                columnSpan: 3,
                required: false,
                placeholder: "e.g. v2.4.1",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DI.find(
                  (v) => v.sdtmVariable === "DISFTV"
                ),
              },
              {
                id: "f_di_expdtc",
                variableName: "DIEXPDTC",
                label: "Sterilization Expiration Date",
                dataType: "date",
                columnSpan: 3,
                required: true,
                cdashMetadata: CDASH_STANDARD_VARIABLES.DI.find(
                  (v) => v.sdtmVariable === "DIEXPDTC"
                ),
              },
              {
                id: "f_di_stat",
                variableName: "DISTAT",
                label: "Device Lifecycle / Tracking Status",
                dataType: "single_select",
                columnSpan: 6,
                required: true,
                codelistId: "CL_DISTAT",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DI.find(
                  (v) => v.sdtmVariable === "DISTAT"
                ),
              },
            ],
          },
        ],
      };

    case "DU":
      return {
        id: formId,
        name: "Device Implantation & Utilization Procedure",
        domain: "DU",
        description:
          "Intra-procedural delivery, anatomical site access, deployment outcome, and fluoroscopy duration",
        version: "1.0",
        rules: [],
        sections: [
          {
            id: `sec_du_${Date.now()}`,
            title: "Procedural Deployment & In-Use Details",
            fields: [
              {
                id: "f_du_test",
                variableName: "DUTEST",
                label: "Intervention / Surgical Procedure Name",
                dataType: "text",
                columnSpan: 6,
                required: true,
                placeholder: "e.g. Transfemoral TAVR Implantation",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DU.find(
                  (v) => v.sdtmVariable === "DUTEST"
                ),
              },
              {
                id: "f_du_loc",
                variableName: "DULOC",
                label: "Anatomical Implantation Site",
                dataType: "text",
                columnSpan: 6,
                required: true,
                placeholder: "e.g. Native Aortic Annulus",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DU.find(
                  (v) => v.sdtmVariable === "DULOC"
                ),
              },
              {
                id: "f_du_stdtc",
                variableName: "DUSTDTC",
                label: "Procedure Start Date & Time",
                dataType: "datetime",
                columnSpan: 4,
                required: true,
                cdashMetadata: CDASH_STANDARD_VARIABLES.DU.find(
                  (v) => v.sdtmVariable === "DUSTDTC"
                ),
              },
              {
                id: "f_du_endtc",
                variableName: "DUENDTC",
                label: "Procedure End Date & Time",
                dataType: "datetime",
                columnSpan: 4,
                required: true,
                cdashMetadata: CDASH_STANDARD_VARIABLES.DU.find(
                  (v) => v.sdtmVariable === "DUENDTC"
                ),
              },
              {
                id: "f_du_dur",
                variableName: "DUDUR",
                label: "Fluoroscopy / Procedure Time (Minutes)",
                dataType: "integer",
                columnSpan: 4,
                required: false,
                unit: "min",
                minValue: 1,
                cdashMetadata: CDASH_STANDARD_VARIABLES.DU.find(
                  (v) => v.sdtmVariable === "DUDUR"
                ),
              },
              {
                id: "f_du_proc",
                variableName: "DUORRES",
                label: "Overall Acute Procedural & Deployment Outcome",
                dataType: "single_select",
                columnSpan: 12,
                required: true,
                codelistId: "CL_DUPROC",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DU.find(
                  (v) => v.sdtmVariable === "DUORRES"
                ),
              },
            ],
          },
        ],
      };

    case "DE":
      return {
        id: formId,
        name: "Device Deficiencies & Incidents Log",
        domain: "DE",
        description:
          "Continuous log for ISO 14155 / FDA 21 CFR 812 device malfunctions, use errors, and serious adverse incidents",
        version: "1.0",
        isLogForm: true,
        rules: [],
        sections: [
          {
            id: `sec_de_${Date.now()}`,
            title: "Device Deficiency / Incident Report",
            fields: [
              {
                id: "f_de_term",
                variableName: "DETERM",
                label: "Reported Description of Device Incident / Deficiency",
                dataType: "text",
                columnSpan: 12,
                required: true,
                placeholder:
                  "e.g. Balloon rupture during deployment, Valve migration, Delivery catheter kink",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DE.find(
                  (v) => v.sdtmVariable === "DETERM"
                ),
              },
              {
                id: "f_de_stdtc",
                variableName: "DESTDTC",
                label: "Date & Time Incident Occurred",
                dataType: "datetime",
                columnSpan: 6,
                required: true,
                cdashMetadata: CDASH_STANDARD_VARIABLES.DE.find(
                  (v) => v.sdtmVariable === "DESTDTC"
                ),
              },
              {
                id: "f_de_defic",
                variableName: "DEDEFIC",
                label: "Deficiency Classification",
                dataType: "single_select",
                columnSpan: 6,
                required: true,
                codelistId: "CL_DEDEF",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DE.find(
                  (v) => v.sdtmVariable === "DEDEFIC"
                ),
              },
              {
                id: "f_de_sev",
                variableName: "DESEV",
                label: "Clinical Severity of Incident",
                dataType: "single_select",
                columnSpan: 6,
                required: true,
                codelistId: "CL_AESEV",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DE.find(
                  (v) => v.sdtmVariable === "DESEV"
                ),
              },
              {
                id: "f_de_ser",
                variableName: "DESER",
                label:
                  "Did this lead to Serious Deterioration in Health (SAE)?",
                dataType: "radio",
                columnSpan: 6,
                required: true,
                codelistId: "CL_NY",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DE.find(
                  (v) => v.sdtmVariable === "DESER"
                ),
              },
              {
                id: "f_de_rel",
                variableName: "DEREL",
                label: "Relationship to Medical Device",
                dataType: "single_select",
                columnSpan: 6,
                required: true,
                codelistId: "CL_DEREL",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DE.find(
                  (v) => v.sdtmVariable === "DEREL"
                ),
              },
              {
                id: "f_de_act",
                variableName: "DEACT",
                label: "Action Taken with Medical Device",
                dataType: "single_select",
                columnSpan: 6,
                required: true,
                codelistId: "CL_DEACT",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DE.find(
                  (v) => v.sdtmVariable === "DEACT"
                ),
              },
              {
                id: "f_de_out",
                variableName: "DEOUT",
                label: "Final Outcome of Subject / Device",
                dataType: "single_select",
                columnSpan: 12,
                required: true,
                codelistId: "CL_AEOUT",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DE.find(
                  (v) => v.sdtmVariable === "DEOUT"
                ),
              },
            ],
          },
        ],
      };

    case "DA":
      return {
        id: formId,
        name: "Drug Accountability & Dispensation",
        domain: "DA",
        description:
          "Investigational product kit tracking, units dispensed, returns, and compliance calculations",
        version: "1.0",
        rules: [
          {
            id: `rule_da_compl_${Date.now()}`,
            name: "Calculate Dosing Compliance Percentage",
            description:
              "Calculate compliance = (Units Used / Expected Units) * 100",
            triggerFieldIds: ["f_da_usedn", "f_da_spno"],
            actionType: "set_value",
            targetFieldId: "f_da_compl",
            conditions: [
              { fieldId: "f_da_usedn", operator: "gt", value: 0 },
              { fieldId: "f_da_spno", operator: "gt", value: 0 },
            ],
            logicalOperator: "AND",
            formulaExpression: "round((dausedn / daspno) * 100, 1)",
          },
        ],
        sections: [
          {
            id: `sec_da_${Date.now()}`,
            title: "IP Dispensation & Reconciliation",
            fields: [
              {
                id: "f_da_test",
                variableName: "DATEST",
                label: "Kit / Bottle Number (e.g. KIT-10492)",
                dataType: "text",
                columnSpan: 6,
                required: true,
                placeholder: "e.g. KIT-90421",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DA.find(
                  (v) => v.sdtmVariable === "DATEST"
                ),
              },
              {
                id: "f_da_stdtc",
                variableName: "DASTDTC",
                label: "Dispensation Date",
                dataType: "date",
                columnSpan: 3,
                required: true,
                cdashMetadata: CDASH_STANDARD_VARIABLES.DA.find(
                  (v) => v.sdtmVariable === "DASTDTC"
                ),
              },
              {
                id: "f_da_endtc",
                variableName: "DAENDTC",
                label: "Return Date",
                dataType: "date",
                columnSpan: 3,
                required: false,
                cdashMetadata: CDASH_STANDARD_VARIABLES.DA.find(
                  (v) => v.sdtmVariable === "DAENDTC"
                ),
              },
              {
                id: "f_da_spno",
                variableName: "DASPNO",
                label: "Total Units Dispensed",
                dataType: "integer",
                columnSpan: 3,
                required: true,
                minValue: 1,
                cdashMetadata: CDASH_STANDARD_VARIABLES.DA.find(
                  (v) => v.sdtmVariable === "DASPNO"
                ),
              },
              {
                id: "f_da_retno",
                variableName: "DARETNO",
                label: "Units Returned",
                dataType: "integer",
                columnSpan: 3,
                required: false,
                minValue: 0,
                cdashMetadata: CDASH_STANDARD_VARIABLES.DA.find(
                  (v) => v.sdtmVariable === "DARETNO"
                ),
              },
              {
                id: "f_da_usedn",
                variableName: "DAUSEDN",
                label: "Units Administered / Used",
                dataType: "integer",
                columnSpan: 3,
                required: true,
                minValue: 0,
                cdashMetadata: CDASH_STANDARD_VARIABLES.DA.find(
                  (v) => v.sdtmVariable === "DAUSEDN"
                ),
              },
              {
                id: "f_da_compl",
                variableName: "DACOMPL",
                label: "Subject Compliance Rate (%)",
                dataType: "calculated",
                columnSpan: 3,
                required: false,
                readOnly: true,
                unit: "%",
                calculationFormula: "round((dausedn / daspno) * 100, 1)",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DA.find(
                  (v) => v.sdtmVariable === "DACOMPL"
                ),
              },
              {
                id: "f_da_recon",
                variableName: "DARECON",
                label: "Reconciliation Status",
                dataType: "single_select",
                columnSpan: 12,
                required: true,
                codelistId: "CL_DARECON",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DA.find(
                  (v) => v.sdtmVariable === "DARECON"
                ),
              },
            ],
          },
        ],
      };

    case "EX":
      return {
        id: formId,
        name: "Study Treatment Administration & Exposure",
        domain: "EX",
        description:
          "Investigational Product (IP) dosage, administration route, infusion timing, and dose modifications",
        version: "1.0",
        rules: [],
        sections: [
          {
            id: `sec_ex_${Date.now()}`,
            title: "Dosing & Exposure Administration Record",
            fields: [
              {
                id: "f_ex_trt",
                variableName: "EXTRT",
                label: "Treatment / Investigational Drug Name",
                dataType: "text",
                columnSpan: 6,
                required: true,
                placeholder: "e.g. Study Drug AB-101 / Placebo",
                cdashMetadata: CDASH_STANDARD_VARIABLES.EX.find(
                  (v) => v.sdtmVariable === "EXTRT"
                ),
              },
              {
                id: "f_ex_dose",
                variableName: "EXDOSE",
                label: "Dose Administered",
                dataType: "number",
                columnSpan: 3,
                required: true,
                minValue: 0,
                cdashMetadata: CDASH_STANDARD_VARIABLES.EX.find(
                  (v) => v.sdtmVariable === "EXDOSE"
                ),
              },
              {
                id: "f_ex_dosu",
                variableName: "EXDOSU",
                label: "Dose Units",
                dataType: "single_select",
                columnSpan: 3,
                required: true,
                codelistId: "CL_DOSU",
                cdashMetadata: CDASH_STANDARD_VARIABLES.EX.find(
                  (v) => v.sdtmVariable === "EXDOSU"
                ),
              },
              {
                id: "f_ex_route",
                variableName: "EXROUTE",
                label: "Route of Administration",
                dataType: "single_select",
                columnSpan: 6,
                required: true,
                codelistId: "CL_ROUTE",
                cdashMetadata: CDASH_STANDARD_VARIABLES.EX.find(
                  (v) => v.sdtmVariable === "EXROUTE"
                ),
              },
              {
                id: "f_ex_dosfrm",
                variableName: "EXDOSFRM",
                label: "Dosage Form",
                dataType: "text",
                columnSpan: 6,
                required: false,
                placeholder: "e.g. Solution for IV Infusion, Oral Capsule",
                cdashMetadata: CDASH_STANDARD_VARIABLES.EX.find(
                  (v) => v.sdtmVariable === "EXDOSFRM"
                ),
              },
              {
                id: "f_ex_stdtc",
                variableName: "EXSTDTC",
                label: "Administration Start Date/Time",
                dataType: "datetime",
                columnSpan: 6,
                required: true,
                cdashMetadata: CDASH_STANDARD_VARIABLES.EX.find(
                  (v) => v.sdtmVariable === "EXSTDTC"
                ),
              },
              {
                id: "f_ex_endtc",
                variableName: "EXENDTC",
                label: "Administration End Date/Time",
                dataType: "datetime",
                columnSpan: 6,
                required: false,
                cdashMetadata: CDASH_STANDARD_VARIABLES.EX.find(
                  (v) => v.sdtmVariable === "EXENDTC"
                ),
              },
              {
                id: "f_ex_adj",
                variableName: "EXADJ",
                label: "Reason for Dose Modification or Interruption",
                dataType: "text",
                columnSpan: 12,
                required: false,
                placeholder: "e.g. Dose delayed due to Grade 3 neutropenia",
                cdashMetadata: CDASH_STANDARD_VARIABLES.EX.find(
                  (v) => v.sdtmVariable === "EXADJ"
                ),
              },
            ],
          },
        ],
      };

    case "MH":
      return {
        id: formId,
        name: "General Medical History",
        domain: "MH",
        description:
          "Baseline medical history, prior diagnoses, and surgical history by body system",
        version: "1.0",
        isLogForm: true,
        rules: [],
        sections: [
          {
            id: `sec_mh_${Date.now()}`,
            title: "Medical Condition / Diagnosis",
            fields: [
              {
                id: "f_mh_term",
                variableName: "MHTERM",
                label: "Medical Condition / Diagnosis (Reported Term)",
                dataType: "text",
                columnSpan: 6,
                required: true,
                placeholder: "e.g. Essential Hypertension, Type 2 Diabetes",
                cdashMetadata: CDASH_STANDARD_VARIABLES.MH.find(
                  (v) => v.sdtmVariable === "MHTERM"
                ),
              },
              {
                id: "f_mh_cat",
                variableName: "MHCAT",
                label: "Body System Category",
                dataType: "single_select",
                columnSpan: 6,
                required: true,
                codelistId: "CL_MHCAT",
                cdashMetadata: CDASH_STANDARD_VARIABLES.MH.find(
                  (v) => v.sdtmVariable === "MHCAT"
                ),
              },
              {
                id: "f_mh_stdtc",
                variableName: "MHSTDTC",
                label: "Diagnosis / Onset Date",
                dataType: "partial_date",
                columnSpan: 4,
                required: true,
                cdashMetadata: CDASH_STANDARD_VARIABLES.MH.find(
                  (v) => v.sdtmVariable === "MHSTDTC"
                ),
              },
              {
                id: "f_mh_ongo",
                variableName: "MHONGO",
                label: "Condition Ongoing?",
                dataType: "radio",
                columnSpan: 4,
                required: true,
                codelistId: "CL_NY",
                cdashMetadata: CDASH_STANDARD_VARIABLES.MH.find(
                  (v) => v.sdtmVariable === "MHONGO"
                ),
              },
              {
                id: "f_mh_endtc",
                variableName: "MHENDTC",
                label: "Resolution / End Date",
                dataType: "partial_date",
                columnSpan: 4,
                required: false,
                cdashMetadata: CDASH_STANDARD_VARIABLES.MH.find(
                  (v) => v.sdtmVariable === "MHENDTC"
                ),
              },
            ],
          },
        ],
      };

    case "DS":
      return {
        id: formId,
        name: "Subject Disposition & Milestone Status",
        domain: "DS",
        description:
          "Study completion, discontinuation reasons, and protocol milestone tracking",
        version: "1.0",
        rules: [],
        sections: [
          {
            id: `sec_ds_${Date.now()}`,
            title: "Study Completion & Disposition",
            fields: [
              {
                id: "f_ds_cat",
                variableName: "DSCAT",
                label: "Protocol Milestone / Epoch",
                dataType: "text",
                columnSpan: 6,
                required: true,
                placeholder: "e.g. Treatment Epoch, Study Completion",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DS.find(
                  (v) => v.sdtmVariable === "DSCAT"
                ),
              },
              {
                id: "f_ds_decod",
                variableName: "DSDECOD",
                label: "Primary Disposition Status / Discontinuation Reason",
                dataType: "single_select",
                columnSpan: 6,
                required: true,
                codelistId: "CL_DSCONT",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DS.find(
                  (v) => v.sdtmVariable === "DSDECOD"
                ),
              },
              {
                id: "f_ds_stdtc",
                variableName: "DSSTDTC",
                label: "Effective Date of Disposition / Discontinuation",
                dataType: "date",
                columnSpan: 6,
                required: true,
                cdashMetadata: CDASH_STANDARD_VARIABLES.DS.find(
                  (v) => v.sdtmVariable === "DSSTDTC"
                ),
              },
              {
                id: "f_ds_term",
                variableName: "DSTERM",
                label: "Investigator Comments / Specific Reason",
                dataType: "textarea",
                columnSpan: 12,
                required: false,
                placeholder:
                  "Provide additional details regarding the disposition reason...",
                cdashMetadata: CDASH_STANDARD_VARIABLES.DS.find(
                  (v) => v.sdtmVariable === "DSTERM"
                ),
              },
            ],
          },
        ],
      };

    default:
      throw new Error(`Unsupported CDASH domain: ${domainCode}`);
  }
}
