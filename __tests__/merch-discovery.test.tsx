// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import MerchPage from "@/app/merch/page";
import { ROUTE_METADATA_CONFIGS, buildRouteMetadata } from "@/lib/seo-metadata";
import { PUBLIC_ROUTE_REGISTRY } from "@/lib/public-routes";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({ playHover: vi.fn(), playSuccess: vi.fn() }),
}));

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("/merch discovery", () => {
  afterEach(cleanup);

  it("renders the page shell with header clearance and one h1", () => {
    const { container } = render(<MerchPage />);
    expect(container.firstElementChild?.className).toContain("min-h-dvh");
    expect(container.firstElementChild?.className).toContain("pt-28");
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelectorAll("main")).toHaveLength(0);
    expect(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).toHaveLength(1);
  });

  it("derives canonical metadata from the route config", () => {
    const config = ROUTE_METADATA_CONFIGS.merch;
    expect(config.path).toBe("/merch");
    const metadata = buildRouteMetadata(config);
    expect(metadata.alternates?.canonical).toContain("/merch");
    expect(String(metadata.title)).toMatch(/coming soon/i);
  });

  it("is registered for offline shell, benchmarks and llms.txt", () => {
    expect(PUBLIC_ROUTE_REGISTRY.map((r) => r.path)).toContain("/merch");
    expect(read("public/llms.txt")).toContain("https://deruiter.dev/merch");
  });

  it("is reachable from the navbar, mobile drawer, footer and command palette", () => {
    const navbar = read("components/Navbar.tsx");
    expect(navbar).toMatch(/href: "\/merch"/);
    expect(navbar).toMatch(/href="\/merch"/);
    expect(read("components/Footer.tsx")).toMatch(/href="\/merch"/);
    expect(read("components/CommandPalette.tsx")).toMatch(/url: "\/merch"/);
  });

  it("has a social preview card and a sitemap entry", async () => {
    const {
      default: merchOg,
      size,
      contentType,
    } = await import("@/app/merch/opengraph-image");
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe("image/png");
    expect(typeof merchOg).toBe("function");
    expect(read("app/sitemap.ts")).toContain('"/merch"');
  });
});
