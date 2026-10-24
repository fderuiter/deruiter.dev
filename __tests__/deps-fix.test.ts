// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  lockedPlaywrightVersion,
  pinnedPlaywrightVersions,
  rewritePlaywrightImages,
} from "../scripts/deps-fix";

const OLD = `sha256:${"a".repeat(64)}`;
const NEW = `sha256:${"b".repeat(64)}`;
const workflow = [
  "jobs:",
  "  unit:",
  "    container:",
  `      image: mcr.microsoft.com/playwright:v1.63.0-noble@${OLD}`,
  "  e2e:",
  "    container:",
  `      image: mcr.microsoft.com/playwright:v1.63.0-noble@${OLD}`,
  "  db:",
  "    services:",
  "      postgres:",
  "        image: postgres:17",
  "",
].join("\n");

describe("deps:fix (#2730)", () => {
  it("reads the locked @playwright/test version", () => {
    const lock = JSON.stringify({
      packages: { "node_modules/@playwright/test": { version: "1.64.1" } },
    });
    expect(lockedPlaywrightVersion(lock)).toBe("1.64.1");
  });

  it("fails when the lockfile has no @playwright/test", () => {
    expect(() => lockedPlaywrightVersion('{"packages":{}}')).toThrow(
      /no @playwright\/test/
    );
  });

  it("lists every pinned Playwright image version", () => {
    expect(pinnedPlaywrightVersions(workflow)).toEqual(["1.63.0", "1.63.0"]);
  });

  it("moves every Playwright image and leaves other images alone", () => {
    const next = rewritePlaywrightImages(workflow, "1.64.1", NEW);
    expect(pinnedPlaywrightVersions(next)).toEqual(["1.64.1", "1.64.1"]);
    expect(next).not.toContain(OLD);
    expect(next.split(NEW)).toHaveLength(3);
    expect(next).toContain("image: postgres:17");
    expect(next.split("\n")).toHaveLength(workflow.split("\n").length);
  });

  it("refuses anything that is not a sha256 digest", () => {
    expect(() => rewritePlaywrightImages(workflow, "1.64.1", "latest")).toThrow(
      /not an image digest/
    );
  });
});
