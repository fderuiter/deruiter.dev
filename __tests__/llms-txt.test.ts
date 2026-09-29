import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";
import {
  buildLlmsManifests,
  LLMS_BASE_URL,
} from "../scripts/generate-llms-txt";

const root = process.cwd();

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, isProductionEnvironment: () => true };
});

describe("llms.txt manifests (#1253)", () => {
  const { llms, full } = buildLlmsManifests();

  it("lists every route in ROUTE_METADATA_CONFIGS", () => {
    for (const [key, config] of Object.entries(ROUTE_METADATA_CONFIGS)) {
      expect(llms, key).toContain(`(${LLMS_BASE_URL}${config.path})`);
    }
  });

  it("follows the llms.txt shape: H1, blockquote summary, H2 link lists", () => {
    expect(llms.startsWith("# ")).toBe(true);
    expect(llms).toMatch(/\n> .+/);
    expect(llms).toMatch(/\n## .+\n\n- \[.+\]\(https:\/\/.+\): .+/);
    expect(full).toContain("### ");
  });

  it("is deterministic and canonical: no localhost, no timestamps", () => {
    expect(buildLlmsManifests()).toEqual({ llms, full });
    expect(llms + full).not.toMatch(/localhost|vercel\.app|www\.deruiter/);
  });

  it("committed public files match the generator output (zero drift)", () => {
    expect(fs.readFileSync(path.join(root, "public/llms.txt"), "utf8")).toBe(
      llms
    );
    expect(
      fs.readFileSync(path.join(root, "public/llms-full.txt"), "utf8")
    ).toBe(full);
  });

  it("generator never touches the database (zero Neon wake)", () => {
    const source = fs.readFileSync(
      path.join(root, "scripts/generate-llms-txt.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/prisma|@\/lib\/db|CaseStudyService|redis/i);
  });

  it("robots explicitly lets AI crawlers fetch the manifests", async () => {
    const robots = (await import("@/app/robots")).default();
    const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
    const ai = rules.find(
      (rule) =>
        Array.isArray(rule.userAgent) && rule.userAgent.includes("GPTBot")
    );
    expect(ai?.allow).toEqual(
      expect.arrayContaining(["/llms.txt", "/llms-full.txt"])
    );
  });
});
