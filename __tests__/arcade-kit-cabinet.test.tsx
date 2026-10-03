// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import { useSkipTitleScreen } from "@/components/arcade/CabinetSetupContext";
import { getSavedSetupConfig } from "@/components/arcade/PreGameSetupWizard";
import {
  buildCrtOverlayBackground,
  crtCalibrationForFilter,
  getCabinetCrtProfile,
  getDefaultCrtFilter,
  isCabinetCrtFilter,
  shouldCabinetDrawCrt,
  CABINET_CRT_FILTERS,
} from "@/lib/arcade";
import {
  buildGameFont,
  gameFont,
  GAME_FONT_FALLBACK_STACK,
} from "@/lib/game-utils";

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    volume: 0.3,
    muted: false,
  }),
}));

describe("gameFont (#1516)", () => {
  it("builds a canvas font led by the given family", () => {
    expect(buildGameFont(12, 700, "'Geist Mono'")).toBe(
      `700 12px 'Geist Mono', ${GAME_FONT_FALLBACK_STACK}`
    );
    expect(buildGameFont(9, "bold")).toBe(
      `bold 9px ${GAME_FONT_FALLBACK_STACK}`
    );
  });

  it("guards bad sizes and weights", () => {
    expect(buildGameFont(Number.NaN, 2000)).toBe(
      `900 10px ${GAME_FONT_FALLBACK_STACK}`
    );
    expect(buildGameFont(-4, 0)).toBe(`100 10px ${GAME_FONT_FALLBACK_STACK}`);
  });

  it("never emits var(), which canvas fonts cannot resolve", () => {
    expect(gameFont(10)).not.toContain("var(");
    expect(gameFont(10)).toMatch(/monospace$/);
  });

  it("resolves the loaded Geist Mono family from --font-geist-mono", async () => {
    vi.resetModules();
    document.documentElement.style.setProperty(
      "--font-geist-mono",
      "'Geist Mono', 'Geist Mono Fallback'"
    );
    const fresh = await import("@/lib/game-utils");
    expect(fresh.gameFont(11, "bold")).toBe(
      `bold 11px 'Geist Mono', 'Geist Mono Fallback', ${GAME_FONT_FALLBACK_STACK}`
    );
    document.documentElement.style.removeProperty("--font-geist-mono");
  });
});

describe("cabinet CRT profile (#1516 item 4)", () => {
  it("defaults canvas games to Soft and DOM games to Off", () => {
    expect(getDefaultCrtFilter("laser-loon")).toBe("soft");
    expect(getDefaultCrtFilter("working-with-duck")).toBe("soft");
    expect(getDefaultCrtFilter("trial-and-error")).toBe("off");
    expect(getDefaultCrtFilter("quasi-puzzler")).toBe("off");
    expect(getDefaultCrtFilter("unknown-game")).toBe("off");
  });

  it("stands down for games that draw their own CRT", () => {
    expect(getCabinetCrtProfile("retro-labyrinth").gameDrawsCrt).toBe(true);
    expect(shouldCabinetDrawCrt("retro-labyrinth", "arcade")).toBe(false);
    expect(shouldCabinetDrawCrt("laser-loon", "soft")).toBe(true);
    expect(shouldCabinetDrawCrt("laser-loon", "off")).toBe(false);
  });

  it("maps every wizard setting onto a static calibration", () => {
    expect(crtCalibrationForFilter("off")).toBeNull();
    for (const filter of CABINET_CRT_FILTERS.filter((f) => f !== "off")) {
      const cal = crtCalibrationForFilter(filter);
      expect(cal?.flickerShimmer).toBe(false);
      expect(cal?.curvature).toBe(0);
    }
    const soft = crtCalibrationForFilter("soft")!;
    const heavy = crtCalibrationForFilter("scanlines")!;
    expect(heavy.scanlineIntensity).toBeGreaterThan(soft.scanlineIntensity);
  });

  it("builds a CSS overlay only when something would show", () => {
    expect(buildCrtOverlayBackground(null)).toBe("");
    const soft = buildCrtOverlayBackground(crtCalibrationForFilter("soft"));
    expect(soft).toContain("repeating-linear-gradient(0deg");
    expect(soft).toContain("radial-gradient");
    expect(soft).not.toContain("90deg");
    const arcade = buildCrtOverlayBackground(crtCalibrationForFilter("arcade"));
    expect(arcade).toContain("repeating-linear-gradient(90deg");
  });

  it("validates stored filter values", () => {
    expect(isCabinetCrtFilter("soft")).toBe(true);
    expect(isCabinetCrtFilter("neon")).toBe(false);
    expect(isCabinetCrtFilter(3)).toBe(false);
  });

  it("gives the wizard the per-game default", () => {
    expect(getSavedSetupConfig("laser-loon").crtFilter).toBe("soft");
    expect(getSavedSetupConfig("trial-and-error").crtFilter).toBe("off");
  });
});

