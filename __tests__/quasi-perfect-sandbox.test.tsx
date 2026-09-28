import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SandboxMode } from "@/components/QuasiPerfectPuzzler/SandboxMode";

// Observe the external animation driver's drop callback; JSDOM has no drag geometry.
// Keep real cards/tree and their click/keyboard behavior mounted.
const drops = vi.hoisted(
  () =>
    new Map<
      string,
      NonNullable<import("framer-motion").MotionProps["onDragEnd"]>
    >()
);
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    motion: {
      ...actual.motion,
      button: actual.motion.button,
      div: (
        props: React.ComponentProps<typeof actual.motion.div> & {
          "data-tactic-id"?: string;
        }
      ) => {
        if (props["data-tactic-id"] && props.onDragEnd)
          drops.set(props["data-tactic-id"], props.onDragEnd);
        return <actual.motion.div {...props} />;
      },
    },
  };
});
afterEach(() => {
  cleanup();
  drops.clear();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "elementsFromPoint");
});

describe("Sandbox target scope (#1234)", () => {
  it("rejects ring on a child without closing the goal, then accepts the root", () => {
    render(<SandboxMode />);
    fireEvent.click(screen.getByRole("button", { name: /^Tactic ring\./ }));
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Variable node with value a. Expression: a",
      })[0]
    );
    expect(screen.queryByText("Q.E.D. (Proof Complete)")).toBeNull();
    expect(screen.getByText(/'ring' requires the root goal/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /^Equality node/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Tactic ring\./ }));
    expect(screen.getByText("Q.E.D. (Proof Complete)")).toBeDefined();
  });
  it("rewrites only the selected arithmetic child and preserves its sibling", () => {
    render(<SandboxMode />);
    fireEvent.click(screen.getByRole("button", { name: "Preset 3" }));
    fireEvent.click(
      screen.getByRole("button", { name: /^Operator node with value \+/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /^Tactic norm_num\./ }));
    expect(
      screen.getByRole("button", {
        name: "Equality node with value =. Expression: 10 = 10",
      })
    ).toBeDefined();
    expect(
      screen.getAllByRole("button", {
        name: "Constant node with value 10. Expression: 10",
      })
    ).toHaveLength(2);
  });

  it("preserves hypotheses when their button is selected as an unsupported target", () => {
    render(<SandboxMode />);
    fireEvent.click(screen.getByRole("button", { name: "Preset 2" }));
    fireEvent.click(screen.getByRole("button", { name: /^Implication node/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Tactic intro\./ }));
    fireEvent.click(screen.getByRole("button", { name: "h: P" }));
    fireEvent.click(screen.getByRole("button", { name: /^Tactic exact\./ }));
    expect(
      screen.getByText(/Hypotheses and empty space are not tactic targets/)
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "h: P" })).toBeDefined();
    expect(screen.queryByText("Q.E.D. (Proof Complete)")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Variable node with value P. Expression: P",
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /^Tactic exact\./ }));
    expect(screen.getByText("Q.E.D. (Proof Complete)")).toBeDefined();
  });

  it("uses the same scope guard for keyboard tactic activation", () => {
    render(<SandboxMode />);
    // Native button keyboard activation produces a click with detail zero.
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Variable node with value a. Expression: a",
      })[0],
      { detail: 0 }
    );
    fireEvent.keyDown(screen.getByRole("button", { name: /^Tactic ring\./ }), {
      key: "Enter",
    });
    expect(screen.getByText(/'ring' requires the root goal/)).toBeDefined();
    expect(screen.queryByText("Q.E.D. (Proof Complete)")).toBeNull();
    expect(
      screen.getByText(/no Lean verification or campaign score/)
    ).toBeDefined();
  });
  it.each(["pointer", "touch"] as const)(
    "rejects a %s drop on a child or outside the Sandbox",
    (input) => {
      render(<SandboxMode />);
      const child = screen.getAllByRole("button", {
        name: "Variable node with value a. Expression: a",
      })[0];
      const hitTest = vi.fn((): Element[] => [child]);
      Object.defineProperty(document, "elementsFromPoint", {
        configurable: true,
        value: hitTest,
      });
      const event =
        input === "pointer"
          ? new MouseEvent("pointerup", { clientX: 12, clientY: 34 })
          : new TouchEvent("touchend", {
              changedTouches: [{ clientX: 12, clientY: 34 } as Touch],
            });
      const drop = () =>
        act(() =>
          drops.get("ring")!(event, {
            point: { x: 12, y: 34 },
            delta: { x: 0, y: 0 },
            offset: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
          })
        );
      drop();
      expect(hitTest).toHaveBeenCalledWith(12, 34);
      expect(screen.getByText(/'ring' requires the root goal/)).toBeDefined();
      expect(screen.queryByText("Q.E.D. (Proof Complete)")).toBeNull();
      const foreignNode = document.createElement("button");
      foreignNode.setAttribute("data-node-id", "sb-goal-1");
      hitTest.mockReturnValue([foreignNode]);
      drop();
      expect(
        screen.getByText(/Hypotheses and empty space are not tactic targets/)
      ).toBeDefined();
      expect(screen.queryByText("Q.E.D. (Proof Complete)")).toBeNull();
    }
  );

  it("reports unsupported multi-goal tactics without modifying the goal", () => {
    render(<SandboxMode />);
    fireEvent.click(screen.getByRole("button", { name: /^Equality node/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Tactic split\./ }));
    expect(
      screen.getByText(/'split' requires multiple proof goals/)
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: /^Equality node/ })
    ).toBeDefined();
    expect(screen.queryByText("Q.E.D. (Proof Complete)")).toBeNull();
  });
});
