import type { StudyProtocol } from "@/lib/crf";

/**
 * Synthetic two-arm study for the form variant journey (#675): one Vital
 * Signs form shared by two visits, both arms following the visit default.
 */
export function buildSharedVitalsStudy(): StudyProtocol {
  return {
    id: "study_variant_demo",
    protocolNumber: "SYN-VAR-001",
    studyName: "Synthetic Variant Demonstration Study",
    phase: "Phase II",
    sponsor: "Synthetic Sponsor",
    therapeuticArea: "Cardiology",
    version: "1.0.0",
    lastModified: "2026-01-01T00:00:00.000Z",
    codelists: [],
    arms: [
      { id: "arm_active", name: "Active", type: "Experimental" },
      { id: "arm_placebo", name: "Placebo", type: "Placebo Comparator" },
    ],
    visits: [
      {
        id: "v_wk2",
        oid: "SE.WK2",
        name: "Week 2",
        visitType: "Scheduled",
        targetDay: 14,
        windowBefore: 2,
        windowAfter: 2,
        armIds: ["arm_active", "arm_placebo"],
        assignedFormIds: ["form_dm", "form_vs"],
      },
      {
        id: "v_wk4",
        oid: "SE.WK4",
        name: "Week 4",
        visitType: "Scheduled",
        targetDay: 28,
        windowBefore: 2,
        windowAfter: 2,
        armIds: ["arm_active", "arm_placebo"],
        assignedFormIds: ["form_vs"],
      },
    ],
    forms: [
      {
        id: "form_dm",
        name: "Demographics",
        domain: "DM",
        description: "Synthetic demographics",
        version: "1.0",
        sections: [
          {
            id: "sec_dm",
            title: "Subject",
            fields: [
              {
                id: "fld_age",
                variableName: "AGE",
                label: "Age",
                dataType: "integer",
                columnSpan: 6,
                required: true,
              },
            ],
          },
        ],
        rules: [],
      },
      {
        id: "form_vs",
        name: "Vital Signs",
        domain: "VS",
        description: "Synthetic vital signs",
        version: "1.0",
        sections: [
          {
            id: "sec_vs",
            title: "Blood Pressure",
            fields: [
              {
                id: "fld_sys",
                variableName: "SYSBP",
                label: "Systolic BP",
                dataType: "integer",
                columnSpan: 6,
                required: true,
                unit: "mmHg",
              },
              {
                id: "fld_dia",
                variableName: "DIABP",
                label: "Diastolic BP",
                dataType: "integer",
                columnSpan: 6,
                required: true,
                unit: "mmHg",
              },
              {
                id: "fld_map",
                variableName: "MAP",
                label: "Mean Arterial Pressure",
                dataType: "calculated",
                columnSpan: 6,
                required: false,
                calculationFormula: "(fld_sys + 2 * fld_dia) / 3",
              },
              {
                id: "fld_reps",
                variableName: "VSREPS",
                label: "Repeat Readings",
                dataType: "repeating_table",
                columnSpan: 12,
                required: false,
                repeatingColumns: [
                  {
                    id: "fld_rep_sys",
                    variableName: "VSREPSYS",
                    label: "Repeat Systolic",
                    dataType: "integer",
                    columnSpan: 6,
                    required: false,
                  },
                ],
              },
            ],
          },
        ],
        rules: [
          {
            id: "rule_dia_lt_sys",
            name: "Diastolic below systolic",
            description: "Diastolic must be lower than systolic",
            triggerFieldIds: ["fld_sys", "fld_dia"],
            actionType: "raise_query",
            targetFieldId: "fld_dia",
            conditions: [
              {
                fieldId: "fld_dia",
                operator: "gte",
                value: 0,
                compareFieldId: "fld_sys",
              },
            ],
            logicalOperator: "AND",
            conditionGroups: [
              {
                id: "grp_bp",
                logicalOperator: "AND",
                conditions: [
                  {
                    fieldId: "fld_dia",
                    operator: "gte",
                    value: 0,
                    compareFieldId: "fld_sys",
                  },
                ],
              },
            ],
            querySeverity: "warning",
            queryMessage: "Diastolic is not below systolic",
          },
          {
            id: "rule_map_calc",
            name: "Derive MAP",
            description: "Mean arterial pressure",
            triggerFieldIds: ["SYSBP", "DIABP"],
            actionType: "set_value",
            targetFieldId: "fld_map",
            conditions: [],
            logicalOperator: "AND",
            formulaExpression: "(fld_sys + 2 * fld_dia) / 3",
          },
        ],
      },
    ],
  };
}
