// @vitest-environment jsdom
// #2922: one device-settings record for every cabinet (part of #2362).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import {
  ARCADE_DEVICE_SETTINGS_KEY,
  DEFAULT_DEVICE_SETTINGS,
  getDeviceSettings,
  setDeviceSettings,
  useDeviceSettings,
} from "@/lib/arcade";

function Probe() {
  const settings = useDeviceSettings();
  return (
    <p data-testid="probe">
      {`${settings.handedness} ${settings.dockSize} ${settings.sound}`}
    </p>
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("arcade device settings (#2922)", () => {
  it("starts from the defaults when nothing is stored", () => {
    expect(getDeviceSettings()).toEqual(DEFAULT_DEVICE_SETTINGS);
    expect(DEFAULT_DEVICE_SETTINGS).toMatchObject({
      handedness: "right",
      haptics: true,
      dockSize: "md",
      layout: "auto",
      sound: 1,
      music: 1,
      reducedEffects: false,
    });
  });

  it("renders the defaults on the server", () => {
    const html = renderToString(<Probe />);
    expect(html).toContain("right md 1");
  });

  it("keeps the other fields when a patch changes one", () => {
    expect(setDeviceSettings({ handedness: "left" })).toBe(true);
    expect(setDeviceSettings({ dockSize: "lg", sound: 0.4 })).toBe(true);
    expect(getDeviceSettings()).toEqual({
      ...DEFAULT_DEVICE_SETTINGS,
      handedness: "left",
      dockSize: "lg",
      sound: 0.4,
    });
    expect(
      JSON.parse(localStorage.getItem(ARCADE_DEVICE_SETTINGS_KEY) ?? "{}")
    ).toMatchObject({ version: 1, handedness: "left", dockSize: "lg" });
  });

  it("clamps volumes and keeps the default for an unknown option", () => {
    setDeviceSettings({
      sound: 4,
      music: -1,
      layout: "watch" as never,
      dockSize: "xl" as never,
    });
    const settings = getDeviceSettings();
    expect(settings.sound).toBe(1);
    expect(settings.music).toBe(0);
    expect(settings.layout).toBe("auto");
    expect(settings.dockSize).toBe("md");
  });

  it("falls a damaged field back alone and keeps the rest", () => {
    localStorage.setItem(
      ARCADE_DEVICE_SETTINGS_KEY,
      JSON.stringify({
        version: 1,
        handedness: "left",
        haptics: "yes",
        sound: "loud",
        music: 0.25,
        reducedEffects: true,
      })
    );
    expect(getDeviceSettings()).toEqual({
      ...DEFAULT_DEVICE_SETTINGS,
      handedness: "left",
      music: 0.25,
      reducedEffects: true,
    });
  });

  it("treats a value that is not a record as corrupt and plays on the defaults", () => {
    localStorage.setItem(ARCADE_DEVICE_SETTINGS_KEY, JSON.stringify([1, 2]));
    expect(getDeviceSettings()).toEqual(DEFAULT_DEVICE_SETTINGS);
  });

  it("plays on the defaults when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(getDeviceSettings()).toEqual(DEFAULT_DEVICE_SETTINGS);
    expect(() => setDeviceSettings({ haptics: false })).not.toThrow();
  });

  it("re-renders a reader when the settings change", () => {
    render(<Probe />);
    expect(screen.getByTestId("probe").textContent).toBe("right md 1");
    act(() => {
      setDeviceSettings({ handedness: "left", dockSize: "sm", sound: 0.5 });
    });
    expect(screen.getByTestId("probe").textContent).toBe("left sm 0.5");
  });
});
