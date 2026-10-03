// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ExportImportModal } from "@/components/crf/Modes/ExportImportModal";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

// #1784: the Exports column is a scrolling flex container. Its tab row and
// preview pane clip their own overflow, so their automatic min-height is 0 and
// they collapsed to fit the viewport, leaving the ODM tab unclickable. JSDOM
// does not lay out flexbox, so this guards the classes that prevent it; the
// real-browser check lives in the PR's Playwright verification.
describe("ExportImportModal Exports layout (#1784)", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
  });

  it("keeps the tab row and preview pane from shrinking inside the scroll column", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      root = createRoot(container);
      root.render(
        <ExportImportModal
          study={ONCOLOGY_RECIST_PRESET}
          onImportStudy={() => {}}
        />
      );
    });

    const column = container.firstElementChild as HTMLElement;
    expect(column.className).toContain("overflow-y-auto");
    expect(column.className).toContain("min-h-0");
    expect(column.className).toContain("min-w-0");

    const tablist = container.querySelector(
      '[role="tablist"][aria-label="Export Format Tabs"]'
    ) as HTMLElement;
    expect(tablist.className).toContain("shrink-0");

    const panel = container.querySelector(
      "#export-panel-universal"
    ) as HTMLElement;
    expect(panel.hidden).toBe(false);
    expect(panel.className).toContain("shrink-0");
    expect(panel.className).not.toMatch(/(^|\s)h-\d/);
  });
});
