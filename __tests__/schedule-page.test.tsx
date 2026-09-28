/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import SchedulePage from "@/app/(desktop)/schedule/page";

describe("SchedulePage Component", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
      container = null;
    }
  });

  it("renders the consultation header and description", async () => {
    await act(async () => {
      root?.render(<SchedulePage />);
    });

    expect(container?.textContent).toContain("Say Hi & Book a Chat");
    expect(container?.textContent).toContain("30 minutes on Google Meet");
    expect(container?.textContent).toContain("30-Minute Chats");
    expect(container?.textContent).toContain("Code, Systems & Web Craft");
    expect(container?.textContent).toContain("Healthcare & Clinical Data");
  });

  it("renders Google Calendar appointment booking button and spec badges", async () => {
    await act(async () => {
      root?.render(<SchedulePage />);
    });

    const bookingBtn = container?.querySelector(
      'a[href="https://calendar.app.google/YnR5oxos7ZTLyvUp8"]'
    );
    expect(bookingBtn).not.toBeNull();
    expect(bookingBtn?.textContent).toContain("Choose a Time");
    expect(container?.textContent).toContain("Find a time that works.");
    expect(container?.textContent).toContain("Google Meet");
  });

  it("renders correct contact links including contact form and linkedin", async () => {
    await act(async () => {
      root?.render(<SchedulePage />);
    });

    const contactLink = container?.querySelector('a[href="/contact"]');
    expect(contactLink).not.toBeNull();
    expect(contactLink?.textContent).toContain("Send a Message");

    const emailLink = container?.querySelector(
      'a[href="mailto:fpderuiter@gmail.com"]'
    );
    expect(emailLink).toBeNull();

    const linkedinLink = container?.querySelector(
      'a[href="https://www.linkedin.com/in/frederick-de-ruiter-88012467/"]'
    );
    expect(linkedinLink).not.toBeNull();
    expect(linkedinLink?.textContent).toContain("LinkedIn Profile");
  });
});
