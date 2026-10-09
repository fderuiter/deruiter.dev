import React, { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  Overlay,
  OverlayButton,
  type DeviceKind,
} from "@/components/study-director-world/TeamPieces";

const Harness: React.FC<{
  device?: DeviceKind;
  onClose: () => void;
  onBack?: () => void;
}> = ({ device, onClose, onBack }) => {
  const first = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button">Opener</button>
      <Overlay
        titleId="t"
        title="Test screen"
        testId="screen"
        device={device}
        back={onBack ? { label: "Back to desk", run: onBack } : undefined}
        onClose={onClose}
        initialFocusRef={first}
      >
        <OverlayButton ref={first}>First</OverlayButton>
        <OverlayButton>Last</OverlayButton>
      </Overlay>
    </>
  );
};

afterEach(cleanup);

describe("device overlays", () => {
  it.each(["monitor", "phone"] as const)(
    "draws a %s with a visible close button",
    (device) => {
      const onClose = vi.fn();
      render(<Harness device={device} onClose={onClose} />);
      expect(screen.getByTestId("screen").dataset.device).toBe(device);
      fireEvent.click(screen.getByRole("button", { name: "Close window" }));
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  );

  it("labels each device on its title bar", () => {
    render(<Harness device="phone" onClose={() => {}} />);
    expect(screen.getByText("Desk phone")).toBeTruthy();
    cleanup();
    render(<Harness device="monitor" onClose={() => {}} />);
    expect(screen.getByText("Workstation")).toBeTruthy();
  });

  it("offers a way back only when there is one", () => {
    const onBack = vi.fn();
    render(<Harness device="monitor" onClose={() => {}} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: "Back to desk" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    cleanup();
    render(<Harness device="monitor" onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: "Back to desk" })).toBeNull();
  });

  it("closes on Escape and keeps focus inside the device", async () => {
    const onClose = vi.fn();
    render(<Harness device="monitor" onClose={onClose} />);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "First" })
      )
    );
    fireEvent.keyDown(screen.getByTestId("screen"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Test screen" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("has no device chrome without a device", () => {
    render(<Harness onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: "Close window" })).toBeNull();
    expect(screen.getByTestId("screen").dataset.device).toBeUndefined();
  });
});
