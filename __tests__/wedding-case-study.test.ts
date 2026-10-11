// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { PORTFOLIO_PHOTOS } from "@/lib/media-registry";
import { getSimulatedStats } from "@/lib/github";
import { scanText } from "@/lib/security-scan";
import { compileTerms } from "@/lib/term-compiler";
import { loadSeedPayloads } from "./helpers/seed-payloads";

const SLUG = "wedding-website";
const REPO = "https://github.com/fderuiter/wedding_website";
const PINNED = `${REPO}/blob/75c6524/`;

function getStudy() {
  const study = FALLBACK_CASE_STUDIES.find((s) => s.slug === SLUG);
  if (!study) throw new Error(`${SLUG} is missing from FALLBACK_CASE_STUDIES`);
  return study;
}

function getSeedPayload() {
  const payload = loadSeedPayloads().find((p) => p.slug === SLUG);
  if (!payload) throw new Error(`${SLUG} is missing from SEED_PAYLOADS`);
  return payload;
}

/**
 * Claims the site never supported. Guests replied through an iCloud invite,
 * so there were no households, invite codes, meal choices or emails (#1913).
 */
const INVENTED_CLAIMS = [
  /250\+/,
  /\bhousehold/i,
  /invite[- ]code/i,
  /dietary/i,
  /meal (choice|preference|selection)/i,
  /confirmation (email|receipt)/i,
  /\bZod\b/,
  /CSV export/i,
  /submitRsvpAction/,
  /Server Actions?/,
];

describe("Wedding website case study", () => {
  it("points at the real repository and the archive", () => {
    const study = getStudy();
    expect(study.github_url).toBe(REPO);
    expect(study.interactive_url).toBe("/wedding");
    expect(study.published).toBe(true);
  });

  it("follows the ADR 0016 section structure", () => {
    const headings = [
      ...getStudy().architectural_narrative.matchAll(/<h3>([^<]+)<\/h3>/g),
    ].map((m) => m[1]);
    expect(headings).toEqual([
      "The problem",
      "How it works",
      "How the pieces connect",
      "Implementation notes",
      "Tradeoffs and lessons",
      "Sources",
    ]);
  });

  it("says RSVPs went through the iCloud invite", () => {
    expect(getStudy().architectural_narrative).toContain("iCloud invite");
  });

  it("makes none of the invented RSVP, dietary or guest-count claims", () => {
    const study = getStudy();
    const text = [
      study.title,
      study.tags,
      study.editorial_content,
      study.architectural_narrative,
    ].join("\n");
    for (const claim of INVENTED_CLAIMS) {
      expect(text, String(claim)).not.toMatch(claim);
    }
  });

  it("links every external source to the pre-wedding commit", () => {
    const hrefs = [
      ...getStudy().architectural_narrative.matchAll(/href="([^"]+)"/g),
    ].map((m) => m[1]);
    const external = hrefs.filter((h) => h.startsWith("http"));
    expect(external.length).toBeGreaterThanOrEqual(5);
    for (const href of external)
      expect(href.startsWith(PINNED), href).toBe(true);
    expect(hrefs).toContain("/wedding");
  });

  it("passes the credential scanner", () => {
    const study = getStudy();
    expect(scanText(study.editorial_content)).toEqual([]);
    expect(scanText(study.architectural_narrative)).toEqual([]);
  });

  it("seeds exactly what the fallback publishes", () => {
    const study = getStudy();
    const payload = getSeedPayload();
    const row = {
      ...payload,
      editorial_content: compileTerms(payload.editorial_content),
      architectural_narrative: compileTerms(payload.architectural_narrative),
    };
    for (const field of [
      "title",
      "primary_language",
      "github_url",
      "tags",
      "editorial_content",
      "architectural_narrative",
      "published",
      "simulated_telemetry",
      "hero_image_url",
    ] as const) {
      expect(row[field as keyof typeof row], field).toBe(study[field]);
    }
  });
});

describe("Wedding website claims elsewhere on the site", () => {
  it("photo captions no longer describe an RSVP database", () => {
    for (const media of PORTFOLIO_PHOTOS.filter((m) => m.tags.includes(SLUG))) {
      for (const claim of INVENTED_CLAIMS) {
        expect(media.caption, media.id).not.toMatch(claim);
      }
      expect(media.caption).not.toMatch(/RSVP/);
    }
  });

  it("the bento card war story mentions no RSVPs", () => {
    const source = readFileSync(
      join(process.cwd(), "components/ui/CaseStudyBentoCard.tsx"),
      "utf-8"
    );
    const start = source.indexOf(`"${SLUG}":`);
    const story = source.slice(start, source.indexOf('\n  "', start + 1));
    expect(story).not.toMatch(/RSVP/);
  });

  it("the offline commit timeline uses real commit messages", () => {
    const stats = getSimulatedStats("TypeScript", SLUG);
    expect(stats.recentCommits.length).toBeGreaterThan(0);
    for (const commit of stats.recentCommits) {
      expect(commit.message).not.toMatch(/RSVP|dietary|invite-code/i);
      expect(commit.date < "2025-10-10").toBe(true);
    }
  });
});
