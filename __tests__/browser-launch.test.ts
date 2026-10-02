// @vitest-environment node
import path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { chromium, type Browser, type LaunchOptions } from "@playwright/test";
import { fromPartial } from "@total-typescript/shoehorn";
import { launchChromiumWithFallback } from "@/lib/dx/browser-launch";

const { mockExistsSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: mockExistsSync,
  },
  existsSync: mockExistsSync,
}));

vi.mock("fs", () => ({
  default: {
    existsSync: mockExistsSync,
  },
  existsSync: mockExistsSync,
}));

vi.mock("@playwright/test", () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

describe("launchChromiumWithFallback", () => {
  const mockBrowser = fromPartial<Browser>({ close: vi.fn() });
  const originalBrowsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;

  beforeEach(() => {
    vi.resetAllMocks();
    if (originalBrowsersPath !== undefined) {
      process.env.PLAYWRIGHT_BROWSERS_PATH = originalBrowsersPath;
    } else {
      delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    }
  });

  afterEach(() => {
    if (originalBrowsersPath !== undefined) {
      process.env.PLAYWRIGHT_BROWSERS_PATH = originalBrowsersPath;
    } else {
      delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    }
  });

  it("launches Chromium successfully on the first attempt without checking fallback", async () => {
    delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    vi.mocked(chromium.launch).mockResolvedValue(mockBrowser);

    const options: LaunchOptions = { headless: true };
    const browser = await launchChromiumWithFallback(options);

    expect(browser).toBe(mockBrowser);
    expect(chromium.launch).toHaveBeenCalledTimes(1);
    expect(chromium.launch).toHaveBeenCalledWith(options);
    expect(existsSync).not.toHaveBeenCalled();
  });

  it("launches Chromium successfully with default empty options parameter", async () => {
    delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    vi.mocked(chromium.launch).mockResolvedValue(mockBrowser);

    const browser = await launchChromiumWithFallback();

    expect(browser).toBe(mockBrowser);
    expect(chromium.launch).toHaveBeenCalledTimes(1);
    expect(chromium.launch).toHaveBeenCalledWith({});
    expect(existsSync).not.toHaveBeenCalled();
  });

  it("re-throws initial launch error when PLAYWRIGHT_BROWSERS_PATH is undefined", async () => {
    delete process.env.PLAYWRIGHT_BROWSERS_PATH;

    const initialError = new Error(
      "Chromium launch failed: executable not found"
    );
    vi.mocked(chromium.launch).mockRejectedValue(initialError);

    await expect(launchChromiumWithFallback()).rejects.toThrow(
      "Chromium launch failed: executable not found"
    );
    expect(chromium.launch).toHaveBeenCalledTimes(1);
    expect(existsSync).not.toHaveBeenCalled();
  });

  it("re-throws initial launch error when PLAYWRIGHT_BROWSERS_PATH is an empty string", async () => {
    process.env.PLAYWRIGHT_BROWSERS_PATH = "";

    const initialError = new Error(
      "Chromium launch failed: executable not found"
    );
    vi.mocked(chromium.launch).mockRejectedValue(initialError);

    await expect(launchChromiumWithFallback()).rejects.toThrow(
      "Chromium launch failed: executable not found"
    );
    expect(chromium.launch).toHaveBeenCalledTimes(1);
    expect(existsSync).not.toHaveBeenCalled();
  });

  it("re-throws initial launch error when fallback binary does not exist on disk", async () => {
    const browsersDir = path.join(process.cwd(), "tmp", "playwright-browsers");
    process.env.PLAYWRIGHT_BROWSERS_PATH = browsersDir;

    const expectedFallbackExecutable = path.join(browsersDir, "chromium");
    const initialError = new Error("Chromium revision 1234 missing");

    vi.mocked(chromium.launch).mockRejectedValue(initialError);
    mockExistsSync.mockReturnValue(false);

    const options: LaunchOptions = { headless: true };
    await expect(launchChromiumWithFallback(options)).rejects.toThrow(
      "Chromium revision 1234 missing"
    );

    expect(chromium.launch).toHaveBeenCalledTimes(1);
    expect(chromium.launch).toHaveBeenCalledWith(options);
    expect(existsSync).toHaveBeenCalledTimes(1);
    expect(existsSync).toHaveBeenCalledWith(expectedFallbackExecutable);
  });

  it("retries launch with fallback executable path when initial launch fails and fallback exists", async () => {
    const browsersDir = path.join(process.cwd(), "tmp", "playwright-browsers");
    process.env.PLAYWRIGHT_BROWSERS_PATH = browsersDir;

    const expectedFallbackExecutable = path.join(browsersDir, "chromium");
    const initialError = new Error("Chromium revision 1234 missing");

    vi.mocked(chromium.launch)
      .mockRejectedValueOnce(initialError)
      .mockResolvedValueOnce(mockBrowser);
    mockExistsSync.mockReturnValue(true);

    const options: LaunchOptions = { headless: true, timeout: 5000 };
    const browser = await launchChromiumWithFallback(options);

    expect(browser).toBe(mockBrowser);
    expect(chromium.launch).toHaveBeenCalledTimes(2);
    expect(chromium.launch).toHaveBeenNthCalledWith(1, options);
    expect(chromium.launch).toHaveBeenNthCalledWith(2, {
      ...options,
      executablePath: expectedFallbackExecutable,
    });
    expect(existsSync).toHaveBeenCalledTimes(1);
    expect(existsSync).toHaveBeenCalledWith(expectedFallbackExecutable);
  });

  it("propagates error thrown during fallback launch attempt when fallback fails", async () => {
    const browsersDir = path.join(process.cwd(), "tmp", "playwright-browsers");
    process.env.PLAYWRIGHT_BROWSERS_PATH = browsersDir;

    const expectedFallbackExecutable = path.join(browsersDir, "chromium");
    const initialError = new Error("Chromium revision missing");
    const fallbackError = new Error(
      "Fallback binary corrupted or incompatible"
    );

    vi.mocked(chromium.launch)
      .mockRejectedValueOnce(initialError)
      .mockRejectedValueOnce(fallbackError);
    mockExistsSync.mockReturnValue(true);

    await expect(launchChromiumWithFallback()).rejects.toThrow(
      "Fallback binary corrupted or incompatible"
    );

    expect(chromium.launch).toHaveBeenCalledTimes(2);
    expect(chromium.launch).toHaveBeenNthCalledWith(1, {});
    expect(chromium.launch).toHaveBeenNthCalledWith(2, {
      executablePath: expectedFallbackExecutable,
    });
    expect(existsSync).toHaveBeenCalledWith(expectedFallbackExecutable);
  });
});
