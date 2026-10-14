// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import React, { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { TouchControlsGate } from "../components/arcade/mobile";

/** A keydown on the window, which the input modality reads as keyboard use. */
function pressKey(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

/** A pointerdown of the given type, which switches the modality back. */
function pointerDown(pointerType: string) {
  const event = new Event("pointerdown");
  Object.defineProperty(event, "pointerType", { value: pointerType });
  act(() => {
    window.dispatchEvent(event);
  });
}

/**
 * A dock that swaps its keys on its own state, the way the Duck dock does on
 * a scene change. The gate does not re-render when this child does, so only
 * the gate's MutationObserver can catch the new keys.
 */
function SwappingDock() {
  const [scene, setScene] = useState<"office" | "park">("office");
  return (
    <>
      <button type="button" onClick={() => setScene("park")}>
        Change scene
      </button>
      {scene === "office" ? (
        <button type="button" key="office">
          Office key
        </button>
      ) : (
        <button type="button" key="park">
          Park key
        </button>
      )}
    </>
  );
}

describe("TouchControlsGate keeps remounted controls out of the Tab order", () => {
  afterEach(() => {
    cleanup();
  });

  it("re-hides a control that mounts after the gate went hidden", async () => {
    render(
      <TouchControlsGate>
        <SwappingDock />
      </TouchControlsGate>
    );
    pressKey("ArrowUp");
    const before = screen.getByRole("button", {
      name: "Office key",
      hidden: true,
    });
    expect(before.getAttribute("tabindex")).toBe("-1");

    fireEvent.click(
      screen.getByRole("button", { name: "Change scene", hidden: true })
    );

    const park = screen.getByRole("button", {
      name: "Park key",
      hidden: true,
    });
    await waitFor(() => {
      expect(park.getAttribute("tabindex")).toBe("-1");
    });
  });

  it("leaves a remounted control in the Tab order while touch controls are shown", () => {
    render(
      <TouchControlsGate>
        <SwappingDock />
      </TouchControlsGate>
    );
    pressKey("ArrowUp");
    pointerDown("touch");
    fireEvent.click(screen.getByRole("button", { name: "Change scene" }));

    const park = screen.getByRole("button", { name: "Park key" });
    expect(park.hasAttribute("tabindex")).toBe(false);
  });
});
