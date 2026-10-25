// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
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
});
