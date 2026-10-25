// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { requestClinicalChaosAutoPause } from "@/components/clinical-trial-chaos/auto-pause";

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

import { ClinicalChaosClient } from "@/components/arcade/ClinicalChaosClient";

describe("ClinicalChaosClient cabinet wiring (#2105)", () => {
  beforeEach(() => {
    cabinetProps.current = null;
  });
  afterEach(() => cleanup());

  it("fits the touch cabinet and pauses a shift when the cabinet asks", () => {
    render(<ClinicalChaosClient />);
    expect(cabinetProps.current?.mobileLayout).toBe("fit");
    expect(cabinetProps.current?.onAutoPause).toBe(
      requestClinicalChaosAutoPause
    );
  });

  it("keeps the cabinet's F-for-fullscreen because no game key is F", () => {
    render(<ClinicalChaosClient />);
    expect(cabinetProps.current?.fullscreenKey).not.toBe(false);
    const controls = cabinetProps.current?.controls as Array<{ key: string }>;
    const keys = controls
      .flatMap((control) => control.key.split(/[\s/,–-]+/))
      .map((key) => key.toLowerCase());
    expect(keys).not.toContain("f");
  });
});
