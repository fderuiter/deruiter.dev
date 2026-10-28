// @vitest-environment node
import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

// Helper to parse fields from a Prisma schema model block
function parsePrismaFields(fileContent: string, modelName: string): string[] {
  const modelRegex = new RegExp(
    `model\\s+${modelName}\\s*\\{[\\s\\S]*?\\}`,
    "g"
  );
  const match = modelRegex.exec(fileContent);
  if (!match) return [];
  const block = match[0];
  const lines = block
    .slice(block.indexOf("{") + 1, block.lastIndexOf("}"))
    .split("\n");
  const fields: string[] = [];
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
    const parts = line.split(/\s+/);
    if (parts.length > 0 && parts[0]) {
      fields.push(parts[0]);
    }
  }
  return fields;
}

// Helper to parse fields from a TypeScript interface block
function parseInterfaceFields(
  fileContent: string,
  interfaceName: string
): string[] {
  const interfaceRegex = new RegExp(
    `interface\\s+${interfaceName}\\s*\\{[\\s\\S]*?\\}`,
    "g"
  );
  const match = interfaceRegex.exec(fileContent);
  if (!match) return [];
  const block = match[0];
  const lines = block
    .slice(block.indexOf("{") + 1, block.lastIndexOf("}"))
    .split("\n");
  const fields: string[] = [];
  for (let line of lines) {
    line = line.trim();
    if (
      !line ||
      line.startsWith("//") ||
      line.startsWith("/*") ||
      line.startsWith("*")
    )
      continue;
    const nameMatch = line.match(/^([a-zA-Z0-9_]+)\??\s*:/);
    if (nameMatch) {
      fields.push(nameMatch[1]);
    }
  }
  return fields;
}

