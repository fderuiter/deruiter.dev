/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import SchedulePage from "@/app/schedule/page";

describe("SchedulePage Component & Interactive Agenda Customizer", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
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

  it("renders the consultation header, topic categories, and timezone selector", async () => {
    await act(async () => {
      root?.render(<SchedulePage />);
    });

    expect(container?.textContent).toContain("Say Hi & Book a Chat");
    expect(container?.textContent).toContain("30 minutes on Google Meet");
    expect(container?.textContent).toContain("Interactive Agenda Customizer");
    expect(container?.textContent).toContain("Code, Systems & Web Craft");
    expect(container?.textContent).toContain("Healthcare & Clinical Data");
    expect(container?.textContent).toContain("Saying Hi & Bouncing Ideas");
    expect(container?.textContent).toContain("Time Zone:");
  });

  it("renders Google Calendar appointment booking button with context parameters", async () => {
    await act(async () => {
      root?.render(<SchedulePage />);
    });

    const bookingBtn = container?.querySelector(
      'a[href^="https://calendar.app.google/YnR5oxos7ZTLyvUp8"]'
    );
    expect(bookingBtn).not.toBeNull();
    expect(bookingBtn?.textContent).toContain("Choose a Time");
    expect(bookingBtn?.getAttribute("href")).toContain("tz=");
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

  it("toggles subtopic items and updates real-time agenda summary and estimated duration", async () => {
    await act(async () => {
      root?.render(<SchedulePage />);
    });

    // Initially no subtopics selected -> default 30-min settings
    expect(container?.textContent).toContain("Default 30-min settings");
    expect(container?.textContent).toContain("30-Min General Chat");
    expect(container?.textContent).toContain("Est. 30 Mins");

    // Click subtopic button
    const subtopicBtn = Array.from(
      container?.querySelectorAll("button") || []
    ).find((btn) =>
      btn.textContent?.includes("Next.js & React 19 Architecture")
    );
    expect(subtopicBtn).toBeDefined();

    await act(async () => {
      subtopicBtn?.click();
    });

    expect(container?.textContent).toContain("1 item selected");
    expect(container?.textContent).toContain(
      "Chat Agenda: Code, Systems & Web Craft"
    );
    expect(container?.textContent).toContain("Est. 10 Mins");

    // Click second subtopic button in a different category
    const secondSubtopicBtn = Array.from(
      container?.querySelectorAll("button") || []
    ).find((btn) => btn.textContent?.includes("GxP & eClinical Architecture"));
    expect(secondSubtopicBtn).toBeDefined();

    await act(async () => {
      secondSubtopicBtn?.click();
    });

    expect(container?.textContent).toContain("2 items selected");
    expect(container?.textContent).toContain("Est. 25 Mins");
  });

  it("unselecting all topics falls back to default 30-minute consultation settings", async () => {
    await act(async () => {
      root?.render(<SchedulePage />);
    });

    const subtopicBtn = Array.from(
      container?.querySelectorAll("button") || []
    ).find((btn) =>
      btn.textContent?.includes("Next.js & React 19 Architecture")
    );

    // Toggle on
    await act(async () => {
      subtopicBtn?.click();
    });
    expect(container?.textContent).toContain("1 item selected");

    // Toggle off
    await act(async () => {
      subtopicBtn?.click();
    });

    expect(container?.textContent).toContain("Default 30-min settings");
    expect(container?.textContent).toContain("30-Min General Chat");
    expect(container?.textContent).toContain("Est. 30 Mins");
  });

  it("toggles whole category via Select All / Deselect All", async () => {
    await act(async () => {
      root?.render(<SchedulePage />);
    });

    const categoryCard = Array.from(container?.querySelectorAll("h3") || [])
      .find((h3) => h3.textContent?.includes("Healthcare & Clinical Data"))
      ?.closest("div");

    const selectAllBtn = Array.from(
      categoryCard?.querySelectorAll("button") || []
    ).find((btn) => btn.textContent?.includes("Select All"));
    expect(selectAllBtn).toBeDefined();

    await act(async () => {
      selectAllBtn?.click();
    });

    expect(container?.textContent).toContain("3 items selected");
    expect(container?.textContent).toContain("Est. 35 Mins");

    // Toggle deselect all
    const deselectBtn = Array.from(
      categoryCard?.querySelectorAll("button") || []
    ).find((btn) => btn.textContent?.includes("Deselect All"));
    expect(deselectBtn).toBeDefined();

    await act(async () => {
      deselectBtn?.click();
    });

    expect(container?.textContent).toContain("Default 30-min settings");
  });

  it("pre-fills ContactForm with dynamic subject and message", async () => {
    await act(async () => {
      root?.render(<SchedulePage />);
    });

    const subjectInput = container?.querySelector(
      'input[name="subject"]'
    ) as HTMLInputElement;
    const messageInput = container?.querySelector(
      'textarea[name="message"]'
    ) as HTMLTextAreaElement;

    expect(subjectInput).not.toBeNull();
    expect(messageInput).not.toBeNull();

    expect(subjectInput.value).toBe("30-Min General Chat");
    expect(messageInput.value).toContain("30-minute general chat");

    // Toggle a subtopic
    const subtopicBtn = Array.from(
      container?.querySelectorAll("button") || []
    ).find((btn) => btn.textContent?.includes("Open-Source Tooling & DX"));

    await act(async () => {
      subtopicBtn?.click();
    });

    expect(subjectInput.value).toBe("Chat Agenda: Code, Systems & Web Craft");
    expect(messageInput.value).toContain("Open-Source Tooling & DX (10m)");
  });

  it("copies agenda context on Copy Agenda Context button click", async () => {
    await act(async () => {
      root?.render(<SchedulePage />);
    });

    const copyBtn = Array.from(
      container?.querySelectorAll("button") || []
    ).find((btn) => btn.textContent?.includes("Copy Agenda Context"));
    expect(copyBtn).toBeDefined();

    await act(async () => {
      copyBtn?.click();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("30-minute general chat")
    );
  });
});
