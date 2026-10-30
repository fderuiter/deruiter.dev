// @vitest-environment node
/**
 * Verifies that the five project engineering skills are linked into .claude/skills/
 * and resolve cleanly to valid SKILL.md definitions (#3500).
 */
import { describe, it, expect } from "vitest";
import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const LINKED_SKILLS = [
  "triage",
  "tdd",
  "diagnosing-bugs",
  "resolving-merge-conflicts",
  "to-tickets",
] as const;

describe("claude skills symlinks (#3500)", () => {
  it("tracks the five linked skills with mode 120000 in the git index", () => {
    const output = cp
      .execSync("git ls-files -s .claude/skills", { encoding: "utf8" })
      .trim();

    for (const skill of LINKED_SKILLS) {
      const regex = new RegExp(`^120000\\s+[0-9a-f]{40}\\s+0\\s+\\.claude/skills/${skill}$`, "m");
      expect(output).toMatch(regex);
    }
  });

  it("points each symlink to the corresponding .agents/skills/<name> directory", () => {
    const rootDir = process.cwd();

    for (const skill of LINKED_SKILLS) {
      const linkPath = path.join(rootDir, ".claude/skills", skill);
      expect(fs.existsSync(linkPath)).toBe(true);

      const stat = fs.lstatSync(linkPath);
      const targetRel = stat.isSymbolicLink()
        ? fs.readlinkSync(linkPath)
        : fs.readFileSync(linkPath, "utf8").trim();
      expect(targetRel).toBe(`../../.agents/skills/${skill}`);

      const targetAbs = path.resolve(path.dirname(linkPath), targetRel);
      expect(fs.existsSync(targetAbs)).toBe(true);

      const skillMdPath = path.join(targetAbs, "SKILL.md");
      expect(fs.existsSync(skillMdPath)).toBe(true);

      const skillContent = fs.readFileSync(skillMdPath, "utf8");
      expect(skillContent).toMatch(new RegExp(`^name:\\s*${skill}$`, "m"));
    }
  });

  it("documents both folders and the five linked skills in docs/agents/skill-folders.md", () => {
    const docPath = path.join(process.cwd(), "docs/agents/skill-folders.md");
    expect(fs.existsSync(docPath)).toBe(true);

    const docContent = fs.readFileSync(docPath, "utf8");
    expect(docContent).toContain(".agents/skills/");
    expect(docContent).toContain(".claude/skills/");
    expect(docContent).toContain("Claude Code");
    expect(docContent).toContain("Antigravity");

    for (const skill of LINKED_SKILLS) {
      expect(docContent).toContain(skill);
    }
  });
});
