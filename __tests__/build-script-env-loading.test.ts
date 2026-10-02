// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * npm does not read .env files, so `npm run build` starts with none of them in
 * process.env. scripts/build.js spawns `next build` with `env: process.env`, and
 * a variable already present in the environment beats any .env file -- so an
 * offline dummy assigned before the .env files are loaded silently wins over a
 * perfectly good .env.local, and the build produces fallback content.
 *
 * That is what happened on 2026-09-18: two builds reported success having never
 * contacted a database.
 */
describe("scripts/build.js environment loading", () => {
  const source = readFileSync(join(process.cwd(), "scripts/build.js"), "utf-8");

  it("loads .env.local before deciding DATABASE_URL is missing", () => {
    const load = source.indexOf(".env.local");
    const dummy = source.indexOf("if (!process.env.DATABASE_URL)");

    expect(
      load,
      ".env.local should be loaded in the build script"
    ).toBeGreaterThan(-1);
    expect(dummy, "the offline fallback should exist").toBeGreaterThan(-1);
    expect(load).toBeLessThan(dummy);
  });

  it("falls back to the default .env when .env.local is absent", () => {
    expect(source).toMatch(/dotenv\.config\(\)/);
  });

  it("retains the offline dummy fallback for environments with no configuration", () => {
    // The fallback is deliberate: CI and contributors without a database must
    // still be able to compile. It is the ordering that was wrong, not the idea.
    expect(source).toContain("if (!process.env.DATABASE_URL)");
    expect(source).toMatch(/dummy/i);
  });

  it("states the consequence when it engages, rather than sounding routine", () => {
    const start = source.indexOf("if (!process.env.DATABASE_URL)");
    const block = source.slice(start, start + 600);
    expect(block).toContain("static fallbacks");
  });
});
