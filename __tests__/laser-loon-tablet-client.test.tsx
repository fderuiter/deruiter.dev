// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { PHONE_QUERY } from "@/components/arcade/mobile";
import { requestLaserLoonAutoPause } from "@/components/laser-loon/auto-pause";

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

import { LaserLoonClient } from "@/components/arcade/LaserLoonClient";

describe("LaserLoonClient cabinet wiring (#2081)", () => {
  beforeEach(() => {
    cabinetProps.current = null;
  });
  afterEach(() => cleanup());

  it("fits the touch cabinet and pauses a run when the cabinet asks", () => {
    render(<LaserLoonClient />);
    expect(cabinetProps.current?.mobileLayout).toBe("fit");
    expect(cabinetProps.current?.onAutoPause).toBe(requestLaserLoonAutoPause);
  });

  it("keeps the cabinet's F-for-fullscreen because no game key is F", () => {
    render(<LaserLoonClient />);
    // fullscreenKey defaults to true; a game passes false only to claim F.
    expect(cabinetProps.current?.fullscreenKey).not.toBe(false);
    const controls = cabinetProps.current?.controls as Array<{ key: string }>;
    const keys = controls
      .flatMap((control) => control.key.split(/[\s/,-]+/))
      .map((key) => key.toLowerCase());
    expect(keys).not.toContain("f");
  });

  it("gates phones only: the notice sits behind the phone query, so tablets get the game", () => {
    const { container } = render(<LaserLoonClient />);
    const notice = container.querySelector(
      '[data-testid="desktop-only-notice"]'
    );
    expect(notice).not.toBeNull();
    expect(PHONE_QUERY.match(/max-width:\s*(\d+)px/)?.[1]).toBe("743");
    expect(notice?.className).toContain("(max-width:743px)");
  });
});
