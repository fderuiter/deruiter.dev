// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  act,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";
import { NeuroReconClient } from "@/components/neuro/NeuroReconClient";
import { ToastProvider } from "@/hooks/useToast";
import {
  A11yProvider,
  LiveAnnouncer,
} from "@/components/providers/A11yProvider";

/**
 * Issue #1442: the Neuro share-link toast is drawn by the shared
 * ToastProvider, and its message is spoken once (by useClipboard), not twice.
 */

const COPY_MESSAGE =
  "Link copied: case, view and tool only. Your edits are not included.";

const copyToClipboard = vi.fn(async (_text: string) => {});

vi.mock("@/lib/clipboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/clipboard")>();
  return {
    ...actual,
    copyToClipboard: (text: string) => copyToClipboard(text),
  };
});

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn(),
  }),
}));

// Exit animations keep removed nodes mounted; render plain list items so the
// toast's dismissal is observable synchronously.
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
    // motion is a component factory proxy; keep every other element intact.
    motion: new Proxy(actual.motion, {
      get: (target, key, receiver) =>
        key === "li" ? MotionLi : Reflect.get(target, key, receiver),
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

describe("NeuroRecon share-link toast (#1442)", () => {
  beforeEach(() => {
    copyToClipboard.mockClear();
    const context2D = new Proxy(
      {
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(4 * w * h),
          width: w,
          height: h,
        }),
        createImageData: (w: number, h: number) => ({
          data: new Uint8ClampedArray(4 * w * h),
          width: w,
          height: h,
        }),
        measureText: (text: string) => ({ width: (text || "").length * 8 }),
      } as Record<string | symbol, unknown>,
      {
        get: (target, key) => (key in target ? target[key] : () => {}),
        set: () => true,
      }
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((
      contextId: string
    ) =>
      contextId === "2d"
        ? context2D
        : null) as unknown as HTMLCanvasElement["getContext"]);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows the copy confirmation in the shared toast stack and announces it once", async () => {
    const announcer = new LiveAnnouncer({ expirationMs: 60_000 });
    const announceSpy = vi.spyOn(announcer, "announce");

    render(
      <A11yProvider announcer={announcer}>
        <ToastProvider>
          <NeuroReconClient />
        </ToastProvider>
      </A11yProvider>
    );

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Share/ }));
    });

    expect(copyToClipboard).toHaveBeenCalledWith(window.location.href);

    const viewport = screen.getByTestId("toast-viewport");
    expect(within(viewport).getByText(COPY_MESSAGE)).toBeDefined();

    const spoken = announceSpy.mock.calls.filter(
      ([message]) => message === COPY_MESSAGE
    );
    expect(spoken).toHaveLength(1);

    // Same 3.5s lifetime as the studio's former ad-hoc toast.
    act(() => {
      vi.advanceTimersByTime(3499);
    });
    expect(within(viewport).queryByText(COPY_MESSAGE)).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(
      within(screen.getByTestId("toast-viewport")).queryByText(COPY_MESSAGE)
    ).toBeNull();
  });
});
