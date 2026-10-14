// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, cleanup } from "@testing-library/react";
import { PHONE_QUERY } from "@/components/arcade/mobile";
import {
  PROTOCOL_DRIFT_AUTO_PAUSE_EVENT,
  requestProtocolDriftAutoPause,
} from "@/components/protocol-drift/auto-pause";

const cabinetProps = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

vi.mock("@/components/arcade/PlayCabinet", () => ({
  PlayCabinet: (props: Record<string, unknown>) => {
    cabinetProps.current = props;
    return null;
  },
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

import { ProtocolDriftClient } from "@/components/arcade/ProtocolDriftClient";

describe("ProtocolDriftClient cabinet wiring (#2045)", () => {
  beforeEach(() => {
    cabinetProps.current = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("lays the workbench out to fit the touch cabinet viewport", () => {
    render(<ProtocolDriftClient />);
    expect(cabinetProps.current?.mobileLayout).toBe("fit");
  });

  it("pauses a running clock when the cabinet asks, and needs no control dock", () => {
    render(<ProtocolDriftClient />);
    expect(cabinetProps.current?.controlDock).toBeUndefined();
    expect(cabinetProps.current?.onAutoPause).toBe(
      requestProtocolDriftAutoPause
    );
  });

  it("keeps the desktop-only notice behind the phone query, so tablets get the game", () => {
    const { container } = render(<ProtocolDriftClient />);
    const notice = container.querySelector(
      '[data-testid="desktop-only-notice"]'
    );
    expect(notice).not.toBeNull();
    // Phones and Split View panes narrower than 744px keep the notice. Every
    // iPad in both orientations is wider than that, so it gets the game.
    const phoneBound = PHONE_QUERY.match(/max-width:\s*(\d+)px/);
    expect(phoneBound?.[1]).toBe("743");
    expect(notice?.className).toContain("(max-width:743px)");
    expect(notice?.className).toContain("(max-height:500px)");
  });

  it("the auto-pause request dispatches the event the workbench listens for", () => {
    const listener = vi.fn();
    window.addEventListener(PROTOCOL_DRIFT_AUTO_PAUSE_EVENT, listener);
    requestProtocolDriftAutoPause();
    window.removeEventListener(PROTOCOL_DRIFT_AUTO_PAUSE_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("Protocol Drift touch CSS (#2045)", () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), "app/arcade/arcade.css"),
    "utf8"
  );

  it("sizes every control to 44px and every label to 12px on the touch cabinet", () => {
    expect(css).toMatch(
      /\.pd-touch button,\s*\.pd-touch summary \{\s*min-height: 44px;/
    );
    expect(css).toMatch(
      /\.pd-touch \.text-\\\[9px\\\],\s*\.pd-touch \.text-\\\[10px\\\],\s*\.pd-touch \.text-\\\[11px\\\] \{\s*font-size: 0\.75rem;/
    );
  });

  it("gives chip ports a 44px hit area and keeps canvas gestures inside the canvas", () => {
    expect(css).toMatch(
      /\.pd-touch \.react-flow__handle::after \{[^}]*inset: -17px;/
    );
    expect(css).toMatch(/\.pd-touch \.react-flow \{\s*touch-action: none;/);
  });

  it("turns the toolbox and rail into strips in a narrow cabinet", () => {
    expect(css).toContain("@media (max-width: 899px)");
    expect(css).toMatch(/\.pd-touch-toolbox,\s*\.pd-touch-rail \{/);
  });
});
