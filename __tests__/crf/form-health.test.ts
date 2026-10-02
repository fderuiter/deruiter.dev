// @vitest-environment node
import { describe, it, expect } from "vitest";
import { computeFormHealthMetrics } from "@/lib/crf/form-health";
import { CRFForm } from "@/lib/crf/types";
import { fromAny } from "@total-typescript/shoehorn";

describe("computeFormHealthMetrics", () => {
  it("computes accurate variable counts, mandatory fields, codelist attachments, and SDV readiness", () => {
    const mockForm: CRFForm = {
      id: "form_demog",
      name: "Demographics",
      domain: "DM",
      description: "Demographics Case Report Form",
      version: "1.0",
      sections: [
        {
          id: "sec_1",
          title: "General",
          fields: [
            {
              id: "f1",
              variableName: "SUBJID",
              label: "Subject Identifier",
              dataType: "text",
              required: true,
              columnSpan: 6,
              sdvVerified: true,
            },
            {
              id: "f2",
              variableName: "SEX",
              label: "Sex",
              dataType: "radio",
              required: true,
              codelistId: "CL_SEX",
              columnSpan: 6,
              sdvVerified: false,
            },
            {
              id: "f3",
              variableName: "ETHNIC",
              label: "Ethnicity",
              dataType: "single_select",
              required: false,
              customOptions: [
                { code: "HISP", label: "Hispanic", order: 1 },
                { code: "NOT_HISP", label: "Not Hispanic", order: 2 },
              ],
              columnSpan: 12,
              sdvVerified: true,
            },
          ],
        },
      ],
      rules: [],
    };

    const metrics = computeFormHealthMetrics(mockForm);

    expect(metrics.totalFields).toBe(3);
    expect(metrics.mandatoryFields).toBe(2);
    expect(metrics.codelistsAttached).toBe(2);
    expect(metrics.sdvVerifiedCount).toBe(2);
    expect(metrics.sdvReadinessPercentage).toBe(67); // 2/3 rounded
  });

  it("calculates CDASH conformance percentage and identifies missing core domain variables", () => {
    const incompleteDMForm: CRFForm = {
      id: "form_dm",
      name: "Demographics",
      domain: "DM",
      description: "Incomplete Demographics Form",
      version: "1.0",
      sections: [
        {
          id: "sec_1",
          title: "Demographics",
          fields: [
            {
              id: "f1",
              variableName: "AGE",
              label: "Age",
              dataType: "integer",
              required: true,
              columnSpan: 6,
            },
          ],
        },
      ],
      rules: [],
    };

    const metrics = computeFormHealthMetrics(incompleteDMForm);

    expect(metrics.cdashConformancePercentage).toBeLessThan(100);
    expect(metrics.missingCoreVariables).toContain("SEX");
  });

  it("safely handles forms with undefined, null, empty, and whitespace variable names without runtime exceptions", () => {
    const unassignedForm = {
      id: "form_unassigned",
      name: "Draft Form",
      domain: "DM",
      description: "Form with unassigned field properties",
      version: "1.0",
      sections: [
        {
          id: "sec_1",
          title: "Section 1",
          fields: [
            {
              id: "f1",
              variableName: fromAny(undefined),
              label: "Unassigned Field 1",
              dataType: "text",
              required: true,
              columnSpan: 6,
            },
            {
              id: "f2",
              variableName: fromAny(null),
              label: "Unassigned Field 2",
              dataType: "number",
              required: false,
              columnSpan: 6,
            },

            {
              id: "f3",
              variableName: "",
              label: "Unassigned Field 3",
              dataType: "date",
              required: false,
              columnSpan: 6,
            },
            {
              id: "f4",
              variableName: "   ",
              label: "Unassigned Field 4",
              dataType: "single_select",
              required: true,
              columnSpan: 6,
            },
            {
              id: "f5",
              variableName: "SEX",
              label: "Sex",
              dataType: "radio",
              required: true,
              columnSpan: 6,
            },
          ],
        },
      ],
      rules: [],
    } as CRFForm;

    let metrics;
    expect(() => {
      metrics = computeFormHealthMetrics(unassignedForm);
    }).not.toThrow();

    expect(metrics).toBeDefined();
    expect(metrics!.totalFields).toBe(5);
    expect(metrics!.mandatoryFields).toBe(3);
    // Core variables for DM are ["SEX", "AGE", "RACE"].
    // Only "SEX" is present among the 5 fields. The 4 unassigned fields score 0.
    expect(metrics!.missingCoreVariables).toEqual(["AGE", "RACE"]);
    // 1 out of 3 core variables present = 33% conformance
    expect(metrics!.cdashConformancePercentage).toBe(33);
  });

  it("scores zero for standards conformance when all fields in domain have unassigned variable names", () => {
    const allUnassignedDMForm = {
      id: "form_dm_unassigned",
      name: "Unassigned Demographics",
      domain: "DM",
      description: "Draft DM Form with no variable names",
      version: "1.0",
      sections: [
        {
          id: "sec_1",
          title: "Demographics",
          fields: [
            {
              id: "f1",
              label: "Field 1",
              dataType: "text",
              required: true,
              columnSpan: 6,
            },
            {
              id: "f2",
              variableName: "",
              label: "Field 2",
              dataType: "integer",
              required: false,
              columnSpan: 6,
            },
          ],
        },
      ],
      rules: [],
    } as CRFForm;

    const metrics = computeFormHealthMetrics(allUnassignedDMForm);

    expect(metrics.totalFields).toBe(2);
    expect(metrics.mandatoryFields).toBe(1);
    expect(metrics.cdashConformancePercentage).toBe(0);
    expect(metrics.missingCoreVariables).toEqual(["SEX", "AGE", "RACE"]);
  });

  it("handles empty forms with 0 total fields, custom non-existent domains, and customOptions edge cases", () => {
    const emptyForm: CRFForm = {
      id: "form_empty",
      name: "Empty Form",
      domain: "UNKNOWN_DOMAIN",
      description: "Empty",
      version: "1.0",
      sections: [],
      rules: [],
    };

    const emptyMetrics = computeFormHealthMetrics(emptyForm);
    expect(emptyMetrics.totalFields).toBe(0);
    expect(emptyMetrics.sdvReadinessPercentage).toBe(0);
    expect(emptyMetrics.cdashConformancePercentage).toBe(100);
    expect(emptyMetrics.missingCoreVariables).toEqual([]);

    const customOptionsEmptyForm: CRFForm = {
      id: "form_custom_opt_empty",
      name: "Custom Options Empty",
      domain: "DM",
      description: "Test",
      version: "1.0",
      sections: [
        {
          id: "s1",
          title: "S1",
          fields: [
            {
              id: "f_empty_opts",
              variableName: "AGE",
              label: "Age",
              dataType: "single_select",
              required: false,
              customOptions: [], // customOptions.length === 0 and no codelistId -> codelistsAttached = 0
              columnSpan: 6,
            },
          ],
        },
      ],
      rules: [],
    };

    const optMetrics = computeFormHealthMetrics(customOptionsEmptyForm);
    expect(optMetrics.codelistsAttached).toBe(0);
  });
});