function TitleProbe() {
  return <div data-testid="probe">{String(useSkipTitleScreen())}</div>;
}

const renderCabinet = (gameId: string, singleTitleScreen?: boolean) =>
  render(
    <PlayCabinet
      gameId={gameId}
      title="Kit Test"
      icon={<span />}
      instructions="Test"
      controls={[]}
      importComponent={() => Promise.resolve({})}
      singleTitleScreen={singleTitleScreen}
    >
      <TitleProbe />
    </PlayCabinet>
  );

async function launch() {
  await act(async () => {
    screen.getByRole("button", { name: /Launch Cabinet/i }).click();
    await Promise.resolve();
  });
  await act(async () => {
    vi.advanceTimersByTime(1500);
  });
}

describe("PlayCabinet kit wiring (#1516)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage?.clear?.();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("draws one CRT layer over a canvas game at the Soft default", async () => {
    const { container } = renderCabinet("laser-loon");
    expect(
      container.querySelector('[data-testid="attract-crt-layer"]')
    ).not.toBeNull();
    await launch();
    const layer = container.querySelector('[data-testid="cabinet-crt-layer"]');
    expect(layer).not.toBeNull();
    expect(layer?.getAttribute("data-crt-filter")).toBe("soft");
    expect(layer?.getAttribute("aria-hidden")).toBe("true");
    expect(layer?.className).toContain("pointer-events-none");
  });

  it("draws no CRT layer for a DOM game at its Off default", async () => {
    const { container } = renderCabinet("trial-and-error");
    expect(
      container.querySelector('[data-testid="attract-crt-layer"]')
    ).toBeNull();
    await launch();
    expect(
      container.querySelector('[data-testid="cabinet-crt-layer"]')
    ).toBeNull();
  });

  it("leaves the CRT to games that draw their own", async () => {
    const { container } = renderCabinet("retro-labyrinth");
    await launch();
    expect(
      container.querySelector('[data-testid="cabinet-crt-layer"]')
    ).toBeNull();
  });

  it("tells the game to skip its own title screen by default", async () => {
    renderCabinet("laser-loon");
    await launch();
    expect(screen.getByTestId("probe").textContent).toBe("true");
  });

  it("lets a game keep its own title screen", async () => {
    renderCabinet("laser-loon", false);
    await launch();
    expect(screen.getByTestId("probe").textContent).toBe("false");
  });

  it("gives the windowed stage a viewport budget that games size against", async () => {
    const { container } = renderCabinet("laser-loon");
    await launch();
    const cabinet = container.querySelector<HTMLElement>(
      "[data-arcade-cabinet]"
    );
    expect(cabinet?.style.getPropertyValue("--arcade-stage-budget")).toMatch(
      /calc\(100dvh - \d+px - \d+px/
    );
    expect(cabinet?.style.getPropertyValue("--layout-viewport-budget")).toBe(
      "var(--arcade-stage-budget)"
    );
  });

  it("returns false from useSkipTitleScreen outside a cabinet", () => {
    render(<TitleProbe />);
    expect(screen.getByTestId("probe").textContent).toBe("false");
  });
});
