// @vitest-environment jsdom
//
// #1565 and #1514: the last direct navigator.clipboard and localStorage call
// sites in CRF Studio, Laser Loon, Garmin and Trial & Error moved onto
// useClipboard and lib/safe-storage. These tests pin what must not change:
// the visible copy feedback, a single announcement per copy, the stored
// bytes, and the defaults when storage is missing or throws.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

const { announce, push } = vi.hoisted(() => ({
  announce: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/hooks/useAnnouncer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useAnnouncer")>()),
  useAnnouncer: () => ({ announce }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { safeGetRawItem, safeSetRawItem } from "@/lib/safe-storage";
import { logger } from "@/lib/logger";
import {
  FLASH_STORAGE_KEY,
  loadPersistedFlashStorage,
  savePersistedFlashStorage,
  type FlashVariable,
} from "@/lib/garmin-engine";
import { getOncologyPresetSync } from "@/lib/crf/presets";
import { InspectorPanel } from "@/components/crf/RightInspector/InspectorPanel";
import { StudioTerminal } from "@/components/crf/Terminal/StudioTerminal";
import { StudioHeader } from "@/components/crf/StudioHeader";
import { AssetDistributionViewer } from "@/components/laser-loon/AssetDistributionHub";

/** The standard in-memory Storage (AGENTS.md §1). */
class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

/** A Storage whose every call throws, like a blocked or full store. */
class ThrowingStorage extends MockStorage {
  override getItem(): string | null {
    throw new Error("SecurityError");
  }
  override setItem(): void {
    throw new Error("QuotaExceededError");
  }
}

const originalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard"
);
const originalExecCommand = Object.getOwnPropertyDescriptor(
  document,
  "execCommand"
);

function installStorage(value: Storage | undefined) {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value,
  });
}

function stubClipboardApi(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

/** Both the async Clipboard API and the execCommand fallback refuse. */
function blockClipboard() {
  stubClipboardApi(() => Promise.reject(new Error("NotAllowedError")));
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: () => false,
  });
}

beforeEach(() => {
  announce.mockClear();
  push.mockClear();
  installStorage(new MockStorage());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalStorage) {
    Object.defineProperty(window, "localStorage", originalStorage);
  }
  if (originalClipboard) {
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
  if (originalExecCommand) {
    Object.defineProperty(document, "execCommand", originalExecCommand);
  } else {
    Reflect.deleteProperty(document, "execCommand");
  }
});