// Helper to recursively find markdown files
function findMdFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (
        file === "node_modules" ||
        file === "generated" ||
        file === "coverage" ||
        file === "_media" ||
        file.startsWith(".")
      )
        continue;
      results = results.concat(findMdFiles(fullPath));
    } else if (file.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

describe("Programmatic Integrity Gates", () => {
  const rootDir = process.cwd();

  describe("Requirement 1: Database-to-Guidelines Sync Validation", () => {
    it("should have exact match between prisma schema fields and CMS guidelines fields", () => {
      const schemaPath = path.join(rootDir, "prisma/schema.prisma");
      const guidelinesPath = path.join(
        rootDir,
        "docs/reference/cms-guidelines.md"
      );

      expect(fs.existsSync(schemaPath)).toBe(true);
      expect(fs.existsSync(guidelinesPath)).toBe(true);

      const schemaContent = fs.readFileSync(schemaPath, "utf8");
      const guidelinesContent = fs.readFileSync(guidelinesPath, "utf8");

      const schemaFields = parsePrismaFields(schemaContent, "CaseStudy").sort();
      const guidelineFields = parsePrismaFields(
        guidelinesContent,
        "CaseStudy"
      ).sort();

      expect(schemaFields).not.toEqual([]);
      expect(guidelineFields).not.toEqual([]);
      expect(schemaFields).toEqual(guidelineFields);
    });
  });

  describe("Requirement 2: Type-to-Database Sync Validation", () => {
    it("should have exact match between BaseCaseStudy TypeScript interface and prisma schema fields", () => {
      const schemaPath = path.join(rootDir, "prisma/schema.prisma");
      const typesPath = path.join(rootDir, "types/domain.ts");

      expect(fs.existsSync(schemaPath)).toBe(true);
      expect(fs.existsSync(typesPath)).toBe(true);

      const schemaContent = fs.readFileSync(schemaPath, "utf8");
      const typesContent = fs.readFileSync(typesPath, "utf8");

      const schemaFields = parsePrismaFields(schemaContent, "CaseStudy").sort();
      const typeFields = parseInterfaceFields(
        typesContent,
        "BaseCaseStudy"
      ).sort();

      expect(schemaFields).not.toEqual([]);
      expect(typeFields).not.toEqual([]);
      expect(schemaFields).toEqual(typeFields);
    });
  });

  describe("Requirement 3: Markdown Relative Link Verification", () => {
    it("should statically validate all relative internal document links to ensure they resolve to real targets", () => {
      const mdFiles = findMdFiles(rootDir);
      expect(mdFiles.length).toBeGreaterThan(0);

      const brokenLinks: {
        file: string;
        line: number;
        text: string;
        destination: string;
      }[] = [];

      for (const mdFile of mdFiles) {
        const content = fs.readFileSync(mdFile, "utf8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Simple regex to find relative markdown links/images: [label](path) or ![alt](path)
          const linkRegex = /!?\[([^\]]*?)\]\(([^)]+)\)/g;
          let match;

          while ((match = linkRegex.exec(line)) !== null) {
            const rawDest = match[2].trim();

            // Ignore external links
            if (
              rawDest.startsWith("http://") ||
              rawDest.startsWith("https://") ||
              rawDest.startsWith("mailto:") ||
              rawDest.startsWith("tel:")
            ) {
              continue;
            }

            // Ignore internal-only page anchors
            if (rawDest.startsWith("#")) {
              continue;
            }

            // Decode and split optional anchors/query-params
            const decodedDest = decodeURIComponent(rawDest);
            const cleanDest = decodedDest.split("#")[0].split("?")[0];

            // If empty (e.g. was just an anchor or is empty)
            if (!cleanDest) continue;

            // Resolve target path relative to the mdFile's directory
            const targetPath = path.resolve(path.dirname(mdFile), cleanDest);

            if (!fs.existsSync(targetPath)) {
              brokenLinks.push({
                file: mdFile,
                line: i + 1,
                text: match[0],
                destination: rawDest,
              });
            }
          }
        }
      }

      if (brokenLinks.length > 0) {
        console.error("\n❌ Found broken relative links in markdown files:");
        for (const broken of brokenLinks) {
          console.error(
            `  - File: ${broken.file}:${broken.line}\n    Link Text: "${broken.text}"\n    Resolved Target: "${broken.destination}"`
          );
        }
      }

      expect(brokenLinks).toEqual([]);
    });
  });

  describe("Requirement 4: Code Sanitization & HTML Allowlist Consistency", () => {
    it("should align allowed tags and attributes between RichNarrative component and CMS guidelines", () => {
      const componentPath = path.join(rootDir, "components/RichNarrative.tsx");
      const guidelinesPath = path.join(
        rootDir,
        "docs/reference/cms-guidelines.md"
      );

      expect(fs.existsSync(componentPath)).toBe(true);
      expect(fs.existsSync(guidelinesPath)).toBe(true);

      const componentContent = fs.readFileSync(componentPath, "utf8");
      const guidelinesContent = fs.readFileSync(guidelinesPath, "utf8");

      // 1. Extract allowed tags from components/RichNarrative.tsx
      const tagsMatch = componentContent.match(
        /ALLOWED_TAGS:\s*\[([\s\S]*?)\]/
      );
      expect(tagsMatch).not.toBeNull();
      const componentTags =
        tagsMatch![1]
          .match(/"([^"]+)"/g)
          ?.map((t) => t.replace(/"/g, ""))
          .sort() || [];

      // 2. Extract allowed attributes from components/RichNarrative.tsx
      const attrsMatch = componentContent.match(
        /ALLOWED_ATTR:\s*\[([\s\S]*?)\]/
      );
      expect(attrsMatch).not.toBeNull();
      const componentAttrs =
        attrsMatch![1]
          .match(/"([^"]+)"/g)
          ?.map((a) => a.replace(/"/g, ""))
          .sort() || [];

      // 3. Extract permitted tags and attributes from docs/reference/cms-guidelines.md
      const guidelineLines = guidelinesContent.split("\n");
      const guidelinePermittedTags: string[] = [];
      const guidelinePermittedAttrs: string[] = [];

      for (const line of guidelineLines) {
        if (line.includes("Permitted")) {
          // Extract tags (e.g. <h2>, <h3>, etc.)
          const tagMatches = line.match(/<([a-zA-Z0-9]+)/g);
          if (tagMatches) {
            for (const tagMatch of tagMatches) {
              const cleanTag = tagMatch.replace("<", "");
              guidelinePermittedTags.push(cleanTag);
            }
          }

          // Extract attributes if the line describes optional attributes
          if (line.includes("attributes")) {
            const backtickMatches = line.match(/`([^`]+)`/g);
            if (backtickMatches) {
              for (const match of backtickMatches) {
                const cleanWord = match.replace(/`/g, "");
                if (!cleanWord.includes("<") && !cleanWord.includes(">")) {
                  guidelinePermittedAttrs.push(cleanWord);
                }
              }
            }
          }
        }
      }

      const uniqueGuidelineTags = Array.from(
        new Set(guidelinePermittedTags)
      ).sort();
      const uniqueGuidelineAttrs = Array.from(
        new Set(guidelinePermittedAttrs)
      ).sort();

      expect(componentTags).not.toEqual([]);
      expect(uniqueGuidelineTags).not.toEqual([]);
      expect(componentTags).toEqual(uniqueGuidelineTags);

      expect(componentAttrs).not.toEqual([]);
      expect(uniqueGuidelineAttrs).not.toEqual([]);
      expect(componentAttrs).toEqual(uniqueGuidelineAttrs);

      // Verify that forbidden tags (like script, iframe) are NOT allowed
      const forbiddenTags = ["script", "iframe"];
      for (const forbidden of forbiddenTags) {
        expect(componentTags).not.toContain(forbidden);
      }
    });
  });
});
