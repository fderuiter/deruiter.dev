// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { AGENTS_SECTION_BY_CHECK, withAgentsSection } from "@/lib/dx/doctor";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const agents = read("AGENTS.md");
const invariantsDir = path.join(root, "docs", "agents", "invariants");
const rationale = fs
  .readdirSync(invariantsDir)
  .filter((f) => f !== "README.md" && f.endsWith(".md"))
  .map((f) => fs.readFileSync(path.join(invariantsDir, f), "utf8"))
  .join("\n");

const SECTIONS = Array.from({ length: 22 }, (_, i) => i + 1);

describe("AGENTS.md rule index (#3495)", () => {
  it("keeps the managed next dev block at the top", () => {
    expect(agents.startsWith("<!-- BEGIN:nextjs-agent-rules -->\n")).toBe(true);
    expect(agents).toContain("<!-- END:nextjs-agent-rules -->");
  });

  it("keeps sections 1 to 22 in AGENTS.md and in docs/agents/invariants", () => {
    for (const n of SECTIONS) {
      const title = agents.match(new RegExp(`^### ${n}\\. (.+)$`, "m"))?.[1];
      expect(title, `AGENTS.md section ${n}`).toBeDefined();
      expect(rationale, `invariants section ${n}`).toContain(
        `## ${n}. ${title}`
      );
    }
  });

  it("stays short enough to load into every session", () => {
    expect(agents.split("\n").length).toBeLessThan(240);
    expect(Buffer.byteLength(agents)).toBeLessThan(20_000);
  });

  it("maps every doctor check to a real section", () => {
    for (const [id, section] of Object.entries(AGENTS_SECTION_BY_CHECK)) {
      expect(SECTIONS, id).toContain(section);
    }
  });

  it("names the section on a failing check, once", () => {
    const failing = {
      id: "layout-navbar-hierarchy",
      name: "Navbar",
      category: "architecture" as const,
      status: "fail" as const,
      message: "Secondary navbar",
    };
    expect(withAgentsSection(failing).message).toBe(
      "Secondary navbar (AGENTS.md section 2)"
    );
    expect(
      withAgentsSection({ ...failing, message: "Navbar (AGENTS.md #2)" })
        .message
    ).toBe("Navbar (AGENTS.md #2)");
    expect(withAgentsSection({ ...failing, status: "pass" })).toEqual({
      ...failing,
      status: "pass",
    });
  });
});
