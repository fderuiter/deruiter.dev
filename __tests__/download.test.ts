import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  canDownloadFiles,
  downloadFile,
  DEFAULT_REVOKE_DELAY_MS,
} from "@/lib/download";

const OBJECT_URL = "blob:https://deruiter.dev/test-object-url";

describe("downloadFile", () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => OBJECT_URL);
  const revokeObjectURL = vi.fn<(url: string) => void>();
  let clicked: HTMLAnchorElement[] = [];
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    clicked = [];
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        // Record the anchor's state at click time: it must be attached to the document.
        expect(document.body.contains(this)).toBe(true);
        clicked.push(this);
      });
  });

  afterEach(() => {
    clickSpy.mockRestore();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.useRealTimers();
  });

  it("clicks an attached anchor with the object URL and filename, then detaches it", () => {
    expect(downloadFile("hello", "notes.txt")).toBe(true);

    expect(clicked).toHaveLength(1);
    expect(clicked[0].href).toBe(OBJECT_URL);
    expect(clicked[0].download).toBe("notes.txt");
    expect(clicked[0].isConnected).toBe(false);
    expect(document.querySelectorAll("a[download]")).toHaveLength(0);
  });

  it("defers object URL revocation until after the default delay", () => {
    downloadFile("hello", "notes.txt");

    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(DEFAULT_REVOKE_DELAY_MS - 1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(OBJECT_URL);
  });

  it("honours a custom revoke delay and revokes synchronously for zero", () => {
    downloadFile("a", "a.txt", { revokeDelayMs: 50 });
    vi.advanceTimersByTime(50);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);

    downloadFile("b", "b.txt", { revokeDelayMs: 0 });
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("falls back to the default delay for negative or non-finite values", () => {
    downloadFile("a", "a.txt", { revokeDelayMs: -5 });
    downloadFile("b", "b.txt", { revokeDelayMs: Number.NaN });
    vi.advanceTimersByTime(DEFAULT_REVOKE_DELAY_MS - 1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("detaches the anchor and still schedules revocation when the click throws", () => {
    clickSpy.mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => downloadFile("x", "x.txt")).toThrow("blocked");
    expect(document.querySelectorAll("a")).toHaveLength(0);
    vi.advanceTimersByTime(DEFAULT_REVOKE_DELAY_MS);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(OBJECT_URL);
  });

  it("applies default MIME types per payload kind", () => {
    downloadFile("text", "a.txt");
    downloadFile(new ArrayBuffer(4), "a.bin");
    downloadFile(new Uint8Array([1, 2]), "b.bin");

    const types = createObjectURL.mock.calls.map(([blob]) => blob.type);
    expect(types).toEqual([
      "text/plain;charset=utf-8",
      "application/octet-stream",
      "application/octet-stream",
    ]);
  });

  it("uses a Blob as-is unless a different MIME type is requested", () => {
    const blob = new Blob(["{}"], { type: "application/json" });
    downloadFile(blob, "a.json");
    downloadFile(blob, "b.json", { mimeType: "application/json" });
    downloadFile(blob, "c.json", { mimeType: "application/fhir+json" });

    const passed = createObjectURL.mock.calls.map(([b]) => b);
    expect(passed[0]).toBe(blob);
    expect(passed[1]).toBe(blob);
    expect(passed[2]).not.toBe(blob);
    expect(passed[2].type).toBe("application/fhir+json");
  });

  it("applies an explicit MIME type to string payloads", () => {
    downloadFile("a,b", "data.csv", { mimeType: "text/csv" });
    expect(createObjectURL.mock.calls[0][0].type).toBe("text/csv");
  });

  it("is a no-op returning false when object URLs are unavailable (JSDOM/SSR)", () => {
    URL.createObjectURL = originalCreate;
    // JSDOM does not implement URL.createObjectURL.
    Object.defineProperty(URL, "createObjectURL", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    expect(canDownloadFiles()).toBe(false);
    expect(downloadFile("x", "x.txt")).toBe(false);
    expect(clicked).toHaveLength(0);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("is a no-op returning false when there is no document (SSR)", () => {
    vi.stubGlobal("document", undefined);
    try {
      expect(canDownloadFiles()).toBe(false);
      expect(downloadFile("x", "x.txt")).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
