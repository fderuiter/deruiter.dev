// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { requestFbbAutoPause } from "@/components/for-better-or-bulk/auto-pause";

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

import { ForBetterOrBulkClient } from "@/components/arcade/ForBetterOrBulkClient";

describe("ForBetterOrBulkClient cabinet wiring (#2123)", () => {
  beforeEach(() => {
    cabinetProps.current = null;
  });
  afterEach(() => cleanup());

  it("fits the touch cabinet and pauses a day when the cabinet asks", () => {
    render(<ForBetterOrBulkClient />);
    expect(cabinetProps.current?.mobileLayout).toBe("fit");
    expect(cabinetProps.current?.onAutoPause).toBe(requestFbbAutoPause);
  });

  it("keeps F for the game's work key, so fullscreen stays on the button", () => {
    render(<ForBetterOrBulkClient />);
    expect(cabinetProps.current?.fullscreenKey).toBe(false);
  });

  it("gates phones only, so tablets get the game", () => {
    const { container } = render(<ForBetterOrBulkClient />);
    const notice = container.querySelector(
      '[data-testid="desktop-only-notice"]'
    );
    expect(notice).not.toBeNull();
    expect(notice?.className).toContain("(max-width:743px)");
  });
});
