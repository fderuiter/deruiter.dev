import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { LaserLoon } from "@/components/LaserLoon";

describe("LaserLoon Component Architecture & Functional Rules", () => {
  const componentPath = path.resolve(__dirname, "../components/LaserLoon.tsx");
  // The session logic lives in its hook since #3436.
  const content = [
    componentPath,
    path.resolve(__dirname, "../components/laser-loon/useLaserLoonSession.ts"),
  ]
    .map((file) => fs.readFileSync(file, "utf-8"))
    .join("\n");

  it("exports a function or component named LaserLoon", () => {
    expect(typeof LaserLoon).toBe("function");
  });

  it("should contain SSR fallback check for non-JS clients", () => {
    expect(content).toContain("if (!isMounted) {");
    expect(content).toContain("INITIALIZING LASER LOON");
  });

  it("should render a canvas element for physics and graphics", () => {
    expect(content).toContain("<canvas");
    expect(content).toContain("ref={canvasRef}");
  });

  it("should enforce keyboard boundary with data-keyboard-boundary='true'", () => {
    expect(content).toContain('data-keyboard-boundary="true"');
    expect(content).toContain("tabIndex={0}");
  });

  it("should implement ice block launching physics and shatter mechanics", () => {
    expect(content).toContain("ice-cannon");
    expect(content).toContain("launchIceBlock");
    expect(content).toContain("iceBlocksRef");
    expect(content).toContain("frozenTimer");
    expect(content).toContain("playIceShatterSound");
  });

  it("should intercept directional and game control keys", () => {
    expect(content).toContain("handleKeyDown");
    expect(content).toContain("e.preventDefault()");
    expect(content).toContain("ArrowUp");
    expect(content).toContain("ArrowDown");
    expect(content).toContain('" "');
  });

  it("should support mode switching between arcade survival and zero-g sandbox", () => {
    expect(content).toContain("Arcade Survival");
    expect(content).toContain("Zero-G Sandbox");
  });
});
