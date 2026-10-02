// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * `playwright.config.ts` starts one web server and sets `baseURL` for every
 * project. Two specs used to override it with `test.use({ baseURL:
 * "http://localhost:3001" })`, a port nothing listens on, so every relative
 * `page.goto` inside those describe blocks failed with
 * `net::ERR_CONNECTION_REFUSED` -- 42 instances in a single CI run. It went
 * unnoticed because the pipeline had never reached those specs: the build hung
 * on every earlier run, and the first two runs that got as far as Playwright
 * were cancelled before these files executed.
 */
describe("E2E Base URL Consistency", () => {
  const e2eDir = path.resolve(process.cwd(), "__tests__/e2e");
  const specs = fs
    .readdirSync(e2eDir)
    .filter((f) => f.endsWith(".spec.ts"))
    .map((f) => ({
      name: f,
      source: fs.readFileSync(path.join(e2eDir, f), "utf-8"),
    }));

  it("finds the e2e specs", () => {
    expect(specs.length).toBeGreaterThan(5);
  });

  it.each(specs.map((s) => s.name))(
    "%s does not hardcode a localhost port",
    (name) => {
      const spec = specs.find((s) => s.name === name)!;
      expect(spec.source).not.toMatch(/https?:\/\/localhost:\d+/);
      expect(spec.source).not.toMatch(/https?:\/\/127\.0\.0\.1:\d+/);
    }
  );

  it.each(specs.map((s) => s.name))(
    "%s does not override the configured baseURL",
    (name) => {
      const spec = specs.find((s) => s.name === name)!;
      expect(spec.source).not.toMatch(/test\.use\(\s*\{[^}]*baseURL/);
    }
  );
});