describe("safeSetRawItem with retainInMemory: false (#1514)", () => {
  it("writes the exact string and reads it back", () => {
    expect(
      safeSetRawItem("migration:raw", "sfx=1;music=0", {
        retainInMemory: false,
      })
    ).toBe(true);
    expect(window.localStorage.getItem("migration:raw")).toBe("sfx=1;music=0");
    expect(safeGetRawItem("migration:raw")).toBe("sfx=1;music=0");
  });

  it("drops a failed write instead of serving it from memory, silently", () => {
    const warn = vi.spyOn(logger, "warn");
    installStorage(new ThrowingStorage());
    expect(
      safeSetRawItem("migration:dropped", "1", { retainInMemory: false })
    ).toBe(false);
    expect(safeGetRawItem("migration:dropped")).toBeNull();
    installStorage(undefined);
    expect(safeGetRawItem("migration:dropped")).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("still retains a failed write by default", () => {
    installStorage(new ThrowingStorage());
    expect(safeSetRawItem("migration:kept", "1")).toBe(false);
    expect(safeGetRawItem("migration:kept")).toBe("1");
  });
});

describe("Garmin flash storage (#1514)", () => {
  const vars: FlashVariable[] = [
    { id: 1, name: "NV_TOKEN_1", sizeKb: 8, allocatedAt: 1_700_000_000_000 },
  ];

  it("keeps the bare JSON array format", () => {
    savePersistedFlashStorage(vars);
    expect(window.localStorage.getItem(FLASH_STORAGE_KEY)).toBe(
      JSON.stringify(vars)
    );
    expect(loadPersistedFlashStorage()).toEqual(vars);
  });

  it("reads an array saved before the migration", () => {
    window.localStorage.setItem(FLASH_STORAGE_KEY, JSON.stringify(vars));
    expect(loadPersistedFlashStorage()).toEqual(vars);
  });

  it.each([
    ["throws", () => new ThrowingStorage()],
    ["is missing", () => undefined],
  ])(
    "propagates error when saving and falls back to empty flash when storage %s",
    (_label, make) => {
      installStorage(make());
      expect(() => savePersistedFlashStorage(vars)).toThrow();
      expect(loadPersistedFlashStorage()).toEqual([]);
    }
  );

  it("ignores a corrupt value", () => {
    window.localStorage.setItem(FLASH_STORAGE_KEY, "{not json");
    expect(loadPersistedFlashStorage()).toEqual([]);
  });
});

describe("CRF Studio simulation hand-off (#1514)", () => {
  const study = getOncologyPresetSync();

  function renderHeader() {
    render(
      <StudioHeader
        study={study}
        activeMode="designer"
        canUndo={false}
        canRedo={false}
        theme="dark"
        onToggleTheme={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onChangeMode={vi.fn()}
        onSelectPreset={vi.fn()}
        onOpenDiagnostics={vi.fn()}
        onOpenCdashScaffolder={vi.fn()}
        onOpenBranding={vi.fn()}
        onOpenExportDocument={vi.fn()}
        onOpenWizard={vi.fn()}
      />
    );
    return screen.getByTitle(
      "Launch Live Conformance Engine Simulation with Active Protocol Pre-Loaded"
    );
  }

  it("stores the protocol as plain JSON and opens Clinical Chaos", () => {
    fireEvent.click(renderHeader());
    expect(
      JSON.parse(window.localStorage.getItem("crf_active_protocol") ?? "null")
    ).toEqual(JSON.parse(JSON.stringify(study)));
    expect(push).toHaveBeenCalledWith("/arcade/clinical-chaos");
  });

  it.each([
    ["throws", () => new ThrowingStorage()],
    ["is missing", () => undefined],
  ])("still opens Clinical Chaos when storage %s", (_label, make) => {
    installStorage(make());
    expect(() => fireEvent.click(renderHeader())).not.toThrow();
    expect(push).toHaveBeenCalledWith("/arcade/clinical-chaos");
  });
});

describe("clipboard call sites on useClipboard (#1565)", () => {
  const study = getOncologyPresetSync();
  const form = study.forms[0];

  function renderInspector() {
    render(
      <InspectorPanel
        form={form}
        selectedField={null}
        codelists={[]}
        onClose={vi.fn()}
        onUpdateField={vi.fn()}
        onUpdateFormMeta={vi.fn()}
        onUpdateRules={vi.fn()}
        reviewAuthor={{ name: "Reviewer", role: "Data Manager" }}
        onReviewAuthorChange={vi.fn()}
        onAddReviewComment={vi.fn()}
        onSetReviewThreadStatus={vi.fn()}
        onCommitReviewTargetChange={vi.fn()}
      />
    );
    return screen.getByTitle("Copy exact CLI command for this element");
  }

  function renderTerminal() {
    render(
      <StudioTerminal
        isOpen
        study={study}
        onClose={vi.fn()}
        onUpdateStudy={vi.fn()}
      />
    );
    return screen.getAllByTitle("Copy Output")[0];
  }

  function renderAssets() {
    render(<AssetDistributionViewer />);
    return screen.getByRole("button", { name: "Share case study link" });
  }

  it("InspectorPanel copies the CLI command and announces it once", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboardApi(writeText);
    const button = renderInspector();
    await act(async () => {
      fireEvent.click(button);
    });
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining(form.domain)
    );
    expect(button.textContent).toContain("Copied");
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(
      "CLI command copied to clipboard",
      "polite"
    );
  });

  it("InspectorPanel shows no success and announces the failure once", async () => {
    blockClipboard();
    const button = renderInspector();
    await act(async () => {
      fireEvent.click(button);
    });
    expect(button.textContent).toContain("CLI");
    expect(button.textContent).not.toContain("Copied");
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(
      expect.stringContaining("Failed to copy CLI command"),
      "assertive"
    );
  });

  it("StudioTerminal marks the copied entry and announces it once", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboardApi(writeText);
    const button = renderTerminal();
    await act(async () => {
      fireEvent.click(button);
    });
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("CRF Studio Headless Command Engine")
    );
    expect(button.querySelector(".text-emerald-400")).not.toBeNull();
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(
      "Terminal output copied to clipboard",
      "polite"
    );
  });

  it("StudioTerminal shows no check mark and announces the failure once", async () => {
    blockClipboard();
    const button = renderTerminal();
    await act(async () => {
      fireEvent.click(button);
    });
    expect(button.querySelector(".text-emerald-400")).toBeNull();
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(
      expect.stringContaining("Failed to copy terminal output"),
      "assertive"
    );
  });

  it("AssetDistributionHub copies the page link and announces it once", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboardApi(writeText);
    const button = renderAssets();
    await act(async () => {
      fireEvent.click(button);
    });
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(button.textContent).toContain("Link Copied!");
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it("AssetDistributionHub keeps the Share label and announces the failure once", async () => {
    blockClipboard();
    const button = renderAssets();
    await act(async () => {
      fireEvent.click(button);
    });
    expect(button.textContent).toContain("Share Assets");
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(
      expect.stringContaining("Failed to copy asset page link"),
      "assertive"
    );
  });
});
