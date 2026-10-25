// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { requestTeAutoPause } from "@/components/trial-and-error/auto-pause";

const cabinetProps = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));
const screenIsTablet = vi.hoisted(() => ({ value: false }));
const phoneWindow = vi.hoisted(() => ({ value: false }));

vi.mock("@/components/arcade/PlayCabinet", () => ({
  PlayCabinet: (props: Record<string, unknown>) => {
    cabinetProps.current = props;
    return null;
  },
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));

beforeEach(() => {
  cabinetProps.current = null;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes("min-width: 450px")
        ? screenIsTablet.value
        : query.includes("pointer: coarse")
          ? phoneWindow.value
          : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});
afterEach(() => cleanup());

import { TrialAndErrorClient } from "@/components/arcade/TrialAndErrorClient";

describe("TrialAndErrorClient cabinet wiring (#2120)", () => {
  it("fits the table to a tablet and settles scoring when the cabinet pauses", () => {
    render(<TrialAndErrorClient />);
    expect(cabinetProps.current?.mobileLayout).toBe("fit");
    expect(cabinetProps.current?.onAutoPause).toBe(requestTeAutoPause);
  });

  it("keeps the scrolling stage for a phone", () => {
    phoneWindow.value = true;
    screenIsTablet.value = false;
    render(<TrialAndErrorClient />);
    expect(cabinetProps.current?.mobileLayout).toBe("scroll");
  });

  it("fits a Split View pane, a phone-wide window that is taller than a phone", () => {
    phoneWindow.value = true;
    screenIsTablet.value = true;
    render(<TrialAndErrorClient />);
    expect(cabinetProps.current?.mobileLayout).toBe("fit");
  });

  it("keeps F for fullscreen because no table key is F", () => {
    render(<TrialAndErrorClient />);
    expect(cabinetProps.current?.fullscreenKey).not.toBe(false);
    const controls = cabinetProps.current?.controls as Array<{ key: string }>;
    const keys = controls
      .flatMap((control) => control.key.split(/[\s/,–-]+/))
      .map((key) => key.toLowerCase());
    expect(keys).not.toContain("f");
  });
});
