// @vitest-environment node
import { describe, it, expect } from "vitest";
import { importStudyFromCsvSpec } from "@/lib/crf";

describe("CRF Studio - CSV Study Specification Parser", () => {
  it("parses structured CSV study specifications into valid StudyProtocol", () => {
    const csvContent = `Domain,Form,Variable (CDASH),Label,Data Type,Core,aCRF Overlay Tag
DM,Demographics,BRTHYR,Year of Birth,integer,HR,DM.BRTHYR
DM,Demographics,SEX,Sex,single_select,R,DM.SEX
VS,Vital Signs,SYSBP,Systolic Blood Pressure,number,R,VS.SYSBP
VS,Vital Signs,DIABP,Diastolic Blood Pressure,number,R,VS.DIABP`;

    const parsed = importStudyFromCsvSpec(csvContent);

    expect(parsed.protocolNumber).toContain("CSV-SPEC-");
    expect(parsed.forms.length).toBe(2);

    const dmForm = parsed.forms.find((f) => f.domain === "DM");
    expect(dmForm).toBeDefined();
    expect(dmForm?.name).toBe("Demographics");
    expect(dmForm?.sections[0].fields.length).toBe(2);

    const brthyr = dmForm?.sections[0].fields[0];
    expect(brthyr?.variableName).toBe("BRTHYR");
    expect(brthyr?.dataType).toBe("integer");
    expect(brthyr?.cdashMetadata?.core).toBe("HR");

    const vsForm = parsed.forms.find((f) => f.domain === "VS");
    expect(vsForm).toBeDefined();
    expect(vsForm?.sections[0].fields.length).toBe(2);

    expect(parsed.visits.length).toBeGreaterThan(0);
    expect(parsed.provenance?.sourceFormat).toBe("CSV Study Specification");
  });

  it("handles quoted CSV values with embedded commas", () => {
    const csvContent = `Domain,Form,Variable,Label,Type,Core
AE,"Adverse Events, Serious & Non-Serious",AETERM,"Reported Term for Adverse Event, verbatim",text,R`;

    const parsed = importStudyFromCsvSpec(csvContent);
    expect(parsed.forms.length).toBe(1);
    expect(parsed.forms[0].name).toBe("Adverse Events, Serious & Non-Serious");
    expect(parsed.forms[0].sections[0].fields[0].label).toBe(
      "Reported Term for Adverse Event, verbatim"
    );
  });

  it("throws actionable errors for empty or malformed CSV content", () => {
    expect(() => importStudyFromCsvSpec("")).toThrow("Empty file content");
    expect(() => importStudyFromCsvSpec("Domain,Form,Variable")).toThrow(
      "Insufficient rows"
    );
  });

  describe("REDCap CSV Data Dictionary Dialect", () => {
    const redcapCsv = `"Variable / Field Name","Form Name","Section Header","Field Type","Field Label","Choices, Calculations, OR Slider Labels","Field Note","Text Validation Type OR Show Slider Number","Text Validation Min","Text Validation Max","Identifier?","Branching Logic (Show field only if...)","Required?","Custom Alignment","Question Number (surveys only)","Matrix Group Name","Matrix Ranking?","Field Annotation"
"record_id","demographics","<h3>Participant Demographics</h3>","text","Record ID","","Study identifier","","","","","","y","","","","",""
"dob","demographics","","text","Date of Birth","","YYYY-MM-DD","date_ymd","1900-01-01","2026-01-01","","[record_id] != ''","y","","","","",""
"age","demographics","","text","Age","","Years","integer","18","120","","[dob] != ''","y","","","","",""
"gender","demographics","","radio","Gender","1, Male | 2, Female | 3, Non-binary | 99, Prefer not to say","","","","","","","y","","","","",""
"sex_at_birth","demographics","","dropdown","Sex assigned at birth","1, Male | 2, Female | 3, Non-binary | 99, Prefer not to say","","","","","","","n","","","","",""
"pregnant","demographics","","yesno","Is the participant pregnant?","","","","","","","[gender] = '2'","n","","","","",""
"notes_general","demographics","","notes","Additional demographic notes","","","","","","","","n","","","","",""
"sysbp","vital_signs","<h3>Vital Signs Measurements</h3>","text","Systolic Blood Pressure","","mmHg","number","60","240","","","y","","","","",""
"diabp","vital_signs","","text","Diastolic Blood Pressure","","mmHg","number","40","140","","","y","","","","",""
"height_cm","vital_signs","Anthropometrics","text","Height","","cm","number","50","250","","","y","","","","",""
"weight_kg","vital_signs","","text","Weight","","kg","number","20","300","","","y","","","","",""
"bmi_calc","vital_signs","","calc","Body Mass Index","[weight_kg] / (([height_cm]/100) * ([height_cm]/100))","","","","","","","n","","","","",""
"pain_vas","vital_signs","","slider","Current Pain Level","No pain | Worst imaginable pain","","","","","","","n","","","","",""
"symptoms","vital_signs","","checkbox","Presenting Symptoms","1, Fever | 2, Cough | 3, Fatigue | 4, Dyspnea","","","","","","","n","","","","",""
"advanced_logic","vital_signs","","text","Advanced Follow-up","","","","","","","datediff([dob], 'today', 'y') >= 50 and [gender] = '2'","n","","","","",""`;

    it("auto-detects REDCap CSV data dictionary and parses multi-form study with sections", () => {
      const parsed = importStudyFromCsvSpec(redcapCsv);

      expect(parsed.provenance?.sourceFormat).toBe(
        "REDCap CSV Data Dictionary"
      );
      expect(parsed.forms.length).toBe(2);

      // Verify Demographics Form
      const dmForm = parsed.forms.find((f) => f.domain === "DM");
      expect(dmForm).toBeDefined();
      expect(dmForm?.name).toBe("Demographics");
      expect(dmForm?.sections.length).toBe(1);
      expect(dmForm?.sections[0].title).toBe("Participant Demographics");
      expect(dmForm?.sections[0].fields.length).toBe(7);

      // Verify Vital Signs Form with multiple sections
      const vsForm = parsed.forms.find((f) => f.domain === "VS");
      expect(vsForm).toBeDefined();
      expect(vsForm?.name).toBe("Vital Signs");
      expect(vsForm?.sections.length).toBe(2);
      expect(vsForm?.sections[0].title).toBe("Vital Signs Measurements");
      expect(vsForm?.sections[0].fields.length).toBe(2); // sysbp, diabp
      expect(vsForm?.sections[1].title).toBe("Anthropometrics");
      expect(vsForm?.sections[1].fields.length).toBe(6); // height, weight, bmi, pain, symptoms, advanced_logic
    });

    it("correctly maps REDCap field types and validation constraints", () => {
      const parsed = importStudyFromCsvSpec(redcapCsv);
      const dmForm = parsed.forms.find((f) => f.domain === "DM")!;
      const vsForm = parsed.forms.find((f) => f.domain === "VS")!;

      const fieldsMap = new Map(
        [...dmForm.sections, ...vsForm.sections]
          .flatMap((s) => s.fields)
          .map((f) => [f.variableName, f])
      );

      // text with date_ymd -> date
      const dob = fieldsMap.get("dob")!;
      expect(dob.dataType).toBe("date");
      expect(dob.required).toBe(true);

      // text with integer validation -> integer, min/max
      const age = fieldsMap.get("age")!;
      expect(age.dataType).toBe("integer");
      expect(age.minValue).toBe(18);
      expect(age.maxValue).toBe(120);

      // radio and dropdown
      const gender = fieldsMap.get("gender")!;
      expect(gender.dataType).toBe("radio");
      expect(gender.required).toBe(true);

      const sex = fieldsMap.get("sex_at_birth")!;
      expect(sex.dataType).toBe("single_select");
      expect(sex.required).toBe(false);

      // yesno
      const pregnant = fieldsMap.get("pregnant")!;
      expect(pregnant.dataType).toBe("radio");

      // notes -> textarea
      const notes = fieldsMap.get("notes_general")!;
      expect(notes.dataType).toBe("textarea");

      // text with number validation
      const sysbp = fieldsMap.get("sysbp")!;
      expect(sysbp.dataType).toBe("number");
      expect(sysbp.minValue).toBe(60);
      expect(sysbp.maxValue).toBe(240);

      // calc -> calculated with formula
      const bmi = fieldsMap.get("bmi_calc")!;
      expect(bmi.dataType).toBe("calculated");
      expect(bmi.calculationFormula).toBe(
        "[weight_kg] / (([height_cm]/100) * ([height_cm]/100))"
      );

      // slider -> vas_scale with min/max labels
      const pain = fieldsMap.get("pain_vas")!;
      expect(pain.dataType).toBe("vas_scale");
      expect(pain.scaleMinLabel).toBe("No pain");
      expect(pain.scaleMaxLabel).toBe("Worst imaginable pain");

      // checkbox
      const symptoms = fieldsMap.get("symptoms")!;
      expect(symptoms.dataType).toBe("checkbox");
    });

    it("parses choice definitions into reusable study codelists", () => {
      const parsed = importStudyFromCsvSpec(redcapCsv);

      // Gender and Sex At Birth have the same choices and should share a codelist
      const dmForm = parsed.forms.find((f) => f.domain === "DM")!;
      const gender = dmForm.sections[0].fields.find(
        (f) => f.variableName === "gender"
      )!;
      const sex = dmForm.sections[0].fields.find(
        (f) => f.variableName === "sex_at_birth"
      )!;

      expect(gender.codelistId).toBeDefined();
      expect(gender.codelistId).toBe(sex.codelistId);
      expect(gender.customOptions?.length).toBe(4);
      expect(gender.customOptions?.[0]).toEqual({
        code: "1",
        label: "Male",
        order: 1,
      });

      // Study protocol codelists collection is populated
      expect(parsed.codelists.length).toBeGreaterThanOrEqual(3);
      const sharedCodelist = parsed.codelists.find(
        (c) => c.id === gender.codelistId
      );
      expect(sharedCodelist).toBeDefined();
      expect(sharedCodelist?.options.length).toBe(4);
    });

    it("parses compatible branching logic into AstCondition rules", () => {
      const parsed = importStudyFromCsvSpec(redcapCsv);
      const dmForm = parsed.forms.find((f) => f.domain === "DM")!;

      const rule = dmForm.rules.find((r) => r.targetFieldId === "fld_pregnant");
      expect(rule).toBeDefined();
      expect(rule?.actionType).toBe("show_field");
      expect(rule?.conditions.length).toBe(1);
      expect(rule?.conditions[0]).toEqual({
        fieldId: "fld_gender",
        operator: "eq",
        value: "2",
      });
      expect(rule?.unsupportedExpression).toBeUndefined();
    });

    it("preserves unsupported branching logic expressions without throwing", () => {
      const parsed = importStudyFromCsvSpec(redcapCsv);
      const vsForm = parsed.forms.find((f) => f.domain === "VS")!;

      const rule = vsForm.rules.find(
        (r) => r.targetFieldId === "fld_advanced_logic"
      );
      expect(rule).toBeDefined();
      expect(rule?.actionType).toBe("show_field");
      expect(rule?.unsupportedExpression).toBeDefined();
      expect(rule?.unsupportedExpression?.raw).toContain("datediff");
    });

    it("handles UTF-8 BOM in REDCap CSV", () => {
      const bomCsv = "\uFEFF" + redcapCsv;
      const parsed = importStudyFromCsvSpec(bomCsv);
      expect(parsed.provenance?.sourceFormat).toBe(
        "REDCap CSV Data Dictionary"
      );
      expect(parsed.forms.length).toBe(2);
    });

    it("safely decodes HTML entities without double-unescaping vulnerabilities", () => {
      const entityCsv = `"Variable / Field Name","Form Name","Section Header","Field Type","Field Label","Choices, Calculations, OR Slider Labels","Field Note","Text Validation Type OR Show Slider Number","Text Validation Min","Text Validation Max","Identifier?","Branching Logic (Show field only if...)","Required?","Custom Alignment","Question Number (surveys only)","Matrix Group Name","Matrix Ranking?","Field Annotation"
"test_html","safety","<h3>Safety &amp; Efficacy</h3>","text","Systolic &lt; 120 &amp; Diastolic &gt; 80","1, Option &amp; Choice | 2, Less &lt; More","Note with &amp;lt;script&amp;gt; tag","","","","","","y","","","","",""`;

      const parsed = importStudyFromCsvSpec(entityCsv);
      const form = parsed.forms.find((f) => f.name === "Safety");
      expect(form).toBeDefined();

      const section = form?.sections[0];
      expect(section?.title).toBe("Safety & Efficacy");

      const field = section?.fields[0];
      expect(field?.label).toBe("Systolic < 120 & Diastolic > 80");
      // Double unescaping prevention: &amp;lt;script&amp;gt; must decode to &lt;script&gt;, not <script>
      expect(field?.description).toBe("Note with &lt;script&gt; tag");

      // Verify custom choices
      expect(field?.customOptions?.[0].label).toBe("Option & Choice");
      expect(field?.customOptions?.[1].label).toBe("Less < More");
    });
  });
});
