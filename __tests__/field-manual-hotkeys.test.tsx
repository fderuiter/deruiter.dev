/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act, StrictMode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FieldManualButton } from "@/components/FieldManualButton";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
    playAutocomplete: vi.fn(),
    volume: 0.8,
    muted: true,
    profile: "8-bit",
    setVolume: vi.fn(),
    setMuted: vi.fn(),
    setProfile: vi.fn(),
  }),
  AudioProvider: ({ children }: any) => <>{children}</>,
}));

describe("FieldManualButton - Hotkey & Ownership Safety (DUCK-02)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    consoleErrorSpy.mockRestore();
  });

  it("toggles without updating parent state during functional state updates in StrictMode", async () => {
    // Parent component that updates its own state when onOpenChange is called
    function ParentWithState() {
      const [parentState, setParentState] = useState(false);
      return (
        <div>
          <div data-testid="parent-status">
            {parentState ? "OPEN" : "CLOSED"}
          </div>
          <FieldManualButton
            manualId="working-with-duck"
            onOpenChange={(isOpen) => {
              setParentState(isOpen);
            }}
          />
        </div>
      );
    }

    await act(async () => {
      root.render(
        <StrictMode>
          <ParentWithState />
        </StrictMode>
      );
    });

    expect(
      container.querySelector('[data-testid="parent-status"]')?.textContent
    ).toBe("CLOSED");

    // Press '?' to toggle open
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", bubbles: true })
      );
    });

    // Verify React 19 warning did not fire:
    // "Cannot update a component (`ParentWithState`) while rendering a different component (`FieldManualButton`)"
    const badSetStateWarnings = consoleErrorSpy.mock.calls.filter(
      (call: unknown[]) =>
        call.some(
          (arg: unknown) =>
            typeof arg === "string" && arg.includes("Cannot update a component")
        )
    );
    expect(badSetStateWarnings).toHaveLength(0);

    expect(
      container.querySelector('[data-testid="parent-status"]')?.textContent
    ).toBe("OPEN");
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1);

    // Press '?' again to toggle closed
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", bubbles: true })
      );
    });

    expect(
      container.querySelector('[data-testid="parent-status"]')?.textContent
    ).toBe("CLOSED");
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);
  });

  it("opens exactly one dialog when duplicate responsive controls are mounted", async () => {
    const onOpenChangeDesktop = vi.fn();
    const onOpenChangeMobile = vi.fn();

    function ResponsiveControls() {
      return (
        <StrictMode>
          <div>
            {/* Simulated Desktop Header Control */}
            <div data-testid="desktop-wrapper">
              <FieldManualButton
                manualId="working-with-duck"
                label="Manual Desktop"
                onOpenChange={onOpenChangeDesktop}
                isHotkeyOwner={true}
              />
            </div>
            {/* Simulated Mobile Hotbar Control */}
            <div data-testid="mobile-wrapper">
              <FieldManualButton
                manualId="working-with-duck"
                label="Manual Mobile"
                onOpenChange={onOpenChangeMobile}
                isHotkeyOwner={false}
              />
            </div>
          </div>
        </StrictMode>
      );
    }

    await act(async () => {
      root.render(<ResponsiveControls />);
    });

    // Press 'h' shortcut
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "h", bubbles: true })
      );
    });

    // Exactly one dialog should be open in the DOM, not two competing dialogs
    const openDialogs = document.body.querySelectorAll('[role="dialog"]');
    expect(openDialogs).toHaveLength(1);

    // Desktop owner was notified, mobile non-owner was not falsely triggered
    expect(onOpenChangeDesktop).toHaveBeenCalledWith(true);
    expect(onOpenChangeMobile).not.toHaveBeenCalled();

    // Repeated hotkey toggle closes the single open dialog
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "h", bubbles: true })
      );
    });

    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(onOpenChangeDesktop).toHaveBeenCalledWith(false);
  });

  it("deterministically picks single owner even when no isHotkeyOwner prop is specified", async () => {
    const onOpen1 = vi.fn();
    const onOpen2 = vi.fn();

    await act(async () => {
      root.render(
        <StrictMode>
          <div>
            <FieldManualButton
              manualId="working-with-duck"
              onOpenChange={onOpen1}
            />
            <FieldManualButton
              manualId="working-with-duck"
              onOpenChange={onOpen2}
            />
          </div>
        </StrictMode>
      );
    });

    // Press '?' shortcut
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", bubbles: true })
      );
    });

    // Exactly one dialog opens
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(onOpen1.mock.calls.length + onOpen2.mock.calls.length).toBe(1);

    // Press '?' to close
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", bubbles: true })
      );
    });

    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);
  });

  it("ignores hotkey when typing in editable or protected contexts", async () => {
    const onOpenChange = vi.fn();

    await act(async () => {
      root.render(
        <StrictMode>
          <div>
            <input data-testid="test-input" type="text" />
            <textarea data-testid="test-textarea" />
            <div data-testid="test-editable" contentEditable />
            <div data-keyboard-boundary data-testid="test-boundary">
              <button type="button">Inside boundary</button>
            </div>
            <FieldManualButton
              manualId="working-with-duck"
              onOpenChange={onOpenChange}
            />
          </div>
        </StrictMode>
      );
    });

    const input = container.querySelector<HTMLInputElement>(
      '[data-testid="test-input"]'
    )!;
    const textarea = container.querySelector<HTMLTextAreaElement>(
      '[data-testid="test-textarea"]'
    )!;
    const editable = container.querySelector<HTMLDivElement>(
      '[data-testid="test-editable"]'
    )!;
    const boundaryBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="test-boundary"] button'
    )!;

    // 1. Inside Input
    input.focus();
    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", bubbles: true })
      );
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "h", bubbles: true })
      );
    });
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(onOpenChange).not.toHaveBeenCalled();

    // 2. Inside Textarea
    textarea.focus();
    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", bubbles: true })
      );
    });
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);

    // 3. Inside contentEditable
    editable.focus();
    await act(async () => {
      editable.dispatchEvent(
        new KeyboardEvent("keydown", { key: "h", bubbles: true })
      );
    });
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);

    // 4. Inside keyboard boundary
    boundaryBtn.focus();
    await act(async () => {
      boundaryBtn.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", bubbles: true })
      );
    });
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("leaves a key a game already handled to the game (#1323)", async () => {
    function GameWithHintKey() {
      const [hints, setHints] = useState(false);
      return (
        <div
          data-testid="game"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "h") {
              e.preventDefault();
              setHints((prev) => !prev);
            }
          }}
        >
          <span data-testid="hints">{hints ? "ON" : "OFF"}</span>
          <FieldManualButton manualId="quasi-puzzler" />
        </div>
      );
    }

    await act(async () => {
      root.render(<GameWithHintKey />);
    });
    const game = container.querySelector('[data-testid="game"]') as HTMLElement;

    await act(async () => {
      game.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "h",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(container.querySelector('[data-testid="hints"]')?.textContent).toBe(
      "ON"
    );
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);

    // ? is not claimed by the game, so it still opens the manual.
    await act(async () => {
      game.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "?",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  it("does not trigger hotkey for card variant buttons by default", async () => {
    const onOpenChange = vi.fn();

    await act(async () => {
      root.render(
        <StrictMode>
          <FieldManualButton
            manualId="working-with-duck"
            variant="card"
            onOpenChange={onOpenChange}
          />
        </StrictMode>
      );
    });

    // Press '?' or 'h'
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", bubbles: true })
      );
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "h", bubbles: true })
      );
    });

    // Card variant buttons should ignore global hotkeys by default
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("supports opening via mouse click and closing via hotkey", async () => {
    const onOpenChange = vi.fn();

    await act(async () => {
      root.render(
        <StrictMode>
          <FieldManualButton
            manualId="working-with-duck"
            onOpenChange={onOpenChange}
          />
        </StrictMode>
      );
    });

    const button = container.querySelector("button")!;
    expect(button).not.toBeNull();

    // Open via mouse click
    await act(async () => {
      button.click();
    });

    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(onOpenChange).toHaveBeenCalledWith(true);

    // Close via 'h' hotkey
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "h", bubbles: true })
      );
    });

    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Re-open via '?' hotkey
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", bubbles: true })
      );
    });

    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1);

    // Dismiss via Escape
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });

    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("selects visible mobile manual owner on phone viewport (<768px)", async () => {
    const onOpenDesktop = vi.fn();
    const onOpenMobile = vi.fn();

    function ResponsiveSetup() {
      return (
        <StrictMode>
          <div>
            <div data-testid="desktop-wrapper">
              <FieldManualButton
                manualId="working-with-duck"
                label="Manual Desktop"
                onOpenChange={onOpenDesktop}
                isHotkeyOwner={true}
              />
            </div>
            <div data-testid="mobile-wrapper">
              <FieldManualButton
                manualId="working-with-duck"
                label="Manual Mobile"
                onOpenChange={onOpenMobile}
                isHotkeyOwner={true}
              />
            </div>
          </div>
        </StrictMode>
      );
    }

    await act(async () => {
      root.render(<ResponsiveSetup />);
    });

    const desktopBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="desktop-wrapper"] button'
    )!;
    const mobileBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="mobile-wrapper"] button'
    )!;

    // Isolated visibility mock: Phone viewport (desktop hidden, mobile visible)
    desktopBtn.checkVisibility = () => false;
    mobileBtn.checkVisibility = () => true;

    // Press 'h' shortcut
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "h", bubbles: true })
      );
    });

    // Exactly one dialog opens, owned by the visible mobile button
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(onOpenMobile).toHaveBeenCalledWith(true);
    expect(onOpenDesktop).not.toHaveBeenCalled();

    // Toggle closed with 'h'
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "h", bubbles: true })
      );
    });
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(onOpenMobile).toHaveBeenCalledWith(false);
    expect(onOpenDesktop).not.toHaveBeenCalled();
  });

  it("selects visible mobile manual owner on 1440x500 short desktop viewport", async () => {
    const onOpenDesktop = vi.fn();
    const onOpenMobile = vi.fn();

    function ShortDesktopSetup() {
      return (
        <StrictMode>
          <div>
            <div data-testid="desktop-wrapper">
              <FieldManualButton
                manualId="working-with-duck"
                label="Manual Desktop"
                onOpenChange={onOpenDesktop}
                isHotkeyOwner={true}
              />
            </div>
            <div data-testid="mobile-wrapper">
              <FieldManualButton
                manualId="working-with-duck"
                label="Manual Mobile"
                onOpenChange={onOpenMobile}
                isHotkeyOwner={true}
              />
            </div>
          </div>
        </StrictMode>
      );
    }

    await act(async () => {
      root.render(<ShortDesktopSetup />);
    });

    const desktopBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="desktop-wrapper"] button'
    )!;
    const mobileBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="mobile-wrapper"] button'
    )!;

    // Isolated visibility mock: 1440x500 short desktop (desktop hidden by height, mobile deck visible)
    desktopBtn.checkVisibility = () => false;
    mobileBtn.checkVisibility = () => true;

    // Press '?' shortcut
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", bubbles: true })
      );
    });

    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(onOpenMobile).toHaveBeenCalledWith(true);
    expect(onOpenDesktop).not.toHaveBeenCalled();

    // Toggle closed with '?'
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", bubbles: true })
      );
    });
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(onOpenMobile).toHaveBeenCalledWith(false);
  });

  it("selects visible desktop manual owner on normal desktop viewport", async () => {
    const onOpenDesktop = vi.fn();
    const onOpenMobile = vi.fn();

    function NormalDesktopSetup() {
      return (
        <StrictMode>
          <div>
            <div data-testid="desktop-wrapper">
              <FieldManualButton
                manualId="working-with-duck"
                label="Manual Desktop"
                onOpenChange={onOpenDesktop}
                isHotkeyOwner={true}
              />
            </div>
            <div data-testid="mobile-wrapper">
              <FieldManualButton
                manualId="working-with-duck"
                label="Manual Mobile"
                onOpenChange={onOpenMobile}
                isHotkeyOwner={true}
              />
            </div>
          </div>
        </StrictMode>
      );
    }

    await act(async () => {
      root.render(<NormalDesktopSetup />);
    });

    const desktopBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="desktop-wrapper"] button'
    )!;
    const mobileBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="mobile-wrapper"] button'
    )!;

    // Isolated visibility mock: Normal desktop (desktop visible, mobile hidden)
    desktopBtn.checkVisibility = () => true;
    mobileBtn.checkVisibility = () => false;

    // Press 'h' shortcut
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "h", bubbles: true })
      );
    });

    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(onOpenDesktop).toHaveBeenCalledWith(true);
    expect(onOpenMobile).not.toHaveBeenCalled();

    // Toggle closed
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "h", bubbles: true })
      );
    });
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(onOpenDesktop).toHaveBeenCalledWith(false);
  });

  it("dynamically adapts ownership across responsive viewport transitions", async () => {
    const onOpenDesktop = vi.fn();
    const onOpenMobile = vi.fn();

    function TransitionSetup() {
      return (
        <StrictMode>
          <div>
            <div data-testid="desktop-wrapper">
              <FieldManualButton
                manualId="working-with-duck"
                label="Manual Desktop"
                onOpenChange={onOpenDesktop}
                isHotkeyOwner={true}
              />
            </div>
            <div data-testid="mobile-wrapper">
              <FieldManualButton
                manualId="working-with-duck"
                label="Manual Mobile"
                onOpenChange={onOpenMobile}
                isHotkeyOwner={true}
              />
            </div>
          </div>
        </StrictMode>
      );
    }

    await act(async () => {
      root.render(<TransitionSetup />);
    });

    const desktopBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="desktop-wrapper"] button'
    )!;
    const mobileBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="mobile-wrapper"] button'
    )!;

    // 1. Initial State: Normal Desktop (desktop visible, mobile hidden)
    desktopBtn.checkVisibility = () => true;
    mobileBtn.checkVisibility = () => false;

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "h", bubbles: true })
      );
    });

    expect(onOpenDesktop).toHaveBeenCalledWith(true);
    expect(onOpenMobile).not.toHaveBeenCalled();

    // Dismiss with Escape
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });
    expect(onOpenDesktop).toHaveBeenCalledWith(false);

    // 2. Viewport Transition: Desktop window resized down to phone / short desktop
    desktopBtn.checkVisibility = () => false;
    mobileBtn.checkVisibility = () => true;

    // Press 'h' shortcut: now mobile must be the active owner!
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "h", bubbles: true })
      );
    });

    expect(onOpenMobile).toHaveBeenCalledWith(true);
    expect(onOpenDesktop).toHaveBeenCalledTimes(2); // open(true) + close(false) from earlier
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1);

    // Dismiss with 'h'
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "h", bubbles: true })
      );
    });
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(onOpenMobile).toHaveBeenCalledWith(false);
  });

  it("rejects hidden candidates when all mounted controls are hidden", async () => {
    const onOpenDesktop = vi.fn();
    const onOpenMobile = vi.fn();

    function AllHiddenSetup() {
      return (
        <StrictMode>
          <div>
            <div data-testid="desktop-wrapper">
              <FieldManualButton
                manualId="working-with-duck"
                label="Manual Desktop"
                onOpenChange={onOpenDesktop}
                isHotkeyOwner={true}
              />
            </div>
            <div data-testid="mobile-wrapper">
              <FieldManualButton
                manualId="working-with-duck"
                label="Manual Mobile"
                onOpenChange={onOpenMobile}
                isHotkeyOwner={true}
              />
            </div>
          </div>
        </StrictMode>
      );
    }

    await act(async () => {
      root.render(<AllHiddenSetup />);
    });

    const desktopBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="desktop-wrapper"] button'
    )!;
    const mobileBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="mobile-wrapper"] button'
    )!;

    // Both controls hidden (e.g. game in hidden drawer/tab)
    desktopBtn.checkVisibility = () => false;
    mobileBtn.checkVisibility = () => false;

    // Press 'h' shortcut
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "h", bubbles: true })
      );
    });

    // Zero dialogs opened, neither callback invoked!
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(0);
    expect(onOpenDesktop).not.toHaveBeenCalled();
    expect(onOpenMobile).not.toHaveBeenCalled();
  });

  // #1669: a game's playfield names its manual, so ? from the focused board
  // opens it, even with the trigger outside the boundary and hidden in a
  // collapsed settings panel.
  it("opens the manual a keyboard boundary names, even when its trigger is hidden", async () => {
    const onOpenChange = vi.fn();
    await act(async () => {
      root.render(
        <div>
          <div data-testid="settings">
            <FieldManualButton
              manualId="retro-labyrinth"
              onOpenChange={onOpenChange}
            />
          </div>
          <div
            data-keyboard-boundary="true"
            data-field-manual="retro-labyrinth"
            data-testid="board"
            tabIndex={0}
          />
          <div data-keyboard-boundary="true" data-testid="other" tabIndex={0} />
        </div>
      );
    });
    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-testid="settings"] button'
    )!;
    trigger.checkVisibility = () => false;

    const other = container.querySelector<HTMLElement>(
      '[data-testid="other"]'
    )!;
    await act(async () => {
      other.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", bubbles: true })
      );
    });
    expect(onOpenChange).not.toHaveBeenCalled();

    const board = container.querySelector<HTMLElement>(
      '[data-testid="board"]'
    )!;
    await act(async () => {
      board.dispatchEvent(
        new KeyboardEvent("keydown", { key: "?", bubbles: true })
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });
});
