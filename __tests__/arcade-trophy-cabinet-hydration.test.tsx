// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React, { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";

import { ArcadeTrophyCabinet } from "@/components/arcade/ArcadeTrophyCabinet";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// #1756: useSyncExternalStore compares snapshots by identity. A server
// snapshot rebuilt on every call makes React log "The result of
// getServerSnapshot should be cached to avoid an infinite loop" on /arcade.
describe("ArcadeTrophyCabinet hydration (#1756)", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    vi.restoreAllMocks();
  });

  it("hydrates without the uncached getServerSnapshot warning", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    container = document.createElement("div");
    container.innerHTML = renderToString(<ArcadeTrophyCabinet />);
    document.body.appendChild(container);

    await act(async () => {
      root = hydrateRoot(container!, <ArcadeTrophyCabinet />);
    });

    const messages = errorSpy.mock.calls.map((args) => String(args[0]));
    expect(
      messages.filter((m) => m.includes("getServerSnapshot should be cached"))
    ).toEqual([]);
  });
});
