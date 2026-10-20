import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { getOncologyPresetSync } from "@/lib/crf";
import { writeHashParams } from "@/hooks/useStudioHashParams";
import { useStudioNavigation } from "@/components/crf/useStudioNavigation";

const storage = vi.hoisted(() => ({
  get: vi.fn<(key: string) => string | null>(() => null),
  set: vi.fn(),
}));

vi.mock("@/lib/safe-storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/safe-storage")>();
  return {
    ...actual,
    safeGetRawItem: storage.get,
    safeSetRawItem: storage.set,
  };
});

const study = getOncologyPresetSync();

function hashParams() {
  return Object.fromEntries(
    new URLSearchParams(window.location.hash.replace(/^#/, ""))
  );
}

function setup(hash = "") {
  window.history.replaceState(null, "", `/crf${hash}`);
  return renderHook(() => useStudioNavigation(study));
}

beforeEach(() => {
  storage.get.mockReturnValue(null);
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.clearAllMocks();
});

describe("useStudioNavigation", () => {
  it("opens the designer on the first form and visit by default", () => {
    const { result } = setup();
    expect(result.current.activeMode).toBe("designer");
    expect(result.current.activeFormId).toBe("form_dm_onc");
    expect(result.current.activeVisitId).toBe("v_screen");
    expect(result.current.selectedFieldId).toBeNull();
    expect(result.current.leftTab).toBe("spine");
    expect(result.current.theme).toBe("dark");
    expect(result.current.isCompareModalOpen).toBe(false);
  });

  it("restores a deep link", () => {
    const { result } = setup(
      "#mode=rules&form=form_vs_onc&field=f_height&visit=v_c1d1&tab=forms&theme=light&compare=b1"
    );
    expect(result.current.activeMode).toBe("rules");
    expect(result.current.activeFormId).toBe("form_vs_onc");
    expect(result.current.selectedFieldId).toBe("f_height");
    expect(result.current.activeVisitId).toBe("v_c1d1");
    expect(result.current.leftTab).toBe("forms");
    expect(result.current.theme).toBe("light");
    expect(result.current.compareBaselineId).toBe("b1");
    expect(result.current.isCompareModalOpen).toBe(true);
  });

  it("keeps a startup-only mode such as the grid", () => {
    const { result } = setup("#mode=grid");
    expect(result.current.activeMode).toBe("grid");
  });

  it("falls back for unknown modes, forms, visits and tabs", () => {
    const { result } = setup(
      "#mode=bogus&form=missing&visit=missing&tab=bogus&theme=sepia"
    );
    expect(result.current.activeMode).toBe("designer");
    expect(result.current.activeFormId).toBe("form_dm_onc");
    // A linked visit is taken as given on first render; only later hash
    // changes are checked against the study's visits.
    expect(result.current.activeVisitId).toBe("missing");
    expect(result.current.leftTab).toBe("spine");
    expect(result.current.theme).toBe("dark");
  });

  it("uses the cached theme when the link names none", () => {
    storage.get.mockReturnValue("light");
    const { result } = setup();
    expect(result.current.theme).toBe("light");
    expect(storage.get).toHaveBeenCalledWith("crf_studio_theme");
  });

  it("ignores a cached theme it does not know", () => {
    storage.get.mockReturnValue("sepia");
    const { result } = setup();
    expect(result.current.theme).toBe("dark");
  });

  it("writes each change back into the hash", () => {
    const { result } = setup();

    act(() => result.current.setActiveMode("matrix"));
    expect(hashParams().mode).toBe("matrix");
    act(() => result.current.setActiveMode("designer"));
    expect(hashParams().mode).toBeUndefined();

    act(() => result.current.setSelectedFieldId("f_x"));
    expect(hashParams().field).toBe("f_x");
    act(() => result.current.setActiveFormId("form_vs_onc"));
    expect(result.current.activeFormId).toBe("form_vs_onc");
    expect(hashParams()).toMatchObject({ form: "form_vs_onc" });
    expect(hashParams().field).toBeUndefined();
    act(() => result.current.setActiveFormId("form_dm_onc"));
    expect(hashParams().form).toBeUndefined();

    act(() => result.current.setActiveVisitId("v_eos"));
    expect(result.current.activeVisitId).toBe("v_eos");
    expect(hashParams().visit).toBe("v_eos");

    act(() => result.current.setLeftTab("palette"));
    expect(result.current.leftTab).toBe("palette");
    expect(hashParams().tab).toBe("palette");
    act(() => result.current.setLeftTab("spine"));
    expect(hashParams().tab).toBeUndefined();

    act(() => result.current.setCompareBaselineId("b2"));
    expect(result.current.compareBaselineId).toBe("b2");
    expect(hashParams().compare).toBe("b2");
    expect(result.current.isCompareModalOpen).toBe(true);
  });

  it("toggles the theme, remembering it and linking only the light one", () => {
    const { result } = setup();
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("light");
    expect(hashParams().theme).toBe("light");
    expect(storage.set).toHaveBeenCalledWith("crf_studio_theme", "light", {
      retainInMemory: false,
    });

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("dark");
    expect(hashParams().theme).toBeUndefined();
  });

  it("follows Back and Forward through the hash", () => {
    const { result } = setup();
    act(() =>
      writeHashParams({
        mode: "edc",
        form: "form_lb_onc",
        visit: "v_c2d1",
        field: "f_lb_alt",
        tab: "forms",
        theme: "light",
        compare: "b3",
      })
    );
    expect(result.current.activeMode).toBe("edc");
    expect(result.current.activeFormId).toBe("form_lb_onc");
    expect(result.current.activeVisitId).toBe("v_c2d1");
    expect(result.current.selectedFieldId).toBe("f_lb_alt");
    expect(result.current.leftTab).toBe("forms");
    expect(result.current.theme).toBe("light");
    expect(result.current.compareBaselineId).toBe("b3");
    expect(result.current.isCompareModalOpen).toBe(true);

    act(() =>
      writeHashParams({
        mode: null,
        form: null,
        visit: "missing",
        field: null,
        tab: null,
        theme: null,
        compare: null,
      })
    );
    expect(result.current.activeMode).toBe("designer");
    expect(result.current.activeFormId).toBe("form_dm_onc");
    expect(result.current.activeVisitId).toBe("v_c2d1");
    expect(result.current.selectedFieldId).toBeNull();
    expect(result.current.leftTab).toBe("spine");
    // Leaving the theme out of the hash keeps the current one.
    expect(result.current.theme).toBe("light");
    expect(result.current.compareBaselineId).toBeNull();
    // Clearing the link does not close an open comparison; closing does.
    expect(result.current.isCompareModalOpen).toBe(true);
    act(() => result.current.setIsCompareModalOpen(false));
    expect(result.current.isCompareModalOpen).toBe(false);
  });

  it("resets to the dark theme when the hash clears it explicitly", () => {
    const { result } = setup("#theme=light");
    expect(result.current.theme).toBe("light");
    act(() => {
      window.history.replaceState(null, "", "/crf#theme=");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current.theme).toBe("dark");
  });
});
