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
