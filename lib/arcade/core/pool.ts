/**
 * High-performance, zero-allocation generic ObjectPool.
 * Pre-allocates objects and recycles them without triggering V8 GC cycles.
 */

export type PoolOverflowPolicy = "fifo" | "reject";

export interface ObjectPoolConfig<T> {
  factory: () => T;
  reset: (item: T) => void;
  initialCapacity: number;
  maxCapacity?: number;
  overflowPolicy?: PoolOverflowPolicy;
}

export class ObjectPool<T> {
  private readonly factory: () => T;
  private readonly resetFn: (item: T) => void;
  private readonly maxCapacity: number;
  private readonly overflowPolicy: PoolOverflowPolicy;

  private items: T[] = [];
  private activeItems: T[] = [];
  private freeItems: T[] = [];

  constructor(config: ObjectPoolConfig<T>) {
    this.factory = config.factory;
    this.resetFn = config.reset;
    const initialCapacity = Math.max(1, config.initialCapacity);
    this.maxCapacity = Math.max(
      initialCapacity,
      config.maxCapacity ?? initialCapacity
    );
    this.overflowPolicy = config.overflowPolicy ?? "fifo";

    // Pre-allocate items
    for (let i = 0; i < initialCapacity; i++) {
      const obj = this.factory();
      this.items.push(obj);
    }
    this.freeItems = [...this.items].reverse();
  }

  /**
   * Acquires an inactive object from the pool, or recycles/expands according to policy.
   */
  public acquire(): T | null {
    if (this.freeItems.length > 0) {
      const item = this.freeItems.pop()!;
      this.activeItems.push(item);
      return item;
    }

    // Can we expand the pool up to maxCapacity?
    if (this.items.length < this.maxCapacity) {
      const item = this.factory();
      this.items.push(item);
      this.activeItems.push(item);
      return item;
    }

    // Pool is saturated: check overflow policy
    if (this.overflowPolicy === "fifo") {
      // Evict oldest active item
      const recycled = this.activeItems.shift()!;
      this.resetFn(recycled);
      this.activeItems.push(recycled);
      return recycled;
    }

    // Reject policy
    return null;
  }

  /**
   * Releases an active object back to the pool.
   */
  public release(item: T): void {
    const index = this.activeItems.indexOf(item);
    if (index !== -1) {
      this.activeItems.splice(index, 1);
      this.resetFn(item);
      this.freeItems.push(item);
    }
  }

  /**
   * Iterates through all currently active items in the pool.
   */
  public forEachActive(callback: (item: T, index: number) => void): void {
    for (let i = 0; i < this.activeItems.length; i++) {
      callback(this.activeItems[i], i);
    }
  }

  public getActiveCount(): number {
    return this.activeItems.length;
  }

  public getCapacity(): number {
    return this.items.length;
  }

  public clear(): void {
    for (const item of this.activeItems) {
      this.resetFn(item);
      this.freeItems.push(item);
    }
    this.activeItems = [];
  }
}
