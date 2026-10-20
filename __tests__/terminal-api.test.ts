// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Interactive Console API and Sandbox Event Bridge", () => {
  let mockWindow: any;
  let loggedGreeting = false;

  beforeEach(() => {
    // Set up a mock window object representing the browser window global
    mockWindow = {
      location: {
        pathname: "/case-studies/imednet-python-sdk",
      },
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Mock global custom event
    global.CustomEvent = class MockCustomEvent {
      type: string;
      detail: any;
      constructor(type: string, options: any = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    } as any;

    loggedGreeting = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should expose window-level API namespaces and display the greeting", () => {
    const originalConsoleLog = console.log;
    console.log = vi.fn(() => {
      loggedGreeting = true;
    });

    // Simulate the mounting logic inside SandboxTerminal
    const setupConsoleApi = (win: any) => {
      if (!win.location.pathname.includes("/case-studies/imednet-python-sdk")) {
        return;
      }

      const terminalApi = {
        run: (cmdText: string) => {
          if (typeof cmdText !== "string") {
            return;
          }
          win.dispatchEvent(
            new CustomEvent("terminal:run", { detail: { command: cmdText } })
          );
        },
        help: () => {
          console.log("Supported API commands...");
        },
      };

      win.terminal = terminalApi;
      win.imednet = terminalApi;

      console.log("Styled greeting!");
    };

    setupConsoleApi(mockWindow);

    expect(mockWindow.terminal).toBeDefined();
    expect(mockWindow.imednet).toBeDefined();
    expect(mockWindow.terminal.run).toBeTypeOf("function");
    expect(loggedGreeting).toBe(true);

    console.log = originalConsoleLog;
  });

  it("should disallow registration on non-SDK pages", () => {
    mockWindow.location.pathname = "/case-studies/some-other-slug";

    const setupConsoleApi = (win: any) => {
      if (!win.location.pathname.includes("/case-studies/imednet-python-sdk")) {
        return;
      }

      const terminalApi = {
        run: (cmdText: string) => {},
      };
      win.terminal = terminalApi;
      win.imednet = terminalApi;
    };

    setupConsoleApi(mockWindow);

    expect(mockWindow.terminal).toBeUndefined();
    expect(mockWindow.imednet).toBeUndefined();
  });

  it("should dispatch 'terminal:run' CustomEvent when run() is called", () => {
    const setupConsoleApi = (win: any) => {
      const terminalApi = {
        run: (cmdText: string) => {
          if (typeof cmdText !== "string") return;
          win.dispatchEvent(
            new CustomEvent("terminal:run", { detail: { command: cmdText } })
          );
        },
      };
      win.terminal = terminalApi;
    };

    setupConsoleApi(mockWindow);
    mockWindow.terminal.run("imednet studies list");

    expect(mockWindow.dispatchEvent).toHaveBeenCalledTimes(1);
    const lastCallArg = mockWindow.dispatchEvent.mock.calls[0][0];
    expect(lastCallArg.type).toBe("terminal:run");
    expect(lastCallArg.detail).toEqual({ command: "imednet studies list" });
  });

  it("should clean up global namespaces when unmounted", () => {
    const setupConsoleApi = (win: any) => {
      const terminalApi = {
        run: () => {},
      };
      win.terminal = terminalApi;
      win.imednet = terminalApi;

      return () => {
        delete win.terminal;
        delete win.imednet;
      };
    };

    const cleanup = setupConsoleApi(mockWindow);
    expect(mockWindow.terminal).toBeDefined();
    expect(mockWindow.imednet).toBeDefined();

    cleanup();

    expect(mockWindow.terminal).toBeUndefined();
    expect(mockWindow.imednet).toBeUndefined();
  });
});
