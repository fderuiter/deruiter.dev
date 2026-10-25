// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";

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

  it("fits the touch cabinet and pauses through the cabinet's pause service", () => {
    render(<LaserLoonClient />);
    expect(cabinetProps.current?.mobileLayout).toBe("fit");
    // Laser Loon reads useCabinetPause() instead of a window event (#2357).
    expect(cabinetProps.current?.onAutoPause).toBeUndefined();
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
});
