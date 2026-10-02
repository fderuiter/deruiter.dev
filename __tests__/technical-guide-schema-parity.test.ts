// @vitest-environment node
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  checkTechnicalGuideSchemaParity,
  comparePrismaModel,
  parsePrismaModels,
  reconstructPrismaModel,
} from "@/lib/dx/doctor";

const workspaceRoot = process.cwd();

describe("Technical Guide Schema & Environment Parity", () => {
  it("parses canonical models from prisma/schema.prisma correctly", () => {
    const schemaPath = path.join(workspaceRoot, "prisma/schema.prisma");
    const schemaContent = fs.readFileSync(schemaPath, "utf-8");
    const models = parsePrismaModels(schemaContent);

    expect(models.has("CaseStudy")).toBe(true);
    expect(models.has("CaseStudyReaction")).toBe(true);
    expect(models.has("BlogPostReaction")).toBe(true);

    const caseStudyReaction = models.get("CaseStudyReaction")!;
    expect(caseStudyReaction.fields.map((f) => f.name)).toEqual([
      "id",
      "caseStudySlug",
      "reactionType",
      "connectionHash",
      "createdAt",
    ]);

    const uniqueDir = caseStudyReaction.directives.find(
      (d) => d.name === "@@unique"
    );
    expect(uniqueDir).toBeDefined();
    expect(uniqueDir?.normalized).toBe(
      "@@unique([caseStudySlug, connectionHash, reactionType])"
    );
  });

  it("compares embedded model snippets against canonical model", () => {
    const canonicalPrisma = `
model SampleReaction {
  id           String @id @default(cuid())
  itemSlug     String
  reactionType String
  @@unique([itemSlug, reactionType])
}
`;
    const stalePrisma = `
model SampleReaction {
  id           String @id @default(cuid())
  itemSlug     String
  reactionType String
}
`;

    const canonicalModel =
      parsePrismaModels(canonicalPrisma).get("SampleReaction")!;
    const staleModel = parsePrismaModels(stalePrisma).get("SampleReaction")!;

    const result = comparePrismaModel(canonicalModel, staleModel);
    expect(result.isMatch).toBe(false);
    expect(result.details).toContain(
      "Model 'SampleReaction' is missing directive '@@unique([itemSlug, reactionType])' in guide snippet"
    );
  });

  it("reconstructs model definition preserving custom explanatory comments", () => {
    const canonicalPrisma = `
model SampleModel {
  id    String @id @default(cuid())
  title String
  @@index([title])
}
`;
    const embeddedPrisma = `
model SampleModel {
  id    String @id @default(cuid())
  title String // Custom explanatory comment
}
`;

    const canonicalModel =
      parsePrismaModels(canonicalPrisma).get("SampleModel")!;
    const embeddedModel = parsePrismaModels(embeddedPrisma).get("SampleModel")!;

    const reconstructed = reconstructPrismaModel(canonicalModel, embeddedModel);

    expect(reconstructed).toContain("// Custom explanatory comment");
    expect(reconstructed).toContain("@@index([title])");
  });

  it("passes checkTechnicalGuideSchemaParity on synchronized codebase", () => {
    const result = checkTechnicalGuideSchemaParity(workspaceRoot, false);
    expect(result.status).toBe("pass");
  });
});
