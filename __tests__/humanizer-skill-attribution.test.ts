// @vitest-environment node
/**
 * The humanizer skill is our adaptation of blader/humanizer. MIT asks that
 * the upstream notice travel with it, so the licence and the credit must
 * stay beside the skill (#3041).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SKILL_DIR = path.join(process.cwd(), ".claude/skills/humanizer");
const UPSTREAM = "https://github.com/blader/humanizer";
const ADAPTED_FROM = "8c307f367c91bd974002f10f2be2965d642c13df";

function read(file: string): string {
  return fs.readFileSync(path.join(SKILL_DIR, file), "utf8");
}

describe("humanizer skill attribution", () => {
  it("keeps the upstream MIT notice", () => {
    const licence = read("LICENSE");
    expect(licence).toMatch(/^MIT License/);
    expect(licence).toContain("Copyright (c) 2025 Siqi Chen");
  });

  it("credits the upstream source and commit", () => {
    const upstream = read("UPSTREAM.md");
    expect(upstream).toContain(UPSTREAM);
    expect(upstream).toContain(ADAPTED_FROM);

    const skill = read("SKILL.md");
    expect(skill).toMatch(/^name: humanizer$/m);
    expect(skill).toMatch(/^license: MIT$/m);
    expect(skill).toContain(UPSTREAM);
    expect(skill).toContain(ADAPTED_FROM);
  });
});
