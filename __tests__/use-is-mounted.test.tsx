// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { renderHook, act, render } from "@testing-library/react";
import { useIsMounted } from "@/hooks/useIsMounted";
import { resolveBaseUrl } from "@/lib/domain";

describe("useIsMounted hook", () => {
  it("returns false during server-side rendering (SSR)", () => {
    function ServerProbe() {
      const isMounted = useIsMounted();
      return <div data-testid="probe">{String(isMounted)}</div>;
    }

    const html = renderToString(<ServerProbe />);
    expect(html).toContain('<div data-testid="probe">false</div>');
  });

  it("returns true once mounted on the client", () => {
    const { result } = renderHook(() => useIsMounted());
    expect(result.current).toBe(true);
  });

  it("remains true across subsequent re-renders", () => {
    const { result, rerender } = renderHook(() => useIsMounted());
    expect(result.current).toBe(true);

    act(() => {
      rerender();
    });

    expect(result.current).toBe(true);
  });

  it("prevents hydration mismatches during hydrateRoot and transitions from false to true", async () => {
    function HydrationProbe() {
      const isMounted = useIsMounted();
      return <div data-testid="probe">{isMounted ? "client-mounted" : "server-rendered"}</div>;
    }

    const container = document.createElement("div");
    container.innerHTML = renderToString(<HydrationProbe />);
    expect(container.textContent).toBe("server-rendered");

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await act(async () => {
      hydrateRoot(container, <HydrationProbe />);
    });

    // Zero hydration mismatch warnings emitted to console
    expect(consoleError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("client-mounted");
    consoleError.mockRestore();
  });

  it("correctly derives canonicalUrl across SSR and client mount states", () => {
    function CanonicalProbe() {
      const isMounted = useIsMounted();
      const canonicalUrl =
        isMounted && typeof window !== "undefined"
          ? window.location.href
          : `${resolveBaseUrl()}/`;
      return <span data-testid="canonical">{canonicalUrl}</span>;
    }

    // SSR render falls back to resolveBaseUrl() even in JSDOM where window exists
    const ssrHtml = renderToString(<CanonicalProbe />);
    expect(ssrHtml).toContain(`${resolveBaseUrl()}/`);

    // Client render derives full window.location.href
    const { getByTestId } = render(<CanonicalProbe />);
    expect(getByTestId("canonical").textContent).toBe(window.location.href);
  });
});
