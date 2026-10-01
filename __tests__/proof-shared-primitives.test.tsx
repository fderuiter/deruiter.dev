// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ProofWorkspaceClient } from "@/app/proof/ProofWorkspaceClient";
import { ToastProvider } from "@/hooks/useToast";
import {
  A11yProvider,
  LiveAnnouncer,
} from "@/components/providers/A11yProvider";

/**
 * Issue #1589 (Proof items): the Proof workspace derives its startup state
 * from useStudioHashParams, binds its shortcuts through useHotkeys and shows
 * feedback in the shared ToastProvider, with behaviour unchanged.
 */

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playSuccess: vi.fn(),
    playAutocomplete: vi.fn(),
    playHover: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: React.ReactNode }) => children,
}));

function setHash(hash: string) {
  window.history.replaceState(null, "", `/proof${hash ? `#${hash}` : ""}`);
}

/** Simulates the browser restoring a history entry with the given hash. */
function navigateHistory(hash: string) {
  act(() => {
    setHash(hash);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

/** Dispatches a keydown on the target and returns the event for inspection. */
function press(
  key: string,
  init: KeyboardEventInit = {},
  target: Element = document.body
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function catalogCard(title: string): HTMLButtonElement {
  return within(screen.getByTestId("proof-catalog"))
    .getByText(title)
    .closest("button") as HTMLButtonElement;
}

const isActiveTheorem = (title: string) =>
  catalogCard(title).className.includes("border-brand-cyan");

function ledgerTab(label: "Ledger" | "Systems" | "Fallacy") {
  return screen.getByText(label, { selector: "button" });
}

const isActiveTab = (label: "Ledger" | "Systems" | "Fallacy") =>
  ledgerTab(label).className.includes("text-brand-cyan");

function snappingEnabled(): boolean {
  return (
    screen
      .getByRole("button", { name: /^Magnetic Snapping:/ })
      .getAttribute("aria-pressed") === "true"
  );
}

function consoleInput(): HTMLInputElement | null {
  return screen.queryByPlaceholderText(/Enter logic command/i);
}

beforeEach(() => {
  setHash("");
  vi.stubGlobal(
    "Worker",
    class {
      postMessage = vi.fn();
      terminate = vi.fn();
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
    }
  );
});

afterEach(() => {
  cleanup();
  setHash("");
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Proof hash-derived startup state", () => {
  it("opens a deep-linked theorem and tab", () => {
    setHash("theorem=modus-tollens&tab=systems");
    render(<ProofWorkspaceClient />);
    expect(isActiveTheorem("Modus Tollens")).toBe(true);
    expect(isActiveTheorem("Modus Ponens")).toBe(false);
    expect(isActiveTab("Systems")).toBe(true);
  });

  it("falls back to Modus Ponens and the ledger for unknown values", () => {
    setHash("theorem=constructor&tab=nope");
    render(<ProofWorkspaceClient />);
    expect(isActiveTheorem("Modus Ponens")).toBe(true);
    expect(isActiveTab("Ledger")).toBe(true);
  });

  it("writes in-app changes to the hash in the same format and follows Back/Forward", () => {
    render(<ProofWorkspaceClient />);
    fireEvent.click(catalogCard("Modus Tollens"));
    expect(window.location.hash).toBe("#theorem=modus-tollens");
    expect(isActiveTheorem("Modus Tollens")).toBe(true);

    fireEvent.click(ledgerTab("Systems"));
    expect(window.location.hash).toBe("#theorem=modus-tollens&tab=systems");
    expect(isActiveTab("Systems")).toBe(true);

    fireEvent.click(ledgerTab("Ledger"));
    expect(window.location.hash).toBe("#theorem=modus-tollens");

    navigateHistory("");
    expect(isActiveTheorem("Modus Ponens")).toBe(true);

    navigateHistory("theorem=modus-tollens&tab=fallacy");
    expect(isActiveTheorem("Modus Tollens")).toBe(true);
    expect(isActiveTab("Fallacy")).toBe(true);
  });

  it("resets the workspace edges when Back/Forward changes the theorem", () => {
    render(<ProofWorkspaceClient />);
    const input = consoleInput() as HTMLInputElement;
    for (const command of ["connect C E", "connect D E"]) {
      fireEvent.change(input, { target: { value: command } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    }
    expect(
      screen.getByRole("button", { name: /^Node E, R, conclusion, proven/ })
    ).toBeTruthy();

    navigateHistory("theorem=modus-tollens");
    navigateHistory("");
    expect(
      screen.queryByRole("button", { name: /^Node E, R, conclusion, proven/ })
    ).toBeNull();
  });

  it("loads a shared custom proof and opens the studio when the link has no formulas", () => {
    setHash(
      `theorem=custom&custom=${encodeURIComponent(JSON.stringify(["A", "A -> B", "B -> C", "C"]))}`
    );
    const { unmount } = render(<ProofWorkspaceClient />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getAllByText("A -> B").length).toBeGreaterThan(0);
    unmount();

    setHash("theorem=custom");
    render(<ProofWorkspaceClient />);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("hydrates a deep link without a server/client markup mismatch", async () => {
    const { renderToString } = await import("react-dom/server");
    const { hydrateRoot } = await import("react-dom/client");

    // The server never sees the hash: render the SSR markup without one.
    setHash("");
    const html = renderToString(<ProofWorkspaceClient />);

    setHash("theorem=modus-tollens&tab=systems");
    const host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const recoverable = vi.fn();

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(host, <ProofWorkspaceClient />, {
        onRecoverableError: recoverable,
      });
    });

    expect(recoverable).not.toHaveBeenCalled();
    expect(
      errorSpy.mock.calls.filter((args) =>
        String(args[0]).toLowerCase().includes("hydrat")
      )
    ).toEqual([]);

    // After hydration the client snapshot applies the deep link.
    await waitFor(() => {
      const card = within(
        host.querySelector('[data-testid="proof-catalog"]') as HTMLElement
      )
        .getByText("Modus Tollens")
        .closest("button");
      expect(card?.className).toContain("border-brand-cyan");
    });

    act(() => root?.unmount());
    host.remove();
  });
});

describe("Proof hotkeys through useHotkeys", () => {
  it("toggles snapping on G and Shift+G with every Ctrl/Alt/Meta combination", () => {
    render(<ProofWorkspaceClient />);
    expect(snappingEnabled()).toBe(true);

    const combos: KeyboardEventInit[] = [
      {},
      { shiftKey: true },
      { ctrlKey: true },
      { altKey: true },
      { metaKey: true },
      { ctrlKey: true, altKey: true },
      { ctrlKey: true, metaKey: true },
      { altKey: true, metaKey: true },
      { ctrlKey: true, altKey: true, metaKey: true },
    ];
    let expected = true;
    for (const init of combos) {
      const event = press(init.shiftKey ? "G" : "g", init);
      expected = !expected;
      expect(event.defaultPrevented).toBe(true);
      expect(snappingEnabled()).toBe(expected);
    }
  });

  it("ignores G while typing and inside the terminal keyboard boundary", () => {
    render(<ProofWorkspaceClient />);
    const input = consoleInput() as HTMLInputElement;
    const typed = press("g", {}, input);
    expect(typed.defaultPrevented).toBe(false);
    expect(snappingEnabled()).toBe(true);

    const toggle = screen.getByRole("button", { name: "Collapse" });
    const inBoundary = press("g", {}, toggle);
    expect(inBoundary.defaultPrevented).toBe(false);
    expect(snappingEnabled()).toBe(true);
  });

  it("focuses the terminal on Ctrl+` and Ctrl+\\, and closes it from the input", () => {
    render(<ProofWorkspaceClient />);
    const input = consoleInput() as HTMLInputElement;
    expect(document.activeElement).not.toBe(input);

    const focusEvent = press("`", { ctrlKey: true });
    expect(focusEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);

    // From inside the input (and the terminal boundary) it closes the console.
    const closeEvent = press("\\", { ctrlKey: true }, input);
    expect(closeEvent.defaultPrevented).toBe(true);
    expect(consoleInput()).toBeNull();

    // With Alt and Meta held it still opens the console.
    press("`", { ctrlKey: true, altKey: true, metaKey: true });
    expect(consoleInput()).not.toBeNull();
  });

  it("does not treat a bare backquote or backslash as the console shortcut", () => {
    render(<ProofWorkspaceClient />);
    const event = press("`");
    expect(event.defaultPrevented).toBe(false);
    expect(consoleInput()).not.toBeNull();
    expect(document.activeElement).not.toBe(consoleInput());
  });
});

describe("Proof toasts through the shared ToastProvider", () => {
  function renderWithProviders() {
    const announcer = new LiveAnnouncer({ expirationMs: 60_000 });
    const announceSpy = vi.spyOn(announcer, "announce");
    render(
      <A11yProvider announcer={announcer}>
        <ToastProvider>
          <ProofWorkspaceClient />
        </ToastProvider>
      </A11yProvider>
    );
    return announceSpy;
  }

  it("shows a toast whose message the workspace already speaks without speaking it again", async () => {
    const announceSpy = renderWithProviders();
    press("g");

    const viewport = screen.getByTestId("toast-viewport");
    expect(
      within(viewport).getByText("Magnetic Snapping disabled (freeform drag)")
    ).toBeTruthy();
    expect(
      announceSpy.mock.calls.filter(([message]) =>
        String(message).includes("Magnetic Snapping disabled")
      )
    ).toEqual([]);
    // The workspace's own live region speaks it once.
    await waitFor(() =>
      expect(screen.getByText("Magnetic snapping disabled.")).toBeTruthy()
    );
    expect(screen.getAllByText("Magnetic snapping disabled.")).toHaveLength(1);
  });

  it("displays inline counterexample badge on target canvas node when an invalid connection is drawn", () => {
    render(
      <ToastProvider>
        <ProofWorkspaceClient />
      </ToastProvider>
    );
    const input = consoleInput() as HTMLInputElement;
    // Drawing an invalid connection C -> A triggers Affirming the Consequent fallacy
    fireEvent.change(input, { target: { value: "connect C A" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    const badge = screen.getByRole("button", {
      name: /Counterexample badge for Node A/i,
    });
    expect(badge).toBeTruthy();

    // Click badge to toggle popover showing variable assignments and sub-expressions
    fireEvent.click(badge);

    expect(
      screen.getByRole("dialog", {
        name: /Counterexample diagnostics popover for Node A/i,
      })
    ).toBeTruthy();
    expect(
      screen.getAllByText(/Fallacy of Affirming the Consequent/i).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/P = FALSE/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Q = TRUE/i).length).toBeGreaterThan(0);
  });

  it("announces a toast exactly once when nothing else speaks it", () => {
    const announceSpy = renderWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /Auto-Step/ }));

    const viewport = screen.getByTestId("toast-viewport");
    const message = within(viewport).getByText(
      /^Auto-Step: Connected/
    ).textContent;
    expect(
      announceSpy.mock.calls.filter(([spoken]) => spoken === message)
    ).toHaveLength(1);
  });
});
