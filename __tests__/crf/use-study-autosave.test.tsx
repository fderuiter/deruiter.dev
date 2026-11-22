// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useStudyAutosave } from "@/hooks/useStudyAutosave";
import { DEFAULT_REVOKE_DELAY_MS } from "@/lib/download";
import type { StudyProtocol } from "@/lib/crf/types";
import * as draftStorage from "@/lib/crf";

function createMockStudy(
  overrides: Partial<StudyProtocol> = {}
): StudyProtocol {
  return {
    id: "study-autosave-test",
    protocolNumber: "TEST-001",
    studyName: "Autosave Unit Study",
    phase: "Phase I",
    sponsor: "Trial Corp",
    therapeuticArea: "Cardiology",
    version: "1.0",
    lastModified: "2026-01-01T00:00:00.000Z",
    forms: [],
    visits: [],
    codelists: [],
    ...overrides,
  };
}

interface TestHarnessProps {
  study: StudyProtocol;
}

function TestHarness({ study }: TestHarnessProps) {
  const { status, savedAt, errorMessage, downloadDraft } =
    useStudyAutosave(study);

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="saved-at">{savedAt ?? "none"}</span>
      <span data-testid="error-message">{errorMessage ?? "none"}</span>
      <button data-testid="download-btn" onClick={downloadDraft}>
        Download Draft
      </button>
    </div>
  );
}

