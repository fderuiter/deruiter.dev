// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { PHONE_QUERY } from "@/components/arcade/mobile";
import { requestPattyAutoPause } from "@/components/patty-drive-thru/auto-pause";

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

import { PattyDriveThruClient } from "@/components/arcade/PattyDriveThruClient";

describe("PattyDriveThruClient cabinet wiring (#2116)", () => {
  beforeEach(() => {
    cabinetProps.current = null;
  });
  afterEach(() => cleanup());

  it("fits the touch cabinet and pauses a shift when the cabinet asks", () => {
    render(<PattyDriveThruClient />);
    expect(cabinetProps.current?.mobileLayout).toBe("fit");
    expect(cabinetProps.current?.onAutoPause).toBe(requestPattyAutoPause);
  });

  it("keeps the cabinet's F-for-fullscreen because no game key is F", () => {
    render(<PattyDriveThruClient />);
    expect(cabinetProps.current?.fullscreenKey).not.toBe(false);
    const controls = cabinetProps.current?.controls as Array<{ key: string }>;
    const keys = controls
      .flatMap((control) => control.key.split(/[\s/,–-]+/))
      .map((key) => key.toLowerCase());
    expect(keys).not.toContain("f");
    // The keys it lists are the ones the booth handles.
    expect(keys).toEqual(expect.arrayContaining(["a", "d", "p", "q", "e"]));
  });

  it("gates phones only, so tablets get the game", () => {
    const { container } = render(<PattyDriveThruClient />);
    const notice = container.querySelector(
      '[data-testid="desktop-only-notice"]'
    );
    expect(notice).not.toBeNull();
    expect(PHONE_QUERY.match(/max-width:\s*(\d+)px/)?.[1]).toBe("743");
    expect(notice?.className).toContain("(max-width:743px)");
  });
});
