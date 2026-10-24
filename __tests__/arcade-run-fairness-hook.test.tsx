import { describe, expect, it } from "vitest";
import { act, fireEvent, renderHook } from "@testing-library/react";
import { useRunFairness } from "@/components/arcade/views";
import { createRunFairness, type FairnessPolicy } from "@/lib/arcade";

// useRunFairness (#2547): a view notes itself and the player's input on the
// session's record, and the record's assists follow the input only.

const policy: FairnessPolicy = {
  levels: { aimAssist: ["off", "strong"] },
  assistsFor: (input): Record<string, string | boolean> =>
    input === "touch" ? { aimAssist: "strong" } : {},
};

/** A pointerdown of one type, as the input modality store hears it. */
function pointerDown(pointerType: string) {
  const event = new Event("pointerdown", { bubbles: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  fireEvent(window, event);
}

describe("useRunFairness", () => {
  it("notes the view and the input, and a keyboard after touch keeps the assists", () => {
    const fairness = createRunFairness(policy);
    const { rerender } = renderHook(
      ({ view }) => useRunFairness(fairness, view),
      { initialProps: { view: "desktop" as "desktop" | "phone" } }
    );
    expect(fairness.getTags()).toEqual({
      views: ["desktop"],
      inputs: ["mouse"],
      assists: {},
    });

    // Narrowing the window to the phone view grants nothing.
    rerender({ view: "phone" });
    expect(fairness.assists()).toEqual({ aimAssist: "off" });

    act(() => pointerDown("touch"));
    act(() => {
      fireEvent.keyDown(window, { key: "ArrowLeft" });
    });
    expect(fairness.getTags()).toEqual({
      views: ["desktop", "phone"],
      inputs: ["mouse", "touch", "keyboard"],
      assists: { aimAssist: "strong" },
    });
  });

  it("does nothing without a record", () => {
    expect(() =>
      renderHook(() => useRunFairness(undefined, "tablet"))
    ).not.toThrow();
  });
});
