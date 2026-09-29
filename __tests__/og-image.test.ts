import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getOgFonts,
  OG_IMAGE_MAX_BYTES,
  PRESET_CONFIGS,
  type SocialPreset,
} from "@/lib/og-image";
import {
  buildDossierChips,
  formatDossierDate,
  formatReadingTime,
} from "@/lib/og-dossier";

const PRESETS = Object.keys(PRESET_CONFIGS) as SocialPreset[];
const LONG_DESCRIPTION =
  "A long description that exercises wrapping inside the narrower text column that appears beside a preset artifact, to make sure nothing overflows or grows the card past the byte budget. ".repeat(
    2
  );

describe("OG brand fonts (#1252)", () => {
  it("loads Lexend and Geist Mono buffers at regular and bold weights", () => {
    const fonts = getOgFonts();
    expect(fonts.map((font) => `${font.name}:${font.weight}`).sort()).toEqual([
      "Geist Mono:400",
      "Geist Mono:700",
      "Lexend:400",
      "Lexend:700",
    ]);
    for (const font of fonts) {
      expect(font.data.byteLength).toBeGreaterThan(1000);
    }
  });

  it("serves the same in-memory buffers on repeat calls", () => {
    expect(getOgFonts()).toBe(getOgFonts());
  });

  it("ships the OFL license text next to the font files", () => {
    const dir = path.join(process.cwd(), "assets", "og-fonts");
    expect(fs.existsSync(path.join(dir, "LICENSE-Lexend-OFL.txt"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "LICENSE-GeistMono-OFL.txt"))).toBe(
      true
    );
  });
});

/**
 * Satori's WASM rasterizer rejects the cross-realm typed arrays produced by
 * the jsdom test environment, so cards are rendered in a plain Node child
 * process and only the measurements come back.
 */
function renderCardMeasurements(): Record<
  string,
  { bytes: number; signature: number[]; contentType: string | null }
> {
  const script = `
    import { createSocialImageResponse, getOgImageByteLength, PRESET_CONFIGS } from "@/lib/og-image";
    import { buildDossierChips } from "@/lib/og-dossier";
    const input = JSON.parse(process.argv[1]);
    (async () => {
      const out = {};
      const cases = [...Object.keys(PRESET_CONFIGS), "NONE"];
      for (const key of cases) {
        const response = createSocialImageResponse({
          ...(key === "NONE" ? {} : { preset: key }),
          title: input.title,
          description: input.description,
          dossier: buildDossierChips({
            readingTime: "7 min read",
            publishedAt: new Date("2026-09-24T12:00:00Z"),
            language: "TypeScript",
            verified: true,
          }),
        });
        const bytes = new Uint8Array(await response.clone().arrayBuffer());
        out[key] = {
          bytes: await getOgImageByteLength(response),
          signature: Array.from(bytes.slice(0, 4)),
          contentType: response.headers.get("content-type"),
        };
      }
      process.stdout.write("RESULT" + JSON.stringify(out));
    })();
  `;
  const stdout = execFileSync(
    "npx",
    [
      "tsx",
      "-e",
      script,
      JSON.stringify({
        title: "A Reasonably Long Case Study Title For Layout Checks",
        description: LONG_DESCRIPTION,
      }),
    ],
    { cwd: process.cwd(), encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
  );
  return JSON.parse(stdout.slice(stdout.indexOf("RESULT") + "RESULT".length));
}

describe("OG preset cards (#1252)", () => {
  const measurements = renderCardMeasurements();

  it.each([...PRESETS, "NONE"])(
    "%s renders a PNG within the 250 KB budget",
    (key) => {
      const card = measurements[key]!;
      expect(card.contentType).toBe("image/png");
      expect(card.signature).toEqual([0x89, 0x50, 0x4e, 0x47]);
      expect(card.bytes).toBeGreaterThan(5_000);
      expect(card.bytes).toBeLessThanOrEqual(OG_IMAGE_MAX_BYTES);
    },
    60_000
  );

  it("ships the web-safe Laser Loon preview, far below the budget", () => {
    const file = path.join(process.cwd(), "public/og/laser-loon-preview.png");
    expect(fs.statSync(file).size).toBeLessThan(50 * 1024);
  });
});

describe("dossier chips (#1252)", () => {
  it("computes reading time from HTML at 200 words per minute, minimum one", () => {
    expect(formatReadingTime("<p>short</p>")).toBe("1 min read");
    expect(formatReadingTime(`<p>${"word ".repeat(450)}</p>`)).toBe(
      "3 min read"
    );
  });

  it("formats dates in UTC and rejects invalid ones", () => {
    expect(formatDossierDate(new Date("2026-09-24T23:59:00Z"))).toBe(
      "Sep 24, 2026"
    );
    expect(formatDossierDate(new Date("nope"))).toBeUndefined();
  });

  it("omits facts that are missing", () => {
    expect(buildDossierChips({ language: "Python" })).toEqual({
      language: "Python",
    });
  });
});

describe("OG routes pick the artifact preset (#1252)", () => {
  it.each([
    ["app/crf/opengraph-image.tsx", "CLINICAL_SYSTEMS"],
    ["app/arcade/laser-loon/opengraph-image.tsx", "VECTOR_ARTWORK"],
    ["app/work/laser-loon/opengraph-image.tsx", "VECTOR_ARTWORK"],
    ["app/arcade/garmin-watch/opengraph-image.tsx", "EMBEDDED_SIMULATOR"],
    ["app/case-studies/[slug]/opengraph-image.tsx", "SYSTEMS_ARCHITECTURE"],
    ["app/blog/[slug]/opengraph-image.tsx", "SYSTEMS_ARCHITECTURE"],
  ])("%s uses %s", (file, preset) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    expect(source).toContain(`preset: "${preset}"`);
  });
});
