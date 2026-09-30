import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("GitHub Actions SHA Pinning & Dependabot Verification", () => {
  const workflowDir = path.join(process.cwd(), ".github/workflows");
  const dependabotPath = path.join(process.cwd(), ".github/dependabot.yml");

  const workflowFiles = fs
    .readdirSync(workflowDir)
    .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"));

  it("finds workflow files to inspect", () => {
    expect(workflowFiles.length).toBeGreaterThan(0);
  });

  it.each(workflowFiles)(
    "%s pins all external actions to full 40-character commit SHAs with inline comments",
    (file) => {
      const content = fs.readFileSync(path.join(workflowDir, file), "utf8");
      const unpinnedActions: string[] = [];

      for (const rawLine of content.split("\n")) {
        const line = rawLine.trim();
        if (line.startsWith("uses:")) {
          const usesValue = line.substring(5).trim();
          // Skip local actions (e.g., ./...)
          if (usesValue.startsWith("./")) continue;

          // Match format: action-name@40-char-sha # version-comment
          const shaMatch = usesValue.match(
            /^[\w\-./]+@([a-f0-9]{40})(?:\s+#\s*\S+)?$/i
          );
          if (!shaMatch) {
            unpinnedActions.push(usesValue);
          }
        }
      }

      expect(unpinnedActions).toEqual([]);
    }
  );

  it("has dependabot.yml configured for github-actions with weekly schedule", () => {
    expect(fs.existsSync(dependabotPath)).toBe(true);
    const content = fs.readFileSync(dependabotPath, "utf8");
    expect(content).toContain('package-ecosystem: "github-actions"');
    expect(content).toContain('interval: "weekly"');
  });
});
