import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  act,
  cleanup,
  fireEvent,
  renderHook,
  within,
} from "@testing-library/react";
import { ToastProvider, useToast, type ToastApi } from "@/hooks/useToast";
import {
  A11yProvider,
  LiveAnnouncer,
} from "@/components/providers/A11yProvider";

// Exit animations keep removed nodes mounted; render plain list items so
// dismissal is observable synchronously.
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  const MotionLi = ({
    children,
    initial: _initial,
    animate: _animate,
    exit: _exit,
    transition: _transition,
    layout: _layout,
    ...rest
  }: React.LiHTMLAttributes<HTMLLIElement> & Record<string, unknown>) => (
    <li {...(rest as React.LiHTMLAttributes<HTMLLIElement>)}>
      {children as React.ReactNode}
    </li>
  );
  return {
    ...actual,
    motion: { ...actual.motion, li: MotionLi },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    useReducedMotion: () => false,
  };
});

function Harness({ onReady }: { onReady: (api: ToastApi) => void }) {
  const toast = useToast();
  onReady(toast);
  return null;
}

/** Scopes text queries to the visual stack; the live region repeats the text. */
function inViewport() {
  return within(screen.getByTestId("toast-viewport"));
}

function setup(maxVisible?: number) {
  const announcer = new LiveAnnouncer({ expirationMs: 60_000 });
  const announceSpy = vi.spyOn(announcer, "announce");
  let api: ToastApi | null = null;
  const utils = render(
    <A11yProvider announcer={announcer}>
      <ToastProvider maxVisible={maxVisible}>
        <Harness onReady={(a) => (api = a)} />
      </ToastProvider>
    </A11yProvider>
  );
  const getApi = (): ToastApi => {
    if (!api) throw new Error("toast api not ready");
    return api;
  };
  return { ...utils, announceSpy, getApi };
}

describe("ToastProvider & useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders an enqueued toast with its variant and description", () => {
    const { getApi } = setup();
    act(() => {
      getApi().success("Link copied", { description: "Share it anywhere" });
    });
    const toast = screen.getByTestId("toast");
    expect(toast.getAttribute("data-variant")).toBe("success");
    expect(toast.textContent).toContain("Link copied");
    expect(toast.textContent).toContain("Share it anywhere");
  });

  it("announces once through the LiveAnnouncer and adds no competing live region", () => {
    const { getApi, announceSpy, container } = setup();
    act(() => {
      getApi().info("Workspace reset");
      getApi().error("Invalid connection", { description: "Cycle detected" });
    });
    expect(announceSpy).toHaveBeenCalledTimes(2);
    expect(announceSpy).toHaveBeenNthCalledWith(1, "Workspace reset", "polite");
    expect(announceSpy).toHaveBeenNthCalledWith(
      2,
      "Invalid connection. Cycle detected",
      "assertive"
    );

    const viewport = screen.getByTestId("toast-viewport");
    expect(viewport.querySelector("[aria-live]")).toBeNull();
    expect(
      viewport.querySelector('[role="status"], [role="alert"]')
    ).toBeNull();
    // Only the A11yProvider's polite and assertive regions exist.
    expect(container.querySelectorAll("[aria-live]")).toHaveLength(2);
  });

  it("auto-dismisses after the default duration, with errors lingering longer", () => {
    const { getApi } = setup();
    act(() => {
      getApi().info("Short lived");
      getApi().error("Long lived");
    });
    expect(screen.getAllByTestId("toast")).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(inViewport().queryByText("Short lived")).toBeNull();
    expect(inViewport().getByText("Long lived")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryAllByTestId("toast")).toHaveLength(0);
  });

  it("caps the stack at maxVisible, evicting the oldest first", () => {
    const { getApi } = setup(3);
    act(() => {
      getApi().info("one");
      getApi().info("two");
      getApi().info("three");
      getApi().info("four");
    });
    const messages = screen
      .getAllByTestId("toast")
      .map((n) => n.textContent ?? "");
    expect(messages).toHaveLength(3);
    expect(messages.join("|")).not.toMatch(/one/);
    expect(messages.at(-1)).toContain("four");

    // The evicted toast's timer is cleared, so the remaining three expire together.
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryAllByTestId("toast")).toHaveLength(0);
  });

  it("keeps persistent toasts and dismisses via dismiss(id) and the close button", () => {
    const { getApi } = setup();
    let firstId = "";
    act(() => {
      firstId = getApi().warning("First", { duration: Infinity });
      getApi().info("Second", { duration: 0 });
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getAllByTestId("toast")).toHaveLength(2);

    act(() => {
      getApi().dismiss(firstId);
    });
    expect(inViewport().queryByText("First")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss notification" })
    );
    expect(screen.queryAllByTestId("toast")).toHaveLength(0);
  });

  it("dismiss() with no id clears the whole stack", () => {
    const { getApi } = setup();
    act(() => {
      getApi().info("a");
      getApi().info("b");
    });
    act(() => {
      getApi().dismiss();
    });
    expect(screen.queryAllByTestId("toast")).toHaveLength(0);
  });

  it("pauses auto-dismiss while hovered and resumes with the remaining time", () => {
    const { getApi, announceSpy } = setup();
    act(() => {
      getApi().success("Hover me");
    });
    const viewport = screen.getByTestId("toast-viewport");
    act(() => {
      vi.advanceTimersByTime(3000);
      fireEvent.mouseEnter(viewport);
      vi.advanceTimersByTime(10_000);
    });
    expect(inViewport().getByText("Hover me")).toBeTruthy();
    expect(announceSpy).toHaveBeenCalledTimes(1);

    act(() => {
      fireEvent.mouseLeave(viewport);
      vi.advanceTimersByTime(999);
    });
    expect(inViewport().getByText("Hover me")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(inViewport().queryByText("Hover me")).toBeNull();
  });

  it("does not stay paused after the hovered stack empties", () => {
    const { getApi } = setup();
    act(() => {
      getApi().info("Under pointer");
    });
    fireEvent.mouseEnter(screen.getByTestId("toast-viewport"));
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss notification" })
    );
    act(() => {
      getApi().info("Next one");
      vi.advanceTimersByTime(4000);
    });
    expect(inViewport().queryByText("Next one")).toBeNull();
  });

  it("clears pending timers on unmount without state-update warnings", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getApi, unmount } = setup();
    act(() => {
      getApi().info("Leaving");
    });
    const pendingBefore = vi.getTimerCount();
    unmount();
    // The toast's auto-dismiss timer is cancelled during teardown.
    expect(vi.getTimerCount()).toBeLessThan(pendingBefore);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("falls back to announcing only when no provider is mounted", () => {
    const { result } = renderHook(() => useToast());
    const id = result.current.success("Standalone");
    expect(id).toMatch(/^toast-/);
    expect(() => result.current.dismiss(id)).not.toThrow();
    expect(document.querySelector('[data-testid="toast"]')).toBeNull();
  });

  it("returns a referentially stable API across renders", () => {
    const seen = new Set<ToastApi>();
    const announcer = new LiveAnnouncer();
    const tree = (
      <A11yProvider announcer={announcer}>
        <ToastProvider>
          <Harness onReady={(a) => seen.add(a)} />
        </ToastProvider>
      </A11yProvider>
    );
    const { rerender } = render(tree);
    rerender(tree);
    expect(seen.size).toBe(1);
  });
});
