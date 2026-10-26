// @vitest-environment jsdom
//
// #2927: CRF Studio's header hands the open study to the Study Data Pipeline
// in one click, through the same sessionStorage handoff as the Exports USDM
// tab. When the browser cannot store it, the studio opens Exports instead.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/crf",
  useSearchParams: () => new URLSearchParams(),
}));

import { getOncologyPresetSync } from "@/lib/crf/presets";
import { StudioHeader } from "@/components/crf/StudioHeader";
import {
  STUDY_DATA_HANDOFF_KEY,
  STUDY_DATA_HANDOFF_PATH,
} from "@/components/study-data/handoff-storage";

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
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

class ThrowingStorage extends MockStorage {
  override setItem(): void {
    throw new Error("blocked");
  }
}

const original = Object.getOwnPropertyDescriptor(window, "sessionStorage");

function installSessionStorage(storage: Storage) {
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: storage,
  });
}

const study = getOncologyPresetSync();
const PIPELINE_TITLE =
  "Open this study in the Study Data Pipeline, which tabulates it into SDTM, ADaM and tables";

function renderHeader(onChangeMode = vi.fn()) {
  render(
    <StudioHeader
      study={study}
      activeMode="designer"
      canUndo={false}
      canRedo={false}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      onChangeMode={onChangeMode}
      onSelectPreset={vi.fn()}
      onOpenDiagnostics={vi.fn()}
      onOpenCdashScaffolder={vi.fn()}
      onOpenBranding={vi.fn()}
      onOpenExportDocument={vi.fn()}
      onOpenWizard={vi.fn()}
    />
  );
  return onChangeMode;
}

beforeEach(() => {
  push.mockClear();
});

afterEach(() => {
  cleanup();
  if (original) Object.defineProperty(window, "sessionStorage", original);
});

describe("CRF Studio header: Run Pipeline (#2927)", () => {
  it("stores the study's USDM export and opens /study-data", async () => {
    const storage = new MockStorage();
    installSessionStorage(storage);
    renderHeader();
    fireEvent.click(screen.getByTitle(PIPELINE_TITLE));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(STUDY_DATA_HANDOFF_PATH)
    );
    const stored = JSON.parse(storage.getItem(STUDY_DATA_HANDOFF_KEY) ?? "{}");
    expect(stored.version).toBe(1);
    expect(stored.source).toBe("crf-studio");
    expect(JSON.stringify(stored.usdm)).toContain(study.protocolNumber);
  });

  it("opens Exports instead when the browser cannot store the study", async () => {
    installSessionStorage(new ThrowingStorage());
    const onChangeMode = renderHeader();
    fireEvent.click(screen.getByTitle(PIPELINE_TITLE));
    await waitFor(() => expect(onChangeMode).toHaveBeenCalledWith("export"));
    expect(push).not.toHaveBeenCalled();
  });
});
