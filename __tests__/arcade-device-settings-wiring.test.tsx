import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  ActionSinkProvider,
  defineActions,
  setDeviceSettings,
} from "@/lib/arcade";
import { DockFrame, useFormFactor } from "@/components/arcade/mobile";
import { ActionCluster, DpadDock } from "@/components/arcade/mobile/docks";
import { PhoneStage } from "@/components/arcade/stage";
import { triggerHaptic } from "@/lib/haptics";

// The device settings from the cabinet's Setup sheet reach the views, the
// docks, the stages and the vibration (#2924). Each reader follows a change
// live, and a value the game passes still wins.

const MAP = defineActions(
  {
    up: { kind: "press", keys: ["ArrowUp"], label: "Move up" },
    down: { kind: "press", keys: ["ArrowDown"], label: "Move down" },
    left: { kind: "press", keys: ["ArrowLeft"], label: "Move left" },
    right: { kind: "press", keys: ["ArrowRight"], label: "Move right" },
    fire: { kind: "press", keys: ["Space"], label: "Fire" },
  },
  { groups: {} }
);

const originalMatchMedia = window.matchMedia;

function setWindow(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  });
}

function change(patch: Parameters<typeof setDeviceSettings>[0]) {
  act(() => {
    setDeviceSettings(patch);
  });
}

beforeEach(() => {
  localStorage.clear();
  // A fine pointer: a 1280x800 window measures as a desktop.
  window.matchMedia = vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  window.history.replaceState(null, "", "/");
  setWindow(1280, 800);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.matchMedia = originalMatchMedia;
  localStorage.clear();
});

describe("useFormFactor reads the Layout setting (#2924)", () => {
  function Probe({ override }: { override?: "auto" | "phone" }) {
    return <output data-testid="view">{useFormFactor({ override })}</output>;
  }
  const view = () => screen.getByTestId("view").textContent;

  it("shows the chosen view, live, and Auto measures again", () => {
    render(<Probe />);
    expect(view()).toBe("desktop");

    change({ layout: "tablet" });
    expect(view()).toBe("tablet");
    change({ layout: "phone" });
    expect(view()).toBe("phone");
    change({ layout: "auto" });
    expect(view()).toBe("desktop");
  });

  it("falls back to Auto while the window is too narrow for the choice", () => {
    setWindow(700, 900);
    render(<Probe />);
    change({ layout: "desktop" });
    // A desktop view needs 1024px; this window measures as a phone.
    expect(view()).toBe("phone");

    act(() => {
      setWindow(1280, 800);
      window.dispatchEvent(new Event("resize"));
    });
    expect(view()).toBe("desktop");
  });

  it("lets a forced view and ?view= win over the setting", () => {
    change({ layout: "tablet" });
    render(<Probe override="phone" />);
    expect(view()).toBe("phone");
    cleanup();

    window.history.replaceState(null, "", "/?view=desktop");
    render(<Probe />);
    expect(view()).toBe("desktop");
  });
});

describe("the docks and stages read the key size and hand (#2924)", () => {
  function Docks({ size }: { size?: "sm" | "md" | "lg" }) {
    return (
      <ActionSinkProvider actions={MAP} onAction={() => {}}>
        <DockFrame>
          <DpadDock
            map={MAP}
            size={size}
            actions={{ up: "up", down: "down", left: "left", right: "right" }}
          />
          <ActionCluster map={MAP} actions={["fire"]} size={size} />
        </DockFrame>
      </ActionSinkProvider>
    );
  }

  it("draws the setting's key size and follows a change", () => {
    const { container } = render(<Docks />);
    const sizes = () =>
      Array.from(container.querySelectorAll("[data-dock-size]")).map((dock) =>
        dock.getAttribute("data-dock-size")
      );
    expect(sizes()).toEqual(["md", "md"]);
    change({ dockSize: "lg" });
    expect(sizes()).toEqual(["lg", "lg"]);
  });

  it("keeps a size the game passes", () => {
    setDeviceSettings({ dockSize: "lg" });
    const { container } = render(<Docks size="sm" />);
    expect(
      container
        .querySelector('[data-dock-preset="dpad"]')
        ?.getAttribute("data-dock-size")
    ).toBe("sm");
  });

  it("mirrors the frame, the cluster and the stage for a left hand", () => {
    const { container } = render(
      <>
        <Docks />
        <PhoneStage orientation="landscape">
          <div />
        </PhoneStage>
      </>
    );
    const hands = () =>
      Array.from(container.querySelectorAll("[data-handedness]")).map((el) =>
        el.getAttribute("data-handedness")
      );
    expect(hands()).toEqual(["right", "right", "right"]);
    change({ handedness: "left" });
    expect(hands()).toEqual(["left", "left", "left"]);
  });

  it("keeps a hand the game passes", () => {
    setDeviceSettings({ handedness: "left" });
    const { container } = render(
      <PhoneStage orientation="landscape" handedness="right">
        <div />
      </PhoneStage>
    );
    expect(
      container.querySelector(".arcade-stage")?.getAttribute("data-handedness")
    ).toBe("right");
  });
});

describe("triggerHaptic reads the Vibration setting (#2924)", () => {
  it("vibrates only while Vibration is on", () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vibrate,
    });
    try {
      triggerHaptic(20);
      expect(vibrate).toHaveBeenCalledTimes(1);

      setDeviceSettings({ haptics: false });
      triggerHaptic(20);
      expect(vibrate).toHaveBeenCalledTimes(1);

      setDeviceSettings({ haptics: true });
      triggerHaptic(20);
      expect(vibrate).toHaveBeenCalledTimes(2);
    } finally {
      Reflect.deleteProperty(navigator, "vibrate");
    }
  });
});
