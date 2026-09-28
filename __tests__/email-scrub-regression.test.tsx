/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import SchedulePage from "@/app/(desktop)/schedule/page";
import ContactPage from "@/app/(desktop)/contact/page";
import { Footer } from "@/components/Footer";
import { getPersonNode } from "@/lib/seo";

describe("Email Scrub Regression Invariant", () => {
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

  it("should not expose raw email address in Schema.org Person JSON-LD node", () => {
    const personNode = getPersonNode();
    expect(personNode.email).toBeUndefined();
    expect(JSON.stringify(personNode)).not.toContain("fpderuiter@gmail.com");
  });

  it("should not render mailto:fpderuiter@gmail.com in Footer", async () => {
    await act(async () => {
      root?.render(<Footer />);
    });

    const mailto = container?.querySelector('a[href*="mailto:"]');
    expect(mailto).toBeNull();
    expect(container?.textContent).not.toContain("fpderuiter@gmail.com");
    expect(container?.textContent).toContain("Contact ↗");
  });

  it("should not render mailto:fpderuiter@gmail.com in SchedulePage", async () => {
    await act(async () => {
      root?.render(<SchedulePage />);
    });

    const mailto = container?.querySelector('a[href*="mailto:"]');
    expect(mailto).toBeNull();
    expect(container?.textContent).not.toContain("fpderuiter@gmail.com");
    expect(container?.textContent).toContain("Send a Message");
  });

  it("should not render mailto:fpderuiter@gmail.com in ContactPage", async () => {
    await act(async () => {
      root?.render(<ContactPage />);
    });

    const mailto = container?.querySelector('a[href*="mailto:"]');
    expect(mailto).toBeNull();
    expect(container?.textContent).not.toContain("fpderuiter@gmail.com");
  });
});
