// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  PRIMARY_NAV,
  getNavBreadcrumbParents,
  getNavBreadcrumbSchemaParents,
  getNavGroup,
  getNavGroupForHref,
  getAllNavHrefs,
} from "@/lib/navigation";
import {
  buildLlmsManifests,
  LLMS_BASE_URL,
} from "../scripts/generate-llms-txt";

vi.mock("@/lib/prisma", () => ({ default: {}, prisma: {} }));
vi.mock("@/lib/services/case-study-service", () => ({
  CaseStudyService: { getAllPublishedCaseStudies: async () => [] },
}));
vi.mock("@/lib/blog", () => ({ getAllPublishedBlogPosts: async () => [] }));

// Phase N3 (#1848): the footer, palette, sitemap, llms.txt and breadcrumbs all
// follow the groups in lib/navigation.ts.
describe("navigation groups for pages (#1848)", () => {
  it("names the group a page belongs to", () => {
    expect(getNavGroupForHref("/arcade/laser-loon")?.id).toBe("arcade");
    expect(getNavGroupForHref("/merch")?.id).toBe("arcade");
    expect(getNavGroupForHref("/protocol-drift")?.id).toBe("simulators");
    expect(getNavGroupForHref("/crf")?.id).toBe("simulators");
    expect(getNavGroupForHref("/stack")?.id).toBe("about");
    expect(getNavGroupForHref("/#about")?.id).toBe("about");
    expect(getNavGroupForHref("/case-studies/4glory")?.id).toBe("work");
    expect(getNavGroupForHref("/contact")?.id).toBe("contact");
    expect(getNavGroupForHref("/offline")).toBeUndefined();
    expect(getNavGroupForHref("")).toBeUndefined();
  });

  it("gives every navigation href a group", () => {
    for (const href of getAllNavHrefs()) {
      if (href.startsWith("http")) continue;
      expect(getNavGroupForHref(href), href).toBeDefined();
    }
  });
});

describe("breadcrumb parents (#1848)", () => {
  it("uses the menu group's label and overview, never Systems", () => {
    expect(getNavBreadcrumbParents("/crf")).toEqual([
      { label: "Simulators", href: "/simulator" },
    ]);
    expect(getNavBreadcrumbParents("/stack")).toEqual([
      { label: "About", href: "/#about" },
    ]);
    expect(getNavBreadcrumbSchemaParents("/neuro")).toEqual([
      { name: "Simulators", url: "/simulator" },
    ]);
  });

  it("leaves out the parent on a group's own overview page and on plain links", () => {
    expect(getNavBreadcrumbParents("/simulator")).toEqual([]);
    expect(getNavBreadcrumbParents("/blog")).toEqual([]);
    expect(getNavBreadcrumbParents("/")).toEqual([]);
  });
});

describe("llms.txt sections (#1848)", () => {
  const { llms } = buildLlmsManifests();

  const sectionOf = (routePath: string): string | undefined => {
    let heading: string | undefined;
    for (const line of llms.split("\n")) {
      if (line.startsWith("## ")) heading = line.slice(3);
      if (line.includes(`(${LLMS_BASE_URL}${routePath})`)) return heading;
    }
    return undefined;
  };

  it("has one section per top bar item, in top bar order", () => {
    const headings = llms
      .split("\n")
      .filter((line) => line.startsWith("## "))
      .map((line) => line.slice(3));
    expect(headings).toEqual([
      ...PRIMARY_NAV.map((group) => group.label),
      "Mobile and utility routes",
      "Optional",
    ]);
  });

  it("lists Protocol Drift with the simulators, not the arcade", () => {
    expect(sectionOf("/protocol-drift")).toBe("Simulators");
    expect(sectionOf("/crf")).toBe("Simulators");
    expect(sectionOf("/arcade/laser-loon")).toBe("Arcade");
    expect(sectionOf("/merch")).toBe("Arcade");
    expect(sectionOf("/stack")).toBe("About");
    expect(sectionOf("/schedule")).toBe("About");
    expect(sectionOf("/case-studies")).toBe("Work");
    expect(sectionOf("/work/laser-loon")).toBe("Work");
    expect(sectionOf("/m/crf")).toBe("Mobile and utility routes");
  });

  it("places each navigation page under its own group", () => {
    for (const group of PRIMARY_NAV) {
      for (const section of group.sections) {
        for (const item of section.items) {
          if (item.external || item.href.includes("#")) continue;
          expect(sectionOf(item.href), item.href).toBe(
            getNavGroup(group.id).label
          );
        }
      }
    }
  });
});

describe("sitemap priorities (#1848)", () => {
  it("rates the Simulators menu pages as flagship and keeps phone variants lower", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const entries = await sitemap();
    const priority = (routePath: string) =>
      entries.find((entry) => new URL(entry.url).pathname === routePath)
        ?.priority;

    for (const flagship of [
      "/crf",
      "/proof",
      "/neuro",
      "/patrol",
      "/simulator",
      "/protocol-drift",
    ]) {
      expect(priority(flagship), flagship).toBe(0.9);
    }
    expect(priority("/m/crf")).toBe(0.8);
    expect(priority("/merch")).toBe(0.4);
    expect(priority("/acknowledgments")).toBe(0.5);
  });
});