describe("useStudyAutosave Hook Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      if (root) {
        root.unmount();
      }
    });
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("initializes in 'idle' status with null timestamps and error messages", async () => {
    const study = createMockStudy();

    await act(async () => {
      root.render(<TestHarness study={study} />);
    });

    expect(container.querySelector('[data-testid="status"]')?.textContent).toBe(
      "idle"
    );
    expect(
      container.querySelector('[data-testid="saved-at"]')?.textContent
    ).toBe("none");
    expect(
      container.querySelector('[data-testid="error-message"]')?.textContent
    ).toBe("none");
  });

  it("debounces local storage draft saves by 800ms on study mutation", async () => {
    const saveSpy = vi.spyOn(draftStorage, "saveStudyDraft");
    const study1 = createMockStudy({ studyName: "Initial Study Name" });

    await act(async () => {
      root.render(<TestHarness study={study1} />);
    });

    expect(saveSpy).not.toHaveBeenCalled();

    const study2 = createMockStudy({ studyName: "Mutated Study Name" });

    await act(async () => {
      root.render(<TestHarness study={study2} />);
    });

    // Immediately changes to saving status
    expect(container.querySelector('[data-testid="status"]')?.textContent).toBe(
      "saving"
    );
    expect(saveSpy).not.toHaveBeenCalled();

    // Advance timers by 400ms (halfway)
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(container.querySelector('[data-testid="status"]')?.textContent).toBe(
      "saving"
    );
    expect(saveSpy).not.toHaveBeenCalled();

    // Advance remaining 400ms (total 800ms)
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledWith(study2);
    expect(container.querySelector('[data-testid="status"]')?.textContent).toBe(
      "saved"
    );
    expect(
      container.querySelector('[data-testid="saved-at"]')?.textContent
    ).not.toBe("none");
    expect(
      container.querySelector('[data-testid="error-message"]')?.textContent
    ).toBe("none");
  });

  it("reschedules the 800ms debounce timer during rapid consecutive edits", async () => {
    const saveSpy = vi.spyOn(draftStorage, "saveStudyDraft");
    const study1 = createMockStudy();
    const study2 = createMockStudy({ version: "1.1" });
    const study3 = createMockStudy({ version: "1.2" });

    await act(async () => {
      root.render(<TestHarness study={study1} />);
    });

    // Keystroke 1 -> study2
    await act(async () => {
      root.render(<TestHarness study={study2} />);
    });

    // Advance 500ms
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(saveSpy).not.toHaveBeenCalled();

    // Keystroke 2 -> study3 (before 800ms timer fires)
    await act(async () => {
      root.render(<TestHarness study={study3} />);
    });

    // Advance another 500ms (total 1000ms from study2, but only 500ms from study3)
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(saveSpy).not.toHaveBeenCalled();

    // Advance remaining 300ms (800ms from study3)
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledWith(study3);
    expect(container.querySelector('[data-testid="status"]')?.textContent).toBe(
      "saved"
    );
  });

  it("handles storage error fallback when saveStudyDraft returns error status", async () => {
    vi.spyOn(draftStorage, "saveStudyDraft").mockReturnValue({
      status: "error",
      message: "QuotaExceededError: LocalStorage capacity exceeded",
    });

    const study1 = createMockStudy();
    const study2 = createMockStudy({ studyName: "Error Test Study" });

    await act(async () => {
      root.render(<TestHarness study={study1} />);
    });

    await act(async () => {
      root.render(<TestHarness study={study2} />);
    });

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(container.querySelector('[data-testid="status"]')?.textContent).toBe(
      "error"
    );
    expect(
      container.querySelector('[data-testid="error-message"]')?.textContent
    ).toBe("QuotaExceededError: LocalStorage capacity exceeded");
  });

  it("handles storage unavailable fallback when saveStudyDraft returns unavailable status", async () => {
    vi.spyOn(draftStorage, "saveStudyDraft").mockReturnValue({
      status: "unavailable",
    });

    const study1 = createMockStudy();
    const study2 = createMockStudy({ studyName: "Unavailable Test Study" });

    await act(async () => {
      root.render(<TestHarness study={study1} />);
    });

    await act(async () => {
      root.render(<TestHarness study={study2} />);
    });

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(container.querySelector('[data-testid="status"]')?.textContent).toBe(
      "error"
    );
    expect(
      container.querySelector('[data-testid="error-message"]')?.textContent
    ).toBe("Local storage is unavailable in this browser.");
  });

  it("executes downloadDraft to trigger native JSON file download fallback", async () => {
    const study = createMockStudy({ id: "custom-study-123" });

    await act(async () => {
      root.render(<TestHarness study={study} />);
    });

    const mockUrl = "blob:http://localhost/mock-blob-uuid";
    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue(mockUrl);
    const revokeObjectURLSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});

    let anchor: HTMLAnchorElement | null = null;
    let attachedAtClick = false;
    const clickSpy = vi.fn(() => {
      attachedAtClick = anchor !== null && document.body.contains(anchor);
    });

    const createElementOriginal = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(
      (tagName: string) => {
        const element = createElementOriginal(tagName);
        if (tagName === "a") {
          anchor = element as HTMLAnchorElement;
          element.click = clickSpy;
        }
        return element;
      }
    );

    const downloadBtn = container.querySelector(
      '[data-testid="download-btn"]'
    ) as HTMLButtonElement;
    expect(downloadBtn).toBeDefined();

    await act(async () => {
      downloadBtn.click();
    });

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const createdBlob = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(createdBlob.type).toBe("application/json");

    expect(clickSpy).toHaveBeenCalledTimes(1);
    // Firefox only downloads from an anchor attached to the document.
    expect(attachedAtClick).toBe(true);
    expect(anchor!.href).toBe(mockUrl);
    expect(anchor!.isConnected).toBe(false);

    // Revocation is deferred so the browser can finish reading the Blob.
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(DEFAULT_REVOKE_DELAY_MS);
    });
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(mockUrl);
  });

  it("uses default filename 'crf-study.json' during downloadDraft when study ID is omitted or empty", async () => {
    const study = createMockStudy({ id: "" });

    await act(async () => {
      root.render(<TestHarness study={study} />);
    });

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    let createdLink: HTMLAnchorElement | null = null;
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") {
        createdLink = el as HTMLAnchorElement;
        el.click = vi.fn();
      }
      return el;
    });

    const downloadBtn = container.querySelector(
      '[data-testid="download-btn"]'
    ) as HTMLButtonElement;
    expect(downloadBtn).toBeDefined();

    await act(async () => {
      downloadBtn.click();
    });

    expect(createdLink).not.toBeNull();
    const downloadFileName = (createdLink as HTMLAnchorElement | null)
      ?.download;
    expect(downloadFileName).toBe("crf-study.json");
  });

  it("checkpoints the latest edit when the editor unmounts before 800ms, then never writes again", async () => {
    const saveSpy = vi.spyOn(draftStorage, "saveStudyDraft");
    const study1 = createMockStudy();
    const study2 = createMockStudy({ studyName: "Unmount Test" });

    await act(async () => {
      root.render(<TestHarness study={study1} />);
    });
    await act(async () => {
      root.render(<TestHarness study={study2} />);
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    // Route departure unmounts the editor before the debounce fires.
    await act(async () => {
      root.unmount();
    });

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledWith(study2);
    expect(draftStorage.loadStudyDraft()).toMatchObject({
      status: "recovered",
      study: { studyName: "Unmount Test" },
    });

    // The cancelled debounce timer must not write a second time.
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it("does not write on unmount when nothing changed since the last acknowledged save", async () => {
    const saveSpy = vi.spyOn(draftStorage, "saveStudyDraft");
    const study1 = createMockStudy();

    await act(async () => {
      root.render(<TestHarness study={study1} />);
    });
    await act(async () => {
      root.unmount();
    });
    expect(saveSpy).not.toHaveBeenCalled();
  });
});

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

function UnsavedHarness({ study }: TestHarnessProps) {
  const { status, hasUnsavedChanges, errorMessage, downloadDraft } =
    useStudyAutosave(study);
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="unsaved">{String(hasUnsavedChanges)}</span>
      <span data-testid="error-message">{errorMessage ?? "none"}</span>
      <button data-testid="download-btn" onClick={downloadDraft}>
        Download Draft
      </button>
    </div>
  );
}

describe("useStudyAutosave lifecycle checkpoints (#3804)", () => {
  let container: HTMLDivElement;
  let root: Root;
  const text = (id: string) =>
    container.querySelector(`[data-testid="${id}"]`)?.textContent;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setVisibility("visible");
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function renderEdited(edits: StudyProtocol[]) {
    await act(async () => {
      root.render(<UnsavedHarness study={createMockStudy()} />);
    });
    for (const study of edits) {
      await act(async () => {
        root.render(<UnsavedHarness study={study} />);
      });
    }
  }

  it("checkpoints synchronously when the tab becomes hidden, without waiting for the debounce", async () => {
    const saveSpy = vi.spyOn(draftStorage, "saveStudyDraft");
    const edited = createMockStudy({ studyName: "Hidden" });
    await renderEdited([edited]);
    expect(text("unsaved")).toBe("true");

    await act(async () => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledWith(edited);
    expect(text("status")).toBe("saved");
    expect(text("unsaved")).toBe("false");

    // The pending debounce was cancelled by the checkpoint.
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it("ignores visibilitychange back to visible", async () => {
    const saveSpy = vi.spyOn(draftStorage, "saveStudyDraft");
    await renderEdited([createMockStudy({ studyName: "Visible" })]);
    await act(async () => {
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("saves only the newest of rapid edits on pagehide and writes once for duplicate events", async () => {
    const saveSpy = vi.spyOn(draftStorage, "saveStudyDraft");
    const newest = createMockStudy({ version: "1.3" });
    await renderEdited([
      createMockStudy({ version: "1.1" }),
      createMockStudy({ version: "1.2" }),
      newest,
    ]);

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
      window.dispatchEvent(new Event("pagehide"));
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledWith(newest);
  });

  it("never reports saved when storage is full, keeps the revision for download, and retries on the next lifecycle event", async () => {
    const saveSpy = vi
      .spyOn(draftStorage, "saveStudyDraft")
      .mockReturnValueOnce({
        status: "error",
        message: "QuotaExceededError",
      });
    const edited = createMockStudy({ id: "quota-study", studyName: "Quota" });
    await renderEdited([edited]);

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(text("status")).toBe("error");
    expect(text("error-message")).toBe("QuotaExceededError");
    expect(text("unsaved")).toBe("true");

    const blobs: Blob[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return "blob:test";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await act(async () => {
      (
        container.querySelector('[data-testid="download-btn"]') as HTMLElement
      ).click();
    });
    expect(JSON.parse(await blobs[0].text())).toMatchObject({
      studyName: "Quota",
    });

    // Storage recovers: the next checkpoint writes the same revision.
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(saveSpy).toHaveBeenCalledTimes(2);
    expect(saveSpy).toHaveBeenLastCalledWith(edited);
    expect(text("status")).toBe("saved");
    expect(text("unsaved")).toBe("false");
  });

  it("reports unavailable storage as an error, never as saved", async () => {
    vi.spyOn(draftStorage, "saveStudyDraft").mockReturnValue({
      status: "unavailable",
    });
    await renderEdited([createMockStudy({ studyName: "Denied" })]);
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(text("status")).toBe("error");
    expect(text("unsaved")).toBe("true");
  });

  it("removes its lifecycle listeners on unmount", async () => {
    await renderEdited([createMockStudy({ studyName: "Gone" })]);
    act(() => root.unmount());
    const saveSpy = vi.spyOn(draftStorage, "saveStudyDraft");
    window.dispatchEvent(new Event("pagehide"));
    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(saveSpy).not.toHaveBeenCalled();
    root = createRoot(container);
  });

  it("does not duplicate saves or overwrite a newer draft under Strict Mode", async () => {
    const saveSpy = vi.spyOn(draftStorage, "saveStudyDraft");
    const initial = createMockStudy();
    const edited = createMockStudy({ studyName: "Strict" });
    await act(async () => {
      root.render(
        <React.StrictMode>
          <UnsavedHarness study={initial} />
        </React.StrictMode>
      );
    });
    // Strict Mode's simulated unmount/remount must not write the untouched study.
    expect(saveSpy).not.toHaveBeenCalled();

    await act(async () => {
      root.render(
        <React.StrictMode>
          <UnsavedHarness study={edited} />
        </React.StrictMode>
      );
    });
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledWith(edited);

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });
    act(() => root.unmount());
    expect(saveSpy).toHaveBeenCalledTimes(1);
    root = createRoot(container);
  });

  it("tracks locally-unsaved separately from baseline-dirty", async () => {
    // An edit that returns the study to its baseline content is still a new
    // committed revision that storage has not acknowledged.
    const baseline = createMockStudy();
    const sameContent = createMockStudy();
    await act(async () => {
      root.render(<UnsavedHarness study={baseline} />);
    });
    expect(text("unsaved")).toBe("false");
    await act(async () => {
      root.render(<UnsavedHarness study={sameContent} />);
    });
    expect(draftStorage.isDraftDirty(sameContent, baseline)).toBe(false);
    expect(text("unsaved")).toBe("true");
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(text("unsaved")).toBe("false");
  });
});
