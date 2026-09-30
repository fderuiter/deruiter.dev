// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { useArcadeFx, ARCADE_FX_MAX_SHAKE_PX } from "@/hooks/useArcadeFx";
import { ArcadeHud } from "@/components/arcade/ArcadeHud";
import { CabinetSetupContext } from "@/components/arcade/CabinetSetupContext";
import type { GameSetupConfig } from "@/components/arcade/PreGameSetupWizard";

const config = (
  screenShake: GameSetupConfig["screenShake"]
): GameSetupConfig => ({
  difficulty: "normal",
  loadout: "",
  screenShake,
  crtFilter: "off",
  bezelStyle: "classic",
});

function withSetup(screenShake: GameSetupConfig["screenShake"]) {
  return function SetupWrapper({ children }: { children: React.ReactNode }) {
    return (
      <CabinetSetupContext.Provider
        value={{
          config: config(screenShake),
          runRevision: 0,
          isSetupOpen: false,
        }}
      >
        {children}
      </CabinetSetupContext.Provider>
    );
  };
}

function setMotion(reduce: boolean, width = 1280) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
  });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

/** Largest translate offset across the keyframes passed to animate(). */
function peakOffset(animate: ReturnType<typeof vi.fn>): number {
  const frames = animate.mock.calls[0][0] as Keyframe[];
  return Math.max(
    ...frames.flatMap((f) =>
      [...String(f.transform).matchAll(/-?\d+(\.\d+)?/g)].map((m) =>
        Math.abs(Number(m[0]))
      )
    )
  );
}

function attach(fx: ReturnType<typeof useArcadeFx>) {
  const stage = document.createElement("div");
  const flash = document.createElement("div");
  const animateStage = vi.fn();
  const animateFlash = vi.fn();
  stage.animate = animateStage as unknown as typeof stage.animate;
  flash.animate = animateFlash as unknown as typeof flash.animate;
  fx.stageRef.current = stage;
  fx.flashRef.current = flash;
  return { animateStage, animateFlash };
}

describe("useArcadeFx (#1598)", () => {
  beforeEach(() => setMotion(false));
  afterEach(cleanup);

  it("caps shake at 6px however hard a game asks", () => {
    const { result } = renderHook(() => useArcadeFx(), {
      wrapper: withSetup("high"),
    });
    const { animateStage } = attach(result.current);
    result.current.shake(40);
    expect(animateStage).toHaveBeenCalledTimes(1);
    expect(peakOffset(animateStage)).toBeLessThanOrEqual(
      ARCADE_FX_MAX_SHAKE_PX
    );
  });

  it("follows the Setup Wizard's screen shake setting", () => {
    const { result } = renderHook(() => useArcadeFx(), {
      wrapper: withSetup("none"),
    });
    const { animateStage, animateFlash } = attach(result.current);
    result.current.shake(10);
    result.current.flash();
    expect(animateStage).not.toHaveBeenCalled();
    expect(animateFlash).not.toHaveBeenCalled();
  });

  it("stays still under reduced motion, on phones and when the game turns it off", () => {
    setMotion(true);
    const reduced = renderHook(() => useArcadeFx(), {
      wrapper: withSetup("high"),
    });
    const a = attach(reduced.result.current);
    reduced.result.current.shake(10);
    expect(a.animateStage).not.toHaveBeenCalled();

    setMotion(false, 375);
    const phone = renderHook(() => useArcadeFx(), {
      wrapper: withSetup("high"),
    });
    const b = attach(phone.result.current);
    phone.result.current.shake(10);
    expect(b.animateStage).not.toHaveBeenCalled();

    setMotion(false);
    const off = renderHook(() => useArcadeFx({ enabled: false }), {
      wrapper: withSetup("high"),
    });
    const c = attach(off.result.current);
    off.result.current.shake(10);
    expect(c.animateStage).not.toHaveBeenCalled();
  });

  it("animates only transform and opacity", () => {
    const { result } = renderHook(() => useArcadeFx(), {
      wrapper: withSetup("high"),
    });
    const { animateStage, animateFlash } = attach(result.current);
    result.current.shake(6);
    result.current.flash("#f43f5e");
    const keys = [animateStage, animateFlash].flatMap((fn) =>
      (fn.mock.calls[0][0] as Keyframe[]).flatMap((f) => Object.keys(f))
    );
    expect(new Set(keys)).toEqual(new Set(["transform", "opacity"]));
  });

  it("reports a hit stop until it runs out", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useArcadeFx());
    expect(result.current.isHitStopped()).toBe(false);
    result.current.hitStop(100);
    expect(result.current.isHitStopped()).toBe(true);
    vi.advanceTimersByTime(150);
    expect(result.current.isHitStopped()).toBe(false);
    vi.useRealTimers();
  });
});

describe("ArcadeHud (#1598)", () => {
  afterEach(cleanup);

  it("shows the stats and spends a full meter", () => {
    const onActivate = vi.fn();
    const { getByRole, getByText } = render(
      <ArcadeHud
        stats={[
          { label: "Score", value: 1200, accent: true },
          { label: "Act", value: "2/4" },
        ]}
        meter={{
          label: "Tremolo",
          percent: 100,
          ready: true,
          onActivate,
          hotkey: "U",
        }}
      />
    );
    expect(getByRole("group", { name: "Game status" })).toBeTruthy();
    expect(getByText("1200")).toBeTruthy();
    expect(getByText("2/4")).toBeTruthy();
    expect(
      getByRole("progressbar", { name: "Tremolo Meter" }).getAttribute(
        "aria-valuenow"
      )
    ).toBe("100");
    fireEvent.click(getByRole("button", { name: /Tremolo: 100%, ready/ }));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("disables a meter that is still charging and never loops an animation", () => {
    const { getByRole, container } = render(
      <ArcadeHud
        stats={[{ label: "Score", value: 0 }]}
        meter={{
          label: "Tremolo",
          percent: 40,
          ready: false,
          onActivate: vi.fn(),
        }}
      />
    );
    expect(
      (getByRole("button", { name: "Tremolo: 40%" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      container.querySelector(".animate-pulse, .animate-bounce, .animate-ping")
    ).toBeNull();
  });
});
