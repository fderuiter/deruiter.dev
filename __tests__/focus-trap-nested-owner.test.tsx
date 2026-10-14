import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { createPortal } from "react-dom";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

// #2042 playtest: a game dialog opened inside a trapped touch cabinet, or
// portaled out of it like the Field Manual, must own Tab. Before, the cabinet's
// trap also handled each Tab and pulled focus back out of the dialog.
function Dialog({ label }: { label: string }) {
  const ref = useFocusTrap<HTMLDivElement>(true, { returnFocus: false });
  return (
    <div ref={ref} role="dialog" aria-label={label}>
      <button>{label} first</button>
      <button>{label} last</button>
    </div>
  );
}

function Cabinet({ portal }: { portal: boolean }) {
  const ref = useFocusTrap<HTMLDivElement>(true, { returnFocus: false });
  const [open, setOpen] = React.useState(false);
  return (
    <div ref={ref}>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <button>Cabinet last</button>
      {open &&
        (portal ? (
          createPortal(<Dialog label="Manual" />, document.body)
        ) : (
          <Dialog label="Manual" />
        ))}
    </div>
  );
}

describe("useFocusTrap gives the keyboard to the dialog that holds focus (#2042)", () => {
  afterEach(cleanup);

  for (const portal of [false, true]) {
    const where = portal ? "portaled out of" : "nested in";
    it(`wraps Tab inside a dialog ${where} a trapped cabinet`, () => {
      render(<Cabinet portal={portal} />);
      fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));
      const first = screen.getByRole("button", { name: "Manual first" });
      const last = screen.getByRole("button", { name: "Manual last" });

      last.focus();
      fireEvent.keyDown(window, { key: "Tab" });
      expect(document.activeElement).toBe(first);

      fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(last);
    });
  }

  it("keeps the cabinet trap working once the focus is back in the cabinet", () => {
    render(<Cabinet portal={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));
    screen.getByRole("button", { name: "Cabinet last" }).focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Open dialog" })
    );
  });
});
