// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * NeuroRecon viewer controls on phones (#3464). The layout itself is
 * checked at 320, 375 and 393 px by __tests__/e2e/neuro-mobile-layout.spec.ts;
 * these keep the classes that make it work from regressing.
 */

const read = (rel: string) =>
  fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const COARSE = "pointer-coarse:min-h-11";

describe("Brain3DViewer controls", () => {
  const src = read("components/neuro/Brain3DViewer.tsx");

  it("wraps the surface mode bar instead of scrolling Aseg out of view", () => {
    expect(src).toMatch(
      /flex min-w-0 flex-wrap items-center gap-1 bg-zinc-950\/90/
    );
    expect(src).not.toContain("overflow-x-auto scrollbar-none");
  });

  it("anchors the hemisphere row under the header so it follows a wrapped header", () => {
    expect(src).toMatch(
      /absolute top-full left-2\.5 right-2\.5 sm:right-auto mt-2\.5 flex flex-wrap/
    );
    expect(src).not.toContain("absolute top-14");
  });

  it("gives the surface, hemisphere, Wireframe and GPU Test toggles 44 px on coarse pointers", () => {
    // Five surface modes share one class string; Both, Left, Right,
    // Wireframe and GPU Test have their own.
    expect(src.split(COARSE).length - 1).toBe(6);
  });
});

describe("MultiPlanarSliceViewer controls", () => {
  const src = read("components/neuro/MultiPlanarSliceViewer.tsx");

  it("lets the header and its control group wrap", () => {
    expect(src).toContain(
      "flex flex-wrap items-center justify-between gap-2 border-b"
    );
    expect(src).toContain("flex min-w-0 flex-wrap items-center gap-2");
  });

  it("makes the layout and plane buttons and the slice sliders 44 px on coarse pointers", () => {
    // 3-Planar, Focused and the focused view's plane buttons.
    expect(src.split(COARSE).length - 1).toBe(3);
    expect(src).toContain("pointer-coarse:h-11 pointer-coarse:bg-transparent");
  });
});

describe("NeuroRecon viewer boxes", () => {
  it("grow past 460 px instead of clipping their controls", () => {
    const src = read("components/neuro/NeuroReconClient.tsx");
    expect(src).not.toMatch(/className=\{`h-\[460px\]/);
    expect(src.split("min-h-[460px] flex flex-col").length - 1).toBe(2);
  });
});
