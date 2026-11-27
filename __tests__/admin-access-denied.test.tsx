import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("@clerk/nextjs", () => ({
  UserButton: () => (
    <div data-testid="mock-clerk-user-button">ClerkUserButton</div>
  ),
}));

describe("AdminAccessDenied In-Route Authorization Console", () => {
  let originalWriteText: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    originalWriteText = navigator.clipboard?.writeText;
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn() },
        configurable: true,
        writable: true,
      });
    }
    navigator.clipboard.writeText = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (navigator.clipboard && originalWriteText) {
      navigator.clipboard.writeText = originalWriteText as (
        data: string
      ) => Promise<void>;
    }
  });

  it("renders authenticated identity details and 403 status", () => {
    render(
      <AdminAccessDenied
        userId="user_clerk_98765"
        primaryEmail="author@example.com"
        displayName="Frederick de Ruiter"
      />
    );

    expect(screen.getByTestId("admin-access-denied-console")).toBeDefined();
    expect(
      screen.getByText(/403 Forbidden: Unlisted Author Identity/i)
    ).toBeDefined();
    expect(screen.getByText("Frederick de Ruiter")).toBeDefined();
    expect(screen.getByText("author@example.com")).toBeDefined();
    expect(screen.getByText("user_clerk_98765")).toBeDefined();
    expect(screen.getByTestId("mock-clerk-user-button")).toBeDefined();
  });

  it("copies email configuration snippet to clipboard on click", async () => {
    render(
      <AdminAccessDenied
        userId="user_clerk_98765"
        primaryEmail="author@example.com"
        displayName="Frederick de Ruiter"
      />
    );

    const emailCopyBtn = screen.getByRole("button", {
      name: "Copy email configuration snippet",
    });
    expect(emailCopyBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(emailCopyBtn);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'ADMIN_EMAILS="author@example.com"'
    );
    expect(emailCopyBtn.textContent).toContain("Copied");

    // Resets back after timeout
    act(() => {
      vi.advanceTimersByTime(2600);
    });

    expect(emailCopyBtn.textContent).toContain("Copy");
  });

  it("copies UID configuration snippet to clipboard on click", async () => {
    render(
      <AdminAccessDenied
        userId="user_clerk_98765"
        primaryEmail="author@example.com"
        displayName="Frederick de Ruiter"
      />
    );

    const uidCopyBtn = screen.getByRole("button", {
      name: "Copy User ID configuration snippet",
    });
    expect(uidCopyBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(uidCopyBtn);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'ADMIN_USER_IDS="user_clerk_98765"'
    );
    expect(uidCopyBtn.textContent).toContain("Copied");
  });

  it("triggers router.refresh() when Re-verify Authorization button is clicked", async () => {
    render(
      <AdminAccessDenied
        userId="user_clerk_98765"
        primaryEmail="author@example.com"
        displayName="Frederick de Ruiter"
      />
    );

    const refreshBtn = screen.getByRole("button", {
      name: /Re-verify Authorization/i,
    });
    expect(refreshBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    expect(mockRefresh).toHaveBeenCalled();
  });

  it("renders navigation link to return to case studies", () => {
    render(
      <AdminAccessDenied
        userId="user_clerk_98765"
        primaryEmail="author@example.com"
      />
    );

    const link = screen.getByRole("link", { name: /Return to Case Studies/i });
    expect(link.getAttribute("href")).toBe("/case-studies");
  });
});
