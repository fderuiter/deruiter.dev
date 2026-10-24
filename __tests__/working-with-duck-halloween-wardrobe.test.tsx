// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fromAny } from "@total-typescript/shoehorn";
import { HALLOWEEN_KEY } from "@/components/working-with-duck/halloween";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    muted: true,
    setMuted: vi.fn(),
  }),
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

import { WorkingWithDuck } from "@/components/WorkingWithDuck";

const ACCESSORIES_KEY = "working_with_duck_accessories";

function radio(container: HTMLElement, name: string) {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('[role="radio"]')
  ).find((el) => el.textContent?.includes(name));
}

function halloweenSwitch(container: HTMLElement) {
  return container.querySelector<HTMLButtonElement>('[role="switch"]');
}

function equipped(container: HTMLElement) {
  return Array.from(container.querySelectorAll("output"))
    .find((o) => o.textContent?.startsWith("Equipped Accessory"))
    ?.textContent?.replace("Equipped Accessory: ", "");
}

describe("Working With Duck Halloween wardrobe (#2737)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // A canvas that accepts every call; the art has its own tests.
    const canvas = new Proxy(
      {},
      {
        get: (_t, prop) =>
          prop === "measureText"
            ? () => ({ width: 8 })
            : prop === "createLinearGradient" || prop === "createRadialGradient"
              ? () => ({ addColorStop: () => {} })
              : () => {},
        set: () => true,
      }
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      fromAny(canvas)
    );
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  async function openWardrobe() {
    await act(async () => {
      root.render(<WorkingWithDuck />);
    });
    const button = container.querySelector<HTMLButtonElement>(
      'button[title="Duck Wardrobe & Accessories"]'
    );
    expect(button).not.toBeNull();
    await act(async () => {
      button!.click();
    });
  }

  it("hides the costumes while Halloween mode is off", async () => {
    localStorage.setItem(HALLOWEEN_KEY, "off");
    await openWardrobe();
    const toggle = halloweenSwitch(container);
    expect(toggle?.getAttribute("aria-checked")).toBe("false");
    expect(radio(container, "Duck Costume")).toBeUndefined();
  });

  it("dresses Duck as a duck once Halloween mode is on, and saves the choice", async () => {
    localStorage.setItem(HALLOWEEN_KEY, "off");
    await openWardrobe();
    await act(async () => {
      halloweenSwitch(container)!.click();
    });
    expect(localStorage.getItem(HALLOWEEN_KEY)).toBe("on");
    expect(halloweenSwitch(container)?.getAttribute("aria-checked")).toBe(
      "true"
    );

    const costume = radio(container, "Duck Costume");
    expect(costume).toBeDefined();
    expect(costume!.disabled).toBe(false);
    expect(radio(container, "Witch Hat")).toBeDefined();
    expect(radio(container, "Vampire Cape")).toBeDefined();

    await act(async () => {
      costume!.click();
    });
    expect(costume!.getAttribute("aria-checked")).toBe("true");
    expect(equipped(container)).toBe("duck-costume");
    const saved = JSON.parse(localStorage.getItem(ACCESSORIES_KEY) ?? "{}");
    expect(saved.equipped).toBe("duck-costume");
  });

  it("takes the costume off when Halloween mode is switched off", async () => {
    localStorage.setItem(HALLOWEEN_KEY, "on");
    await openWardrobe();
    await act(async () => {
      radio(container, "Witch Hat")!.click();
    });
    expect(equipped(container)).toBe("witch-hat");

    await act(async () => {
      halloweenSwitch(container)!.click();
    });
    expect(localStorage.getItem(HALLOWEEN_KEY)).toBe("off");
    expect(equipped(container)).toBe("none");
    expect(radio(container, "Witch Hat")).toBeUndefined();
  });

  it("keeps a saved costume on after a reload only while Halloween mode is on", async () => {
    localStorage.setItem(
      ACCESSORIES_KEY,
      JSON.stringify({
        unlocked: ["none", "bucket-hat"],
        equipped: "duck-costume",
      })
    );
    localStorage.setItem(HALLOWEEN_KEY, "on");
    await openWardrobe();
    expect(equipped(container)).toBe("duck-costume");
    act(() => root.unmount());

    localStorage.setItem(HALLOWEEN_KEY, "off");
    root = createRoot(container);
    await openWardrobe();
    expect(equipped(container)).toBe("none");
  });
});
