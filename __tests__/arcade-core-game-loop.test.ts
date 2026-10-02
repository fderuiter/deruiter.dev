// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ArcadeEngine, ArcadeGameLoop } from "@/lib/arcade";
import { fromPartial } from "@total-typescript/shoehorn";

// Mock implementation of ArcadeEngine for testing
class TestArcadeEngine extends ArcadeEngine<
  { count: number },
  { count: number }
> {
  public updateCalls: number[] = [];
  public renderCalls: { alpha: number }[] = [];
  public initCalled = false;
  public destroyCalled = false;
  public resizeCalled: { width: number; height: number; dpr: number } | null =
    null;

  constructor() {
    super({ count: 0 });
  }

  public override init(): void {
    this.initCalled = true;
  }

  public override update(dt: number): void {
    this.updateCalls.push(dt);
    this.state.count += 1;
    this.emit("tick", { count: this.state.count });
  }

  public override render(ctx: CanvasRenderingContext2D, alpha: number): void {
    this.renderCalls.push({ alpha });
  }

  public override destroy(): void {
    this.destroyCalled = true;
    super.destroy();
  }

  public override resize(width: number, height: number, dpr: number): void {
    this.resizeCalled = { width, height, dpr };
  }

  public override createSnapshot(): { count: number } {
    return { count: this.state.count };
  }
}

describe("ArcadeEngine & EventBus", () => {
  it("initializes state and provides snapshot", () => {
    const engine = new TestArcadeEngine();
    expect(engine.getSnapshot()).toEqual({ count: 0 });
  });

  it("subscribes and emits typed events through EventBus", () => {
    const engine = new TestArcadeEngine();
    const handler = vi.fn();

    const unsubscribe = engine.on("tick", handler);
    engine.update(1 / 60);

    expect(handler).toHaveBeenCalledWith({ count: 1 });

    unsubscribe();
    engine.update(1 / 60);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("notifies snapshot subscribers on state mutation", () => {
    const engine = new TestArcadeEngine();
    const subscriber = vi.fn();

    const unsubscribe = engine.subscribe(subscriber);
    engine.notifySubscribers();

    expect(subscriber).toHaveBeenCalledTimes(1);
    unsubscribe();
    engine.notifySubscribers();
    expect(subscriber).toHaveBeenCalledTimes(1);
  });
});

describe("ArcadeGameLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs fixed timestep updates and interpolates render passes", () => {
    const engine = new TestArcadeEngine();
    const mockCtx = fromPartial<CanvasRenderingContext2D>({});
    const loop = new ArcadeGameLoop(engine, () => mockCtx);

    loop.start();
    expect(engine.initCalled).toBe(true);

    // Simulate 2 fixed frames at 60Hz
    loop.tick((1000 / 60) * 2);

    // Should have stepped 2 times at dt = 1/60s (approx 0.016666s)
    expect(engine.updateCalls.length).toBe(2);
    expect(engine.updateCalls[0]).toBeCloseTo(1 / 60, 4);
    expect(engine.updateCalls[1]).toBeCloseTo(1 / 60, 4);
    expect(engine.renderCalls.length).toBe(1);

    loop.stop();
    expect(loop.isRunning()).toBe(false);
  });

  it("clamps accumulator to prevent spiral of death on huge time delta", () => {
    const engine = new TestArcadeEngine();
    const mockCtx = fromPartial<CanvasRenderingContext2D>({});
    const loop = new ArcadeGameLoop(engine, () => mockCtx, {
      maxAccumulatorSec: 0.1,
    }); // Max 6 frames

    loop.start();

    // Simulate tab switch: 5000ms delay
    loop.tick(5000);

    // Must be clamped to maxAccumulatorSec / fixedDt = 0.1 / (1/60) = 6 updates
    expect(engine.updateCalls.length).toBe(6);
    loop.stop();
  });

  it("supports pausing and resuming without accumulating phantom delta time", () => {
    const engine = new TestArcadeEngine();
    const mockCtx = fromPartial<CanvasRenderingContext2D>({});
    const loop = new ArcadeGameLoop(engine, () => mockCtx);

    loop.start();
    loop.pause();
    expect(loop.isPaused()).toBe(true);

    loop.tick(100);
    // When paused, update should not be called
    expect(engine.updateCalls.length).toBe(0);

    loop.resume();
    expect(loop.isPaused()).toBe(false);

    // First tick after resume resets lastTimestamp so no phantom time accumulates
    loop.tick(1000 / 60);
    expect(engine.updateCalls.length).toBe(1);

    loop.stop();
  });

  it("supports single-step debug mode", () => {
    const engine = new TestArcadeEngine();
    const mockCtx = fromPartial<CanvasRenderingContext2D>({});
    const loop = new ArcadeGameLoop(engine, () => mockCtx);

    loop.start();
    loop.pause();

    loop.stepOnce();
    expect(engine.updateCalls.length).toBe(1);
    expect(engine.renderCalls.length).toBe(1);
    expect(loop.isPaused()).toBe(true);

    loop.stop();
  });
});
