// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  DEFAULT_STUDY_BRANDING,
  BRANDING_PRESETS,
  getStudyBranding,
} from "@/lib/crf/branding-defaults";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import { StudyProtocol, StudyBranding } from "@/lib/crf/types";

describe("CRF Studio - Branding Defaults & Resolution", () => {
  it("should have valid DEFAULT_STUDY_BRANDING with clinical colors and confidentiality", () => {
    expect(DEFAULT_STUDY_BRANDING.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(DEFAULT_STUDY_BRANDING.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(DEFAULT_STUDY_BRANDING.organizationName.length).toBeGreaterThan(0);
    expect(
      DEFAULT_STUDY_BRANDING.confidentialityNotice?.length
    ).toBeGreaterThan(10);
  });

  it("should provide multiple distinct branding presets in BRANDING_PRESETS", () => {
    expect(BRANDING_PRESETS.length).toBeGreaterThanOrEqual(4);
    const cyan = BRANDING_PRESETS.find((p) => p.id === "biotech_cyan");
    const navy = BRANDING_PRESETS.find((p) => p.id === "clinical_navy");
    const crimson = BRANDING_PRESETS.find((p) => p.id === "pharma_crimson");

    expect(cyan).toBeDefined();
    expect(navy).toBeDefined();
    expect(crimson).toBeDefined();
  });

  it("should resolve study branding using getStudyBranding fallback", () => {
    // When study has explicit branding
    const customBrand: StudyBranding = {
      organizationName: "Custom Pharma Inc",
      primaryColor: "#ff0000",
      accentColor: "#00ff00",
    };
    const studyWithBrand: Partial<StudyProtocol> = {
      sponsor: "Sponsor A",
      branding: customBrand,
    };

    const resolved = getStudyBranding(studyWithBrand);
    expect(resolved.organizationName).toBe("Custom Pharma Inc");
    expect(resolved.primaryColor).toBe("#ff0000");

    // When study does not have explicit branding, falls back to study.sponsor
    const studyWithoutBrand: Partial<StudyProtocol> = {
      sponsor: "Aura Therapeutics",
    };
    const fallbackResolved = getStudyBranding(studyWithoutBrand);
    expect(fallbackResolved.organizationName).toBe("Aura Therapeutics");
    expect(fallbackResolved.primaryColor).toBe(
      DEFAULT_STUDY_BRANDING.primaryColor
    );
  });

  it("should preserve branding losslessly across JSON serialization and deserialization", () => {
    const customStudy: StudyProtocol = {
      ...ONCOLOGY_RECIST_PRESET,
      branding: {
        organizationName: "Roundtrip Health Tech",
        primaryColor: "#06b6d4",
        accentColor: "#0284c7",
        headerText: "CUSTOM HEADER",
        footerText: "CUSTOM FOOTER",
        confidentialityNotice:
          "Strictly confidential notice for roundtrip test.",
        showPageNumbers: true,
        showTableOfContents: true,
      },
    };

    const serialized = JSON.stringify(customStudy);
    const deserialized: StudyProtocol = JSON.parse(serialized);

    expect(deserialized.branding).toBeDefined();
    expect(deserialized.branding?.organizationName).toBe(
      "Roundtrip Health Tech"
    );
    expect(deserialized.branding?.primaryColor).toBe("#06b6d4");
    expect(deserialized.branding?.headerText).toBe("CUSTOM HEADER");
    expect(deserialized.branding?.confidentialityNotice).toContain(
      "Strictly confidential"
    );
  });
});
