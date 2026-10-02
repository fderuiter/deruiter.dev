// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  PORTFOLIO_PHOTOS,
  getPhotosByCategory,
  getPhotoById,
} from "@/lib/media-registry";

describe("PORTFOLIO_PHOTOS Media Registry", () => {
  it("contains exactly 14 registered photographs", () => {
    expect(PORTFOLIO_PHOTOS).toHaveLength(14);
  });

  it("ensures every image file physically exists in the public directory", () => {
    PORTFOLIO_PHOTOS.forEach((photo) => {
      const filePath = path.join(
        process.cwd(),
        "public",
        photo.src.replace(/^\//, "")
      );
      expect(fs.existsSync(filePath), `Missing image file: ${filePath}`).toBe(
        true
      );
    });
  });

  it("guarantees every photo has non-empty metadata, alt text, and dimensions", () => {
    PORTFOLIO_PHOTOS.forEach((photo) => {
      expect(photo.id.length).toBeGreaterThan(0);
      expect(photo.title.length).toBeGreaterThan(0);
      expect(photo.caption.length).toBeGreaterThan(0);
      expect(photo.alt.length).toBeGreaterThan(20); // Descriptive alt text requirement
      expect(photo.width).toBeGreaterThan(0);
      expect(photo.height).toBeGreaterThan(0);
      expect(photo.tags.length).toBeGreaterThan(0);
    });
  });

  it("filters correctly by category", () => {
    const duckPhotos = getPhotosByCategory("duck");
    expect(duckPhotos.length).toBeGreaterThanOrEqual(5);

    const sportsPhotos = getPhotosByCategory("sports");
    expect(sportsPhotos).toHaveLength(2);

    const bioPhotos = getPhotosByCategory("bio");
    expect(bioPhotos).toHaveLength(3);

    const personalPhotos = getPhotosByCategory("personal");
    expect(personalPhotos).toHaveLength(4);
  });

  it("retrieves a photo by ID", () => {
    const mudRun = getPhotoById("theodore-wirth-mud-run");
    expect(mudRun).toBeDefined();
    expect(mudRun?.title).toContain("Theodore Wirth Mud Run");
  });
});
