// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The For Better or Bulk loud-moment bursts are styled in app/arcade/arcade.css
 * (AGENTS.md section 20, ADR 0046 amendment). The JS gate (useFbbLoud) can be
 * removed without touching this file, so this suite reads the CSS itself and
 * checks that the bursts stay behind the loud selector, the reduced-motion
 * block, and the transform-and-opacity-only keyframes.
 */
const css = fs.readFileSync(
  path.resolve(process.cwd(), "app/arcade/arcade.css"),
  "utf-8"
);

const LOUD_GATE = '[data-fbb-cabinet][data-fbb-loud="on"]';

/** The FBB section of the stylesheet, from its header comment to the end. */
const sectionStart = css.lastIndexOf(
  "/*",
  css.indexOf("For Better or Bulk loud moments")
);
const section = css.slice(sectionStart).replace(/\/\*[\s\S]*?\*\//g, "");

/** The text between the first `{` at or after `from` and its matching `}`. */
function blockAfter(source: string, from: number): string {
  const open = source.indexOf("{", from);
  expect(open, "a block follows").toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error("unbalanced block");
}

/** The values a rule body sets for one property. */
function values(body: string, prop: string): string[] {
  const pattern = new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+)`, "g");
  return [...body.matchAll(pattern)].map((m) => m[1].trim());
}

/** Every plain rule (selector and body) in the FBB section. */
const rules = [...section.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selector: m[1].trim(),
  body: m[2],
}));

describe("For Better or Bulk burst styles", () => {
  it("gates every burst that shows or animates behind the loud selector", () => {
    const bursts = rules.filter((r) => r.selector.includes(".fbb-burst"));
    const live = bursts.filter((r) =>
      [...values(r.body, "display"), ...values(r.body, "animation")].some(
        (v) => v !== "none"
      )
    );
    expect(live.length).toBeGreaterThan(0);
    for (const rule of live) {
      expect(rule.selector, rule.selector).toContain(LOUD_GATE);
    }
  });

  it("switches the bursts off under prefers-reduced-motion", () => {
    const start = section.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(start, "a reduced-motion block exists").toBeGreaterThanOrEqual(0);
    const body = blockAfter(section, start);
    expect(body).toContain(".fbb-burst");
    expect(body).toMatch(/display\s*:\s*none/);
    expect(body).toMatch(/animation\s*:\s*none/);
  });

  it("keeps each burst animation under 0.6s", () => {
    const durations = [
      ...section.matchAll(/animation\s*:[^;]*?(\d*\.?\d+)s/g),
    ].map((m) => Number(m[1]));
    expect(durations.length).toBeGreaterThan(0);
    for (const seconds of durations) expect(seconds).toBeLessThan(0.6);
  });

  it("animates only transform and opacity in the fbb burst keyframes", () => {
    const frames = [...section.matchAll(/@keyframes (fbb-burst-[\w-]+)\s*\{/g)];
    expect(frames.length).toBeGreaterThanOrEqual(2);
    for (const frame of frames) {
      const props = [
        ...blockAfter(section, frame.index ?? 0).matchAll(/([a-z-]+)\s*:/g),
      ].map((m) => m[1]);
      expect(props.length, `${frame[1]} animates something`).toBeGreaterThan(0);
      for (const prop of props) {
        expect(
          ["transform", "opacity"],
          `${frame[1]} animates ${prop}`
        ).toContain(prop);
      }
    }
  });
});

describe("For Better or Bulk ceremony playback styles", () => {
  const scene = rules.find((r) => r.selector.includes(".fbb-scene-in"));

  it("gates the scene fade behind the loud selector", () => {
    expect(scene, "a scene fade rule exists").toBeDefined();
    expect(scene?.selector).toContain(LOUD_GATE);
    expect(values(scene?.body ?? "", "animation").length).toBeGreaterThan(0);
  });

  it("switches the scene fade off under prefers-reduced-motion", () => {
    const start = section.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(start, "a reduced-motion block exists").toBeGreaterThanOrEqual(0);
    const body = blockAfter(section, start);
    expect(body).toContain(".fbb-scene-in");
    expect(body).toMatch(/animation\s*:\s*none/);
  });

  it("animates only transform and opacity in the scene keyframes", () => {
    const frame = section.indexOf("@keyframes fbb-scene-in");
    expect(frame, "the scene keyframes exist").toBeGreaterThanOrEqual(0);
    const props = [
      ...blockAfter(section, frame).matchAll(/([a-z-]+)\s*:/g),
    ].map((m) => m[1]);
    expect(props.length).toBeGreaterThan(0);
    for (const prop of props) {
      expect(["transform", "opacity"], `scene fade animates ${prop}`).toContain(
        prop
      );
    }
  });
});

/** WCAG 2.1 relative luminance of a six-digit hex colour. */
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const value = parseInt(hex.slice(i, i + 2), 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  const [r, g, b] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two six-digit hex colours. */
function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x
  );
  return (light + 0.05) / (dark + 0.05);
}

/** The value of one custom property in the cabinet's token block. */
function cabinetToken(name: string): string {
  const from = css.indexOf("[data-fbb-cabinet] {");
  expect(from, "the cabinet token block exists").toBeGreaterThanOrEqual(0);
  const body = blockAfter(css, from);
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(body);
  expect(match, `--${name} is a hex colour`).not.toBeNull();
  return (match?.[1] ?? "#000000").toLowerCase();
}

describe("the receipt's dim text (WCAG 2.1 AA, 1.4.3)", () => {
  it("meets 4.5:1 for --fbb-dim on the receipt panel and on the stage", () => {
    const dim = cabinetToken("fbb-dim");
    expect(
      contrastRatio(dim, cabinetToken("fbb-panel"))
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(dim, cabinetToken("fbb-stage"))
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the rain steel readable on the lawn's panel at 3:1 or better", () => {
    expect(
      contrastRatio("#94a3b8", cabinetToken("fbb-panel"))
    ).toBeGreaterThanOrEqual(3);
  });
});

describe("the cabinet clears the sticky navbar and sits on opaque surfaces", () => {
  const readSource = (file: string) =>
    fs.readFileSync(path.resolve(process.cwd(), file), "utf-8");

  it("gives the cabinet element a scroll margin of at least 6rem", () => {
    const from = css.indexOf("[data-fbb-cabinet] {");
    const margin = /scroll-margin-top:\s*([\d.]+)rem/.exec(
      blockAfter(css, from)
    );
    expect(margin, "the cabinet sets a scroll margin").not.toBeNull();
    expect(Number(margin?.[1])).toBeGreaterThanOrEqual(6);
    // Scroll margin is not inherited, so it must not be sprayed onto every
    // descendant; the replay controls carry their own margin in the component.
    expect(css).not.toMatch(/\[data-fbb-cabinet\] \*/);
  });

  it("uses graphite, not a see-through zinc, for the scrolled navbar", () => {
    const navbar = readSource("components/Navbar.tsx");
    expect(navbar).toContain("bg-[#0d0e11]/95");
    expect(navbar).not.toContain("bg-zinc-950/85");
  });

  it("gives the Preferences dropdown an opaque graphite background", () => {
    const menu = readSource("components/nav/PreferencesMenu.tsx");
    expect(menu).toContain("bg-[#0d0e11] p-4");
    expect(menu).not.toContain("bg-zinc-950/95");
  });

  it("isolates the cabinet, so its pause overlay stacks inside it, below the navbar (#1931)", () => {
    const source = readSource(
      "components/for-better-or-bulk/ForBetterOrBulkGame.tsx"
    );
    const root =
      /className="([^"]*min-h-\[460px\][^"]*)"/.exec(source)?.[1] ?? "";
    expect(root.split(/\s+/)).toContain("isolate");
    const overlay = /className="absolute inset-0 z-(\d+)[^"]*"/.exec(source);
    expect(overlay, "the pause overlay exists").not.toBeNull();
    expect(Number(overlay?.[1])).toBeLessThanOrEqual(50);
    expect(source).not.toMatch(/z-\[\d{3,}\]/);
  });
});
