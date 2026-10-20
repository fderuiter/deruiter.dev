// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ArcadeInputManager, ArcadeViewport } from "@/lib/arcade";
import { fromPartial } from "@total-typescript/shoehorn";

describe("ArcadeInputManager", () => {
  let inputManager: ArcadeInputManager;
  let viewport: ArcadeViewport;
  let mockCanvas: HTMLCanvasElement;

  beforeEach(() => {
    inputManager = new ArcadeInputManager();
    viewport = new ArcadeViewport({
      mode: "safe-zone",
      baseWidth: 800,
      baseHeight: 500,
    });

    mockCanvas = fromPartial<HTMLCanvasElement>({
      getBoundingClientRect: () =>
        fromPartial<DOMRect>({
          left: 0,
          top: 0,
          width: 800,
          height: 500,
          right: 800,
          bottom: 500,
          x: 0,
          y: 0,
          toJSON: () => {},
        }),
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: vi.fn().mockReturnValue(false),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    inputManager.detach();
  });

  it("initializes with zeroed input state", () => {
    const snapshot = inputManager.getSnapshot();
    expect(snapshot.moveX).toBe(0);
    expect(snapshot.moveY).toBe(0);
    expect(snapshot.actionA).toBe(false);
    expect(snapshot.actionB).toBe(false);
    expect(snapshot.primaryPointer.isDown).toBe(false);
  });

  it("updates keyboard moveX and moveY on WASD and Arrow key events", () => {
    inputManager.handleKeyDown("ArrowRight");
    expect(inputManager.getSnapshot().moveX).toBe(1);

    inputManager.handleKeyDown("KeyW");
    expect(inputManager.getSnapshot().moveY).toBe(-1);

    inputManager.handleKeyUp("ArrowRight");
    expect(inputManager.getSnapshot().moveX).toBe(0);

    inputManager.handleKeyUp("KeyW");
    expect(inputManager.getSnapshot().moveY).toBe(0);
  });

  it("maps action keys (Space, Enter, KeyJ, KeyK) to actionA and actionB", () => {
    inputManager.handleKeyDown("Space");
    expect(inputManager.getSnapshot().actionA).toBe(true);

    inputManager.handleKeyDown("KeyK");
    expect(inputManager.getSnapshot().actionB).toBe(true);

    inputManager.handleKeyUp("Space");
    expect(inputManager.getSnapshot().actionA).toBe(false);

    inputManager.handleKeyUp("KeyK");
    expect(inputManager.getSnapshot().actionB).toBe(false);
  });

  it("translates pointer events into game coordinates and updates primaryPointer", () => {
    const metrics = viewport.calculateMetrics(800, 500, 1.0);
    inputManager.attach(mockCanvas, () => metrics);

    inputManager.handlePointerDown(
      fromPartial<PointerEvent>({
        clientX: 400,
        clientY: 250,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
      })
    );

    const snapshot = inputManager.getSnapshot();
    expect(snapshot.primaryPointer.isDown).toBe(true);
    expect(snapshot.aimX).toBeCloseTo(400, 1);
    expect(snapshot.aimY).toBeCloseTo(250, 1);
    expect(snapshot.actionA).toBe(true); // primary click triggers actionA

    inputManager.handlePointerUp(
      fromPartial<PointerEvent>({
        clientX: 400,
        clientY: 250,
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
      })
    );

    expect(inputManager.getSnapshot().primaryPointer.isDown).toBe(false);
  });

  it("bridges virtual dock direction and action presses seamlessly", () => {
    inputManager.setVirtualDirection("left", true);
    expect(inputManager.getSnapshot().moveX).toBe(-1);

    inputManager.setVirtualDirection("left", false);
    expect(inputManager.getSnapshot().moveX).toBe(0);

    inputManager.setVirtualAction("actionA", true);
    expect(inputManager.getSnapshot().actionA).toBe(true);

    inputManager.setVirtualStick(0.75, -0.5);
    expect(inputManager.getSnapshot().moveX).toBeCloseTo(0.75, 2);
    expect(inputManager.getSnapshot().moveY).toBeCloseTo(-0.5, 2);
  });

  it("clears all active keys and pointers on blur or reset", () => {
    inputManager.handleKeyDown("KeyA");
    inputManager.handleKeyDown("Space");
    expect(inputManager.getSnapshot().moveX).toBe(-1);

    inputManager.reset();
    const snapshot = inputManager.getSnapshot();
    expect(snapshot.moveX).toBe(0);
    expect(snapshot.moveY).toBe(0);
    expect(snapshot.actionA).toBe(false);
  });
});
