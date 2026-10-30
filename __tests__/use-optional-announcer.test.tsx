import { describe, it, expect, afterEach, vi } from "vitest";
import React, { useRef } from "react";
import { render, renderHook, act, cleanup } from "@testing-library/react";
import {
  useOptionalAnnouncer,
  LiveAnnouncerProvider,
  LiveAnnouncer,
} from "@/hooks/useAnnouncer";
import { useWebGLContextLoss } from "@/hooks/useWebGLContextLoss";

function WebGLHarness({
  onLost,
  onRestored,
}: {
  onLost?: () => void;
  onRestored?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { status } = useWebGLContextLoss({
    canvasRef,
    label: "3D Viewport",
    onContextLost: onLost,
    onContextRestored: onRestored,
  });

  return (
    <div>
      <canvas ref={canvasRef} data-testid="webgl-canvas" />
      <span data-testid="webgl-status">{status}</span>
    </div>
  );
}

describe("useOptionalAnnouncer", () => {
  afterEach(() => {
    cleanup();
  });

  it("returns null when called outside of an A11yProvider", () => {
    const { result } = renderHook(() => useOptionalAnnouncer());
    expect(result.current).toBeNull();
  });

  it("returns the announcer context and dispatches messages when called inside an A11yProvider", () => {
    const customAnnouncer = new LiveAnnouncer();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LiveAnnouncerProvider announcer={customAnnouncer}>
        {children}
      </LiveAnnouncerProvider>
    );

    const { result } = renderHook(() => useOptionalAnnouncer(), { wrapper });
    expect(result.current).not.toBeNull();
    expect(result.current?.announce).toBeTypeOf("function");

    act(() => {
      result.current?.announce("Graphics context restored.", "polite");
    });

    const politeRegion = document.querySelector('[aria-live="polite"]');
    expect(politeRegion?.textContent).toBe("Graphics context restored.");
    customAnnouncer.destroy();
  });

  it("allows useWebGLContextLoss to handle context loss and restoration outside an A11yProvider", () => {
    const onLost = vi.fn();
    const onRestored = vi.fn();

    const { getByTestId } = render(
      <WebGLHarness onLost={onLost} onRestored={onRestored} />
    );

    const canvas = getByTestId("webgl-canvas");
    expect(getByTestId("webgl-status").textContent).toBe("idle");

    act(() => {
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    });
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(getByTestId("webgl-status").textContent).toBe("lost");

    act(() => {
      canvas.dispatchEvent(
        new Event("webglcontextrestored", { cancelable: true })
      );
    });
    expect(onRestored).toHaveBeenCalledTimes(1);
    expect(getByTestId("webgl-status").textContent).toBe("restored");
  });
});
