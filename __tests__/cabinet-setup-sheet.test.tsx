// @vitest-environment jsdom
// #2923: the cabinet's one Setup sheet for the device settings (part of #2362).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { CabinetSetupSheet } from "@/components/arcade/CabinetSetupSheet";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import {
  DEFAULT_DEVICE_SETTINGS,
  effectiveLayout,
  getDeviceSettings,
  layoutFits,
  setDeviceSettings,
} from "@/lib/arcade";

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playKeystroke: vi.fn(),
    volume: 0.3,
    muted: false,
  }),
}));

function setWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
}

function renderSheet(props: Partial<React.ComponentProps<typeof CabinetSetupSheet>> = {}) {
  const onClose = vi.fn();
  const onOpenWizard = vi.fn();
  const view = render(
    <CabinetSetupSheet
      open
      onClose={onClose}
      asSheet={false}
      onOpenWizard={onOpenWizard}
      {...props}
    />
  );
  return { ...view, onClose, onOpenWizard };
}

beforeEach(() => {
  localStorage.clear();
  setWidth(1280);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

describe("layout fit (#2923)", () => {
  it("fits a phone everywhere, a tablet from 744px and a desktop from 1024px", () => {
    expect(layoutFits("phone", 320)).toBe(true);
    expect(layoutFits("auto", 320)).toBe(true);
    expect(layoutFits("tablet", 743)).toBe(false);
    expect(layoutFits("tablet", 744)).toBe(true);
    expect(layoutFits("desktop", 1023)).toBe(false);
    expect(layoutFits("desktop", 1024)).toBe(true);
  });

  it("falls back to Auto while a stored layout does not fit", () => {
    expect(effectiveLayout("desktop", 900)).toBe("auto");
    expect(effectiveLayout("desktop", 1280)).toBe("desktop");
    expect(effectiveLayout("phone", 1280)).toBe("phone");
  });
});

describe("CabinetSetupSheet (#2923)", () => {
  it("is a modal dialog named Setup, with focus on Close", async () => {
    renderSheet();
    const dialog = screen.getByRole("dialog", { name: "Setup" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(dialog).getByRole("button", { name: "Close setup" })
      )
    );
  });

  it("writes each setting as its control changes", () => {
    renderSheet();
    const dialog = screen.getByRole("dialog", { name: "Setup" });

    fireEvent.click(
      within(within(dialog).getByRole("group", { name: "Dominant hand" })).getByRole(
        "button",
        { name: "Left" }
      )
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Large" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Tablet" }));
    fireEvent.click(
      within(dialog).getByRole("switch", { name: "Reduced effects" })
    );
    fireEvent.change(within(dialog).getByRole("slider", { name: "Sound effects" }), {
      target: { value: "40" },
    });
    fireEvent.change(within(dialog).getByRole("slider", { name: "Music" }), {
      target: { value: "15" },
    });

    expect(getDeviceSettings()).toEqual({
      ...DEFAULT_DEVICE_SETTINGS,
      handedness: "left",
      dockSize: "lg",
      layout: "tablet",
      reducedEffects: true,
      sound: 0.4,
      music: 0.15,
    });
    expect(
      within(dialog).getByRole("button", { name: "Left" }).getAttribute(
        "aria-pressed"
      )
    ).toBe("true");
  });

  it("turns vibration off where the device can vibrate, and says so where it cannot", () => {
    const original = navigator.vibrate;
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vi.fn(),
    });
    try {
      renderSheet();
      const toggle = screen.getByRole("switch", { name: "Vibration" });
      expect(toggle.getAttribute("aria-checked")).toBe("true");
      fireEvent.click(toggle);
      expect(getDeviceSettings().haptics).toBe(false);
    } finally {
      Object.defineProperty(navigator, "vibrate", {
        configurable: true,
        value: original,
      });
    }
    cleanup();
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: undefined,
    });
    try {
      renderSheet();
      const toggle = screen.getByRole("switch", { name: "Vibration" });
      expect((toggle as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText("This device cannot vibrate.")).toBeTruthy();
    } finally {
      Object.defineProperty(navigator, "vibrate", {
        configurable: true,
        value: original,
      });
    }
  });

  it("offers only the layouts that fit the window", () => {
    setWidth(800);
    renderSheet();
    const layout = screen.getByRole("group", { name: "Layout" });
    const button = (name: string) =>
      within(layout).getByRole("button", { name }) as HTMLButtonElement;
    expect(button("Auto").disabled).toBe(false);
    expect(button("Phone").disabled).toBe(false);
    expect(button("Tablet").disabled).toBe(false);
    expect(button("Desktop").disabled).toBe(true);
  });

  it("keeps a stored layout that no longer fits, and says Auto applies", () => {
    setDeviceSettings({ layout: "desktop" });
    setWidth(600);
    renderSheet();
    const layout = screen.getByRole("group", { name: "Layout" });
    expect(
      within(layout).getByRole("button", { name: "Desktop" }).getAttribute(
        "aria-pressed"
      )
    ).toBe("true");
    expect(screen.getByTestId("setup-layout-note").textContent).toMatch(
      /Desktop needs a window 1024px wide, so Auto applies/
    );
    expect(getDeviceSettings().layout).toBe("desktop");
  });

  it("closes on Escape and opens the wizard from its button", () => {
    const { onClose, onOpenWizard } = renderSheet();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(screen.getByTitle("Pre-Game Setup Wizard"));
    expect(onOpenWizard).toHaveBeenCalled();
  });

  it("shows the game's own options under the device settings", () => {
    renderSheet({ setupItems: <p>Deck: classic</p> });
    const game = screen.getByRole("region", { name: "This game" });
    expect(within(game).getByText("Deck: classic")).toBeTruthy();
  });
});

describe("PlayCabinet Setup key (#2923)", () => {
  it("opens the Setup sheet, and the sheet leads to the wizard", async () => {
    vi.useFakeTimers();
    render(
      <PlayCabinet
        gameId="quasi-puzzler"
        title="Quasi-Perfect Puzzler"
        icon={<div />}
        instructions="Test Instructions"
        controls={[]}
        importComponent={vi.fn().mockResolvedValue({})}
        setupItems={<p>Puzzle options</p>}
      >
        <div>Active Gameplay Loaded</div>
      </PlayCabinet>
    );
    await act(async () => {
      fireEvent.click(screen.getByText(/Launch Cabinet/i));
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    const setupKey = screen.getByTitle("Setup");
    expect(setupKey.getAttribute("aria-haspopup")).toBe("dialog");
    act(() => {
      fireEvent.click(setupKey);
    });
    const dialog = screen.getByRole("dialog", { name: "Setup" });
    expect(within(dialog).getByText("Puzzle options")).toBeTruthy();
    expect(screen.queryByTestId("pregame-setup-wizard-overlay")).toBeNull();

    act(() => {
      fireEvent.click(within(dialog).getByTitle("Pre-Game Setup Wizard"));
    });
    expect(screen.queryByRole("dialog", { name: "Setup" })).toBeNull();
    expect(screen.getByTestId("pregame-setup-wizard-overlay")).toBeTruthy();
  });
});
