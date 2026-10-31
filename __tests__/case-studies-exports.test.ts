import { describe, expect, expectTypeOf, it } from "vitest";
import * as caseStudiesData from "@/lib/case-studies-data";
import * as caseStudiesBarrel from "@/lib/case-studies";
import type {
  CaseStudyCommandDefinition,
  CaseStudyCommands,
  CaseStudyData,
  CaseStudyPlayback,
  CaseStudyPlaybackStep,
} from "@/lib/case-studies-data";

describe("lib/case-studies-data export contract snapshot (#3488)", () => {
  it("exports the exact set of 13 runtime symbols from the facade", () => {
    expect(Object.keys(caseStudiesData).sort()).toEqual([
      "CARDIAC_RISK_COMMANDS_OBJ",
      "CARDIAC_RISK_PLAYBACK_OBJ",
      "CRF_XL_COMMANDS_OBJ",
      "CRF_XL_PLAYBACK_OBJ",
      "DUCKDEPLOY_COMMANDS_OBJ",
      "DUCKDEPLOY_PLAYBACK_OBJ",
      "FALLBACK_CASE_STUDIES",
      "FOUR_GLORY_COMMANDS_OBJ",
      "FOUR_GLORY_PLAYBACK_OBJ",
      "IMEDNET_COMMANDS_OBJ",
      "IMEDNET_PLAYBACK_OBJ",
      "PROMPTOPS_COMMANDS_OBJ",
      "PROMPTOPS_PLAYBACK_OBJ",
    ]);
  });

  it("exports the exact set of runtime symbols from lib/case-studies package", () => {
    expect(Object.keys(caseStudiesBarrel).sort()).toEqual([
      "CARDIAC_RISK_COMMANDS_OBJ",
      "CARDIAC_RISK_PLAYBACK_OBJ",
      "CRF_XL_COMMANDS_OBJ",
      "CRF_XL_PLAYBACK_OBJ",
      "DUCKDEPLOY_COMMANDS_OBJ",
      "DUCKDEPLOY_PLAYBACK_OBJ",
      "FALLBACK_CASE_STUDIES",
      "FOUR_GLORY_COMMANDS_OBJ",
      "FOUR_GLORY_PLAYBACK_OBJ",
      "IMEDNET_COMMANDS_OBJ",
      "IMEDNET_PLAYBACK_OBJ",
      "PROMPTOPS_COMMANDS_OBJ",
      "PROMPTOPS_PLAYBACK_OBJ",
      "compileCaseStudy",
    ]);
  });

  it("maintains strict reference equality between facade and package entry points", () => {
    expect(caseStudiesData.FALLBACK_CASE_STUDIES).toBe(
      caseStudiesBarrel.FALLBACK_CASE_STUDIES
    );
    expect(caseStudiesData.IMEDNET_COMMANDS_OBJ).toBe(
      caseStudiesBarrel.IMEDNET_COMMANDS_OBJ
    );
    expect(caseStudiesData.IMEDNET_PLAYBACK_OBJ).toBe(
      caseStudiesBarrel.IMEDNET_PLAYBACK_OBJ
    );
    expect(caseStudiesData.DUCKDEPLOY_COMMANDS_OBJ).toBe(
      caseStudiesBarrel.DUCKDEPLOY_COMMANDS_OBJ
    );
    expect(caseStudiesData.DUCKDEPLOY_PLAYBACK_OBJ).toBe(
      caseStudiesBarrel.DUCKDEPLOY_PLAYBACK_OBJ
    );
    expect(caseStudiesData.CARDIAC_RISK_COMMANDS_OBJ).toBe(
      caseStudiesBarrel.CARDIAC_RISK_COMMANDS_OBJ
    );
    expect(caseStudiesData.FOUR_GLORY_COMMANDS_OBJ).toBe(
      caseStudiesBarrel.FOUR_GLORY_COMMANDS_OBJ
    );
    expect(caseStudiesData.CRF_XL_COMMANDS_OBJ).toBe(
      caseStudiesBarrel.CRF_XL_COMMANDS_OBJ
    );
    expect(caseStudiesData.PROMPTOPS_COMMANDS_OBJ).toBe(
      caseStudiesBarrel.PROMPTOPS_COMMANDS_OBJ
    );
  });

  it("re-exports public TypeScript type contracts", () => {
    expectTypeOf<CaseStudyData>().toHaveProperty("id");
    expectTypeOf<CaseStudyData>().toHaveProperty("slug");
    expectTypeOf<CaseStudyData>().toHaveProperty("title");
    expectTypeOf<CaseStudyData>().toHaveProperty("editorial_content");
    expectTypeOf<CaseStudyData>().toHaveProperty("architectural_narrative");
    expectTypeOf<CaseStudyData>().toHaveProperty("published");
    expectTypeOf<CaseStudyData>().toHaveProperty("primary_language");
    expectTypeOf<CaseStudyData>().toHaveProperty("github_url");
    expectTypeOf<CaseStudyData>().toHaveProperty("tags");
    expectTypeOf<CaseStudyData>().toHaveProperty("created_at");
    expectTypeOf<CaseStudyData>().toHaveProperty("updated_at");

    expectTypeOf<CaseStudyCommandDefinition>().toHaveProperty("description");
    expectTypeOf<CaseStudyCommandDefinition>().toHaveProperty("payload");

    expectTypeOf<CaseStudyCommands>().toBeObject();
    expectTypeOf<CaseStudyPlayback>().toBeArray();

    expectTypeOf<CaseStudyPlaybackStep>().toHaveProperty("command");
    expectTypeOf<CaseStudyPlaybackStep>().toHaveProperty("description");
  });

  it("preserves exact canonical sequence of all 23 case studies (ADR 0012, ADR 0016)", () => {
    expect(caseStudiesData.FALLBACK_CASE_STUDIES).toHaveLength(23);

    const slugs = caseStudiesData.FALLBACK_CASE_STUDIES.map((s) => s.slug);
    expect(slugs).toEqual([
      "clinical-data-mapper",
      "cadence-clinical",
      "imednet-python-sdk",
      "wedding-website",
      "schemaflow",
      "hono-kiln",
      "inbody-qr-decoder",
      "polyglot-tsp",
      "oxidizemath",
      "ualbf",
      "sortify",
      "laser-loon",
      "sonos-network-controller",
      "clintrials",
      "equipose-randomization",
      "lambda-wave",
      "duckdeploy",
      "cardiac-risk-modeling",
      "4glory",
      "crf-xl",
      "promptops",
      "designing-for-my-brother",
      "study-data-pipeline",
    ]);

    for (const study of caseStudiesData.FALLBACK_CASE_STUDIES) {
      expect(study.id).toMatch(/^canonical-\d+$/);
      expect(study.title.length).toBeGreaterThan(0);
      expect(study.editorial_content.length).toBeGreaterThan(0);
      expect(study.architectural_narrative.length).toBeGreaterThan(0);
      expect(study.created_at).toBeInstanceOf(Date);
      expect(study.updated_at).toBeInstanceOf(Date);
    }
  });

  it("preserves valid terminal command and playback JSON for interactive studies", () => {
    const interactiveSlugs = [
      "imednet-python-sdk",
      "duckdeploy",
      "cardiac-risk-modeling",
      "4glory",
      "crf-xl",
      "promptops",
      "designing-for-my-brother",
    ];

    for (const slug of interactiveSlugs) {
      const study = caseStudiesData.FALLBACK_CASE_STUDIES.find(
        (s) => s.slug === slug
      );
      expect(study).toBeDefined();
      expect(study?.commands_json).toBeDefined();
      expect(study?.playback_json).toBeDefined();

      const parsedCommands = JSON.parse(study!.commands_json!);
      const parsedPlayback = JSON.parse(study!.playback_json!);

      expect(Object.keys(parsedCommands).length).toBeGreaterThan(0);
      expect(parsedPlayback.length).toBeGreaterThan(0);
    }
  });
});
