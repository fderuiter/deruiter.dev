// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ReviewPackageModal } from "@/components/crf/ReviewPackageModal";
import { ExportImportModal } from "@/components/crf/Modes/ExportImportModal";
import {
  openReviewPackage,
  STUDY_BASELINES_STORAGE_KEY,
  type StudyBaseline,
  type StudyProtocol,
} from "@/lib/crf";
import type { RawStorage } from "@/lib/safe-storage";
import { amend, baseStudy, reviewedStudy } from "./review-package-fixtures";

/** #680: the review package flow previews scope, shows progress, and recovers from errors. */

const pdfFailure = vi.hoisted(() => ({ remaining: 0 }));

vi.mock("@/lib/crf/export-pdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/crf/export-pdf")>();
  return {
    ...actual,
    generateStudyPdf: async (
      ...args: Parameters<typeof actual.generateStudyPdf>
    ) => {
      if (pdfFailure.remaining > 0) {
        pdfFailure.remaining--;
        throw new Error("Synthetic renderer failure");
      }
      return actual.generateStudyPdf(...args);
    },
  };
});

class MockStorage implements RawStorage {
  private readonly items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

function storageWithBaseline(study: StudyProtocol): MockStorage {
  const storage = new MockStorage();
  const baseline: StudyBaseline = {
    id: "baseline_ui",
    versionTag: "v1.0",
    label: "Approved for review",
    createdAt: "2026-09-30T15:00:00.000Z",
    actor: { name: "Synthetic Author" },
    study,
  };
  storage.setItem(STUDY_BASELINES_STORAGE_KEY, JSON.stringify([baseline]));
  return storage;
}

describe("[#680] review package modal", () => {
  let container: HTMLDivElement;
  let root: Root;
  let downloads: Array<{ filename: string; blob: Blob }>;
  let blobs: Blob[];
  let onClose: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    pdfFailure.remaining = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    downloads = [];
    blobs = [];
    onClose = vi.fn<() => void>();
    globalThis.URL.createObjectURL = vi.fn((b: Blob) => {
      blobs.push(b);
      return `blob:${blobs.length - 1}`;
    });
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloads.push({
        filename: this.download,
        blob: blobs[Number(this.href.split(":").pop())],
      });
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  async function render(
    study: StudyProtocol,
    storage: RawStorage = new MockStorage()
  ) {
    await act(async () => {
      root.render(
        <div data-studio-theme="dark">
          <ReviewPackageModal
            study={study}
            onClose={onClose}
            storage={storage}
          />
        </div>
      );
    });
  }

  const dialog = () =>
    container.querySelector('[role="dialog"]') as HTMLElement;

  function button(name: RegExp): HTMLButtonElement {
    const match = Array.from(container.querySelectorAll("button")).find((b) =>
      name.test(b.textContent || "")
    );
    if (!match) throw new Error(`No button ${name}`);
    return match;
  }

  function checkbox(title: string): HTMLInputElement {
    const label = Array.from(container.querySelectorAll("label")).find((l) =>
      (l.textContent || "").startsWith(title)
    );
    if (!label) throw new Error(`No entry ${title}`);
    return container.querySelector(`#${label.htmlFor}`) as HTMLInputElement;
  }

  async function click(element: HTMLElement) {
    await act(async () => {
      element.click();
    });
  }

  it("previews contents, scope and unresolved findings before generating", async () => {
    await render(amend(reviewedStudy()), storageWithBaseline(reviewedStudy()));

    expect(dialog().getAttribute("aria-labelledby")).toBe(
      "review-package-title"
    );
    const text = dialog().textContent || "";
    expect(text).toContain("SYN-RP-001 · version 1.1");
    expect(text).toContain("study/SYN-RP-001.crf.json");
    expect(text).toContain("(always included)");
    expect(text).toContain("1 open review thread(s)");
    expect(text).toContain("1 stale test(s): High reading raises a query");
    expect(text).toContain("2 visits");
    expect(text).not.toMatch(/Schedule Consultation/i);

    // The stored baseline for this study is chosen, so the change summary is in.
    const select = container.querySelector(
      "#review-package-baseline"
    ) as HTMLSelectElement;
    expect(select.value).toBe("baseline_ui");
    expect(checkbox("Change summary").checked).toBe(true);
    expect(checkbox("Native study source").disabled).toBe(true);

    // Without a baseline the change summary is unavailable, not silently empty.
    await act(async () => {
      select.value = "";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(checkbox("Change summary").checked).toBe(false);
    expect(checkbox("Change summary").disabled).toBe(true);
    expect(dialog().textContent).toContain(
      "Not included: No comparison baseline was chosen."
    );

    // Leaving an item out is reflected in the preview.
    await click(checkbox("Annotated CRF forms"));
    expect(checkbox("Annotated CRF forms").checked).toBe(false);
    expect(dialog().textContent).toContain(
      "Not included: Left out by the author."
    );
  });

  it("shows progress and downloads one archive whose native source reopens", async () => {
    const study = reviewedStudy();
    await render(study);
    await click(checkbox("Annotated CRF forms"));
    await click(button(/Generate package/));

    expect(container.querySelector("progress")).not.toBeNull();
    await vi.waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent).toContain(
        "Package ready: SYN-RP-001-v1.0-review-package.zip"
      );
    });

    expect(downloads).toHaveLength(1);
    expect(downloads[0].filename).toBe("SYN-RP-001-v1.0-review-package.zip");
    expect(downloads[0].blob.type).toBe("application/zip");
    expect(dialog().textContent).toContain(
      "The included native source was reopened and checked."
    );

    const opened = await openReviewPackage(
      new Uint8Array(await downloads[0].blob.arrayBuffer())
    );
    expect(opened.study.reviewThreads).toEqual(study.reviewThreads);
    expect(opened.paths).not.toContain("forms/SYN-RP-001-annotated-forms.pdf");

    await click(button(/Download again/));
    expect(downloads).toHaveLength(2);
  });

  it("reports a failed step and resumes from it on retry", async () => {
    pdfFailure.remaining = 1;
    await render(baseStudy());
    await click(button(/Generate package/));

    await vi.waitFor(() => {
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
    });
    const alert = container.querySelector('[role="alert"]')!.textContent || "";
    expect(alert).toContain("Annotated CRF forms failed.");
    expect(alert).toContain("Synthetic renderer failure");
    expect(alert).toContain("Retry keeps the 1 file(s)");
    expect(downloads).toHaveLength(0);

    await click(button(/^Retry$/));
    await vi.waitFor(
      () => {
        expect(
          container.querySelector('[role="status"]')?.textContent
        ).toContain("Package ready");
      },
      { timeout: 10000 }
    );
    expect(dialog().textContent).toContain("kept from the earlier attempt");
    expect(downloads).toHaveLength(1);
  });

  it("warns when the study changes after the snapshot and can retake it", async () => {
    const study = reviewedStudy();
    await render(study);
    expect(dialog().textContent).not.toContain(
      "The study changed after this snapshot"
    );

    await render(amend(study));
    expect(dialog().textContent).toContain(
      "The study changed after this snapshot"
    );
    expect(dialog().textContent).toContain("version 1.0");

    await click(button(/Retake snapshot/));
    expect(dialog().textContent).not.toContain(
      "The study changed after this snapshot"
    );
    expect(dialog().textContent).toContain("version 1.1");
  });

  it("closes on Escape", async () => {
    await render(baseStudy());
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("is offered from the Exports workspace", async () => {
    const onOpenReviewPackage = vi.fn();
    await act(async () => {
      root.render(
        <ExportImportModal
          study={baseStudy()}
          onImportStudy={vi.fn()}
          onOpenReviewPackage={onOpenReviewPackage}
        />
      );
    });
    await click(button(/Review Package/));
    expect(onOpenReviewPackage).toHaveBeenCalledTimes(1);
  });
});
