// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import { render, cleanup } from "@testing-library/react";
import { PHONE_QUERY } from "@/components/arcade/mobile";
import {
  STUDY_DIRECTOR_AUTO_PAUSE_EVENT,
  requestStudyDirectorAutoPause,
} from "@/components/study-director-world/auto-pause";

const cabinetProps = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));
const touchDevice = vi.hoisted(() => ({ value: false }));

vi.mock("@/components/arcade/PlayCabinet", () => ({
  PlayCabinet: (props: Record<string, unknown>) => {
    cabinetProps.current = props;
    return null;
  },
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/hooks/useMediaQuery", async (original) => ({
  ...(await original<typeof import("@/hooks/useMediaQuery")>()),
  useMediaQuery: () => touchDevice.value,
}));

import { StudyDirectorClient } from "@/components/arcade/StudyDirectorClient";

describe("StudyDirectorClient cabinet wiring (#2076)", () => {
  beforeEach(() => {
    cabinetProps.current = null;
    touchDevice.value = false;
  });
  afterEach(() => cleanup());

  it("fits the touch cabinet and stops a walk when the cabinet asks", () => {
    render(<StudyDirectorClient />);
    expect(cabinetProps.current?.mobileLayout).toBe("fit");
    expect(cabinetProps.current?.onAutoPause).toBe(
      requestStudyDirectorAutoPause
    );
  });

  it("the auto-pause request dispatches the event the office listens for", () => {
    const listener = vi.fn();
    window.addEventListener(STUDY_DIRECTOR_AUTO_PAUSE_EVENT, listener);
    requestStudyDirectorAutoPause();
    window.removeEventListener(STUDY_DIRECTOR_AUTO_PAUSE_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("leaves F to the game on desktop and on a touch device", () => {
    render(<StudyDirectorClient />);
    expect(cabinetProps.current?.fullscreenKey).toBe(false);
    cleanup();
    touchDevice.value = true;
    render(<StudyDirectorClient />);
    expect(cabinetProps.current?.fullscreenKey).toBe(false);
  });

  it("keeps the desktop-only notice behind the phone query, so tablets get the game", () => {
    const { container } = render(<StudyDirectorClient />);
    const notice = container.querySelector(
      '[data-testid="desktop-only-notice"]'
    );
    expect(notice).not.toBeNull();
    expect(PHONE_QUERY.match(/max-width:\s*(\d+)px/)?.[1]).toBe("743");
    expect(notice?.className).toContain("(max-width:743px)");
  });
});
