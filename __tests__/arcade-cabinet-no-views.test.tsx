// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    volume: 0.3,
    muted: false,
  }),
}));

// ADR 0062 (#2355): a cabinet that passes no views renders the markup it
// rendered before the view contract existed. The snapshot was recorded
// against PlayCabinet as it was on main before the contract landed.
describe("PlayCabinet without views (#2355)", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function renderPlain() {
    return render(
      <PlayCabinet
        gameId="plain"
        title="Plain Game"
        icon={<span>P</span>}
        instructions="Play."
        controls={[{ key: "Space", action: "Jump" }]}
        importComponent={() => Promise.resolve({})}
      >
        <div data-testid="plain-content">Plain</div>
      </PlayCabinet>
    );
  }

  it("renders the same attract markup", () => {
    const { container } = renderPlain();
    expect(container.innerHTML).toMatchSnapshot();
  });

  it("renders the same launched markup", async () => {
    vi.useFakeTimers();
    const { container } = renderPlain();
    const button = screen.getByRole("button", { name: /Launch Cabinet/i });
    await act(async () => {
      fireEvent.mouseEnter(button);
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId("plain-content")).toBeTruthy();
    expect(container.innerHTML).toMatchSnapshot();
  });
});
