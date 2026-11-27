import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AdminLoginGateway } from "@/components/admin/AdminLoginGateway";

vi.mock("@clerk/nextjs", () => ({
  SignIn: (props: Record<string, unknown>) => (
    <div data-testid="clerk-signin" data-props={JSON.stringify(props)}>
      ClerkSignInWidget
    </div>
  ),
}));

describe("AdminLoginGateway Production Component Suite", () => {
  let originalWriteText: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
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
    if (navigator.clipboard && originalWriteText) {
      navigator.clipboard.writeText = originalWriteText as (
        data: string
      ) => Promise<void>;
    }
  });

  it("renders system telemetry and node observability metadata", () => {
    render(<AdminLoginGateway />);

    expect(screen.getByText("AUTHOR GATEWAY • V2.4")).toBeDefined();
    expect(screen.getByText("Edge Diagnostics")).toBeDefined();
    expect(screen.getByText("gateway-iad1.sys")).toBeDefined();
    expect(screen.getByText("iad1-us-east")).toBeDefined();
    expect(screen.getByText("0.00ms penalty")).toBeDefined();
    expect(screen.getByText("SHA-256 Token")).toBeDefined();
    expect(screen.getByText("Env Allowlist")).toBeDefined();
  });

  it("renders the embedded Clerk SignIn component with appropriate routes", () => {
    render(<AdminLoginGateway />);

    const signIn = screen.getByTestId("clerk-signin");
    expect(signIn).toBeDefined();

    const props = JSON.parse(signIn.getAttribute("data-props") || "{}");
    expect(props.path).toBe("/admin/login");
    expect(props.fallbackRedirectUrl).toBe("/admin");
    expect(props.routing).toBe("path");
  });

  it("renders hardware WebAuthn and edge micro-metrics ribbon", () => {
    render(<AdminLoginGateway />);

    expect(screen.getByText("WebAuthn")).toBeDefined();
    expect(screen.getByText("Passkey Ready")).toBeDefined();
    expect(screen.getByText("0ms Penalty")).toBeDefined();
    expect(screen.getByText("Zero-Prerender")).toBeDefined();
    expect(screen.getByText("Edge Guard")).toBeDefined();
    expect(screen.getByText("Rate-Limited")).toBeDefined();
  });

  it("toggles the architecture and allowlist setup drawer and copies snippets", async () => {
    render(<AdminLoginGateway />);

    // Toggle drawer open
    const toggleButton = screen.getByRole("button", {
      name: /Environment Setup & Architecture/i,
    });
    expect(toggleButton).toBeDefined();

    fireEvent.click(toggleButton);

    expect(screen.getByText("npm run setup:clerk")).toBeDefined();
    expect(
      screen.getByText('ADMIN_EMAILS="your-email@example.com"')
    ).toBeDefined();

    // Copy wizard command
    const copyWizardButton = screen.getByRole("button", {
      name: /Copy setup wizard command/i,
    });
    fireEvent.click(copyWizardButton);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "npm run setup:clerk"
    );

    // Copy email snippet
    const copyEmailButton = screen.getByRole("button", {
      name: /Copy admin email template/i,
    });
    fireEvent.click(copyEmailButton);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'ADMIN_EMAILS="your-email@example.com"'
    );

    // Toggle drawer closed
    fireEvent.click(toggleButton);
    expect(screen.queryByText("npm run setup:clerk")).toBeNull();
  });

  it("handles clipboard write failures gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    navigator.clipboard.writeText = vi
      .fn()
      .mockRejectedValue(new Error("Clipboard denied"));
    const originalExecCommand = document.execCommand;
    document.execCommand = vi.fn().mockReturnValue(false);

    render(<AdminLoginGateway />);

    const toggleButton = screen.getByRole("button", {
      name: /Environment Setup & Architecture/i,
    });
    fireEvent.click(toggleButton);

    const copyWizardButton = screen.getByRole("button", {
      name: /Copy setup wizard command/i,
    });
    fireEvent.click(copyWizardButton);

    // Allow promise rejection to propagate
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to copy snippet to clipboard:",
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
    document.execCommand = originalExecCommand;
  });

  it("provides an accessible return navigation link to case studies", () => {
    render(<AdminLoginGateway />);

    const returnLink = screen.getByRole("link", {
      name: /Return to Case Studies Index/i,
    });
    expect(returnLink).toBeDefined();
    expect(returnLink.getAttribute("href")).toBe("/case-studies");
  });
});
