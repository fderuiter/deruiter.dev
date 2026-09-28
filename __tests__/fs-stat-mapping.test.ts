import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  getRouteSourceFilePath,
  getRouteLastModified,
} from "@/lib/fs-stat-mapping";

describe("Runtime File System Stat Mapping Utilities", () => {
  it("maps configured static route paths to corresponding page source files on disk", () => {
    const rootPath = getRouteSourceFilePath("/");
    expect(rootPath).toBe(
      path.resolve(process.cwd(), "app/desktop/page.tsx")
    );

    const arcadePath = getRouteSourceFilePath("/arcade");
    expect(arcadePath).toBe(
      path.resolve(process.cwd(), "app/desktop/arcade/page.tsx")
    );

    const laserLoonPath = getRouteSourceFilePath("/work/laser-loon");
    expect(laserLoonPath).toBe(
      path.resolve(process.cwd(), "app/desktop/work/laser-loon/page.tsx")
    );
  });

  it("inspects source file modification times dynamically during sitemap generation", () => {
    const rootStat = fs.statSync(
      path.resolve(process.cwd(), "app/desktop/page.tsx")
    );
    const rootLastModified = getRouteLastModified("/");
    expect(rootLastModified.getTime()).toBe(rootStat.mtime.getTime());

    const arcadeStat = fs.statSync(
      path.resolve(process.cwd(), "app/desktop/arcade/page.tsx")
    );
    const arcadeLastModified = getRouteLastModified("/arcade");
    expect(arcadeLastModified.getTime()).toBe(arcadeStat.mtime.getTime());
  });

  it("falls back to server boot or generation timestamp if a page source file cannot be statted", () => {
    const fallbackDate = new Date("2026-08-21T12:00:00Z");
    const unresolvable = getRouteLastModified(
      "/unresolvable/virtual/route",
      fallbackDate
    );
    expect(unresolvable).toEqual(fallbackDate);
  });

  it("fails open gracefully without throwing exceptions for missing file paths", () => {
    const fallbackDate = new Date();
    expect(() => {
      const result = getRouteLastModified(
        "/nonexistent-path-abc-123",
        fallbackDate
      );
      expect(result).toBeDefined();
    }).not.toThrow();
  });
});
