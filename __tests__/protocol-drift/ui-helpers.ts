import { vi } from "vitest";

/**
 * jsdom lacks the geometry APIs React Flow reads. This installs the minimal
 * stubs (DOMMatrixReadOnly, a ResizeObserver that reports a fixed size) and
 * mocks the sound engine so no test touches Web Audio.
 */
export function installFlowMocks(): void {
  class MockDOMMatrixReadOnly {
    m22: number;
    constructor(transform?: string) {
      const scale = transform?.match(/scale\(([1-9.]+)\)/)?.[1];
      this.m22 = scale ? Number(scale) : 1;
    }
  }
  vi.stubGlobal("DOMMatrixReadOnly", MockDOMMatrixReadOnly);

  class FixedResizeObserver {
    private callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.callback(
        [
          {
            target,
            contentRect: { width: 1200, height: 600 } as DOMRectReadOnly,
          } as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver
      );
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", FixedResizeObserver);
}
