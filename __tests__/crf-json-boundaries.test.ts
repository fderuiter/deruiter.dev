import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CRF_STUDIO_USDM_EXTENSION_BASE,
  STUDY_PRESETS,
  exportStudyToUsdmObject,
  importStudyFromUsdm,
} from "@/lib/crf";

/**
 * JSON-to-type boundaries in the USDM adapter (#3676). CRF Studio's own USDM
 * extensions and a legacy study's `forms` are checked before they are used:
 * an extension that does not match its shape is ignored and the plain USDM
 * is read, and a legacy form that does not match is skipped.
 */

type Json = Record<string, unknown>;

const preset = STUDY_PRESETS.find(
  (item) => item.id === "device_cardiovascular_implant"
)!;

function exported(): Json {
  return JSON.parse(
    JSON.stringify(exportStudyToUsdmObject(preset.study))
  ) as Json;
}

function design(doc: Json): Json {
  const study = doc.study as { versions: { studyDesigns: Json[] }[] };
  return study.versions[0].studyDesigns[0];
}

/** Rewrites the CRF Studio extension of the given kind on `owner`. */
function rewriteExtension(
  owner: Json,
  kind: string,
  edit: (value: Json) => Json
): void {
  const attrs = owner.extensionAttributes as {
    url: string;
    valueString?: string;
  }[];
  const ext = attrs.find(
    (attr) => attr.url === `${CRF_STUDIO_USDM_EXTENSION_BASE}${kind}`
  );
  if (!ext?.valueString) throw new Error(`no ${kind} extension`);
  ext.valueString = JSON.stringify(edit(JSON.parse(ext.valueString) as Json));
}

describe("CRF Studio USDM extensions", () => {
  it("reads every preset's own extensions on a round trip", () => {
    for (const item of STUDY_PRESETS) {
      const study = importStudyFromUsdm(
        JSON.stringify(exportStudyToUsdmObject(item.study))
      );
      expect(study.visits.map((visit) => visit.id)).toEqual(
        item.study.visits.map((visit) => visit.id)
      );
      expect(study.forms.map((form) => [form.id, form.domain])).toEqual(
        item.study.forms.map((form) => [form.id, form.domain])
      );
    }
  });

  it("reads the plain encounter when its extension has no valid type", () => {
    const doc = exported();
    const encounter = (design(doc).encounters as Json[])[0];
    rewriteExtension(encounter, "encounter", (value) => ({
      ...value,
      type: "Sometimes",
    }));
    const visit = importStudyFromUsdm(JSON.stringify(doc)).visits.find(
      (item) => item.id === encounter.id
    )!;
    expect(["Scheduled", "Unscheduled"]).toContain(visit.visitType);
  });

  it("reads the plain activity when its extension has no domain", () => {
    const doc = exported();
    const activity = (design(doc).activities as Json[])[0];
    const original = preset.study.forms.find(
      (form) => form.id === activity.id
    )!;
    rewriteExtension(activity, "activity", (value) => {
      const { domain: _domain, ...rest } = value;
      return { ...rest, name: "Renamed by a broken extension" };
    });
    const form = importStudyFromUsdm(JSON.stringify(doc)).forms.find(
      (item) => item.id === activity.id
    )!;
    expect(form.name).not.toBe("Renamed by a broken extension");
    expect(form.domain).toBe(original.domain);
  });

  it("reads the plain concept when its extension has no name", () => {
    const doc = exported();
    const study = doc.study as { versions: Json[] };
    const concepts = study.versions[0].biomedicalConcepts as Json[];
    const concept = concepts.find((bc) =>
      (bc.extensionAttributes as { url: string }[] | undefined)?.some(
        (attr) =>
          attr.url === `${CRF_STUDIO_USDM_EXTENSION_BASE}biomedical-concept`
      )
    )!;
    rewriteExtension(concept, "biomedical-concept", (value) => {
      const { name: _name, ...rest } = value;
      return rest;
    });
    const imported = importStudyFromUsdm(
      JSON.stringify(doc)
    ).biomedicalConcepts?.find((bc) => bc.id === concept.id);
    expect(imported?.name).toEqual(expect.any(String));
    expect(imported?.name).not.toBe("");
  });
});

describe("a legacy study's forms", () => {
  const legacy = (forms: unknown[]) =>
    JSON.stringify({
      study: {
        id: "legacy_study",
        name: "Legacy study",
        forms,
        studyDesigns: [{ id: "design_1", name: "Design" }],
      },
    });

  it("reads a form without a domain as GENERAL and skips one that is not an object", () => {
    const study = importStudyFromUsdm(
      legacy([
        "not a form",
        { id: "form_a", name: "Form A", sections: [], rules: [] },
        { id: "form_b", name: "Form B", domain: "VS", sections: [], rules: [] },
      ])
    );
    expect(study.forms.map((form) => [form.id, form.domain])).toEqual([
      ["form_a", "GENERAL"],
      ["form_b", "VS"],
    ]);
  });
});

describe("a legacy form's rules and sections", () => {
  it("keeps a form whose rules lack ids, and leaves those rules to the import's review", () => {
    // The rule importer gives an unidentified rule an id and preserves an
    // unreadable one for review (#540), so the form must reach it.
    const study = importStudyFromUsdm(
      JSON.stringify({
        study: {
          id: "legacy_rules",
          name: "Legacy rules",
          studyDesigns: [{ id: "d1", name: "Design" }],
          forms: [
            {
              id: "form_a",
              name: "Form A",
              domain: "VS",
              sections: [{ title: "No id", fields: [] }],
              rules: [{ name: "No id" }, "not a rule"],
            },
          ],
        },
      })
    );
    expect(study.forms.map((form) => form.id)).toEqual(["form_a"]);
    const rules = study.forms[0].rules;
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(typeof rule.id).toBe("string");
      expect(rule.unsupportedExpression).toBeDefined();
    }
  });
});

describe("the casts this replaced", () => {
  it.each(["library-upgrade.ts", "usdm-adapter.ts"])(
    "leaves no `as unknown as` in %s",
    (file) => {
      const source = fs.readFileSync(
        path.resolve(process.cwd(), "lib/crf/internal", file),
        "utf8"
      );
      expect(source).not.toContain("as unknown as");
    }
  );
});
