// @vitest-environment node
import { describe, it, expect } from "vitest";
import { ObjectPool } from "@/lib/arcade";

interface Particle {
  id: number;
  x: number;
  y: number;
  active: boolean;
}

describe("ObjectPool", () => {
  it("pre-allocates objects up to initialCapacity", () => {
    let nextId = 1;
    const pool = new ObjectPool<Particle>({
      initialCapacity: 10,
      maxCapacity: 20,
      factory: () => ({ id: nextId++, x: 0, y: 0, active: false }),
      reset: (p) => {
        p.x = 0;
        p.y = 0;
        p.active = false;
      },
    });

    expect(pool.getCapacity()).toBe(10);
    expect(pool.getActiveCount()).toBe(0);
  });

  it("acquires and releases pooled objects", () => {
    let nextId = 1;
    const pool = new ObjectPool<Particle>({
      initialCapacity: 5,
      factory: () => ({ id: nextId++, x: 0, y: 0, active: false }),
      reset: (p) => {
        p.x = 0;
        p.y = 0;
        p.active = false;
      },
    });

    const p1 = pool.acquire();
    expect(p1).not.toBeNull();
    p1!.x = 100;
    p1!.active = true;

    expect(pool.getActiveCount()).toBe(1);

    pool.release(p1!);
    expect(pool.getActiveCount()).toBe(0);
    expect(p1!.x).toBe(0); // reset called
  });

  it("evicts oldest active item when overflow policy is FIFO", () => {
    let nextId = 1;
    const pool = new ObjectPool<Particle>({
      initialCapacity: 3,
      maxCapacity: 3,
      overflowPolicy: "fifo",
      factory: () => ({ id: nextId++, x: 0, y: 0, active: false }),
      reset: (p) => {
        p.x = 0;
        p.y = 0;
        p.active = false;
      },
    });

    const p1 = pool.acquire()!;
    const p2 = pool.acquire()!;
    const p3 = pool.acquire()!;

    expect(p1.id).toBe(1);
    expect(p2.id).toBe(2);
    expect(p3.id).toBe(3);
    expect(pool.getActiveCount()).toBe(3);

    // Acquiring 4th with FIFO should recycle p1 (oldest active)
    const p4 = pool.acquire()!;
    expect(p4.id).toBe(1);
    expect(pool.getActiveCount()).toBe(3);
  });

  it("rejects acquisition when pool is full and overflow policy is reject", () => {
    let nextId = 1;
    const pool = new ObjectPool<Particle>({
      initialCapacity: 2,
      maxCapacity: 2,
      overflowPolicy: "reject",
      factory: () => ({ id: nextId++, x: 0, y: 0, active: false }),
      reset: (p) => {
        p.x = 0;
        p.y = 0;
        p.active = false;
      },
    });

    pool.acquire();
    pool.acquire();
    expect(pool.getActiveCount()).toBe(2);

    const rejected = pool.acquire();
    expect(rejected).toBeNull();
  });

  it("iterates over active elements with forEachActive", () => {
    let nextId = 1;
    const pool = new ObjectPool<Particle>({
      initialCapacity: 5,
      factory: () => ({ id: nextId++, x: 0, y: 0, active: false }),
      reset: (p) => {
        p.x = 0;
        p.y = 0;
        p.active = false;
      },
    });

    const p1 = pool.acquire()!;
    p1.x = 10;
    const p2 = pool.acquire()!;
    p2.x = 20;

    const visited: number[] = [];
    pool.forEachActive((p) => {
      visited.push(p.x);
    });

    expect(visited).toEqual([10, 20]);
  });
});
