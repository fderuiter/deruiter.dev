// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  importStudyFromCsvSpec,
  isRedcapHeader,
  isRedcapCsv,
  detectCsvDialect,
} from "@/lib/crf";

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

      // Verify Demographics Form - domain left unassigned and flagged for review
      const dmForm = parsed.forms.find((f) => f.name === "Demographics");
      expect(dmForm).toBeDefined();
      expect(dmForm?.domain).toBe("");
      expect(dmForm?.needsReview).toBe(true);
      expect(dmForm?.description).toContain(
        "Flagged for review: SDTM domain unassigned"
      );
      expect(dmForm?.sections.length).toBe(1);
      expect(dmForm?.sections[0].title).toBe("Participant Demographics");
      expect(dmForm?.sections[0].fields.length).toBe(7);

      // Verify Vital Signs Form with multiple sections - domain left unassigned
      const vsForm = parsed.forms.find((f) => f.name === "Vital Signs");
      expect(vsForm).toBeDefined();
      expect(vsForm?.domain).toBe("");
      expect(vsForm?.needsReview).toBe(true);
      expect(vsForm?.sections.length).toBe(2);
      expect(vsForm?.sections[0].title).toBe("Vital Signs Measurements");
      expect(vsForm?.sections[0].fields.length).toBe(2); // sysbp, diabp
      expect(vsForm?.sections[1].title).toBe("Anthropometrics");
      expect(vsForm?.sections[1].fields.length).toBe(6); // height, weight, bmi, pain, symptoms, advanced_logic

      // Verify open review threads created to flag forms for SDTM domain assignment
      expect(parsed.reviewThreads?.length).toBe(2);
      expect(parsed.reviewThreads?.[0].target.formName).toBe("Demographics");
      const firstEvent = parsed.reviewThreads?.[0].events[0];
      expect(firstEvent?.type).toBe("comment");
      if (firstEvent && firstEvent.type === "comment") {
        expect(firstEvent.body).toContain("unassigned SDTM domain");
      }
    });

    it("correctly maps REDCap field types and validation constraints", () => {
      const parsed = importStudyFromCsvSpec(redcapCsv);
      const dmForm = parsed.forms.find((f) => f.name === "Demographics")!;
      const vsForm = parsed.forms.find((f) => f.name === "Vital Signs")!;

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
      const dmForm = parsed.forms.find((f) => f.name === "Demographics")!;
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
      const dmForm = parsed.forms.find((f) => f.name === "Demographics")!;

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
      const vsForm = parsed.forms.find((f) => f.name === "Vital Signs")!;

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

    it("tightens dialect detection to the exact 4 REDCap signature headers and rejects ambiguous CDISC specs", () => {
      // Missing 'Field Type' and 'Variable / Field Name' -> must NOT match REDCap
      const cdiscLikeHeaders = [
        "Domain",
        "Form Name",
        "Variable",
        "Field Label",
        "Data Type",
      ];
      expect(isRedcapHeader(cdiscLikeHeaders)).toBe(false);

      // Score-based trick: header having section, choices, and branching but not exact required headers
      const looseHeaders = [
        "Form Name",
        "Section Header",
        "Choices",
        "Branching Logic",
      ];
      expect(isRedcapHeader(looseHeaders)).toBe(false);

      // Exact 4 REDCap signature headers present
      const exactHeaders = [
        "Variable / Field Name",
        "Form Name",
        "Field Type",
        "Field Label",
      ];
      expect(isRedcapHeader(exactHeaders)).toBe(true);

      // Dialect detection routing test
      const cdiscCsv = `Domain,Form Name,Variable,Field Label,Data Type\nDM,Demographics,AGE,Age in Years,integer`;
      expect(detectCsvDialect(cdiscCsv)).toBe("cdisc_spec");
      expect(isRedcapCsv(cdiscCsv)).toBe(false);

      const redcapMinimalCsv = `"Variable / Field Name","Form Name","Field Type","Field Label"\n"pt_id","demographics","text","Patient ID"`;
      expect(detectCsvDialect(redcapMinimalCsv)).toBe("redcap");
      expect(isRedcapCsv(redcapMinimalCsv)).toBe(true);
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

    it("parses and validates against a real public REDCap dictionary (OuhscBbmc/REDCapR simple project)", () => {
      // Real public REDCap Data Dictionary from REDCapR project
      // Source: https://github.com/OuhscBbmc/REDCapR/blob/main/inst/test-data/projects/simple/dictionary.csv
      // Licence: MIT (https://github.com/OuhscBbmc/REDCapR/blob/main/LICENSE)
      // Copyright (c) 2013-2024, University of Oklahoma Health Sciences Center (OUHSC) BBMC
      const realPublicRedcapCsv = `"Variable / Field Name","Form Name","Section Header","Field Type","Field Label","Choices, Calculations, OR Slider Labels","Field Note","Text Validation Type OR Show Slider Number","Text Validation Min","Text Validation Max",Identifier?,"Branching Logic (Show field only if...)","Required Field?","Custom Alignment","Question Number (surveys only)","Matrix Group Name","Matrix Ranking?","Field Annotation"
record_id,demographics,,text,"Study ID",,,,,,,,,,,,,
name_first,demographics,"Contact Information",text,"First Name",,,,,,y,,,,,,,
name_last,demographics,,text,"Last Name",,,,,,y,,,,,,,
address,demographics,,notes,"Street, City, State, ZIP",,,,,,y,,,,,,,
telephone,demographics,,text,"Phone number",,"Include Area Code",phone,,,y,,,,,,,
email,demographics,,text,E-mail,,,email,,,y,,,,,,,
dob,demographics,,text,"Date of birth",,,date_ymd,,,y,,,,,,,
age,demographics,,text,"Age (years)",,,,,,,,,,,,,
sex,demographics,,radio,Gender,"0, Female | 1, Male",,,,,,,,,,,,
height,health,,text,"Height (cm)",,,number,130,215,,,,,,,,
weight,health,,text,"Weight (kilograms)",,,integer,35,200,,,,,,,,
bmi,health,,calc,BMI,"round(([weight]*10000)/(([height])^(2)),1)",,,,,,,,,,,,
comments,health,"General Comments",notes,Comments,,,,,,,,,,,,,
mugshot,health,,file,Mugshot,,,,,,,,,,,,,
race,race_and_ethnicity,,checkbox,"Race (Select all that apply)","1, American Indian/Alaska Native | 2, Asian | 3, Native Hawaiian or Other Pacific Islander | 4, Black or African American | 5, White | 6, Unknown / Not Reported",,,,,,,,,,,,
ethnicity,race_and_ethnicity,,radio,Ethnicity,"0, Unknown / Not Reported | 1, NOT Hispanic or Latino | 2, Hispanic or Latino",,,,,,,,,,,,`;

      expect(isRedcapCsv(realPublicRedcapCsv)).toBe(true);
      expect(detectCsvDialect(realPublicRedcapCsv)).toBe("redcap");

      const study = importStudyFromCsvSpec(realPublicRedcapCsv);

      expect(study.provenance?.sourceFormat).toBe("REDCap CSV Data Dictionary");
      // 3 distinct instruments/forms in this dictionary
      expect(study.forms.length).toBe(3);

      const demoForm = study.forms.find((f) => f.name === "Demographics");
      const healthForm = study.forms.find((f) => f.name === "Health");
      const raceForm = study.forms.find((f) => f.name === "Race And Ethnicity");

      expect(demoForm).toBeDefined();
      expect(healthForm).toBeDefined();
      expect(raceForm).toBeDefined();

      // All forms have unassigned domain and are flagged for review
      for (const form of [demoForm!, healthForm!, raceForm!]) {
        expect(form.domain).toBe("");
        expect(form.needsReview).toBe(true);
        expect(form.description).toContain(
          "Flagged for review: SDTM domain unassigned"
        );
      }

      // Review threads created for all 3 forms
      expect(study.reviewThreads?.length).toBe(3);

      // Verify Demographics sections and fields
      expect(demoForm?.sections.length).toBe(2);
      expect(demoForm?.sections[0].title).toBe("Demographics Details");
      expect(demoForm?.sections[0].fields[0].variableName).toBe("record_id");
      expect(demoForm?.sections[1].title).toBe("Contact Information");

      const demoFields = demoForm!.sections.flatMap((s) => s.fields);
      const recordId = demoFields.find((f) => f.variableName === "record_id")!;
      expect(recordId.dataType).toBe("text");
      expect(recordId.label).toBe("Study ID");

      const dob = demoFields.find((f) => f.variableName === "dob")!;
      expect(dob.dataType).toBe("date");
      expect(dob.required).toBe(false);

      const address = demoFields.find((f) => f.variableName === "address")!;
      expect(address.dataType).toBe("textarea");

      const sex = demoFields.find((f) => f.variableName === "sex")!;
      expect(sex.dataType).toBe("radio");
      expect(sex.customOptions?.length).toBe(2);
      expect(sex.customOptions?.[0]).toEqual({
        code: "0",
        label: "Female",
        order: 1,
      });
      expect(sex.customOptions?.[1]).toEqual({
        code: "1",
        label: "Male",
        order: 2,
      });

      // Verify Health form sections, validation ranges and calculation formula
      expect(healthForm?.sections.length).toBe(2);
      expect(healthForm?.sections[1].title).toBe("General Comments");

      const healthFields = healthForm!.sections.flatMap((s) => s.fields);
      const height = healthFields.find((f) => f.variableName === "height")!;
      expect(height.dataType).toBe("number");
      expect(height.minValue).toBe(130);
      expect(height.maxValue).toBe(215);

      const weight = healthFields.find((f) => f.variableName === "weight")!;
      expect(weight.dataType).toBe("integer");
      expect(weight.minValue).toBe(35);
      expect(weight.maxValue).toBe(200);

      const bmi = healthFields.find((f) => f.variableName === "bmi")!;
      expect(bmi.dataType).toBe("calculated");
      expect(bmi.calculationFormula).toBe(
        "round(([weight]*10000)/(([height])^(2)),1)"
      );

      const comments = healthFields.find((f) => f.variableName === "comments")!;
      expect(comments.dataType).toBe("textarea");

      // Verify Race & Ethnicity form
      const raceFields = raceForm!.sections.flatMap((s) => s.fields);
      const race = raceFields.find((f) => f.variableName === "race")!;
      expect(race.dataType).toBe("checkbox");
      expect(race.customOptions?.length).toBe(6);

      const ethnicity = raceFields.find((f) => f.variableName === "ethnicity")!;
      expect(ethnicity.dataType).toBe("radio");
      expect(ethnicity.customOptions?.length).toBe(3);

      // Verify study codelists are populated
      expect(study.codelists.length).toBeGreaterThanOrEqual(3);
    });
  });
});
