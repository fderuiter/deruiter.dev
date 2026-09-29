import { vi } from "vitest";
import { File as NodeFile, Blob as NodeBlob } from "node:buffer";

// Ensure standards-compliant File and Blob implementations with arrayBuffer() in JSDOM / Node
if (
  typeof globalThis.File === "undefined" ||
  typeof globalThis.File.prototype.arrayBuffer !== "function"
) {
  Object.defineProperty(globalThis, "File", {
    value: NodeFile,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, "Blob", {
    value: NodeBlob,
    writable: true,
    configurable: true,
  });
}

// Mock localStorage if missing or defective in JSDOM / Node 25+
export class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

if (
  typeof globalThis.localStorage === "undefined" ||
  typeof globalThis.localStorage.getItem !== "function"
) {
  const storageInstance = new MockStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: storageInstance,
    writable: true,
    configurable: true,
  });
}

// Mock ResizeObserver
if (typeof globalThis.ResizeObserver === "undefined") {
  class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  globalThis.ResizeObserver =
    MockResizeObserver as unknown as typeof ResizeObserver;
}

// Mock IntersectionObserver
if (typeof globalThis.IntersectionObserver === "undefined") {
  class MockIntersectionObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);
  }
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
}

// Polyfill PointerEvent (unsupported by jsdom@26, pinned in package.json overrides)
if (typeof globalThis.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    width: number;
    height: number;
    pressure: number;
    tangentialPressure: number;
    tiltX: number;
    tiltY: number;
    twist: number;
    pointerType: string;
    isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
      this.tangentialPressure = params.tangentialPressure ?? 0;
      this.tiltX = params.tiltX ?? 0;
      this.tiltY = params.tiltY ?? 0;
      this.twist = params.twist ?? 0;
      this.pointerType = params.pointerType ?? "mouse";
      this.isPrimary = params.isPrimary ?? false;
    }
  }
  globalThis.PointerEvent =
    PointerEventPolyfill as unknown as typeof PointerEvent;
}

// Mock Canvas 2D and WebGL contexts
const originalGetContext = HTMLCanvasElement.prototype.getContext;

HTMLCanvasElement.prototype.getContext = function (
  this: HTMLCanvasElement,
  contextId: string,
  ...args: unknown[]
): RenderingContext | null {
  if (contextId === "2d") {
    const el = this as HTMLCanvasElement & { _ctx2d?: RenderingContext };
    if (!el._ctx2d) {
      el._ctx2d = {
        canvas: this,
        font: "16px sans-serif",
        fillStyle: "#ffffff",
        strokeStyle: "#000000",
        lineWidth: 1,
        globalAlpha: 1,
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        clearRect: vi.fn(),
        setLineDash: vi.fn(),
        getLineDash: vi.fn(() => []),
        clip: vi.fn(),
        ellipse: vi.fn(),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        createPattern: vi.fn(),
        getImageData: vi.fn(
          (_sx?: number, _sy?: number, sw?: number, sh?: number) => {
            const width = typeof sw === "number" && sw > 0 ? sw : 256;
            const height = typeof sh === "number" && sh > 0 ? sh : 256;
            return {
              width,
              height,
              data: new Uint8ClampedArray(width * height * 4),
            };
          }
        ),
        putImageData: vi.fn(),
        createImageData: vi.fn((w?: number | ImageData, h?: number) => {
          const width = typeof w === "number" && w > 0 ? w : 256;
          const height = typeof h === "number" && h > 0 ? h : 256;
          return {
            width,
            height,
            data: new Uint8ClampedArray(width * height * 4),
          };
        }),
        drawImage: vi.fn(),
        save: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        arc: vi.fn(),
        arcTo: vi.fn(),
        fill: vi.fn(),
        rect: vi.fn(),
        quadraticCurveTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        roundRect: vi.fn(),
        measureText: vi.fn((text: string) => ({
          width: (text || "").length * 8,
          height: 16,
        })),
        transform: vi.fn(),
        resetTransform: vi.fn(),
      } as unknown as RenderingContext;
    }
    return el._ctx2d;
  }

  if (
    contextId === "webgl" ||
    contextId === "webgl2" ||
    contextId === "experimental-webgl"
  ) {
    return {
      canvas: this,
      getExtension: vi.fn(),
      getParameter: vi.fn(() => "Mock WebGL"),
      createBuffer: vi.fn(),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      createShader: vi.fn(),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      createProgram: vi.fn(),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      useProgram: vi.fn(),
      viewport: vi.fn(),
      clear: vi.fn(),
      clearColor: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      isContextLost: vi.fn(() => false),
    } as unknown as RenderingContext;
  }

  if (typeof originalGetContext === "function") {
    return (
      originalGetContext as (...a: unknown[]) => RenderingContext | null
    ).apply(this, [contextId, ...args]);
  }
  return null;
} as typeof HTMLCanvasElement.prototype.getContext;

// Mock Clerk Next.js client and server modules for offline testing
vi.mock("@clerk/nextjs", () => {
  return {
    ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
    SignIn: () => null,
    SignUp: () => null,
    UserButton: () => null,
    useAuth: () => ({ isLoaded: true, isSignedIn: false, userId: null }),
    useUser: () => ({ isLoaded: true, isSignedIn: false, user: null }),
  };
});

vi.mock("@clerk/nextjs/server", () => {
  return {
    auth: vi.fn().mockResolvedValue({ userId: null, sessionId: null }),
    currentUser: vi.fn().mockResolvedValue(null),
    clerkMiddleware: vi.fn((cb) => {
      return (req: unknown, ...args: unknown[]) => {
        const mockAuth = {
          protect: vi.fn().mockResolvedValue(undefined),
          userId: null,
          sessionId: null,
        };
        return cb(mockAuth, req, ...args);
      };
    }),
    createRouteMatcher: vi.fn(
      (routes: string[]) => (req: { nextUrl: { pathname: string } }) => {
        return routes.some((pattern) => {
          const regex = new RegExp(
            "^" + pattern.replace(/\(\.\*\)/g, ".*") + "$"
          );
          return regex.test(req.nextUrl.pathname);
        });
      }
    ),
  };
});

vi.mock("@clerk/themes", () => {
  return {
    dark: {},
  };
});

vi.mock("next/font/local", () => {
  return {
    default: () => ({
      variable: "--font-opendyslexic",
      className: "font-opendyslexic",
    }),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
