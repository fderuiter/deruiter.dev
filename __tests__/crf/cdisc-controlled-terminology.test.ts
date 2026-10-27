// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  STANDARD_CODELISTS,
  NCI_CODE_REGEX,
  findCodelistById,
  findCodelistByNciCode,
  findOptionByCode,
  findOptionByNciCode,
  matchTermByLabel,
  validateCodelists,
  CDISC_CT_PACKAGE_VERSION,
} from "../../lib/crf/cdisc-controlled-terminology";
import { CDASH_STANDARD_VARIABLES } from "../../lib/crf/cdash-domain-templates";
import { CodelistDefinition } from "../../lib/crf/types";
import ctPackage from "../fixtures/cdisc-ct/ct-subset.json";

interface CtCodelist {
  submissionValue: string;
  name: string;
  extensible: boolean;
  terms: Record<string, string>;
}
const CT_CODELISTS: Record<string, CtCodelist> = ctPackage.codelists;

describe("CDISC Controlled Terminology Codelists & Helpers", () => {
  describe("Requirement 1: 19 Codelists Integrity & NCI C-codes", () => {
    it("should contain exactly 19 standard codelists", () => {
      expect(STANDARD_CODELISTS).toBeDefined();
      expect(STANDARD_CODELISTS.length).toBe(19);
    });

    it("should pass full validation assertions for all 19 codelists with zero errors", () => {
      const validation = validateCodelists(STANDARD_CODELISTS);
      expect(validation.errors).toEqual([]);
      expect(validation.valid).toBe(true);
    });

    it("should have all expected unique codelist IDs starting with CL_", () => {
      const expectedIds = [
        "CL_NY",
        "CL_SEX",
        "CL_RACE",
        "CL_ETHNIC",
        "CL_AESEV",
        "CL_AETOXGR",
        "CL_AEREL",
        "CL_AEOUT",
        "CL_RECIST_RESP",
        "CL_ROUTE",
        "CL_DEDEF",
        "CL_DEREL",
        "CL_DEACT",
        "CL_DISTAT",
        "CL_DUPROC",
        "CL_DSCONT",
        "CL_DARECON",
        "CL_DOSU",
        "CL_MHCAT",
      ];

      const actualIds = STANDARD_CODELISTS.map((cl) => cl.id);
      expect(actualIds).toEqual(expectedIds);

      // Verify strict uniqueness
      const uniqueIds = new Set(actualIds);
      expect(uniqueIds.size).toBe(19);
    });

    it("should give every CDISC codelist a valid NCI C-code and mark sponsor-defined ones by name", () => {
      STANDARD_CODELISTS.forEach((cl) => {
        expect(cl.isStandard).toBe(true);
        if (cl.nciCodelistCode) {
          expect(cl.nciCodelistCode).toMatch(NCI_CODE_REGEX);
        } else {
          expect(cl.name).toMatch(/sponsor-defined/);
        }
      });
    });

    it("should ensure all options have non-empty submission codes and labels, and NCI C-codes only in CDISC codelists", () => {
      STANDARD_CODELISTS.forEach((cl) => {
        expect(cl.options.length).toBeGreaterThan(0);

        const seenCodes = new Set<string>();
        cl.options.forEach((opt) => {
          expect(opt.code).toBeTruthy();
          expect(typeof opt.code).toBe("string");

          expect(opt.label).toBeTruthy();
          expect(typeof opt.label).toBe("string");

          if (opt.nciCode) {
            expect(cl.nciCodelistCode).toBeDefined();
            expect(opt.nciCode).toMatch(NCI_CODE_REGEX);
          }

          expect(typeof opt.order).toBe("number");
          expect(opt.order).toBeGreaterThan(0);

          // Duplicate option code detection inside same codelist
          expect(seenCodes.has(opt.code.toUpperCase())).toBe(false);
          seenCodes.add(opt.code.toUpperCase());
        });
      });
    });

    it("should trigger explicit test failures when duplicate codelist IDs are provided", () => {
      const duplicateCodelists: CodelistDefinition[] = [
        {
          id: "CL_DUPLICATE",
          name: "Test Codelist 1",
          nciCodelistCode: "C10001",
          options: [{ code: "A", label: "Alpha", nciCode: "C20001", order: 1 }],
        },
        {
          id: "CL_DUPLICATE",
          name: "Test Codelist 2 (Duplicate ID)",
          nciCodelistCode: "C10002",
          options: [{ code: "B", label: "Beta", nciCode: "C20002", order: 1 }],
        },
      ];

      const result = validateCodelists(duplicateCodelists);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain(
        'Duplicate codelist ID detected: "CL_DUPLICATE"'
      );
    });

    it("should trigger explicit test failures when duplicate NCI codelist concept codes are detected", () => {
      const duplicateNciCodelists: CodelistDefinition[] = [
        {
          id: "CL_TEST1",
          name: "Test Codelist 1",
          nciCodelistCode: "C66741", // Reuse CL_NY code
          options: [{ code: "A", label: "Alpha", nciCode: "C20001", order: 1 }],
        },
        {
          id: "CL_TEST2",
          name: "Test Codelist 2",
          nciCodelistCode: "C66741", // Duplicate C66741
          options: [{ code: "B", label: "Beta", nciCode: "C20002", order: 1 }],
        },
      ];

      const result = validateCodelists(duplicateNciCodelists);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining(
          'Duplicate NCI Codelist Code detected: "C66741"'
        )
      );
    });

    it("should trigger explicit test failures for invalid NCI C-code formatting or missing attributes", () => {
      const invalidCodelists: CodelistDefinition[] = [
        {
          id: "CL_INVALID_NCI",
          name: "Invalid NCI Code Codelist",
          nciCodelistCode: "INVALID_CODE_123",
          options: [
            {
              code: "OPT1",
              label: "Option 1",
              nciCode: "BAD_NCI_CODE",
              order: 1,
            },
            {
              code: "OPT1",
              label: "Duplicate Option",
              nciCode: "C30002",
              order: 2,
            },
          ],
        },
      ];

      const result = validateCodelists(invalidCodelists);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((err) =>
          err.includes("invalid nciCodelistCode format")
        )
      ).toBe(true);
      expect(
        result.errors.some((err) => err.includes("invalid option nciCode"))
      ).toBe(true);
      expect(
        result.errors.some((err) =>
          err.includes("duplicate option submission code")
        )
      ).toBe(true);
    });
  });

  describe("Requirement 2: Codelist Lookup & Term Matching Helpers", () => {
    describe("findCodelistById", () => {
      it("should look up a codelist by its ID", () => {
        const sexCl = findCodelistById("CL_SEX");
        expect(sexCl).toBeDefined();
        expect(sexCl?.name).toBe("Sex (SEX)");
        expect(sexCl?.nciCodelistCode).toBe("C66731");

        const nyCl = findCodelistById("CL_NY");
        expect(nyCl).toBeDefined();
        expect(nyCl?.nciCodelistCode).toBe("C66742");
      });

      it("should return undefined for non-existent or empty IDs", () => {
        expect(findCodelistById("CL_UNKNOWN")).toBeUndefined();
        expect(findCodelistById("")).toBeUndefined();
      });
    });

    describe("findCodelistByNciCode", () => {
      it("should look up a codelist by its NCI C-code", () => {
        const nyCl = findCodelistByNciCode("C66742");
        expect(nyCl).toBeDefined();
        expect(nyCl?.id).toBe("CL_NY");

        const raceCl = findCodelistByNciCode("C128689");
        expect(raceCl).toBeDefined();
        expect(raceCl?.id).toBe("CL_RACE");
      });

      it("should support case-insensitive NCI code lookup", () => {
        const nyCl = findCodelistByNciCode("c66742");
        expect(nyCl).toBeDefined();
        expect(nyCl?.id).toBe("CL_NY");
      });

      it("should return undefined for non-existent NCI codelist codes", () => {
        expect(findCodelistByNciCode("C999999")).toBeUndefined();
        expect(findCodelistByNciCode("")).toBeUndefined();
      });
    });

    describe("findOptionByCode", () => {
      it("should look up an option by submission code using codelist ID or object", () => {
        const yesOpt = findOptionByCode("CL_NY", "Y");
        expect(yesOpt).toEqual({
          code: "Y",
          label: "Yes",
          nciCode: "C49488",
          order: 2,
        });

        const maleOpt = findOptionByCode("CL_SEX", "M");
        expect(maleOpt).toEqual({
          code: "M",
          label: "Male",
          nciCode: "C20197",
          order: 1,
        });

        const recistCl = findCodelistById("CL_RECIST_RESP")!;
        const crOpt = findOptionByCode(recistCl, "CR");
        expect(crOpt).toEqual({
          code: "CR",
          label: "Complete Response (CR)",
          nciCode: "C4870",
          order: 1,
        });
      });

      it("should handle case-insensitive submission code matching", () => {
        const noOpt = findOptionByCode("CL_NY", "n");
        expect(noOpt).toBeDefined();
        expect(noOpt?.code).toBe("N");
      });

      it("should return undefined for missing or unknown submission codes", () => {
        expect(findOptionByCode("CL_NY", "INVALID")).toBeUndefined();
        expect(findOptionByCode("CL_NONEXISTENT", "Y")).toBeUndefined();
        expect(findOptionByCode("CL_NY", "")).toBeUndefined();
      });
    });

    describe("findOptionByNciCode", () => {
      it("should look up an option by option NCI C-code", () => {
        const noOpt = findOptionByNciCode("CL_NY", "C49487");
        expect(noOpt).toBeDefined();
        expect(noOpt?.code).toBe("N");
        expect(noOpt?.label).toBe("No");

        const femaleOpt = findOptionByNciCode("CL_SEX", "C16576");
        expect(femaleOpt).toBeDefined();
        expect(femaleOpt?.code).toBe("F");
      });

      it("should support case-insensitive option NCI code lookup", () => {
        const yesOpt = findOptionByNciCode("CL_NY", "c49488");
        expect(yesOpt).toBeDefined();
        expect(yesOpt?.code).toBe("Y");
      });

      it("should return undefined for unknown option NCI codes", () => {
        expect(findOptionByNciCode("CL_NY", "C000000")).toBeUndefined();
        expect(findOptionByNciCode("CL_NY", "")).toBeUndefined();
      });
    });

    describe("matchTermByLabel", () => {
      it("should match option by exact label", () => {
        const opt = matchTermByLabel("CL_SEX", "Male");
        expect(opt).toBeDefined();
        expect(opt?.code).toBe("M");

        const opt2 = matchTermByLabel("CL_NY", "Yes");
        expect(opt2).toBeDefined();
        expect(opt2?.code).toBe("Y");
      });

      it("should match option by label case-insensitively by default", () => {
        const opt = matchTermByLabel("CL_SEX", "male");
        expect(opt).toBeDefined();
        expect(opt?.code).toBe("M");

        const opt2 = matchTermByLabel("CL_SEX", "FEMALE");
        expect(opt2).toBeDefined();
        expect(opt2?.code).toBe("F");
      });

      it("should respect caseSensitive option when requested", () => {
        const strictMatch = matchTermByLabel("CL_SEX", "Male", {
          caseSensitive: true,
        });
        expect(strictMatch).toBeDefined();

        const mismatch = matchTermByLabel("CL_SEX", "male", {
          caseSensitive: true,
        });
        expect(mismatch).toBeUndefined();
      });

      it("should return undefined for unmatched or empty term labels", () => {
        expect(matchTermByLabel("CL_SEX", "NonExistentTerm")).toBeUndefined();
        expect(matchTermByLabel("CL_SEX", "")).toBeUndefined();
      });
    });
  });

  // Regression for #2727: codes were borrowed from neighbouring codelists
  // (NY filed under VSTESTCD, SEX under NY, AEOUT under ACN, ...). Every code
  // is now pinned to the published package in the fixture.
  describe("Requirement 3: codes match the CDISC CT package (#2727)", () => {
    it("names the package the codes were checked against", () => {
      expect(CDISC_CT_PACKAGE_VERSION).toBe(ctPackage.package);
    });

    it.each(STANDARD_CODELISTS.filter((cl) => cl.nciCodelistCode))(
      "$id cites a codelist that is in the package",
      (cl) => {
        const ct = CT_CODELISTS[cl.nciCodelistCode!];
        expect(ct, `${cl.nciCodelistCode} is not in the package`).toBeDefined();
        expect(cl.name).toContain(`(${ct.submissionValue})`);
      }
    );

    it.each(STANDARD_CODELISTS.filter((cl) => cl.nciCodelistCode))(
      "$id uses CDISC submission values and term codes",
      (cl) => {
        const ct = CT_CODELISTS[cl.nciCodelistCode!];
        for (const opt of cl.options) {
          if (opt.nciCode === undefined) {
            // A sponsor extension is only allowed in an extensible codelist
            // and must not reuse a CDISC submission value.
            expect(ct.extensible).toBe(true);
            expect(ct.terms[opt.code]).toBeUndefined();
          } else {
            expect(ct.terms[opt.code], `${cl.id} ${opt.code}`).toBe(
              opt.nciCode
            );
          }
        }
      }
    );

    it("keeps NCI codes off every sponsor-defined codelist", () => {
      for (const cl of STANDARD_CODELISTS.filter((c) => !c.nciCodelistCode)) {
        expect(cl.options.every((opt) => opt.nciCode === undefined)).toBe(true);
      }
    });

    it("rejects a sponsor-defined codelist that borrows an NCI term code", () => {
      const result = validateCodelists([
        {
          id: "CL_SPONSOR",
          name: "Sponsor list",
          options: [{ code: "A", label: "Alpha", nciCode: "C66742", order: 1 }],
        },
      ]);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("sponsor-defined");
    });

    it("never cites a retired codelist", () => {
      const retired = Object.keys(ctPackage.retired);
      for (const cl of STANDARD_CODELISTS) {
        expect(retired).not.toContain(cl.nciCodelistCode);
      }
    });

    it("gives every CDASH variable a codelist code that matches its CRF codelist", () => {
      const vars = Object.values(CDASH_STANDARD_VARIABLES).flat();
      const coded = vars.filter((v) => v.nciConceptId || v.codelistId);
      expect(coded.length).toBeGreaterThan(0);
      for (const v of coded) {
        const cl = findCodelistById(v.codelistId ?? "");
        expect(cl, `${v.sdtmVariable} codelist`).toBeDefined();
        expect(v.nciConceptId, v.sdtmVariable).toBe(cl!.nciCodelistCode);
      }
    });
  });
});
