// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ExportImportModal } from "@/components/crf/Modes/ExportImportModal";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

/**
 * Reproduction for #1202: every Exports tab must download what it shows and
 * honour (or visibly decline) the Domain & Form Scope selector.
 */

const study = ONCOLOGY_RECIST_PRESET;

interface Download {
  filename: string;
  type: string;
  text: string;
}

describe("[#1202] Exports tab downloads match what the tab promises", () => {
  let container: HTMLDivElement;
  let root: Root;
  let downloads: Download[];
  let blobs: Blob[];

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    downloads = [];
    blobs = [];
    globalThis.URL.createObjectURL = vi.fn((b: Blob) => {
      blobs.push(b);
      return `blob:${blobs.length - 1}`;
    });
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      const blob = blobs[Number(this.href.split(":").pop())];
      downloads.push({ filename: this.download, type: blob.type, text: "" });
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  async function render() {
    await act(async () => {
      root.render(<ExportImportModal study={study} onImportStudy={() => {}} />);
    });
  }

  async function openTab(label: RegExp) {
    const tab = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    ).find((b) => label.test(b.textContent || ""));
    expect(tab).toBeDefined();
    await act(async () => {
      tab?.click();
    });
    // computeContent awaits dynamic imports.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
  }

  async function download(): Promise<Download> {
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      /download file/i.test(b.textContent || "")
    );
    await act(async () => {
      button?.click();
    });
    const last = downloads[downloads.length - 1];
    last.text = await blobs[blobs.length - 1].text();
    return last;
  }

  function scopeSelect() {
    return container.querySelector(
      'select[aria-label="Filter export domain scope"]'
    ) as HTMLSelectElement;
  }

  it("downloads the SDTM mapping table as CSV, not the study JSON", async () => {
    await render();
    await openTab(/SDTM Mapping Specs/);
    const file = await download();

    expect(file.filename).toMatch(/sdtm-spec\.csv$/);
    expect(file.type).toBe("text/csv");
    const [header, ...rows] = file.text.trim().split("\n");
    expect(header).toBe(
      "Domain,Form,Variable (CDASH),Label,Data Type,Core,aCRF Overlay Tag"
    );
    const fieldCount = study.forms.reduce(
      (n, f) => n + f.sections.reduce((m, s) => m + s.fields.length, 0),
      0
    );
    expect(rows).toHaveLength(fieldCount);
  });

  it("exports every form as a FHIR Bundle when the scope is the whole study", async () => {
    await render();
    await openTab(/HL7 FHIR/);
    const file = await download();
    const parsed = JSON.parse(file.text);

    expect(parsed.resourceType).toBe("Bundle");
    expect(parsed.entry).toHaveLength(study.forms.length);
    expect(file.filename).toMatch(/fhir-bundle/);
  });

  it("disables the scope selector for whole-study formats and says why", async () => {
    await render();
    for (const tab of [
      /Universal CRF/,
      /USDM/,
      /ODM-XML/,
      /JSON Study Bundle/,
    ]) {
      await openTab(tab);
      expect(scopeSelect().disabled).toBe(true);
      expect(container.textContent).toMatch(/always exports the whole study/i);
    }
    await openTab(/SAS Script/);
    expect(scopeSelect().disabled).toBe(false);
  });

  it("gives the JSON Study Bundle its own filename", async () => {
    await render();
    await openTab(/Universal CRF/);
    const universal = await download();
    await openTab(/JSON Study Bundle/);
    const bundle = await download();
    await openTab(/SDTM Mapping Specs/);
    const spec = await download();

    expect(bundle.filename).not.toBe(universal.filename);
    expect(bundle.filename).not.toBe(spec.filename);
    expect(bundle.filename).toMatch(/study-bundle\.json$/);
  });
});
