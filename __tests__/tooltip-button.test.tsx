import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createRef } from "react";
import { fromPartial } from "@total-typescript/shoehorn";
import { TooltipButton } from "@/components/ui/Tooltip";

/**
 * TooltipButton replaces `title` tooltips on buttons (#3978): the hint shows
 * on hover and focus, hides on Escape and blur, stays hoverable, and
 * describes the button for assistive technology.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("TooltipButton without anchor positioning (fallback)", () => {
  it("renders no title and no tip until hovered", () => {
    render(<TooltipButton tooltip="Delete the visit">Delete</TooltipButton>);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.hasAttribute("title")).toBe(false);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(button.getAttribute("aria-describedby")).toBeNull();
    // The hint stays readable for tests and specs without showing the tip.
    expect(button.dataset.tooltip).toBe("Delete the visit");
  });

  it("shows on hover and describes the button", () => {
    render(<TooltipButton tooltip="Delete the visit">Delete</TooltipButton>);
    const button = screen.getByRole("button", { name: "Delete" });
    fireEvent.mouseEnter(button);
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toBe("Delete the visit");
    expect(button.getAttribute("aria-describedby")).toBe(tip.id);
    expect(tip.style.position).toBe("fixed");
  });

  it("shows on focus and hides on blur and on Escape", () => {
    render(<TooltipButton tooltip="Delete the visit">Delete</TooltipButton>);
    const button = screen.getByRole("button", { name: "Delete" });
    fireEvent.focus(button);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(button, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.focus(button);
    fireEvent.blur(button);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("stays open while the pointer moves onto the tip", () => {
    render(<TooltipButton tooltip="Delete the visit">Delete</TooltipButton>);
    const button = screen.getByRole("button", { name: "Delete" });
    fireEvent.mouseEnter(button);
    fireEvent.mouseLeave(button);
    fireEvent.mouseEnter(screen.getByRole("tooltip"));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.mouseLeave(screen.getByRole("tooltip"));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("does not repeat a tip that matches the aria-label", () => {
    render(
      <TooltipButton tooltip="Delete visit" aria-label="Delete visit">
        <svg aria-hidden="true" />
      </TooltipButton>
    );
    const button = screen.getByRole("button", { name: "Delete visit" });
    fireEvent.mouseEnter(button);
    expect(screen.getByRole("tooltip").textContent).toBe("Delete visit");
    expect(button.getAttribute("aria-describedby")).toBeNull();
  });

  it("keeps the caller's handlers, ref and description", () => {
    const onFocus = vi.fn();
    const onKeyDown = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(
      <>
        <span id="extra">More</span>
        <TooltipButton
          ref={ref}
          tooltip="Tip"
          aria-describedby="extra"
          onFocus={onFocus}
          onKeyDown={onKeyDown}
        >
          Go
        </TooltipButton>
      </>
    );
    const button = screen.getByRole("button", { name: "Go" });
    expect(ref.current).toBe(button);
    fireEvent.focus(button);
    fireEvent.keyDown(button, { key: "Escape" });
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    fireEvent.focus(button);
    const tip = screen.getByRole("tooltip");
    expect(button.getAttribute("aria-describedby")).toBe(`extra ${tip.id}`);
  });

  it("renders a plain button when the tooltip is undefined", () => {
    render(<TooltipButton tooltip={undefined}>Go</TooltipButton>);
    const button = screen.getByRole("button", { name: "Go" });
    fireEvent.mouseEnter(button);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(button.hasAttribute("data-tooltip")).toBe(false);
  });

  it("keeps the fallback tip inside the viewport near the right edge", () => {
    vi.stubGlobal("innerWidth", 320);
    render(<TooltipButton tooltip="Edge tip">Edge</TooltipButton>);
    const button = screen.getByRole("button", { name: "Edge" });
    button.getBoundingClientRect = () =>
      fromPartial<DOMRect>({
        left: 310,
        right: 330,
        top: 200,
        bottom: 220,
        width: 20,
        height: 20,
      });
    fireEvent.mouseEnter(button);
    const tip = screen.getByRole("tooltip");
    expect(Number.parseFloat(tip.style.left)).toBeLessThanOrEqual(312);
  });
});

describe("TooltipButton with anchor positioning", () => {
  beforeEach(() => {
    vi.stubGlobal("CSS", { supports: () => true });
    HTMLElement.prototype.showPopover = vi.fn();
    HTMLElement.prototype.hidePopover = vi.fn();
  });

  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
    delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover;
  });

  it("keeps a hint popover in the DOM that always describes the button", () => {
    render(<TooltipButton tooltip="Delete the visit">Delete</TooltipButton>);
    const button = screen.getByRole("button", { name: "Delete" });
    const tip = document.querySelector<HTMLElement>("[role=tooltip]");
    expect(tip?.getAttribute("popover")).toBe("hint");
    expect(button.getAttribute("aria-describedby")).toBe(tip?.id);
    fireEvent.mouseEnter(button);
    expect(HTMLElement.prototype.showPopover).toHaveBeenCalled();
  });
});
