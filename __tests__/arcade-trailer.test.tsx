import React from "react";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { ArcadeHubClient } from "@/components/arcade/ArcadeHubClient";

const publicFile = (src: string) => path.resolve(process.cwd(), "public" + src);

describe("arcade trailer (#1788)", () => {
  afterEach(cleanup);

  it("sits on the hub as a labelled section", () => {
    const { container } = render(<ArcadeHubClient />);
    expect(
      within(container).getByRole("region", { name: /Trailer/i })
    ).toBeTruthy();
  });

  it("waits for the visitor: controls, no autoplay, nothing preloaded", () => {
    const { container } = render(<ArcadeHubClient />);
    const video = within(container).getByTestId("arcade-trailer");
    expect(video.hasAttribute("controls")).toBe(true);
    expect(video.getAttribute("preload")).toBe("none");
    expect(video.hasAttribute("autoplay")).toBe(false);
    expect(video.getAttribute("poster")).toBe(
      "/videos/arcade-trailer-poster.jpg"
    );
  });

  it("ships the video, poster and a captions track in public/", () => {
    const { container } = render(<ArcadeHubClient />);
    const video = within(container).getByTestId("arcade-trailer");
    const sources = Array.from(container.querySelectorAll("video source"));
    expect(sources.map((s) => s.getAttribute("type"))).toEqual([
      "video/mp4",
      "video/webm",
    ]);
    const track = container.querySelector('video track[kind="captions"]');
    expect(track).not.toBeNull();
    for (const src of [
      ...sources.map((s) => s.getAttribute("src") ?? ""),
      track?.getAttribute("src") ?? "",
      video.getAttribute("poster") ?? "",
    ]) {
      expect(src).toMatch(/^\/videos\//);
      expect(existsSync(publicFile(src))).toBe(true);
    }
  });

  it("captions are valid WebVTT covering the whole trailer", () => {
    const vtt = readFileSync(publicFile("/videos/arcade-trailer.vtt"), "utf8");
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    const cues =
      vtt.match(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/g) ?? [];
    expect(cues.length).toBeGreaterThan(10);
    expect(cues[cues.length - 1]).toContain("--> 00:00:50.033");
  });
});
