import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  EngineeringBridge,
  EngineeringBridgeJump,
} from "@/components/EngineeringBridge";
import { ENGINEERING_BRIDGES } from "@/lib/engineering-bridges";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

const root = process.cwd();
const entries = Object.values(ENGINEERING_BRIDGES);
const registeredPaths = new Set(
  Object.values(ROUTE_METADATA_CONFIGS).map((config) => config.path)
);

describe("engineering bridges (#1255)", () => {
  afterEach(cleanup);

  it("covers the CRF, Patrol and Laser Loon arcade routes", () => {
    expect(Object.keys(ENGINEERING_BRIDGES).sort()).toEqual([
      "/arcade/laser-loon",
      "/crf",
      "/patrol",
    ]);
  });

  it.each(entries.map((entry) => [entry.route, entry] as const))(
    "%s: every referenced route, case study and ADR exists",
    (_route, entry) => {
      expect(registeredPaths.has(entry.route)).toBe(true);
      for (const study of entry.caseStudies) {
        const found = FALLBACK_CASE_STUDIES.find(
          (candidate) => candidate.slug === study.slug
        );
        expect(found, `case study ${study.slug}`).toBeDefined();
      }
      for (const adr of entry.adrs) {
        expect(adr.file.startsWith(`${adr.id}-`), adr.file).toBe(true);
        expect(
          fs.existsSync(path.join(root, "adr", adr.file)),
          `adr/${adr.file}`
        ).toBe(true);
      }
    }
  );

  it.each(entries.map((entry) => [entry.route] as const))(
    "%s: renders fully in server-side HTML with links",
    (route) => {
      const entry = ENGINEERING_BRIDGES[route]!;
      const html = renderToString(<EngineeringBridge route={route} />);
      expect(html).toContain('aria-labelledby="systems-architecture"');
      expect(html).toContain('id="systems-architecture"');
      expect(html).toContain("Architecture &amp; Engine Notes");
      for (const study of entry.caseStudies) {
        expect(html).toContain(`href="/case-studies/${study.slug}"`);
      }
      for (const adr of entry.adrs) {
        expect(html).toContain(`ADR ${adr.id}`);
        expect(html).toContain(adr.file);
      }
    }
  );

  it("renders nothing for a route without an entry", () => {
    expect(renderToString(<EngineeringBridge route="/nope" />)).toBe("");
  });

  it("jump trigger scrolls the section into view and focuses it", () => {
    const scrollIntoView = vi.fn();
    render(
      <>
        <EngineeringBridgeJump />
        <EngineeringBridge route="/crf" />
      </>
    );
    const heading = document.getElementById("systems-architecture")!;
    heading.scrollIntoView = scrollIntoView;

    fireEvent.click(
      screen.getByRole("link", { name: /Architecture & Engine Notes/i })
    );
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: expect.stringMatching(/smooth|auto/),
      block: "start",
    });
    expect(document.activeElement).toBe(heading);
  });

  it("jump trigger is desktop-only so it never overlays the mobile menu or studio controls", () => {
    render(<EngineeringBridgeJump />);
    const link = screen.getByRole("link", {
      name: /Architecture & Engine Notes/i,
    });
    expect(link.className).toContain("hidden");
    expect(link.className).toContain("xl:inline-flex");
    expect(link.className).toContain("active:scale-[0.98]");
    expect(link.className).not.toMatch(/z-\[/);
  });

  it.each([
    ["app/crf/page.tsx", "/crf", false],
    ["app/patrol/page.tsx", "/patrol", false],
    ["app/arcade/laser-loon/page.tsx", "/arcade/laser-loon", true],
  ])("%s mounts the bridge section (jump: %s)", (file, route, jump) => {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    expect(source).toContain(`<EngineeringBridge route="${route}" />`);
    if (jump) expect(source).toContain("<EngineeringBridgeJump />");
    else expect(source).not.toContain("<EngineeringBridgeJump />");
  });
});
