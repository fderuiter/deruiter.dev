// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FieldManualButton } from "@/components/FieldManualButton";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
    playAutocomplete: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

/**
 * #1549: an arcade hub card has backdrop-blur-xl, which makes the card the
 * containing block for a `fixed inset-0` descendant. The manual must render
 * outside the card, directly under document.body.
 */
describe("FieldManualModal portal (#1549)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the card-variant dialog under document.body, outside the card", async () => {
    await act(async () => {
      root.render(
        <div data-testid="hub-card" className="backdrop-blur-xl">
          <FieldManualButton manualId="working-with-duck" variant="card" />
        </div>
      );
    });

    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-testid="hub-card"] button'
    );
    expect(trigger).not.toBeNull();

    await act(async () => {
      trigger?.focus();
      trigger?.click();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.parentElement).toBe(document.body);
    expect(container.contains(dialog)).toBe(false);

    // Escape still closes it and focus returns to the trigger.
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
