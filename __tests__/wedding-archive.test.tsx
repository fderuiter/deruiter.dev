import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import sharp from "sharp";
import {
  WEDDING_ALBUM_URL,
  WEDDING_PARTY,
  WEDDING_PHOTOS,
} from "@/lib/wedding-archive";
import { getAllNavHrefs, getNavGroupForHref } from "@/lib/navigation";
import { PUBLIC_ROUTE_REGISTRY } from "@/lib/public-routes";
import { ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({ playHover: vi.fn(), playClick: vi.fn() }),
}));

const { WeddingArchiveView } =
  await import("@/components/wedding/WeddingArchiveView");

const publicDir = path.resolve(process.cwd(), "public");

describe("wedding archive data (#1898)", () => {
  it("points every photo at a checked-in file with the declared size", async () => {
    for (const photo of WEDDING_PHOTOS) {
      const file = path.join(publicDir, photo.src);
      expect(fs.existsSync(file), photo.src).toBe(true);
      const meta = await sharp(file).metadata();
      expect([meta.width, meta.height], photo.src).toEqual([
        photo.width,
        photo.height,
      ]);
    }
  });

  it("keeps photos light and stripped of camera metadata", async () => {
    for (const photo of WEDDING_PHOTOS) {
      const file = path.join(publicDir, photo.src);
      expect(fs.statSync(file).size, photo.src).toBeLessThan(400 * 1024);
      const meta = await sharp(file).metadata();
      expect(meta.exif, photo.src).toBeUndefined();
    }
  });

  it("gives every photo distinct, descriptive alt text", () => {
    const alts = WEDDING_PHOTOS.map((p) => p.alt);
    expect(new Set(alts).size).toBe(alts.length);
    for (const alt of alts) expect(alt.length).toBeGreaterThan(20);
  });

  it("is reachable from the footer, listed under About, and benchmarked", () => {
    expect(getAllNavHrefs()).toContain("/wedding");
    expect(getNavGroupForHref("/wedding")?.id).toBe("about");
    expect(PUBLIC_ROUTE_REGISTRY.map((r) => r.path)).toContain("/wedding");
    expect(ROUTE_METADATA_CONFIGS.wedding.path).toBe("/wedding");
  });
});

describe("WeddingArchiveView", () => {
  it("renders the gallery, the party and the album link", () => {
    render(<WeddingArchiveView />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Abbi & Fred" })
    ).toBeTruthy();
    expect(screen.getAllByRole("img")).toHaveLength(WEDDING_PHOTOS.length);
    for (const member of WEDDING_PARTY) {
      expect(screen.getByText(member.name)).toBeTruthy();
    }
    const album = screen.getByRole("link", {
      name: /full album on google photos/i,
    });
    expect(album.getAttribute("href")).toBe(WEDDING_ALBUM_URL);
    expect(album.getAttribute("rel")).toContain("noopener");
  });
});
