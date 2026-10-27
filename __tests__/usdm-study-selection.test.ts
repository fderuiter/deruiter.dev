import { describe, expect, it } from "vitest";
import {
  resolveUsdmStudyDesign,
  type UsdmV4Document,
} from "@/lib/clinical-standards";
import { exportStudyToUsdmObject, importStudyFromUsdm } from "@/lib/crf";
import { DEVICE_CARDIOVASCULAR_IMPLANT_PRESET } from "@/lib/crf/presets";
import { prepareStudyHandoff, readStudyDefinition } from "@/lib/study-data";
import { DEMO_301_USDM } from "@/lib/study-data/presets";

const DEVICE_USDM = exportStudyToUsdmObject(
  DEVICE_CARDIOVASCULAR_IMPLANT_PRESET
);

/**
 * A copy of `doc` with a second study version, an amendment whose study
 * identifier is AMENDED-1, so a reader that takes the first version shows
 * the original identifier.
 */
function withAmendment(doc: UsdmV4Document): UsdmV4Document {
  const copy = structuredClone(doc);
  const versions = copy.study.versions ?? [];
  const amended = structuredClone(versions[0]);
  amended.id = "amendment_version";
  amended.versionIdentifier = "2";
  amended.studyIdentifiers = amended.studyIdentifiers.map((identifier, i) =>
    i === 0 ? { ...identifier, text: "AMENDED-1" } : identifier
  );
  copy.study.versions = [...versions, amended];
  return copy;
}

/** A copy of `doc` whose only version holds a second design. */
function withSecondDesign(doc: UsdmV4Document): UsdmV4Document {
  const copy = structuredClone(doc);
  const version = (copy.study.versions ?? [])[0];
  const designs = version.studyDesigns ?? [];
  const second = structuredClone(designs[0]);
  second.id = "second_design";
  second.name = "Second design";
  version.studyDesigns = [...designs, second];
  return copy;
}

function firstIds(doc: UsdmV4Document) {
  const version = (doc.study.versions ?? [])[0];
  return {
    studyVersionId: version.id as string,
    studyDesignId: (version.studyDesigns ?? [])[0].id as string,
  };
}

describe("resolveUsdmStudyDesign", () => {
  it("needs no selection for one version with one design", () => {
    const result = resolveUsdmStudyDesign(DEMO_301_USDM.study);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.versionIndex).toBe(0);
      expect(result.designIndex).toBe(0);
    }
  });

  it("asks instead of guessing when there are two versions", () => {
    const result = resolveUsdmStudyDesign(withAmendment(DEMO_301_USDM).study);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ambiguous");
      expect(result.options.map((o) => o.studyVersionId)).toEqual([
        firstIds(DEMO_301_USDM).studyVersionId,
        "amendment_version",
      ]);
    }
  });

  it("asks when one version holds two designs", () => {
    const result = resolveUsdmStudyDesign(withSecondDesign(DEVICE_USDM).study);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ambiguous");
      expect(result.options[0].designs.map((d) => d.id)).toContain(
        "second_design"
      );
    }
  });

  it("reads the selected version and design", () => {
    const doc = withAmendment(DEMO_301_USDM);
    const result = resolveUsdmStudyDesign(doc.study, {
      studyVersionId: "amendment_version",
      studyDesignId: firstIds(DEMO_301_USDM).studyDesignId,
    });
    expect(result.ok && result.versionIndex).toBe(1);
  });

  it("rejects a selection that names nothing in the study", () => {
    const result = resolveUsdmStudyDesign(DEMO_301_USDM.study, {
      studyVersionId: "nope",
      studyDesignId: "nope",
    });
    expect(!result.ok && result.code).toBe("unknown-selection");
  });

  it("reports a study with no version or no design", () => {
    expect(resolveUsdmStudyDesign({ versions: [] })).toMatchObject({
      ok: false,
      code: "no-study-version",
    });
    expect(
      resolveUsdmStudyDesign({ versions: [{ id: "v", studyDesigns: [] }] })
    ).toMatchObject({ ok: false, code: "no-study-design" });
  });
});

describe("the pipeline never reads the first version silently", () => {
  const amended = withAmendment(DEMO_301_USDM);
  const amendment = {
    studyVersionId: "amendment_version",
    studyDesignId: firstIds(DEMO_301_USDM).studyDesignId,
  };

  it("readStudyDefinition refuses an ambiguous document", () => {
    expect(() => readStudyDefinition(amended)).toThrow(
      /choose a study version and design/
    );
  });

  it("readStudyDefinition reads the selected amendment", () => {
    expect(readStudyDefinition(amended, amendment).studyId).toBe("AMENDED-1");
    expect(
      readStudyDefinition(amended, firstIds(DEMO_301_USDM)).studyId
    ).not.toBe("AMENDED-1");
  });

  it("prepareStudyHandoff runs the selected amendment", () => {
    const device = withAmendment(DEVICE_USDM);
    expect(() => prepareStudyHandoff(device)).toThrow(
      /choose a study version and design/
    );
    const { definition } = prepareStudyHandoff(device, {
      studyVersionId: "amendment_version",
      studyDesignId: firstIds(DEVICE_USDM).studyDesignId,
    });
    expect(definition.studyId).toBe("AMENDED-1");
  });

  it("reads one-version documents exactly as before", () => {
    expect(readStudyDefinition(DEMO_301_USDM)).toEqual(
      readStudyDefinition(DEMO_301_USDM, firstIds(DEMO_301_USDM))
    );
  });
});

describe("CRF Studio never imports the first version silently", () => {
  it("throws and names the choices for two versions", () => {
    expect(() => importStudyFromUsdm(withAmendment(DEVICE_USDM))).toThrow(
      /amendment_version/
    );
  });

  it("throws and names the choices for two designs", () => {
    expect(() => importStudyFromUsdm(withSecondDesign(DEVICE_USDM))).toThrow(
      /second_design/
    );
  });

  it("imports the selected version", () => {
    const amended = withAmendment(DEMO_301_USDM);
    const pick = (studyVersionId: string) =>
      importStudyFromUsdm(amended, {
        selection: {
          studyVersionId,
          studyDesignId: firstIds(DEMO_301_USDM).studyDesignId,
        },
      }).protocolNumber;
    expect(pick("amendment_version")).toBe("AMENDED-1");
    expect(pick(firstIds(DEMO_301_USDM).studyVersionId)).toBe("DEMO-301");
  });

  it("imports one-version documents exactly as before", () => {
    expect(importStudyFromUsdm(DEVICE_USDM)).toEqual(
      importStudyFromUsdm(DEVICE_USDM, { selection: firstIds(DEVICE_USDM) })
    );
  });
});
