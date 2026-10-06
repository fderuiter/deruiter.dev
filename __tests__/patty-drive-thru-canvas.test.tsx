import React, { useEffect } from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { createBoothStore } from "@/components/patty-drive-thru/store";

const gl = vi.hoisted(() => ({ canvas: null as HTMLCanvasElement | null }));

// The canvas stands in for React Three Fiber's, which needs WebGL.
vi.mock("@react-three/fiber", () => ({
  Canvas: ({
    onCreated,
    children,
  }: {
    onCreated: (state: { gl: { domElement: HTMLCanvasElement } }) => void;
    children: React.ReactNode;
  }) => {
    useEffect(() => {
      const canvas = document.createElement("canvas");
      gl.canvas = canvas;
      onCreated({ gl: { domElement: canvas } });
    }, [onCreated]);
    return <div data-testid="canvas">{children}</div>;
  },
}));

vi.mock("@/components/patty-drive-thru/BoothWorld", () => ({
  BOOTH_CAMERA: {},
  BoothWorld: () => null,
}));

import BoothScene from "@/components/patty-drive-thru/BoothScene";

function loseContext(): Event {
  const event = new Event("webglcontextlost", { cancelable: true });
  gl.canvas?.dispatchEvent(event);
  return event;
}

describe("Patty's Drive-Thru booth canvas (#1813)", () => {
  it("reports a WebGL context lost while the booth is on screen", () => {
    const onContextLost = vi.fn();
    render(
      <BoothScene
        store={createBoothStore()}
        onOpenRegister={vi.fn()}
        onContextLost={onContextLost}
      />
    );
    const event = loseContext();
    expect(event.defaultPrevented).toBe(true);
    expect(onContextLost).toHaveBeenCalledTimes(1);
  });

  it("calls the latest handler after a re-render", () => {
    const first = vi.fn();
    const second = vi.fn();
    const store = createBoothStore();
    const { rerender } = render(
      <BoothScene
        store={store}
        onOpenRegister={vi.fn()}
        onContextLost={first}
      />
    );
    rerender(
      <BoothScene
        store={store}
        onOpenRegister={vi.fn()}
        onContextLost={second}
      />
    );
    loseContext();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("ignores the context release that follows its own unmount", () => {
    const onContextLost = vi.fn();
    const { unmount } = render(
      <BoothScene
        store={createBoothStore()}
        onOpenRegister={vi.fn()}
        onContextLost={onContextLost}
      />
    );
    unmount();
    loseContext();
    expect(onContextLost).not.toHaveBeenCalled();
  });
});
