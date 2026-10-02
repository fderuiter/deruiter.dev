// @vitest-environment node
import { describe, it, expect } from "vitest";
import { WorkingWithDuckEngine } from "@/lib/working-with-duck-engine";

describe("WorkingWithDuckEngine", () => {
  it("initializes Duck simulator with starting happy mood and idle state", () => {
    const engine = new WorkingWithDuckEngine();
    const snapshot = engine.getSnapshot();

    expect(snapshot.duck.mood).toBe("happy");
    expect(snapshot.score).toBe(0);
    expect(snapshot.duck.behaviorState).toBe("IDLE_ROAM");
  });

  it("performs trick and awards trick bonus points", () => {
    const engine = new WorkingWithDuckEngine();
    engine.performTrick("HIGH_FIVE");

    const snapshot = engine.getSnapshot();
    expect(snapshot.duck.behaviorState).toBe("PERFORMING_TRICK");
    expect(snapshot.score).toBeGreaterThan(0);
  });

  it("updates simulation ticks and physics", () => {
    const engine = new WorkingWithDuckEngine();
    engine.update(1 / 60);

    const snapshot = engine.getSnapshot();
    expect(snapshot.duck.x).toBeDefined();
    expect(snapshot.duck.y).toBeDefined();
  });
});
