// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * #903: a dev server without Postgres must not put a permanent error badge on
 * the Next.js dev overlay, while production keeps reporting real failures.
 */
describe("Telemetry aggregate sync without a database (#903)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Mounts a probe using a fresh module instance and returns its refetch. */
  async function mountRefetch() {
    const { useTelemetry } = await import("@/hooks/useTelemetry");
    let refetch: ((o?: { force?: boolean }) => Promise<void>) | null = null;
    function Probe() {
      refetch = useTelemetry().refetch;
      return null;
    }
    await act(async () => root.render(<Probe />));
    return () =>
      act(async () => {
        await refetch!({ force: true });
      });
  }

  const offline = () =>
    new Response("{}", {
      status: 500,
      headers: { "X-Telemetry-Offline": "expected" },
    });

  it("warns once, and never errors, when the route reports an expected offline database", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => offline())
    );
    const refetch = await mountRefetch();

    await refetch();
    await refetch();
    await refetch();

    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain(
      "Telemetry aggregates are unavailable"
    );
  });

  it("still errors for a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    );
    const refetch = await mountRefetch();

    await refetch();

    expect(error).toHaveBeenCalledWith(
      "Background telemetry synchronization failed:",
      expect.anything()
    );
  });

  it("keeps reporting an unflagged 5xx (a production runtime) as an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 500 }))
    );
    const refetch = await mountRefetch();

    await refetch();

    expect(error).toHaveBeenCalledWith(
      "Background telemetry synchronization failed:",
      expect.anything()
    );
  });
});

describe("GET /api/telemetry when the database is unreachable (#903)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/services", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/services")>();
      return {
        ...actual,
        GetTelemetryAggregateStatsHandler: class {
          async execute() {
            return {
              success: false as const,
              error: {
                code: "STORAGE_UNAVAILABLE" as const,
                message: "connect ECONNREFUSED",
                recoverable: true,
                details: new Error("connect ECONNREFUSED"),
              },
            };
          }
        },
      };
    });
  });

  afterEach(() => {
    vi.doUnmock("@/lib/services");
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function callGet() {
    const { logger } = await import("@/lib/logger");
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => ({
      level: "warn",
      message: "",
      timestamp: "",
    }));
    const error = vi.spyOn(logger, "error").mockImplementation(() => ({
      level: "error",
      message: "",
      timestamp: "",
    }));
    const { GET } = await import("@/app/api/telemetry/route");
    const res = await GET();
    return { res, warn, error };
  }

  it("warns and flags the failure as expected outside a production runtime", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    const { res, warn, error } = await callGet();

    expect(res.status).toBe(500);
    expect(res.headers.get("X-Telemetry-Offline")).toBe("expected");
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("reports an error in a production runtime", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("PLAYWRIGHT_TEST", "");
    const { res, warn, error } = await callGet();

    expect(res.status).toBe(500);
    expect(error).toHaveBeenCalledWith(
      "Telemetry statistics aggregate query failed:",
      expect.any(Error)
    );
    expect(warn).not.toHaveBeenCalled();
    expect(res.headers.get("X-Telemetry-Offline")).toBeNull();
  });
});
