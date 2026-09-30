// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import * as THREE from "three";
import { Brain3DViewer } from "@/components/neuro/Brain3DViewer";

/**
 * Brain3DViewer's render loop, now on useAnimationFrame (#1578). three.js is
 * mocked down to a renderer that records calls, and frames run only when the
 * test ticks them, so no WebGL context or free-running loop exists in JSDOM.
 */

class MockWebGLRenderer {
  domElement = document.createElement("canvas");
  setSize = vi.fn();
  setPixelRatio = vi.fn();
  render = vi.fn();
  dispose = vi.fn();
}

const renderers: MockWebGLRenderer[] = [];

vi.mock("@/lib/neuro/engine-loader", () => {
  const fakeThree = {
    ...THREE,
    WebGLRenderer: function MockRendererCtor() {
      const renderer = new MockWebGLRenderer();
      renderers.push(renderer);
      return renderer;
    },
  };
  return {
    loadGraphicsEngine: vi.fn(async () => fakeThree),
    createMeshGroupFromBuffers: vi.fn(() => new THREE.Group()),
  };
});

vi.mock("@/lib/neuro/mesh-generator", () => ({
  createCorticalSurfaceMeshBuffersAsync: vi.fn(async () => ({})),
  getAnatomicalParcelAtCoordinate: vi.fn(() => null),
}));

vi.mock("@/lib/neuro/asset-loader", () => ({
  loadExternalBrainBuffers: vi.fn(() => new Promise(() => {})),
}));

vi.mock("@/components/neuro/ProgressHUD", () => ({
  ProgressHUD: () => null,
}));

/** Frames run only on `tick(timestamp)`, so the loop is fully test-driven. */
function installFrameScheduler() {
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((cb: FrameRequestCallback) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    })
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => {
      pending.delete(id);
    })
  );
  return {
    pendingCount: () => pending.size,
    tick(timestamp: number) {
      const batch = [...pending.values()];
      pending.clear();
      act(() => {
        for (const cb of batch) cb(timestamp);
      });
    },
  };
}

let intersectionCallbacks: ((entries: IntersectionObserverEntry[]) => void)[];

function setIntersecting(isIntersecting: boolean) {
  act(() => {
    for (const cb of intersectionCallbacks) {
      cb([{ isIntersecting } as IntersectionObserverEntry]);
    }
  });
}

async function flushAsync() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

async function mountViewer() {
  const view = render(
    <Brain3DViewer surfaceMode="white" crosshair={{ x: 48, y: 48, z: 48 }} />
  );
  await flushAsync();
  // Entering the viewport also triggers the mesh load that fills the scene.
  setIntersecting(true);
  await flushAsync();
  return view;
}

describe("Brain3DViewer render loop on useAnimationFrame", () => {
  let frames: ReturnType<typeof installFrameScheduler>;

  beforeEach(() => {
    renderers.length = 0;
    intersectionCallbacks = [];
    frames = installFrameScheduler();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: (entries: IntersectionObserverEntry[]) => void) {
          intersectionCallbacks.push(cb);
        }
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
        takeRecords = vi.fn(() => []);
      }
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("starts one loop once the renderer exists and renders on every frame", async () => {
    await mountViewer();

    expect(renderers).toHaveLength(1);
    const renderer = renderers[0];
    expect(frames.pendingCount()).toBe(1);

    const before = renderer.render.mock.calls.length;
    frames.tick(1000);
    frames.tick(1016);
    frames.tick(1033);

    expect(renderer.render.mock.calls.length - before).toBe(3);
    expect(frames.pendingCount()).toBe(1);
  });

  it("advances the rotation per frame, so neither the first frame's zero delta nor a long gap changes a step", async () => {
    await mountViewer();
    const renderer = renderers[0];

    // The mesh group is added to the scene the renderer draws.
    frames.tick(1000);
    const scene = renderer.render.mock.calls.at(-1)?.[0] as THREE.Scene;
    const group = scene.children.find((c) => c instanceof THREE.Group);
    expect(group).toBeDefined();
    const y0 = group!.rotation.y;

    frames.tick(1016); // ordinary 16 ms frame
    const y1 = group!.rotation.y;
    frames.tick(61016); // a minute away: never clamped, never scaled
    const y2 = group!.rotation.y;

    expect(y1 - y0).toBeCloseTo(0.004, 10);
    expect(y2 - y1).toBeCloseTo(0.004, 10);
  });

  it("skips drawing while offscreen without cancelling the loop", async () => {
    await mountViewer();
    const renderer = renderers[0];

    setIntersecting(false);
    const before = renderer.render.mock.calls.length;
    frames.tick(1000);
    frames.tick(1016);
    expect(renderer.render.mock.calls.length).toBe(before);
    expect(frames.pendingCount()).toBe(1);

    setIntersecting(true);
    frames.tick(1033);
    expect(renderer.render.mock.calls.length).toBe(before + 1);
  });

  it("stops the loop and disposes the renderer on unmount", async () => {
    const { unmount } = await mountViewer();
    const renderer = renderers[0];
    frames.tick(1000);

    unmount();

    expect(frames.pendingCount()).toBe(0);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    const calls = renderer.render.mock.calls.length;
    frames.tick(1016);
    expect(renderer.render.mock.calls.length).toBe(calls);
  });

  it("restarts the loop on a fresh renderer after a WebGL context restore", async () => {
    await mountViewer();
    const first = renderers[0];
    frames.tick(1000);

    act(() => {
      first.domElement.dispatchEvent(
        new Event("webglcontextlost", { cancelable: true })
      );
    });
    // Frames keep coming while the context is lost, but draw nothing.
    const lostCalls = first.render.mock.calls.length;
    frames.tick(1016);
    expect(first.render.mock.calls.length).toBe(lostCalls);
    expect(frames.pendingCount()).toBe(1);

    act(() => {
      first.domElement.dispatchEvent(
        new Event("webglcontextrestored", { cancelable: true })
      );
    });
    await flushAsync();

    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(renderers).toHaveLength(2);
    const second = renderers[1];
    // Exactly one loop survives the restart.
    expect(frames.pendingCount()).toBe(1);

    const firstCalls = first.render.mock.calls.length;
    const secondCalls = second.render.mock.calls.length;
    frames.tick(1033);
    expect(first.render.mock.calls.length).toBe(firstCalls);
    expect(second.render.mock.calls.length).toBe(secondCalls + 1);
  });
});
