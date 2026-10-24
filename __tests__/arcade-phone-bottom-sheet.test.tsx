// @vitest-environment jsdom
// #2361: the phone's shared BottomSheet. It snaps between peek, half and
// full, its handle is a button and a drag target, it is a modal dialog under
// the useFocusTrap stack rules, it makes the cabinet around it inert, and it
// pauses real-time play with the reason `sheet` while it is open.
import { describe, it, expect, vi, afterEach } from "vitest";
import React, { useState } from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import axe from "axe-core";
import { BottomSheet } from "@/components/arcade/mobile/ui";
import {
  CabinetPauseProvider,
  createPauseController,
} from "@/components/arcade/pause";
import { useFocusTrap } from "@/hooks/useFocusTrap";

afterEach(() => {
  cleanup();
});

function Sheet(props: Partial<React.ComponentProps<typeof BottomSheet>>) {
  return (
    <BottomSheet open title="Options" onClose={() => {}} {...props}>
      <button type="button">First option</button>
      <button type="button">Second option</button>
    </BottomSheet>
  );
}

describe("BottomSheet (#2361)", () => {
  it("renders nothing while closed", () => {
    render(<Sheet open={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is a modal dialog named by its heading, and focuses its close button", async () => {
    render(<Sheet />);
    const dialog = screen.getByRole("dialog", { name: "Options" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByRole("heading", { name: "Options" })).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Close Options" })
      )
    );
  });

  it("closes on Escape, the close button and the backdrop", () => {
    const onClose = vi.fn();
    render(<Sheet onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close Options" }));
    fireEvent.click(screen.getByTestId("bottom-sheet-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("pauses play with the reason `sheet` while open, and holds it for a second sheet", () => {
    const controller = createPauseController();
    function Two() {
      const [a, setA] = useState(true);
      const [b, setB] = useState(true);
      return (
        <CabinetPauseProvider controller={controller}>
          <button type="button" onClick={() => setA(false)}>
            Close A
          </button>
          <button type="button" onClick={() => setB(false)}>
            Close B
          </button>
          <BottomSheet open={a} title="A" onClose={() => setA(false)}>
            a
          </BottomSheet>
          <BottomSheet open={b} title="B" onClose={() => setB(false)}>
            b
          </BottomSheet>
        </CabinetPauseProvider>
      );
    }
    const { container } = render(<Two />);
    expect(controller.getState().reasons.has("sheet")).toBe(true);
    // The sheets make the buttons inert; click them through the DOM.
    fireEvent.click(container.querySelector("button")!);
    expect(controller.getState().reasons.has("sheet")).toBe(true);
    fireEvent.click(container.querySelectorAll("button")[1]);
    expect(controller.getState().paused).toBe(false);
  });

  it("leaves play running when `pausesPlay` is false", () => {
    const controller = createPauseController();
    render(
      <CabinetPauseProvider controller={controller}>
        <Sheet pausesPlay={false} />
      </CabinetPauseProvider>
    );
    expect(controller.getState().paused).toBe(false);
  });

  it("makes the cabinet around it inert, but not live regions or what was already inert", () => {
    function Cabinet({ open }: { open: boolean }) {
      return (
        <div data-arcade-cabinet="fixture">
          <div role="status" aria-live="polite">
            Score 10
          </div>
          <div data-testid="chrome">
            <button type="button">Exit</button>
          </div>
          <div data-testid="already" inert>
            held
          </div>
          <div data-testid="stage">
            <canvas aria-label="Stage" />
            <div data-testid="game-ui">
              <button type="button">Menu</button>
              <Sheet open={open} />
            </div>
          </div>
        </div>
      );
    }
    const { rerender } = render(<Cabinet open />);
    expect(screen.getByTestId("chrome").hasAttribute("inert")).toBe(true);
    expect(screen.getByText("Menu").hasAttribute("inert")).toBe(true);
    expect(screen.getByLabelText("Stage").hasAttribute("inert")).toBe(true);
    expect(screen.getByRole("status").hasAttribute("inert")).toBe(false);
    expect(screen.getByRole("dialog").hasAttribute("inert")).toBe(false);
    expect(screen.getByTestId("stage").hasAttribute("inert")).toBe(false);

    rerender(<Cabinet open={false} />);
    expect(screen.getByTestId("chrome").hasAttribute("inert")).toBe(false);
    expect(screen.getByText("Menu").hasAttribute("inert")).toBe(false);
    expect(screen.getByTestId("already").hasAttribute("inert")).toBe(true);
  });

  it("steps through the snaps by tap and by arrow keys", () => {
    const onSnapChange = vi.fn();
    render(<Sheet onSnapChange={onSnapChange} />);
    const dialog = screen.getByRole("dialog");
    const handle = screen.getByRole("button", { name: /Sheet height/ });
    expect(dialog.getAttribute("data-snap")).toBe("half");
    expect(handle.getAttribute("aria-label")).toBe("Sheet height: half height");

    fireEvent.click(handle);
    expect(dialog.getAttribute("data-snap")).toBe("full");
    fireEvent.click(handle);
    expect(dialog.getAttribute("data-snap")).toBe("peek");
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(dialog.getAttribute("data-snap")).toBe("half");
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(dialog.getAttribute("data-snap")).toBe("peek");
    fireEvent.keyDown(handle, { key: "End" });
    expect(dialog.getAttribute("data-snap")).toBe("full");
    expect(onSnapChange.mock.calls.map(([snap]) => snap)).toEqual([
      "full",
      "peek",
      "half",
      "peek",
      "full",
    ]);
  });

  it("snaps a drag to the nearest height, and closes on a drag off the bottom", () => {
    const onClose = vi.fn();
    render(<Sheet onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    const handle = screen.getByTestId("bottom-sheet-handle");
    const height = window.innerHeight;
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      height: height * 0.55,
    } as DOMRect);

    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 600 });
    fireEvent.pointerMove(handle, {
      pointerId: 1,
      clientY: 600 - height * 0.3,
    });
    expect(dialog.style.height).toMatch(/px$/);
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 600 - height * 0.3 });
    // The click a drag ends with is not a tap.
    fireEvent.click(handle);
    expect(dialog.getAttribute("data-snap")).toBe("full");
    expect(dialog.style.height).toBe("92dvh");

    fireEvent.pointerDown(handle, { pointerId: 2, clientY: 100 });
    fireEvent.pointerMove(handle, { pointerId: 2, clientY: 100 + height });
    fireEvent.pointerUp(handle, { pointerId: 2, clientY: 100 + height });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("gives Tab to a dialog opened inside it (the useFocusTrap stack rule)", async () => {
    function Inner() {
      const ref = useFocusTrap<HTMLDivElement>(true);
      return (
        <div ref={ref} role="dialog" aria-label="Confirm">
          <button type="button">Yes</button>
          <button type="button">No</button>
        </div>
      );
    }
    function Nested() {
      const [inner, setInner] = useState(false);
      return (
        <BottomSheet open title="Options" onClose={() => {}}>
          <button type="button" onClick={() => setInner(true)}>
            Ask
          </button>
          {inner && <Inner />}
        </BottomSheet>
      );
    }
    render(<Nested />);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    const no = screen.getByRole("button", { name: "No" });
    no.focus();
    fireEvent.keyDown(no, { key: "Tab" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Yes" })
    );
  });

  it("pads for the safe area and does not animate under reduced motion", () => {
    render(<Sheet />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("pb-[env(safe-area-inset-bottom)]");
    expect(dialog.className).toContain("motion-reduce:transition-none");
  });

  it("has zero axe violations", async () => {
    const { container } = render(
      <main>
        <Sheet />
      </main>
    );
    const result = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
    expect(result.violations).toEqual([]);
  });
});
