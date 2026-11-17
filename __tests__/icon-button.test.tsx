// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React, { createRef } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { IconButton } from "@/components/ui/IconButton";

describe("IconButton Component Primitive (WCAG 2.2 SC 2.5.8 / C42)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders with minimum target size of 24 by 24 CSS pixels (min-w-6 min-h-6)", () => {
    render(
      <IconButton aria-label="Action button">
        <span>Icon</span>
      </IconButton>
    );
    const button = screen.getByRole("button", { name: "Action button" });
    expect(button).toBeDefined();
    expect(button.className).toContain("min-w-6");
    expect(button.className).toContain("min-h-6");
  });

  it("enforces touch target expansion to 44 by 44 CSS pixels on coarse pointer devices", () => {
    render(
      <IconButton aria-label="Touch control">
        <span>Icon</span>
      </IconButton>
    );
    const button = screen.getByRole("button", { name: "Touch control" });
    expect(button.className).toContain("pointer-coarse:min-h-11");
    expect(button.className).toContain("pointer-coarse:min-w-11");
  });

  it("supports pseudo-element target expansion pattern by default (WCAG Technique C42)", () => {
    render(
      <IconButton aria-label="Dense icon action">
        <span>12px</span>
      </IconButton>
    );
    const button = screen.getByRole("button", { name: "Dense icon action" });
    expect(button.className).toContain("after:absolute");
    expect(button.className).toContain("after:-inset-1.5");
  });

  it("allows disabling pseudo-element target expansion when expandTarget is false", () => {
    render(
      <IconButton aria-label="Standard icon action" expandTarget={false}>
        <span>14px</span>
      </IconButton>
    );
    const button = screen.getByRole("button", { name: "Standard icon action" });
    expect(button.className).not.toContain("after:-inset-1.5");
    expect(button.className).toContain("min-w-6");
    expect(button.className).toContain("min-h-6");
  });

  it("exposes valid accessible name to assistive technologies via aria-label", () => {
    render(
      <IconButton aria-label="Delete patient visit">
        <span>X</span>
      </IconButton>
    );
    const button = screen.getByRole("button", { name: "Delete patient visit" });
    expect(button.getAttribute("aria-label")).toBe("Delete patient visit");
  });

  it("renders keyboard focus indicator ring styles clearly", () => {
    render(
      <IconButton aria-label="Focusable target">
        <span>Icon</span>
      </IconButton>
    );
    const button = screen.getByRole("button", { name: "Focusable target" });
    expect(button.className).toContain("focus-visible:ring-2");
    expect(button.className).toContain("focus-visible:ring-brand-cyan");
  });

  it("supports icon prop as an alternative to children", () => {
    render(
      <IconButton
        aria-label="Save form"
        icon={<span data-testid="custom-icon">Save</span>}
      />
    );
    expect(screen.getByTestId("custom-icon")).toBeDefined();
    expect(screen.getByRole("button", { name: "Save form" })).toBeDefined();
  });

  it("forwards ref and HTML button attributes", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <IconButton
        ref={ref}
        aria-label="Stepper next"
        title="Next Step"
        disabled
      >
        <span>&gt;</span>
      </IconButton>
    );

    const button = screen.getByRole("button", { name: "Stepper next" });
    expect(ref.current).toBe(button);
    expect(button.getAttribute("title")).toBe("Next Step");
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("type")).toBe("button");
  });

  it("invokes onClick handler and isolates pointer events when stopPropagation is invoked", () => {
    const parentClick = vi.fn();
    const buttonClick = vi.fn((e: React.MouseEvent) => {
      e.stopPropagation();
    });

    render(
      <div onClick={parentClick}>
        <IconButton aria-label="Unassign visit form" onClick={buttonClick}>
          <span>Unassign</span>
        </IconButton>
      </div>
    );

    const button = screen.getByRole("button", { name: "Unassign visit form" });
    fireEvent.click(button);

    expect(buttonClick).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });
});
