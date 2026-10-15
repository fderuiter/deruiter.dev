// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { PHONE_QUERY } from "@/components/arcade/mobile";
import { requestGarminAutoPause } from "@/components/garmin-watch/auto-pause";

const cabinetProps = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));

vi.mock("@/components/arcade/PlayCabinet", () => ({
  PlayCabinet: (props: Record<string, unknown>) => {
    cabinetProps.current = props;
    return null;
  },
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));

import { GarminWatchClient } from "@/components/arcade/GarminWatchClient";

describe("GarminWatchClient cabinet wiring (#2122)", () => {
  beforeEach(() => {
    cabinetProps.current = null;
  });
  afterEach(() => cleanup());

  it("fits the touch cabinet and pauses a run when the cabinet asks", () => {
    render(<GarminWatchClient />);
    expect(cabinetProps.current?.mobileLayout).toBe("fit");
    expect(cabinetProps.current?.onAutoPause).toBe(requestGarminAutoPause);
  });

  it("keeps the cabinet's F-for-fullscreen because no game key is F", () => {
    render(<GarminWatchClient />);
    expect(cabinetProps.current?.fullscreenKey).not.toBe(false);
    const controls = cabinetProps.current?.controls as Array<{ key: string }>;
    const keys = controls
      .flatMap((control) => control.key.split(/[\s/,–-]+/))
      .map((key) => key.toLowerCase());
    expect(keys).not.toContain("f");
    expect(keys).toEqual(expect.arrayContaining(["enter", "x", "p", "esc"]));
  });

  it("gates phones only, so tablets get the game", () => {
    const { container } = render(<GarminWatchClient />);
    const notice = container.querySelector(
      '[data-testid="desktop-only-notice"]'
    );
    expect(notice).not.toBeNull();
    expect(PHONE_QUERY.match(/max-width:\s*(\d+)px/)?.[1]).toBe("743");
    expect(notice?.className).toContain("(max-width:743px)");
  });
});
